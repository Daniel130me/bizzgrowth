// The owner's own numbers — every figure they gave Nellovia (in the checkup, a check-in,
// a challenge chat, or by editing their facts) — and how each one changed over time.
// Client- and server-safe, pure.
//
// Nothing here is worked out or estimated: a value is always the owner's own words for it.

import type { BusinessFacts, DueItem, MoneyPeriod } from "./checkup";

export type NumberSource = "checkup" | "check-in" | "challenge chat" | "you";
export type NumberGroup = "owed" | "money" | "customers";

/** One recorded value of one number. */
export interface NumberEntry {
  /** Stable id: "cashNow", "moneyIn", "due:shop lease", "cost:stock", "closeRate"… */
  key: string;
  label: string;
  group: NumberGroup;
  value: string;
  /** ISO time it was recorded; absent for values from before the log existed. */
  at?: string;
  source: NumberSource;
  /** For a payment: paid off, or on a plan. */
  status?: DueItem["status"];
}

/** At most this many entries are kept (oldest go first); plenty for years of check-ins. */
export const NUMBER_LOG_CAP = 400;

const PER: Record<MoneyPeriod, string> = { day: "a day", week: "a week", month: "a month", year: "a year" };
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const clean = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

function dueValue(d: DueItem): string {
  if (d.status === "paid") return "Paid";
  const amount = clean(d.amount);
  const rawWhen = clean(d.when);
  const when = amount && /^[A-Z][a-z]/.test(rawWhen) ? rawWhen.charAt(0).toLowerCase() + rawWhen.slice(1) : rawWhen;
  const base = [amount, when].filter(Boolean).join(", ");
  return d.status === "plan" ? `On a plan: ${base || "agreed"}` : base;
}

/** Every number in their facts right now, in the order they are shown. */
export function numbersFromFacts(f: BusinessFacts | null | undefined): Omit<NumberEntry, "at" | "source">[] {
  if (!f) return [];
  const out: Omit<NumberEntry, "at" | "source">[] = [];
  const push = (key: string, label: string, group: NumberGroup, value: string | undefined, status?: DueItem["status"]) => {
    const v = clean(value);
    if (v) out.push({ key, label, group, value: v, ...(status ? { status } : {}) });
  };
  const m = f.money;
  if (m) {
    for (const d of m.due) push(`due:${slug(d.what)}`, clean(d.what), "owed", dueValue(d), d.status);
    push("cashNow", "Cash in hand", "money", m.cashNow);
    if (m.moneyIn) push("moneyIn", "Money coming in from sales", "money", `${clean(m.moneyIn.amount)} ${PER[m.moneyIn.per]}`);
    push("statedMonthlySales", "Monthly sales you mentioned", "money", m.statedMonthlySales);
    for (const c of m.costs) push(`cost:${slug(c.what)}`, clean(c.what), "money", `${clean(c.amount)} ${PER[c.per]}`);
    push("platformFees", "Fees taken from your sales", "money", m.platformFees);
  }
  push("monthlyEnquiries", "People who ask about buying, each month", "customers", f.monthlyEnquiries);
  push("closeRate", "How many of them go on to buy", "customers", f.closeRate);
  push("jobValue", "What a typical order or job brings in", "customers", f.jobValue);
  return out;
}

/** Log entries for every number that is new or different in `next` (removed numbers are not logged). */
export function diffNumbers(prev: BusinessFacts | null | undefined, next: BusinessFacts | null | undefined, source: NumberSource, at: string): NumberEntry[] {
  const before = new Map(numbersFromFacts(prev).map((n) => [n.key, n.value]));
  return numbersFromFacts(next)
    .filter((n) => before.get(n.key) !== n.value)
    .map((n) => ({ ...n, at, source }));
}

/**
 * The log with what changed between two versions of their facts. A number changing for the
 * first time since before the log existed keeps its old value first (as from the checkup,
 * undated), so "was …" is never lost.
 */
export function logChanges(log: NumberEntry[] | undefined, prev: BusinessFacts | null | undefined, next: BusinessFacts | null | undefined, source: NumberSource, at: string): NumberEntry[] {
  const changes = diffNumbers(prev, next, source, at);
  if (!changes.length) return log ?? [];
  const logged = new Set((log ?? []).map((e) => e.key));
  const before = new Map(numbersFromFacts(prev).map((n) => [n.key, n]));
  const baselines = changes.flatMap((c) => {
    const old = before.get(c.key);
    return old && !logged.has(c.key) ? [{ ...old, source: "checkup" as const }] : [];
  });
  return appendNumbers(log, [...baselines, ...changes]);
}

/** The log with new entries added, capped. */
export function appendNumbers(log: NumberEntry[] | undefined, entries: NumberEntry[]): NumberEntry[] {
  const all = [...(log ?? []), ...entries];
  return all.length > NUMBER_LOG_CAP ? all.slice(all.length - NUMBER_LOG_CAP) : all;
}

/** One number as the owner sees it: now, where it came from, and what it was before. */
export interface NumberRow {
  key: string;
  label: string;
  group: NumberGroup;
  value: string;
  status?: DueItem["status"];
  source: NumberSource;
  /** When the current value was recorded; absent when not known. */
  at?: string;
  /** Earlier values, newest first (the current one is not repeated). */
  history: { value: string; at?: string; source: NumberSource }[];
}

/**
 * The rows to show: every number in their facts now (so nothing they told us is missing,
 * even from before the log existed), with its history from the log.
 */
