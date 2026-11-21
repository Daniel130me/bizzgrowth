"use client";
// Screen 23 — Metric drill-down. Reusable detailed view opened by clicking metrics.

import React from "react";
import { ArrowRight, BarChart3, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfidenceBadge, ProvenanceBadge, TrendBadge } from "@/components/shared/badges";
import { TrendLineChart } from "@/components/shared/charts";
import { ProvenanceLegend } from "@/components/shared/evidence";
import { Breadcrumbs, KeyValue, PageHeader, SectionCard } from "@/components/shared/layout";
import { EmptyState, NoDataYetState } from "@/components/shared/states";
import { useBizz } from "@/lib/store";
import { getBusiness, getPeriod } from "@/lib/data/businesses";
import {
  METRIC_IDS,
  breakdownFor,
  importantChanges,
  metricChartFormatter,
  metricLabel,
  metricMonthlySeries,
  metricSnapshot,
  relatedInsights,
  type MetricId,
} from "./metric-defs";
import type { ScreenProps } from "../view-types";

/** Copy for metrics that exist as ids but are not tracked for the workspace type. */
function notTrackedCopy(id: MetricId, isEcom: boolean): { title: string; description: string } {
  if (id === "traffic" && !isEcom) {
    return {
      title: "Website traffic is not measured yet",
      description:
        "Website analytics are not connected for this workspace, so visitor counts are not available. Enquiries are measured instead once visitors reach out.",
    };
  }
  if (id === "orders" && !isEcom) {
    return {
      title: "Orders are not tracked for service workspaces",
      description:
        "This service workspace tracks enquiries and customers rather than product orders. The closest equivalent volume measure is enquiries.",
    };
  }
  if (id === "enquiries" && isEcom) {
    return {
      title: "Enquiries are not tracked for ecommerce workspaces",
      description: "Orders are the equivalent volume measure for this store. Connect a support channel to track pre-sale enquiries.",
    };
  }
  return {
    title: "Customer-level records are not connected",
    description:
      "Customer-level records are not connected for this workspace, so the customer count cannot be broken down. Orders and revenue are measured instead.",
  };
}

