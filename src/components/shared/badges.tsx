"use client";
// Semantic badges — provenance, confidence, trends, status.
// Meaning is never communicated by colour alone (icon + label always included).

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeInfo,
  Calculator,
  CheckCircle2,
  CircleAlert,
  Flame,
  Info,
  Lightbulb,
  Minus,
  Ruler,
  Sparkles,
  UserRound,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConfidenceLevel, Goodness, Provenance } from "@/lib/types";

const PROV_STYLE: Record<Provenance, { label: string; icon: React.ReactNode; cls: string; tip: string }> = {
  measured: {
    label: "Measured",
    icon: <Ruler className="size-3" aria-hidden />,
    // Teal, not brand blue: brand blue marks the AI's own interpretation below.
    cls: "bg-teal-50 text-teal-700 border-teal-200",
    tip: "Directly retrieved from a connected source or recorded measurement.",
  },
  "user-supplied": {
    label: "User supplied",
    icon: <UserRound className="size-3" aria-hidden />,
    cls: "bg-slate-100 text-slate-700 border-slate-200",
    tip: "Manually provided by someone in your team.",
  },
  estimated: {
    label: "Estimated",
    icon: <Calculator className="size-3" aria-hidden />,
    cls: "bg-amber-50 text-amber-700 border-amber-200",
    tip: "Approximate or calculated from other values.",
  },
  "ai-interpretation": {
    label: "AI interpretation",
    icon: <Sparkles className="size-3" aria-hidden />,
    cls: "bg-brand-50 text-brand-700 border-brand-200",
    tip: "A conclusion produced by reasoning over the available evidence — not measured data.",
  },
};

