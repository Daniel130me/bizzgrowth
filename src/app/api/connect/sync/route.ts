import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { readJson, sameOrigin } from "@/lib/auth/http";
import { connectorTablesReady, ownedConnections } from "@/lib/connectors/store";
import { syncAllStale, syncConnectionRows } from "@/lib/connectors/sync";

export const runtime = "nodejs";
export const maxDuration = 120;

function cronAuthorized(request: NextRequest): boolean {
  const expected = (process.env.CRON_SECRET ?? "").trim();
  const supplied = request.headers.get("x-cron-secret") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  // App-open syncs are intentionally a no-op before the additive schema is installed.
  // This keeps existing sessions healthy while deployment setup is still incomplete.
  if (!(await connectorTablesReady())) {
    return NextResponse.json({ ok: true, synced: 0, results: [] });
  }
  if (cronAuthorized(request)) {
    const results = await syncAllStale();
    return NextResponse.json({ ok: true, synced: results.length, results });
  }
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, error: "Cross-site request rejected" }, { status: 403 });
  const session = await getSession().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });
  const body = await readJson(request);
  const ids = Array.isArray(body?.connectionIds) ? body.connectionIds.filter((id): id is string => typeof id === "string").slice(0, 10) : undefined;
  const candidates = await ownedConnections(session.userId, ids);
  const staleCutoff = Date.now() - 24 * 60 * 60 * 1_000;
  const rows = body?.staleOnly === true
    ? candidates.filter((row) => !row.lastSyncAt || row.lastSyncAt.getTime() < staleCutoff)
    : candidates;
  const results = await syncConnectionRows(rows);
  return NextResponse.json({ ok: results.every((result) => result.ok), results }, { status: results.some((result) => !result.ok) ? 207 : 200 });
}
