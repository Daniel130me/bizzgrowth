import { NextRequest, NextResponse } from "next/server";
import { completeText } from "@/lib/ai";
import { extractJson, type AskAnswerContent, type AskWorkspaceContext } from "@/lib/checkup";

export const runtime = "nodejs";

const SYSTEM = `You are the analyst inside bizzGrowth. A small-business owner asks a question about their own business. You answer grounded STRICTLY in the workspace snapshot provided in the user message.

Return ONLY valid JSON, no markdown:
{
  "grounded": ["2-4 short paragraphs (strings). Every number you state MUST come from the snapshot. If the snapshot has no measured data, say so plainly and reason over what the owner reported instead."],
  "interpretation": "optional: 1-3 sentences of clearly-labelled interpretation (the pattern you see, likely constraint, what to do next).",
  "limitations": ["1-3 short strings: what is genuinely unknown or not yet connected"],
  "evidence": [
    { "label": "short label", "value": "the exact number or short fact", "provenance": "measured|user-supplied|estimated|ai-interpretation", "source": "where it came from, e.g. 'Meta Ads (connected)', 'Your checkup answers', 'Owner-entered channel counts'" }
  ],
  "referencedPeriod": "e.g. 'September 2026' or 'Last full month' — take it from the snapshot"
}

Rules:
- provenance "measured" ONLY for numbers from connected sources / metrics in the snapshot; "user-supplied" for owner-entered counts; "estimated" for stated trend directions; "ai-interpretation" for anything you derived.
- evidence: 2-4 items max, each value <= 40 chars.
- If the question is about something the snapshot cannot answer, say so directly in "grounded", suggest the cheapest way to get the missing data, and keep "limitations" honest.
- Never invent numbers, percentages, dates, tools, or channels that are not in the snapshot.
- Plain, direct, professional English. No emoji. No markdown.`;

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
          .map((h) => ({ question: String(h.question).slice(0, 200), summary: String(h.summary ?? "").slice(0, 200) }))
          .slice(-3)
      : [];

    const raw = await completeText(
      SYSTEM,
      `WORKSPACE SNAPSHOT:\n${JSON.stringify(workspace, null, 2)}\n\nPREVIOUS QUESTIONS THIS SESSION:\n${
        history.length > 0
          ? history.map((h) => `Q: ${h.question}\nA(summary): ${h.summary}`).join("\n")
          : "(none)"
      }\n\nOWNER'S QUESTION:\n${question}`,
      { maxTokens: 2000 },
    );

    const parsed = extractJson<Partial<AskAnswerContent>>(raw);

    if (!parsed || !Array.isArray(parsed.grounded) || parsed.grounded.length === 0) {
      // One retry with a stricter instruction — truncation/prose happens occasionally.
      const retryRaw = await completeText(
        SYSTEM,
        `Ignore any previous attempt. Answer again, but output ONLY the raw JSON object — no prose before or after, no markdown fences. Keep "grounded" to 2 short paragraphs and "evidence" to 2 items so the JSON stays short and valid.\n\nWORKSPACE SNAPSHOT:\n${JSON.stringify(workspace, null, 2)}\n\nOWNER'S QUESTION:\n${question}`,
        { maxTokens: 1400 },
      );
      const retryParsed = extractJson<Partial<AskAnswerContent>>(retryRaw);
      if (!retryParsed || !Array.isArray(retryParsed.grounded) || retryParsed.grounded.length === 0) {
        return NextResponse.json({ ok: false, error: "No answer produced" }, { status: 502 });
      }
      return NextResponse.json({ ok: true, answer: normalizeAnswer(retryParsed) });
    }

    return NextResponse.json({ ok: true, answer: normalizeAnswer(parsed) });
  } catch (error) {
    console.error("[api/ask] error:", error);
    return NextResponse.json({ ok: false, error: "Ask failed" }, { status: 500 });
  }
}

function normalizeAnswer(parsed: Partial<AskAnswerContent>): AskAnswerContent {

    const answer: AskAnswerContent = {
      grounded: parsed.grounded!.filter((g) => typeof g === "string").map((g) => String(g).slice(0, 700)).slice(0, 5),
      interpretation:
        typeof parsed.interpretation === "string" && parsed.interpretation.trim().length > 0
          ? String(parsed.interpretation).slice(0, 500)
          : undefined,
      limitations: Array.isArray(parsed.limitations)
        ? parsed.limitations.filter((l) => typeof l === "string").map((l) => String(l).slice(0, 160)).slice(0, 4)
        : [],
      evidence: Array.isArray(parsed.evidence)
        ? parsed.evidence
            .filter((e) => e && typeof e.label === "string" && typeof e.value === "string")
            .map((e) => ({
              label: String(e.label).slice(0, 60),
              value: String(e.value).slice(0, 60),
              provenance: (["measured", "user-supplied", "estimated", "ai-interpretation"] as const).includes(
                e.provenance as "measured",
              )
                ? e.provenance
                : "ai-interpretation",
              source: String(e.source ?? "Workspace data").slice(0, 80),
            }))
            .slice(0, 4)
        : [],
      referencedPeriod: String(parsed.referencedPeriod ?? "Last full month").slice(0, 60),
    };

    return answer;
  }
