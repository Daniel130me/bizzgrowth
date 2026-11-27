// How the checkup's closing extraction is merged with the interview's own
// answers (POST /api/checkup/extract). Pure, so the rules can be tested.
//
// The interview's slots are what the owner actually answered. The model reads
// the whole conversation and writes cleaner wording — but it also guesses. A
// guess must never become a fact: a trend they never gave, an answer to a
// question that was never asked, or one they skipped.

import { clampPercent, type BusinessFacts, type CheckupFact, type MoneyFacts, type MoneyPeriod, type TrendDirection } from "./checkup";
import { plainify, shorten } from "./checkup-math";
import { amountFromOwner } from "./checkup-turn";

const PERIODS: MoneyPeriod[] = ["day", "week", "month", "year"];

/**
 * The model's money picture, kept only where the owner said it: every amount
 * must be one of theirs (in any format), so nothing worked out or guessed can
 * become the base of the money maths.
 */
export function cleanMoney(raw: unknown, base: MoneyFacts, ownerText: string): MoneyFacts {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
  if (!r) return base;
  const text = (v: unknown, cap: number) => (typeof v === "string" && v.trim() && !/^null$/i.test(v.trim()) ? v.trim().slice(0, cap) : undefined);
  const theirs = (v: unknown) => {
    const t = text(v, 60);
    return t && /\d/.test(t) && amountFromOwner(t, ownerText) ? t : undefined;
  };
  const period = (v: unknown): MoneyPeriod | undefined => (PERIODS as string[]).includes(String(v)) ? (v as MoneyPeriod) : undefined;
  const items = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : []);

  const due = items(r.due)
    .map((d) => ({ what: text(d.what, 80) ?? "", amount: theirs(d.amount), when: text(d.when, 60) }))
    .filter((d) => d.what)
    .slice(0, 6);
  const moneyInRaw = r.moneyIn && typeof r.moneyIn === "object" ? (r.moneyIn as Record<string, unknown>) : null;
  const inAmount = moneyInRaw ? theirs(moneyInRaw.amount) : undefined;
  const inPer = moneyInRaw ? period(moneyInRaw.per) : undefined;
  const days = moneyInRaw && typeof moneyInRaw.daysOpen === "number" && Number.isFinite(moneyInRaw.daysOpen) ? Math.round(moneyInRaw.daysOpen) : undefined;
  // Days open only when they said that number.
  const daysOpen = days && days > 0 && days <= 31 && new RegExp(`\\b${days}\\b`).test(ownerText) ? days : undefined;
  const costs = items(r.costs)
    .map((c) => ({ what: text(c.what, 60) ?? "", amount: theirs(c.amount), per: period(c.per) ?? "month" }))
    .filter((c): c is { what: string; amount: string; per: MoneyPeriod } => Boolean(c.what && c.amount))
    .slice(0, 8);

  return {
    due: due.length ? due : base.due,
    cashNow: theirs(r.cashNow) ?? base.cashNow,
    ...(inAmount && inPer ? { moneyIn: { amount: inAmount, per: inPer, ...(daysOpen ? { daysOpen } : {}) } } : base.moneyIn ? { moneyIn: base.moneyIn } : {}),
    costs: costs.length ? costs : base.costs,
    statedMonthlySales: theirs(r.statedMonthlySales) ?? base.statedMonthlySales,
    coverPlan: text(r.coverPlan, 200) ?? base.coverPlan,
    pricesChanged: text(r.pricesChanged, 160) ?? base.pricesChanged,
    platformFees: text(r.platformFees, 160) ?? base.platformFees,
    owedFlex: text(r.owedFlex, 160) ?? base.owedFlex,
  };
}

const TRENDS: TrendDirection[] = ["Increased", "Decreased", "About the same", "Don't know"];

export const slotTrend = (v: unknown): TrendDirection | undefined =>
  typeof v === "string" && (TRENDS as string[]).includes(v) ? (v as TrendDirection) : undefined;

/** The answers that exist only when the owner gave them in the interview. */
const ANSWERED_FIELDS = ["bottleneck", "followUp", "pricePresentation", "lostReason", "capacity", "proof", "repeat", "ownerTheory"] as const;

