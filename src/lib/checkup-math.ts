// Pure helpers that turn an owner's rough checkup answers into honest numbers.
// Client- and server-safe (no imports beyond types).
//
//   parseCloseRate("2 out of about 5")      -> { won: 2, of: 5 }
//   parseAmount("₦50k – ₦200k")             -> { low: 50000, high: 200000 }
//   parseCount("6 to 15 a month")            -> { low: 6, high: 15 }
//   computeStake(facts, "₦", "convert")      -> "+50% more paying customers…" with the working shown
//
// Every figure the diagnosis shows is derived here from the owner's OWN
// estimates — the model never invents a number, and the page can always show
// how a figure was worked out.

import type { BusinessFacts, DiagnosisStake, FocusStage } from "./checkup";

export interface Ratio {
  won: number;
  of: number;
}

export interface Range {
  low: number;
  high: number;
}

const UNIT_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
/** Scales owners use: thousand, million, billion — and lakh (100,000) and crore (10,000,000). */
const SCALE_WORDS: Record<string, number> = { thousand: 1e3, lakh: 1e5, lakhs: 1e5, lac: 1e5, lacs: 1e5, million: 1e6, crore: 1e7, crores: 1e7, billion: 1e9 };
const RUN_WORDS = [...Object.keys(UNIT_WORDS), "hundred", ...Object.keys(SCALE_WORDS), "and", "a", "an", "half"].join("|");
const RUN_RE = new RegExp(`\\b(?:${RUN_WORDS})\\b(?:[\\s-]+(?:${RUN_WORDS})\\b)*`, "gi");

/** One run of number words ("nine hundred and sixty thousand") as digits; other words kept as they were. */
function spelledRun(run: string): string {
  const orig = run.split(/[\s-]+/);
  const words = orig.map((w) => w.toLowerCase());
  const out: string[] = [];
  let total = 0;
  let current = 0;
  let has = false;
  let half = false;
  let prevUnit: number | null = null;
  let afterBig = false; // just read "hundred" or a scale: an "and" next joins the number
  const flush = () => {
    if (has) out.push(String(total + current));
    total = 0;
    current = 0;
    has = false;
    half = false;
    prevUnit = null;
    afterBig = false;
  };
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const next = words[i + 1];
    const bigNext = next === "hundred" || (next !== undefined && next in SCALE_WORDS);
    if (w in UNIT_WORDS) {
      const v = UNIT_WORDS[w];
      // "twenty one" is 21; "one two" are two numbers.
      if (prevUnit !== null && !(prevUnit >= 20 && prevUnit % 10 === 0 && v < 10)) flush();
      current += v;
      has = true;
      prevUnit = v;
      afterBig = false;
    } else if (w === "hundred" && has) {
      current = (current || 1) * 100;
      prevUnit = null;
      afterBig = true;
    } else if (w in SCALE_WORDS && (has || half)) {
      // "half a million" is 500,000.
      total += (current || 1) * (half ? 0.5 : 1) * SCALE_WORDS[w];
      current = 0;
      half = false;
      has = true;
      prevUnit = null;
      afterBig = true;
    } else if ((w === "a" || w === "an") && bigNext) {
      if (!half) flush();
      current = 1;
      has = true;
      prevUnit = null;
    } else if (w === "half" && (next === "a" || next === "an" || bigNext)) {
      flush();
      half = true;
    } else if (w === "and" && has && afterBig && next !== undefined && (next in UNIT_WORDS || next === "hundred")) {
      continue;
    } else {
      // Not part of a number here ("a lot", "and", a scale after digits like "50 thousand").
      flush();
      out.push(orig[i]);
    }
  }
  flush();
  return out.join(" ");
}

/**
 * Number words to digits: "two out of five" -> "2 out of 5", "nine hundred and sixty
 * thousand" -> "960000", "half a million" -> "500000", "three lakh" -> "300000".
 */
