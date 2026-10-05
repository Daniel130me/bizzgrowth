"use client";
// Home screen group — screens 21–23 (Home, Business Health, Metric drill-down).
import type { ViewMap } from "../view-types";
import HomeScreen from "./home-screen";
import HealthDetail from "./health-detail";
import MetricDetail from "./metric-detail";

export const views: ViewMap = {
  home: HomeScreen,
  "health-detail": HealthDetail,
  "metric/:id": MetricDetail,
};
