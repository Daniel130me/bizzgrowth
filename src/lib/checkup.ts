// Shared contract between the Nellovia AI backend (API routes) and client screens.
// Pure types + a tolerant JSON extractor — safe to import from both server and client.

import type { DraftHint, NextStep } from "./coach";

export type TrendDirection = "Increased" | "Decreased" | "About the same" | "Don't know";

export interface TranscriptTurn {
  role: "ai" | "user";
  text: string;
}

export interface CheckupFact {
  section: string;
  value: string;
  provenance: "user-supplied" | "ai-interpretation" | "estimated" | "measured";
  source: string;
}

export interface BusinessFacts {
  businessType: "service" | "ecommerce";
  whatTheySell: string;
  primaryGoal: string;
  customers: string;
  channels: string[];
  journey: string[];
  trends: { enquiries: TrendDirection; customers: TrendDirection; revenue: TrendDirection };
  recentChanges: string[];
  /** Where the owner feels growth is stuck, in their words (e.g. "turning enquiries into paying clients"). */
  bottleneck?: string;
  /** Owner's rough estimate of how many enquiries become paying customers (e.g. "about 3 in 10"). */
  closeRate?: string;
  /** How enquiries are handled — reply speed and follow-up, in their words. */
  followUp?: string;
  /** Rough amount one customer pays for a typical job or order (e.g. "₦200k – ₦500k"). */
  jobValue?: string;
  /** Rough number of people who ask about buying in a normal month (e.g. "6 to 15"). */
  monthlyEnquiries?: string;
  /** How and when the owner gives the price (e.g. "a quick figure on WhatsApp"). */
  pricePresentation?: string;
  /** What people say or do when they don't buy (e.g. "they just stop replying"). */
  lostReason?: string;
  /** Whether the owner could take on more work right now. */
  capacity?: string;
  /** Whether new people see past work or results before the price. */
  proof?: string;
  /** Whether past customers come back or order again. */
  repeat?: string;
  /** What the owner thinks is causing the problem — their own observations and hunches. */
  ownerTheory?: string;
  /**
   * Other things holding the business back, in the owner's words (up to 3).
   * Captured in the checkup with one question, never diagnosed there — each
   * becomes a challenge of its own, taken one at a time.
   */
  otherChallenges?: string[];
  chips: string[];
  facts: CheckupFact[];
  confidence: number;
}

export interface DiagnosisDelta {
  label: string;
  /**
   * Real measured percent change. null when no measured figure exists —
   * Nellovia NEVER invents a number the owner did not give.
   */
  delta: number | null;
  /** Self-reported direction, used when delta is null. */
  direction?: "up" | "down" | "flat" | "unknown";
  goodness: "good" | "bad" | "neutral";
  caption: string;
  /** Preformatted value to display instead of a percent (e.g. a real conversion rate). */
  customValue?: string;
}

/**
 * "What it's worth" — worked out ONLY from the owner's own estimates
 * (close rate, typical job value, people asking per month). Deterministic:
 * never written by the model, so every figure can be traced to an answer.
 */
export interface DiagnosisStake {
  /** The big figure, e.g. "+50%" or "₦240k–₦1.5m". */
  figure: string;
  /** What the figure means, e.g. "more paying clients from the same referrals". */
  label: string;
  /** Optional second line, e.g. "about 1–3 more paying clients a month". */
  detail?: string;
  /** The working, step by step, in plain words. */
  working: string[];
  /** True when the figure is money (so the page can invite the missing inputs otherwise). */
  isMoney: boolean;
}

/** Ready-to-use help on the diagnosis page: something to send, say or offer today. */
export interface DiagnosisTool {
  kind: "message" | "script" | "offer";
  title: string;
  /** When to use it, one short line. */
  when?: string;
  /** The exact words, ready to copy. */
  body: string;
}

/** Bump when the diagnosis page needs fields older stored diagnoses lack — they are regenerated. */
export const DIAGNOSIS_VERSION = 2;