export function wordsToDigits(text: string): string {
  return text.replace(RUN_RE, (run) => spelledRun(run));
}

function validRatio(won: number, of: number): Ratio | null {
  if (!Number.isFinite(won) || !Number.isFinite(of) || of <= 0 || won < 0 || won > of) return null;
  return { won, of };
}

/**
 * Read "how many of the people who ask go on to pay" — only when BOTH numbers
 * are present (or a clear word like "half"). A bare "2" is not a ratio.
 */
export function parseCloseRate(raw?: string | null): Ratio | null {
  if (!raw) return null;
  const t = wordsToDigits(raw.toLowerCase()).replace(/,/g, "");
  const num = "(\\d+(?:\\.\\d+)?)";
  const join = "\\s*(?:out of|outta|in|of|\\/)\\s*(?:about|around|roughly|approximately|approx\\.?|maybe|every|each|like)?\\s*";
  let m = t.match(new RegExp(`${num}\\s*(?:to|-|–|or)\\s*${num}${join}${num}`));
  if (m) return validRatio((Number(m[1]) + Number(m[2])) / 2, Number(m[3]));
  m = t.match(new RegExp(`${num}${join}${num}`));
  if (m) return validRatio(Number(m[1]), Number(m[2]));
  m = t.match(/(\d+(?:\.\d+)?)\s*(?:%|percent)/);
  if (m) return validRatio(Number(m[1]) / 10, 10);
  if (/\bhalf\b/.test(t) && !/(more|less|over|under) than half|over half|under half/.test(t)) return { won: 1, of: 2 };
  return null;
}

/** True when a reply is just a number with no "out of" — e.g. "2", "about 3". */
export function isBareNumber(raw: string): number | null {
  const t = wordsToDigits(raw.toLowerCase()).trim();
  if (/out of|outta|\bin\b|\bof\b|\/|%|percent|half|most|few|all|none|every/.test(t)) return null;
  const m = t.match(/^(?:about|around|roughly|maybe|like|just|only)?\s*(\d+(?:\.\d+)?)\s*(?:people|persons|clients|customers|of them)?[.!]*$/);
  return m ? Number(m[1]) : null;
}

const NUM_RE = /(\d+(?:\.\d+)?)\s*(k\b|thousand|hundred\b|lakhs?\b|lacs?\b|crores?\b|mil\b|million|m\b|bn\b|b\b|billion)?/g;

function scaleFor(suffix: string | undefined): number {
  const s = (suffix ?? "").toLowerCase();
  if (s.startsWith("k") || s.startsWith("thousand")) return 1e3;
  if (s.startsWith("hundred")) return 100;
  if (s.startsWith("lak") || s.startsWith("lac")) return 1e5;
  if (s.startsWith("crore")) return 1e7;
  if (s.startsWith("bn") || s === "b" || s.startsWith("billion")) return 1e9;
  if (s.startsWith("m")) return 1e6;
  return 1;
}

function numbersIn(t: string): number[] {
  const tokens = [...t.matchAll(NUM_RE)].map((m) => ({ value: Number(m[1]), scale: scaleFor(m[2]) }));
  // "50 to 200k" — the first number borrows the second's scale.
  if (tokens.length >= 2 && tokens[0].scale === 1 && tokens[1].scale > 1 && tokens[0].value < 1000) {
    tokens[0].scale = tokens[1].scale;
  } else if (tokens.length >= 2 && tokens[0].scale === 1 && tokens[0].value < 1000) {
    // "fifty to seventy thousand" arrives as "50 to 70000": the same borrowing, when it fits
    // (50 thousand is below 70 thousand, and close to it) — "₦500 to ₦70,000" is left alone.
    const second = tokens[1].value * tokens[1].scale;
    const s = second >= 1e9 ? 1e9 : second >= 1e6 ? 1e6 : second >= 1e3 ? 1e3 : 1;
    const first = tokens[0].value * s;
    if (s > 1 && first <= second && first * 100 >= second) tokens[0].scale = s;
  }
  return tokens.map((x) => x.value * x.scale).filter((v) => Number.isFinite(v));
}

