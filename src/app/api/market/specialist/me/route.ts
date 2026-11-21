import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toSpecialistDTO } from "@/lib/market";
import { marketErrorResponse, requireMarketSession } from "@/lib/market-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CATEGORIES = ["marketing", "sales", "content", "design", "web", "ops", "finance", "data", "people", "legal"];

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function stringList(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim().slice(0, maxLength)).filter(Boolean))].slice(0, maxItems);
}

function portfolio(value: unknown): { title: string; blurb: string }[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is { title?: unknown; blurb?: unknown } => Boolean(item && typeof item === "object"))
    .map((item) => ({ title: text(item.title, 120), blurb: text(item.blurb, 600) }))
    .filter((item) => item.title && item.blurb)
    .slice(0, 8);
}

function privateProfile(row: Awaited<ReturnType<typeof db.specialist.findUnique>>) {
  if (!row) return null;
  return {
    ...toSpecialistDTO(row),
    status: row.status,
    onboardingStep: row.onboardingStep,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewNote: row.reviewNote,
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireMarketSession(request, { action: "specialist:me", limit: 90 });
    const specialist = await db.specialist.findUnique({ where: { userId: session.userId } });
    return NextResponse.json(
      { ok: true, specialist: privateProfile(specialist) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return marketErrorResponse(error, "specialist:me");
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireMarketSession(request, { mutation: true, action: "specialist:save", limit: 30 });
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid profile data." }, { status: 400 });
    }

    const category = text(body.category, 30);
    if (category && !CATEGORIES.includes(category)) {
      return NextResponse.json({ ok: false, error: "Choose a valid specialist category." }, { status: 400 });
    }
    const hourlyRate = Math.round(Number(body.hourlyRate));
    if (body.hourlyRate !== undefined && (!Number.isFinite(hourlyRate) || hourlyRate < 0 || hourlyRate > 10_000_000)) {
      return NextResponse.json({ ok: false, error: "Enter a valid hourly rate." }, { status: 400 });
    }

    const existing = await db.specialist.findUnique({ where: { userId: session.userId } });
    const nextStatus = existing?.status === "approved" ? "submitted" : existing?.status === "submitted" ? "submitted" : "draft";
    const saved = await db.specialist.upsert({
      where: { userId: session.userId },
      create: {
        userId: session.userId,
        name: text(body.name, 120) || session.name,
        headline: text(body.headline, 160),
        category,
        skills: JSON.stringify(stringList(body.skills, 20, 60)),
        hourlyRate: Number.isFinite(hourlyRate) ? hourlyRate : 0,
        responseTime: text(body.responseTime, 80) || "Within 1 business day",
        location: text(body.location, 120),
        languages: JSON.stringify(stringList(body.languages, 10, 40)),
        bio: text(body.bio, 2500),
        portfolio: JSON.stringify(portfolio(body.portfolio)),
        available: text(body.available, 100) || "Unavailable",
        status: "draft",
        onboardingStep: Math.min(5, Math.max(1, Math.round(Number(body.onboardingStep)) || 1)),
        verified: false,
      },
      update: {
        name: text(body.name, 120) || existing?.name || session.name,
        headline: text(body.headline, 160),
        category,
        skills: JSON.stringify(stringList(body.skills, 20, 60)),
        hourlyRate: Number.isFinite(hourlyRate) ? hourlyRate : existing?.hourlyRate ?? 0,
        responseTime: text(body.responseTime, 80) || "Within 1 business day",
        location: text(body.location, 120),
        languages: JSON.stringify(stringList(body.languages, 10, 40)),
        bio: text(body.bio, 2500),
        portfolio: JSON.stringify(portfolio(body.portfolio)),
        available: text(body.available, 100) || "Unavailable",
        status: nextStatus,
        onboardingStep: Math.min(5, Math.max(1, Math.round(Number(body.onboardingStep)) || existing?.onboardingStep || 1)),
        verified: nextStatus === "submitted" ? false : existing?.verified ?? false,
        reviewNote: nextStatus === "submitted" ? "Profile changed and is awaiting re-review." : existing?.reviewNote,
      },
    });

    return NextResponse.json({ ok: true, specialist: privateProfile(saved) });
  } catch (error) {
    return marketErrorResponse(error, "specialist:save");
  }
}
