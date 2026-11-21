import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { GOOGLE_SCOPES } from "@/lib/connectors/catalogue";
import { listGoogleAccounts } from "@/lib/connectors/google";
import { accessTokenForCredential } from "@/lib/connectors/sync";
import { getCredential, ownedConnections } from "@/lib/connectors/store";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });
  const credential = await getCredential(session.userId, "google").catch(() => null);
  if (!credential) return NextResponse.json({ ok: false, error: "Connect Google first" }, { status: 404 });
  try {
    const [accounts, existing] = await Promise.all([
      accessTokenForCredential(credential).then(listGoogleAccounts),
      ownedConnections(session.userId),
    ]);
    const scopes = new Set(credential.scopes.split(/\s+/).filter(Boolean));
    return NextResponse.json({
      ok: true,
      searchConsole: { granted: scopes.has(GOOGLE_SCOPES.searchConsole), ...accounts.searchConsole },
      analytics: { granted: scopes.has(GOOGLE_SCOPES.analytics), ...accounts.analytics },
      ads: { granted: scopes.has(GOOGLE_SCOPES.ads), ...accounts.ads },
      sheets: { granted: scopes.has(GOOGLE_SCOPES.sheets) },
      current: {
        searchConsole: existing.find((row) => row.provider === "google" && row.product === "search-console")?.externalAccountId ?? null,
        analytics: existing.find((row) => row.provider === "google" && row.product === "analytics")?.externalAccountId ?? null,
        ads: existing.find((row) => row.provider === "google" && row.product === "ads")?.externalAccountId ?? null,
        sheets: existing.find((row) => row.provider === "google" && row.product === "sheets")?.externalAccountId ?? null,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Google accounts could not be listed" }, { status: 502 });
  }
}
