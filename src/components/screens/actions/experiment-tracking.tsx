"use client";
// Screen 43 — Experiment / Measurement Tracking.

import { FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ExperimentProgressChart } from "@/components/shared/charts";
import { MetricCard } from "@/components/shared/cards";
import { StatusBadge } from "@/components/shared/badges";
import { Breadcrumbs, InfoBanner, KeyValue, PageHeader, SectionCard } from "@/components/shared/layout";
import { ErrorState } from "@/components/shared/states";
import { getBusiness } from "@/lib/data/businesses";
import { useBizz } from "@/lib/store";
import { fmtDate } from "@/lib/format";
import type { ScreenProps } from "../view-types";
import {
  daysRemainingLabel,
  metricFormatterFor,
  metricLabelFor,
  useCombinedActions,
  useCombinedExperiments,
  windowProgressPct,
} from "./helpers";

export function ExperimentTracking({ params }: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);
  const businessId = useBizz((s) => s.businessId);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const actions = useCombinedActions(businessId);
  const experiments = useCombinedExperiments(businessId);
  const business = getBusiness(businessId, userWorkspace);

  const exp = experiments.find((e) => e.id === params.id);

  if (!exp) {
    return (
      <ErrorState
        title="Experiment not found"
        description="This experiment may belong to another workspace, or the link is out of date."
        onHome={() => navigate("actions")}
      />
    );
  }

  const action = actions.find((a) => a.id === exp.actionId);
  const others = experiments.filter((e) => e.id !== exp.id);
  const complete = exp.status === "complete";

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Action Centre", onClick: () => navigate("actions") },
          { label: "Experiments" },
          { label: exp.title },
        ]}
      />
      <PageHeader
        title={exp.title}
        badge={<StatusBadge status={exp.status} />}
        description={exp.hypothesis}
        actions={
          complete ? (
            <Button onClick={() => navigate(`outcome/${exp.id}`)}>View outcome</Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Current reading" value={exp.current} />
        <MetricCard label="Baseline" value={exp.baseline} footnote="Value when the window opened." />
        <MetricCard label="Target" value={exp.target} footnote={`Over ${exp.windowDays} days.`} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <SectionCard
          title="Progress toward target"
          description={metricLabelFor(exp)}
          className="lg:col-span-2"
        >
          <ExperimentProgressChart
            baseline={exp.baselineValue}
            current={exp.currentValue}
            target={exp.targetValue}
            label={metricLabelFor(exp)}
            formatter={metricFormatterFor(exp)}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Interim readings are directional — an outcome is recorded only when the window closes.
          </p>
        </SectionCard>

        <SectionCard title="Setup">
          <div className="space-y-3">
            <KeyValue label="Status">
              <StatusBadge status={exp.status} />
            </KeyValue>
            <KeyValue label="Owner">{exp.owner}</KeyValue>
            <KeyValue label="Started">{fmtDate(exp.startedAt)}</KeyValue>
            <KeyValue label="Window">{exp.windowDays} days</KeyValue>
            <KeyValue label="Days remaining">
              {exp.daysRemaining > 0 ? `${exp.daysRemaining} of ${exp.windowDays}` : "Complete"}
            </KeyValue>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{daysRemainingLabel(exp)}</span>
              <span className="tnum">{windowProgressPct(exp)}% of window elapsed</span>
            </div>
            <Progress value={windowProgressPct(exp)} className="mt-1.5 h-2" />
          </div>
          {action && (
            <Button variant="outline" size="sm" className="mt-4 w-full" onClick={() => navigate(`actions/${action.id}`)}>
              View originating action
            </Button>
          )}
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <InfoBanner tone="warning" title="Other changes may affect attribution">
          <ul className="mt-1 space-y-1">
            {exp.otherChanges.map((c, i) => (
              <li key={i}>· {c}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs opacity-80">
            We watch for other changes during the window so results are interpreted honestly.
          </p>
        </InfoBanner>

        <SectionCard title="Metrics watched alongside" description="Secondary signals that could explain a result.">
          <div className="flex flex-wrap gap-2">
            {exp.watchMetrics.map((m) => (
              <Badge key={m} variant="outline" className="bg-slate-50 font-normal">
                {m}
              </Badge>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Change being tested: {exp.change}</p>
        </SectionCard>
      </div>

      <div className="mt-6">
        <SectionCard title={`Other experiments — ${business.name}`}>
          {others.length === 0 ? (
            <p className="text-sm text-muted-foreground">No other experiments for this business yet.</p>
          ) : (
            <ul className="divide-y">
              {others.map((e) => (
                <li key={e.id}>
                  <button
                    onClick={() => navigate(`experiments/${e.id}`)}
                    className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <FlaskConical className="size-4 shrink-0 text-violet-600" aria-hidden />
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
        </SectionCard>
      </div>
    </div>
  );
}
