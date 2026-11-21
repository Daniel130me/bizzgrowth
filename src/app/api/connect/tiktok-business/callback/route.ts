import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { TIKTOK_PROFILE_STATE_COOKIE, publicBaseUrl, tiktokProfileRedirectUri } from "@/lib/connectors/request";
import { saveCredential, upsertConnection } from "@/lib/connectors/store";
import { tiktokProfileConnector, tiktokProfileIdentity } from "@/lib/connectors/tiktok";

export const runtime = "nodejs";
const same = (a: string, b: string) => { const left = Buffer.from(a); const right = Buffer.from(b); return left.length === right.length && timingSafeEqual(left, right); };

export async function GET(request: NextRequest) {
  const session = await getSession().catch(() => null);
  const expected = request.cookies.get(TIKTOK_PROFILE_STATE_COOKIE)?.value ?? "";
  const state = request.nextUrl.searchParams.get("state") ?? "";
  const code = request.nextUrl.searchParams.get("code") ?? "";
  let result = "tiktok-error";
  try {
    if (!session || !expected || !same(expected, state) || !code || request.nextUrl.searchParams.has("error")) throw new Error("invalid_callback");
    const tokens = await tiktokProfileConnector.exchangeCode({ code, redirectUri: tiktokProfileRedirectUri(request) });
    const credential = await saveCredential(session.userId, tiktokProfileConnector.id, tokens);
    const identity = await tiktokProfileIdentity(tokens.accessToken);
    await upsertConnection({ userId: session.userId, workspaceId: session.workspaceId, credentialId: credential.id, provider: tiktokProfileConnector.id, product: "profile", accountId: identity.id, accountLabel: identity.label, scopes: tokens.scopes });
    result = "tiktok-ok";
  } catch (error) {
    console.error("[connectors] TikTok profile callback failed", error instanceof Error ? error.message : "unknown");
  }
  const response = NextResponse.redirect(new URL(`/?connect=${result}#/integrations`, publicBaseUrl(request)));
  response.cookies.set(TIKTOK_PROFILE_STATE_COOKIE, "", { path: "/api/connect/tiktok-business", maxAge: 0 });
  return response;
}
