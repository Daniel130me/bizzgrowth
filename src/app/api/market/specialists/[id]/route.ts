import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toSpecialistDTO } from "@/lib/market";

export const runtime = "nodejs";

/** GET /api/market/specialists/:id — full showcase profile. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const row = await db.specialist.findUnique({ where: { id } });
    if (!row) {
      return NextResponse.json({ ok: false, error: "Specialist not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, specialist: toSpecialistDTO(row) });
  } catch (error) {
    console.error("[api/market/specialists/:id] GET error:", error);
    return NextResponse.json({ ok: false, error: "Could not load this specialist." }, { status: 500 });
  }
}
