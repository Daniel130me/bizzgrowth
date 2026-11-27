"use client";
// Screen 18 — First Diagnosis Evidence.
// Know / Think / Unknown + evidence table + confidence explanation.
// For user workspaces the panels are built from the owner's OWN checkup
// answers (store.checkup.facts) and the AI diagnosis; the constants below
// are only the fallback when no checkup facts exist.

import React from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/shared/layout";
import { ConfidenceBadge } from "@/components/shared/badges";
import { ConfidencePanel, EvidencePanel, KnowThinkUnknown, ProvenanceLegend } from "@/components/shared/evidence";
import { useBizz, useFocusChallenge } from "@/lib/store";
import type { EvidenceItem } from "@/lib/types";
import { diagnosisReturnRoute } from "@/lib/diagnosis-route";
import { improveHelps } from "@/lib/checkup";
import { fmtDateShort } from "@/lib/format";
import { missingNumbers, numberRows, sourceLabel } from "@/lib/number-log";

import type { ScreenProps } from "../view-types";

const FALLBACK_EVIDENCE: EvidenceItem[] = [
  {
    label: "Marketing spend",
    value: "Up about 40% (₦370k vs ₦265k)",
    provenance: "user-supplied",
    source: "You reported this during the checkup",
  },
  {
    label: "Enquiries",
    value: "Up about 50% (277 vs 185)",
    provenance: "measured",
    source: "Counted from your enquiry records",
  },
  {
    label: "New customers",
    value: "Almost unchanged (49 vs 47)",
    provenance: "user-supplied",
    source: "Your estimate during the checkup",
  },
  {
    label: "Revenue",
    value: "Almost unchanged (about ₦6.0m)",
    provenance: "user-supplied",
    source: "Your estimate during the checkup",
  },
];

