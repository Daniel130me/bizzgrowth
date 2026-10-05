"use client";
// Screen 21 — Home / Business Overview. The command centre.
// Answers: How are we doing? What changed? Why? What should we do?

import React from "react";
import { ArrowRight, Database, ScrollText, Sparkles, Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ConfidenceBadge, ImpactBadge, ProvenanceBadge, StatusBadge } from "@/components/shared/badges";
import { GoalProgressCard, MetricCard } from "@/components/shared/cards";
import { RevenueAreaChart } from "@/components/shared/charts";
import { InfoBanner, SectionCard } from "@/components/shared/layout";
import { useBizz } from "@/lib/store";
import { getBusiness, getPeriod } from "@/lib/data/businesses";
import { deltaPct, fmtDateShort, fmtDelta } from "@/lib/format";
import {
  fmtMoneyMajor,
  insightsForBusiness,
  metricSnapshot,
  primaryGoal,
  recommendationsForBusiness,
  timelineForBusiness,
  type MetricId,
} from "./metric-defs";
import type { ScreenProps } from "../view-types";

const HOME_CARDS: Record<"service" | "ecommerce", MetricId[]> = {
  service: ["revenue", "customers", "enquiries", "spend"],
  ecommerce: ["revenue", "orders", "traffic", "spend"],
};

const CARD_LABELS: Record<MetricId, string> = {
  revenue: "Revenue",
  customers: "New customers",
  enquiries: "Enquiries",
  orders: "Orders",
  traffic: "Visitors",
  spend: "Marketing spend",
  cac: "CAC",
  conversion: "Conversion",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{children}</p>;
}

