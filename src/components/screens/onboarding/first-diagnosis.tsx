"use client";
// Screen 17 — First Diagnosis. The "wow" moment: an intelligence surface, not a dashboard.
// Renders the SwiftHaul-style story (the template for any new workspace).

import React, { useEffect, useState } from "react";
import { ArrowRight, Eye, Search, Sparkles, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InfoBanner } from "@/components/shared/layout";
import { ProvenanceBadge, TrendBadge } from "@/components/shared/badges";
import { useBizz } from "@/lib/store";
import type { Goodness } from "@/lib/types";
import type { ScreenProps } from "../view-types";

const DELTAS: { label: string; delta: number; goodness: Goodness; caption: string }[] = [
  { label: "Marketing spend", delta: 40, goodness: "neutral", caption: "You invested more in ads" },
  { label: "Enquiries", delta: 50, goodness: "good", caption: "Demand responded" },
  { label: "Customers", delta: 4, goodness: "neutral", caption: "Barely moved" },
  { label: "Revenue", delta: 3, goodness: "neutral", caption: "Barely moved" },
];

export default function FirstDiagnosis(_props: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);
  // Read the "improved" flag left by the improve-diagnosis screen (lazy, mount-time read only).
  const [improved] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.sessionStorage.getItem("bizzg-diag-improved") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    // Clear the one-shot flag in the external system (no state updates here).
    try {
      window.sessionStorage.removeItem("bizzg-diag-improved");
    } catch {}
  }, []);

  return (
    <div className="mx-auto w-full max-w-3xl">
      {improved ? (
        <div className="mb-6">
          <InfoBanner tone="warning" title="Diagnosis improved">
            Channel numbers were added — confidence increased to 82% and Instagram conversion is now the clearest signal.
          </InfoBanner>
        </div>
      ) : null}

      {/* Hero intelligence surface */}
      <section
        aria-label="Your first diagnosis"
        className="relative overflow-hidden rounded-2xl border border-violet-200 bg-violet-50/60 p-6 sm:p-10"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-violet-200/40 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-28 -left-20 size-72 rounded-full bg-violet-100/60 blur-3xl"
        />

        <div className="relative">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-violet-700">
            <Sparkles className="size-4" aria-hidden />
            Your first diagnosis
          </p>
          <h1 className="mt-3 max-w-xl text-3xl font-bold tracking-tight sm:text-4xl">
            We found the first thing worth investigating.
          </h1>
          <blockquote className="mt-5 max-w-2xl border-l-2 border-violet-400 pl-4 text-base leading-relaxed text-slate-700 sm:text-lg">
            Your marketing activity and enquiries increased much faster than your number of customers. Your immediate
            constraint may be conversion rather than lead generation.
          </blockquote>
          <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <ProvenanceBadge provenance="ai-interpretation" />
            Based on the trends you described — not on measured channel data yet.
          </p>

          {/* Delta story */}
          <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            {DELTAS.map((d) => (
              <div key={d.label} className="rounded-xl border border-violet-100 bg-white/80 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{d.label}</p>
                <p className="mt-1.5 text-2xl font-semibold tnum text-slate-900 sm:text-3xl">
                  +{d.delta}%
                </p>
                <TrendBadge delta={d.delta} goodness={d.goodness} className="mt-2" />
                <p className="mt-2 text-xs text-muted-foreground">{d.caption}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Your last full month vs the month before, as you described it.</p>
        </div>
      </section>

      {/* Reading of the result */}
      <section className="mt-8 space-y-6" aria-label="Interpretation">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Search className="size-4 text-violet-600" aria-hidden />
            What this means
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
            Demand is not the problem. Enquiries grew roughly 12 times faster than customers did. The drop-off is most
            likely happening after the enquiry arrives — in response time, quoting, or follow-up — rather than in how many
            people discover you.
          </p>
        </div>

        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <TrendingDown className="size-4 text-amber-600" aria-hidden />
            Why it matters
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
            If customer conversion had kept pace with enquiries, the same ad spend could have produced close to twice as
            many new customers. Spending more on marketing before fixing conversion would amplify the gap — and the waste.
          </p>
        </div>

        <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-violet-800">
            <Sparkles className="size-4" aria-hidden />
            Recommended next investigation
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-violet-900/90">
            Compare how each channel converts enquiries into customers, and check how quickly enquiries receive a first
            response. Your Instagram enquiries grew the fastest, yet converted far worse than referrals — that contrast is
            the fastest route to the real constraint.
          </p>
        </div>
      </section>

      <div className="mt-8 flex flex-col gap-2 sm:flex-row">
        <Button onClick={() => navigate("first-diagnosis-evidence")} className="w-full bg-violet-600 hover:bg-violet-700 sm:w-auto">
          <Eye className="size-4" aria-hidden />
          See the evidence
        </Button>
        <Button variant="outline" className="w-full sm:w-auto" onClick={() => navigate("improve-diagnosis")}>
          Improve this diagnosis
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
