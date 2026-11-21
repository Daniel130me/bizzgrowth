"use client";
// Screen 107 — Business Admin Detail: workspace, sources, coverage, AI output, support and admin actions.

import { useMemo } from "react";
import { Building2, CircleAlert, Database, Eye, PlugZap, RefreshCw, RotateCcw, Sparkles } from "lucide-react";
import { AdminActionButton, AdminBackLink, AdminActionTag, AdminBadge, MiniProgress, NotFoundLite } from "./parts";
import { KeyValue, PageHeader, SectionCard } from "@/components/shared/layout";
import { EmptyState } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/badges";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ADMIN_BUSINESSES, AI_AUDIT, SUPPORT_TICKETS, SYNC_HEALTH } from "@/lib/data/admin";
import { recommendationsFor } from "@/lib/data/intelligence";
import { useBizz } from "@/lib/store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ScreenProps } from "../view-types";

// Plausible per-workspace source lists (counts match ADMIN_BUSINESSES.sources).
const SOURCES: Record<string, { name: string; status: "healthy" | "delayed" | "failed" | "manual"; note?: string }[]> = {
  swifthaul: [
    { name: "Meta Ads", status: "healthy" },
    { name: "Google Ads", status: "healthy" },
    { name: "Manual entry", status: "manual", note: "Monthly totals, verified by owner" },
  ],
  korahome: [
    { name: "Shopify", status: "failed", note: "Authorization expired — reconnect required" },
    { name: "Paystack (via Shopify)", status: "delayed", note: "Paused upstream until Shopify recovers" },
  ],
  "lagos-smile": [{ name: "Manual entry", status: "manual", note: "Enquiry trend only" }],
  "naija-threads": [
    { name: "Shopify", status: "healthy" },
    { name: "Meta Ads", status: "healthy" },
    { name: "Google Analytics", status: "healthy" },
    { name: "Paystack", status: "healthy" },
  ],
  brightpath: [],
  greenleaf: [
    { name: "Shopify", status: "delayed", note: "Rate limited — retrying with backoff" },
    { name: "Google Analytics", status: "healthy" },
    { name: "Manual entry", status: "manual", note: "Monthly revenue totals" },
  ],
  "zenith-fit": [{ name: "Google Ads", status: "failed", note: "Workspace suspended — connection revoked" }],
  "kola-interiors": [{ name: "Google Analytics", status: "healthy" }],
};

// Coverage breakdown rows per business type (deterministic offsets from the workspace coverage).
function coverageBreakdown(coverage: number, type: "service" | "ecommerce") {
  const rows = type === "ecommerce"
    ? [
        { label: "Store & sales data", value: coverage + 20 },
        { label: "Website & funnel", value: coverage + 10 },
        { label: "Marketing spend", value: coverage + 4 },
        { label: "Costs & margins", value: coverage - 14 },
      ]
    : [
        { label: "Marketing spend", value: coverage + 18 },
        { label: "Enquiries & customers", value: coverage + 6 },
        { label: "Lead follow-up", value: coverage - 8 },
        { label: "Costs & margins", value: coverage - 16 },
      ];
  return rows.map((r) => ({ ...r, value: Math.max(0, Math.min(100, r.value)) }));
}

// Recommendation titles per workspace (counts match openRecommendations where synthesized).
const RECOMMENDATION_TITLES: Record<string, string[]> = {
  "naija-threads": [
    "Test a loyalty prompt for second purchases",
    "Review Instagram audience targeting before raising budgets",
    "Track repeat-purchase rate as a workspace goal",
    "Introduce a win-back message for lapsed customers",
  ],
  greenleaf: ["Compress hero images and lazy-load product galleries", "Review mobile product page speed on weekends"],
  "lagos-smile": ["Add channel-level enquiry totals to enable conversion analysis"],
  "kola-interiors": ["Introduce 48-hour quote follow-up rule", "Track quote outcomes per service package"],
  "zenith-fit": ["Reconnect Google Ads and refresh September metrics"],
};

// Synthesized diagnosis history for workspaces without entries in the audit dataset.
const SYNTH_DIAGNOSES: Record<string, { title: string; date: string; confidence: number }[]> = {
  "zenith-fit": [
    { title: "Google Ads was the only acquisition source — no other channel data to compare against.", date: "2026-09-03", confidence: 61 },
    { title: "Class attendance trend flat across August; retention data missing.", date: "2026-08-28", confidence: 55 },
  ],
};

