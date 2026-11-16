import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toTaskDTO, toBidDTO, toSpecialistDTO } from "@/lib/market";

export const runtime = "nodejs";

/** GET /api/market/tasks/:id — task with its bids (each bid carries the specialist). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const task = await db.marketTask.findUnique({
      where: { id },
      include: { _count: { select: { bids: true } } },
    });
    if (!task) {
      return NextResponse.json({ ok: false, error: "Task not found." }, { status: 404 });
    }
    const bids = await db.marketBid.findMany({
      where: { taskId: id },
      orderBy: { createdAt: "asc" },
      include: { specialist: true },
    });
    return NextResponse.json({ ok: true, task: toTaskDTO(task), bids: bids.map((b) => toBidDTO(b, toSpecialistDTO(b.specialist))) });
  } catch (error) {
    console.error("[api/market/tasks/:id] GET error:", error);
    return NextResponse.json({ ok: false, error: "Could not load this task." }, { status: 500 });
  }
}