export default function HomeScreen(_props: ScreenProps) {
  const businessId = useBizz((s) => s.businessId);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const dateRange = useBizz((s) => s.dateRange);
  const user = useBizz((s) => s.user);
  const navigate = useBizz((s) => s.navigate);

  const business = getBusiness(businessId, userWorkspace);
  const period = getPeriod(business, dateRange);

  const firstName = user.name.split(" ")[0];
  const hour = new Date().getHours();
  const partOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

  const insights = insightsForBusiness(business);
  const topInsight = insights[0];
  const rec = recommendationsForBusiness(business)[0];
  const goal = primaryGoal(business);
  const events = timelineForBusiness(business).slice(0, 3);

  const cards = HOME_CARDS[business.type];
  const ecom = business.type === "ecommerce";

  // Important-change banner figures (measured, period-aware).
  const enquiryDelta = Math.round(deltaPct(period.current.enquiries, period.previous.enquiries));
  const customerDelta = Math.round(deltaPct(period.current.customers, period.previous.customers));
  const trafficDelta = Math.round(deltaPct(period.current.traffic, period.previous.traffic));
  const orderDelta = Math.round(deltaPct(period.current.orders, period.previous.orders));

  const lowest = business.dataCoverage.areas.reduce((min, a) => (a.coverage < min.coverage ? a : min), business.dataCoverage.areas[0]);

  const monthlyRange = `${business.monthly[0]?.label} – ${business.monthly[business.monthly.length - 1]?.label} 2026`;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {/* Greeting + business status */}
      <header>
        <h1 className="text-2xl font-bold tracking-tight" suppressHydrationWarning>
          Good {partOfDay}, {firstName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {business.name} · {period.label} <span className="text-slate-400">({period.compareLabel})</span>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <StatusBadge status={business.lastSyncOk ? "connected" : "error"} />
          <span>{business.lastSyncNote}</span>
          <button onClick={() => navigate("data")} className="font-medium text-blue-700 hover:underline">
            Data centre
          </button>
        </div>
      </header>

      {/* How are we doing? */}
      <section aria-labelledby="how-doing">
        <div id="how-doing">
          <SectionLabel>How are we doing</SectionLabel>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((id) => {
            const snap = metricSnapshot(id, business, period);
            return (
              <MetricCard
                key={id}
                label={CARD_LABELS[id]}
                value={snap.displayCompact}
                delta={snap.delta}
                goodness={snap.goodness}
                provenance={snap.provenance}
                source={snap.source}
                footnote={`Previous: ${snap.previousDisplay}`}
                onClick={() => navigate(`metric/${id}`)}
              />
            );
          })}
        </div>
      </section>

      {/* What changed? Why? */}
      <section className="space-y-4" aria-label="What changed and why">
        <InfoBanner tone="warning" title="Important change">
          {ecom ? (
            <span>
              Traffic grew {fmtDelta(trafficDelta)} while orders changed by {fmtDelta(orderDelta)} — the constraint sits after the visit, not in demand.
            </span>
          ) : (
            <span>
              Enquiry volume grew significantly faster than customers — enquiries {fmtDelta(enquiryDelta)} while customers grew only {fmtDelta(customerDelta)}.
            </span>
          )}
        </InfoBanner>

        <div className="grid gap-4 lg:grid-cols-2">
          {topInsight && (
            <Card className="border-violet-200 bg-violet-50/60 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Sparkles className="size-4 text-violet-600" aria-hidden />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">AI insight</span>
                <ProvenanceBadge provenance="ai-interpretation" />
              </div>
              <p className="mt-2 text-[15px] font-semibold leading-snug">
                {ecom
                  ? "Checkout completion appears to be the current growth constraint."
                  : "Conversion appears to be the current growth constraint."}
              </p>
              <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{topInsight.summary}</p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <ConfidenceBadge level={topInsight.confidenceLevel} value={topInsight.confidence} />
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-violet-700 hover:text-violet-800"
                  onClick={() => navigate(`insights/${topInsight.id}`)}
                >
                  View diagnosis <ArrowRight className="ml-1 size-3.5" aria-hidden />
                </Button>
              </div>
            </Card>
          )}

          {rec && (
            <Card className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Target className="size-4 text-blue-600" aria-hidden />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">Recommended action</span>
                <ImpactBadge impact={rec.impact} />
              </div>
              <p className="mt-2 text-[15px] font-semibold leading-snug">{rec.title}</p>
              <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{rec.recommendation}</p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Expected: {rec.expectedImpact}</span>
                <Button size="sm" variant="outline" onClick={() => navigate(`recommendations/${rec.id}`)}>
                  View recommendation
                </Button>
              </div>
            </Card>
          )}
        </div>
      </section>

      {/* Progress and data */}
      <section className="grid gap-4 lg:grid-cols-2" aria-label="Goal progress and data coverage">
        {goal && (
          <div>
            <SectionLabel>What to do next</SectionLabel>
            <GoalProgressCard
              title={goal.title}
              current={goal.current}
              target={goal.target}
              unit={goal.unit}
              deadline={fmtDateShort(goal.deadline)}
              status={goal.status}
              onOpen={() => navigate(`goals/${goal.id}`)}
            />
          </div>
        )}
        <div className={goal ? "" : "lg:col-span-2"}>
          <SectionLabel>Data quality</SectionLabel>
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[15px] font-semibold">Data coverage</h3>
              <span className="text-2xl font-semibold tnum">{business.dataCoverage.overall}%</span>
            </div>
            <Progress value={business.dataCoverage.overall} className="mt-2" />
            <p className="mt-2 text-xs text-muted-foreground">
              {lowest ? `${lowest.area} coverage is lowest at ${lowest.coverage}% — ${lowest.missing.charAt(0).toLowerCase()}${lowest.missing.slice(1)}` : ""}
            </p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => navigate("data")}>
              <Database className="mr-1.5 size-3.5" aria-hidden /> Improve coverage
            </Button>
          </Card>
        </div>
      </section>

      {/* Trend and recent activity */}
      <section className="grid gap-4 lg:grid-cols-5" aria-label="Revenue trend and recent activity">
        <div className="lg:col-span-3">
          <SectionCard title="Revenue trend" description={`Monthly revenue, ${monthlyRange}`}>
            <RevenueAreaChart
              data={business.monthly.map((m) => ({ label: m.label, current: m.revenue }))}
              xKey="label"
              height={180}
            />
          </SectionCard>
        </div>
        <div className="lg:col-span-2">
          <SectionCard
            title="Recent activity"
            description="Latest changes affecting your numbers"
            action={
              <Button variant="ghost" size="sm" onClick={() => navigate("timeline")}>
                <ScrollText className="mr-1.5 size-3.5" aria-hidden /> View all
              </Button>
            }
          >
            <ul className="space-y-3">
              {events.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => navigate("timeline")}
                    className="w-full rounded-lg border border-transparent p-2 text-left transition-colors hover:border-slate-200 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium leading-snug">{t.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{fmtDateShort(t.date)}</span>
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {t.source} · {t.description.length > 80 ? `${t.description.slice(0, 80)}…` : t.description}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      </section>
    </div>
  );
}
