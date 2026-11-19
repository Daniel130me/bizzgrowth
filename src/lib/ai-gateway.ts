// Server-side AI gateway: multi-provider chat completion with automatic
// failover. Providers are tried in priority order; if one fails (bad key,
// rate limit, outage, timeout) the next takes over immediately.
//
// Providers: z.ai (platform SDK, always available), OpenAI, Groq,
// OpenRouter, Google Gemini (all via their OpenAI-compatible endpoints).
//
// Credentials NEVER live in the browser or the database — they are read from
// server environment variables (.env.local). Multiple keys per provider are
// supported, comma-separated; each key becomes its own failover route.
//
// MUST only be imported from API routes / server code.

import ZAI from "z-ai-web-dev-sdk";

export type GatewayProviderId = "z.ai" | "openai" | "groq" | "openrouter" | "gemini";

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
];

const DEFAULT_ORDER: GatewayProviderId[] = ["z.ai", "openai", "groq", "openrouter", "gemini"];

/**
 * Call profiles. "default" keeps AI_GATEWAY_ORDER for every existing feature.
 *  - "fast": live conversation turns, where every second of waiting is felt.
 *    Low-latency providers first (AI_GATEWAY_FAST_ORDER) and a short timeout,
 *    so a slow provider fails over instead of leaving the owner waiting.
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
  fast: { env: "AI_GATEWAY_FAST_ORDER", fallback: ["groq", "openrouter", "z.ai", "openai", "gemini"] },
  quality: { env: "AI_GATEWAY_QUALITY_ORDER", fallback: ["groq", "openrouter", "openai", "z.ai", "gemini"] },
};

/**
 * A rate limit (429) or "overloaded" (503) answer says the provider will keep
 * refusing for a while — park it right away for that long (2s–60s) so the
 * next turns go straight to a provider that will answer.
 */
