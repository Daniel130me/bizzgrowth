"use client";
// Performance screen group — screens 24–31.
import type { ViewMap } from "../view-types";
import PerformanceOverview from "./overview";
import RevenuePerformance from "./revenue";
import FunnelPerformance from "./funnel";
import MarketingPerformance from "./marketing";
import ChannelDetail from "./channel-detail";
import WebsitePerformance from "./website";
import ProductsPerformance from "./products";
import RetentionPerformance from "./retention";

export const views: ViewMap = {
  performance: PerformanceOverview,
  "performance/revenue": RevenuePerformance,
  "performance/funnel": FunnelPerformance,
  "performance/marketing": MarketingPerformance,
  "performance/marketing/:channel": ChannelDetail,
  "performance/website": WebsitePerformance,
  "performance/products": ProductsPerformance,
  "performance/retention": RetentionPerformance,
};
