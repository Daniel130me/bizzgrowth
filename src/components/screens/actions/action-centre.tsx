"use client";
// Screen 38 — Action Centre: recommendations → tracked actions → measurement.
// The owner's own workspace shows their real steps (your-actions.tsx); the
// sample businesses keep this demo of recommendations, actions and experiments.

import { useMemo, useState } from "react";
import { CalendarClock, FlaskConical, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActionCard, RecommendationCard } from "@/components/shared/cards";
import { EffortBadge, StatusBadge } from "@/components/shared/badges";
import { InfoBanner, PageHeader, SectionCard } from "@/components/shared/layout";
import { EmptyState } from "@/components/shared/states";
import { getBusiness } from "@/lib/data/businesses";
import { recommendationsFor } from "@/lib/data/intelligence";
import { useBizz } from "@/lib/store";
import type { ActionRecord, Recommendation } from "@/lib/types";
import {
  CATEGORY_CHIP_CLS,
  categoryForRecId,
  daysRemainingLabel,
  useCombinedActions,
  useCombinedExperiments,
  type ActionCategory,
} from "./helpers";
import { OWN_WORKSPACE, YourActions } from "./your-actions";

function CategoryChip({ category }: { category: ActionCategory }) {
  return (
    <Badge variant="outline" className={CATEGORY_CHIP_CLS[category]}>
      {category}
    </Badge>
  );
}

