import { GOOGLE_SCOPES } from "./catalogue";
import {
  ConnectorError,
  type DateRange,
  type MetricPoint,
  type OAuth2Connector,
  type TokenSet,
} from "./types";

const GOOGLE_CLIENT_ID = "GOOGLE_CLIENT_ID";
const GOOGLE_CLIENT_SECRET = "GOOGLE_CLIENT_SECRET";
const GOOGLE_ADS_DEVELOPER_TOKEN = "GOOGLE_ADS_DEVELOPER_TOKEN";
const REQUEST_TIMEOUT_MS = 30_000;

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

type SearchRow = {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  position?: number;
};

type GaReport = {
  rows?: Array<{
    dimensionValues?: Array<{ value?: string }>;
    metricValues?: Array<{ value?: string }>;
  }>;
};

type GoogleAdsSearchResponse = {
  results?: Array<{
    segments?: { date?: string };
    metrics?: { impressions?: string; clicks?: string; costMicros?: string; conversions?: number; conversionsValue?: number };
    searchTermView?: { searchTerm?: string };
  }>;
  nextPageToken?: string;
};

type SheetConfig = {
  tab: string;
  dateColumn: number;
  revenueColumn?: number;
  expenseColumn?: number;
  customersColumn?: number;
};

function configured(name: string): string {
  return (process.env[name] ?? "").trim();
}

async function googleFetch<T>(url: string, init: RequestInit, label: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), cache: "no-store" });
  } catch (error) {
    throw new ConnectorError("network", `Google ${label} could not be reached. Try again shortly.`, String(error));
  }

  if (response.ok) return (await response.json()) as T;

  const detail = (await response.text()).slice(0, 1_500);
  const lower = detail.toLowerCase();
  if (response.status === 401) throw new ConnectorError("auth", "Google rejected the saved authorization. Reconnect Google.", detail);
  if (response.status === 403 && /insufficient|scope/.test(lower)) {
    throw new ConnectorError("scope_missing", "Google did not grant the read-only permission this source needs. Reconnect and approve it.", detail);
  }
  if (response.status === 403 && /accessnotconfigured|api.*disabled|has not been used/.test(lower)) {
    throw new ConnectorError("api_disabled", `The Google ${label} API is not enabled in this Google Cloud project.`, detail);
  }
  if (response.status === 403) throw new ConnectorError("no_access", `This Google account cannot read the selected ${label}.`, detail);
  if (response.status === 429) throw new ConnectorError("rate_limited", "Google is temporarily rate-limiting this sync. Try again later.", detail);
  if (response.status === 400) throw new ConnectorError("bad_request", `Google could not read the selected ${label}.`, detail);
  throw new ConnectorError("upstream", `Google ${label} returned an unexpected error.`, detail);
}

async function tokenRequest(params: URLSearchParams): Promise<TokenSet> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });
  const payload = (await response.json()) as GoogleTokenResponse;
  if (!response.ok || !payload.access_token) {
    const detail = `${payload.error ?? response.status}: ${payload.error_description ?? "token request failed"}`;
    const code = payload.error === "invalid_grant" ? "reauth" : "auth";
    throw new ConnectorError(code, code === "reauth" ? "Google authorization expired. Reconnect Google." : "Google sign-in could not be completed.", detail);
  }
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? null,
    expiresAt: payload.expires_in ? new Date(Date.now() + payload.expires_in * 1_000) : null,
    scopes: (payload.scope ?? "").split(/\s+/).filter(Boolean),
  };
}

