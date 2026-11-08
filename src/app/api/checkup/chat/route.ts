import { NextRequest, NextResponse } from "next/server";
import { completeText } from "@/lib/ai";
import {
  CHECKUP_STAGES,
  extractJson,
  emptySlots,
  type CheckupSlots,
  type CheckupStage,
  type ChatRead,
  type ChatTurnResult,
  type TranscriptTurn,
  type TrendDirection,
} from "@/lib/checkup";

export const runtime = "nodejs";

const TREND_VALUES: TrendDirection[] = ["Increased", "Decreased", "About the same", "Don't know"];

const READ_VALUES: ChatRead[] = ["answer", "correction", "partial", "dodge", "question", "other"];

const STAGE_TOPIC: Record<CheckupStage, string> = {
  intro: "What the business does and sells, who it serves, where customers come from, and what the owner most wants to improve",
  enquiry: "Direction of enquiries vs the previous month",
  customers: "Direction of paying customers vs the previous month",
  revenue: "Direction of revenue vs the previous month (optional — a direction is enough, never ask for exact figures)",
  changes: "Recent changes in pricing, team, or how they market",
  done: "Wrap-up",
};

/** Deterministic question text, used by the safety-net fallback and force-advance bridges. */
const QUESTION_FOR: Record<Exclude<CheckupStage, "done">, string> = {
  intro: "Tell me about your business and what you most want to improve.",
  enquiry: "Compared with the previous month, are enquiries up, down, or about the same?",
  customers: "And paying customers over the same period — up, down, or about the same?",
  revenue: "Optional one, and estimates are fine: revenue — up, down, or flat versus last month?",
  changes: "Has anything changed recently in the business — pricing, the team, or how you market?",
};

const SYSTEM = `You are the bizzGrowth Business Context Engine. To the owner you are simply an experienced business consultant doing a first intake conversation: warm, sharp, efficient, and genuinely listening. You never sound like a survey, a form, or a script.

GOAL
Across a handful of exchanges, understand the business well enough for a first growth diagnosis. Fill the SLOTS you are given. Some owners answer directly; others dodge, correct you, or talk around the topic. Get what you need from the flow of conversation — a direct question is your tool of last resort, not your default.

CLASSIFY THE OWNER'S LATEST MESSAGE BEFORE REPLYING
- "answer": it actually answers your pending question.
- "correction": it fixes something you got wrong, or narrows/expands something said earlier. Signals: "no", "not just", "actually", "what I mean", "we don't only", or it contradicts a slot already recorded. Corrections are valuable: in ONE short clause acknowledge the specific thing you had wrong, restate the corrected understanding using their words, then — in the SAME reply — weave in your pending question naturally. NEVER score a correction as a trend answer. NEVER say "understood" and then summarize something they did not say.
- "partial": answers part of it. Reflect the part they gave, then ask for the missing piece in one light touch.
- "dodge": they can't or won't answer. Respect it, say briefly how you will handle the gap (estimate later, infer from connected data), and move on. No guilt-tripping.
- "question": they asked you something. Answer honestly in 1-2 sentences, then return to your pending question.

PACING (askNumber is provided per turn)
- askNumber 0: ask the pending topic directly but naturally, tied to something they just said.
- askNumber 1: they have not answered — rephrase INDIRECTLY from a different angle using their own context (e.g. instead of revenue figures: "would you say this month felt busier than last?"). Never repeat the same phrasing.
- askNumber 2: accept the gap. Mark the slot "Don't know", note briefly how you will cover it, and move the conversation forward. Never ask a third time.

STYLE
- 1-3 short sentences per reply. Plain, direct, human. No emoji, no bullet lists, no "As an AI".
- React to THEIR specifics — channel names, their exact words, cities, what they sell — and what it implies for growth. A bare "Noted" or "That is useful" with nothing specific is a failure.
- Exactly one question per reply. Vary your openers; never start two replies the same way.
- Never invent facts, numbers, channels, or tools. Only reflect what they actually said.
- The owner should feel a consultant is listening, not filling a form.

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
  "learnedChips": ["up to 3 chips <= 46 chars describing what changed in the model THIS turn; prefix 'Updated:' when a correction changed something, e.g. 'Updated: serves clients worldwide'"],
  "nextStage": "intro|enquiry|customers|revenue|changes|done",
  "chips": ["up to 4 short suggested replies <= 40 chars for the NEXT question — always include a comfortable option like 'Don't know' or 'Not sure'"]
}
RULES
- slotUpdates: include ONLY slots learned or corrected THIS turn. Omit everything else. For trend slots use exactly the enum values; "Don't know" when the owner could not or would not say.
- nextStage: keep the current stage until its topic is genuinely resolved or the owner has declined twice. Advance at most one stage per turn. Use "done" only when instructed that the conversation is complete.
- learnedChips: omit entirely if this turn changed nothing in the model.
- Write replies in clear, plain, professional English matching the owner's register.`;

