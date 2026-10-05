import { NextRequest, NextResponse } from "next/server";
import { completeText } from "@/lib/ai";
import {
  extractJson,
  clampPercent,
  type BusinessFacts,
  type TranscriptTurn,
  type TrendDirection,
} from "@/lib/checkup";

export const runtime = "nodejs";

const SYSTEM = `You are the bizzGrowth Business Context Engine. You read a short conversation between a business owner (the "user" turns) and the checkup assistant (the "ai" turns), and you extract a structured model of their business.

Return ONLY valid JSON, no markdown, matching exactly this shape:
{
  "businessType": "service" | "ecommerce",
  "whatTheySell": "one sentence, in their words where possible",
  "primaryGoal": "one sentence describing what they most want to improve",
  "customers": "who their customers are, one sentence",
  "channels": ["acquisition / enquiry channels they mentioned"],
  "journey": ["4-6 short journey steps from first discovery to becoming a paying customer, e.g. 'Discovery via Instagram', 'WhatsApp enquiry', 'Quote', 'Customer'"],
  "trends": { "enquiries": "Increased|Decreased|About the same|Don't know", "customers": "...", "revenue": "..." },
  "recentChanges": ["short strings, e.g. 'More ad spend on Instagram'"],
  "chips": ["3-6 short extraction chips, each <= 46 characters, e.g. 'Service business — cleaning', 'Channel: Instagram', 'Goal: convert more enquiries'"],
  "facts": [
    { "section": "Business", "value": "...", "provenance": "user-supplied|ai-interpretation|estimated", "source": "Your checkup conversation|Interpreted from your checkup conversation|Your directional estimates" }
  ],
  "ack": "1-2 sentence warm confirmation that references their specifics by name",
  "confidence": 62
}

Rules:
- "businessType" is "service" if they provide a service or sell time/bookings; "ecommerce" if they sell physical/digital products online.
- The "facts" array must contain 6-9 items with sections exactly: "Business", "What you sell", "Primary goal", "Customers", "Customer journey", "Acquisition channels", "Known performance changes", "Known recent changes" (optionally "Platform / tools").
- "Business" fact value should read like: "<name> — a <type> business in <country>".
- provenance: "user-supplied" only for things the owner explicitly stated; "ai-interpretation" for your inferences (journey, goal interpretation); "estimated" for directional trends they gave.
- trends: derive each from their answers. If they never said, use "Don't know".
- confidence: 50-72 (integers) — these are self-reported directions, not measured data.
- Never invent numbers, tools, or channels they did not mention. If something is unknown, say so in facts/limitations rather than guessing.
- Write in clear, plain, professional English. No emoji.`;