function n(value: string | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function daysBefore(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function googleAdsVersion(): string {
  const value = configured("GOOGLE_ADS_API_VERSION") || "v26";
  return /^v\d+$/.test(value) ? value : "v26";
}

function googleAdsHeaders(accessToken: string): HeadersInit {
  const developerToken = configured(GOOGLE_ADS_DEVELOPER_TOKEN);
  if (!developerToken) throw new ConnectorError("not_configured", `${GOOGLE_ADS_DEVELOPER_TOKEN} is not configured.`);
  return { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", "developer-token": developerToken };
}

async function googleAdsSearch(accessToken: string, customerId: string, query: string): Promise<GoogleAdsSearchResponse["results"]> {
  const cleanId = customerId.replace(/\D/g, "");
  if (!cleanId) throw new ConnectorError("bad_request", "The selected Google Ads account is invalid.");
  let pageToken = "";
  const rows: NonNullable<GoogleAdsSearchResponse["results"]> = [];
  do {
    const result = await googleFetch<GoogleAdsSearchResponse>(
      `https://googleads.googleapis.com/${googleAdsVersion()}/customers/${cleanId}/googleAds:search`,
      { method: "POST", headers: googleAdsHeaders(accessToken), body: JSON.stringify({ query, pageSize: 10_000, ...(pageToken ? { pageToken } : {}) }) },
      "Ads",
    );
    rows.push(...(result.results ?? []));
    pageToken = result.nextPageToken ?? "";
  } while (pageToken && rows.length < 50_000);
  return rows;
}

async function syncGoogleAds(accessToken: string, customerId: string, range: DateRange): Promise<MetricPoint[]> {
  const currentFrom = daysBefore(range.to, 27);
  const [daily, terms] = await Promise.all([
    googleAdsSearch(accessToken, customerId, `SELECT segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value FROM customer WHERE segments.date BETWEEN '${range.from}' AND '${range.to}' ORDER BY segments.date`),
    googleAdsSearch(accessToken, customerId, `SELECT search_term_view.search_term, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions FROM search_term_view WHERE segments.date BETWEEN '${currentFrom}' AND '${range.to}' ORDER BY metrics.clicks DESC LIMIT 25`),
  ]);
  const points: MetricPoint[] = [];
  for (const row of daily ?? []) {
    const date = row.segments?.date;
    if (!date) continue;
    points.push(
      { metric: "impressions", date, value: n(row.metrics?.impressions) },
      { metric: "clicks", date, value: n(row.metrics?.clicks) },
      { metric: "spend", date, value: n(row.metrics?.costMicros) / 1_000_000 },
      { metric: "conversions", date, value: Number(row.metrics?.conversions ?? 0) },
      { metric: "conversionValue", date, value: Number(row.metrics?.conversionsValue ?? 0) },
    );
  }
  for (const row of terms ?? []) {
    const term = row.searchTermView?.searchTerm?.slice(0, 500);
    if (!term) continue;
    points.push(
      { metric: "clicks", dimension: "search-term", dimensionValue: term, date: range.to, value: n(row.metrics?.clicks) },
      { metric: "impressions", dimension: "search-term", dimensionValue: term, date: range.to, value: n(row.metrics?.impressions) },
      { metric: "spend", dimension: "search-term", dimensionValue: term, date: range.to, value: n(row.metrics?.costMicros) / 1_000_000 },
      { metric: "conversions", dimension: "search-term", dimensionValue: term, date: range.to, value: Number(row.metrics?.conversions ?? 0) },
    );
  }
  return points;
}

function sheetDate(value: string): string | null {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const local = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/.exec(trimmed);
  if (local) {
    const [, day, month, year] = local;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function sheetNumber(value: string | undefined): number {
  const parsed = Number((value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function validSheetConfig(value: Record<string, unknown> | null | undefined): SheetConfig | null {
  if (!value || typeof value.tab !== "string" || typeof value.dateColumn !== "number") return null;
  const optional = (key: keyof Pick<SheetConfig, "revenueColumn" | "expenseColumn" | "customersColumn">) =>
    typeof value[key] === "number" ? value[key] as number : undefined;
  return { tab: value.tab.slice(0, 200), dateColumn: value.dateColumn, revenueColumn: optional("revenueColumn"), expenseColumn: optional("expenseColumn"), customersColumn: optional("customersColumn") };
}

async function syncSheet(accessToken: string, spreadsheetId: string, range: DateRange, rawConfig?: Record<string, unknown> | null): Promise<MetricPoint[]> {
  const config = validSheetConfig(rawConfig);
  if (!config) throw new ConnectorError("bad_request", "This spreadsheet needs its columns mapped again.");
  const tab = `'${config.tab.replace(/'/g, "''")}'!A1:ZZ50001`;
  const response = await googleFetch<{ values?: string[][] }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(tab)}?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    "Sheets",
  );
  const totals = new Map<string, { revenue: number; expenses: number; customers: number }>();
  for (const row of (response.values ?? []).slice(1, 50_001)) {
    const date = sheetDate(String(row[config.dateColumn] ?? ""));
    if (!date || date < range.from || date > range.to) continue;
    const current = totals.get(date) ?? { revenue: 0, expenses: 0, customers: 0 };
    if (config.revenueColumn !== undefined) current.revenue += sheetNumber(String(row[config.revenueColumn] ?? ""));
    if (config.expenseColumn !== undefined) current.expenses += sheetNumber(String(row[config.expenseColumn] ?? ""));
    if (config.customersColumn !== undefined) current.customers += sheetNumber(String(row[config.customersColumn] ?? ""));
    totals.set(date, current);
  }
  return [...totals].flatMap(([date, values]) => [
    ...(config.revenueColumn !== undefined ? [{ metric: "revenue", date, value: values.revenue }] : []),
    ...(config.expenseColumn !== undefined ? [{ metric: "expenses", date, value: values.expenses }] : []),
    ...(config.customersColumn !== undefined ? [{ metric: "customers", date, value: values.customers }] : []),
  ]);
}

async function searchConsoleQuery(accessToken: string, site: string, range: DateRange, dimensions: string[], rowLimit: number) {
  return googleFetch<{ rows?: SearchRow[] }>(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ startDate: range.from, endDate: range.to, dimensions, rowLimit, dataState: "final" }),
    },
    "Search Console",
  );
}

async function syncSearchConsole(accessToken: string, site: string, range: DateRange): Promise<MetricPoint[]> {
  const [daily, queries, pages] = await Promise.all([
    searchConsoleQuery(accessToken, site, range, ["date"], 25_000),
    searchConsoleQuery(accessToken, site, { from: daysBefore(range.to, 27), to: range.to }, ["query"], 25),
    searchConsoleQuery(accessToken, site, { from: daysBefore(range.to, 27), to: range.to }, ["page"], 25),
  ]);

  const points: MetricPoint[] = [];
  for (const row of daily.rows ?? []) {
    const date = row.keys?.[0];
    if (!date) continue;
    points.push(
      { metric: "clicks", date, value: row.clicks ?? 0 },
      { metric: "impressions", date, value: row.impressions ?? 0 },
      { metric: "position", date, value: row.position ?? 0 },
    );
  }
  for (const [dimension, rows] of [
    ["query", queries.rows ?? []],
    ["page", pages.rows ?? []],
  ] as const) {
    for (const row of rows) {
      const key = row.keys?.[0]?.slice(0, 500);
      if (!key) continue;
      points.push(
        { metric: "clicks", dimension, dimensionValue: key, date: range.to, value: row.clicks ?? 0 },
        { metric: "impressions", dimension, dimensionValue: key, date: range.to, value: row.impressions ?? 0 },
      );
    }
  }
  return points;
}

async function gaReport(accessToken: string, property: string, body: Record<string, unknown>, label: string): Promise<GaReport> {
  if (!/^properties\/\d+$/.test(property)) {
    throw new ConnectorError("bad_request", "The selected Analytics property is invalid.");
  }
  return googleFetch<GaReport>(
    `https://analyticsdata.googleapis.com/v1beta/${property}:runReport`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    label,
  );
}

async function syncAnalytics(accessToken: string, property: string, range: DateRange): Promise<MetricPoint[]> {
  const current = { from: daysBefore(range.to, 27), to: range.to };
  const previous = { from: daysBefore(current.from, 28), to: daysBefore(current.from, 1) };
  const metrics = [{ name: "sessions" }, { name: "totalUsers" }, { name: "newUsers" }, { name: "keyEvents" }];
  const [daily, currentTotal, previousTotal, currentChannels, previousChannels] = await Promise.all([
    gaReport(accessToken, property, { dateRanges: [{ startDate: range.from, endDate: range.to }], dimensions: [{ name: "date" }], metrics, limit: "100000" }, "Analytics Data"),
    gaReport(accessToken, property, { dateRanges: [{ startDate: current.from, endDate: current.to }], metrics: [{ name: "totalUsers" }] }, "Analytics Data"),
    gaReport(accessToken, property, { dateRanges: [{ startDate: previous.from, endDate: previous.to }], metrics: [{ name: "totalUsers" }] }, "Analytics Data"),
    gaReport(accessToken, property, { dateRanges: [{ startDate: current.from, endDate: current.to }], dimensions: [{ name: "sessionDefaultChannelGroup" }], metrics: [{ name: "sessions" }, { name: "keyEvents" }], limit: "100" }, "Analytics Data"),
    gaReport(accessToken, property, { dateRanges: [{ startDate: previous.from, endDate: previous.to }], dimensions: [{ name: "sessionDefaultChannelGroup" }], metrics: [{ name: "sessions" }, { name: "keyEvents" }], limit: "100" }, "Analytics Data"),
  ]);

  const points: MetricPoint[] = [];
  for (const row of daily.rows ?? []) {
    const compact = row.dimensionValues?.[0]?.value;
    if (!compact || compact.length !== 8) continue;
    const date = `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
    points.push(
      { metric: "sessions", date, value: n(row.metricValues?.[0]?.value) },
      { metric: "users", date, value: n(row.metricValues?.[1]?.value) },
      { metric: "newUsers", date, value: n(row.metricValues?.[2]?.value) },
      { metric: "keyEvents", date, value: n(row.metricValues?.[3]?.value) },
    );
  }
  points.push(
    { metric: "users28d", dimension: "window", dimensionValue: `${current.from}:${current.to}`, date: current.to, value: n(currentTotal.rows?.[0]?.metricValues?.[0]?.value) },
    { metric: "users28d", dimension: "window", dimensionValue: `${previous.from}:${previous.to}`, date: previous.to, value: n(previousTotal.rows?.[0]?.metricValues?.[0]?.value) },
  );
  for (const [window, report, date] of [
    ["current", currentChannels, current.to],
    ["previous", previousChannels, previous.to],
  ] as const) {
    for (const row of report.rows ?? []) {
      const channel = row.dimensionValues?.[0]?.value?.slice(0, 200);
      if (!channel) continue;
      points.push(
        { metric: "sessions", dimension: `channel-${window}`, dimensionValue: channel, date, value: n(row.metricValues?.[0]?.value) },
        { metric: "keyEvents", dimension: `channel-${window}`, dimensionValue: channel, date, value: n(row.metricValues?.[1]?.value) },
      );
    }
  }
  return points;
}

export const googleConnector: OAuth2Connector = {
  id: "google",
  name: "Google",
  category: "Website and search",
  stage: "found",
  authType: "oauth2",
  products: [
    { id: "search-console", name: "Search Console", catalogueId: "google-search-console", scopes: [{ scope: GOOGLE_SCOPES.searchConsole, label: "View Search Console data" }] },
    { id: "analytics", name: "Google Analytics", catalogueId: "google-analytics", scopes: [{ scope: GOOGLE_SCOPES.analytics, label: "View Google Analytics data" }] },
    { id: "sheets", name: "Google Sheets", catalogueId: "google-sheets", scopes: [{ scope: GOOGLE_SCOPES.sheets, label: "View Google Sheets spreadsheets" }] },
    { id: "ads", name: "Google Ads", catalogueId: "google-ads", scopes: [{ scope: GOOGLE_SCOPES.ads, label: "View Google Ads accounts and reports" }] },
  ],
  backfillDays: 90,
  resyncDays: 90,
  missingConfig() {
    return [GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET].filter((name) => !configured(name));
  },
  authorizeUrl({ state, redirectUri, products }) {
    const scopes = [...new Set(products.flatMap((product) => this.products.find((p) => p.id === product)?.scopes.map((s) => s.scope) ?? []))];
    const params = new URLSearchParams({
      client_id: configured(GOOGLE_CLIENT_ID),
      redirect_uri: redirectUri,
      response_type: "code",
      access_type: "offline",
      include_granted_scopes: "true",
      prompt: "consent",
      state,
      scope: scopes.join(" "),
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  },
  exchangeCode({ code, redirectUri }) {
    return tokenRequest(new URLSearchParams({
      code,
      client_id: configured(GOOGLE_CLIENT_ID),
      client_secret: configured(GOOGLE_CLIENT_SECRET),
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }));
  },
  refresh(refreshToken) {
    return tokenRequest(new URLSearchParams({
      refresh_token: refreshToken,
      client_id: configured(GOOGLE_CLIENT_ID),
      client_secret: configured(GOOGLE_CLIENT_SECRET),
      grant_type: "refresh_token",
    }));
  },
  async revoke(token) {
    const response = await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!response.ok && response.status !== 400) throw new ConnectorError("upstream", "Google could not revoke the authorization. Try again.");
  },
  latestDate(product, today) {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - (product === "search-console" ? 3 : 1));
    return date.toISOString().slice(0, 10);
  },
  async sync(ctx) {
    const productName = this.products.find((product) => product.id === ctx.product)?.name ?? "Google data";
    await ctx.progress({ step: 2, total: 4, label: `Reading ${productName}` });
    if (ctx.product === "search-console") return syncSearchConsole(ctx.accessToken, ctx.account.id, ctx.range);
    if (ctx.product === "analytics") return syncAnalytics(ctx.accessToken, ctx.account.id, ctx.range);
    if (ctx.product === "ads") return syncGoogleAds(ctx.accessToken, ctx.account.id, ctx.range);
    if (ctx.product === "sheets") return syncSheet(ctx.accessToken, ctx.account.id, ctx.range, ctx.account.config);
    throw new ConnectorError("bad_request", "This Google product is not supported.");
  },
};

export async function listGoogleAdsAccounts(accessToken: string) {
  if (!configured(GOOGLE_ADS_DEVELOPER_TOKEN)) return { accounts: [], error: `${GOOGLE_ADS_DEVELOPER_TOKEN} is not configured.` };
  const response = await googleFetch<{ resourceNames?: string[] }>(
    `https://googleads.googleapis.com/${googleAdsVersion()}/customers:listAccessibleCustomers`,
    { headers: googleAdsHeaders(accessToken) },
    "Ads",
  );
  return { accounts: (response.resourceNames ?? []).slice(0, 100).map((name) => {
    const id = name.replace(/^customers\//, "");
    return { id, label: `Google Ads ${id}`, detail: `Customer ID ${id}` };
  }) };
}

export function googleSheetId(input: string): string | null {
  const trimmed = input.trim();
  const fromUrl = /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/.exec(trimmed)?.[1];
  const id = fromUrl ?? (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed) ? trimmed : "");
  return id || null;
}

export async function previewGoogleSheet(accessToken: string, spreadsheetId: string) {
  const metadata = await googleFetch<{ spreadsheetId?: string; properties?: { title?: string }; sheets?: Array<{ properties?: { title?: string } }> }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=spreadsheetId,properties.title,sheets.properties.title`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    "Sheets",
  );
  const titles = (metadata.sheets ?? []).map((sheet) => sheet.properties?.title).filter((title): title is string => Boolean(title)).slice(0, 30);
  const tabs = await Promise.all(titles.map(async (title) => {
    const range = `'${title.replace(/'/g, "''")}'!1:6`;
    const values = await googleFetch<{ values?: string[][] }>(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
      "Sheets",
    );
    const rows = (values.values ?? []).map((row) => row.map(String));
    return { title, headers: rows[0] ?? [], sample: rows.slice(1, 6) };
  }));
  return { id: metadata.spreadsheetId ?? spreadsheetId, name: metadata.properties?.title ?? "Google Sheet", tabs };
}

