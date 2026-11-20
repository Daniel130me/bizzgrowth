"use client";
// Brings back a checkup the owner already finished, when this browser has lost
// it (signed in again, another account used this browser, cleared storage, new
// device). The finished onboarding chat is the record that onboarding is done:
// it is kept in this browser and on the server per signed-in user, with the
// facts it produced and, once made, the diagnosis.

import { useBizz } from "@/lib/store";
import type { BusinessFacts, DiagnosisContent, TranscriptTurn } from "@/lib/checkup";
import { chatDraftKey, fetchResumableChat, loadDraft } from "@/lib/chat-log";

interface DraftShape {
  phase?: string;
  facts?: BusinessFacts | null;
  transcript?: TranscriptTurn[];
  messages?: { role: "ai" | "user"; text: string; cta?: boolean; note?: boolean }[];
}

const usable = (f: unknown): f is BusinessFacts =>
  !!f && typeof f === "object" && typeof (f as BusinessFacts).businessType === "string";

let inFlight: Promise<boolean> | null = null;

/** True when the store has finished-checkup facts (already, or restored now). */
export function restoreFinishedCheckup(): Promise<boolean> {
  if (useBizz.getState().checkup.facts) return Promise.resolve(true);
  if (!inFlight) {
    inFlight = run().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function run(): Promise<boolean> {
  const s = useBizz.getState();
  const workspace = s.userWorkspace?.name;
  if (!workspace) return false;

  // 1. The chat saved in this browser.
  const draft = loadDraft<DraftShape>(chatDraftKey("onboarding-checkup", workspace));
  const draftDone = !!draft && (draft.phase === "done" || !!draft.messages?.some((m) => m.cta));
  if (draftDone && usable(draft.facts)) {
    const transcript = draft.transcript ?? (draft.messages ?? []).filter((m) => m.text && !m.note).map((m) => ({ role: m.role, text: m.text }));
    useBizz.getState().restoreCheckup(draft.facts, transcript);
    return true;
  }

  // 2. The signed-in user's chat saved on the server.
  const stored = await fetchResumableChat("onboarding-checkup", workspace);
  if (useBizz.getState().checkup.facts) return true;
  const finished = stored && (stored.meta?.finished === true || stored.phase === "done");
  if (!stored || !finished || !usable(stored.facts)) return false;
  const transcript = stored.messages
    .filter((m) => m.text && m.meta?.note !== true)
    .map((m) => ({ role: m.role, text: m.text }));
  const diagnosis = (stored.meta?.diagnosis as DiagnosisContent | undefined) ?? null;
  useBizz.getState().restoreCheckup(stored.facts, transcript, diagnosis);
  return true;
}
