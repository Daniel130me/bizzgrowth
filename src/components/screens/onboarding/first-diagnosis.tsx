"use client";
// Screen 17 — First Diagnosis: the payoff for the checkup, and the moment a
// new owner decides whether Nellovia is worth paying for. It has to:
//   1. Name the real problem in their terms, with an insight they had not
//      connected themselves (not their complaint repeated back).
//   2. Show what fixing it is WORTH — computed from their own estimates, with
//      the working one tap away (nothing invented).
//   3. Hand them help they can use in the next five minutes: a message to send
//      (copy or open in WhatsApp), what to say, an offer to use.
//   4. Give them a plan to tick off and a reason to come back.
// The wait is part of the experience: an analysis view walks through their
// own answers while the diagnosis is written.
//
// The same tabbed diagnosis lives on its own page in the workspace
// (#/diagnosis); this is the first-time reveal, in the setup layout.

import { DiagnosisView } from "../diagnosis/diagnosis-view";
import type { ScreenProps } from "../view-types";

export default function FirstDiagnosis({ params }: ScreenProps) {
  return <DiagnosisView mode="reveal" tabParam={params.tab} />;
}
