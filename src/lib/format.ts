// Formatting helpers — Nigerian Naira demo context
import type { Goodness } from "./types";

export function fmtNaira(value: number, opts?: { compact?: boolean }): string {
  if (opts?.compact) {
    if (Math.abs(value) >= 1_000_000) return `₦${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 2).replace(/\.00$/, "")}m`;
    if (Math.abs(value) >= 1_000) return `₦${(value / 1_000).toFixed(0)}k`;
    return `₦${value}`;
  }
  return `₦${value.toLocaleString("en-NG")}`;
}

export function fmtNum(value: number): string {
  return value.toLocaleString("en-NG");
}

export function fmtPct(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

export function fmtDelta(value: number, digits = 0): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(digits)}%`;
}

export function fmtDate(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? "T12:00:00" : ""));
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function fmtDateShort(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? "T12:00:00" : ""));
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Whether a metric going UP is a good thing (CAC up = bad, revenue up = good). */
export const GOODNESS_MAP: Record<string, Goodness> = {
  revenue: "good",
  customers: "good",
  enquiries: "good",
  orders: "good",
  traffic: "good",
  conversion: "good",
  repeatRate: "good",
  aov: "good",
  spend: "neutral",
  cac: "bad",
  churn: "bad",
  paymentFailures: "bad",
  checkoutCompletion: "good",
};

export function goodnessFor(metric: string, direction: "up" | "down"): Goodness {
  const base = GOODNESS_MAP[metric] ?? "neutral";
  if (base === "neutral") return "neutral";
  if (base === "good") return direction === "up" ? "good" : "bad";
  return direction === "up" ? "bad" : "good";
}

export function deltaPct(current: number, previous: number): number {
  if (!previous) return 0;
  return ((current - previous) / previous) * 100;
}
