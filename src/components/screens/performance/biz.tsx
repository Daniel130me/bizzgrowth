"use client";
// Shared hook + helpers for the Performance screen group (screens 24–31).

import { useBizz } from "@/lib/store";
import { getBusiness, getPeriod } from "@/lib/data/businesses";
import { insightsFor, recommendationsFor } from "@/lib/data/intelligence";
import { fmtNaira } from "@/lib/format";
import type { Business, Insight, Recommendation } from "@/lib/types";

export function useBiz() {
  const businessId = useBizz((s) => s.businessId);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const dateRange = useBizz((s) => s.dateRange);
  const setDateRange = useBizz((s) => s.setDateRange);
  const navigate = useBizz((s) => s.navigate);
  const business = getBusiness(businessId, userWorkspace);
  const period = getPeriod(business, dateRange);
  return { businessId, business, period, dateRange, setDateRange, navigate };
}

/** ₦6.0m / ₦370k style compact money for headline values. */
export function fmtMoneyMajor(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `₦${(v / 1_000_000).toFixed(1)}m`;
  return fmtNaira(v, { compact: true });
}

/** User-created workspaces inherit their template story — intelligence falls back by type. */
function fallbackId(business: Business): string {
  return business.type === "ecommerce" ? "korahome" : "swifthaul";
}

export function insightsForBiz(business: Business): Insight[] {
  const direct = insightsFor(business.id);
  return direct.length ? direct : insightsFor(fallbackId(business));
}

export function recommendationsForBiz(business: Business): Recommendation[] {
  const direct = recommendationsFor(business.id);
  return direct.length ? direct : recommendationsFor(fallbackId(business));
}
