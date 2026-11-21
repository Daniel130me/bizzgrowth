// Server-only marketplace authorization and abuse protection.
//
// Every marketplace route goes through these helpers. Keeping the checks in
// one place prevents a new task action from accidentally trusting a client
// supplied workspace id or specialist id.

import { NextResponse } from "next/server";
import { db } from "./db";
import { sameOrigin } from "./auth/http";
import { getSession, type SessionUser } from "./auth/session";

export class MarketHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type RateBucket = { count: number; resetAt: number };
const globalBuckets = globalThis as unknown as { __bizzMarketRateBuckets?: Map<string, RateBucket> };
const rateBuckets = (globalBuckets.__bizzMarketRateBuckets ??= new Map<string, RateBucket>());

function enforceRateLimit(key: string, limit: number, windowMs = 60_000): void {
  const now = Date.now();
  const current = rateBuckets.get(key);
  const bucket = current && current.resetAt > now ? current : { count: 0, resetAt: now + windowMs };
  bucket.count += 1;
  rateBuckets.set(key, bucket);
  if (bucket.count > limit) {
    throw new MarketHttpError(429, "Too many marketplace requests. Please wait a moment and try again.");
  }
  if (rateBuckets.size > 10_000) {
    for (const [bucketKey, value] of rateBuckets) {
      if (value.resetAt <= now) rateBuckets.delete(bucketKey);
    }
  }
}

export async function requireMarketSession(
  request: Request,
  options: { mutation?: boolean; action?: string; limit?: number } = {},
): Promise<SessionUser> {
  if (options.mutation && !sameOrigin(request)) {
    throw new MarketHttpError(403, "Cross-site request rejected.");
  }
  const session = await getSession().catch(() => null);
  if (!session) throw new MarketHttpError(401, "Sign in required.");
  enforceRateLimit(`${session.userId}:${options.action ?? "read"}`, options.limit ?? 120);
  return session;
}

export function requireWorkspace(session: SessionUser, requestedWorkspaceId?: string | null): string {
  if (!session.workspaceId) {
    throw new MarketHttpError(403, "Create or join a workspace before using the owner marketplace.");
  }
  if (requestedWorkspaceId && requestedWorkspaceId !== session.workspaceId) {
    throw new MarketHttpError(403, "You do not have access to that workspace.");
  }
  return session.workspaceId;
}

export async function requireOwnedTask(taskId: string, session: SessionUser) {
  const task = await db.marketTask.findUnique({ where: { id: taskId } });
  if (!task) throw new MarketHttpError(404, "Task not found.");
  const workspaceId = requireWorkspace(session);
  if (task.workspaceId !== workspaceId) {
    // Do not reveal whether another workspace's task id exists.
    throw new MarketHttpError(404, "Task not found.");
  }
  return task;
}

export async function requireSpecialist(session: SessionUser, options: { approved?: boolean } = {}) {
  const specialist = await db.specialist.findUnique({ where: { userId: session.userId } });
  if (!specialist) throw new MarketHttpError(404, "Specialist profile not found. Start specialist onboarding first.");
  if (options.approved && (specialist.status !== "approved" || !specialist.verified)) {
    throw new MarketHttpError(403, "Your specialist application must be approved before you can do that.");
  }
  return specialist;
}

export function marketErrorResponse(error: unknown, context: string): NextResponse {
  if (error instanceof MarketHttpError) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  console.error(`[market/${context}]`, error);
  return NextResponse.json(
    { ok: false, error: "The marketplace could not complete that request." },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}

export async function notifyUser(input: {
  userId: string | null | undefined;
  type: string;
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
}): Promise<void> {
  if (!input.userId) return;
  try {
    await db.marketNotification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        entityType: input.entityType,
        entityId: input.entityId,
      },
    });
  } catch (error) {
    // A secondary notification failure must not make a completed award,
    // review or lifecycle transition appear to have failed to the user.
    console.error("[market/notification]", error);
  }
}

export async function notifyWorkspaceMembers(input: {
  workspaceId: string;
  excludeUserId?: string;
  type: string;
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
}): Promise<void> {
  try {
    const members = await db.$queryRaw<{ userId: string }[]>`
      SELECT "userId"
      FROM "WorkspaceMembership"
      WHERE "workspaceId" = ${input.workspaceId} AND "status" = 'ACTIVE'
      LIMIT 100`;
    const userIds = [...new Set(members.map((member) => member.userId))].filter((userId) => userId !== input.excludeUserId);
    if (userIds.length === 0) return;
    await db.marketNotification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type: input.type,
        title: input.title,
        body: input.body,
        entityType: input.entityType,
        entityId: input.entityId,
      })),
    });
  } catch (error) {
    console.error("[market/workspace-notification]", error);
  }
}
