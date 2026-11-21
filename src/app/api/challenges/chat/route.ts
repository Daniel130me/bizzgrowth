import { NextRequest, NextResponse } from "next/server";
import { completeText } from "@/lib/ai";
import { extractJson, FOCUS_STAGES, type BusinessFacts, type TranscriptTurn } from "@/lib/checkup";
import { plainify, shorten, tidyOwnerText } from "@/lib/checkup-math";
import { HONESTY_RULES, I_VOICE, formatBusinessContext } from "@/lib/ai-voice";
import { clearlyOutside, ownerVoice, returnedGoods, similarChallenge, stageOfText, type ChallengeStage } from "@/lib/challenges";
import {
  ACKS,
  LINK_NO,
  LINK_YES,
  WRAP_REPLY,
  YES_RE,
  detailsFrom,
  factUpdatesFrom,
  nextSlot,
  questionFor,
  targetedFor,
  type ChallengeChatState,
  type ChallengeSlot,
  type ChallengeTurnResult,
} from "@/lib/challenge-chat";

export const runtime = "nodejs";

/**
 * One turn of the short chat about a single challenge. The app decides WHAT
 * to ask (a fixed, short path: what's happening, since when, how often, what
 * they've tried, one or two questions picked for this challenge); the model
 * only reacts to the owner's answer in one sentence, cleans it up, and — on
 * the first answer — names the challenge, places it, and says whether it is
 * the same problem as one already on their list.
 */
const SYSTEM = `You are Nellovia, the owner's AI business consultant inside the Nellovia app, having a SHORT, focused chat with a small-business owner about ONE problem holding their business back. You already know their business (BUSINESS CONTEXT below) — never ask about it again and never diagnose yet.

Each turn you get the owner's latest answer and the question the app will ask next. Return:
- "lead": ONE short sentence (max 25 words) reacting to their answer — what it suggests, or why it's useful to know. Never repeat their words back. Never ask a question. No "Great!", no "Thanks for sharing". Don't give advice yet.
- "value": their answer cleaned up in plain words (fix spelling and grammar, keep their meaning and any numbers exactly), max 200 characters.
- "theory": if their answer says what THEY think causes the problem, that in their own voice as a plain statement (e.g. "The new shop nearby is cheaper" — never "They think…"); otherwise null.
Only when FIRST ANSWER is yes, also return:
- "title": the problem in the owner's own words, short (max 70 characters), e.g. "Customers don't come back after the first order". A plain statement, not a diagnosis.
- "stage": where it sits — "found" (people finding them), "enquire" (people getting in touch), "convert" (people who ask going on to buy), "deliver" (capacity, time, quality, delivery, pricing for profit), "return" (customers coming back), or "outside" (things the app can't see: cash flow, staff, rent, costs, suppliers, equipment, health).
- "sameAs": the id of a challenge on THEIR LIST that is genuinely the same underlying problem seen from another angle, otherwise null.
- "sameAsWhy": one short sentence on why it looks like the same problem, or null.

TONE
- Plain everyday words a market trader understands. Warm, calm, specific to them. No emoji, no lists.
- Never use: leads, conversion, convert, funnel, pipeline, retention, churn, acquisition, metrics, KPI, ROI.

${I_VOICE}

${HONESTY_RULES}

Return ONLY valid JSON, no markdown:
{"lead": "...", "value": "...", "theory": null, "title": null, "stage": null, "sameAs": null, "sameAsWhy": null}`;

interface Body {
  workspaceName?: string;
  country?: string;
  currency?: string;
  facts?: BusinessFacts | null;
  /** The challenge being talked about, when it is already on the list (captured earlier, noticed in Ask…). */
  challenge?: { id?: string; title?: string } | null;
  others?: { id: string; title: string; status: string }[];
  transcript?: TranscriptTurn[];
  state?: Partial<ChallengeChatState>;
}

const STAGES: ChallengeStage[] = [...FOCUS_STAGES.map((s) => s.id), "outside"];

function sanitizeState(s: Partial<ChallengeChatState> | undefined): ChallengeChatState {
  const answers: ChallengeChatState["answers"] = {};
  const raw = (s?.answers ?? {}) as Record<string, unknown>;
  for (const k of ["what", "since", "often", "tried", "extra1", "extra2"] as ChallengeSlot[]) {
    if (typeof raw[k] === "string") answers[k] = String(raw[k]).slice(0, 300);
  }
  return {
    answers,
    pending: s?.pending,
    stage: STAGES.includes(s?.stage as ChallengeStage) ? (s!.stage as ChallengeStage) : undefined,
    title: typeof s?.title === "string" ? s.title.slice(0, 100) : undefined,
    theory: typeof s?.theory === "string" ? s.theory.slice(0, 240) : undefined,
    targeted: Array.isArray(s?.targeted) ? s!.targeted!.slice(0, 2) : undefined,
    link: s?.link && typeof s.link.id === "string" ? { id: s.link.id, title: String(s.link.title ?? "").slice(0, 100), why: s.link.why, answered: s.link.answered } : null,
  };
}