export function numberRows(facts: BusinessFacts | null | undefined, log: NumberEntry[] | undefined): NumberRow[] {
  const entries = log ?? [];
  return numbersFromFacts(facts).map((n) => {
    // Repeats of the same value in a row say nothing new.
    const mine = entries.filter((e) => e.key === n.key).filter((e, i, arr) => i === 0 || e.value !== arr[i - 1].value);
    const last = mine[mine.length - 1];
    // The log agrees with the facts: the current value is its last entry.
    const current = last && last.value === n.value ? last : null;
    const earlier = (current ? mine.slice(0, -1) : mine).filter((e) => e.value !== n.value);
    return {
      ...n,
      // No entry yet: it came from the checkup (before the log existed). Changed outside the
      // log (an older version of the app): shown as theirs, undated.
      source: current?.source ?? (mine.length ? "you" : "checkup"),
      at: current?.at,
      history: earlier.reverse().map((e) => ({ value: e.value, at: e.at, source: e.source })),
    };
  });
}

/** "From your checkup" / "Updated in a check-in" — said plainly. */
export function sourceLabel(source: NumberSource, current: boolean): string {
  switch (source) {
    case "checkup":
      return "From your checkup";
    case "check-in":
      return current ? "Updated in a check-in" : "From a check-in";
    case "challenge chat":
      return current ? "Updated in a challenge chat" : "From a challenge chat";
    case "you":
      return current ? "You changed it" : "You entered it";
  }
}

/**
 * The figures this read still lacks, in plain words — only ones that matter for their kind
 * of problem (money trouble: cash, sales, costs; otherwise: people who ask, how many buy,
 * order size, reply speed). Never jargon, never a list padded with things nobody asked.
 */
export function missingNumbers(f: BusinessFacts | null | undefined): string[] {
  if (!f) return [];
  const out: string[] = [];
  const m = f.money;
  if (m) {
    if (!clean(m.cashNow)) out.push("How much cash the business has now");
    if (!m.moneyIn) out.push("What comes in from sales on a normal day or week");
    if (!m.costs.length) out.push("Your main running costs (stock, staff, rent, power…)");
    for (const d of m.due) if (d.status !== "paid" && !clean(d.amount)) out.push(`How much is due for ${clean(d.what).toLowerCase()}`);
    return out;
  }
  if (!clean(f.monthlyEnquiries)) out.push("How many people ask about buying each month");
  if (!clean(f.closeRate)) out.push("How many of them go on to buy");
  if (!clean(f.jobValue)) out.push("What a typical order or job brings in");
  if (!clean(f.followUp)) out.push("How quickly people who ask get a reply");
  return out;
}

/** The part of a number the owner can correct, and what stays fixed after it ("a day"). */
export function editableNumber(f: BusinessFacts | null | undefined, key: string): { value: string; suffix?: string } | null {
  if (!f) return null;
  const m = f.money;
  if (key === "monthlyEnquiries" || key === "closeRate" || key === "jobValue") return { value: f[key] ?? "" };
  if (!m) return null;
  if (key === "cashNow" || key === "statedMonthlySales" || key === "platformFees") return { value: m[key] ?? "" };
  if (key === "moneyIn") return m.moneyIn ? { value: m.moneyIn.amount, suffix: PER[m.moneyIn.per] } : null;
  if (key.startsWith("cost:")) {
    const c = m.costs.find((x) => `cost:${slug(x.what)}` === key);
    return c ? { value: c.amount, suffix: PER[c.per] } : null;
  }
  if (key.startsWith("due:")) {
    const d = m.due.find((x) => `due:${slug(x.what)}` === key);
    return d && d.status !== "paid" ? { value: d.amount ?? "", suffix: clean(d.when) || undefined } : null;
  }
  return null;
}

export type NumberInput = { value: string } | { paid: boolean };

/**
 * Their facts with one number corrected by them (or a payment marked paid / not paid).
 * Null when nothing would change or the input can't be used — the caller does nothing.
 */
export function setNumber(f: BusinessFacts, key: string, input: NumberInput, at: string): BusinessFacts | null {
  const m = f.money;
  if ("paid" in input) {
    if (!m || !key.startsWith("due:")) return null;
    const i = m.due.findIndex((x) => `due:${slug(x.what)}` === key);
    if (i === -1 || (m.due[i].status === "paid") === input.paid) return null;
    const due = m.due.map((d, j) => (j !== i ? d : input.paid ? { ...d, status: "paid" as const, updatedAt: at } : { ...d, status: undefined, updatedAt: at }));
    return { ...f, money: { ...m, due } };
  }
  const value = clean(input.value).slice(0, 80);
  const current = editableNumber(f, key);
  if (!value || !current || value === current.value) return null;
  if (key === "monthlyEnquiries" || key === "closeRate" || key === "jobValue") return { ...f, [key]: value };
  if (!m) return null;
  if (key === "cashNow" || key === "statedMonthlySales" || key === "platformFees") return { ...f, money: { ...m, [key]: value } };
  if (key === "moneyIn" && m.moneyIn) return { ...f, money: { ...m, moneyIn: { ...m.moneyIn, amount: value } } };
  if (key.startsWith("cost:")) return { ...f, money: { ...m, costs: m.costs.map((c) => (`cost:${slug(c.what)}` === key ? { ...c, amount: value } : c)) } };
  if (key.startsWith("due:")) return { ...f, money: { ...m, due: m.due.map((d) => (`due:${slug(d.what)}` === key ? { ...d, amount: value, updatedAt: at } : d)) } };
  return null;
}
