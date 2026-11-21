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
import { useBizz } from "@/lib/store";
import type { EvidenceItem } from "@/lib/types";
import { diagnosisReturnRoute } from "@/lib/diagnosis-route";
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

  const isPersonalized = Boolean(facts);
  const confidence = improved?.confidence ?? diagnosis?.confidence ?? 62;

  // Evidence rows built from what the owner actually said during the checkup.
  const evidence: EvidenceItem[] = isPersonalized && facts
    ? [
        ...(improved
          ? improved.channelRows.map(
              (r): EvidenceItem => ({
                label: `${r.name} conversion`,
                value: `${r.conversion.toFixed(1)}% (${r.customers} of ${r.enquiries})`,
                provenance: "user-supplied",
                source: "Counts you entered",
              }),
            )
          : ([
              {
                label: "Enquiries",
                value: `${facts.trends.enquiries} (your estimate)`,
                provenance: "estimated",
                source: "Your directional estimate in the checkup",
              },
            ] satisfies EvidenceItem[])),
        {
          label: "Customers",
          value: `${facts.trends.customers} (your estimate)`,
          provenance: "estimated",
          source: "Your directional estimate in the checkup",
        },
        {
          label: "Revenue",
          value: `${facts.trends.revenue} (your estimate)`,
          provenance: "estimated",
          source: "Your directional estimate in the checkup",
        },
        {
          label: "Recent changes",
          value: facts.recentChanges.slice(0, 2).join("; ") || "None reported",
          provenance: "user-supplied",
          source: "Your checkup conversation",
        },
      ]
    : FALLBACK_EVIDENCE;

  const known: string[] = isPersonalized && facts
    ? [
        `Enquiries: ${facts.trends.enquiries} (you reported)`,
        `Customers: ${facts.trends.customers} (you reported)`,
        `Revenue: ${facts.trends.revenue} (you reported)`,
        ...facts.recentChanges.slice(0, 2).map((c) => `${c} (you reported)`),
        ...(improved
          ? improved.channelRows.map((r) => `${r.name}: ${r.conversion.toFixed(1)}% conversion (${r.customers}/${r.enquiries} — you entered)`)
          : []),
      ]
    : [
        "Marketing spend increased about 40% (you reported)",
        "Enquiries increased about 50% (277 vs 185)",
        "New customers almost unchanged (49 vs 47)",
        "Revenue almost unchanged (about +3%)",
      ];

  const think = improved?.meaning ?? diagnosis?.meaning ?? "The bottleneck likely occurs after enquiry generation — in response time, quoting, or follow-up — rather than in lead generation.";

  const unknown: string[] = isPersonalized && facts
    ? [
        ...facts.channels.slice(0, 2).map((c) => `${c} response time`),
        ...(improved ? [] : facts.channels.slice(0, 2).map((c) => `${c} conversion counts`)),
        "Lead quality",
        "Pricing outcomes",
        "Follow-up activity",
      ]
    : ["Lead quality", "Response time to enquiries", "Channel-level conversion", "Pricing outcomes", "Follow-up activity"];

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
          onImprove={() => navigate("improve-diagnosis")}
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
          coverage={improved ? 70 : 45}
          sources={
            isPersonalized
              ? ["Your checkup answers", "Trend directions you described", ...(improved ? ["Channel counts you entered"] : [])]
              : ["Your checkup answers", "Direction estimates for spend, enquiries, customers and revenue"]
          }
          missing={
            isPersonalized && improved
              ? ["Response times", "Lead quality", "Pricing and discount outcomes", "Connected ad platform data"]
              : ["Channel-level enquiry and customer counts", "Response times", "Lead quality", "Pricing and discount outcomes", "Follow-up activity"]
          }
        />
      </div>

      <div className="mt-8 flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" className="w-full sm:w-auto" onClick={() => navigate("improve-diagnosis")}>
          Improve diagnosis
        </Button>
        <Button className="w-full sm:w-auto" onClick={() => navigate("setup-complete")}>
          Continue with current understanding
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
