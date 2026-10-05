"use client";
// Screen 50 — Data Coverage Overview (signature screen).

import {
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  Database,
  FileSpreadsheet,
  PenLine,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/shared/layout";
import { useBizz } from "@/lib/store";
import { getBusiness } from "@/lib/data/businesses";
import { DATA_QUALITY, provenanceFor } from "@/lib/data/operations";
import { cn } from "@/lib/utils";
import type { ViewMap } from "../view-types";

function coverageBarClass(coverage: number): string {
  if (coverage >= 70) return "[&>div]:bg-emerald-500";
  if (coverage > 0) return "[&>div]:bg-amber-500";
  return "[&>div]:bg-slate-300";
}

function coverageSummary(overall: number): string {
  if (overall >= 70)
    return `${overall}% of the information needed for confident diagnosis is available. Diagnosis confidence is high across most areas.`;
  if (overall >= 55)
    return `${overall}% of the information needed for confident diagnosis is available — enough for directional answers, not for certainty.`;
  return `${overall}% of the information needed for confident diagnosis is available. Connecting sources or entering totals will improve this.`;
}

function DataCoverageScreen() {
  const businessId = useBizz((s) => s.businessId);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const connections = useBizz((s) => s.connections);
  const navigate = useBizz((s) => s.navigate);
  const business = getBusiness(businessId, userWorkspace);

  const connectedSources = Object.values(connections).filter((s) => s === "connected").length;
  const openIssues = DATA_QUALITY.filter((d) => d.businessId === businessId).length;
  const facts = provenanceFor(businessId).length;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title="Data Centre"
        description="What the system knows about your business, where each fact comes from, and what connecting or entering data would unlock."
      />

      {/* Overall coverage */}
      <Card className="p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex items-end gap-3">
              <span className="text-6xl font-bold leading-none tracking-tight tnum">{business.dataCoverage.overall}%</span>
              <span className="pb-1.5 text-sm font-medium text-muted-foreground">overall coverage</span>
            </div>
            <Progress
              value={business.dataCoverage.overall}
              className={cn("mt-4 h-3", coverageBarClass(business.dataCoverage.overall))}
              aria-label={`Overall data coverage ${business.dataCoverage.overall}%`}
            />
            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">{coverageSummary(business.dataCoverage.overall)}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={() => navigate("integrations")}>
                <ShieldCheck className="mr-1.5 size-4" aria-hidden /> Improve coverage
              </Button>
              <Button variant="outline" onClick={() => navigate("manual-entry")}>
                <PenLine className="mr-1.5 size-4" aria-hidden /> Enter totals manually
              </Button>
              <Button variant="outline" onClick={() => navigate("csv-upload")}>
                <FileSpreadsheet className="mr-1.5 size-4" aria-hidden /> Upload CSV
              </Button>
            </div>
          </div>
          <div className="grid w-full shrink-0 grid-cols-3 gap-3 lg:w-72 lg:grid-cols-1">
            <MiniStat label="Connected sources" value={String(connectedSources)} onClick={() => navigate("integrations")} />
            <MiniStat label="Open data issues" value={String(openIssues)} onClick={() => navigate("data-quality")} alert={openIssues > 0} />
            <MiniStat label="Facts with provenance" value={String(facts)} onClick={() => navigate("provenance/all")} />
          </div>
        </div>
      </Card>

      {/* Area cards */}
      <div className="mt-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Coverage by area</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {business.dataCoverage.areas.map((area) => (
            <Card key={area.area} className="flex flex-col p-5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{area.area}</h3>
                <span className="text-sm font-semibold tnum">{area.coverage}%</span>
              </div>
              <Progress value={area.coverage} className={cn("mt-2 h-2", coverageBarClass(area.coverage))} aria-label={`${area.area} coverage ${area.coverage}%`} />
              <div className="mt-4 space-y-3 text-sm">
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                    <CheckCircle2 className="size-3.5" aria-hidden /> What we know
                  </p>
                  <p className="mt-1 leading-relaxed text-muted-foreground">{area.known}</p>
                </div>
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700">
                    <CircleAlert className="size-3.5" aria-hidden /> What&apos;s missing
                  </p>
                  <p className="mt-1 leading-relaxed text-muted-foreground">{area.missing}</p>
                </div>
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-700">
                    <Sparkles className="size-3.5" aria-hidden /> What additional data would unlock
                  </p>
                  <p className="mt-1 leading-relaxed text-muted-foreground">{area.unlocks}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4 text-sm">
        <button onClick={() => navigate("data-quality")} className="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline">
          <CircleAlert className="size-4" aria-hidden /> Data quality issues
          <ArrowUpRight className="size-3.5" aria-hidden />
        </button>
        <button onClick={() => navigate("provenance/all")} className="inline-flex items-center gap-1 font-medium text-blue-700 hover:underline">
          <Database className="size-4" aria-hidden /> How facts are sourced
          <ArrowUpRight className="size-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}

function MiniStat({ label, value, onClick, alert }: { label: string; value: string; onClick: () => void; alert?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-xl border bg-white p-4 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/40",
        alert && "border-amber-200 bg-amber-50/50"
      )}
    >
      <p className="text-2xl font-bold tnum leading-none">{value}</p>
      <p className="mt-1.5 text-xs font-medium text-muted-foreground">{label}</p>
    </button>
  );
}

export const views: ViewMap = {
  data: DataCoverageScreen,
};
