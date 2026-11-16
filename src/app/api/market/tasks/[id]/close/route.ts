import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toTaskDTO } from "@/lib/market";

export const runtime = "nodejs";

/** POST /api/market/tasks/:id/close — close a task without hiring. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const task = await db.marketTask.findUnique({ where: { id } });
    if (!task) return NextResponse.json({ ok: false, error: "Task not found." }, { status: 404 });
    if (task.status !== "open") {
      return NextResponse.json({ ok: false, error: "Only open tasks can be closed." }, { status: 409 });
    }

    const updated = await db.marketTask.update({
      where: { id: task.id },
      data: { status: "closed" },
      include: { _count: { select: { bids: true } } },
    });

    await db.marketBid.updateMany({ where: { taskId: task.id, status: "pending" }, data: { status: "declined" } });

    return NextResponse.json({ ok: true, task: toTaskDTO(updated) });
  } catch (error) {
    console.error("[api/market/tasks/:id/close] POST error:", error);
    return NextResponse.json({ ok: false, error: "Could not close the task." }, { status: 500 });
  }
}
