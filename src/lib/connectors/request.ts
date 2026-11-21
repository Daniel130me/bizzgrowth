import type { NextRequest } from "next/server";

/**
 * Shared by the two OAuth endpoints without importing one route module from another.
 * The cookie names keep the old "bizz_" prefix on purpose: renaming one would break
 * a connection flow that is already in progress.
 */
export const GOOGLE_OAUTH_STATE_COOKIE = "bizz_google_oauth_state";
export const META_OAUTH_STATE_COOKIE = "bizz_meta_oauth_state";
export const TIKTOK_ADS_STATE_COOKIE = "bizz_tiktok_ads_state";
export const TIKTOK_PROFILE_STATE_COOKIE = "bizz_tiktok_profile_state";
export const SHOPIFY_OAUTH_STATE_COOKIE = "bizz_shopify_oauth_state";
export const SHOPIFY_SHOP_COOKIE = "bizz_shopify_shop";

export function publicBaseUrl(request: NextRequest): URL {
  const configured = (process.env.APP_URL ?? "").trim();
  if (configured) return new URL(configured.endsWith("/") ? configured : `${configured}/`);
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || request.nextUrl.protocol.replace(":", "") || "http";
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || request.headers.get("host") || request.nextUrl.host;
  return new URL(`${proto}://${host}/`);
}

export function googleRedirectUri(request: NextRequest): string {
  return (process.env.GOOGLE_REDIRECT_URI ?? "").trim() || new URL("api/connect/google/callback", publicBaseUrl(request)).toString();
}

export function metaRedirectUri(request: NextRequest): string {
  return (process.env.META_REDIRECT_URI ?? "").trim() || new URL("api/connect/meta/callback", publicBaseUrl(request)).toString();
}

export function tiktokAdsRedirectUri(request: NextRequest): string {
  return (process.env.TIKTOK_ADS_REDIRECT_URI ?? "").trim() || new URL("api/connect/tiktok-ads/callback", publicBaseUrl(request)).toString();
}

export function tiktokProfileRedirectUri(request: NextRequest): string {
  return (process.env.TIKTOK_REDIRECT_URI ?? "").trim() || new URL("api/connect/tiktok-business/callback", publicBaseUrl(request)).toString();
}

export function shopifyRedirectUri(request: NextRequest): string {
  return (process.env.SHOPIFY_REDIRECT_URI ?? "").trim() || new URL("api/connect/shopify/callback", publicBaseUrl(request)).toString();
}
