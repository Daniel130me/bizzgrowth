import { NextRequest, NextResponse } from "next/server";
import { requireAiSession } from "@/lib/ai-route-guard";
import { completeText } from "@/lib/ai";
import { extractJson, type AskAnswerContent, type AskWorkspaceContext } from "@/lib/checkup";
import { DRAFT_KIND_ENUM, DRAFT_KIND_GUIDE, cleanDraftHint } from "@/lib/coach";
import { plainify } from "@/lib/checkup-math";
import { CONSULTANT_PATTERNS, NUMBER_RULES, VOICE_RULES, formatBusinessContext } from "@/lib/ai-voice";
import { collectAllowedNumbers, dropUngroundedSentences, ungroundedNumbers } from "@/lib/grounding";
import { cleanNoticed } from "@/lib/challenges";
import { getSession } from "@/lib/auth/session";
import { measuredContext } from "@/lib/connectors/summary";

export const runtime = "nodejs";

/**
 * Ask — Nellovia, the owner's own AI consultant. It knows their checkup
 * answers, their diagnosis and how far they are with the plan, so every answer
 * builds on what they already know and moves them forward: a straight answer,
 * the reasoning, and — when the question calls for it — the exact words to use.
 */
const SYSTEM = `You are Nellovia, the owner's own AI business consultant inside the Nellovia app. A small-business owner (often in Nigeria, often with no website) is asking about THEIR business. You know their checkup answers, their diagnosis, their plan and any numbers in the snapshot. Answer like a trusted consultant who knows them well — never like a search engine.

HOW TO ANSWER
- Answer their exact question directly in the FIRST sentence. Never restate the question. Never open with a generic description of their business.
- If they ask who or what you are, or what you can do: say so directly in the FIRST sentence, as yourself — Nellovia, an AI business consultant — then in one or two short sentences say how you can help THEIR business, using what you know about it. Don't turn it into a sales pitch, and leave "interpretation" and "evidence" empty for this kind of question.
- Then give the reasoning from what they told you, their diagnosis and any numbers — specific, never generic.
- When the question is about what to do, what to say or how to handle someone — or the answer means writing something (website words, an ad, a post, a product description, a bio, a flyer or sign, a brief for someone they'll hire, a reply to a review, a policy) — offer to write the words with "draft"; the app writes them only if they tap the button. Set its kind to WHAT IT MAKES:
${DRAFT_KIND_GUIDE}
  Use "other" if none fits — never squeeze website words, a brief or an ad into an email or a message. Give it a button label naming what it makes ("Write the follow-up message", "Write the words for my homepage", "Write the developer brief") and the purpose (what the words are for and who reads them). Don't write long pieces yourself.
- When they ask for the words themselves — what exactly to say or write to someone ("what do I say to…", "what should I tell…", "write me…") — give them in "words": a short, ready-to-use version in their own voice (a message or what to say, 2-6 short sentences), built on their own figures, with [brackets] for anything you don't know. Still offer "draft" for a longer or polished version. Otherwise "words" is null. Words to someone they owe (a landlord, a supplier, a lender) ask for one clear thing — what they can pay now and when the rest follows ([amount] and [date] if they haven't said) — and never mention their other debts or the other people they owe: that weakens their hand.
- If they are trying a step right now (WHAT THEY ARE TRYING RIGHT NOW in the context), connect your answer to it when it is relevant, in one short sentence; a few days in, you may lightly ask how it's going. Never nag, never more than one sentence about it.
- Build on their diagnosis and plan: if they ask "what should I do?", start from the plan steps they have NOT done yet; if they did some, acknowledge it and move them forward.
- If previous questions in this session are provided, build on them and move the conversation forward — never repeat earlier wording.
- If the owner is FOLLOWING UP ON AN EARLIER ANSWER (that block is in the context), their question is about that answer: build on it, refer to it naturally in a few words ("On the showcase idea…"), and never repeat it back.
- If their question tells you something you didn't know (that they already owe money, a date something is due, a new cost or problem), pick it up: say what it changes, and ask for the one missing detail that matters most (how much, and when it is due).
- THE OWNER'S OWN WORDS IN THEIR CHECKUP are part of what you know: never say you don't know a figure or a fact they gave there.
- If the snapshot cannot answer the question, say so plainly in one sentence, give your best reasoning from what they DID tell you, and name the cheapest way to find out (e.g. "count the next 10 people who ask").
- Offer 2-3 natural next questions THEY might ask you next, in their voice ("How do I follow up without sounding pushy?").
- NOTICING A NEW CHALLENGE: if the question describes a NEW problem holding the business back that is not already on THEIR CHALLENGES list (for example something that just started going wrong, or a problem they hadn't mentioned), answer it as usual AND set "newChallenge" — the problem in their own words, its stage, and "sameAs": the id of a challenge on their list only if it is really the same problem seen from another angle. Never for a question that only asks how to do something, and never for a challenge already on the list.

${CONSULTANT_PATTERNS}

${NUMBER_RULES}

${VOICE_RULES}

Return ONLY valid JSON, no markdown:
{
  "grounded": ["2-3 short paragraphs (strings). Paragraph 1: the direct answer. Paragraph 2+: the reasoning."],
  "interpretation": "optional: 1-2 sentences — the pattern you see or the likely real cause",
  "draft": { "kind": "${DRAFT_KIND_ENUM}", "label": "button text naming what it makes, <= 40 chars", "purpose": "what the words are for and who reads them, 1 sentence" } or null,
  "words": { "title": "<= 60 chars, what these words are, e.g. 'What to say when you call'", "body": "the words, ready to use" } or null,
  "limitations": ["0-2 short strings in your own voice ('I don't know yet how many…', never 'We don't know'): what is genuinely unknown and would change the answer"],
  "evidence": [
    { "label": "short label", "value": "the exact number or short fact", "provenance": "measured|user-supplied|estimated|ai-interpretation", "source": "e.g. 'Your checkup answers', 'Your diagnosis', 'Owner-entered totals', 'Meta Ads (connected)'" }
  ],
  "followUps": ["2-3 short questions the owner might ask next, each <= 70 chars"],
  "newChallenge": null or { "title": "the new problem in the owner's own words, <= 70 chars", "stage": "found|enquire|convert|deliver|return|outside", "sameAs": "an id from THEIR CHALLENGES, or null", "why": "1 short sentence: why it looks new (or the same as that one)" },
  "referencedPeriod": "e.g. 'September 2026', 'Your checkup answers' — from the snapshot"
}
Rules:
- provenance "measured" ONLY for numbers from connected sources or metrics in the snapshot; "user-supplied" for things the owner told you or entered; "estimated" for their stated directions; "ai-interpretation" for anything you derived.
- evidence: 0-4 items, each value <= 40 chars. Do not pad.`;

