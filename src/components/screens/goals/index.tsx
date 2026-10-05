"use client";
import type { ViewMap } from "../view-types";
import { GoalsOverview } from "./goals-overview";
import { GoalCreate } from "./goal-create";
import { GoalDetail } from "./goal-detail";

// Screen-group view map (Screens 65–67: goals overview, create/edit goal,
// goal detail & progress).
export const views: ViewMap = {
  goals: GoalsOverview,
  "goal-create": GoalCreate,
  "goals/:id": GoalDetail,
};
