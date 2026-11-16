import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toSpecialistDTO } from "@/lib/market";

export const runtime = "nodejs";

/** GET /api/market/specialists — the vetted roster (optionally filtered). */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") ?? undefined;
    const q = (searchParams.get("q") ?? "").trim().toLowerCase();

    const rows = await db.specialist.findMany({
      where: category ? { category } : undefined,
      orderBy: [{ rating: "desc" }, { completedJobs: "desc" }],
    });

    const specialists = rows
      .map(toSpecialistDTO)
      .filter((s) =>
        q
          ? `${s.name} ${s.headline} ${s.skills.join(" ")} ${s.bio}`.toLowerCase().includes(q)
          : true,
      );

    return NextResponse.json({ ok: true, specialists });
  } catch (error) {
    console.error("[api/market/specialists] GET error:", error);
    return NextResponse.json({ ok: false, error: "Could not load the specialist roster." }, { status: 500 });
  }
}
