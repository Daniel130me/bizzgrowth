"use client";
// Screen 27 — Marketing Performance. Channel table with calculated CAC / ROAS.

import React from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProvenanceBadge } from "@/components/shared/badges";
import { ProvenanceLegend } from "@/components/shared/evidence";
import { InfoBanner, PageHeader, SectionCard } from "@/components/shared/layout";
import { fmtNaira, fmtNum, fmtPct } from "@/lib/format";
import { useBiz } from "./biz";
import type { ScreenProps } from "../view-types";

export default function MarketingPerformance(_props: ScreenProps) {
  const { business, navigate } = useBiz();
  const ecom = business.type === "ecommerce";
  const channels = business.channels;

  const totals = channels.reduce(
    (acc, c) => ({
      spend: acc.spend + c.spend,
      enquiries: acc.enquiries + c.enquiries,
      customers: acc.customers + c.customers,
      orders: acc.orders + (c.orders ?? 0),
      revenue: acc.revenue + c.revenue,
    }),
    { spend: 0, enquiries: 0, customers: 0, orders: 0, revenue: 0 }
  );
  const blendedDenom = ecom ? totals.orders : totals.customers;
  const blendedCac = blendedDenom ? totals.spend / blendedDenom : 0;
  const blendedRoas = totals.spend ? totals.revenue / totals.spend : 0;

  // Insight callout — derived from measured channel data, phrased per workspace type.
  const instagram = channels.find((c) => c.id === "instagram");
  const insightCopy = ecom
    ? `Instagram Ads drive ${fmtPct(totals.orders && instagram ? ((instagram.orders ?? 0) / totals.orders) * 100 : 0, 0)} of orders at the highest CAC (₦${Math.round(instagram?.cac ?? 0).toLocaleString("en-NG")}).`
    : "Instagram produces the most enquiries but the weakest customer conversion.";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <PageHeader
        title="Marketing performance"
        description={`Channel spend, volume and efficiency for ${business.name}. Select a channel for campaigns, trends and provenance.`}
        back={
          <Button variant="ghost" size="sm" className="-ml-2 mb-1" onClick={() => navigate("performance")}>
            <ArrowRight className="mr-1.5 size-4 rotate-180" aria-hidden /> Performance
          </Button>
        }
      />

      <InfoBanner tone="warning" title="Channel insight">
        <div className="flex flex-wrap items-center gap-2">
          <span>{insightCopy}</span>
          <ProvenanceBadge provenance={ecom ? "ai-interpretation" : "measured"} />
        </div>
      </InfoBanner>

      <SectionCard
        title="Channel performance"
        description={ecom ? "Attributed to Shopify orders for the current period." : "September channel totals (manual + connected sources)."}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-2.5 pr-4 font-medium">Channel</th>
                <th className="py-2.5 pr-4 text-right font-medium">Spend</th>
                <th className="py-2.5 pr-4 text-right font-medium">{ecom ? "Orders" : "Enquiries"}</th>
                <th className="py-2.5 pr-4 text-right font-medium">Customers</th>
                <th className="py-2.5 pr-4 text-right font-medium">Revenue</th>
                <th className="py-2.5 pr-4 text-right font-medium">{ecom ? "Cost per order" : "CAC"}</th>
                <th className="py-2.5 pr-4 text-right font-medium">Conversion</th>
                <th className="py-2.5 pr-4 text-right font-medium">ROAS</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((c) => {
                const denom = ecom ? c.orders ?? 0 : c.customers;
                const cac = denom > 0 ? (ecom ? (c.spend > 0 ? c.spend / denom : 0) : c.cac) : 0;
                const conversion: number | null = ecom ? null : c.conversion;
                return (
                  <tr
                    key={c.id}
                    tabIndex={0}
                    onClick={() => navigate(`performance/marketing/${c.id}`)}
                    onKeyDown={(e) => e.key === "Enter" && navigate(`performance/marketing/${c.id}`)}
                    aria-label={`${c.name} — open channel detail`}
                    className="cursor-pointer border-b transition-colors last:border-0 hover:bg-slate-50 focus-visible:bg-slate-50"
                  >
                    <td className="py-3 pr-4">
                      <span className="font-medium">{c.name}</span>
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                        {c.kind}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right tnum">{c.spend > 0 ? fmtNaira(c.spend) : "—"}</td>
                    <td className="py-3 pr-4 text-right tnum">{ecom ? fmtNum(c.orders ?? 0) : fmtNum(c.enquiries)}</td>
                    <td className="py-3 pr-4 text-right tnum">{!ecom ? fmtNum(c.customers) : "—"}</td>
                    <td className="py-3 pr-4 text-right tnum">{fmtNaira(c.revenue)}</td>
                    <td className="py-3 pr-4 text-right tnum">{cac > 0 ? fmtNaira(Math.round(cac)) : "—"}</td>
                    <td className="py-3 pr-4 text-right tnum">{conversion !== null && conversion > 0 ? fmtPct(conversion) : "—"}</td>
                    <td className="py-3 pr-4 text-right tnum">{c.spend > 0 ? `${(c.revenue / c.spend).toFixed(1)}x` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t bg-slate-50/70 font-medium">
                <td className="py-3 pr-4">All channels</td>
                <td className="py-3 pr-4 text-right tnum">{fmtNaira(totals.spend)}</td>
                <td className="py-3 pr-4 text-right tnum">{ecom ? fmtNum(totals.orders) : fmtNum(totals.enquiries)}</td>
                <td className="py-3 pr-4 text-right tnum">{!ecom ? fmtNum(totals.customers) : "—"}</td>
                <td className="py-3 pr-4 text-right tnum">{fmtNaira(totals.revenue)}</td>
                <td className="py-3 pr-4 text-right tnum">{blendedCac > 0 ? fmtNaira(Math.round(blendedCac)) : "—"}</td>
                <td className="py-3 pr-4 text-right tnum">
                  {!ecom && totals.enquiries ? fmtPct((totals.customers / totals.enquiries) * 100) : "—"}
                </td>
                <td className="py-3 pr-4 text-right tnum">{blendedRoas > 0 ? `${blendedRoas.toFixed(1)}x` : "—"}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-4 space-y-2 border-t pt-3">
          <ProvenanceLegend />
          <p className="text-xs text-muted-foreground">
            {ecom
              ? "Spend is measured from ad platforms; orders and revenue from Shopify. Per-channel customers and conversion are not available from attribution — shown as “—”. CAC and ROAS are calculated."
              : "Spend and enquiries are measured; customers and revenue are user-supplied monthly entries. CAC, conversion and ROAS are calculated from those figures."}
          </p>
        </div>
      </SectionCard>
    </div>
  );
}
