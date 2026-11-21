import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toTaskDTO, toBidDTO, toSpecialistDTO } from "@/lib/market";
import { marketErrorResponse, requireMarketSession, requireOwnedTask } from "@/lib/market-auth";

export const runtime = "nodejs";

/** GET /api/market/tasks/:id — task with its bids (each bid carries the specialist). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireMarketSession(_req, { action: "tasks:read", limit: 120 });
    await requireOwnedTask(id, session);
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
    const invitations = await db.marketInvitation.findMany({
      where: { taskId: id },
      orderBy: { createdAt: "asc" },
      select: { id: true, specialistId: true, status: true, source: true, createdAt: true },
    });
    const engagement = await db.marketEngagement.findUnique({
      where: { taskId: id },
      select: { id: true, status: true, paymentStatus: true },
    });
    return NextResponse.json({
      ok: true,
      task: toTaskDTO(task),
      bids: bids.map((b) => toBidDTO(b, toSpecialistDTO(b.specialist))),
      invitations: invitations.map((invitation) => ({ ...invitation, createdAt: invitation.createdAt.toISOString() })),
      engagement,
    });
  } catch (error) {
    return marketErrorResponse(error, "tasks:read");
  }
}
