import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { encryptionReady } from "@/lib/connectors/crypto";
import { googleConnector } from "@/lib/connectors/google";
import { GOOGLE_OAUTH_STATE_COOKIE, googleRedirectUri, publicBaseUrl } from "@/lib/connectors/request";
import { connectorTablesReady } from "@/lib/connectors/store";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await getSession().catch(() => null);
  if (!session) return NextResponse.redirect(new URL("/#/signin", publicBaseUrl(request)));
  if (!(await connectorTablesReady()) || !encryptionReady() || googleConnector.missingConfig().length) {
    return NextResponse.redirect(new URL("/?connect=google-not-configured#/connect/google", publicBaseUrl(request)));
  }
  const requested = (request.nextUrl.searchParams.get("products") ?? googleConnector.products.map((product) => product.id).join(",")).split(",");
  const products = requested.filter((id) => googleConnector.products.some((product) => product.id === id));
  if (!products.length) products.push(...googleConnector.products.map((product) => product.id));
  const state = randomBytes(32).toString("base64url");
  const redirectUri = googleRedirectUri(request);
  const response = NextResponse.redirect(googleConnector.authorizeUrl({ state, redirectUri, products }));
  const secure = publicBaseUrl(request).protocol === "https:";
  const options = { httpOnly: true, secure, sameSite: "lax" as const, path: "/api/connect/google", maxAge: 600 };
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, options);
  return response;
}
