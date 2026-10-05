"use client";
// Screen 18 — First Diagnosis Evidence.
// Know / Think / Unknown + evidence table + confidence explanation.

import React from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/shared/layout";
import { ConfidenceBadge } from "@/components/shared/badges";
import { ConfidencePanel, EvidencePanel, KnowThinkUnknown, ProvenanceLegend } from "@/components/shared/evidence";
import { useBizz } from "@/lib/store";
import type { EvidenceItem } from "@/lib/types";
import type { ScreenProps } from "../view-types";

const EVIDENCE: EvidenceItem[] = [
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

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Button variant="ghost" size="sm" className="-ml-2 mb-4 text-slate-500" onClick={() => navigate("first-diagnosis")}>
        <ArrowLeft className="size-4" aria-hidden />
        Back to diagnosis
      </Button>

      <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">First diagnosis — evidence</p>
      <h1 className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">The evidence behind your diagnosis</h1>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        What the system knows, what it thinks, and what it openly does not know yet.
        <ConfidenceBadge level="medium" value={62} />
      </p>

      <div className="mt-6">
        <KnowThinkUnknown
          known={[
          "Marketing spend increased about 40% (you reported)",
          "Enquiries increased about 50% (277 vs 185)",
          "New customers almost unchanged (49 vs 47)",
          "Revenue almost unchanged (about +3%)",
        ]}
        think="The bottleneck likely occurs after enquiry generation — in response time, quoting, or follow-up — rather than in lead generation."
        unknown={["Lead quality", "Response time to enquiries", "Channel-level conversion", "Pricing outcomes", "Follow-up activity"]}
        onImprove={() => navigate("improve-diagnosis")}
        />
      </div>

      <SectionCard
        title="Evidence"
        description="Every number carries its provenance. AI conclusions are never presented as measured data."
        className="mt-6"
      >
        <EvidencePanel items={EVIDENCE} />
        <ProvenanceLegend className="mt-4" />
      </SectionCard>

      <div className="mt-6">
        <ConfidencePanel
          level="medium"
          value={62}
          coverage={45}
          sources={["Your checkup answers", "Direction estimates for spend, enquiries, customers and revenue"]}
          missing={["Channel-level enquiry and customer counts", "Response times", "Lead quality", "Pricing and discount outcomes", "Follow-up activity"]}
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
