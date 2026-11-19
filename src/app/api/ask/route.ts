import { NextRequest, NextResponse } from "next/server";
import { completeText } from "@/lib/ai";
import { extractJson, type AskAnswerContent, type AskWorkspaceContext } from "@/lib/checkup";
import { parseAmount, plainify } from "@/lib/checkup-math";
import { CONSULTANT_PATTERNS, NUMBER_RULES, VOICE_RULES, formatBusinessContext } from "@/lib/ai-voice";
import { collectAllowedNumbers, dropUngroundedSentences, ungroundedNumbers } from "@/lib/grounding";

export const runtime = "nodejs";

/**
 * Ask — the owner's own analyst. It knows their checkup answers, their
 * diagnosis and how far they are with the plan, so every answer builds on what
 * they already know and moves them forward: a straight answer, the reasoning,
 * and — when the question calls for it — the exact words to use.
 */
const SYSTEM = `You are the owner's own business analyst inside bizzGrowth. A small-business owner (often in Nigeria, often with no website) is asking about THEIR business. You know their checkup answers, their diagnosis, their plan and any numbers in the snapshot. Answer like a trusted consultant who knows them well — never like a search engine.

HOW TO ANSWER
- Answer their exact question directly in the FIRST sentence. Never restate the question. Never open with a generic description of their business.
- Then give the reasoning from what they told you, their diagnosis and any numbers — specific, never generic.
- When the question is about what to do, what to say or how to handle someone, give them the exact words to use in "tryThis" (a WhatsApp message, what to say on a call, a simple price layout) — short, friendly, in their voice, with [name] where a name goes.
- Build on their diagnosis and plan: if they ask "what should I do?", start from the plan steps they have NOT done yet; if they did some, acknowledge it and move them forward.
- If previous questions in this session are provided, build on them and move the conversation forward — never repeat earlier wording.
- If the snapshot cannot answer the question, say so plainly in one sentence, give your best reasoning from what they DID tell you, and name the cheapest way to find out (e.g. "count the next 10 people who ask").
- Offer 2-3 natural next questions THEY might ask you next, in their voice ("How do I follow up without sounding pushy?").

${CONSULTANT_PATTERNS}

${NUMBER_RULES}

${VOICE_RULES}

Return ONLY valid JSON, no markdown:
{
  "grounded": ["2-3 short paragraphs (strings). Paragraph 1: the direct answer. Paragraph 2+: the reasoning."],
  "interpretation": "optional: 1-2 sentences — the pattern you see or the likely real cause",
  "tryThis": { "title": "<= 60 chars", "body": "the exact words to use, 2-5 short sentences" } or null,
  "limitations": ["0-2 short strings: what is genuinely unknown and would change the answer"],
  "evidence": [
    { "label": "short label", "value": "the exact number or short fact", "provenance": "measured|user-supplied|estimated|ai-interpretation", "source": "e.g. 'Your checkup answers', 'Your diagnosis', 'Owner-entered totals', 'Meta Ads (connected)'" }
  ],
  "followUps": ["2-3 short questions the owner might ask next, each <= 70 chars"],
  "referencedPeriod": "e.g. 'September 2026', 'Your checkup answers' — from the snapshot"
}
Rules:
- provenance "measured" ONLY for numbers from connected sources or metrics in the snapshot; "user-supplied" for things the owner told us or entered; "estimated" for their stated directions; "ai-interpretation" for anything you derived.
- evidence: 0-4 items, each value <= 40 chars. Do not pad.`;

const HISTORY_TURNS = 4;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      question?: string;
      history?: { question: string; summary: string }[];
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

    // The owner's business in full (checkup, diagnosis, plan) + the numeric snapshot.
    const { business, ...snapshot } = workspace;
    const prompt = [
      formatBusinessContext(business ?? null),
      "",
      `WORKSPACE NUMBERS SNAPSHOT:\n${JSON.stringify(snapshot, null, 2)}`,
      "",
      `PREVIOUS QUESTIONS THIS SESSION:\n${historyBlock}`,
      "",
      `OWNER'S QUESTION:\n${question}`,
    ].join("\n");

    const ownerText = [question, ...history.map((h) => h.question)].join("\n");
    // The only figures an answer may use: what is in the context and the snapshot.
    const allowed = collectAllowedNumbers(prompt);
    const priceRange = parseAmount(business?.facts?.jobValue);
    const inventedIn = (p: Partial<AskAnswerContent>) =>
      [
        ...[...(p.grounded ?? []), p.interpretation ?? ""].flatMap((t) => ungroundedNumbers(String(t ?? ""), allowed)),
        ...(p.tryThis && typeof p.tryThis.body === "string" ? ungroundedNumbers(p.tryThis.body, allowed, { priceRange }) : []),
      ];

    let parsed: Partial<AskAnswerContent> | null = null;
    let feedback = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      const raw = await completeText(SYSTEM, attempt === 0 ? prompt : `${prompt}\n\n${feedback}`, { maxTokens: 2600, profile: "quality" });
      if (raw === null) {
        if (attempt === 0) {
          // The model is genuinely unreachable — say so instead of degrading to a script.
          return NextResponse.json({ ok: false, error: "The AI analyst is temporarily unavailable. Please retry in a moment." }, { status: 503 });
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
        parsed = {
          ...parsed,
          grounded,
          interpretation: parsed.interpretation ? dropUngroundedSentences(parsed.interpretation, allowed) || undefined : undefined,
          tryThis: parsed.tryThis && ungroundedNumbers(String(parsed.tryThis.body ?? ""), allowed, { priceRange }).length === 0 ? parsed.tryThis : null,
        };
      } else {
        verified = false;
      }
    }
    return NextResponse.json({ ok: true, answer: { ...normalizeAnswer(parsed, ownerText), verified } });
  } catch (error) {
    console.error("[api/ask] error:", error);
    return NextResponse.json({ ok: false, error: "Ask failed" }, { status: 500 });
  }
}

function normalizeAnswer(parsed: Partial<AskAnswerContent>, ownerText: string): AskAnswerContent {
  const plain = (s: string, cap: number) => plainify(s.replace(/\s+\n/g, "\n").trim(), ownerText).slice(0, cap);
  const tryThis =
    parsed.tryThis && typeof parsed.tryThis === "object" && typeof parsed.tryThis.body === "string" && parsed.tryThis.body.trim().length > 15
      ? { title: plain(String(parsed.tryThis.title ?? "Try this"), 70), body: plainify(parsed.tryThis.body.trim(), ownerText).slice(0, 700) }
      : null;
  return {
    grounded: parsed.grounded!.filter((g) => typeof g === "string" && g.trim()).map((g) => plain(String(g), 800)).slice(0, 5),
    interpretation:
      typeof parsed.interpretation === "string" && parsed.interpretation.trim().length > 0 ? plain(parsed.interpretation, 500) : undefined,
    tryThis,
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
