/**
 * chat-engine.ts — deterministic slot-filling engine for the
 * "Chat with the intelligence" intake (months / revenue / marketing).
 *
 * WHY THIS EXISTS — the bugs it fixes (each was observed in the live chat):
 *  B1  "we didnt do any marketing" was not extracted (no digits to match),
 *      so the bot re-asked the SAME marketing question verbatim.
 *      -> rule extractor understands zero/negation; a slot is never re-asked.
 *  B2  Quick replies ("Last month") stayed on screen after the month was
 *      answered; tapping one created a junk turn.
 *      -> quick replies are regenerated for the CURRENT question only.
 *  B3  Duplicate answers were acknowledged as new ("Noted — October 2026")
 *      and the same question text was repeated word-for-word.
 *      -> duplicate guard + re-ask always uses a DIFFERENT wording variant.
 *  B4  Every turn restated the whole context ("October 2026, revenue
 *      ₦200,000 …") three turns in a row.
 *      -> acknowledgements mention ONLY what was just captured; the running
 *         summary lives in the chips strip, not in prose.
 *  B5  The "What I've heard so far" chips never gained "Marketing: ₦0".
 *      -> chips are derived from state on every turn; zero is a real value.
 *  B6  No progress indicator, no auto-finish.
 *      -> progress = answered/total on every turn; engine auto-finishes and
 *         returns the record when all slots are captured or skipped.
 *
 * DESIGN RULE: the CODE decides which question comes next; the model (if you
 * keep one) only extracts values into the `Extraction` shape below. Never let
 * an LLM compose the next question — it will repeat itself.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SlotKey = "month" | "revenue" | "marketing";

/** month: 1–12 */
export type MonthValue = { year: number; month: number; label: string };
export type MoneyValue = { amount: number; isZero: boolean };

export type SlotRecord = {
  key: SlotKey;
  status: "answered" | "unknown";
  /** month slot -> MonthValue; money slots -> MoneyValue */
  value?: MonthValue | MoneyValue;
  fromText?: string;
};

export type Chip = { label: string; muted?: boolean };

export type EngineTurn = {
  assistantText: string;
  chips: Chip[];
  progress: { answered: number; total: number; currentLabel: string | null };
  quickReplies: string[];
  /** true when every slot is answered/unknown and `result` is present */
  done: boolean;
  /** true only on the turn where the user asked to save */
  saveRequested: boolean;
  result?: IntakeResult;
};

export type IntakeResult = {
  month: MonthValue | null;
  revenue: number | null;
  marketing: number | null;
  unknownSlots: SlotKey[];
};

/** What extraction may produce from one user message. */
export type Extraction = {
  month?: MonthValue;
  revenue?: MoneyValue;
  marketing?: MoneyValue;
};

export type LlmExtractor = (
  userText: string,
  currentSlot: SlotKey | null
) => Promise<Extraction | null> | Extraction | null;

