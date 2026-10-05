"use client";
// Trust & evidence components — the signature of the product.

import React from "react";
import { ArrowDown, CheckCircle2, CircleDashed, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { ConfidenceLevel, EvidenceItem, Provenance } from "@/lib/types";
import { ProvenanceBadge } from "./badges";

/** What we know / What we think / What we don't know — three-part evidence panel. */
export function KnowThinkUnknown({
  known,
  think,
  unknown,
  onImprove,
}: {
  known: string[];
  think: string;
  unknown: string[];
  onImprove?: () => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-blue-800">
          <CheckCircle2 className="size-4" aria-hidden /> What we know
        </h4>
        <ul className="mt-2 space-y-1.5">
          {known.map((k, i) => (
            <li key={i} className="text-sm text-blue-900/80">
              · {k}
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-violet-800">
          <HelpCircle className="size-4" aria-hidden /> What we think
        </h4>
        <p className="mt-2 text-sm text-violet-900/80">{think}</p>
        <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-violet-600">AI interpretation</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <CircleDashed className="size-4" aria-hidden /> What we don&apos;t know yet
        </h4>
        <ul className="mt-2 space-y-1.5">
          {unknown.map((k, i) => (
            <li key={i} className="text-sm text-slate-600">
              · {k}
            </li>
          ))}
        </ul>
        {onImprove ? (
          <Button size="sm" variant="outline" className="mt-3 w-full" onClick={onImprove}>
            Improve this diagnosis
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** Evidence list with provenance badges and links to fact detail. */
export function EvidencePanel({ items, onOpenFact }: { items: EvidenceItem[]; onOpenFact?: (factId?: string) => void }) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">Evidence</th>
            <th className="px-4 py-2.5 font-medium">Value</th>
            <th className="px-4 py-2.5 font-medium">Source</th>
            <th className="px-4 py-2.5 font-medium sr-only sm:table-cell">Type</th>
          </tr>
        </thead>
        <tbody>
          {items.map((e, i) => (
            <tr key={i} className="border-b last:border-0">
              <td className="px-4 py-2.5 font-medium">{e.label}</td>
              <td className="px-4 py-2.5 tnum">{e.value}</td>
              <td className="px-4 py-2.5 text-muted-foreground">
                {e.factId ? (
                  <button className="text-blue-700 hover:underline" onClick={() => onOpenFact?.(e.factId)}>
                    {e.source}
                  </button>
                ) : (
                  e.source
                )}
              </td>
              <td className="px-4 py-2.5">
                <ProvenanceBadge provenance={e.provenance} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Explains WHY the system is confident (or not) — never unexplained scores. */
export function ConfidencePanel({
  level,
  value,
  coverage,
  sources,
  missing,
}: {
  level: ConfidenceLevel;
  value?: number;
  coverage: number;
  sources: string[];
  missing: string[];
}) {
  const barColor = level === "high" ? "bg-emerald-500" : level === "medium" ? "bg-amber-500" : "bg-slate-400";
  const language =
    level === "high"
      ? "Strong evidence and data coverage support this conclusion."
      : level === "medium"
        ? "A useful signal, but some information is missing. Additional data would raise confidence."
        : "Not enough evidence to isolate the cause yet. This is not an error — it reflects what is currently measurable.";
  return (
    <div className="rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">Confidence</h4>
        <span className="text-sm font-semibold tnum">{value !== undefined ? `${value}%` : level[0].toUpperCase() + level.slice(1)}</span>
      </div>
      <Progress value={value ?? (level === "high" ? 85 : level === "medium" ? 60 : 30)} className={cn("mt-2 h-2", barColor)} />
      <p className="mt-2 text-sm text-muted-foreground">{language}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Data coverage</p>
          <p className="mt-1 text-sm tnum">{coverage}% of the information needed for this conclusion is available.</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sources supporting this</p>
          <ul className="mt-1 space-y-0.5">
            {sources.map((s, i) => (
              <li key={i} className="text-sm">
                · {s}
              </li>
            ))}
          </ul>
        </div>
      </div>
      {missing.length > 0 && (
        <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Missing data</p>
          <ul className="mt-1 space-y-0.5">
            {missing.map((m, i) => (
              <li key={i} className="text-sm text-amber-800">
                · {m}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Visual root-cause chain — each step explainable, never implied certainty. */
export function RootCauseTree({ steps, onSelectStep }: { steps: { step: string; note?: string }[]; onSelectStep?: (i: number) => void }) {
  return (
    <ol className="space-y-0">
      {steps.map((s, i) => (
        <li key={i}>
          <button
            onClick={() => onSelectStep?.(i)}
            className={cn(
              "w-full rounded-xl border p-3.5 text-left transition-colors",
              i === steps.length - 1 ? "border-violet-200 bg-violet-50/60" : "bg-white hover:border-blue-300 hover:bg-blue-50/40"
            )}
          >
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tnum",
                  i === steps.length - 1 ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-600"
                )}
              >
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-medium leading-snug">{s.step}</p>
                {s.note ? <p className="mt-0.5 text-xs text-muted-foreground">{s.note}</p> : null}
              </div>
            </div>
          </button>
          {i < steps.length - 1 && (
            <div className="flex justify-center py-1" aria-hidden>
              <ArrowDown className="size-4 text-slate-400" />
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

/** Provenance legend shown on data-heavy screens. */
export function ProvenanceLegend({ className }: { className?: string }) {
  const kinds: Provenance[] = ["measured", "user-supplied", "estimated", "ai-interpretation"];
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="text-xs text-muted-foreground">Data types:</span>
      {kinds.map((k) => (
        <ProvenanceBadge key={k} provenance={k} />
      ))}
    </div>
  );
}
