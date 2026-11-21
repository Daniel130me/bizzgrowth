import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { encryptionReady } from "@/lib/connectors/crypto";
import { TIKTOK_PROFILE_STATE_COOKIE, publicBaseUrl, tiktokProfileRedirectUri } from "@/lib/connectors/request";
import { connectorTablesReady } from "@/lib/connectors/store";
import { tiktokProfileConnector } from "@/lib/connectors/tiktok";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await getSession().catch(() => null);
  if (!session) return NextResponse.redirect(new URL("/#/signin", publicBaseUrl(request)));
  if (!(await connectorTablesReady()) || !encryptionReady() || tiktokProfileConnector.missingConfig().length) return NextResponse.redirect(new URL("/?connect=tiktok-not-configured#/integrations", publicBaseUrl(request)));
  const state = randomBytes(32).toString("base64url");
  const redirectUri = tiktokProfileRedirectUri(request);
  const response = NextResponse.redirect(tiktokProfileConnector.authorizeUrl({ state, redirectUri, products: ["profile"] }));
  response.cookies.set(TIKTOK_PROFILE_STATE_COOKIE, state, { httpOnly: true, secure: publicBaseUrl(request).protocol === "https:", sameSite: "lax", path: "/api/connect/tiktok-business", maxAge: 600 });
  return response;
}
