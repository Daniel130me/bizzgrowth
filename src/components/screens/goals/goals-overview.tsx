"use client";
// Screen 65 — Goals Overview: active / at-risk / completed / draft tabs.

import React, { useState } from "react";
import { useBizz } from "@/lib/store";
import { getBusiness } from "@/lib/data/businesses";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/layout";
import { StatusBadge } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/states";
import { fmtDate } from "@/lib/format";
import { CalendarClock, Plus, Target, UserRound } from "lucide-react";
import type { GoalRecord } from "@/lib/types";
import type { ScreenProps } from "../view-types";
import { PriorityBadge, goalProgressPct, goalsForBusiness } from "./parts";

const TAB_STATUSES = ["active", "at-risk", "completed", "draft"] as const;
type TabKey = (typeof TAB_STATUSES)[number];

const EMPTY_COPY: Record<TabKey, { title: string; description: string }> = {
  active: {
    title: "No active goals yet",
    description:
      "Active goals connect your recommendations and actions to a measurable target with an owner and a deadline. Create one to start tracking progress.",
  },
  "at-risk": {
    title: "Nothing is at risk right now",
    description:
      "At-risk goals are active but unlikely to be reached by the deadline at the current pace. Goals move here automatically when progress falls behind.",
  },
  completed: {
    title: "No completed goals yet",
    description:
      "Completed goals stay here as a record of what was achieved and which actions contributed. Mark a goal complete from its detail page when the target is reached.",
  },
  draft: {
    title: "No draft goals",
    description:
      "Drafts are goals you are still shaping — they are visible to you only, excluded from progress tracking and recommendations until they are activated.",
  },
};

function GoalCard({ goal, onOpen }: { goal: GoalRecord; onOpen: () => void }) {
  const pct = goalProgressPct(goal);
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className="cursor-pointer p-4 transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`${goal.title} — ${goal.current} of ${goal.target} ${goal.unit || "target"}. Open goal detail.`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[15px] font-semibold leading-snug">{goal.title}</h3>
        <StatusBadge status={goal.status} className="shrink-0" />
      </div>
      <p className="mt-2 text-2xl font-semibold tnum">
        {goal.current}
        <span className="text-base font-normal text-muted-foreground"> / {goal.target} {goal.unit}</span>
      </p>
      <Progress value={pct} className="mt-2 h-2" aria-label={`${pct}% of target`} />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <PriorityBadge priority={goal.priority} />
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <CalendarClock className="size-3.5" aria-hidden /> Due {fmtDate(goal.deadline)}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <UserRound className="size-3.5" aria-hidden /> {goal.owner}
        </span>
        {goal.relatedRecommendations.length > 0 ? (
          <span>
            {goal.relatedRecommendations.length} related {goal.relatedRecommendations.length === 1 ? "recommendation" : "recommendations"}
          </span>
        ) : null}
      </div>
    </Card>
  );
}

export function GoalsOverview({ params: _params }: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);
  const businessId = useBizz((s) => s.businessId);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const storeGoals = useBizz((s) => s.goals);
  const business = getBusiness(businessId, userWorkspace);

  const goals = goalsForBusiness(businessId, storeGoals);
  const counts = Object.fromEntries(TAB_STATUSES.map((t) => [t, goals.filter((g) => g.status === t).length])) as Record<TabKey, number>;

  const [tab, setTab] = useState<TabKey>("active");
  const visible = goals.filter((g) => g.status === tab);

  return (
    <div>
      <PageHeader
        title="Goals"
        description={`Targets for ${business.name} that connect diagnosis, actions and measurement. Progress updates as your data updates.`}
        actions={
          <Button onClick={() => navigate("goal-create")}>
            <Plus className="size-4" aria-hidden /> Create goal
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)}>
        <TabsList className="mb-4 flex-wrap h-auto">
          {TAB_STATUSES.map((t) => (
            <TabsTrigger key={t} value={t} className="capitalize">
              {t.replace("-", " ")}
              <span className="ml-1.5 rounded-full bg-slate-200/70 px-1.5 text-xs tnum text-slate-600">{counts[t]}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {TAB_STATUSES.map((t) => (
          <TabsContent key={t} value={t} className="mt-0">
            {visible.length === 0 ? (
              <EmptyState
                icon={<Target className="size-5" />}
                title={EMPTY_COPY[t].title}
                description={EMPTY_COPY[t].description}
                actions={
                  t === "active" ? (
                    <Button size="sm" onClick={() => navigate("goal-create")}>
                      <Plus className="size-3.5" aria-hidden /> Create goal
                    </Button>
                  ) : t === "at-risk" && counts.active > 0 ? (
                    <Button size="sm" variant="outline" onClick={() => setTab("active")}>
                      View active goals
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {visible.map((g) => (
                  <GoalCard key={g.id} goal={g} onOpen={() => navigate(`goals/${g.id}`)} />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <p className="mt-6 text-xs text-muted-foreground">
        Goals are tracked against monthly data. Related recommendations explain the fastest path to each target — opening a goal shows the required improvement and its risks.
      </p>
    </div>
  );
}
