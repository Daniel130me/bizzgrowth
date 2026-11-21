"use client";
// "More worth knowing" — the diagnosis page's fourth tab, and the owner's home
// for insights: things beyond the main diagnosis (an opportunity they may be
// missing, something to watch, a quick win), written on request from their
// checkup, diagnosis, challenges and any totals they entered. Each one has a
// next move (track it as a challenge, or put it on this week's list), shown on
// its card once taken. When the focus moves on, a challenge is solved or the
// diagnosis changes, they're flagged as out of date. Sample businesses keep
// their own Insights page.

import { useMemo, useState } from "react";
import { History, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InsightCard } from "@/components/shared/cards";
import { EmptyState } from "@/components/shared/states";
import { useBizz, useFocusChallenge, useOwnChallenges } from "@/lib/store";
import { generateOwnerInsights, insightPlace, loadInsightsMeta } from "@/lib/insights-client";
import type { Challenge } from "@/lib/challenges";
import { shorten } from "@/lib/checkup-math";
import { fmtDate } from "@/lib/format";
import type { Insight } from "@/lib/types";
import { sortInsights } from "../insights/parts";

/** Why insights written earlier may no longer fit — or null while they still do. */
function outOfDate(list: Insight[], focus: Challenge | null, challenges: Challenge[], headline: string | null): string | null {
  if (!list.length) return null;
  const meta = loadInsightsMeta();
  // Written before their basis was kept: go by the day they were written.
  const since = meta?.at ?? `${list.map((i) => i.date).sort().pop()}T23:59:59`;
  const closed = challenges
    .filter((c) => (c.solvedAt && c.solvedAt > since) || (c.stoppedAt && c.stoppedAt > since))
    .sort((a, b) => (b.solvedAt ?? b.stoppedAt ?? "").localeCompare(a.solvedAt ?? a.stoppedAt ?? ""))[0];
  if (closed) return `${closed.status === "solved" ? "You solved" : "You stopped working on"} “${shorten(closed.title, 60)}” since these were written.`;
  if (meta ? (meta.focusId ?? null) !== (focus?.id ?? null) : Boolean(focus?.focusedAt && focus.focusedAt > since)) {
    return focus ? `You've moved on to “${shorten(focus.title, 60)}” since these were written.` : "Nothing is in focus any more since these were written.";
  }
  if (meta?.headline && headline && meta.headline !== headline) return "Your diagnosis has changed since these were written.";
  return null;
}

export function MoreWorthKnowing() {
  const navigate = useBizz((s) => s.navigate);
  const insights = useBizz((s) => s.aiInsights);
  const diagnosis = useBizz((s) => s.checkup.diagnosis);
  const focus = useFocusChallenge();
  const challenges = useOwnChallenges();
  const [writing, setWriting] = useState(false);
  const list = useMemo(() => sortInsights(insights), [insights]);
  const writtenOn = list.map((i) => i.date).sort().pop();
  const stale = useMemo(() => outOfDate(list, focus, challenges, diagnosis?.headline ?? null), [list, focus, challenges, diagnosis]);

  async function write() {
    setWriting(true);
    await generateOwnerInsights();
    setWriting(false);
  }

  if (!list.length) {
    return (
      <EmptyState
        icon={writing ? <Loader2 className="size-5 animate-spin" /> : <Sparkles className="size-5" />}
        title="Three things worth knowing about your business"
        description="Beyond your diagnosis: an opportunity you may be missing, something to watch, and a quick win for this week — with the exact words to use where it helps. Every figure is checked against your answers; nothing is made up."
        actions={
          <Button size="sm" className="bg-brand-600 hover:bg-brand-700" disabled={writing} onClick={() => void write()}>
            {writing ? (
              <>
                <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden />
                Studying your answers — up to a minute…
              </>
            ) : (
              <>
                <Sparkles className="mr-1.5 size-3.5" aria-hidden />
                Show me my insights
              </>
            )}
          </Button>
        }
      />
    );
  }

  return (
    <section aria-label="More worth knowing" className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <Sparkles className="size-5 text-brand-600" aria-hidden />
          Beyond your diagnosis
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Not the main problem — but worth knowing: an opportunity you may be missing, something to watch, and a quick win. Open one to see why, then track it as a challenge or put it on this week&apos;s list.
        </p>
      </div>

      {stale ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between" role="status">
          <p className="flex items-start gap-2 text-sm text-amber-950">
            <History className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
            <span>
              {stale} They may not fit any more.
            </span>
          </p>
          <Button size="sm" className="shrink-0 bg-brand-600 hover:bg-brand-700" disabled={writing} onClick={() => void write()}>
            {writing ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <RefreshCw className="size-3.5" aria-hidden />}
            {writing ? "Writing new ones…" : "Write new ones"}
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {list.map((insight) => {
          const place = insightPlace(insight, challenges, diagnosis);
          return (
            <InsightCard
              key={insight.id}
              insight={insight}
              cta="Why, and what to do"
              status={place?.kind === "week" ? "On this week's list" : place?.kind === "tracked" ? "Tracked as a challenge" : undefined}
              onOpen={() => navigate(`insights/${insight.id}`)}
            />
          );
        })}
      </div>

      {!stale ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            {writtenOn ? `Written on ${fmtDate(writtenOn)}, from what you'd told me then.` : "Written from what you'd told me."} I&apos;ll flag them when your focus or diagnosis moves on.
          </p>
          <Button size="sm" variant="outline" className="shrink-0 bg-white" disabled={writing} onClick={() => void write()}>
            {writing ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <RefreshCw className="size-3.5" aria-hidden />}
            {writing ? "Writing new ones…" : "Write new ones"}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
