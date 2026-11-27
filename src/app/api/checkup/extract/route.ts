import { NextRequest, NextResponse } from "next/server";
import { requireAiSession } from "@/lib/ai-route-guard";
import { completeText } from "@/lib/ai";
import {
  businessKindPhrase,
  extractJson,
  type BusinessFacts,
  type CheckupFact,
  type MoneyFacts,
  type TranscriptTurn,
} from "@/lib/checkup";
import { plainify, tidyOwnerText } from "@/lib/checkup-math";
import { mergeExtractedFacts, slotTrend } from "@/lib/checkup-facts";

export const runtime = "nodejs";

const SYSTEM = `You are Nellovia's Business Context Engine. You read a short conversation between a business owner (the "user" turns) and the checkup assistant (the "ai" turns), and you extract a structured model of their business.

Return ONLY valid JSON, no markdown, matching exactly this shape:
{
  "businessType": "service" | "ecommerce",
  "whatTheySell": "one short phrase, e.g. 'Websites and web apps'",
  "primaryGoal": "one sentence describing what they most want to improve",
  "customers": "who their customers are, one short phrase",
  "channels": ["how new customers find them, as they said it"],
  "journey": ["4-6 short steps from first hearing about them to paying, e.g. 'Hears about you from a friend', 'Asks on WhatsApp', 'Gets a price', 'Pays'"],
  "trends": { "enquiries": "Increased|Decreased|About the same|Don't know", "customers": "...", "revenue": "..." },
  "recentChanges": ["short strings"],
  "bottleneck": "what feels hardest right now, one clean sentence in their terms — say what IS stuck, never what is not, and never their own explanation of it (that goes in ownerTheory) — or null",
  "closeRate": "out of the people who ask, how many pay — both numbers as the owner said them, e.g. '2 out of 5', or null. Never assume a denominator they did not say.",
  "followUp": "how quickly they reply and whether they check back, or null",
  "jobValue": "roughly what one customer pays for a typical job, with currency, e.g. '₦200k – ₦500k', or null",
  "monthlyEnquiries": "roughly how many people ask in a normal month, e.g. 'About 5 a month', or null",
  "pricePresentation": "how and when they give the price, or null",
  "lostReason": "what people say or do when they don't go ahead, or null",
  "capacity": "whether they could take on more work right now, or null",
  "proof": "whether new people see past work or results before the price, or null",
  "repeat": "whether past customers come back or order again, or null",
  "ownerTheory": "what the owner thinks is causing the problem — their own observations or hunches, or null",
  "money": null — or, ONLY when the owner described a payment they can't cover or money they owe: {
    "due": [{ "what": "what it is, e.g. 'Supplier invoice'", "amount": "what they must pay, exactly as they said it", "when": "when it is due, in their words" }],
    "cashNow": "the cash they have now, exactly as they said it, or null",
    "moneyIn": { "amount": "sales as they gave them, e.g. '₦40,000–₦60,000'", "per": "day|week|month", "daysOpen": the number of days a month they said they open, or null } or null,
    "costs": [{ "what": "a running cost they named", "amount": "exactly as they said it", "per": "day|week|month|year" }],
    "statedMonthlySales": "a monthly sales figure they stated in passing, exactly as said, or null",
    "coverPlan": "how they were planning to cover the gap, in their words, or null",
    "pricesChanged": "when they last changed prices and whether costs rose, or null",
    "platformFees": "fees or commission a way of selling takes, or null",
    "owedFlex": "whether whoever they owe agreed to part payment or a plan before, or null"
  },
  "chips": ["3-6 short chips, each <= 46 characters"],
  "facts": [
    { "section": "Business", "value": "...", "provenance": "user-supplied|ai-interpretation|estimated", "source": "Your checkup conversation|Interpreted from your checkup conversation|Your directional estimates" }
  ],
  "ack": "1-2 sentence warm confirmation that references their specifics by name",
  "confidence": 62
}

Rules:
- "businessType" is "service" if they provide a service or sell time/bookings; "ecommerce" if they sell products.
- "facts": 6-14 items with sections from: "Business", "What you sell", "Primary goal", "Customers", "Customer journey", "How people find you", "Known performance changes", "Where growth feels stuck", "Enquiries that become customers", "How enquiries are handled", "Typical job value", "People asking each month", "How you give your price", "When people don't buy", "Room for more work", "Past work shown before the price", "Customers coming back", "What you think is causing it" — only the ones the owner actually spoke to (plus Business and Customer journey).
- Clean up spelling and grammar in every value (e.g. "every businesses and invidual" → "Any business or individual") while keeping the owner's meaning and numbers exactly. Never copy typos. Start each value with a capital letter.
- "Business" fact value: "<name> — a <type> business in <country>".
- provenance: "user-supplied" only for things the owner explicitly stated; "ai-interpretation" for your inferences (journey, goal); "estimated" for directional trends they gave.
- trends: only what they actually said; otherwise "Don't know". Never infer a trend from words like "more" in an unrelated answer.
- Never invent numbers, tools or channels they did not mention.
- "money": every amount exactly as the owner said it — never add up, convert, round or estimate anything. For a loan, the amount they must pay back, not what they borrowed. Leave out anything they didn't say. Add facts rows "Money due", "Cash now", "Money in and out" when they spoke to them.
- Plain everyday English any small-business owner understands. Never use jargon such as signed, leads, prospects, conversions, funnel, CTR, traffic, visitors or acquisition unless the owner used the word first. Never assume the business is online. No emoji.`;

