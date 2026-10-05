"use client";
// Screen 44 — Outcome / Result Detail (uses exp-sh-0 as the primary example).

import { useState } from "react";
import { toast } from "sonner";
import { ArrowDownRight, ArrowUpRight, CheckCircle2, Hourglass, Minus, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExperimentProgressChart } from "@/components/shared/charts";
import { ConfidenceBadge, ProvenanceBadge, StatusBadge } from "@/components/shared/badges";
import { Breadcrumbs, PageHeader, SectionCard } from "@/components/shared/layout";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { useBizz } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { Goodness } from "@/lib/types";
import type { ScreenProps } from "../view-types";
import { metricFormatterFor, metricLabelFor, useCombinedExperiments } from "./helpers";

function GoodnessPill({ goodness }: { goodness: Goodness }) {
  const map = {
    good: {
      icon: <ArrowUpRight className="size-3" aria-hidden />,
      label: "Improved",
      cls: "bg-emerald-50 text-emerald-700 border-emerald-200",
    },
    bad: {
      icon: <ArrowDownRight className="size-3" aria-hidden />,
      label: "Declined",
      cls: "bg-red-50 text-red-700 border-red-200",
    },
    neutral: {
      icon: <Minus className="size-3" aria-hidden />,
      label: "No change",
      cls: "bg-slate-100 text-slate-600 border-slate-200",
    },
  } as const;
  const s = map[goodness];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium", s.cls)}>
      {s.icon}
      {s.label}
    </span>
  );
}

