import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateBidFor, matchTask, toBidDTO, toSpecialistDTO, type BidDTO, type SpecialistDTO } from "@/lib/market";

export const runtime = "nodejs";

/**
 * POST /api/market/tasks/:id/invite — invite specialists to bid.
 *
 * Body:
 *   { mode: "ai" }                     → match with the AI matchmaker and invite the top fits
 *   { specialistIds: ["…"] }           → invite specific roster specialists (e.g. from a profile page)
 *
 * Pilot behaviour (displayed honestly in the UI): invited roster specialists
 * respond automatically with indicative bids derived from their own profile.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));

    const task = await db.marketTask.findUnique({ where: { id } });
    if (!task) return NextResponse.json({ ok: false, error: "Task not found." }, { status: 404 });
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
      invitees = (await db.specialist.findMany({ where: { id: { in: ids } } })).map(toSpecialistDTO);
    } else {
      return NextResponse.json({ ok: false, error: "Provide mode:\"ai\" or specialistIds." }, { status: 400 });
    }

    const existing = await db.marketBid.findMany({
      where: { taskId: task.id, status: { in: ["pending", "accepted"] } },
      select: { specialistId: true },
    });
    const alreadyInvited = new Set(existing.map((b) => b.specialistId));

    const created: BidDTO[] = [];
    for (const s of invitees) {
      if (alreadyInvited.has(s.id)) continue;
      const bid = generateBidFor(s, task);
      const row = await db.marketBid.create({
        data: {
          taskId: task.id,
          specialistId: s.id,
          amount: bid.amount,
          days: bid.days,
          coverNote: bid.coverNote,
          inviteSource: body?.mode === "ai" ? "ai-match" : "manual",
          status: "pending",
        },
      });
      created.push(toBidDTO(row, s));
    }

    if (created.length === 0) {
      return NextResponse.json({ ok: true, invited: 0, bids: [], message: "Those specialists have already bid on this task." });
    }

    return NextResponse.json({ ok: true, invited: created.length, bids: created }, { status: 201 });
  } catch (error) {
    console.error("[api/market/tasks/:id/invite] POST error:", error);
    return NextResponse.json({ ok: false, error: "Could not send the invitations." }, { status: 500 });
  }
}
