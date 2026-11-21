import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isEmail, jsonError, readJson, sameOrigin } from "@/lib/auth/http";
import { validateWaitlistSubmission } from "@/lib/waitlist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_MS = 10 * 60_000;
const MAX_SUBMISSIONS = 10;
type RateBucket = { count: number; resetAt: number };
const globalRateLimit = globalThis as typeof globalThis & { __waitlistRateBuckets?: Map<string, RateBucket> };
const rateBuckets = (globalRateLimit.__waitlistRateBuckets ??= new Map<string, RateBucket>());

function rateLimited(request: Request): boolean {
  const ip = (request.headers.get("x-forwarded-for")?.split(",")[0] || request.headers.get("x-real-ip") || "unknown").trim();
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  const current = bucket && bucket.resetAt > now ? bucket : { count: 0, resetAt: now + WINDOW_MS };
  current.count += 1;
  rateBuckets.set(ip, current);
  if (rateBuckets.size > 10_000) {
    for (const [key, value] of rateBuckets) {
      if (value.resetAt <= now) rateBuckets.delete(key);
    }
  }
  return current.count > MAX_SUBMISSIONS;
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return jsonError(403, "Cross-site request blocked.");
  const body = await readJson(request);

  // Quietly discard automated form fills without collecting their contents.
  if (typeof body?.website === "string" && body.website.trim()) {
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  }
  if (rateLimited(request)) return jsonError(429, "Too many requests. Please wait a few minutes and try again.");

  const validation = validateWaitlistSubmission(body);
  if (!validation.ok) return jsonError(400, validation.error, { field: validation.field });
  const { name, email, audience, businessName, industry, specialty, experience } = validation.value;

  try {
    await db.$queryRaw<{ id: string }[]>`
      INSERT INTO "WaitlistSignup" (
        "id", "name", "email", "audience", "businessName", "industry", "specialty", "experience"
      )
      VALUES (
        ${randomUUID()}, ${name}, ${email}, ${audience}, ${businessName}, ${industry}, ${specialty}, ${experience}
      )
      ON CONFLICT (lower("email")) DO NOTHING
      RETURNING "id"`;
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[api/waitlist] Could not save request:", error);
    return jsonError(503, "We couldn't save your request right now. Please try again in a moment.");
  }
}
