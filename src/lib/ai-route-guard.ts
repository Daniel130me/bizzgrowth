// Every AI route spends paid provider credit, so only a signed-in account may
// call one — the screens that use them are all behind sign-in already — and a
// runaway script is stopped by a per-account limit that real use never hits.
//
// MUST only be imported from API routes / server code.

import { NextResponse } from "next/server";
import { getSession, type SessionUser } from "./auth/session";

type Bucket = { count: number; resetAt: number };
const store = globalThis as unknown as { __bizzAiRateBuckets?: Map<string, Bucket> };
const buckets = (store.__bizzAiRateBuckets ??= new Map<string, Bucket>());

/** AI calls per feature per account per minute. A checkup turn or an Ask is one call; owners do a few a minute at most. */
export const AI_ROUTE_LIMIT_PER_MINUTE = 40;

/** True when this key is over its limit in the current window (counts the call). Pure apart from the shared buckets. */
export function aiRateLimited(key: string, limit = AI_ROUTE_LIMIT_PER_MINUTE, windowMs = 60_000, now = Date.now(), map = buckets): boolean {
  const current = map.get(key);
  const bucket = current && current.resetAt > now ? current : { count: 0, resetAt: now + windowMs };
  bucket.count += 1;
  map.set(key, bucket);
  if (map.size > 10_000) {
    for (const [k, v] of map) if (v.resetAt <= now) map.delete(k);
  }
  return bucket.count > limit;
}

/** The signed-in account for an AI route — or the response to send instead (401 signed out, 429 too many). */
export async function requireAiSession(feature: string): Promise<{ session: SessionUser; response?: never } | { session?: never; response: NextResponse }> {
  const session = await getSession().catch(() => null);
  if (!session) {
    return { response: NextResponse.json({ ok: false, error: "Please sign in again to use Nellovia." }, { status: 401, headers: { "Cache-Control": "no-store" } }) };
  }
  if (aiRateLimited(`${session.userId}:${feature}`)) {
    return {
      response: NextResponse.json({ ok: false, error: "That's a lot of requests in a minute — please wait a moment and try again." }, { status: 429, headers: { "Cache-Control": "no-store" } }),
    };
  }
  return { session };
}
