import { NextRequest, NextResponse } from "next/server";
import { completeText } from "@/lib/ai";
import {
  ASK_CAP,
  REQUIRED_SLOTS,
  SLOT_KEYS,
  SLOT_LABELS,
  extractJson,
  emptySlots,
  type AskCounts,
  type CheckupPhase,
  type CheckupSlots,
  type ChatRead,
  type ChatTurnResult,
  type SlotKey,
  type TranscriptTurn,
  type TrendDirection,
} from "@/lib/checkup";

export const runtime = "nodejs";

const TREND_VALUES: TrendDirection[] = ["Increased", "Decreased", "About the same", "Don't know"];

const READ_VALUES: ChatRead[] = ["answer", "correction", "partial", "dodge", "question", "other"];

const TREND_SLOT_KEYS: SlotKey[] = ["enquiries", "customers", "revenue"];

/**
 * Deterministic question per slot — used ONLY by the offline fallback and the
 * wrap bridge. The live consultant never draws from this list; it composes its
 * own questions based on what is missing and what the owner just said.
 */
const QUESTION_FOR: Record<SlotKey, string> = {
  businessType: "Is this mainly a service business, or do you sell products?",
  sells: "What does your business actually sell or do, in your own words?",
  targetMarket: "Who are your customers — locals, businesses, anyone specific?",
  location: "Where are you based, and where do you operate?",
  goal: "What is the one thing you most want to improve right now?",
  channels: "Where do your enquiries and customers actually come from?",
  enquiries: "Compared with the previous month, are enquiries up, down, or about the same?",
  customers: "And paying customers over the same period — up, down, or about the same?",
  revenue: "Optional, and a direction is enough: revenue versus last month?",
  changes: "Has anything changed recently in the business — pricing, team, or how you market?",
};

const SYSTEM = `You are the bizzGrowth Business Context Engine — an experienced business consultant running a SHORT first consultation with a business owner. Warm, sharp, efficient, genuinely listening. You never sound like a survey, a form, or a script.

GOAL
Gather enough understanding for a first growth diagnosis — the REQUIRED slots listed in the prompt — plus optional slots when they come naturally. THERE IS NO FIXED QUESTION ORDER. Every owner is different: adapt the interview to the person. You decide what to ask next, each turn.

CHOOSING WHAT TO ASK NEXT
- Look at COVERAGE: what is KNOWN, what is MISSING, what was ASKED already (askCount) or DECLINED.
- Pick the missing slot that connects most naturally to what the owner just said — their words are your bridge. Vary which thread you pull: sometimes follow their story, sometimes close the biggest gap.
- Never ask about anything KNOWN or DECLINED. Never re-ask with the same wording.
- askCount rules: asked once without an answer → try ONE different angle tied to their context; asked twice → stop, treat as "Don't know", move on. A slot at its ask cap is off-limits.
- Harvest aggressively: if one message reveals several slots, record ALL of them in slotUpdates and skip ahead. Owners who volunteer everything deserve a two-minute consultation, not twenty questions.
- Keep it SHORT: aim to finish in 5-8 owner replies. When few gaps remain, prioritise them.

WRAPPING UP
- When the prompt says WRAP: stop asking questions entirely. Reply with a brief, warm close that reflects 2-3 SPECIFICS you learned about their business, note one gap you will cover from their data later if any optional slot stayed unknown, and set nextSlot "none". Do not invent new topics.

CLASSIFY THE OWNER'S LATEST MESSAGE BEFORE REPLYING
- "answer": it actually answers your pending question.
- "correction": it fixes something you got wrong, or narrows/expands something said earlier. Signals: "no", "not just", "actually", "what I mean", "we don't only", or it contradicts a recorded slot. Corrections are valuable: in ONE short clause acknowledge the specific thing you had wrong, restate the corrected understanding using their words, then continue the conversation naturally. NEVER score a correction as a trend answer. NEVER say "understood" and then summarize something they did not say.
- "partial": answers part of it. Reflect the part they gave, then pull the missing piece in one light touch.
- "dodge": they can't or won't answer. Respect it, say briefly how you will cover the gap (estimate later, infer from connected data), and move to a different missing slot. No guilt-tripping.
- "question": they asked you something. Answer honestly in 1-2 sentences, then continue with your next question.

STYLE
- 1-3 short sentences per reply. Plain, direct, human. No emoji, no bullet lists, no "As an AI".
- React to THEIR specifics — channel names, their exact words, cities, what they sell — and what it implies for growth. A bare "Noted" or "That is useful" with nothing specific is a failure.
- Exactly one question per reply (none when wrapping), and the question MUST be written out inside your reply text — never implied or left to the suggested chips. Vary your openers; never start two replies the same way.
- Never invent facts, numbers, channels, or tools. Only reflect what they actually said.

OUTPUT — return ONLY valid JSON, no markdown:
{
  "read": "answer|correction|partial|dodge|question|other",
  "reply": "your consultant reply (<= 3 sentences)",
  "slotUpdates": {
    "businessType": "...", "sells": "...", "targetMarket": "...", "location": "...", "goal": "...",
    "channels": ["full updated list"],
    "enquiries": "Increased|Decreased|About the same|Don't know",
    "customers": "Increased|Decreased|About the same|Don't know",
    "revenue": "Increased|Decreased|About the same|Don't know",
    "changes": ["full updated list"]
  },
  "learnedChips": ["up to 3 chips <= 46 chars describing what changed in the model THIS turn; prefix 'Updated:' when a correction changed something"],
  "nextSlot": "the ONE missing slot your question goes after, or \"none\" when wrapping up",
  "chips": ["up to 4 short suggested replies <= 40 chars for your NEXT question — always include a comfortable option like 'Not sure' or 'Skip this' when sensible; empty when wrapping"]
}
RULES
- slotUpdates: include ONLY slots learned or corrected THIS turn. For trend slots use exactly the enum values; "Don't know" when the owner could not or would not say.
- nextSlot must be a slot that is currently MISSING (or "none" when wrapping).
- learnedChips: omit if this turn changed nothing in the model.
- Write replies in clear, plain, professional English matching the owner's register.`;

