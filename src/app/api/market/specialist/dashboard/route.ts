import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { marketErrorResponse, requireMarketSession, requireSpecialist } from "@/lib/market-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await requireMarketSession(request, { action: "specialist:dashboard", limit: 90 });
    const specialist = await requireSpecialist(session);
    const [invitations, bids, engagements, notifications] = await Promise.all([
      db.marketInvitation.findMany({
        where: { specialistId: specialist.id },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { task: true },
      }),
      db.marketBid.findMany({
        where: { specialistId: specialist.id },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { task: true },
      }),
      db.marketEngagement.findMany({
        where: { specialistId: specialist.id },
        orderBy: { updatedAt: "desc" },
        take: 50,
        include: { task: true },
      }),
      db.marketNotification.findMany({
        where: { userId: session.userId },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    ]);

    return NextResponse.json(
      {
        ok: true,
        specialist: {
          id: specialist.id,
          name: specialist.name,
          status: specialist.status,
          verified: specialist.verified,
          onboardingStep: specialist.onboardingStep,
          reviewNote: specialist.reviewNote,
        },
        invitations,
        bids,
        engagements,
        notifications,
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return marketErrorResponse(error, "specialist:dashboard");
  }
}
