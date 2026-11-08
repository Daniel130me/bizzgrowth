"use client";
// Central prototype state. Everything is client-side; persistence is
// session-level (in-memory) with localStorage backup for settings where useful.

import { create } from "zustand";
import { toast } from "sonner";
import { navigate } from "./router";
import type {
  ActionRecord,
  ChecklistItem,
  ConnectionStatus,
  DateRangeId,
  ExperimentRecord,
  GoalRecord,
  ManualEntry,
  NotificationItem,
} from "./types";
import type { UserWorkspaceMeta, WorkspaceId } from "./data/businesses";
import type { BusinessFacts, DiagnosisContent, ImprovedDiagnosis, TranscriptTurn } from "./checkup";

export interface CheckupState {
  transcript: TranscriptTurn[];
  facts: BusinessFacts | null;
  diagnosis: DiagnosisContent | null;
  improved: ImprovedDiagnosis | null;
}

const EMPTY_CHECKUP: CheckupState = { transcript: [], facts: null, diagnosis: null, improved: null };

export interface BizzUser {
  name: string;
  email: string;
  jobRole: string;
}

interface BizzSettings {
  businessName: string;
  currency: string;
  timezone: string;
  reportingPeriod: string;
  comparisonPeriod: string;
  notifPrefs: Record<string, { inApp: boolean; email: boolean }>;
  plan: "Private Beta" | "Growth" | "Team";
}

interface BizzState {
  hydrated: boolean;
  businessId: WorkspaceId;
  userWorkspace: UserWorkspaceMeta | null;
  dateRange: DateRangeId;
  user: BizzUser;
  notifications: NotificationItem[];
  actions: ActionRecord[];
  experiments: ExperimentRecord[];
  goals: GoalRecord[];
  /** Totals the owner entered by hand (their own workspace only). */
  manualEntries: ManualEntry[];
  connections: Record<string, ConnectionStatus>;
  /** Source connections created inside the OWNER'S OWN workspace (starts empty). */
  ownConnections: Record<string, ConnectionStatus>;
  recommendationState: Record<string, "open" | "dismissed" | "saved">;
  settings: BizzSettings;
  pendingInvite: { business: string; inviter: string; role: string; expires: string } | null;
  checkup: CheckupState;

  navigate: (path: string) => void;
  setBusiness: (id: WorkspaceId) => void;
  setDateRange: (range: DateRangeId) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;

  startAction: (input: { recommendationId: string; title: string; owner: string; due: string; asExperiment: boolean; notes?: string }) => string;
  updateAction: (id: string, patch: Partial<ActionRecord>) => void;
  toggleChecklist: (actionId: string, index: number) => void;
  addActionActivity: (id: string, text: string) => void;

  createExperiment: (input: { actionId?: string; businessId?: string; title: string; hypothesis: string; change: string; baseline: string; target: string; windowDays: number; owner: string; watchMetrics: string[] }) => string;
  updateExperiment: (id: string, patch: Partial<ExperimentRecord>) => void;

  addGoal: (goal: Omit<GoalRecord, "id" | "businessId" | "status">) => void;
  updateGoal: (id: string, patch: Partial<GoalRecord>) => void;

  setConnection: (id: string, status: ConnectionStatus) => void;
  setRecommendationState: (id: string, state: "open" | "dismissed" | "saved") => void;

  createWorkspace: (meta: UserWorkspaceMeta) => void;
  /** Store the signed-up/in person's identity AND persist it (survives reload). */
  setAuthUser: (name: string, email: string) => void;
  addManualEntry: (entry: ManualEntry) => void;
  deleteManualEntry: (id: string) => void;
  setCheckupFacts: (facts: BusinessFacts, transcript: TranscriptTurn[]) => void;
  setCheckupJourney: (journey: string[]) => void;
  setCheckupDiagnosis: (diagnosis: DiagnosisContent) => void;
  setImprovedDiagnosis: (improved: ImprovedDiagnosis) => void;
  updateSettings: (patch: Partial<BizzSettings>) => void;
  updateProfile: (patch: Partial<BizzUser>) => void;
  sendInvite: (email: string, role: string) => void;
  hydrate: () => void;
}

