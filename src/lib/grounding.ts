// Grounding check — the guarantee behind "nothing invented".
//
// Every amount, percentage and count an AI feature writes is checked against
// the numbers the owner actually gave (checkup answers, entered totals,
// measured data) and the figures computed from them. A figure that cannot be
// traced is caught here; the caller then asks the model again, removes the
// sentence, or falls back — and the page can honestly tell the owner that
// every figure was checked.
//
// Advice-scale numbers are allowed without a source: small counts ("3
// options", "2 or 3 payments", "within 2 days"), common time spans
// ("24 hours", "30 days") and years.

export interface AllowedNumbers {
  values: number[];
  percents: number[];
}

const SCALE: Record<string, number> = { k: 1e3, thousand: 1e3, m: 1e6, mil: 1e6, million: 1e6, bn: 1e9, b: 1e9, billion: 1e9 };

const CURRENCY_RE = /(₦|\$|£|€|\bN(?=\d))\s?(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|mil|million|m|bn|billion|b)?\b/gi;
const PERCENT_RE = /(\d+(?:\.\d+)?)\s?(%|percent\b)/gi;
const SUFFIXED_RE = /\b(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|million|bn|billion)\b/gi;
const PLAIN_RE = /\b\d[\d,]*(?:\.\d+)?\b/g;

const ADVICE_SAFE = new Set([12, 14, 15, 20, 24, 30, 45, 48, 60, 72, 90, 100]);

function num(raw: string): number {
  return Number(raw.replace(/,/g, ""));
}

/** Every number in the given sources — the only figures an answer may use. */
export function collectAllowedNumbers(...sources: (string | null | undefined)[]): AllowedNumbers {
  const values: number[] = [];
  const percents: number[] = [];
  for (const src of sources) {
    if (!src) continue;
    for (const m of src.matchAll(CURRENCY_RE)) values.push(num(m[2]) * (SCALE[(m[3] ?? "").toLowerCase()] ?? 1));
    for (const m of src.matchAll(SUFFIXED_RE)) values.push(num(m[1]) * (SCALE[m[2].toLowerCase()] ?? 1));
    for (const m of src.matchAll(PERCENT_RE)) percents.push(num(m[1]));
    for (const m of src.matchAll(PLAIN_RE)) {
      const v = num(m[0]);
      values.push(v);
      // "50" next to a % elsewhere, or a ratio like 2 out of 5 = 40% is NOT allowed — only what is written.
    }
  }
  return { values, percents };
}

function near(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(0.5, Math.abs(b) * 0.02);
}

/**
 * Figures in `text` that cannot be traced to the allowed numbers.
 * `priceRange` lets an offer suggest prices around the owner's own job value.
 */
export function ungroundedNumbers(text: string, allowed: AllowedNumbers, opts?: { priceRange?: { low: number; high: number } | null }): string[] {
  if (!text) return [];
  const bad: string[] = [];
  let rest = text;

  for (const m of text.matchAll(CURRENCY_RE)) {
    const v = num(m[2]) * (SCALE[(m[3] ?? "").toLowerCase()] ?? 1);
    const ok =
      allowed.values.some((a) => near(v, a)) ||
      (opts?.priceRange ? v >= opts.priceRange.low * 0.5 && v <= opts.priceRange.high * 1.6 : false);
    if (!ok) bad.push(m[0].trim());
    rest = rest.replace(m[0], " ");
  }
  for (const m of rest.matchAll(PERCENT_RE)) {
    const p = num(m[1]);
    if (!allowed.percents.some((a) => near(p, a))) bad.push(m[0].trim());
  }
  rest = rest.replace(PERCENT_RE, " ");
  for (const m of rest.matchAll(SUFFIXED_RE)) {
    const v = num(m[1]) * (SCALE[m[2].toLowerCase()] ?? 1);
    if (!allowed.values.some((a) => near(v, a))) bad.push(m[0].trim());
  }
  rest = rest.replace(SUFFIXED_RE, " ");
  for (const m of rest.matchAll(PLAIN_RE)) {
    const v = num(m[0]);
    if (v <= 10 || (v >= 1990 && v <= 2100) || ADVICE_SAFE.has(v)) continue;
    if (!allowed.values.some((a) => near(v, a))) bad.push(m[0]);
  }
  return [...new Set(bad)];
}

/** Drop the sentences of a paragraph that carry an untraceable figure. */
export function dropUngroundedSentences(text: string, allowed: AllowedNumbers): string {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const kept = sentences.filter((s) => ungroundedNumbers(s, allowed).length === 0);
  return kept.join(" ").trim();
}
