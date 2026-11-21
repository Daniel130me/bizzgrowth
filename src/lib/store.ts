"use client";
// Central prototype state. Everything is client-side; persistence is
// session-level (in-memory) with localStorage backup for settings where useful.

import { useMemo } from "react";
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
  TimelineEvent,
} from "./types";
import type { UserWorkspaceMeta, WorkspaceId } from "./data/businesses";
import type { Brief, Insight } from "./types";
import type { BusinessFacts, DiagnosisContent, ImprovedDiagnosis, TranscriptTurn } from "./checkup";
import {
  DEFAULT_COACH_PREFS,
  addDays,
  countAnswerText,
  countValue,
  formatCount,
  friendlyDate,
  nextCheckIn,
  numbersVerdict,
  scheduleCheckIns,
  type CheckInAnswer,
  type CheckInRecord,
  type CheckInResult,
  type CheckInVerdict,
  type CoachPrefs,
  type NextStep,
} from "./coach";
import { computeStake, currencySymbol, shorten, tidyOwnerText } from "./checkup-math";
import {
  isOpen,
  outcomeFor,
  planOrder,
  similarChallenge,
  stageOfText,
  type Challenge,
  type ChallengeAngle,
  type ChallengeDetails,
  type ChallengeLesson,
  type ChallengePlan,
  type ChallengeReading,
  type ChallengeSource,
  type ChallengeStage,
} from "./challenges";

/** A draft the owner copied or opened — the check-in can ask how it went. */
export interface DraftUse {
  at: string;
  label: string;
  what: "copied" | "whatsapp" | "email";
}

/** A next step the owner accepted, with its check-ins. One active step at a time. */
export interface CoachStep {
  id: string;
  workspaceId: string;
  step: NextStep;
  acceptedAt: string;
  /** "paused": the owner switched focus to another challenge — picked up again when they switch back. */
  status: "active" | "done" | "stopped" | "paused";
  /** The challenge this step works on. */
  challengeId?: string;
  pausedAt?: string;
  /** Starting number, in the owner's words (experiments). */
  baseline?: string;
  actionId: string;
  experimentId?: string;
  checkIns: CheckInRecord[];
  draftUses: DraftUse[];
  result?: { verdict: CheckInVerdict; summary: string; after?: string; at: string };
}

export interface CoachState {
  steps: CoachStep[];
  prefs: CoachPrefs;
  /** What check-ins taught us, newest last — fed back into every AI feature. */
  learnings: { at: string; text: string }[];
}

const EMPTY_COACH: CoachState = { steps: [], prefs: DEFAULT_COACH_PREFS, learnings: [] };

const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
const todayIso = () => new Date().toISOString().slice(0, 10);

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

/** A question the owner actually asked Nellovia (the AI consultant), with a short answer summary.
 *  Real history only — nothing here is seeded or canned. */
export interface AskLogEntry {
  id: string;
  workspaceId: string;
  question: string;
  summary: string;
  period: string;
  at: string;
}

/** Prefill for the marketplace "Post a task" form — set when the intelligence
 *  recommends work the owner may not execute themselves. */
export interface TaskPrefill {
  title: string;
  description: string;
  category?: string;
  skills?: string[];
  source: "recommendation" | "manual";
  sourceRef?: string;
  sourceTitle?: string;
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
  /** AI-generated insights for the owner's own workspace (from checkup facts). */
  aiInsights: Insight[];
  /** AI-generated first brief for the owner's own workspace. */
  aiBrief: Brief | null;
  /** Real Ask conversations (per workspace), persisted. Never seeded. */
  askLog: AskLogEntry[];
  /** Marketplace task prefill carried from a recommendation into the post-task form. */
  taskPrefill: TaskPrefill | null;
  /** Business changes and coaching events the owner recorded (merged with sample events on the timeline). */
  timelineEvents: TimelineEvent[];
  /** The coaching loop: accepted next steps, their check-ins, and what they taught us. */
  coach: CoachState;
  /** The owner's business challenges — one worked on at a time (their own workspace only). */
  challenges: Challenge[];
  /** When the app suggested which challenge comes first (at the first diagnosis). null = not yet. */
  challengePlanAt: string | null;

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

  /**
   * Start a next step: creates the tracked action (and the experiment), schedules check-ins. Returns the step id.
   * With a challengeId that isn't being worked on, that challenge becomes the focus first (the current step is paused).
   */
  acceptNextStep: (step: NextStep, opts?: { baseline?: string; asRecommendation?: boolean; challengeId?: string }) => string;
  stopCoachStep: (id: string) => void;
  /** Note that the owner copied or opened a draft — the next check-in asks how it went. */
  logDraftUse: (label: string, what: DraftUse["what"]) => void;
  completeCheckIn: (input: { stepId: string; checkInId: string; answers: CheckInAnswer[]; result: CheckInResult }) => void;
  setCoachPrefs: (prefs: CoachPrefs) => void;
  /** Keep a step going for more days (outcome "Run longer"). */
  extendCoachStep: (id: string, days: number) => void;
  /** Testing helper: make the next check-in due right now. */
  makeCheckInDue: (stepId?: string) => void;
  addTimelineEvent: (event: Omit<TimelineEvent, "id" | "businessId"> & { businessId?: string }) => void;

  /** Add a challenge (reported, noticed in Ask or a check-in). It waits "up next" until the owner works on it. Returns its id. */
  addChallenge: (input: NewChallengeInput) => string;
  updateChallenge: (id: string, patch: Partial<Challenge>) => void;
  /** Store a challenge's own diagnosis (the one being worked on keeps it in the checkup). */
  setChallengeDiagnosis: (id: string, diagnosis: DiagnosisContent) => void;
  /** Work on this challenge now: the current step is paused, and this one's paused step picks up again. */
  focusChallenge: (id: string) => void;
  /** The first diagnosis chose which challenge comes first, and the order of the rest. */
  applyChallengePlan: (plan: ChallengePlan, diagnosis: DiagnosisContent) => void;
  /** The OWNER confirms it's solved — the outcome (before/after, what was tried, how long) is recorded. */
  markChallengeSolved: (id: string, note?: string) => void;
  setChallengeStatus: (id: string, status: "stopped" | "no-longer" | "up-next", lesson?: string) => void;
  /** "Not yet" to the solved suggestion — it is offered again only after a newer check-in. */
  declineSolved: (id: string) => void;
  /** The same problem from another angle — added to an existing challenge instead of tracked twice. */
  addChallengeAngle: (targetId: string, angle: Omit<ChallengeAngle, "at">) => void;
  linkChallenges: (a: string, b: string) => void;
  moveChallenge: (id: string, dir: -1 | 1) => void;

  addGoal: (goal: Omit<GoalRecord, "id" | "businessId" | "status">) => void;
  updateGoal: (id: string, patch: Partial<GoalRecord>) => void;

  setConnection: (id: string, status: ConnectionStatus) => void;
  setRecommendationState: (id: string, state: "open" | "dismissed" | "saved") => void;

  createWorkspace: (meta: UserWorkspaceMeta) => void;
  /** Store the signed-up/in person's identity AND persist it (survives reload). */
  setAuthUser: (name: string, email: string) => void;
  /** Server session (from /api/auth/me): the real User id and Workspace id in Neon. */
  authUserId: string | null;
  authWorkspaceId: string | null;
  /** Server-authorized access to platform administration. */
  authIsPlatformAdmin: boolean;
  /** True once /api/auth/me has answered for this page load. */
  authChecked: boolean;
  setSession: (u: { id: string; name: string; email: string; jobRole?: string | null; workspaceId?: string | null; isPlatformAdmin?: boolean } | null) => void;
  addManualEntry: (entry: ManualEntry) => void;
  deleteManualEntry: (id: string) => void;
  setCheckupFacts: (facts: BusinessFacts, transcript: TranscriptTurn[]) => void;
  setCheckupJourney: (journey: string[]) => void;
  /** Put back a checkup finished earlier (saved chat), keeping its diagnosis. No-op if facts are already here. */
  restoreCheckup: (facts: BusinessFacts, transcript: TranscriptTurn[], diagnosis?: DiagnosisContent | null) => void;
  /** Owner corrections to the extracted facts — clears the now-stale diagnosis so it regenerates. */
  updateCheckupFacts: (facts: BusinessFacts) => void;
  /** Add answers to the facts and swap in an updated diagnosis in one step (no regeneration). */
  patchCheckupFacts: (patch: Partial<BusinessFacts>, diagnosis?: DiagnosisContent) => void;
  setCheckupDiagnosis: (diagnosis: DiagnosisContent) => void;
  setImprovedDiagnosis: (improved: ImprovedDiagnosis) => void;
  setAiInsights: (items: Insight[]) => void;
  setAiBrief: (brief: Brief) => void;
  recordAsk: (entry: Omit<AskLogEntry, "id" | "at">) => void;
  clearAskLog: (workspaceId: string) => void;
  setTaskPrefill: (prefill: TaskPrefill | null) => void;
  updateSettings: (patch: Partial<BizzSettings>) => void;
  updateProfile: (patch: Partial<BizzUser>) => void;
  sendInvite: (email: string, role: string) => void;
  hydrate: () => void;
}

