import { NextRequest, NextResponse } from "next/server";
import { completeText } from "@/lib/ai";
import {
  extractJson,
  clampPercent,
  type BusinessFacts,
  type DiagnosisContent,
  type DiagnosisDelta,
  type TrendDirection,
} from "@/lib/checkup";

export const runtime = "nodejs";

const SYSTEM = `You are the senior analyst inside bizzGrowth. You write a user's FIRST DIAGNOSIS — the moment they realise this product understands their business. You reason ONLY over the structured facts extracted from their own checkup answers (self-reported directions, no measured channel data).

TRUST RULE — NUMBERS ARE SACRED
The owner described DIRECTIONS, never figures. You must NOT output any percentage, money amount, count, or ratio anywhere in your text. Write "customers grew while revenue stayed flat", never "+15%". Any numeric claim is a fabrication that destroys trust and is forbidden. The metric tiles are rendered by the app itself from the owner's stated directions — you do not produce them.

Return ONLY valid JSON, no markdown, matching exactly:
{
  "headline": "one short line, max 90 chars, names the first thing worth investigating",
  "story": "2-3 sentences (max 260 chars) naming THEIR business type, their channels and their goal, ending with the constraint hypothesis",
  "meaning": "3-4 sentences: what the pattern means. Reference their actual channels.",
  "whyItMatters": "2-3 sentences: the cost of ignoring it. Plain logic, no invented numbers.",
  "nextInvestigation": "2-3 sentences: the single most useful comparison to make next, using THEIR channels.",
  "confidence": 62
}

Rules:
- confidence: 45-68 integer — these are self-reported directions, not measured data; be humble.
- Tone: direct, plain, professional. No hype, no emoji, no marketing language. Never imply data was measured — it was described by the owner.
- If all three of enquiries/customers/revenue are "Don't know", pivot the diagnosis to "insufficient signal — here is the cheapest way to get one", confidence <= 50.`;

type Direction = "up" | "down" | "flat" | "unknown";

function directionOf(t: TrendDirection | undefined): Direction {
  switch (t) {
    case "Increased":
      return "up";
    case "Decreased":
      return "down";
    case "About the same":
      return "flat";
    default:
      return "unknown";
  }
}

/**
 * The ONLY source of the metric tiles: the owner's stated directions, mapped to
 * words — never to invented percentages. Marketing spend is only shown when the
 * owner actually mentioned it in their recent changes.
 */
function directionDeltas(facts: BusinessFacts): DiagnosisDelta[] {
  const goodFor = (dir: Direction, positiveIsGood: boolean): "good" | "bad" | "neutral" => {
    if (dir === "unknown" || dir === "flat") return "neutral";
    if (dir === "up") return positiveIsGood ? "good" : "bad";
    return positiveIsGood ? "bad" : "good";
  };

  const mentionText = facts.recentChanges.join(" ").toLowerCase();
  const spendMentioned = /spend|ads|advert|budget|boost|promo/.test(mentionText);

  const spend: DiagnosisDelta = spendMentioned
    ? { label: "Marketing spend", delta: null, direction: "up", goodness: "neutral", caption: "From your recent changes — ad spend" }
    : { label: "Marketing spend", delta: null, direction: "unknown", goodness: "neutral", caption: "Not mentioned in your checkup" };

  const dir = (t: TrendDirection | undefined, label: string, positiveIsGood: boolean): DiagnosisDelta => {
    const d = directionOf(t);
    return {
      label,
      delta: null,
      direction: d,
      goodness: goodFor(d, positiveIsGood),
      caption: d === "unknown" ? "You did not report this yet" : "Direction you described",
    };
  };

  return [
    spend,
    dir(facts.trends.enquiries, "Enquiries", true),
    dir(facts.trends.customers, "Customers", true),
    dir(facts.trends.revenue, "Revenue", true),
  ];
}

function templateDiagnosis(facts: BusinessFacts, name: string): DiagnosisContent {
  const d = facts.trends;
  const ch = facts.channels.length ? facts.channels.join(", ") : "your channels";
  const gap = d.enquiries === "Increased" && (d.customers === "About the same" || d.customers === "Don't know");

  return {
    headline: gap
      ? "Demand is moving — customers are not, yet."
      : "Here is the first pattern worth investigating.",
    story: `Your checkup says enquiries are ${d.enquiries.toLowerCase()} while customers are ${d.customers.toLowerCase()} and revenue is ${d.revenue.toLowerCase()}. ${
      gap
        ? "Your immediate constraint may be converting the demand you already generate rather than generating more of it."
        : `The next step is to find where attention and outcomes diverge across ${ch}.`
    }`,
    deltas: directionDeltas(facts),
    meaning: gap
      ? `Demand is not the problem — enquiry activity grew while customers stayed flat. The drop-off is most likely happening after the enquiry arrives (response time, quoting, or follow-up) rather than in how many people discover ${name}. Each of your channels (${ch}) needs a conversion check.`
      : `Based on what you described, the clearest open question is how outcomes differ across ${ch}. Comparing like-for-like conversion per channel is the fastest route to the real constraint.`,
    whyItMatters:
      "Acting on the wrong lever — for example spending more on acquisition before fixing conversion — amplifies the gap and the waste. A small comparison done this week is cheaper than another month of unfocused spend.",
    nextInvestigation: `Compare enquiry-to-customer conversion per channel (${ch}) and check how quickly enquiries receive a first response. Whichever channel sends the most enquiries but converts worst is your first target.`,
    confidence: 55,
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

    const raw = await completeText(SYSTEM, JSON.stringify(userPayload, null, 2), { maxTokens: 900 });
    const parsed = extractJson<{
      headline?: string;
      story?: string;
      meaning?: string;
      whyItMatters?: string;
      nextInvestigation?: string;
      confidence?: number;
    }>(raw);

    if (!parsed || !parsed.headline || !parsed.story || !parsed.meaning) {
      return NextResponse.json({
        ok: true,
        diagnosis: templateDiagnosis(facts, name),
        degraded: true,
      });
    }

    // Deltas are NEVER the LLM's job: they are derived deterministically from the
    // owner's stated directions and rendered as words, not invented percentages.
    const diagnosis: DiagnosisContent = {
      headline: String(parsed.headline).slice(0, 120),
      story: String(parsed.story).slice(0, 420),
      deltas: directionDeltas(facts),
      meaning: String(parsed.meaning).slice(0, 600),
      whyItMatters: String(parsed.whyItMatters ?? "").slice(0, 500),
      nextInvestigation: String(parsed.nextInvestigation ?? "").slice(0, 500),
      confidence: clampPercent(parsed.confidence, 40, 68, 55),
    };

    return NextResponse.json({ ok: true, diagnosis, degraded: false });
  } catch (error) {
    console.error("[api/checkup/diagnosis] error:", error);
    return NextResponse.json({ ok: false, error: "Diagnosis generation failed" }, { status: 500 });
  }
}
