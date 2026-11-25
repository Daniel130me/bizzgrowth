// Server-side AI gateway: multi-provider chat completion with automatic
// failover. Providers are tried in priority order; if one fails (bad key,
// rate limit, outage, timeout) the next takes over immediately.
//
// Providers: z.ai, OpenAI, Groq, OpenRouter, Google Gemini (all via their
// OpenAI-compatible endpoints).
//
// Credentials NEVER live in the browser. Existing environment keys remain
// supported; administrator-managed keys are AES-256-GCM encrypted in the
// database. Values are never logged or returned: keys are identified only by
// label + a masked fingerprint.
//
// ---- Several keys per provider ----
// Every provider accepts any mix of these (no code change needed to add more):
//   GROQ_API_KEY=key                     the original single-key variable
//   GROQ_API_KEY=key1,key2               comma-separated (also newline-separated)
//   GROQ_API_KEYS=key3,key4              plural variable, same format
//   GROQ_API_KEY_2=key5                  numbered variables (_2, _3, … any number)
// Optionally prefix a key with a label so contributors can be identified:
//   GROQ_API_KEY_2=ada:gsk_abc…          → shown as "ada"
// Unlabelled keys are shown as "groq#1", "groq#2", … in configuration order.
// Same prefixes for ZAI_, ZAI_FREE_, OPENAI_, OPENROUTER_, GEMINI_, CEREBRAS_ and MISTRAL_.
// Duplicates are ignored.
//
// Rotation: within a provider, healthy keys are used least-recently-used
// first, so load spreads across all of them. A 429 / quota answer cools down
// only THAT key and the next key of the same provider is tried before failing
// over to the next provider. Invalid keys (401/403) are parked for longer
// (AI_GATEWAY_AUTH_PARK_MS, default 6h); a 503 "overloaded" parks the whole
// provider briefly since it is not key-specific.
//
// Usage per key (requests, successes, failures, rate-limit hits, tokens, last
// error, cooldown) is persisted to .ai-gateway/usage.json (gitignored) so it
// survives dev-server restarts. Set AI_GATEWAY_USAGE_FILE=off to keep it
// in-memory only, or to a path to store it elsewhere.
//
// MUST only be imported from API routes / server code.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import ZAI from "z-ai-web-dev-sdk";
import { providerRequestOptions, type GatewayReasoningEffort } from "@/lib/ai-gateway-request";
import {
  refreshRuntimeAiProviderConfig,
  runtimeAiProviderConfig,
  runtimeAiProviderOrder,
  type ManagedAiProviderId,
} from "@/lib/ai-provider-config";

export type GatewayProviderId = ManagedAiProviderId;

interface ProviderDef {
  id: GatewayProviderId;
  label: string;
  kind: "platform" | "openai-compatible";
  baseUrl?: string;
  envKeys?: string;
  envModel?: string;
  defaultModel: string;
  defaultKeysNote?: string;
}

const PROVIDER_DEFS: ProviderDef[] = [
  {
    id: "z.ai",
    label: "z.ai",
    kind: "openai-compatible",
    baseUrl: "https://api.z.ai/api/paas/v4/chat/completions",
    envKeys: "ZAI_API_KEY",
    envModel: "ZAI_MODEL",
    defaultModel: "glm-4.7-flash",
  },
  {
    // A second z.ai entry with its own keys and model, so keys on an account
    // with no balance can run the free GLM-4.7 Flash while the paid key stays
    // on GLM-5.3 under "z.ai". Each sits separately in the failover order.
    id: "z.ai-free",
    label: "z.ai free",
    kind: "openai-compatible",
    baseUrl: "https://api.z.ai/api/paas/v4/chat/completions",
    envKeys: "ZAI_FREE_API_KEY",
    envModel: "ZAI_FREE_MODEL",
    defaultModel: "glm-4.7-flash",
  },
  {
    id: "openai",
    label: "OpenAI",
    kind: "openai-compatible",
    baseUrl: "https://api.openai.com/v1/chat/completions",
    envKeys: "OPENAI_API_KEY",
    envModel: "OPENAI_MODEL",
    defaultModel: "gpt-4o-mini",
  },
  {
    id: "groq",
    label: "Groq",
    kind: "openai-compatible",
    baseUrl: "https://api.groq.com/openai/v1/chat/completions",
    envKeys: "GROQ_API_KEY",
    envModel: "GROQ_MODEL",
    defaultModel: "llama-3.3-70b-versatile",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    kind: "openai-compatible",
    baseUrl: "https://openrouter.ai/api/v1/chat/completions",
    envKeys: "OPENROUTER_API_KEY",
    envModel: "OPENROUTER_MODEL",
    defaultModel: "google/gemini-2.0-flash-001",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    kind: "openai-compatible",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    envKeys: "GEMINI_API_KEY",
    envModel: "GEMINI_MODEL",
    defaultModel: "gemini-2.0-flash",
  },
  {
    // Free tier (about 1M tokens/day as of Nov 2026); very fast inference.
    id: "cerebras",
    label: "Cerebras",
    kind: "openai-compatible",
    baseUrl: "https://api.cerebras.ai/v1/chat/completions",
    envKeys: "CEREBRAS_API_KEY",
    envModel: "CEREBRAS_MODEL",
    defaultModel: "gpt-oss-120b",
  },
  {
    // Free "Experiment" tier, rate-limited (about 1 request/second).
    id: "mistral",
    label: "Mistral",
    kind: "openai-compatible",
    baseUrl: "https://api.mistral.ai/v1/chat/completions",
    envKeys: "MISTRAL_API_KEY",
    envModel: "MISTRAL_MODEL",
    defaultModel: "mistral-medium-latest",
  },
];