export interface DiagnosisContent {
  headline: string;
  story: string;
  deltas: DiagnosisDelta[];
  meaning: string;
  whyItMatters: string;
  nextInvestigation: string;
  confidence: number;
  /** Where in the customer journey growth most likely breaks — drives the page's focus visual. */
  focusStage?: FocusStage;
  /** 2-3 concrete, owner-specific actions for this week. */
  steps?: string[];
  /** Format version (see DIAGNOSIS_VERSION). */
  version?: number;
  /** The connection the owner has probably not made — links two of their answers. */
  insight?: string;
  /** What is already working, acknowledged before the gap. */
  working?: string;
  /** What fixing it is worth, from their own estimates. null when they gave too little to work it out. */
  stake?: DiagnosisStake | null;
  /** Ready-to-use help: a message to send, what to say, an offer layout. */
  tools?: DiagnosisTool[];
  /** True when every figure in the diagnosis was traced to the owner's own answers (grounding check). */
  checked?: boolean;
  /** The ONE thing to do next — an experiment or a recommendation the owner can accept. */
  nextStep?: NextStep;
  /** What the latest check-in taught us, shown on top of the diagnosis. */
  update?: { at: string; note: string };
}

export type FocusStage = "found" | "enquire" | "convert" | "deliver" | "return";

export const FOCUS_STAGES: { id: FocusStage; label: string; hint: string }[] = [
  { id: "found", label: "Getting found", hint: "How people discover you" },
  { id: "enquire", label: "Enquiries", hint: "People reaching out" },
  { id: "convert", label: "Becoming customers", hint: "Enquiries that pay" },
  { id: "deliver", label: "Delivering", hint: "Capacity and quality" },
  { id: "return", label: "Coming back", hint: "Repeat work and referrals" },
];

export interface ChannelCountInput {
  name: string;
  enquiries: number;
  customers: number;
}

export interface ChannelConversionRow extends ChannelCountInput {
  conversion: number; // customers / enquiries * 100
}

export interface ImprovedDiagnosis {
  channelRows: ChannelConversionRow[];
  bestChannel: string;
  worstChannel: string;
  headline: string;
  story: string;
  meaning: string;
  whyItMatters: string;
  nextInvestigation: string;
  confidence: number;
}

export interface AskEvidenceItem {
  label: string;
  value: string;
  provenance: "user-supplied" | "ai-interpretation" | "estimated" | "measured";
  source: string;
}

export interface AskAnswerContent {
  grounded: string[];
  interpretation?: string;
  limitations?: string[];
  evidence: AskEvidenceItem[];
  referencedPeriod: string;
  /** Ready-to-use words (older answers only — new answers offer a draft button instead). */
  tryThis?: { title: string; body: string } | null;
  /** Words the app can write for this answer, on request. */
  draft?: DraftHint | null;
  /** 2-3 natural next questions the owner might ask. */
  followUps?: string[];
  /** True when every figure in the answer was traced to the workspace data (grounding check). */
  verified?: boolean;
  /** A new problem the question described — offered as a challenge to add, in one tap. */
  newChallenge?: NoticedChallenge | null;
}

/**
 * Everything the AI knows about an owner's business, in one shape every AI
 * feature (Ask, insights, briefs, improve) receives — so each one builds on
 * the checkup, the diagnosis and the plan instead of starting from scratch.
 */
export interface BusinessContextPayload {
  name: string;
  country?: string;
  currency?: string;
  facts?: BusinessFacts | null;
  diagnosis?: {
    headline: string;
    insight?: string;
    focusStage?: FocusStage;
    stake?: { figure: string; label: string; working: string[] } | null;
    steps?: string[];
    stepsDone?: string[];
    tools?: { kind: string; title: string }[];
  } | null;
  /** Owner-entered monthly totals, oldest first. */
  months?: { label: string; revenue?: number; enquiries?: number; customers?: number }[];
  /** The step they are trying right now, and what earlier check-ins taught us. */
  coaching?: {
    active?: { title: string; kind: string; day: number; days: number; measure?: string; baseline?: string; nextCheckIn?: string } | null;
    learnings?: string[];
  } | null;
  /** Their list of challenges (one worked on at a time), so answers can connect to it. */
  challenges?: { id: string; title: string; status: string; stage: string; note?: string }[] | null;
}

/** A new problem the owner described (in Ask or a check-in) that is not on their list yet. */
export interface NoticedChallenge {
  title: string;
  stage: string;
  /** An open challenge it is probably the same problem as. */
  sameAs: string | null;
  why?: string;
}

