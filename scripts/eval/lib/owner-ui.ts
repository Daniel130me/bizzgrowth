// Small pieces of screen code the runner needs but cannot import (they live in
// React components). Each one is copied from the file named next to it, and
// `checkUiCopies()` fails the run if the screen has changed since, so the
// runner never quietly drifts from what the owner really sees.

import { readFileSync } from "node:fs";
import path from "node:path";
import { APP_ROOT } from "./context";

/** src/components/screens/onboarding/onboarding-chat.tsx — OPENERS[0] (the screen picks one at random; runs use the first so before/after match). */
export const CHECKUP_OPENER =
  "Hi, and welcome! I'm Nellovia, an AI business consultant. I'd love to hear about your business — what do you do, and what would you most like to improve?";

/** src/components/screens/onboarding/onboarding-chat.tsx — INTRO_CHIPS[0]. */
export const CHECKUP_INTRO_CHIPS = [
  "I run a cleaning company in Lagos. Most customers hear about us from friends.",
  "I sell handmade furniture from my workshop; people find me on Instagram.",
];

/** onboarding-chat.tsx — the closing message after the extraction. */
export const CHECKUP_DONE =
  "All done — I'm putting your diagnosis together now. It will show what's holding the business back, what fixing it could be worth, and exactly what to do first.";

/** onboarding-chat.tsx — MAX_USER_TURNS. */
export const CHECKUP_MAX_USER_TURNS = 18;

/** src/components/screens/challenges/challenge-chat.tsx — OPENER. */
export const CHALLENGE_OPENER = "What's holding the business back? Say it in your own words — a sentence is enough.";

const COPIES: { file: string; text: string }[] = [
  { file: "src/components/screens/onboarding/onboarding-chat.tsx", text: CHECKUP_OPENER },
  { file: "src/components/screens/onboarding/onboarding-chat.tsx", text: CHECKUP_INTRO_CHIPS[0] },
  { file: "src/components/screens/onboarding/onboarding-chat.tsx", text: CHECKUP_DONE },
  { file: "src/components/screens/onboarding/onboarding-chat.tsx", text: `const MAX_USER_TURNS = ${CHECKUP_MAX_USER_TURNS};` },
  { file: "src/components/screens/challenges/challenge-chat.tsx", text: CHALLENGE_OPENER },
  // The runner sends the owner's checkup words with Ask, the brief and drafts, as these screens do.
  { file: "src/components/screens/ask/index.tsx", text: "transcript: checkupTranscript" },
  { file: "src/components/screens/reports/reports-archive.tsx", text: "const transcript = useBizz((s) => s.checkup.transcript);" },
  { file: "src/components/shared/try-this.tsx", text: "ownerWords: ownerWordsFrom(transcript)" },
];

export function checkUiCopies(): void {
  for (const c of COPIES) {
    const src = readFileSync(path.join(APP_ROOT, c.file), "utf8");
    if (!src.includes(c.text)) {
      throw new Error(`The runner's copy of screen text is out of date: "${c.text.slice(0, 60)}…" is no longer in ${c.file}. Update scripts/eval/lib/owner-ui.ts.`);
    }
  }
}