const DEFAULT_NOTIFICATIONS: NotificationItem[] = [];

// Storage keys keep the old "bizzgrowth-" prefix on purpose: renaming one would hide
// the owner's saved data (the product itself is now called Nellovia).
const SETTINGS_KEY = "bizzgrowth-settings-v1";
const CHECKUP_KEY = "bizzgrowth-checkup-v1";
const MANUAL_KEY = "bizzgrowth-manual-v1";
const AI_KEY = "bizzgrowth-ai-v1";
const ASKLOG_KEY = "bizzgrowth-asklog-v1";
const COACH_KEY = "bizzgrowth-coach-v1";

function persistCoach(state: { actions: ActionRecord[]; experiments: ExperimentRecord[]; timelineEvents: TimelineEvent[]; coach: CoachState }) {
  try {
    localStorage.setItem(
      COACH_KEY,
      JSON.stringify({ actions: state.actions, experiments: state.experiments, timelineEvents: state.timelineEvents, coach: state.coach }),
    );
  } catch {}
}

/** In-app reminders for check-ins that are due (recomputed on load; never duplicated). */
function dueCheckInNotifications(coach: CoachState, existing: NotificationItem[]): NotificationItem[] {
  const out: NotificationItem[] = [];
  for (const st of coach.steps) {
    if (st.status !== "active") continue;
    const n = nextCheckIn(st.checkIns);
    if (!n || !n.due) continue;
    const id = `ntf-${n.checkIn.id}`;
    if (existing.some((e) => e.id === id)) continue;
    out.push({
      id,
      businessId: st.workspaceId,
      category: "experiment",
      title: "Time for a 30-second check-in",
      body: `How's it going with “${st.step.title}”? A few taps help us read what's working.`,
      time: "Now",
      read: false,
      targetRoute: `check-in/${st.id}`,
    });
  }
  return out;
}

function persistAskLog(entries: AskLogEntry[]) {
  try {
    localStorage.setItem(ASKLOG_KEY, JSON.stringify(entries));
  } catch {}
}

function persistManual(entries: ManualEntry[]) {
  try {
    localStorage.setItem(MANUAL_KEY, JSON.stringify(entries));
  } catch {}
}