/** Workspace snapshot sent to the Ask endpoint so answers stay grounded. */
export interface AskWorkspaceContext {
  /** The owner's own business, in full (checkup, diagnosis, plan). */
  business?: BusinessContextPayload | null;
  name: string;
  type: "service" | "ecommerce";
  location: string;
  currency: string;
  isUserWorkspace: boolean;
  hasMeasuredData: boolean;
  periodLabel?: string;
  metrics?: {
    spend: number;
    enquiries?: number;
    customers?: number;
    orders?: number;
    traffic?: number;
    revenue: number;
    prev?: {
      spend: number;
      enquiries?: number;
      customers?: number;
      orders?: number;
      traffic?: number;
      revenue: number;
    };
  };
  channels?: { name: string; enquiries: number; customers: number; conversion: number; cac?: number; spend?: number }[];
  channelCounts?: ChannelConversionRow[]; // user-entered counts (measured by the owner)
  userFacts?: {
    whatTheySell: string;
    primaryGoal: string;
    customers: string;
    channels: string[];
    trends: BusinessFacts["trends"];
    recentChanges: string[];
  } | null;
}

/* ------------------------------------------------------------------ */
/* Consultant conversation (per-turn brain) — /api/checkup/chat        */
/* ------------------------------------------------------------------ */

export type CheckupPhase = "interview" | "done";

/** Every piece of information the consultation can gather. No fixed order. */
export type SlotKey =
  | "businessType"
  | "sells"
  | "targetMarket"
  | "location"
  | "goal"
  | "channels"
  | "enquiries"
  | "customers"
  | "revenue"
  | "changes"
  | "bottleneck"
  | "closeRate"
  | "followUp"
  | "jobValue"
  | "monthlyEnquiries"
  | "pricePresentation"
  | "lostReason"
  | "capacity"
  | "proof"
  | "repeat"
  | "ownerTheory"
  | "otherChallenges";

export const SLOT_KEYS: SlotKey[] = [
  "businessType",
  "sells",
  "targetMarket",
  "location",
  "goal",
  "channels",
  "enquiries",
  "customers",
  "revenue",
  "changes",
  "bottleneck",
  "closeRate",
  "followUp",
  "jobValue",
  "monthlyEnquiries",
  "pricePresentation",
  "lostReason",
  "capacity",
  "proof",
  "repeat",
  "ownerTheory",
  "otherChallenges",
];

/**
 * Follow-up questions asked AFTER the required ones, chosen from what the
 * owner said is hard — they are what lets the diagnosis name the real cause
 * (price given too early, no proof, no room for more work…) instead of a
 * generic one. Owners would rather answer a few more questions than get a
 * shallow diagnosis.
 */
export const DEPTH_SLOTS: SlotKey[] = ["pricePresentation", "lostReason", "proof", "repeat", "capacity"];

export function depthSlotsFor(slots: Pick<CheckupSlots, "bottleneck" | "closeRate">): SlotKey[] {
  const b = (slots.bottleneck ?? "").toLowerCase();
  const priceOrBuying = /price|expensive|cost|afford|pay|buy|quote|quiet|leave|commit|convert|close|decid|don't buy|dont buy/.test(b);
  const visibility = /not enough|find|visib|reach|known|more (people|customers|clients)|enquir|aware/.test(b);
  const busy = /busy|time|capacity|staff|overwhelm|too much|deliver/.test(b);
  const unsteady = /steady|consistent|season|some months|irregular|up and down|slow months|quiet months|not regular|dry/.test(b);
  const out: SlotKey[] = [];
  if (priceOrBuying || busy) out.push("pricePresentation");
  if (priceOrBuying) out.push("lostReason");
  if (priceOrBuying || visibility || unsteady) out.push("proof");
  if (unsteady || visibility || !priceOrBuying) out.push("repeat");
  out.push("capacity");
  return out;
}

/**
 * Slots a first diagnosis genuinely needs — coverage = all of these resolved.
 * close rate + people asking a month + typical job value are what let the
 * diagnosis say what fixing the problem is WORTH, from the owner's own numbers.
 */
export const REQUIRED_SLOTS: SlotKey[] = [
  "sells",
  "targetMarket",
  "channels",
  "bottleneck",
  // What the owner thinks is causing it — they often know things that happen
  // offline (a cheaper competitor nearby, a bad month, what customers say).
  "ownerTheory",
  "closeRate",
  "monthlyEnquiries",
  "jobValue",
  "followUp",
];

/**
 * Slots that carry real diagnostic signal. Owners who do not track numbers can
 * still answer the qualitative ones (bottleneck, close rate, follow-up), so a
 * checkup never ends on "don't know" across the board.
 */
export const SIGNAL_SLOTS: SlotKey[] = ["bottleneck", "closeRate", "followUp", "jobValue", "monthlyEnquiries", "enquiries", "customers", "revenue"];

/** Minimum known signals before the consultant may wrap up. */
export const MIN_SIGNALS = 3;

