"use client";
// Challenges as cards and notices, shared by Home, the Challenges pages, Ask
// and check-ins:
//  • ChallengeCard — the owner's words, status, starting vs latest number, next check-in.
//  • SolvedSuggestion — only when their own counts held up across two check-ins; the OWNER confirms.
//  • StuckNotice — two steps didn't move it: said plainly, with a different approach (or a specialist).
//  • NoticedChallengeCard — a new problem mentioned in Ask or a check-in, added in one tap.
//  • WorkOnThisButton — switch focus (the current step is paused, nothing is lost).
//  • ChallengesStrip — Home's compact view of the list.

import { useState } from "react";
import { ArrowRight, Check, CheckCircle2, Flag, Handshake, Lightbulb, Link2, Pause, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useBizz, useFocusChallenge, useOwnChallenges, type CoachStep } from "@/lib/store";
import {
  SOURCE_LABEL,
  STATUS_META,
  asStage,
  isOpen,
  latestComparable,
  sameTitle,
  solvedEvidence,
  stageLabel,
  startReading,
  stuckEvidence,
  type Challenge,
  type ChallengeStage,
  type ChallengeStatus,
} from "@/lib/challenges";
import type { NoticedChallenge } from "@/lib/checkup";
import { friendlyDate, nextCheckIn } from "@/lib/coach";
import { requestChallengeDiagnosis } from "@/lib/challenge-client";
import { shorten } from "@/lib/checkup-math";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Small pieces                                                         */
/* ------------------------------------------------------------------ */

export function ChallengeStatusPill({ status, className }: { status: ChallengeStatus; className?: string }) {
  const m = STATUS_META[status];
  return <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", m.cls, className)}>{m.label}</span>;
}

export function StagePill({ stage, className }: { stage: ChallengeStage; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        stage === "outside" ? "border-dashed border-slate-300 text-slate-500" : "border-slate-200 text-slate-600",
        className,
      )}
    >
      {stageLabel(stage)}
    </span>
  );
}

