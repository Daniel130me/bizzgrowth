// Pure guards for one checkup turn (used by POST /api/checkup/chat).
//
// The model writes the reply and suggests what it learned; these decide what
// the reply's question is really about, and whether what it recorded is what
// the owner actually said — so a figure the model worked out never becomes
// the owner's answer, and a trend they never gave is never recorded.

import type { SlotKey } from "./checkup";
import { wordsToDigits } from "./checkup-math";
import { collectAllowedNumbers, ungroundedNumbers } from "./grounding";

// A clause that asks something starts like a question (optionally after a soft lead-in).
const ASKS = /^(?:(?:and|so|also|then|roughly|about|just|quickly|briefly|honestly)[,\s]+)*(?:who|what|which|where|when|why|how|do|does|did|is|are|was|were|can|could|would|should|will|have|has|any|out of|tell me|describe|explain)\b/i;

/**
 * The part of a reply that actually asks: the last sentence with a "?", cut
 * down to its asking clause. A lead-in before a ";" or ":" ("I've got the
 * monthly picture; what do you sell?") and an options list after a dash
 * ("…find you — walk-ins, repeat customers, referrals?") are not the question.
 */
export function questionCore(reply: string): string {
  const sentences = reply.split(/(?<=[.!?])\s+/).filter((s) => s.includes("?"));
  const q = (sentences[sentences.length - 1] ?? "").trim();
  if (!q) return "";
  const clauses = q
    .split(/\s*(?:;|:|—|–|\s-\s)\s*/)
    .map((c) => c.trim())
    .filter(Boolean);
  if (clauses.length <= 1) return q;
  return clauses.find((c) => ASKS.test(c)) ?? clauses[clauses.length - 1];
}

/**
 * What the reply's question is really about — read from the question itself,
 * because the model's own label ("nextSlot") is sometimes wrong, and a wrong
 * label made correct answers look unanswered.
 */
