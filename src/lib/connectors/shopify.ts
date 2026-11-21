import { createHmac, timingSafeEqual } from "crypto";
import { ConnectorError, type DateRange, type MetricPoint, type OAuth2Connector, type TokenSet } from "./types";

const REQUEST_TIMEOUT_MS = 30_000;
export const SHOPIFY_SCOPES = ["read_orders"];

function configured(name: string): string { return (process.env[name] ?? "").trim(); }

export function normalizeShop(value: string): string | null {
  const cleaned = value.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0];
  const domain = cleaned.endsWith(".myshopify.com") ? cleaned : `${cleaned}.myshopify.com`;
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(domain) ? domain : null;
}

export function verifyShopifyHmac(params: URLSearchParams): boolean {
  const received = params.get("hmac") ?? "";
  if (!/^[a-f0-9]{64}$/i.test(received)) return false;
  const pairs = [...params.entries()].filter(([key]) => key !== "hmac" && key !== "signature").sort(([a], [b]) => a.localeCompare(b));
  const message = pairs.map(([key, value]) => `${key}=${value}`).join("&");
  const expected = createHmac("sha256", configured("SHOPIFY_CLIENT_SECRET")).update(message).digest("hex");
  return timingSafeEqual(Buffer.from(received, "hex"), Buffer.from(expected, "hex"));
}

function apiVersion(): string {
  const value = configured("SHOPIFY_API_VERSION") || "2026-10";
  return /^\d{4}-(01|04|07|10)$/.test(value) ? value : "2026-10";
}

async function tokenRequest(
  shop: string,
  body: Record<string, string>,
  requireGrantedScope = false,
): Promise<TokenSet> {
  const form = new URLSearchParams(body);
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: form,
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const payload = await response.json().catch(() => ({})) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error_description?: string };
  if (!response.ok || !payload.access_token) throw new ConnectorError(response.status === 401 ? "reauth" : "auth", "Shopify authorization could not be completed.", payload.error_description ?? `HTTP ${response.status}`);

  const scopes = payload.scope?.split(",").map((scope) => scope.trim()).filter(Boolean) ?? [];
  if (requireGrantedScope && !scopes.includes("read_orders")) {
    throw new ConnectorError(
      "scope_missing",
      "Shopify did not grant permission to read orders. Reconnect and approve the requested permission.",
    );
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? null,
    expiresAt: payload.expires_in ? new Date(Date.now() + payload.expires_in * 1_000) : null,
    scopes,
    metadata: { shop },
  };
}

async function graph<T>(shop: string, accessToken: string, query: string, variables: Record<string, unknown>): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`https://${shop}/admin/api/${apiVersion()}/graphql.json`, { method: "POST", headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": accessToken }, body: JSON.stringify({ query, variables }), cache: "no-store", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (error) {
    throw new ConnectorError("network", "Shopify could not be reached. Try again shortly.", error instanceof Error ? error.name : "fetch_failed");
  }
  const payload = await response.json().catch(() => ({})) as { data?: T; errors?: Array<{ message?: string; extensions?: { code?: string } }> };
  if (response.ok && payload.data && !payload.errors?.length) return payload.data;
  const detail = payload.errors?.map((error) => error.message).filter(Boolean).join("; ") || `HTTP ${response.status}`;
  if (response.status === 401) throw new ConnectorError("reauth", "Shopify authorization expired. Reconnect the store.", detail);
  if (response.status === 403 || payload.errors?.some((error) => error.extensions?.code === "ACCESS_DENIED")) throw new ConnectorError("scope_missing", "Shopify did not grant access to read orders.", detail);
  if (response.status === 429) throw new ConnectorError("rate_limited", "Shopify is temporarily rate-limiting this sync. Try again later.", detail);
  throw new ConnectorError("upstream", "Shopify returned an unexpected error.", detail);
}

async function shopIdentity(shop: string, accessToken: string) {
  return graph<{ shop: { name: string; myshopifyDomain: string; currencyCode: string } }>(shop, accessToken, "query { shop { name myshopifyDomain currencyCode } }", {});
}

