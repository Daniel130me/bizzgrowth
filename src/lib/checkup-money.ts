// Money trouble: spotting it in the owner's words, and working out — in code,
// from their own figures only — what is due against what they have, and
// whether money coming in covers the running costs. Client- and server-safe.
//
// The model never does this maths: it quotes these lines, which show every
// figure they came from, so the owner can check them.

import type { MoneyFacts, MoneyPeriod, MoneyUpdates } from "./checkup";
import { amountFromOwner } from "./checkup-turn";
import { foreignCurrency, formatMoney, formatMoneyRange, parseAmount, wordsToDigits, type Range } from "./checkup-math";

/**
 * The owner has a payment they can't cover, or owes money that is due: rent,
 * a loan, a supplier, wages, tax or a bill — said in their own words. Ordinary
 * mentions ("we pay rent of 200k") are not trouble; "due in 9 days", "can't
 * pay", "owe", "overdue" are.
 */
export function isMoneyTrouble(text: string): boolean {
  const t = text.toLowerCase();
  return (
    /\b(overdue|arrears|evict\w*|in debt|debts?\b|owe|owes|owing|behind (on|with)|default\w*|repay\w*|loan (shark|app|repayment)s?)\b/.test(t) ||
    /\b(can'?t|cannot|could ?n[o']t|unable to|struggling to|not able to)\s+(pay|afford|cover|meet|settle)\b/.test(t) ||
    /\b(short of (cash|money|funds)|cash (crunch|shortage|problem|gap)|run(ning)? out of (cash|money)|no money (to|for) pay)\b/.test(t) ||
    /\b(rent|loan|repayment|bill|bills|salar(y|ies)|wages|tax(es)?|supplier|payment|lease|fees?)\b[^.?!]{0,40}\b(due|overdue|deadline)\b/.test(t) ||
    /\bdue (in|on|by|this|next|tomorrow|today)\b/.test(t) ||
    /\blose (my|the|our) (shop|business|place|premises|space|store)\b/.test(t)
  );
}

// An amount of money, not just any number ("9 days" is not one): a currency sign,
// a k/m/million suffix, or a figure in the thousands.
const MONEY_AMOUNT = /[₦$€£¥₹₵]\s?\d|\b\d[\d,]*(?:\.\d+)?\s?(?:k|m|bn|million|thousand|billion)\b|\b\d{1,3}(?:,\d{3})+\b|\b\d{4,}\b/i;
const DUE_WORDS = /\b(due|overdue|owe|owes|owing|repay\w*|deadline|pay (it )?by|have to pay|need to pay|must pay)\b/i;
const CASH_WORDS = /\b(i|we) (only )?(have|got)\b|^(only )?(have|got)\b|\bhave only\b|\b(in hand|on hand|in the bank|in the account|left|saved)\b/i;

/**
 * What a money-trouble owner already said, kept in their own words when the AI can't
 * be reached: the clause naming what is due and the one saying what they have — each
 * only when it carries an amount. Nothing is worked out or reworded.
 */
export function moneyClauses(text: string): { due?: string; cash?: string } {
  const out: { due?: string; cash?: string } = {};
  const clauses = text
    .split(/(?<=[.!?;])\s+|\s+(?:and|but)\s+|,\s+/i)
    .map((c) => c.trim().replace(/[.!?;,]+$/, ""))
    .filter(Boolean);
  for (const c of clauses) {
    if (!MONEY_AMOUNT.test(c)) continue;
    if (DUE_WORDS.test(c)) out.due ??= c;
    else if (CASH_WORDS.test(c)) out.cash ??= c;
  }
  return out;
}

/** A lender or collector harassing them: contacting the people they know, threats, public shaming. */
export const HARASSMENT_RE =
  /\b(harass\w*|threat\w*|shaming|blackmail\w*|(messag|call|text|contact|disturb|bother|embarrass|insult|abus|disgrac)\w* (all )?(my|our) (contacts|family|friends|relatives|people|customers|neighbou?rs|colleagues))\b/i;

const SAFETY_STEP = "Screenshot every message the lender sends you or your contacts, and report it — that is not acceptable.";

/**
 * When the owner reports harassment, the read must answer it — whatever the model wrote.
 * It did not, even with the rule in its instructions, so the safety step is added in code.
 */
