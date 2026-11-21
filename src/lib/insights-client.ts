"use client";
// The owner's insights — things worth knowing beyond their diagnosis — written
// on request from the checkup, the diagnosis, the challenge list, the step
// being tried and any totals they entered (so they don't repeat what the owner
// already tracks or has tried). Used by the diagnosis page ("More worth
// knowing") and the Insights page.
//
// Each insight then has ONE next move that feeds the coaching loop: an
// opportunity or a risk can be tracked as a challenge; a quick win goes on
// this week's list.

import { toast } from "sonner";
import { useBizz } from "./store";
import { buildBusinessContext, coachingContext } from "./ai-context";
import { challengeListForAi } from "./challenge-client";
import { sameTitle, similarChallenge, type Challenge } from "./challenges";
import { shorten, tidyOwnerText } from "./checkup-math";
import { SAME_SUBJECT, sharedWords } from "./overlap";
import { ownerMonthsFromEntries } from "./data/user-business";
import type { DiagnosisContent } from "./checkup";
import type { Insight } from "./types";

const OWN = "user-workspace";
// Keeps the old "bizzgrowth-" prefix on purpose: renaming a storage key would lose what was saved under it.
const META_KEY = "bizzgrowth-insights-meta-v1";

/** What the insights were written against, to tell when they no longer fit. */
export interface InsightsMeta {
  at: string;
  focusId: string | null;
  headline: string | null;
}

export function loadInsightsMeta(): InsightsMeta | null {
  try {
    const raw = typeof window === "undefined" ? null : localStorage.getItem(META_KEY);
    return raw ? (JSON.parse(raw) as InsightsMeta) : null;
  } catch {
    return null;
  }
}

/** Writes (or rewrites) the owner's three insights. True when new ones were saved. */
export async function generateOwnerInsights(): Promise<boolean> {
  const s = useBizz.getState();
  const facts = s.checkup.facts;
  if (!facts) return false;
  const months = ownerMonthsFromEntries(s.manualEntries)
    .slice(-3)
    .map((m) => ({ label: m.label, revenue: m.revenue, enquiries: m.enquiries, customers: m.customers }));
  const focus = s.challenges.find((c) => c.workspaceId === OWN && c.status === "working") ?? null;
  try {
    const res = await fetch("/api/insights/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceName: s.userWorkspace?.name,
        country: s.userWorkspace?.country,
        facts,
        // Everything the owner told the checkup, their diagnosis and plan, what they're trying
        // now and their challenges — insights build on it instead of repeating it.
        context: buildBusinessContext({
          workspace: s.userWorkspace,
          facts,
          diagnosis: s.checkup.diagnosis,
          months,
          coaching: coachingContext(s.coach, OWN),
          challenges: challengeListForAi(),
        }),
        months,
      }),
    });
    const data = (await res.json()) as { ok?: boolean; insights?: Insight[]; error?: string };
    if (data?.ok && data.insights?.length) {
      useBizz.getState().setAiInsights(data.insights);
      try {
        const meta: InsightsMeta = { at: new Date().toISOString(), focusId: focus?.id ?? null, headline: s.checkup.diagnosis?.headline ?? null };
        localStorage.setItem(META_KEY, JSON.stringify(meta));
      } catch {}
      toast.success("Your insights are ready", { description: "Built on your checkup, diagnosis and challenges — every figure checked against your answers." });
      return true;
    }
    toast.error("Could not generate insights", { description: "Nothing was invented in the attempt. Please try again in a moment." });
  } catch {
    toast.error("Could not reach the intelligence engine", { description: "Check your connection and try again — nothing was fabricated meanwhile." });
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* One next move per insight                                            */
/* ------------------------------------------------------------------ */

export type InsightMove = "week" | "track";

/** A quick win goes on this week's list (when there's a diagnosis to hold it); anything else can be tracked. */
export function insightMove(insight: Pick<Insight, "type">, hasWeekList: boolean): InsightMove {
  return insight.type === "improvement" && hasWeekList ? "week" : "track";
}

/** The line a quick win adds to this week's list. */
export function weekLine(insight: Pick<Insight, "recommendedAction" | "title">): string {
  return shorten(tidyOwnerText(insight.recommendedAction || insight.title), 160);
}

/** What a tracked insight says about its challenge (its first description, or an added angle). */
export function insightNote(insight: Pick<Insight, "summary" | "title">): string {
  return shorten(tidyOwnerText(insight.summary || insight.title), 280);
}

const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * The open challenge an insight is really about, if any: the same title or theme,
 * or at least two meaningful words shared with the challenge in the owner's own words.
 * (The insights route already asks for new angles, but a restated challenge can slip through.)
 */
export function insightChallenge(insight: Pick<Insight, "title" | "summary">, challenges: Challenge[]): Challenge | null {
  const open = challenges.filter((c) => c.status === "working" || c.status === "up-next");
  const same = similarChallenge(insight.title, open);
  if (same) return same;
  const said = `${insight.title} ${insight.summary}`;
  let best: { c: Challenge; n: number } | null = null;
  for (const c of open) {
    const n = sharedWords(said, `${c.title} ${c.details?.what ?? ""} ${c.details?.theory ?? ""}`);
    if (n >= SAME_SUBJECT && (!best || n > best.n)) best = { c, n };
  }
  return best?.c ?? null;
}

/** Where the insight already sits in the loop, if anywhere. */
export function insightPlace(insight: Insight, challenges: Challenge[], diagnosis: DiagnosisContent | null): { kind: "week" | "tracked"; challengeId?: string } | null {
  const line = norm(weekLine(insight));
  if ((diagnosis?.steps ?? []).some((s) => norm(s) === line)) return { kind: "week" };
  const note = norm(insightNote(insight));
  const tracked = challenges.find((c) => sameTitle(c.title, insight.title) || c.angles.some((a) => a.source === "insight" && norm(a.text) === note));
  return tracked ? { kind: "tracked", challengeId: tracked.id } : null;
}
