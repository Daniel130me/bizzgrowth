import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { metaConnector } from "@/lib/connectors/meta";
import { META_OAUTH_STATE_COOKIE, metaRedirectUri, publicBaseUrl } from "@/lib/connectors/request";
import { saveCredential } from "@/lib/connectors/store";

export const runtime = "nodejs";

function sameValue(a: string, b: string): boolean {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: NextRequest) {
  const base = publicBaseUrl(request);
  const session = await getSession().catch(() => null);
  const expected = request.cookies.get(META_OAUTH_STATE_COOKIE)?.value ?? "";
  const state = request.nextUrl.searchParams.get("state") ?? "";
  const code = request.nextUrl.searchParams.get("code") ?? "";
  let result = "meta-error";
  try {
    if (!session || !expected || !state || !sameValue(expected, state) || !code || request.nextUrl.searchParams.has("error")) throw new Error("invalid_callback");
    const tokens = await metaConnector.exchangeCode({ code, redirectUri: metaRedirectUri(request) });
    await saveCredential(session.userId, "meta", tokens);
    result = "meta-ok";
  } catch (error) {
    console.error("[connectors] Meta OAuth callback failed", error instanceof Error ? error.message : "unknown");
  }
  const response = NextResponse.redirect(new URL(`/?connect=${result}#/connect/meta`, base));
  response.cookies.set(META_OAUTH_STATE_COOKIE, "", { path: "/api/connect/meta", maxAge: 0 });
  return response;
}