export default function MetricDetail({ params }: ScreenProps) {
  const businessId = useBizz((s) => s.businessId);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const dateRange = useBizz((s) => s.dateRange);
  const navigate = useBizz((s) => s.navigate);

  const business = getBusiness(businessId, userWorkspace);
  const period = getPeriod(business, dateRange);

  const rawId = params.id;
  const isValid = METRIC_IDS.includes(rawId as MetricId);
  if (!isValid) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <NoDataYetState subject={rawId ? `the metric “${rawId}”` : "this metric"} />
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => navigate("performance")}>
            <ArrowRight className="mr-1.5 size-4 rotate-180" aria-hidden /> Back to performance
          </Button>
        </div>
      </div>
    );
  }

  const id = rawId as MetricId;
  const isEcom = business.type === "ecommerce";
  const snap = metricSnapshot(id, business, period);

  if (!snap.available) {
    const copy = notTrackedCopy(id, isEcom);
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Breadcrumbs
          items={[
            { label: "Home", onClick: () => navigate("home") },
            { label: "Performance", onClick: () => navigate("performance") },
            { label: metricLabel(id, business) },
          ]}
        />
        <EmptyState icon={<BarChart3 className="size-5" />} title={copy.title} description={copy.description} />
        <div className="flex flex-wrap justify-center gap-2">
          {(id === "traffic" || (isEcom && id === "customers")) && (
            <Button onClick={() => navigate("integrations")}>Connect a data source</Button>
          )}
          <Button variant="outline" onClick={() => navigate(isEcom ? "metric/orders" : "metric/enquiries")}>
            View {isEcom ? "orders" : "enquiries"} metric
          </Button>
        </div>
      </div>
    );
  }

  const series = metricMonthlySeries(id, business);
  const formatter = metricChartFormatter(id);
  const breakdown = breakdownFor(id, business);
  const changes = importantChanges(id, business);
  const insights = relatedInsights(id, business);
  const monthlyRange = `${business.monthly[0]?.label} – ${business.monthly[business.monthly.length - 1]?.label} 2026`;

  const noBreakdownNote =
    id === "traffic"
      ? "Per-channel traffic is not available for this workspace — sessions are measured at store level only."
      : isEcom
        ? "Per-channel customer and conversion data is not available from Shopify attribution — orders are measured per channel instead."
        : null;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <Breadcrumbs
        items={[
          { label: "Home", onClick: () => navigate("home") },
          { label: "Performance", onClick: () => navigate("performance") },
          { label: snap.label },
        ]}
      />

      <PageHeader
        title={snap.label}
        description={`${period.label} · ${period.compareLabel}`}
        badge={<ProvenanceBadge provenance={snap.provenance} source={snap.source} />}
        actions={
          <Button onClick={() => navigate("ask")}>
            Ask AI about this metric <ArrowRight className="ml-1.5 size-4" aria-hidden />
          </Button>
        }
      />

      {/* Headline value + comparison */}
      <SectionCard>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-4xl font-bold tracking-tight tnum">{snap.display}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <TrendBadge delta={snap.delta} goodness={snap.goodness} />
              <span className="text-sm text-muted-foreground">{period.compareLabel}</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <KeyValue label={period.label}>{snap.display}</KeyValue>
            <KeyValue label={period.compareLabel.replace("vs ", "")}>{snap.previousDisplay}</KeyValue>
          </div>
        </div>
      </SectionCard>

      {/* Trend */}
      <SectionCard title="Trend" description={`Monthly ${snap.label.toLowerCase()}, ${monthlyRange}`}>
        <TrendLineChart
          data={series}
          xKey="label"
          series={[{ key: "value", label: snap.label }]}
          valueFormatter={formatter}
        />
      </SectionCard>

      {/* Breakdown by channel */}
      <SectionCard
        title={`Breakdown by channel`}
        description={breakdown ? "Channel-level contribution for the current period." : undefined}
      >
        {breakdown ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2.5 pr-4 font-medium">Channel</th>
                  {breakdown.columns.map((c) => (
                    <th key={c.key} className="py-2.5 pr-4 text-right font-medium">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {breakdown.rows.map((r) => (
                  <tr
                    key={r.id}
                    tabIndex={0}
                    onClick={() => navigate(`performance/marketing/${r.id}`)}
                    onKeyDown={(e) => e.key === "Enter" && navigate(`performance/marketing/${r.id}`)}
                    className="cursor-pointer border-b transition-colors last:border-0 hover:bg-slate-50 focus-visible:bg-slate-50"
                    aria-label={`${r.name} — open channel detail`}
                  >
                    <td className="py-2.5 pr-4 font-medium">{r.name}</td>
                    {r.cells.map((cell, i) => (
                      <td key={i} className="py-2.5 pr-4 text-right tnum">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{noBreakdownNote ?? "No channel-level breakdown is available for this metric yet."}</p>
        )}
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Important changes */}
        <SectionCard
          title="Important changes"
          description="Timeline events that touch this metric"
          action={
            <Button variant="ghost" size="sm" onClick={() => navigate("timeline")}>
              View all
            </Button>
          }
        >
          <ul className="space-y-3">
            {changes.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => navigate("timeline")}
                  className="w-full rounded-lg border border-transparent p-2 text-left transition-colors hover:border-slate-200 hover:bg-slate-50"
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium leading-snug">{t.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{t.date}</span>
                  </span>
                  <span className="mt-1 flex items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">{t.source}</span>
                    <ProvenanceBadge provenance={t.provenance} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </SectionCard>

        {/* Related insights */}
        <SectionCard title="Related insights" description="AI diagnoses that reference this metric">
          {insights.length ? (
            <ul className="space-y-2">
              {insights.map((i) => (
                <li key={i.id}>
                  <button
                    onClick={() => navigate(`insights/${i.id}`)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-transparent p-2.5 text-left transition-colors hover:border-slate-200 hover:bg-slate-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{i.title}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{i.primaryMetric}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <ConfidenceBadge level={i.confidenceLevel} />
                      <ChevronRight className="size-4 text-slate-400" aria-hidden />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No insights currently reference this metric.</p>
          )}
        </SectionCard>
      </div>

      {/* Data source / provenance */}
      <SectionCard title="Data source" description="Where this metric comes from and how it is calculated.">
        <div className="space-y-3">
          <KeyValue label="Provenance">
            <ProvenanceBadge provenance={snap.provenance} source={snap.source} />
          </KeyValue>
          <KeyValue label="Source">{snap.source}</KeyValue>
          <KeyValue label="Data coverage">
            <span className="tnum">{business.dataCoverage.overall}%</span>
            <Button variant="ghost" size="sm" className="ml-2 h-7 text-brand-700" onClick={() => navigate("data")}>
              View data centre
            </Button>
          </KeyValue>
          <ProvenanceLegend className="pt-1" />
        </div>
      </SectionCard>
    </div>
  );
}
