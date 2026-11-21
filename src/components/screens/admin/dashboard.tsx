"use client";
// Screen 105 — Admin Dashboard: platform-level metrics, recent system events, quick links.

import { Activity, ArrowUpRight, Building2, CreditCard, Database, FileWarning, LifeBuoy, PlugZap, Sparkles, Users } from "lucide-react";
import { AdminActionButton, AdminBadge } from "./parts";
import { InfoBanner, PageHeader, SectionCard } from "@/components/shared/layout";
import { ADMIN_SYSTEM_EVENTS } from "@/lib/data/admin";
import { useBizz } from "@/lib/store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ScreenProps } from "../view-types";

const EVENT_DOT: Record<string, string> = {
  info: "bg-brand-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
};

const EVENT_LABEL: Record<string, string> = {
  info: "Info",
  warning: "Warning",
  error: "Error",
};

const EVENT_CLS: Record<string, string> = {
  info: "border-brand-200 bg-brand-50 text-brand-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  error: "border-red-200 bg-red-50 text-red-700",
};

const QUICK_LINKS = [
  { id: "admin/businesses", label: "Businesses", icon: Building2, description: "8 workspaces · 2 on trial" },
  { id: "admin/users", label: "Users", icon: Users, description: "12 accounts · 1 invitation pending" },
  { id: "admin/subscriptions", label: "Subscriptions", icon: CreditCard, description: "MRR ₦210,000 · 1 past due" },
  { id: "admin/sync-health", label: "Sync health", icon: PlugZap, description: "2 failing connections" },
  { id: "admin/jobs", label: "Jobs & imports", icon: Database, description: "1 running · 2 failed" },
  { id: "admin/ai-audit", label: "AI audit", icon: Sparkles, description: "2 diagnoses pending review" },
  { id: "admin/support", label: "Support inbox", icon: LifeBuoy, description: "4 cases not yet resolved" },
];

function TrendNote({ dir, text, tone = "neutral" }: { dir: "up" | "down" | "flat"; text: string; tone?: "good" | "bad" | "neutral" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium",
        tone === "good" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : tone === "bad" ? "border-red-200 bg-red-50 text-red-700" : "border-slate-200 bg-slate-50 text-slate-600"
      )}
    >
      <ArrowUpRight className={cn("size-3", dir === "down" && "rotate-90", dir === "flat" && "rotate-45")} aria-hidden />
      {text}
    </span>
  );
}

