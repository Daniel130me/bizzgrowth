// Builds the one business context every AI feature receives (client side):
// the owner's checkup answers, their diagnosis, how far they are with the plan,
// and any totals they entered. With it, Ask / insights / briefs build on what
// the owner already knows instead of starting from a blank page.

import type { BusinessContextPayload, BusinessFacts, DiagnosisContent, TranscriptTurn } from "./checkup";
import { loadPlanProgress, planIdFor } from "./plan-progress";
import { daysSince, friendlyDate, nextCheckIn } from "./coach";
import type { CoachState } from "./store";

/** The step being tried right now and what check-ins taught us, for the AI context. */
export function coachingContext(coach: CoachState | null | undefined, workspaceId: string): BusinessContextPayload["coaching"] {
  if (!coach) return null;
  const active = coach.steps.find((x) => x.workspaceId === workspaceId && x.status === "active");
  const learnings = coach.learnings.map((l) => l.text).slice(-6);
  if (!active && !learnings.length) return null;
  const next = active ? nextCheckIn(active.checkIns) : null;
  return {
    active: active
      ? {
          title: active.step.title,
          kind: active.step.kind,
          day: Math.min(active.step.days, daysSince(active.acceptedAt) + 1),
          days: active.step.days,
          measure: active.step.measure,
          baseline: active.baseline,
          nextCheckIn: next ? (next.due ? "due now" : friendlyDate(next.checkIn.dueAt)) : undefined,
        }
      : null,
    learnings,
  };
}

export function buildBusinessContext(input: {
  workspace: { name: string; country?: string; currency?: string } | null | undefined;
  facts: BusinessFacts | null | undefined;
  diagnosis: DiagnosisContent | null | undefined;
  months?: { label: string; revenue?: number; enquiries?: number; customers?: number }[];
  coaching?: BusinessContextPayload["coaching"];
  /** Their list of challenges (see challengesContext). */
  challenges?: BusinessContextPayload["challenges"];
  /** The checkup conversation — the owner's own replies go along, word for word. */
  transcript?: TranscriptTurn[];
}): BusinessContextPayload | null {
  const { workspace, facts, diagnosis: d } = input;
  if (!workspace && !facts) return null;
  const name = workspace?.name ?? "Your business";

  let diagnosis: BusinessContextPayload["diagnosis"] = null;
  if (d) {
    const done = loadPlanProgress(planIdFor(name, d.headline));
    const steps = d.steps ?? [];
    diagnosis = {
      headline: d.headline,
      insight: d.insight,
      focusStage: d.focusStage,
      stake: d.stake ? { figure: d.stake.figure, label: d.stake.label, working: d.stake.working } : null,
      steps,
      stepsDone: steps.filter((_, i) => done[i]),
      tools: (d.tools ?? []).map((t) => ({ kind: t.kind, title: t.title })),
    };
  }

  return {
    name,
    country: workspace?.country,
    currency: workspace?.currency,
    // The fact rows and chips repeat the fields — leave them out to keep prompts lean.
    facts: facts ? { ...facts, facts: [], chips: [] } : null,
    diagnosis,
    months: (input.months ?? []).slice(-3),
    coaching: input.coaching ?? null,
    challenges: input.challenges?.length ? input.challenges : null,
    ...(ownerWordsFrom(input.transcript).length ? { ownerWords: ownerWordsFrom(input.transcript) } : {}),
  };
}

/** The owner's own checkup replies, trimmed to what a prompt can carry (latest kept). */
export function ownerWordsFrom(transcript: TranscriptTurn[] | undefined, maxChars = 2400): string[] {
  const replies = (transcript ?? [])
    .filter((t) => t.role === "user" && typeof t.text === "string" && t.text.trim().length > 0)
    .map((t) => t.text.replace(/\s+/g, " ").trim().slice(0, 400));
  const out: string[] = [];
  let used = 0;
  // Keep the first reply (it usually says why they came) and as many of the latest as fit.
  for (let i = replies.length - 1; i >= 0; i--) {
    if (used + replies[i].length > maxChars && out.length > 0 && i !== 0) continue;
    out.unshift(replies[i]);
    used += replies[i].length;
  }
  return out;
}
