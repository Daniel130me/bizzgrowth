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

/**
 * How the business type reads in words. "ecommerce" only means they sell products —
 * a food shop or a market stall is not an online store, and reading it that way
 * misled both the owner ("a ecommerce business") and the model.
 */
export function businessKindPhrase(type: "service" | "ecommerce" | undefined): string {
  return type === "ecommerce" ? "a business that sells products" : "a service business";
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
  /**
   * The money picture, when the owner has a payment they can't cover (rent, a
   * loan, a supplier, wages, tax). Every amount is one they gave; anything
   * worked out from these (the gap, money in against money out) is computed in
   * code — see src/lib/checkup-money.ts.
   */
  money?: MoneyFacts;
  chips: string[];
  facts: CheckupFact[];
  confidence: number;
}

export type MoneyPeriod = "day" | "week" | "month" | "year";

/** One payment they owe. After a check-in it can be paid, or moved onto a plan they agreed. */
export interface DueItem {
  what: string;
  /** What they must pay — for a plan, the next instalment. */
  amount?: string;
  /** When, in their words ("in 9 days", "every month"). */
  when?: string;
  /** Paid off, or on a plan they agreed. Absent: still due as first said. */
  status?: "paid" | "plan";
  /** What changed, in their words ("paid ₦900k, then ₦300k a month"). */
  note?: string;
  /** When it last changed (ISO). */
  updatedAt?: string;
}

/**
 * What a check-in told us changed in their money — already checked: every amount is one
 * they typed, and each change names a payment that is on their list.
 */
export interface MoneyUpdates {
  due?: { what: string; change: "paid" | "plan" | "new" | "amount"; amount?: string; when?: string; note?: string }[];
  cashNow?: string;
  moneyIn?: { amount: string; per: MoneyPeriod };
  pricesChanged?: string;
}

export interface MoneyFacts {
  /** What they have to pay soon, or already owe: what, how much they must pay, and when. */
  due: DueItem[];
  /** The cash the business has now to pay with, in their words. */
  cashNow?: string;
  /** Money coming in from sales, as they gave it, e.g. { amount: "₦40,000–₦60,000", per: "day", daysOpen: 24 }. */
  moneyIn?: { amount: string; per: MoneyPeriod; daysOpen?: number };
  /** Running costs they listed (stock, staff, power, transport…), each with its period. */
  costs: { what: string; amount: string; per: MoneyPeriod }[];
  /** A monthly sales figure they stated in passing, kept to check against money in. */
  statedMonthlySales?: string;
  /** How they were planning to cover the gap, in their words. */
  coverPlan?: string;
  /** When they last changed their prices, and whether costs went up since. */
  pricesChanged?: string;
  /** Fees or commission a way of selling takes (an app, a platform, a card machine). */
  platformFees?: string;
  /** Whether whoever they owe has agreed a payment plan or part payment before. */
  owedFlex?: string;
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
  /**
   * Their money, worked out in code from their own figures (what's due against
   * what they have; money in against running costs). Owners in money trouble only.
   */
  money?: string[];
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
  /**
   * What they said in the checkup, in their own words (their replies only). The
   * fields above have no place for an amount owed, a due date or the cash they
   * have — without these, every feature after the checkup forgot them.
   */
  ownerWords?: string[];
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
  | "otherChallenges"
  // The money picture — asked only when the owner has a payment they can't cover.
  | "moneyDue"
  | "otherDebts"
  | "cashNow"
  | "moneyInOut"
  | "coverPlan"
  | "pricesChanged"
  | "platformFees"
  | "owedFlex";

/** The money questions, in the order a consultant would ask them. */
export const MONEY_SLOTS: SlotKey[] = ["moneyDue", "otherDebts", "cashNow", "moneyInOut", "coverPlan", "pricesChanged", "platformFees", "owedFlex"];

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
  ...MONEY_SLOTS,
];

/**
 * Follow-up questions asked AFTER the required ones, chosen from what the
 * owner said is hard — they are what lets the diagnosis name the real cause
 * (price given too early, no proof, no room for more work…) instead of a
 * generic one. Owners would rather answer a few more questions than get a
 * shallow diagnosis.
 */