const SOURCE_META: Record<string, { cls: string; label: string }> = {
  healthy: { cls: "text-emerald-700", label: "Syncing normally" },
  delayed: { cls: "text-amber-700", label: "Delayed" },
  failed: { cls: "text-red-700", label: "Failing" },
  manual: { cls: "text-slate-500", label: "Manual — no sync" },
};

export function BusinessAdminDetail({ params }: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);
  const business = ADMIN_BUSINESSES.find((b) => b.id === params.id);

  const diagnoses = useMemo(() => {
    if (!business) return [];
    const audited = AI_AUDIT.filter((a) => a.business === business.name).map((a) => ({ title: a.diagnosis, date: a.date, confidence: a.confidence }));
    return audited.length ? audited : (SYNTH_DIAGNOSES[business.id] ?? []);
  }, [business]);

  const recommendations = useMemo(() => {
    if (!business) return [];
    const core = recommendationsFor(business.id).map((r) => r.title);
    return core.length ? core : (RECOMMENDATION_TITLES[business.id] ?? []);
  }, [business]);

  const tickets = useMemo(() => (business ? SUPPORT_TICKETS.filter((t) => t.business === business.name) : []), [business]);

  if (!business) {
    return (
      <NotFoundLite
        title="Business not found"
        description={`No workspace with id "${params.id}" exists in this prototype. It may have been renamed or removed from the demo dataset.`}
        onBack={() => navigate("admin/businesses")}
        backLabel="Back to businesses"
      />
    );
  }

  const syncRows = SYNC_HEALTH.filter((s) => s.business === business.name);
  const failing = syncRows.filter((s) => s.status === "failed").length;
  const sources = SOURCES[business.id] ?? [];

  const act = (what: string, detail: string) =>
    toast(`Simulated: ${what}`, { description: detail });

  return (
    <div>
      <AdminBackLink label="Back to businesses" onClick={() => navigate("admin/businesses")} />
      <PageHeader
        title={business.name}
        badge={<AdminBadge status={business.status} />}
        description={`Workspace id ${business.id} · ${business.type === "service" ? "Service business" : "Ecommerce store"} · last active ${business.lastActive}.`}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Workspace" description="Account and ownership details.">
          <div className="space-y-3">
            <KeyValue label="Workspace">{business.name}</KeyValue>
            <KeyValue label="Owner">{business.owner}</KeyValue>
            <KeyValue label="Plan">{business.plan}</KeyValue>
            <KeyValue label="Status">
              <AdminBadge status={business.status} />
            </KeyValue>
            <KeyValue label="Team size">{business.teamSize} members</KeyValue>
            <KeyValue label="Support cases">{business.supportCases} on file</KeyValue>
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard
            title="Data sources"
            description={`${sources.length} connected source${sources.length === 1 ? "" : "s"}.`}
            action={
              <button
                onClick={() => navigate("admin/sync-health")}
                className="text-xs font-medium text-brand-600 underline-offset-2 hover:underline"
              >
                View sync health
              </button>
            }
          >
            {sources.length === 0 ? (
              <EmptyState
                icon={<Database className="size-5" />}
                title="No sources connected"
                description="This workspace has not connected any data source yet. Coverage comes from onboarding answers only."
              />
            ) : (
              <ul className="divide-y rounded-lg border">
                {sources.map((s) => {
                  const meta = SOURCE_META[s.status];
                  return (
                    <li key={s.name} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{s.name}</p>
                        {s.note ? <p className="truncate text-xs text-muted-foreground">{s.note}</p> : null}
                      </div>
                      <span className={cn("shrink-0 text-xs font-medium", meta.cls)}>{meta.label}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="Sync health & coverage"
            description="Connection posture and how much of the picture the platform can see."
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sync health</span>
              <AdminBadge status={business.syncHealth === "healthy" ? "healthy" : business.syncHealth === "delayed" ? "delayed" : "failed"} />
              {failing > 0 ? (
                <span className="inline-flex items-center gap-1 text-xs text-red-700">
                  <CircleAlert className="size-3.5" aria-hidden /> {failing} failing connection{failing > 1 ? "s" : ""}
                </span>
              ) : null}
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <p className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Overall data coverage</span>
                  <span className="font-medium tabular-nums text-slate-700">{business.coverage}%</span>
                </p>
                <MiniProgress value={business.coverage} barClassName={business.coverage >= 60 ? "bg-emerald-500" : business.coverage >= 30 ? "bg-brand-600" : "bg-amber-500"} className="[&>span]:hidden" />
              </div>
              {coverageBreakdown(business.coverage, business.type).map((row) => (
                <div key={row.label}>
                  <p className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{row.label}</span>
                    <span className="tabular-nums">{row.value}%</span>
                  </p>
                  <MiniProgress value={row.value} className="[&>span]:hidden" />
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Recent diagnoses"
          description="Latest AI diagnoses generated for this workspace."
          action={
            <button onClick={() => navigate("admin/ai-audit")} className="text-xs font-medium text-brand-600 underline-offset-2 hover:underline">
              Open AI audit
            </button>
          }
        >
          {diagnoses.length === 0 ? (
            <EmptyState
              icon={<Sparkles className="size-5" />}
              title="No diagnoses generated yet"
              description={`Data coverage is ${business.coverage}%, below the diagnosis threshold. Connecting a source or entering monthly totals will unlock the first diagnosis.`}
            />
          ) : (
            <ul className="space-y-3">
              {diagnoses.map((d, i) => (
                <li key={i} className="rounded-lg border bg-slate-50/60 p-3">
                  <p className="text-sm leading-snug">{d.title}</p>
                  <p className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="tabular-nums">{d.date}</span>
                    <span aria-hidden>·</span>
                    <span className="tabular-nums">{d.confidence}% confidence</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Recommendations"
          description={`${business.openRecommendations} open for this workspace.`}
        >
          {recommendations.length === 0 ? (
            <EmptyState
              title="No open recommendations"
              description="Recommendations appear after a diagnosis identifies a clear opportunity or problem to act on."
            />
          ) : (
            <ul className="space-y-2">
              {recommendations.map((r, i) => (
                <li key={i} className="flex items-start gap-2.5 rounded-lg border bg-white p-3">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                    <Sparkles className="size-3" aria-hidden />
                  </span>
                  <p className="text-sm leading-snug">{r}</p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Support history"
        description="Cases opened by this workspace."
        className="mt-6"
        contentClassName={tickets.length ? "p-0" : undefined}
      >
        {tickets.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<Building2 className="size-5" />}
              title="No support cases on file"
              description="Nothing has been submitted by this workspace. New cases appear in the support inbox as they arrive."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-36">Type</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead className="w-32">Status</TableHead>
                  <TableHead className="w-36">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((t) => (
                  <TableRow key={t.id} className="hover:bg-slate-50/60">
                    <TableCell>
                      <AdminBadge status={t.type} />
                    </TableCell>
                    <TableCell className="max-w-md">
                      <p className="truncate text-sm">{t.summary}</p>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={t.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">{t.created}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Troubleshooting"
        description="Operator-only interventions. Every action is simulated in this prototype and affects demo data only."
        className="mt-6 border-amber-200"
        action={<AdminActionTag />}
      >
        <ul className="grid gap-3 sm:grid-cols-2">
          <li className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50/40 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Force re-sync</p>
              <p className="text-xs text-muted-foreground">Re-queue all connections immediately.</p>
            </div>
            <AdminActionButton
              label="Run"
              icon={<RefreshCw className="size-3.5" aria-hidden />}
              onClick={() => act("force re-sync queued", `All ${sources.length || "available"} sources for ${business.name} would re-sync within a minute.`)}
            />
          </li>
          <li className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50/40 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Reset connection</p>
              <p className="text-xs text-muted-foreground">Invalidate tokens and ask the owner to reconnect.</p>
            </div>
            <AdminActionButton
              label="Reset"
              icon={<RotateCcw className="size-3.5" aria-hidden />}
              onClick={() => act("connection reset", `${business.owner} would receive reconnect instructions by email.`)}
            />
          </li>
          <li className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50/40 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Regenerate diagnosis</p>
              <p className="text-xs text-muted-foreground">Re-run AI analysis on current data.</p>
            </div>
            <AdminActionButton
              label="Regenerate"
              icon={<Sparkles className="size-3.5" aria-hidden />}
              onClick={() => act("diagnosis regeneration queued", "The next diagnosis run would replace the current diagnosis for this workspace.")}
            />
          </li>
          <li className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50/40 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Impersonate view (read-only)</p>
              <p className="text-xs text-muted-foreground">See the workspace exactly as the owner does.</p>
            </div>
            <AdminActionButton
              label="Open view"
              icon={<Eye className="size-3.5" aria-hidden />}
              onClick={() => act("impersonated read-only view", `Admin session would open ${business.name} with all actions disabled. Nothing is written.`)}
            />
          </li>
        </ul>
        <p className="mt-4 flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-xs text-muted-foreground">
          <PlugZap className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Impersonation is read-only and logged in the system event log. Connection resets always notify the workspace owner.
        </p>
      </SectionCard>
    </div>
  );
}
