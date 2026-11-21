"use client";
// Screen 22 — Business Health Detail. Explainable dimension scores, never gamified.

import React, { useState } from "react";
import { ArrowRight, ChevronRight, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ProvenanceBadge } from "@/components/shared/badges";
import { PageHeader, SectionCard } from "@/components/shared/layout";
import { useBizz } from "@/lib/store";
import { getBusiness, getPeriod } from "@/lib/data/businesses";
import { cn } from "@/lib/utils";
import type { Business } from "@/lib/types";
import type { ScreenProps } from "../view-types";

/** Colour reflects goodness of the score, never raw decoration. */
function scoreBar(score: number): string {
  if (score >= 70) return "[&>[data-slot=progress-indicator]]:bg-emerald-500";
  if (score >= 50) return "[&>[data-slot=progress-indicator]]:bg-amber-500";
  return "[&>[data-slot=progress-indicator]]:bg-red-500";
}

function relatedRoute(dimension: string, business: Business): string | null {
  if (dimension.startsWith("Revenue")) return "metric/revenue";
  if (dimension.startsWith("Marketing")) return "performance/marketing";
  if (dimension.startsWith("Customer acquisition")) return business.type === "ecommerce" ? "metric/orders" : "metric/customers";
  if (dimension === "Conversion") return "metric/conversion";
  if (dimension.startsWith("Data")) return "data";
  return null;
}

export default function HealthDetail(_props: ScreenProps) {
  const businessId = useBizz((s) => s.businessId);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const dateRange = useBizz((s) => s.dateRange);
  const navigate = useBizz((s) => s.navigate);

  const business = getBusiness(businessId, userWorkspace);
  const period = getPeriod(business, dateRange);

  const [openDimension, setOpenDimension] = useState<string | null>(null);
  const active = business.health.find((h) => h.dimension === openDimension) ?? null;

  const overall = Math.round(business.health.reduce((a, h) => a + h.score, 0) / Math.max(business.health.length, 1));

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title="Business health"
        description={`Explainable dimension scores for ${business.name} — ${period.label}. Open any dimension to see the exact signals behind its score.`}
      />

      <div className="space-y-5">
        {/* Overall score — derived, labelled as a calculation */}
        <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">Overall business health</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Average of the {business.health.length} dimension scores below for {period.label}.
            </p>
            <div className="mt-2">
              <ProvenanceBadge provenance="estimated" source="Calculated — average of dimension scores" />
            </div>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-4xl font-bold tracking-tight tnum">
              {overall}
              <span className="text-base font-normal text-muted-foreground"> / 100</span>
            </p>
            <Progress value={overall} className={cn("mt-2 sm:w-48", scoreBar(overall))} />
          </div>
        </Card>

        <SectionCard title="How to read these scores">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
            <div className="text-sm text-muted-foreground">
              <p>
                Scores are explainable summaries of the signals below — not gamified numbers. Each dimension is scored 0–100 from
                measured changes in the current period, and every score lists the exact signals that produced it.
              </p>
              <p className="mt-1.5">A low score is a pointer to where attention helps most — not a grade.</p>
            </div>
          </div>
        </SectionCard>

        {/* Dimension grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {business.health.map((h) => (
            <Card
              key={h.dimension}
              role="button"
              tabIndex={0}
              onClick={() => setOpenDimension(h.dimension)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpenDimension(h.dimension);
                }
              }}
              aria-label={`${h.dimension}: ${h.score} out of 100. View signals.`}
              className="cursor-pointer p-5 transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-[15px] font-semibold leading-snug">{h.dimension}</h3>
                <p className="shrink-0 text-xl font-semibold tnum">
                  {h.score}
                  <span className="text-xs font-normal text-muted-foreground"> /100</span>
                </p>
              </div>
              <Progress value={h.score} className={cn("mt-3", scoreBar(h.score))} />
              <p className="mt-2.5 line-clamp-2 text-sm text-muted-foreground">{h.summary}</p>
              <span className="mt-3 inline-flex items-center gap-0.5 text-xs font-medium text-brand-700">
                Why this score <ChevronRight className="size-3.5" aria-hidden />
              </span>
            </Card>
          ))}
        </div>
      </div>

      {/* Dimension detail dialog */}
      <Dialog open={active !== null} onOpenChange={(o) => !o && setOpenDimension(null)}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto sm:max-w-xl">
          {active && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between gap-3 pr-6">
                  <span>{active.dimension}</span>
                  <span className="text-xl font-bold tnum">
                    {active.score}
                    <span className="text-xs font-normal text-muted-foreground"> /100</span>
                  </span>
                </DialogTitle>
                <DialogDescription>{active.summary}</DialogDescription>
              </DialogHeader>
              <Progress value={active.score} className={scoreBar(active.score)} />
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Signals behind this score</h4>
                <ul className="mt-2 space-y-1.5">
                  {active.why.map((w, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-slate-400" aria-hidden />
                      <span>{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-muted-foreground">
                Scores are explainable summaries of the signals below — not gamified numbers. Each signal above is measured or
                user-supplied for {period.label}.
              </p>
              {relatedRoute(active.dimension, business) && (
                <Button
                  className="w-full"
                  onClick={() => {
                    setOpenDimension(null);
                    navigate(relatedRoute(active.dimension, business) ?? "home");
                  }}
                >
                  Open related view <ArrowRight className="ml-1.5 size-4" aria-hidden />
                </Button>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
