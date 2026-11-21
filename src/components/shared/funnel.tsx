"use client";
// Funnel visualization — highlights the largest percentage loss, stages clickable.

import React from "react";
import { ArrowDown, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtNum } from "@/lib/format";
import type { FunnelStep } from "@/lib/types";

export function FunnelView({
  steps,
  orientation = "vertical",
  onSelect,
}: {
  steps: FunnelStep[];
  orientation?: "vertical" | "horizontal";
  onSelect?: (step: FunnelStep, index: number) => void;
}) {
  const max = Math.max(...steps.map((s) => s.value), 1);
  const losses = steps.map((s, i) => {
    if (i === 0) return 0;
    const prev = steps[i - 1].value;
    return prev ? ((prev - s.value) / prev) * 100 : 0;
  });
  const bottleneck = losses.indexOf(Math.max(...losses.slice(1)));

  if (orientation === "horizontal") {
    return (
      <div className="space-y-2">
        {steps.map((s, i) => {
          const width = Math.max(12, (s.value / max) * 100);
          const isBottleneck = i === bottleneck && i > 0;
          return (
            <div key={s.id}>
              <button
                onClick={() => onSelect?.(s, i)}
                className="group flex w-full items-center gap-3 text-left"
                aria-label={`${s.label}: ${fmtNum(s.value)}`}
              >
                <span className="w-32 shrink-0 text-xs font-medium text-muted-foreground sm:w-40">{s.label}</span>
                <span className="relative h-9 flex-1 overflow-hidden rounded-lg bg-slate-100">
                  <span
                    className={cn(
                      "absolute inset-y-0 left-0 rounded-lg transition-all",
                      isBottleneck ? "bg-amber-400/80" : i === steps.length - 1 ? "bg-emerald-500/80" : "bg-brand-500/80",
                      "group-hover:brightness-95"
                    )}
                    style={{ width: `${width}%` }}
                  />
                  <span className="absolute inset-y-0 left-3 flex items-center text-xs font-semibold text-white tnum drop-shadow-sm">
                    {fmtNum(s.value)}
                  </span>
                </span>
                {i > 0 && (
                  <span className={cn("w-20 shrink-0 text-right text-xs tnum", isBottleneck ? "font-semibold text-amber-600" : "text-muted-foreground")}>
                    {fmtNum(steps[i - 1].value)} → {fmtNum(s.value)}
                  </span>
                )}
              </button>
              {i < steps.length - 1 && (
                <div className="ml-32 flex items-center gap-1 py-0.5 text-[11px] text-muted-foreground sm:ml-40" aria-hidden>
                  <ArrowRight className="size-3" />
                  {losses[i + 1] > 0 && <span>−{losses[i + 1].toFixed(0)}% drop</span>}
                </div>
              )}
            </div>
          );
        })}
        {bottleneck > 0 && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Largest loss: between <strong>{steps[bottleneck - 1].label.toLowerCase()}</strong> and <strong>{steps[bottleneck].label.toLowerCase()}</strong> (
            {losses[bottleneck].toFixed(0)}% drop).
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      {steps.map((s, i) => {
        const width = Math.max(28, (s.value / max) * 100);
        const isBottleneck = i === bottleneck && i > 0;
        return (
          <div key={s.id} className="flex w-full flex-col items-center">
            <button
              onClick={() => onSelect?.(s, i)}
              className={cn(
                "flex flex-col items-center justify-center rounded-xl border px-4 py-3 transition-colors",
                isBottleneck ? "border-amber-300 bg-amber-50" : "border-brand-200 bg-brand-50/60 hover:bg-brand-50"
              )}
              style={{ width: `${width}%` }}
              aria-label={`${s.label}: ${fmtNum(s.value)}`}
            >
              <span className="text-xs font-medium text-slate-600">{s.label}</span>
              <span className="text-lg font-semibold tnum">{fmtNum(s.value)}</span>
              {isBottleneck && <span className="mt-0.5 text-[11px] font-semibold text-amber-700">Largest drop (−{losses[i].toFixed(0)}%)</span>}
            </button>
            {i < steps.length - 1 && (
              <div className="flex flex-col items-center py-1 text-[11px] text-muted-foreground" aria-hidden>
                <ArrowDown className="size-4" />
                <span>{steps[i + 1].value > 0 ? `${((steps[i + 1].value / s.value) * 100).toFixed(0)}% continue` : "—"}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