interface ChatBody {
  workspaceName?: string;
  country?: string;
  transcript?: TranscriptTurn[];
  stage?: CheckupStage;
  slots?: Partial<CheckupSlots>;
  attempts?: number;
  final?: boolean;
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
    declined: list(input.declined, 20, 6) ?? [],
    corrections:
      typeof input.corrections === "number" && Number.isFinite(input.corrections)
        ? Math.max(0, Math.min(9, Math.round(input.corrections)))
        : 0,
  };
}

function clampStage(current: CheckupStage, proposed: unknown): CheckupStage {
  if (typeof proposed !== "string" || !(CHECKUP_STAGES as string[]).includes(proposed)) return current;
  const next = proposed as CheckupStage;
  const ci = CHECKUP_STAGES.indexOf(current);
  const ni = CHECKUP_STAGES.indexOf(next);
  // Never go backwards; never skip more than one stage; "done" only from "changes".
  if (ni < ci) return current;
  if (next === "done") return current === "changes" ? "done" : current;
  if (ni > ci + 1) return CHECKUP_STAGES[ci + 1];
  return next;
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
  (["enquiries", "customers", "revenue"] as const).forEach((k) => {
    if (updates[k]) chips.push(`${k === "enquiries" ? "Enquiries" : k === "customers" ? "Customers" : "Revenue"}: ${updates[k]}`);
  });
  return chips.slice(0, 3);
}

/**
 * Deterministic safety net when the LLM is unreachable. The one property that
 * matters: a message that does not answer the pending question is NEVER
 * converted into a trend answer.
 */
