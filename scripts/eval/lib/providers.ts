// Read-only views of the live AI settings, and direct provider calls for the
// plain-AI comparison (no Nellovia prompt, code or checks around it).
//
// Nothing here ever writes AiProviderConfig or AiProviderCredential. Keys are
// read into memory only to make the comparison call — never printed, logged or
// saved; results name keys by label and last four characters.

import { createDecipheriv } from "node:crypto";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { providerRequestOptions } from "@/lib/ai-gateway-request";
import type { ManagedAiProviderId } from "@/lib/ai-provider-config";

/** Copied from PROVIDER_DEFS in src/lib/ai-gateway.ts (labels, endpoints, env names). */
export const PROVIDERS: { id: ManagedAiProviderId; label: string; baseUrl: string; envKeys: string; envModel: string; defaultModel: string }[] = [
  { id: "z.ai", label: "z.ai", baseUrl: "https://api.z.ai/api/paas/v4/chat/completions", envKeys: "ZAI_API_KEY", envModel: "ZAI_MODEL", defaultModel: "glm-4.7-flash" },
  { id: "z.ai-free", label: "z.ai free", baseUrl: "https://api.z.ai/api/paas/v4/chat/completions", envKeys: "ZAI_FREE_API_KEY", envModel: "ZAI_FREE_MODEL", defaultModel: "glm-4.7-flash" },
  { id: "openai", label: "OpenAI", baseUrl: "https://api.openai.com/v1/chat/completions", envKeys: "OPENAI_API_KEY", envModel: "OPENAI_MODEL", defaultModel: "gpt-4o-mini" },
  { id: "groq", label: "Groq", baseUrl: "https://api.groq.com/openai/v1/chat/completions", envKeys: "GROQ_API_KEY", envModel: "GROQ_MODEL", defaultModel: "llama-3.3-70b-versatile" },
  { id: "openrouter", label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1/chat/completions", envKeys: "OPENROUTER_API_KEY", envModel: "OPENROUTER_MODEL", defaultModel: "google/gemini-2.0-flash-001" },
  { id: "gemini", label: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", envKeys: "GEMINI_API_KEY", envModel: "GEMINI_MODEL", defaultModel: "gemini-2.0-flash" },
  { id: "cerebras", label: "Cerebras", baseUrl: "https://api.cerebras.ai/v1/chat/completions", envKeys: "CEREBRAS_API_KEY", envModel: "CEREBRAS_MODEL", defaultModel: "gpt-oss-120b" },
  { id: "mistral", label: "Mistral", baseUrl: "https://api.mistral.ai/v1/chat/completions", envKeys: "MISTRAL_API_KEY", envModel: "MISTRAL_MODEL", defaultModel: "mistral-medium-latest" },
];

interface ProviderRow {
  provider: string;
  enabled: boolean;
  model: string | null;
  updatedAt: Date;
}
interface CredentialRow {
  provider: string;
  label: string;
  lastFour: string;
  enabled: boolean;
  secretEnc?: string;
}

/** Same parsing and labels as keysFor() in src/lib/ai-gateway.ts: plain, plural, numbered, "label:key". */
/**
 * A variable's value as the Next.js dev server reads it (dotenv: the outer pair of quotes is
 * stripped), not as Bun does — Bun keeps only the first quoted part of KEY="k1","k2", which
 * under-counted the keys the app really uses. Shell variables still win, as in Next.
 */
function nextEnvValue(name: string): string {
  for (const file of [".env.development.local", ".env.local", ".env.development", ".env"]) {
    let text = "";
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const line = text.split(/\r?\n/).find((l) => l.replace(/^\s*export\s+/, "").startsWith(`${name}=`));
    if (line === undefined) continue;
    const v = line.slice(line.indexOf("=") + 1).trim();
    return v.length >= 2 && /^["'`]/.test(v) && v[v.length - 1] === v[0] ? v.slice(1, -1) : v;
  }
  return process.env[name] ?? "";
}
function envKeys(providerId: ManagedAiProviderId, base: string): { label: string; apiKey: string }[] {
  const numbered = Object.keys(process.env)
    .map((name) => ({ name, m: name.match(new RegExp(`^${base}_(\\d+)$`)) }))
    .filter((x): x is { name: string; m: RegExpMatchArray } => x.m !== null)
    .sort((a, b) => Number(a.m[1]) - Number(b.m[1]))
    .map((x) => x.name);
  const out: { label: string; apiKey: string }[] = [];
  const seen = new Set<string>();
  for (const source of [base, `${base}S`, ...numbered].filter((n) => nextEnvValue(n).trim().length > 0)) {
    for (const entry of nextEnvValue(source).split(/[,\n]/)) {
      const raw = entry.trim().replace(/^["']|["']$/g, "");
      if (!raw) continue;
      const m = raw.match(/^([A-Za-z0-9 _.@#+-]{1,40}):(.+)$/);
      const apiKey = (m ? m[2] : raw).trim();
      if (!apiKey || seen.has(apiKey)) continue;
      seen.add(apiKey);
      out.push({ label: m ? m[1].trim() : `${providerId}#${out.length + 1}`, apiKey });
    }
  }
  return out;
}

function decrypt(stored: string): string {
  const raw = (process.env.AI_CREDENTIALS_ENCRYPTION_KEY ?? "").trim();
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("AI_CREDENTIALS_ENCRYPTION_KEY is unavailable.");
  const [version, iv, tag, encrypted] = stored.split(".");
  if (version !== "v1" || !iv || !tag || !encrypted) throw new Error("Unrecognised encrypted AI credential.");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}

/** The live AI settings as they are right now — order, switches, models, keys by label only. Read-only. */
export async function providerSnapshot(): Promise<Record<string, unknown>> {
  const db = new PrismaClient();
  try {
    const rows = await db.$queryRaw<ProviderRow[]>`SELECT "provider", "enabled", "model", "updatedAt" FROM "AiProviderConfig"`;
    const creds = await db.$queryRaw<CredentialRow[]>`SELECT "provider", "label", "lastFour", "enabled" FROM "AiProviderCredential" ORDER BY "provider", "createdAt"`;
    const orderRow = rows.find((r) => r.provider === "_gateway_order");
    return {
      takenAt: new Date().toISOString(),
      adminOrder: orderRow?.model ? orderRow.model.split(",").map((s) => s.trim()) : null,
      adminOrderSavedAt: orderRow?.updatedAt ?? null,
      envOrder: process.env.AI_GATEWAY_ORDER ?? null,
      providers: PROVIDERS.map((p) => {
        const row = rows.find((r) => r.provider === p.id);
        return {
          id: p.id,
          enabled: row?.enabled ?? true,
          model: row?.model?.trim() || process.env[p.envModel] || p.defaultModel,
          modelSource: row?.model?.trim() ? "admin screen" : process.env[p.envModel] ? `.env ${p.envModel}` : "built-in default",
          envKeys: envKeys(p.id, p.envKeys).map((k) => ({ label: k.label, masked: `…${k.apiKey.slice(-4)}` })),
          adminKeys: creds.filter((c) => c.provider === p.id).map((c) => ({ label: c.label, masked: `…${c.lastFour}`, enabled: c.enabled })),
        };
      }),
    };
  } finally {
    await db.$disconnect();
  }
}

/** The provider and key behind a gateway route label such as "OpenAI" or "z.ai · zai#3". */
async function keyForRoute(routeLabel: string): Promise<{ provider: (typeof PROVIDERS)[number]; apiKey: string; keyLabel: string }> {
  const [providerLabel, keyLabel] = routeLabel.split(" · ").map((s) => s.trim());
  const provider = PROVIDERS.find((p) => p.label === providerLabel);
  if (!provider) throw new Error(`Unknown provider route "${routeLabel}"`);
  const fromEnv = envKeys(provider.id, provider.envKeys);
  const db = new PrismaClient();
  let admin: { label: string; apiKey: string }[] = [];
  try {
    const rows = await db.$queryRaw<CredentialRow[]>`SELECT "provider", "label", "lastFour", "enabled", "secretEnc" FROM "AiProviderCredential" WHERE "provider" = ${provider.id} AND "enabled" = TRUE ORDER BY "createdAt"`;
    admin = rows.map((r) => ({ label: r.label, apiKey: decrypt(r.secretEnc ?? "") }));
  } finally {
    await db.$disconnect();
  }
  const all = [...fromEnv, ...admin.filter((a) => !fromEnv.some((e) => e.apiKey === a.apiKey))];
  const pick = keyLabel ? all.find((k) => k.label === keyLabel) : all[0];
  if (!pick) throw new Error(`No key found for "${routeLabel}"`);
  return { provider, apiKey: pick.apiKey, keyLabel: pick.label };
}

export interface PlainTurn {
  role: "system" | "user" | "assistant";
  content: string;
}

/** One plain chat completion on exactly that provider, key and model — no failover, no Nellovia. */
export async function plainChat(routeLabel: string, model: string, messages: PlainTurn[], maxTokens: number) {
  const { provider, apiKey, keyLabel } = await keyForRoute(routeLabel);
  const started = performance.now();
  const res = await fetch(provider.baseUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, stream: false, ...providerRequestOptions(provider.id, model, maxTokens, "low"), messages }),
  });
  const ms = Math.round(performance.now() - started);
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200).split(apiKey).join("[key]")}`);
  const data = JSON.parse(text) as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } };
  return {
    text: data.choices?.[0]?.message?.content ?? "",
    ms,
    keyLabel,
    usage: {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      totalTokens: data.usage?.total_tokens ?? 0,
    },
  };
}
