// Shared contract between the bizzGrowth AI backend (API routes) and client screens.
// Pure types + a tolerant JSON extractor — safe to import from both server and client.

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
  chips: string[];
  facts: CheckupFact[];
  confidence: number;
}

export interface DiagnosisDelta {
  label: string;
  delta: number; // percent change vs previous month, negative = decline
  goodness: "good" | "bad" | "neutral";
  caption: string;
}

export interface DiagnosisContent {
  headline: string;
  story: string;
  deltas: DiagnosisDelta[];
  meaning: string;
  whyItMatters: string;
  nextInvestigation: string;
  confidence: number;
}

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
}

/** Workspace snapshot sent to the Ask endpoint so answers stay grounded. */
export interface AskWorkspaceContext {
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

export type CheckupStage = "intro" | "enquiry" | "customers" | "revenue" | "changes" | "done";

export const CHECKUP_STAGES: CheckupStage[] = ["intro", "enquiry", "customers", "revenue", "changes", "done"];

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
  /** Topics the owner declined to answer — accepted gaps, never fabricated. */
  declined: string[];
  /** How many times the owner corrected the engine's understanding. */
  corrections: number;
}

export function emptySlots(): CheckupSlots {
  return { declined: [], corrections: 0 };
}

/** How the engine classified the owner's latest message. */
export type ChatRead = "answer" | "correction" | "partial" | "dodge" | "question" | "other";

/** Result of one consultant turn. */
export interface ChatTurnResult {
  read: ChatRead;
  reply: string;
  /** Chips shown under "Understood as" — what changed in the model this turn. */
  learnedChips: string[];
  stage: CheckupStage;
  slots: CheckupSlots;
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
