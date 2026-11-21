import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { matchTask, toSpecialistDTO, type SpecialistDTO } from "@/lib/market";
import { marketErrorResponse, notifyUser, requireMarketSession, requireOwnedTask } from "@/lib/market-auth";

export const runtime = "nodejs";

/**
 * POST /api/market/tasks/:id/invite — invite specialists to bid.
 *
 * Body:
 *   { mode: "ai" }                     → match with the AI matchmaker and invite the top fits
 *   { specialistIds: ["…"] }           → invite specific roster specialists (e.g. from a profile page)
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await requireMarketSession(req, { mutation: true, action: "tasks:invite", limit: 30 });
    const body = await req.json().catch(() => ({}));

    const task = await requireOwnedTask(id, session);
    if (task.status !== "open") {
      return NextResponse.json({ ok: false, error: "This task is no longer open for bids." }, { status: 409 });
    }

    let invitees: SpecialistDTO[] = [];

    if (body?.mode === "ai") {
      const match = await matchTask({
        title: task.title,
        description: task.description,
        category: task.category,
        skills: JSON.parse(task.skills || "[]"),
        limit: 4,
      });
      // Persist the matchmaking summary for the record.
      await db.marketTask.update({
        where: { id: task.id },
        data: {
          matchNote: [
            match.aiInterpreted ? "AI-matched" : "Category-matched",
            match.note ? ` — ${match.note}` : "",
          ].join(""),
        },
      });
      invitees = match.matches.map((m) => m.specialist);
    } else if (Array.isArray(body?.specialistIds) && body.specialistIds.length > 0) {
      const ids = body.specialistIds.filter((v: unknown): v is string => typeof v === "string").slice(0, 6);
      invitees = (
        await db.specialist.findMany({
          where: { id: { in: ids }, status: "approved", verified: true },
        })
      ).map(toSpecialistDTO);
    } else {
      return NextResponse.json({ ok: false, error: "Provide mode:\"ai\" or specialistIds." }, { status: 400 });
    }

    const uniqueInvitees = [...new Map(invitees.map((specialist) => [specialist.id, specialist])).values()];
    const created = await db.marketInvitation.createManyAndReturn({
      data: uniqueInvitees.map((specialist) => ({
        taskId: task.id,
        specialistId: specialist.id,
        source: body?.mode === "ai" ? "ai-match" : "manual",
        status: "pending",
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      })),
      skipDuplicates: true,
      select: { specialistId: true },
    });

    const accounts = await db.specialist.findMany({
      where: { id: { in: created.map((invitation) => invitation.specialistId) } },
      select: { id: true, userId: true },
    });
    await Promise.all(
      accounts.map((specialist) =>
        notifyUser({
          userId: specialist.userId,
          type: "market-invitation",
          title: "New task invitation",
          body: `${task.businessName} invited you to bid on “${task.title}”.`,
          entityType: "task",
          entityId: task.id,
        }),
      ),
    );

    if (created.length === 0) {
      return NextResponse.json({ ok: true, invited: 0, message: "Those specialists were already invited." });
    }

    return NextResponse.json({ ok: true, invited: created.length }, { status: 201 });
  } catch (error) {
    return marketErrorResponse(error, "tasks:invite");
  }
}
