"use client";

import type { ViewMap } from "../view-types";
import { SpecialistOnboarding } from "./onboarding";
import { SpecialistDashboard } from "./dashboard";
import { SpecialistEngagement } from "./engagement";

export const views: ViewMap = {
  "specialist/onboarding": SpecialistOnboarding,
  "specialist/dashboard": SpecialistDashboard,
  "specialist/engagement/:id": SpecialistEngagement,
};