/** Starting number vs the latest one — only the owner's own counts, compared like with like. */
export function ChallengeNumbers({ challenge, className }: { challenge: Challenge; className?: string }) {
  const start = startReading(challenge);
  const latest = latestComparable(challenge);
  if (!start) {
    return <p className={cn("text-xs text-slate-500", className)}>No starting number yet — it&apos;s recorded when you start a step that counts something.</p>;
  }
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm", className)}>
      <span className="text-slate-500">Started at</span>
      <span className="font-semibold text-slate-900 tnum">{start.value}</span>
      {latest ? (
        <>
          <ArrowRight className="size-3.5 self-center text-slate-400" aria-hidden />
          <span className="text-slate-500">latest</span>
          <span className="font-semibold text-slate-900 tnum">{latest.value}</span>
        </>
      ) : (
        <span className="text-xs text-slate-500">· no check-in count yet</span>
      )}
      {start.measure ? <span className="basis-full text-xs text-slate-500">{start.measure.replace(/\.$/, "")}</span> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* A challenge in a list                                                */
/* ------------------------------------------------------------------ */

export function ChallengeCard({ challenge, steps, className }: { challenge: Challenge; steps: CoachStep[]; className?: string }) {
  const navigate = useBizz((s) => s.navigate);
  const active = steps.find((st) => st.challengeId === challenge.id && st.status === "active");
  const paused = steps.find((st) => st.challengeId === challenge.id && st.status === "paused");
  const next = active ? nextCheckIn(active.checkIns) : null;
  const lesson = challenge.lessons[challenge.lessons.length - 1];
  const o = challenge.outcome;

  return (
    <article
      className={cn(
        "rounded-2xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5",
        challenge.status === "working" ? "border-brand-300 ring-1 ring-brand-100" : "border-slate-200",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <ChallengeStatusPill status={challenge.status} />
        <StagePill stage={challenge.stage} />
        <span className="text-[11px] text-slate-500">
          {SOURCE_LABEL[challenge.source]}
          {challenge.reportedAtUnknown ? "" : ` · ${friendlyDate(challenge.reportedAt)}`}
        </span>
      </div>
      <h3 className="mt-2 line-clamp-3 text-[15px] font-semibold leading-snug text-slate-900">“{challenge.title}”</h3>

      {challenge.status === "working" ? (
        active ? (
          <p className="mt-1.5 text-sm text-slate-700">
            <span className="font-medium">Trying: </span>
            {active.step.title}
            {next ? <span className="text-slate-500"> · {next.due ? "check-in due now" : `next check-in ${friendlyDate(next.checkIn.dueAt)}`}</span> : null}
          </p>
        ) : paused ? (
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-600">
            <Pause className="size-3.5" aria-hidden /> Paused: {paused.step.title}
          </p>
        ) : (
          <p className="mt-1.5 text-sm text-slate-600">No step started yet.</p>
        )
      ) : null}
      {challenge.status === "up-next" ? (
        <p className="mt-1.5 text-sm text-slate-600">
          {paused ? (
            <span className="flex items-center gap-1.5">
              <Pause className="size-3.5" aria-hidden /> Paused: {paused.step.title}
            </span>
          ) : (
            challenge.orderReason ?? "Waiting its turn."
          )}
        </p>
      ) : null}
      {challenge.status === "solved" && o ? (
        <p className="mt-1.5 text-sm text-slate-700">
          {o.worked.length ? (
            <>
              <span className="font-medium">What worked: </span>
              {o.worked.join("; ")}
            </>
          ) : o.note ? (
            <>
              <span className="font-medium">In your words: </span>
              {o.note}
            </>
          ) : (
            "You marked it solved."
          )}
          {o.took ? <span className="text-slate-500"> · took {o.took}</span> : null}
        </p>
      ) : null}
      {(challenge.status === "stopped" || challenge.status === "no-longer") && lesson ? (
        <p className="mt-1.5 flex gap-1.5 text-sm text-slate-700">
          <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-amber-600" aria-hidden />
          <span>
            <span className="font-medium">Learned: </span>
            {lesson.text}
          </span>
        </p>
      ) : null}
      {challenge.angles.length || challenge.linkedTo.length ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
          <Link2 className="size-3.5" aria-hidden />
          {challenge.angles.length ? `Also described ${challenge.angles.length === 1 ? "one other way" : `${challenge.angles.length} other ways`}` : "Linked to another challenge"}
        </p>
      ) : null}

      <ChallengeNumbers challenge={challenge} className="mt-3" />

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" className="-ml-2 text-brand-700 hover:text-brand-800" onClick={() => navigate(`challenges/${challenge.id}`)}>
          See the full story
          <ArrowRight className="size-3.5" aria-hidden />
        </Button>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* "This may be solved" — the owner decides                             */
/* ------------------------------------------------------------------ */

export function SolvedSuggestion({ challenge, className }: { challenge: Challenge; className?: string }) {
  const mark = useBizz((s) => s.markChallengeSolved);
  const decline = useBizz((s) => s.declineSolved);
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState("");
  const ev = solvedEvidence(challenge);
  if (!ev) return null;
  const noteId = `solved-note-${challenge.id}`;
  return (
    <section aria-label="This may be solved" className={cn("rounded-3xl border border-emerald-200 bg-emerald-50/70 p-5 sm:p-6", className)}>
      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
        <CheckCircle2 className="size-4" aria-hidden /> This may be solved
      </p>
      <p className="mt-1.5 text-[15px] font-semibold leading-snug text-slate-900">“{shorten(challenge.title, 110)}”</p>
      <p className="mt-1 text-sm leading-relaxed text-slate-700">{ev.text} You decide whether it&apos;s solved — the app only suggests it.</p>
      {confirming ? (
        <div className="mt-3 space-y-2">
          <label htmlFor={noteId} className="block text-sm font-medium text-slate-800">
            What made the difference? <span className="font-normal text-slate-500">(optional, in your own words)</span>
          </label>
          <Textarea id={noteId} value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="bg-white" />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => mark(challenge.id, note)} className="bg-emerald-600 hover:bg-emerald-700">
              <Check className="size-4" aria-hidden /> Yes, mark it solved
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Back
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => setConfirming(true)} className="bg-emerald-600 hover:bg-emerald-700">
            Yes, it&apos;s solved
          </Button>
          <Button variant="outline" className="bg-white" onClick={() => decline(challenge.id)}>
            Not yet — keep going
          </Button>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Two steps didn't move it — say so, and change approach               */
/* ------------------------------------------------------------------ */

export function StuckNotice({ challenge, steps, className }: { challenge: Challenge; steps: CoachStep[]; className?: string }) {
  const setTaskPrefill = useBizz((s) => s.setTaskPrefill);
  const navigate = useBizz((s) => s.navigate);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<"done" | "failed" | null>(null);
  const ev = stuckEvidence(challenge, steps);
  if (!ev) return null;

  async function rethink() {
    setBusy(true);
    setResult(null);
    const d = await requestChallengeDiagnosis(challenge.id, { rethink: true });
    setBusy(false);
    setResult(d ? "done" : "failed");
  }

  function specialist() {
    const learned = challenge.lessons.slice(-3).map((l) => `- ${l.text}`);
    setTaskPrefill({
      title: `Help with: ${shorten(challenge.title, 70)}`,
      description: [
        `What's holding my business back: ${challenge.title}`,
        `What I've tried so far (it didn't move it): ${ev!.titles.join("; ")}`,
        learned.length ? `What those tries taught me:\n${learned.join("\n")}` : "",
        "I'm looking for someone who has sorted this out before for a business like mine.",
      ]
        .filter(Boolean)
        .join("\n\n"),
      skills: [],
      source: "recommendation",
      sourceRef: challenge.id,
      sourceTitle: challenge.title,
    });
    navigate("market/post");
  }

  return (
    <section aria-label="Time to change approach" className={cn("rounded-3xl border border-amber-200 bg-amber-50/70 p-5 sm:p-6", className)}>
      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
        <RotateCcw className="size-4" aria-hidden /> Time to change approach
      </p>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-800">{ev.text}</p>
      {result === "done" ? <p className="mt-2 text-sm font-medium text-emerald-700">Done — the diagnosis now looks at a different cause, with a new first step.</p> : null}
      {result === "failed" ? <p className="mt-2 text-sm text-amber-900">I couldn&apos;t connect just now — your answers are safe. Please try again.</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={rethink} disabled={busy} className="bg-amber-600 text-white hover:bg-amber-700">
          {busy ? "Thinking it through again…" : "Look for a different cause"}
        </Button>
        <Button variant="outline" className="bg-white" onClick={specialist}>
          <Handshake className="size-4" aria-hidden /> Get a specialist&apos;s help
        </Button>
      </div>
      <p className="mt-2 text-xs text-slate-500">A specialist is optional — you post what you need and choose who helps, if anyone.</p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* A new problem noticed in Ask or a check-in — one tap to add it       */
/* ------------------------------------------------------------------ */

export function NoticedChallengeCard({
  noticed,
  source,
  ownerText,
  className,
}: {
  noticed: NoticedChallenge;
  source: "ask" | "check-in";
  /** What the owner said, kept as the challenge's first description. */
  ownerText: string;
  className?: string;
}) {
  const challenges = useBizz((s) => s.challenges);
  const addChallenge = useBizz((s) => s.addChallenge);
  const addAngle = useBizz((s) => s.addChallengeAngle);
  const linkChallenges = useBizz((s) => s.linkChallenges);
  const navigate = useBizz((s) => s.navigate);
  const same = noticed.sameAs ? challenges.find((c) => c.id === noticed.sameAs && isOpen(c)) ?? null : null;
  const already = challenges.find((c) => sameTitle(c.title, noticed.title));
  const [state, setState] = useState<{ kind: "added" | "linked" | "dismissed"; id: string } | null>(null);
  const shown = state ?? (already ? { kind: "added" as const, id: already.id } : null);

  if (shown?.kind === "dismissed") return null;
  if (shown) {
    const target = challenges.find((c) => c.id === shown.id);
    return (
      <div className={cn("flex flex-col gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between", className)} role="status">
        <p className="flex items-center gap-2 text-sm text-emerald-900">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden />
          {shown.kind === "added" ? "On your challenges list, up next." : `Added to “${shorten(target?.title ?? "", 60)}”.`}
        </p>
        <div className="flex flex-wrap gap-2">
          {shown.kind === "added" && target && !target.chatDone ? (
            <Button size="sm" variant="outline" className="bg-white" onClick={() => navigate(`challenges/${shown.id}/chat`)}>
              Tell me more — a few quick questions
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" className="text-emerald-800" onClick={() => navigate(`challenges/${shown.id}`)}>
            See it
          </Button>
        </div>
      </div>
    );
  }

  function add() {
    const id = addChallenge({
      title: noticed.title,
      source,
      stage: asStage(noticed.stage, noticed.title),
      details: { what: shorten(ownerText.trim(), 280) || noticed.title },
      linkedTo: same ? [same.id] : [],
    });
    if (same) linkChallenges(id, same.id);
    setState({ kind: "added", id });
  }
  function link() {
    if (!same) return;
    addAngle(same.id, { text: shorten(ownerText.trim(), 280) || noticed.title, source });
    setState({ kind: "linked", id: same.id });
  }

  return (
    <div className={cn("rounded-2xl border border-brand-200 bg-brand-50/60 p-4", className)}>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-700">
        <Flag className="size-3.5" aria-hidden /> Sounds like a challenge
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-900">“{noticed.title}”</p>
      {same ? (
        <p className="mt-1 text-sm text-slate-700">
          It may be the same problem as “{shorten(same.title, 80)}”, seen from another angle.{noticed.why ? ` ${noticed.why}` : ""}
        </p>
      ) : (
        <p className="mt-1 text-sm text-slate-700">Add this as a challenge to work on? It waits up next — you stay focused on one thing at a time.</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {same ? (
          <>
            <Button size="sm" onClick={link} className="bg-brand-600 hover:bg-brand-700">
              <Link2 className="size-3.5" aria-hidden /> Add it to that one
            </Button>
            <Button size="sm" variant="outline" className="bg-white" onClick={add}>
              It&apos;s separate — add it
            </Button>
          </>
        ) : (
          <Button size="sm" onClick={add} className="bg-brand-600 hover:bg-brand-700">
            <Plus className="size-3.5" aria-hidden /> Add it to my challenges
          </Button>
        )}
        <Button size="sm" variant="ghost" className="text-slate-600" onClick={() => setState({ kind: "dismissed", id: "" })}>
          Not now
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Switch focus                                                         */
/* ------------------------------------------------------------------ */

export function WorkOnThisButton({
  challenge,
  label = "Work on this now",
  className,
  size = "default",
  variant = "default",
}: {
  challenge: Challenge;
  label?: string;
  className?: string;
  size?: "sm" | "default";
  variant?: "default" | "outline";
}) {
  const focus = useFocusChallenge();
  const steps = useBizz((s) => s.coach.steps);
  const focusChallenge = useBizz((s) => s.focusChallenge);
  const navigate = useBizz((s) => s.navigate);
  const [open, setOpen] = useState(false);
  const active = steps.find((st) => st.workspaceId === "user-workspace" && st.status === "active");
  if (challenge.status === "working") return null;

  function go() {
    focusChallenge(challenge.id);
    navigate(challenge.chatDone ? `challenges/${challenge.id}` : `challenges/${challenge.id}/chat`);
  }

  return (
    <>
      <Button
        size={size}
        variant={variant}
        className={cn(variant === "default" ? "bg-brand-600 hover:bg-brand-700" : "bg-white", className)}
        onClick={() => (focus || active ? setOpen(true) : go())}
      >
        {label}
        <ArrowRight className="size-4" aria-hidden />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Work on “{shorten(challenge.title, 70)}” now?</AlertDialogTitle>
            <AlertDialogDescription>
              {active
                ? `“${shorten(active.step.title, 80)}” will be paused — its check-ins stop until you come back to it. Nothing is lost.`
                : `“${shorten(focus?.title ?? "", 80)}” goes back to Up next. Nothing is lost.`}{" "}
              One challenge at a time keeps every check-in clear about what worked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my current focus</AlertDialogCancel>
            <AlertDialogAction onClick={go} className="bg-brand-600 hover:bg-brand-700">
              Switch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Home: the list at a glance                                           */
/* ------------------------------------------------------------------ */

export function ChallengesStrip({ className }: { className?: string }) {
  const list = useOwnChallenges();
  const navigate = useBizz((s) => s.navigate);
  if (list.length === 0) return null;
  const focus = list.find((c) => c.status === "working");
  const waiting = list.filter((c) => c.status === "up-next").sort((a, b) => a.order - b.order);
  const solved = list.filter((c) => c.status === "solved").length;

  return (
    <section aria-label="Your challenges" className={cn("rounded-2xl border border-slate-200 bg-white px-5 py-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <Flag className="size-3.5 text-brand-600" aria-hidden /> Your challenges
        </p>
        <button type="button" onClick={() => navigate("challenges")} className="text-xs font-medium text-brand-700 hover:underline">
          See all{solved ? ` · ${solved} solved` : ""}
        </button>
      </div>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 text-sm">
          {focus ? (
            <p className="text-slate-800">
              <span className="font-semibold text-slate-900">Working on now: </span>
              <button type="button" onClick={() => navigate(`challenges/${focus.id}`)} className="text-left hover:underline">
                {shorten(focus.title, 100)}
              </button>
            </p>
          ) : (
            <p className="font-medium text-slate-900">
              Nothing in focus right now{waiting[0] ? ` — up next: “${shorten(waiting[0].title, 60)}”` : "."}
            </p>
          )}
          {waiting.length ? (
            <p className="mt-0.5 text-slate-600">
              <span className="font-medium">Up next: </span>
              {waiting
                .slice(0, 3)
                .map((c) => shorten(c.title, 40))
                .join(" · ")}
              {waiting.length > 3 ? ` · +${waiting.length - 3} more` : ""}
            </p>
          ) : null}
        </div>
        <Button size="sm" variant="outline" className="shrink-0" onClick={() => navigate("challenges/new")}>
          <Plus className="size-3.5" aria-hidden /> Something else holding you back?
        </Button>
      </div>
    </section>
  );
}
