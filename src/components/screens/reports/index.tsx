"use client";
import type { ViewMap } from "../view-types";
import { BriefWeekly } from "./brief-weekly";
import { BriefMonthly } from "./brief-monthly";
import { ReportsArchive } from "./reports-archive";

// Screen-group view map (Screens 68–70: weekly brief, monthly review,
// reports / brief archive).
export const views: ViewMap = {
  "brief/weekly": BriefWeekly,
  "brief/monthly": BriefMonthly,
  reports: ReportsArchive,
};
