// Calls the app's real routes on the local dev server, as the signed-in test
// owner, and records every call: the request, the response, the time taken
// and — from the gateway trace — which provider and model answered and the
// tokens it used. Keys never appear anywhere: the trace holds labels only.

import { appendFileSync, closeSync, existsSync, openSync, readFileSync, readSync, statSync } from "node:fs";
import { readJson, writeJson, type RunContext } from "./context";

export interface GatewayCall {
  profile: string;
  maxTokens: number;
  servedBy: string | null;
  model: string | null;
  latencyMs: number | null;
  totalMs: number;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number } | null;
  attempts: { routeLabel: string; model: string; ok: boolean; latencyMs: number; error?: string }[];
  /** Start of the system prompt — tells which prompt it was. */
  systemHead: string;
  replyChars: number;
}

export interface CallRecord {
  seq: number;
  at: string;
  run: string;
  feature: string;
  method: string;
  route: string;
  status: number;
  ms: number;
  request: unknown;
  response: unknown;
  gateway: GatewayCall[];
  tokens: { prompt: number; completion: number; total: number };
}

interface Session {
  cookie: string | null;
}

function sessionCookie(ctx: RunContext): string | null {
  return readJson<Session>(ctx.sessionPath, { cookie: null }).cookie;
}

function rememberCookie(ctx: RunContext, res: Response): void {
  const all = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  const mine = all.find((c) => c.startsWith("bizz_session="));
  if (!mine) return;
  const value = mine.split(";")[0];
  writeJson(ctx.sessionPath, { cookie: value.endsWith("=") ? null : value });
}

function traceSize(file: string): number {
  try {
    return statSync(file).size;
  } catch {
    return 0;
  }
}

/** Gateway trace lines written since `offset` (the server writes them before it answers). */
function traceSince(file: string, offset: number): Record<string, unknown>[] {
  if (!existsSync(file)) return [];
  const size = traceSize(file);
  if (size <= offset) return [];
  const fd = openSync(file, "r");
  try {
    const buf = Buffer.alloc(size - offset);
    readSync(fd, buf, 0, buf.length, offset);
    return buf
      .toString("utf8")
      .split("\n")
      .filter((l) => l.trim())
      .map((l) => {
        try {
          return JSON.parse(l) as Record<string, unknown>;
        } catch {
          return null;
        }
      })
      .filter((x): x is Record<string, unknown> => x !== null);
  } finally {
    closeSync(fd);
  }
}

function summarise(t: Record<string, unknown>): GatewayCall {
  const attempts = Array.isArray(t.attempts) ? (t.attempts as GatewayCall["attempts"]) : [];
  return {
    profile: String(t.profile ?? "default"),
    maxTokens: Number(t.maxTokens ?? 0),
    servedBy: (t.servedBy as string | null) ?? null,
    model: (t.model as string | null) ?? null,
    latencyMs: (t.latencyMs as number | null) ?? null,
    totalMs: Number(t.totalMs ?? 0),
    usage: (t.usage as GatewayCall["usage"]) ?? null,
    attempts: attempts.map((a) => ({ routeLabel: a.routeLabel, model: a.model, ok: a.ok, latencyMs: a.latencyMs, ...(a.error ? { error: a.error } : {}) })),
    systemHead: String(t.system ?? "").slice(0, 90),
    replyChars: typeof t.text === "string" ? t.text.length : 0,
  };
}

function nextSeq(ctx: RunContext): number {
  if (!existsSync(ctx.callsPath)) return 1;
  try {
    return readFileSync(ctx.callsPath, "utf8").split("\n").filter((l) => l.trim()).length + 1;
  } catch {
    return 1;
  }
}

export interface ApiResult<T = Record<string, unknown>> {
  status: number;
  json: T;
  ms: number;
  gateway: GatewayCall[];
  record: CallRecord;
}

/** One real route call, recorded. `record: false` for calls that are not part of the test (sign-up, session checks). */
export async function apiCall<T = Record<string, unknown>>(
  ctx: RunContext,
  feature: string,
  route: string,
  body?: unknown,
  opts: { method?: "GET" | "POST"; record?: boolean; anonymous?: boolean } = {},
): Promise<ApiResult<T>> {
  const method = opts.method ?? (body === undefined ? "GET" : "POST");
  const cookie = opts.anonymous ? null : sessionCookie(ctx);
  const offset = traceSize(ctx.tracePath);
  const started = performance.now();
  const res = await fetch(`${ctx.baseUrl}${route}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: ctx.baseUrl,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  rememberCookie(ctx, res);
  const text = await res.text();
  const ms = Math.round(performance.now() - started);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = { nonJson: text.slice(0, 500) };
  }
  const gateway = traceSince(ctx.tracePath, offset).map(summarise);
  const tokens = gateway.reduce(
    (acc, g) => {
      // Every attempt's tokens are spent, including ones that failed (e.g. a reply that came back empty).
      acc.prompt += g.usage?.promptTokens ?? 0;
      acc.completion += g.usage?.completionTokens ?? 0;
      acc.total += g.usage?.totalTokens ?? 0;
      return acc;
    },
    { prompt: 0, completion: 0, total: 0 },
  );
  const record: CallRecord = {
    seq: nextSeq(ctx),
    at: new Date().toISOString(),
    run: ctx.run,
    feature,
    method,
    route,
    status: res.status,
    ms,
    request: body ?? null,
    response: json,
    gateway,
    tokens,
  };
  if (opts.record !== false) appendFileSync(ctx.callsPath, `${JSON.stringify(record)}\n`);
  return { status: res.status, json: json as T, ms, gateway, record };
}

/** One line for the operator: who answered, how long, how many tokens. */
export function callLine(r: ApiResult): string {
  const g = r.gateway;
  if (!g.length) return `[${r.status}] ${r.ms} ms · no AI call (deterministic or offline path)`;
  const served = g.map((x) => `${x.servedBy ?? "NONE"} ${x.model ?? ""}`.trim()).join(" → ");
  const failed = g.flatMap((x) => x.attempts.filter((a) => !a.ok)).length;
  return `[${r.status}] ${r.ms} ms · ${g.length} AI call${g.length > 1 ? "s" : ""} · served by ${served}${failed ? ` · ${failed} failed attempt${failed > 1 ? "s" : ""}` : ""} · ${r.record.tokens.total} tokens`;
}