export function withHarassmentSafety(steps: string[], ownerText: string, answerText: string): string[] {
  if (!HARASSMENT_RE.test(ownerText)) return steps;
  // Answered means both: they are told it is not acceptable, and what to do (keep proof, report it).
  const toldNotOk = /not acceptable|not allowed|against the (rules|law)|illegal/i.test(answerText);
  const toldWhatToDo = /screenshot|report (it|them|this)|keep (a record|proof|evidence)/i.test(answerText);
  if (toldNotOk && toldWhatToDo) return steps;
  return [SAFETY_STEP, ...steps].slice(0, 3);
}

/**
 * Days until the first payment still ahead, from their own words ("in 9 days", "on day 8",
 * "in two weeks", "this week", "tomorrow"); null when none is dated in a way we can count.
 */
export function daysToFirstDue(money: MoneyFacts | null | undefined): number | null {
  let first: number | null = null;
  for (const d of money?.due ?? []) {
    if (d.status === "paid") continue;
    const w = wordsToDigits(String(d.when ?? "").toLowerCase());
    let n: number | null = null;
    const within = w.match(/\b(?:in|within|next)\s+(\d+)\s+(day|week)s?\b/);
    const dayN = w.match(/\bday\s+(\d+)\b/);
    if (within) n = Number(within[1]) * (within[2] === "week" ? 7 : 1);
    else if (dayN) n = Number(dayN[1]);
    else if (/\btomorrow\b/.test(w)) n = 1;
    else if (/\b(this|end of the) week\b/.test(w)) n = 7;
    else if (/\bnext week\b/.test(w)) n = 10;
    if (n !== null && n > 0 && (first === null || n < first)) first = n;
  }
  return first;
}

/** A step's check-in falls before the first payment it is meant to help with, not after it. */
export function daysBeforeDeadline(days: number, money: MoneyFacts | null | undefined): number {
  const first = daysToFirstDue(money);
  if (first === null) return days;
  return Math.max(1, Math.min(days, first - 1));
}

/**
 * "Money in and out" is only answered once the owner has spoken about their costs. A sales
 * figure on its own (often a claim made in passing) can't show whether the business covers
 * its costs, so the question must still be asked.
 */
export function speaksOfCosts(text: string): boolean {
  return /\b(costs?|spend\w*|pay (for|out)|buy(ing)?|stock|staff|salar\w*|wages?|fuel|diesel|petrol|gas|power|electric\w*|light|ingredients?|food ?stuff|materials?|transport|bills?|expenses?|overheads?|break[- ]?even|loss|losing|profit)\b/i.test(text);
}

const PER_MONTH: Record<MoneyPeriod, number> = { day: 26, week: 52 / 12, month: 1, year: 1 / 12 };

function perMonth(r: Range, per: MoneyPeriod, daysOpen?: number): Range {
  const f = per === "day" ? daysOpen ?? PER_MONTH.day : PER_MONTH[per];
  return { low: r.low * f, high: r.high * f };
}

function sumRanges(rs: Range[]): Range {
  return rs.reduce((a, r) => ({ low: a.low + r.low, high: a.high + r.high }), { low: 0, high: 0 });
}

const periodWord: Record<MoneyPeriod, string> = { day: "a day", week: "a week", month: "a month", year: "a year" };

/** What their own figures say that they may not have connected — worked out in code. */
export interface MoneyFindings {
  /** Sales don't cover the running costs they listed, even before the payments due. */
  losesMoney: boolean;
  /** A monthly sales figure they mentioned is well above what their own day or week figures add up to. */
  statedTooHigh: boolean;
}

export function moneyFindings(given: MoneyFacts | null | undefined, cur = ""): MoneyFindings {
  const none = { losesMoney: false, statedTooHigh: false };
  if (!given) return none;
  const { money } = homeCurrencyOnly(given, cur);
  const inRange = money.moneyIn ? parseAmount(money.moneyIn.amount) : null;
  const monthlyIn = money.moneyIn && inRange ? perMonth(inRange, money.moneyIn.per, money.moneyIn.daysOpen) : null;
  const costs = money.costs.map((c) => ({ r: parseAmount(c.amount), per: c.per })).filter((c): c is { r: Range; per: MoneyPeriod } => c.r !== null);
  const totalCosts = costs.length ? sumRanges(costs.map((c) => perMonth(c.r, c.per))) : null;
  const stated = parseAmount(money.statedMonthlySales);
  return {
    // Even their best month (most sales, least costs) doesn't cover the costs.
    losesMoney: Boolean(monthlyIn && totalCosts && monthlyIn.high < totalCosts.low),
    statedTooHigh: Boolean(stated && monthlyIn && stated.low > monthlyIn.high * 1.15),
  };
}

/**
 * The instruction that goes with those findings: they are the insight the owner hasn't
 * connected, and they challenge "it's only timing" — so the answer must say them, kindly.
 */