/** Read a rough money amount or range: "₦50,000 – ₦200,000", "about 300k", "over ₦1 million". */
export function parseAmount(raw?: string | null): Range | null {
  if (!raw) return null;
  const t = wordsToDigits(
    raw
      .toLowerCase()
      .replace(/[,₦$£€]/g, "")
      .replace(/\b(ngn|naira|usd|dollars?|pounds?|euros?|kes|ghs|cedis?|rand|zar)\b/g, " "),
  );
  const nums = numbersIn(t);
  if (nums.length === 0) return null;
  if (nums.length >= 2) {
    const low = Math.min(nums[0], nums[1]);
    const high = Math.max(nums[0], nums[1]);
    return low > 0 ? { low, high } : null;
  }
  const v = nums[0];
  if (v <= 0) return null;
  if (/\b(under|below|less than|up to|not more than)\b/.test(t)) return { low: v / 2, high: v };
  return { low: v, high: v };
}

/** Read a rough count per month: "6 to 15 a month", "about 10", "3 a week", "more than 40". */
export function parseCount(raw?: string | null): Range | null {
  if (!raw) return null;
  const t = wordsToDigits(raw.toLowerCase().replace(/,/g, ""));
  const nums = [...t.matchAll(/(\d+(?:\.\d+)?)/g)].map((m) => Number(m[1])).filter((v) => Number.isFinite(v));
  if (nums.length === 0) return null;
  let range: Range;
  if (nums.length >= 2) range = { low: Math.min(nums[0], nums[1]), high: Math.max(nums[0], nums[1]) };
  else if (/\b(under|below|less than|up to|fewer than)\b/.test(t)) range = { low: Math.max(1, nums[0] / 2), high: nums[0] };
  else range = { low: nums[0], high: nums[0] };
  const factor = /\b(week|weekly)\b/.test(t) ? 4 : /\b(day|daily)\b/.test(t) ? 26 : /\b(year|yearly|annual)\b/.test(t) ? 1 / 12 : 1;
  range = { low: range.low * factor, high: range.high * factor };
  return range.high > 0 ? range : null;
}

/** "₦ (Nigerian Naira)" -> "₦" */
export function currencySymbol(currency?: string | null): string {
  const m = (currency ?? "").trim().match(/^[^\s(]+/);
  return m ? m[0] : "₦";
}

/** Round to 2 significant figures so estimates never look falsely precise. */
function nice(n: number): number {
  if (!Number.isFinite(n) || n === 0) return 0;
  const p = Math.pow(10, Math.floor(Math.log10(Math.abs(n))) - 1);
  return Math.round(n / p) * p;
}

function oneDecimal(x: number): string {
  return String(Math.round(x * 10) / 10);
}

export function formatMoney(n: number, cur: string): string {
  const v = nice(n);
  if (v >= 1e9) return `${cur}${oneDecimal(v / 1e9)}bn`;
  if (v >= 1e6) return `${cur}${oneDecimal(v / 1e6)}m`;
  if (v >= 1e3) return `${cur}${oneDecimal(v / 1e3)}k`;
  return `${cur}${Math.round(v)}`;
}

export function formatMoneyRange(r: Range, cur: string): string {
  const a = formatMoney(r.low, cur);
  const b = formatMoney(r.high, cur);
  return a === b ? a : `${a}–${b}`;
}

function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : oneDecimal(n);
}

export function ratioText(r: Ratio): string {
  return `${fmtNum(r.won)} out of ${fmtNum(r.of)}`;
}

function countText(n: Range): string {
  const a = Math.round(n.low);
  const b = Math.round(n.high);
  return a === b ? `${b}` : `${a} to ${b}`;
}

