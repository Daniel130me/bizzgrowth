import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { configuredProviders } from "@/lib/connectors/registry";
import { encryptionReady } from "@/lib/connectors/crypto";
import { connectorTablesReady, listConnections, listInterest } from "@/lib/connectors/store";

export const runtime = "nodejs";

export async function GET() {
  let session;
  try {
    session = await getSession();
  } catch (error) {
    console.error("[connectors] Status session lookup failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json(
      { ok: false, error: "Connections are temporarily unavailable. Try again shortly." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!session) return NextResponse.json({ ok: false, signedIn: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
  let tablesReady: boolean;
  try {
    tablesReady = await connectorTablesReady();
  } catch (error) {
    console.error("[connectors] Readiness check failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json(
      { ok: false, error: "Connections are temporarily unavailable. Try again shortly." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  const providers = configuredProviders();
  if (!encryptionReady()) {
    for (const provider of Object.values(providers)) {
      provider.configured = false;
      if (!provider.missing.includes("CONNECTIONS_ENCRYPTION_KEY")) provider.missing.push("CONNECTIONS_ENCRYPTION_KEY");
    }
  }
  const [connections, interest] = tablesReady ? await Promise.all([listConnections(session.userId), listInterest(session.userId)]) : [[], []];
  return NextResponse.json(
    { ok: true, signedIn: true, tablesReady, providers, connections, interest },
    { headers: { "Cache-Control": "no-store" } },
  );
}