/** Fact rows that restate one of those answers (by section name), so a row can't bring back a dropped guess. */
const ROW_FIELD: [RegExp, keyof BusinessFacts][] = [
  [/stuck|hardest/i, "bottleneck"],
  [/think is causing|your view/i, "ownerTheory"],
  [/enquiries are handled|follow/i, "followUp"],
  [/give your price|price presentation/i, "pricePresentation"],
  [/don't buy|do not buy|lost/i, "lostReason"],
  [/room for more|capacity/i, "capacity"],
  [/past work|proof/i, "proof"],
  [/coming back|repeat/i, "repeat"],
  [/become customers|how many pay/i, "closeRate"],
  [/job value|order value|typical (job|order)/i, "jobValue"],
  [/asking each month|enquiries a month/i, "monthlyEnquiries"],
  [/money due|also owed|cash now|money in and out/i, "money"],
];

export interface ParsedFacts extends Partial<BusinessFacts> {
  ack?: string;
}

export function mergeExtractedFacts(input: {
  /** Facts built only from the interview's answers. */
  base: BusinessFacts;
  /** What the model extracted from the conversation. */
  parsed: ParsedFacts;
  /** The interview's trend answers (only these count as trends). */
  slots: { enquiries?: unknown; customers?: unknown; revenue?: unknown };
  /** Everything the owner typed, for the plain-words safety net. */
  ownerText: string;
}): BusinessFacts {
  const { base, parsed, slots, ownerText } = input;
  const plain = (v: unknown, cap: number) => {
    const t = typeof v === "string" ? plainify(v.trim(), ownerText).slice(0, cap) : "";
    return t.length > 0 && !/^null$/i.test(t) ? t : undefined;
  };
  // The model's wording for an answer the owner really gave; nothing when they didn't.
  const answered = (key: (typeof ANSWERED_FIELDS)[number], cap: number): string | undefined =>
    base[key] ? plain(parsed[key], cap) ?? base[key] : undefined;

  const merged: Pick<BusinessFacts, (typeof ANSWERED_FIELDS)[number]> = {
    bottleneck: answered("bottleneck", 160),
    followUp: answered("followUp", 160),
    pricePresentation: answered("pricePresentation", 160),
    lostReason: answered("lostReason", 160),
    capacity: answered("capacity", 160),
    proof: answered("proof", 160),
    repeat: answered("repeat", 160),
    ownerTheory: answered("ownerTheory", 220),
  };

  const known = (key: keyof BusinessFacts) => {
    const v = key in merged ? merged[key as keyof typeof merged] : base[key];
    return typeof v === "string" ? v.trim().length > 0 : Boolean(v);
  };
  const modelFacts: CheckupFact[] = Array.isArray(parsed.facts)
    ? parsed.facts
        .filter((f) => f && typeof f.section === "string" && typeof f.value === "string" && f.value.trim())
        .map((f) => ({
          section: String(f.section).replace(/^acquisition channels$/i, "How people find you").slice(0, 40),
          value: plain(f.value, 220) ?? "",
          provenance: (["user-supplied", "ai-interpretation", "estimated", "measured"] as const).includes(f.provenance as "user-supplied") ? f.provenance : "ai-interpretation",
          source: String(f.source ?? "Your checkup conversation").slice(0, 80),
        }))
        .filter((f) => f.value)
        // A row about an answer the owner never gave is a guess, not a fact.
        .filter((f) => {
          const field = ROW_FIELD.find(([re]) => re.test(f.section))?.[1];
          return !field || known(field);
        })
        .slice(0, 14)
    : [];

  // Confirmed interview answers win for anything the owner explicitly gave
  // (channels, numbers, trends); the model's cleaned wording wins for prose.
  const channels = base.channels.length
    ? base.channels
    : Array.isArray(parsed.channels)
      ? parsed.channels.filter((c) => typeof c === "string").map((c) => String(c).slice(0, 40)).slice(0, 6)
      : [];
  const facts: BusinessFacts = {
    businessType: parsed.businessType === "ecommerce" ? "ecommerce" : parsed.businessType === "service" ? "service" : base.businessType,
    whatTheySell: plain(parsed.whatTheySell, 200) ?? base.whatTheySell,
    primaryGoal: plain(parsed.primaryGoal, 200) ?? base.primaryGoal,
    customers: plain(parsed.customers, 200) ?? base.customers,
    channels,
    journey:
      Array.isArray(parsed.journey) && parsed.journey.length >= 3
        ? parsed.journey.filter((j) => typeof j === "string").map((j) => plainify(String(j), ownerText).slice(0, 60)).slice(0, 8)
        : base.journey,
    // Only the trends the owner gave in the interview — the model reads "business is OK" as one.
    trends: {
      enquiries: slotTrend(slots.enquiries) ?? "Don't know",
      customers: slotTrend(slots.customers) ?? "Don't know",
      revenue: slotTrend(slots.revenue) ?? "Don't know",
    },
    ...merged,
    closeRate: base.closeRate ?? plain(parsed.closeRate, 80),
    jobValue: base.jobValue ?? plain(parsed.jobValue, 80),
    monthlyEnquiries: base.monthlyEnquiries ?? plain(parsed.monthlyEnquiries, 80),
    otherChallenges: base.otherChallenges,
    // Money trouble only (the interview decides); amounts only where the owner said them.
    ...(base.money ? { money: cleanMoney((parsed as { money?: unknown }).money, base.money, ownerText) } : {}),
    recentChanges: Array.isArray(parsed.recentChanges)
      ? parsed.recentChanges.filter((c) => typeof c === "string").map((c) => plainify(String(c), ownerText).slice(0, 80)).slice(0, 5)
      : base.recentChanges,
    chips: Array.isArray(parsed.chips) ? parsed.chips.filter((c) => typeof c === "string").map((c) => shorten(plainify(String(c), ownerText), 46)).slice(0, 6) : [],
    facts: modelFacts.length >= 4 ? modelFacts : base.facts,
    confidence: clampPercent(parsed.confidence, 40, 80, 62),
  };
  // "How people find you" must match the confirmed channels.
  facts.facts = facts.facts.map((f) => (/find you|channel/i.test(f.section) && channels.length ? { ...f, value: channels.join(", ") } : f));
  return facts;
}