/** A per-month count range in words; tiny numbers are expressed per year instead. */
function countRange(low: number, high: number): { text: string; period: "a month" | "a year"; scale: number } {
  if (high < 1) {
    const yl = Math.round(low * 12);
    const yh = Math.max(1, Math.round(high * 12));
    return { text: yl === yh || yl === 0 ? `about ${yh}` : `${yl}–${yh}`, period: "a year", scale: 12 };
  }
  const l = Math.round(low);
  const h = Math.round(high);
  return { text: l === h ? `about ${h}` : l === 0 ? `up to ${h}` : `${l}–${h}`, period: "a month", scale: 1 };
}

/** "from the same referrals" only when referrals really are where customers come from. */
function channelPhrase(channels?: string[]): string {
  const list = (channels ?? []).map((c) => c.toLowerCase()).filter(Boolean);
  if (list.length > 0 && list.every((c) => /referr|word of mouth|recommend|friends?/.test(c))) return "from the same referrals";
  if (list.length > 0 && list.every((c) => /walk[\s-]?in|shop|stall|market/.test(c))) return "from the same people walking in";
  return "from the people who already ask";
}

/** Owner serves "everyone" / "all kinds" — the classic cause of price shopping. */
export function isBroadMarket(text?: string | null): boolean {
  return /\b(every|everyone|everybody|all|any|anyone|anybody|whoever|not boxed)\b/i.test(text ?? "");
}

/**
 * What fixing the main problem is worth, from the owner's own estimates.
 * The angle follows the stage: for "found"/"enquire" it is the value of each
 * new person who asks; for "convert" (and by default) it is winning one more
 * of the people who already ask; for "return" it is one more job from a past client.
 */
export function computeStake(
  facts: Partial<Pick<BusinessFacts, "closeRate" | "jobValue" | "monthlyEnquiries" | "channels">>,
  cur: string,
  stage: FocusStage,
): DiagnosisStake | null {
  const r = parseCloseRate(facts.closeRate);
  const v = parseAmount(facts.jobValue);
  const n = parseCount(facts.monthlyEnquiries);
  const from = channelPhrase(facts.channels);

  if ((stage === "found" || stage === "enquire") && r && r.won > 0 && v) {
    const share = r.won / r.of;
    const per = { low: v.low * share, high: v.high * share };
    const working = [
      `You said about ${ratioText(r)} people who ask go on to pay you.`,
      `One customer usually pays about ${formatMoneyRange(v, cur)}.`,
      `So, on average, every new person who asks is worth about ${formatMoneyRange(per, cur)} to you.`,
    ];
    const five = { low: per.low * 5, high: per.high * 5 };
    working.push(`Just 5 more people asking each month would mean about ${formatMoneyRange(five, cur)} more a month.`);
    return {
      figure: formatMoneyRange(per, cur),
      label: "is what every new person who asks is worth to you",
      detail: `5 more people asking a month ≈ ${formatMoneyRange(five, cur)} more a month.`,
      working,
      isMoney: true,
    };
  }

  if (stage === "return" && v) {
    return {
      figure: formatMoneyRange(v, cur),
      label: "is what each extra purchase from a past customer is worth",
      detail: "Past customers already trust you — no marketing cost to win them again.",
      working: [`One customer usually pays about ${formatMoneyRange(v, cur)}.`, "Each past customer who comes back once more adds about that much, without any marketing."],
      isMoney: true,
    };
  }

  // "About half" is 1 out of 2 — but "win one more of every 2" would mean winning
  // everyone. Small ratios are read as "out of 10"; a rate that is already high
  // (8 in 10 or better) is not where the money is, so no "win one more" figure.
  const r10 = r && r.of < 5 ? { won: (r.won * 10) / r.of, of: 10 } : r;
  if (r && r10 && r10.won > 0 && r10.won / r10.of < 0.8) {
    const nextWon = Math.min(r10.of, r10.won + 1);
    const pct = Math.round(((nextWon - r10.won) / r10.won) * 100);
    const working = [
      r10 === r
        ? `You said about ${ratioText(r)} people who ask go on to pay you.`
        : `You said ${/\d/.test(facts.closeRate ?? "") ? `about ${ratioText(r)}` : (facts.closeRate ?? "").trim().replace(/^./, (c) => c.toLowerCase())} of the people who ask go on to pay you — that is about ${ratioText(r10)}.`,
      `Winning just one more out of every ${fmtNum(r10.of)} makes it ${fmtNum(nextWon)} out of ${fmtNum(r10.of)}.`,
      `That is ${pct}% more paying customers ${from} — with no extra marketing.`,
    ];
    let figure = `+${pct}%`;
    let label = `more paying customers ${from}`;
    let detail: string | undefined;
    let isMoney = false;
    if (n) {
      const extra = countRange(n.low / r10.of, n.high / r10.of);
      const who = extra.text === "about 1" ? "paying customer" : "paying customers";
      working.push(`About ${countText(n)} people ask in a normal month, so that is ${extra.text} more ${who} ${extra.period}.`);
      detail = `That is ${extra.text} more ${who} ${extra.period}.`;
      if (v) {
        const money = { low: (n.low / r10.of) * v.low * extra.scale, high: (n.high / r10.of) * v.high * extra.scale };
        working.push(`At about ${formatMoneyRange(v, cur)} each, that is about ${formatMoneyRange(money, cur)} more ${extra.period}.`);
        figure = formatMoneyRange(money, cur);
        label = extra.period === "a month" ? "more coming in every month" : "more coming in every year";
        detail = `If you win just one more of every ${fmtNum(r10.of)} people who ask — ${pct}% more paying customers ${from}.`;
        isMoney = true;
      }
    } else if (v) {
      detail = `Each extra customer is worth about ${formatMoneyRange(v, cur)} to you.`;
      working.push(detail);
    }
    return { figure, label, detail, working, isMoney };
  }

  if (v) {
    return {
      figure: formatMoneyRange(v, cur),
      label: "is what each extra customer is worth to you",
      working: [`One customer usually pays about ${formatMoneyRange(v, cur)}.`],
      isMoney: true,
    };
  }
  return null;
}

