import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { encryptionReady } from "@/lib/connectors/crypto";
import { TIKTOK_ADS_STATE_COOKIE, publicBaseUrl, tiktokAdsRedirectUri } from "@/lib/connectors/request";
import { connectorTablesReady } from "@/lib/connectors/store";
import { tiktokAdsConnector } from "@/lib/connectors/tiktok";

export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const session = await getSession().catch(() => null);
  if (!session) return NextResponse.redirect(new URL("/#/signin", publicBaseUrl(request)));
  if (!(await connectorTablesReady()) || !encryptionReady() || tiktokAdsConnector.missingConfig().length) return NextResponse.redirect(new URL("/?connect=tiktok-ads-not-configured#/integrations", publicBaseUrl(request)));
  const state = randomBytes(32).toString("base64url");
  const response = NextResponse.redirect(tiktokAdsConnector.authorizeUrl({ state, redirectUri: tiktokAdsRedirectUri(request), products: ["ads"] }));
  response.cookies.set(TIKTOK_ADS_STATE_COOKIE, state, { httpOnly: true, secure: publicBaseUrl(request).protocol === "https:", sameSite: "lax", path: "/api/connect/tiktok-ads", maxAge: 3_600 });
  return response;
}