interface ChatBody {
  workspaceName?: string;
  country?: string;
  transcript?: TranscriptTurn[];
  phase?: CheckupPhase;
  slots?: Partial<CheckupSlots>;
  askCounts?: AskCounts;
}

function sanitizeSlots(input: Partial<CheckupSlots> | undefined): CheckupSlots {
  const base = emptySlots();
  if (!input) return base;
  const trend = (v: unknown): TrendDirection | undefined =>
    typeof v === "string" && (TREND_VALUES as string[]).includes(v) ? (v as TrendDirection) : undefined;
  const str = (v: unknown, cap: number): string | undefined => {
    const s = typeof v === "string" ? v.trim().slice(0, cap) : "";
    return s.length > 0 ? s : undefined;
  };
  const list = (v: unknown, cap: number, n: number): string[] | undefined =>
    Array.isArray(v) && v.length > 0
      ? v.filter((x) => typeof x === "string" && x.trim().length > 0).map((x) => String(x).trim().slice(0, cap)).slice(0, n)
      : undefined;

  return {
    businessType: str(input.businessType, 120),
    sells: str(input.sells, 160),
    targetMarket: str(input.targetMarket, 160),
    location: str(input.location, 80),
    goal: str(input.goal, 160),
    channels: list(input.channels, 40, 6),
    enquiries: trend(input.enquiries),
    customers: trend(input.customers),
    revenue: trend(input.revenue),
    changes: list(input.changes, 80, 5),
    declined: (list(input.declined, 20, SLOT_KEYS.length) ?? []).filter((d): d is SlotKey => (SLOT_KEYS as string[]).includes(d)),
    corrections:
      typeof input.corrections === "number" && Number.isFinite(input.corrections)
        ? Math.max(0, Math.min(9, Math.round(input.corrections)))
        : 0,
  };
}

function sanitizeAskCounts(input: AskCounts | undefined): AskCounts {
  if (!input || typeof input !== "object") return {};
  const out: AskCounts = {};
  for (const key of SLOT_KEYS) {
    const v = input[key];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) out[key] = Math.min(5, Math.round(v));
  }
  return out;
}