const DEFAULT_NOTIFICATIONS: NotificationItem[] = [];

const SETTINGS_KEY = "bizzgrowth-settings-v1";
const CHECKUP_KEY = "bizzgrowth-checkup-v1";
const MANUAL_KEY = "bizzgrowth-manual-v1";

function persistManual(entries: ManualEntry[]) {
  try {
    localStorage.setItem(MANUAL_KEY, JSON.stringify(entries));
  } catch {}
}

function persistCheckup(state: { userWorkspace: UserWorkspaceMeta | null; checkup: CheckupState }) {
  try {
    localStorage.setItem(
      CHECKUP_KEY,
      JSON.stringify({ userWorkspace: state.userWorkspace, checkup: state.checkup }),
    );
  } catch {}
}

export const useBizz = create<BizzState>((set, get) => ({
  hydrated: false,
  businessId: "swifthaul",
  userWorkspace: null,
  dateRange: "this-month",
  user: { name: "Amara Okafor", email: "amara@swifthaul.ng", jobRole: "Founder / CEO" },
  notifications: DEFAULT_NOTIFICATIONS,
  actions: [],
  experiments: [],
  goals: [],
  manualEntries: [],
  connections: { "meta-ads": "connected", "google-ads": "connected", shopify: "error", manual: "connected" },
  ownConnections: {},
  recommendationState: {},
  checkup: EMPTY_CHECKUP,
  settings: {
    businessName: "SwiftHaul Logistics",
    currency: "₦ (Nigerian Naira)",
    timezone: "Africa/Lagos (WAT)",
    reportingPeriod: "Calendar month",
    comparisonPeriod: "Previous period",
    notifPrefs: {
      "Critical alerts": { inApp: true, email: true },
      Recommendations: { inApp: true, email: false },
      Assignments: { inApp: true, email: true },
      "Weekly brief": { inApp: true, email: true },
      "Monthly review": { inApp: true, email: false },
      "Integration issues": { inApp: true, email: true },
    },
    plan: "Private Beta",
  },
  pendingInvite: {
    business: "SwiftHaul Logistics",
    inviter: "Amara Okafor (Owner)",
    role: "Member",
    expires: "in 6 days",
  },

  navigate: (path) => navigate(path),
  setBusiness: (id) => {
    set({ businessId: id });
    const current = get();
    if (id === "korahome") current.settings.businessName = "KoraHome Store";
    else if (id === "swifthaul") current.settings.businessName = "SwiftHaul Logistics";
    else if (current.userWorkspace) current.settings.businessName = current.userWorkspace.name;
    toast.success("Workspace switched", { description: id === "korahome" ? "KoraHome Store — ecommerce" : id === "swifthaul" ? "SwiftHaul Logistics — service" : current.settings.businessName });
  },
  setDateRange: (range) => set({ dateRange: range }),
  markRead: (id) => set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
  markAllRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),

  startAction: ({ recommendationId, title, owner, due, asExperiment, notes }) => {
    const id = `act-${Math.random().toString(36).slice(2, 8)}`;
    const action: ActionRecord = {
      id,
      businessId: get().businessId,
      recommendationId,
      title,
      owner,
      due,
      started: "2026-10-01",
      status: "in-progress",
      checklist: [],
      notes: notes ?? "",
      metric: "",
      activity: [{ date: "2026-10-01", text: "Action started" }],
    };
    set((s) => ({ actions: [action, ...s.actions] }));
    toast.success("Action started", { description: asExperiment ? "Action created — next step: set up the experiment." : "You can track it in the Action Centre." });
    return id;
  },
  updateAction: (id, patch) => set((s) => ({ actions: s.actions.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),
  toggleChecklist: (actionId, index) =>
    set((s) => ({
      actions: s.actions.map((a) => {
        if (a.id !== actionId) return a;
        const checklist: ChecklistItem[] = a.checklist.map((c, i) => (i === index ? { ...c, done: !c.done } : c));
        return { ...a, checklist };
      }),
    })),
  addActionActivity: (id, text) =>
    set((s) => ({
      actions: s.actions.map((a) => (a.id === id ? { ...a, activity: [{ date: "2026-10-01", text }, ...a.activity] } : a)),
    })),

  createExperiment: ({ actionId, businessId, title, hypothesis, change, baseline, target, windowDays, owner, watchMetrics }) => {
    const id = `exp-${Math.random().toString(36).slice(2, 8)}`;
    const exp: ExperimentRecord = {
      id,
      businessId: businessId ?? get().businessId,
      actionId,
      title,
      hypothesis,
      change,
      baseline,
      target,
      current: baseline,
      baselineValue: parseFloat(baseline.replace(/[^0-9.]/g, "")) || 0,
      currentValue: parseFloat(baseline.replace(/[^0-9.]/g, "")) || 0,
      targetValue: parseFloat(target.replace(/[^0-9.]/g, "")) || 0,
      windowDays,
      startedAt: "2026-10-01",
      daysRemaining: windowDays,
      otherChanges: ["No other changes detected yet"],
      watchMetrics,
      owner,
      status: "measuring",
    };
    set((s) => ({ experiments: [exp, ...s.experiments] }));
    toast.success("Experiment created", { description: `${windowDays}-day measurement window opened.` });
    return id;
  },
  updateExperiment: (id, patch) => set((s) => ({ experiments: s.experiments.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),

  addGoal: (goal) => {
    const id = `goal-${Math.random().toString(36).slice(2, 8)}`;
    set((s) => ({ goals: [{ ...goal, id, businessId: s.businessId, status: "active" }, ...s.goals] }));
    toast.success("Goal created");
  },
  updateGoal: (id, patch) => set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),

  setConnection: (id, status) =>
    set((s) =>
      s.businessId === "user-workspace"
        ? { ownConnections: { ...s.ownConnections, [id]: status } }
        : { connections: { ...s.connections, [id]: status } },
    ),
  setRecommendationState: (id, state) => {
    set((s) => ({ recommendationState: { ...s.recommendationState, [id]: state } }));
    if (state === "dismissed") toast("Recommendation dismissed", { description: "You can find it again in the Action Centre → Dismissed." });
    if (state === "saved") toast.success("Saved for later");
  },

  createWorkspace: (meta) => {
    // The workspace is the user's own — settings must reflect it immediately,
    // never the sample business name.
    const settings = { ...get().settings, businessName: meta.name };
    set({ userWorkspace: meta, businessId: "user-workspace", checkup: { ...EMPTY_CHECKUP }, settings });
    persistCheckup({ userWorkspace: meta, checkup: EMPTY_CHECKUP });
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ settings, user: get().user }));
    } catch {}
    toast.success("Workspace created", { description: `${meta.name} is ready for its private checkup.` });
  },
  setAuthUser: (name, email) => {
    const user = { ...get().user, name, email };
    set({ user });
    try {
      const { settings } = get();
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ settings, user }));
    } catch {}
  },
  addManualEntry: (entry) => {
    set((s) => {
      // Re-saving a month is a correction — replace the earlier entry for the
      // same period instead of stacking duplicates.
      const manualEntries = [entry, ...s.manualEntries.filter((e) => !(e.businessId === entry.businessId && e.period === entry.period))];
      persistManual(manualEntries);
      return { manualEntries };
    });
  },
  deleteManualEntry: (id) => {
    set((s) => {
      const manualEntries = s.manualEntries.filter((e) => e.id !== id);
      persistManual(manualEntries);
      return { manualEntries };
    });
  },
  setCheckupFacts: (facts, transcript) => {
    const s = get();
    // The conversation can reveal the real business type — keep the workspace in sync.
    const userWorkspace = s.userWorkspace && s.userWorkspace.type !== facts.businessType
      ? { ...s.userWorkspace, type: facts.businessType }
      : s.userWorkspace;
    const checkup: CheckupState = { transcript, facts, diagnosis: s.checkup.diagnosis, improved: null };
    set({ checkup, userWorkspace });
    persistCheckup({ userWorkspace, checkup });
  },
  setCheckupJourney: (journey) => {
    const s = get();
    if (!s.checkup.facts) return;
    const checkup: CheckupState = { ...s.checkup, facts: { ...s.checkup.facts, journey } };
    set({ checkup });
    persistCheckup({ userWorkspace: s.userWorkspace, checkup });
  },
  setCheckupDiagnosis: (diagnosis) => {
    const s = get();
    const checkup: CheckupState = { ...s.checkup, diagnosis };
    set({ checkup });
    persistCheckup({ userWorkspace: s.userWorkspace, checkup });
  },
  setImprovedDiagnosis: (improved) => {
    const s = get();
    const checkup: CheckupState = { ...s.checkup, improved };
    set({ checkup });
    persistCheckup({ userWorkspace: s.userWorkspace, checkup });
  },
  updateSettings: (patch) => {
    set((s) => ({ settings: { ...s.settings, ...patch } }));
    try {
      const { settings, user } = get();
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ settings, user }));
    } catch {}
    toast.success("Settings saved");
  },
  updateProfile: (patch) => {
    set((s) => ({ user: { ...s.user, ...patch } }));
    try {
      const { settings, user } = get();
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ settings, user }));
    } catch {}
    toast.success("Profile updated");
  },
  sendInvite: (email, role) => {
    toast.success("Invitation sent", { description: `${email} will join as ${role}.` });
  },
  hydrate: () => {
    if (get().hydrated) return;
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        set({ settings: { ...get().settings, ...parsed.settings }, user: { ...get().user, ...parsed.user } });
      }
    } catch {}
    try {
      const raw = localStorage.getItem(CHECKUP_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { userWorkspace?: UserWorkspaceMeta | null; checkup?: CheckupState };
        if (parsed.checkup && parsed.checkup.facts) {
          const userWorkspace = parsed.userWorkspace ?? get().userWorkspace;
          set({
            userWorkspace,
            checkup: { ...EMPTY_CHECKUP, ...parsed.checkup },
            businessId: parsed.userWorkspace ? "user-workspace" : get().businessId,
          });
          // Old sessions may still carry the sample business name in settings —
          // the owner's workspace name always wins.
          if (parsed.userWorkspace && get().settings.businessName !== parsed.userWorkspace.name) {
            const settings = { ...get().settings, businessName: parsed.userWorkspace.name };
            set({ settings });
            try {
              localStorage.setItem(SETTINGS_KEY, JSON.stringify({ settings, user: get().user }));
            } catch {}
          }
        }
      }
    } catch {}
    try {
      const rawManual = localStorage.getItem(MANUAL_KEY);
      if (rawManual) {
        const parsedManual = JSON.parse(rawManual) as ManualEntry[];
        if (Array.isArray(parsedManual)) set({ manualEntries: parsedManual });
      }
    } catch {}
    set({ hydrated: true });
  },
}));