export function moneyFindingsBlock(money: MoneyFacts | null | undefined, cur = ""): string {
  const f = moneyFindings(money, cur);
  if (!f.losesMoney && !f.statedTooHigh) return "";
  return [
    "WHAT THEIR OWN FIGURES SHOW THAT THEY MAY NOT HAVE CONNECTED (from the COMPUTED lines — say it plainly and kindly; it is more important than how they explained the problem):",
    ...(f.losesMoney
      ? ["- Sales don't cover the running costs they listed, even before the payments due. Getting through this payment is not enough: the gap comes back every month until prices, costs or sales change. Never call the business healthy or the problem only timing."]
      : []),
    ...(f.statedTooHigh
      ? ["- The monthly sales figure they mentioned is more than their own day or week figures add up to. Work from the day or week figures, and ask which months the bigger figure came from — never build on it."]
      : []),
  ].join("\n");
}

/**
 * The money picture as lines the model may quote word for word: what is due
 * and when, the cash they have and the gap, and — when they gave money in and
 * their costs — what is left each month before those payments.
 */
export function moneyLinesForPrompt(given: MoneyFacts | null | undefined, cur: string): string[] {
  if (!given) return [];
  const lines: string[] = [];
  // Only amounts in their own currency are added up; others are named, never converted.
  const { money, leftOut } = homeCurrencyOnly(given, cur);
  if (leftOut.length) lines.push(`Not added up, because it is not in ${cur} (Nellovia never converts currencies): ${leftOut.join("; ")}.`);

  // What is still due (paid items are done), against the cash they have.
  const paid = money.due.filter((d) => d.status === "paid").map((d) => d.what.trim());
  const due = money.due
    .filter((d) => d.status !== "paid")
    .map((d) => ({ ...d, range: parseAmount(d.amount) }))
    .filter((d): d is typeof d & { range: Range } => d.range !== null);
  if (paid.length) lines.push(`Already paid: ${paid.join("; ")}.`);
  if (due.length) {
    const total = sumRanges(due.map((d) => d.range));
    const items = due
      .map((d) => {
        const when = [d.status === "plan" ? "on a plan they agreed" : "", d.when?.trim() ?? ""].filter(Boolean).join(", ");
        return `${d.what.trim()} ${formatMoneyRange(d.range, cur)}${when ? ` (${when})` : ""}`;
      })
      .join("; ");
    lines.push(due.length > 1 ? `Due, from what they told you: ${items} — ${formatMoneyRange(total, cur)} in total.` : `Due, from what they told you: ${items}.`);
    const cash = parseAmount(money.cashNow);
    if (cash) {
      const short = { low: Math.max(0, total.low - cash.high), high: Math.max(0, total.high - cash.low) };
      lines.push(`Cash they have now: ${formatMoneyRange(cash, cur)}.`);
      lines.push(
        short.high > 0
          ? `So they are about ${formatMoneyRange(short, cur)} short of what is due (${formatMoneyRange(total, cur)} due minus ${formatMoneyRange(cash, cur)} in hand).`
          : `Their cash covers what is due (${formatMoneyRange(cash, cur)} in hand for ${formatMoneyRange(total, cur)} due).`,
      );
    }
  }

  // Money in against running costs, per month.
  const inRange = money.moneyIn ? parseAmount(money.moneyIn.amount) : null;
  const costs = money.costs
    .map((c) => ({ ...c, range: parseAmount(c.amount) }))
    .filter((c): c is typeof c & { range: Range } => c.range !== null);
  let monthlyIn: Range | null = null;
  if (money.moneyIn && inRange) {
    monthlyIn = perMonth(inRange, money.moneyIn.per, money.moneyIn.daysOpen);
    const how =
      money.moneyIn.per === "month"
        ? `${formatMoneyRange(inRange, cur)} a month`
        : money.moneyIn.per === "day"
          ? `${formatMoneyRange(inRange, cur)} a day × ${money.moneyIn.daysOpen ?? 26} days${money.moneyIn.daysOpen ? "" : " (assuming about 26 open days — they didn't say)"}`
          : `${formatMoneyRange(inRange, cur)} ${periodWord[money.moneyIn.per]}`;
    lines.push(`Money coming in, from their figures: about ${formatMoneyRange(monthlyIn, cur)} a month (${how}).`);
  }
  if (costs.length) {
    const monthly = costs.map((c) => ({ what: c.what.trim(), range: perMonth(c.range, c.per) }));
    const total = sumRanges(monthly.map((c) => c.range));
    lines.push(`Running costs they listed: about ${formatMoneyRange(total, cur)} a month (${monthly.map((c) => `${c.what} ${formatMoneyRange(c.range, cur)}`).join(" + ")}).`);
    if (monthlyIn) {
      const left = { low: monthlyIn.low - total.high, high: monthlyIn.high - total.low };
      if (left.high < 0) {
        lines.push(`So on their own figures the business loses about ${formatMoneyRange({ low: -left.high, high: -left.low }, cur)} a month before the payments above — sales don't cover the running costs.`);
      } else if (left.low < 0) {
        lines.push(`So on their own figures the business is somewhere between losing ${formatMoney(-left.low, cur)} and keeping ${formatMoney(left.high, cur)} a month before the payments above — at best close to breaking even.`);
      } else {
        lines.push(`So on their own figures about ${formatMoneyRange(left, cur)} a month is left after running costs, before the payments above.`);
      }
      const biggest = [...monthly].sort((a, b) => b.range.high - a.range.high)[0];
      if (biggest && monthlyIn.high > 0) {
        const lo = Math.round((biggest.range.low / monthlyIn.high) * 100);
        const hi = Math.round((biggest.range.high / Math.max(1, monthlyIn.low)) * 100);
        lines.push(`Their biggest cost, ${biggest.what.toLowerCase()}, is about ${lo === hi ? `${lo}%` : `${lo}%–${hi}%`} of the money coming in.`);
      }
    }
  }

  // A monthly figure they stated that their own daily or weekly figures don't add up to.
  const stated = parseAmount(money.statedMonthlySales);
  if (stated && monthlyIn && stated.low > monthlyIn.high * 1.15) {
    lines.push(`They also said about ${formatMoneyRange(stated, cur)} a month — more than their own figures add up to (about ${formatMoneyRange(monthlyIn, cur)}). Worth asking which months that was.`);
  }
  return lines;
}