const DEFAULT_ORDER: GatewayProviderId[] = ["z.ai", "openai", "groq", "openrouter", "gemini", "z.ai-free", "cerebras", "mistral"];

/**
 * Call profiles. "default" keeps AI_GATEWAY_ORDER for every existing feature.
 *  - "fast": live conversation turns, where every second of waiting is felt.
 *    Low-latency providers first (AI_GATEWAY_FAST_ORDER) and a shorter timeout
 *    (AI_GATEWAY_FAST_TIMEOUT_MS, 20 s by default), so a slow provider fails
 *    over instead of leaving the owner waiting.
 *  - "quality": the diagnosis — one call that decides whether the product
 *    impresses. Strongest reasoning first (AI_GATEWAY_QUALITY_ORDER), more
 *    reasoning effort on reasoning models.
 * Providers missing from a profile's list are appended in default order, and
 * only configured providers are ever called.
 */
export type GatewayProfile = "default" | "fast" | "quality";

const PROFILE_ORDER: Record<Exclude<GatewayProfile, "default">, { env: string; fallback: GatewayProviderId[] }> = {
  // Measured on this project's keys (Nov 2026): Groq ~1.3s, OpenRouter ~1.7s,
  // z.ai ~2.2s on a short prompt; Gemini flash-lite was returning 503 "high demand".
  fast: { env: "AI_GATEWAY_FAST_ORDER", fallback: ["groq", "openrouter", "z.ai", "openai", "gemini", "z.ai-free"] },
  quality: { env: "AI_GATEWAY_QUALITY_ORDER", fallback: ["groq", "openrouter", "openai", "z.ai", "gemini", "z.ai-free"] },
};

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const TIMEOUT_MS = envInt("AI_GATEWAY_TIMEOUT_MS", 45_000);
// 20 s, not 12: z.ai's free flash model often answers in 11-12 s, so a 12 s
// limit cut off replies that were nearly done and restarted on the next key.
const FAST_TIMEOUT_MS = envInt("AI_GATEWAY_FAST_TIMEOUT_MS", 20_000);
const COOLDOWN_MS = envInt("AI_GATEWAY_COOLDOWN_MS", 60_000);
const AUTH_PARK_MS = envInt("AI_GATEWAY_AUTH_PARK_MS", 6 * 60 * 60 * 1000);
const QUOTA_PARK_MS = envInt("AI_GATEWAY_QUOTA_PARK_MS", 60 * 60 * 1000);
const FAILURES_TO_OPEN = 2;

/**
 * A rate limit (429) or "overloaded" (503) answer says the provider will keep
 * refusing for a while — park it right away for that long so the next turns
 * go straight to a key/provider that will answer. A 429 parks only that key,
 * so it may honour a longer "try again in 7m30s" (up to 30 min); a 503 is
 * provider-wide and stays short (2s–60s).
 */
function parkFor(error: unknown): number | null {
  const status = (error as { status?: number })?.status;
  if (status !== 429 && status !== 503) return null;
  const msg = error instanceof Error ? error.message : "";
  const m = msg.match(/try again in\s*(?:(\d+)m)?\s*(\d+(?:\.\d+)?)\s*(ms|s)\b/i);
  let ms = status === 503 ? 30_000 : 20_000;
  if (m) ms = (Number(m[1] ?? 0) * 60 + (m[3] === "ms" ? Number(m[2]) / 1000 : Number(m[2]))) * 1000;
  const cap = status === 429 ? 30 * 60_000 : 60_000;
  return Math.max(2_000, Math.min(cap, ms));
}

/** Out of credits / quota — not coming back in seconds. */
function isQuotaExhausted(error: unknown): boolean {
  const status = (error as { status?: number })?.status;
  if (status === 402) return true;
  const msg = error instanceof Error ? error.message.toLowerCase() : "";
  // z.ai answers an empty balance with HTTP 429 + code 1113 ("Insufficient
  // balance or no resource package") — without this it was parked for only
  // ~20 s like a rate limit and retried on every turn.
  return /insufficient_quota|exceeded your current quota|insufficient credits|out of credits|insufficient balance|no resource package|"code":\s*"?1113\b/.test(msg);
}