function fallbackFacts(body: {
  workspaceName: string;
  country: string;
  transcript: TranscriptTurn[];
}): BusinessFacts {
  const userText = body.transcript
    .filter((t) => t.role === "user")
    .map((t) => t.text)
    .join("\n");
  const t = userText.toLowerCase();

  const businessType: BusinessFacts["businessType"] =
    /store|shop|sell|selling|ecommerce|products|brand|furniture|clothes|dropship|online order/.test(t)
      ? "ecommerce"
      : "service";

  const trend = (): TrendDirection => {
    if (/decreas|down|less|fewer|drop|fell|worse|slower/.test(t)) return "Decreased";
    if (/increas|up|more|grew|rise|rose|better|higher/.test(t)) return "Increased";
    if (/don'|do not|no idea|not sure/.test(t)) return "Don't know";
    return "About the same";
  };

  const channels: string[] = [];
  if (/instagram|\big\b/.test(t)) channels.push("Instagram");
  if (/google|search/.test(t)) channels.push("Google Search");
  if (/facebook/.test(t)) channels.push("Facebook");
  if (/tiktok/.test(t)) channels.push("TikTok");
  if (/referr|word of mouth|recommend/.test(t)) channels.push("Referrals");
  if (/whatsapp/.test(t)) channels.push("WhatsApp");
  if (/website|site/.test(t)) channels.push("Website");
  if (channels.length === 0) channels.push("Not specified yet");

  const recentChanges: string[] = [];
  if (/spend|ads|advertis|budget/.test(t)) recentChanges.push("More ad spend");
  if (/price|pricing/.test(t)) recentChanges.push("Changed pricing");
  if (/team|hired|hire|staff/.test(t)) recentChanges.push("Grew the team");
  if (recentChanges.length === 0) recentChanges.push("Nothing major reported");

  return {
    businessType,
    whatTheySell:
      businessType === "service"
        ? "Services (described in your own words)"
        : "Products sold online (described in your own words)",
    primaryGoal: "Understand why growth is slow and what to fix next",
    customers: "Described during the checkup",
    channels,
    journey:
      businessType === "service"
        ? ["Discovery", "Enquiry (WhatsApp / website)", "Quote", "Customer"]
        : ["Discovery", "Visit online store", "Add to cart", "Checkout", "Customer"],
    trends: { enquiries: trend(), customers: trend(), revenue: trend() },
    recentChanges,
    chips: [
      businessType === "service" ? "Service business" : "Ecommerce — products online",
      ...channels.slice(0, 3).map((c) => `Channel: ${c}`),
    ],
    facts: [
      {
        section: "Business",
        value: `${body.workspaceName} — a ${businessType} business in ${body.country}`,
        provenance: "user-supplied",
        source: "Workspace setup",
      },
      {
        section: "Acquisition channels",
        value: channels.join(", "),
        provenance: "user-supplied",
        source: "Your checkup conversation",
      },
      {
        section: "Known performance changes",
        value: `Enquiries ${trend().toLowerCase()}, customers ${trend().toLowerCase()}, revenue ${trend().toLowerCase()} (your estimates)`,
        provenance: "estimated",
        source: "Your directional estimates",
      },
      {
        section: "Known recent changes",
        value: recentChanges.join("; "),
        provenance: "user-supplied",
        source: "Your checkup conversation",
      },
    ],
    confidence: 55,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      workspaceName?: string;
      country?: string;
      transcript?: TranscriptTurn[];
    };

    const workspaceName = (body.workspaceName ?? "Your business").slice(0, 120);
    const country = (body.country ?? "Nigeria").slice(0, 80);
    const transcript = Array.isArray(body.transcript)
      ? body.transcript
          .filter((t) => t && typeof t.text === "string" && (t.role === "ai" || t.role === "user"))
          .map((t) => ({ role: t.role, text: t.text.slice(0, 1200) }))
          .slice(-20)
      : [];

    const transcriptText = transcript
      .map((t) => `${t.role === "ai" ? "ASSISTANT" : "OWNER"}: ${t.text}`)
      .join("\n");

    const raw = await completeText(
      SYSTEM,
      `Workspace name: ${workspaceName}\nCountry: ${country}\n\nConversation:\n${transcriptText}`,
      { maxTokens: 1400 },
    );

    const parsed = extractJson<Partial<BusinessFacts> & { ack?: string }>(raw);

    if (!parsed || !parsed.facts || !Array.isArray(parsed.facts)) {
      // Graceful degradation — deterministic extraction so the journey never blocks.
      return NextResponse.json({
        ok: true,
        facts: fallbackFacts({ workspaceName, country, transcript }),
        degraded: true,
      });
    }

    const facts: BusinessFacts = {
      businessType: parsed.businessType === "ecommerce" ? "ecommerce" : "service",
      whatTheySell: String(parsed.whatTheySell ?? "Described during the checkup").slice(0, 200),
      primaryGoal: String(parsed.primaryGoal ?? "Understand what to fix next").slice(0, 200),
      customers: String(parsed.customers ?? "Described during the checkup").slice(0, 200),
      channels: Array.isArray(parsed.channels)
        ? parsed.channels.filter((c) => typeof c === "string").map((c) => String(c).slice(0, 40)).slice(0, 6)
        : [],
      journey: Array.isArray(parsed.journey)
        ? parsed.journey.filter((j) => typeof j === "string").map((j) => String(j).slice(0, 60)).slice(0, 8)
        : [],
      trends: {
        enquiries: (parsed.trends?.enquiries ?? "Don't know") as TrendDirection,
        customers: (parsed.trends?.customers ?? "Don't know") as TrendDirection,
        revenue: (parsed.trends?.revenue ?? "Don't know") as TrendDirection,
      },
      recentChanges: Array.isArray(parsed.recentChanges)
        ? parsed.recentChanges.filter((c) => typeof c === "string").map((c) => String(c).slice(0, 80)).slice(0, 5)
        : [],
      chips: Array.isArray(parsed.chips)
        ? parsed.chips.filter((c) => typeof c === "string").map((c) => String(c).slice(0, 46)).slice(0, 6)
        : [],
      facts: parsed.facts
        .filter((f) => f && typeof f.section === "string" && typeof f.value === "string")
        .map((f) => ({
          section: String(f.section).slice(0, 40),
          value: String(f.value).slice(0, 220),
          provenance: (["user-supplied", "ai-interpretation", "estimated", "measured"] as const).includes(
            f.provenance as "user-supplied",
          )
            ? f.provenance
            : "ai-interpretation",
          source: String(f.source ?? "Your checkup conversation").slice(0, 80),
        }))
        .slice(0, 10),
      confidence: clampPercent(parsed.confidence, 40, 80, 62),
    };

    return NextResponse.json({
      ok: true,
      facts,
      ack: typeof parsed.ack === "string" ? parsed.ack.slice(0, 300) : null,
      degraded: false,
    });
  } catch (error) {
    console.error("[api/checkup/extract] error:", error);
    return NextResponse.json({ ok: false, error: "Extraction failed" }, { status: 500 });
  }
}
