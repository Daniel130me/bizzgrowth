import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toBidDTO, toSpecialistDTO } from "@/lib/market";
import { MarketHttpError, marketErrorResponse, notifyWorkspaceMembers, requireMarketSession, requireSpecialist } from "@/lib/market-auth";
import { validateBidInput } from "@/lib/market-rules";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireMarketSession(request, { mutation: true, action: "bids:submit", limit: 20 });
    const specialist = await requireSpecialist(session, { approved: true });
    const { id: taskId } = await params;
    const body = await request.json().catch(() => null);
    const validated = validateBidInput(body);
    if (!validated.value) return NextResponse.json({ ok: false, error: validated.error }, { status: 400 });
    const { amount, days, coverNote } = validated.value;

    const task = await db.marketTask.findUnique({ where: { id: taskId } });
    if (!task || task.status !== "open") throw new MarketHttpError(404, "Open task not found.");
    const invitation = await db.marketInvitation.findUnique({
      where: { taskId_specialistId: { taskId, specialistId: specialist.id } },
    });
    if (!invitation || !["pending", "accepted"].includes(invitation.status)) {
      throw new MarketHttpError(403, "You need an active invitation before bidding on this task.");
    }
    if (invitation.expiresAt && invitation.expiresAt < new Date()) {
      await db.marketInvitation.update({
        where: { id: invitation.id },
        data: { status: "expired", respondedAt: new Date() },
      });
      throw new MarketHttpError(410, "This invitation has expired.");
    }

    const bid = await db.$transaction(async (tx) => {
      const openTask = await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "MarketTask"
        WHERE "id" = ${taskId} AND "status" = 'open'
        FOR UPDATE`;
      if (openTask.length !== 1) throw new MarketHttpError(409, "This task is no longer accepting bids.");
      await tx.marketInvitation.update({
        where: { id: invitation.id },
        data: { status: "accepted", respondedAt: new Date() },
      });
      return tx.marketBid.upsert({
        where: { taskId_specialistId: { taskId, specialistId: specialist.id } },
        create: {
          taskId,
          specialistId: specialist.id,
          amount,
          days,
          coverNote,
          inviteSource: "specialist",
          status: "pending",
        },
        update: { amount, days, coverNote, status: "pending", withdrawnAt: null },
      });
    });

    await notifyWorkspaceMembers({
      workspaceId: task.workspaceId,
      excludeUserId: session.userId,
      type: "market-bid",
      title: "New specialist bid",
      body: `${specialist.name} submitted a bid on “${task.title}”.`,
      entityType: "task",
      entityId: task.id,
    });

    return NextResponse.json({ ok: true, bid: toBidDTO(bid, toSpecialistDTO(specialist)) }, { status: 201 });
  } catch (error) {
    return marketErrorResponse(error, "bids:submit");
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireMarketSession(request, { mutation: true, action: "bids:withdraw", limit: 20 });
    const specialist = await requireSpecialist(session, { approved: true });
    const { id: taskId } = await params;
    const bid = await db.marketBid.findUnique({ where: { taskId_specialistId: { taskId, specialistId: specialist.id } } });
    if (!bid || bid.status !== "pending") throw new MarketHttpError(404, "Active bid not found.");
    await db.marketBid.update({ where: { id: bid.id }, data: { status: "withdrawn", withdrawnAt: new Date() } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return marketErrorResponse(error, "bids:withdraw");
  }
}
