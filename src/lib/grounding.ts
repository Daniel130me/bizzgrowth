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
// "300k", "2.5 million", and an "m"/"b" written straight onto the number ("1.5m", "2b") —
// without a currency sign those are still amounts, and were slipping through.
const SUFFIXED_RE = /\b(\d[\d,]*(?:\.\d+)?)(?:\s*(k|thousand|million|bn|billion)|(m|b))\b/gi;
const PLAIN_RE = /\b\d[\d,]*(?:\.\d+)?\b/g;

// Amounts written in words with a scale: "three hundred thousand", "two million", "half a million".
const NUMBER_WORDS = "zero|one|an?|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|half|and";
const SPELLED_RE = new RegExp(`\\b(?:${NUMBER_WORDS})(?:[\\s-]+(?:${NUMBER_WORDS}))*\\b`, "gi");
const WORD_VALUE: Record<string, number> = {
  zero: 0, one: 1, a: 1, an: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const WORD_SCALE: Record<string, number> = { thousand: 1e3, million: 1e6, billion: 1e9 };

const ADVICE_SAFE = new Set([12, 14, 15, 20, 24, 30, 45, 48, 60, 72, 90, 100]);

function num(raw: string): number {
  return Number(raw.replace(/,/g, ""));
}

function suffixScale(m: RegExpMatchArray): number {
  return SCALE[(m[2] ?? m[3] ?? "").toLowerCase()] ?? 1;
}

/** The value of an amount written in words, or null when it has no thousand/million/billion in it. */
export function spelledAmount(phrase: string): number | null {
  const words = phrase.toLowerCase().split(/[\s-]+/).filter((w) => w && w !== "and");
  if (!words.some((w) => w in WORD_SCALE)) return null;
  // A scale word on its own is the tail of a written number ("4.8 million"), read with its digits elsewhere.
  if (!words.some((w) => w in WORD_VALUE || w === "hundred" || w === "half")) return null;
  let total = 0;
  let current = 0;
  let half = false;
  for (const w of words) {
    if (w === "half") half = true;
    else if (w in WORD_VALUE) current += WORD_VALUE[w];
    else if (w === "hundred") current = (current || 1) * 100;
    else if (w in WORD_SCALE) {
      total += (half ? 0.5 : current || 1) * WORD_SCALE[w];
      current = 0;
      half = false;
    }
  }
  return total + current;
}

/** Every number in the given sources — the only figures an answer may use. */
export function collectAllowedNumbers(...sources: (string | null | undefined)[]): AllowedNumbers {
  const values: number[] = [];
  const percents: number[] = [];
  for (const src of sources) {
    if (!src) continue;
    for (const m of src.matchAll(CURRENCY_RE)) values.push(num(m[2]) * (SCALE[(m[3] ?? "").toLowerCase()] ?? 1));
    for (const m of src.matchAll(SUFFIXED_RE)) values.push(num(m[1]) * suffixScale(m));
    for (const m of src.matchAll(SPELLED_RE)) {
      const v = spelledAmount(m[0]);
      if (v !== null) values.push(v);
    }
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

  for (const m of text.matchAll(SPELLED_RE)) {
    const v = spelledAmount(m[0]);
    if (v === null) continue;
    const ok =
      allowed.values.some((a) => near(v, a)) ||
      (opts?.priceRange ? v >= opts.priceRange.low * 0.5 && v <= opts.priceRange.high * 1.6 : false);
    if (!ok) bad.push(m[0].trim());
  }
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
    const v = num(m[1]) * suffixScale(m);
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