/** Plain lines for the model: the computed figures it may quote, word for word. */
export function stakeLinesForPrompt(
  facts: Partial<Pick<BusinessFacts, "closeRate" | "jobValue" | "monthlyEnquiries" | "channels">>,
  cur: string,
): string[] {
  const lines = new Set<string>();
  for (const stage of ["convert", "found"] as FocusStage[]) {
    const s = computeStake(facts, cur, stage);
    s?.working.forEach((w) => lines.add(w));
  }
  return [...lines];
}

/* ------------------------------------------------------------------ */
/* Plain language                                                       */
/* ------------------------------------------------------------------ */

function keepCase(match: string, replacement: string): string {
  return match[0] === match[0].toUpperCase() ? replacement[0].toUpperCase() + replacement.slice(1) : replacement;
}

/**
 * Swap business-school jargon for everyday words — unless the owner used the
 * word themselves. A safety net behind the prompts, not a replacement for them.
 */
// Scripts other than Latin (Greek, Cyrillic, Hebrew, Arabic, Devanagari, Thai, Japanese, Chinese, Korean).
const OTHER_SCRIPT = "\\u0370-\\u03FF\\u0400-\\u04FF\\u0590-\\u05FF\\u0600-\\u06FF\\u0750-\\u077F\\u0900-\\u097F\\u0E00-\\u0E7F\\u3040-\\u30FF\\u3400-\\u4DBF\\u4E00-\\u9FFF\\uAC00-\\uD7AF";

/**
 * A model sometimes slips a word from another language into an English reply
 * ("how quickly do you عادة reply"). Words in a script the owner never wrote in
 * are removed; an owner who writes in that script keeps them.
 */
