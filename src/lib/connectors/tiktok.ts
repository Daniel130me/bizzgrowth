import { ConnectorError, type DateRange, type MetricPoint, type OAuth2Connector, type TokenSet } from "./types";

const REQUEST_TIMEOUT_MS = 30_000;
const TIKTOK_PROFILE_SCOPES = ["user.info.basic", "user.info.profile", "user.info.stats", "video.list"];

function configured(name: string): string {
  return (process.env[name] ?? "").trim();
}

async function jsonFetch<T>(url: string, init: RequestInit, label: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (error) {
    throw new ConnectorError("network", `${label} could not be reached. Try again shortly.`, error instanceof Error ? error.name : "fetch_failed");
  }
  const payload = await response.json().catch(() => ({})) as T & { error?: { code?: string; message?: string }; code?: number; message?: string };
  const errorCode = payload.error?.code;
  if (response.ok && (!errorCode || errorCode === "ok") && (payload.code === undefined || payload.code === 0)) return payload;
  const detail = payload.error?.message ?? payload.message ?? `HTTP ${response.status}`;
  if (response.status === 401 || /token|auth/i.test(errorCode ?? "")) throw new ConnectorError("reauth", `${label} authorization expired. Reconnect it.`, detail);
  if (response.status === 403 || /scope|permission/i.test(errorCode ?? "")) throw new ConnectorError("scope_missing", `${label} did not grant the required read permission.`, detail);
  if (response.status === 429) throw new ConnectorError("rate_limited", `${label} is temporarily rate-limiting requests. Try again later.`, detail);
  throw new ConnectorError("upstream", `${label} returned an unexpected error.`, detail);
}

function formToken(params: Record<string, string>): Promise<{ access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; open_id?: string; error?: string; error_description?: string }> {
  return jsonFetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  }, "TikTok");
}

async function profileSync(accessToken: string, range: DateRange): Promise<MetricPoint[]> {
  const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };
  const fields = "open_id,display_name,username,follower_count,following_count,likes_count,video_count";
  const profile = await jsonFetch<{ data?: { user?: Record<string, unknown> } }>(`https://open.tiktokapis.com/v2/user/info/?fields=${fields}`, { headers }, "TikTok profile");
  const user = profile.data?.user ?? {};
  const points: MetricPoint[] = [
    { metric: "followers", date: range.to, value: Number(user.follower_count ?? 0) },
    { metric: "following", date: range.to, value: Number(user.following_count ?? 0) },
    { metric: "profileLikes", date: range.to, value: Number(user.likes_count ?? 0) },
    { metric: "videos", date: range.to, value: Number(user.video_count ?? 0) },
  ];
  let cursor = 0;
  let hasMore = true;
  let pages = 0;
  while (hasMore && pages < 10) {
    const result = await jsonFetch<{ data?: { videos?: Array<{ id?: string; create_time?: number; view_count?: number; like_count?: number; comment_count?: number; share_count?: number }>; cursor?: number; has_more?: boolean } }>(
      "https://open.tiktokapis.com/v2/video/list/?fields=id,create_time,view_count,like_count,comment_count,share_count",
      { method: "POST", headers, body: JSON.stringify({ max_count: 20, cursor }) },
      "TikTok videos",
    );
    for (const video of result.data?.videos ?? []) {
      const date = video.create_time ? new Date(video.create_time * 1_000).toISOString().slice(0, 10) : "";
      if (!date || date < range.from || date > range.to) continue;
      points.push(
        { metric: "videoViews", date, value: Number(video.view_count ?? 0) },
        { metric: "videoLikes", date, value: Number(video.like_count ?? 0) },
        { metric: "videoComments", date, value: Number(video.comment_count ?? 0) },
        { metric: "videoShares", date, value: Number(video.share_count ?? 0) },
      );
    }
    cursor = result.data?.cursor ?? 0;
    hasMore = result.data?.has_more === true;
    pages += 1;
  }
  return points.filter((point) => Number.isFinite(point.value));
}

