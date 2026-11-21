"use client";
// Screen 67 — Goal Detail & Progress: timeline, required improvement,
// contributing metrics, related recommendations, actions completed, risks, AI summary.

import React, { useState } from "react";
import { toast } from "sonner";
import { useBizz } from "@/lib/store";
import { getBusiness } from "@/lib/data/businesses";
import { recommendationById } from "@/lib/data/intelligence";
import { GOALS, timelineFor } from "@/lib/data/operations";
import { fmtDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PageHeader, SectionCard, InfoBanner, KeyValue } from "@/components/shared/layout";
import { ProvenanceBadge, StatusBadge } from "@/components/shared/badges";
import { RecommendationCard } from "@/components/shared/cards";
import { TrendLineChart } from "@/components/shared/charts";
import { ErrorState } from "@/components/shared/states";
import { ArrowLeft, ArrowRight, CalendarClock, CheckCircle2, Pencil, ShieldAlert, Sparkles, UserRound } from "lucide-react";
import type { ScreenProps } from "../view-types";
import { PriorityBadge, goalById, goalProgressPct, goalSeriesFor, remainingPhrase, saveGoalEdit } from "./parts";

export function GoalDetail({ params }: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);
  const businessId = useBizz((s) => s.businessId);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const storeGoals = useBizz((s) => s.goals);
  const updateGoal = useBizz((s) => s.updateGoal);
  const setBusiness = useBizz((s) => s.setBusiness);
  const business = getBusiness(businessId, userWorkspace);

  const goal = goalById(businessId, storeGoals, params.id);
  const [progressOpen, setProgressOpen] = useState(false);
  const [draftCurrent, setDraftCurrent] = useState("");
  const [refresh, setRefresh] = useState(0);

  if (!goal) {
    const elsewhere = GOALS.find((g) => g.id === params.id);
    const ownerName = elsewhere?.businessId === "korahome" ? "KoraHome Store" : elsewhere?.businessId === "swifthaul" ? "SwiftHaul Logistics" : null;
    return (
      <div className="space-y-4">
        <ErrorState
          title="Goal not found"
          description="This goal may have been removed or belongs to a different workspace."
          onRetry={() => navigate("goals")}
          onHome={undefined}
        />
        {elsewhere && ownerName ? (
          <div className="mx-auto max-w-md rounded-xl border border-brand-200 bg-brand-50/60 p-4 text-center">
            <p className="text-sm text-brand-900">
              This goal lives in <strong>{ownerName}</strong> — a different demo workspace.
            </p>
            <Button
              size="sm"
              className="mt-2"
              onClick={() => {
                setBusiness(elsewhere.businessId as "swifthaul" | "korahome");
                navigate(`goals/${params.id}`);
              }}
            >
              Switch to {ownerName} and view goal
            </Button>
          </div>
        ) : null}
      </div>
    );
  }

  const isStoreGoal = storeGoals.some((g) => g.id === goal.id);
  const pct = goalProgressPct(goal);
  const gap = remainingPhrase(goal);
  const series = goalSeriesFor(goal, business.monthly);
  const completedEligible = goal.current >= goal.target && goal.status !== "completed";
  const actionEvents = timelineFor(businessId).filter((t) => t.type === "action");
  const recs = goal.relatedRecommendations.map((id) => recommendationById(id)).filter((r): r is NonNullable<typeof r> => Boolean(r));

  const saveCurrent = () => {
    const value = Number(draftCurrent);
    if (!/^\d*\.?\d+$/.test(draftCurrent) || value < 0) {
      toast.error("Enter the latest value", { description: "Use the number you recorded for the current period." });
      return;
    }
    if (isStoreGoal) updateGoal(goal.id, { current: value });
    else saveGoalEdit(goal.id, { current: value });
    toast.success("Progress updated", { description: `Current is now ${value}${goal.unit ? ` ${goal.unit}` : ""} of ${goal.target}.` });
    setProgressOpen(false);
    setRefresh((r) => r + 1);
  };

  const markComplete = () => {
    if (isStoreGoal) updateGoal(goal.id, { status: "completed" });
    else saveGoalEdit(goal.id, { status: "completed" });
    toast.success("Goal marked complete", { description: "It moves to the Completed tab as a record of the result." });
    setRefresh((r) => r + 1);
  };

  const openEdit = () => {
    try {
      // Same key as EDIT_PREFILL_KEY; the old "bizzgrowth-" prefix is kept on purpose.
      sessionStorage.setItem("bizzgrowth-edit-goal", goal.id);
    } catch {}
    toast("Editing prefills from goal", { description: "The form opens with this goal's current definition." });
    navigate("goal-create");
  };

  return (
    <div key={refresh}>
      <Button variant="ghost" size="sm" className="-ml-2 mb-3 text-muted-foreground" onClick={() => navigate("goals")}>
        <ArrowLeft className="size-4" aria-hidden /> Back to goals
      </Button>

      <PageHeader
        title={goal.title}
        badge={
          <>
            <StatusBadge status={goal.status} />
            <PriorityBadge priority={goal.priority} />
          </>
        }
        description={`${goal.metric} · ${business.name}`}
        actions={
          <>
            <Button onClick={() => { setDraftCurrent(String(goal.current)); setProgressOpen(true); }}>Update progress</Button>
            <Button variant="outline" onClick={openEdit}>
              <Pencil className="size-4" aria-hidden /> Edit goal
            </Button>
            {completedEligible ? (
              <Button variant="outline" className="border-emerald-200 text-emerald-700 hover:bg-emerald-50" onClick={markComplete}>
                <CheckCircle2 className="size-4" aria-hidden /> Mark complete
              </Button>
            ) : null}
          </>
        }
      />

      <div className="space-y-5">
        <SectionCard title="Progress" description={`Baseline ${goal.baseline} → target ${goal.target} ${goal.unit}`.trim()}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <p className="text-3xl font-semibold tnum">
              {goal.current}
              <span className="text-lg font-normal text-muted-foreground"> / {goal.target} {goal.unit}</span>
            </p>
            <span className="text-sm text-muted-foreground tnum">{pct}% of target</span>
          </div>
          <Progress value={pct} className="mt-3 h-2.5" aria-label={`${pct}% of target reached`} />
          <div className="mt-4 grid gap-3 text-sm">
            <KeyValue label="Owner">
              <span className="inline-flex items-center gap-1">
                <UserRound className="size-3.5 text-muted-foreground" aria-hidden /> {goal.owner}
              </span>
            </KeyValue>
            <KeyValue label="Deadline">
              <span className="inline-flex items-center gap-1 tnum">
                <CalendarClock className="size-3.5 text-muted-foreground" aria-hidden /> {fmtDate(goal.deadline)}
              </span>
            </KeyValue>
          </div>
        </SectionCard>

        {gap ? (
          <InfoBanner tone="info" title="Required improvement">
            To reach {goal.target}
            {goal.unit && !goal.unit.startsWith("₦") ? ` ${goal.unit}` : ""}, current performance requires {gap}. Paths below show where the
            improvement could come from — they are possibilities, not guarantees.
          </InfoBanner>
        ) : (
          <InfoBanner tone="success" title="Target reached">
            The current value already meets or passes the target. Mark the goal complete to record the result.
          </InfoBanner>
        )}

        <SectionCard
          title="Progress timeline"
          description={`Monthly ${series.series[0].label.toLowerCase()}, Feb–Sep 2026, against the target line.`}
        >
          <TrendLineChart data={series.data} xKey="label" series={series.series} valueFormatter={series.valueFormatter} />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <ProvenanceBadge provenance={businessId === "korahome" ? "measured" : "user-supplied"} source={businessId === "korahome" ? "Shopify sync" : "Manual monthly entries"} />
            <span className="text-xs text-muted-foreground">Dashed line shows the goal target.</span>
          </div>
        </SectionCard>

        {goal.contributing.length > 0 ? (
          <SectionCard title="Contributing metrics" description="Metrics that move this goal. Improving any of them helps.">
            <div className="flex flex-wrap gap-2">
              {goal.contributing.map((c) => (
                <Badge key={c} variant="outline" className="bg-slate-50 font-normal">
                  {c}
                </Badge>
              ))}
            </div>
          </SectionCard>
        ) : null}

        <SectionCard
          title="Related recommendations"
          description="Diagnosed opportunities with the strongest link to this goal."
        >
          {recs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recommendations are currently linked to this goal.</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {recs.map((rec) => (
                <RecommendationCard
                  key={rec.id}
                  rec={rec}
                  onOpen={() => navigate(`recommendations/${rec.id}`)}
                  onStart={() => navigate(`action-start/${rec.id}`)}
                />
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Actions completed" description="Work already carried out toward this goal, from the business timeline.">
          {actionEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No goal-related actions have been recorded yet. Actions appear here once started from a recommendation.</p>
          ) : (
            <ol className="space-y-3">
              {actionEvents.map((e) => (
                <li key={e.id} className="rounded-xl border p-3.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground tnum">{fmtDate(e.date)}</span>
                    <ProvenanceBadge provenance={e.provenance} source={e.source} />
                  </div>
                  <p className="mt-1 text-sm font-medium leading-snug">{e.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{e.description}</p>
                </li>
              ))}
            </ol>
          )}
          <Button variant="link" size="sm" className="mt-2 -ml-2 px-0" onClick={() => navigate("timeline")}>
            Open full timeline <ArrowRight className="size-3.5" aria-hidden />
          </Button>
        </SectionCard>

        {goal.risks ? (
          <InfoBanner tone="warning" title="Risks to this goal">
            <span className="inline-flex items-start gap-1.5">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              {goal.risks}
            </span>
          </InfoBanner>
        ) : null}

        <SectionCard
          title="AI summary"
          action={<ProvenanceBadge provenance="ai-interpretation" source="Reasoning over monthly and channel data" />}
          className="border-brand-200 bg-brand-50/40"
        >
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
            <p className="text-sm leading-6 text-slate-700">{goal.summary}</p>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            This is an AI interpretation, not measured data. It highlights possible paths — outcomes are not guaranteed.
          </p>
        </SectionCard>
      </div>

      <Dialog open={progressOpen} onOpenChange={setProgressOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update progress</DialogTitle>
            <DialogDescription>
              Enter the latest recorded value for {goal.metric.toLowerCase()}. Progress tracking and the weekly brief use this number.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="goal-current">
              Current value ({goal.unit || "target unit"})
            </Label>
            <Input
              id="goal-current"
              type="number"
              inputMode="decimal"
              min={0}
              value={draftCurrent}
              onChange={(e) => setDraftCurrent(e.target.value)}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Latest recorded: <span className="tnum">{goal.current}</span> · Target <span className="tnum">{goal.target}</span>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProgressOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveCurrent}>Save progress</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
