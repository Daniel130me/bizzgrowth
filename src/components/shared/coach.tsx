"use client";
// Coaching cards shared by the diagnosis page and Home:
//  • NextStepCard — the ONE thing to do next, marked "Not started yet" until the
//    owner starts it (Start sits right under the why). An experiment asks for a
//    starting number before it starts ("so I can tell whether it worked"); a
//    recommendation starts in one tap. When sending a message IS the step, the
//    draft button is the main button.
//  • ActiveStepCard — what they're trying, how far along, and the check-in.
//  • CheckInFrequency — how often check-ins happen (the owner decides).
//  • MissingAnswers — the answers that would sharpen the read, each with what
//    not knowing it costs, answerable in one tap.

import { useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  Check,
  CheckCircle2,
  CircleDashed,
  CirclePlay,
  Clock,
  FlaskConical,
  ListChecks,
  PenLine,
  Settings2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DraftButton } from "@/components/shared/try-this";
import { useBizz, type CoachStep } from "@/lib/store";
import {
  COUNT_CHOICES,
  FREQUENCY_OPTIONS,
  IN10_CHOICES,
  baselineQuestion,
  frequencyIdFor,
  friendlyDate,
  missingFacts,
  nextCheckIn,
  stepBadge,
  stepProgress,
  suggestedBaseline,
  type CheckInVerdict,
  type FactKey,
  type NextStep,
} from "@/lib/coach";
import type { BusinessFacts, DiagnosisContent } from "@/lib/checkup";
import { computeStake, currencySymbol } from "@/lib/checkup-math";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Small pieces                                                         */
/* ------------------------------------------------------------------ */

export function StepKindPill({ step, className }: { step: Pick<NextStep, "kind" | "days">; className?: string }) {
  const experiment = step.kind === "experiment";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
        experiment ? "border-brand-200 bg-brand-50 text-brand-700" : "border-emerald-200 bg-emerald-50 text-emerald-700",
        className,
      )}
    >
      {experiment ? <FlaskConical className="size-3" aria-hidden /> : <BadgeCheck className="size-3" aria-hidden />}
      {stepBadge(step)}
    </span>
  );
}

function ChoiceChip({ label, selected, onClick, tone = "brand" }: { label: string; selected?: boolean; onClick: () => void; tone?: "brand" | "slate" }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600",
        selected
          ? "border-brand-600 bg-brand-600 text-white"
          : tone === "brand"
            ? "border-brand-200 bg-white text-brand-800 hover:border-brand-400 hover:bg-brand-50"
            : "border-slate-200 bg-white text-slate-700 hover:border-slate-400",
      )}
    >
      {selected ? <Check className="size-3.5" aria-hidden /> : null}
      {label}
    </button>
  );
}

function checkInPlan(step: NextStep, midpoint: boolean): string {
  if (step.days < 6 || !midpoint) return `I'll check in when it's done (in ${step.days} days) — about 30 seconds.`;
  return `I'll check in halfway and at the end — about 30 seconds each.`;
}

/* ------------------------------------------------------------------ */
/* The next step                                                        */
/* ------------------------------------------------------------------ */