export async function listGoogleAccounts(accessToken: string) {
  const [searchConsole, analytics, ads] = await Promise.allSettled([
    googleFetch<{ siteEntry?: Array<{ siteUrl?: string; permissionLevel?: string }> }>(
      "https://www.googleapis.com/webmasters/v3/sites",
      { headers: { Authorization: `Bearer ${accessToken}` } },
      "Search Console",
    ),
    googleFetch<{
      accountSummaries?: Array<{
        displayName?: string;
        propertySummaries?: Array<{ property?: string; displayName?: string; propertyType?: string }>;
      }>;
    }>(
      "https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200",
      { headers: { Authorization: `Bearer ${accessToken}` } },
      "Analytics Admin",
    ),
    listGoogleAdsAccounts(accessToken),
  ]);

  return {
    searchConsole:
      searchConsole.status === "fulfilled"
        ? { sites: (searchConsole.value.siteEntry ?? []).filter((s) => s.siteUrl).map((s) => ({ id: s.siteUrl!, label: s.siteUrl!, detail: s.permissionLevel ?? "verified" })) }
        : { sites: [], error: searchConsole.reason instanceof ConnectorError ? searchConsole.reason.message : "Search Console could not be listed." },
    analytics:
      analytics.status === "fulfilled"
        ? {
            properties: (analytics.value.accountSummaries ?? []).flatMap((account) =>
              (account.propertySummaries ?? []).filter((p) => p.property).map((p) => ({ id: p.property!, label: p.displayName ?? p.property!, detail: account.displayName ?? p.propertyType ?? "GA4" })),
            ),
          }
        : { properties: [], error: analytics.reason instanceof ConnectorError ? analytics.reason.message : "Analytics properties could not be listed." },
    ads:
      ads.status === "fulfilled"
        ? ads.value
        : { accounts: [], error: ads.reason instanceof ConnectorError ? ads.reason.message : "Google Ads accounts could not be listed." },
  };
}
