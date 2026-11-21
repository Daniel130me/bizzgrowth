import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { encryptionReady } from "@/lib/connectors/crypto";
import { SHOPIFY_OAUTH_STATE_COOKIE, SHOPIFY_SHOP_COOKIE, publicBaseUrl, shopifyRedirectUri } from "@/lib/connectors/request";
import { normalizeShop, shopifyConnector } from "@/lib/connectors/shopify";
import { connectorTablesReady } from "@/lib/connectors/store";

export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const session = await getSession().catch(() => null);
  if (!session) return NextResponse.redirect(new URL("/#/signin", publicBaseUrl(request)));
  const shop = normalizeShop(request.nextUrl.searchParams.get("shop") ?? "");
  if (!shop) return NextResponse.redirect(new URL("/?connect=invalid-shop#/connect/shopify", publicBaseUrl(request)));
  if (!(await connectorTablesReady()) || !encryptionReady() || shopifyConnector.missingConfig().length) return NextResponse.redirect(new URL("/?connect=shopify-not-configured#/integrations", publicBaseUrl(request)));
  const state = randomBytes(32).toString("base64url");
  const redirectUri = shopifyRedirectUri(request);
  const response = NextResponse.redirect(shopifyConnector.authorizeUrl({ state, redirectUri, products: ["orders"], context: { shop } }));
  const options = { httpOnly: true, secure: publicBaseUrl(request).protocol === "https:", sameSite: "lax" as const, path: "/api/connect/shopify", maxAge: 600 };
  response.cookies.set(SHOPIFY_OAUTH_STATE_COOKIE, state, options);
  response.cookies.set(SHOPIFY_SHOP_COOKIE, shop, options);
  return response;
}
