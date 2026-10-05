"use client";
// Shared helpers for the actions / experiments screen group (screens 38–47).

import { useMemo } from "react";
import { useBizz } from "@/lib/store";
import { actionsFor, experimentsFor } from "@/lib/data/intelligence";
import type { ActionRecord, ExperimentRecord } from "@/lib/types";

// ---------- Categories (screen 38) ----------

export type ActionCategory = "High priority" | "Growth" | "Performance" | "Data" | "Experiment";

/** Simple category map by recommendation id (per prototype spec). */
export const CATEGORY_BY_REC: Record<string, ActionCategory> = {
  "rec-sh-1": "High priority",
  "rec-sh-2": "Growth",
  "rec-sh-3": "Data",
  "rec-kh-1": "High priority",
  "rec-kh-2": "Performance",
  "rec-kh-3": "Growth",
};

export function categoryForRecId(recId?: string): ActionCategory {
  return (recId && CATEGORY_BY_REC[recId]) || "Performance";
}

export const CATEGORY_CHIP_CLS: Record<ActionCategory, string> = {
  "High priority": "bg-amber-50 text-amber-700 border-amber-200",
  Growth: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Performance: "bg-blue-50 text-blue-700 border-blue-200",
  Data: "bg-slate-100 text-slate-600 border-slate-200",
  Experiment: "bg-violet-50 text-violet-700 border-violet-200",
};

// ---------- Combined records (user-created store records + static demo data) ----------

export function useCombinedActions(businessId: string): ActionRecord[] {
  const storeActions = useBizz((s) => s.actions);
  return useMemo(
    () => [...storeActions.filter((a) => a.businessId === businessId), ...actionsFor(businessId)],
    [storeActions, businessId],
  );
}

export function useCombinedExperiments(businessId: string): ExperimentRecord[] {
  const storeExperiments = useBizz((s) => s.experiments);
  return useMemo(
    () => [...storeExperiments.filter((e) => e.businessId === businessId), ...experimentsFor(businessId)],
    [storeExperiments, businessId],
  );
}

// ---------- Experiment presentation helpers ----------

const EXP_METRIC_LABEL: Record<string, string> = {
  "exp-sh-0": "Blended CAC (₦)",
  "exp-sh-1": "Instagram conversion (%)",
  "exp-kh-1": "Mobile checkout completion (%)",
};

export function metricLabelFor(exp: ExperimentRecord): string {
  return EXP_METRIC_LABEL[exp.id] ?? "Metric value";
}

export function metricFormatterFor(exp: ExperimentRecord): (v: number) => string {
  if (exp.baselineValue >= 1000) return (v: number) => `₦${Math.round(v).toLocaleString("en-NG")}`;
  return (v: number) => `${v}%`;
}

export function daysRemainingLabel(exp: ExperimentRecord): string {
  return exp.daysRemaining > 0 ? `${exp.daysRemaining} days remaining` : "Window complete";
}

export function windowProgressPct(exp: ExperimentRecord): number {
  if (exp.windowDays <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round(((exp.windowDays - exp.daysRemaining) / exp.windowDays) * 100)));
}

// ---------- Copy helpers ----------

/** Tip shown when jumping from a recommendation to Ask Your Business. */
export function askTipFor(businessId: string): string {
  return businessId === "korahome"
    ? "Tip: ask why mobile checkout completion dropped"
    : "Tip: ask why Instagram enquiries are not converting";
}

export const STATUS_LABEL: Record<string, string> = {
  "in-progress": "In progress",
  measuring: "Measuring",
  completed: "Completed",
};
