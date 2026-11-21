"use client";
// Screen 25 — Revenue & Sales Performance.

import React from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProvenanceBadge, TrendBadge } from "@/components/shared/badges";
import { CompareBarChart, RevenueAreaChart } from "@/components/shared/charts";
import { InfoBanner, KeyValue, PageHeader, SectionCard } from "@/components/shared/layout";
import { CHART_COLORS } from "@/lib/chart-colors";
import { deltaPct, fmtDelta, fmtNaira, fmtNum, fmtPct, goodnessFor } from "@/lib/format";
import { fmtMoneyMajor, useBiz } from "./biz";
import type { ScreenProps } from "../view-types";

export default function RevenuePerformance(_props: ScreenProps) {
  const { business, period, navigate } = useBiz();
  const ecom = business.type === "ecommerce";
  const cur = period.current;
  const prev = period.previous;

  const denom = ecom ? cur.orders : cur.customers;
  const prevDenom = ecom ? prev.orders : prev.customers;
  const aov = denom ? cur.revenue / denom : 0;
  const prevAov = prevDenom ? prev.revenue / prevDenom : 0;

  const revenueDelta = Math.round(deltaPct(cur.revenue, prev.revenue));
  const denomDelta = Math.round(deltaPct(denom, prevDenom));
  const spendDelta = Math.round(deltaPct(cur.spend, prev.spend));
  const trafficDelta = Math.round(deltaPct(cur.traffic, prev.traffic));

  const channels = business.channels;
  const channelRevenueTotal = channels.reduce((a, c) => a + c.revenue, 0);

  const monthlyRange = `${business.monthly[0]?.label} – ${business.monthly[business.monthly.length - 1]?.label} 2026`;

  // AI interpretation copy — derived from measured changes, labelled as interpretation.
  const aiCopy = ecom
    ? `Revenue declined ${fmtDelta(Math.abs(revenueDelta))} while traffic grew ${fmtDelta(trafficDelta)} — the constraint sits after the visit.`
    : `Revenue increased only ${fmtDelta(revenueDelta)} despite a ${fmtDelta(spendDelta)} increase in marketing spend.`;

  const revenueInsight = ecom ? "ins-kh-1" : "ins-sh-4";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <PageHeader
        title="Revenue & sales"
        description={`${business.name} · ${period.label} (${period.compareLabel})`}
        back={
          <Button variant="ghost" size="sm" className="-ml-2 mb-1" onClick={() => navigate("performance")}>
            <ArrowRight className="mr-1.5 size-4 rotate-180" aria-hidden /> Performance
          </Button>
        }
      />

      {/* Headline stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total revenue</p>
            <TrendBadge delta={revenueDelta} goodness={goodnessFor("revenue", revenueDelta >= 0 ? "up" : "down")} />
          </div>
          <p className="mt-1 text-2xl font-semibold tnum">{fmtNaira(cur.revenue)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ProvenanceBadge provenance={ecom ? "measured" : "user-supplied"} source={ecom ? "Shopify order revenue" : "Manual monthly submission"} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {period.compareLabel.replace("vs ", "")}: {fmtNaira(prev.revenue)}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{ecom ? "Orders" : "Customers"}</p>
            <TrendBadge
              delta={denomDelta}
              goodness={goodnessFor(ecom ? "orders" : "customers", denomDelta >= 0 ? "up" : "down")}
            />
          </div>
          <p className="mt-1 text-2xl font-semibold tnum">{fmtNum(denom)}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {period.compareLabel.replace("vs ", "")}: {fmtNum(prevDenom)}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Average transaction value</p>
            <TrendBadge
              delta={Math.round(deltaPct(aov, prevAov))}
              goodness={goodnessFor("aov", aov >= prevAov ? "up" : "down")}
            />
          </div>
          <p className="mt-1 text-2xl font-semibold tnum">{fmtNaira(Math.round(aov))}</p>
          <p className="mt-2 text-xs text-muted-foreground">Calculated — revenue ÷ {ecom ? "orders" : "customers"}</p>
        </div>
      </div>

      {/* AI interpretation */}
      <InfoBanner tone="ai" title="AI interpretation" action={
        <Button size="sm" variant="outline" className="shrink-0 border-brand-300 bg-white text-brand-700 hover:bg-brand-100" onClick={() => navigate(`insights/${revenueInsight}`)}>
          View diagnosis <ArrowRight className="ml-1 size-3.5" aria-hidden />
        </Button>
      }>
        <div className="flex flex-wrap items-center gap-2">
          <span>{aiCopy}</span>
          <ProvenanceBadge provenance="ai-interpretation" />
        </div>
      </InfoBanner>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Monthly revenue" description={monthlyRange}>
          <RevenueAreaChart data={business.monthly.map((m) => ({ label: m.label, current: m.revenue }))} xKey="label" />
        </SectionCard>
        <SectionCard
          title="Revenue vs marketing spend"
          description={`Two-series comparison by month, ${monthlyRange}`}
        >
          <CompareBarChart
            data={business.monthly.map((m) => ({ label: m.label, Revenue: m.revenue, Spend: m.spend }))}
            xKey="label"
            series={[
              { key: "Revenue", label: "Revenue", color: CHART_COLORS.blue },
              { key: "Spend", label: "Marketing spend", color: CHART_COLORS.slate },
            ]}
            valueFormatter={(v) => fmtMoneyMajor(v)}
          />
        </SectionCard>
      </div>

      {/* Revenue by channel */}
      <SectionCard title="Revenue by channel" description="Share of measured channel revenue for the current period.">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2.5 pr-4 font-medium">Channel</th>
                <th className="py-2.5 pr-4 text-right font-medium">Revenue</th>
                <th className="py-2.5 pr-4 text-right font-medium">Share</th>
                <th className="py-2.5 pr-4 text-right font-medium">ROAS</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((c) => (
                <tr
                  key={c.id}
                  tabIndex={0}
                  onClick={() => navigate(`performance/marketing/${c.id}`)}
                  onKeyDown={(e) => e.key === "Enter" && navigate(`performance/marketing/${c.id}`)}
                  aria-label={`${c.name} — open channel detail`}
                  className="cursor-pointer border-b transition-colors last:border-0 hover:bg-slate-50 focus-visible:bg-slate-50"
                >
                  <td className="py-2.5 pr-4 font-medium">{c.name}</td>
                  <td className="py-2.5 pr-4 text-right tnum">{fmtNaira(c.revenue)}</td>
                  <td className="py-2.5 pr-4 text-right tnum">
                    {channelRevenueTotal ? fmtPct((c.revenue / channelRevenueTotal) * 100) : "—"}
                  </td>
                  <td className="py-2.5 pr-4 text-right tnum">{c.spend > 0 ? `${(c.revenue / c.spend).toFixed(1)}x` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 space-y-2 border-t pt-3">
          <KeyValue label="Full breakdown">
            <Button variant="ghost" size="sm" className="h-7 text-brand-700" onClick={() => navigate("performance/marketing")}>
              Marketing performance <ArrowRight className="ml-1 size-3.5" aria-hidden />
            </Button>
          </KeyValue>
          <KeyValue label={ecom ? "Product revenue" : "Service revenue"}>
            <Button variant="ghost" size="sm" className="h-7 text-brand-700" onClick={() => navigate("performance/products")}>
              {ecom ? "Products" : "Services"} performance <ArrowRight className="ml-1 size-3.5" aria-hidden />
            </Button>
          </KeyValue>
        </div>
      </SectionCard>
    </div>
  );
}
