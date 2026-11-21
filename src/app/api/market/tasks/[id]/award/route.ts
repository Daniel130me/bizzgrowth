import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toTaskDTO, toBidDTO, toSpecialistDTO } from "@/lib/market";
import { MarketHttpError, marketErrorResponse, notifyUser, requireMarketSession, requireOwnedTask } from "@/lib/market-auth";

export const runtime = "nodejs";

/** POST /api/market/tasks/:id/award — accept one bid, award the task. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireMarketSession(req, { mutation: true, action: "tasks:award", limit: 15 });
    const body = await req.json().catch(() => null);
    const bidId = typeof body?.bidId === "string" ? body.bidId : "";
    if (!bidId) return NextResponse.json({ ok: false, error: "bidId is required." }, { status: 400 });

    const task = await requireOwnedTask(id, session);
    if (task.status !== "open") {
      return NextResponse.json({ ok: false, error: "This task has already been awarded or closed." }, { status: 409 });
    }

    const bid = await db.marketBid.findUnique({ where: { id: bidId }, include: { specialist: true } });
    if (!bid || bid.taskId !== task.id || bid.status !== "pending") {
      return NextResponse.json({ ok: false, error: "That bid does not belong to this task." }, { status: 404 });
    }

    await db.$transaction(async (tx) => {
      const claimed = await tx.marketTask.updateMany({
        where: { id: task.id, status: "open", awardedBidId: null },
        data: { status: "awarded", awardedBidId: bid.id },
      });
      if (claimed.count !== 1) throw new MarketHttpError(409, "This task was already awarded or closed.");
      await tx.marketBid.update({ where: { id: bid.id }, data: { status: "accepted" } });
      await tx.marketBid.updateMany({
        where: { taskId: task.id, id: { not: bid.id }, status: "pending" },
        data: { status: "declined" },
      });
      await tx.marketInvitation.updateMany({
        where: { taskId: task.id, specialistId: { not: bid.specialistId }, status: "pending" },
        data: { status: "expired", respondedAt: new Date() },
      });
      await tx.marketEngagement.create({
        data: {
          taskId: task.id,
          bidId: bid.id,
          specialistId: bid.specialistId,
          workspaceId: task.workspaceId,
          agreedAmount: bid.amount,
          deliveryDays: bid.days,
          scope: task.description,
          status: "awarded",
          paymentStatus: "external",
        },
      });
    });

    const updatedTask = await db.marketTask.findUniqueOrThrow({
      where: { id: task.id },
      include: { _count: { select: { bids: true } } },
    });

    const bids = await db.marketBid.findMany({ where: { taskId: task.id }, orderBy: { createdAt: "asc" }, include: { specialist: true } });
    const engagement = await db.marketEngagement.findUnique({
      where: { taskId: task.id },
      select: { id: true, status: true, paymentStatus: true },
    });

    await notifyUser({
      userId: bid.specialist.userId,
      type: "market-award",
      title: "Your bid was accepted",
      body: `${task.businessName} awarded you “${task.title}”.`,
      entityType: "task",
      entityId: task.id,
    });

    return NextResponse.json({
      ok: true,
      task: toTaskDTO(updatedTask),
      bids: bids.map((b) => toBidDTO(b, toSpecialistDTO(b.specialist))),
      engagement,
    });
  } catch (error) {
    return marketErrorResponse(error, "tasks:award");
  }
}
