import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { readJson, sameOrigin, str } from "@/lib/auth/http";
import { CATALOGUE } from "@/lib/connectors/catalogue";
import { connectorTablesReady, setInterest } from "@/lib/connectors/store";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, error: "Cross-site request rejected" }, { status: 403 });
  const session = await getSession().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });
  if (!(await connectorTablesReady())) return NextResponse.json({ ok: false, error: "Connections database is not ready" }, { status: 503 });
  const body = await readJson(request);
  const platform = str(body?.platform, 80);
  const entry = CATALOGUE.find((item) => item.id === platform && item.availability === "soon");
  if (!entry) return NextResponse.json({ ok: false, error: "Unknown platform" }, { status: 400 });
  await setInterest(session.userId, platform, body?.enabled !== false);
  return NextResponse.json({ ok: true });
}