export async function tiktokProfileIdentity(accessToken: string) {
  const fields = "open_id,display_name,username";
  const profile = await jsonFetch<{ data?: { user?: { open_id?: string; display_name?: string; username?: string } } }>(`https://open.tiktokapis.com/v2/user/info/?fields=${fields}`, { headers: { Authorization: `Bearer ${accessToken}` } }, "TikTok profile");
  const user = profile.data?.user;
  if (!user?.open_id) throw new ConnectorError("no_access", "TikTok did not return an account for this authorization.");
  return { id: user.open_id, label: user.username ? `@${user.username}` : user.display_name ?? "TikTok account" };
}

export const tiktokProfileConnector: OAuth2Connector = {
  id: "tiktok-business",
  name: "TikTok business account",
  category: "Social",
  stage: "found",
  authType: "oauth2",
  products: [{ id: "profile", name: "TikTok business account", catalogueId: "tiktok-business", scopes: TIKTOK_PROFILE_SCOPES.map((scope) => ({ scope, label: `Read ${scope}` })) }],
  backfillDays: 90,
  resyncDays: 90,
  missingConfig: () => ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"].filter((name) => !configured(name)),
  authorizeUrl({ state, redirectUri }) {
    const params = new URLSearchParams({ client_key: configured("TIKTOK_CLIENT_KEY"), response_type: "code", scope: TIKTOK_PROFILE_SCOPES.join(","), redirect_uri: redirectUri, state });
    return `https://www.tiktok.com/v2/auth/authorize/?${params}`;
  },
  async exchangeCode({ code, redirectUri }) {
    const token = await formToken({ client_key: configured("TIKTOK_CLIENT_KEY"), client_secret: configured("TIKTOK_CLIENT_SECRET"), code, grant_type: "authorization_code", redirect_uri: redirectUri });
    if (!token.access_token) throw new ConnectorError("auth", "TikTok sign-in could not be completed.", token.error_description ?? token.error);
    return { accessToken: token.access_token, refreshToken: token.refresh_token ?? null, expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1_000) : null, scopes: token.scope?.split(",").filter(Boolean) ?? [], metadata: { openId: token.open_id ?? "" } };
  },
  async refresh(refreshToken, metadata) {
    const token = await formToken({ client_key: configured("TIKTOK_CLIENT_KEY"), client_secret: configured("TIKTOK_CLIENT_SECRET"), refresh_token: refreshToken, grant_type: "refresh_token" });
    if (!token.access_token) throw new ConnectorError("reauth", "TikTok authorization expired. Reconnect TikTok.", token.error_description ?? token.error);
    return { accessToken: token.access_token, refreshToken: token.refresh_token ?? refreshToken, expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1_000) : null, scopes: token.scope?.split(",").filter(Boolean) ?? [], metadata };
  },
  async revoke(token) {
    await jsonFetch("https://open.tiktokapis.com/v2/oauth/revoke/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_key: configured("TIKTOK_CLIENT_KEY"), client_secret: configured("TIKTOK_CLIENT_SECRET"), token }) }, "TikTok");
  },
  latestDate: (_product, today) => today.toISOString().slice(0, 10),
  async sync(ctx) {
    await ctx.progress({ step: 2, total: 4, label: "Reading TikTok profile and videos" });
    return profileSync(ctx.accessToken, ctx.range);
  },
};

type AdsTokenResponse = { code?: number; message?: string; data?: { access_token?: string; refresh_token?: string; expires_in?: number; advertiser_ids?: string[]; scope?: Array<string | number> } };