function persistAi(state: { aiInsights: Insight[]; aiBrief: Brief | null }) {
  try {
    localStorage.setItem(AI_KEY, JSON.stringify({ aiInsights: state.aiInsights, aiBrief: state.aiBrief }));
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

/* ------------------------------------------------------------------ */
/* Challenges — what's holding the business back, as a list            */
/* ------------------------------------------------------------------ */
//
// The checkup always describes the challenge being worked on: its
// "where it feels stuck" and its diagnosis live in checkup.facts /
// checkup.diagnosis, so every existing screen (diagnosis, Ask, check-ins,
// business understanding) keeps working unchanged. Every other challenge keeps
// its own diagnosis "parked" on itself until it becomes the focus.

// Same old "bizzgrowth-" prefix, kept on purpose (see the keys above).
const CHALLENGES_KEY = "bizzgrowth-challenges-v1";
const OWN = "user-workspace";

export interface NewChallengeInput {
  title: string;
  source: ChallengeSource;
  stage?: ChallengeStage;
  details?: ChallengeDetails;
  transcript?: TranscriptTurn[];
  chatDone?: boolean;
  linkedTo?: string[];
}

function persistChallenges(state: { challenges: Challenge[]; challengePlanAt: string | null }) {
  try {
    localStorage.setItem(CHALLENGES_KEY, JSON.stringify({ v: 1, items: state.challenges, planAt: state.challengePlanAt }));
  } catch {}
}

function focusOf(list: Challenge[]): Challenge | undefined {
  return list.find((c) => c.workspaceId === OWN && c.status === "working");
}

function makeChallenge(input: NewChallengeInput & { id?: string; status?: Challenge["status"]; order?: number; reportedAt?: string }, facts?: BusinessFacts | null): Challenge {
  const title = shorten(tidyOwnerText(input.title.trim()), 160) || "What's holding growth back";
  return {
    id: input.id ?? uid("ch"),
    workspaceId: OWN,
    title,
    stage: input.stage ?? stageOfText(`${title} ${input.details?.what ?? ""}`, facts) ?? "found",
    status: input.status ?? "up-next",
    source: input.source,
    reportedAt: input.reportedAt ?? new Date().toISOString(),
    details: input.details,
    transcript: input.transcript,
    chatDone: input.chatDone,
    parked: null,
    stepIds: [],
    readings: [],
    lessons: [],
    angles: [],
    linkedTo: input.linkedTo ?? [],
    order: input.order ?? 99,
  };
}

/** Number the ones waiting 1, 2, 3… in their current order (the one being worked on is 0). */
function renumber(list: Challenge[]): Challenge[] {
  const waiting = list.filter((c) => c.status === "up-next").sort((a, b) => a.order - b.order);
  return list.map((c) => (c.status === "working" ? { ...c, order: 0 } : c.status === "up-next" ? { ...c, order: waiting.indexOf(c) + 1 } : c));
}

/** The owner's counts so far for some steps: their starting numbers and the counts from check-ins. */
function readingsFromSteps(steps: CoachStep[]): ChallengeReading[] {
  const out: ChallengeReading[] = [];
  for (const st of steps) {
    const unit = st.step.unit ?? "in10";
    if (st.baseline) out.push({ at: st.acceptedAt, value: st.baseline, unit, measure: st.step.measure, stepId: st.id, kind: "start" });
    for (const ci of st.checkIns) {
      if (!ci.doneAt) continue;
      const raw = ci.after ?? ci.answers?.find((a) => a.id === "count")?.answer;
      const value = raw ? (ci.after ? ci.after : countAnswerText(raw, unit)) : null;
      if (value) out.push({ at: ci.doneAt, value, unit, measure: st.step.measure, stepId: st.id, kind: "check-in" });
    }
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

const NOT_A_LESSON = /early days|keep going|no count yet|simple tally|didn'?t fit|too early|easier step/i;

/**
 * Challenges for a checkup that predates them: the problem from the checkup
 * becomes "Working on now", with every step tried so far, its counts and what
 * check-ins taught. Ids are fixed, so deriving again gives the same list —
 * nothing is written until the owner changes something.
 */
function deriveChallenges(facts: BusinessFacts | null, diagnosis: DiagnosisContent | null, coach: CoachState): Challenge[] {
  if (!facts) return [];
  const steps = coach.steps.filter((x) => x.workspaceId === OWN).sort((a, b) => a.acceptedAt.localeCompare(b.acceptedAt));
  const reportedAt = steps[0]?.acceptedAt ?? new Date().toISOString();
  const title = facts.bottleneck?.trim() ? facts.bottleneck : "What's holding growth back";
  const main = makeChallenge(
    {
      id: "ch-main",
      title,
      source: "onboarding",
      status: "working",
      order: 0,
      reportedAt,
      stage: diagnosis?.focusStage ?? stageOfText(title, facts) ?? "convert",
      details: { what: facts.bottleneck, theory: facts.ownerTheory },
      chatDone: true,
    },
    facts,
  );
  main.main = true;
  main.focusedAt = reportedAt;
  // Without a step there's no date to go on — none is shown rather than a made-up one.
  if (!steps.length) main.reportedAtUnknown = true;
  main.stepIds = steps.map((x) => x.id);
  main.readings = readingsFromSteps(steps);
  main.lessons = coach.learnings
    .filter((l) => !NOT_A_LESSON.test(l.text))
    .map((l) => ({ at: l.at, text: l.text, stepId: steps.find((x) => l.text.startsWith(`${x.step.title}:`))?.id }));
  const extras = (facts.otherChallenges ?? []).map((t, i) => ({
    ...makeChallenge({ id: `ch-extra-${i + 1}`, title: t, source: "onboarding", status: "up-next", order: i + 1, reportedAt }, facts),
    reportedAtUnknown: main.reportedAtUnknown,
  }));
  return [main, ...extras];
}

const STUCK_ROW = /stuck|bottleneck|hardest/i;
const THEORY_ROW = /think is causing|your view|your theory/i;

/** The checkup's "where it feels stuck" (and their view of the cause) set to this challenge. */
function withFocusFacts(facts: BusinessFacts, c: Challenge): BusinessFacts {
  const theory = c.details?.theory;
  const source = c.source === "onboarding" ? "Your checkup conversation" : "Your challenges";
  const stuck = { section: "Where growth feels stuck", value: c.title, provenance: "user-supplied" as const, source };
  const view = theory ? { section: "What you think is causing it", value: theory, provenance: "user-supplied" as const, source } : null;
  const rows = facts.facts.flatMap((f) => (STUCK_ROW.test(f.section) ? [stuck] : THEORY_ROW.test(f.section) ? (view ? [view] : []) : [f]));
  if (!rows.some((f) => STUCK_ROW.test(f.section))) rows.push(stuck);
  if (view && !rows.some((f) => THEORY_ROW.test(f.section))) rows.splice(rows.findIndex((f) => STUCK_ROW.test(f.section)) + 1, 0, view);
  return { ...facts, bottleneck: c.title, ownerTheory: theory, facts: rows };
}

/** Pause the steps being tried (focus moves elsewhere). */
function pauseActive(steps: CoachStep[], now: string): { steps: CoachStep[]; paused: CoachStep[] } {
  const paused: CoachStep[] = [];
  const next = steps.map((st) => {
    if (st.workspaceId !== OWN || st.status !== "active") return st;
    paused.push(st);
    return { ...st, status: "paused" as const, pausedAt: now };
  });
  return { steps: next, paused };
}

/** Pick a paused step up again: its remaining check-ins move on by the time it was paused. */
function resumeStep(st: CoachStep, now: string): CoachStep {
  const gap = st.pausedAt ? Math.max(0, new Date(now).getTime() - new Date(st.pausedAt).getTime()) : 0;
  return {
    ...st,
    status: "active",
    pausedAt: undefined,
    checkIns: st.checkIns.map((c) => (c.doneAt ? c : { ...c, dueAt: new Date(new Date(c.dueAt).getTime() + gap).toISOString() })),
  };
}

/** A saved challenge with every list present (older or hand-edited records stay readable). */
function normalizeChallenge(c: Challenge): Challenge {
  return {
    ...c,
    workspaceId: c.workspaceId ?? OWN,
    stepIds: Array.isArray(c.stepIds) ? c.stepIds : [],
    readings: Array.isArray(c.readings) ? c.readings : [],
    lessons: Array.isArray(c.lessons) ? c.lessons : [],
    angles: Array.isArray(c.angles) ? c.angles : [],
    linkedTo: Array.isArray(c.linkedTo) ? c.linkedTo : [],
    order: typeof c.order === "number" ? c.order : 99,
  };
}

/** The diagnosis that belongs to a challenge: the checkup's for the one being worked on, its own otherwise. */
export function challengeDiagnosis(c: Challenge, checkup: CheckupState): DiagnosisContent | null {
  return c.status === "working" ? checkup.diagnosis : c.parked?.diagnosis ?? null;
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
  aiInsights: [],
  aiBrief: null,
  askLog: [],
  taskPrefill: null,
  timelineEvents: [],
  coach: EMPTY_COACH,
  challenges: [],
  challengePlanAt: null,
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
      started: todayIso(),
      status: "in-progress",
      checklist: [],
      notes: notes ?? "",
      metric: "",
      activity: [{ date: todayIso(), text: "Action started" }],
    };
    set((s) => ({ actions: [action, ...s.actions] }));
    persistCoach(get());
    toast.success("Action started", { description: asExperiment ? "Action created — next step: set up the experiment." : "You can track it in the Action Centre." });
    return id;
  },
  updateAction: (id, patch) => {
    set((s) => ({ actions: s.actions.map((a) => (a.id === id ? { ...a, ...patch } : a)) }));
    persistCoach(get());
  },
  toggleChecklist: (actionId, index) => {
    set((s) => ({
      actions: s.actions.map((a) => {
        if (a.id !== actionId) return a;
        const checklist: ChecklistItem[] = a.checklist.map((c, i) => (i === index ? { ...c, done: !c.done } : c));
        return { ...a, checklist };
      }),
    }));
    persistCoach(get());
  },
  addActionActivity: (id, text) => {
    set((s) => ({
      actions: s.actions.map((a) => (a.id === id ? { ...a, activity: [{ date: todayIso(), text }, ...a.activity] } : a)),
    }));
    persistCoach(get());
  },

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
      startedAt: new Date().toISOString(),
      daysRemaining: windowDays,
      otherChanges: ["No other changes detected yet"],
      watchMetrics,
      owner,
      status: "measuring",
    };
    set((s) => ({ experiments: [exp, ...s.experiments] }));
    persistCoach(get());
    toast.success("Experiment created", { description: `${windowDays}-day measurement window opened.` });
    return id;
  },
  updateExperiment: (id, patch) => {
    set((s) => ({ experiments: s.experiments.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
    persistCoach(get());
  },

  acceptNextStep: (step, opts = {}) => {
    // A step for a challenge that isn't being worked on makes it the focus first (the current step is paused).
    if (opts.challengeId && get().businessId === OWN && focusOf(get().challenges)?.id !== opts.challengeId) get().focusChallenge(opts.challengeId);
    const s = get();
    const focus = s.businessId === OWN ? focusOf(s.challenges) : undefined;
    const now = new Date().toISOString();
    const id = uid("coach");
    const asExperiment = step.kind === "experiment" && !opts.asRecommendation;
    const effective: NextStep = asExperiment ? step : { ...step, kind: "recommendation" };
    const actionId = uid("act");
    const baseline = asExperiment ? opts.baseline : undefined;

    const action: ActionRecord = {
      id: actionId,
      businessId: s.businessId,
      title: step.title,
      owner: s.user.name,
      due: addDays(now, step.days).slice(0, 10),
      started: now.slice(0, 10),
      status: asExperiment ? "measuring" : "in-progress",
      checklist: step.how.map((label) => ({ label, done: false })),
      notes: step.why,
      metric: step.measure ?? "",
      activity: [
        {
          date: now.slice(0, 10),
          text: asExperiment ? `Experiment started — starting point: ${baseline ?? "not recorded"}` : "Started from your diagnosis",
        },
      ],
      coachStepId: id,
    };

    let experiment: ExperimentRecord | null = null;
    if (asExperiment) {
      const unit = step.unit ?? "in10";
      const b = countValue(baseline, unit) ?? 0;
      const target = unit === "in10" ? Math.min(10, b + 1) : b === 0 ? 2 : Math.ceil(b * 1.5);
      experiment = {
        id: uid("exp"),
        businessId: s.businessId,
        actionId,
        title: step.title,
        hypothesis: step.why,
        change: step.how.join(" · "),
        baseline: baseline ?? "Not recorded",
        target: `${formatCount(target, unit)} (hoped for)`,
        current: baseline ?? "Not counted yet",
        baselineValue: b,
        currentValue: b,
        targetValue: target,
        windowDays: step.days,
        startedAt: now,
        daysRemaining: step.days,
        otherChanges: ["Nothing reported yet — your check-in will ask"],
        watchMetrics: step.measure ? [step.measure] : [],
        owner: s.user.name,
        status: "running",
        unit,
        coachStepId: id,
      };
    }

    const coachStep: CoachStep = {
      id,
      workspaceId: s.businessId,
      step: effective,
      acceptedAt: now,
      status: "active",
      challengeId: focus?.id,
      baseline,
      actionId,
      experimentId: experiment?.id,
      checkIns: scheduleCheckIns(now, step.days, s.coach.prefs, id),
      draftUses: [],
    };
    // One step at a time: an earlier active step in this workspace is set aside
    // (and so is a paused one for this same challenge — this step replaces it).
    const steps = [
      coachStep,
      ...s.coach.steps.map((x) =>
        x.workspaceId === s.businessId && (x.status === "active" || (x.status === "paused" && focus && x.challengeId === focus.id))
          ? { ...x, status: "stopped" as const }
          : x,
      ),
    ];
    // The challenge keeps the step, and the starting number when there is one.
    const challenges = focus
      ? s.challenges.map((c) =>
          c.id === focus.id
            ? {
                ...c,
                stepIds: [...c.stepIds, id],
                readings: baseline
                  ? [...c.readings, { at: now, value: baseline, unit: step.unit ?? "in10", measure: step.measure, stepId: id, kind: "start" as const }]
                  : c.readings,
              }
            : c,
        )
      : s.challenges;
    const event: TimelineEvent = {
      id: uid("te"),
      businessId: s.businessId,
      date: now.slice(0, 10),
      type: asExperiment ? "experiment" : "action",
      title: asExperiment ? `Experiment started: ${step.title}` : `Started: ${step.title}`,
      description: asExperiment ? `${step.days}-day test. Starting point: ${baseline ?? "not recorded"}.` : step.why,
      source: "Your next step",
      provenance: "user-supplied",
    };
    set({
      actions: [action, ...s.actions],
      experiments: experiment ? [experiment, ...s.experiments] : s.experiments,
      timelineEvents: [event, ...s.timelineEvents],
      coach: { ...s.coach, steps },
      challenges,
    });
    persistCoach(get());
    if (focus) persistChallenges(get());
    const first = coachStep.checkIns[0];
    toast.success(asExperiment ? "Experiment started" : "You're on it", {
      description: first ? `I'll check in with you ${friendlyDate(first.dueAt)} — it takes about 30 seconds.` : undefined,
    });
    return id;
  },
  stopCoachStep: (id) => {
    const s = get();
    set({ coach: { ...s.coach, steps: s.coach.steps.map((x) => (x.id === id ? { ...x, status: "stopped" as const } : x)) } });
    persistCoach(get());
  },
  logDraftUse: (label, what) => {
    const s = get();
    const active = s.coach.steps.find((x) => x.workspaceId === s.businessId && x.status === "active");
    if (!active) return;
    const use: DraftUse = { at: new Date().toISOString(), label, what };
    set({
      coach: {
        ...s.coach,
        steps: s.coach.steps.map((x) => (x.id === active.id ? { ...x, draftUses: [...x.draftUses, use].slice(-10) } : x)),
      },
    });
    persistCoach(get());
  },
  completeCheckIn: ({ stepId, checkInId, answers, result }) => {
    const s = get();
    const st = s.coach.steps.find((x) => x.id === stepId);
    if (!st) return;
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const ci = st.checkIns.find((c) => c.id === checkInId);
    const isEnd = ci?.kind === "end";
    const unit = st.step.unit ?? "in10";
    const changes = result.otherChanges.filter((c) => c.trim().length > 0);

    const steps = s.coach.steps.map((x) => {
      if (x.id !== stepId) return x;
      return {
        ...x,
        status: isEnd ? ("done" as const) : x.status,
        checkIns: x.checkIns.map((c) =>
          c.id === checkInId ? { ...c, doneAt: now, answers, summary: result.learned, verdict: result.verdict, after: result.after } : c,
        ),
        result: isEnd ? { verdict: result.verdict, summary: result.learned, after: result.after, at: now } : x.result,
      };
    });

    const experiments = s.experiments.map((e) => {
      if (e.id !== st.experimentId) return e;
      const after = result.after ?? undefined;
      const v = countValue(after, unit);
      const kept = e.otherChanges.filter((c) => !/nothing reported yet|nothing else changed/i.test(c));
      const otherChanges = [...new Set([...kept, ...changes])];
      const next: ExperimentRecord = {
        ...e,
        current: after ?? e.current,
        currentValue: v ?? e.currentValue,
        otherChanges: otherChanges.length ? otherChanges : ["Nothing else changed, as far as you know"],
      };
      if (!isEnd) return next;
      const dir = numbersVerdict(e.baseline, after, unit);
      const diff = v !== null ? Math.round((v - e.baselineValue) * 10) / 10 : null;
      return {
        ...next,
        status: "complete" as const,
        outcome: {
          primaryMetric: st.step.measure ?? "What you counted",
          before: e.baseline,
          after: after ?? "Not counted",
          delta:
            diff === null
              ? "Not enough to compare"
              : dir === "same"
                ? "About the same"
                : `${diff > 0 ? "+" : ""}${unit === "in10" ? `${diff} in 10` : diff}`,
          goodness: dir === "up" ? ("good" as const) : dir === "down" ? ("bad" as const) : ("neutral" as const),
          secondary: [],
          otherChanges: otherChanges.length ? otherChanges : ["Nothing else changed, as far as you know"],
          attribution: otherChanges.length || dir === null ? ("low" as const) : ("medium" as const),
          interpretation: result.reply,
          conclusion: result.learned,
          period: `${new Date(st.acceptedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${new Date(now).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
        },
      };
    });

    const actions = s.actions.map((a) =>
      a.id === st.actionId
        ? {
            ...a,
            status: isEnd ? ("completed" as const) : a.status,
            activity: [{ date: today, text: `${isEnd ? "Result" : "Check-in"}: ${result.learned}` }, ...a.activity],
          }
        : a,
    );

    const events: TimelineEvent[] = [
      {
        id: uid("te"),
        businessId: st.workspaceId,
        date: today,
        type: isEnd ? "outcome" : st.experimentId ? "experiment" : "action",
        title: isEnd ? `Result: ${st.step.title}` : `Check-in: ${st.step.title}`,
        description: result.learned,
        source: "Your check-in",
        provenance: "user-supplied",
      },
      ...changes.map((c) => ({
        id: uid("te"),
        businessId: st.workspaceId,
        date: today,
        type: "external" as const,
        title: c,
        description: "You told us about this in a check-in — it is kept in view when results are read.",
        source: "Your check-in",
        provenance: "user-supplied" as const,
      })),
    ];

    const learnings = [...s.coach.learnings, { at: now, text: `${st.step.title}: ${result.learned}` }].slice(-12);

    // The challenge this step works on: its counts and what it taught us are kept on it.
    const ch = st.challengeId ? s.challenges.find((c) => c.id === st.challengeId) : st.workspaceId === OWN ? focusOf(s.challenges) : undefined;
    const isFocusStep = !ch || ch.status === "working";

    // New answers sharpen the facts; the diagnosis carries the update and the next step.
    let checkup = s.checkup;
    const updateDiagnosis = (diagnosis: DiagnosisContent, facts: BusinessFacts): DiagnosisContent => {
      const moneyChanged = ["closeRate", "monthlyEnquiries"].some((k) => k in result.factUpdates);
      return {
        ...diagnosis,
        update: { at: now, note: result.learned },
        nextStep: result.nextStep && (isEnd || result.verdict === "not-tried") ? result.nextStep : diagnosis.nextStep,
        stake: moneyChanged ? computeStake(facts, currencySymbol(s.userWorkspace?.currency), diagnosis.focusStage ?? "convert") : diagnosis.stake,
      };
    };
    if (checkup.facts) {
      const facts: BusinessFacts = { ...checkup.facts, ...(result.factUpdates as Partial<BusinessFacts>) };
      const diagnosis = checkup.diagnosis && isFocusStep ? updateDiagnosis(checkup.diagnosis, facts) : checkup.diagnosis;
      checkup = { ...checkup, facts, diagnosis };
    }

    let challenges = s.challenges;
    if (ch) {
      const lessonWorthy = (isEnd && ["working", "no-change", "worse"].includes(result.verdict)) || (!isEnd && ["no-change", "worse"].includes(result.verdict));
      const reading: ChallengeReading | null = result.after ? { at: now, value: result.after, unit, measure: st.step.measure, stepId, kind: "check-in" } : null;
      const lesson: ChallengeLesson | null = lessonWorthy ? { at: now, text: result.learned, stepId } : null;
      challenges = s.challenges.map((c) => {
        if (c.id !== ch.id) return c;
        const parked = !isFocusStep && c.parked?.diagnosis && checkup.facts ? { ...c.parked, diagnosis: updateDiagnosis(c.parked.diagnosis, checkup.facts) } : c.parked;
        return {
          ...c,
          stepIds: c.stepIds.includes(stepId) ? c.stepIds : [...c.stepIds, stepId],
          readings: reading ? [...c.readings, reading] : c.readings,
          lessons: lesson ? [...c.lessons, lesson] : c.lessons,
          parked,
        };
      });
    }

    set({
      coach: { ...s.coach, steps, learnings },
      experiments,
      actions,
      timelineEvents: [...events, ...s.timelineEvents],
      checkup,
      challenges,
      notifications: s.notifications.filter((n) => n.id !== `ntf-${checkInId}`),
    });
    persistCoach(get());
    if (checkup !== s.checkup) persistCheckup({ userWorkspace: s.userWorkspace, checkup });
    if (challenges !== s.challenges) persistChallenges(get());
  },
  setCoachPrefs: (prefs) => {
    const s = get();
    const nowMs = Date.now();
    const steps = s.coach.steps.map((x) => {
      if (x.status !== "active") return x;
      const done = x.checkIns.filter((c) => c.doneAt);
      const fresh = scheduleCheckIns(x.acceptedAt, x.step.days, prefs, x.id).filter(
        (c) => new Date(c.dueAt).getTime() > nowMs || c.kind === "end",
      );
      const keep = fresh.filter((c) => !done.some((d) => d.id === c.id));
      return { ...x, checkIns: [...done, ...keep].sort((a, b) => a.dueAt.localeCompare(b.dueAt)) };
    });
    set({ coach: { ...s.coach, prefs, steps } });
    persistCoach(get());
    toast.success("Check-ins updated");
  },
  extendCoachStep: (id, days) => {
    const s = get();
    const st = s.coach.steps.find((x) => x.id === id);
    if (!st) return;
    const now = new Date().toISOString();
    const steps = s.coach.steps.map((x) =>
      x.id === id
        ? {
            ...x,
            status: "active" as const,
            result: undefined,
            step: { ...x.step, days: x.step.days + days },
            checkIns: [...x.checkIns, { id: uid(`${id}-end`), kind: "end" as const, dueAt: addDays(now, days) }],
          }
        : x,
    );
    const experiments = s.experiments.map((e) =>
      e.id === st.experimentId ? { ...e, status: "running" as const, windowDays: e.windowDays + days, outcome: undefined } : e,
    );
    const actions = s.actions.map((a) => (a.id === st.actionId ? { ...a, status: st.experimentId ? ("measuring" as const) : ("in-progress" as const) } : a));
    set({ coach: { ...s.coach, steps }, experiments, actions });
    persistCoach(get());
    toast.success(`Running for ${days} more days`, { description: `I'll check in again ${friendlyDate(addDays(now, days))}.` });
  },
  makeCheckInDue: (stepId) => {
    const s = get();
    const st = stepId
      ? s.coach.steps.find((x) => x.id === stepId)
      : s.coach.steps.find((x) => x.workspaceId === s.businessId && x.status === "active");
    if (!st) return;
    const n = nextCheckIn(st.checkIns);
    if (!n) return;
    const past = new Date(Date.now() - 60_000).toISOString();
    const steps = s.coach.steps.map((x) =>
      x.id === st.id ? { ...x, checkIns: x.checkIns.map((c) => (c.id === n.checkIn.id ? { ...c, dueAt: past } : c)) } : x,
    );
    const coach = { ...s.coach, steps };
    set({ coach, notifications: [...dueCheckInNotifications(coach, s.notifications), ...s.notifications] });
    persistCoach(get());
  },
  addTimelineEvent: (event) => {
    const s = get();
    const full: TimelineEvent = { ...event, id: uid("te"), businessId: event.businessId ?? s.businessId };
    set({ timelineEvents: [full, ...s.timelineEvents] });
    persistCoach(get());
  },

  addChallenge: (input) => {
    const s = get();
    const c = makeChallenge({ ...input, status: "up-next" }, s.checkup.facts);
    // Its place in the line, as the app would suggest it: one that blocks the
    // others goes first; things the app can't measure go last.
    const waiting = s.challenges.filter((x) => x.status === "up-next").sort((a, b) => a.order - b.order);
    const focus = focusOf(s.challenges);
    const plan = planOrder(s.checkup.facts, [...(focus ? [focus] : []), ...waiting, c], focus?.id);
    const suggested = plan?.order.findIndex((o) => o.id === c.id) ?? -1;
    const first = plan?.focusId === c.id;
    const at = first ? 0 : suggested >= 0 ? Math.min(suggested, waiting.length) : waiting.length;
    const reason = first ? plan!.whyFirst : suggested >= 0 ? plan!.order[suggested].reason : undefined;
    const challenges = renumber([...s.challenges, { ...c, order: at + 0.5, orderReason: reason }]);
    set({ challenges });
    persistChallenges(get());
    return c.id;
  },
  updateChallenge: (id, patch) => {
    const s = get();
    const before = s.challenges.find((c) => c.id === id);
    if (!before) return;
    const challenges = s.challenges.map((c) => (c.id === id ? { ...c, ...patch } : c));
    // The one being worked on describes the checkup's "where it feels stuck".
    let checkup = s.checkup;
    const after = challenges.find((c) => c.id === id)!;
    if (after.status === "working" && checkup.facts && (patch.title !== undefined || patch.details !== undefined)) {
      checkup = { ...checkup, facts: withFocusFacts(checkup.facts, after) };
    }
    set({ challenges, checkup });
    persistChallenges(get());
    if (checkup !== s.checkup) persistCheckup({ userWorkspace: s.userWorkspace, checkup });
  },
  setChallengeDiagnosis: (id, diagnosis) => {
    const s = get();
    const c = s.challenges.find((x) => x.id === id);
    if (!c) return;
    const stage = c.stage === "outside" ? c.stage : diagnosis.focusStage ?? c.stage;
    if (c.status === "working") {
      const checkup: CheckupState = { ...s.checkup, diagnosis };
      set({ checkup, challenges: s.challenges.map((x) => (x.id === id ? { ...x, stage } : x)) });
      persistCheckup({ userWorkspace: s.userWorkspace, checkup });
    } else {
      set({ challenges: s.challenges.map((x) => (x.id === id ? { ...x, stage, parked: { diagnosis, improved: null } } : x)) });
    }
    persistChallenges(get());
  },
  focusChallenge: (id) => {
    const s = get();
    const target = s.challenges.find((c) => c.id === id);
    if (!target || target.status === "working") return;
    const now = new Date().toISOString();
    const current = focusOf(s.challenges);

    // 1. The step being tried is paused; this challenge's own paused step picks up again.
    const { steps: afterPause, paused } = pauseActive(s.coach.steps, now);
    const toResume = afterPause
      .filter((x) => x.challengeId === id && x.status === "paused")
      .sort((a, b) => (b.pausedAt ?? "").localeCompare(a.pausedAt ?? ""))[0];
    const steps = afterPause.map((x) => (toResume && x.id === toResume.id ? resumeStep(x, now) : x));
    const actions = s.actions.map((a) => {
      if (paused.some((p) => p.actionId === a.id)) return { ...a, activity: [{ date: now.slice(0, 10), text: `Paused — you switched to “${shorten(target.title, 60)}”` }, ...a.activity] };
      if (toResume && toResume.actionId === a.id) return { ...a, activity: [{ date: now.slice(0, 10), text: "Picked up again" }, ...a.activity] };
      return a;
    });

    // 2. The current focus keeps its diagnosis (and the owner's view of the cause) on itself.
    const challenges = renumber(
      s.challenges.map((c) => {
        if (current && c.id === current.id) {
          return {
            ...c,
            status: "up-next" as const,
            order: 0.5, // straight after the new focus, unless the owner moves it
            parked: { diagnosis: s.checkup.diagnosis, improved: s.checkup.improved },
            details: { ...c.details, what: c.details?.what ?? s.checkup.facts?.bottleneck, theory: c.details?.theory ?? s.checkup.facts?.ownerTheory },
          };
        }
        if (c.id === id) return { ...c, status: "working" as const, order: 0, focusedAt: now, parked: null, solvedAt: undefined, stoppedAt: undefined, outcome: undefined };
        return c;
      }),
    );

    // 3. The checkup now describes the new focus; its diagnosis comes back from where it was parked.
    const next = challenges.find((c) => c.id === id)!;
    const checkup: CheckupState = s.checkup.facts
      ? { ...s.checkup, facts: withFocusFacts(s.checkup.facts, next), diagnosis: target.parked?.diagnosis ?? null, improved: target.parked?.improved ?? null }
      : s.checkup;

    const coach = { ...s.coach, steps };
    set({
      challenges,
      checkup,
      actions,
      coach,
      notifications: [
        ...dueCheckInNotifications(coach, s.notifications),
        ...s.notifications.filter((n) => !paused.some((p) => n.targetRoute === `check-in/${p.id}`)),
      ],
    });
    persistChallenges(get());
    persistCoach(get());
    persistCheckup({ userWorkspace: s.userWorkspace, checkup });
    toast.success(`Working on: ${shorten(target.title, 60)}`, {
      description: paused.length ? `“${shorten(paused[0].step.title, 60)}” is paused — pick it up again any time.` : toResume ? `Picked up “${shorten(toResume.step.title, 60)}” again.` : undefined,
    });
  },
  applyChallengePlan: (plan, diagnosis) => {
    const s = get();
    const target = s.challenges.find((c) => c.id === plan.focusId);
    if (!target) {
      get().setCheckupDiagnosis(diagnosis);
      return;
    }
    const now = new Date().toISOString();
    const current = focusOf(s.challenges);
    const { steps } = current && current.id !== target.id ? pauseActive(s.coach.steps, now) : { steps: s.coach.steps };
    const challenges = renumber(
      s.challenges.map((c) => {
        const i = plan.order.findIndex((o) => o.id === c.id);
        if (c.id === target.id) {
          return { ...c, status: "working" as const, order: 0, whyFirst: plan.whyFirst, focusedAt: c.focusedAt ?? now, parked: null, stage: c.stage === "outside" ? c.stage : diagnosis.focusStage ?? c.stage };
        }
        if (i < 0) return c;
        const wasFocus = current && c.id === current.id;
        return {
          ...c,
          status: "up-next" as const,
          order: i + 1,
          orderReason: plan.order[i].reason,
          ...(wasFocus
            ? { parked: { diagnosis: null, improved: null }, details: { ...c.details, what: c.details?.what ?? s.checkup.facts?.bottleneck, theory: c.details?.theory ?? s.checkup.facts?.ownerTheory } }
            : {}),
        };
      }),
    );
    const next = challenges.find((c) => c.id === target.id)!;
    const facts = s.checkup.facts && (!current || current.id !== target.id) ? withFocusFacts(s.checkup.facts, next) : s.checkup.facts;
    const checkup: CheckupState = { ...s.checkup, facts, diagnosis };
    set({ challenges, challengePlanAt: now, checkup, coach: { ...s.coach, steps } });
    persistChallenges(get());
    persistCheckup({ userWorkspace: s.userWorkspace, checkup });
    if (steps !== s.coach.steps) persistCoach(get());
  },
  markChallengeSolved: (id, note) => {
    const s = get();
    const c = s.challenges.find((x) => x.id === id);
    if (!c) return;
    const now = new Date().toISOString();
    const wasFocus = c.status === "working";
    const outcome = outcomeFor(c, s.coach.steps, s.experiments, now, note);
    // Its steps are finished with it (a step still running is set aside).
    const steps = s.coach.steps.map((x) => (x.challengeId === id && (x.status === "active" || x.status === "paused") ? { ...x, status: "stopped" as const } : x));
    const challenges = renumber(
      s.challenges.map((x) =>
        x.id === id
          ? { ...x, status: "solved" as const, solvedAt: now, outcome, parked: wasFocus ? { diagnosis: s.checkup.diagnosis, improved: s.checkup.improved } : x.parked }
          : x,
      ),
    );
    const event: TimelineEvent = {
      id: uid("te"),
      businessId: OWN,
      date: now.slice(0, 10),
      type: "outcome",
      title: `Solved: ${shorten(c.title, 80)}`,
      description: [
        outcome.before && outcome.after ? `${outcome.before} → ${outcome.after}${outcome.measure ? ` (${outcome.measure.replace(/\.$/, "").toLowerCase()})` : ""}.` : "",
        outcome.worked.length ? `What worked: ${outcome.worked.join("; ")}.` : "",
        outcome.took ? `Took ${outcome.took}.` : "",
        outcome.otherChanges.length ? `Also changed at the same time: ${outcome.otherChanges.join("; ")}.` : "",
      ]
        .filter(Boolean)
        .join(" ") || "You marked it solved.",
      source: "Your challenges",
      provenance: "user-supplied",
    };
    set({ challenges, coach: { ...s.coach, steps }, timelineEvents: [event, ...s.timelineEvents] });
    persistChallenges(get());
    persistCoach(get());
    toast.success("Marked as solved", { description: outcome.took ? `It took ${outcome.took}. It stays in your list, with what worked.` : "It stays in your list, with what worked." });
  },
  setChallengeStatus: (id, status, lesson) => {
    const s = get();
    const c = s.challenges.find((x) => x.id === id);
    if (!c || c.status === status) return;
    const now = new Date().toISOString();
    const wasFocus = c.status === "working";
    const parked = wasFocus ? { diagnosis: s.checkup.diagnosis, improved: s.checkup.improved } : c.parked;
    let steps = s.coach.steps;
    if (status === "up-next" && wasFocus) {
      steps = pauseActive(s.coach.steps, now).steps;
    } else if (status !== "up-next") {
      steps = s.coach.steps.map((x) => (x.challengeId === id && (x.status === "active" || x.status === "paused") ? { ...x, status: "stopped" as const } : x));
    }
    const lessons = lesson?.trim() ? [...c.lessons, { at: now, text: shorten(lesson.trim(), 240) }] : c.lessons;
    const challenges = renumber(
      s.challenges.map((x) =>
        x.id === id
          ? {
              ...x,
              status,
              parked,
              lessons,
              stoppedAt: status === "up-next" ? undefined : now,
              solvedAt: status === "up-next" ? undefined : x.solvedAt,
              order: status === "up-next" ? 98 : x.order,
            }
          : x,
      ),
    );
    set({ challenges, coach: { ...s.coach, steps } });
    persistChallenges(get());
    if (steps !== s.coach.steps) persistCoach(get());
  },
  declineSolved: (id) => {
    const s = get();
    set({ challenges: s.challenges.map((c) => (c.id === id ? { ...c, solvedDeclinedAt: new Date().toISOString() } : c)) });
    persistChallenges(get());
  },
  addChallengeAngle: (targetId, angle) => {
    const s = get();
    const at = new Date().toISOString();
    set({ challenges: s.challenges.map((c) => (c.id === targetId ? { ...c, angles: [...c.angles, { ...angle, at }] } : c)) });
    persistChallenges(get());
  },
  linkChallenges: (a, b) => {
    if (a === b) return;
    const s = get();
    set({
      challenges: s.challenges.map((c) =>
        c.id === a && !c.linkedTo.includes(b) ? { ...c, linkedTo: [...c.linkedTo, b] } : c.id === b && !c.linkedTo.includes(a) ? { ...c, linkedTo: [...c.linkedTo, a] } : c,
      ),
    });
    persistChallenges(get());
  },
  moveChallenge: (id, dir) => {
    const s = get();
    const waiting = s.challenges.filter((c) => c.status === "up-next").sort((a, b) => a.order - b.order);
    const i = waiting.findIndex((c) => c.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= waiting.length) return;
    [waiting[i], waiting[j]] = [waiting[j], waiting[i]];
    const challenges = s.challenges.map((c) => {
      const k = waiting.findIndex((w) => w.id === c.id);
      return k >= 0 ? { ...c, order: k + 1, orderReason: c.id === id ? "You moved it here." : c.orderReason } : c;
    });
    set({ challenges });
    persistChallenges(get());
  },

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
    const s = get();
    // Setup run again for the same business (e.g. after signing in on a browser that had
    // lost it): everything it already has stays; only the workspace details are updated.
    const nameKey = (n: string) => n.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (s.userWorkspace && nameKey(s.userWorkspace.name) === nameKey(meta.name)) {
      const userWorkspace = { ...s.userWorkspace, ...meta };
      set({ userWorkspace, businessId: "user-workspace", settings });
      persistCheckup({ userWorkspace, checkup: s.checkup });
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify({ settings, user: s.user }));
      } catch {}
      toast.success("Workspace ready", { description: `${meta.name} keeps everything you've done so far.` });
      return;
    }
    // A new business starts clean: the previous one's steps, check-ins, Ask history and
    // entered totals belonged to that business (sample businesses keep theirs).
    const coach: CoachState = { ...s.coach, steps: s.coach.steps.filter((x) => x.workspaceId !== OWN), learnings: [] };
    const actions = s.actions.filter((a) => a.businessId !== OWN);
    const experiments = s.experiments.filter((e) => e.businessId !== OWN);
    const timelineEvents = s.timelineEvents.filter((t) => t.businessId !== OWN);
    const askLog = s.askLog.filter((e) => e.workspaceId !== OWN);
    const manualEntries = s.manualEntries.filter((m) => m.businessId !== OWN);
    const notifications = s.notifications.filter((n) => n.businessId !== OWN);
    set({
      userWorkspace: meta,
      businessId: "user-workspace",
      checkup: { ...EMPTY_CHECKUP },
      aiInsights: [],
      aiBrief: null,
      settings,
      challenges: [],
      challengePlanAt: null,
      coach,
      actions,
      experiments,
      timelineEvents,
      askLog,
      manualEntries,
      notifications,
    });
    persistCheckup({ userWorkspace: meta, checkup: EMPTY_CHECKUP });
    persistAi({ aiInsights: [], aiBrief: null });
    persistChallenges({ challenges: [], challengePlanAt: null });
    persistCoach({ actions, experiments, timelineEvents, coach });
    persistAskLog(askLog);
    persistManual(manualEntries);
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
  authUserId: null,
  authWorkspaceId: null,
  authIsPlatformAdmin: false,
  authChecked: false,
  setSession: (u) => {
    if (!u) {
      set({ authUserId: null, authWorkspaceId: null, authIsPlatformAdmin: false, authChecked: true });
      return;
    }
    set({
      authUserId: u.id,
      authWorkspaceId: u.workspaceId ?? null,
      authIsPlatformAdmin: u.isPlatformAdmin === true,
      authChecked: true,
    });
    // Identity shown in the app comes from the server session, not localStorage.
    const cur = get().user;
    if (cur.name !== u.name || cur.email !== u.email || (u.jobRole && cur.jobRole !== u.jobRole)) {
      get().setAuthUser(u.name, u.email);
      if (u.jobRole) set({ user: { ...get().user, jobRole: u.jobRole } });
    }
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
    // A new checkup means a new diagnosis — never show the previous one for new answers.
    const now = new Date().toISOString();
    const own = s.challenges.filter((c) => c.workspaceId === OWN);
    let challenges: Challenge[];
    let steps = s.coach.steps;
    if (own.length === 0) {
      // The first checkup: its main problem is worked on first (the first diagnosis may
      // suggest another order); anything else they named waits up next.
      challenges = deriveChallenges(facts, null, { prefs: s.coach.prefs, steps: [], learnings: [] }).map((c) => ({
        ...c,
        id: uid("ch"),
        reportedAt: now,
        reportedAtUnknown: undefined,
        focusedAt: c.status === "working" ? now : undefined,
      }));
    } else {
      // A checkup done again: nothing is lost. The problem they named now is worked on;
      // the earlier focus waits up next with its diagnosis and its step paused.
      const mainTitle = facts.bottleneck?.trim() ? facts.bottleneck : "What's holding growth back";
      const prev = focusOf(own);
      const same = similarChallenge(mainTitle, own);
      let list = [...s.challenges];
      let mainId = same?.id;
      if (same) {
        list = list.map((c) => (c.id === same.id ? { ...c, title: shorten(tidyOwnerText(mainTitle), 160), details: { ...c.details, what: facts.bottleneck, theory: facts.ownerTheory ?? c.details?.theory } } : c));
      } else {
        const m = makeChallenge({ title: mainTitle, source: "onboarding", status: "up-next", details: { what: facts.bottleneck, theory: facts.ownerTheory }, chatDone: true }, facts);
        mainId = m.id;
        list.push(m);
      }
      if (prev && prev.id !== mainId) {
        steps = pauseActive(s.coach.steps, now).steps;
        list = list.map((c) => (c.id === prev.id ? { ...c, status: "up-next" as const, order: 0.5, parked: { diagnosis: s.checkup.diagnosis, improved: s.checkup.improved } } : c));
      }
      // The problem named in this checkup is now the main one.
      list = list.map((c) => (c.id === mainId ? { ...c, status: "working" as const, order: 0, focusedAt: now, parked: null, main: true } : c.main ? { ...c, main: false } : c));
      for (const t of facts.otherChallenges ?? []) {
        if (!similarChallenge(t, list)) list.push(makeChallenge({ title: t, source: "onboarding", status: "up-next" }, facts));
      }
      challenges = renumber(list);
    }
    const checkup: CheckupState = { transcript, facts, diagnosis: null, improved: null };
    set({ checkup, userWorkspace, challenges, challengePlanAt: null, coach: { ...s.coach, steps } });
    persistCheckup({ userWorkspace, checkup });
    persistChallenges(get());
    if (steps !== s.coach.steps) persistCoach(get());
  },
  patchCheckupFacts: (patch, diagnosis) => {
    const s = get();
    if (!s.checkup.facts) return;
    const checkup: CheckupState = {
      ...s.checkup,
      facts: { ...s.checkup.facts, ...patch },
      diagnosis: diagnosis ?? s.checkup.diagnosis,
    };
    set({ checkup });
    persistCheckup({ userWorkspace: s.userWorkspace, checkup });
  },
  setCheckupJourney: (journey) => {
    const s = get();
    if (!s.checkup.facts) return;
    const checkup: CheckupState = { ...s.checkup, facts: { ...s.checkup.facts, journey } };
    set({ checkup });
    persistCheckup({ userWorkspace: s.userWorkspace, checkup });
  },
  restoreCheckup: (facts, transcript, diagnosis) => {
    const s = get();
    if (s.checkup.facts) return;
    const userWorkspace = s.userWorkspace && s.userWorkspace.type !== facts.businessType
      ? { ...s.userWorkspace, type: facts.businessType }
      : s.userWorkspace;
    const checkup: CheckupState = { ...EMPTY_CHECKUP, transcript, facts, diagnosis: diagnosis ?? null };
    // A checkup put back from a saved chat: its challenges are derived the same way as
    // on load (fixed ids, nothing written until the owner changes something).
    const challenges = s.challenges.some((c) => c.workspaceId === OWN) ? s.challenges : deriveChallenges(facts, diagnosis ?? null, s.coach);
    set({ checkup, userWorkspace, challenges });
    persistCheckup({ userWorkspace, checkup });
  },
  updateCheckupFacts: (facts) => {
    const s = get();
    if (!s.checkup.facts) return;
    const userWorkspace = s.userWorkspace && s.userWorkspace.type !== facts.businessType
      ? { ...s.userWorkspace, type: facts.businessType }
      : s.userWorkspace;
    // Correcting "where it feels stuck" corrects the challenge being worked on — only its
    // diagnosis is rewritten; every other challenge keeps its own.
    let challenges = s.challenges;
    const focus = focusOf(s.challenges);
    const prev = s.checkup.facts;
    const stuckChanged = (facts.bottleneck ?? "") !== (prev.bottleneck ?? "");
    const theoryChanged = (facts.ownerTheory ?? "") !== (prev.ownerTheory ?? "");
    if (focus && (stuckChanged || theoryChanged)) {
      const title = facts.bottleneck?.trim() ? shorten(tidyOwnerText(facts.bottleneck), 160) : focus.title;
      challenges = s.challenges.map((c) =>
        c.id === focus.id
          ? {
              ...c,
              title,
              stage: stuckChanged && c.stage !== "outside" ? stageOfText(title, facts) ?? c.stage : c.stage,
              details: { ...c.details, what: stuckChanged ? facts.bottleneck : c.details?.what, theory: facts.ownerTheory },
            }
          : c,
      );
    } else if (!focus && stuckChanged && facts.bottleneck?.trim()) {
      // Nothing being worked on: a new "where it feels stuck" is a new challenge to work on.
      const m = makeChallenge({ title: facts.bottleneck, source: "reported", status: "working", order: 0, details: { what: facts.bottleneck, theory: facts.ownerTheory }, chatDone: true }, facts);
      challenges = [...s.challenges, { ...m, focusedAt: new Date().toISOString() }];
    }
    const checkup: CheckupState = { ...s.checkup, facts, diagnosis: null, improved: null };
    set({ checkup, userWorkspace, challenges });
    persistCheckup({ userWorkspace, checkup });
    if (challenges !== s.challenges) persistChallenges(get());
  },
  setCheckupDiagnosis: (diagnosis) => {
    const s = get();
    const checkup: CheckupState = { ...s.checkup, diagnosis };
    // The diagnosis belongs to the challenge being worked on — keep its place in the journey in step.
    const focus = focusOf(s.challenges);
    const challenges =
      focus && focus.stage !== "outside" && diagnosis.focusStage && diagnosis.focusStage !== focus.stage
        ? s.challenges.map((c) => (c.id === focus.id ? { ...c, stage: diagnosis.focusStage! } : c))
        : s.challenges;
    set({ checkup, challenges });
    persistCheckup({ userWorkspace: s.userWorkspace, checkup });
    if (challenges !== s.challenges) persistChallenges(get());
  },
  setImprovedDiagnosis: (improved) => {
    const s = get();
    const checkup: CheckupState = { ...s.checkup, improved };
    set({ checkup });
    persistCheckup({ userWorkspace: s.userWorkspace, checkup });
  },
  setAiInsights: (items) => {
    set({ aiInsights: items });
    persistAi({ aiInsights: items, aiBrief: get().aiBrief });
  },
  setAiBrief: (brief) => {
    set({ aiBrief: brief });
    persistAi({ aiInsights: get().aiInsights, aiBrief: brief });
  },
  recordAsk: (entry) => {
    const full: AskLogEntry = {
      ...entry,
      id: `ask-${Math.random().toString(36).slice(2, 10)}`,
      at: new Date().toISOString(),
    };
    const askLog = [full, ...get().askLog].slice(0, 100);
    set({ askLog });
    persistAskLog(askLog);
  },
  clearAskLog: (workspaceId) => {
    const askLog = get().askLog.filter((e) => e.workspaceId !== workspaceId);
    set({ askLog });
    persistAskLog(askLog);
  },
  setTaskPrefill: (prefill) => set({ taskPrefill: prefill }),
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
        // A workspace created mid-onboarding (no facts yet) must survive a reload
        // too, so the owner's in-progress chat resumes under the right business.
        if (parsed.userWorkspace && !(parsed.checkup && parsed.checkup.facts)) {
          set({ userWorkspace: parsed.userWorkspace, businessId: "user-workspace" });
        }
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
    try {
      const rawAi = localStorage.getItem(AI_KEY);
      if (rawAi) {
        const parsedAi = JSON.parse(rawAi) as { aiInsights?: Insight[]; aiBrief?: Brief | null };
        set({
          aiInsights: Array.isArray(parsedAi.aiInsights) ? parsedAi.aiInsights : [],
          aiBrief: parsedAi.aiBrief ?? null,
        });
      }
    } catch {}
    try {
      const rawCoach = localStorage.getItem(COACH_KEY);
      if (rawCoach) {
        const parsedCoach = JSON.parse(rawCoach) as {
          actions?: ActionRecord[];
          experiments?: ExperimentRecord[];
          timelineEvents?: TimelineEvent[];
          coach?: Partial<CoachState>;
        };
        const coach: CoachState = {
          steps: Array.isArray(parsedCoach.coach?.steps) ? parsedCoach.coach!.steps : [],
          prefs: { ...DEFAULT_COACH_PREFS, ...(parsedCoach.coach?.prefs ?? {}) },
          learnings: Array.isArray(parsedCoach.coach?.learnings) ? parsedCoach.coach!.learnings : [],
        };
        set({
          actions: Array.isArray(parsedCoach.actions) ? parsedCoach.actions : [],
          experiments: Array.isArray(parsedCoach.experiments) ? parsedCoach.experiments : [],
          timelineEvents: Array.isArray(parsedCoach.timelineEvents) ? parsedCoach.timelineEvents : [],
          coach,
          notifications: [...dueCheckInNotifications(coach, get().notifications), ...get().notifications],
        });
      }
    } catch {}
    try {
      const rawAsk = localStorage.getItem(ASKLOG_KEY);
      if (rawAsk) {
        const parsedAsk = JSON.parse(rawAsk) as AskLogEntry[];
        if (Array.isArray(parsedAsk)) set({ askLog: parsedAsk.filter((e) => e && e.question && e.workspaceId) });
      }
    } catch {}
    try {
      // Challenges: saved ones, or — for a checkup that predates them — derived from the
      // checkup and the steps tried so far (in memory only: nothing is written on load).
      const raw = localStorage.getItem(CHALLENGES_KEY);
      const parsed = raw ? (JSON.parse(raw) as { items?: Challenge[]; planAt?: string | null }) : null;
      const items = parsed && Array.isArray(parsed.items) ? parsed.items.filter((c) => c && typeof c.id === "string" && typeof c.title === "string").map(normalizeChallenge) : null;
      const { checkup, coach, userWorkspace } = get();
      if (items && (items.length > 0 || !checkup.facts)) set({ challenges: items, challengePlanAt: parsed?.planAt ?? null });
      else if (checkup.facts && userWorkspace) set({ challenges: deriveChallenges(checkup.facts, checkup.diagnosis, coach) });
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
/** The step the owner is working on right now in the active workspace. */
export function useActiveCoachStep(): CoachStep | null {
  return useBizz((s) => s.coach.steps.find((x) => x.workspaceId === s.businessId && x.status === "active") ?? null);
}
/** The most recent step (any status except set aside or paused) in the active workspace. */
export function useLatestCoachStep(): CoachStep | null {
  return useBizz((s) => s.coach.steps.find((x) => x.workspaceId === s.businessId && x.status !== "stopped" && x.status !== "paused") ?? null);
}
export function useCoachStep(id: string | undefined): CoachStep | null {
  return useBizz((s) => (id ? s.coach.steps.find((x) => x.id === id) ?? null : null));
}

/** The owner's challenges (their own workspace only — sample businesses have none). */
export function useOwnChallenges(): Challenge[] {
  const list = useBizz((s) => s.challenges);
  const businessId = useBizz((s) => s.businessId);
  return useMemo(() => (businessId === OWN ? list.filter((c) => c.workspaceId === OWN) : []), [list, businessId]);
}
/** The challenge being worked on now. */
export function useFocusChallenge(): Challenge | null {
  return useBizz((s) => (s.businessId === OWN ? focusOf(s.challenges) ?? null : null));
}
export function useChallenge(id: string | undefined): Challenge | null {
  return useBizz((s) => (id ? s.challenges.find((c) => c.id === id) ?? null : null));
}

export function useGoalsFor(businessId: string): GoalRecord[] {
  return useBizz((s) => s.goals.filter((g) => g.businessId === businessId));
}

import { NOTIFICATIONS } from "./data/operations";

// Testing helper (development only): `__bizzCoach.makeDue()` in the console makes
// the next check-in due now, so the check-in flow can be tried without waiting.
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as { __bizzCoach?: unknown }).__bizzCoach = {
    makeDue: (stepId?: string) => useBizz.getState().makeCheckInDue(stepId),
    state: () => useBizz.getState().coach,
    challenges: () => useBizz.getState().challenges,
    // The store itself, for setting up test workspaces without a reload (development only).
    store: useBizz,
  };
}

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
