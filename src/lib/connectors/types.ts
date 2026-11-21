// Connector framework types.
//
// A connector is one third-party platform (Google, later Paystack, Meta, ...).
// It may cover several products (Google: Search Console + Analytics) that the
// owner connects separately. Every connector normalizes what it reads into
// daily metric points, so summaries, the Data pages and the AI never need to
// know which platform a number came from — only its label and source.
//
// The first half of this file is client-safe (API response shapes); the
// Connector interface is implemented server-side only.

import type { CatalogueGroup, ScopeLine } from "./catalogue";

// ---------------------------------------------------------------- API shapes

export type ConnectionStatusValue = "pending" | "syncing" | "connected" | "error";

export interface SyncProgress {
  step: number;
  total: number;
  label: string;
  /** Rows saved so far in this sync. */
  rows?: number;
}

/** A connection as the browser sees it — never includes tokens. */
export interface ConnectionView {
  id: string;
  provider: string;
  /** "" while signed in but nothing picked yet. */
  product: string;
  catalogueId: string | null;
  accountId: string | null;
  accountLabel: string | null;
  status: ConnectionStatusValue;
  progress: SyncProgress | null;
  error: string | null;
  errorCode: string | null;
  lastSyncAt: string | null;
  lastAttemptAt: string | null;
  connectedSince: string;
  dataFrom: string | null;
  dataTo: string | null;
  scopes: string[];
}

export interface ProviderSetup {
  configured: boolean;
  /** Names of missing environment variables (never values). */
  missing: string[];
}

export interface ConnectStatusResponse {
  ok: boolean;
  signedIn: boolean;
  /** False until the additive connection migrations through 005 are applied. */
  tablesReady: boolean;
  providers: Record<string, ProviderSetup>;
  connections: ConnectionView[];
  /** Catalogue ids this user said "I use this" for. */
  interest: string[];
}

export interface GoogleAccountsResponse {
  ok: boolean;
  error?: string;
  searchConsole: { granted: boolean; sites: { id: string; label: string; detail: string }[]; error?: string };
  analytics: { granted: boolean; properties: { id: string; label: string; detail: string }[]; error?: string };
  ads: { granted: boolean; accounts: { id: string; label: string; detail: string }[]; error?: string };
  sheets: { granted: boolean; error?: string };
  /** What is already connected, so the picker can preselect it. */
  current: { searchConsole: string | null; analytics: string | null; ads: string | null; sheets: string | null };
}

export interface SheetPreviewResponse {
  ok: boolean;
  spreadsheet: { id: string; name: string };
  tabs: Array<{ title: string; headers: string[]; sample: string[][] }>;
}

export interface MetaAccountsResponse {
  ok: boolean;
  ads: { granted: boolean; accounts: { id: string; label: string; detail: string }[]; error?: string };
  pages: { granted: boolean; pages: { id: string; label: string; detail: string }[]; error?: string };
  instagram: { granted: boolean; accounts: { id: string; label: string; detail: string; pageId: string }[]; error?: string };
  current: { ads: string | null; facebook: string | null; instagram: string | null };
}

export interface TikTokAdsAccountsResponse {
  ok: boolean;
  accounts: Array<{ id: string; label: string; detail: string }>;
  current: string | null;
}

export interface Change {
  now: number;
  prev: number;
}

export interface MeasuredWindow {
  from: string;
  to: string;
}

export interface SearchConsoleSummary {
  connectionId: string;
  site: string;
  window: MeasuredWindow;
  prevWindow: MeasuredWindow;
  clicks: Change;
  impressions: Change;
  /** Percent (clicks / impressions × 100), null when there were no impressions. */
  ctr: { now: number | null; prev: number | null };
  position: { now: number | null; prev: number | null };
  topQueries: { key: string; clicks: number; impressions: number; prevClicks: number }[];
  topPages: { key: string; clicks: number; impressions: number; prevClicks: number }[];
  daily: { date: string; clicks: number; impressions: number }[];
  lastSyncAt: string | null;
}