type SlotInput = Partial<
  Record<
    | "businessType"
    | "sells"
    | "targetMarket"
    | "goal"
    | "bottleneck"
    | "closeRate"
    | "followUp"
    | "jobValue"
    | "monthlyEnquiries"
    | "pricePresentation"
    | "lostReason"
    | "capacity"
    | "proof"
    | "repeat"
    | "ownerTheory"
    | "enquiries"
    | "customers"
    | "revenue"
    | "moneyDue"
    | "otherDebts"
    | "cashNow"
    | "moneyInOut"
    | "coverPlan"
    | "pricesChanged"
    | "platformFees"
    | "owedFlex",
    unknown
  >
> & { channels?: unknown; changes?: unknown; otherChallenges?: unknown; money?: unknown };

const slotText = (v: unknown, cap: number) =>
  typeof v === "string" && v.trim().length > 0 && v !== "Don't know" ? v.trim().slice(0, cap) : undefined;
const slotList = (v: unknown, cap: number, n: number) =>
  Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).map((x) => String(x).trim().slice(0, cap)).slice(0, n) : [];

/**
 * Facts built ONLY from the confirmed interview answers — used whenever the
 * model's extraction is unavailable, so the diagnosis never runs on guesses
 * (no trend inferred from a stray "more", no channel taken from "I send the
 * price on WhatsApp").
 */
function factsFromSlots(body: { workspaceName: string; country: string; transcript: TranscriptTurn[]; slots: SlotInput }): BusinessFacts {
  const s = body.slots;
  const own = (v: unknown, cap = 160) => {
    const t = slotText(v, cap);
    return t ? tidyOwnerText(t) : undefined;
  };
  const businessType: BusinessFacts["businessType"] = /product|sell (things|goods)|shop|store|stock/i.test(String(s.businessType ?? s.sells ?? ""))
    ? "ecommerce"
    : "service";
  const channels = slotList(s.channels, 40, 6).map(tidyOwnerText);
  const fields = {
    whatTheySell: own(s.sells, 200) ?? "Described during the checkup",
    customers: own(s.targetMarket, 200) ?? "Described during the checkup",
    primaryGoal: own(s.goal, 200) ?? "Grow the business",
    bottleneck: own(s.bottleneck),
    closeRate: slotText(s.closeRate, 80),
    followUp: own(s.followUp),
    jobValue: slotText(s.jobValue, 80),
    monthlyEnquiries: own(s.monthlyEnquiries, 80),
    pricePresentation: own(s.pricePresentation),
    lostReason: own(s.lostReason),
    capacity: own(s.capacity),
    proof: own(s.proof),
    repeat: own(s.repeat),
    ownerTheory: own(s.ownerTheory, 220),
  };
  const fact = (section: string, value: string | undefined): CheckupFact | null =>
    value ? { section, value, provenance: "user-supplied", source: "Your checkup conversation" } : null;
  const facts = [
    fact("Business", `${body.workspaceName} — ${businessKindPhrase(businessType)} in ${body.country}`),
    fact("What you sell", slotText(s.sells, 200) ? fields.whatTheySell : undefined),
    fact("Customers", slotText(s.targetMarket, 200) ? fields.customers : undefined),
    fact("How people find you", channels.length ? channels.join(", ") : undefined),
    fact("Where growth feels stuck", fields.bottleneck),
    fact("What you think is causing it", fields.ownerTheory),
    fact("Enquiries that become customers", fields.closeRate),
    fact("People asking each month", fields.monthlyEnquiries),
    fact("Typical job value", fields.jobValue),
    fact("How enquiries are handled", fields.followUp),
    fact("How you give your price", fields.pricePresentation),
    fact("When people don't buy", fields.lostReason),
    fact("Past work shown before the price", fields.proof),
    fact("Room for more work", fields.capacity),
    fact("Customers coming back", fields.repeat),
    fact("Money due", own(s.moneyDue, 220)),
    fact("Also owed", own(s.otherDebts, 220)),
    fact("Cash now", own(s.cashNow, 120)),
    fact("Money in and out", own(s.moneyInOut, 300)),
  ].filter((f): f is CheckupFact => f !== null);
  // Money trouble: what they told the interview, unstructured (the model's extraction adds the amounts).
  const money: MoneyFacts | undefined =
    s.money === true
      ? {
          due: [own(s.moneyDue, 220), /^(nothing|no|none)\b/i.test(String(s.otherDebts ?? "").trim()) ? undefined : own(s.otherDebts, 220)]
            .filter((t): t is string => Boolean(t))
            .map((what) => ({ what })),
          cashNow: slotText(s.cashNow, 120),
          costs: [],
          coverPlan: own(s.coverPlan),
          pricesChanged: own(s.pricesChanged),
          platformFees: own(s.platformFees),
          owedFlex: own(s.owedFlex),
        }
      : undefined;

  return {
    businessType,
    ...fields,
    channels,
    journey:
      businessType === "service"
        ? ["Hears about you", "Asks about the work", "Gets a price", "Pays"]
        : ["Sees what you sell", "Asks or visits", "Decides", "Pays"],
    trends: {
      enquiries: slotTrend(s.enquiries) ?? "Don't know",
      customers: slotTrend(s.customers) ?? "Don't know",
      revenue: slotTrend(s.revenue) ?? "Don't know",
    },
    recentChanges: slotList(s.changes, 80, 5),
    // Other challenges come straight from their answer — recorded, never diagnosed here.
    otherChallenges: Array.isArray(s.otherChallenges) ? slotList(s.otherChallenges, 80, 3).map(tidyOwnerText) : undefined,
    ...(money ? { money } : {}),
    chips: [],
    facts,
    confidence: 58,
  };
}