export function ProvenanceBadge({ provenance, source, className }: { provenance: Provenance; source?: string; className?: string }) {
  const s = PROV_STYLE[provenance];
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={cn("gap-1 font-normal", s.cls, className)}>
            {s.icon}
            {s.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-64 text-xs">
          <p className="font-medium">{s.label}</p>
          <p className="text-slate-200">{s.tip}</p>
          {source ? <p className="mt-1 text-slate-200">Source: {source}</p> : null}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const CONF_STYLE: Record<ConfidenceLevel, { cls: string; tip: string }> = {
  high: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", tip: "Strong evidence and data coverage support this." },
  medium: { cls: "bg-amber-50 text-amber-700 border-amber-200", tip: "Useful signal, but some information is missing." },
  low: { cls: "bg-slate-100 text-slate-600 border-slate-200", tip: "Not enough evidence yet to isolate the cause. This is not an error — improving data coverage will raise it." },
};

export function ConfidenceBadge({ level, value, className }: { level: ConfidenceLevel; value?: number; className?: string }) {
  const s = CONF_STYLE[level];
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={cn("gap-1 font-normal", s.cls, className)}>
            <BadgeInfo className="size-3" aria-hidden />
            {value !== undefined ? `${value}% confidence` : `${level[0].toUpperCase()}${level.slice(1)} confidence`}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-64 text-xs">{s.tip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Trend badge — colour reflects whether the change is GOOD for the business, not just direction. */
export function TrendBadge({ delta, goodness, suffix = "", className }: { delta: number; goodness: Goodness; suffix?: string; className?: string }) {
  const dir = delta > 0.05 ? "up" : delta < -0.05 ? "down" : "flat";
  const color =
    goodness === "good"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : goodness === "bad"
        ? "bg-red-50 text-red-700 border-red-200"
        : "bg-slate-100 text-slate-600 border-slate-200";
  const Icon = dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : Minus;
  const label = dir === "flat" ? "No real change" : `${dir === "up" ? "+" : "−"}${Math.abs(delta).toFixed(Math.abs(delta) < 10 ? 1 : 0)}%${suffix}`;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium tnum", color, className)}>
      <Icon className="size-3" aria-hidden />
      {label}
    </span>
  );
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  "in-progress": { label: "In progress", cls: "bg-brand-50 text-brand-700 border-brand-200" },
  measuring: { label: "Measuring", cls: "bg-teal-50 text-teal-700 border-teal-200" },
  completed: { label: "Completed", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  running: { label: "Running", cls: "bg-brand-50 text-brand-700 border-brand-200" },
  complete: { label: "Complete", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  open: { label: "Open", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  resolved: { label: "Resolved", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  dismissed: { label: "Dismissed", cls: "bg-slate-100 text-slate-500 border-slate-200" },
  saved: { label: "Saved for later", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  active: { label: "Active", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  "at-risk": { label: "At risk", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  draft: { label: "Draft", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  connected: { label: "Connected", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  available: { label: "Available", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  syncing: { label: "Syncing…", cls: "bg-brand-50 text-brand-700 border-brand-200" },
  error: { label: "Error — action needed", cls: "bg-red-50 text-red-700 border-red-200" },
  invited: { label: "Invited", cls: "bg-amber-50 text-amber-700 border-amber-200" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const s = STATUS_MAP[status] ?? { label: status, cls: "bg-slate-100 text-slate-600 border-slate-200" };
  return (
    <Badge variant="outline" className={cn("gap-1 font-normal", s.cls, className)}>
      {(status === "resolved" || status === "completed" || status === "complete") && <CheckCircle2 className="size-3" aria-hidden />}
      {s.label}
    </Badge>
  );
}

const SEVERITY_MAP = {
  critical: { label: "Critical", icon: <CircleAlert className="size-3" />, cls: "bg-red-50 text-red-700 border-red-200" },
  warning: { label: "Warning", icon: <CircleAlert className="size-3" />, cls: "bg-amber-50 text-amber-700 border-amber-200" },
  opportunity: { label: "Opportunity", icon: <Lightbulb className="size-3" />, cls: "bg-amber-50 text-amber-700 border-amber-200" },
  info: { label: "Information", icon: <Info className="size-3" />, cls: "bg-brand-50 text-brand-700 border-brand-200" },
} as const;

export function SeverityBadge({ severity, className }: { severity: keyof typeof SEVERITY_MAP; className?: string }) {
  const s = SEVERITY_MAP[severity];
  return (
    <Badge variant="outline" className={cn("gap-1 font-normal", s.cls, className)}>
      {s.icon}
      {s.label}
    </Badge>
  );
}

const IMPACT_CLS = {
  high: "bg-emerald-50 text-emerald-700 border-emerald-200",
  medium: "bg-amber-50 text-amber-700 border-amber-200",
  low: "bg-slate-100 text-slate-600 border-slate-200",
} as const;

export function ImpactBadge({ impact, className }: { impact: "high" | "medium" | "low"; className?: string }) {
  return (
    <Badge variant="outline" className={cn("gap-1 font-normal", IMPACT_CLS[impact], className)}>
      <Flame className="size-3" aria-hidden />
      Impact: {impact}
    </Badge>
  );
}

export function EffortBadge({ effort, className }: { effort: "high" | "medium" | "low"; className?: string }) {
  return (
    <Badge variant="outline" className={cn("gap-1 font-normal bg-slate-100 text-slate-600 border-slate-200", className)}>
      <Eye className="size-3" aria-hidden />
      Effort: {effort}
    </Badge>
  );
}

const EXEC_MAP = {
  guided: { label: "Guided — platform explains exactly what to change", icon: <Lightbulb className="size-3" /> },
  human: { label: "Human action required", icon: <UserRound className="size-3" /> },
  connected: { label: "Automatic / connected execution", icon: <Sparkles className="size-3" /> },
} as const;

export function ExecutionTypeBadge({ type, className }: { type: keyof typeof EXEC_MAP; className?: string }) {
  const s = EXEC_MAP[type];
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={cn("gap-1 font-normal bg-brand-50 text-brand-700 border-brand-200", className)}>
            {s.icon}
            {type === "guided" ? "Guided" : type === "human" ? "Human action" : "Automatic"}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-64 text-xs">{s.label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