export interface AnalyticsSummary {
  connectionId: string;
  property: string;
  window: MeasuredWindow;
  prevWindow: MeasuredWindow;
  sessions: Change;
  /** Unique people in each 28-day window (not a sum of daily counts). */
  users: { now: number | null; prev: number | null };
  newUsers: Change;
  keyEvents: Change;
  channels: { key: string; sessions: number; prevSessions: number; keyEvents: number }[];
  daily: { date: string; sessions: number; keyEvents: number }[];
  lastSyncAt: string | null;
}

export interface MeasuredSummary {
  generatedAt: string;
  searchConsole: SearchConsoleSummary | null;
  analytics: AnalyticsSummary | null;
  otherSources: Array<{
    connectionId: string;
    provider: string;
    product: string;
    source: string;
    account: string;
    window: MeasuredWindow;
    prevWindow: MeasuredWindow;
    metrics: Record<string, Change>;
    lastSyncAt: string | null;
  }>;
}

// ------------------------------------------------------------ Server contract

export type AuthType = "oauth2" | "apiKey" | "webhook";

/** Inclusive calendar dates, YYYY-MM-DD. */
export interface DateRange {
  from: string;
  to: string;
}

/** One normalized number for one day. dimension "" = the day's total. */
export interface MetricPoint {
  metric: string;
  date: string;
  value: number;
  dimension?: string;
  dimensionValue?: string;
}

export interface TokenSet {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scopes: string[];
  /** Non-secret provider identifiers needed after OAuth. */
  metadata?: Record<string, unknown> | null;
}

export interface ConnectorProduct {
  id: string;
  name: string;
  catalogueId: string;
  /** The read-only scopes this product needs. */
  scopes: ScopeLine[];
}

export interface SyncContext {
  accessToken: string;
  product: string;
  account: { id: string; label: string | null; config?: Record<string, unknown> | null };
  range: DateRange;
  /** Report a step; the UI polls it to show real progress. */
  progress: (p: SyncProgress) => Promise<void>;
}

export type ConnectorErrorCode =
  | "auth" // token rejected — refresh, or reconnect
  | "reauth" // refresh token revoked/expired: the owner must reconnect
  | "scope_missing" // the owner did not tick a permission on the consent screen
  | "api_disabled" // the API is switched off in the developer project
  | "no_access" // this account cannot see that site/property
  | "rate_limited"
  | "not_configured"
  | "bad_request"
  | "upstream"
  | "network";

/** Errors a connector throws; `message` is safe to show the owner. */
export class ConnectorError extends Error {
  constructor(
    public code: ConnectorErrorCode,
    message: string,
    /** Internal detail for logs (never tokens). */
    public detail?: string,
  ) {
    super(message);
    this.name = "ConnectorError";
  }
}

interface ConnectorBase {
  id: string;
  name: string;
  category: string;
  stage: CatalogueGroup;
  authType: AuthType;
  products: ConnectorProduct[];
  /** Env variable names this connector needs; empty array = ready. */
  missingConfig(): string[];
  /** Read normalized daily numbers for one product + account. */
  sync(ctx: SyncContext): Promise<MetricPoint[]>;
  /** Days of history to read on the first sync. */
  backfillDays: number;
  /** Days before the last synced day to read again (late, revised data). */
  resyncDays: number;
  /** Latest day worth asking for (e.g. Search Console lags 2-3 days). */
  latestDate(product: string, today: Date): string;
}

export interface OAuth2Connector extends ConnectorBase {
  authType: "oauth2";
  authorizeUrl(input: { state: string; redirectUri: string; products: string[]; context?: Record<string, string> }): string;
  exchangeCode(input: { code: string; redirectUri: string; context?: Record<string, string> }): Promise<TokenSet>;
  refresh(refreshToken: string, metadata?: Record<string, unknown> | null): Promise<TokenSet>;
  revoke(token: string): Promise<void>;
}

export interface ApiKeyConnector extends ConnectorBase {
  authType: "apiKey";
  /** Check a key and return the account it belongs to. */
  verifyKey(key: string): Promise<{ id: string; label: string }>;
}

export interface WebhookConnector extends ConnectorBase {
  authType: "webhook";
  /** Turn one incoming payload into metric points. */
  parse(payload: unknown): MetricPoint[];
}

export type Connector = OAuth2Connector | ApiKeyConnector | WebhookConnector;