async function adsToken(body: Record<string, unknown>): Promise<AdsTokenResponse> {
  return jsonFetch("https://business-api.tiktok.com/open_api/v2.0/oauth2/access_token/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, "TikTok Ads");
}

async function adsSync(accessToken: string, advertiserId: string, range: DateRange): Promise<MetricPoint[]> {
  const payload = await jsonFetch<{ data?: { list?: Array<{ dimensions?: { stat_time_day?: string }; metrics?: Record<string, string> }>; page_info?: { total_page?: number } } }>(
    "https://business-api.tiktok.com/open_api/v2.0/report/integrated/get/",
    {
      method: "POST",
      headers: { "Access-Token": accessToken, "Content-Type": "application/json" },
      body: JSON.stringify({ report_type: "AD", data_level: "AUCTION_ADVERTISER", advertiser_ids: [advertiserId], dimensions: ["stat_time_day"], metrics: ["spend", "impressions", "reach", "clicks", "conversion"], start_date: range.from, end_date: range.to, page: 1, page_size: 1_000 }),
    },
    "TikTok Ads reporting",
  );
  return (payload.data?.list ?? []).flatMap((row) => {
    const date = row.dimensions?.stat_time_day?.slice(0, 10);
    if (!date) return [];
    const metric = (name: string) => Number(row.metrics?.[name] ?? 0);
    return [
      { metric: "spend", date, value: metric("spend") }, { metric: "impressions", date, value: metric("impressions") },
      { metric: "reach", date, value: metric("reach") }, { metric: "clicks", date, value: metric("clicks") },
      { metric: "conversions", date, value: metric("conversion") },
    ];
  }).filter((point) => Number.isFinite(point.value));
}

export const tiktokAdsConnector: OAuth2Connector = {
  id: "tiktok-ads",
  name: "TikTok Ads",
  category: "Advertising",
  stage: "found",
  authType: "oauth2",
  products: [{ id: "ads", name: "TikTok Ads", catalogueId: "tiktok-ads", scopes: [{ scope: "Reporting > Consolidated Report", label: "Read advertising performance reports" }] }],
  backfillDays: 90,
  resyncDays: 90,
  missingConfig: () => ["TIKTOK_ADS_APP_ID", "TIKTOK_ADS_SECRET", "TIKTOK_ADS_AUTH_URL"].filter((name) => !configured(name)),
  authorizeUrl({ state }) {
    const url = new URL(configured("TIKTOK_ADS_AUTH_URL"));
    url.searchParams.set("state", state);
    return url.toString();
  },
  async exchangeCode({ code }) {
    const response = await adsToken({ app_id: configured("TIKTOK_ADS_APP_ID"), secret: configured("TIKTOK_ADS_SECRET"), auth_code: code, is_long_term: true, return_advertiser_ids: true });
    const data = response.data;
    if (!data?.access_token) throw new ConnectorError("auth", "TikTok Ads authorization could not be completed.", response.message);
    return { accessToken: data.access_token, refreshToken: data.refresh_token ?? null, expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1_000) : null, scopes: (data.scope ?? []).map(String), metadata: { advertiserIds: data.advertiser_ids ?? [] } };
  },
  async refresh(refreshToken, metadata) {
    const response = await jsonFetch<AdsTokenResponse>("https://business-api.tiktok.com/open_api/v2.0/oauth/token/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ app_id: configured("TIKTOK_ADS_APP_ID"), secret: configured("TIKTOK_ADS_SECRET"), refresh_token: refreshToken, grant_type: "refresh_token" }) }, "TikTok Ads");
    const data = response.data;
    if (!data?.access_token) throw new ConnectorError("reauth", "TikTok Ads authorization expired. Reconnect TikTok Ads.", response.message);
    return { accessToken: data.access_token, refreshToken: data.refresh_token ?? refreshToken, expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1_000) : null, scopes: (data.scope ?? []).map(String), metadata };
  },
  async revoke(token) {
    await jsonFetch("https://business-api.tiktok.com/open_api/v2.0/oauth2/revoke_token/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ app_id: configured("TIKTOK_ADS_APP_ID"), secret: configured("TIKTOK_ADS_SECRET"), access_token: token }) }, "TikTok Ads");
  },
  latestDate(_product, today) { const date = new Date(today); date.setUTCDate(date.getUTCDate() - 1); return date.toISOString().slice(0, 10); },
  async sync(ctx) {
    await ctx.progress({ step: 2, total: 4, label: "Reading TikTok Ads reporting" });
    return adsSync(ctx.accessToken, ctx.account.id, ctx.range);
  },
};

export function advertiserIds(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== "object") return [];
  const value = (metadata as { advertiserIds?: unknown }).advertiserIds;
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string" && /^\d+$/.test(id)).slice(0, 500) : [];
}
