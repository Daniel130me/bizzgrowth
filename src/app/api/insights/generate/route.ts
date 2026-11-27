import { NextRequest, NextResponse } from "next/server";
import { requireAiSession } from "@/lib/ai-route-guard";
import { completeText } from "@/lib/ai";
import { extractJson, clampPercent, type BusinessContextPayload, type BusinessFacts } from "@/lib/checkup";
import { plainify } from "@/lib/checkup-math";
import { CONSULTANT_PATTERNS, NUMBER_RULES, VOICE_RULES, formatBusinessContext } from "@/lib/ai-voice";
import { collectAllowedNumbers, dropUngroundedSentences, ungroundedNumbers } from "@/lib/grounding";
import { SAME_SUBJECT, sharedWords } from "@/lib/overlap";
import { getSession } from "@/lib/auth/session";
import { measuredContext } from "@/lib/connectors/summary";
import type { EvidenceItem, Insight } from "@/lib/types";
import { DRAFT_KIND_ENUM, DRAFT_KIND_GUIDE, cleanDraftHint } from "@/lib/coach";

export const runtime = "nodejs";

const INSIGHT_TYPES = ["problem", "opportunity", "improvement", "watch"] as const;
const IMPORTANCE = ["critical", "high", "medium", "low"] as const;
const PROVENANCE = ["measured", "user-supplied", "estimated", "ai-interpretation"] as const;
/** Plain metric words — they label the insight and link to the matching metric page. */
const METRICS = ["Enquiries", "Customers", "Repeat customers", "Revenue", "Orders"] as const;

/**
 * Insights complement the diagnosis: the owner has already read their main
 * problem, so each insight must add something NEW — an opportunity they are
 * missing, a risk to watch, a quick win — specific, grounded, and usable.
 */
const SYSTEM = `You are Nellovia, the owner's own AI business consultant inside the Nellovia app. Write 3 INSIGHTS for this owner — things worth knowing BEYOND their diagnosis.

They have already read their diagnosis (it is in the context). Do NOT repeat its main point.
They also track THEIR CHALLENGES (listed in the context, whatever their status) and may be TRYING a step right now. Never turn a challenge on that list into an insight, even in other words — if "weekdays are too quiet" is listed, "quiet weekdays are costing you" is a repeat. Never suggest a step they are trying, one marked "already tried", one already on their plan for this week, or ready-made help they already have. Pick angles the list and the plan don't cover yet.
A NEW ANGLE on a listed challenge is not a repeat and is often the most useful insight: a cause they haven't named, a cost or price they haven't looked at, a risk it creates. If the challenge they are WORKING ON NOW is about money (cash running short, what they owe, rent, costs, prices), at least two of the three insights must be new angles on it, from their own answers (what comes in against what goes out, prices against rising costs, fees they pay, what is due when) — not ways to find more customers.
Each insight must give them something new, specific and usable:
1. an OPPORTUNITY they are probably missing (type "opportunity") — e.g. past customers who would buy again, people who already trust them, a better offer, a group who already asks;
2. something to WATCH (type "watch") — a real risk implied by their own answers (e.g. relying on one way people find them, being too stretched to follow up, the quiet months);
3. a QUICK WIN for this week (type "improvement") — a small change with an obvious payoff.

Each insight:
- is grounded in what the owner told you; "known" lists the answers it rests on, in plain words;
- has one concrete "recommendedAction" they can do without measured data;
- when the action involves saying, sending or writing something (a message, a post, an ad, website words, a description, a bio, a flyer, a brief, a policy…), offers to write the words with "draft": its kind is what it makes (DRAFT KINDS below; "other" if none fits — never squeeze website words, a brief or an ad into an email or a message), a button label naming what it makes, and the purpose — the app writes them only when the owner taps; don't write the words yourself;
- "unknown" names what would confirm it (e.g. "how many past customers you could message").

DRAFT KINDS
${DRAFT_KIND_GUIDE}

${CONSULTANT_PATTERNS}

${NUMBER_RULES}

${VOICE_RULES}

Return ONLY valid JSON, no markdown:
{
  "insights": [
    {
      "type": "opportunity|watch|improvement|problem",
      "importance": "critical|high|medium|low",
      "title": "max 80 chars, specific to THIS business",
      "summary": "1-2 sentences",
      "meaning": "2-3 sentences: why it matters for growing THIS business",
      "known": ["2-4 short strings the owner told you"],
      "unknown": ["1-2 short strings in your own voice ('I don't know yet…', never 'We don't know')"],
      "evidence": [{ "label": "short label", "value": "short fact from the context", "provenance": "user-supplied|estimated|ai-interpretation", "source": "Your checkup answers|Your diagnosis|Your entered totals" }],
      "recommendedAction": "one concrete next step",
      "draft": { "kind": "${DRAFT_KIND_ENUM}", "label": "button text naming what it makes, <= 40 chars", "purpose": "what the words are for and who reads them" } or null,
      "primaryMetric": "Enquiries|Customers|Repeat customers|Revenue|Orders"
    }
  ]
}`;

