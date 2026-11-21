import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { TIKTOK_ADS_STATE_COOKIE, publicBaseUrl, tiktokAdsRedirectUri } from "@/lib/connectors/request";
import { saveCredential } from "@/lib/connectors/store";
import { tiktokAdsConnector } from "@/lib/connectors/tiktok";

export const runtime = "nodejs";
const same = (a: string, b: string) => { const left = Buffer.from(a); const right = Buffer.from(b); return left.length === right.length && timingSafeEqual(left, right); };
export async function GET(request: NextRequest) {
  const session = await getSession().catch(() => null);
  const expected = request.cookies.get(TIKTOK_ADS_STATE_COOKIE)?.value ?? "";
  const state = request.nextUrl.searchParams.get("state") ?? "";
  const code = request.nextUrl.searchParams.get("auth_code") ?? request.nextUrl.searchParams.get("code") ?? "";
  let result = "tiktok-ads-error";
  try {
    if (!session || !expected || !same(expected, state) || !code) throw new Error("invalid_callback");
    const tokens = await tiktokAdsConnector.exchangeCode({ code, redirectUri: tiktokAdsRedirectUri(request) });
    await saveCredential(session.userId, tiktokAdsConnector.id, tokens);
    result = "tiktok-ads-ok";
  } catch (error) { console.error("[connectors] TikTok Ads callback failed", error instanceof Error ? error.message : "unknown"); }
  const response = NextResponse.redirect(new URL(`/?connect=${result}#/connect/tiktok-ads`, publicBaseUrl(request)));
  response.cookies.set(TIKTOK_ADS_STATE_COOKIE, "", { path: "/api/connect/tiktok-ads", maxAge: 0 });
  return response;
}
