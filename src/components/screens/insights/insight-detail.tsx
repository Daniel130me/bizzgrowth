"use client";
// Screens 33 + 34 + 35 — Intelligence Detail.
// One screen serves Problem diagnosis, Opportunity detail and Confidence/Evidence
// detail: reasoning chain, evidence with provenance links, what we know / think /
// do not know, confidence explanation and the recommended next action.

import { ArrowRight, Lightbulb, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfidenceBadge, EffortBadge, ProvenanceBadge } from "@/components/shared/badges";
import { ConfidencePanel, EvidencePanel, KnowThinkUnknown, RootCauseTree } from "@/components/shared/evidence";
import { IntelligenceDetail, SectionCard } from "@/components/shared/layout";
import { ErrorState } from "@/components/shared/states";
import { getBusiness } from "@/lib/data/businesses";
import { insightById, recommendationById } from "@/lib/data/intelligence";
import { fmtDate } from "@/lib/format";
import { useBizz } from "@/lib/store";
import type { ScreenProps } from "../view-types";
import { guessCategory } from "../market/parts";
import { BackLink, IMPORTANCE_LABEL, INSIGHT_TYPE_META, evidenceWithFacts, metricSlugFor } from "./parts";

export function InsightDetail({ params }: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);
  const businessId = useBizz((s) => s.businessId);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const aiInsights = useBizz((s) => s.aiInsights);
  const setTaskPrefill = useBizz((s) => s.setTaskPrefill);

  // AI-generated insights live in the store; curated ones in the dataset.
  const insight = aiInsights.find((i) => i.id === params.id) ?? insightById(params.id);

  if (!insight) {
    return (
      <div className="mx-auto max-w-2xl py-10">
        <BackLink label="Back to insights" onClick={() => navigate("insights")} />
        <ErrorState
          title="Diagnosis not found"
          description="This insight is not available. It may belong to another workspace or has been archived as newer conclusions replaced it."
          onRetry={() => navigate("insights")}
          onHome={() => navigate("home")}
        />
      </div>
    );
  }

  const business = getBusiness(businessId, userWorkspace);
  const meta = INSIGHT_TYPE_META[insight.type];
  const evidence = evidenceWithFacts(insight.businessId, insight.evidence);
  const sources = Array.from(new Set(insight.evidence.map((e) => e.source)));
  const rec = insight.recommendationId ? recommendationById(insight.recommendationId) : undefined;
  const metricSlug = metricSlugFor(insight.primaryMetric);

  const openRelatedMetric = () => {
    if (metricSlug) {
      navigate(`metric/${metricSlug}`);
    } else {
      toast.info("No drill-down for this metric yet", {
        description: "Metric pages are available for revenue, customers, enquiries, CAC and conversion.",
      });
    }
  };

  const findSpecialist = () => {
    // Hand this insight's recommended action to the marketplace as a brief:
    // the intelligence found the opportunity, a specialist executes it.
    setTaskPrefill({
      title: insight.title.length >= 8 ? insight.title : `Handle: ${insight.title}`,
      description: `${insight.summary}\n\nWhat we recommend: ${insight.recommendedAction}`,
      category: guessCategory(`${insight.title} ${insight.summary} ${insight.recommendedAction}`),
      skills: [],
      source: "recommendation",
      sourceRef: insight.id,
      sourceTitle: insight.title,
    });
    navigate("market/post");
  };

  return (
    <div>
      <BackLink label="Back to insights" onClick={() => navigate("insights")} />

      <IntelligenceDetail
        eyebrow={meta.eyebrow}
        eyebrowClass={meta.text}
        title={insight.title}
        meta={
          <>
            <span className="text-sm text-muted-foreground">{fmtDate(insight.date)}</span>
            <ConfidenceBadge level={insight.confidenceLevel} value={insight.confidence} />
            <Badge variant="outline" className="font-normal text-slate-600">
              {IMPORTANCE_LABEL[insight.importance]}
            </Badge>
            <ProvenanceBadge provenance="ai-interpretation" />
          </>
        }
      >
        {/* Summary */}
        <p className="max-w-3xl text-[15px] leading-relaxed text-foreground/90">{insight.summary}</p>

        {/* What happened */}
        <SectionCard title="What happened" description="Measured changes behind this insight.">
          <ul className="space-y-2.5">
            {insight.known.map((k, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-blue-600" aria-hidden />
                <span>{k}</span>
              </li>
            ))}
          </ul>
        </SectionCard>

        {/* Where it happened — reasoning chain */}
        {insight.rootCause && (
          <SectionCard
            title="Where it happened — reasoning chain"
            description="How the system moved from a measured change to the likely location of the constraint."
          >
            <RootCauseTree
              steps={insight.rootCause}
              onSelectStep={(i) =>
                toast.info(`Reasoning step ${i + 1} of ${insight.rootCause!.length}`, {
                  description:
                    insight.rootCause![i].note ??
                    "This step follows from the measured evidence listed on this page.",
                })
              }
            />
            <p className="mt-3 text-xs text-muted-foreground">
              Each step links evidence to the next conclusion. The final step lists hypotheses — not certainties.
            </p>
          </SectionCard>
        )}

        {/* Evidence (opens provenance records) */}
        <SectionCard
          title="Evidence"
          description="Every conclusion traces back to these records. Select a linked source to open its provenance record."
        >
          <EvidencePanel
            items={evidence}
            onOpenFact={(factId) => {
              if (factId) navigate(`provenance/${factId}`);
            }}
          />
        </SectionCard>

        {/* Possible explanation / what we do not know */}
        <KnowThinkUnknown
          known={insight.known}
          think={insight.meaning}
          unknown={insight.unknown}
          onImprove={() => {
            navigate("data");
            toast.info("Add data to strengthen this diagnosis", {
              description: "Coverage grows every time you connect a source or record a manual entry.",
            });
          }}
        />

        {/* Confidence (Screen 35) */}
        <ConfidencePanel
          level={insight.confidenceLevel}
          value={insight.confidence}
          coverage={business.dataCoverage.overall}
          sources={sources}
          missing={insight.missingToImprove}
        />

        {/* Opportunity extras (Screen 34) */}
        {insight.type === "opportunity" && (
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-amber-800">
                <Lightbulb className="size-4" aria-hidden /> Potential impact
              </h3>
              <p className="mt-2 text-sm text-amber-900/80">
                {rec?.expectedImpact ?? insight.meaning}
              </p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
              <h3 className="text-sm font-semibold text-amber-800">Effort</h3>
              <div className="mt-2">
                {rec ? <EffortBadge effort={rec.effort} /> : <p className="text-sm text-amber-900/80">Not yet assessed.</p>}
              </div>
              {rec && <p className="mt-2 text-xs text-muted-foreground">Estimated for the linked recommendation.</p>}
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
              <h3 className="text-sm font-semibold text-amber-800">What would strengthen this conclusion</h3>
              <ul className="mt-2 space-y-1.5">
                {insight.missingToImprove.map((m, i) => (
                  <li key={i} className="text-sm text-amber-900/80">
                    · {m}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Recommended next action */}
        <SectionCard
          title="Recommended next action"
          description={rec ? "Linked to a prepared recommendation in the Action Centre." : "No prepared recommendation yet — you can set the action up from this insight."}
          action={<Sparkles className="size-4 text-violet-600" aria-hidden />}
          className="border-violet-200 bg-violet-50/40"
        >
          <p className="text-[15px] leading-relaxed">{insight.recommendedAction}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {insight.recommendationId ? (
              <>
                <Button size="sm" onClick={() => navigate(`recommendations/${insight.recommendationId}`)}>
                  View recommendation
                </Button>
                <Button size="sm" variant="outline" onClick={() => navigate(`action-start/${insight.recommendationId}`)}>
                  Start action
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  toast("This will create a new action", {
                    description: "No prepared recommendation exists for this insight — the Action Centre will set the action up from this diagnosis.",
                  });
                  navigate(`action-start/rec-${insight.id}`);
                }}
              >
                Create action
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={findSpecialist} title="Post this to the Specialists marketplace and get bids">
              <Users className="mr-1.5 size-4" aria-hidden />
              Find a specialist
            </Button>
          </div>
        </SectionCard>

        {/* Related metric */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Related metric</span>
          <button
            type="button"
            onClick={openRelatedMetric}
            className="inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-xs font-medium transition-colors hover:border-blue-300 hover:bg-blue-50/50"
          >
            {insight.primaryMetric}
            <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />
          </button>
        </div>
      </IntelligenceDetail>
    </div>
  );
}
