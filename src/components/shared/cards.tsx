"use client";
// Reusable business cards — metric, intelligence, recommendation, action, alert.

import React from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle,
  ArrowRight,
  Lightbulb,
  Sparkles,
  TrendingUp,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActionRecord, AlertItem, Goodness, Insight, Recommendation } from "@/lib/types";
import { ConfidenceBadge, ExecutionTypeBadge, ImpactBadge, ProvenanceBadge, SeverityBadge, StatusBadge, TrendBadge } from "./badges";

// ---------- Metric card ----------

export function MetricCard({
  label,
  value,
  delta,
  goodness = "neutral",
  provenance,
  source,
  onClick,
  footnote,
  className,
}: {
  label: string;
  value: string;
  delta?: number;
  goodness?: Goodness;
  provenance?: "measured" | "user-supplied" | "estimated" | "ai-interpretation";
  source?: string;
  onClick?: () => void;
  footnote?: string;
  className?: string;
}) {
  const inner = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {delta !== undefined && <TrendBadge delta={delta} goodness={goodness} />}
      </div>
      <p className="mt-1 text-2xl font-semibold tracking-tight tnum">{value}</p>
      {footnote ? <p className="mt-0.5 text-xs text-muted-foreground">{footnote}</p> : null}
      {provenance ? (
        <div className="mt-2">
          <ProvenanceBadge provenance={provenance} source={source} />
        </div>
      ) : null}
    </>
  );
  if (onClick) {
    return (
      <Card
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => e.key === "Enter" && onClick()}
        className={cn("cursor-pointer p-4 transition-colors hover:border-blue-300 hover:bg-blue-50/40 focus-visible:ring-2 focus-visible:ring-ring", className)}
      >
        {inner}
      </Card>
    );
  }
  return <Card className={cn("p-4", className)}>{inner}</Card>;
}

// ---------- Intelligence cards ----------

const TYPE_STYLE = {
  problem: { icon: <AlertTriangle className="size-4" aria-hidden />, cls: "border-violet-200 bg-violet-50/50", chip: "text-violet-700 bg-violet-100" },
  opportunity: { icon: <Lightbulb className="size-4" aria-hidden />, cls: "border-amber-200 bg-amber-50/60", chip: "text-amber-700 bg-amber-100" },
  improvement: { icon: <TrendingUp className="size-4" aria-hidden />, cls: "border-emerald-200 bg-emerald-50/50", chip: "text-emerald-700 bg-emerald-100" },
  watch: { icon: <Eye className="size-4" aria-hidden />, cls: "border-slate-200 bg-slate-50", chip: "text-slate-600 bg-slate-200/70" },
} as const;

const IMPORTANCE_LABEL = { critical: "Critical", high: "High importance", medium: "Medium importance", low: "Low importance" } as const;

export function InsightCard({ insight, onOpen }: { insight: Insight; onOpen: () => void }) {
  const s = TYPE_STYLE[insight.type];
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className={cn("group cursor-pointer border p-0 transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring", s.cls)}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide", s.chip)}>
            {s.icon}
            {insight.type}
          </span>
          <span className="text-[11px] font-medium text-muted-foreground">{IMPORTANCE_LABEL[insight.importance]}</span>
          <span className="ml-auto text-[11px] text-muted-foreground">{insight.date}</span>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <h3 className="text-[15px] font-semibold leading-snug">{insight.title}</h3>
        <p className="mt-1.5 line-clamp-3 text-sm text-muted-foreground">{insight.summary}</p>
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-2 border-t bg-white/50 py-2.5">
        <ConfidenceBadge level={insight.confidenceLevel} value={insight.confidence} />
        <span className="inline-flex items-center gap-1 text-xs font-medium text-violet-700 group-hover:underline">
          View diagnosis <ArrowRight className="size-3.5" aria-hidden />
        </span>
      </CardFooter>
    </Card>
  );
}

export function RecommendationCard({ rec, onOpen, onStart, right }: { rec: Recommendation; onOpen: () => void; onStart: () => void; right?: React.ReactNode }) {
  return (
    <Card className="p-0">
      <CardContent className="pt-5">
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles className="size-4 text-violet-600" aria-hidden />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-violet-700">Recommendation</span>
          <ConfidenceBadge level={rec.confidence >= 75 ? "high" : rec.confidence >= 50 ? "medium" : "low"} value={rec.confidence} />
          <ImpactBadge impact={rec.impact} />
          <StatusBadge status={rec.status} />
        </div>
        <h3
          role="button"
          tabIndex={0}
          onClick={onOpen}
          onKeyDown={(e) => e.key === "Enter" && onOpen()}
          className="mt-2 cursor-pointer text-[15px] font-semibold leading-snug hover:text-blue-700 hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          {rec.title}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{rec.recommendation}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <ExecutionTypeBadge type={rec.executionType} />
          <span>Primary metric: {rec.primaryMetric}</span>
          <span>· Window: {rec.measurementWindow}</span>
        </div>
      </CardContent>
      <CardFooter className="flex items-center justify-between gap-2 border-t bg-slate-50/60 py-3">
        {right ?? (
          <>
            <Button variant="ghost" size="sm" onClick={onOpen}>
              View details
            </Button>
            <Button size="sm" onClick={onStart}>
              Start action
            </Button>
          </>
        )}
      </CardFooter>
    </Card>
  );
}

export function ActionCard({ action, onOpen }: { action: ActionRecord; onOpen: () => void }) {
  const done = action.checklist.filter((c) => c.done).length;
  const pct = action.checklist.length ? Math.round((done / action.checklist.length) * 100) : action.status === "completed" ? 100 : 0;
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className="cursor-pointer p-4 transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold leading-snug">{action.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Owner: {action.owner} · Due {action.due}
          </p>
        </div>
        <StatusBadge status={action.status} className="shrink-0" />
      </div>
      {action.checklist.length > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {done} of {action.checklist.length} steps complete
            </span>
            <span className="tnum">{pct}%</span>
          </div>
          <Progress value={pct} className="mt-1.5 h-1.5" />
        </div>
      )}
    </Card>
  );
}

export function AlertCard({ alert, onOpen }: { alert: AlertItem; onOpen: () => void }) {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className="cursor-pointer p-4 transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <SeverityBadge severity={alert.severity} />
          <h3 className="mt-2 text-[15px] font-semibold leading-snug">{alert.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{alert.whatHappened}</p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{alert.time}</span>
      </div>
    </Card>
  );
}

export function GoalProgressCard({
  title,
  current,
  target,
  unit,
  deadline,
  status,
  onOpen,
}: {
  title: string;
  current: number;
  target: number;
  unit: string;
  deadline: string;
  status: string;
  onOpen: () => void;
}) {
  const pct = Math.min(100, Math.round((current / Math.max(target, 1)) * 100));
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className="cursor-pointer p-4 transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[15px] font-semibold">{title}</h3>
        <StatusBadge status={status} />
      </div>
      <p className="mt-2 text-2xl font-semibold tnum">
        {current}
        <span className="text-base font-normal text-muted-foreground"> / {target} {unit}</span>
      </p>
      <Progress value={pct} className="mt-2 h-2" />
      <p className="mt-2 text-xs text-muted-foreground">Deadline {deadline}</p>
    </Card>
  );
}
