"use client";
import type { ViewMap } from "../view-types";
import { BrainOverview } from "./brain-overview";
import { BrainProducts } from "./brain-products";
import { BrainCustomers } from "./brain-customers";
import { BrainJourney } from "./brain-journey";
import { BrainChannels } from "./brain-channels";
import { BrainPriorities } from "./brain-priorities";

// Screen-group view map (Screens 71–76: business brain overview and the five
// configuration screens — products, customers, journey, channels, priorities).
export const views: ViewMap = {
  brain: BrainOverview,
  "brain/products": BrainProducts,
  "brain/customers": BrainCustomers,
  "brain/journey": BrainJourney,
  "brain/channels": BrainChannels,
  "brain/priorities": BrainPriorities,
};
