import { NextRequest, NextResponse } from "next/server";
import { completeText } from "@/lib/ai";
import {
  extractJson,
  clampPercent,
  type BusinessFacts,
  type ChannelCountInput,
  type ChannelConversionRow,
  type ImprovedDiagnosis,
} from "@/lib/checkup";

export const runtime = "nodejs";

/** Deterministic math — never let the LLM compute the numbers. */
function computeRows(channels: ChannelCountInput[]): {
  rows: ChannelConversionRow[];
  best: ChannelConversionRow | null;
  worst: ChannelConversionRow | null;
} {
  const rows = channels
    .filter((c) => c && typeof c.name === "string")
    .map((c) => ({
      name: String(c.name).slice(0, 40),
      enquiries: Math.max(0, Math.round(Number(c.enquiries) || 0)),
      customers: Math.max(0, Math.round(Number(c.customers) || 0)),
      conversion: 0,
    }))
    .map((c) => ({
      ...c,
      conversion: c.enquiries > 0 ? Math.round((c.customers / c.enquiries) * 1000) / 10 : 0,
    }));

  const eligible = rows.filter((r) => r.enquiries > 0);
  const best =
    eligible.length > 0 ? eligible.reduce((a, b) => (b.conversion > a.conversion ? b : a)) : null;
  const worst =
    eligible.length > 0 ? eligible.reduce((a, b) => (b.conversion < a.conversion ? b : a)) : null;
  return { rows, best, worst };
}

function narrative(
  rows: ChannelConversionRow[],
  best: ChannelConversionRow | null,
  worst: ChannelConversionRow | null,
  facts: BusinessFacts,
  name: string,
): Omit<ImprovedDiagnosis, "channelRows" | "bestChannel" | "worstChannel" | "confidence"> {
  const fmt = (r: ChannelConversionRow) => `${r.name} converts at ${r.conversion.toFixed(1)}%`;
  const bestS = best ? fmt(best) : "your best channel";
  const worstS = worst ? fmt(worst) : "your weakest channel";
  return {
    headline: worst
      ? `${worst.name} is where enquiries are leaking.`
      : "Your channel picture just got clearer.",
    story: `You added real counts for ${rows.length} channel${rows.length === 1 ? "" : "s"}. ${bestS}${worst && best ? ` while ${worst.name} converts at ${worst.conversion.toFixed(1)}%` : ""}. The gap between them is now the clearest signal in your diagnosis.`,
    meaning: worst
      ? `With measured counts, ${worst.name} sends enquiries that rarely become customers for ${name} (${worst.customers} of ${worst.enquiries}). ${best && best.name !== worst.name ? `${best.name} proves your offer converts when the right people arrive — ${best.conversion.toFixed(1)}% conversion. ` : ""}The constraint is the quality of what happens between enquiry and customer on ${worst.name}, not the volume of enquiries.`
      : `The counts you entered now anchor the diagnosis in your own numbers for ${name}.`,
    whyItMatters:
      "Every week the weakest channel runs unattended, spend and effort convert below what the same work could produce elsewhere. Fixing one response or follow-up step on that single channel usually costs less than buying more traffic.",
    nextInvestigation: worst
      ? `Look at the last 20 enquiries from ${worst.name}: how fast did each get a first reply, and what happened after? Then run one focused change (faster reply, a standard quote, or one follow-up) for two weeks and keep ${best ? best.name : "your best channel"} as the benchmark.`
      : "Compare conversion per channel over the next two weeks and re-run this diagnosis with response-time information.",
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      workspaceName?: string;
      facts?: BusinessFacts;
      channels?: ChannelCountInput[];
    };

    const facts = body.facts;
    if (!facts) {
      return NextResponse.json({ ok: false, error: "Missing checkup facts" }, { status: 400 });
    }

    const channels = Array.isArray(body.channels) ? body.channels.slice(0, 8) : [];
    const { rows, best, worst } = computeRows(channels);
    if (rows.length === 0 || !best || !worst) {
      return NextResponse.json(
        { ok: false, error: "Provide at least one channel with more than zero enquiries" },
        { status: 400 },
      );
    }

    const name = (body.workspaceName ?? "Your business").slice(0, 120);
    const baseConfidence = typeof facts.confidence === "number" ? facts.confidence : 62;

    const payload = {
      business: { name, type: facts.businessType, goal: facts.primaryGoal },
      statedTrends: facts.trends,
      measuredByOwner: rows,
      computed: {
        bestChannel: { name: best.name, conversion: best.conversion },
        worstChannel: { name: worst.name, conversion: worst.conversion },
        totalEnquiries: rows.reduce((a, r) => a + r.enquiries, 0),
        totalCustomers: rows.reduce((a, r) => a + r.customers, 0),
      },
    };

    const raw = await completeText(
      `You are the senior analyst inside bizzGrowth. The owner of a small business just added per-channel enquiry and customer counts during their first diagnosis. The numbers are ALREADY computed for you — never recalculate or invent any number; only reference the exact values provided under "measuredByOwner" and "computed".

Return ONLY valid JSON:
{
  "headline": "max 80 chars naming the weak channel",
  "story": "max 220 chars summarising what the new numbers reveal",
  "meaning": "3-4 sentences interpreting the conversion gap using ONLY the provided numbers and channel names",
  "whyItMatters": "2-3 sentences on the cost of leaving the weak channel unfixed",
  "nextInvestigation": "2-3 sentences with the single most useful next check or two-week experiment on that channel"
}
Plain, direct English. No emoji. No markdown.`,
      JSON.stringify(payload, null, 2),
      { maxTokens: 800 },
    );

    const parsed = extractJson<Partial<ImprovedDiagnosis>>(raw);
    const fallback = narrative(rows, best, worst, facts, name);

    const improved: ImprovedDiagnosis = {
      channelRows: rows,
      bestChannel: best.name,
      worstChannel: worst.name,
      headline: String(parsed?.headline ?? fallback.headline).slice(0, 120),
      story: String(parsed?.story ?? fallback.story).slice(0, 400),
      meaning: String(parsed?.meaning ?? fallback.meaning).slice(0, 700),
      whyItMatters: String(parsed?.whyItMatters ?? fallback.whyItMatters).slice(0, 550),
      nextInvestigation: String(parsed?.nextInvestigation ?? fallback.nextInvestigation).slice(0, 550),
      confidence: clampPercent(baseConfidence + 20, 50, 88, 82),
    };

    return NextResponse.json({ ok: true, improved, degraded: !parsed });
  } catch (error) {
    console.error("[api/checkup/improve] error:", error);
    return NextResponse.json({ ok: false, error: "Improvement failed" }, { status: 500 });
  }
}
