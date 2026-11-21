import { META_SCOPES } from "./catalogue";
import { ConnectorError, type DateRange, type MetricPoint, type OAuth2Connector, type TokenSet } from "./types";

const META_APP_ID = "META_APP_ID";
const META_APP_SECRET = "META_APP_SECRET";
const REQUEST_TIMEOUT_MS = 30_000;

type MetaError = { error?: { message?: string; code?: number; error_subcode?: number; type?: string } };
type MetaPage = { id: string; name: string; access_token: string; tasks?: string[]; instagram_business_account?: { id: string; username?: string; name?: string } };

function configured(name: string): string {
  return (process.env[name] ?? "").trim();
}

function graphVersion(): string {
  const value = configured("META_GRAPH_VERSION") || "v27.0";
  return /^v\d+\.\d+$/.test(value) ? value : "v27.0";
}

function graphUrl(path: string, params: Record<string, string> = {}): string {
  const url = new URL(`https://graph.facebook.com/${graphVersion()}/${path.replace(/^\//, "")}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}

async function metaFetch<T>(url: string, init: RequestInit = {}, label = "Meta"): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (error) {
    // The request URL may contain an OAuth token. Never attach the URL-bearing
    // fetch error to a value that can reach application logs.
    const safeDetail = error instanceof Error ? error.name : "fetch_failed";
    throw new ConnectorError("network", `${label} could not be reached. Try again shortly.`, safeDetail);
  }
  const payload = await response.json().catch(() => ({})) as T & MetaError;
  if (response.ok && !payload.error) return payload;
  const detail = payload.error?.message ?? `HTTP ${response.status}`;
  if (payload.error?.code === 190 || response.status === 401) throw new ConnectorError("reauth", "Meta authorization expired. Reconnect Meta.", detail);
  if (payload.error?.code === 200 || response.status === 403) throw new ConnectorError("scope_missing", `Meta did not grant the permission needed for ${label}.`, detail);
  if (payload.error?.code === 4 || payload.error?.code === 17 || response.status === 429) throw new ConnectorError("rate_limited", "Meta is temporarily rate-limiting this sync. Try again later.", detail);
  throw new ConnectorError("upstream", `${label} returned an unexpected error.`, detail);
}

async function allPages<T>(url: string, maxRows = 50_000): Promise<T[]> {
  const rows: T[] = [];
  let next: string | undefined = url;
  while (next && rows.length < maxRows) {
    const page = await metaFetch<{ data?: T[]; paging?: { next?: string } }>(next);
    rows.push(...(page.data ?? []));
    next = page.paging?.next;
  }
  return rows;
}

function numeric(value: unknown): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function actionValue(actions: Array<{ action_type?: string; value?: string }> | undefined, names: string[]): number {
  return (actions ?? []).filter((item) => item.action_type && names.includes(item.action_type)).reduce((total, item) => total + numeric(item.value), 0);
}

async function pagesFor(accessToken: string): Promise<MetaPage[]> {
  return allPages<MetaPage>(graphUrl("me/accounts", {
    access_token: accessToken,
    fields: "id,name,access_token,tasks,instagram_business_account{id,username,name}",
    limit: "100",
  }), 500);
}

async function syncAds(accessToken: string, accountId: string, range: DateRange): Promise<MetricPoint[]> {
  const rows = await allPages<{
    date_start?: string; impressions?: string; reach?: string; clicks?: string; spend?: string;
    actions?: Array<{ action_type?: string; value?: string }>;
    action_values?: Array<{ action_type?: string; value?: string }>;
  }>(graphUrl(`${accountId}/insights`, {
    access_token: accessToken,
    level: "account",
    time_increment: "1",
    time_range: JSON.stringify({ since: range.from, until: range.to }),
    fields: "date_start,impressions,reach,clicks,spend,actions,action_values",
    limit: "500",
  }));
  return rows.flatMap((row) => row.date_start ? [
    { metric: "impressions", date: row.date_start, value: numeric(row.impressions) },
    { metric: "reach", date: row.date_start, value: numeric(row.reach) },
    { metric: "clicks", date: row.date_start, value: numeric(row.clicks) },
    { metric: "spend", date: row.date_start, value: numeric(row.spend) },
    { metric: "leads", date: row.date_start, value: actionValue(row.actions, ["lead", "onsite_conversion.lead_grouped"]) },
    { metric: "purchases", date: row.date_start, value: actionValue(row.actions, ["purchase", "omni_purchase"]) },
    { metric: "purchaseValue", date: row.date_start, value: actionValue(row.action_values, ["purchase", "omni_purchase"]) },
  ] : []);
}

function insightPoints(data: Array<{ name?: string; values?: Array<{ value?: unknown; end_time?: string }> }>, aliases: Record<string, string>): MetricPoint[] {
  const points: MetricPoint[] = [];
  for (const metric of data) {
    const name = metric.name ? aliases[metric.name] : undefined;
    if (!name) continue;
    for (const value of metric.values ?? []) {
      const date = value.end_time?.slice(0, 10);
      if (date) points.push({ metric: name, date, value: numeric(value.value) });
    }
  }
  return points;
}

async function pageTokenFor(accessToken: string, pageId: string): Promise<MetaPage> {
  const page = (await pagesFor(accessToken)).find((item) => item.id === pageId);
  if (!page) throw new ConnectorError("no_access", "This Facebook Page is no longer available to the connected account.");
  return page;
}

async function syncFacebookPage(accessToken: string, pageId: string, range: DateRange): Promise<MetricPoint[]> {
  const page = await pageTokenFor(accessToken, pageId);
  const result = await metaFetch<{ data?: Array<{ name?: string; values?: Array<{ value?: unknown; end_time?: string }> }> }>(graphUrl(`${pageId}/insights`, {
    access_token: page.access_token,
    metric: "page_impressions,page_post_engagements,page_follows,page_daily_follows_unique,page_daily_unfollows_unique",
    period: "day",
    since: range.from,
    until: range.to,
  }), {}, "Facebook Page Insights");
  return insightPoints(result.data ?? [], {
    page_impressions: "impressions", page_post_engagements: "engagements", page_follows: "followers",
    page_daily_follows_unique: "follows", page_daily_unfollows_unique: "unfollows",
  });
}

async function syncInstagram(accessToken: string, igId: string, pageId: string, range: DateRange): Promise<MetricPoint[]> {
  const page = await pageTokenFor(accessToken, pageId);
  if (page.instagram_business_account?.id !== igId) throw new ConnectorError("no_access", "This Instagram account is no longer linked to the selected Facebook Page.");
  const result = await metaFetch<{ data?: Array<{ name?: string; values?: Array<{ value?: unknown; end_time?: string }> }> }>(graphUrl(`${igId}/insights`, {
    access_token: page.access_token,
    metric: "reach,profile_views,total_interactions",
    period: "day",
    since: range.from,
    until: range.to,
  }), {}, "Instagram Insights");
  return insightPoints(result.data ?? [], { reach: "reach", profile_views: "profileViews", total_interactions: "interactions" });
}

async function exchangeToken(params: Record<string, string>): Promise<{ access_token?: string; expires_in?: number }> {
  return metaFetch(graphUrl("oauth/access_token", params), {}, "Meta sign-in");
}

export const metaConnector: OAuth2Connector = {
  id: "meta",
  name: "Meta",
  category: "Ads and social",
  stage: "found",
  authType: "oauth2",
  products: [
    { id: "ads", name: "Meta Ads", catalogueId: "meta-ads", scopes: [{ scope: META_SCOPES.ads, label: "Read advertising performance" }] },
    { id: "facebook-pages", name: "Facebook Page insights", catalogueId: "facebook-page-insights", scopes: [
      { scope: META_SCOPES.pages, label: "List Pages you manage" }, { scope: META_SCOPES.pageEngagement, label: "Read Page engagement" }, { scope: META_SCOPES.insights, label: "Read Page insights" },
    ] },
    { id: "instagram", name: "Instagram insights", catalogueId: "instagram-insights", scopes: [
      { scope: META_SCOPES.pages, label: "List linked Pages" }, { scope: META_SCOPES.pageEngagement, label: "Read linked Page data" },
      { scope: META_SCOPES.instagram, label: "Identify professional Instagram accounts" }, { scope: META_SCOPES.instagramInsights, label: "Read Instagram insights" },
    ] },
  ],
  backfillDays: 90,
  resyncDays: 90,
  missingConfig() { return [META_APP_ID, META_APP_SECRET].filter((name) => !configured(name)); },
  authorizeUrl({ state, redirectUri, products }) {
    const scopes = [...new Set(products.flatMap((product) => this.products.find((item) => item.id === product)?.scopes.map((scope) => scope.scope) ?? []))];
    const params = new URLSearchParams({ client_id: configured(META_APP_ID), redirect_uri: redirectUri, state, response_type: "code", scope: scopes.join(",") });
    return `https://www.facebook.com/${graphVersion()}/dialog/oauth?${params}`;
  },
  async exchangeCode({ code, redirectUri }): Promise<TokenSet> {
    const short = await exchangeToken({ client_id: configured(META_APP_ID), client_secret: configured(META_APP_SECRET), redirect_uri: redirectUri, code });
    if (!short.access_token) throw new ConnectorError("auth", "Meta sign-in could not be completed.");
    const long = await exchangeToken({ grant_type: "fb_exchange_token", client_id: configured(META_APP_ID), client_secret: configured(META_APP_SECRET), fb_exchange_token: short.access_token });
    if (!long.access_token) throw new ConnectorError("auth", "Meta sign-in could not be completed.");
    const permissions = await metaFetch<{ data?: Array<{ permission?: string; status?: string }> }>(graphUrl("me/permissions", { access_token: long.access_token }), {}, "Meta permissions");
    return { accessToken: long.access_token, refreshToken: null, expiresAt: long.expires_in ? new Date(Date.now() + long.expires_in * 1_000) : null, scopes: (permissions.data ?? []).filter((item) => item.status === "granted" && item.permission).map((item) => item.permission!) };
  },
  refresh() { throw new ConnectorError("reauth", "Meta authorization expired. Reconnect Meta."); },
  async revoke(token) { await metaFetch(graphUrl("me/permissions", { access_token: token }), { method: "DELETE" }, "Meta authorization"); },
  latestDate(_product, today) { const date = new Date(today); date.setUTCDate(date.getUTCDate() - 1); return date.toISOString().slice(0, 10); },
  async sync(ctx) {
    await ctx.progress({ step: 2, total: 4, label: `Reading ${this.products.find((product) => product.id === ctx.product)?.name ?? "Meta"}` });
    if (ctx.product === "ads") return syncAds(ctx.accessToken, ctx.account.id, ctx.range);
    if (ctx.product === "facebook-pages") return syncFacebookPage(ctx.accessToken, ctx.account.id, ctx.range);
    if (ctx.product === "instagram") {
      const pageId = typeof ctx.account.config?.pageId === "string" ? ctx.account.config.pageId : "";
      if (!pageId) throw new ConnectorError("bad_request", "Reconnect Instagram and choose its linked Facebook Page.");
      return syncInstagram(ctx.accessToken, ctx.account.id, pageId, ctx.range);
    }
    throw new ConnectorError("bad_request", "This Meta product is not supported.");
  },
};

