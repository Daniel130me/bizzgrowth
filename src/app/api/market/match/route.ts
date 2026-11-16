import { NextRequest, NextResponse } from "next/server";
import { matchTask } from "@/lib/market";

export const runtime = "nodejs";

/**
 * POST /api/market/match — AI matchmaking for a piece of work.
 * Used by the post-task flow ("who fits this work") before bids are invited.
 * Falls back to honest category/skill matching when the AI is unavailable —
 * the response says which one ran (aiInterpreted).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const title = typeof body?.title === "string" ? body.title.trim().slice(0, 120) : "";
    const description = typeof body?.description === "string" ? body.description.trim().slice(0, 2000) : "";
    const category = typeof body?.category === "string" ? body.category.trim().slice(0, 30) : undefined;
    const skills = Array.isArray(body?.skills)
      ? body.skills.filter((s: unknown): s is string => typeof s === "string").slice(0, 8)
      : [];

    if (title.length < 8 || description.length < 30) {
      return NextResponse.json({ ok: false, error: "Provide a task title and description to match against." }, { status: 400 });
    }

    const result = await matchTask({ title, description, category, skills });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[api/market/match] POST error:", error);
    return NextResponse.json({ ok: false, error: "Matchmaking failed. You can still invite specialists manually." }, { status: 500 });
  }
}