function oneSentence(text: string): string {
  const parts = text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!])\s+/)
    .filter((p) => p && !p.includes("?"));
  return shorten(parts[0] ?? "", 180);
}

export async function POST(request: NextRequest) {
  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const state = sanitizeState(body.state);
  const facts = body.facts ?? null;
  const others = (Array.isArray(body.others) ? body.others : [])
    .filter((o) => o && typeof o.id === "string" && typeof o.title === "string")
    .map((o) => ({ id: o.id, title: o.title.slice(0, 120), status: String(o.status ?? "up-next") }))
    .slice(0, 12);
  const transcript = (Array.isArray(body.transcript) ? body.transcript : [])
    .filter((t) => t && typeof t.text === "string" && (t.role === "ai" || t.role === "user"))
    .map((t) => ({ role: t.role, text: t.text.slice(0, 900) }))
    .slice(-16);
  const lastUser = [...transcript].reverse().find((t) => t.role === "user")?.text?.trim() ?? "";
  const existing = body.challenge?.id ? { id: body.challenge.id, title: (body.challenge.title ?? "").slice(0, 120) } : null;
  if (existing?.title && !state.title) state.title = existing.title;
  const userTurns = transcript.filter((t) => t.role === "user").length;
  const factUpdates = () => factUpdatesFrom(state);

  const finish = (reply: string, degraded: boolean, linkedTo?: string | null): NextResponse =>
    NextResponse.json({
      ok: true,
      reply,
      chips: [],
      phase: "done",
      state: { ...state, pending: undefined },
      details: detailsFrom(state),
      linkedTo: linkedTo ?? null,
      factUpdates: factUpdates(),
      degraded,
    } satisfies ChallengeTurnResult & { ok: true });

  // Nothing said yet (an existing challenge opened for its short chat): the first question.
  if (!lastUser) {
    const first = nextSlot(state) ?? "what";
    const q = questionFor(first, state);
    const intro = existing?.title ? `Let's look at “${shorten(existing.title, 70)}” — a few quick questions, tap or type.` : "A few quick questions, tap or type.";
    return NextResponse.json({
      ok: true,
      reply: `${intro} ${q.text}`,
      chips: q.chips,
      why: q.why,
      phase: "chat",
      state: { ...state, pending: first },
      details: detailsFrom(state),
      factUpdates: {},
      degraded: false,
    } satisfies ChallengeTurnResult & { ok: true });
  }

  // The owner answered the "same problem?" question.
  if (state.pending === "link" && state.link) {
    const yes = YES_RE.test(lastUser) && !/^no\b|different|separate|not the same/i.test(lastUser);
    state.link = { ...state.link, answered: yes ? "yes" : "no" };
    if (yes) return finish(`Done — I've added this to “${shorten(state.link.title, 70)}”, so it's tracked in one place.`, false, state.link.id);
    const slot = nextSlot(state);
    if (!slot) return finish(WRAP_REPLY, false);
    const q = questionFor(slot, state);
    return NextResponse.json({
      ok: true,
      reply: `Understood — I'll keep it as its own challenge. ${q.text}`,
      chips: q.chips,
      why: q.why,
      phase: "chat",
      state: { ...state, pending: slot },
      details: detailsFrom(state),
      factUpdates: factUpdates(),
      degraded: false,
    } satisfies ChallengeTurnResult & { ok: true });
  }

  // Record the answer to the question that was asked ("what" when nothing was asked yet).
  const answered: ChallengeSlot = state.pending && state.pending !== "link" ? state.pending : "what";
  const firstAnswer = answered === "what";
  state.answers[answered] = tidyOwnerText(shorten(lastUser, 280));

  // Decide the next question before asking the model, so it can bridge to it.
  if (firstAnswer && !state.stage) {
    state.stage = stageOfText(`${state.title ?? ""} ${lastUser}`, facts) ?? "found";
    if (!state.title) state.title = shorten(tidyOwnerText(lastUser.replace(/[.!]+$/, "")), 120);
  }
  const theoryKnown = Boolean(state.theory) || /because|i think|reason is|maybe it'?s|probably/i.test(`${state.answers.what ?? ""} ${state.answers.tried ?? ""}`);
  if (!state.targeted) state.targeted = targetedFor(state.stage ?? "found", state.title ?? lastUser, facts, theoryKnown);

  const context = formatBusinessContext({ name: (body.workspaceName ?? "Your business").slice(0, 120), country: body.country, currency: body.currency, facts, diagnosis: null });
  const listBlock = others.length ? others.map((o) => `- [${o.id}] ${o.title} (${o.status})`).join("\n") : "(none yet)";

  let lead = "";
  let degraded = true;
  let model: { lead?: string; value?: string; theory?: string | null; title?: string | null; stage?: string | null; sameAs?: string | null; sameAsWhy?: string | null } | null = null;
  try {
    const peek = nextSlot(state);
    const prompt = [
      context,
      "",
      `THEIR LIST OF CHALLENGES (ids in brackets):\n${listBlock}`,
      "",
      existing?.title || (state.title && !firstAnswer)
        ? `THE CHALLENGE THIS CHAT IS ABOUT (react only to this, not to their other problems): ${existing?.title ?? state.title}`
        : "THE CHALLENGE: new — the owner is describing it now.",
      `FIRST ANSWER: ${firstAnswer && !existing ? "yes" : "no"}`,
      `THE QUESTION THEY ANSWERED: ${answered === "what" ? "What's holding the business back / what's happening?" : questionFor(answered, state).text}`,
      `THEIR ANSWER: ${lastUser}`,
      peek ? `THE APP WILL ASK NEXT: ${questionFor(peek, state).text}` : "THIS WAS THE LAST QUESTION — the app will wrap up.",
      "",
      "THE CHAT SO FAR:",
      transcript.map((t) => `${t.role === "ai" ? "NELLOVIA" : "OWNER"}: ${t.text}`).join("\n"),
    ].join("\n");
    const raw = await completeText(SYSTEM, prompt, { maxTokens: 450, profile: "fast" });
    model = raw ? extractJson(raw) : null;
  } catch (error) {
    console.error("[api/challenges/chat] error:", error);
  }

  const ownerText = transcript.filter((t) => t.role === "user").map((t) => t.text).join("\n");
  if (model) {
    degraded = false;
    const l = oneSentence(plainify(String(model.lead ?? ""), ownerText));
    if (l.length > 8) lead = l;
    const v = plainify(String(model.value ?? "").trim(), ownerText).slice(0, 240);
    if (v.length >= 2) state.answers[answered] = tidyOwnerText(v);
    if (typeof model.theory === "string" && model.theory.trim().length > 4) {
      const theory = ownerVoice(tidyOwnerText(plainify(model.theory.trim(), ownerText).slice(0, 220)));
      const what = (state.answers.what ?? state.title ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      const t = theory.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (t && !(what.includes(t) || t.includes(what))) state.theory = theory;
    }
    if (firstAnswer && !existing) {
      const t = typeof model.title === "string" ? tidyOwnerText(plainify(model.title.replace(/^["“]|["”]$/g, "").trim(), ownerText)) : "";
      if (t.length >= 6) state.title = shorten(t, 120);
      // Words that clearly name something the app can't see stay "outside", whatever the model says.
      const said = `${state.title ?? ""} ${lastUser}`;
      if (STAGES.includes(model.stage as ChallengeStage) && !clearlyOutside(said) && !(model.stage === "return" && returnedGoods(said))) {
        const before = state.stage;
        state.stage = model.stage as ChallengeStage;
        // The questions depend on the stage — pick them again if it moved.
        if (before !== state.stage) state.targeted = targetedFor(state.stage, state.title ?? lastUser, facts, Boolean(state.theory) || theoryKnown);
      }
    }
  }
  if (!lead) lead = ACKS[userTurns % ACKS.length];

  // Same problem from another angle? Offer to link instead of tracking it twice.
  if (firstAnswer && !existing && others.length) {
    const open = others.filter((o) => o.status === "working" || o.status === "up-next");
    const fromModel = model && typeof model.sameAs === "string" ? open.find((o) => o.id === model!.sameAs) : undefined;
    const match = fromModel ?? similarChallenge(state.title ?? lastUser, open.map((o) => ({ ...o, status: o.status as "working" | "up-next" })));
    if (match) {
      const whyRaw = model && typeof model.sameAsWhy === "string" && model.sameAsWhy.trim().length > 8 ? oneSentence(plainify(model.sameAsWhy, ownerText)) : "";
      // A proper sentence: capital first, full stop last.
      const why = whyRaw ? `${whyRaw[0].toUpperCase()}${whyRaw.slice(1)}`.replace(/([^.!])$/, "$1.") : undefined;
      state.link = { id: match.id, title: match.title, why };
      return NextResponse.json({
        ok: true,
        reply: `${lead} This sounds like it could be the same problem as “${shorten(match.title, 70)}”, seen from another angle.${why ? ` ${why}` : ""} Shall I add it to that one instead of tracking it twice?`,
        chips: [LINK_YES, LINK_NO],
        phase: "chat",
        state: { ...state, pending: "link" },
        details: detailsFrom(state),
        factUpdates: factUpdates(),
        degraded,
      } satisfies ChallengeTurnResult & { ok: true });
    }
  }

  const slot = nextSlot(state);
  if (!slot || userTurns >= 8) return finish(`${lead === ACKS[userTurns % ACKS.length] ? "" : `${lead} `}${WRAP_REPLY}`.trim(), degraded);
  const q = questionFor(slot, state);
  return NextResponse.json({
    ok: true,
    reply: `${lead} ${q.text}`,
    chips: q.chips,
    why: q.why,
    phase: "chat",
    state: { ...state, pending: slot },
    details: detailsFrom(state),
    factUpdates: factUpdates(),
    degraded,
  } satisfies ChallengeTurnResult & { ok: true });
}