function isResolved(slots: CheckupSlots, key: SlotKey): boolean {
  if (slots.declined.includes(key)) return true;
  const v = slots[key];
  if (key === "channels" || key === "changes") return Array.isArray(v) && v.length > 0;
  return typeof v === "string" && v.length > 0;
}

function missingRequired(slots: CheckupSlots): SlotKey[] {
  return REQUIRED_SLOTS.filter((k) => !isResolved(slots, k));
}

function deriveLearnedChips(updates: Partial<CheckupSlots>): string[] {
  const chips: string[] = [];
  const push = (label: string, v?: string) => {
    if (v) chips.push(`${label}: ${v}`.slice(0, 46));
  };
  push("Business", updates.businessType);
  push("Sells", updates.sells);
  push("Market", updates.targetMarket);
  push("Location", updates.location);
  push("Goal", updates.goal);
  (updates.channels ?? []).slice(0, 2).forEach((c) => chips.push(`Channel: ${c}`.slice(0, 46)));
  (updates.changes ?? []).slice(0, 2).forEach((c) => chips.push(`Change: ${c}`.slice(0, 46)));
  (TREND_SLOT_KEYS).forEach((k) => {
    if (updates[k]) chips.push(`${k === "enquiries" ? "Enquiries" : k === "customers" ? "Customers" : "Revenue"}: ${updates[k]}`);
  });
  return chips.slice(0, 3);
}

function wrapReply(slots: CheckupSlots): string {
  const bits: string[] = [];
  if (slots.sells) bits.push(slots.sells.toLowerCase());
  if (slots.targetMarket) bits.push(`serving ${slots.targetMarket.toLowerCase()}`);
  const openGaps = ["revenue", "changes", "location"].filter((k) => !isResolved(slots, k as SlotKey));
  const gapNote = openGaps.length
    ? ` I will ${openGaps.includes("revenue") ? "estimate the money side from your data" : "fill the remaining gaps"} as your workspace matures.`
    : "";
  return `That covers it — ${bits.join(", ") || "your business as described"}${gapNote} I have what I need to put your first diagnosis together.`;
}

/**
 * Deterministic safety net when the LLM is unreachable. Walks missing slots in
 * priority order, respects ask caps, never converts a non-answer into a trend.
 */