/** How many times the consultant may ask about a slot before accepting the gap. */
export const ASK_CAP: Record<SlotKey, number> = {
  businessType: 1,
  sells: 3,
  targetMarket: 3,
  location: 1,
  goal: 1,
  channels: 3,
  enquiries: 1,
  customers: 1,
  revenue: 1,
  changes: 1,
  bottleneck: 2,
  closeRate: 2,
  followUp: 2,
  jobValue: 2,
  monthlyEnquiries: 2,
  pricePresentation: 1,
  lostReason: 1,
  capacity: 1,
  proof: 1,
  repeat: 1,
  ownerTheory: 1,
  // Asked once; a second time only if they asked something back instead of answering.
  otherChallenges: 2,
};

export const SLOT_LABELS: Record<SlotKey, string> = {
  businessType: "Business type",
  sells: "What they sell",
  targetMarket: "Who they serve",
  location: "Where they operate",
  goal: "What they want to improve",
  channels: "Where customers come from",
  enquiries: "Enquiries vs last month",
  customers: "Customers vs last month",
  revenue: "Revenue vs last month (optional)",
  changes: "Recent changes",
  bottleneck: "Where growth feels stuck",
  closeRate: "Out of the people who ask, how many pay — BOTH numbers, e.g. '2 out of 5'",
  followUp: "How fast enquiries get a reply and whether they check back",
  jobValue: "Rough amount one customer pays for a typical job or order",
  monthlyEnquiries: "Rough number of people who ask about buying in a normal month",
  pricePresentation: "How and when they give the price (quick figure on WhatsApp, written quote, after a call or visit)",
  lostReason: "What people say or do when they don't go ahead",
  capacity: "Whether they could take on more work right now",
  proof: "Whether new people see past work or results before hearing the price",
  repeat: "Whether past customers come back or order again, or it is mostly one-off work",
  ownerTheory: "What the owner thinks is causing the problem — their own observations, checks or hunches",
  otherChallenges: "Anything else holding the business back — up to 3, in their words (recorded only, never followed up here)",
};

/** What the engine currently understands about the business. Updated every turn. */
export interface CheckupSlots {
  businessType?: string;
  sells?: string;
  targetMarket?: string;
  location?: string;
  goal?: string;
  channels?: string[];
  enquiries?: TrendDirection;
  customers?: TrendDirection;
  revenue?: TrendDirection;
  changes?: string[];
  bottleneck?: string;
  closeRate?: string;
  followUp?: string;
  jobValue?: string;
  monthlyEnquiries?: string;
  pricePresentation?: string;
  lostReason?: string;
  capacity?: string;
  proof?: string;
  repeat?: string;
  ownerTheory?: string;
  /** Other things holding the business back (an empty list = "no, that's the main one"). */
  otherChallenges?: string[];
  /** The slot the last question asked about — lets the next turn read a short reply in context. */
  pending?: SlotKey;
  /** Slots the owner declined to answer — accepted gaps, never fabricated. */
  declined: string[];
  /** How many times the owner corrected the engine's understanding. */
  corrections: number;
}

export function emptySlots(): CheckupSlots {
  return { declined: [], corrections: 0 };
}

/** Times each slot has been asked about, e.g. { enquiries: 1 }. */
export type AskCounts = Partial<Record<SlotKey, number>>;

/** How the engine classified the owner's latest message. */
export type ChatRead = "answer" | "correction" | "partial" | "dodge" | "question" | "other";

/** Result of one consultant turn. */
export interface ChatTurnResult {
  read: ChatRead;
  reply: string;
  /** Chips shown under "Understood as" — what changed in the model this turn. */
  learnedChips: string[];
  phase: CheckupPhase;
  slots: CheckupSlots;
  askCounts: AskCounts;
  /** Suggested short answers for the NEXT question. */
  chips: string[];
  degraded: boolean;
}

/**
 * Tolerant JSON extraction from an LLM response.
 * Handles markdown fences, leading prose, and trailing commentary.
 */
export function extractJson<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  let text = raw.trim();
  // Strip markdown code fences if present.
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  // Slice from the first { or [ to the matching last } or ].
  const firstObj = text.indexOf("{");
  const firstArr = text.indexOf("[");
  const start =
    firstObj === -1 ? firstArr : firstArr === -1 ? firstObj : Math.min(firstObj, firstArr);
  if (start === -1) return null;
  const lastObj = text.lastIndexOf("}");
  const lastArr = text.lastIndexOf("]");
  const end = Math.max(lastObj, lastArr);
  if (end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

export function clampPercent(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : fallback;
  return Math.max(min, Math.min(max, Math.round(v)));
}
