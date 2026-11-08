"use client";
// Shared helpers for the team / notifications screen group (screens 77–83).

import { useMemo } from "react";
import { CircleAlert, ClipboardList, FileText, FlaskConical, PlugZap, Target, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useBizz } from "@/lib/store";
import { actionsFor } from "@/lib/data/intelligence";
import { TEAM } from "@/lib/data/operations";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/format";
import type { ActionRecord, NotificationItem, TeamMember } from "@/lib/types";

// ---------- Dates (prototype "today" is anchored to the dataset period) ----------

export const PROTOTYPE_TODAY = new Date("2026-10-01T12:00:00");

export function daysUntil(iso: string): number {
  const due = new Date(iso + (iso.length === 10 ? "T12:00:00" : ""));
  return Math.round((due.getTime() - PROTOTYPE_TODAY.getTime()) / 86_400_000);
}

export type DueTone = "overdue" | "soon" | "normal";

export function dueInfo(iso: string): { text: string; tone: DueTone } {
  const d = daysUntil(iso);
  if (d < 0) return { text: `Overdue — was due ${fmtDate(iso)}`, tone: "overdue" };
  if (d === 0) return { text: "Due today", tone: "soon" };
  if (d <= 14) return { text: `Due in ${d} days`, tone: "soon" };
  return { text: `Due ${fmtDate(iso)}`, tone: "normal" };
}

export const DUE_TONE_CLS: Record<DueTone, string> = {
  overdue: "text-red-600 font-medium",
  soon: "text-amber-600 font-medium",
  normal: "text-muted-foreground",
};

// ---------- Roles ----------

export type TeamRole = TeamMember["role"];

export const ROLE_LABEL: Record<TeamRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

const ROLE_CLS: Record<TeamRole, string> = {
  owner: "bg-violet-50 text-violet-700 border-violet-200",
  admin: "bg-blue-50 text-blue-700 border-blue-200",
  member: "bg-slate-100 text-slate-600 border-slate-200",
};

export function RoleBadge({ role, className }: { role: TeamRole; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-normal", ROLE_CLS[role], className)}>
      {ROLE_LABEL[role]}
    </Badge>
  );
}

/** What each role can do — used on invite, member detail and the roles matrix. */
export const ROLE_CAPABILITIES: Record<TeamRole, string> = {
  owner: "Full workspace control, including billing, export and workspace deletion. There is one Owner per workspace.",
  admin: "Day-to-day business operations: data sources, goals, actions and team management. Admins cannot access billing or delete the workspace.",
  member: "Business views and collaboration on assigned actions and experiments. Members cannot change data sources or manage the team.",
};

// ---------- Team list with prototype-level overrides (sessionStorage) ----------

const ROLES_KEY = "bizz-team-role-overrides";
const REMOVED_KEY = "bizz-team-removed";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeRoleOverride(id: string, role: TeamRole) {
  const overrides = readJson<Record<string, TeamRole>>(ROLES_KEY, {});
  overrides[id] = role;
  try {
    sessionStorage.setItem(ROLES_KEY, JSON.stringify(overrides));
  } catch {}
}

export function writeRemovedMember(id: string) {
  const removed = readJson<string[]>(REMOVED_KEY, []);
  if (!removed.includes(id)) removed.push(id);
  try {
    sessionStorage.setItem(REMOVED_KEY, JSON.stringify(removed));
  } catch {}
}

/** TEAM dataset with role overrides applied and removed members filtered out.
 *  A user's OWN workspace starts with just the owner — sample staff never appear. */
export function useTeam(): TeamMember[] {
  const businessId = useBizz((s) => s.businessId);
  const user = useBizz((s) => s.user);
  return useMemo(() => {
    if (businessId === "user-workspace") {
      const owner: TeamMember = {
        id: "own-owner",
        name: user.name || "You",
        email: user.email || "",
        role: "owner",
        jobTitle: user.jobRole || "Owner",
        status: "active",
        lastActive: "Active now",
        assignedActions: 0,
      };
      return [owner];
    }
    const overrides = readJson<Record<string, TeamRole>>(ROLES_KEY, {});
    const removed = readJson<string[]>(REMOVED_KEY, []);
    return TEAM.filter((m) => !removed.includes(m.id)).map((m) => ({
      ...m,
      role: overrides[m.id] ?? m.role,
    }));
  }, [businessId, user]);
}

/** Joined dates for member activity — aligned with the notification history (Ngozi: Sept 2). */
export const JOINED: Record<string, string> = {
  "mem-1": "2026-06-12",
  "mem-2": "2026-06-20",
  "mem-3": "2026-09-02",
  "mem-4": "2026-08-08",
  "mem-5": "",
};

// ---------- Actions (static dataset + user-created store records) ----------

export function useTeamActions(businessId: string): ActionRecord[] {
  const storeActions = useBizz((s) => s.actions);
  return useMemo(
    () => [...storeActions.filter((a) => a.businessId === businessId), ...actionsFor(businessId)],
    [storeActions, businessId],
  );
}

/** Static action rows use "Name (Job title)" — match on the name prefix. */
export function actionOwnedBy(action: ActionRecord, memberName: string): boolean {
  return action.owner.startsWith(memberName);
}

// ---------- Avatars ----------

export function MemberAvatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600",
        className,
      )}
    >
      {initials}
    </span>
  );
}

// ---------- Notification categories ----------

export const NOTIF_CATEGORY_META: Record<
  NotificationItem["category"],
  { label: string; icon: React.ReactNode; cls: string }
> = {
  alert: { label: "Alert", icon: <CircleAlert className="size-3" aria-hidden />, cls: "bg-red-50 text-red-700 border-red-200" },
  assignment: { label: "Assignment", icon: <ClipboardList className="size-3" aria-hidden />, cls: "bg-blue-50 text-blue-700 border-blue-200" },
  report: { label: "Report", icon: <FileText className="size-3" aria-hidden />, cls: "bg-slate-100 text-slate-600 border-slate-200" },
  experiment: { label: "Experiment", icon: <FlaskConical className="size-3" aria-hidden />, cls: "bg-violet-50 text-violet-700 border-violet-200" },
  connection: { label: "Connection", icon: <PlugZap className="size-3" aria-hidden />, cls: "bg-amber-50 text-amber-700 border-amber-200" },
  goal: { label: "Goal", icon: <Target className="size-3" aria-hidden />, cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  team: { label: "Team", icon: <Users className="size-3" aria-hidden />, cls: "bg-slate-100 text-slate-600 border-slate-200" },
};