export default function FirstDiagnosisEvidence(_props: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);
  const facts = useBizz((s) => s.checkup.facts);
  const diagnosis = useBizz((s) => s.checkup.diagnosis);
  const improved = useBizz((s) => s.checkup.improved);
  const numberLog = useBizz((s) => s.checkup.numberLog);
  const focus = useFocusChallenge();

  const isPersonalized = Boolean(facts);
  const confidence = improved?.confidence ?? diagnosis?.confidence ?? 62;

  // Built only from what the owner really gave: their numbers (with where each came from),
  // the directions they actually knew, the changes they mentioned. "Don't know" is never
  // listed as something we know.
  const rows = numberRows(facts, numberLog);
  const knownTrends = facts
    ? ([
        ["Enquiries", facts.trends.enquiries],
        ["Customers", facts.trends.customers],
        ["Sales", facts.trends.revenue],
      ] as const).filter(([, t]) => t !== "Don't know")
    : [];
  // A change that only repeats a figure already listed ("Rent of ₦3.6m is due…") says nothing new.
  // (Their history counts too: "the supplier bill of ₦350k is overdue" is out of date once it's paid.)
  const shownFigures = rows.flatMap((r) => [r.value, ...r.history.map((h) => h.value)]).join(" ");
  const figuresIn = (t: string) => t.match(/[₦$€£₵]?\d[\d,.]*\s?(?:k|m|bn)?/gi) ?? [];
  const recent = (facts?.recentChanges ?? [])
    .filter((c) => {
      const figs = figuresIn(c);
      return !figs.length || !figs.every((f) => shownFigures.includes(f.trim()));
    })
    .slice(0, 2);
  const sourceOf = (r: (typeof rows)[number]) => `${sourceLabel(r.source, r.history.length > 0)}${r.at ? ` · ${fmtDateShort(r.at)}` : ""}`;

  const ownEvidence: EvidenceItem[] = [
    ...rows.map((r): EvidenceItem => ({ label: r.label, value: r.value, provenance: "user-supplied", source: sourceOf(r) })),
    ...(improved?.channelRows ?? []).map(
      (r): EvidenceItem => ({ label: r.name, value: `${r.customers} of ${r.enquiries} who asked went on to buy`, provenance: "user-supplied", source: "Counts you entered" }),
    ),
    ...knownTrends.map(([label, t]): EvidenceItem => ({ label: `${label} lately`, value: `${t} (your sense)`, provenance: "estimated", source: "What you said in the checkup" })),
    ...recent.map((c): EvidenceItem => ({ label: "Something that changed", value: c, provenance: "user-supplied", source: "Your checkup conversation" })),
  ];
  const evidence: EvidenceItem[] = isPersonalized && facts
    ? ownEvidence.length
      ? ownEvidence
      : [{ label: "What you told me", value: facts.bottleneck || facts.whatTheySell || "Your checkup answers", provenance: "user-supplied", source: "Your checkup conversation" }]
    : FALLBACK_EVIDENCE;

  const ownKnown = [
    ...rows.map((r) => `${r.label}: ${r.value}`),
    ...(improved?.channelRows ?? []).map((r) => `${r.name}: ${r.customers} of ${r.enquiries} went on to buy (you counted)`),
    ...knownTrends.map(([label, t]) => `${label}: ${t.toLowerCase()} (your sense)`),
    ...recent,
  ];
  const known: string[] = isPersonalized && facts
    ? ownKnown.length
      ? ownKnown
      : [facts.bottleneck ? `Where it feels stuck: ${facts.bottleneck}` : "Your checkup answers"]
    : [
        "Marketing spend increased about 40% (you reported)",
        "Enquiries increased about 50% (277 vs 185)",
        "New customers almost unchanged (49 vs 47)",
        "Revenue almost unchanged (about +3%)",
      ];

  const think = improved?.meaning ?? diagnosis?.meaning ?? "The bottleneck likely occurs after enquiry generation — in response time, quoting, or follow-up — rather than in lead generation.";

  // Everything here is what they told me — none of it is from their records yet. Said honestly.
  const ownUnknown = [...missingNumbers(facts), "Figures from your records (till, bank or sales app) — everything here is from what you told me"];
  const unknown: string[] = isPersonalized && facts
    ? ownUnknown
    : ["Lead quality", "Response time to enquiries", "Channel-level conversion", "Pricing outcomes", "Follow-up activity"];

  // How much of what this read needs is really there — worked out, never a set number.
  const coverage = isPersonalized && facts
    ? Math.round((100 * (rows.length + knownTrends.length)) / Math.max(1, rows.length + knownTrends.length + ownUnknown.length))
    : 45;
  const helps = improveHelps(facts, diagnosis, focus?.stage) && !improved;
  const sources = [
    "Your checkup answers",
    ...(rows.some((r) => r.source === "check-in" || r.history.some((h) => h.source === "check-in")) ? ["What you told me in check-ins"] : []),
    ...(rows.some((r) => r.source === "you") ? ["Figures you corrected"] : []),
    ...(knownTrends.length ? ["Which way things are going, in your words"] : []),
    ...(improved ? ["Counts you entered"] : []),
  ];

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Button variant="ghost" size="sm" className="-ml-2 mb-4 text-slate-500" onClick={() => navigate(diagnosisReturnRoute("diagnosis"))}>
        <ArrowLeft className="size-4" aria-hidden />
        Back to diagnosis
      </Button>

      <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">First diagnosis — evidence</p>
      <h1 className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">The evidence behind your diagnosis</h1>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        What the system knows, what it thinks, and what it openly does not know yet.
        <ConfidenceBadge level={confidence >= 75 ? "high" : confidence >= 60 ? "medium" : "low"} value={confidence} />
      </p>

      <div className="mt-6">
        <KnowThinkUnknown
          known={known}
          think={think}
          unknown={unknown}
          onImprove={helps ? () => navigate("improve-diagnosis") : undefined}
        />
      </div>

      <SectionCard
        title="Evidence"
        description="Every number carries its provenance. AI conclusions are never presented as measured data."
        className="mt-6"
      >
        <EvidencePanel items={evidence} />
        <ProvenanceLegend className="mt-4" />
      </SectionCard>

      <div className="mt-6">
        <ConfidencePanel
          level={confidence >= 75 ? "high" : confidence >= 60 ? "medium" : "low"}
          value={confidence}
          coverage={coverage}
          sources={isPersonalized ? sources : ["Your checkup answers", "Direction estimates for spend, enquiries, customers and revenue"]}
          missing={isPersonalized ? ownUnknown : ["Channel-level enquiry and customer counts", "Response times", "Lead quality", "Pricing and discount outcomes", "Follow-up activity"]}
        />
      </div>

      <div className="mt-8 flex flex-col gap-2 sm:flex-row">
        {helps ? (
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => navigate("improve-diagnosis")}>
            Add my enquiry numbers
          </Button>
        ) : null}
        <Button className="w-full sm:w-auto" onClick={() => navigate("setup-complete")}>
          Continue with current understanding
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
