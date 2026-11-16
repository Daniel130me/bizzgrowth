"use client";
// Screens 84–94 — Account, workspace and billing settings, help and feedback.

import type { ViewMap } from "../view-types";
import { BusinessSettings } from "./business";
import { ProfileSettings } from "./profile";
import { SecuritySettings } from "./security";
import { PrivacySettings } from "./privacy";
import { PlanSettings } from "./plan";
import { Upgrade } from "./upgrade";
import { PaymentMethod } from "./payment-method";
import { Invoices } from "./invoices";
import { ExportDelete } from "./export-delete";
import { HelpSupport } from "./help";
import { Feedback } from "./feedback";
import { AiGatewaySettings } from "./ai-gateway";

export const views: ViewMap = {
  "settings/business": BusinessSettings,
  "settings/profile": ProfileSettings,
  "settings/security": SecuritySettings,
  "settings/privacy": PrivacySettings,
  "settings/ai": AiGatewaySettings,
  "settings/plan": PlanSettings,
  upgrade: Upgrade,
  "payment-method": PaymentMethod,
  invoices: Invoices,
  "settings/export-delete": ExportDelete,
  help: HelpSupport,
  feedback: Feedback,
};
