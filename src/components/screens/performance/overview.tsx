"use client";
// Screen 24 — Performance overview. One place to understand performance areas.

import React from "react";
import {
  ArrowUpRight,
  Filter,
  Globe,
  Megaphone,
  Package,
  Repeat,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendBadge } from "@/components/shared/badges";
import { PageHeader } from "@/components/shared/layout";
import { DATE_RANGES, REPORTING_MONTH } from "@/lib/data/businesses";
import { deltaPct, fmtDelta, fmtNaira, fmtNum, fmtPct, goodnessFor } from "@/lib/format";
import type { DateRangeId } from "@/lib/types";
import { useBiz, fmtMoneyMajor } from "./biz";
import type { ScreenProps } from "../view-types";

interface AreaCardProps {
  icon: LucideIcon;
  title: string;
  value: string;
  badge?: React.ReactNode;
  summary: string;
  onClick: () => void;
}

function AreaCard({ icon: Icon, title, value, badge, summary, onClick }: AreaCardProps) {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={`${title}: ${value}. ${summary}`}
      className="cursor-pointer p-5 transition-shadow hover:border-blue-300 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between">
        <span className="flex size-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <Icon className="size-5" aria-hidden />
        </span>
        <ArrowUpRight className="size-4 text-slate-300" aria-hidden />
      </div>
      <h3 className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <span className="text-xl font-semibold tnum">{value}</span>
        {badge}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{summary}</p>
    </Card>
  );
}

export default function PerformanceOverview(_props: ScreenProps) {
  const { business, period, dateRange, setDateRange, navigate } = useBiz();
  const ecom = business.type === "ecommerce";
  const cur = period.current;
  const prev = period.previous;

  const denom = ecom ? cur.orders : cur.customers;
  const prevDenom = ecom ? prev.orders : prev.customers;
  const aov = denom ? cur.revenue / denom : 0;
  const prevAov = prevDenom ? prev.revenue / prevDenom : 0;
  const cac = denom ? cur.spend / denom : 0;
  const prevCac = prevDenom ? prev.spend / prevDenom : 0;

  const steps = business.funnel;
  const firstStep = steps[0];
  const lastStep = steps[steps.length - 1];
  const endToEnd = firstStep && lastStep && firstStep.value ? (lastStep.value / firstStep.value) * 100 : 0;

  const prevMonth = business.monthly[business.monthly.length - 2];
  const prevConv = prevMonth && prevMonth.traffic ? ((prevMonth.orders ?? 0) / prevMonth.traffic) * 100 : 0;

  const topItem = ecom
    ? (business.products ?? []).reduce((top, p) => (p.revenue > (top?.revenue ?? 0) ? p : top), (business.products ?? [])[0])
    : (business.services ?? []).reduce((top, s) => (s.revenue > (top?.revenue ?? 0) ? s : top), (business.services ?? [])[0]);

  const visitorsMetric = ecom ? "metric/orders" : "metric/customers";
  const visitorsTitle = ecom ? "Orders" : "Customers";

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title="Performance"
        description={`${business.name} · ${period.label} (${period.compareLabel}). Seven areas, one picture — open any area for the full breakdown.`}
        actions={
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRangeId)}>
            <SelectTrigger className="w-full sm:w-[240px]" aria-label="Date range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGES.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AreaCard
          icon={Wallet}
          title="Revenue"
          value={fmtMoneyMajor(cur.revenue)}
          badge={<TrendBadge delta={Math.round(deltaPct(cur.revenue, prev.revenue))} goodness={goodnessFor("revenue", cur.revenue >= prev.revenue ? "up" : "down")} />}
          summary={`Average transaction ${fmtNaira(Math.round(aov))} · ${period.compareLabel.replace("vs ", "")} ${fmtMoneyMajor(prev.revenue)}`}
          onClick={() => navigate("performance/revenue")}
        />
        <AreaCard
          icon={Users}
          title={visitorsTitle}
          value={fmtNum(denom)}
          badge={
            <TrendBadge
              delta={Math.round(deltaPct(denom, prevDenom))}
              goodness={goodnessFor(ecom ? "orders" : "customers", denom >= prevDenom ? "up" : "down")}
            />
          }
          summary={
            ecom
              ? `AOV ${fmtNaira(Math.round(aov))} (${fmtDelta(Math.round(deltaPct(aov, prevAov)))})`
              : `From ${fmtNum(cur.enquiries)} enquiries at ${fmtPct(cur.enquiries ? (denom / cur.enquiries) * 100 : 0)} conversion`
          }
          onClick={() => navigate(visitorsMetric)}
        />
        <AreaCard
          icon={Filter}
          title="Funnel"
          value={firstStep && lastStep ? `${fmtNum(firstStep.value)} → ${fmtNum(lastStep.value)}` : "—"}
          summary={`End-to-end conversion ${fmtPct(endToEnd)} · ${REPORTING_MONTH.current} snapshot`}
          onClick={() => navigate("performance/funnel")}
        />
        <AreaCard
          icon={Megaphone}
          title="Marketing"
          value={fmtMoneyMajor(cur.spend)}
          badge={<TrendBadge delta={Math.round(deltaPct(cur.spend, prev.spend))} goodness="neutral" />}
          summary={`Blended CAC ${fmtNaira(Math.round(cac))} (${fmtDelta(Math.round(deltaPct(cac, prevCac)))})`}
          onClick={() => navigate("performance/marketing")}
        />
        <AreaCard
          icon={Globe}
          title="Website"
          value={
            business.website.connected && business.website.mobileCheckout
              ? `${fmtPct(business.website.mobileCheckout.current, 0)}`
              : "—"
          }
          badge={
            business.website.connected && business.website.mobileCheckout ? (
              <TrendBadge
                delta={Math.round(deltaPct(business.website.mobileCheckout.current, business.website.mobileCheckout.previous))}
                goodness={goodnessFor("checkoutCompletion", business.website.mobileCheckout.current >= business.website.mobileCheckout.previous ? "up" : "down")}
              />
            ) : undefined
          }
          summary={
            business.website.connected
              ? "Mobile checkout completion (was 71%) · September snapshot"
              : "No analytics connected — see what connecting unlocks"
          }
          onClick={() => navigate("performance/website")}
        />
        <AreaCard
          icon={Package}
          title={ecom ? "Products" : "Services"}
          value={topItem ? fmtMoneyMajor(topItem.revenue) : "—"}
          summary={topItem ? `${topItem.name} leads revenue · September snapshot` : "No items recorded yet"}
          onClick={() => navigate("performance/products")}
        />
        <AreaCard
          icon={Repeat}
          title="Retention"
          value={business.retention.connected && business.retention.repeatRate !== undefined ? fmtPct(business.retention.repeatRate) : "—"}
          summary={
            business.retention.connected
              ? `Repeat purchase rate · frequency ${business.retention.frequency ?? "—"}x`
              : "Not measured yet — connect a source to unlock"
          }
          onClick={() => navigate("performance/retention")}
        />
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Revenue, customers/orders and marketing figures follow the selected date range. Funnel, website, product and retention
        views reflect the {REPORTING_MONTH.current} reporting snapshot.
      </p>
    </div>
  );
}
