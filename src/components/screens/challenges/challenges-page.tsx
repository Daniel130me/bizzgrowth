"use client";
// Challenges — what's holding the business back, as a list the owner can hold
// themselves (and the app) accountable to: what's being worked on now, what's
// up next and why, what's solved (with before/after and what worked), and what
// was stopped (with what it taught). No badges: just the record.

import { useMemo } from "react";
import { ArrowDown, ArrowUp, Flag, Lightbulb, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/layout";
import { ChallengeCard, SolvedSuggestion, StuckNotice, WorkOnThisButton } from "@/components/shared/challenges";
import { useBizz, useOwnChallenges } from "@/lib/store";
import { challengeSummary, type Challenge } from "@/lib/challenges";
import type { ScreenProps } from "../view-types";

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export function ChallengesScreen(_props: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);
  const hydrated = useBizz((s) => s.hydrated);
  const businessId = useBizz((s) => s.businessId);
  const facts = useBizz((s) => s.checkup.facts);
  const steps = useBizz((s) => s.coach.steps);
  const moveChallenge = useBizz((s) => s.moveChallenge);
  const list = useOwnChallenges();

  const sum = useMemo(() => challengeSummary(list, steps), [list, steps]);
  const focus = list.find((c) => c.status === "working") ?? null;
  const waiting = useMemo(() => list.filter((c) => c.status === "up-next").sort((a, b) => a.order - b.order), [list]);
  const solved = useMemo(() => list.filter((c) => c.status === "solved").sort((a, b) => (b.solvedAt ?? "").localeCompare(a.solvedAt ?? "")), [list]);
  const stopped = useMemo(() => list.filter((c) => c.status === "stopped" || c.status === "no-longer").sort((a, b) => (b.stoppedAt ?? "").localeCompare(a.stoppedAt ?? "")), [list]);

  if (!hydrated) return <div className="py-16 text-center text-sm text-muted-foreground">Loading your challenges…</div>;

  if (businessId !== "user-workspace") {
    return (
      <div className="mx-auto w-full max-w-xl py-10 text-center">
        <Flag className="mx-auto size-6 text-brand-600" aria-hidden />
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Challenges live in your own workspace</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sample businesses don&apos;t have a challenge list. Switch to your workspace to see yours.</p>
      </div>
    );
  }

  if (!facts || list.length === 0) {
    return (
      <div className="mx-auto w-full max-w-xl py-10 text-center">
        <Flag className="mx-auto size-6 text-brand-600" aria-hidden />
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Your challenges start with your checkup</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The checkup finds what&apos;s holding the business back. Each problem then gets tracked here — what you tried, what worked, and what it taught us.
        </p>
        <Button className="mt-5 bg-brand-600 hover:bg-brand-700" onClick={() => navigate(facts ? "challenges/new" : "onboarding-chat")}>
          {facts ? "Report a challenge" : "Do my checkup"}
        </Button>
      </div>
    );
  }

  const summaryBits = [
    plural(sum.solved, "solved", "solved"),
    plural(sum.working, "in progress", "in progress"),
    plural(sum.waiting, "waiting", "waiting"),
    plural(sum.experiments, "experiment run", "experiments run"),
    ...(sum.steps > sum.experiments ? [plural(sum.steps - sum.experiments, "other step tried", "other steps tried")] : []),
    ...(sum.lessons ? [plural(sum.lessons, "lesson learned", "lessons learned")] : []),
  ];

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        title="Your challenges"
        description="What's holding the business back, one at a time. The app suggests the order; you decide, and you confirm when something is solved."
        actions={
          <Button className="bg-brand-600 hover:bg-brand-700" onClick={() => navigate("challenges/new")}>
            <Plus className="size-4" aria-hidden /> Report a new challenge
          </Button>
        }
      />

      {/* Since you joined — the honest record */}
      <Card className="mb-6 border-brand-200 bg-brand-50/50 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">Since you joined</p>
        <p className="mt-1 text-base font-semibold text-slate-900 sm:text-lg">{summaryBits.join(" · ")}</p>
        <p className="mt-1 text-xs text-slate-600">
          Counted from what you did and told us in check-ins.{sum.noLonger ? ` ${plural(sum.noLonger, "challenge")} went away on ${sum.noLonger === 1 ? "its" : "their"} own — not counted as solved.` : ""}
        </p>
      </Card>

      {/* Working on now */}
      <section aria-labelledby="ch-working" className="mb-8">
        <h2 id="ch-working" className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Working on now
        </h2>
        {focus ? (
          <div className="space-y-3">
            <SolvedSuggestion challenge={focus} />
            <StuckNotice challenge={focus} steps={steps} />
            <ChallengeCard challenge={focus} steps={steps} />
          </div>
        ) : (
          <Card className="p-5">
            <p className="text-sm font-semibold text-slate-900">Nothing in focus right now.</p>
            {waiting[0] ? (
              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-600">
                  Suggested next: <span className="font-medium text-slate-900">“{waiting[0].title}”</span>
                  {waiting[0].orderReason ? ` — ${waiting[0].orderReason.replace(/^./, (c) => c.toLowerCase())}` : ""}
                </p>
                <WorkOnThisButton challenge={waiting[0]} size="sm" />
              </div>
            ) : (
              <p className="mt-1 text-sm text-slate-600">Report what&apos;s holding the business back next, and we&apos;ll work on it together.</p>
            )}
          </Card>
        )}
      </section>

      {/* Up next — in the suggested order, the owner can move them */}
      <section aria-labelledby="ch-next" className="mb-8">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="ch-next" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Up next
          </h2>
          {waiting.length > 1 ? <p className="text-xs text-slate-500">In the order we suggest — move them if you see it differently.</p> : null}
        </div>
        {waiting.length ? (
          <ol className="space-y-3">
            {waiting.map((c, i) => (
              <li key={c.id}>
                <ChallengeCard challenge={c} steps={steps} />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <WorkOnThisButton challenge={c} size="sm" variant="outline" label="Work on this now" />
                  <OrderButtons challenge={c} first={i === 0} last={i === waiting.length - 1} onMove={moveChallenge} />
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">Nothing waiting. Anything else holding the business back? Report it and it joins the line.</p>
        )}
      </section>

      {/* Solved — before/after, what worked, how long */}
      <section aria-labelledby="ch-solved" className="mb-8">
        <h2 id="ch-solved" className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Solved
        </h2>
        {solved.length ? (
          <div className="space-y-3">
            {solved.map((c) => (
              <ChallengeCard key={c.id} challenge={c} steps={steps} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
            Nothing marked solved yet. When your own counts hold up across two check-ins, I&apos;ll ask whether it&apos;s solved — you decide.
          </p>
        )}
      </section>

      {/* Stopped — and what it taught */}
      <section aria-labelledby="ch-stopped" className="mb-4">
        <h2 id="ch-stopped" className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Stopped
        </h2>
        {stopped.length ? (
          <div className="space-y-3">
            {stopped.map((c) => (
              <ChallengeCard key={c.id} challenge={c} steps={steps} />
            ))}
          </div>
        ) : (
          <p className="flex gap-2 rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
            Stopping is fine — what a step ruled out (“it isn&apos;t slow replies”) still counts, and it&apos;s kept here.
          </p>
        )}
      </section>
    </div>
  );
}

function OrderButtons({ challenge, first, last, onMove }: { challenge: Challenge; first: boolean; last: boolean; onMove: (id: string, dir: -1 | 1) => void }) {
  if (first && last) return null;
  return (
    <span className="inline-flex gap-1">
      <Button size="icon" variant="ghost" className="size-8" disabled={first} onClick={() => onMove(challenge.id, -1)} aria-label={`Move “${challenge.title}” up`}>
        <ArrowUp className="size-4" aria-hidden />
      </Button>
      <Button size="icon" variant="ghost" className="size-8" disabled={last} onClick={() => onMove(challenge.id, 1)} aria-label={`Move “${challenge.title}” down`}>
        <ArrowDown className="size-4" aria-hidden />
      </Button>
    </span>
  );
}
