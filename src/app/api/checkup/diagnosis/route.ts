import { NextRequest, NextResponse } from "next/server";
import { completeText } from "@/lib/ai";
import {
  extractJson,
  clampPercent,
  type BusinessFacts,
  type DiagnosisContent,
  type DiagnosisDelta,
} from "@/lib/checkup";

export const runtime = "nodejs";

const SYSTEM = `You are the senior analyst inside bizzGrowth. You write a user's FIRST DIAGNOSIS — the moment they realise this product understands their business. You reason ONLY over the structured facts extracted from their own checkup answers (self-reported directions, no measured channel data).

Return ONLY valid JSON, no markdown, matching exactly:
{
  "headline": "one short line, max 90 chars, names the first thing worth investigating",
  "story": "2-3 sentences (max 240 chars) naming THEIR business type, their channels and their goal, ending with the constraint hypothesis",
  "deltas": [
    { "label": "Marketing spend", "delta": 40, "goodness": "neutral", "caption": "short caption" },
    { "label": "Enquiries", "delta": 50, "goodness": "good", "caption": "short caption" },
    { "label": "Customers", "delta": 4, "goodness": "neutral", "caption": "short caption" },
    { "label": "Revenue", "delta": 3, "goodness": "neutral", "caption": "short caption" }
  ],
  "meaning": "3-4 sentences: what the pattern means. Reference their actual channels.",
  "whyItMatters": "2-3 sentences: the cost of ignoring it. Plain logic, no invented numbers.",
  "nextInvestigation": "2-3 sentences: the single most useful comparison to make next, using THEIR channels.",
  "confidence": 62
}

Rules for deltas (labels fixed in this order: Marketing spend, Enquiries, Customers, Revenue):
- Convert each stated trend direction into an illustrative percent estimate:
  "Increased" with words like lot/much/way/more than -> 30-60; plain "Increased"/"up" -> 12-25;
  "About the same" -> -5 to 5; "Don't know" -> 0 with caption "Not reported yet";
  "Decreased" -> -10 to -45.
- goodness: spend up = "neutral"; enquiries up = "good", down = "bad"; customers/revenue up = "good", flat = "neutral", down = "bad".
- delta must be an integer. These are labelled as the owner's estimates in the UI, so keep them consistent with what was actually said.
- confidence: 55-72 integer.
- Tone: direct, plain, professional. No hype, no emoji, no marketing language. Never imply data was measured — it was described by the owner.
- If all three of enquiries/customers/revenue are "Don't know", pivot the diagnosis to "insufficient signal — here is the cheapest way to get one", deltas all 0 with "Not reported yet" captions, confidence <= 55.`;

