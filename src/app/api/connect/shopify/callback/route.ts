import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { SHOPIFY_OAUTH_STATE_COOKIE, SHOPIFY_SHOP_COOKIE, publicBaseUrl, shopifyRedirectUri } from "@/lib/connectors/request";
import { normalizeShop, shopIdentity, shopifyConnector, verifyShopifyHmac } from "@/lib/connectors/shopify";
import { saveCredential, upsertConnection } from "@/lib/connectors/store";

export const runtime = "nodejs";
const same = (a: string, b: string) => { const left = Buffer.from(a); const right = Buffer.from(b); return left.length === right.length && timingSafeEqual(left, right); };
export async function GET(request: NextRequest) {
  const session = await getSession().catch(() => null);
  const expectedState = request.cookies.get(SHOPIFY_OAUTH_STATE_COOKIE)?.value ?? "";
  const expectedShop = request.cookies.get(SHOPIFY_SHOP_COOKIE)?.value ?? "";
  const state = request.nextUrl.searchParams.get("state") ?? "";
  const shop = normalizeShop(request.nextUrl.searchParams.get("shop") ?? "");
  const code = request.nextUrl.searchParams.get("code") ?? "";
  let result = "shopify-error";
  try {
    if (!session || !expectedState || !same(expectedState, state) || !shop || shop !== expectedShop || !code || !verifyShopifyHmac(request.nextUrl.searchParams)) throw new Error("invalid_callback");
    const tokens = await shopifyConnector.exchangeCode({ code, redirectUri: shopifyRedirectUri(request), context: { shop } });
    const identity = await shopIdentity(shop, tokens.accessToken);
    if (identity.shop.myshopifyDomain !== shop) throw new Error("shop_mismatch");
    const credential = await saveCredential(session.userId, shopifyConnector.id, tokens);
    await upsertConnection({ userId: session.userId, workspaceId: session.workspaceId, credentialId: credential.id, provider: shopifyConnector.id, product: "orders", accountId: shop, accountLabel: `${identity.shop.name} — ${shop}`, scopes: tokens.scopes });
    result = "shopify-ok";
  } catch (error) { console.error("[connectors] Shopify callback failed", error instanceof Error ? error.message : "unknown"); }
  const response = NextResponse.redirect(new URL(`/?connect=${result}#/integrations`, publicBaseUrl(request)));
  response.cookies.set(SHOPIFY_OAUTH_STATE_COOKIE, "", { path: "/api/connect/shopify", maxAge: 0 });
  response.cookies.set(SHOPIFY_SHOP_COOKIE, "", { path: "/api/connect/shopify", maxAge: 0 });
  return response;
}
