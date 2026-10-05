"use client";
// Screen 28 — Marketing Channel Detail. One channel: stats, trend, simulated campaigns, provenance.

import React, { useEffect } from "react";
import { ArrowRight, Lightbulb, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProvenanceBadge, TrendBadge } from "@/components/shared/badges";
import { TrendLineChart } from "@/components/shared/charts";
import { KeyValue, PageHeader, SectionCard } from "@/components/shared/layout";
import { fmtNaira, fmtNum, fmtPct, goodnessFor, deltaPct } from "@/lib/format";
import type { Business, ChannelMetrics, Provenance } from "@/lib/types";
import { fmtMoneyMajor, insightsForBiz, recommendationsForBiz, useBiz } from "./biz";
import type { ScreenProps } from "../view-types";

/** Simulated campaign rows — clearly labelled as illustrative (campaign data is not connected). */
const CAMPAIGNS: Record<string, { name: string; spend: number; status: string }[]> = {
  "service:instagram": [
    { name: "Reels — Interstate delivery push", spend: 95000, status: "active" },
    { name: "Story retargeting — Lagos SMBs", spend: 60000, status: "active" },
    { name: "Lead gen — Same-day delivery", spend: 45000, status: "completed" },
  ],
  "service:google": [
    { name: "Search — “delivery company Lagos”", spend: 90000, status: "active" },
    { name: "Search — interstate freight terms", spend: 60000, status: "active" },
  ],
  "service:referral": [{ name: "Partner referral programme", spend: 20000, status: "active" }],
  "ecommerce:instagram": [
    { name: "Reels — Rattan collection launch", spend: 140000, status: "active" },
    { name: "Retargeting — cart abandoners", spend: 105000, status: "active" },
    { name: "Prospecting — home & living", spend: 75000, status: "completed" },
  ],
  "ecommerce:google": [
    { name: "Search — furniture + delivery Lagos", spend: 120000, status: "active" },
    { name: "Shopping — best sellers", spend: 90000, status: "active" },
  ],
};

function channelProvenance(business: Business, ch: ChannelMetrics): { figure: string; provenance: Provenance; source: string }[] {
  const ecom = business.type === "ecommerce";
  const rows: { figure: string; provenance: Provenance; source: string }[] = [];
  if (ch.spend > 0) {
    rows.push({
      figure: "Spend",
      provenance: "measured",
      source: ch.kind === "paid" ? (ch.id === "google" ? "Google Ads sync" : "Meta Ads sync") : "Manual monthly submission",
    });
  } else {
    rows.push({ figure: "Spend", provenance: "measured", source: "No paid spend recorded" });
  }
  if (ecom) {
    rows.push({
      figure: "Orders",
      provenance: ch.kind === "paid" ? "measured" : "estimated",
      source: ch.kind === "paid" ? "Platform + Shopify attributed orders" : "Shopify attribution model",
    });
    rows.push({ figure: "Revenue", provenance: "measured", source: "Shopify order revenue" });
  } else {
    rows.push({
      figure: "Enquiries",
      provenance: ch.kind === "paid" ? "measured" : "user-supplied",
      source: ch.kind === "paid" ? "Manual submission + ad platform" : "Manual monthly submission",
    });
    rows.push({ figure: "Customers", provenance: "user-supplied", source: "Manual monthly submission" });
    rows.push({ figure: "Revenue", provenance: "user-supplied", source: "Manual monthly submission" });
  }
  rows.push({ figure: ecom ? "Cost per order" : "CAC", provenance: "estimated", source: `Calculated — spend ÷ ${ecom ? "orders" : "customers"}` });
  if (ch.spend > 0) rows.push({ figure: "ROAS", provenance: "estimated", source: "Calculated — revenue ÷ spend" });
  return rows;
}

function matchesText(haystack: string, keyword: string): boolean {
  return haystack.toLowerCase().includes(keyword.toLowerCase());
}

