import { NextRequest, NextResponse } from "next/server";
import { completeText } from "@/lib/ai";
import { extractJson, clampPercent, type BusinessFacts } from "@/lib/checkup";
import type { EvidenceItem, Insight } from "@/lib/types";

export const runtime = "nodejs";

const INSIGHT_TYPES = ["problem", "opportunity", "improvement", "watch"] as const;
const IMPORTANCE = ["critical", "high", "medium", "low"] as const;
const PROVENANCE = ["measured", "user-supplied", "estimated", "ai-interpretation"] as const;

const SYSTEM = `You are the intelligence analyst inside bizzGrowth. You generate the FIRST insights for a small-business owner from their checkup facts — before any measured data exists. Everything must trace back to the facts you are given.

Return ONLY valid JSON, no markdown:
{
  "insights": [
    {
      "type": "problem|opportunity|improvement|watch",
      "importance": "critical|high|medium|low",
      "title": "max 80 chars, specific to THIS business, no numbers you were not given",
      "summary": "1-2 sentences grounded in the facts",
      "meaning": "2-3 sentences: what it means for growth, reasoning from their words",
      "known": ["2-4 short strings the owner actually established"],
      "unknown": ["1-3 short strings that are genuinely unknown until data arrives"],
      "evidence": [{ "label": "short label", "value": "exact short fact from the facts", "provenance": "user-supplied|estimated|ai-interpretation", "source": "Your checkup answers" }],
      "recommendedAction": "one concrete next step that does NOT require measured data",
      "primaryMetric": "one word: Enquiries|Customers|Revenue|Conversion|Retention|Traffic|Orders|CAC"
    }
  ]
}

HARD RULES
- 2-3 insights. At least one should connect to their stated goal.
- NEVER invent a number, percentage, currency amount, or timeframe not present in the facts. Words like "growing" or "flat" are fine when they match stated trends.
- Every evidence value must be copied or minimally shortened from the facts. provenance "user-supplied" for things the owner said; "estimated" for their directional trends; "ai-interpretation" only for your reasoning labels.
- "unknown" must include at least one thing a connected data source would settle (e.g. actual response time, per-channel conversion).
- No emoji, no markdown, plain professional English.`;

interface FactsInput {
  workspaceName?: string;
  country?: string;
  facts?: BusinessFacts;
  months?: { label: string; revenue?: number; enquiries?: number; customers?: number }[];
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as FactsInput;
    const facts = body.facts;
    if (!facts) {
      return NextResponse.json({ ok: false, error: "Missing checkup facts" }, { status: 400 });
    }

    const name = (body.workspaceName ?? "Your business").slice(0, 120);
    const country = (body.country ?? "Nigeria").slice(0, 80);

    const userPrompt = [
      `Business: ${name} (${country})`,
      `Type: ${facts.businessType}`,
      `What they sell: ${facts.whatTheySell}`,
      `Customers: ${facts.customers}`,
      `Goal: ${facts.primaryGoal}`,
      `Channels: ${facts.channels.join(", ") || "not specified"}`,
      `Stated trends: enquiries ${facts.trends.enquiries}, customers ${facts.trends.customers}, revenue ${facts.trends.revenue}`,
      `Recent changes: ${facts.recentChanges.join("; ") || "none reported"}`,
      body.months?.length
        ? `Owner-entered months (their own numbers): ${JSON.stringify(body.months.slice(-3))}`
        : "Owner-entered months: none yet",
    ].join("\n");

    const raw = await completeText(SYSTEM, userPrompt, { maxTokens: 1400 });
    const parsed = extractJson<{ insights?: unknown }>(raw);

    if (!parsed || !Array.isArray(parsed.insights) || parsed.insights.length === 0) {
      return NextResponse.json({ ok: false, error: "No insights produced" }, { status: 502 });
    }

    const today = new Date().toISOString().slice(0, 10);
    const insights: Insight[] = parsed.insights.slice(0, 3).map((r: Record<string, unknown>, i: number) => {
      const confidence = clampPercent(Number(r.confidence) || 55, 35, 72, 55);
      const evidence: EvidenceItem[] = Array.isArray(r.evidence)
        ? (r.evidence as Record<string, unknown>[])
            .filter((e) => e && typeof e.label === "string" && typeof e.value === "string")
            .map((e) => ({
              label: String(e.label).slice(0, 60),
              value: String(e.value).slice(0, 60),
              provenance: (PROVENANCE as readonly string[]).includes(String(e.provenance))
                ? (e.provenance as EvidenceItem["provenance"])
                : "ai-interpretation",
              source: String(e.source ?? "Your checkup answers").slice(0, 80),
            }))
            .slice(0, 4)
        : [];

      return {
        id: `ins-ai-${Date.now().toString(36)}-${i}`,
        businessId: "user-workspace",
        type: (INSIGHT_TYPES as readonly string[]).includes(String(r.type)) ? (r.type as Insight["type"]) : "watch",
        importance: (IMPORTANCE as readonly string[]).includes(String(r.importance))
          ? (r.importance as Insight["importance"])
          : "medium",
        title: String(r.title ?? "Insight from your checkup").slice(0, 100),
        summary: String(r.summary ?? "").slice(0, 300),
        date: today,
        confidence,
        confidenceLevel: confidence >= 65 ? "high" : confidence >= 50 ? "medium" : "low",
        meaning: String(r.meaning ?? "").slice(0, 700),
        known: Array.isArray(r.known) ? r.known.filter((k: unknown) => typeof k === "string").map((k) => String(k).slice(0, 120)).slice(0, 4) : [],
        unknown: Array.isArray(r.unknown) ? r.unknown.filter((k: unknown) => typeof k === "string").map((k) => String(k).slice(0, 120)).slice(0, 3) : [],
        evidence,
        recommendedAction: String(r.recommendedAction ?? "").slice(0, 300),
        missingToImprove: ["Connected data for measured confirmation"],
        primaryMetric: String(r.primaryMetric ?? "Enquiries").slice(0, 30),
      } satisfies Insight;
    });

    return NextResponse.json({ ok: true, insights, degraded: false });
  } catch (error) {
    console.error("[api/insights/generate] error:", error);
    return NextResponse.json({ ok: false, error: "Generation failed" }, { status: 500 });
  }
}