function templateDiagnosis(facts: BusinessFacts, name: string, currency: string): DiagnosisContent {
  const d = facts.trends;
  const num = (t: string, up: number, flat = 2): number =>
    t === "Increased" ? up : t === "Decreased" ? -18 : t === "Don't know" ? 0 : flat;
  const good = (t: string): "good" | "bad" | "neutral" =>
    t === "Increased" ? "good" : t === "Decreased" ? "bad" : "neutral";
  const ch = facts.channels.length ? facts.channels.join(", ") : "your channels";
  const gap =
    d.enquiries === "Increased" && (d.customers === "About the same" || d.customers === "Don't know");

  return {
    headline: gap
      ? "Demand is moving — customers are not, yet."
      : "Here is the first pattern worth investigating.",
    story: `${name} told the checkup that enquiries are ${d.enquiries.toLowerCase()} while customers are ${d.customers.toLowerCase()} and revenue ${d.revenue.toLowerCase()}. ${
      gap
        ? `Your immediate constraint may be converting the demand you already generate rather than generating more of it.`
        : `The next step is to find where attention and outcomes diverge across ${ch}.`
    }`,
    deltas: [
      { label: "Marketing spend", delta: num(d.revenue, 25, 0), goodness: "neutral", caption: "As you described it" },
      { label: "Enquiries", delta: num(d.enquiries, 35), goodness: good(d.enquiries), caption: "Your estimate" },
      { label: "Customers", delta: num(d.customers, 8, 2), goodness: good(d.customers) === "good" ? "good" : "neutral", caption: "Your estimate" },
      { label: "Revenue", delta: num(d.revenue, 6, 2), goodness: good(d.revenue) === "good" ? "good" : "neutral", caption: "Your estimate" },
    ],
    meaning: gap
      ? `Demand is not the problem — enquiry activity grew while customers stayed flat. The drop-off is most likely happening after the enquiry arrives (response time, quoting, or follow-up) rather than in how many people discover ${name}. Your stated channels (${ch}) each need a conversion check.`
      : `Based on what you described, the clearest open question is how outcomes differ across ${ch}. Comparing like-for-like conversion per channel is the fastest route to the real constraint.`,
    whyItMatters:
      "Acting on the wrong lever — for example spending more on acquisition before fixing conversion — amplifies the gap and the waste. A small comparison done this week is cheaper than another month of unfocused spend.",
    nextInvestigation: `Compare enquiry-to-customer conversion per channel (${ch}) and check how quickly enquiries receive a first response. Whichever channel sends the most enquiries but converts worst is your first target.`,
    confidence: 60,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      workspaceName?: string;
      country?: string;
      currency?: string;
      facts?: BusinessFacts;
    };

    const facts = body.facts;
    if (!facts || !facts.trends) {
      return NextResponse.json({ ok: false, error: "Missing checkup facts" }, { status: 400 });
    }

    const name = (body.workspaceName ?? "Your business").slice(0, 120);
    const currency = (body.currency ?? "₦").slice(0, 6);
    const country = (body.country ?? "Nigeria").slice(0, 80);

    const userPayload = {
      business: { name, country, currency, type: facts.businessType },
      whatTheySell: facts.whatTheySell,
      primaryGoal: facts.primaryGoal,
      customers: facts.customers,
      channels: facts.channels,
      journey: facts.journey,
      statedTrends: facts.trends,
      recentChanges: facts.recentChanges,
    };

    const raw = await completeText(SYSTEM, JSON.stringify(userPayload, null, 2), { maxTokens: 1100 });
    const parsed = extractJson<Partial<DiagnosisContent>>(raw);

    if (!parsed || !parsed.headline || !parsed.story || !Array.isArray(parsed.deltas) || parsed.deltas.length < 4) {
      return NextResponse.json({
        ok: true,
        diagnosis: templateDiagnosis(facts, name, currency),
        degraded: true,
      });
    }

    const deltas: DiagnosisDelta[] = parsed.deltas.slice(0, 4).map((d, i) => ({
      label: String(d.label ?? ["Marketing spend", "Enquiries", "Customers", "Revenue"][i]).slice(0, 30),
      delta: clampPercent(d.delta, -60, 80, 0),
      goodness: d.goodness === "good" || d.goodness === "bad" ? d.goodness : "neutral",
      caption: String(d.caption ?? "As you described it").slice(0, 60),
    }));

    const diagnosis: DiagnosisContent = {
      headline: String(parsed.headline).slice(0, 120),
      story: String(parsed.story).slice(0, 400),
      deltas,
      meaning: String(parsed.meaning ?? "").slice(0, 600),
      whyItMatters: String(parsed.whyItMatters ?? "").slice(0, 500),
      nextInvestigation: String(parsed.nextInvestigation ?? "").slice(0, 500),
      confidence: clampPercent(parsed.confidence, 45, 80, 62),
    };

    return NextResponse.json({ ok: true, diagnosis, degraded: false });
  } catch (error) {
    console.error("[api/checkup/diagnosis] error:", error);
    return NextResponse.json({ ok: false, error: "Diagnosis generation failed" }, { status: 500 });
  }
}
