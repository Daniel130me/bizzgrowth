"use client";
// Admin console group — Screens 105–114 (internal platform administration).
// Renders inside AdminShell (dark slate-900 sidebar); all content lives on white cards.
import type { ViewMap } from "../view-types";
import { AdminDashboard } from "./dashboard";
import { BusinessesManagement } from "./businesses";
import { BusinessAdminDetail } from "./business-detail";
import { UsersManagement } from "./users";
import { UserAdminDetail } from "./user-detail";
import { SubscriptionsAdmin } from "./subscriptions";
import { SyncHealth } from "./sync-health";
import { JobsView } from "./jobs";
import { AiAudit } from "./ai-audit";
import { SupportInbox } from "./support";
import { SpecialistApplications } from "./specialists";
import { AiProviderManagement } from "./ai-providers";
import { AiGatewaySettings } from "../settings/ai-gateway";

export const views: ViewMap = {
  admin: AdminDashboard,
  "admin/businesses": BusinessesManagement,
  "admin/businesses/:id": BusinessAdminDetail,
  "admin/users": UsersManagement,
  "admin/users/:id": UserAdminDetail,
  "admin/subscriptions": SubscriptionsAdmin,
  "admin/sync-health": SyncHealth,
  "admin/jobs": JobsView,
  "admin/ai-audit": AiAudit,
  "admin/ai-gateway": AiGatewaySettings,
  "admin/support": SupportInbox,
  "admin/specialists": SpecialistApplications,
  "admin/ai-providers": AiProviderManagement,
};
