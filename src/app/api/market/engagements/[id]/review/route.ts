import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { MarketHttpError, marketErrorResponse, notifyUser, requireMarketSession } from "@/lib/market-auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireMarketSession(request, { mutation: true, action: "reviews:create", limit: 10 });
    const { id } = await params;
    const engagement = await db.marketEngagement.findUnique({ where: { id }, include: { specialist: true, task: true } });
    if (!engagement || engagement.workspaceId !== session.workspaceId) throw new MarketHttpError(404, "Engagement not found.");
    if (engagement.status !== "completed") throw new MarketHttpError(409, "Complete the engagement before reviewing it.");
    const body = await request.json().catch(() => null);
    const rating = Math.round(Number(body?.rating));
    const comment = typeof body?.comment === "string" ? body.comment.trim().slice(0, 2000) : "";
    if (rating < 1 || rating > 5) return NextResponse.json({ ok: false, error: "Rating must be between 1 and 5." }, { status: 400 });
    if (comment.length < 20) return NextResponse.json({ ok: false, error: "Write at least 20 characters about the work." }, { status: 400 });

    await db.$transaction(async (tx) => {
      const created = await tx.marketReview.createMany({
        data: [{
          engagementId: id,
          reviewerUserId: session.userId,
          revieweeSpecialistId: engagement.specialistId,
          rating,
          comment,
        }],
        skipDuplicates: true,
      });
      if (created.count !== 1) throw new MarketHttpError(409, "You have already reviewed this engagement.");
      const aggregate = await tx.marketReview.aggregate({
        where: { revieweeSpecialistId: engagement.specialistId },
        _avg: { rating: true },
        _count: { rating: true },
      });
      await tx.specialist.update({
        where: { id: engagement.specialistId },
        data: { rating: aggregate._avg.rating ?? 0, reviews: aggregate._count.rating },
      });
    });
    await notifyUser({
      userId: engagement.specialist.userId,
      type: "market-review",
      title: "You received a review",
      body: `${rating}/5 for “${engagement.task.title}”.`,
      entityType: "engagement",
      entityId: id,
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return marketErrorResponse(error, "reviews:create");
  }
}