async function syncOrders(shop: string, accessToken: string, range: DateRange): Promise<MetricPoint[]> {
  const query = `query Orders($first: Int!, $after: String, $query: String!) { orders(first: $first, after: $after, query: $query, sortKey: CREATED_AT) { nodes { createdAt cancelledAt totalQuantity totalPriceSet { shopMoney { amount } } currentTotalPriceSet { shopMoney { amount } } totalRefundedSet { shopMoney { amount } } } pageInfo { hasNextPage endCursor } } }`;
  const totals = new Map<string, { orders: number; gross: number; revenue: number; refunds: number; items: number; cancelled: number }>();
  const exclusiveEnd = new Date(`${range.to}T00:00:00Z`);
  exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
  let after: string | null = null;
  let pages = 0;
  do {
    const data: { orders: { nodes: Array<{ createdAt: string; cancelledAt?: string | null; totalQuantity?: number; totalPriceSet?: { shopMoney?: { amount?: string } }; currentTotalPriceSet?: { shopMoney?: { amount?: string } }; totalRefundedSet?: { shopMoney?: { amount?: string } } }>; pageInfo: { hasNextPage: boolean; endCursor?: string | null } } } = await graph(shop, accessToken, query, { first: 100, after, query: `created_at:>=${range.from} created_at:<${exclusiveEnd.toISOString().slice(0, 10)}` });
    for (const order of data.orders.nodes) {
      const date = order.createdAt.slice(0, 10);
      const day = totals.get(date) ?? { orders: 0, gross: 0, revenue: 0, refunds: 0, items: 0, cancelled: 0 };
      day.orders += 1; day.gross += Number(order.totalPriceSet?.shopMoney?.amount ?? 0); day.revenue += Number(order.currentTotalPriceSet?.shopMoney?.amount ?? 0); day.refunds += Number(order.totalRefundedSet?.shopMoney?.amount ?? 0); day.items += Number(order.totalQuantity ?? 0); day.cancelled += order.cancelledAt ? 1 : 0;
      totals.set(date, day);
    }
    after = data.orders.pageInfo.hasNextPage ? data.orders.pageInfo.endCursor ?? null : null;
    pages += 1;
  } while (after && pages < 100);
  return [...totals].flatMap(([date, day]) => [
    { metric: "orders", date, value: day.orders }, { metric: "grossSales", date, value: day.gross },
    { metric: "revenue", date, value: day.revenue }, { metric: "refunds", date, value: day.refunds },
    { metric: "items", date, value: day.items }, { metric: "cancelledOrders", date, value: day.cancelled },
  ]).filter((point) => Number.isFinite(point.value));
}

export const shopifyConnector: OAuth2Connector = {
  id: "shopify", name: "Shopify", category: "Commerce", stage: "convert", authType: "oauth2",
  products: [{ id: "orders", name: "Shopify orders", catalogueId: "shopify", scopes: [{ scope: "read_orders", label: "Read orders and aggregate sales totals" }] }],
  backfillDays: 60, resyncDays: 60,
  missingConfig: () => ["SHOPIFY_CLIENT_ID", "SHOPIFY_CLIENT_SECRET"].filter((name) => !configured(name)),
  authorizeUrl({ state, redirectUri, context }) {
    const shop = normalizeShop(context?.shop ?? "");
    if (!shop) throw new ConnectorError("bad_request", "Enter a valid Shopify store domain.");
    const params = new URLSearchParams({ client_id: configured("SHOPIFY_CLIENT_ID"), scope: SHOPIFY_SCOPES.join(","), redirect_uri: redirectUri, state });
    return `https://${shop}/admin/oauth/authorize?${params}`;
  },
  async exchangeCode({ code, context }) {
    const shop = normalizeShop(context?.shop ?? "");
    if (!shop) throw new ConnectorError("bad_request", "The Shopify callback did not contain a valid store.");
    return tokenRequest(shop, {
      client_id: configured("SHOPIFY_CLIENT_ID"),
      client_secret: configured("SHOPIFY_CLIENT_SECRET"),
      code,
      expiring: "1",
    }, true);
  },
  async refresh(refreshToken, metadata) {
    const shop = normalizeShop(typeof metadata?.shop === "string" ? metadata.shop : "");
    if (!shop) throw new ConnectorError("reauth", "Reconnect Shopify to restore the store identity.");
    return tokenRequest(shop, {
      client_id: configured("SHOPIFY_CLIENT_ID"),
      client_secret: configured("SHOPIFY_CLIENT_SECRET"),
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
  },
  async revoke() { /* Shopify revokes the token when the merchant uninstalls the app. */ },
  latestDate(_product, today) { const date = new Date(today); date.setUTCDate(date.getUTCDate() - 1); return date.toISOString().slice(0, 10); },
  async sync(ctx) {
    const shop = normalizeShop(ctx.account.id);
    if (!shop) throw new ConnectorError("bad_request", "The connected Shopify domain is invalid.");
    await ctx.progress({ step: 2, total: 4, label: "Reading Shopify orders" });
    return syncOrders(shop, ctx.accessToken, ctx.range);
  },
};

export { shopIdentity };
