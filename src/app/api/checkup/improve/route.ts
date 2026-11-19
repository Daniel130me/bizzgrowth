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
import { plainify } from "@/lib/checkup-math";
import { VOICE_RULES } from "@/lib/ai-voice";
import { collectAllowedNumbers, ungroundedNumbers } from "@/lib/grounding";

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
  const fmt = (r: ChannelConversionRow) => `${r.customers} of the ${r.enquiries} people who asked through ${r.name} went on to pay`;
  return {
    headline: worst && best && worst.name !== best.name
      ? `People who find you through ${worst.name} are the ones slipping away`
      : "Your own numbers now back up your diagnosis",
    story: `You added real counts for ${rows.length} way${rows.length === 1 ? "" : "s"} people find you. ${best ? `${fmt(best)}` : ""}${worst && best && worst.name !== best.name ? `, while ${worst.customers} of the ${worst.enquiries} who asked through ${worst.name} did` : ""}. That gap is now the clearest signal in your diagnosis.`,
    meaning: worst
      ? `${worst.name} brings people to ${name} who rarely go on to pay (${worst.customers} of ${worst.enquiries}). ${best && best.name !== worst.name ? `${best.name} shows your offer works when the right people arrive. ` : ""}So the thing to fix is what happens after people from ${worst.name} first get in touch — not how many of them there are.`
      : `The counts you entered now ground your diagnosis in your own numbers for ${name}.`,
    whyItMatters:
      "Every week this stays the same, the effort that brings those people in buys fewer customers than it could. Improving one step — a faster reply, a clearer price, one follow-up — usually costs far less than finding more people.",
    nextInvestigation: worst
      ? `Look back at the last people who asked through ${worst.name}: how fast did each get a reply, and what happened after? Then change one thing — a faster reply, a clear price with options, or one friendly follow-up — for two weeks, and compare with ${best ? best.name : "your best way of finding customers"}.`
      : "Keep counting who asks and who pays for the next two weeks, then update your diagnosis.",
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
      business: { name, type: facts.businessType, sells: facts.whatTheySell, customers: facts.customers, goal: facts.primaryGoal },
      whatTheyToldUs: {
        whereItFeelsStuck: facts.bottleneck ?? null,
        whatTheyThinkIsCausingIt: facts.ownerTheory ?? null,
        howTheyReplyAndFollowUp: facts.followUp ?? null,
        howTheyGiveThePrice: facts.pricePresentation ?? null,
        whenPeopleDontBuy: facts.lostReason ?? null,
      },
      measuredByOwner: rows.map((r) => ({ way: r.name, peopleWhoAsked: r.enquiries, peopleWhoPaid: r.customers, sharePaidPercent: r.conversion })),
      computed: {
        bestWay: { name: best.name, sharePaidPercent: best.conversion },
        weakestWay: { name: worst.name, sharePaidPercent: worst.conversion },
        totalPeopleWhoAsked: rows.reduce((a, r) => a + r.enquiries, 0),
        totalPeopleWhoPaid: rows.reduce((a, r) => a + r.customers, 0),
      },
    };
    const payloadText = JSON.stringify(payload, null, 2);
    const allowed = collectAllowedNumbers(payloadText);

    const raw = await completeText(
      `You are the owner's own analyst inside bizzGrowth. They just counted, for each way people find them, how many people asked and how many paid. The figures are ALREADY worked out for you — never recalculate or invent any number; use only the exact values in "measuredByOwner" and "computed".

Explain what their own numbers show, connect it to what they told you in the checkup (whatTheyToldUs), and give the single most useful thing to change next.

${VOICE_RULES}

Return ONLY valid JSON:
{
  "headline": "max 80 chars — what their numbers show, in plain words",
  "story": "max 220 chars — what the new numbers reveal",
  "meaning": "3 sentences — what is probably happening, linking the numbers to what they told us",
  "whyItMatters": "2 sentences — the cost of leaving it as it is",
  "nextInvestigation": "2-3 sentences — the one change to try for two weeks, and what to count"
}`,
      payloadText,
      { maxTokens: 1600, profile: "quality" },
    );

    const parsed = extractJson<Partial<ImprovedDiagnosis>>(raw);
    const fallback = narrative(rows, best, worst, facts, name);
    // A field with an untraceable figure falls back to the computed narrative.
    const pick = (v: unknown, fb: string, cap: number) => {
      const s = typeof v === "string" ? v.trim() : "";
      return (s && ungroundedNumbers(s, allowed).length === 0 ? plainify(s) : fb).slice(0, cap);
    };

    const improved: ImprovedDiagnosis = {
      channelRows: rows,
      bestChannel: best.name,
      worstChannel: worst.name,
      headline: pick(parsed?.headline, fallback.headline, 120),
      story: pick(parsed?.story, fallback.story, 400),
      meaning: pick(parsed?.meaning, fallback.meaning, 700),
      whyItMatters: pick(parsed?.whyItMatters, fallback.whyItMatters, 550),
      nextInvestigation: pick(parsed?.nextInvestigation, fallback.nextInvestigation, 550),
      confidence: clampPercent(baseConfidence + 20, 50, 88, 82),
    };

    return NextResponse.json({ ok: true, improved, degraded: !parsed });
  } catch (error) {
    console.error("[api/checkup/improve] error:", error);
    return NextResponse.json({ ok: false, error: "Improvement failed" }, { status: 500 });
  }
}
