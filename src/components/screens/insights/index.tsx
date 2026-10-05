"use client";
import type { ViewMap } from "../view-types";
import { InsightsFeed } from "./insights-feed";
import { InsightDetail } from "./insight-detail";
import { AlertsCentre } from "./alerts-centre";
import { AlertDetail } from "./alert-detail";

// Screen-group view map (Screens 32–37: insights feed, intelligence detail,
// opportunity detail, confidence/evidence detail, alerts centre, alert detail).
export const views: ViewMap = {
  insights: InsightsFeed,
  "insights/:id": InsightDetail,
  alerts: AlertsCentre,
  "alerts/:id": AlertDetail,
};