export function OutcomeDetail({ params }: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);
  const businessId = useBizz((s) => s.businessId);
  const experiments = useCombinedExperiments(businessId);
  const [decision, setDecision] = useState<string | null>(null);

  const exp = experiments.find((e) => e.id === params.id);

  if (!exp) {
    return (
      <ErrorState
        title="Result not found"
        description="No experiment matches this link. Outcomes appear here once a measurement window closes."
        onHome={() => navigate("actions")}
      />
    );
  }

  const o = exp.outcome;

  if (!o) {
    return (
      <div>
        <Breadcrumbs
          items={[
            { label: "Action Centre", onClick: () => navigate("actions") },
            { label: "Experiments", onClick: () => navigate(`experiments/${exp.id}`) },
            { label: "Outcome" },
          ]}
        />
        <PageHeader title={exp.title} badge={<StatusBadge status={exp.status} />} />
        <EmptyState
          icon={<Timer className="size-5" />}
          title={`Measurement in progress — ${exp.daysRemaining} days remaining`}
          description="An outcome is recorded only when the measurement window closes. Until then, interim readings are directional and no result is concluded."
          actions={<Button onClick={() => navigate(`experiments/${exp.id}`)}>Open tracking page</Button>}
        />
        <div className="mt-6">
          <SectionCard title="Current readings" description={metricLabelFor(exp)}>
            <ExperimentProgressChart
              baseline={exp.baselineValue}
              current={exp.currentValue}
              target={exp.targetValue}
              label={metricLabelFor(exp)}
              formatter={metricFormatterFor(exp)}
            />
          </SectionCard>
        </div>
      </div>
    );
  }

  const recordDecision = (kind: "kept" | "reverted" | "extended") => {
    setDecision(kind);
    if (kind === "kept") toast.success("Change kept — timeline updated");
    if (kind === "reverted") toast("Change reverted", { description: "Future analyses will treat this change as undone." });
    if (kind === "extended")
      toast.success("Measurement extended", { description: "The window continues before an outcome is finalised." });
  };

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Action Centre", onClick: () => navigate("actions") },
          { label: "Experiments", onClick: () => navigate(`experiments/${exp.id}`) },
          { label: "Outcome" },
        ]}
      />
      <PageHeader
        title={`Outcome — ${exp.title}`}
        badge={<StatusBadge status={exp.status} />}
        description={`Measurement window ${o.period}. A result is only recorded once the window closes.`}
      />

      <SectionCard title="Outcome" description={`${o.primaryMetric} — before, after and difference.`}>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-slate-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Before</p>
            <p className="mt-1 text-2xl font-semibold tnum">{o.before}</p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-blue-700">After</p>
            <p className="mt-1 text-2xl font-semibold tnum">{o.after}</p>
          </div>
          <div
            className={cn(
              "rounded-xl border p-4",
              o.goodness === "good"
                ? "border-emerald-200 bg-emerald-50/60"
                : o.goodness === "bad"
                  ? "border-red-200 bg-red-50/60"
                  : "border-slate-200 bg-slate-50",
            )}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Difference</p>
            <p
              className={cn(
                "mt-1 text-2xl font-semibold tnum",
                o.goodness === "good" ? "text-emerald-700" : o.goodness === "bad" ? "text-red-700" : "",
              )}
            >
              {o.delta}
            </p>
            <p className="mt-1.5">
              <GoodnessPill goodness={o.goodness} />
            </p>
          </div>
        </div>
      </SectionCard>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <SectionCard title="Secondary metrics" description="Supporting measures over the same window.">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Metric</TableHead>
                <TableHead>Before</TableHead>
                <TableHead>After</TableHead>
                <TableHead>Reading</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {o.secondary.map((s) => (
                <TableRow key={s.label}>
                  <TableCell className="font-medium">{s.label}</TableCell>
                  <TableCell className="tnum">{s.before}</TableCell>
                  <TableCell className="tnum">{s.after}</TableCell>
                  <TableCell>
                    <GoodnessPill goodness={s.goodness} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>

        <div className="space-y-4">
          <SectionCard title="Other changes during the period">
            <ul className="space-y-1.5">
              {o.otherChanges.map((c, i) => (
                <li key={i} className="text-sm">
                  · {c}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted-foreground">
              If several things changed in the same window, we say so — a result is never attributed to one change by default.
            </p>
          </SectionCard>

          <SectionCard title="Attribution confidence">
            <div className="flex flex-wrap items-center gap-2">
              <ConfidenceBadge level={o.attribution} />
              <span className="text-sm text-muted-foreground">How strongly timing and data support a link.</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed">
              The timing suggests the intervention may have contributed, although other changes occurred in the same window.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Confidence is not proof of causation — it describes how well the evidence supports a connection.
            </p>
          </SectionCard>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <SectionCard title="AI interpretation" action={<ProvenanceBadge provenance="ai-interpretation" />}>
          <blockquote className="border-l-2 border-violet-300 pl-3 text-sm leading-relaxed text-slate-700">
            {o.interpretation}
          </blockquote>
        </SectionCard>
        <SectionCard title="Conclusion">
          <blockquote className="border-l-2 border-slate-300 pl-3 text-sm leading-relaxed text-slate-700">
            {o.conclusion}
          </blockquote>
        </SectionCard>
      </div>

      <SectionCard
        title="Decision"
        description="Record what happens to this change — the timeline and future analyses follow it."
        className="mt-5"
      >
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => recordDecision("kept")}>
            <CheckCircle2 className="mr-2 size-4" aria-hidden />
            Keep change
          </Button>
          <Button variant="outline" onClick={() => recordDecision("reverted")}>
            Revert
          </Button>
          <Button variant="outline" onClick={() => recordDecision("extended")}>
            <Hourglass className="mr-2 size-4" aria-hidden />
            Run longer
          </Button>
          <Button variant="ghost" onClick={() => navigate(`experiment-setup/${exp.actionId ?? exp.id}`)}>
            Run another experiment
          </Button>
        </div>
        {decision === "kept" && (
          <p className="mt-3 text-sm text-emerald-700">Decision recorded — the change stays and the timeline reflects it.</p>
        )}
        {decision === "reverted" && (
          <p className="mt-3 text-sm text-slate-600">Decision recorded — the change is treated as undone in future analyses.</p>
        )}
        {decision === "extended" && (
          <p className="mt-3 text-sm text-slate-600">
            Decision recorded — measurement continues before the result is finalised.
          </p>
        )}
      </SectionCard>
    </div>
  );
}
