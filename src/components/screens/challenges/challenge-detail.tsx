"use client";
// One challenge, its whole story: reported (in the owner's words) → what they
// told us about it → diagnosed → steps tried → what each check-in showed →
// the outcome. Wins sit next to anything else that changed at the same time
// (honest credit), and lessons count as milestones.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  Check,
  CheckCircle2,
  CircleDot,
  Eye,
  Flag,
  FlaskConical,
  Lightbulb,
  Link2,
  Loader2,
  MessageSquareText,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState } from "@/components/shared/states";
import { ActiveStepCard, NextStepCard, StepKindPill, VerdictPill } from "@/components/shared/coach";
import { DraftButton } from "@/components/shared/try-this";
import { ChallengeNumbers, ChallengeStatusPill, SolvedSuggestion, StagePill, StuckNotice, WorkOnThisButton } from "@/components/shared/challenges";
import { challengeDiagnosis, useBizz, useChallenge, useFocusChallenge, type CoachStep } from "@/lib/store";
import { SOURCE_LABEL, otherChangesFor, outsideNote, sameTitle, templateOutsideStep, type Challenge } from "@/lib/challenges";
import { templateNextStep, type CheckInVerdict, type DraftKind } from "@/lib/coach";
import type { DiagnosisTool } from "@/lib/checkup";
import { requestChallengeDiagnosis } from "@/lib/challenge-client";
import { shorten, tidyOwnerText } from "@/lib/checkup-math";
import { cn } from "@/lib/utils";
import type { ScreenProps } from "../view-types";

const TOOL_DRAFT: Record<DiagnosisTool["kind"], DraftKind> = { message: "whatsapp", script: "call-script", offer: "price-list" };

