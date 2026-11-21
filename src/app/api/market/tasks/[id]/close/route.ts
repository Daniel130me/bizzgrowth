import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toTaskDTO } from "@/lib/market";
import { MarketHttpError, marketErrorResponse, requireMarketSession, requireOwnedTask } from "@/lib/market-auth";

export const runtime = "nodejs";

/** POST /api/market/tasks/:id/close — close a task without hiring. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireMarketSession(_req, { mutation: true, action: "tasks:close", limit: 20 });
    const task = await requireOwnedTask(id, session);
    if (task.status !== "open") {
      return NextResponse.json({ ok: false, error: "Only open tasks can be closed." }, { status: 409 });
    }

    await db.$transaction(async (tx) => {
      const closed = await tx.marketTask.updateMany({
        where: { id: task.id, status: "open", awardedBidId: null },
        data: { status: "closed" },
      });
      if (closed.count !== 1) throw new MarketHttpError(409, "Only open tasks can be closed.");
      await tx.marketBid.updateMany({ where: { taskId: task.id, status: "pending" }, data: { status: "declined" } });
      await tx.marketInvitation.updateMany({
        where: { taskId: task.id, status: "pending" },
        data: { status: "expired", respondedAt: new Date() },
      });
    });

    const updated = await db.marketTask.findUniqueOrThrow({
      where: { id: task.id },
      include: { _count: { select: { bids: true } } },
    });

    return NextResponse.json({ ok: true, task: toTaskDTO(updated) });
  } catch (error) {
    return marketErrorResponse(error, "tasks:close");
  }
}
