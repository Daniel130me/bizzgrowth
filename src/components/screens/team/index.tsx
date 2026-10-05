"use client";
// Screens 77–83 — Team, accountability, notifications and notification preferences.

import type { ViewMap } from "../view-types";
import { TeamMembers } from "./team-members";
import { InviteMember } from "./invite";
import { MemberDetail } from "./member-detail";
import { RolesPermissions } from "./roles";
import { MyActions } from "./my-actions";
import { NotificationsCentre } from "./notifications";
import { NotificationPrefs } from "./notif-prefs";

export const views: ViewMap = {
  team: TeamMembers,
  "team/invite": InviteMember,
  "team/roles": RolesPermissions,
  "team/:id": MemberDetail,
  "my-actions": MyActions,
  notifications: NotificationsCentre,
  "notification-prefs": NotificationPrefs,
};
