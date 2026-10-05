"use client";
// Screen 31 — Customer / Retention Performance.
// Service: honest limitation. Ecommerce: new vs repeat, repeat rate, frequency.

import React from "react";
import { ArrowRight, Repeat, UserPlus, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProvenanceBadge } from "@/components/shared/badges";
import { DonutChart } from "@/components/shared/charts";
import { InfoBanner, KeyValue, PageHeader, SectionCard } from "@/components/shared/layout";
import { EmptyState } from "@/components/shared/states";
import { CHART_COLORS } from "@/lib/chart-colors";
import { deltaPct, fmtDelta, fmtNaira, fmtNum, fmtPct } from "@/lib/format";
import { useBiz } from "./biz";
import type { ScreenProps } from "../view-types";

export default function RetentionPerformance(_props: ScreenProps) {
  const { business, navigate } = useBiz();
  const ecom = business.type === "ecommerce";
  const retention = business.retention;

  // ---------- Service: limitation state ----------
  if (!retention.connected) {
    return (
      <div className="mx-auto w-full max-w-4xl space-y-5">
        <PageHeader
          title="Customer retention"
          description="Repeat behaviour, retention and lifetime patterns."
          back={
            <Button variant="ghost" size="sm" className="-ml-2 mb-1" onClick={() => navigate("performance")}>
              <ArrowRight className="mr-1.5 size-4 rotate-180" aria-hidden /> Performance
            </Button>
          }
        />
        <EmptyState
          icon={<Repeat className="size-5" />}
          title="Retention is not measured for this workspace yet"
          description={
            retention.note ??
            "Repeat-purchase tracking is not available for this workspace yet. Connect a CRM or payments source to unlock it."
          }
          actions={
            <>
              <Button onClick={() => navigate("integrations")}>Connect a CRM or payments source</Button>
              <Button variant="outline" onClick={() => navigate("manual-entry")}>
                Enter data manually
              </Button>
            </>
          }
        />
        <SectionCard title="Why this section is empty" description="Retention needs customer-level history, not monthly totals.">
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Monthly totals answer how many customers arrived. Retention answers what they did next — whether they came back, how
              often, and at what value. That requires customer-level records linked across months.
            </p>
            <p>
              Corporate accounts already show the strongest repeat usage, but without enquiry-level retention data the platform will
              not estimate numbers on your behalf.
            </p>
            <KeyValue label="Data coverage">
              <span className="tnum">{business.dataCoverage.areas.find((a) => a.area === "Customers")?.coverage ?? "—"}%</span>
              <span className="ml-2">for customer-level data</span>
            </KeyValue>
          </div>
        </SectionCard>
      </div>
    );
  }

  // ---------- Ecommerce: full retention view ----------
  const newC = retention.newCustomers ?? 0;
  const repeatC = retention.repeatCustomers ?? 0;
  const totalC = newC + repeatC;

  // Channel/source observation (derived from measured channel data, labelled as interpretation).
  const directOrders = business.channels.find((c) => c.id === "direct")?.orders ?? 0;
  const organicOrders = business.channels.find((c) => c.id === "organic")?.orders ?? 0;
  const totalOrders = business.channels.reduce((a, c) => a + (c.orders ?? 0), 0);

  // Average order value (calculated).
  const lastMonth = business.monthly[business.monthly.length - 1];
  const prevMonth = business.monthly[business.monthly.length - 2];
  const aov = lastMonth && lastMonth.orders ? lastMonth.revenue / lastMonth.orders : 0;
  const prevAov = prevMonth && prevMonth.orders ? prevMonth.revenue / prevMonth.orders : 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <PageHeader
        title="Customer retention"
        description="New vs repeat customers, purchase frequency and value — September snapshot."
        back={
          <Button variant="ghost" size="sm" className="-ml-2 mb-1" onClick={() => navigate("performance")}>
            <ArrowRight className="mr-1.5 size-4 rotate-180" aria-hidden /> Performance
          </Button>
        }
      />

      {!business.lastSyncOk && (
        <InfoBanner tone="warning" title="Data freshness notice">
          {business.lastSyncNote} — customer-level figures below may lag the live store until the sync is restored.{" "}
          <button onClick={() => navigate("data-quality")} className="font-medium text-blue-700 hover:underline">
            View data quality
          </button>
        </InfoBanner>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <UserPlus className="size-4" aria-hidden />
            <p className="text-xs font-medium uppercase tracking-wide">New customers</p>
          </div>
          <p className="mt-1 text-2xl font-semibold tnum">{fmtNum(newC)}</p>
          <p className="mt-2 text-xs text-muted-foreground">{totalC ? fmtPct((newC / totalC) * 100, 0) : "—"} of customers</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Repeat className="size-4" aria-hidden />
            <p className="text-xs font-medium uppercase tracking-wide">Repeat customers</p>
          </div>
          <p className="mt-1 text-2xl font-semibold tnum">{fmtNum(repeatC)}</p>
          <p className="mt-2 text-xs text-muted-foreground">{totalC ? fmtPct((repeatC / totalC) * 100, 0) : "—"} of customers</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="size-4" aria-hidden />
            <p className="text-xs font-medium uppercase tracking-wide">Repeat purchase rate</p>
          </div>
          <p className="mt-1 text-2xl font-semibold tnum">{fmtPct(retention.repeatRate ?? 0)}</p>
          <div className="mt-2">
            <ProvenanceBadge provenance="measured" source="Shopify customer records" />
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Wallet className="size-4" aria-hidden />
            <p className="text-xs font-medium uppercase tracking-wide">Purchase frequency</p>
          </div>
          <p className="mt-1 text-2xl font-semibold tnum">{fmtPct(retention.frequency ?? 0, 2).replace("%", "")}x</p>
          <p className="mt-2 text-xs text-muted-foreground">Orders per customer</p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="New vs repeat customers" description="Customer split for the current period.">
          <DonutChart
            data={[
              { name: "New customers", value: newC, color: CHART_COLORS.blue },
              { name: "Repeat customers", value: repeatC, color: CHART_COLORS.green },
            ]}
            valueFormatter={(v) => fmtNum(Math.round(v))}
          />
        </SectionCard>

        <SectionCard title="Value and source patterns" description="Calculated from measured order data.">
          <div className="space-y-3">
            <KeyValue label="Average order value">
              <span className="tnum font-medium">{fmtNaira(Math.round(aov))}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                ({fmtDelta(Math.round(deltaPct(aov, prevAov)))} vs August)
              </span>
            </KeyValue>
            <KeyValue label="Repeat share of orders">
              <span className="tnum font-medium">
                {totalOrders ? fmtPct(((directOrders + organicOrders) / totalOrders) * 100, 0) : "—"}
              </span>
              <span className="ml-2 text-xs text-muted-foreground">arrive via Organic Social ({fmtNum(organicOrders)}) and Direct / Repeat ({fmtNum(directOrders)})</span>
            </KeyValue>
            <div className="rounded-lg border border-violet-200 bg-violet-50/60 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <ProvenanceBadge provenance="ai-interpretation" />
                <p className="text-sm text-violet-900/90">
                  The {fmtPct(retention.repeatRate ?? 0)} repeat rate is consistent with the strong Direct / Repeat and Organic
                  order shares — a healthy signal that does not depend on paid traffic.
                </p>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="What retention data would unlock next">
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            With addresses and segments connected, retention could be split by acquisition source and lifetime value — turning the
            current CAC comparison into LTV-based budget decisions.
          </p>
          <Button variant="outline" size="sm" onClick={() => navigate("data")}>
            Improve data coverage
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
