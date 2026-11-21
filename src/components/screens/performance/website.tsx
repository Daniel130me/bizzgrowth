"use client";
// Screen 29 — Website & Conversion Performance.
// SwiftHaul: no analytics connected → honest empty state. KoraHome: full conversion view.

import React from "react";
import { ArrowRight, CircleAlert, MousePointerClick } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProvenanceBadge, TrendBadge } from "@/components/shared/badges";
import { CompareBarChart, DonutChart } from "@/components/shared/charts";
import { InfoBanner, KeyValue, PageHeader, SectionCard } from "@/components/shared/layout";
import { NoDataYetState } from "@/components/shared/states";
import { CHART_COLORS } from "@/lib/chart-colors";
import { deltaPct, fmtDelta, fmtNum, fmtPct } from "@/lib/format";
import { useBiz } from "./biz";
import type { ScreenProps } from "../view-types";

export default function WebsitePerformance(_props: ScreenProps) {
  const { business, navigate } = useBiz();
  const site = business.website;

  // ---------- Empty state (SwiftHaul) ----------
  if (!site.connected) {
    const coverage = business.dataCoverage.areas.find((a) => a.area === "Website");
    return (
      <div className="mx-auto w-full max-w-4xl space-y-5">
        <PageHeader
          title="Website & conversion"
          description="What happens on your website before enquiries arrive."
          back={
            <Button variant="ghost" size="sm" className="-ml-2 mb-1" onClick={() => navigate("performance")}>
              <ArrowRight className="mr-1.5 size-4 rotate-180" aria-hidden /> Performance
            </Button>
          }
        />
        <InfoBanner tone="info" title="This is the largest data gap in your workspace">
          Connect Google Analytics to see what happens on your website before enquiries arrive — traffic, top pages and where
          visitors drop off. Today, enquiries can only be measured after they are already recorded.
        </InfoBanner>
        <NoDataYetState
          subject="website performance"
          onConnect={() => navigate("integrations")}
          onEnterData={() => navigate("manual-entry")}
        />
        {coverage && (
          <SectionCard title="What connecting would unlock" description="From your current data-coverage record.">
            <div className="space-y-3">
              <KeyValue label="Known today">{coverage.known}</KeyValue>
              <KeyValue label="Missing">{coverage.missing}</KeyValue>
              <KeyValue label="Unlocks">{coverage.unlocks}</KeyValue>
            </div>
          </SectionCard>
        )}
      </div>
    );
  }

  // ---------- Connected (KoraHome) ----------
  const prevMonth = business.monthly[business.monthly.length - 2];
  const prevConv = prevMonth && prevMonth.traffic ? ((prevMonth.orders ?? 0) / prevMonth.traffic) * 100 : 0;
  const convDelta = Math.round(deltaPct(site.visitorConversion ?? 0, prevConv));

  const productViews = business.funnel.find((s) => s.id === "views")?.value ?? 0;
  const carts = business.funnel.find((s) => s.id === "carts")?.value ?? 0;
  const cartRate = productViews ? (carts / productViews) * 100 : 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <PageHeader
        title="Website & conversion"
        description="Traffic, device mix and checkout behaviour for the store — September snapshot."
        back={
          <Button variant="ghost" size="sm" className="-ml-2 mb-1" onClick={() => navigate("performance")}>
            <ArrowRight className="mr-1.5 size-4 rotate-180" aria-hidden /> Performance
          </Button>
        }
      />

      {/* Payment failure alert */}
      <InfoBanner
        tone="danger"
        title="Payment failures increased"
        action={
          <Button size="sm" variant="outline" className="shrink-0 border-red-300 bg-white text-red-700 hover:bg-red-100" onClick={() => navigate("alerts/al-kh-3")}>
            View alert <ArrowRight className="ml-1 size-3.5" aria-hidden />
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <CircleAlert className="size-4 shrink-0" aria-hidden />
          <span>
            Failed payment attempts rose {fmtDelta(site.paymentFailuresDelta ?? 0)} vs August — this correlates with the mobile
            checkout completion decline.
          </span>
          <TrendBadge delta={site.paymentFailuresDelta ?? 0} goodness="bad" />
        </div>
      </InfoBanner>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sessions</p>
          <p className="mt-1 text-2xl font-semibold tnum">{fmtNum(site.traffic ?? 0)}</p>
          <div className="mt-2">
            <ProvenanceBadge provenance="measured" source="Shopify sessions" />
          </div>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Unique visitors</p>
          <p className="mt-1 text-2xl font-semibold tnum">{fmtNum(site.visitors ?? 0)}</p>
          <p className="mt-2 text-xs text-muted-foreground">{fmtPct(site.mobileShare ?? 0, 0)} on mobile</p>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Visitor → purchase</p>
            <TrendBadge delta={convDelta} goodness={convDelta >= 0 ? "good" : "bad"} />
          </div>
          <p className="mt-1 text-2xl font-semibold tnum">{fmtPct(site.visitorConversion ?? 0)}</p>
          <p className="mt-2 text-xs text-muted-foreground">Was {fmtPct(prevConv)} in August</p>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">View → cart rate</p>
          <p className="mt-1 text-2xl font-semibold tnum">{fmtPct(cartRate)}</p>
          <p className="mt-2 text-xs text-muted-foreground">{fmtNum(carts)} carts from {fmtNum(productViews)} views</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Device mix" description="Share of sessions by device, September">
          <DonutChart
            data={[
              { name: "Mobile", value: site.deviceMix?.mobile ?? 0, color: CHART_COLORS.blue },
              { name: "Desktop", value: site.deviceMix?.desktop ?? 0, color: CHART_COLORS.slate },
            ]}
          />
        </SectionCard>
        <SectionCard title="Checkout completion by device" description="Percentage of checkouts completed, August vs September">
          <CompareBarChart
            data={[
              { name: "Mobile", Previous: site.mobileCheckout?.previous ?? 0, Current: site.mobileCheckout?.current ?? 0 },
              { name: "Desktop", Previous: site.desktopCheckout?.previous ?? 0, Current: site.desktopCheckout?.current ?? 0 },
            ]}
            xKey="name"
            series={[
              { key: "Previous", label: "August", color: CHART_COLORS.slate },
              { key: "Current", label: "September", color: CHART_COLORS.blue },
            ]}
            layout="vertical"
            valueFormatter={(v) => `${Math.round(v)}%`}
            height={200}
          />
        </SectionCard>
      </div>

      {/* AI callout */}
      <InfoBanner
        tone="ai"
        title="AI interpretation"
        action={
          <Button size="sm" variant="outline" className="shrink-0 border-brand-300 bg-white text-brand-700 hover:bg-brand-100" onClick={() => navigate("insights/ins-kh-1")}>
            View diagnosis <ArrowRight className="ml-1 size-3.5" aria-hidden />
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <span>Mobile checkout is the weakest point — this is where orders are being lost.</span>
          <ProvenanceBadge provenance="ai-interpretation" />
        </div>
      </InfoBanner>

      {/* Landing pages */}
      <SectionCard title="Top landing pages" description="Where sessions land and how each entry point converts.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2.5 pr-4 font-medium">Path</th>
                <th className="py-2.5 pr-4 text-right font-medium">Visits</th>
                <th className="py-2.5 pr-4 text-right font-medium">Conversion</th>
              </tr>
            </thead>
            <tbody>
              {(site.landingPages ?? []).map((p) => (
                <tr key={p.path} className="border-b last:border-0">
                  <td className="py-2.5 pr-4 font-mono text-[13px]">{p.path}</td>
                  <td className="py-2.5 pr-4 text-right tnum">{fmtNum(p.visits)}</td>
                  <td className="py-2.5 pr-4 text-right tnum">{fmtPct(p.conversion)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* CTA interactions note */}
      <SectionCard title="CTA interactions">
        <div className="flex items-start gap-3">
          <MousePointerClick className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
          <div className="text-sm text-muted-foreground">
            <p>
              Add-to-cart interactions: {fmtNum(carts)} carts from {fmtNum(productViews)} product views ({fmtPct(cartRate)}) —
              measured as part of the Shopify click funnel.
            </p>
            <p className="mt-1.5">
              Step-level heatmaps and session recordings are not connected, so the exact failing checkout step cannot be pinpointed
              yet. The Data Centre lists this as the fastest way to raise website coverage.
            </p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