function fallbackTurn(body: {
  phase: CheckupPhase;
  slots: CheckupSlots;
  askCounts: AskCounts;
  lastUser: string;
}): ChatTurnResult {
  const { slots, askCounts, lastUser } = body;
  const t = lastUser.toLowerCase();

  if (body.phase === "done") {
    return { read: "other", reply: wrapReply(slots), learnedChips: [], phase: "done", slots, askCounts, chips: [], degraded: true };
  }

  const correctionish =
    /(^|\s)(no|nope|not just|not only|actually|what i meant|what i mean|correction|we don't|we do not|we also|forget)/.test(t) ||
    /all over the world|worldwide|globally|everywhere|international/.test(t);

  // If the message answers a trend slot, harvest it.
  const trendHarvest: Partial<CheckupSlots> = {};
  if (!correctionish) {
    let trend: TrendDirection | undefined;
    if (/decreas|down|less|fewer|drop|fell|worse|slower/.test(t)) trend = "Decreased";
    else if (/increas|up|more|grew|rise|rose|better|higher/.test(t)) trend = "Increased";
    else if (/don'|do not|no idea|not sure|skip|rather not|prefer not/.test(t)) trend = "Don't know";
    else if (/same|flat|stable|steady|about/.test(t)) trend = "About the same";
    if (trend) {
      for (const key of ["enquiries", "customers", "revenue"] as SlotKey[]) {
        if (!isResolved(slots, key) && (askCounts[key] ?? 0) > 0) trendHarvest[key] = trend;
      }
    }
  }

  const merged: CheckupSlots = { ...slots, ...trendHarvest };
  const learnedChips = Object.keys(trendHarvest).length ? deriveLearnedChips(trendHarvest) : [];

  const missing = missingRequired(merged);
  if (missing.length === 0) {
    return { read: "answer", reply: wrapReply(merged), learnedChips, phase: "done", slots: merged, askCounts, chips: [], degraded: true };
  }

  if (correctionish && Object.keys(trendHarvest).length === 0) {
    const next = missing.find((k) => (askCounts[k] ?? 0) < ASK_CAP[k]) ?? missing[0];
    return {
      read: "correction",
      reply: `Fair correction — noted. ${QUESTION_FOR[next]}`,
      learnedChips: ["Updated: understanding corrected"],
      phase: "interview",
      slots: { ...merged, corrections: merged.corrections + 1 },
      askCounts: { ...askCounts, [next]: (askCounts[next] ?? 0) + 1 },
      chips: [],
      degraded: true,
    };
  }

  // Next missing slot that still has ask budget; decline slots at their cap.
  const nextAskCounts: AskCounts = { ...askCounts };
  for (const key of SLOT_KEYS) {
    if (!isResolved(merged, key) && (nextAskCounts[key] ?? 0) >= ASK_CAP[key]) {
      merged.declined = [...merged.declined, key];
      if ((TREND_SLOT_KEYS as string[]).includes(key)) merged[key as "enquiries"] = "Don't know";
    }
  }
  const target = missingRequired(merged).find((k) => (nextAskCounts[k] ?? 0) < ASK_CAP[k]);
  if (!target) {
    return { read: "other", reply: wrapReply(merged), learnedChips, phase: "done", slots: merged, askCounts: nextAskCounts, chips: [], degraded: true };
  }
  nextAskCounts[target] = (nextAskCounts[target] ?? 0) + 1;
  return {
    read: Object.keys(trendHarvest).length ? "answer" : "other",
    reply: QUESTION_FOR[target],
    learnedChips,
    phase: "interview",
    slots: merged,
    askCounts: nextAskCounts,
    chips: [],
    degraded: true,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChatBody;

    const workspaceName = (body.workspaceName ?? "Your business").slice(0, 120);
    const country = (body.country ?? "Nigeria").slice(0, 80);
    const phase: CheckupPhase = body.phase === "done" ? "done" : "interview";
    const slots = sanitizeSlots(body.slots);
    const askCounts = sanitizeAskCounts(body.askCounts);
    const transcript = Array.isArray(body.transcript)
      ? body.transcript
          .filter((t) => t && typeof t.text === "string" && (t.role === "ai" || t.role === "user"))
          .map((t) => ({ role: t.role, text: t.text.slice(0, 900) }))
          .slice(-24)
      : [];

    const lastUser = [...transcript].reverse().find((t) => t.role === "user")?.text ?? "";
    const userTurns = transcript.filter((t) => t.role === "user").length;

    if (phase === "done") {
      const fb = fallbackTurn({ phase, slots, askCounts, lastUser });
      return NextResponse.json({ ok: true, ...fb });
    }

    // --- Coverage state for the prompt -------------------------------------
    const missing = missingRequired(slots);
    const wrapNow = missing.length === 0 || userTurns >= 12;
    const coverageLines = SLOT_KEYS.map((key) => {
      const status = isResolved(slots, key)
        ? slots.declined.includes(key)
          ? "DECLINED (off-limits)"
          : `KNOWN — ${JSON.stringify(slots[key])}`
        : `MISSING (asked ${(askCounts[key] ?? 0)}x, cap ${ASK_CAP[key]})${REQUIRED_SLOTS.includes(key) ? " [REQUIRED]" : " [optional]"}`;
      return `- ${key} (${SLOT_LABELS[key]}): ${status}`;
    }).join("\n");

    const userPrompt = [
      `Workspace: ${workspaceName}`,
      `Country: ${country}`,
      "",
      "COVERAGE (your information model):",
      coverageLines,
      "",
      `Owner replies so far: ${userTurns}. Aim to wrap within ${Math.max(1, 8 - userTurns)} more.`,
      wrapNow
        ? "WRAP: all required information is gathered (or its ask budget is spent). Do NOT ask anything more — close warmly per your wrapping rules, nextSlot \"none\"."
        : `REQUIRED GAPS: ${missing.join(", ")}. Choose your own next question — the one that flows most naturally from the owner's last message.`,
      "",
      "CONVERSATION SO FAR (the last OWNER line is the message you are responding to):",
      transcript.map((t) => `${t.role === "ai" ? "ASSISTANT" : "OWNER"}: ${t.text}`).join("\n"),
    ].join("\n");

    const raw = await completeText(SYSTEM, userPrompt, { maxTokens: 800 });
    const parsed = extractJson<{
      read?: string;
      reply?: string;
      slotUpdates?: Partial<CheckupSlots>;
      learnedChips?: unknown;
      nextSlot?: string;
      chips?: unknown;
    }>(raw);

    if (!parsed || typeof parsed.reply !== "string" || parsed.reply.trim().length === 0) {
      const fb = fallbackTurn({ phase, slots, askCounts, lastUser });
      return NextResponse.json({ ok: true, ...fb });
    }

    // --- Guardrails --------------------------------------------------------
    let reply = parsed.reply.trim().slice(0, 700);
    const read: ChatRead = (READ_VALUES as string[]).includes(parsed.read ?? "") ? (parsed.read as ChatRead) : "other";

    const updates = sanitizeSlots(parsed.slotUpdates);
    const merged: CheckupSlots = { ...slots };
    for (const key of ["businessType", "sells", "targetMarket", "location", "goal"] as const) {
      if (updates[key]) merged[key] = updates[key];
    }
    if (updates.channels) merged.channels = updates.channels;
    if (updates.changes) merged.changes = updates.changes;
    for (const key of ["enquiries", "customers", "revenue"] as const) {
      if (updates[key]) merged[key] = updates[key];
    }
    if (read === "correction") merged.corrections = Math.min(9, slots.corrections + 1);

    // Ask-count bookkeeping: count a real ask only when it targets a missing slot.
    const nextAskCounts: AskCounts = { ...askCounts };
    const nextSlotRaw = typeof parsed.nextSlot === "string" ? parsed.nextSlot : "";
    const nextSlot: SlotKey | "none" = (SLOT_KEYS as string[]).includes(nextSlotRaw) ? (nextSlotRaw as SlotKey) : "none";
    if (nextSlot !== "none" && !isResolved(merged, nextSlot) && !wrapNow) {
      nextAskCounts[nextSlot] = (nextAskCounts[nextSlot] ?? 0) + 1;
    }
    // Enforce ask caps: a slot at its cap is auto-declined (honest gap, trend slots get "Don't know").
    for (const key of SLOT_KEYS) {
      if (!isResolved(merged, key) && (nextAskCounts[key] ?? 0) >= ASK_CAP[key]) {
        merged.declined = merged.declined.includes(key) ? merged.declined : [...merged.declined, key];
        if (key === "enquiries") merged.enquiries = merged.enquiries ?? "Don't know";
        if (key === "customers") merged.customers = merged.customers ?? "Don't know";
        if (key === "revenue") merged.revenue = merged.revenue ?? "Don't know";
      }
    }

    // Phase decision: done when coverage is complete after this turn, or hard caps hit.
    const stillMissing = missingRequired(merged);
    const outPhase: CheckupPhase = wrapNow || stillMissing.length === 0 || userTurns >= 12 ? "done" : "interview";

    // If we must wrap but the model asked another question, replace with a clean close.
    if (outPhase === "done" && nextSlot !== "none" && /\?\s*$/.test(reply)) {
      reply = wrapReply(merged);
    }

    const learnedChips = Array.isArray(parsed.learnedChips)
      ? parsed.learnedChips.filter((c) => typeof c === "string").map((c) => String(c).slice(0, 46)).slice(0, 3)
      : deriveLearnedChips(updates);

    const chips =
      outPhase === "done"
        ? []
        : Array.isArray(parsed.chips)
          ? parsed.chips.filter((c) => typeof c === "string").map((c) => String(c).slice(0, 40)).slice(0, 4)
          : [];

    const result: ChatTurnResult = {
      read,
      reply,
      learnedChips,
      phase: outPhase,
      slots: merged,
      askCounts: nextAskCounts,
      chips,
      degraded: false,
    };
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[api/checkup/chat] error:", error);
    return NextResponse.json(
      {
        ok: true,
        ...fallbackTurn({ phase: "interview", slots: emptySlots(), askCounts: {}, lastUser: "" }),
        degraded: true,
      },
      { status: 200 },
    );
  }
}
