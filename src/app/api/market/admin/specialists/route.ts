import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { MarketHttpError, marketErrorResponse, requireMarketSession } from "@/lib/market-auth";
import { toSpecialistDTO } from "@/lib/market";
import { isPlatformAdmin } from "@/lib/auth/platform-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await requireMarketSession(request, { action: "specialist:admin-list", limit: 60 });
    if (!isPlatformAdmin(session)) {
      throw new MarketHttpError(403, "Administrator access required.");
    }

    const status = request.nextUrl.searchParams.get("status") || "submitted";
    const allowedStatuses = new Set(["submitted", "approved", "rejected", "suspended"]);
    if (!allowedStatuses.has(status)) {
      return NextResponse.json({ ok: false, error: "Invalid application status." }, { status: 400 });
    }

    const specialists = await db.specialist.findMany({
      where: { status },
      orderBy: [{ submittedAt: "asc" }, { createdAt: "asc" }],
      take: 100,
    });
    return NextResponse.json({
      ok: true,
      specialists: specialists.map((specialist) => ({
        ...toSpecialistDTO(specialist),
        status: specialist.status,
        submittedAt: specialist.submittedAt?.toISOString() ?? null,
        reviewNote: specialist.reviewNote,
      })),
    });
  } catch (error) {
    return marketErrorResponse(error, "specialist:admin-list");
  }
}
