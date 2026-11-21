import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { META_SCOPES } from "@/lib/connectors/catalogue";
import { listMetaAccounts } from "@/lib/connectors/meta";
import { accessTokenForCredential } from "@/lib/connectors/sync";
import { getCredential, ownedConnections } from "@/lib/connectors/store";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });
  const credential = await getCredential(session.userId, "meta").catch(() => null);
  if (!credential) return NextResponse.json({ ok: false, error: "Connect Meta first" }, { status: 404 });
  try {
    const [accounts, existing] = await Promise.all([accessTokenForCredential(credential).then(listMetaAccounts), ownedConnections(session.userId)]);
    const scopes = new Set(credential.scopes.split(/\s+/).filter(Boolean));
    return NextResponse.json({ ok: true,
      ads: { granted: scopes.has(META_SCOPES.ads), ...accounts.ads },
      pages: { granted: scopes.has(META_SCOPES.pages) && scopes.has(META_SCOPES.insights), ...accounts.pages },
      instagram: { granted: scopes.has(META_SCOPES.instagram) && scopes.has(META_SCOPES.instagramInsights), ...accounts.instagram },
      current: {
        ads: existing.find((row) => row.provider === "meta" && row.product === "ads")?.externalAccountId ?? null,
        facebook: existing.find((row) => row.provider === "meta" && row.product === "facebook-pages")?.externalAccountId ?? null,
        instagram: existing.find((row) => row.provider === "meta" && row.product === "instagram")?.externalAccountId ?? null,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Meta accounts could not be listed" }, { status: 502 });
  }
}
