import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { MarketHttpError, marketErrorResponse, notifyUser, requireMarketSession } from "@/lib/market-auth";
import { isPlatformAdmin } from "@/lib/auth/platform-admin";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireMarketSession(request, { mutation: true, action: "specialist:review", limit: 40 });
    if (!isPlatformAdmin(session)) {
      throw new MarketHttpError(403, "Administrator access required.");
    }
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const decision = body?.decision === "approve" ? "approved" : body?.decision === "reject" ? "rejected" : "";
    const note = typeof body?.note === "string" ? body.note.trim().slice(0, 1000) : "";
    if (!decision) return NextResponse.json({ ok: false, error: "Choose approve or reject." }, { status: 400 });
    if (decision === "rejected" && note.length < 10) {
      return NextResponse.json({ ok: false, error: "Explain what the specialist should change." }, { status: 400 });
    }

    const specialist = await db.specialist.findUnique({ where: { id } });
    if (!specialist || specialist.status !== "submitted") throw new MarketHttpError(404, "Submitted application not found.");
    const updated = await db.specialist.update({
      where: { id },
      data: {
        status: decision,
        verified: decision === "approved",
        reviewedAt: new Date(),
        reviewNote: note || (decision === "approved" ? "Application approved." : null),
      },
    });
    await notifyUser({
      userId: updated.userId,
      type: "specialist-review",
      title: decision === "approved" ? "Specialist profile approved" : "Changes requested",
      body: note || "Your specialist profile is now live.",
      entityType: "specialist",
      entityId: updated.id,
    });
    return NextResponse.json({ ok: true, status: updated.status });
  } catch (error) {
    return marketErrorResponse(error, "specialist:review");
  }
}
