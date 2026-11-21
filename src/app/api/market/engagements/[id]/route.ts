import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { MarketHttpError, marketErrorResponse, notifyUser, notifyWorkspaceMembers, requireMarketSession } from "@/lib/market-auth";
import { engagementTransition } from "@/lib/market-rules";

export const runtime = "nodejs";

async function loadAuthorized(id: string, userId: string, workspaceId: string | null) {
  const engagement = await db.marketEngagement.findUnique({
    where: { id },
    include: { task: true, bid: true, specialist: true },
  });
  if (!engagement) throw new MarketHttpError(404, "Engagement not found.");
  const role = engagement.specialist.userId === userId ? "specialist" : engagement.workspaceId === workspaceId ? "owner" : null;
  if (!role) throw new MarketHttpError(404, "Engagement not found.");
  return { engagement, role } as const;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireMarketSession(request, { action: "engagements:read", limit: 120 });
    const { id } = await params;
    const { engagement, role } = await loadAuthorized(id, session.userId, session.workspaceId);
    const hasReviewed = role === "owner"
      ? Boolean(await db.marketReview.findUnique({
          where: { engagementId_reviewerUserId: { engagementId: id, reviewerUserId: session.userId } },
          select: { id: true },
        }))
      : false;
    return NextResponse.json(
      { ok: true, engagement: { ...engagement, hasReviewed }, role },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return marketErrorResponse(error, "engagements:read");
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireMarketSession(request, { mutation: true, action: "engagements:update", limit: 30 });
    const { id } = await params;
    const { engagement, role } = await loadAuthorized(id, session.userId, session.workspaceId);
    const body = await request.json().catch(() => null);
    const action = typeof body?.action === "string" ? body.action : "";

    const transition = engagementTransition(action);
    if (action === "mark-paid") {
      if (role !== "owner") throw new MarketHttpError(403, "Only the hiring workspace can confirm payment.");
      if (!["accepted", "in-progress", "delivered", "completed"].includes(engagement.status)) {
        throw new MarketHttpError(409, "Payment cannot be confirmed at this stage.");
      }
      const updated = await db.marketEngagement.update({ where: { id }, data: { paymentStatus: "paid" } });
      await notifyUser({
        userId: engagement.specialist.userId,
        type: "engagement-payment",
        title: "Payment marked as paid",
        body: `The hiring business marked payment for “${engagement.task.title}” as paid.`,
        entityType: "engagement",
        entityId: id,
      });
      return NextResponse.json({ ok: true, engagement: updated });
    }
    if (!transition) return NextResponse.json({ ok: false, error: "Unknown engagement action." }, { status: 400 });
    if (transition.role !== role) throw new MarketHttpError(403, "You cannot perform that engagement action.");
    if (!transition.from.includes(engagement.status)) throw new MarketHttpError(409, "That action is not valid at this stage.");

    const disputeReason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 1500) : "";
    if (action === "dispute" && disputeReason.length < 20) {
      return NextResponse.json({ ok: false, error: "Explain the dispute in at least 20 characters." }, { status: 400 });
    }

    const now = new Date();
    const updated = await db.$transaction(async (tx) => {
      const claimed = await tx.marketEngagement.updateMany({
        where: { id, status: engagement.status },
        data: {
          status: transition.to,
          ...(action === "start" ? { startedAt: now } : {}),
          ...(action === "deliver" ? { deliveredAt: now } : {}),
          ...(action === "complete" ? { completedAt: now } : {}),
          ...(action === "cancel" ? { cancelledAt: now } : {}),
          ...(action === "dispute" ? { disputeReason } : {}),
        },
      });
      if (claimed.count !== 1) throw new MarketHttpError(409, "The engagement changed. Refresh and try again.");
      const taskStatus = transition.to === "accepted" ? "awarded" : transition.to;
      await tx.marketTask.update({ where: { id: engagement.taskId }, data: { status: taskStatus } });
      if (transition.to === "completed") {
        await tx.specialist.update({
          where: { id: engagement.specialistId },
          data: { completedJobs: { increment: 1 } },
        });
      }
      return tx.marketEngagement.findUniqueOrThrow({ where: { id } });
    });

    if (role === "owner") {
      await notifyUser({
        userId: engagement.specialist.userId,
        type: "engagement-status",
        title: `Engagement ${transition.to}`,
        body: `“${engagement.task.title}” is now ${transition.to}.`,
        entityType: "engagement",
        entityId: id,
      });
    } else {
      await notifyWorkspaceMembers({
        workspaceId: engagement.workspaceId,
        excludeUserId: session.userId,
        type: "engagement-status",
        title: `Engagement ${transition.to}`,
        body: `${engagement.specialist.name} moved “${engagement.task.title}” to ${transition.to}.`,
        entityType: "engagement",
        entityId: id,
      });
    }
    return NextResponse.json({ ok: true, engagement: updated });
  } catch (error) {
    return marketErrorResponse(error, "engagements:update");
  }
}
