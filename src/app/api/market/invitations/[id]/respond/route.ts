import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { MarketHttpError, marketErrorResponse, requireMarketSession, requireSpecialist } from "@/lib/market-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireMarketSession(request, { mutation: true, action: "invitations:respond", limit: 30 });
    const specialist = await requireSpecialist(session, { approved: true });
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const decision = body?.decision === "accept" ? "accepted" : body?.decision === "decline" ? "declined" : "";
    if (!decision) return NextResponse.json({ ok: false, error: "Choose accept or decline." }, { status: 400 });
    const invitation = await db.marketInvitation.findFirst({ where: { id, specialistId: specialist.id } });
    if (!invitation || invitation.status !== "pending") throw new MarketHttpError(404, "Pending invitation not found.");
    if (invitation.expiresAt && invitation.expiresAt < new Date()) {
      await db.marketInvitation.update({ where: { id }, data: { status: "expired", respondedAt: new Date() } });
      throw new MarketHttpError(410, "This invitation has expired.");
    }
    const updated = await db.marketInvitation.update({
      where: { id },
      data: { status: decision, respondedAt: new Date() },
    });
    return NextResponse.json({ ok: true, invitation: updated });
  } catch (error) {
    return marketErrorResponse(error, "invitations:respond");
  }
}
