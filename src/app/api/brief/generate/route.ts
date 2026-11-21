import { NextRequest, NextResponse } from "next/server";
import { completeText } from "@/lib/ai";
import { extractJson, type BusinessContextPayload, type BusinessFacts } from "@/lib/checkup";
import { parseAmount, plainify } from "@/lib/checkup-math";
import { CONSULTANT_PATTERNS, NUMBER_RULES, VOICE_RULES, formatBusinessContext } from "@/lib/ai-voice";
import { collectAllowedNumbers, dropUngroundedSentences, ungroundedNumbers } from "@/lib/grounding";
import type { Brief, BriefSection } from "@/lib/types";

export const runtime = "nodejs";

const KINDS = ["weekly", "monthly"] as const;

/**
 * The brief is the owner's regular note from Nellovia, their AI consultant: where things
 * stand, what is working, what to watch, the biggest opportunity, what to do
 * next (building on the plan they already have) and one message to send.
 */
function systemFor(kind: "weekly" | "monthly"): string {
  const period = kind === "weekly" ? "week" : "month";
  return `You are Nellovia, the owner's own AI business consultant inside the Nellovia app, writing their ${kind} business brief. It must read like an honest, useful note from someone who knows their business — not a marketing document and not a list of generic tips. Don't sign it or introduce yourself by name; it is already marked as coming from you.

Build on what they already know: their checkup answers, their diagnosis and their plan (which steps are done). If they have done plan steps, acknowledge it and move them forward. Never repeat the diagnosis word for word.

Sections, in this order and with these exact headings:
1. "This ${period}" — 2-3 sentences: where the business stands and the one thing that matters most this ${period}.
2. "What's working" — 2-3 bullets grounded in their answers.
3. "Pay attention to" — 1-3 bullets: real risks implied by their own answers.
4. "Opportunity" — 2-3 sentences: the biggest opportunity and what it is worth (quote COMPUTED figures if listed).
5. "Recommended actions" — 3-4 short, concrete bullets for this ${period}, starting with plan steps not yet done.
6. "Something to send this ${period}" — ONE paragraph: the exact message to send (WhatsApp-ready, [name] where a name goes) that moves the biggest opportunity forward.
7. "What would sharpen this" — 1-2 sentences: the one or two numbers worth noting this ${period} and why (e.g. "how many people asked and how many paid").

${CONSULTANT_PATTERNS}

${NUMBER_RULES}

${VOICE_RULES}

Return ONLY valid JSON, no markdown:
{
  "title": "<= 70 chars, e.g. '${kind === "weekly" ? "Weekly" : "Monthly"} brief — <business name>'",
  "sections": [ { "heading": "...", "paragraphs": ["..."] } or { "heading": "...", "bullets": ["..."] } ]
}`;
}

interface BriefInput {
  workspaceName?: string;
  country?: string;
  kind?: string;
  facts?: BusinessFacts;
  context?: BusinessContextPayload | null;
  months?: { label: string; revenue?: number; enquiries?: number; customers?: number }[];
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as BriefInput;
    const facts = body.context?.facts ?? body.facts;
    if (!facts) {
      return NextResponse.json({ ok: false, error: "Missing checkup facts" }, { status: 400 });
    }
    const name = (body.context?.name ?? body.workspaceName ?? "Your business").slice(0, 120);
    const kind = (KINDS as readonly string[]).includes(String(body.kind)) ? (body.kind as "weekly" | "monthly") : "weekly";
    const context: BusinessContextPayload = body.context ?? {
      name,
      country: (body.country ?? "Nigeria").slice(0, 80),
      facts,
      months: body.months,
    };

    const prompt = formatBusinessContext(context);
    const allowed = collectAllowedNumbers(prompt);
    const priceRange = parseAmount(facts.jobValue);
    const textsOf = (sections: Record<string, unknown>[]) =>
      sections.flatMap((s) => [
        ...(Array.isArray(s.paragraphs) ? s.paragraphs : []),
        ...(Array.isArray(s.bullets) ? s.bullets : []),
      ]).map((t) => String(t ?? ""));

    let sectionsRaw: Record<string, unknown>[] = [];
    let title: unknown = null;
    let feedback = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      const raw = await completeText(systemFor(kind), attempt === 0 ? prompt : `${prompt}\n\n${feedback}`, { maxTokens: 3000, profile: "quality" });
      if (!raw) break;
      const parsed = extractJson<{ title?: unknown; sections?: unknown }>(raw);
      if (!parsed || !Array.isArray(parsed.sections) || parsed.sections.length === 0) {
        feedback = "YOUR PREVIOUS ANSWER WAS NOT VALID JSON. Output ONLY the raw JSON object.";
        continue;
      }
      sectionsRaw = (parsed.sections as unknown[]).filter((s): s is Record<string, unknown> => !!s && typeof s === "object" && typeof (s as Record<string, unknown>).heading === "string");
      title = parsed.title;
      const bad = [...new Set(textsOf(sectionsRaw).flatMap((t) => ungroundedNumbers(t, allowed, { priceRange })))];
      if (bad.length === 0) break;
      feedback = `YOUR PREVIOUS ANSWER USED FIGURES THAT ARE NOT IN THE CONTEXT (${bad.join(", ")}). Write it again without them.`;
    }

    if (sectionsRaw.length === 0) {
      return NextResponse.json({ ok: false, error: "No brief produced" }, { status: 502 });
    }

    // Anything still untraceable is removed — sentence by sentence, bullet by bullet.
    const isMessage = (h: string) => /^something to send/i.test(h);
    const sections: BriefSection[] = sectionsRaw
      .map((s) => {
        const heading = plainify(String(s.heading)).slice(0, 60);
        const clean = (t: unknown, cap: number) =>
          isMessage(heading)
            ? (ungroundedNumbers(String(t ?? ""), allowed, { priceRange }).length ? "" : plainify(String(t ?? "").trim()).slice(0, cap))
            : plainify(dropUngroundedSentences(String(t ?? "").trim(), allowed)).slice(0, cap);
        const paragraphs = Array.isArray(s.paragraphs) ? s.paragraphs.map((p) => clean(p, 700)).filter(Boolean).slice(0, 3) : undefined;
        const bullets = Array.isArray(s.bullets) ? s.bullets.map((b) => clean(b, 220)).filter(Boolean).slice(0, 5) : undefined;
        return { heading, paragraphs: paragraphs?.length ? paragraphs : undefined, bullets: bullets?.length ? bullets : undefined };
      })
      .filter((s) => s.paragraphs || s.bullets)
      .slice(0, 8);

    const brief: Brief = {
      id: `brief-ai-${kind}-${Date.now().toString(36)}`,
      businessId: "user-workspace",
      kind,
      period: new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
      title: plainify(String(title ?? `${kind === "weekly" ? "Weekly" : "Monthly"} brief — ${name}`)).slice(0, 90),
      sections,
    };

    return NextResponse.json({ ok: true, brief, degraded: false });
  } catch (error) {
    console.error("[api/brief/generate] error:", error);
    return NextResponse.json({ ok: false, error: "Generation failed" }, { status: 500 });
  }
}