/* ------------------------------------------------------------------ */
/* Money that changed since the checkup — told in a check-in           */
/* ------------------------------------------------------------------ */

// Words that say nothing about WHICH payment it is ("the supplier bill" = "supplier").
const GENERIC_WORDS = new Set(["the", "my", "our", "a", "an", "for", "of", "to", "from", "and", "bill", "bills", "payment", "payments", "repayment", "due", "money", "fee", "fees", "owed", "balance"]);

function nameWords(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !GENERIC_WORDS.has(w));
}

/** Which payment on their list a name means; -1 when none, or when two fit equally (never guess). */
export function matchDue(what: string, due: { what: string }[]): number {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const exact = due.findIndex((d) => norm(d.what) === norm(what));
  if (exact !== -1) return exact;
  const want = nameWords(what);
  if (!want.length) return -1;
  // One name's words must all be in the other ("supplier" = "Supplier bill"); a shared
  // word alone is not enough ("Brother's loan" is not the "Hair products loan").
  const scores = due.map((d) => {
    const have = nameWords(d.what);
    const fits = have.length > 0 && (want.every((w) => have.includes(w)) || have.every((w) => want.includes(w)));
    return fits ? want.filter((w) => have.includes(w)).length : 0;
  });
  const best = Math.max(0, ...scores);
  if (best === 0 || scores.filter((s) => s === best).length > 1) return -1;
  return scores.indexOf(best);
}

const PERIODS: MoneyPeriod[] = ["day", "week", "month", "year"];
const str = (v: unknown, cap: number): string | undefined => (typeof v === "string" && v.trim() ? v.replace(/\s+/g, " ").trim().slice(0, cap) : undefined);

/**
 * What a check-in's model said changed in their money, kept only where it holds up:
 * every amount is one the owner typed, a change to a payment names one on their list
 * (a new one needs their amount), periods are real. Null when nothing is left.
 */