export async function listMetaAccounts(accessToken: string) {
  const [ads, pages] = await Promise.allSettled([
    allPages<{ id: string; name?: string; currency?: string; account_status?: number }>(graphUrl("me/adaccounts", { access_token: accessToken, fields: "id,name,currency,account_status", limit: "100" }), 500),
    pagesFor(accessToken),
  ]);
  const pageRows = pages.status === "fulfilled" ? pages.value : [];
  return {
    ads: ads.status === "fulfilled" ? { accounts: ads.value.map((item) => ({ id: item.id, label: item.name ?? item.id, detail: `${item.currency ?? "Currency unknown"} · status ${item.account_status ?? "unknown"}` })) } : { accounts: [], error: ads.reason instanceof Error ? ads.reason.message : "Ad accounts could not be listed." },
    pages: pages.status === "fulfilled" ? { pages: pageRows.map((item) => ({ id: item.id, label: item.name, detail: (item.tasks ?? []).join(", ") || "Managed Page" })) } : { pages: [], error: pages.reason instanceof Error ? pages.reason.message : "Pages could not be listed." },
    instagram: pages.status === "fulfilled" ? { accounts: pageRows.filter((item) => item.instagram_business_account).map((item) => ({ id: item.instagram_business_account!.id, label: item.instagram_business_account!.username ? `@${item.instagram_business_account!.username}` : item.instagram_business_account!.name ?? item.name, detail: `Linked to ${item.name}`, pageId: item.id })) } : { accounts: [], error: "Linked Instagram accounts could not be listed." },
  };
}
