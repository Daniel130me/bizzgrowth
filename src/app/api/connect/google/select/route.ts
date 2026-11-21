import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { readJson, sameOrigin, str } from "@/lib/auth/http";
import { GOOGLE_SCOPES } from "@/lib/connectors/catalogue";
import { googleSheetId, listGoogleAccounts, previewGoogleSheet } from "@/lib/connectors/google";
import { accessTokenForCredential } from "@/lib/connectors/sync";
import { getCredential, upsertConnection } from "@/lib/connectors/store";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, error: "Cross-site request rejected" }, { status: 403 });
  const session = await getSession().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });
  const credential = await getCredential(session.userId, "google").catch(() => null);
  if (!credential) return NextResponse.json({ ok: false, error: "Connect Google first" }, { status: 404 });
  const body = await readJson(request);
  const searchConsoleId = str(body?.searchConsole, 500);
  const analyticsId = str(body?.analytics, 200);
  const adsId = str(body?.ads, 40).replace(/\D/g, "");
  const sheetId = googleSheetId(str(body?.sheet, 500));
  const sheetConfig = body?.sheetConfig && typeof body.sheetConfig === "object" && !Array.isArray(body.sheetConfig)
    ? body.sheetConfig as Record<string, unknown>
    : {};
  const sheetTab = str(sheetConfig.tab, 200);
  const column = (name: string) => {
    const value = sheetConfig[name];
    return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : undefined;
  };
  if (!searchConsoleId && !analyticsId && !adsId && !sheetId) return NextResponse.json({ ok: false, error: "Choose at least one Google source" }, { status: 400 });

  const grantedScopes = new Set(credential.scopes.split(/\s+/).filter(Boolean));
  if (searchConsoleId && !grantedScopes.has(GOOGLE_SCOPES.searchConsole)
    || analyticsId && !grantedScopes.has(GOOGLE_SCOPES.analytics)
    || adsId && !grantedScopes.has(GOOGLE_SCOPES.ads)
    || sheetId && !grantedScopes.has(GOOGLE_SCOPES.sheets)) {
    return NextResponse.json({ ok: false, error: "Google did not grant every permission required by the selected sources. Reconnect Google and approve them." }, { status: 403 });
  }

  const accessToken = await accessTokenForCredential(credential);
  const accounts = await listGoogleAccounts(accessToken);
  const site = accounts.searchConsole.sites.find((item) => item.id === searchConsoleId);
  const property = accounts.analytics.properties.find((item) => item.id === analyticsId);
  const ads = accounts.ads.accounts.find((item) => item.id === adsId);
  if (searchConsoleId && !site) return NextResponse.json({ ok: false, error: "That Search Console site is not available to this Google account" }, { status: 403 });
  if (analyticsId && !property) return NextResponse.json({ ok: false, error: "That Analytics property is not available to this Google account" }, { status: 403 });
  if (adsId && !ads) return NextResponse.json({ ok: false, error: "That Google Ads account is not available to this Google account" }, { status: 403 });
  let sheet: Awaited<ReturnType<typeof previewGoogleSheet>> | null = null;
  if (sheetId) {
    const preview = await previewGoogleSheet(accessToken, sheetId);
    sheet = preview;
    const selectedTab = preview.tabs.find((tab) => tab.title === sheetTab);
    if (!sheetTab || !selectedTab || column("dateColumn") === undefined) {
      return NextResponse.json({ ok: false, error: "Choose a valid spreadsheet tab and date column" }, { status: 400 });
    }
    const mappedColumns = [column("dateColumn"), column("revenueColumn"), column("expenseColumn"), column("customersColumn")].filter((value): value is number => value !== undefined);
    if (mappedColumns.some((value) => value >= selectedTab.headers.length)) {
      return NextResponse.json({ ok: false, error: "One mapped spreadsheet column is no longer available" }, { status: 400 });
    }
    if ([column("revenueColumn"), column("expenseColumn"), column("customersColumn")].every((value) => value === undefined)) {
      return NextResponse.json({ ok: false, error: "Map at least one financial or customer column" }, { status: 400 });
    }
  }

  const ids: string[] = [];
  if (site) ids.push(await upsertConnection({ userId: session.userId, workspaceId: session.workspaceId, credentialId: credential.id, provider: "google", product: "search-console", accountId: site.id, accountLabel: site.label, scopes: [GOOGLE_SCOPES.searchConsole] }));
  if (property) ids.push(await upsertConnection({ userId: session.userId, workspaceId: session.workspaceId, credentialId: credential.id, provider: "google", product: "analytics", accountId: property.id, accountLabel: property.label, scopes: [GOOGLE_SCOPES.analytics] }));
  if (ads) ids.push(await upsertConnection({ userId: session.userId, workspaceId: session.workspaceId, credentialId: credential.id, provider: "google", product: "ads", accountId: ads.id, accountLabel: ads.label, scopes: [GOOGLE_SCOPES.ads] }));
  if (sheet && sheetId) ids.push(await upsertConnection({
    userId: session.userId, workspaceId: session.workspaceId, credentialId: credential.id, provider: "google", product: "sheets",
    accountId: sheetId, accountLabel: `${sheet.name} — ${sheetTab}`, scopes: [GOOGLE_SCOPES.sheets],
    config: { tab: sheetTab, dateColumn: column("dateColumn"), revenueColumn: column("revenueColumn"), expenseColumn: column("expenseColumn"), customersColumn: column("customersColumn") },
  }));
  return NextResponse.json({ ok: true, connectionIds: ids });
}
