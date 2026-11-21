"use client";
// Screen 26 — Customer Journey / Funnel. Steps come from the data layer per business type.

import React, { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProvenanceBadge } from "@/components/shared/badges";
import { FunnelView } from "@/components/shared/funnel";
import { InfoBanner, PageHeader, SectionCard } from "@/components/shared/layout";
import { REPORTING_MONTH } from "@/lib/data/businesses";
import { fmtNum, fmtPct } from "@/lib/format";
import type { FunnelStep } from "@/lib/types";
import { useBiz } from "./biz";
import type { ScreenProps } from "../view-types";

const SERVICE_HELP: Record<string, string> = {
  enquiries:
    "Record response time and lead source for every enquiry — that separates lead quality from follow-up speed and sharpens the diagnosis.",
  qualified: "Apply qualification criteria consistently and track lost reasons at this step so weak leads stop hiding weak follow-up.",
  quotes: "Track quote turnaround time — faster quotes correlate with higher win rates in service businesses.",
  customers: "Faster, structured follow-up for Instagram enquiries is the current recommendation; protecting Google and Referral volume matters as much.",
};

const ECOM_HELP: Record<string, string> = {
  visitors: "Traffic quality matters more than volume — most recent growth comes from paid Instagram, so conversion fixes pay off twice.",
  views: "Improve product-page clarity and load speed to lift the view → cart rate.",
  carts: "Automated cart reminders can recover a share of abandoned carts within hours.",
  checkouts:
    "Fix mobile checkout errors and payment failures first — this is the largest recoverable loss in the funnel.",
  purchases: "Post-purchase follow-up and bundles raise repeat purchase rate, which is already tracked for this store.",
};

export default function FunnelPerformance(_props: ScreenProps) {
  const { business, navigate } = useBiz();
  const ecom = business.type === "ecommerce";
  const [openStep, setOpenStep] = useState<{ step: FunnelStep; index: number } | null>(null);

  const steps = business.funnel;
  const losses = steps.map((s, i) => {
    if (i === 0) return 0;
    const prev = steps[i - 1]?.value ?? 0;
    return prev ? ((prev - s.value) / prev) * 100 : 0;
  });
  const bottleneckIdx = losses.indexOf(Math.max(...losses.slice(1)));

  // Service note figures (measured).
  const totalEnquiries = steps[0]?.value ?? 0;
  const instagram = business.channels.find((c) => c.id === "instagram");
  const instagramShare = ecom || !instagram || !totalEnquiries ? 0 : (instagram.enquiries / totalEnquiries) * 100;

  const helpFor = (stepId: string): string =>
    (ecom ? ECOM_HELP[stepId] : SERVICE_HELP[stepId]) ?? "Improve measurement at this stage to unlock a specific suggestion.";

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      <PageHeader
        title="Customer journey"
        description={`How ${ecom ? "visitors become orders" : "enquiries become customers"} — ${REPORTING_MONTH.current} snapshot. Stages come from ${
          ecom ? "the Shopify click funnel" : "monthly manual submissions"
        }; select any stage for detail.`}
        back={
          <Button variant="ghost" size="sm" className="-ml-2 mb-1" onClick={() => navigate("performance")}>
            <ArrowRight className="mr-1.5 size-4 rotate-180" aria-hidden /> Performance
          </Button>
        }
      />

      <SectionCard title="Funnel" description={ecom ? "Visitors → purchases, last 30 days" : "Enquiries → new customers, September"}>
        <FunnelView
          steps={steps}
          orientation="vertical"
          onSelect={(step, index) => setOpenStep({ step, index })}
        />
      </SectionCard>

      {ecom ? (
        <InfoBanner
          tone="ai"
          title="AI interpretation"
          action={
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 border-brand-300 bg-white text-brand-700 hover:bg-brand-100"
              onClick={() => navigate("insights/ins-kh-1")}
            >
              View diagnosis <ArrowRight className="ml-1 size-3.5" aria-hidden />
            </Button>
          }
        >
          <div className="flex flex-wrap items-center gap-2">
            <span>Largest deterioration occurs at checkout — mobile completion fell from 71% to 48%.</span>
            <ProvenanceBadge provenance="ai-interpretation" />
          </div>
        </InfoBanner>
      ) : (
        <InfoBanner tone="warning" title="Where the journey leaks">
          <span>
            The largest single drop is between enquiries and qualified leads (−{losses[1]?.toFixed(0)}%). Instagram supplies{" "}
            {fmtPct(instagramShare, 0)} of enquiries but converts at only {fmtPct(instagram?.conversion ?? 0)} — the current AI
            diagnosis focuses there.
          </span>
        </InfoBanner>
      )}

      <Dialog open={openStep !== null} onOpenChange={(o) => !o && setOpenStep(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          {openStep && (
            <>
              <DialogHeader>
                <DialogTitle>{openStep.step.label}</DialogTitle>
                <DialogDescription>
                  Stage {openStep.index + 1} of {steps.length} · {REPORTING_MONTH.current}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex items-baseline justify-between rounded-lg border p-3">
                  <span className="text-sm text-muted-foreground">Volume at this stage</span>
                  <span className="text-xl font-semibold tnum">{fmtNum(openStep.step.value)}</span>
                </div>
                {openStep.index > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-sm">
                      <span className="font-semibold tnum">−{losses[openStep.index]?.toFixed(1)}%</span> drop from the previous
                      stage ({fmtNum(steps[openStep.index - 1]?.value ?? 0)} → {fmtNum(openStep.step.value)}).
                    </p>
                    {openStep.index === bottleneckIdx && (
                      <p className="mt-1 text-xs font-medium text-amber-700">This is the largest loss in the funnel.</p>
                    )}
                  </div>
                )}
                {steps[steps.length - 1] && steps[steps.length - 1].value > 0 && (
                  <div className="flex items-baseline justify-between rounded-lg border p-3">
                    <span className="text-sm text-muted-foreground">Share reaching the final stage</span>
                    <span className="text-sm font-semibold tnum">
                      {fmtPct((openStep.step.value ? (steps[steps.length - 1].value / openStep.step.value) * 100 : 0))}
                    </span>
                  </div>
                )}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What would help</h4>
                  <p className="mt-1.5 text-sm">{helpFor(openStep.step.id)}</p>
                </div>
                <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-muted-foreground">
                  Percentages are calculated from the measured stages above — nothing here is estimated.
                </p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
