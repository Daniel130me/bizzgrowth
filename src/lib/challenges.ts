// Business challenges — what is holding the business back, tracked as a list.
// Pure (no React, no store): shared by the store, the screens and the API routes.
//
//   • One challenge is worked on at a time ("working"); the app suggests the
//     order of the rest ("up-next"); the owner can switch focus.
//   • The OWNER confirms "solved". The app only suggests it when their own
//     numbers hold up across two check-ins — compared like with like.
//   • What was learned counts ("it isn't slow replies"), and other changes the
//     owner reported sit next to every win, so credit is honest.
//   • Things the app can't see (cash flow, staff, rent, costs) are still
//     recorded, with an honest note.
//
// Nothing here may assume a particular kind of business: every list adapts to
// what the owner told us (what they sell, who pays them, how people find them).

import { FOCUS_STAGES, type BusinessFacts, type DiagnosisContent, type FocusStage, type ImprovedDiagnosis, type TranscriptTurn } from "./checkup";
import { countValue, type CheckInVerdict, type CountUnit, type NextStep } from "./coach";
import { parseCount, shorten, tidyOwnerText } from "./checkup-math";
import type { ChallengeChatState } from "./challenge-chat";

/* ------------------------------------------------------------------ */
/* Model                                                                */
/* ------------------------------------------------------------------ */

export type ChallengeStatus = "working" | "up-next" | "solved" | "stopped" | "no-longer";
/** Where in the customer journey it sits — or "outside" for what the app can't measure. */
export type ChallengeStage = FocusStage | "outside";
export type ChallengeSource = "onboarding" | "reported" | "ask" | "check-in" | "insight";

/** What the owner told us about this challenge in its short chat (their words, tidied). */
export interface ChallengeDetails {
  what?: string;
  since?: string;
  often?: string;
  tried?: string;
  /** What they think is causing it. */
  theory?: string;
  /** The one or two targeted questions picked for this challenge. */
  extra?: { key: string; question: string; answer: string }[];
}

/** One of the owner's own counts — the starting point or a check-in. */
export interface ChallengeReading {
  at: string;
  /** In the owner's words, e.g. "3 in 10", "1 or 2". */
  value: string;
  unit: CountUnit;
  measure?: string;
  stepId?: string;
  kind: "start" | "check-in";
}

export interface ChallengeLesson {
  at: string;
  text: string;
  stepId?: string;
}

/** The same problem described from another angle — linked instead of tracked twice. */
export interface ChallengeAngle {
  at: string;
  text: string;
  source: ChallengeSource;
  details?: ChallengeDetails;
}

export interface ChallengeOutcome {
  before?: string;
  after?: string;
  measure?: string;
  tried: string[];
  worked: string[];
  took?: string;
  /** What else changed at the same time, as the owner told us — honest credit. */
  otherChanges: string[];
  /** The owner's own words on what made the difference. */
  note?: string;
}

export interface Challenge {
  id: string;
  workspaceId: string;
  /** In the owner's own words. */
  title: string;
  stage: ChallengeStage;
  status: ChallengeStatus;
  source: ChallengeSource;
  /** The main problem the owner named in their checkup (its diagnosis may lead elsewhere, as before). */
  main?: boolean;
  reportedAt: string;
  /** True when the real date isn't known (a checkup from before challenges existed) — no date is shown. */
  reportedAtUnknown?: boolean;
  details?: ChallengeDetails;
  /** Its short chat. The challenge from the checkup keeps its answers in the checkup itself. */
  transcript?: TranscriptTurn[];
  /** True once its short chat is finished (or it came from the checkup). */
  chatDone?: boolean;
  /** Where its short chat stopped, so leaving halfway resumes at the same question. */
  chat?: { state: ChallengeChatState; chips: string[]; why?: string } | null;
  /**
   * Its own diagnosis while it is NOT being worked on. The one being worked on
   * keeps its diagnosis in the checkup (so every existing screen keeps working).
   */
  parked?: { diagnosis: DiagnosisContent | null; improved: ImprovedDiagnosis | null } | null;
  stepIds: string[];
  readings: ChallengeReading[];
  lessons: ChallengeLesson[];
  angles: ChallengeAngle[];
  /** Related challenges (same root cause, or the owner chose to keep them apart but connected). */
  linkedTo: string[];
  /** Place among the ones waiting (lower first). */
  order: number;
  /** Why the app suggested this place in the order. */
  orderReason?: string;
  /** Why it is being tackled first (when the app suggested it). */
  whyFirst?: string;
  focusedAt?: string;
  solvedAt?: string;
  stoppedAt?: string;
  outcome?: ChallengeOutcome;
  /** The owner said "not yet" to a solved suggestion — ask again only after a newer check-in. */
  solvedDeclinedAt?: string;
}

export const OPEN_STATUSES: ChallengeStatus[] = ["working", "up-next"];
export const isOpen = (c: Pick<Challenge, "status">) => OPEN_STATUSES.includes(c.status);

