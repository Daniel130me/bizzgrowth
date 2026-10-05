"use client";
// Screens 11–20 — Onboarding + first diagnosis flow.
// Keys are registered here and resolved by app-root (OnboardingLayout wraps them).

import type { ViewMap } from "../view-types";
import Welcome from "./welcome";
import CreateWorkspace from "./create-workspace";
import CheckupIntro from "./checkup-intro";
import OnboardingChat from "./onboarding-chat";
import JourneyConfirm from "./journey-confirm";
import BusinessUnderstanding from "./business-understanding";
import FirstDiagnosis from "./first-diagnosis";
import FirstDiagnosisEvidence from "./first-diagnosis-evidence";
import ImproveDiagnosis from "./improve-diagnosis";
import SetupComplete from "./setup-complete";

export const views: ViewMap = {
  welcome: Welcome,
  "create-workspace": CreateWorkspace,
  "checkup-intro": CheckupIntro,
  "onboarding-chat": OnboardingChat,
  "journey-confirm": JourneyConfirm,
  "business-understanding": BusinessUnderstanding,
  "first-diagnosis": FirstDiagnosis,
  "first-diagnosis-evidence": FirstDiagnosisEvidence,
  "improve-diagnosis": ImproveDiagnosis,
  "setup-complete": SetupComplete,
};