export function dropForeignScript(text: string, ownerText = ""): string {
  const any = new RegExp(`[${OTHER_SCRIPT}]`);
  if (!any.test(text) || any.test(ownerText)) return text;
  return text
    .replace(new RegExp(`[${OTHER_SCRIPT}]+`, "g"), "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([,.!?;:])/g, "$1")
    .trim();
}

export function plainify(text: string, ownerText = ""): string {
  if (!text) return text;
  const owner = ownerText.toLowerCase();
  let out = dropForeignScript(text, ownerText);
  const rep = (re: RegExp, replacement: string) => {
    out = out.replace(re, (m) => keepCase(m, replacement));
  };
  if (!/\bsign/.test(owner)) {
    out = out.replace(/\bsigned\s+(projects?|clients?|customers?|deals?|jobs?|contracts?|work)\b/gi, (m, w: string) => keepCase(m, `paying ${w}`));
    rep(/\bsign(?:s|ing)?[- ]?ups?\b/gi, "new customers");
    rep(/\bsigned\b/gi, "won");
  }
  if (!/\bleads?\b/.test(owner)) rep(/\bleads\b/gi, "enquiries");
  if (!/prospect/.test(owner)) {
    rep(/\bprospects\b/gi, "people who ask");
    rep(/\bprospect\b/gi, "potential customer");
  }
  if (!/conver/.test(owner)) {
    rep(/\bconversion rates?\b/gi, "share of enquiries that pay");
    out = out.replace(/\b(doesn't|does not|don't|do not|didn't|did not|won't|will not|never|not) convert\b/gi, "$1 turn into paying work");
    out = out.replace(/\b(that|which|who) convert\b/gi, "$1 turn into paying work");
    out = out.replace(/\b(that|which|who) converts\b/gi, "$1 turns into paying work");
    rep(/\bconversions?\b/gi, "sales");
    out = out.replace(/\bconvert(s|ed|ing)?\b/gi, (m, s?: string) =>
      keepCase(m, s === "s" ? "turns" : s === "ed" ? "turned" : s === "ing" ? "turning" : "turn"),
    );
  }
  if (!/funnel/.test(owner)) rep(/\bfunnel\b/gi, "path to buying");
  if (!/pipeline/.test(owner)) rep(/\bpipeline\b/gi, "list of people who asked");
  if (!/acquisition/.test(owner)) rep(/\b(?:customer |client )?acquisition\b/gi, "finding new customers");
  if (!/retention/.test(owner)) rep(/\b(?:customer |client )?retention\b/gi, "customers coming back");
  if (!/churn/.test(owner)) rep(/\bchurn\b/gi, "customers leaving");
  if (!/\broi\b/.test(owner)) out = out.replace(/\bROI\b/g, "return");
  if (!/\bkpis?\b/.test(owner)) out = out.replace(/\bKPIs?\b/g, "numbers");
  return out;
}

/**
 * Light tidy for an owner's own words shown back to them: drop leading
 * fillers ("actually,", "well,"), capitalise, "i" → "I". Never rewrites meaning.
 */
export function tidyOwnerText(text: string): string {
  let t = text.replace(/\s+/g, " ").trim();
  t = t.replace(/^(actually|well|so|um+|uh+|hmm+|like|basically|honestly|ok(ay)?|yes|yeah|no)\b[,.!]?\s+(?=\S)/i, "");
  t = t.replace(/\bi\b/g, "I").replace(/\bi'(m|ve|d|ll)\b/gi, (_m, s: string) => `I'${s.toLowerCase()}`);
  t = t.replace(/\s+([,.!?])/g, "$1");
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}

/** Shorten at a word boundary with an ellipsis — never mid-word. */
export function shorten(text: string, cap: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= cap) return clean;
  const cut = clean.slice(0, cap - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > cap * 0.5 ? cut.slice(0, space) : cut).replace(/[\s,;:–-]+$/, "")}…`;
}

/**
 * Amounts in a piece of text written out in full, so the owner sees exactly what was understood:
 * "300k" -> "₦300,000", "₦3.6m, in 9 days" -> "₦3,600,000, in 9 days", "fifty to seventy
 * thousand a day" -> "₦50,000 to ₦70,000 a day". Counts and percentages ("26 days", "20%")
 * are left alone. For display only — what the owner typed is what is stored.
 */
export function amountInFull(text: string, cur: string): string {
  const t = wordsToDigits(text);
  const re = /(?:([₦$£€₵¥₹])\s?|\b([Nn])(?=\d))?(\d[\d,]*(?:\.\d+)?)(\s?(?:k|m|bn|b|thousand|hundred|lakhs?|lacs?|crores?|million|billion)\b)?(\s+(?:naira|ngn|cedis?|ghs|kes|shillings?|rand|zar|usd|dollars?|pounds?|euros?)\b)?/gi;
  const toks: { start: number; end: number; value: number; sign?: string; money: boolean }[] = [];
  for (const m of t.matchAll(re)) {
    const raw = Number(m[3].replace(/,/g, ""));
    if (!Number.isFinite(raw)) continue;
    const value = raw * (m[4] ? scaleFor(m[4].trim()) : 1);
    // "%" right after means a percentage, never money.
    if (t[(m.index ?? 0) + m[0].length] === "%") continue;
    toks.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length, value, sign: m[1], money: Boolean(m[1] || m[2] || m[4] || m[5]) || value >= 1000 });
  }
  // "50 to 70000" (from "fifty to seventy thousand"): the first borrows the second's scale when it fits.
  for (let i = 0; i + 1 < toks.length; i++) {
    const a = toks[i];
    const b = toks[i + 1];
    if (a.money || !b.money || !/^\s*(?:to|-|–|and|or)\s*$/i.test(t.slice(a.end, b.start))) continue;
    const s = b.value >= 1e9 ? 1e9 : b.value >= 1e6 ? 1e6 : b.value >= 1e3 ? 1e3 : 1;
    if (s > 1 && a.value * s <= b.value && a.value * s * 100 >= b.value) Object.assign(a, { value: a.value * s, money: true, sign: b.sign });
  }
  let out = "";
  let pos = 0;
  for (const k of toks) {
    if (!k.money) continue;
    out += `${t.slice(pos, k.start)}${k.sign ?? cur}${Math.round(k.value).toLocaleString("en-US")}`;
    pos = k.end;
  }
  return out + t.slice(pos);
}

