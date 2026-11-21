"use client";
// Local building blocks for the goals group (Screens 65–67).
// Goal resolution merges static demo goals with user-created store goals and
// session-local edits (static demo records cannot be mutated through the store).

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Flag } from "lucide-react";
import type { GoalRecord, MonthlyPoint } from "@/lib/types";
import { GOALS } from "@/lib/data/operations";
import { fmtNaira } from "@/lib/format";
import { CHART_COLORS } from "@/lib/chart-colors";

// ---------- Session-local edits for static demo goals ----------

// Storage keys keep the old "bizzgrowth-" prefix on purpose: renaming one would lose what was saved under it.
const EDITS_KEY = "bizzgrowth-goal-edits";
export const EDIT_PREFILL_KEY = "bizzgrowth-edit-goal";

type GoalEdits = Record<string, Partial<GoalRecord>>;

function readEdits(): GoalEdits {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(sessionStorage.getItem(EDITS_KEY) ?? "{}") as GoalEdits;
  } catch {
    return {};
  }
}

export function saveGoalEdit(id: string, patch: Partial<GoalRecord>) {
  const edits = readEdits();
  edits[id] = { ...edits[id], ...patch };
  try {
    sessionStorage.setItem(EDITS_KEY, JSON.stringify(edits));
  } catch {}
}

export function peekGoalEdit<T>(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function dropGoalEdit(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {}
}

/** Merge session edits into a goal record (static goals only carry edits). */
export function withEdits(goal: GoalRecord): GoalRecord {
  const patch = readEdits()[goal.id];
  return patch ? { ...goal, ...patch } : goal;
}

/** All goals for a business: static dataset records + store-created ones, edits applied. */
export function goalsForBusiness(businessId: string, storeGoals: GoalRecord[]): GoalRecord[] {
  const staticGoals = GOALS.filter((g) => g.businessId === businessId).map(withEdits);
  return [...storeGoals, ...staticGoals];
}

export function goalById(businessId: string, storeGoals: GoalRecord[], id: string): GoalRecord | undefined {
  return goalsForBusiness(businessId, storeGoals).find((g) => g.id === id);
}

// ---------- Presentation helpers ----------

const PRIORITY_STYLE = {
  high: { cls: "bg-amber-50 text-amber-700 border-amber-200", label: "High priority" },
  medium: { cls: "bg-brand-50 text-brand-700 border-brand-200", label: "Medium priority" },
  low: { cls: "bg-slate-100 text-slate-600 border-slate-200", label: "Low priority" },
} as const;

export function PriorityBadge({ priority, className }: { priority: "high" | "medium" | "low"; className?: string }) {
  const s = PRIORITY_STYLE[priority];
  return (
    <Badge variant="outline" className={`gap-1 font-normal ${s.cls} ${className ?? ""}`}>
      <Flag className="size-3" aria-hidden />
      {s.label}
    </Badge>
  );
}

export function goalProgressPct(goal: GoalRecord): number {
  if (goal.target <= 0) return 0;
  return Math.min(100, Math.round((goal.current / goal.target) * 100));
}

/** Human phrasing for the remaining gap (e.g. "approximately 11 additional customers"). */
export function remainingPhrase(goal: GoalRecord): string | null {
  const gap = goal.target - goal.current;
  if (gap <= 0) return null;
  const unit = goal.unit.trim();
  if (!unit || unit.startsWith("%")) return `an improvement of approximately ${gap} percentage points`;
  if (unit.startsWith("₦")) return `approximately ${fmtNaira(gap, { compact: true })} in additional revenue`;
  const singular = unit.replace(/s$/, "");
  return `approximately ${gap} additional ${gap === 1 ? singular : `${singular}s`}`;
}

// ---------- Goal → chart series ----------

export type GoalMetricKind = "customers" | "orders" | "revenue" | "conversion" | "efficiency";

/** Which monthly metric this goal tracks (spec: sh-1 → customers, kh-1 → orders). */
export function goalMetricKind(goal: GoalRecord): GoalMetricKind {
  if (goal.id === "goal-sh-1") return "customers";
  if (goal.id === "goal-kh-1") return "orders";
  const m = `${goal.metric} ${goal.unit}`.toLowerCase();
  if (m.includes("order")) return "orders";
  if (m.includes("customer")) return "customers";
  if (m.includes("conversion")) return "conversion";
  if (m.includes("efficiency") || m.includes("cac") || m.includes("spend")) return "efficiency";
  return "revenue";
}

const KIND_LABEL: Record<GoalMetricKind, string> = {
  customers: "New customers",
  orders: "Orders",
  conversion: "Conversion",
  efficiency: "Revenue per ₦1 of spend",
  revenue: "Revenue",
};

/** Build the progress-timeline series for a goal from business.monthly. */
export function goalSeriesFor(goal: GoalRecord, monthly: MonthlyPoint[]) {
  const kind = goalMetricKind(goal);
  const data = monthly.map((m) => {
    let value = m.revenue;
    if (kind === "customers") value = m.customers;
    else if (kind === "orders") value = m.orders ?? 0;
    else if (kind === "conversion")
      value = m.traffic && m.orders ? +((m.orders / m.traffic) * 100).toFixed(1) : m.enquiries ? +((m.customers / m.enquiries) * 100).toFixed(1) : 0;
    else if (kind === "efficiency") value = m.spend ? +((m.revenue / m.spend) * 1).toFixed(1) : 0;
    return { label: m.label, value, target: goal.target };
  });
  const valueFormatter =
    kind === "revenue"
      ? (v: number) => fmtNaira(v, { compact: true })
      : kind === "efficiency"
        ? (v: number) => `₦${v.toFixed(1)}`
        : kind === "conversion"
          ? (v: number) => `${v.toFixed(1)}%`
          : (v: number) => v.toLocaleString();
  return {
    data,
    series: [
      { key: "value", label: KIND_LABEL[kind] },
      { key: "target", label: "Target", color: CHART_COLORS.navy, dashed: true },
    ],
    valueFormatter,
  };
}
