import type { CountUnit, DraftHint } from "./coach";
// Nellovia prototype — shared type system
// Provenance is a core product principle: never treat measured data,
// user-supplied data, estimates and AI interpretation as visually identical.

export type BusinessType = "service" | "ecommerce";

export type Provenance = "measured" | "user-supplied" | "estimated" | "ai-interpretation";

export type ConfidenceLevel = "high" | "medium" | "low";

export type Goodness = "good" | "bad" | "neutral";

export type DateRangeId = "last-7" | "last-30" | "this-month" | "last-month";

export interface MonthlyPoint {
  key: string; // e.g. "2026-09"
  label: string; // e.g. "Sep"
  /** Full period name when available (owner-entered months), e.g. "September 2026". */
  fullLabel?: string;
  spend: number;
  enquiries: number;
  customers: number;
  revenue: number;
  orders?: number;
  traffic?: number;
}

export interface DailyPoint {
  day: number; // 1..30
  label: string; // e.g. "Sep 1"
  spend: number;
  enquiries: number;
  customers: number;
  revenue: number;
  orders?: number;
  traffic?: number;
}

export interface ChannelMetrics {
  id: string;
  name: string;
  kind: "paid" | "organic" | "referral";
  spend: number;
  enquiries: number;
  customers: number;
  revenue: number;
  cac: number;
  conversion: number; // enquiry -> customer %
  orders?: number;
  trend: number[]; // last 6 months enquiry volume
}

export interface FunnelStep {
  id: string;
  label: string;
  value: number;
  hint?: string;
}

export interface ServiceItem {
  id: string;
  name: string;
  enquiries: number;
  customers: number;
  revenue: number;
  conversion: number;
  active: boolean;
  priceRange: string;
}

export interface ProductItem {
  id: string;
  name: string;
  views: number;
  carts: number;
  orders: number;
  revenue: number;
  returns: number;
}

export interface Business {
  id: string;
  name: string;
  type: BusinessType;
  location: string;
  platform: string | null;
  model: string;
  goal: string;
  journey: string[];
  monthly: MonthlyPoint[];
  daily: DailyPoint[]; // September (30 days)
  channels: ChannelMetrics[];
  funnel: FunnelStep[];
  services?: ServiceItem[];
  products?: ProductItem[];
  website: {
    connected: boolean;
    traffic?: number;
    visitors?: number;
    mobileShare?: number;
    visitorConversion?: number;
    deviceMix?: { mobile: number; desktop: number };
    mobileCheckout?: { previous: number; current: number };
    desktopCheckout?: { previous: number; current: number };
    paymentFailuresDelta?: number;
    landingPages?: { path: string; visits: number; conversion: number }[];
  };
  retention: {
    connected: boolean;
    newCustomers?: number;
    repeatCustomers?: number;
    repeatRate?: number;
    frequency?: number;
    note?: string;
  };
  dataCoverage: { overall: number; areas: { area: string; coverage: number; known: string; missing: string; unlocks: string }[] };
  health: { dimension: string; score: number; summary: string; why: string[] }[];
  lastSyncNote: string;
  lastSyncOk: boolean;
}

// ---------- Intelligence ----------

export interface EvidenceItem {
  label: string;
  value: string;
  provenance: Provenance;
  source: string;
  factId?: string; // links to provenance record
}

export interface Insight {
  id: string;
  businessId: string;
  type: "problem" | "opportunity" | "improvement" | "watch";
  importance: "critical" | "high" | "medium" | "low";
  title: string;
  summary: string;
  date: string;
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  meaning: string;
  known: string[];
  unknown: string[];
  evidence: EvidenceItem[];
  recommendedAction: string;
  recommendationId?: string;
  rootCause?: { step: string; note?: string }[];
  missingToImprove: string[];
  primaryMetric: string;
  /** Ready-to-use words for the recommended action (older AI insights only). */
  tryThis?: { title: string; body: string };
  /** Words the app can write for the recommended action, on request (AI insights). */
  draft?: DraftHint;
}

export interface Recommendation {
  id: string;
  businessId: string;
  insightId: string;
  title: string;
  problem: string;
  evidence: EvidenceItem[];
  diagnosis: string;
  recommendation: string;
  expectedImpact: string;
  impact: "high" | "medium" | "low";
  effort: "high" | "medium" | "low";
  confidence: number;
  primaryMetric: string;
  measurementWindow: string;
  executionType: "guided" | "human" | "connected";
  tasks: string[];
  status: "open" | "started" | "dismissed" | "saved";
}

export interface ChecklistItem {
  label: string;
  done: boolean;
}

export interface ActionRecord {
  id: string;
  businessId: string;
  recommendationId?: string;
  title: string;
  owner: string;
  due: string;
  started?: string;
  status: "in-progress" | "measuring" | "completed";
  checklist: ChecklistItem[];
  notes: string;
  metric: string;
  activity: { date: string; text: string }[];
  /** Set when the action came from an accepted coaching next step. */
  coachStepId?: string;
}

export interface Outcome {
  primaryMetric: string;
  before: string;
  after: string;
  delta: string;
  goodness: Goodness;
  secondary: { label: string; before: string; after: string; goodness: Goodness }[];
  otherChanges: string[];
  attribution: ConfidenceLevel;
  interpretation: string;
  conclusion: string;
  period: string;
}

