import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toTaskDTO, toBidDTO, toSpecialistDTO } from "@/lib/market";

export const runtime = "nodejs";

/** POST /api/market/tasks/:id/award — accept one bid, award the task. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const bidId = typeof body?.bidId === "string" ? body.bidId : "";
    if (!bidId) return NextResponse.json({ ok: false, error: "bidId is required." }, { status: 400 });

    const task = await db.marketTask.findUnique({ where: { id } });
    if (!task) return NextResponse.json({ ok: false, error: "Task not found." }, { status: 404 });
    if (task.status !== "open") {
      return NextResponse.json({ ok: false, error: "This task has already been awarded or closed." }, { status: 409 });
    }

    const bid = await db.marketBid.findUnique({ where: { id: bidId }, include: { specialist: true } });
    if (!bid || bid.taskId !== task.id) {
      return NextResponse.json({ ok: false, error: "That bid does not belong to this task." }, { status: 404 });
    }

    const [updatedTask] = await db.$transaction([
      db.marketTask.update({
        where: { id: task.id },
        data: { status: "awarded", awardedBidId: bid.id },
        include: { _count: { select: { bids: true } } },
      }),
      db.marketBid.update({ where: { id: bid.id }, data: { status: "accepted" } }),
      db.marketBid.updateMany({
        where: { taskId: task.id, id: { not: bid.id }, status: "pending" },
        data: { status: "declined" },
      }),
    ]);

    const bids = await db.marketBid.findMany({ where: { taskId: task.id }, orderBy: { createdAt: "asc" }, include: { specialist: true } });

    return NextResponse.json({ ok: true, task: toTaskDTO(updatedTask), bids: bids.map((b) => toBidDTO(b, toSpecialistDTO(b.specialist))) });
  } catch (error) {
    console.error("[api/market/tasks/:id/award] POST error:", error);
    return NextResponse.json({ ok: false, error: "Could not award the task." }, { status: 500 });
  }
}
