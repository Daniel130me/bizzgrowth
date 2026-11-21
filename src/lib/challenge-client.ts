"use client";
// Browser helpers for challenges: the payload the AI routes receive, and
// writing a challenge's own diagnosis.

import { useBizz } from "./store";
import { challengesContext, type Challenge } from "./challenges";
import type { DiagnosisContent } from "./checkup";

const OWN = "user-workspace";

/** What the diagnosis route needs to know about one challenge. */
export function challengePayload(c: Challenge) {
  return { id: c.id, title: c.title, stage: c.stage, status: c.status, source: c.source, main: c.main === true, details: c.details };
}

/** The owner's list as the AI routes see it (ids, status, stage, what worked / what was learned). */
export function challengeListForAi(): ReturnType<typeof challengesContext> {
  return challengesContext(useBizz.getState().challenges.filter((c) => c.workspaceId === OWN));
}

/**
 * Write (or rewrite) a challenge's own diagnosis from everything known about
 * the business plus its short chat. Stored on the challenge — or in the
 * checkup when it is the one being worked on. Returns the diagnosis, or null.
 */
export async function requestChallengeDiagnosis(id: string, opts: { rethink?: boolean } = {}): Promise<DiagnosisContent | null> {
  const s = useBizz.getState();
  const c = s.challenges.find((x) => x.id === id);
  if (!c || !s.checkup.facts) return null;
  const others = s.challenges.filter((x) => x.id !== id && x.workspaceId === OWN).map(challengePayload);
  try {
    const res = await fetch("/api/checkup/diagnosis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceName: s.userWorkspace?.name ?? "Your business",
        country: s.userWorkspace?.country ?? "Nigeria",
        currency: s.userWorkspace?.currency ?? "₦",
        facts: s.checkup.facts,
        // Its own short chat first, so the owner's words about it are always read.
        transcript: [...(c.transcript ?? []), ...s.checkup.transcript],
        learnings: s.coach.learnings.map((l) => l.text),
        tried: s.coach.steps.filter((x) => x.workspaceId === OWN).map((x) => x.step.title),
        challenge: challengePayload(c),
        others,
        rethink: opts.rethink === true,
      }),
    });
    const data = (await res.json()) as { ok?: boolean; diagnosis?: DiagnosisContent };
    if (data?.ok && data.diagnosis) {
      useBizz.getState().setChallengeDiagnosis(id, data.diagnosis);
      return data.diagnosis;
    }
  } catch {
    // The caller shows a retry — nothing is lost.
  }
  return null;
}
