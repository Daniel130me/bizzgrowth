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
  const facts = useBizz((s) => s.checkup.facts);
  const manualEntries = useBizz((s) => s.manualEntries);
  const dateRange = useBizz((s) => s.dateRange);
  const setDateRange = useBizz((s) => s.setDateRange);
  const navigate = useBizz((s) => s.navigate);
  const business = getBusiness(businessId, userWorkspace, facts, manualEntries);
  const period = getPeriod(business, dateRange);
  return { businessId, business, period, dateRange, setDateRange, navigate };
}

/** ₦6.0m / ₦370k style compact money for headline values. */
export function fmtMoneyMajor(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `₦${(v / 1_000_000).toFixed(1)}m`;
  return fmtNaira(v, { compact: true });
}

/**
 * User-created workspaces inherit their template story — intelligence falls back by type.
 * EXCEPTION: a user's OWN workspace never inherits sample intelligence.
 */
function fallbackId(business: Business): string | null {
  if (business.id === "user-workspace") return null;
  return business.type === "ecommerce" ? "korahome" : "swifthaul";
}

export function insightsForBiz(business: Business): Insight[] {
  const direct = insightsFor(business.id);
  const fb = fallbackId(business);
  return direct.length ? direct : fb ? insightsFor(fb) : [];
}

export function recommendationsForBiz(business: Business): Recommendation[] {
  const direct = recommendationsFor(business.id);
  const fb = fallbackId(business);
  return direct.length ? direct : fb ? recommendationsFor(fb) : [];
}