/** Strip anything that looks like a credential out of an error message. */
function redact(message: string, apiKey?: string): string {
  let out = message;
  if (apiKey && apiKey.length >= 6) out = out.split(apiKey).join("[key]");
  return out.replace(/\b(sk-[a-z0-9-]*|gsk_|csk-|AIza|xai-)[A-Za-z0-9_\-*.]{6,}/gi, "[redacted]");
}

// ---------- Key configuration ----------

interface ProviderKey {
  apiKey: string;
  label: string;
  /** Stable, non-reversible id (sha256 prefix) — survives reordering. */
  fingerprint: string;
  /** "…abcd" — last 4 characters only. */
  masked: string;
  /** Env var the key came from. */
  source: string;
}

const LABEL_RE = /^([A-Za-z0-9 _.@#+-]{1,40}):(.+)$/;

function fingerprintOf(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex").slice(0, 10);
}

/** Env var names holding keys for a provider, in configuration order. */
function keyVarNames(base: string): string[] {
  const numbered = Object.keys(process.env)
    .map((name) => ({ name, m: name.match(new RegExp(`^${base}_(\\d+)$`)) }))
    .filter((x): x is { name: string; m: RegExpMatchArray } => x.m !== null)
    .sort((a, b) => Number(a.m[1]) - Number(b.m[1]))
    .map((x) => x.name);
  return [base, `${base}S`, ...numbered].filter((n) => (process.env[n] ?? "").trim().length > 0);
}

function keysFor(def: ProviderDef): ProviderKey[] {
  const managed = runtimeAiProviderConfig(def.id);
  if (!managed.enabled) return [];
  if (!def.envKeys) return [];
  const out: ProviderKey[] = [];
  const seen = new Set<string>();
  for (const source of keyVarNames(def.envKeys)) {
    for (const entry of (process.env[source] ?? "").split(/[,\n]/)) {
      const raw = entry.trim().replace(/^["']|["']$/g, "");
      if (!raw) continue;
      const m = raw.match(LABEL_RE);
      const apiKey = (m ? m[2] : raw).trim();
      if (!apiKey || seen.has(apiKey)) continue;
      seen.add(apiKey);
      out.push({
        apiKey,
        label: m ? m[1].trim() : `${def.id}#${out.length + 1}`,
        fingerprint: fingerprintOf(apiKey),
        masked: `…${apiKey.slice(-4)}`,
        source,
      });
    }
  }
  for (const credential of managed.credentials) {
    if (seen.has(credential.apiKey)) continue;
    seen.add(credential.apiKey);
    out.push({
      apiKey: credential.apiKey,
      label: credential.label,
      fingerprint: fingerprintOf(credential.apiKey),
      masked: `…${credential.lastFour}`,
      source: `admin:${credential.id}`,
    });
  }
  return out;
}

// ---------- Per-key health + usage state ----------
// Kept on globalThis so dev hot-reloads don't wipe it, and persisted to disk.

interface KeyStats {
  provider: GatewayProviderId;
  label: string;
  masked: string;
  requests: number;
  successes: number;
  failures: number;
  rateLimitHits: number;
  authFailures: number;
  consecutiveFailures: number;
  openUntil: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  firstSeenAt: number;
  lastUsedAt?: number;
  lastSuccessAt?: number;
  lastErrorAt?: number;
  lastError?: string;
  lastLatencyMs?: number;
}

export interface GatewayEvent {
  ts: number;
  routeLabel: string;
  provider: GatewayProviderId;
  model: string;
  ok: boolean;
  latencyMs?: number;
  error?: string;
}

interface GatewayState {
  health: Map<string, KeyStats>;
  loaded: boolean;
  saveTimer?: ReturnType<typeof setTimeout>;
  recentEvents: GatewayEvent[];
  lastServedBy: string | null;
}

const globalRef = globalThis as unknown as { __bizzAiGateway?: GatewayState };
const state: GatewayState = (globalRef.__bizzAiGateway ??= {
  health: new Map(),
  loaded: false,
  recentEvents: [],
  lastServedBy: null,
});

/** The app folder (where package.json lives). `next dev bizzgrowth` may run
 *  with cwd one level up, so look one directory down if needed. */
function appRoot(): string {
  const cwd = process.cwd();
  if (existsSync(path.join(cwd, "package.json"))) return cwd;
  try {
    for (const entry of readdirSync(cwd, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const dir = path.join(cwd, entry.name);
      if (existsSync(path.join(dir, "package.json")) && existsSync(path.join(dir, "src", "lib", "ai-gateway.ts"))) return dir;
    }
  } catch {
    // fall through
  }
  return cwd;
}

let cachedUsagePath: string | null | undefined;
function usageFilePath(): string | null {
  if (cachedUsagePath !== undefined) return cachedUsagePath;
  const raw = (process.env.AI_GATEWAY_USAGE_FILE ?? "").trim();
  if (raw.toLowerCase() === "off") cachedUsagePath = null;
  else cachedUsagePath = raw ? path.resolve(appRoot(), raw) : path.join(appRoot(), ".ai-gateway", "usage.json");
  return cachedUsagePath;
}

function loadUsage() {
  if (state.loaded) return;
  state.loaded = true;
  const file = usageFilePath();
  if (!file) return;
  try {
    const data = JSON.parse(readFileSync(file, "utf8")) as { keys?: Record<string, KeyStats> };
    for (const [id, stats] of Object.entries(data.keys ?? {})) {
      if (!state.health.has(id)) state.health.set(id, { ...emptyStats(stats.provider, stats.label, stats.masked), ...stats });
    }
  } catch {
    // No file yet (or unreadable) — start fresh.
  }
}

function scheduleSave() {
  const file = usageFilePath();
  if (!file || state.saveTimer) return;
  state.saveTimer = setTimeout(() => {
    state.saveTimer = undefined;
    try {
      mkdirSync(path.dirname(file), { recursive: true });
      const keys = Object.fromEntries(state.health.entries());
      writeFileSync(file, JSON.stringify({ version: 1, savedAt: Date.now(), keys }, null, 2));
    } catch (error) {
      console.warn("[Nellovia AI] could not persist gateway usage:", error instanceof Error ? error.message : error);
    }
  }, 1_000);
}

function emptyStats(provider: GatewayProviderId, label: string, masked: string): KeyStats {
  return {
    provider,
    label,
    masked,
    requests: 0,
    successes: 0,
    failures: 0,
    rateLimitHits: 0,
    authFailures: 0,
    consecutiveFailures: 0,
    openUntil: 0,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    firstSeenAt: Date.now(),
  };
}

function healthFor(route: Route): KeyStats {
  loadUsage();
  let h = state.health.get(route.key);
  if (!h) {
    h = emptyStats(route.provider.id, route.keyLabel, route.masked);
    state.health.set(route.key, h);
  }
  // Labels can be edited in env without changing the key — keep them current.
  h.label = route.keyLabel;
  h.masked = route.masked;
  return h;
}

function recordEvent(e: GatewayEvent) {
  state.recentEvents.unshift(e);
  if (state.recentEvents.length > 30) state.recentEvents.length = 30;
}

// ---------- Route building (fresh each call so env edits are picked up) ----------

interface Route {
  /** Stats id: "<provider>:<fingerprint>". */
  key: string;
  routeLabel: string;
  keyLabel: string;
  masked: string;
  fingerprint: string;
  provider: ProviderDef;
  model: string;
  apiKey?: string; // undefined for the platform provider
}

function parseOrder(profile: GatewayProfile = "default"): GatewayProviderId[] {
  // An order set by the administrator wins for every profile: what the admin
  // screen shows is what every AI request tries. Reset it there to return to
  // AI_GATEWAY_ORDER and the tuned fast/quality orders.
  const adminOrder = runtimeAiProviderOrder();
  if (adminOrder) return adminOrder;
  const spec = profile === "default" ? null : PROFILE_ORDER[profile];
  const raw = spec ? process.env[spec.env] : process.env.AI_GATEWAY_ORDER;
  const base = spec ? spec.fallback : DEFAULT_ORDER;
  const ids = raw
    ? raw
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter((s): s is GatewayProviderId => PROVIDER_DEFS.some((p) => p.id === s))
    : base;
  // Dedupe, preserve first occurrence; providers omitted from the list are appended.
  const seen = new Set<GatewayProviderId>();
  const merged: GatewayProviderId[] = [];
  for (const id of [...ids, ...base, ...DEFAULT_ORDER]) {
    if (!seen.has(id)) {
      seen.add(id);
      merged.push(id);
    }
  }
  return merged;
}

/** Routes in failover order — one per key, grouped by provider. Only
 *  configured providers are included. With `rotate`, each provider's keys are
 *  ordered healthy-first, least-recently-used first, to spread load. */
function buildRoutes(profile: GatewayProfile = "default", rotate = false): Route[] {
  const routes: Route[] = [];
  const now = Date.now();
  for (const id of parseOrder(profile)) {
    const def = PROVIDER_DEFS.find((p) => p.id === id);
    if (!def) continue;
    const managed = runtimeAiProviderConfig(def.id);
    if (!managed.enabled) continue;
    if (def.kind === "platform") {
      routes.push({
        key: "z.ai:platform",
        routeLabel: "z.ai (platform)",
        keyLabel: "platform",
        masked: "—",
        fingerprint: "platform",
        provider: def,
        model: managed.model || process.env.ZAI_MODEL || def.defaultModel,
      });
      continue;
    }
    const keys = keysFor(def);
    const model = (managed.model || process.env[def.envModel!] || def.defaultModel).trim();
    const group: Route[] = keys.map((k) => ({
      key: `${def.id}:${k.fingerprint}`,
      routeLabel: keys.length > 1 ? `${def.label} · ${k.label}` : def.label,
      keyLabel: k.label,
      masked: k.masked,
      fingerprint: k.fingerprint,
      provider: def,
      model,
      apiKey: k.apiKey,
    }));
    if (rotate && group.length > 1) {
      const meta = new Map(group.map((r, i) => [r, { h: healthFor(r), i }]));
      group.sort((a, b) => {
        const A = meta.get(a)!;
        const B = meta.get(b)!;
        const coolA = A.h.openUntil > now ? 1 : 0;
        const coolB = B.h.openUntil > now ? 1 : 0;
        if (coolA !== coolB) return coolA - coolB;
        const used = (A.h.lastUsedAt ?? 0) - (B.h.lastUsedAt ?? 0);
        return used !== 0 ? used : A.i - B.i;
      });
    }
    routes.push(...group);
  }
  return routes;
}

// ---------- Provider calls ----------

interface CompletionUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

async function callOpenAiCompatible(
  route: Route,
  system: string,
  user: string,
  maxTokens: number,
  timeoutMs: number,
  reasoningEffort: GatewayReasoningEffort = "low",
): Promise<{ text: string; usage?: CompletionUsage }> {
  if (!route.apiKey) throw new Error("missing key");
  if (!route.provider.baseUrl) throw new Error("missing base URL");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(route.provider.baseUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${route.apiKey}`,
        // OpenRouter attribution (optional, harmless elsewhere is NOT sent).
        // The app name is Nellovia; the referer domain is left as it was until
        // the owner decides which domain Nellovia lives on.
        ...(route.provider.id === "openrouter"
          ? { "HTTP-Referer": "https://bizzgrowth.app", "X-Title": "Nellovia" }
          : {}),
      },
      body: JSON.stringify({
        model: route.model,
        stream: false,
        ...providerRequestOptions(route.provider.id, route.model, maxTokens, reasoningEffort),
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const detail = body.slice(0, 200).replace(/\s+/g, " ");
      throw Object.assign(new Error(`HTTP ${res.status}${detail ? `: ${detail}` : ""}`), { status: res.status });
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[]; usage?: CompletionUsage };
    const content = data.choices?.[0]?.message?.content;
    if (!content || content.trim().length === 0) {
      throw Object.assign(new Error("empty completion"), { usage: data.usage });
    }
    return { text: content, usage: data.usage };
  } finally {
    clearTimeout(timer);
  }
}

async function callZai(system: string, user: string, timeoutMs: number): Promise<string> {
  // ZAI.create() re-reads the platform config — a freshly rotated token is
  // picked up on the next attempt instead of caching a dead one.
  const attempt = async (): Promise<string> => {
    const zai = await ZAI.create();
    const completion = await zai.chat.completions.create({
      messages: [
        { role: "assistant", content: system },
        { role: "user", content: user },
      ],
      thinking: { type: "disabled" },
    });
    const content = completion.choices[0]?.message?.content;
    if (!content || content.trim().length === 0) throw new Error("empty completion");
    return content;
  };
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs),
  );
  return Promise.race([attempt(), timeout]);
}

/** Connection-level blips (DNS, reset, socket closed) — worth one quick retry. */
/** Cut off by our own time limit: the AbortController ("This operation was aborted") or the platform race ("timeout after …"). */
function isTimeoutError(message: string): boolean {
  return /\babort(ed)?\b|timed? ?out|timeout after/i.test(message);
}

function isNetworkError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message.toLowerCase() : "";
  const code = String((error as { cause?: { code?: string } })?.cause?.code ?? "").toLowerCase();
  return msg.includes("fetch failed") || /econnreset|enotfound|eai_again|etimedout|und_err_socket|und_err_connect/.test(code);
}

/** The z.ai platform SDK only works where its config file exists (hosted env). */
function isMissingPlatformConfig(error: unknown): boolean {
  const msg = error instanceof Error ? error.message.toLowerCase() : "";
  return msg.includes("configuration file not found");
}

function isAuthError(error: unknown): boolean {
  const status = (error as { status?: number })?.status;
  if (status === 401 || status === 403) return true;
  const msg = error instanceof Error ? error.message.toLowerCase() : "";
  return msg.includes("401") || msg.includes("403") || msg.includes("unauthorized") || msg.includes("missing x-token");
}

function addUsage(h: KeyStats, usage: CompletionUsage | undefined) {
  if (!usage) return;
  const p = Number(usage.prompt_tokens) || 0;
  const c = Number(usage.completion_tokens) || 0;
  h.promptTokens += p;
  h.completionTokens += c;
  h.totalTokens += Number(usage.total_tokens) || p + c;
}

// ---------- Public API ----------

export interface GatewayAttempt {
  routeLabel: string;
  model: string;
  ok: boolean;
  latencyMs: number;
  error?: string;
}

export interface GatewayResult {
  text: string | null;
  servedBy?: string;
  model?: string;
  latencyMs?: number;
  attempts: GatewayAttempt[];
}

/** Run one chat completion through the failover chain. */
export async function gatewayChatComplete(
  system: string,
  user: string,
  opts?: { maxTokens?: number; profile?: GatewayProfile; timeoutMs?: number },
): Promise<GatewayResult> {
  if (process.env.BIZZ_AI_DISABLED === "1") {
    console.warn("[Nellovia AI] disabled via BIZZ_AI_DISABLED=1 — gateway will not be called");
    return { text: null, attempts: [] };
  }

  await refreshRuntimeAiProviderConfig();
  const profile: GatewayProfile = opts?.profile ?? "default";
  const routes = buildRoutes(profile, true);
  const maxTokens = opts?.maxTokens ?? 2000;
  const timeoutMs = opts?.timeoutMs ?? (profile === "fast" ? Math.min(FAST_TIMEOUT_MS, TIMEOUT_MS) : TIMEOUT_MS);
  const reasoningEffort = profile === "quality" ? "medium" : "low";
  const attempts: GatewayAttempt[] = [];
  const anyRouteAvailable = routes.some((r) => healthFor(r).openUntil <= Date.now());

  // A timeout says the PROVIDER is slow right now, not one key: rotating to its
  // next key usually times out too (three z.ai keys in a row). Its other keys
  // move to the back of the queue so a different provider answers first — they
  // stay as a last resort, nothing is dropped.
  const queue = [...routes];
  const slowProviders = new Set<string>();

  for (let i = 0; i < queue.length; i++) {
    const route = queue[i];
    const h = healthFor(route);
    // Skip cooling-down keys unless every key is cooling down (probe mode).
    // Uses the live clock so a key/provider parked earlier in THIS call is skipped too.
    if (h.openUntil > Date.now() && anyRouteAvailable) {
      attempts.push({ routeLabel: route.routeLabel, model: route.model, ok: false, latencyMs: 0, error: "skipped — cooling down after earlier failures" });
      continue;
    }

    // Auth-like failures get one quick retry (platform token rotation window);
    // everything else moves straight to the next route.
    // HTTP providers get one retry for connection blips (flaky networks).
    const tries = 2;
    for (let t = 0; t < tries; t++) {
      const started = Date.now();
      h.requests += 1;
      h.lastUsedAt = started;
      scheduleSave();
      try {
        let text: string;
        if (route.provider.kind === "platform") {
          text = await callZai(system, user, timeoutMs);
        } else {
          const out = await callOpenAiCompatible(route, system, user, maxTokens, timeoutMs, reasoningEffort);
          text = out.text;
          addUsage(h, out.usage);
        }
        const latencyMs = Date.now() - started;
        h.consecutiveFailures = 0;
        h.openUntil = 0;
        h.successes += 1;
        h.lastLatencyMs = latencyMs;
        h.lastSuccessAt = Date.now();
        h.lastError = undefined;
        state.lastServedBy = route.routeLabel;
        scheduleSave();
        attempts.push({ routeLabel: route.routeLabel, model: route.model, ok: true, latencyMs });
        recordEvent({ ts: Date.now(), routeLabel: route.routeLabel, provider: route.provider.id, model: route.model, ok: true, latencyMs });
        return { text, servedBy: route.routeLabel, model: route.model, latencyMs, attempts };
      } catch (error) {
        const latencyMs = Date.now() - started;
        const message = redact(error instanceof Error ? error.message : String(error), route.apiKey);
        attempts.push({ routeLabel: route.routeLabel, model: route.model, ok: false, latencyMs, error: message });
        recordEvent({ ts: Date.now(), routeLabel: route.routeLabel, provider: route.provider.id, model: route.model, ok: false, latencyMs, error: message.slice(0, 200) });
        console.error(`[Nellovia AI] ${route.routeLabel} (${route.masked}) failed (${latencyMs}ms):`, message);
        if (isTimeoutError(message) && !slowProviders.has(route.provider.id)) {
          slowProviders.add(route.provider.id);
          // Providers that haven't timed out go first; slow ones keep their order behind them.
          const later = queue.slice(i + 1);
          const fresh = later.filter((r) => !slowProviders.has(r.provider.id));
          const slow = later.filter((r) => slowProviders.has(r.provider.id));
          queue.splice(i + 1, later.length, ...fresh, ...slow);
        }
        addUsage(h, (error as { usage?: CompletionUsage })?.usage);
        h.failures += 1;
        h.consecutiveFailures += 1;
        h.lastLatencyMs = latencyMs;
        h.lastError = message.slice(0, 200);
        h.lastErrorAt = Date.now();
        scheduleSave();
        if (h.consecutiveFailures >= FAILURES_TO_OPEN) {
          h.openUntil = Date.now() + COOLDOWN_MS;
        }
        const status = (error as { status?: number })?.status;
        // Out of credits / quota — park this key for a long while.
        if (isQuotaExhausted(error)) {
          h.rateLimitHits += status === 429 ? 1 : 0;
          h.openUntil = Math.max(h.openUntil, Date.now() + QUOTA_PARK_MS);
          break;
        }
        const park = parkFor(error);
        if (park !== null) {
          if (status === 429) {
            // Rate limit is per key: cool down only this key, try the next one.
            h.rateLimitHits += 1;
            h.openUntil = Math.max(h.openUntil, Date.now() + park);
          } else {
            // 503 overloaded is provider-wide: park every key of this provider.
            for (const r of routes) {
              if (r.provider.id !== route.provider.id) continue;
              const rh = healthFor(r);
              rh.openUntil = Math.max(rh.openUntil, Date.now() + park);
            }
          }
          break;
        }
        // Invalid / revoked key — park it for hours, the other keys carry on.
        if (route.provider.kind !== "platform" && (status === 401 || status === 403)) {
          h.authFailures += 1;
          h.openUntil = Math.max(h.openUntil, Date.now() + AUTH_PARK_MS);
          break;
        }
        // No platform config on this machine — it will never work here, so
        // park the route for a long time instead of paying for it every turn.
        if (isMissingPlatformConfig(error)) {
          h.openUntil = Date.now() + 60 * 60 * 1000;
          break;
        }
        if (t < tries - 1 && route.provider.kind !== "platform") {
          if (isNetworkError(error)) {
            await new Promise((resolve) => setTimeout(resolve, 400));
            continue;
          }
          break;
        }
        if (t < tries - 1 && isAuthError(error)) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }
        // The platform route retries once for transient/auth failures, but a
        // timeout already consumed the full budget — move on instead.
        const msg = error instanceof Error ? error.message.toLowerCase() : "";
        if (t < tries - 1 && route.provider.kind === "platform" && !msg.includes("timeout")) {
          continue;
        }
        break;
      }
    }
  }

  return { text: null, attempts };
}

// ---------- Status snapshot (for the settings screen / GET /api/ai-gateway) ----------

/** Per-key stats as exposed by the status endpoint — never the key itself. */
export interface GatewayKeySnapshot {
  /** "<provider>:<fingerprint>" — stable id, non-reversible. */
  id: string;
  label: string;
  /** Last 4 characters only, e.g. "…a1b2". */
  masked: string;
  fingerprint: string;
  envVar?: string;
  configured: boolean;
  status: "active" | "cooling-down";
  cooldownUntil: number | null;
  requests: number;
  successes: number;
  failures: number;
  rateLimitHits: number;
  authFailures: number;
  consecutiveFailures: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  firstSeenAt: number;
  lastUsedAt?: number;
  lastSuccessAt?: number;
  lastErrorAt?: number;
  lastError?: string;
  lastLatencyMs?: number;
}

export interface GatewayUsageTotals {
  requests: number;
  successes: number;
  failures: number;
  rateLimitHits: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface GatewaySnapshot {
  disabled: boolean;
  orderLabel: string;
  timeoutMs: number;
  /** Per-try limit for live features (chat turns, check-ins, drafts). */
  fastTimeoutMs: number;
  cooldownMs: number;
  authParkMs: number;
  /** Where per-key usage is persisted (relative to the app), or null when in-memory only. */
  usageFile: string | null;
  providers: {
    id: GatewayProviderId;
    label: string;
    kind: string;
    enabled: boolean;
    configured: boolean;
    keyCount: number;
    activeKeyCount: number;
    model?: string;
    envKeys?: string;
    /** Env var names that currently hold keys for this provider (values never exposed). */
    envKeyVars?: string[];
    envModel?: string;
    note?: string;
    usage: GatewayUsageTotals;
    keys: GatewayKeySnapshot[];
    /** Keys with recorded usage that are no longer in the env. */
    retiredKeys: GatewayKeySnapshot[];
  }[];
  routes: {
    routeLabel: string;
    provider: GatewayProviderId;
    model: string;
    keyLabel: string;
    masked: string;
    status: "active" | "cooling-down";
    cooldownUntil: number | null;
    consecutiveFailures: number;
    requests: number;
    successes: number;
    failures: number;
    rateLimitHits: number;
    totalTokens: number;
    lastLatencyMs?: number;
    lastError?: string;
    lastSuccessAt?: number;
    lastUsedAt?: number;
  }[];
  events: GatewayEvent[];
  lastServedBy: string | null;
}

function keySnapshot(id: string, h: KeyStats, fingerprint: string, configured: boolean, envVar?: string): GatewayKeySnapshot {
  const now = Date.now();
  const cooling = h.openUntil > now;
  return {
    id,
    label: h.label,
    masked: h.masked,
    fingerprint,
    envVar,
    configured,
    status: cooling ? "cooling-down" : "active",
    cooldownUntil: cooling ? h.openUntil : null,
    requests: h.requests,
    successes: h.successes,
    failures: h.failures,
    rateLimitHits: h.rateLimitHits,
    authFailures: h.authFailures,
    consecutiveFailures: h.consecutiveFailures,
    promptTokens: h.promptTokens,
    completionTokens: h.completionTokens,
    totalTokens: h.totalTokens,
    firstSeenAt: h.firstSeenAt,
    lastUsedAt: h.lastUsedAt,
    lastSuccessAt: h.lastSuccessAt,
    lastErrorAt: h.lastErrorAt,
    lastError: h.lastError,
    lastLatencyMs: h.lastLatencyMs,
  };
}

function totals(keys: GatewayKeySnapshot[]): GatewayUsageTotals {
  const t: GatewayUsageTotals = { requests: 0, successes: 0, failures: 0, rateLimitHits: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  for (const k of keys) {
    t.requests += k.requests;
    t.successes += k.successes;
    t.failures += k.failures;
    t.rateLimitHits += k.rateLimitHits;
    t.promptTokens += k.promptTokens;
    t.completionTokens += k.completionTokens;
    t.totalTokens += k.totalTokens;
  }
  return t;
}

export async function getGatewaySnapshot(): Promise<GatewaySnapshot> {
  await refreshRuntimeAiProviderConfig();
  loadUsage();
  const routes = buildRoutes();
  const file = usageFilePath();
  const providers = PROVIDER_DEFS.map((def) => {
    const managed = runtimeAiProviderConfig(def.id);
    const model = (managed.model || (def.envModel ? process.env[def.envModel] : process.env.ZAI_MODEL) || def.defaultModel).trim();
    const providerRoutes = routes.filter((r) => r.provider.id === def.id);
    const configuredIds = new Set(providerRoutes.map((r) => r.key));
    const sources = new Map(keysFor(def).map((k) => [k.fingerprint, k.source]));
    const keys = providerRoutes.map((r) => keySnapshot(r.key, healthFor(r), r.fingerprint, true, sources.get(r.fingerprint)));
    const retiredKeys = [...state.health.entries()]
      .filter(([id, h]) => h.provider === def.id && !configuredIds.has(id) && h.requests > 0)
      .map(([id, h]) => keySnapshot(id, h, id.split(":").slice(1).join(":"), false));
    const base = {
      id: def.id,
      label: def.label,
      kind: def.kind,
      enabled: managed.enabled,
      model,
      usage: totals([...keys, ...retiredKeys]),
      keys,
      retiredKeys,
      activeKeyCount: keys.filter((k) => k.status === "active").length,
    };
    if (def.kind === "platform") {
      return { ...base, configured: true, keyCount: 1, note: def.defaultKeysNote };
    }
    return {
      ...base,
      configured: keys.length > 0,
      keyCount: keys.length,
      envKeys: def.envKeys,
      envKeyVars: keyVarNames(def.envKeys!),
      envModel: def.envModel,
    };
  });
  return {
    disabled: process.env.BIZZ_AI_DISABLED === "1",
    orderLabel: parseOrder().join(" → "),
    timeoutMs: TIMEOUT_MS,
    fastTimeoutMs: Math.min(FAST_TIMEOUT_MS, TIMEOUT_MS),
    cooldownMs: COOLDOWN_MS,
    authParkMs: AUTH_PARK_MS,
    usageFile: file ? path.relative(appRoot(), file) || file : null,
    providers,
    routes: routes.map((r) => {
      const h = healthFor(r);
      const cooling = h.openUntil > Date.now();
      return {
        routeLabel: r.routeLabel,
        provider: r.provider.id,
        model: r.model,
        keyLabel: r.keyLabel,
        masked: r.masked,
        status: cooling ? ("cooling-down" as const) : ("active" as const),
        cooldownUntil: cooling ? h.openUntil : null,
        consecutiveFailures: h.consecutiveFailures,
        requests: h.requests,
        successes: h.successes,
        failures: h.failures,
        rateLimitHits: h.rateLimitHits,
        totalTokens: h.totalTokens,
        lastLatencyMs: h.lastLatencyMs,
        lastError: h.lastError,
        lastSuccessAt: h.lastSuccessAt,
        lastUsedAt: h.lastUsedAt,
      };
    }),
    events: [...state.recentEvents],
    lastServedBy: state.lastServedBy,
  };
}
