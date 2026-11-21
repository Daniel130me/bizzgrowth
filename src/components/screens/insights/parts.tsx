"use client";
// Local building blocks for the insights group (Screens 32–37).
// Keeps type presentation, provenance-fact linking and severity accents in one place.

import type { AlertItem, EvidenceItem, Insight } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { provenanceFor } from "@/lib/data/operations";
import { AlertTriangle, ArrowLeft, CircleAlert, Info, Lightbulb } from "lucide-react";

// ---------- Insight type presentation ----------

export const INSIGHT_TYPE_META = {
  problem: { eyebrow: "Problem diagnosis", text: "text-brand-600", chip: "bg-brand-100 text-brand-700" },
  opportunity: { eyebrow: "Opportunity", text: "text-amber-600", chip: "bg-amber-100 text-amber-700" },
  improvement: { eyebrow: "Improvement detected", text: "text-emerald-600", chip: "bg-emerald-100 text-emerald-700" },
  watch: { eyebrow: "Watch signal", text: "text-slate-500", chip: "bg-slate-200/70 text-slate-600" },
} as const;

export const IMPORTANCE_LABEL: Record<Insight["importance"], string> = {
  critical: "Critical",
  high: "High importance",
  medium: "Medium importance",
  low: "Low importance",
};

const IMPORTANCE_ORDER: Record<Insight["importance"], number> = { critical: 0, high: 1, medium: 2, low: 3 };

/** Feed order: most important first, newest first within an importance level. */
export function sortInsights(insights: Insight[]): Insight[] {
  return [...insights].sort((a, b) => {
    const w = IMPORTANCE_ORDER[a.importance] - IMPORTANCE_ORDER[b.importance];
    if (w !== 0) return w;
    return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
  });
}

// ---------- Provenance fact linking ----------

const FACT_STOPWORDS = new Set(["september", "august", "the", "and", "for", "per", "vs", "rate"]);

function factTokens(label: string): string[] {
  return label
    .toLowerCase()
    .replace(/[→()×+:]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !FACT_STOPWORDS.has(w));
}

/**
 * Attach provenance-record links to evidence rows when a matching fact exists
 * in the same workspace. Only exact label overlap is matched — conservative by
 * design, so a row never links to an unrelated provenance record.
 */
export function evidenceWithFacts(businessId: string, items: EvidenceItem[]): EvidenceItem[] {
  const facts = provenanceFor(businessId);
  return items.map((e) => {
    if (e.factId) return e;
    const hay = `${e.label} ${e.value} ${e.source}`.toLowerCase();
    const match = facts.find((f) => {
      const tokens = factTokens(f.label);
      return tokens.length > 0 && tokens.every((t) => hay.includes(t));
    });
    return match ? { ...e, factId: match.id } : e;
  });
}

// ---------- Metric drill-down slugs ----------

/** Map a metric name to a metric drill-down slug. Null = no drill-down page. */
export function metricSlugFor(metric: string | undefined): string | null {
  if (!metric) return null;
  const m = metric.toLowerCase();
  if (m.includes("conversion")) return "conversion";
  if (m.includes("cac") || m.includes("cost per customer")) return "cac";
  if (m.includes("revenue")) return "revenue";
  if (m.includes("enquir")) return "enquiries";
  if (m.includes("customer")) return "customers";
  return null;
}

// ---------- Alert severity accents ----------

export function severityAccent(severity: AlertItem["severity"]): {
  border: string;
  label: string;
  bg: string;
  icon: React.ReactNode;
} {
  switch (severity) {
    case "critical":
      return { border: "border-l-red-500", label: "text-red-700", bg: "bg-red-50/50", icon: <CircleAlert className="size-3.5" aria-hidden /> };
    case "warning":
      return { border: "border-l-amber-500", label: "text-amber-700", bg: "bg-amber-50/50", icon: <AlertTriangle className="size-3.5" aria-hidden /> };
    case "opportunity":
      return { border: "border-l-amber-500", label: "text-amber-700", bg: "bg-amber-50/50", icon: <Lightbulb className="size-3.5" aria-hidden /> };
    case "info":
    default:
      return { border: "border-l-brand-500", label: "text-brand-700", bg: "bg-brand-50/50", icon: <Info className="size-3.5" aria-hidden /> };
  }
}

// ---------- Shared back link ----------

export function BackLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" className="-ml-2 mb-3 text-muted-foreground" onClick={onClick}>
      <ArrowLeft className="size-4" aria-hidden /> {label}
    </Button>
  );
}