export type EngineOptions = {
  /** Reference "today" for resolving "last month". Defaults to now. */
  today?: Date;
  /** Shown in the first question, e.g. "Node 71 limited". */
  businessName?: string;
  currency?: string;
  /**
   * Optional async extractor (your LLM). Runs AFTER the rule extractor and may
   * only FILL gaps — rule results win on conflicts so the bot can never
   * "forget" a captured value.
   */
  llmExtract?: LlmExtractor;
};

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function formatMoney(amount: number, currency = "₦"): string {
  const rounded = Math.round(amount);
  return `${currency}${rounded.toLocaleString("en-US")}`;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

const MONTH_NAMES: [string, number][] = [
  ["january", 1], ["february", 2], ["march", 3], ["april", 4], ["may", 5],
  ["june", 6], ["july", 7], ["august", 8], ["september", 9], ["october", 10],
  ["november", 11], ["december", 12],
];

const REVENUE_KEYWORDS =
  /\b(made|revenue|sales|sold|earn|earned|income|turnover|gross|takings|came in|make)\b/i;
const MARKETING_KEYWORDS =
  /\b(marketing|ads?|adverts?|advertising|promo(?:tion)?s?|influencers?|sponsored|boost(?:ed|s)?|jingles?|billboards?|flyers?|spend|spent|spending|expenses?)\b/i;

/** "didn't do any", "no marketing", "nothing on ads", "zero", "nil", … */
const NEGATION =
  /\b(didn'?t|did not|dont'?|do not|never|no|none|nothing|zero|nil|without|not\s+(?:do|spend|use))\b/i;

const MONEY_RE =
  /(?:₦|ngn|naira)?\s*(\d[\d,]*(?:\.\d+)?)\s*(k\b|k\b|m\b|mm\b|million|thousand)?/i;
const ANY_NUMBER_RE = /\d/;

function parseNumber(raw: string, unit?: string): number {
  let n = Number(raw.replace(/,/g, "").trim());
  if (!isFinite(n)) return NaN;
  const u = (unit || "").toLowerCase();
  if (u === "k" || u === "thousand") n *= 1_000;
  if (u === "m" || u === "mm" || u === "million") n *= 1_000_000;
  return n;
}

function resolveMonth(year: number, month: number, today: Date): MonthValue | undefined {
  // A bare month name means the most recent occurrence that is not in the future.
  let y = year;
  if (new Date(y, month - 1, 1) > new Date(today.getFullYear(), today.getMonth(), 1)) {
    y -= 1;
  }
  if (y < 1970 || y > today.getFullYear() + 1 || month < 1 || month > 12) return undefined;
  const label = `${MONTH_NAMES[month - 1][0][0].toUpperCase()}${MONTH_NAMES[month - 1][0].slice(1)} ${y}`;
  return { year: y, month, label };
}

/** Extracts a month from free text. Returns undefined when nothing matches. */
export function parseMonth(text: string, today: Date): MonthValue | undefined {
  const t = text.toLowerCase();

  if (/\blast\s+month\b/.test(t)) {
    const d = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    return resolveMonth(d.getFullYear(), d.getMonth() + 1, today);
  }
  if (/\b(this|current)\s+month\b/.test(t)) {
    return resolveMonth(today.getFullYear(), today.getMonth() + 1, today);
  }

  // Numeric: "10/2026", "10-26", "2026-10" (4-digit alternatives first)
  const my = t.match(/\b(19\d{2}|20\d{2}|\d{1,2})[\/\-](19\d{2}|20\d{2}|\d{1,2})\b/);
  if (my) {
    const a = parseInt(my[1], 10);
    const b = parseInt(my[2], 10);
    if (a >= 1970) {
      if (b >= 1 && b <= 12) return resolveMonth(a, b, today); // yyyy-mm
      return undefined;
    }
    if (b >= 1970) {
      if (a >= 1 && a <= 12) return resolveMonth(b, a, today); // mm/yyyy
      return undefined;
    }
    if (a >= 1 && a <= 12 && b <= 99) return resolveMonth(2000 + b, a, today); // mm-yy
    return undefined;
  }

  // Month name, optionally with a year: "october 2026", "oct", "oct '25".
  // Full names before abbreviations; the trailing \b stops "mar" from
  // matching inside "marketing".
  const MONTH_TOKEN_RE =
    /\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)\b(?:\s*,?\s*(\d{4})\b|\s*'(\d{2})\b)?/i;
  const m = t.match(MONTH_TOKEN_RE);
  if (!m) return undefined;

  const token = m[1].toLowerCase();
  // "we may have made 700k" must not become May — without an explicit year,
  // only accept may/march in short answers.
  if (!m[2] && !m[3] && /^(may|march)$/.test(token) && text.trim().split(/\s+/).length > 3) {
    return undefined;
  }

  const idx = MONTH_NAMES.findIndex(([n]) => n.startsWith(token.slice(0, 3)));
  if (idx < 0) return undefined;

  let y = today.getFullYear();
  if (m[2]) y = parseInt(m[2], 10);
  else if (m[3]) y = 2000 + parseInt(m[3], 10);
  return resolveMonth(y, MONTH_NAMES[idx][1], today);
}

type Clause = { text: string; slotHint?: "revenue" | "marketing" };

function splitClauses(text: string): Clause[] {
  return text
    .split(/[.!?;\n]+|,\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((text) => ({
      text,
      slotHint: MARKETING_KEYWORDS.test(text)
        ? "marketing"
        : REVENUE_KEYWORDS.test(text)
        ? "revenue"
        : undefined,
    }));
}

/**
 * Rule-based extractor. Handles the shapes the live chat failed on:
 *  - "we didnt do any marketing"  -> marketing = ₦0
 *  - "we made about 700k, spent 200k on ads" -> revenue 700k + marketing 200k
 *  - "₦200,000" / "200k" / "2m" / "none" (in context of the current question)
 */
export function extractFromText(
  userText: string,
  currentSlot: SlotKey | null,
  today: Date
): Extraction {
  const out: Extraction = {};
  const t = userText.toLowerCase();

  // --- month ---
  // Trust month parsing when the month question is current, the text carries
  // an explicit year ("october 2026", "10/2026"), or it names the month
  // unambiguously ("last month"). Otherwise "we MAY have made 200k" would
  // be read as May.
  if (
    currentSlot === "month" ||
    /\b(?:19|20)\d{2}\b/.test(t) ||
    /\b(last|this|current)\s+month\b/.test(t)
  ) {
    const month = parseMonth(userText, today);
    if (month) out.month = month;
  }

  // "none / nothing / zero" as a standalone answer to the marketing question
  if (currentSlot === "marketing" && !ANY_NUMBER_RE.test(t) &&
      /\b(none|no|nothing|zero|nil|didn'?t|did not|not at all)\b/.test(t)) {
    out.marketing = { amount: 0, isZero: true };
  }

  // --- money per clause ---
  for (const clause of splitClauses(userText)) {
    const c = clause.text.toLowerCase();
    const numMatch = c.match(MONEY_RE);
    const hasNegation = NEGATION.test(c);
    const isMarketingClause =
      clause.slotHint === "marketing" ||
      (clause.slotHint === undefined &&
        currentSlot === "marketing" &&
        !REVENUE_KEYWORDS.test(c));

    if (numMatch) {
      const amount = parseNumber(numMatch[1], numMatch[2]);
      if (!isFinite(amount) || amount < 0) continue;
      const value: MoneyValue = { amount, isZero: amount === 0 };
      if (isMarketingClause) {
        if (out.marketing === undefined) out.marketing = value;
      } else if (clause.slotHint === "revenue") {
        if (out.revenue === undefined) out.revenue = value;
      } else if (currentSlot === "revenue" && out.revenue === undefined) {
        out.revenue = value;
      } else if (currentSlot === "marketing" && out.marketing === undefined) {
        out.marketing = value;
      }
    } else if (hasNegation && clause.slotHint === "marketing" && out.marketing === undefined) {
      // "we didnt do any marketing" — no number, but negation + keyword => 0
      out.marketing = { amount: 0, isZero: true };
    }
  }

  // If the current question is marketing and the whole message negates it
  // ("no", "we didn't", "nothing") without a number anywhere -> 0.
  if (
    currentSlot === "marketing" &&
    out.marketing === undefined &&
    hasAnyMoney(out) === false &&
    !ANY_NUMBER_RE.test(t) &&
    NEGATION.test(t)
  ) {
    out.marketing = { amount: 0, isZero: true };
  }

  // Don't extract a month from answers given while a money question is current
  // unless the text really names a month (parseMonth is already conservative).
  return out;
}

function hasAnyMoney(e: Extraction): boolean {
  return e.revenue !== undefined || e.marketing !== undefined;
}

// ---------------------------------------------------------------------------
// Question catalogue — wording VARIANTS are the fix for verbatim repeats
// ---------------------------------------------------------------------------

type SlotSpec = {
  label: string;
  questions: string[];
  quickReplies: string[];
  skipAllowed: boolean;
};

const SLOT_SPECS: Record<SlotKey, SlotSpec> = {
  month: {
    label: "month",
    questions: [
      "Which month should we look at{for}? If it's easier, just say “last month”.",
      "Which month are we recording — e.g. “October 2026” or “last month”?",
    ],
    quickReplies: ["Last month", "This month"],
    skipAllowed: false,
  },
  revenue: {
    label: "revenue",
    questions: [
      "Roughly how much did the business make that month (in naira)? A ballpark is fine — precision can come later.",
      "And the money that came IN that month — about how much, in naira?",
    ],
    quickReplies: ["I'm not sure"],
    skipAllowed: true,
  },
  marketing: {
    label: "marketing",
    questions: [
      "How much went into marketing that month — ads, promos, influencers, anything you paid to get customers? (₦0 is a valid answer.)",
      "Did you spend anything on getting customers that month? If you did none, just say “none”.",
    ],
    quickReplies: ["₦0 — we did none", "I'm not sure"],
    skipAllowed: true,
  },
};

const ACK_MONTH = ["Got it — {v}.", "{v} it is."];
const ACK_MONEY = ["Noted — {k} {v}.", "{k} {v}, got it."];
const ACK_ZERO = ["Got it — no marketing spend.", "Noted — {k} {v}."];
const DUP_NUDGES = [
  "Already noted — {v}. ",
  "I have that — {v}. ",
];

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export class IntakeEngine {
  private slots = new Map<SlotKey, SlotRecord>();
  private attempts = new Map<SlotKey, number>();
  private askedVariant = new Map<SlotKey, number>();
  private turnCount = 0;
  private readonly today: Date;
  private readonly businessName: string;
  private readonly currency: string;
  private readonly llmExtract?: LlmExtractor;

  constructor(opts: EngineOptions = {}) {
    this.today = opts.today ?? new Date();
    this.businessName = opts.businessName ? ` for ${opts.businessName}` : "";
    this.currency = opts.currency ?? "₦";
    this.llmExtract = opts.llmExtract;
  }

  /** First unanswered slot, or null when everything is captured. */
  currentSlot(): SlotKey | null {
    for (const key of ["month", "revenue", "marketing"] as SlotKey[]) {
      if (!this.slots.has(key)) return key;
    }
    return null;
  }

  private questionFor(key: SlotKey, variantIndex: number): string {
    const spec = SLOT_SPECS[key];
    const idx = variantIndex % spec.questions.length;
    return spec.questions[idx].replace("{for}", key === "month" ? this.businessName : "");
  }

  private nextVariant(key: SlotKey): number {
    const prev = this.askedVariant.get(key) ?? -1;
    const next = prev + 1;
    this.askedVariant.set(key, next);
    return next;
  }

  chips(): Chip[] {
    const chips: Chip[] = [];
    const month = this.slots.get("month");
    if (month?.status === "answered") {
      chips.push({ label: (month.value as MonthValue).label });
    }
    for (const key of ["revenue", "marketing"] as SlotKey[]) {
      const rec = this.slots.get(key);
      if (!rec) continue;
      if (rec.status === "unknown") {
        chips.push({ label: `${cap(key)}: not sure`, muted: true });
      } else {
        const v = rec.value as MoneyValue;
        chips.push({ label: `${cap(key)}: ${formatMoney(v.amount, this.currency)}` });
      }
    }
    return chips;
  }

  private moneyOf(key: SlotKey): MoneyValue | null {
    const rec = this.slots.get(key);
    return rec?.status === "answered" ? (rec.value as MoneyValue) : null;
  }

  result(): IntakeResult {
    const monthRec = this.slots.get("month");
    const unknown: SlotKey[] = [];
    const rev = this.moneyOf("revenue");
    const mkt = this.moneyOf("marketing");
    if (!monthRec || monthRec.status === "unknown") unknown.push("month");
    if (!rev) unknown.push("revenue");
    if (!mkt) unknown.push("marketing");
    return {
      month: monthRec?.status === "answered" ? (monthRec.value as MonthValue) : null,
      revenue: rev ? rev.amount : null,
      marketing: mkt ? mkt.amount : null,
      unknownSlots: unknown,
    };
  }

  private buildTurn(
    assistantText: string,
    opts: { saveRequested?: boolean } = {}
  ): EngineTurn {
    const cur = this.currentSlot();
    const answered = (["month", "revenue", "marketing"] as SlotKey[]).filter((k) =>
      this.slots.has(k)
    ).length;
    const done = cur === null;
    let quickReplies: string[] = [];
    if (!done) {
      const spec = SLOT_SPECS[cur];
      quickReplies = [...spec.quickReplies];
      if (this.turnCount >= 1 && answered >= 1) quickReplies.push("That's everything I have");
    } else {
      quickReplies = ["Save it", "Edit revenue", "Edit marketing", "Edit month"];
    }
    return {
      assistantText,
      chips: this.chips(),
      progress: {
        answered,
        total: 3,
        currentLabel: done ? null : SLOT_SPECS[cur].label,
      },
      quickReplies,
      done,
      saveRequested: opts.saveRequested ?? false,
      result: done ? this.result() : undefined,
    };
  }

  /** Opening question — call once when the panel mounts. */
  open(): EngineTurn {
    this.turnCount++;
    const cur = this.currentSlot();
    if (cur === null) return this.buildTurn("All set — here's your snapshot.");
    const v = this.nextVariant(cur);
    return this.buildTurn(this.questionFor(cur, v));
  }

  private finishText(): string {
    const r = this.result();
    const parts: string[] = [];
    parts.push(r.month ? `Here's your ${r.month.label} snapshot:` : "Here's your snapshot:");
    parts.push(`• Revenue: ${r.revenue === null ? "not sure" : formatMoney(r.revenue, this.currency)}`);
    if (r.marketing === 0) {
      parts.push("• Marketing: ₦0 — no marketing spend recorded (ROAS n/a)");
    } else {
      parts.push(`• Marketing: ${r.marketing === null ? "not sure" : formatMoney(r.marketing, this.currency)}`);
    }
    if (r.unknownSlots.length > 0) {
      parts.push(`Left blank for now: ${r.unknownSlots.map(cap).join(", ")} — you can update it in the Data Centre.`);
    }
    parts.push("Press “Save & finish” to record it.");
    return parts.join("\n");
  }

  private markUnknown(key: SlotKey): void {
    this.slots.set(key, { key, status: "unknown" });
  }

  /** Main entry point. Applies control phrases, then extraction, then capture. */
  async handleUserMessage(text: string): Promise<EngineTurn> {
    const trimmed = (text || "").trim();
    if (!trimmed) return this.buildTurn("Say something — even a ballpark helps.");

    this.turnCount++;

    // --- edit: reopen one slot --------------------------------------------
    const editMatch = trimmed.match(/^edit\s+(month|revenue|marketing)\b/i);
    if (editMatch) {
      const key = editMatch[1].toLowerCase() as SlotKey;
      this.slots.delete(key);
      this.attempts.set(key, 0);
      const v = this.nextVariant(key);
      return this.buildTurn(`Sure — ${SLOT_SPECS[key].label} again. ` + this.questionFor(key, v));
    }

    // --- save / done / "that's everything" --------------------------------
    if (/^(save( it)?|save & finish|done|that'?s everything( i have)?)\.?$/i.test(trimmed)) {
      const haveCore = this.slots.has("month") && this.slots.has("revenue");
      if (haveCore) {
        for (const k of ["month", "revenue", "marketing"] as SlotKey[]) {
          if (!this.slots.has(k)) this.markUnknown(k);
        }
        return this.buildTurn(this.finishText(), { saveRequested: true });
      }
      const missing = this.slots.has("month") ? "revenue" : "month";
      const cur = this.currentSlot();
      return this.buildTurn(
        `Before I save, I still need the ${missing}. ` +
          (cur ? this.questionFor(cur, this.nextVariant(cur)) : ""),
      );
    }

    // --- skip ---------------------------------------------------------------
    if (/^skip( (this|it))?\.?$/i.test(trimmed)) {
      const cur = this.currentSlot();
      if (cur) {
        if (SLOT_SPECS[cur].skipAllowed) {
          this.markUnknown(cur);
          return this.afterCapture([], `OK — ${SLOT_SPECS[cur].label} left blank for now.`);
        }
        return this.buildTurn(
          "The month is the one thing I can't skip — everything hangs on it. " +
            this.questionFor(cur, this.nextVariant(cur)),
        );
      }
    }

    // --- "I'm not sure" ------------------------------------------------------
    if (/^(i'?m not sure|not sure|idk|i don'?t know)\.?$/i.test(trimmed)) {
      const cur = this.currentSlot();
      if (cur && SLOT_SPECS[cur].skipAllowed) {
        this.markUnknown(cur);
        return this.afterCapture([], `OK — ${SLOT_SPECS[cur].label} marked “not sure”.`);
      }
      // month question: fall through to the failure ladder (rephrase)
    }

    // --- done-state guard: everything captured, nothing left to extract ------
    if (this.currentSlot() === null) {
      return this.buildTurn("All captured ✓ — press “Save & finish”, or type “edit revenue” to change a number.");
    }

    const cur = this.currentSlot();

    // --- extraction -------------------------------------------------------
    let extraction = extractFromText(trimmed, cur, this.today);
    if (this.llmExtract) {
      try {
        const llm = await this.llmExtract(trimmed, cur);
        if (llm) {
          // rules win on conflicts; LLM only fills gaps
          extraction = {
            month: extraction.month ?? llm.month,
            revenue: extraction.revenue ?? llm.revenue,
            marketing: extraction.marketing ?? llm.marketing,
          };
        }
      } catch {
        /* LLM failures must never break the flow — rules already ran */
      }
    }

    // --- apply captures (skip already-answered slots) ----------------------
    const newly: string[] = [];
    let dupNudge: string | null = null;

    if (extraction.month) {
      const rec = this.slots.get("month");
      if (!rec) {
        this.slots.set("month", { key: "month", status: "answered", value: extraction.month, fromText: trimmed });
        newly.push(`month:${extraction.month.label}`);
      } else if (rec.status === "answered") {
        dupNudge = dupNudge ?? pick(DUP_NUDGES, this.turnCount).replace("{v}", (rec.value as MonthValue).label);
      }
    }
    for (const key of ["revenue", "marketing"] as SlotKey[]) {
      const val = key === "revenue" ? extraction.revenue : extraction.marketing;
      if (!val) continue;
      const rec = this.slots.get(key);
      if (!rec) {
        this.slots.set(key, { key, status: "answered", value: val, fromText: trimmed });
        newly.push(key);
      } else if (rec.status === "answered") {
        dupNudge = dupNudge ?? pick(DUP_NUDGES, this.turnCount).replace(
          "{v}", formatMoney((rec.value as MoneyValue).amount, this.currency),
        );
      }
    }

    return this.afterCapture(newly, null, dupNudge);
  }

  /** Compose the response after captures were applied. */
  private afterCapture(
    newly: string[],
    overrideText: string | null,
    dupNudge: string | null = null
  ): EngineTurn {
    const cur = this.currentSlot();

    if (cur === null) {
      return this.buildTurn(overrideText ? overrideText + "\n" + this.finishText() : this.finishText());
    }

    // Nothing captured -> failure ladder for the CURRENT slot only.
    if (newly.length === 0 && !overrideText) {
      const n = (this.attempts.get(cur) ?? 0) + 1;
      this.attempts.set(cur, n);
      const spec = SLOT_SPECS[cur];

      if (n === 1) {
        // Rephrase with a DIFFERENT wording — never repeat verbatim.
        const v = this.nextVariant(cur);
        const lead = dupNudge ? dupNudge : "Hmm, I didn't catch that. ";
        return this.buildTurn(lead + this.questionFor(cur, v));
      }
      if (n === 2) {
        const v = this.nextVariant(cur);
        return this.buildTurn(
          (dupNudge ?? "") +
            `No worries — let's try it another way. ${this.questionFor(cur, v)} You can also skip.`,
        );
      }
      // n >= 3 -> stop blocking the flow. The month can't be unknown (every
      // number hangs on it), so fall back to last month, clearly flagged.
      if (cur === "month") {
        const d = new Date(this.today.getFullYear(), this.today.getMonth() - 1, 1);
        const fallback = resolveMonth(d.getFullYear(), d.getMonth() + 1, this.today)!;
        this.slots.set("month", {
          key: "month", status: "answered", value: fallback, fromText: "default: last month",
        });
        const nxt = this.currentSlot();
        const note = `OK — I'll use ${fallback.label} for now; type “edit month” to change it.`;
        if (nxt === null) return this.buildTurn(`${note}\n${this.finishText()}`);
        return this.buildTurn(`${note} ${this.questionFor(nxt, this.nextVariant(nxt))}`);
      }
      this.markUnknown(cur);
      const nxt = this.currentSlot();
      if (nxt === null) return this.buildTurn(this.finishText());
      const v = this.nextVariant(nxt);
      return this.buildTurn(
        `OK — leaving ${spec.label} blank for now; you can update it later. ` +
          this.questionFor(nxt, v),
      );
    }

    // A capture happened (or a controlled override): acknowledge ONLY the new
    // value, then ask the next question with fresh wording.
    const acks: string[] = [];
    let seed = this.turnCount;
    for (const item of newly) {
      if (item.startsWith("month:")) {
        acks.push(pick(ACK_MONTH, seed++).replace("{v}", item.slice(6)));
      } else {
        const rec = this.slots.get(item as SlotKey)!;
        const v = rec.value as MoneyValue;
        const template = v.isZero && item === "marketing" ? pick(ACK_ZERO, seed++) : pick(ACK_MONEY, seed++);
        acks.push(
          template
            .replace("{k}", cap(item))
            .replace("{v}", formatMoney(v.amount, this.currency)),
        );
      }
    }

    const v = this.nextVariant(cur);
    if (overrideText) {
      return this.buildTurn(overrideText + " " + this.questionFor(cur, v));
    }
    const lead = [dupNudge, acks.join(" ")].filter(Boolean).join(" ");
    return this.buildTurn(lead ? lead + " " + this.questionFor(cur, v) : this.questionFor(cur, v));
  }
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
