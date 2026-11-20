import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
} as const;

/**
 * The default liveness probe avoids waking Neon on every container health
 * check. Add `?readiness=1` during deployments or low-frequency monitoring to
 * verify the database with a minimal query.
 */
export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("readiness") !== "1") {
    return NextResponse.json({ status: "alive" }, { headers: RESPONSE_HEADERS });
  }

  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ready" }, { headers: RESPONSE_HEADERS });
  } catch (error) {
    console.error("[health] database readiness check failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json({ status: "not_ready" }, { status: 503, headers: RESPONSE_HEADERS });
  }
}
