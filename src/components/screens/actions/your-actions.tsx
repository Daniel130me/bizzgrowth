"use client";
// Actions in the owner's own workspace: every step they accepted, read from the
// one source of truth, the coaching steps. Home's "You're trying" card, the
// Challenges page and Ask's step strip read the same steps. The step being
// tried comes first, on the same card Home shows. With nothing running, the
// not-started step Home offers shows as "Ready to start", with the same Start
// button. Then paused steps, finished ones (with what they showed) and stopped
// ones; then anything set up by hand.
// Sample businesses keep their demo Action Centre (action-centre.tsx).

import { useMemo, type ReactNode } from "react";
import { ArrowRight, CalendarClock, FlaskConical, Flag, ListChecks, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/badges";
import { PageHeader } from "@/components/shared/layout";
import { ActiveStepCard, NextStepCard, StepKindPill, VerdictPill } from "@/components/shared/coach";
import { WorkOnThisButton } from "@/components/shared/challenges";
import { useActiveCoachStep, useBizz, useFocusChallenge, useLatestCoachStep, useOwnChallenges, type CoachStep } from "@/lib/store";
import { friendlyDate, stepProgress, templateNextStep, type CheckInVerdict, type NextStep } from "@/lib/coach";
import { shorten } from "@/lib/checkup-math";
import type { BusinessFacts } from "@/lib/checkup";
import type { Challenge } from "@/lib/challenges";
import type { ActionRecord, ExperimentRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

/** The owner's own workspace. Sample businesses have their own ids. */
export const OWN_WORKSPACE = "user-workspace";

/* ------------------------------------------------------------------ */
/* Where a step stands                                                  */
/* ------------------------------------------------------------------ */

type StepStatus = CoachStep["status"];

const STEP_STATUS: Record<StepStatus, { label: string; cls: string }> = {
  active: { label: "Running", cls: "border-brand-200 bg-brand-50 text-brand-700" },
  paused: { label: "Paused", cls: "border-amber-200 bg-amber-50 text-amber-800" },
  done: { label: "Finished", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  stopped: { label: "Stopped", cls: "border-slate-200 bg-slate-100 text-slate-600" },
};

export function StepStatusPill({ status, className }: { status: StepStatus; className?: string }) {
  const s = STEP_STATUS[status] ?? STEP_STATUS.stopped;
  return <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", s.cls, className)}>{s.label}</span>;
}

const VERDICTS: CheckInVerdict[] = ["working", "no-change", "worse", "not-tried", "too-early", "unclear"];

const newestFirst = (a: string | undefined, b: string | undefined) => (b ?? "").localeCompare(a ?? "");

export interface WorkspaceSteps {
  /** The step being tried now: the same one Home, Ask and the challenge page show. */
  active: CoachStep | null;
  /** Older data can hold more than one active step. None of them is hidden. */
  alsoActive: CoachStep[];
  paused: CoachStep[];
  finished: CoachStep[];
  /** Stopped, plus anything with a status this version doesn't know. */
  stopped: CoachStep[];
}

/** The open workspace's steps, grouped by where each one stands. */
export function useWorkspaceSteps(): WorkspaceSteps {
  const steps = useBizz((s) => s.coach.steps);
  const businessId = useBizz((s) => s.businessId);
  const active = useActiveCoachStep();
  return useMemo(() => {
    const mine = steps.filter((x) => x.workspaceId === businessId);
    return {
      active,
      alsoActive: mine.filter((x) => x.status === "active" && x.id !== active?.id),
      paused: mine.filter((x) => x.status === "paused").sort((a, b) => newestFirst(a.pausedAt ?? a.acceptedAt, b.pausedAt ?? b.acceptedAt)),
      finished: mine.filter((x) => x.status === "done").sort((a, b) => newestFirst(a.result?.at ?? a.acceptedAt, b.result?.at ?? b.acceptedAt)),
      stopped: mine
        .filter((x) => x.status !== "active" && x.status !== "paused" && x.status !== "done")
        .sort((a, b) => newestFirst(a.acceptedAt, b.acceptedAt)),
    };
  }, [steps, businessId, active]);
}

/** The challenge a step works on, if it has one. */
function challengeFor(st: CoachStep, challenges: Challenge[]): Challenge | null {
  return (st.challengeId ? challenges.find((c) => c.id === st.challengeId) : undefined) ?? challenges.find((c) => c.stepIds.includes(st.id)) ?? null;
}

/** The page with a step's details: its result once there is one, else its experiment or action. */
function detailsFor(st: CoachStep, actions: ActionRecord[], experiments: ExperimentRecord[]): { route: string; label: string } | null {
  const exp = st.experimentId ? experiments.find((e) => e.id === st.experimentId) : undefined;
  if (exp) return exp.outcome ? { route: `outcome/${exp.id}`, label: "See the result" } : { route: `experiments/${exp.id}`, label: "See the details" };
  if (actions.some((a) => a.id === st.actionId)) return { route: `actions/${st.actionId}`, label: "See the details" };
  return null;
}

function lastCheckInSummary(st: CoachStep): string | null {
  const done = st.checkIns.filter((c) => c.doneAt && c.summary).sort((a, b) => (a.doneAt ?? "").localeCompare(b.doneAt ?? ""));
  return done.length ? done[done.length - 1].summary ?? null : null;
}

/* ------------------------------------------------------------------ */
/* Pieces                                                               */
/* ------------------------------------------------------------------ */

const H2 = "text-sm font-semibold uppercase tracking-wide text-slate-500";

function ForChallenge({ challenge, className }: { challenge: Challenge | null; className?: string }) {
  const navigate = useBizz((s) => s.navigate);
  if (!challenge) return null;
  return (
    <p className={cn("flex items-start gap-1.5 text-xs text-slate-500", className)}>
      <Flag className="mt-px size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0 break-words">
        For{" "}
        <button
          type="button"
          onClick={() => navigate(`challenges/${challenge.id}`)}
          className="text-left font-medium text-slate-700 underline-offset-2 hover:text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
        >
          {challenge.title}
        </button>
      </span>
    </p>
  );
}

function FinishedResult({ st }: { st: CoachStep }) {
  const r = st.result;
  if (!r) return <p className="mt-2 text-sm text-slate-600">Finished. No result was recorded.</p>;
  const counted = st.step.kind === "experiment" && (st.baseline || r.after);
  return (
    <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
      {VERDICTS.includes(r.verdict) ? <VerdictPill verdict={r.verdict} /> : null}
      {r.summary ? <p className="mt-1.5 text-sm text-slate-700">{r.summary}</p> : null}
      {counted ? (
        <p className="mt-1 text-xs text-slate-500">
          {st.baseline ? `Started at ${st.baseline}` : "No starting count"} · {r.after ? `ended at ${r.after}` : "no count at the end"}
        </p>
      ) : null}
    </div>
  );
}

function pausedLine(challenge: Challenge | null): string {
  if (challenge?.status === "up-next") return "Work on its challenge again and I’ll pick its check-ins back up where they stopped.";
  if (challenge && (challenge.status === "solved" || challenge.status === "stopped" || challenge.status === "no-longer")) return "Its challenge is closed, so it stays on hold.";
  return "Its check-ins are on hold.";
}

function StepRow({ st, challenge, details }: { st: CoachStep; challenge: Challenge | null; details: { route: string; label: string } | null }) {
  const navigate = useBizz((s) => s.navigate);
  const last = st.status === "done" ? null : lastCheckInSummary(st);
  const when =
    st.status === "paused"
      ? `Paused ${friendlyDate(st.pausedAt ?? st.acceptedAt)}, on day ${stepProgress(st).day} of ${st.step.days}`
      : st.status === "done"
        ? `Finished ${friendlyDate(st.result?.at ?? st.acceptedAt)}`
        : `Started ${friendlyDate(st.acceptedAt)}`;

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <StepStatusPill status={st.status} />
        <StepKindPill step={st.step} />
        <span className="text-xs text-slate-500">{when}</span>
      </div>
      <h3 className="mt-2 break-words text-base font-semibold leading-snug text-slate-900">{st.step.title}</h3>
      <ForChallenge challenge={challenge} className="mt-1" />

      {st.status === "done" ? <FinishedResult st={st} /> : null}
      {st.status === "paused" ? <p className="mt-2 text-sm text-slate-600">{pausedLine(challenge)}</p> : null}
      {st.status === "stopped" ? <p className="mt-2 text-sm text-slate-600">Stopped before the end: set aside, or replaced by a newer step.</p> : null}
      {last ? (
        <p className="mt-2 text-sm text-slate-600">
          <span className="font-medium text-slate-700">Last check-in:</span> {last}
        </p>
      ) : null}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        {st.status === "paused" && challenge && challenge.status === "up-next" ? (
          <WorkOnThisButton challenge={challenge} label="Work on this again" size="sm" variant="outline" />
        ) : null}
        {st.status === "active" ? (
          <Button variant="outline" size="sm" onClick={() => navigate(`check-in/${st.id}`)}>
            <ListChecks className="size-4" aria-hidden />
            Share how it’s going
          </Button>
        ) : null}
        {details ? (
          <Button variant="ghost" size="sm" className="text-slate-600" onClick={() => navigate(details.route)}>
            {details.label}
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function StepGroup({ id, title, hint, steps, row }: { id: string; title: string; hint: string; steps: CoachStep[]; row: (st: CoachStep) => ReactNode }) {
  if (!steps.length) return null;
  return (
    <section aria-labelledby={id} className="mt-8">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h2 id={id} className={H2}>
          {title} <span className="tnum text-slate-400">({steps.length})</span>
        </h2>
        <p className="text-xs text-slate-500">{hint}</p>
      </div>
      <ul className="mt-3 space-y-3">{steps.map(row)}</ul>
    </section>
  );
}

interface ReadyStep {
  /** The step Home offers to start (not started yet), or null when there's none to offer. */
  next: NextStep | null;
  /** The card's label, as on Home. */
  heading: string;
  focus: Challenge | null;
  facts: BusinessFacts | null;
  noFocus: boolean;
  nextUp: Challenge | null;
}

/** With nothing running: the same not-started step Home offers (the diagnosis's own, or the ready-made one for its stage). */
function useReadyStep(): ReadyStep {
  const facts = useBizz((s) => s.checkup.facts);
  const diagnosis = useBizz((s) => s.checkup.diagnosis);
  const steps = useBizz((s) => s.coach.steps);
  const businessId = useBizz((s) => s.businessId);
  const latest = useLatestCoachStep();
  const challenges = useOwnChallenges();
  const focus = useFocusChallenge();
  return useMemo(() => {
    // Nothing in focus (the last challenge was solved or stopped): the next one waits for the owner's go.
    const noFocus = challenges.length > 0 && !focus;
    const nextUp = noFocus ? challenges.filter((c) => c.status === "up-next").sort((a, b) => a.order - b.order)[0] ?? null : null;
    const tried = steps.filter((x) => x.workspaceId === businessId).map((x) => x.step.title);
    const next = diagnosis && !noFocus ? diagnosis.nextStep ?? templateNextStep(diagnosis.focusStage ?? "convert", facts, tried) : null;
    return { next, heading: latest?.status === "done" ? "Your next step" : "Your first step", focus, facts, noFocus, nextUp };
  }, [facts, diagnosis, steps, businessId, latest, challenges, focus]);
}

/** Nothing running and no step to offer yet: say what comes first. */
function NothingRunning({ ready, hasPaused }: { ready: ReadyStep; hasPaused: boolean }) {
  const navigate = useBizz((s) => s.navigate);

  let title: string;
  let body: string;
  let go: { label: string; route: string };
  if (!ready.facts) {
    title = "Your actions start with your checkup";
    body = "Tell me about your business and I’ll suggest one step to try first. It shows here, with its check-ins.";
    go = { label: "Start my checkup", route: "checkup-intro" };
  } else if (ready.noFocus) {
    title = "Nothing running right now";
    body = ready.nextUp
      ? `You’re not working on a challenge at the moment. Next up is “${shorten(ready.nextUp.title, 90)}”.`
      : "You’re not working on a challenge at the moment.";
    go = { label: "See my challenges", route: "challenges" };
  } else {
    title = "Nothing running yet";
    body = "Your diagnosis isn’t ready yet. Open it to see what to try first.";
    go = { label: "Open my diagnosis", route: "diagnosis" };
  }

  return (
    <div className="rounded-3xl border border-dashed border-brand-200 bg-brand-50/30 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-brand-600 shadow-sm ring-1 ring-brand-100">
          <Sparkles className="size-4.5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm text-slate-600">
            {body}
            {hasPaused ? " You can also pick a paused step up again below." : ""}
          </p>
        </div>
      </div>

      <Button className="mt-4 w-full bg-brand-600 hover:bg-brand-700 sm:w-auto" onClick={() => navigate(go.route)}>
        {go.label}
        <ArrowRight className="size-4" aria-hidden />
      </Button>
    </div>
  );
}

/** Experiments and actions set up by hand (or whose step is gone), so nothing drops out of view. */
function TrackedByHand({ actions, experiments }: { actions: ActionRecord[]; experiments: ExperimentRecord[] }) {
  const navigate = useBizz((s) => s.navigate);
  const rows = [
    ...experiments.map((e) => ({ id: e.id, route: `experiments/${e.id}`, title: e.title, status: e.status, icon: <FlaskConical className="size-4 shrink-0 text-brand-600" aria-hidden /> })),
    ...actions.map((a) => ({ id: a.id, route: `actions/${a.id}`, title: a.title, status: a.status, icon: <ListChecks className="size-4 shrink-0 text-brand-600" aria-hidden /> })),
  ];
  return (
    <section aria-labelledby="actions-by-hand" className="mt-8">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <h2 id="actions-by-hand" className={H2}>
          Also tracked <span className="tnum text-slate-400">({rows.length})</span>
        </h2>
        <p className="text-xs text-slate-500">Set up by hand rather than from your diagnosis.</p>
      </div>
      <ul className="mt-3 divide-y rounded-2xl border border-slate-200 bg-white shadow-sm">
        {rows.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => navigate(r.route)}
              className="flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex min-w-0 items-center gap-2">
                {r.icon}
                <span className="min-w-0 break-words text-sm font-medium">{r.title}</span>
              </span>
              <StatusBadge status={r.status} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* The page                                                             */
/* ------------------------------------------------------------------ */

export function YourActions() {
  const navigate = useBizz((s) => s.navigate);
  const hydrated = useBizz((s) => s.hydrated);
  const businessId = useBizz((s) => s.businessId);
  const allActions = useBizz((s) => s.actions);
  const allExperiments = useBizz((s) => s.experiments);
  const allSteps = useBizz((s) => s.coach.steps);
  const challenges = useOwnChallenges();
  const { active, alsoActive, paused, finished, stopped } = useWorkspaceSteps();
  const ready = useReadyStep();

  const actions = useMemo(() => allActions.filter((a) => a.businessId === businessId), [allActions, businessId]);
  const experiments = useMemo(() => allExperiments.filter((e) => e.businessId === businessId), [allExperiments, businessId]);
  // Records that no step points to (set up by hand, or their step is gone) still show.
  const loose = useMemo(() => {
    const stepIds = new Set(allSteps.map((x) => x.id));
    const actionIds = new Set(allSteps.map((x) => x.actionId));
    const experimentIds = new Set(allSteps.flatMap((x) => (x.experimentId ? [x.experimentId] : [])));
    return {
      actions: actions.filter((a) => !actionIds.has(a.id) && !(a.coachStepId && stepIds.has(a.coachStepId))),
      experiments: experiments.filter((e) => !experimentIds.has(e.id) && !(e.coachStepId && stepIds.has(e.coachStepId))),
    };
  }, [allSteps, actions, experiments]);

  if (!hydrated) {
    return (
      <div role="status" className="py-16 text-center text-sm text-muted-foreground">
        Loading your actions…
      </div>
    );
  }

  const row = (st: CoachStep) => <StepRow key={st.id} st={st} challenge={challengeFor(st, challenges)} details={detailsFor(st, actions, experiments)} />;

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        title="Actions"
        description="Every step you’ve started, and where each one is: running, paused, finished or stopped."
        actions={
          <Button variant="outline" onClick={() => navigate("timeline")}>
            <CalendarClock className="mr-2 size-4" aria-hidden />
            Business timeline
          </Button>
        }
      />

      <section aria-labelledby="actions-running">
        <h2 id="actions-running" className={H2}>
          {!active && ready.next ? "Ready to start" : "Running now"}
        </h2>
        <div className="mt-3 space-y-2">
          {active ? (
            <>
              <ForChallenge challenge={challengeFor(active, challenges)} className="px-1" />
              <ActiveStepCard coachStep={active} />
            </>
          ) : ready.next ? (
            <>
              <p className="px-1 text-sm text-slate-600">
                Nothing is running yet. Once you start this step, it shows here with its day count and check-ins.
                {paused.length ? " Or pick a paused step up again below." : ""}
              </p>
              <ForChallenge challenge={ready.focus} className="px-1" />
              {/* The same card Home shows, so starting it here or there is one and the same. */}
              <NextStepCard key={`ready-${ready.next.title}`} step={ready.next} facts={ready.facts} heading={ready.heading} challengeId={ready.focus?.id} />
            </>
          ) : (
            <NothingRunning ready={ready} hasPaused={paused.length > 0} />
          )}
        </div>
        {alsoActive.length ? <ul className="mt-3 space-y-3">{alsoActive.map(row)}</ul> : null}
      </section>

      <StepGroup id="actions-paused" title="Paused" hint="They wait while you work on another challenge." steps={paused} row={row} />
      <StepGroup id="actions-finished" title="Finished" hint="What each one showed." steps={finished} row={row} />
      <StepGroup id="actions-stopped" title="Stopped" hint="Set aside before the end, or replaced by a newer step." steps={stopped} row={row} />
      {loose.actions.length || loose.experiments.length ? <TrackedByHand actions={loose.actions} experiments={loose.experiments} /> : null}
    </div>
  );
}
