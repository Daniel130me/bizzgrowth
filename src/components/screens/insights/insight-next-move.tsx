"use client";
// The one next move for an owner's insight, so it feeds the coaching loop
// instead of being read once and forgotten:
//   • a quick win → this week's list on their diagnosis (ticked like the rest);
//   • an opportunity or a risk → tracked as a challenge (or added to one that
//     is the same problem), waiting up next — one thing at a time.

import { ArrowRight, CheckCircle2, Flag, Link2, ListChecks, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBizz, useOwnChallenges } from "@/lib/store";
import { shorten } from "@/lib/checkup-math";
import { insightChallenge, insightMove, insightNote, insightPlace, weekLine } from "@/lib/insights-client";
import type { Insight } from "@/lib/types";

export function InsightNextMove({ insight }: { insight: Insight }) {
  const navigate = useBizz((s) => s.navigate);
  const diagnosis = useBizz((s) => s.checkup.diagnosis);
  const setCheckupDiagnosis = useBizz((s) => s.setCheckupDiagnosis);
  const addChallenge = useBizz((s) => s.addChallenge);
  const addAngle = useBizz((s) => s.addChallengeAngle);
  const challenges = useOwnChallenges();
  const focus = challenges.find((c) => c.status === "working") ?? null;

  const move = insightMove(insight, Boolean(diagnosis && focus));
  const place = insightPlace(insight, challenges, diagnosis);
  const same = move === "track" && !place ? insightChallenge(insight, challenges) : null;

  if (place) {
    const target = place.challengeId ? challenges.find((c) => c.id === place.challengeId) ?? null : null;
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between" role="status">
        <p className="flex items-center gap-2 text-sm text-emerald-900">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden />
          {place.kind === "week"
            ? "On this week's list, with the rest of your plan."
            : target && target.title.trim().toLowerCase() !== insight.title.trim().toLowerCase()
              ? `Kept with your challenge “${shorten(target.title, 60)}”.`
              : "On your challenges list."}
        </p>
        <div className="flex flex-wrap gap-2">
          {place.kind === "tracked" && target && !target.chatDone && target.status === "up-next" ? (
            <Button size="sm" variant="outline" className="bg-white" onClick={() => navigate(`challenges/${target.id}/chat`)}>
              Tell me more — a few quick questions
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            className="text-emerald-800"
            onClick={() => navigate(place.kind === "week" ? "diagnosis/what-to-do" : `challenges/${place.challengeId}`)}
          >
            {place.kind === "week" ? "See this week's list" : "See it"}
            <ArrowRight className="size-3.5" aria-hidden />
          </Button>
        </div>
      </div>
    );
  }

  function addToWeek() {
    if (!diagnosis) return;
    setCheckupDiagnosis({ ...diagnosis, steps: [...(diagnosis.steps ?? []), weekLine(insight)] });
  }
  function track() {
    addChallenge({ title: shorten(insight.title, 120), source: "insight", details: { what: insightNote(insight) }, linkedTo: [] });
  }
  function addToSame() {
    if (same) addAngle(same.id, { text: insightNote(insight), source: "insight" });
  }

  if (move === "week") {
    return (
      <div className="rounded-2xl border border-brand-200 bg-white p-4">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-700">
          <ListChecks className="size-3.5" aria-hidden /> A quick win for this week
        </p>
        <p className="mt-1 text-sm text-slate-800">“{weekLine(insight)}”</p>
        <p className="mt-1 text-xs text-slate-500">It joins this week&apos;s list on your diagnosis, so you can tick it off with the rest.</p>
        <Button size="sm" className="mt-3 bg-brand-600 hover:bg-brand-700" onClick={addToWeek}>
          <Plus className="size-3.5" aria-hidden /> Add to this week&apos;s list
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-brand-200 bg-white p-4">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-700">
        <Flag className="size-3.5" aria-hidden /> {insight.type === "opportunity" ? "Worth going after?" : "Worth keeping an eye on?"}
      </p>
      {same ? (
        <p className="mt-1 text-sm text-slate-700">It looks like part of your challenge “{shorten(same.title, 80)}” — keep it with that one, or track it on its own.</p>
      ) : (
        <p className="mt-1 text-sm text-slate-700">Track it as a challenge. It waits up next, so you stay focused on one thing at a time.</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {same ? (
          <>
            <Button size="sm" className="bg-brand-600 hover:bg-brand-700" onClick={addToSame}>
              <Link2 className="size-3.5" aria-hidden /> Keep it with that one
            </Button>
            <Button size="sm" variant="outline" className="bg-white" onClick={track}>
              It&apos;s separate — track it
            </Button>
          </>
        ) : (
          <Button size="sm" className="bg-brand-600 hover:bg-brand-700" onClick={track}>
            <Plus className="size-3.5" aria-hidden /> Track this as a challenge
          </Button>
        )}
      </div>
    </div>
  );
}