export function AdminDashboard(_props: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);

  return (
    <div>
      <PageHeader
        title="Admin dashboard"
        description="Platform-wide state of the Nellovia MVP: workspaces, data connections, AI output quality and support load."
      />

      <div className="mb-6">
        <InfoBanner tone="warning" title="Internal administration">
          Actions here affect the prototype demo data only. Customer workspaces are never modified by admin tooling in this build.
        </InfoBanner>
      </div>

      {/* Platform metrics */}
      <section aria-label="Platform metrics" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricTileWrap label="Businesses" value={8} onClick={() => navigate("admin/businesses")} subnote={<TrendNote dir="up" text="+2 this month" />} />
        <MetricTileWrap label="Active users" value={12} onClick={() => navigate("admin/users")} subnote={<TrendNote dir="up" text="+3 this month" />} />
        <MetricTileWrap label="Connected sources" value={15} onClick={() => navigate("admin/sync-health")} subnote={<TrendNote dir="up" text="+4 this month" />} />
        <MetricTileWrap label="Diagnoses generated" value={21} onClick={() => navigate("admin/ai-audit")} subnote={<TrendNote dir="up" text="+6 this week" />} />
        <MetricTileWrap label="Recommendations generated" value={24} onClick={() => navigate("admin/ai-audit")} subnote={<TrendNote dir="up" text="+7 this week" />} />
        <MetricTileWrap label="Connection failures" value={2} tone="risk" onClick={() => navigate("admin/sync-health")} subnote={<TrendNote dir="up" text="1 needs reconnect" tone="bad" />} />
        <MetricTileWrap label="Import failures" value={1} tone="warn" onClick={() => navigate("admin/jobs")} subnote={<TrendNote dir="flat" text="Validation errors" />} />
        <MetricTileWrap label="Support cases" value={3} tone="warn" onClick={() => navigate("admin/support")} subnote={<TrendNote dir="flat" text="1 high priority" tone="bad" />} />
      </section>

      {/* Recent system events + quick links */}
      <div className="mt-6 grid gap-6 lg:grid-cols-5">
        <SectionCard
          title="Recent system events"
          description="Latest platform activity across all workspaces."
          className="lg:col-span-3"
          contentClassName="p-0"
          action={
            <AdminActionButton
              label="Export log"
              icon={<FileWarning className="mr-1.5 size-3.5" aria-hidden />}
              onClick={() => toast("Simulated: system event log exported", { description: "A CSV of the last 30 days would download in a live environment." })}
            />
          }
        >
          <ul className="divide-y">
            {ADMIN_SYSTEM_EVENTS.map((e, i) => (
              <li key={i} className="flex items-start gap-3 px-5 py-3">
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", EVENT_DOT[e.level] ?? "bg-slate-300")} aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm leading-snug">{e.event}</p>
                  <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="tabular-nums">{e.time}</span>
                    <span aria-hidden>·</span>
                    <span className={cn("rounded-md border px-1.5 py-0.5 text-[10px] font-medium", EVENT_CLS[e.level] ?? "border-slate-200 bg-slate-50 text-slate-600")}>
                      {EVENT_LABEL[e.level] ?? "Event"}
                    </span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="Quick links" description="Jump to an admin area." className="lg:col-span-2" contentClassName="p-3">
          <div className="grid gap-2">
            {QUICK_LINKS.map((q) => {
              const Icon = q.icon;
              return (
                <button
                  key={q.id}
                  onClick={() => navigate(q.id)}
                  className="flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:border-slate-200 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{q.label}</span>
                    <span className="block truncate text-xs text-muted-foreground">{q.description}</span>
                  </span>
                  <ArrowUpRight className="size-4 shrink-0 text-slate-400" aria-hidden />
                </button>
              );
            })}
          </div>
        </SectionCard>
      </div>

      {/* Platform activity snapshot */}
      <SectionCard
        title="Platform activity snapshot"
        description="Operational posture of the MVP right now."
        className="mt-6"
        action={
          <AdminActionButton
            label="Run health check"
            icon={<Activity className="mr-1.5 size-3.5" aria-hidden />}
            onClick={() => toast("Simulated: platform health check queued", { description: "Checks sync workers, job runners and AI generation across all workspaces." })}
          />
        }
      >
        <ul className="grid gap-3 text-sm sm:grid-cols-2">
          <li className="flex items-center justify-between gap-2 rounded-lg border bg-slate-50/60 px-3 py-2.5">
            <span className="text-muted-foreground">Ingestion pipeline</span>
            <AdminBadge status="healthy" />
          </li>
          <li className="flex items-center justify-between gap-2 rounded-lg border bg-slate-50/60 px-3 py-2.5">
            <span className="text-muted-foreground">Diagnosis engine</span>
            <AdminBadge status="healthy" />
          </li>
          <li className="flex items-center justify-between gap-2 rounded-lg border bg-slate-50/60 px-3 py-2.5">
            <span className="text-muted-foreground">Background job runners</span>
            <AdminBadge status="healthy" />
          </li>
          <li className="flex items-center justify-between gap-2 rounded-lg border bg-slate-50/60 px-3 py-2.5">
            <span className="text-muted-foreground">Customer connections</span>
            <AdminBadge status="delayed" />
          </li>
        </ul>
      </SectionCard>
    </div>
  );
}

/** Local wrapper so MetricTile subnotes can sit under the value with consistent rhythm. */
function MetricTileWrap({ label, value, subnote, tone, onClick }: { label: string; value: number; subnote: React.ReactNode; tone?: "neutral" | "warn" | "risk"; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: ${value}. Open detail.`}
      className={cn(
        "flex w-full flex-col rounded-xl border bg-white p-4 text-left shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
      )}
    >
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span
        className={cn(
          "mt-1 text-2xl font-bold tabular-nums tracking-tight",
          tone === "risk" ? "text-red-600" : tone === "warn" ? "text-amber-600" : "text-slate-900"
        )}
      >
        {value}
      </span>
      <span className="mt-1.5">{subnote}</span>
    </button>
  );
}
