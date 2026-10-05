"use client";
// Data Centre group — Screens 50–64.
// 50 coverage · 51–56 sources & connections · 57–58 manual data · 59–62 CSV import · 63 quality · 64 provenance.

import type { ViewMap } from "../view-types";
import { views as coverageViews } from "./coverage";
import { views as sourcesViews } from "./sources";
import { views as manualViews } from "./manual";
import { views as csvViews } from "./csv";
import { views as qualityViews } from "./quality";
import { views as provenanceViews } from "./provenance";

export const views: ViewMap = {
  ...coverageViews,
  ...sourcesViews,
  ...manualViews,
  ...csvViews,
  ...qualityViews,
  ...provenanceViews,
};