export default function ChannelDetail({ params }: ScreenProps) {
  const { business, navigate } = useBiz();
  const channelId = params.channel;
  const ch = business.channels.find((c) => c.id === channelId);
  const ecom = business.type === "ecommerce";

  useEffect(() => {
    if (!ch) navigate("performance/marketing");
  }, [ch, navigate]);

  if (!ch) return null;

  const denom = ecom ? ch.orders ?? 0 : ch.customers;
  const cac = denom > 0 ? (ecom ? (ch.spend > 0 ? ch.spend / denom : 0) : ch.cac) : 0;
  const roas = ch.spend > 0 ? ch.revenue / ch.spend : 0;

  const campaignKey = `${business.type}:${ch.id}`;
  const campaigns = CAMPAIGNS[campaignKey];

  const keyword = ch.name.split(" ")[0]; // "Instagram", "Google", "Referral", "Organic", "Direct"
  const relatedInsight = insightsForBiz(business).find((i) => matchesText(`${i.title} ${i.summary} ${i.primaryMetric}`, keyword));
  const relatedRec = recommendationsForBiz(business).find((r) => matchesText(`${r.title} ${r.problem} ${r.primaryMetric}`, keyword));

  const trendData = business.monthly.slice(-6).map((m, i) => ({ label: m.label, value: ch.trend[i] ?? 0 }));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <PageHeader
        title={ch.name}
        description={`${ecom ? "Ecommerce" : "Service"} channel · ${ch.kind} acquisition`}
        back={
          <Button variant="ghost" size="sm" className="-ml-2 mb-1" onClick={() => navigate("performance/marketing")}>
            <ArrowRight className="mr-1.5 size-4 rotate-180" aria-hidden /> Marketing
          </Button>
        }
      />

      {/* Channel switcher */}
      <Tabs value={ch.id} onValueChange={(v) => navigate(`performance/marketing/${v}`)}>
        <TabsList aria-label="Switch channel">
          {business.channels.map((c) => (
            <TabsTrigger key={c.id} value={c.id}>
              {c.name}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Spend</p>
          <p className="mt-1 text-lg font-semibold tnum">{ch.spend > 0 ? fmtNaira(ch.spend) : "—"}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">{ecom ? "Orders" : "Enquiries"}</p>
          <p className="mt-1 text-lg font-semibold tnum">{fmtNum(ecom ? ch.orders ?? 0 : ch.enquiries)}</p>
        </Card>
        {!ecom && (
          <Card className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Customers</p>
            <p className="mt-1 text-lg font-semibold tnum">{fmtNum(ch.customers)}</p>
          </Card>
        )}
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">Revenue</p>
          <p className="mt-1 text-lg font-semibold tnum">{fmtMoneyMajor(ch.revenue)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted-foreground">{ecom ? "Cost per order" : "CAC"}</p>
          <p className="mt-1 text-lg font-semibold tnum">{cac > 0 ? fmtNaira(Math.round(cac)) : "—"}</p>
        </Card>
        {!ecom ? (
          <Card className="p-4">
            <p className="text-xs font-medium text-muted-foreground">Conversion</p>
            <p className="mt-1 text-lg font-semibold tnum">{fmtPct(ch.conversion)}</p>
          </Card>
        ) : (
          <Card className="p-4">
            <p className="text-xs font-medium text-muted-foreground">ROAS</p>
            <p className="mt-1 text-lg font-semibold tnum">{roas > 0 ? `${roas.toFixed(1)}x` : "—"}</p>
          </Card>
        )}
      </div>

      {/* Trend */}
      <SectionCard
        title="Volume trend"
        description={`${ecom ? "Attributed orders" : "Enquiry volume"} over the last 6 months (Apr – Sep)`}
      >
        <TrendLineChart
          data={trendData}
          xKey="label"
          series={[{ key: "value", label: ecom ? "Orders" : "Enquiries" }]}
          valueFormatter={(v) => fmtNum(Math.round(v))}
          height={200}
        />
        {ch.trend.length >= 2 && (
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <TrendBadge
              delta={Math.round(deltaPct(ch.trend[ch.trend.length - 1], ch.trend[ch.trend.length - 2]))}
              goodness={goodnessFor(ecom ? "orders" : "enquiries", ch.trend[ch.trend.length - 1] >= ch.trend[ch.trend.length - 2] ? "up" : "down")}
            />
            <span>vs previous month ({ch.trend[ch.trend.length - 2]} → {ch.trend[ch.trend.length - 1]})</span>
          </div>
        )}
      </SectionCard>

      {/* Campaigns */}
      <SectionCard
        title="Campaigns"
        description={
          campaigns
            ? "Campaign-level data is not connected yet — entries below are simulated to illustrate the intended view."
            : undefined
        }
        action={campaigns ? <ProvenanceBadge provenance="estimated" source="Simulated campaign structure" /> : undefined}
      >
        {campaigns ? (
          <ul className="space-y-2">
            {campaigns.map((c) => (
              <li key={c.name} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                <span className="text-sm font-medium">{c.name}</span>
                <span className="flex items-center gap-3">
                  <span className="text-sm tnum">{fmtNaira(c.spend)}</span>
                  <Badge variant="outline" className="font-normal">
                    {c.status === "active" ? "Active" : "Completed"}
                  </Badge>
                </span>
              </li>
            ))}
            <li className="pt-1 text-xs text-muted-foreground">
              Simulated spend totals {fmtNaira(campaigns.reduce((a, c) => a + c.spend, 0))} — matching the measured channel spend of{" "}
              {fmtNaira(ch.spend)}.
            </li>
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No paid campaigns — this channel is measured through Shopify attribution rather than campaign structures.
          </p>
        )}
      </SectionCard>

      {/* Related intelligence */}
      <div className="grid gap-4 lg:grid-cols-2">
        {relatedInsight && (
          <Card
            role="button"
            tabIndex={0}
            onClick={() => navigate(`insights/${relatedInsight.id}`)}
            onKeyDown={(e) => e.key === "Enter" && navigate(`insights/${relatedInsight.id}`)}
            className="cursor-pointer border-violet-200 bg-violet-50/50 p-4 transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-center gap-2 text-violet-700">
              <Sparkles className="size-4" aria-hidden />
              <span className="text-[11px] font-semibold uppercase tracking-wide">Related insight</span>
            </div>
            <p className="mt-1.5 text-sm font-semibold leading-snug">{relatedInsight.title}</p>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{relatedInsight.summary}</p>
          </Card>
        )}
        {relatedRec && (
          <Card
            role="button"
            tabIndex={0}
            onClick={() => navigate(`recommendations/${relatedRec.id}`)}
            onKeyDown={(e) => e.key === "Enter" && navigate(`recommendations/${relatedRec.id}`)}
            className="cursor-pointer border-amber-200 bg-amber-50/50 p-4 transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-center gap-2 text-amber-700">
              <Lightbulb className="size-4" aria-hidden />
              <span className="text-[11px] font-semibold uppercase tracking-wide">Related recommendation</span>
            </div>
            <p className="mt-1.5 text-sm font-semibold leading-snug">{relatedRec.title}</p>
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{relatedRec.recommendation}</p>
          </Card>
        )}
      </div>

      {/* Provenance panel */}
      <SectionCard title="Provenance" description="Which source supplies each figure for this channel.">
        <div className="space-y-3">
          {channelProvenance(business, ch).map((r) => (
            <KeyValue key={r.figure} label={r.figure}>
              <ProvenanceBadge provenance={r.provenance} source={r.source} />
              <span className="ml-2 text-sm text-muted-foreground">{r.source}</span>
            </KeyValue>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
