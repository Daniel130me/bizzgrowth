import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { encryptionReady } from "@/lib/connectors/crypto";
import { metaConnector } from "@/lib/connectors/meta";
import { META_OAUTH_STATE_COOKIE, metaRedirectUri, publicBaseUrl } from "@/lib/connectors/request";
import { connectorTablesReady } from "@/lib/connectors/store";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await getSession().catch(() => null);
  if (!session) return NextResponse.redirect(new URL("/#/signin", publicBaseUrl(request)));
  if (!(await connectorTablesReady()) || !encryptionReady() || metaConnector.missingConfig().length) {
    return NextResponse.redirect(new URL("/?connect=meta-not-configured#/integrations", publicBaseUrl(request)));
  }
  const requested = (request.nextUrl.searchParams.get("products") ?? metaConnector.products.map((product) => product.id).join(",")).split(",");
  const products = requested.filter((id) => metaConnector.products.some((product) => product.id === id));
  if (!products.length) products.push(...metaConnector.products.map((product) => product.id));
  const state = randomBytes(32).toString("base64url");
  const response = NextResponse.redirect(metaConnector.authorizeUrl({ state, redirectUri: metaRedirectUri(request), products }));
  response.cookies.set(META_OAUTH_STATE_COOKIE, state, { httpOnly: true, secure: publicBaseUrl(request).protocol === "https:", sameSite: "lax", path: "/api/connect/meta", maxAge: 600 });
  return response;
}