// How each currency is written: its sign, codes and words. "N960k" is naira, "R500" is rand.
const CURRENCY_MARKS: { sign: string; re: RegExp }[] = [
  { sign: "₦", re: /₦|\bngn\b|\bnaira\b|(?:^|[^a-z])n(?=\d)/i },
  { sign: "₵", re: /₵|gh¢|\bghs\b|\bcedis?\b/i },
  { sign: "$", re: /\$|\busd\b|\bdollars?\b/i },
  { sign: "£", re: /£|\bgbp\b|\bpounds?\b/i },
  { sign: "€", re: /€|\beur\b|\beuros?\b/i },
  { sign: "KSh", re: /\bksh\b|\bkes\b|\bshillings?\b/i },
  { sign: "R", re: /\bzar\b|\brand\b|(?:^|\s)r(?=\d)/i },
  { sign: "₹", re: /₹|\binr\b|\brupees?\b/i },
];

/**
 * A currency other than the business's own in this text ("$960,000" in a naira business), or
 * null. Amounts are only ever added up in the business's own currency — Nellovia never converts
 * (that would mean guessing a rate), so a figure in another currency is asked about, not used.
 */
export function foreignCurrency(text: string | null | undefined, cur: string): string | null {
  if (!text) return null;
  const home = CURRENCY_MARKS.find((m) => m.sign === cur || m.re.test(cur))?.sign ?? cur;
  for (const m of CURRENCY_MARKS) if (m.sign !== home && m.re.test(text)) return m.sign;
  return null;
}