export function NextStepCard({
  step,
  facts,
  heading = "Your next step",
  onAccepted,
  className,
  challengeId,
}: {
  step: NextStep;
  facts: BusinessFacts | null;
  heading?: string;
  onAccepted?: (id: string) => void;
  className?: string;
  /** The challenge this step is for — starting it makes that challenge the focus. */
  challengeId?: string;
}) {
  const accept = useBizz((s) => s.acceptNextStep);
  const prefs = useBizz((s) => s.coach.prefs);
  const navigate = useBizz((s) => s.navigate);
  const [askingBaseline, setAskingBaseline] = useState(false);
  const suggested = suggestedBaseline(step, facts);
  const [baseline, setBaseline] = useState<string | null>(suggested?.value ?? null);
  const experiment = step.kind === "experiment";
  const choices = step.unit === "count" ? COUNT_CHOICES : IN10_CHOICES;

  function start(asRecommendation = false) {
    const id = accept(step, { baseline: asRecommendation ? undefined : baseline ?? undefined, asRecommendation, challengeId });
    onAccepted?.(id);
  }

  const startLabel = experiment ? "Start the experiment" : step.draftIsMain && step.draft ? "I'm doing this — check in with me" : "Start this step";
  const startButton = (
    <Button
      onClick={() => (experiment ? setAskingBaseline(true) : start())}
      variant={step.draftIsMain && step.draft ? "outline" : "default"}
      className={cn(step.draftIsMain && step.draft ? "border-brand-200 bg-white text-brand-800 hover:bg-brand-50" : "bg-brand-600 hover:bg-brand-700")}
    >
      {startLabel}
      <ArrowRight className="size-4" aria-hidden />
    </Button>
  );

  return (
    <section aria-label={`${heading} (not started yet)`} className={cn("rounded-3xl border border-brand-200 bg-white p-5 shadow-sm sm:p-6", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-700">
          <Sparkles className="size-3.5" aria-hidden />
          {heading}
        </span>
        <StepKindPill step={step} />
        {/* Until it's started nothing is running — so it never reads as an experiment already under way. */}
        <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-slate-300 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">
          <CircleDashed className="size-3" aria-hidden />
          Not started yet
        </span>
      </div>
      <h2 className="mt-2 text-lg font-semibold leading-snug text-slate-900 sm:text-xl">{step.title}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{step.why}</p>
      {experiment ? (
        <p className="mt-1 text-xs text-slate-500">An experiment is a small test — it shows whether I read the cause right before you change anything big.</p>
      ) : null}
      <p className="mt-3 flex items-start gap-1.5 text-sm font-medium text-slate-700">
        <CirclePlay className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
        <span>
          {experiment
            ? `The ${step.days} days begin when you tap “${startLabel}”.`
            : `It begins when you tap “${startLabel}”.`}
        </span>
      </p>

      {/* Starting comes right after the why, so it's reachable without scrolling past the how-to. */}
      {askingBaseline ? (
        <div className="mt-4 rounded-2xl border border-brand-200 bg-brand-50/60 p-4 animate-in fade-in-0 slide-in-from-top-1">
          <p className="text-sm font-semibold text-slate-900">Before you start — one number</p>
          <p className="mt-1 text-sm text-slate-700">{baselineQuestion(step)}</p>
          <p className="mt-1 text-xs text-slate-500">So I can tell whether it worked. A rough guess is fine.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {suggested ? <ChoiceChip label={suggested.label} selected={baseline === suggested.value} onClick={() => setBaseline(suggested.value)} /> : null}
            {choices
              .filter((c) => c.value !== suggested?.value)
              .map((c) => (
                <ChoiceChip key={c.value} label={c.label} selected={baseline === c.value} onClick={() => setBaseline(c.value)} />
              ))}
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button disabled={!baseline} onClick={() => start()} className="bg-brand-600 hover:bg-brand-700">
              Start the experiment
              <ArrowRight className="size-4" aria-hidden />
            </Button>
            <button type="button" onClick={() => start(true)} className="text-left text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline sm:ml-2">
              Not sure? Start without measuring
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start">
          {step.draft && step.draftIsMain ? <DraftButton hint={step.draft} main size="default" /> : null}
          {startButton}
          {step.draft && !step.draftIsMain ? <DraftButton hint={step.draft} size="default" /> : null}
        </div>
      )}

      <p className="mt-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-slate-500">
        <CalendarClock className="size-3.5" aria-hidden />
        {checkInPlan(step, prefs.midpoint)}
        <button type="button" onClick={() => navigate("notification-prefs")} className="font-medium text-brand-700 hover:underline">
          Change how often
        </button>
      </p>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">How to do it</p>
        <ol className="mt-2 space-y-1.5">
          {step.how.map((h, i) => (
            <li key={h} className="flex gap-2.5 text-sm leading-snug text-slate-800">
              <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-semibold text-brand-700 tnum">
                {i + 1}
              </span>
              <span>{h}</span>
            </li>
          ))}
        </ol>
      </div>

      {step.measure ? (
        <div className="mt-4 flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <PenLine className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden />
          <div className="text-sm">
            <p className="font-medium text-slate-800">What you’ll count once it starts: {step.measure.replace(/\.$/, "")}</p>
            {step.countHow ? <p className="mt-0.5 text-slate-600">{step.countHow}</p> : null}
          </div>
        </div>
      ) : null}

    </section>
  );
}

/* ------------------------------------------------------------------ */
/* What they're trying now                                              */
/* ------------------------------------------------------------------ */

const VERDICT_WORD: Record<CheckInVerdict, { label: string; cls: string }> = {
  working: { label: "It's working", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  "no-change": { label: "No real change — useful to know", cls: "border-slate-200 bg-slate-50 text-slate-700" },
  worse: { label: "Fewer went ahead", cls: "border-amber-200 bg-amber-50 text-amber-800" },
  "not-tried": { label: "Didn't fit this time", cls: "border-slate-200 bg-slate-50 text-slate-700" },
  "too-early": { label: "Too early to tell", cls: "border-slate-200 bg-slate-50 text-slate-700" },
  unclear: { label: "Not counted yet", cls: "border-slate-200 bg-slate-50 text-slate-700" },
};

export function VerdictPill({ verdict }: { verdict: CheckInVerdict }) {
  const v = VERDICT_WORD[verdict];
  return <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", v.cls)}>{v.label}</span>;
}

export function ActiveStepCard({ coachStep, className }: { coachStep: CoachStep; className?: string }) {
  const navigate = useBizz((s) => s.navigate);
  const { step } = coachStep;
  // Days it actually ran: a pause moves its check-ins (and its end) on, so it doesn't eat into the count.
  const { day } = stepProgress(coachStep);
  const next = nextCheckIn(coachStep.checkIns);
  const due = Boolean(next?.due);
  const details = coachStep.experimentId ? `experiments/${coachStep.experimentId}` : `actions/${coachStep.actionId}`;

  return (
    <section
      aria-label="What you're trying now"
      className={cn(
        "rounded-3xl border p-5 shadow-sm sm:p-6",
        due ? "border-amber-300 bg-gradient-to-br from-amber-50 via-white to-white ring-1 ring-amber-100" : "border-brand-200 bg-white",
        className,
      )}
    >
      {due ? (
        <div className="mb-4 flex flex-col gap-3 rounded-2xl bg-amber-100/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white">
              <Clock className="size-4.5" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-amber-950">Time for a quick check-in</p>
              <p className="text-xs text-amber-900/80">About 30 seconds — a few taps. It tells me what’s working outside the app.</p>
            </div>
          </div>
          <Button onClick={() => navigate(`check-in/${coachStep.id}`)} className="bg-amber-600 text-white hover:bg-amber-700">
            Check in now
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">You’re trying</span>
        <StepKindPill step={step} />
      </div>
      <h2 className="mt-2 text-lg font-semibold leading-snug text-slate-900">{step.title}</h2>

      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="tnum">
            Day {day} of {step.days}
          </span>
          {next && !due ? <span>Next check-in: {friendlyDate(next.checkIn.dueAt)}</span> : null}
        </div>
        <Progress value={(day / step.days) * 100} className="mt-1.5 h-1.5" aria-label={`Day ${day} of ${step.days}`} />
      </div>

      {step.measure ? (
        <p className="mt-3 flex gap-2 text-sm text-slate-700">
          <PenLine className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
          <span>
            Keep counting: {step.measure.replace(/\.$/, "").replace(/^./, (c) => c.toLowerCase())}
            {coachStep.baseline ? <span className="text-slate-500"> · starting point {coachStep.baseline}</span> : null}
          </span>
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start">
        {step.draft ? <DraftButton hint={step.draft} main={step.draftIsMain && !due} /> : null}
        {!due ? (
          <Button variant="outline" size="sm" onClick={() => navigate(`check-in/${coachStep.id}`)}>
            <ListChecks className="size-4" aria-hidden />
            Share how it’s going
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" className="text-slate-600" onClick={() => navigate(details)}>
          See the details
        </Button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* How often                                                            */
/* ------------------------------------------------------------------ */

export function CheckInFrequency() {
  const prefs = useBizz((s) => s.coach.prefs);
  const setPrefs = useBizz((s) => s.setCoachPrefs);
  const current = frequencyIdFor(prefs);
  return (
    <div role="radiogroup" aria-label="How often to check in" className="grid gap-2">
      {FREQUENCY_OPTIONS.map((o) => {
        const on = o.id === current;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => !on && setPrefs(o.prefs)}
            className={cn(
              "flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600",
              on ? "border-brand-500 bg-brand-50" : "border-slate-200 bg-white hover:border-brand-300",
            )}
          >
            <span className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2", on ? "border-brand-600" : "border-slate-300")}>
              {on ? <span className="size-2 rounded-full bg-brand-600" /> : null}
            </span>
            <span>
              <span className="block text-sm font-medium text-slate-900">{o.label}</span>
              <span className="block text-xs text-slate-500">{o.hint}</span>
            </span>
          </button>
        );
      })}
      <p className="flex items-center gap-1.5 text-xs text-slate-500">
        <Settings2 className="size-3.5" aria-hidden />
        Check-ins show up on Home and in your notifications. Email and WhatsApp reminders are coming later.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The answers that would sharpen the read                              */
/* ------------------------------------------------------------------ */

export function MissingAnswers({
  facts,
  diagnosis,
  currency,
  onUpdate,
  updating,
  exclude,
}: {
  facts: BusinessFacts;
  diagnosis: DiagnosisContent | null;
  currency?: string;
  /** Rewrite the diagnosis with the new answers. */
  onUpdate?: () => void;
  updating?: boolean;
  exclude?: FactKey[];
}) {
  const patchCheckupFacts = useBizz((s) => s.patchCheckupFacts);
  const [answered, setAnswered] = useState<Partial<Record<FactKey, string>>>({});
  // Questions are fixed for this visit, so an answered one stays visible with a tick.
  const [questions] = useState(() => missingFacts(facts, { limit: 3, exclude }));
  if (questions.length === 0) return null;
  const count = Object.keys(answered).length;

  function answer(key: FactKey, label: string, value: string) {
    setAnswered((a) => ({ ...a, [key]: label }));
    const next = { ...facts, [key]: value };
    const stake = diagnosis && (key === "closeRate" || key === "monthlyEnquiries") ? computeStake(next, currencySymbol(currency), diagnosis.focusStage ?? "convert") : undefined;
    patchCheckupFacts({ [key]: value } as Partial<BusinessFacts>, diagnosis ? { ...diagnosis, ...(stake !== undefined ? { stake } : {}) } : undefined);
  }

  return (
    <section aria-label="Answers that would sharpen this" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
        <ListChecks className="size-5 text-brand-600" aria-hidden />
        {questions.length === 1 ? "One quick answer would sharpen this" : `${questions.length} quick answers would sharpen this`}
      </h2>
      <p className="mt-1 text-sm text-slate-600">This read is a little weaker without them. One tap each — skip any you don’t know.</p>
      <div className="mt-4 space-y-4">
        {questions.map((q) => {
          const done = answered[q.key];
          return (
            <div key={q.key} className={cn("rounded-2xl border px-4 py-3.5", done ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200")}>
              <p className="text-sm font-medium text-slate-900">{q.question}</p>
              {!done ? <p className="mt-0.5 text-xs text-slate-500">Why it matters: {q.cost}</p> : null}
              {done ? (
                <p className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                  <CheckCircle2 className="size-4" aria-hidden /> {done}
                </p>
              ) : (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {q.choices.map((c) => (
                    <ChoiceChip key={c.label} label={c.label} onClick={() => answer(q.key, c.label, c.value)} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {count > 0 && onUpdate ? (
        <div className="mt-4 flex flex-col gap-2 rounded-2xl bg-brand-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-brand-900">Saved. Want your diagnosis rewritten with {count === 1 ? "this answer" : "these answers"}?</p>
          <Button onClick={onUpdate} disabled={updating} className="bg-brand-600 hover:bg-brand-700">
            {updating ? "Updating…" : "Update my diagnosis"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
