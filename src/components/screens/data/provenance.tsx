"use client";
// Screen 64 — Data Provenance / Fact Detail.
// Every important number can be traced to where it came from.

import { ArrowLeft, ArrowRight, Database, FileWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/states";
import { InfoBanner, KeyValue, PageHeader, SectionCard } from "@/components/shared/layout";
import { ConfidenceBadge, ProvenanceBadge } from "@/components/shared/badges";
import { useBizz } from "@/lib/store";
import { getBusiness } from "@/lib/data/businesses";
import { provenanceById, provenanceFor } from "@/lib/data/operations";
import { fmtDate } from "@/lib/format";
import type { Provenance, ProvenanceFact } from "@/lib/types";
import type { ViewMap } from "../view-types";

const PROV_EXPLANATION: Record<Provenance, string> = {
  measured:
    "This value was retrieved directly from a connected source or recorded measurement — it was not estimated or interpreted.",
  "user-supplied":
    "This value was entered by someone in your team. It is trusted but labelled, so any conclusion that depends on it is visible.",
  estimated:
    "This value was calculated from other values (for example spend ÷ customers) or approximated. It is labelled so analysis stays transparent.",
  "ai-interpretation":
    "This is a conclusion produced by reasoning over your data — not measured data. Confidence reflects the strength of the evidence behind it.",
};

function depRoute(dep: string): string | null {
  const rec = dep.match(/rec-[a-z]{2}-\d+/);
  if (rec) return `recommendations/${rec[0]}`;
  const ins = dep.match(/ins-[a-z]{2}-\d+/);
  if (ins) return `insights/${ins[0]}`;
  const act = dep.match(/act-[a-z]{2}-\d+/);
  if (act) return `actions/${act[0]}`;
  const exp = dep.match(/exp-[a-z]{2}-\d+/);
  if (exp) return `experiments/${exp[0]}`;
  return null;
}

function FactRow({ fact, active }: { fact: ProvenanceFact; active?: boolean }) {
  const navigate = useBizz((s) => s.navigate);
  return (
    <button
      onClick={() => navigate(`provenance/${fact.id}`)}
      aria-label={`Open fact: ${fact.label}`}
      className={`flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border p-3.5 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/40 ${
        active ? "border-brand-300 bg-brand-50/40" : ""
      }`}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium leading-snug">{fact.label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{fact.source}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold tnum">{fact.value}</span>
        <ProvenanceBadge provenance={fact.provenance} />
        <ArrowRight className="size-3.5 text-slate-300" aria-hidden />
      </div>
    </button>
  );
}

function ProvenanceFactScreen({ params }: { params: Record<string, string> }) {
  const businessId = useBizz((s) => s.businessId);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const navigate = useBizz((s) => s.navigate);
  const business = getBusiness(businessId, userWorkspace);

  const allFacts = provenanceFor(businessId);
  const fact = params.id && params.id !== "all" ? provenanceById(params.id) : undefined;

  // Unknown id (or "all") → list every fact for this workspace with an info banner.
  if (!fact) {
    return (
      <div className="mx-auto w-full max-w-4xl">
        <PageHeader
          title="Facts and provenance"
          description={`Where each recorded fact about ${business.name} comes from, who entered it and how precise it is.`}
          back={
            <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => navigate("data")}>
              Back to Data Centre
            </Button>
          }
        />
        {params.id && params.id !== "all" ? (
          <InfoBanner tone="warning" title="That fact could not be found">
            Showing all facts recorded for this workspace instead.
          </InfoBanner>
        ) : null}
        <div className="mt-5 space-y-2.5">
          {allFacts.length === 0 ? (
            <EmptyState
              icon={<Database className="size-5" />}
              title="No facts recorded yet"
              description="Facts appear here as sources connect and totals are entered — each with its source, precision and confidence."
              actions={
                <Button size="sm" onClick={() => navigate("integrations")}>
                  Connect sources
                </Button>
              }
            />
          ) : (
            allFacts.map((f) => <FactRow key={f.id} fact={f} />)
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        title={fact.label}
        description="Exactly where this fact came from — the trust layer behind every analysis."
        back={
          <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => navigate("provenance/all")}>
            All facts
          </Button>
        }
        badge={
          <>
            <ProvenanceBadge provenance={fact.provenance} source={fact.source} />
            <ConfidenceBadge level={fact.confidence} />
          </>
        }
      />

      <Card className="p-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Value</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <p className="text-4xl font-bold leading-none tracking-tight tnum">{fact.value}</p>
          <ProvenanceBadge provenance={fact.provenance} source={fact.source} />
        </div>
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">What this label means</p>
          <p className="mt-1 text-sm text-slate-600">{PROV_EXPLANATION[fact.provenance]}</p>
        </div>
      </Card>

      <SectionCard title="Record" className="mt-5">
        <div className="space-y-2.5">
          <KeyValue label="Source">{fact.source}</KeyValue>
          {fact.enteredBy ? <KeyValue label="Entered by">{fact.enteredBy}</KeyValue> : null}
          <KeyValue label="Date">{fmtDate(fact.date)}</KeyValue>
          <KeyValue label="Precision">{fact.precision}</KeyValue>
          <KeyValue label="Confidence">
            <ConfidenceBadge level={fact.confidence} />
          </KeyValue>
        </div>
      </SectionCard>

      {fact.note ? (
        <InfoBanner tone={fact.provenance === "ai-interpretation" ? "ai" : "warning"} title="Note" >
          <span className="flex items-start gap-1.5">
            <FileWarning className="mt-0.5 size-4 shrink-0" aria-hidden />
            {fact.note}
          </span>
        </InfoBanner>
      ) : null}

      <SectionCard title="Dependencies" description="Analyses and conclusions built on this fact." className="mt-5">
        {fact.dependencies && fact.dependencies.length > 0 ? (
          <ul className="space-y-1.5">
            {fact.dependencies.map((dep) => {
              const route = depRoute(dep);
              return (
                <li key={dep} className="flex items-center justify-between gap-2 text-sm">
                  <span>{dep}</span>
                  {route ? (
                    <button
                      onClick={() => navigate(route)}
                      className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
                      aria-label={`Open ${dep}`}
                    >
                      Open <ArrowRight className="size-3" aria-hidden />
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No recorded dependencies yet.</p>
        )}
      </SectionCard>

      <div className="mt-6">
        <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <ArrowLeft className="size-4" aria-hidden /> Other facts in this workspace
        </h2>
        <div className="space-y-2.5">
          {allFacts.filter((f) => f.id !== fact.id).map((f) => (
            <FactRow key={f.id} fact={f} />
          ))}
        </div>
      </div>
    </div>
  );
}

export const views: ViewMap = {
  "provenance/:id": ProvenanceFactScreen,
};