function day(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

interface StoryItem {
  at: string;
  /** Shown instead of the date when the real date isn't known. */
  dateLabel?: string;
  icon: React.ElementType;
  tone: "brand" | "emerald" | "amber" | "slate";
  title: string;
  body?: React.ReactNode;
}

function Story({ items }: { items: StoryItem[] }) {
  const tone = {
    brand: "bg-brand-100 text-brand-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-800",
    slate: "bg-slate-100 text-slate-600",
  };
  return (
    <ol className="relative space-y-5 border-l border-slate-200 pl-6">
      {items.map((it, i) => {
        const Icon = it.icon;
        return (
          <li key={`${it.at}-${i}`} className="relative">
            <span className={cn("absolute -left-[37px] top-0 flex size-6 items-center justify-center rounded-full ring-4 ring-white", tone[it.tone])}>
              <Icon className="size-3.5" aria-hidden />
            </span>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{it.dateLabel ?? day(it.at)}</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">{it.title}</p>
            {it.body ? <div className="mt-1 text-sm leading-relaxed text-slate-700">{it.body}</div> : null}
          </li>
        );
      })}
    </ol>
  );
}

export function ChallengeDetailScreen({ params }: ScreenProps) {
  const challenge = useChallenge(params.id);
  const navigate = useBizz((s) => s.navigate);
  const hydrated = useBizz((s) => s.hydrated);
  const checkup = useBizz((s) => s.checkup);
  const steps = useBizz((s) => s.coach.steps);
  const experiments = useBizz((s) => s.experiments);
  const challenges = useBizz((s) => s.challenges);
  const focus = useFocusChallenge();
  const setStatus = useBizz((s) => s.setChallengeStatus);
  const markSolved = useBizz((s) => s.markChallengeSolved);

  const [retrying, setRetrying] = useState(false);
  const [diagFailed, setDiagFailed] = useState(false);
  const [closing, setClosing] = useState<null | "solved" | "stopped">(null);
  const [note, setNote] = useState("");
  const asked = useRef(false);

  const diagnosis = challenge ? challengeDiagnosis(challenge, checkup) : null;
  const linkedSteps = useMemo(
    () => (challenge ? steps.filter((s) => challenge.stepIds.includes(s.id) || s.challengeId === challenge.id).sort((a, b) => a.acceptedAt.localeCompare(b.acceptedAt)) : []),
    [challenge, steps],
  );
  const activeStep = linkedSteps.find((s) => s.status === "active") ?? null;
  const pausedStep = linkedSteps.find((s) => s.status === "paused") ?? null;
  const otherChanges = useMemo(() => (challenge ? otherChangesFor(challenge.stepIds, steps, experiments) : []), [challenge, steps, experiments]);

  // A challenge whose short chat is done but has no diagnosis yet gets one now.
  useEffect(() => {
    if (!challenge || diagnosis || !challenge.chatDone || asked.current || !checkup.facts) return;
    asked.current = true;
    void requestChallengeDiagnosis(challenge.id).then((d) => {
      if (!d) setDiagFailed(true);
    });
  }, [challenge, diagnosis, checkup.facts]);
  // Being written: asked for automatically (its chat is done, no diagnosis yet) or retried.
  const diagnosing = retrying || (Boolean(challenge?.chatDone) && !diagnosis && !diagFailed && Boolean(checkup.facts));

  if (!hydrated) return <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>;
  if (!challenge) return <ErrorState title="Challenge not found" description="It may belong to another workspace." onHome={() => navigate("challenges")} />;

  const c: Challenge = challenge;
  const working = c.status === "working";
  const closed = c.status === "solved" || c.status === "stopped" || c.status === "no-longer";
  const linked = challenges.filter((x) => c.linkedTo.includes(x.id));
  const story = buildStory(c, linkedSteps, diagnosis?.headline);
  // Diagnoses written before next steps existed get the ready-made one, as on Home.
  const tried = steps.filter((s) => s.workspaceId === "user-workspace").map((s) => s.step.title);
  const nextStep = diagnosis
    ? diagnosis.nextStep ?? (c.stage === "outside" ? templateOutsideStep(c.title) : templateNextStep(diagnosis.focusStage ?? "convert", checkup.facts, tried))
    : null;

  async function retry() {
    setDiagFailed(false);
    setRetrying(true);
    const d = await requestChallengeDiagnosis(c.id);
    setRetrying(false);
    if (!d) setDiagFailed(true);
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 pb-6">
      <button type="button" onClick={() => navigate("challenges")} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" aria-hidden /> Challenges
      </button>

      {/* The challenge, in the owner's words */}
      <header className="rounded-3xl border border-brand-200 bg-gradient-to-br from-brand-50 via-white to-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-center gap-1.5">
          <ChallengeStatusPill status={c.status} />
          <StagePill stage={c.stage} />
          <span className="text-[11px] text-slate-500">
            {SOURCE_LABEL[c.source]}
            {c.reportedAtUnknown ? "" : ` · ${day(c.reportedAt)}`}
          </span>
        </div>
        <h1 className="mt-3 text-2xl font-bold leading-tight tracking-tight text-slate-900 sm:text-3xl">“{c.title}”</h1>
        {working && c.whyFirst ? (
          <p className="mt-3 flex gap-2 text-sm text-slate-700">
            <Flag className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
            <span>
              <span className="font-semibold">Why this one first: </span>
              {c.whyFirst}
            </span>
          </p>
        ) : null}
        {c.status === "up-next" && c.orderReason ? <p className="mt-3 text-sm text-slate-600">{c.orderReason}</p> : null}
        {linked.length ? (
          <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            <Link2 className="size-3.5" aria-hidden /> Linked to:
            {linked.map((l) => (
              <button key={l.id} type="button" onClick={() => navigate(`challenges/${l.id}`)} className="font-medium text-brand-700 hover:underline">
                {shorten(l.title, 50)}
              </button>
            ))}
          </p>
        ) : null}

        {/* What the owner can do with it */}
        <div className="mt-5 flex flex-wrap gap-2">
          {c.status === "up-next" ? <WorkOnThisButton challenge={c} /> : null}
          {closed ? <WorkOnThisButton challenge={c} label="Work on this again" variant="outline" /> : null}
          {!c.chatDone && !closed ? (
            <Button variant={working ? "default" : "outline"} className={working ? "bg-brand-600 hover:bg-brand-700" : "bg-white"} onClick={() => navigate(`challenges/${c.id}/chat`)}>
              <MessageSquareText className="size-4" aria-hidden /> Tell me more — a few quick questions
            </Button>
          ) : null}
          {working ? (
            <>
              <Button variant="outline" className="bg-white" onClick={() => setClosing("solved")}>
                <CheckCircle2 className="size-4" aria-hidden /> It&apos;s solved
              </Button>
              <Button variant="ghost" className="text-slate-600" onClick={() => setStatus(c.id, "up-next")}>
                Not now — back to Up next
              </Button>
            </>
          ) : null}
          {!closed ? (
            <>
              <Button variant="ghost" className="text-slate-600" onClick={() => setClosing("stopped")}>
                Stop working on this
              </Button>
              <Button variant="ghost" className="text-slate-600" onClick={() => setStatus(c.id, "no-longer")}>
                No longer a problem
              </Button>
            </>
          ) : null}
        </div>

        {closing ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            <label htmlFor="close-note" className="block text-sm font-medium text-slate-900">
              {closing === "solved" ? "What made the difference?" : "What did you learn from it?"}{" "}
              <span className="font-normal text-slate-500">(optional, in your own words)</span>
            </label>
            {closing === "stopped" ? <p className="mt-0.5 text-xs text-slate-500">Even “it isn&apos;t the price” is worth keeping — it counts as a lesson.</p> : null}
            <Textarea id="close-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="mt-2" />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                className={closing === "solved" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-800 hover:bg-slate-900"}
                onClick={() => {
                  if (closing === "solved") markSolved(c.id, note);
                  else setStatus(c.id, "stopped", note);
                  setClosing(null);
                  setNote("");
                }}
              >
                <Check className="size-4" aria-hidden /> {closing === "solved" ? "Mark it solved" : "Stop working on it"}
              </Button>
              <Button variant="ghost" onClick={() => setClosing(null)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </header>

      {working ? <SolvedSuggestion challenge={c} /> : null}
      {working ? <StuckNotice challenge={c} steps={steps} /> : null}

      {c.stage === "outside" ? (
        <div className="flex gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-slate-500" aria-hidden />
          <p className="text-sm leading-relaxed text-slate-700">
            <span className="font-semibold text-slate-900">An honest note: </span>
            {outsideNote(c.title)}
          </p>
        </div>
      ) : null}

      {/* The outcome — before/after, what worked, how long, and what else changed */}
      {c.status === "solved" && c.outcome ? (
        <section aria-label="The outcome" className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-5 sm:p-6">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
            <Trophy className="size-4" aria-hidden /> Solved {c.solvedAt ? `· ${day(c.solvedAt)}` : ""}
          </p>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Before → after</dt>
              <dd className="mt-0.5 text-lg font-semibold text-slate-900 tnum">
                {c.outcome.before && c.outcome.after ? `${c.outcome.before} → ${c.outcome.after}` : c.outcome.before ? `${c.outcome.before} → not counted again` : "Not counted"}
              </dd>
              {c.outcome.measure ? <dd className="text-xs text-slate-500">{c.outcome.measure.replace(/\.$/, "")}</dd> : null}
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">How long it took</dt>
              <dd className="mt-0.5 text-lg font-semibold text-slate-900">{c.outcome.took ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">What was tried</dt>
              <dd className="mt-0.5 text-sm text-slate-800">{c.outcome.tried.length ? c.outcome.tried.join("; ") : "No tracked steps"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">What worked</dt>
              <dd className="mt-0.5 text-sm text-slate-800">{c.outcome.worked.length ? c.outcome.worked.join("; ") : c.outcome.note ?? "You marked it solved"}</dd>
            </div>
          </dl>
          {c.outcome.note && c.outcome.worked.length ? <p className="mt-3 text-sm text-slate-700">In your words: {c.outcome.note}</p> : null}
          <HonestCredit changes={c.outcome.otherChanges} />
        </section>
      ) : null}

      {/* Where it stands */}
      {!closed ? (
        <section aria-label="Where it stands" className="space-y-3">
          <Card className="p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Where it stands</p>
            <ChallengeNumbers challenge={c} className="mt-2" />
            {pausedStep && !activeStep ? (
              <p className="mt-2 text-sm text-slate-600">
                Paused: “{pausedStep.step.title}”. {working ? "" : "It picks up again when you work on this challenge."}
              </p>
            ) : null}
            {otherChanges.length ? <HonestCredit changes={otherChanges} /> : null}
          </Card>
          {working && activeStep ? <ActiveStepCard coachStep={activeStep} /> : null}
        </section>
      ) : null}

      {/* Its diagnosis and next step */}
      {!closed ? (
        diagnosis ? (
          <section aria-label="What's behind it" className="space-y-4">
            <Card className="border-brand-200 p-5 sm:p-6">
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-brand-700">
                <Sparkles className="size-4" aria-hidden /> What&apos;s behind it
              </p>
              <h2 className="mt-2 text-lg font-semibold leading-snug text-slate-900 sm:text-xl">{diagnosis.headline}</h2>
              {diagnosis.insight ? (
                <p className="mt-2 flex gap-2 text-sm leading-relaxed text-slate-700">
                  <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
                  <span>{diagnosis.insight}</span>
                </p>
              ) : null}
              {diagnosis.working ? (
                <p className="mt-2 flex gap-2 text-sm text-emerald-800">
                  <BadgeCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                  <span>
                    <span className="font-semibold">Already working: </span>
                    {diagnosis.working}
                  </span>
                </p>
              ) : null}
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{diagnosis.meaning}</p>
              {diagnosis.update ? (
                <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                  <span className="font-semibold">Latest from your check-in: </span>
                  {diagnosis.update.note}
                </p>
              ) : null}
              {/* The full diagnosis — why I think this, the week's list — on the diagnosis page. */}
              <Button variant="ghost" size="sm" className="mt-3 -ml-2 text-brand-700" onClick={() => navigate(working ? "diagnosis" : `diagnosis/summary/${encodeURIComponent(c.id)}`)}>
                <Eye className="size-3.5" aria-hidden /> Open the full diagnosis
              </Button>
            </Card>

            {nextStep && !activeStep ? (
              <div className="space-y-2">
                {!working && focus ? (
                  <p className="text-xs text-slate-500">
                    Starting this makes it your focus — “{shorten(focus.title, 60)}” goes back to Up next{steps.some((s) => s.challengeId === focus.id && s.status === "active") ? " and its step is paused" : ""}.
                  </p>
                ) : null}
                <NextStepCard step={nextStep} facts={checkup.facts} heading={working ? "Your next step" : "The first step for this one"} challengeId={c.id} />
              </div>
            ) : null}

            {(diagnosis.tools ?? []).length ? (
              <section aria-label="Help for today">
                <h3 className="text-sm font-semibold text-slate-900">Help you can use today</h3>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {(diagnosis.tools ?? []).map((t) => (
                    <div key={`${t.kind}-${t.title}`} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-sm font-semibold text-slate-900">{t.title}</p>
                      {t.when ? <p className="mt-0.5 text-xs text-slate-500">{t.when}</p> : null}
                      <div className="mt-2">
                        <DraftButton hint={{ kind: TOOL_DRAFT[t.kind], label: "Show the words", purpose: `${t.title}${t.when ? ` — ${t.when}` : ""}` }} initial={{ title: t.title, body: t.body }} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </section>
        ) : c.chatDone ? (
          <Card className="p-5">
            {diagnosing ? (
              <p className="flex items-center gap-2 text-sm text-brand-900" role="status">
                <Loader2 className="size-4 animate-spin" aria-hidden /> Working out what&apos;s behind it, and the first thing to try…
              </p>
            ) : diagFailed ? (
              <div className="text-sm text-amber-900">
                I couldn&apos;t write its diagnosis just now — your answers are safe.
                <Button size="sm" variant="outline" className="ml-2" onClick={retry}>
                  <RotateCcw className="size-3.5" aria-hidden /> Try again
                </Button>
              </div>
            ) : null}
          </Card>
        ) : (
          <Card className="p-5">
            <p className="text-sm font-semibold text-slate-900">A few quick questions first</p>
            <p className="mt-1 text-sm text-slate-600">
              What&apos;s happening, since when, and what you&apos;ve tried — then it gets its own diagnosis and first step. I already know the rest of your business.
            </p>
            <Button className="mt-3 bg-brand-600 hover:bg-brand-700" onClick={() => navigate(`challenges/${c.id}/chat`)}>
              Start — about a minute
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </Card>
        )
      ) : null}

      {/* The full story */}
      <section aria-label="The story so far">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">The story so far</h2>
        <Story items={story} />
      </section>
    </div>
  );
}

function HonestCredit({ changes }: { changes: string[] }) {
  if (!changes.length) return null;
  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">Also changed at the same time</p>
      <p className="mt-0.5 text-sm text-slate-700">{changes.join("; ")}</p>
      <p className="mt-0.5 text-xs text-slate-500">You told us about these in check-ins — they may explain part of the result.</p>
    </div>
  );
}

const VERDICT_TONE: Record<CheckInVerdict, StoryItem["tone"]> = {
  working: "emerald",
  "no-change": "slate",
  worse: "amber",
  "not-tried": "slate",
  "too-early": "slate",
  unclear: "slate",
};

/** Reported → what they told us → diagnosed → steps → check-ins → lessons → outcome. */
function buildStory(c: Challenge, steps: CoachStep[], headline?: string): StoryItem[] {
  const items: StoryItem[] = [];
  const d = c.details;
  const answers: [string, string | undefined][] = [
    ["Since", d?.since],
    ["How often", d?.often],
    ["Tried so far", d?.tried],
    ["What you think is behind it", d?.theory],
  ];
  items.push({
    at: c.reportedAt,
    icon: Flag,
    tone: "brand",
    dateLabel: c.reportedAtUnknown ? "Earlier" : undefined,
    title: `${SOURCE_LABEL[c.source]}`,
    body: (
      <>
        <p>“{d?.what && !sameTitle(d.what, c.title) ? tidyOwnerText(d.what) : c.title}”</p>
        {answers.some(([, v]) => v) || d?.extra?.length ? (
          <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
            {answers
              .filter((r): r is [string, string] => Boolean(r[1]))
              .map(([k, v]) => (
                <div key={k}>
                  <dt className="font-semibold text-slate-500">{k}</dt>
                  <dd className="text-slate-700">{v}</dd>
                </div>
              ))}
            {(d?.extra ?? []).map((e) => (
              <div key={e.key}>
                <dt className="font-semibold text-slate-500">{e.question}</dt>
                <dd className="text-slate-700">{e.answer}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </>
    ),
  });
  for (const a of c.angles) items.push({ at: a.at, icon: Link2, tone: "slate", title: "Also described as", body: <p>“{a.text}”</p> });
  if (headline)
    items.push({
      at: c.focusedAt ?? c.reportedAt,
      dateLabel: c.reportedAtUnknown && !steps.length ? "Earlier" : undefined,
      icon: Sparkles,
      tone: "brand",
      title: "Diagnosed",
      body: <p>{headline}</p>,
    });
  for (const st of steps) {
    items.push({
      at: st.acceptedAt,
      icon: st.step.kind === "experiment" ? FlaskConical : CircleDot,
      tone: "brand",
      title: `Started: ${st.step.title}`,
      body: (
        <div className="flex flex-wrap items-center gap-2">
          <StepKindPill step={st.step} />
          {st.baseline ? <span className="text-xs text-slate-500">Starting point: {st.baseline}</span> : null}
          {st.status === "paused" ? <span className="text-xs text-slate-500">Paused {st.pausedAt ? day(st.pausedAt) : ""}</span> : null}
          {st.status === "stopped" && !st.result ? <span className="text-xs text-slate-500">Set aside</span> : null}
        </div>
      ),
    });
    for (const ci of st.checkIns.filter((x) => x.doneAt)) {
      const changes = ci.answers?.find((a) => a.id === "changes")?.answer;
      items.push({
        at: ci.doneAt!,
        icon: CalendarClock,
        tone: ci.verdict ? VERDICT_TONE[ci.verdict] : "slate",
        title: ci.kind === "end" ? "End-of-step check-in" : ci.kind === "mid" ? "Halfway check-in" : "Weekly check-in",
        body: (
          <div className="space-y-1">
            {ci.verdict ? <VerdictPill verdict={ci.verdict} /> : null}
            {ci.summary ? <p>{ci.summary}</p> : null}
            {ci.after ? <p className="text-xs text-slate-500">Your count: {ci.after}</p> : null}
            {changes && !/^(nothing|no|none|nope)\b/i.test(changes.trim()) && !/nothing (else )?changed/i.test(changes) ? (
              <p className="text-xs text-amber-800">Also changed: {changes}</p>
            ) : null}
          </div>
        ),
      });
    }
  }
  for (const l of c.lessons.filter((x) => !x.stepId)) items.push({ at: l.at, icon: Lightbulb, tone: "amber", title: "Lesson", body: <p>{l.text}</p> });
  if (c.status === "solved" && c.solvedAt) items.push({ at: c.solvedAt, icon: CheckCircle2, tone: "emerald", title: "You marked it solved", body: c.outcome?.took ? <p>It took {c.outcome.took}.</p> : undefined });
  if ((c.status === "stopped" || c.status === "no-longer") && c.stoppedAt)
    items.push({ at: c.stoppedAt, icon: Check, tone: "slate", title: c.status === "stopped" ? "Stopped" : "No longer a problem" });
  if (c.status === "working" && !steps.length)
    items.push({ at: c.focusedAt ?? c.reportedAt, dateLabel: "Now", icon: ArrowRight, tone: "slate", title: "Working on it now", body: <p>The first step is above.</p> });
  return items.sort((a, b) => a.at.localeCompare(b.at));
}