export interface ExperimentRecord {
  id: string;
  businessId: string;
  actionId?: string;
  title: string;
  hypothesis: string;
  change: string;
  baseline: string;
  target: string;
  current: string;
  baselineValue: number;
  currentValue: number;
  targetValue: number;
  windowDays: number;
  startedAt: string;
  daysRemaining: number;
  otherChanges: string[];
  watchMetrics: string[];
  owner: string;
  status: "running" | "measuring" | "complete";
  outcome?: Outcome;
  /** How the count reads: out of every 10 who ask, or a plain number (coaching experiments). */
  unit?: CountUnit;
  /** Set when the experiment came from an accepted coaching next step. */
  coachStepId?: string;
}

export interface AlertItem {
  id: string;
  businessId: string;
  severity: "critical" | "warning" | "opportunity" | "info";
  title: string;
  whatHappened: string;
  whyItMatters: string;
  whatToDo: string;
  metric?: string;
  time: string;
  status: "open" | "resolved" | "dismissed";
  evidence: EvidenceItem[];
  relatedDiagnosisId?: string;
}

// ---------- Operations ----------

export interface NotificationItem {
  id: string;
  businessId: string;
  category: "alert" | "assignment" | "report" | "experiment" | "connection" | "goal" | "team";
  title: string;
  body: string;
  time: string;
  read: boolean;
  targetRoute: string;
}

export interface GoalRecord {
  id: string;
  businessId: string;
  title: string;
  metric: string;
  baseline: number;
  target: number;
  current: number;
  unit: string;
  deadline: string;
  owner: string;
  priority: "high" | "medium" | "low";
  status: "active" | "at-risk" | "completed" | "draft";
  contributing: string[];
  relatedRecommendations: string[];
  risks?: string;
  summary: string;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "member";
  jobTitle: string;
  status: "active" | "invited";
  lastActive: string;
  assignedActions: number;
}

export type ConnectionStatus = "available" | "connected" | "syncing" | "error";

export interface IntegrationDef {
  id: string;
  name: string;
  category: string;
  description: string;
  provides: string[];
  unlocks: string;
  permissions: { read: string[]; cannot: string[] };
  badge: "Read" | "Observe" | "Write";
  status: ConnectionStatus;
  businessId?: string; // connected instance scope in demo
  connectedSince?: string;
  lastSync?: string;
  nextSync?: string;
  error?: { title: string; detail: string; affected: string; resolution: string; time: string };
}

export interface DataQualityIssue {
  id: string;
  businessId: string;
  severity: "error" | "warning" | "info";
  title: string;
  detail: string;
  impact: string;
  resolution: string;
}

export interface ProvenanceFact {
  id: string;
  businessId: string;
  label: string;
  value: string;
  provenance: Provenance;
  source: string;
  enteredBy?: string;
  date: string;
  precision: string;
  confidence: ConfidenceLevel;
  dependencies?: string[];
  note?: string;
}

export interface TimelineEvent {
  id: string;
  businessId: string;
  date: string;
  type: "action" | "external" | "recommendation" | "experiment" | "data" | "outcome";
  title: string;
  description: string;
  source: string;
  provenance: Provenance;
}

export interface ManualEntry {
  id: string;
  businessId: string;
  period: string;
  metrics: { label: string; value: string; precision: "exact" | "approximate" | "range" }[];
  updatedBy: string;
  lastModified: string;
  status: "verified" | "unverified";
}

// ---------- Briefs ----------

export interface BriefSection {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  metrics?: { label: string; value: string; goodness: Goodness; note?: string }[];
}

export interface Brief {
  id: string;
  businessId: string;
  kind: "weekly" | "monthly";
  period: string;
  title: string;
  sections: BriefSection[];
}

// ---------- Admin ----------

export interface AdminBusiness {
  id: string;
  name: string;
  type: BusinessType;
  owner: string;
  plan: string;
  status: "active" | "trial" | "suspended";
  coverage: number;
  lastActive: string;
  sources: number;
  syncHealth: "healthy" | "delayed" | "failed";
  teamSize: number;
  recentDiagnoses: number;
  openRecommendations: number;
  supportCases: number;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  business: string;
  role: string;
  status: "active" | "invited" | "disabled";
  joined: string;
  lastActive: string;
}

export interface AdminSubscription {
  business: string;
  plan: string;
  state: "active" | "past-due" | "trialing";
  lastPayment: string;
  nextRenewal: string;
  failedPayments: number;
  mrr: string;
}

export interface SyncHealthRow {
  source: string;
  business: string;
  lastSync: string;
  status: "healthy" | "delayed" | "failed";
  failures: number;
  lastError?: string;
}

export interface JobRow {
  id: string;
  job: string;
  business: string;
  started: string;
  duration: string;
  status: "success" | "running" | "failed";
  error?: string;
}

export interface AiAuditItem {
  id: string;
  business: string;
  diagnosis: string;
  recommendation: string;
  confidence: number;
  evidenceCount: number;
  coverage: number;
  date: string;
  feedback: "helpful" | "unhelpful" | "none";
  status: "pending" | "reviewed" | "flagged";
  detail?: {
    inputs: { label: string; value: string; provenance: Provenance }[];
    interpretation: string;
    missingData: string[];
    concerns: string[];
    userFeedback?: string;
    outcome?: string;
  };
}

export interface SupportTicket {
  id: string;
  type: "feedback" | "bug" | "data-concern" | "ai-concern";
  business: string;
  user: string;
  summary: string;
  message: string;
  priority: "high" | "medium" | "low";
  status: "open" | "in-progress" | "resolved";
  created: string;
  workspaceContext: string;
}
