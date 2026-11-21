import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { marketErrorResponse, requireMarketSession, requireSpecialist } from "@/lib/market-auth";

export const runtime = "nodejs";

function parsedList(raw: string): unknown[] {
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireMarketSession(request, { mutation: true, action: "specialist:submit", limit: 10 });
    const specialist = await requireSpecialist(session);
    if (specialist.status === "approved") {
      return NextResponse.json({ ok: true, status: "approved" });
    }

    const missing: string[] = [];
    if (specialist.name.trim().length < 2) missing.push("full name");
    if (specialist.headline.trim().length < 20) missing.push("professional headline");
    if (!specialist.category) missing.push("category");
    if (parsedList(specialist.skills).length < 3) missing.push("at least 3 skills");
    if (specialist.hourlyRate < 1) missing.push("hourly rate");
    if (specialist.location.trim().length < 2) missing.push("location");
    if (parsedList(specialist.languages).length < 1) missing.push("language");
    if (specialist.bio.trim().length < 80) missing.push("bio of at least 80 characters");
    if (missing.length) {
      return NextResponse.json(
        { ok: false, error: `Complete your ${missing.join(", ")} before submitting.`, missing },
        { status: 422 },
      );
    }

    const submitted = await db.specialist.update({
      where: { id: specialist.id },
      data: {
        status: "submitted",
        verified: false,
        onboardingStep: 5,
        submittedAt: new Date(),
        reviewNote: null,
      },
    });
    return NextResponse.json({ ok: true, status: submitted.status, submittedAt: submitted.submittedAt?.toISOString() });
  } catch (error) {
    return marketErrorResponse(error, "specialist:submit");
  }
}