function parkFor(error: unknown): number | null {
  const status = (error as { status?: number })?.status;
  if (status !== 429 && status !== 503) return null;
  const msg = error instanceof Error ? error.message : "";
  const m = msg.match(/try again in\s*(?:(\d+)m)?\s*(\d+(?:\.\d+)?)\s*(ms|s)\b/i);
  let ms = status === 503 ? 30_000 : 20_000;
  if (m) ms = (Number(m[1] ?? 0) * 60 + (m[3] === "ms" ? Number(m[2]) / 1000 : Number(m[2]))) * 1000;
  return Math.max(2_000, Math.min(60_000, ms));
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const TIMEOUT_MS = envInt("AI_GATEWAY_TIMEOUT_MS", 45_000);
const FAST_TIMEOUT_MS = envInt("AI_GATEWAY_FAST_TIMEOUT_MS", 12_000);
const COOLDOWN_MS = envInt("AI_GATEWAY_COOLDOWN_MS", 60_000);
const FAILURES_TO_OPEN = 2;

// ---------- Health state (per server process) ----------

interface RouteHealth {
  consecutiveFailures: number;
  openUntil: number;
  successes: number;
  failures: number;
  lastLatencyMs?: number;
  lastError?: string;
  lastSuccessAt?: number;
}

const health = new Map<string, RouteHealth>();

function healthFor(key: string): RouteHealth {
  let h = health.get(key);
  if (!h) {
    h = { consecutiveFailures: 0, openUntil: 0, successes: 0, failures: 0 };
    health.set(key, h);
  }
  return h;
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

const recentEvents: GatewayEvent[] = [];
let lastServedBy: string | null = null;

function recordEvent(e: GatewayEvent) {
  recentEvents.unshift(e);
  if (recentEvents.length > 30) recentEvents.length = 30;
}

// ---------- Route building (fresh each call so env edits are picked up) ----------

interface Route {
  key: string;
  routeLabel: string;
  provider: ProviderDef;
  model: string;
  apiKey?: string; // undefined for the platform provider
}

function splitKeys(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
}

function parseOrder(profile: GatewayProfile = "default"): GatewayProviderId[] {
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

/** Routes in failover order. Only configured providers are included
 *  (z.ai is the platform default and is always included). */
function buildRoutes(profile: GatewayProfile = "default"): Route[] {
  const routes: Route[] = [];
  for (const id of parseOrder(profile)) {
    const def = PROVIDER_DEFS.find((p) => p.id === id);
    if (!def) continue;
    if (def.kind === "platform") {
      routes.push({
        key: "z.ai:platform",
        routeLabel: "z.ai (platform)",
        provider: def,
        model: process.env.ZAI_MODEL || def.defaultModel,
      });
      continue;
    }
    const keys = splitKeys(process.env[def.envKeys!]);
    const model = (process.env[def.envModel!] || def.defaultModel).trim();
    keys.forEach((apiKey, i) => {
      routes.push({
        key: `${def.id}:${i}:${model}`,
        routeLabel: keys.length > 1 ? `${def.label} key #${i + 1}` : def.label,
        provider: def,
        model,
        apiKey,
      });
    });
  }
  return routes;
}

// ---------- Provider calls ----------

async function callOpenAiCompatible(
  route: Route,
  system: string,
  user: string,
  maxTokens: number,
  timeoutMs: number,
  reasoningEffort: "low" | "medium" = "low",
): Promise<string> {
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
        // OpenRouter attribution (optional, harmless elsewhere is NOT sent)
        ...(route.provider.id === "openrouter"
          ? { "HTTP-Referer": "https://bizzgrowth.app", "X-Title": "bizzGrowth" }
          : {}),
      },
      body: JSON.stringify({
        model: route.model,
        stream: false,
        max_tokens: maxTokens,
        // Reasoning models (gpt-oss) spend max_tokens on hidden reasoning and
        // return empty content on short budgets — keep reasoning minimal.
        ...(/gpt-oss/i.test(route.model) ? { reasoning_effort: reasoningEffort } : {}),
        // GLM models think by default; disable it for fast, non-empty replies.
        ...(route.provider.id === "z.ai" ? { thinking: { type: "disabled" } } : {}),
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
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content;
    if (!content || content.trim().length === 0) throw new Error("empty completion");
    return content;
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
    console.warn("[bizzGrowth AI] disabled via BIZZ_AI_DISABLED=1 — gateway will not be called");
    return { text: null, attempts: [] };
  }

  const profile: GatewayProfile = opts?.profile ?? "default";
  const routes = buildRoutes(profile);
  const maxTokens = opts?.maxTokens ?? 2000;
  const timeoutMs = opts?.timeoutMs ?? (profile === "fast" ? Math.min(FAST_TIMEOUT_MS, TIMEOUT_MS) : TIMEOUT_MS);
  const reasoningEffort = profile === "quality" ? "medium" : "low";
  const attempts: GatewayAttempt[] = [];
  const now = Date.now();
  const anyRouteAvailable = routes.some((r) => healthFor(r.key).openUntil <= now);

  for (const route of routes) {
    const h = healthFor(route.key);
    // Skip cooling-down routes unless every route is cooling down (probe mode).
    if (h.openUntil > now && anyRouteAvailable) {
      attempts.push({ routeLabel: route.routeLabel, model: route.model, ok: false, latencyMs: 0, error: "skipped — cooling down after earlier failures" });
      continue;
    }

    // Auth-like failures get one quick retry (platform token rotation window);
    // everything else moves straight to the next route.
    // HTTP providers get one retry for connection blips (flaky networks).
    const tries = 2;
    for (let t = 0; t < tries; t++) {
      const started = Date.now();
      try {
        const text =
          route.provider.kind === "platform"
            ? await callZai(system, user, timeoutMs)
            : await callOpenAiCompatible(route, system, user, maxTokens, timeoutMs, reasoningEffort);
        const latencyMs = Date.now() - started;
        h.consecutiveFailures = 0;
        h.openUntil = 0;
        h.successes += 1;
        h.lastLatencyMs = latencyMs;
        h.lastSuccessAt = Date.now();
        h.lastError = undefined;
        lastServedBy = route.routeLabel;
        attempts.push({ routeLabel: route.routeLabel, model: route.model, ok: true, latencyMs });
        recordEvent({ ts: Date.now(), routeLabel: route.routeLabel, provider: route.provider.id, model: route.model, ok: true, latencyMs });
        return { text, servedBy: route.routeLabel, model: route.model, latencyMs, attempts };
      } catch (error) {
        const latencyMs = Date.now() - started;
        const message = error instanceof Error ? error.message : String(error);
        attempts.push({ routeLabel: route.routeLabel, model: route.model, ok: false, latencyMs, error: message });
        recordEvent({ ts: Date.now(), routeLabel: route.routeLabel, provider: route.provider.id, model: route.model, ok: false, latencyMs, error: message.slice(0, 200) });
        console.error(`[bizzGrowth AI] ${route.routeLabel} failed (${latencyMs}ms):`, message);
        h.failures += 1;
        h.consecutiveFailures += 1;
        h.lastLatencyMs = latencyMs;
        h.lastError = message.slice(0, 200);
        if (h.consecutiveFailures >= FAILURES_TO_OPEN) {
          h.openUntil = Date.now() + COOLDOWN_MS;
        }
        const park = parkFor(error);
        if (park !== null) {
          h.openUntil = Math.max(h.openUntil, Date.now() + park);
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

// ---------- Status snapshot (for the settings screen) ----------

export interface GatewaySnapshot {
  disabled: boolean;
  orderLabel: string;
  timeoutMs: number;
  cooldownMs: number;
  providers: {
    id: GatewayProviderId;
    label: string;
    kind: string;
    configured: boolean;
    keyCount: number;
    model?: string;
    envKeys?: string;
    envModel?: string;
    note?: string;
  }[];
  routes: {
    routeLabel: string;
    provider: GatewayProviderId;
    model: string;
    status: "active" | "cooling-down";
    consecutiveFailures: number;
    successes: number;
    failures: number;
    lastLatencyMs?: number;
    lastError?: string;
    lastSuccessAt?: number;
  }[];
  events: GatewayEvent[];
  lastServedBy: string | null;
}

export function getGatewaySnapshot(): GatewaySnapshot {
  const routes = buildRoutes();
  const providers = PROVIDER_DEFS.map((def) => {
    if (def.kind === "platform") {
      return {
        id: def.id,
        label: def.label,
        kind: def.kind,
        configured: true,
        keyCount: 1,
        model: process.env.ZAI_MODEL || def.defaultModel,
        note: def.defaultKeysNote,
      };
    }
    const keys = splitKeys(process.env[def.envKeys!]);
    const model = (process.env[def.envModel!] || def.defaultModel).trim();
    return {
      id: def.id,
      label: def.label,
      kind: def.kind,
      configured: keys.length > 0,
      keyCount: keys.length,
      model,
      envKeys: def.envKeys,
      envModel: def.envModel,
    };
  });
  return {
    disabled: process.env.BIZZ_AI_DISABLED === "1",
    orderLabel: parseOrder().join(" → "),
    timeoutMs: TIMEOUT_MS,
    cooldownMs: COOLDOWN_MS,
    providers,
    routes: routes.map((r) => {
      const h = healthFor(r.key);
      return {
        routeLabel: r.routeLabel,
        provider: r.provider.id,
        model: r.model,
        status: h.openUntil > Date.now() ? ("cooling-down" as const) : ("active" as const),
        consecutiveFailures: h.consecutiveFailures,
        successes: h.successes,
        failures: h.failures,
        lastLatencyMs: h.lastLatencyMs,
        lastError: h.lastError,
        lastSuccessAt: h.lastSuccessAt,
      };
    }),
    events: [...recentEvents],
    lastServedBy,
  };
}