const HISTORY_TURNS = 4;

export async function POST(request: NextRequest) {
  // Paid AI: signed-in accounts only, with a per-account limit.
  const guard = await requireAiSession("ask");
  if (guard.response) return guard.response;

  try {
    const body = (await request.json()) as {
      question?: string;
      history?: { question: string; summary: string }[];
      /** The earlier answer this question follows up on (may be older than the recent turns). */
      replyTo?: { question?: unknown; summary?: unknown };
      workspace?: AskWorkspaceContext;
    };

    const question = (body.question ?? "").trim().slice(0, 500);
    if (!question) {
      return NextResponse.json({ ok: false, error: "Question is required" }, { status: 400 });
    }

    const workspace = body.workspace;
    if (!workspace) {
      return NextResponse.json({ ok: false, error: "Workspace context is required" }, { status: 400 });
    }

    const history = Array.isArray(body.history)
      ? body.history
          .filter((h) => h && typeof h.question === "string")
          .map((h) => ({ question: String(h.question).slice(0, 240), summary: String(h.summary ?? "").slice(0, 420) }))
          .slice(-HISTORY_TURNS)
      : [];

    const historyBlock =
      history.length > 0 ? history.map((h) => `Q: ${h.question}\nA (summary): ${h.summary}`).join("\n") : "(none — this is the first question)";

    const replyTo =
      body.replyTo && typeof body.replyTo.question === "string" && body.replyTo.question.trim()
        ? { question: body.replyTo.question.trim().slice(0, 240), summary: String(body.replyTo.summary ?? "").trim().slice(0, 900) }
        : null;
    const replyBlock = replyTo ? `THE OWNER IS FOLLOWING UP ON AN EARLIER ANSWER:\nQ: ${replyTo.question}\nA (summary): ${replyTo.summary || "(not kept)"}` : "";
    const session = workspace.isUserWorkspace ? await getSession().catch(() => null) : null;
    const connected = session ? await measuredContext(session.userId, session.workspaceId) : "";

    // The owner's business in full (checkup, diagnosis, plan) + the numeric snapshot.
    const { business, ...snapshot } = workspace;
    const prompt = [
      formatBusinessContext(business ?? null),
      "",
      `WORKSPACE NUMBERS SNAPSHOT:\n${JSON.stringify(snapshot, null, 2)}`,
      "",
      ...(connected ? [connected, ""] : []),
      `PREVIOUS QUESTIONS THIS SESSION:\n${historyBlock}`,
      "",
      ...(replyBlock ? [replyBlock, ""] : []),
      `OWNER'S QUESTION:\n${question}`,
    ].join("\n");

    const ownerText = [question, ...history.map((h) => h.question), ...(replyTo ? [replyTo.question] : [])].join("\n");
    // The only figures an answer may use: what is in the context and the snapshot.
    const allowed = collectAllowedNumbers(prompt);
    const wordsOf = (p: Partial<AskAnswerContent>) => {
      const w = (p as { words?: { body?: unknown } }).words;
      return w && typeof w.body === "string" ? w.body : "";
    };
    const inventedIn = (p: Partial<AskAnswerContent>) =>
      [...(p.grounded ?? []), p.interpretation ?? "", wordsOf(p)].flatMap((t) => ungroundedNumbers(String(t ?? ""), allowed));

    let parsed: Partial<AskAnswerContent> | null = null;
    let feedback = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      const raw = await completeText(SYSTEM, attempt === 0 ? prompt : `${prompt}\n\n${feedback}`, { maxTokens: 2600, profile: "quality" });
      if (raw === null) {
        if (attempt === 0) {
          // The model is genuinely unreachable — say so instead of degrading to a script.
          return NextResponse.json({ ok: false, error: "Nellovia is temporarily unavailable. Please retry in a moment." }, { status: 503 });
        }
        break;
      }
      const candidate = extractJson<Partial<AskAnswerContent>>(raw);
      if (!candidate || !Array.isArray(candidate.grounded) || candidate.grounded.length === 0) {
        feedback = `YOUR PREVIOUS ANSWER WAS NOT VALID JSON. Output ONLY the raw JSON object — no prose before or after, no markdown fences. Keep "grounded" to 2 short paragraphs so it stays short and valid.`;
        continue;
      }
      parsed = candidate;
      const invented = [...new Set(inventedIn(candidate))];
      if (invented.length === 0) break;
      feedback = `YOUR PREVIOUS ANSWER USED FIGURES THAT ARE NOT IN THE BUSINESS CONTEXT OR SNAPSHOT (${invented.join(", ")}). Answer again without them — use only the owner's own numbers and the COMPUTED lines, or say plainly that the number isn't known yet.`;
    }

    if (!parsed || !Array.isArray(parsed.grounded) || parsed.grounded.length === 0) {
      return NextResponse.json({ ok: false, error: "No answer produced" }, { status: 502 });
    }

    // Still untraceable after a retry: drop those sentences; tell the owner honestly if that leaves nothing.
    let verified = true;
    if (inventedIn(parsed).length > 0) {
      const grounded = parsed.grounded.map((g) => dropUngroundedSentences(String(g), allowed)).filter((g) => g.length > 0);
      if (grounded.length > 0) {
        // Words to send with an untraceable figure are left out entirely (the draft button still offers them).
        const words = (parsed as { words?: unknown }).words;
        parsed = {
          ...parsed,
          grounded,
          interpretation: parsed.interpretation ? dropUngroundedSentences(parsed.interpretation, allowed) || undefined : undefined,
          ...(words && ungroundedNumbers(wordsOf(parsed), allowed).length ? { words: null } : {}),
        } as Partial<AskAnswerContent>;
      } else {
        verified = false;
      }
    }
    // A new problem the owner described — offered as a challenge to add, never added by itself.
    const list = (business?.challenges ?? []).map((c) => ({ id: c.id, title: c.title, status: c.status }));
    const newChallenge = workspace.isUserWorkspace ? cleanNoticed((parsed as { newChallenge?: unknown }).newChallenge, question, list) : null;
    return NextResponse.json({ ok: true, answer: { ...normalizeAnswer(parsed, ownerText), verified, newChallenge } });
  } catch (error) {
    console.error("[api/ask] error:", error);
    return NextResponse.json({ ok: false, error: "Ask failed" }, { status: 500 });
  }
}

