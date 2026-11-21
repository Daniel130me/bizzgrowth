import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { readJson, sameOrigin, str } from "@/lib/auth/http";
import { META_SCOPES } from "@/lib/connectors/catalogue";
import { listMetaAccounts } from "@/lib/connectors/meta";
import { accessTokenForCredential } from "@/lib/connectors/sync";
import { getCredential, upsertConnection } from "@/lib/connectors/store";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, error: "Cross-site request rejected" }, { status: 403 });
  const session = await getSession().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });
  const credential = await getCredential(session.userId, "meta");
  if (!credential) return NextResponse.json({ ok: false, error: "Connect Meta first" }, { status: 404 });
  const body = await readJson(request);
  const adsId = str(body?.ads, 80); const pageId = str(body?.facebook, 80); const instagramId = str(body?.instagram, 80);
  if (!adsId && !pageId && !instagramId) return NextResponse.json({ ok: false, error: "Choose at least one Meta source" }, { status: 400 });
  const grantedScopes = new Set(credential.scopes.split(/\s+/).filter(Boolean));
  const pageScopesGranted = grantedScopes.has(META_SCOPES.pages) && grantedScopes.has(META_SCOPES.pageEngagement) && grantedScopes.has(META_SCOPES.insights);
  const instagramScopesGranted = pageScopesGranted && grantedScopes.has(META_SCOPES.instagram) && grantedScopes.has(META_SCOPES.instagramInsights);
  if (adsId && !grantedScopes.has(META_SCOPES.ads) || pageId && !pageScopesGranted || instagramId && !instagramScopesGranted) {
    return NextResponse.json({ ok: false, error: "Meta did not grant every permission required by the selected sources. Reconnect Meta and approve them." }, { status: 403 });
  }
  const accounts = await accessTokenForCredential(credential).then(listMetaAccounts);
  const ads = accounts.ads.accounts.find((item) => item.id === adsId);
  const page = accounts.pages.pages.find((item) => item.id === pageId);
  const instagram = accounts.instagram.accounts.find((item) => item.id === instagramId);
  if (adsId && !ads || pageId && !page || instagramId && !instagram) return NextResponse.json({ ok: false, error: "One selected Meta account is no longer available" }, { status: 403 });
  const ids: string[] = [];
  if (ads) ids.push(await upsertConnection({ userId: session.userId, workspaceId: session.workspaceId, credentialId: credential.id, provider: "meta", product: "ads", accountId: ads.id, accountLabel: ads.label, scopes: [META_SCOPES.ads] }));
  if (page) ids.push(await upsertConnection({ userId: session.userId, workspaceId: session.workspaceId, credentialId: credential.id, provider: "meta", product: "facebook-pages", accountId: page.id, accountLabel: page.label, scopes: [META_SCOPES.pages, META_SCOPES.pageEngagement, META_SCOPES.insights] }));
  if (instagram) ids.push(await upsertConnection({ userId: session.userId, workspaceId: session.workspaceId, credentialId: credential.id, provider: "meta", product: "instagram", accountId: instagram.id, accountLabel: instagram.label, scopes: [META_SCOPES.instagram, META_SCOPES.instagramInsights], config: { pageId: instagram.pageId } }));
  return NextResponse.json({ ok: true, connectionIds: ids });
}