function ActionList({ items, onOpen }: { items: ActionRecord[]; onOpen: (path: string) => void }) {
  return (
    <div className="space-y-4">
      {items.map((a) => (
        <div key={a.id} className="space-y-1.5">
          <ActionCard action={a} onOpen={() => onOpen(`actions/${a.id}`)} />
          <div className="flex flex-wrap items-center gap-2 px-1">
            <CategoryChip category={categoryForRecId(a.recommendationId)} />
            {a.recommendationId ? (
              <button
                className="text-xs text-muted-foreground underline-offset-2 hover:text-brand-700 hover:underline"
                onClick={() => onOpen(`recommendations/${a.recommendationId}`)}
              >
                From recommendation {a.recommendationId}
              </button>
            ) : (
              <span className="text-xs text-muted-foreground">Created manually</span>
            )}
            {a.metric ? <span className="text-xs text-muted-foreground">· Metric: {a.metric}</span> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ActionCentre() {
  const businessId = useBizz((s) => s.businessId);
  return businessId === OWN_WORKSPACE ? <YourActions /> : <SampleActionCentre />;
}

function SampleActionCentre() {
  const navigate = useBizz((s) => s.navigate);
  const businessId = useBizz((s) => s.businessId);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const recommendationState = useBizz((s) => s.recommendationState);
  const setRecommendationState = useBizz((s) => s.setRecommendationState);
  const [tab, setTab] = useState("recommended");

  const business = getBusiness(businessId, userWorkspace);
  const recs = useMemo(() => recommendationsFor(businessId), [businessId]);
  const actions = useCombinedActions(businessId);
  const experiments = useCombinedExperiments(businessId);

  const effectiveStatus = (r: Recommendation) => recommendationState[r.id] ?? r.status;
  const activeRecs = recs.filter((r) => effectiveStatus(r) !== "dismissed");
  const dismissedRecs = recs.filter((r) => effectiveStatus(r) === "dismissed");
  const inProgress = actions.filter((a) => a.status === "in-progress");
  const measuring = actions.filter((a) => a.status === "measuring");
  const completed = actions.filter((a) => a.status === "completed");

  const renderRec = (r: Recommendation, dismissedView: boolean) => {
    const card: Recommendation = { ...r, status: effectiveStatus(r) };
    return (
      <div key={r.id} className="space-y-1.5">
        <RecommendationCard
          rec={card}
          onOpen={() => navigate(`recommendations/${r.id}`)}
          onStart={() => navigate(`action-start/${r.id}`)}
          right={
            dismissedView ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setRecommendationState(r.id, "open")}>
                  Restore
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate(`recommendations/${r.id}`)}>
                  View details
                </Button>
              </>
            ) : undefined
          }
        />
        <div className="flex flex-wrap items-center gap-2 px-1">
          <CategoryChip category={categoryForRecId(r.id)} />
          <EffortBadge effort={r.effort} />
          <span className="text-xs text-muted-foreground">Owner is assigned when the action starts.</span>
        </div>
      </div>
    );
  };

  const emptyFor = (title: string, description: string) => (
    <EmptyState
      title={title}
      description={description}
      actions={
        <Button variant="outline" size="sm" onClick={() => setTab("recommended")}>
          Browse recommendations
        </Button>
      }
    />
  );

  return (
    <div>
      <PageHeader
        title="Action Centre"
        description="Turn recommendations into trackable work — with an owner, a checklist and an honest measurement window."
        actions={
          <Button variant="outline" onClick={() => navigate("timeline")}>
            <CalendarClock className="mr-2 size-4" aria-hidden />
            Business timeline
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={setTab} className="space-y-5">
        <div className="overflow-x-auto pb-1">
          <TabsList>
            <TabsTrigger value="recommended">Recommended ({activeRecs.length})</TabsTrigger>
            <TabsTrigger value="in-progress">In progress ({inProgress.length})</TabsTrigger>
            <TabsTrigger value="measuring">Measuring ({measuring.length})</TabsTrigger>
            <TabsTrigger value="completed">Completed ({completed.length})</TabsTrigger>
            <TabsTrigger value="all">All ({actions.length})</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="recommended" className="space-y-5">
          <InfoBanner tone="ai" title="From diagnosis to action">
            Recommendations come from your latest diagnosis. Starting one creates trackable work — and if it is measured as an
            experiment, results are compared against a baseline before and after the change.
          </InfoBanner>
          {activeRecs.length === 0 ? (
            <EmptyState
              title="No active recommendations"
              description="New recommendations appear here after each monthly diagnosis. Dismissed items remain available below."
            />
          ) : (
            <div className="space-y-4">{activeRecs.map((r) => renderRec(r, false))}</div>
          )}
          {dismissedRecs.length > 0 && (
            <SectionCard title="Dismissed" description="Hidden from the recommended queue. Restore any time.">
              <div className="max-h-96 space-y-4 overflow-y-auto">{dismissedRecs.map((r) => renderRec(r, true))}</div>
            </SectionCard>
          )}
        </TabsContent>

        <TabsContent value="in-progress">
          {inProgress.length ? (
            <ActionList items={inProgress} onOpen={navigate} />
          ) : (
            emptyFor("No actions in progress", "Start a recommendation to create your first tracked action.")
          )}
        </TabsContent>

        <TabsContent value="measuring">
          {measuring.length ? (
            <ActionList items={measuring} onOpen={navigate} />
          ) : (
            emptyFor("Nothing is being measured", "Mark an action implemented to open a measurement window for it.")
          )}
        </TabsContent>

        <TabsContent value="completed">
          {completed.length ? (
            <ActionList items={completed} onOpen={navigate} />
          ) : (
            emptyFor("No completed actions yet", "Actions move here when their work is done and verified.")
          )}
        </TabsContent>

        <TabsContent value="all">
          {actions.length ? (
            <ActionList items={actions} onOpen={navigate} />
          ) : (
            emptyFor("No actions yet", "Every recommendation you start becomes a tracked action here.")
          )}
        </TabsContent>
      </Tabs>

      <div className="mt-8">
        <SectionCard
          title="Experiments & measurement windows"
          description="Each experiment isolates one change over a fixed window so results can be interpreted honestly."
          action={
            <Button variant="outline" size="sm" onClick={() => navigate("experiment-setup/new")}>
              <Plus className="mr-2 size-4" aria-hidden />
              Set up an experiment
            </Button>
          }
        >
          {experiments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No experiments yet. Setting one up records a baseline, a target and the other changes to watch.
            </p>
          ) : (
            <ul className="divide-y">
              {experiments.map((e) => (
                <li key={e.id}>
                  <button
                    onClick={() => navigate(`experiments/${e.id}`)}
                    className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <FlaskConical className="size-4 shrink-0 text-brand-600" aria-hidden />
                      <span className="truncate text-sm font-medium">{e.title}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                      <StatusBadge status={e.status} />
                      {daysRemainingLabel(e)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            {business.name}: {experiments.length} experiment{experiments.length === 1 ? "" : "s"} · outcomes are only recorded
            when a window closes.
          </p>
        </SectionCard>
      </div>
    </div>
  );
}
