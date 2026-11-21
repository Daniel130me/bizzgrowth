"use client";
// Screens 116–119 — Specialists marketplace: showcase, profiles, task posting,
// bidding and awards.

import type { ViewMap } from "../view-types";
import { MarketHome } from "./market-home";
import { SpecialistDetail } from "./specialist-detail";
import { TaskPost } from "./task-post";
import { TaskDetail } from "./task-detail";
import { SpecialistEngagement } from "../specialist/engagement";

export const views: ViewMap = {
  market: MarketHome,
  "market/specialist/:id": SpecialistDetail,
  "market/post": TaskPost,
  "market/task/:id": TaskDetail,
  "market/engagement/:id": SpecialistEngagement,
};