/** Merge static demo records with user-created ones for a business. */
export function useActionsFor(businessId: string): ActionRecord[] {
  return useBizz((s) => s.actions.filter((a) => a.businessId === businessId));
}
export function useExperimentsFor(businessId: string): ExperimentRecord[] {
  return useBizz((s) => s.experiments.filter((e) => e.businessId === businessId));
}
export function useGoalsFor(businessId: string): GoalRecord[] {
  return useBizz((s) => s.goals.filter((g) => g.businessId === businessId));
}

import { NOTIFICATIONS } from "./data/operations";

/** Header notifications for the current business. Sample items NEVER leak into a user's own workspace. */
export function useBizzNotifications(businessId: string, _all?: NotificationItem[]): { items: NotificationItem[]; unread: number } {
  const storeItems = useBizz((s) => s.notifications);
  const items = businessId === "user-workspace" ? storeItems : storeItems.length ? storeItems : NOTIFICATIONS;
  const scoped = items.filter((n) => n.businessId === businessId);
  return { items: scoped, unread: scoped.filter((n) => !n.read).length };
}

/** Connection statuses for the ACTIVE workspace — sample presets never leak into a real owner's workspace. */
export function useConnectionsFor(businessId: string): Record<string, ConnectionStatus> {
  return useBizz((s) => (businessId === "user-workspace" ? s.ownConnections : s.connections));
}
