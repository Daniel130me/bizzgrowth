"use client";
// Screens 130–133 — the owner's diagnosis on its own page (sidebar → Diagnosis),
// in four tabs: Summary, What to do, Why I think this, More worth knowing. The
// same component serves every address, so moving between tabs or challenges
// keeps it mounted.

import type { ScreenProps, ViewMap } from "../view-types";
import { DiagnosisView } from "./diagnosis-view";

function DiagnosisScreen({ params }: ScreenProps) {
  return <DiagnosisView mode="page" tabParam={params.tab} challengeParam={params.challenge} />;
}

export const views: ViewMap = {
  diagnosis: DiagnosisScreen,
  "diagnosis/:tab": DiagnosisScreen,
  "diagnosis/:tab/:challenge": DiagnosisScreen,
};
