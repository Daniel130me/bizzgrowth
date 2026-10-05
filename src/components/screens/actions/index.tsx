"use client";
// Screens 38–47 — Action Centre, recommendations, actions, experiments, outcomes, timeline.

import type { ViewMap } from "../view-types";
import { ActionCentre } from "./action-centre";
import { RecommendationDetail } from "./recommendation-detail";
import { ActionStart } from "./action-start";
import { ActionDetail } from "./action-detail";
import { ExperimentSetup } from "./experiment-setup";
import { ExperimentTracking } from "./experiment-tracking";
import { OutcomeDetail } from "./outcome";
import { Timeline } from "./timeline";
import { ChangeAdd } from "./change-add";

export const views: ViewMap = {
  actions: ActionCentre,
  "recommendations/:id": RecommendationDetail,
  "action-start/:id": ActionStart,
  "actions/:id": ActionDetail,
  "experiment-setup/:id": ExperimentSetup,
  "experiments/:id": ExperimentTracking,
  "outcome/:id": OutcomeDetail,
  timeline: Timeline,
  "change-add": ChangeAdd,
};
