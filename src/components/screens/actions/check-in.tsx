"use client";
// Check-in — a 30-second conversation about the step the owner is trying.
// The app can't see what happens offline (WhatsApp chats, walk-ins, a price
// change, a slow week), so it asks: did you try it, what happened (a rough
// count), what else changed — plus one or two still-missing checkup answers,
// spread over time instead of all at once. Tap answers, or type.

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarClock, Loader2, RotateCcw, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/states";
import { NextStepCard, StepKindPill, VerdictPill } from "@/components/shared/coach";
import { NoticedChallengeCard, WorkOnThisButton } from "@/components/shared/challenges";
import { useBizz, useChallenge, useCoachStep } from "@/lib/store";
import { FOCUS_STAGES } from "@/lib/checkup";
import { challengesContext } from "@/lib/challenges";
import {
  acknowledge,
  daysSince,
  friendlyDate,
  nextCheckIn,
  nextCheckInQuestion,
  type CheckInAnswer,
  type CheckInQuestion,
  type CheckInResult,
} from "@/lib/coach";
import { cn } from "@/lib/utils";
import type { ScreenProps } from "../view-types";

interface Bubble {
  role: "ai" | "user";
  text: string;
  why?: string;
}

export function CheckInScreen({ params }: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);
  const user = useBizz((s) => s.user);
  const facts = useBizz((s) => s.checkup.facts);
  const diagnosis = useBizz((s) => s.checkup.diagnosis);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const coach = useBizz((s) => s.coach);
  const completeCheckIn = useBizz((s) => s.completeCheckIn);
  const hydrated = useBizz((s) => s.hydrated);
  const challenges = useBizz((s) => s.challenges);
  const coachStep = useCoachStep(params.id);
  // The challenge this step works on (its stage decides the fallback next step).
  const challenge = useChallenge(coachStep?.challengeId);

  // The check-in being answered is fixed once the step has loaded
  // (undefined = still loading, null = nothing left to check in on).
  const [target, setTarget] = useState<ReturnType<typeof nextCheckIn> | undefined>(undefined);
  useEffect(() => {
    if (target === undefined && coachStep) setTarget(nextCheckIn(coachStep.checkIns));
  }, [coachStep, target]);
  const kind = target?.checkIn.kind ?? "end";
  const lastDraft = coachStep?.draftUses.length ? coachStep.draftUses[coachStep.draftUses.length - 1] : null;

  const [answers, setAnswers] = useState<CheckInAnswer[]>([]);
  const [question, setQuestion] = useState<CheckInQuestion | null>(null);
  const [thread, setThread] = useState<Bubble[]>([]);
  const [phase, setPhase] = useState<"asking" | "reading" | "done" | "failed">("asking");
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  const day = coachStep ? Math.min(coachStep.step.days, daysSince(coachStep.acceptedAt) + 1) : 1;
  const firstName = user.name.split(" ")[0];

  // Opening line + first question.
  useEffect(() => {
    if (!coachStep || started.current || !target) return;
    started.current = true;
    const q = nextCheckInQuestion({ step: coachStep.step, kind, facts, lastDraft, answers: [] });
    const opener =
      kind === "end"
        ? `Hi ${firstName} — that's the ${coachStep.step.days} days done on “${coachStep.step.title}”. A few quick taps and I'll tell you what it showed.`
        : `Hi ${firstName} — quick check-in, day ${day} of ${coachStep.step.days}. Just a few taps.`;
    setThread([{ role: "ai", text: opener }, ...(q ? [{ role: "ai" as const, text: q.text, why: q.why }] : [])]);
    setQuestion(q);
  }, [coachStep, target]);

  useEffect(() => {
    // When the result arrives, bring it up with the closing reply still visible above it.
    if (phase === "done") resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    else endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [thread, phase]);

  const totalGuess = useMemo(() => (kind === "end" ? 5 : 4), [kind]);

  async function finish(all: CheckInAnswer[]) {
    if (!coachStep || !target) return;
    setPhase("reading");
    try {
      const res = await fetch("/api/coach/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceName: userWorkspace?.name ?? "Your business",
          country: userWorkspace?.country,
          currency: userWorkspace?.currency,
          facts: facts ? { ...facts, facts: [], chips: [] } : null,
          stage: challenge && FOCUS_STAGES.some((st) => st.id === challenge.stage) ? challenge.stage : diagnosis?.focusStage,
          challenge: challenge ? { id: challenge.id, title: challenge.title, stage: challenge.stage } : null,
          challenges: challengesContext(challenges.filter((c) => c.workspaceId === "user-workspace")),
          step: coachStep.step,
          baseline: coachStep.baseline,
          kind,
          day,
          answers: all,
          learnings: coach.learnings.map((l) => l.text).slice(-6),
          tried: coach.steps.filter((x) => x.workspaceId === coachStep.workspaceId).map((x) => x.step.title),
        }),
      });
      const data = (await res.json()) as { ok?: boolean; result?: CheckInResult };
      if (!data.ok || !data.result) throw new Error("no result");
      completeCheckIn({ stepId: coachStep.id, checkInId: target.checkIn.id, answers: all, result: data.result });
      setResult(data.result);
      setThread((t) => [...t, { role: "ai", text: data.result!.reply }]);
      setPhase("done");
    } catch {
      setPhase("failed");
    }
  }

  function answer(text: string, typed = false) {
    const a = text.trim();
    if (!a || !question || phase !== "asking" || !coachStep) return;
    setInput("");
    // Typed answers are the owner's own words — only those can reveal a new problem.
    const all = [...answers, { id: question.id, question: question.text, answer: a, ...(typed ? { typed: true } : {}) }];
    setAnswers(all);
    const ack = acknowledge(question.id, a);
    const next = nextCheckInQuestion({ step: coachStep.step, kind, facts, lastDraft, answers: all });
    setThread((t) => [...t, { role: "user", text: a }, ...(next ? [{ role: "ai" as const, text: `${ack} ${next.text}`, why: next.why }] : [{ role: "ai" as const, text: ack }])]);
    setQuestion(next);
    if (!next) void finish(all);
  }

  /* ---------- Missing / finished ---------- */
  if (!hydrated || (coachStep && target === undefined)) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Loading your check-in…</div>;
  }
  if (!coachStep) {
    return (
      <ErrorState
        title="Check-in not found"
        description="This step may belong to another workspace, or it was replaced by a newer one."
        onHome={() => navigate("home")}
      />
    );
  }
  if (coachStep.status === "paused" && phase === "asking") {
    return (
      <div className="mx-auto w-full max-w-2xl py-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Check-in</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">“{coachStep.step.title}” is paused</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {challenge ? `You switched to another challenge, so its check-ins are on hold. Work on “${challenge.title}” again to pick it up.` : "Its check-ins are on hold for now."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {challenge ? <WorkOnThisButton challenge={challenge} label="Work on this again" /> : null}
          <Button variant="outline" onClick={() => navigate("home")}>
            Back to Home
          </Button>
        </div>
      </div>
    );
  }
  if (!target) {
    return (
      <div className="mx-auto w-full max-w-2xl py-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Check-in</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">“{coachStep.step.title}” is finished</h1>
        {coachStep.result ? <p className="mt-3 text-sm text-muted-foreground">{coachStep.result.summary}</p> : null}
        <Button className="mt-6 bg-brand-600 hover:bg-brand-700" onClick={() => navigate("home")}>
          Back to Home
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
    );
  }

  const asked = answers.length;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <button type="button" onClick={() => navigate("home")} className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" aria-hidden /> Home
      </button>

      <div className="overflow-clip rounded-3xl border border-slate-200 bg-white shadow-sm">
        {/* Header */}
        <div className="border-b border-slate-100 bg-gradient-to-br from-brand-50 via-white to-white px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">
              {kind === "end" ? "End-of-step check-in" : kind === "mid" ? "Halfway check-in" : "Weekly check-in"}
            </span>
            <StepKindPill step={coachStep.step} />
          </div>
          <h1 className="mt-1.5 text-lg font-semibold leading-snug text-slate-900">{coachStep.step.title}</h1>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex gap-1" aria-hidden>
              {Array.from({ length: totalGuess }).map((_, i) => (
                <span key={i} className={cn("h-1.5 w-6 rounded-full", i < asked ? "bg-brand-600" : "bg-brand-100")} />
              ))}
            </div>
            <span className="text-xs text-slate-500">About 30 seconds · tap or type</span>
          </div>
        </div>

        {/* Thread */}
        <div className="space-y-3 px-4 py-5 sm:px-6" aria-live="polite">
          {thread.map((b, i) =>
            b.role === "ai" ? (
              <div key={i} className="flex gap-2.5">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
                  <Sparkles className="size-3.5" aria-hidden />
                </span>
                <div className="max-w-[85%]">
                  <p className="rounded-2xl rounded-tl-md bg-slate-100 px-4 py-2.5 text-[15px] leading-relaxed text-slate-800">{b.text}</p>
                  {b.why ? <p className="mt-1 px-1 text-xs text-slate-500">Why I’m asking: {b.why.replace(/^./, (c) => c.toLowerCase())}</p> : null}
                </div>
              </div>
            ) : (
              <div key={i} className="flex justify-end">
                <p className="max-w-[80%] rounded-2xl rounded-br-md bg-brand-600 px-4 py-2.5 text-[15px] leading-relaxed text-white">{b.text}</p>
              </div>
            ),
          )}
          {phase === "reading" ? (
            <div className="flex items-center gap-2.5 text-sm text-slate-500" role="status">
              <span className="flex size-7 items-center justify-center rounded-full bg-brand-600 text-white">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              </span>
              Reading your answers…
            </div>
          ) : null}
          {phase === "failed" ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Your answers are safe — I just couldn’t reach the reader.
              <Button size="sm" variant="outline" className="ml-2 bg-white" onClick={() => finish(answers)}>
                <RotateCcw className="size-3.5" aria-hidden /> Try again
              </Button>
            </div>
          ) : null}
        </div>

        {/* Composer */}
        {phase === "asking" && question ? (
          <div className="sticky bottom-0 border-t border-slate-100 bg-white/95 px-4 py-4 backdrop-blur sm:px-6">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tap an answer — or type your own</p>
            <div className="flex flex-wrap gap-2">
              {question.choices.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => answer(c)}
                  className="min-h-10 rounded-full border border-brand-200 bg-brand-50/60 px-4 py-2 text-sm font-medium text-brand-800 transition-colors hover:border-brand-400 hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                >
                  {c}
                </button>
              ))}
            </div>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                answer(input, true);
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={question.placeholder}
                aria-label="Your answer"
                className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 px-3.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
              />
              <Button type="submit" disabled={!input.trim()} className="h-11 bg-brand-600 px-4 hover:bg-brand-700" aria-label="Send">
                <Send className="size-4" aria-hidden />
              </Button>
            </form>
          </div>
        ) : null}
        {/* Scrolling to the card's bottom keeps the newest message just above the answer box. */}
        <div ref={endRef} aria-hidden />
      </div>

      {/* Result */}
      {phase === "done" && result ? (
        <div ref={resultRef} className="mt-5 scroll-mt-48 space-y-4 animate-in fade-in-0 slide-in-from-bottom-2">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">What this told us</span>
              <VerdictPill verdict={result.verdict} />
            </div>
            <p className="mt-2 text-[15px] leading-relaxed text-slate-800">{result.learned}</p>
            {result.tweak ? (
              <p className="mt-3 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-900">
                <span className="font-semibold">One small tweak: </span>
                {result.tweak}
              </p>
            ) : null}
            {result.otherChanges.length ? (
              <p className="mt-3 text-xs text-slate-500">Added to your business timeline: {result.otherChanges.join("; ")}</p>
            ) : null}
            {result.newChallenge ? (
              <NoticedChallengeCard
                noticed={result.newChallenge}
                source="check-in"
                ownerText={answers.find((x) => x.typed && (x.id === "changes" || x.id === "blocker"))?.answer ?? result.newChallenge.title}
                className="mt-4"
              />
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {result.keepGoing ? (
                <Button onClick={() => navigate("home")} className="bg-brand-600 hover:bg-brand-700">
                  Keep going
                  <ArrowRight className="size-4" aria-hidden />
                </Button>
              ) : null}
              {kind === "end" && coachStep.experimentId ? (
                <Button variant="outline" onClick={() => navigate(`outcome/${coachStep.experimentId}`)}>
                  See the result
                </Button>
              ) : null}
              <Button variant="ghost" className="text-slate-600" onClick={() => navigate("timeline")}>
                <CalendarClock className="size-4" aria-hidden />
                Business timeline
              </Button>
            </div>
            {result.keepGoing ? (
              <p className="mt-3 text-xs text-slate-500">
                {(() => {
                  const n = nextCheckIn(coachStep.checkIns.filter((c) => c.id !== target.checkIn.id));
                  return n ? `Next check-in: ${friendlyDate(n.checkIn.dueAt)}.` : "";
                })()}
              </p>
            ) : null}
          </section>

          {result.nextStep && !result.keepGoing ? (
            <NextStepCard step={result.nextStep} facts={facts} heading="Your next step" onAccepted={() => navigate("home")} />
          ) : result.nextStep && result.verdict === "not-tried" ? (
            <NextStepCard step={result.nextStep} facts={facts} heading="An easier step, if you'd rather" onAccepted={() => navigate("home")} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
