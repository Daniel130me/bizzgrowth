import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { googleConnector } from "@/lib/connectors/google";
import { GOOGLE_OAUTH_STATE_COOKIE, googleRedirectUri, publicBaseUrl } from "@/lib/connectors/request";
import { saveCredential } from "@/lib/connectors/store";

export const runtime = "nodejs";

function sameValue(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: NextRequest) {
  const base = publicBaseUrl(request);
  const session = await getSession().catch(() => null);
  const expected = request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value ?? "";
  const state = request.nextUrl.searchParams.get("state") ?? "";
  const code = request.nextUrl.searchParams.get("code") ?? "";
  const denied = request.nextUrl.searchParams.get("error");
  let result = "google-error";
  try {
    if (!session) throw new Error("session");
    if (!expected || !state || !sameValue(expected, state)) throw new Error("state");
    if (denied || !code) throw new Error("denied");
    const tokens = await googleConnector.exchangeCode({ code, redirectUri: googleRedirectUri(request) });
    await saveCredential(session.userId, "google", tokens);
    result = "google-ok";
  } catch (error) {
    console.error("[connectors] Google OAuth callback failed", error instanceof Error ? error.message : "unknown");
  }
  const response = NextResponse.redirect(new URL(`/?connect=${result}#/connect/google`, base));
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, "", { path: "/api/connect/google", maxAge: 0 });
  return response;
}