function fallbackTurn(body: { stage: CheckupStage; slots: CheckupSlots; attempts: number; lastUser: string }): ChatTurnResult {
  const { stage, slots, attempts, lastUser } = body;
  const t = lastUser.toLowerCase();

  if (stage === "done") {
    return { read: "other", reply: "Thanks — that is everything I need.", learnedChips: [], stage: "done", slots, chips: [], degraded: true };
  }

  // Correction signals — the user is fixing our understanding, not answering.
  const correctionish =
    /(^|\s)(no|nope|not just|not only|actually|what i meant|what i mean|correction|we don't|we do not|we also|forget)/.test(t) ||
    /all over the world|worldwide|globally|everywhere|international/.test(t);

  // Trend stages: accept a real trend answer, otherwise re-ask; never fabricate.
  const isTrendStage = stage === "enquiry" || stage === "customers" || stage === "revenue";
  let trend: TrendDirection | undefined;
  if (isTrendStage && !correctionish) {
    if (/decreas|down|less|fewer|drop|fell|worse|slower/.test(t)) trend = "Decreased";
    else if (/increas|up|more|grew|rise|rose|better|higher/.test(t)) trend = "Increased";
    else if (/don'|do not|no idea|not sure|skip|rather not|prefer not/.test(t)) trend = "Don't know";
    else if (/same|flat|stable|steady|about/.test(t)) trend = "About the same";
  }

  if (trend) {
    const nextStage = clampStage(stage, CHECKUP_STAGES[CHECKUP_STAGES.indexOf(stage) + 1]);
    return {
      read: "answer",
      reply: `${trend === "Don't know" ? "No problem — I will cover that from your data later." : `${trend} — noted.`} ${QUESTION_FOR[nextStage as Exclude<CheckupStage, "done">]}`,
      learnedChips: [`${stage === "enquiry" ? "Enquiries" : stage === "customers" ? "Customers" : "Revenue"}: ${trend}`],
      stage: nextStage,
      slots: { ...slots, [stage === "enquiry" ? "enquiries" : stage === "customers" ? "customers" : "revenue"]: trend },
      chips: ["Increased", "Decreased", "About the same", "Don't know"],
      degraded: true,
    };
  }

  if (correctionish) {
    return {
      read: "correction",
      reply: `Fair correction — noted. ${QUESTION_FOR[stage as Exclude<CheckupStage, "done">]}`,
      learnedChips: ["Updated: understanding corrected"],
      stage, // hold and re-ask; the pacing guard advances if it keeps happening
      slots: { ...slots, corrections: slots.corrections + 1 },
      chips: [],
      degraded: true,
    };
  }

  // Anything else: do not invent. After two attempts, accept the gap and move on.
  if (attempts >= 2) {
    const nextStage = clampStage(stage, CHECKUP_STAGES[CHECKUP_STAGES.indexOf(stage) + 1]);
    const declined = slots.declined.includes(stage) ? slots.declined : [...slots.declined, stage];
    return {
      read: "dodge",
      reply: `No problem — I will infer that from your data later. ${QUESTION_FOR[nextStage as Exclude<CheckupStage, "done">]}`,
      learnedChips: [],
      stage: nextStage,
      slots: { ...slots, declined },
      chips: [],
      degraded: true,
    };
  }

  return {
    read: "other",
    reply: QUESTION_FOR[stage as Exclude<CheckupStage, "done">],
    learnedChips: [],
    stage,
    slots,
    chips: [],
    degraded: true,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ChatBody;

    const workspaceName = (body.workspaceName ?? "Your business").slice(0, 120);
    const country = (body.country ?? "Nigeria").slice(0, 80);
    const stage: CheckupStage =
      typeof body.stage === "string" && (CHECKUP_STAGES as string[]).includes(body.stage) ? (body.stage as CheckupStage) : "intro";
    const slots = sanitizeSlots(body.slots);
    const attempts = Math.max(0, Math.min(3, Math.round(body.attempts ?? 0)));
    const transcript = Array.isArray(body.transcript)
      ? body.transcript
          .filter((t) => t && typeof t.text === "string" && (t.role === "ai" || t.role === "user"))
          .map((t) => ({ role: t.role, text: t.text.slice(0, 900) }))
          .slice(-24)
      : [];

    const lastUser = [...transcript].reverse().find((t) => t.role === "user")?.text ?? "";

    const nextStageName = CHECKUP_STAGES[Math.min(CHECKUP_STAGES.indexOf(stage) + 1, CHECKUP_STAGES.length - 1)];

    const userPrompt = [
      `Workspace: ${workspaceName}`,
      `Country: ${country}`,
      "",
      "CURRENT SLOTS (what you know so far):",
      JSON.stringify(slots),
      "",
      `PENDING TOPIC: ${stage} — ${STAGE_TOPIC[stage]}`,
      `askNumber on this topic: ${attempts} (0 = first ask, 1 = rephrase indirectly from their context, 2 = accept the gap, mark "Don't know", move on)`,
      `NEXT STAGE IF RESOLVED: ${nextStageName} — ${STAGE_TOPIC[nextStageName]}`,
      stage === "changes" ? "NOTE: this is the final topic of the checkup — once resolved, set nextStage \"done\"." : "",
      "",
      "CONVERSATION SO FAR (the last OWNER line is the message you are responding to):",
      transcript.map((t) => `${t.role === "ai" ? "ASSISTANT" : "OWNER"}: ${t.text}`).join("\n"),
    ]
      .filter(Boolean)
      .join("\n");

    const raw = await completeText(SYSTEM, userPrompt, { maxTokens: 800 });
    const parsed = extractJson<{
      read?: string;
      reply?: string;
      slotUpdates?: Partial<CheckupSlots>;
      learnedChips?: unknown;
      nextStage?: string;
      chips?: unknown;
    }>(raw);

    if (!parsed || typeof parsed.reply !== "string" || parsed.reply.trim().length === 0) {
      const fb = fallbackTurn({ stage, slots, attempts, lastUser });
      return NextResponse.json({ ok: true, ...fb });
    }

    // --- Guardrails -------------------------------------------------------
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

    let nextStage = clampStage(stage, parsed.nextStage);
    // Hard pacing guard: a topic can hold for at most 3 turns, then we accept the gap.
    if (nextStage === stage && attempts >= 2) {
      nextStage = clampStage(stage, CHECKUP_STAGES[CHECKUP_STAGES.indexOf(stage) + 1]);
      if (nextStage !== stage) {
        if (!merged.declined.includes(stage)) merged.declined = [...merged.declined, stage];
        if (stage === "enquiry") merged.enquiries = merged.enquiries ?? "Don't know";
        if (stage === "customers") merged.customers = merged.customers ?? "Don't know";
        if (stage === "revenue") merged.revenue = merged.revenue ?? "Don't know";
        // The reply was likely a re-ask, but we are force-advancing — bridge to the next question.
        reply = `${reply.replace(/\?+\s*$/, ".")} ${QUESTION_FOR[nextStage as Exclude<CheckupStage, "done">]}`.slice(0, 700);
      }
    }

    const learnedChips = Array.isArray(parsed.learnedChips)
      ? parsed.learnedChips.filter((c) => typeof c === "string").map((c) => String(c).slice(0, 46)).slice(0, 3)
      : deriveLearnedChips(updates);

    const chips = Array.isArray(parsed.chips)
      ? parsed.chips.filter((c) => typeof c === "string").map((c) => String(c).slice(0, 40)).slice(0, 4)
      : [];

    const result: ChatTurnResult = { read, reply, learnedChips, stage: nextStage, slots: merged, chips, degraded: false };
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[api/checkup/chat] error:", error);
    return NextResponse.json(
      { ok: true, ...fallbackTurn({ stage: "intro", slots: emptySlots(), attempts: 0, lastUser: "" }), degraded: true },
      { status: 200 },
    );
  }
}
