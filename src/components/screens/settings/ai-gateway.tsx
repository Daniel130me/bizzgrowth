"use client";
// Settings — AI Gateway: live view of the multi-provider failover chain.
// Administrators can add encrypted database-backed keys from the platform
// console; environment keys remain supported for deployment compatibility.

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  ListOrdered,
  PlayCircle,
  RefreshCw,
  XCircle,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, SectionCard } from "@/components/shared/layout";
import type { GatewaySnapshot } from "@/lib/ai-gateway";

interface TestAttempt {
  routeLabel: string;
  model: string;
  ok: boolean;
  latencyMs: number;
  error?: string;
}

interface TestResult {
  ok: boolean;
  servedBy?: string;
  model?: string;
  latencyMs?: number;
  totalLatencyMs?: number;
  reply?: string;
  attempts: TestAttempt[];
  error?: string;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function statusBadge(snapshot: GatewaySnapshot, configured: boolean) {
  if (snapshot.disabled) return <Badge className="bg-red-100 text-[10px] font-medium text-red-700">Disabled</Badge>;
  if (!configured) return <Badge variant="outline" className="text-[10px] font-normal text-slate-500">Not configured</Badge>;
  return <Badge className="bg-emerald-100 text-[10px] font-medium text-emerald-700">In chain</Badge>;
}

export function AiGatewaySettings() {
  const [snapshot, setSnapshot] = useState<GatewaySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<TestResult | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/ai-gateway", { cache: "no-store" });
      const data = (await res.json()) as { ok?: boolean; snapshot?: GatewaySnapshot };
      if (data?.ok && data.snapshot) setSnapshot(data.snapshot);
      else throw new Error("bad status response");
    } catch {
      toast.error("Couldn't load gateway status", { description: "Is the server running? Try again in a moment." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function runTest() {
    setTesting(true);
    setTest(null);
    try {
      const res = await fetch("/api/ai-gateway", { method: "POST" });
      const data = (await res.json()) as TestResult & { ok?: boolean };
      setTest(data);
      if (data.ok) {
        toast.success(`Answered by ${data.servedBy}`, { description: `${data.model} · ${data.latencyMs}ms` });
      } else {
        toast.error("No provider could serve the request", { description: data.error });
      }
      void load(); // refresh health counters
    } catch {
      toast.error("Test request failed", { description: "The status endpoint itself is unreachable." });
    } finally {
      setTesting(false);
    }
  }

  const activeRoutes = snapshot?.routes.filter((r) => r.status === "active") ?? [];
  const extraConfigured = snapshot?.providers.filter((p) => p.kind !== "platform" && p.configured) ?? [];

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="AI gateway"
        description="How Nellovia's AI stays online. Every completion goes through a failover chain: if a provider or key fails, the next one takes up the request automatically."
        back={null}
      />

      {/* Live test */}
      <SectionCard
        title="Live test"
        description="Sends a tiny probe through the chain and shows exactly which route answered — or how each one failed."
        action={
          <Button size="sm" onClick={runTest} disabled={testing || (snapshot?.disabled ?? false)}>
            {testing ? <RefreshCw className="mr-1.5 size-4 animate-spin" aria-hidden /> : <PlayCircle className="mr-1.5 size-4" aria-hidden />}
            {testing ? "Probing…" : "Test the chain now"}
          </Button>
        }
      >
        {test ? (
          <div className="space-y-3">
            <div
              className={`flex items-start gap-2.5 rounded-xl border p-3.5 ${
                test.ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
              }`}
              role="status"
            >
              {test.ok ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
              ) : (
                <XCircle className="mt-0.5 size-4 shrink-0 text-red-600" aria-hidden />
              )}
              <div className="text-sm">
                {test.ok ? (
                  <>
                    <p className="font-medium text-emerald-900">
                      Served by {test.servedBy} <span className="font-normal text-emerald-700">({test.model})</span>
                    </p>
                    <p className="mt-0.5 text-xs text-emerald-800">
                      {test.latencyMs}ms · reply: &ldquo;{test.reply}&rdquo;
                    </p>
                  </>
                ) : (
                  <p className="font-medium text-red-900">{test.error ?? "All routes failed."}</p>
                )}
              </div>
            </div>
            {test.attempts.length > 0 ? (
              <ul className="space-y-1.5" aria-label="Attempt detail">
                {test.attempts.map((a, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg border bg-white px-3 py-2 text-xs">
                    {a.ok ? (
                      <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" aria-hidden />
                    ) : (
                      <XCircle className="size-3.5 shrink-0 text-red-400" aria-hidden />
                    )}
                    <span className="font-medium">{a.routeLabel}</span>
                    <span className="text-muted-foreground">{a.model}</span>
                    <span className="ml-auto tnum text-muted-foreground">{a.latencyMs}ms</span>
                    {a.error ? (
                      <span className="w-full truncate text-red-500" title={a.error}>
                        {a.error}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {snapshot?.disabled
              ? "The gateway is disabled via the BIZZ_AI_DISABLED ops switch — features use their honest offline states."
              : "Run a test to see the chain in action. Failures are expected and harmless here — that is what the chain is for: the next route takes over."}
          </p>
        )}
      </SectionCard>

      {/* Chain overview */}
      <SectionCard
        title="Failover chain"
        description={
          snapshot
            ? `Priority order: ${snapshot.orderLabel} · per-attempt timeout ${Math.round(snapshot.timeoutMs / 1000)}s`
            : "Loading…"
        }
        action={<ListOrdered className="size-4 text-slate-400" aria-hidden />}
        contentClassName="p-0"
      >
        <ul className="divide-y">
          {(snapshot?.providers ?? []).map((p, i) => {
            const providerRoutes = snapshot?.routes.filter((r) => r.provider === p.id) ?? [];
            const cooling = providerRoutes.some((r) => r.status === "cooling-down");
            return (
              <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded bg-slate-100 text-[10px] font-bold text-slate-500 tnum">
                      {i + 1}
                    </span>
                    {p.label}
                    {!p.enabled ? (
                      <Badge className="bg-slate-200 text-[10px] font-medium text-slate-700">Disabled by administrator</Badge>
                    ) : statusBadge(snapshot!, p.configured)}
                    {cooling ? (
                      <Badge className="bg-amber-100 text-[10px] font-medium text-amber-700">
                        <AlertTriangle className="mr-1 size-3" aria-hidden /> cooling down
                      </Badge>
                    ) : null}
                  </p>
                  <p className="mt-0.5 pl-7 text-xs leading-relaxed text-muted-foreground">
                    {p.kind === "platform"
                      ? `${p.model} · ${p.note}`
                      : `Model: ${p.model} · ${p.configured ? `${p.keyCount} key${p.keyCount > 1 ? "s" : ""}` : "no key set"} · set via ${p.envKeys}${p.envModel ? ` / ${p.envModel}` : ""}`}
                  </p>
                  {(p.keys ?? []).length > 0 ? (
                    <ul className="mt-2 space-y-1.5 pl-7" aria-label={`${p.label} keys`}>
                      {[...(p.keys ?? []), ...(p.retiredKeys ?? [])].map((k) => (
                        <li key={k.id} className="rounded-lg border bg-white px-3 py-2 text-xs">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <KeyRound className="size-3 shrink-0 text-slate-400" aria-hidden />
                            <span className="font-medium">{k.label}</span>
                            <code className="rounded bg-slate-100 px-1 text-[10px] text-slate-600">{k.masked}</code>
                            {!k.configured ? (
                              <Badge variant="outline" className="text-[10px] font-normal text-slate-500">removed</Badge>
                            ) : k.status === "cooling-down" ? (
                              <Badge className="bg-amber-100 text-[10px] font-medium text-amber-700">
                                cooling{k.cooldownUntil ? ` until ${formatTime(k.cooldownUntil)}` : ""}
                              </Badge>
                            ) : null}
                            <span className="ml-auto tnum text-muted-foreground">
                              {k.requests} req · {k.successes} ok · {k.failures} failed · {k.rateLimitHits} 429
                              {k.totalTokens > 0 ? ` · ${k.totalTokens.toLocaleString()} tok` : ""}
                              {k.lastUsedAt ? ` · last ${formatTime(k.lastUsedAt)}` : ""}
                            </span>
                          </div>
                          {k.lastError ? (
                            <p className="mt-0.5 truncate text-red-500" title={k.lastError}>
                              {k.lastError}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                {p.configured && providerRoutes.length > 0 ? (
                  <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                    <span className="tnum" title="Successful completions">
                      {providerRoutes.reduce((n, r) => n + r.successes, 0)} ok
                    </span>
                    <span className="tnum" title="Failed attempts">
                      {providerRoutes.reduce((n, r) => n + r.failures, 0)} failed
                    </span>
                    {providerRoutes.some((r) => r.lastLatencyMs) ? (
                      <span className="tnum" title="Last attempt latency">
                        {Math.min(...providerRoutes.filter((r) => r.lastLatencyMs).map((r) => r.lastLatencyMs!))}ms
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </SectionCard>

      {/* Configuration guidance */}
      <SectionCard
        title="Managing provider keys"
        description="Platform administrators can add encrypted keys and disable providers from Platform administration → AI providers."
        action={<KeyRound className="size-4 text-slate-400" aria-hidden />}
      >
        <div className="space-y-2.5 text-sm leading-relaxed text-muted-foreground">
          <p>
            Environment keys remain supported as a deployment fallback. Add them to{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-800">.env.local</code>, then restart
            the production server or let the development server reload:
          </p>
          <pre className="overflow-x-auto rounded-xl bg-slate-900 p-4 text-xs leading-relaxed text-slate-100" aria-label="Environment variable example">
{`OPENAI_API_KEY=sk-...            # or several: sk-1,sk-2
OPENAI_MODEL=gpt-4o-mini
GROQ_API_KEY=gsk_...
GROQ_API_KEY_2=ada:gsk_...       # numbered + optional "label:" prefix
GROQ_API_KEYS=gsk_...,gsk_...    # plural var also works
GROQ_MODEL=llama-3.3-70b-versatile
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=google/gemini-2.0-flash-001
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.0-flash
# Optional priority order (default: z.ai first):
AI_GATEWAY_ORDER=z.ai,openai,groq,openrouter,gemini`}
          </pre>
          <p>
            Several keys per provider are rotated least-recently-used first to spread load. A rate-limited key cools
            down on its own and the next key of the same provider takes over; invalid keys are parked for hours.
            Providers without a key are skipped. Each key is shown above by its label and last 4 characters only.
          </p>
          {extraConfigured.length === 0 ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800">
              Only the platform provider is active right now — there is no failover target yet. Add at least one key
              above to enable it.
            </p>
          ) : (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">
              {extraConfigured.length} extra provider{extraConfigured.length > 1 ? "s" : ""} configured
              ({extraConfigured.map((p) => p.label).join(", ")}) — failover is live.
            </p>
          )}
        </div>
      </SectionCard>

      {/* Recent activity */}
      <SectionCard
        title="Recent activity"
        description={`Last gateway events on this server${snapshot?.lastServedBy ? ` · last answer served by ${snapshot.lastServedBy}` : ""}.`}
        action={<Activity className="size-4 text-slate-400" aria-hidden />}
        contentClassName="p-0"
      >
        <div className="max-h-96 overflow-y-auto">
          {(snapshot?.events ?? []).length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">
              No completions have been attempted yet since the server started. Ask a question or run the live test.
            </p>
          ) : (
            <ul className="divide-y">
              {snapshot!.events.map((e, i) => (
                <li key={i} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-5 py-2.5 text-xs">
                  <span className="tnum text-muted-foreground">{formatTime(e.ts)}</span>
                  {e.ok ? (
                    <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600" aria-hidden />
                  ) : (
                    <XCircle className="size-3.5 shrink-0 text-red-400" aria-hidden />
                  )}
                  <span className="font-medium">{e.routeLabel}</span>
                  <span className="text-muted-foreground">{e.model}</span>
                  {e.ok ? (
                    <span className="ml-auto tnum text-muted-foreground">{e.latencyMs}ms</span>
                  ) : (
                    <span className="ml-auto max-w-[50%] truncate text-red-500" title={e.error}>
                      {e.error}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </SectionCard>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {snapshot?.usageFile
            ? `Per-key usage is saved to ${snapshot.usageFile} and survives restarts; recent events reset on restart.`
            : "Gateway state (health counters and events) is per server process and resets on restart."}
        </p>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-1.5 size-4 ${loading ? "animate-spin" : ""}`} aria-hidden /> Refresh status
        </Button>
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Zap className="size-3.5 text-brand-600" aria-hidden />
        Every AI surface — consultation, diagnosis, Ask, insights, briefs — routes through this chain automatically.
        {activeRoutes.length > 1 ? ` ${activeRoutes.length} routes are standing by.` : ""}
      </p>
    </div>
  );
}
