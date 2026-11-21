"use client";
// Shared helpers for the actions / experiments screen group (screens 38–47).

import { useMemo } from "react";
import { useBizz } from "@/lib/store";
import { actionsFor, experimentsFor } from "@/lib/data/intelligence";
import { timelineFor } from "@/lib/data/operations";
import { daysSince, formatCount, stepProgress } from "@/lib/coach";
import type { ActionRecord, ExperimentRecord, TimelineEvent } from "@/lib/types";

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
  Performance: "bg-teal-50 text-teal-700 border-teal-200",
  Data: "bg-slate-100 text-slate-600 border-slate-200",
  Experiment: "bg-brand-50 text-brand-700 border-brand-200",
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
  const steps = useBizz((s) => s.coach.steps);
  return useMemo(
    () => [
      // Real experiments count down from the day they started. One from an accepted
      // step counts only the days it ran, as its card does (a pause doesn't use any up).
      ...storeExperiments
        .filter((e) => e.businessId === businessId)
        .map((e) => {
          if (e.status === "complete") return { ...e, daysRemaining: 0 };
          const st = e.coachStepId ? steps.find((x) => x.id === e.coachStepId) : undefined;
          return { ...e, daysRemaining: st ? stepProgress(st).daysLeft : Math.max(0, e.windowDays - daysSince(e.startedAt)) };
        }),
      ...experimentsFor(businessId),
    ],
    [storeExperiments, steps, businessId],
  );
}

/** Sample timeline events plus the ones the owner recorded (changes, check-ins), newest first. */
export function useCombinedTimeline(businessId: string): TimelineEvent[] {
  const storeEvents = useBizz((s) => s.timelineEvents);
  return useMemo(
    () => [...storeEvents.filter((e) => e.businessId === businessId), ...timelineFor(businessId)].sort((a, b) => b.date.localeCompare(a.date)),
    [storeEvents, businessId],
  );
}

// ---------- Experiment presentation helpers ----------

const EXP_METRIC_LABEL: Record<string, string> = {
  "exp-sh-0": "Blended CAC (₦)",
  "exp-sh-1": "Instagram conversion (%)",
  "exp-kh-1": "Mobile checkout completion (%)",
};

export function metricLabelFor(exp: ExperimentRecord): string {
  if (exp.unit) return exp.watchMetrics[0] ?? "What you counted";
  return EXP_METRIC_LABEL[exp.id] ?? "Metric value";
}

export function metricFormatterFor(exp: ExperimentRecord): (v: number) => string {
  if (exp.unit) {
    const unit = exp.unit;
    return (v: number) => formatCount(v, unit);
  }
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