interface InsightsInput {
  workspaceName?: string;
  country?: string;
  facts?: BusinessFacts;
  context?: BusinessContextPayload | null;
  months?: { label: string; revenue?: number; enquiries?: number; customers?: number }[];
}

type RawInsight = Record<string, unknown>;

/** Everything the owner already has in hand, spelled out so no insight restates it. */
function alreadyCovered(ctx: BusinessContextPayload): string {
  const word: Record<string, string> = { working: "working on now", "up-next": "up next", solved: "solved", stopped: "stopped", "no-longer": "no longer a problem" };
  const lines: string[] = [];
  for (const c of ctx.challenges ?? []) lines.push(`- Challenge (${word[c.status] ?? c.status}): ${c.title}${c.note ? ` — ${c.note}` : ""}`);
  if (ctx.facts?.ownerTheory) lines.push(`- What they already think is causing it: ${ctx.facts.ownerTheory}`);
  if (ctx.diagnosis?.headline) lines.push(`- Their diagnosis: ${ctx.diagnosis.headline}`);
  for (const s of ctx.diagnosis?.steps ?? []) lines.push(`- On this week's plan: ${s}`);
  for (const t of ctx.diagnosis?.tools ?? []) lines.push(`- Ready-made help they already have: ${t.title}`);
  if (ctx.coaching?.active?.title) lines.push(`- Trying right now: ${ctx.coaching.active.title}`);
  return lines.length ? ["ALREADY COVERED — do not write an insight about any of these, in any words:", ...lines].join("\n") : "";
}

/** The subjects an insight must not restate: their challenges, their own view of the cause, and their diagnosis. */
function coveredSubjects(ctx: BusinessContextPayload): string[] {
  return [
    ...(ctx.challenges ?? []).map((c) => c.title),
    ...(ctx.facts?.ownerTheory ? [ctx.facts.ownerTheory] : []),
    ...(ctx.diagnosis?.headline ? [ctx.diagnosis.headline] : []),
  ];
}