export const DEPTH_SLOTS: SlotKey[] = ["pricePresentation", "lostReason", "proof", "repeat", "capacity"];

/** A way of selling that usually takes a fee or commission (apps, platforms, marketplaces, card payments). */
export function sellsThroughPlatform(channels: string[] | undefined): boolean {
  return (channels ?? []).some((c) => /\b(apps?|delivery|platform|marketplace|online store|jumia|konga|glovo|chowdeck|uber|bolt|etsy|amazon|ebay|shopify|pos|card)\b/i.test(c));
}

export function depthSlotsFor(slots: Pick<CheckupSlots, "bottleneck" | "closeRate"> & Partial<Pick<CheckupSlots, "money" | "channels">>): SlotKey[] {
  // Money trouble: what is needed to judge whether the business covers its costs, and
  // what room there is with whoever is owed — not how to win more customers.
  if (slots.money) {
    const out: SlotKey[] = [];
    if (!slots.channels?.length) out.push("channels");
    else if (sellsThroughPlatform(slots.channels)) out.push("platformFees");
    out.push("pricesChanged", "owedFlex");
    return out;
  }
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
 * When the owner has a payment they can't cover, the first diagnosis has to
 * be about this week's money: what is due, what else they owe, the cash they
 * have, and whether money in covers money out. The questions about winning
 * more customers wait — they can't fix a gap that is due in days.
 */
export const MONEY_REQUIRED_SLOTS: SlotKey[] = ["sells", "bottleneck", "moneyDue", "otherDebts", "cashNow", "moneyInOut", "coverPlan", "ownerTheory"];

/** The questions a first diagnosis needs for this owner. */
export function requiredSlotsFor(slots: Partial<Pick<CheckupSlots, "money">>): SlotKey[] {
  return slots.money ? MONEY_REQUIRED_SLOTS : REQUIRED_SLOTS;
}

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
  moneyDue: 2,
  otherDebts: 1,
  cashNow: 2,
  moneyInOut: 2,
  coverPlan: 1,
  pricesChanged: 1,
  platformFees: 1,
  owedFlex: 1,
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
  moneyDue: "The payment they can't cover: what it is, how much, and when it is due",
  otherDebts: "Anything ELSE they owe or must pay in the next few weeks (a loan, a supplier, wages, tax, a bill) — how much and when; 'nothing else' is an answer",
  cashNow: "How much money the business has right now to pay with",
  moneyInOut: "Money in and out in a normal week or month: roughly what comes in from sales, and the main running costs (stock, staff, power or fuel, transport)",
  coverPlan: "How they were planning to cover the gap (borrowing, selling something, asking family, talking to whoever is owed) — so a risky plan can be caught before it happens",
  pricesChanged: "When they last changed their prices, and whether their costs have gone up since",
  platformFees: "Whether a way they sell (an app, a platform, a card machine) takes a fee or commission, and roughly how much",
  owedFlex: "Whether whoever they owe has ever agreed to part payment or a payment plan before",
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
  moneyDue?: string;
  otherDebts?: string;
  cashNow?: string;
  moneyInOut?: string;
  coverPlan?: string;
  pricesChanged?: string;
  platformFees?: string;
  owedFlex?: string;
  /** Set once the owner says they have a payment they can't cover: the checkup asks about money first. */
  money?: boolean;
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

/**
 * Whether "Improve your diagnosis" (counts of people who asked and paid, per way they find
 * you) can change the read. It can when the read is about getting found, enquiries or
 * winning customers — not money trouble, delivering, repeat customers, or a problem outside
 * sales, where those counts would only take the owner's time.
 */
export function improveHelps(
  facts: Pick<BusinessFacts, "money"> | null | undefined,
  diagnosis: { focusStage?: FocusStage } | null | undefined,
  challengeStage?: string | null,
): boolean {
  if (!facts || facts.money || challengeStage === "outside") return false;
  const stage = diagnosis?.focusStage;
  return !stage || stage === "found" || stage === "enquire" || stage === "convert";
}