export function classifyQuestion(reply: string): SlotKey | null {
  const q = questionCore(reply).toLowerCase();
  if (!q) return null;
  const rules: [RegExp, SlotKey][] = [
    // "What do you think is causing them to drop off after you give the price?" asks for their view,
    // not how they give the price — so this is read first.
    [/(what|why) do you think|behind (that|this|it|the)|what('s| is) causing|any (idea|hunch|theory)|reason (for|behind) (that|this|it)|something else you've noticed/, "ownerTheory"],
    // Money trouble — read before the questions about price, cost and "how much".
    [/anything else (you )?(owe|due|to pay)|else (is )?(due|owed)|owe anyone|(other|any) (debts?|loans?|payments? (due|coming))|another (loan|payment)|borrowed/, "otherDebts"],
    [/how much (cash|money)\b[^?]*\b(have|got|on hand|in hand|in the bank|right now|today)|cash (do you have|on hand|in hand)/, "cashNow"],
    [/(normal|typical|usual|good|bad) (day|week)\b|comes? in (from sales|each|a )|takings|money (comes in|coming in|in and out)|main (running )?costs|biggest (costs|things you pay)/, "moneyInOut"],
    [/(last )?(change|changed|raise|raised|increase|increased) (your )?prices|prices (stayed|been) the same|prices? last/, "pricesChanged"],
    [/\b(fees?|commission|cut|charge)\b[^?]*\b(apps?|platforms?|marketplace|card machine|pos)\b|\b(apps?|platforms?)\b[^?]*\b(fees?|commission|cut|charge)\b/, "platformFees"],
    [/agreed (to )?(a )?(part payment|payment plan|instal)|let you pay (in parts|in instal|part)|been flexible|payment plan before|part payment before|pay in parts before/, "owedFlex"],
    [/(what|how much) (exactly )?is due|by what date|how much do you have to pay|when is it due/, "moneyDue"],
    [/how (were|are|was) you (planning|going|hoping) to (cover|pay|find|raise|get)|plan(ning)? to (cover|pay|raise)|where (were|are) you (going|planning) to (find|get)|where will the (rest|money) come from/, "coverPlan"],
    // Only "how many of the people who ask go on to pay" — not "how many people ask about buying".
    [/out of (how many|every|the|those|all)\b|how many (of them|of those)\b|how many\b[^?]*\b(go on to|end up|actually|go ahead|decide to)\b|go ahead and pay|how many\b[^?]*\b(pay|paid|paying)\b/, "closeRate"],
    [/(each|a|per|normal|typical|usual) month|monthly/, "monthlyEnquiries"],
    [/twice as many|room for more|more work (right now|than)|handle (the|more|that|it)|already (quite )?full|capacity/, "capacity"],
    [/come back|order again|buy again|one-?off|returning|repeat/, "repeat"],
    [/examples|past work|portfolio|samples|photos of|reviews|testimonials|results from|show (new )?(people|customers)/, "proof"],
    [/how (quickly|fast|soon)|get back to|respond to|check (back|in)|follow[- ]?up|call (them )?back|second message|go(es)? quiet|chase/, "followUp"],
    [/don't go ahead|doesn't go ahead|don't buy|didn't buy|reason they give|what do they (usually )?say|why (they|people) (don't|didn't)/, "lostReason"],
    [/get your price|give (your|the|a) price|send (your|the|a) price|written quote|how do you (usually )?(price|quote)/, "pricePresentation"],
    [/how much|cost|typical (job|project|order)|pay you for|bring in|worth|spend on/, "jobValue"],
    [/anything else (that'?s |is )?(holding|getting in the way|making (it|growth) hard|stopping)|else (is )?(holding|making growth hard)|other (problems|challenges|things holding)/, "otherChallenges"],
    [/stuck|hardest|holding .* back|biggest challenge|main challenge|struggl/, "bottleneck"],
    [/find you|hear about you|come from|reach you|discover/, "channels"],
    [/who (usually |mostly |normally )?(pays|buys|orders)|who is it (usually|mostly|normally)|which (kind|type) of (client|customer)|your (usual |typical )?(clients|customers) are|kind of (client|customer|person)|(people|customers) (who )?(buy|order) from you most/, "targetMarket"],
    [/what (does your business|do you) (do|sell|offer)|what exactly do/, "sells"],
    [/one thing you would|most like to (get better|improve)|three months/, "goal"],
  ];
  for (const [re, slot] of rules) if (re.test(q)) return slot;
  return null;
}

function periodOf(text: string): "day" | "week" | "month" | "year" | null {
  if (/\b(day|days|daily)\b/i.test(text)) return "day";
  if (/\b(week|weeks|weekly)\b/i.test(text)) return "week";
  if (/\b(year|years|yearly|annual|annually)\b/i.test(text)) return "year";
  if (/\b(month|months|monthly)\b/i.test(text)) return "month";
  return null;
}

/**
 * Did the owner give this count — or did the model work it out ("20 a day" recorded as
 * "about 600 a month")? Every number must be one they said, and the period must be theirs.
 */
export function countFromOwner(value: string, ownerWords: string): boolean {
  const said = wordsToDigits(ownerWords.toLowerCase()).replace(/,/g, "");
  const theirs = new Set((said.match(/\d+(?:\.\d+)?/g) ?? []).map(Number));
  const nums = (wordsToDigits(value.toLowerCase()).replace(/,/g, "").match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
  if (nums.some((n) => !theirs.has(n))) return false;
  const recorded = periodOf(value);
  const given = periodOf(said);
  return !(recorded && given && recorded !== given);
}

/** Did the owner give this amount (in any format: "50k", "₦50,000", "fifty thousand")? */
export function amountFromOwner(value: string, ownerWords: string): boolean {
  return ungroundedNumbers(value, collectAllowedNumbers(ownerWords)).length === 0;
}

// A reaction that rules on the cause ("it's timing, not demand", "not the business itself").
// The checkup only listens; the diagnosis weighs the owner's view against their figures.
const JUDGES_CAUSE =
  /\b(not (just |only |really )?(the business|demand|an? (day-to-day |daily |weekly |monthly |real |normal |underlying )?(sales|demand|business|trading|cash[- ]flow) (problem|issue)|(weak|low) (demand|sales)|your sales|the food business|the kitchen)|more than (demand|sales)|rather than (demand|sales)|(it'?s|it is|that'?s|this is|sounds like|looks like) (just |mainly |mostly |really |more |only )?(a )?(cash[- ])?(timing|rent[- ]timing|one[- ]off)( problem| issue| squeeze| gap)?|(that|this|it|which) points? to\b|points? to (cash |rent )?timing|(the )?(real|main|big|biggest) (squeeze|problem|issue|pressure( point)?) is|is the (main |real |big |biggest )?(squeeze|problem|issue|pressure( point)?)\b|(even )?(a|your) (steady|healthy|good|strong|solid|sound|stable) (business|shop|trade|company)|business itself is (fine|ok|okay|healthy)|nothing (is )?wrong with the business|the business is (fine|ok|okay|healthy|steady|sound|solid))/i;

const NEUTRAL_ACKS = ["Thanks — noted.", "Got it.", "That's useful to know.", "Thanks, that helps."];

/**
 * Drop any sentence that rules on what is causing the problem, keeping the
 * question. If nothing is left before the question, a plain acknowledgement
 * takes its place. Returns the reply unchanged when nothing judges.
 */
export function neutralReply(reply: string, turn = 0): string {
  let changed = false;
  const kept = reply
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .map((s) => {
      if (!s.includes("?")) {
        if (!JUDGES_CAUSE.test(s)) return s;
        changed = true;
        return "";
      }
      // In the sentence that asks, only the judging clauses before the question go.
      const clauses = s.split(/\s*(?:;|—|–)\s*/);
      if (clauses.length < 2) return s;
      const lead = clauses.slice(0, -1).filter((c) => {
        const judges = JUDGES_CAUSE.test(c);
        if (judges) changed = true;
        return !judges;
      });
      const asks = clauses[clauses.length - 1];
      return lead.length ? [...lead, asks].join(" — ") : asks.replace(/^./, (c) => c.toUpperCase());
    })
    .filter(Boolean);
  if (!changed) return reply;
  // Something must come before the question: what's left of the lead, or a plain acknowledgement.
  const hasLead = kept.length > 0 && (!kept[0].includes("?") || / — /.test(kept[0]));
  return (hasLead ? kept : [NEUTRAL_ACKS[turn % NEUTRAL_ACKS.length], ...kept]).join(" ").trim();
}

/**
 * Right after the owner gives their own explanation of the problem, the reply only listens:
 * whatever came before the question becomes a plain thank-you. Agreeing ("that makes sense —
 * it's the lump sum, not the trading") can be worded endlessly, and the diagnosis is where
 * their view is weighed against their figures.
 */
export function listenOnly(reply: string): string {
  const sentences = reply.split(/(?<=[.!?])\s+/).filter(Boolean);
  const q = sentences.findIndex((s) => s.includes("?"));
  if (q <= 0) return reply;
  return ["Thanks — it helps to hear it in your own words.", ...sentences.slice(q)].join(" ");
}

/**
 * A tap answer the owner could really send: not a fill-in template ("About ₦_____ a week"),
 * and — for money questions — no figure they never gave ("About 5%"), which a tired owner
 * might tap and which would then become "their" number.
 */
export function usableChip(chip: string, opts: { money?: boolean; ownerText?: string } = {}): boolean {
  if (/_{2,}|\[|\]|\.{3}|…|\bxx+\b|\?{2,}/i.test(chip)) return false;
  if (opts.money && /\d/.test(chip) && !amountFromOwner(chip, opts.ownerText ?? "")) return false;
  return true;
}

const CHANGE_WORDS =
  /\b(more|less|fewer|same|similar|up|down|increas\w*|decreas\w*|drop\w*|fell|fall\w*|grow\w*|grew|rise|rising|rose|better|worse|higher|lower|than|last (week|month|year)|before|steady|flat|stable|slow\w*|busier|quieter|picking up|dried up)\b/i;

/** A trend ("more / fewer / about the same") is only recorded when the owner talked about a change. */
export function ownerSpokeOfChange(text: string): boolean {
  return CHANGE_WORDS.test(text);
}