export const STATUS_META: Record<ChallengeStatus, { label: string; cls: string }> = {
  working: { label: "Working on now", cls: "border-brand-200 bg-brand-50 text-brand-700" },
  "up-next": { label: "Up next", cls: "border-slate-200 bg-slate-50 text-slate-700" },
  solved: { label: "Solved", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  stopped: { label: "Stopped", cls: "border-amber-200 bg-amber-50 text-amber-800" },
  "no-longer": { label: "No longer a problem", cls: "border-slate-200 bg-white text-slate-600" },
};

export const SOURCE_LABEL: Record<ChallengeSource, string> = {
  onboarding: "From your checkup",
  reported: "You reported it",
  ask: "Noticed in Ask",
  "check-in": "Noticed in a check-in",
  insight: "From your insights",
};

export function stageLabel(stage: ChallengeStage): string {
  if (stage === "outside") return "Outside what the app measures";
  return FOCUS_STAGES.find((s) => s.id === stage)?.label ?? "Your business";
}

/* ------------------------------------------------------------------ */
/* Reading the owner's words                                            */
/* ------------------------------------------------------------------ */

/** The owner's own costs going up (not customers saying something costs too much). */
const OWN_COSTS = String.raw`\bnepa\b|\bphcn\b|no light|(rising|high|higher|growing) costs|costs? (keep|kept|are|is|have|has)?\s*(rising|going up|went up|gone up|increas\w*|too high|high)|ingredients?|materials? (cost|price)|stock (costs?|prices?)|inflation|exchange rate|dollar rate|price of (stock|goods|materials|ingredients|fuel)|\brent\b|landlord|power|electricity|light bill|generator|\bfuel\b|diesel|petrol|suppliers?`;

const OUTSIDE_RE = new RegExp(
  String.raw`cash ?flow|money (is )?(tight|short)|short of (cash|money)|loans?\b|debts?\b|\btax(es)?\b|\bstaff\b|employees?|workers?|hir(e|ing)\b|apprentices?|helpers?|government|permits?|licen[cs]e|theft|stolen|health|\bsick\b|equipment|machines?\b|\b(oven|fridge|freezer|generator|vehicle|van|truck|motorbike)s?\b|break(s|ing)? down|broke down|keeps breaking|(get|getting|got) paid|pay(s|ing)? (me )?late|paid late|owe[sd]? me|debtors?|${OWN_COSTS}`,
  "i",
);

/** Goods sent back — wrong size, faulty, refunds — not customers "coming back". */
export function returnedGoods(text: string | undefined | null): boolean {
  return /return(s|ed|ing)? (the |my |their |some |a lot of )?(clothes|items?|goods|products?|orders?|parcels?|shoes|dresses|bags)|\brefunds?\b|\bexchanges?\b|wrong (size|item|colou?r)|(don'?t|doesn'?t|didn'?t) fit|damaged (items?|goods|on arrival)/i.test(text ?? "");
}

/** Where a challenge sits, read from the owner's words. null when it can't be told. */
export function stageOfText(text: string | undefined | null, facts?: Pick<BusinessFacts, "repeat"> | null): ChallengeStage | null {
  const t = (text ?? "").toLowerCase();
  if (!t.trim()) return null;
  // Profit is a pricing question (in scope) even though it mentions money.
  if (/profit|margin|undercharg|charg(e|ing) (too )?little|prices? (are |is )?too low/.test(t)) return "deliver";
  if (OUTSIDE_RE.test(t)) return "outside";
  if (returnedGoods(t)) return "deliver";
  if (/come back|coming back|order(ing)? again|buy(ing)? again|book(ing)? again|repeat|one-?off|loyal|regulars?|(don'?t|never|rarely) return/.test(t)) return "return";
  if (/too busy|\bbusy\b|no time|capacity|keep up|overwhelm|too much work|can'?t (handle|cope|take)|deliver(y|ies|ing)?|quality|mistakes|late orders/.test(t)) return "deliver";
  if (
    /(don'?t|do not|didn'?t|won'?t|never) (buy|pay|go ahead|book|order|commit|decide)|\b(few|hardly any(one)?|nobody|no one)\b.*\b(buy|order|pay|book)s?\b|\blikes?\b.*\bbut\b|not buying|ask(s|ing)? but|look(s|ing)? but|leave|walk (away|out)|go(es)? quiet|stop(s|ped)? replying|ghost|too expensive|costs? too much|price|haggl|bargain|take (long|ages|forever) to decide|decid|compar|cheaper|close|follow ?up|quote|turn(ing)?\b.*\binto\b|into paying/.test(
      t,
    )
  )
    return "convert";
  if (/(don'?t|do not|never|rarely) (call|message|reach|contact|get in touch|ask|enquire)|few (calls|messages|enquir)|not enough (enquir|messages|calls)/.test(t)) return "enquire";
  if (/slow (days|months|weeks|season|period|market)|quiet (days|months|weeks|season)|season|up and down|some months|not steady|inconsistent|irregular|\bdry\b|market (is |dey )?slow|business (is |dey )?slow|slow this (period|month|season)/.test(t)) {
    return /rarely|one-?off|\bno\b|few|not really/i.test(facts?.repeat ?? "") ? "return" : "found";
  }
  if (
    /not enough|too few|few (people|customers|clients|buyers|orders|sales)|nobody (knows|sabi)|no one knows|people (don'?t|do not|no) (know|sabi)|visib|known|reach|find (me|us)|hear(s|d)? about|new (customers|clients)|more (customers|clients|people|orders|sales|work)|slow (sales|business)|\bquiet\b|seeing my|coming in|sales (dey |are |is )?(drop|down|low|reduc|fall)|no (customers|clients|buyers|orders) yet|just (started|opened|began)|brand[- ]new|new business|starting out/.test(
      t,
    )
  )
    return "found";
  return null;
}

/** A rough topic, used to avoid offering or tracking the same problem twice. */
export function themeOf(text: string | undefined | null): string {
  const t = (text ?? "").toLowerCase();
  if (/cash ?flow|money (is )?(tight|short)|short of (cash|money)|(get|getting|got) paid|pay(s|ing)? (me )?late|paid late|owe[sd]? me|debtors?/.test(t)) return "cash";
  if (/\bstaff\b|employees?|workers?|hir(e|ing)|apprentices?|helpers?/.test(t)) return "staff";
  if (/profit|margin|undercharg|charg(e|ing) (too )?little|prices? (are |is )?too low/.test(t)) return "profit";
  if (new RegExp(OWN_COSTS, "i").test(t)) return "costs";
  if (/deliver(y|ies)|courier|dispatch|shipping/.test(t)) return "delivery";
  if (returnedGoods(t)) return "quality";
  const stage = stageOfText(t);
  if (stage === "return") return "return";
  if (stage === "deliver") return "capacity";
  if (stage === "convert") return "convert";
  if (/slow (days|months|weeks|season)|quiet (days|months|weeks|season)|season|up and down|some months|not steady/.test(t)) return "season";
  if (stage === "found" || stage === "enquire") return "demand";
  return `other:${t.replace(/[^a-z0-9]+/g, " ").trim().split(" ").slice(0, 4).join(" ")}`;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** The same words, ignoring case and punctuation. */
export function sameTitle(a: string, b: string): boolean {
  return norm(a) === norm(b);
}

const STAGE_VALUES: ChallengeStage[] = ["found", "enquire", "convert", "deliver", "return", "outside"];

/** A stage from untrusted text (a model, an old record), falling back to reading the title. */
export function asStage(v: unknown, title: string): ChallengeStage {
  return STAGE_VALUES.includes(v as ChallengeStage) ? (v as ChallengeStage) : stageOfText(title) ?? "found";
}

/** An open challenge that is probably the same problem (same topic, or nearly the same words). */
export function similarChallenge<T extends Pick<Challenge, "id" | "title" | "status">>(title: string, list: T[], excludeId?: string): T | null {
  const theme = themeOf(title);
  const n = norm(title);
  const open = list.filter((c) => isOpen(c) && c.id !== excludeId);
  const sameWords = open.find((c) => {
    const m = norm(c.title);
    return m === n || (n.length > 12 && m.includes(n)) || (m.length > 12 && n.includes(m));
  });
  if (sameWords) return sameWords;
  if (theme.startsWith("other:")) return null;
  return open.find((c) => themeOf(c.title) === theme) ?? null;
}

/* ------------------------------------------------------------------ */
/* "Is anything else holding you back?" — tap answers by business type  */
/* ------------------------------------------------------------------ */

export type BusinessKind = "service" | "b2b" | "food" | "retail" | "online" | "product";

/** What kind of business this is, from the owner's own answers (never from the workspace name). */
export function businessKind(input: { businessType?: string; sells?: string; targetMarket?: string; channels?: string[] }): BusinessKind {
  const what = `${input.sells ?? ""} ${input.businessType ?? ""}`.toLowerCase();
  const who = (input.targetMarket ?? "").toLowerCase();
  const how = (input.channels ?? []).join(" ").toLowerCase();
  const product =
    /\b(products?|goods|items?|stock|i sell|we sell|handmade|furniture|cloth\w*|fabric\w*|shoes?|bags?|jewel\w*|cosmetic\w*|skincare|perfume\w*|phones?|accessor\w*|gadgets?|electronic\w*|spare parts|wears?|e-?commerce|things i make|uniforms?|books?|stationer\w*|farm\w*|produce|eggs?|poultry|chickens?|fish|vegetables?|fruits?|grains?|livestock|goats?|cattle|feeds?)\b/.test(what) ||
    /sell products|i sell|we sell|make or stock/.test(what);
  const service =
    /\b(services?|i offer|we offer|do for people|repair\w*|fix(es|ing)?|clean\w*|salon\w*|barb\w*|hair\w*|nails?|makeup|tailor\w*|design\w*|consult\w*|tutor\w*|lessons?|train\w*|photograph\w*|events?|plumb\w*|electrician\w*|mechanic\w*|laundr\w*|logistic\w*|transport\w*|clinic\w*|therap\w*|coach\w*|agenc(y|ies)|studio\w*|develop\w*|marketing|accounting|legal|printing)\b/.test(what) ||
    /\b(build|make|design|develop)\w* (websites?|web ?apps?|apps?|software)\b/.test(what);
  if (
    /\b(food|bak\w*|cakes?|pastr\w*|bread|snacks?|small chops|meals?|restaurants?|eatery|kitchen|cater\w*|cook\w*|drinks?|juices?|smoothies?|cafe|coffee|grill\w*|suya|shawarma|pizza|lunch|breakfast|desserts?|ice cream|chops|chef)\b/.test(what)
  )
    return "food";
  const businessBuyers =
    /\b(businesses|business owners|compan(y|ies)|firms?|offices?|organi[sz]ations?|corporates?|brands?|schools?|hospitals?|churches|ngos?|government|shops|retailers?|resellers?|restaurants?|hotels?|contractors?)\b/.test(who);
  const peopleBuyers = /\b(people|individuals?|famil(y|ies)|homes?|households?|parents?|women|men|ladies|girls|boys|kids|children|students?|anyone|everyone|neighbou?rs|customers nearby|walk-?ins?)\b/.test(who);
  if ((businessBuyers && !peopleBuyers) || /\b(wholesal\w*|distribut\w*|b2b|suppl(y|ier|iers)|in bulk|bulk)\b/.test(what)) return "b2b";
  // "I sell…" leads: a seller who also mentions design or repairs is still a seller.
  const productLed = product && (!service || /\b(i|we) sell\b|sell products/.test(what));
  const onlineWords = /\b(online|web ?store|website|jumia|konga|etsy|amazon|shopify|instagram|facebook|tiktok)\b/;
  if (productLed && (onlineWords.test(what) || onlineWords.test(how))) return "online";
  if ((/\b(shop|store|boutique|stall|supermarket|pharmacy|kiosk|outlet|mart|market)\b/.test(what) || /walk[- ]?ins?/.test(how)) && (productLed || !service)) return "retail";
  if (productLed) return "product";
  return "service";
}

const CHIP_POOL: Record<BusinessKind, string[]> = {
  service: ["Not enough people asking", "Customers don't come back", "Too busy to take more work", "Finding good staff", "People ask but don't go ahead", "Getting paid on time"],
  b2b: ["Not enough new clients", "Clients take long to decide", "Clients pay late", "Cash flow", "Finding good staff", "Too busy to take more work"],
  food: ["Not enough customers", "Slow days or quiet months", "Ingredient costs keep rising", "Customers don't come back", "Finding good staff", "Can't keep up with orders"],
  retail: ["Not enough people coming in", "People look but don't buy", "Stock costs keep rising", "Slow days or quiet months", "Cash flow", "Customers don't come back"],
  online: ["Not enough people seeing my page", "People ask but don't order", "Delivery problems", "Customers don't order again", "Cash flow", "Costs keep rising"],
  product: ["Not enough people asking", "Customers don't order again", "Costs keep rising", "Can't make enough to keep up", "Cash flow", "Slow months"],
};

export const NONE_CHIP = "No, that's the main one";

/**
 * Tap answers for "Is anything else holding you back?" — fitted to the kind
 * of business, without repeating the problem they already named.
 */
export function otherChallengeChips(
  input: { businessType?: string; sells?: string; targetMarket?: string; channels?: string[]; bottleneck?: string },
  existingTitles: string[] = [],
  opts: { includeNone?: boolean; limit?: number } = {},
): string[] {
  const kind = businessKind(input);
  const taken = new Set([themeOf(input.bottleneck), ...existingTitles.map((t) => themeOf(t))].filter((t) => !t.startsWith("other:")));
  const picked = CHIP_POOL[kind].filter((c) => !taken.has(themeOf(c))).slice(0, opts.limit ?? 5);
  return opts.includeNone === false ? picked : [...picked, NONE_CHIP];
}

const NONE_RE =
  /^(i\s+)?(no+|nope|nah|no o|nothing( else)?|none|not really|not sure|don'?t know|do not know|idk|dunno|skip( this)?|that'?s (it|all|the main (one|thing))|just (that|this|the one)|only (that|this)( one)?|na only (that|this)( one)?|na (that|this) one|e no (get|dey)|no be|no,? that'?s the main one)\b/i;
/** A bare "yes" or "everything" names nothing — ask again rather than record it. */
const UNCLEAR_RE = /^(yes|yeah|yep|yup|ok(ay)?|sure|true|everything|all of (it|them)|all|plenty|many|a lot|loads|too many)\W*$/i;

/**
 * The owner's answer to "anything else?", split into up to 3 challenges in their own words.
 * [] = "no, that's the main one"; null = it names nothing yet (a bare "yes") — ask once more.
 */
export function parseOtherChallenges(answer: string, main?: string): string[] | null {
  let a = answer.replace(/\s+/g, " ").trim();
  if (!a) return [];
  if (UNCLEAR_RE.test(a)) return null;
  if (NONE_RE.test(a)) {
    // "No, but cash flow is also hard" — the part after "but" is a real answer.
    const rest = a.match(/\b(but|except|apart from|although)\b\s*(.*)$/i)?.[2]?.trim() ?? "";
    if (!rest || NONE_RE.test(rest) || rest.split(/\s+/).length < 2) return [];
    a = rest.replace(/\b(is|are) (also )?(a )?(problem|hard|issue|wahala)\b.*$/i, "").replace(/\balso\b/i, "").trim() || rest;
  }
  const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
  const known = (s: string) => !themeOf(s).startsWith("other:");
  const parts: string[] = [];
  for (const piece of a.split(/\s*(?:;|,|\n|\/|&|\.\s)\s*/)) {
    const sub = piece.split(/\s+(?:and also|also|and|plus|n)\s+/i);
    if (sub.length > 1 && sub.every((s) => words(s) >= 2 || known(s))) parts.push(...sub);
    else parts.push(piece);
  }
  const mainN = norm(main ?? "");
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const clean = shorten(tidyOwnerText(p.replace(/^(and|also|plus|but|oh|um+)\s+/i, "").replace(/[.!]+$/, "")), 80);
    const n = norm(clean);
    if (clean.length < 3 || NONE_RE.test(clean) || seen.has(n) || (mainN && n === mainN)) continue;
    seen.add(n);
    out.push(clean);
  }
  return out.slice(0, 3);
}

/* ------------------------------------------------------------------ */
/* The suggested order — which one first, and why                       */
/* ------------------------------------------------------------------ */

export interface ChallengePlanItem {
  id: string;
  reason: string;
}

export interface ChallengePlan {
  focusId: string;
  /** One plain sentence: why this one comes first. */
  whyFirst: string;
  /** The others, in the suggested order, each with a short reason. */
  order: ChallengePlanItem[];
}

type PlanInput = Pick<Challenge, "id" | "title" | "stage" | "status" | "source">;

const FULL_RE = /\b(no|not really|full|can't|cannot|couldn't|could not|already busy|need help|stretched)\b/i;

function monthlyWords(v: string): string {
  const t = v
    .replace(/^(about|around|roughly|maybe|probably|approximately)\s+/i, "")
    .replace(/\s*(a|per|each|every) month\b.*$/i, "")
    .replace(/\s*monthly\b.*$/i, "")
    .trim();
  return /\d/.test(t) ? `about ${t}` : t.toLowerCase();
}

/** True when the owner said only a handful of people ask in a normal month. */
export function fewAsking(facts: Pick<BusinessFacts, "monthlyEnquiries"> | null | undefined): boolean {
  const v = facts?.monthlyEnquiries ?? "";
  if (!v) return false;
  const r = parseCount(v);
  if (r) return r.high <= 5;
  return /\b(few|hardly|not many|very little|none|nobody|no one)\b/i.test(v);
}

function capacityFull(facts: Pick<BusinessFacts, "capacity"> | null | undefined): boolean {
  const c = facts?.capacity ?? "";
  return FULL_RE.test(c) && !/\b(yes|easily|plenty)\b/i.test(c);
}

const STAGE_NEXT_REASON: Record<ChallengeStage, string> = {
  found: "More people hearing about you lifts everything else.",
  enquire: "A clearer way to get in touch catches people who are already interested.",
  convert: "Once people are asking, winning more of them is the next lever.",
  deliver: "Worth sorting before more work comes in.",
  return: "Bringing past customers back is usually the cheapest growth.",
  outside: "Outside what the app can measure — kept on your list so it isn't forgotten.",
};

/**
 * Decide which challenge to tackle first, from the owner's own answers:
 * the one blocking the others first (already full → capacity; only a handful
 * of people asking → getting found), otherwise the one they said feels
 * hardest. Things the app can't measure go last unless nothing else is open.
 */
export function planOrder(facts: BusinessFacts | null, list: PlanInput[], mainId?: string): ChallengePlan | null {
  const open = list.filter((c) => c.status === "working" || c.status === "up-next");
  if (open.length === 0) return null;
  const main = open.find((c) => c.id === mainId) ?? open.find((c) => c.status === "working") ?? open[0];
  const inScope = open.filter((c) => c.stage !== "outside");
  let focus = main;
  let whyFirst = open.length > 1 ? "You told us this is what feels hardest, and nothing in your answers says another one is blocking it." : "It's what you told us is holding the business back.";

  const deliverC = inScope.find((c) => c.stage === "deliver");
  const demandC = inScope.find((c) => c.stage === "found" || c.stage === "enquire");
  if (capacityFull(facts) && deliverC && main.stage !== "deliver") {
    focus = deliverC;
    whyFirst = "You said you're already full, so more customers would only stretch you further — freeing up time, or charging more, comes first.";
  } else if (fewAsking(facts) && demandC && main.stage !== "found" && main.stage !== "enquire" && main.stage !== "outside") {
    focus = demandC;
    whyFirst = `With ${monthlyWords(facts?.monthlyEnquiries ?? "")} people asking in a normal month, winning more of them can only add a little — getting more people to ask comes first.`;
  } else if (main.stage === "outside" && inScope.length > 0) {
    focus = inScope[0];
    whyFirst =
      themeOf(main.title) === "cash"
        ? `“${shorten(main.title, 40)}” matters and stays on your list, but the app can't see it directly. More paying customers often eases it, so we'll start where the app can help most.`
        : `“${shorten(main.title, 40)}” matters and stays on your list, but it's outside what the app can measure — so we'll start where the app can help most.`;
  }

  const rest = open.filter((c) => c.id !== focus.id);
  const ordered = [...rest.filter((c) => c.stage !== "outside"), ...rest.filter((c) => c.stage === "outside")];
  const order = ordered.map((c) => ({
    id: c.id,
    reason:
      c.id === main.id && main.id !== focus.id
        ? main.stage === "outside"
          ? STAGE_NEXT_REASON.outside
          : "You said this feels hardest — it's next, once the first one is moving."
        : STAGE_NEXT_REASON[c.stage],
  }));
  return { focusId: focus.id, whyFirst, order };
}

/* ------------------------------------------------------------------ */
/* Facts as they apply to one challenge                                 */
/* ------------------------------------------------------------------ */

/** True when the words clearly name something the app can't see (cash, staff, rent, costs, equipment…). */
export function clearlyOutside(text: string | undefined | null): boolean {
  return OUTSIDE_RE.test(text ?? "") && stageOfText(text) === "outside";
}

/** Their own view of the cause, in their voice ("They think the move…" → "The move…"). */
export function ownerVoice(text: string): string {
  const t = text.replace(/^\s*(they|the owner|you)\s+(think|thinks|believe|believes|feel|feels|suspect|suspects|reckon|reckons)\s+(that\s+)?/i, "").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}

/** The business facts with this challenge as "where it feels stuck" (for its diagnosis). */
export function factsForChallenge(facts: BusinessFacts, c: Pick<Challenge, "title" | "details" | "source">, isFocus = false): BusinessFacts {
  const theory = c.details?.theory ?? (isFocus ? facts.ownerTheory : undefined);
  return { ...facts, bottleneck: c.title, ownerTheory: theory };
}

/** The challenge's own answers, as plain lines for a prompt. */
export function detailLines(d: ChallengeDetails | undefined): string[] {
  if (!d) return [];
  const rows: [string, string | undefined][] = [
    ["What's happening", d.what],
    ["Since when", d.since],
    ["How often / how big", d.often],
    ["What they've tried", d.tried],
    ["What they think is causing it", d.theory],
  ];
  const lines = rows.filter((r): r is [string, string] => typeof r[1] === "string" && r[1].trim().length > 0).map(([k, v]) => `- ${k}: ${v}`);
  for (const e of d.extra ?? []) if (e.answer.trim()) lines.push(`- ${e.question} → ${e.answer}`);
  return lines;
}

/* ------------------------------------------------------------------ */
/* Evidence — suggested "solved", "not moving", the outcome             */
/* ------------------------------------------------------------------ */

/** Whether a higher count is better for this measure ("days money was short" is better lower). */
export function higherIsBetter(measure?: string): boolean {
  return !/(days?|times?|weeks?)\b.*\b(short|tight|without|missed|lost)|\blate\b|complain|returns?\b|cancel|mistakes|owed|waste|hours? .*(someone else|could do)|happened/i.test(measure ?? "");
}

function better(start: ChallengeReading, r: ChallengeReading): boolean {
  const a = countValue(start.value, start.unit);
  const b = countValue(r.value, r.unit);
  if (a === null || b === null) return false;
  return higherIsBetter(start.measure) ? b - a > 0.5 : a - b > 0.5;
}

export function startReading(c: Pick<Challenge, "readings">): ChallengeReading | null {
  return c.readings.find((r) => r.kind === "start") ?? null;
}

/** Latest count that can be compared with the starting one (same unit, same thing counted). */
export function latestComparable(c: Pick<Challenge, "readings">): ChallengeReading | null {
  const start = startReading(c);
  if (!start) return null;
  const later = c.readings.filter((r) => r.kind === "check-in" && r.unit === start.unit && (r.measure ?? "") === (start.measure ?? "") && r.at >= start.at);
  return later.length ? later[later.length - 1] : null;
}

/** "Looks solved": the last two check-ins were both better than where they started. */
export function solvedEvidence(c: Challenge): { start: ChallengeReading; latest: ChallengeReading; text: string } | null {
  if (c.status !== "working") return null;
  const start = startReading(c);
  if (!start) return null;
  const later = c.readings.filter((r) => r.kind === "check-in" && r.unit === start.unit && (r.measure ?? "") === (start.measure ?? "") && r.at >= start.at);
  if (later.length < 2) return null;
  const lastTwo = later.slice(-2);
  if (!lastTwo.every((r) => better(start, r))) return null;
  if (c.solvedDeclinedAt && lastTwo[1].at <= c.solvedDeclinedAt) return null;
  return {
    start,
    latest: lastTwo[1],
    text: `Your last two check-ins were both better than where you started (${start.value} → ${lastTwo[0].value}, then ${lastTwo[1].value}).`,
  };
}

interface StepLike {
  id: string;
  status: string;
  acceptedAt: string;
  step: Pick<NextStep, "title" | "kind" | "measure">;
  result?: { verdict: CheckInVerdict; summary: string; after?: string; at: string };
  checkIns: { doneAt?: string; answers?: { id: string; answer: string }[] }[];
}

/** Two finished steps that didn't move it: say so plainly and change approach. */
export function stuckEvidence(c: Pick<Challenge, "stepIds" | "status">, steps: StepLike[]): { titles: string[]; text: string } | null {
  if (c.status !== "working") return null;
  const linked = steps.filter((s) => c.stepIds.includes(s.id)).sort((a, b) => a.acceptedAt.localeCompare(b.acceptedAt));
  const isFlat = (s: StepLike) => s.status === "done" && (s.result?.verdict === "no-change" || s.result?.verdict === "worse");
  // Once a new step is under way, the approach has already changed.
  const last = linked[linked.length - 1];
  if (!last || !isFlat(last)) return null;
  const flat = linked.filter(isFlat);
  if (flat.length < 2) return null;
  const titles = flat.map((s) => s.step.title);
  return {
    titles,
    text: `Two steps haven't moved this yet (“${shorten(titles[0], 50)}” and “${shorten(titles[1], 50)}”). That's useful: it says the cause is probably somewhere else, so it's time to change approach rather than push harder.`,
  };
}

/** Plain length of time between two dates. */
export function durationText(fromIso: string, toIso: string): string {
  const days = Math.max(0, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 86_400_000));
  if (days < 1) return "less than a day";
  if (days === 1) return "1 day";
  if (days < 14) return `${days} days`;
  if (days < 60) return `about ${Math.round(days / 7)} weeks`;
  return `about ${Math.round(days / 30)} months`;
}

const NOTHING_RE = /nothing (else )?(changed|reported)|no other changes|as far as you know/i;

/** What other changes the owner reported while these steps ran (for honest credit). */
export function otherChangesFor(stepIds: string[], steps: StepLike[], experiments: { coachStepId?: string; otherChanges: string[] }[]): string[] {
  const out = new Set<string>();
  for (const e of experiments) if (e.coachStepId && stepIds.includes(e.coachStepId)) e.otherChanges.filter((x) => !NOTHING_RE.test(x)).forEach((x) => out.add(x));
  for (const s of steps) {
    if (!stepIds.includes(s.id)) continue;
    for (const ci of s.checkIns) {
      const a = ci.answers?.find((x) => x.id === "changes")?.answer?.trim();
      if (a && !/^(nothing|no|none|nope)\b/i.test(a) && !NOTHING_RE.test(a)) out.add(a);
    }
  }
  return [...out].slice(0, 6);
}

export function outcomeFor(c: Challenge, steps: StepLike[], experiments: { coachStepId?: string; otherChanges: string[] }[], solvedAt: string, note?: string): ChallengeOutcome {
  const linked = steps.filter((s) => c.stepIds.includes(s.id)).sort((a, b) => a.acceptedAt.localeCompare(b.acceptedAt));
  const start = startReading(c);
  const latest = latestComparable(c);
  const worked = linked.filter((s) => s.result?.verdict === "working").map((s) => s.step.title);
  const from = linked[0]?.acceptedAt ?? c.focusedAt ?? c.reportedAt;
  return {
    before: start?.value,
    after: latest?.value,
    measure: start?.measure,
    tried: linked.map((s) => s.step.title),
    worked,
    took: durationText(from, solvedAt),
    otherChanges: otherChangesFor(c.stepIds, steps, experiments),
    note: note?.trim() ? shorten(note.trim(), 240) : undefined,
  };
}

/** The counts for the summary at the top of the Challenges page. */
export function challengeSummary(list: Challenge[], steps: { workspaceId: string; step: Pick<NextStep, "kind"> }[]) {
  const own = steps.filter((s) => s.workspaceId === "user-workspace");
  return {
    solved: list.filter((c) => c.status === "solved").length,
    working: list.filter((c) => c.status === "working").length,
    waiting: list.filter((c) => c.status === "up-next").length,
    stopped: list.filter((c) => c.status === "stopped").length,
    noLonger: list.filter((c) => c.status === "no-longer").length,
    experiments: own.filter((s) => s.step.kind === "experiment").length,
    steps: own.length,
    lessons: list.reduce((n, c) => n + c.lessons.length, 0),
  };
}

/* ------------------------------------------------------------------ */
/* Things the app can't measure — an honest note and a sensible start   */
/* ------------------------------------------------------------------ */

export type OutsideKind = "cash" | "staff" | "costs" | "other";

export function outsideKind(text: string): OutsideKind {
  const t = themeOf(text);
  if (t === "cash") return "cash";
  if (t === "staff") return "staff";
  if (t === "costs") return "costs";
  return "other";
}

export function outsideNote(title: string): string {
  const k = outsideKind(title);
  const what = k === "cash" ? "your cash" : k === "staff" ? "hiring" : k === "costs" ? "your costs" : "this";
  return `I can't see ${what} — it happens outside the app. It stays on your list so it isn't forgotten, and any step for it is one you count yourself.`;
}

const OUTSIDE_STEPS: Record<OutsideKind, NextStep> = {
  cash: {
    kind: "recommendation",
    title: "Write down money in and money out for two weeks",
    why: "Seeing when money comes in and goes out shows where it gets tight — and what to change first.",
    how: ["Each evening, note what came in and what went out", "Mark the days money felt tight", "At the end, circle your three biggest costs and your slowest days"],
    days: 14,
    measure: "Days money felt tight",
    unit: "count",
    countHow: "A line a day in your notebook: in, out, and a mark when money felt tight.",
    draft: null,
  },
  staff: {
    kind: "recommendation",
    title: "Write down exactly the help you need",
    why: "A clear description of the work attracts the right people and makes it easier to hand tasks over.",
    how: ["List the tasks the person must do well, and the ones you can teach", "Ask people you trust to pass it on", "Try promising people on a short, paid trial first"],
    days: 14,
    measure: "How many suitable people you spoke to",
    unit: "count",
    countHow: "A tally in your notebook: one line for each suitable person you spoke to.",
    draft: { kind: "whatsapp", label: "Write the message about the job", purpose: "A short message to people I trust, describing the help I need so they can pass it on" },
    draftIsMain: false,
  },
  costs: {
    kind: "recommendation",
    title: "List your biggest costs and ask for one better price",
    why: "A few costs usually make up most of the spending — one better price there is worth more than many small savings.",
    how: ["Write down your five biggest regular costs", "For the biggest one, ask two other sellers for a price", "Decide whether some of the rise needs to go into your own prices"],
    days: 14,
    measure: "How many better prices you found",
    unit: "count",
    countHow: "A short list in your notebook: who you asked and the price they gave.",
    draft: { kind: "whatsapp", label: "Write the message asking for a price", purpose: "Asking a supplier for their best price on something I buy regularly" },
    draftIsMain: false,
  },
  other: {
    kind: "recommendation",
    title: "Note when it happens and what it costs you",
    why: "Writing it down for two weeks shows how big it really is and what sets it off.",
    how: ["Each time it happens, note the day and what happened", "Note what it cost you — time, money or a customer", "At the end, look for a pattern"],
    days: 14,
    measure: "How many times it happened",
    unit: "count",
    countHow: "A line in your notebook each time it happens.",
    draft: null,
  },
};

export function templateOutsideStep(title: string): NextStep {
  return OUTSIDE_STEPS[outsideKind(title)];
}

/** A plain, honest read for something the app can't measure (used when the model is unreachable). */
export function templateOutsideDiagnosis(c: Pick<Challenge, "title" | "details">): DiagnosisContent {
  const step = templateOutsideStep(c.title);
  return {
    version: 2,
    headline: `${shorten(c.title, 70)} — outside what the app can see, but not forgotten`,
    insight: "When something like this happens outside the app, the first useful step is seeing exactly when and how often it hits — that shows what to change first.",
    working: "You've named it, which is the first step to sorting it.",
    story: c.details?.what ? `You told us: ${shorten(c.details.what, 160)}` : `You told us “${shorten(c.title, 80)}” is holding the business back.`,
    meaning: outsideNote(c.title),
    whyItMatters: "Problems like this quietly take time and money away from growing the business, so it's worth seeing clearly.",
    nextInvestigation: "Start by writing down when it happens for two weeks — then we'll know where to act.",
    deltas: [],
    confidence: 45,
    steps: step.how,
    tools: [],
    stake: null,
    nextStep: step,
    checked: true,
  };
}

/* ------------------------------------------------------------------ */
/* The list as the AI sees it                                           */
/* ------------------------------------------------------------------ */

export interface ChallengeContextItem {
  id: string;
  title: string;
  status: ChallengeStatus;
  stage: string;
  note?: string;
}

export function challengesContext(list: Challenge[]): ChallengeContextItem[] {
  return list.slice(0, 12).map((c) => ({
    id: c.id,
    title: shorten(c.title, 90),
    status: c.status,
    stage: stageLabel(c.stage),
    note:
      c.status === "solved"
        ? c.outcome?.worked.length
          ? `what worked: ${c.outcome.worked.join("; ")}`
          : undefined
        : c.status === "stopped" && c.lessons.length
          ? `learned: ${c.lessons[c.lessons.length - 1].text}`
          : isOpen(c) && c.details?.tried?.trim()
            ? // So advice doesn't suggest what the owner already tried.
              `already tried: ${shorten(tidyOwnerText(c.details.tried), 120)}`
            : undefined,
  }));
}

/** Words that show the owner is describing a problem (not just asking how to do something). */
export const PROBLEM_RE =
  /problem|struggl|hard|difficult|can'?t|cannot|couldn'?t|not enough|too (few|many|much|expensive|slow|busy)|losing|lost|no one|nobody|stopped|slow|late|expensive|costs?\b|stuck|worr|issue|trouble|complain|leav|left|quit|don'?t|doesn'?t|won'?t|didn'?t|never|fewer|less|dropp|fall|fell|short|owe|broke|stolen|sick|tight|keep (rising|going up)|went up|gone up/i;

/** Words that plainly report something going wrong (a typed check-in answer worth offering as a challenge). */
export const CLEAR_PROBLEM_RE =
  /\b(broke|broken|breaks? down|breaking down|quit|resigned|left (me|us|the job|work)|stopped (working|coming|supplying|delivering|paying)|stolen|robbed|sick|ill\b|went up|gone up|keeps? (rising|going up|failing|breaking)|lost (my|our|a|the)|no (light|power|water)|can'?t (afford|pay|get|find|finish|keep)|struggl\w*|owe[sd]?\b|complain\w*|late (deliver\w*|payments?)|deliver\w* (were|was|are|is) late)/i;

/** A model's suggestion of a new challenge, checked against the list (null when it isn't one). */
export function cleanNoticed(
  raw: unknown,
  ownerText: string,
  list: { id: string; title: string; status: string }[],
): { title: string; stage: ChallengeStage; sameAs: string | null; why?: string } | null {
  if (!raw || typeof raw !== "object") return null;
  if (!PROBLEM_RE.test(ownerText)) return null;
  const o = raw as Record<string, unknown>;
  const title = shorten(tidyOwnerText(String(o.title ?? "").replace(/^["“]|["”]$/g, "")), 80);
  if (title.length < 6) return null;
  const stageRaw = String(o.stage ?? "");
  const stage: ChallengeStage = clearlyOutside(title)
    ? "outside"
    : stageRaw === "outside" || FOCUS_STAGES.some((s) => s.id === stageRaw)
      ? (stageRaw as ChallengeStage)
      : stageOfText(title) ?? "found";
  const ids = new Set(list.filter((c) => c.status === "working" || c.status === "up-next").map((c) => c.id));
  let sameAs = typeof o.sameAs === "string" && ids.has(o.sameAs) ? o.sameAs : null;
  if (!sameAs) {
    const sim = similarChallenge(title, list.map((c) => ({ id: c.id, title: c.title, status: c.status as ChallengeStatus })));
    if (sim) sameAs = sim.id;
  }
  // Already on the list in nearly the same words: nothing new to add.
  const exact = list.find((c) => norm(c.title) === norm(title));
  if (exact) return null;
  const why = typeof o.why === "string" && o.why.trim().length > 8 ? shorten(o.why.trim(), 200) : undefined;
  return { title, stage, sameAs, why };
}