export async function POST(request: NextRequest) {
  // Paid AI: signed-in accounts only, with a per-account limit.
  const guard = await requireAiSession("checkup-extract");
  if (guard.response) return guard.response;

  try {
    const body = (await request.json()) as {
      workspaceName?: string;
      country?: string;
      transcript?: TranscriptTurn[];
      slots?: SlotInput;
    };

    const workspaceName = (body.workspaceName ?? "Your business").slice(0, 120);
    const country = (body.country ?? "Nigeria").slice(0, 80);
    const slots: SlotInput = body.slots && typeof body.slots === "object" ? body.slots : {};
    const transcript = Array.isArray(body.transcript)
      ? body.transcript
          .filter((t) => t && typeof t.text === "string" && (t.role === "ai" || t.role === "user"))
          .map((t) => ({ role: t.role, text: t.text.slice(0, 1200) }))
          .slice(-36)
      : [];

    const base = factsFromSlots({ workspaceName, country, transcript, slots });

    const transcriptText = transcript.map((t) => `${t.role === "ai" ? "ASSISTANT" : "OWNER"}: ${t.text}`).join("\n");
    const raw = await completeText(SYSTEM, `Workspace name: ${workspaceName}\nCountry: ${country}\n\nConversation:\n${transcriptText}`, {
      maxTokens: 2600,
      profile: "fast",
      timeoutMs: 40_000,
    });

    const parsed = extractJson<Partial<BusinessFacts> & { ack?: string }>(raw);

    if (!parsed || typeof parsed !== "object") {
      // The model was unavailable — the confirmed interview answers still give a faithful model.
      return NextResponse.json({ ok: true, facts: base, degraded: true });
    }

    // Plain-words safety net over everything the owner will read back.
    const ownerText = transcript.filter((t) => t.role === "user").map((t) => t.text).join("\n");
    const plain = (v: unknown, cap: number) => {
      const t = typeof v === "string" ? plainify(v.trim(), ownerText).slice(0, cap) : "";
      return t.length > 0 && !/^null$/i.test(t) ? t : undefined;
    };
    // The interview's own answers decide what is a fact; the model only words them.
    const facts: BusinessFacts = mergeExtractedFacts({ base, parsed, slots, ownerText });

    return NextResponse.json({
      ok: true,
      facts,
      ack: typeof parsed.ack === "string" ? plain(parsed.ack, 300) ?? null : null,
      degraded: false,
    });
  } catch (error) {
    console.error("[api/checkup/extract] error:", error);
    return NextResponse.json({ ok: false, error: "Extraction failed" }, { status: 500 });
  }
}
