import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { measuredSummary } from "@/lib/connectors/summary";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, summary: await measuredSummary(session.userId, session.workspaceId) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: true, summary: { generatedAt: new Date().toISOString(), searchConsole: null, analytics: null, otherSources: [] } }, { headers: { "Cache-Control": "no-store" } });
  }
}
