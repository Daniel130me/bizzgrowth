import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toSpecialistDTO } from "@/lib/market";
import { marketErrorResponse, requireMarketSession } from "@/lib/market-auth";

export const runtime = "nodejs";

/** GET /api/market/specialists/:id — full showcase profile. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireMarketSession(_req, { action: "specialists:read", limit: 120 });
    const { id } = await params;
    const row = await db.specialist.findFirst({ where: { id, status: "approved", verified: true } });
    if (!row) {
      return NextResponse.json({ ok: false, error: "Specialist not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, specialist: toSpecialistDTO(row) });
  } catch (error) {
    return marketErrorResponse(error, "specialists:read");
  }
}