export async function POST(request: NextRequest) {
  // Paid AI: signed-in accounts only, with a per-account limit.
  const guard = await requireAiSession("insights");
  if (guard.response) return guard.response;

  try {
    const body = (await request.json()) as InsightsInput;
    const facts = body.context?.facts ?? body.facts;
    if (!facts) {
      return NextResponse.json({ ok: false, error: "Missing checkup facts" }, { status: 400 });
    }
    const context: BusinessContextPayload = body.context ?? {
      name: (body.workspaceName ?? "Your business").slice(0, 120),
      country: (body.country ?? "Nigeria").slice(0, 80),
      facts,
      months: body.months,
    };

    const session = await getSession().catch(() => null);
    const connected = session?.workspaceName === context.name
      ? await measuredContext(session.userId, session.workspaceId)
      : "";
    const prompt = [formatBusinessContext(context), connected, alreadyCovered(context)].filter(Boolean).join("\n\n");
    const allowed = collectAllowedNumbers(prompt);
    const textOf = (r: RawInsight) =>
      [r.title, r.summary, r.meaning, r.recommendedAction, ...(Array.isArray(r.known) ? r.known : [])].map((v) => String(v ?? ""));
    const invented = (list: RawInsight[]) =>
      [...new Set(list.flatMap((r) => textOf(r).flatMap((t) => ungroundedNumbers(t, allowed))))];
    // An insight that restates one of their challenges (or their diagnosis), whatever the wording.
    // Read from the title, which names what an insight is about: the summary of a new angle on a
    // challenge naturally shares words with it (its cost, its cause) without restating it.
    const subjects = coveredSubjects(context);
    const repeatOf = (r: RawInsight) => subjects.find((s) => sharedWords(String(r.title ?? ""), s) >= SAME_SUBJECT) ?? null;

    let list: RawInsight[] = [];
    let feedback = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      const raw = await completeText(SYSTEM, attempt === 0 ? prompt : `${prompt}\n\n${feedback}`, { maxTokens: 3200, profile: "quality" });
      if (!raw) break;
      const parsed = extractJson<{ insights?: unknown }>(raw);
      if (!parsed || !Array.isArray(parsed.insights) || parsed.insights.length === 0) {
        feedback = "YOUR PREVIOUS ANSWER WAS NOT VALID JSON. Output ONLY the raw JSON object.";
        continue;
      }
      list = parsed.insights.filter((r): r is RawInsight => !!r && typeof r === "object");
      const bad = invented(list);
      const repeats = list.flatMap((r) => {
        const s = repeatOf(r);
        return s ? [`"${String(r.title ?? "")}" restates "${s}"`] : [];
      });
      if (bad.length === 0 && repeats.length === 0) break;
      feedback = [
        bad.length ? `YOUR PREVIOUS ANSWER USED FIGURES THAT ARE NOT IN THE CONTEXT (${bad.join(", ")}). Write it again without them.` : "",
        repeats.length ? `THESE INSIGHTS REPEAT WHAT THEY ALREADY HAVE: ${repeats.join("; ")}. Replace them with angles nothing above covers, and keep the rest.` : "",
      ]
        .filter(Boolean)
        .join("\n");
    }
    // Still restating something they already track after the second try: leave it out (as long as one remains).
    const fresh = list.filter((r) => !repeatOf(r));
    if (fresh.length) list = fresh;

    if (list.length === 0) {
      return NextResponse.json({ ok: false, error: "No insights produced" }, { status: 502 });
    }

    const ownerText = "";
    const plain = (v: unknown, cap: number) => plainify(dropUngroundedSentences(String(v ?? "").trim(), allowed), ownerText).slice(0, cap);
    const today = new Date().toISOString().slice(0, 10);
    const insights: Insight[] = list.slice(0, 3).map((r, i) => {
      const confidence = clampPercent(Number(r.confidence) || 56, 35, 72, 56);
      const evidence: EvidenceItem[] = Array.isArray(r.evidence)
        ? (r.evidence as RawInsight[])
            .filter((e) => e && typeof e.label === "string" && typeof e.value === "string" && ungroundedNumbers(String(e.value), allowed).length === 0)
            .map((e) => ({
              label: plain(e.label, 60),
              value: String(e.value).slice(0, 60),
              provenance: (PROVENANCE as readonly string[]).includes(String(e.provenance)) ? (e.provenance as EvidenceItem["provenance"]) : "ai-interpretation",
              source: String(e.source ?? "Your checkup answers").slice(0, 80),
            }))
            .slice(0, 4)
        : [];
      // The words are written on request (POST /api/draft) and grounded there.
      const draft = cleanDraftHint((r as { draft?: unknown }).draft);
      const metric = (METRICS as readonly string[]).find((m) => m.toLowerCase() === String(r.primaryMetric ?? "").toLowerCase()) ?? "Customers";

      return {
        id: `ins-ai-${Date.now().toString(36)}-${i}`,
        businessId: "user-workspace",
        type: (INSIGHT_TYPES as readonly string[]).includes(String(r.type)) ? (r.type as Insight["type"]) : "watch",
        importance: (IMPORTANCE as readonly string[]).includes(String(r.importance)) ? (r.importance as Insight["importance"]) : "medium",
        title: plain(r.title ?? "Insight from your checkup", 100) || "Insight from your checkup",
        summary: plain(r.summary, 300),
        date: today,
        confidence,
        confidenceLevel: confidence >= 65 ? "high" : confidence >= 50 ? "medium" : "low",
        meaning: plain(r.meaning, 700),
        known: Array.isArray(r.known) ? r.known.filter((k): k is string => typeof k === "string").map((k) => plain(k, 120)).filter(Boolean).slice(0, 4) : [],
        unknown: Array.isArray(r.unknown) ? r.unknown.filter((k): k is string => typeof k === "string").map((k) => plain(k, 120)).filter(Boolean).slice(0, 3) : [],
        evidence,
        recommendedAction: plain(r.recommendedAction, 300),
        missingToImprove: ["Your own numbers — entered totals or a connected source — to confirm this"],
        primaryMetric: metric,
        ...(draft ? { draft } : {}),
      } satisfies Insight;
    });

    return NextResponse.json({ ok: true, insights, degraded: false });
  } catch (error) {
    console.error("[api/insights/generate] error:", error);
    return NextResponse.json({ ok: false, error: "Generation failed" }, { status: 500 });
  }
}
