"use client";
// Screen 39 — Recommendation Detail: the signature intelligence structure.

import { CircleDashed, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Breadcrumbs, IntelligenceDetail, KeyValue, SectionCard } from "@/components/shared/layout";
import { EvidencePanel } from "@/components/shared/evidence";
import {
  ConfidenceBadge,
  EffortBadge,
  ExecutionTypeBadge,
  ImpactBadge,
  ProvenanceBadge,
  StatusBadge,
} from "@/components/shared/badges";
import { ErrorState } from "@/components/shared/states";
import { recommendationById } from "@/lib/data/intelligence";
import { useBizz } from "@/lib/store";
import type { ScreenProps } from "../view-types";
import { guessCategory } from "../market/parts";
import { askTipFor } from "./helpers";

export function RecommendationDetail({ params }: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);
  const recommendationState = useBizz((s) => s.recommendationState);
  const setRecommendationState = useBizz((s) => s.setRecommendationState);
  const setTaskPrefill = useBizz((s) => s.setTaskPrefill);

  const rec = recommendationById(params.id);

  if (!rec) {
    return (
      <ErrorState
        title="Recommendation not found"
        description="This recommendation may belong to another workspace, or the link is out of date."
        onHome={() => navigate("actions")}
      />
    );
  }

  const eff = recommendationState[rec.id] ?? rec.status;
  const level = rec.confidence >= 75 ? "high" : rec.confidence >= 50 ? "medium" : "low";

  const askAbout = () => {
    navigate("ask");
    toast(askTipFor(rec.businessId));
  };

  const findSpecialist = () => {
    // Hand this recommendation to the marketplace as a ready-to-bid brief:
    // the intelligence says WHAT to do, a vetted human does the doing.
    setTaskPrefill({
      title: rec.title,
      description: `${rec.problem}\n\nWhat to do: ${rec.recommendation}${rec.expectedImpact ? `\n\nExpected impact (an estimate, not a promise): ${rec.expectedImpact}` : ""}`,
      category: guessCategory(`${rec.title} ${rec.recommendation} ${rec.problem}`),
      skills: [],
      source: "recommendation",
      sourceRef: rec.id,
      sourceTitle: rec.title,
    });
    navigate("market/post");
  };

  return (
    <div>
      <Breadcrumbs
        items={[{ label: "Action Centre", onClick: () => navigate("actions") }, { label: "Recommendation" }]}
      />
      <IntelligenceDetail
        eyebrow="Recommendation"
        title={rec.title}
        meta={
          <>
            <StatusBadge status={eff} />
            <ConfidenceBadge level={level} value={rec.confidence} />
            <ImpactBadge impact={rec.impact} />
            <EffortBadge effort={rec.effort} />
            <ExecutionTypeBadge type={rec.executionType} />
            <ProvenanceBadge provenance="ai-interpretation" source="Diagnosis engine" />
          </>
        }
        actions={
          <>
            <Button onClick={() => navigate(`action-start/${rec.id}`)}>Start action</Button>
            <Button variant={rec.executionType === "human" ? "secondary" : "outline"} onClick={findSpecialist}>
              <Users className="mr-1.5 size-4" aria-hidden />
              Find a specialist
            </Button>
            <Button variant="outline" onClick={askAbout}>
              Ask about this
            </Button>
            {eff === "dismissed" ? (
              <Button variant="outline" onClick={() => setRecommendationState(rec.id, "open")}>
                Restore
              </Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setRecommendationState(rec.id, "dismissed")}>
                  Dismiss
                </Button>
                <Button variant="ghost" onClick={() => setRecommendationState(rec.id, "saved")}>
                  Save for later
                </Button>
              </>
            )}
          </>
        }
      >
        <SectionCard title="Problem">
          <p className="text-sm leading-relaxed">{rec.problem}</p>
        </SectionCard>

        <SectionCard title="Evidence" description="Every fact carries its source and data type.">
          <EvidencePanel
            items={rec.evidence}
            onOpenFact={(factId) => {
              if (factId) navigate(`provenance/${factId}`);
            }}
          />
        </SectionCard>

        <SectionCard title="Diagnosis" action={<ProvenanceBadge provenance="ai-interpretation" source="Diagnosis engine" />}>
          <p className="text-sm leading-relaxed">{rec.diagnosis}</p>
        </SectionCard>

        <SectionCard title="Recommendation">
          <p className="text-sm font-medium leading-relaxed">{rec.recommendation}</p>
        </SectionCard>

        <SectionCard title="Expected impact" description="An estimate, not a promise.">
          <p className="text-sm leading-relaxed">{rec.expectedImpact}</p>
        </SectionCard>

        <SectionCard title="Measurement plan">
          <div className="space-y-3">
            <KeyValue label="Primary success metric">{rec.primaryMetric}</KeyValue>
            <KeyValue label="Measurement period">{rec.measurementWindow}</KeyValue>
            <KeyValue label="Execution type">
              {rec.executionType === "guided"
                ? "Guided — the platform explains exactly what to change"
                : rec.executionType === "human"
                  ? "Human action required"
                  : "Automatic / connected execution"}
            </KeyValue>
          </div>
        </SectionCard>

        <SectionCard title="Suggested tasks" description="A starting checklist — you can adjust it when starting the action.">
          <ul className="space-y-2">
            {rec.tasks.map((t, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm">
                <CircleDashed className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </SectionCard>
      </IntelligenceDetail>
    </div>
  );
}