/** The ready-to-use words in an answer, or null. Kept in the owner's voice; never signed as Nellovia. */
function cleanWords(raw: unknown, ownerText: string): { title: string; body: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as { title?: unknown; body?: unknown };
  const body = typeof o.body === "string" ? plainify(o.body.replace(/\r/g, "").trim(), ownerText).slice(0, 900) : "";
  if (body.length < 20 || /\bnellovia\b/i.test(body)) return null;
  const title = typeof o.title === "string" && o.title.trim() ? plainify(o.title.trim(), ownerText).slice(0, 70) : "What to say";
  return { title, body };
}

function normalizeAnswer(parsed: Partial<AskAnswerContent>, ownerText: string): AskAnswerContent {
  const plain = (s: string, cap: number) => plainify(s.replace(/\s+\n/g, "\n").trim(), ownerText).slice(0, cap);
  return {
    grounded: parsed.grounded!.filter((g) => typeof g === "string" && g.trim()).map((g) => plain(String(g), 800)).slice(0, 5),
    interpretation:
      typeof parsed.interpretation === "string" && parsed.interpretation.trim().length > 0 ? plain(parsed.interpretation, 500) : undefined,
    // Asked for the words themselves: a short version right here, checked like the rest of the answer.
    tryThis: cleanWords((parsed as { words?: unknown }).words, ownerText),
    // Longer or polished words are written on request (POST /api/draft), grounded there.
    draft: cleanDraftHint((parsed as { draft?: unknown }).draft),
    limitations: Array.isArray(parsed.limitations)
      ? parsed.limitations.filter((l) => typeof l === "string" && l.trim()).map((l) => plain(String(l), 180)).slice(0, 3)
      : [],
    evidence: Array.isArray(parsed.evidence)
      ? parsed.evidence
          .filter((e) => e && typeof e.label === "string" && typeof e.value === "string")
          .map((e) => ({
            label: plain(String(e.label), 60),
            value: String(e.value).slice(0, 60),
            provenance: (["measured", "user-supplied", "estimated", "ai-interpretation"] as const).includes(e.provenance as "measured")
              ? e.provenance
              : "ai-interpretation",
            source: String(e.source ?? "Workspace data").slice(0, 80),
          }))
          .slice(0, 4)
      : [],
    followUps: Array.isArray(parsed.followUps)
      ? parsed.followUps
          .filter((q) => typeof q === "string" && q.trim().length > 5)
          .map((q) => plain(String(q), 90))
          .slice(0, 3)
      : [],
    referencedPeriod: String(parsed.referencedPeriod ?? "Your checkup answers").slice(0, 60),
  };
}