export function cleanMoneyUpdates(raw: unknown, money: MoneyFacts | null | undefined, ownerText: string, cur = ""): MoneyUpdates | null {
  if (!money || !raw || typeof raw !== "object" || !ownerText.trim()) return null;
  const r = raw as Record<string, unknown>;
  const theirs = (v: unknown, cap = 60): string | undefined => {
    const s = str(v, cap);
    // Their own figure, in their own currency (one in another currency is never recorded or converted).
    return s && /\d/.test(s) && amountFromOwner(s, ownerText) && !(cur && foreignCurrency(s, cur)) ? s : undefined;
  };
  const out: MoneyUpdates = {};

  const due: NonNullable<MoneyUpdates["due"]> = [];
  for (const item of Array.isArray(r.due) ? r.due.slice(0, 6) : []) {
    if (!item || typeof item !== "object") continue;
    const d = item as Record<string, unknown>;
    const change = d.change;
    if (change !== "paid" && change !== "plan" && change !== "new" && change !== "amount") continue;
    const what = str(d.what, 60);
    if (!what) continue;
    const amount = theirs(d.amount);
    const when = str(d.when, 60);
    const note = str(d.note, 140);
    const at = matchDue(what, money.due);
    if (change === "new") {
      // Already on the list: it is a change to that one, not a second copy.
      if (at !== -1) {
        if (amount || when) due.push({ what: money.due[at].what, change: "amount", amount, when, note });
      } else if (amount) {
        due.push({ what, change: "new", amount, when, note });
      }
      continue;
    }
    if (at === -1) continue;
    if (change === "amount" && !amount && !when) continue;
    if (str(d.amount, 60) && !amount && change !== "paid") continue; // an amount they never typed
    due.push({ what: money.due[at].what, change, amount, when, note });
  }
  if (due.length) out.due = due;

  const cash = theirs(r.cashNow);
  if (cash) out.cashNow = cash;
  const mi = r.moneyIn as Record<string, unknown> | null | undefined;
  if (mi && typeof mi === "object") {
    const amount = theirs(mi.amount);
    const per = PERIODS.find((p) => p === mi.per);
    if (amount && per) out.moneyIn = { amount, per };
  }
  const prices = str(r.pricesChanged, 160);
  if (prices && /\b(price|prices|priced|charge|charging|raised|increased|reduced|lowered|cut)\b/i.test(ownerText)) out.pricesChanged = prices;

  return Object.keys(out).length ? out : null;
}

/** Their money picture with checked changes applied. Nothing is ever deleted: a paid payment stays, marked paid. */
export function applyMoneyUpdates(money: MoneyFacts, u: MoneyUpdates | null | undefined, at: string): MoneyFacts {
  if (!u) return money;
  const due = money.due.map((d) => ({ ...d }));
  for (const c of u.due ?? []) {
    if (c.change === "new") {
      if (matchDue(c.what, due) === -1) due.push({ what: c.what, amount: c.amount, when: c.when, note: c.note, updatedAt: at });
      continue;
    }
    const i = matchDue(c.what, due);
    if (i === -1) continue;
    const d = due[i];
    due[i] = {
      ...d,
      ...(c.change === "paid" ? { status: "paid" as const } : c.change === "plan" ? { status: "plan" as const } : {}),
      ...(c.amount && c.change !== "paid" ? { amount: c.amount } : {}),
      ...(c.when && c.change !== "paid" ? { when: c.when } : {}),
      ...(c.note ? { note: c.note } : {}),
      updatedAt: at,
    };
  }
  return {
    ...money,
    due,
    ...(u.cashNow ? { cashNow: u.cashNow } : {}),
    // A new sales figure keeps their open days (it is the same shop, a different week).
    ...(u.moneyIn ? { moneyIn: { ...u.moneyIn, ...(money.moneyIn?.daysOpen && u.moneyIn.per === "day" ? { daysOpen: money.moneyIn.daysOpen } : {}) } } : {}),
    ...(u.pricesChanged ? { pricesChanged: u.pricesChanged } : {}),
  };
}

/**
 * Their money with every amount in another currency taken out of the sums (never converted),
 * and a note naming what was left out — so "$500" is never added to naira as if it were ₦500.
 */
export function homeCurrencyOnly(money: MoneyFacts, cur: string): { money: MoneyFacts; leftOut: string[] } {
  if (!cur) return { money, leftOut: [] };
  const leftOut: string[] = [];
  const foreign = (label: string, amount: string | undefined) => {
    if (!amount || !foreignCurrency(amount, cur)) return false;
    leftOut.push(`${label} ${amount.trim()}`);
    return true;
  };
  return {
    money: {
      ...money,
      due: money.due.map((d) => (foreign(d.what.trim(), d.amount) ? { ...d, amount: undefined } : d)),
      cashNow: foreign("Cash now", money.cashNow) ? undefined : money.cashNow,
      moneyIn: money.moneyIn && foreign("Money coming in", money.moneyIn.amount) ? undefined : money.moneyIn,
      costs: money.costs.filter((c) => !foreign(c.what.trim(), c.amount)),
      statedMonthlySales: foreign("Monthly sales they mentioned", money.statedMonthlySales) ? undefined : money.statedMonthlySales,
    },
    leftOut,
  };
}
