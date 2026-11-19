import { NextRequest, NextResponse } from "next/server";
import { completeText } from "@/lib/ai";
import { extractJson, clampPercent, type BusinessContextPayload, type BusinessFacts } from "@/lib/checkup";
import { parseAmount, plainify } from "@/lib/checkup-math";
import { CONSULTANT_PATTERNS, NUMBER_RULES, VOICE_RULES, formatBusinessContext } from "@/lib/ai-voice";
import { collectAllowedNumbers, dropUngroundedSentences, ungroundedNumbers } from "@/lib/grounding";
import type { EvidenceItem, Insight } from "@/lib/types";

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
const SYSTEM = `You are the owner's own business analyst inside bizzGrowth. Write 3 INSIGHTS for this owner — things worth knowing BEYOND their diagnosis.

They have already read their diagnosis (it is in the context). Do NOT repeat its main point. Each insight must give them something new, specific and usable:
1. an OPPORTUNITY they are probably missing (type "opportunity") — e.g. past customers who would buy again, people who already trust them, a better offer, a group who already asks;
2. something to WATCH (type "watch") — a real risk implied by their own answers (e.g. relying on one way people find them, being too stretched to follow up, the quiet months);
3. a QUICK WIN for this week (type "improvement") — a small change with an obvious payoff.

Each insight:
- is grounded in what the owner told us; "known" lists the answers it rests on, in plain words;
- has one concrete "recommendedAction" they can do without measured data;
- when the action involves saying or sending something, includes the exact words in "tryThis" (short, friendly, WhatsApp-ready, [name] where a name goes);
- "unknown" names what would confirm it (e.g. "how many past customers you could message").

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
      "known": ["2-4 short strings the owner told us"],
      "unknown": ["1-2 short strings"],
      "evidence": [{ "label": "short label", "value": "short fact from the context", "provenance": "user-supplied|estimated|ai-interpretation", "source": "Your checkup answers|Your diagnosis|Your entered totals" }],
      "recommendedAction": "one concrete next step",
      "tryThis": { "title": "<= 60 chars", "body": "the exact words" } or null,
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

export async function POST(request: NextRequest) {
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

    const prompt = formatBusinessContext(context);
    const allowed = collectAllowedNumbers(prompt);
    const priceRange = parseAmount(facts.jobValue);
    const textOf = (r: RawInsight) =>
      [r.title, r.summary, r.meaning, r.recommendedAction, ...(Array.isArray(r.known) ? r.known : [])].map((v) => String(v ?? ""));
    const invented = (list: RawInsight[]) =>
      [...new Set(list.flatMap((r) => [...textOf(r).flatMap((t) => ungroundedNumbers(t, allowed)), ...ungroundedNumbers(String((r.tryThis as { body?: string } | null)?.body ?? ""), allowed, { priceRange })]))];

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
      if (bad.length === 0) break;
      feedback = `YOUR PREVIOUS ANSWER USED FIGURES THAT ARE NOT IN THE CONTEXT (${bad.join(", ")}). Write it again without them.`;
    }

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
      const tt = r.tryThis as { title?: unknown; body?: unknown } | null | undefined;
      const tryThis =
        tt && typeof tt.body === "string" && tt.body.trim().length > 15 && ungroundedNumbers(tt.body, allowed, { priceRange }).length === 0
          ? { title: plain(tt.title ?? "Try this", 70), body: plainify(tt.body.trim()).slice(0, 700) }
          : undefined;
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
        ...(tryThis ? { tryThis } : {}),
      } satisfies Insight;
    });

    return NextResponse.json({ ok: true, insights, degraded: false });
  } catch (error) {
    console.error("[api/insights/generate] error:", error);
    return NextResponse.json({ ok: false, error: "Generation failed" }, { status: 500 });
  }
}
