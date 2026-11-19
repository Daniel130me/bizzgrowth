// Server-only: login sessions for bizzGrowth.
//
// The browser holds a random token in an httpOnly cookie; the DB row in
// "AuthSession" (prisma/sql/002_auth_session.sql) holds only its SHA-256 hash.
// Users, workspaces and memberships are the existing Neon tables, read with raw
// SQL because they are not modelled in prisma/schema.prisma yet.

import { createHash, randomBytes, randomUUID } from "crypto";
import { cookies, headers } from "next/headers";
import type { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const SESSION_COOKIE = "bizz_session";
const REMEMBER_DAYS = 30;
const SHORT_HOURS = 12;

export interface SessionUser {
  sessionId: string;
  userId: string;
  email: string;
  name: string;
  jobRole: string | null;
  platformRole: string;
  workspaceId: string | null;
  workspaceName: string | null;
  workspace: { type: string; country: string | null; currency: string } | null;
}

export function newId(): string {
  return randomUUID();
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Neon suspends idle compute; the first query after a pause can fail with P1001. */
export async function withDbRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const code = (err as { code?: string })?.code;
    const msg = String((err as Error)?.message ?? "");
    if (code === "P1001" || code === "P2024" || /reach database server|connection pool/i.test(msg)) {
      await new Promise((r) => setTimeout(r, 1500));
      return fn();
    }
    throw err;
  }
}

export async function requestMeta(): Promise<{ ip: string; userAgent: string }> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "local").trim();
  return { ip, userAgent: (h.get("user-agent") || "").slice(0, 400) };
}

function cookieSecure(): boolean {
  // Browsers accept Secure cookies on http://localhost, so this is on everywhere
  // unless explicitly disabled (e.g. testing over a LAN IP on plain http).
  return process.env.AUTH_COOKIE_INSECURE !== "1";
}

/** Create a DB session for the user and set the cookie on the response. */
export async function startSession(
  res: NextResponse,
  input: { userId: string; workspaceId?: string | null; remember?: boolean },
): Promise<void> {
  const { ip, userAgent } = await requestMeta();
  const token = randomBytes(32).toString("base64url");
  const remember = input.remember !== false;
  const ttlMs = remember ? REMEMBER_DAYS * 86_400_000 : SHORT_HOURS * 3_600_000;
  const expiresAt = new Date(Date.now() + ttlMs);
  await withDbRetry(
    () => db.$executeRaw`
      INSERT INTO "AuthSession" ("id", "tokenHash", "userId", "workspaceId", "expiresAt", "userAgent", "ip")
      VALUES (${newId()}, ${hashToken(token)}, ${input.userId}, ${input.workspaceId ?? null}, ${expiresAt}, ${userAgent}, ${ip})`,
  );
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    // No maxAge without "remember me": the cookie ends with the browser session
    // (and the DB row expires after SHORT_HOURS regardless).
    ...(remember ? { maxAge: Math.floor(ttlMs / 1000) } : {}),
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: cookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

type SessionRow = {
  sessionId: string;
  userId: string;
  email: string;
  name: string;
  jobRole: string | null;
  platformRole: string;
  sessionWorkspaceId: string | null;
};

/** The logged-in user for this request, or null. Use in route handlers and server code. */
export async function getSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length > 200) return null;
  const rows = await withDbRetry(
    () => db.$queryRaw<SessionRow[]>`
      SELECT s."id" AS "sessionId", u."id" AS "userId", u."email", u."name", u."jobRole",
             u."platformRole"::text AS "platformRole", s."workspaceId" AS "sessionWorkspaceId"
      FROM "AuthSession" s JOIN "User" u ON u."id" = s."userId"
      WHERE s."tokenHash" = ${hashToken(token)} AND s."revokedAt" IS NULL AND s."expiresAt" > NOW()
      LIMIT 1`,
  );
  const row = rows[0];
  if (!row) return null;

  // Workspace: the one pinned on the session, else the user's first active membership.
  const ws = await withDbRetry(
    () => db.$queryRaw<{ id: string; name: string; type: string; location: string | null; currency: string }[]>`
      SELECT w."id", w."name", w."type"::text AS "type", w."location", w."currency" FROM "WorkspaceMembership" m JOIN "Workspace" w ON w."id" = m."workspaceId"
      WHERE m."userId" = ${row.userId} AND m."status" = 'ACTIVE'
      ORDER BY (w."id" = ${row.sessionWorkspaceId ?? ""}) DESC, m."createdAt" ASC
      LIMIT 1`,
  );

  // Touch lastSeenAt at most every few minutes (cheap, best effort).
  db.$executeRaw`UPDATE "AuthSession" SET "lastSeenAt" = NOW()
    WHERE "id" = ${row.sessionId} AND "lastSeenAt" < NOW() - INTERVAL '5 minutes'`.catch(() => {});

  return {
    sessionId: row.sessionId,
    userId: row.userId,
    email: row.email,
    name: row.name,
    jobRole: row.jobRole,
    platformRole: row.platformRole,
    workspaceId: ws[0]?.id ?? null,
    workspaceName: ws[0]?.name ?? null,
    workspace: ws[0]
      ? { type: ws[0].type === "ECOMMERCE" ? "ecommerce" : "service", country: ws[0].location, currency: ws[0].currency }
      : null,
  };
}

/** Revoke the current request's session (if any). */
export async function revokeCurrentSession(): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return;
  await withDbRetry(
    () => db.$executeRaw`UPDATE "AuthSession" SET "revokedAt" = NOW()
      WHERE "tokenHash" = ${hashToken(token)} AND "revokedAt" IS NULL`,
  );
}

/** Pin a workspace on the current session (after onboarding creates one). */
export async function setSessionWorkspace(sessionId: string, workspaceId: string): Promise<void> {
  await withDbRetry(
    () => db.$executeRaw`UPDATE "AuthSession" SET "workspaceId" = ${workspaceId} WHERE "id" = ${sessionId}`,
  );
}

/** Public shape returned to the browser. */
export function publicUser(s: SessionUser) {
  return {
    id: s.userId,
    email: s.email,
    name: s.name,
    jobRole: s.jobRole,
    workspaceId: s.workspaceId,
    workspaceName: s.workspaceName,
    workspace: s.workspace,
  };
}
