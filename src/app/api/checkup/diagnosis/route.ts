import { NextRequest, NextResponse } from "next/server";
import { completeText } from "@/lib/ai";
import {
  extractJson,
  clampPercent,
  DIAGNOSIS_VERSION,
  type BusinessFacts,
  type DiagnosisContent,
  type DiagnosisDelta,
  type DiagnosisTool,
  type FocusStage,
  FOCUS_STAGES,
  type TrendDirection,
} from "@/lib/checkup";
import { computeStake, currencySymbol, isBroadMarket, parseAmount, parseCloseRate, plainify, ratioText, stakeLinesForPrompt } from "@/lib/checkup-math";
import { collectAllowedNumbers, dropUngroundedSentences, ungroundedNumbers, type AllowedNumbers } from "@/lib/grounding";

export const runtime = "nodejs";

/**
 * The first diagnosis decides whether a new owner believes in the product.
 * It must (1) say something true they had not connected, (2) read their
 * numbers fairly, (3) show what fixing it is worth — from THEIR estimates,
 * computed in code, never invented — and (4) hand them help they can use today.
 */
const SYSTEM = `You are the senior growth analyst inside bizzGrowth. A small-business owner — often in Nigeria, often with no website — has just finished a short checkup. Write their FIRST DIAGNOSIS. It must make them think "this understands my business better than I expected", and give them something they can use today.

You only know what they told you (the facts below) plus COMPUTED figures worked out in code from their own estimates.

WHAT MAKES IT WORTH PAYING FOR
1. INSIGHT — say one true thing they have probably NOT connected themselves, by linking two of their answers. Never just repeat their complaint back to them in different words. Patterns experienced consultants look for — use one ONLY if their answers support it:
   - They serve "everyone" → buyers compare them with the cheapest option they know, so the price feels high before the value is clear.
   - They don't check back after giving a price → people who were still deciding go quiet and never return.
   - One single price → the buyer's only choice is yes or no; options turn it into "which one".
   - The price comes before the buyer understands what they get → it feels expensive by default.
   - All work comes from referrals → people arrive trusting them, but the number of new people is capped.
   - Busy owner, slow replies → people who asked buy from whoever answered first.
   - Plenty of people ask but few pay → the problem is after the first conversation, not finding people.
   - Orders come in waves (some months full, some empty) and people buy for occasions (birthdays, weddings, holidays, office events, school terms) → those occasions come round again, but past customers are never reminded, so every quiet month starts from zero.
   - Few customers come back → every month starts from zero; giving people a reason and a reminder to return is the cheapest growth there is.
1b. THE OWNER'S OWN VIEW — if they told you what they think is causing it, take it seriously and address it by name: confirm it when their other answers support it and build on it, or — gently and with a reason from their own answers — show what else is likely going on ("You mentioned others charge less. That may be part of it, but people who never saw your past work have no way to compare the quality, so…"). Never ignore it.
1c. ANSWER THE PROBLEM THEY NAMED — the headline must speak to what they said feels hardest (whereGrowthFeelsStuck), using their own view when their answers support it. Only lead with a different problem if their answers clearly show it matters more — and then say in the story why that is the better place to start.
2. A FAIR READ OF THEIR NUMBERS — winning about half of the people who ask is strong; 3-4 out of 10 is a decent base for work that needs a quote or a price; 1 out of 10 or fewer is weak. If their rate is decent, SAY SO, and find the real lever (who is asking, how and when the price is given, follow-up, how many people ask).
3. STAKES — if COMPUTED figures are listed, you may quote them exactly as written, each figure at most once in the whole diagnosis. Never write any other number, percentage or amount about their business, and never do your own maths.
4. HELP THEY CAN USE TODAY — ready-to-use words in the owner's own voice: short, plain, friendly, ready to paste into WhatsApp, with [name] where a name goes. In the offer you may suggest prices inside their own typical job range; use a placeholder like [time] for anything else you do not know.

VOICE
- Speak to the owner as "you". Warm, direct and confident — like a trusted consultant who has seen many businesses like theirs. Acknowledge what works before the gap.
- Never blame or scold ("you never…", "you fail to…", "you're losing them because you…"). Describe what happens and the opportunity: "People who go quiet after a price hear nothing more, so they drift away."
- Everyday words a market trader understands. NEVER use: signed, sign up, leads, prospects, conversion, convert, funnel, pipeline, CTR, traffic, visitors, acquisition, retention, churn, ROI, KPI, metrics, B2B, B2C, leverage, optimise.
- Do not assume they use spreadsheets, apps, a CRM or a website — a notebook or WhatsApp is fine.
- Do not mention their country unless it matters to the advice.
- Every sentence must be specific to THIS business. If a sentence would fit any business, rewrite it.

Return ONLY valid JSON, no markdown:
{
  "headline": "max 90 chars — the main thing holding growth back, in their terms (what they sell, who they serve, or the exact moment they lose people). A statement, not a question.",
  "insight": "1-2 sentences — the connection they probably haven't made, linking two of their answers",
  "working": "1 short sentence — what is already working for them",
  "story": "2 sentences — why you think so, citing 2-3 specific things they told you",
  "meaning": "3 sentences — what is probably happening and why",
  "whyItMatters": "2 sentences — what it costs them if left alone (quote COMPUTED figures if listed)",
  "nextInvestigation": "1-2 sentences — the ONE thing to do first this week, and why it comes first",
  "focusStage": "found|enquire|convert|deliver|return",
  "steps": ["exactly 3 short actions for this week, each <= 90 chars, starting with a verb, specific to them"],
  "tools": [
    { "kind": "message", "title": "<= 60 chars", "when": "<= 80 chars: when to send it", "body": "the exact message, 2-5 short sentences" },
    { "kind": "script", "title": "<= 60 chars", "when": "<= 80 chars", "body": "what to say, 2-4 short sentences" },
    { "kind": "offer", "title": "<= 60 chars", "when": "<= 80 chars", "body": "a simple layout, one option per line" }
  ],
  "confidence": 60
}
- tools: exactly 3, one of each kind, matched to focusStage:
  convert → a message for people who went quiet after hearing the price; what to say when someone says it is too expensive; three options instead of one price (small / standard / full, and paying in parts).
  found → a message asking a happy customer to pass your name on; a one-line way to say what you do and for whom; a simple thank-you for referrals.
  enquire → a message that makes it easy to get in touch; the first reply to every new enquiry; a clear starting option.
  deliver → a message raising prices for new work; how to say "next month" without losing the customer; a priority option for urgent work.
  return → a check-in message to past customers; how to ask for a referral; a follow-on offer for past customers.
- confidence: integer 45-72 (self-reported answers, not measured data).`;

type Direction = "up" | "down" | "flat" | "unknown";

/** Headlines that fit any business — a diagnosis that returns one of these is rejected. */
const GENERIC_HEADLINES = [
  "your referrals bring interest — the gap is turning it into signed projects",
  "your referrals bring interest - the gap is turning it into signed projects",
  "enquiries are coming in — turning them into paying customers is the gap",
  "more people need to find you — that's the first lever to pull",
];

/**
 * Safety net for third-person slips ("their channels", "this business") —
 * the diagnosis always addresses the owner directly.
 */
function toSecondPerson(text: string): string {
  return text
    .replace(/(this|the) (service |ecommerce |online )?business/gi, (m) => (m[0] === m[0].toUpperCase() ? "Your business" : "your business"))
    .replace(/the owner's/gi, "your")
    .replace(/the owner/gi, "you")
    .replace(
      /([Tt])heir (business|channels?|goal|goals|acquisition|current|primary|clients?|customers?|enquiries|leads|revenue|sales|tracking|referrals|offer|services?|products?|pricing|team|website|follow-up|process|work)/g,
      (_m, t: string, w: string) => `${t === "T" ? "Your" : "your"} ${w}`,
    );
}

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
 * The owner's stated directions, mapped to words — never to invented
 * percentages. Marketing spend is only shown when the owner mentioned it.
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

/** Best-guess journey stage from the owner's own words — used when the model omits it. */
function inferStage(facts: BusinessFacts): FocusStage {
  // No room for more work: more customers is not the answer — price and process are.
  if (/\b(no|not really|full|can't|cannot|couldn't|could not|already busy|need help)\b/i.test(facts.capacity ?? "") && !/\b(yes|easily)\b/i.test(facts.capacity ?? "")) return "deliver";
  const b = `${facts.bottleneck ?? ""} ${facts.primaryGoal}`.toLowerCase();
  // Orders in waves: past customers who are never reminded, or not enough new people.
  if (/steady|season|some months|irregular|up and down|quiet months|slow months/.test(b)) {
    return /rarely|one-?off|\bno\b|few|not really/i.test(facts.repeat ?? "") || !facts.repeat ? "return" : "found";
  }
  if (/busy|capacity|no time|deliver|staff|overwhelm/.test(b)) return "deliver";
  if (/price|profit|margin|cheap|charge|expensive|pay/.test(b)) return "convert";
  if (/not enough enquir|more enquir|leads|visib|found|reach|awareness|not enough (people|customers)/.test(b)) return "found";
  if (/convert|close|turn|sale|quote|follow/.test(b)) return "convert";
  if (/repeat|return|retain|come back/.test(b)) return "return";
  const r = parseCloseRate(facts.closeRate);
  if (r && r.won / r.of < 0.5) return "convert";
  if (facts.trends.enquiries === "Increased" && facts.trends.customers !== "Increased") return "convert";
  return "found";
}

const PRICE_RE = /price|expensive|cost|afford|cheap|budget|pay/i;
const NO_FOLLOW_RE = /\b(don't|do not|dont|never|rarely|no|not)\b.*\b(check|follow|chase|call back|remind)|\bwon'?t hear from\b|\bgo quiet\b|\bdisappear/i;

/* ------------------------------------------------------------------ */
/* Ready-to-use help — the template set (also fills gaps in model output) */
/* ------------------------------------------------------------------ */

function templateTools(stage: FocusStage): DiagnosisTool[] {
  switch (stage) {
    case "found":
      return [
        {
          kind: "message",
          title: "Ask a happy customer to pass your name on",
          when: "Send to your 3 happiest recent customers this week",
          body: "Hi [name], I really enjoyed working with you. If you know anyone who needs something similar, I'd be grateful if you passed my number on — I'll take good care of them. Thank you!",
        },
        {
          kind: "script",
          title: "Say what you do in one line",
          when: "Use it every time someone asks what you do",
          body: "I help [the kind of customer you serve best] get [the result they want] — quickly and without stress. Most of my work comes from people my customers recommend.",
        },
        {
          kind: "offer",
          title: "A simple thank-you for referrals",
          when: "Mention it once to every customer after a job",
          body: "Anyone who sends me a new customer gets [a small thank-you — a discount on their next job, or a free extra].\nTell customers once, by message, right after the job is done.",
        },
      ];
    case "enquire":
      return [
        {
          kind: "message",
          title: "Make it easy to get in touch",
          when: "Put it where people already see you — status, shop sign, flyers",
          body: "Need [what you do]? Send me a message with what you need and roughly when — I reply the same day with options and prices.",
        },
        {
          kind: "script",
          title: "Your first reply to every new enquiry",
          when: "Send within an hour of someone asking",
          body: "Thanks for reaching out! So I can help properly — what do you need, by when, and roughly what budget do you have in mind? I'll come back to you today.",
        },
        {
          kind: "offer",
          title: "A clear starting option",
          when: "Lead with it when people are unsure",
          body: "Starter — [what's included] — [price]\nMost people start here and add more later.",
        },
      ];
    case "deliver":
      return [
        {
          kind: "message",
          title: "Raise prices for new work",
          when: "Send to new enquiries and regular customers",
          body: "Hi [name], a quick note: from [date], my prices for new work will be [new price]. Anything booked before then stays at today's price — so if you've been planning something, now is a good time.",
        },
        {
          kind: "script",
          title: "Say \"next month\" without losing the customer",
          when: "When you're fully booked",
          body: "I'd love to do this, and I want to give it proper attention. My next free slot is [date] — shall I hold it for you?",
        },
        {
          kind: "offer",
          title: "Charge more for urgent work",
          when: "Offer it whenever someone needs it fast",
          body: "Standard — ready in [normal time] — [price]\nPriority — ready in [faster time] — [price + extra]",
        },
      ];
    case "return":
      return [
        {
          kind: "message",
          title: "Check in with past customers",
          when: "Send to 5 past customers this week",
          body: "Hi [name], it's been a while since we worked together — I hope everything is still going well. If there's anything you need now, I'd be glad to help.",
        },
        {
          kind: "script",
          title: "Ask for a referral at the right moment",
          when: "Right after a customer says they're happy",
          body: "I'm really glad you're happy with it. Who else do you know who might need something like this? I'd take good care of them.",
        },
        {
          kind: "offer",
          title: "A follow-on offer for past customers",
          when: "Send with your check-in message",
          body: "For past customers this month: [a useful next service] with [a small discount or free extra].",
        },
      ];
    case "convert":
    default:
      return [
        {
          kind: "message",
          title: "For people who went quiet after your price",
          when: "Send to the last 3 people who didn't reply",
          body: "Hi [name], thanks again for asking about the work. I know paying it all at once can feel like a lot — I can split it into 2 or 3 payments, or start with a simpler version and add more later. Would either of those work for you?",
        },
        {
          kind: "script",
          title: "When someone says it's too expensive",
          when: "Say it before they walk away",
          body: "I understand — it's a real cost. Can I ask roughly what you were hoping to spend? Then I'll show you what I can do within that, and what you'd get by going a little higher.",
        },
        {
          kind: "offer",
          title: "Give three options instead of one price",
          when: "Use it on your very next quote",
          body: "Basic — the essentials, done well — [lower price]\nStandard — what most customers choose — [your usual price]\nFull — everything, plus extra support — [higher price]\nPay in 2 or 3 parts if that helps.",
        },
      ];
  }
}

function templateSteps(stage: FocusStage, facts: BusinessFacts): string[] {
  switch (stage) {
    case "found":
      return [
        "Ask your 3 happiest customers to pass your name on",
        "Ask every new enquiry how they heard about you",
        `Show up one place every week where your best customers already are`,
      ];
    case "enquire":
      return ["Make your number and next step obvious everywhere people see you", "Reply to every enquiry the same day", "Count how many people get in touch each week"];
    case "deliver":
      return ["Write down where your hours go for one week", "Raise prices for new work", "Hand one repeated task to someone else or a template"];
    case "return":
      return ["Message 5 past customers to check in", "Ask happy customers who else might need you", "Offer past customers a simple follow-on service"];
    case "convert":
    default:
      return [
        PRICE_RE.test(facts.bottleneck ?? "") ? "Message the last 3 people who went quiet after your price" : "Follow up once with everyone who goes quiet",
        "Put three options on your next quote instead of one price",
        "Note what each person says when they don't go ahead",
      ];
  }
}

function templateDiagnosis(facts: BusinessFacts, cur: string): DiagnosisContent {
  const stage = inferStage(facts);
  const ratio = parseCloseRate(facts.closeRate);
  const channels = facts.channels.length ? facts.channels.join(", ").toLowerCase() : "the places people find you";
  const referrals = /referr|word of mouth|recommend|friend/i.test(channels);
  const priceIssue = PRICE_RE.test(facts.bottleneck ?? "");
  const broad = isBroadMarket(facts.customers) || isBroadMarket(facts.whatTheySell);
  const noFollowUp = NO_FOLLOW_RE.test(`${facts.followUp ?? ""} ${facts.bottleneck ?? ""}`);

  const headlineByStage: Record<FocusStage, string> = {
    convert: priceIssue
      ? "People like your work — the price conversation is where you lose them"
      : "People ask about your work — most of them drift away before they pay",
    found: "Your work sells once people find you — too few of the right people find you yet",
    enquire: "People know about you, but too few of them get in touch",
    deliver: "You have more demand than time — your prices and process are the lever now",
    return: "Your next growth is in customers who already trust you",
  };

  let insight: string;
  if (broad && priceIssue) {
    insight = "You serve almost anyone, so people compare your price with the cheapest option they know — not with what you would actually do for them.";
  } else if (noFollowUp && stage === "convert") {
    insight = "People who go quiet after hearing a price are often still deciding — and right now nobody nudges them, so the quiet ones never come back.";
  } else if (referrals && stage === "found") {
    insight = "All your work comes through people who already know you. That is great for trust, but it caps how many new people ever hear about you.";
  } else if (ratio && ratio.won / ratio.of >= 0.3 && stage === "convert") {
    insight = `Winning ${ratioText(ratio)} people who ask is a decent base — the gain is in the ones who were almost ready and simply drifted off.`;
  } else {
    insight = "The fastest growth usually comes from fixing the step where people already drop off — not from finding more people.";
  }

  const working = referrals
    ? "People recommend you — that only happens when the work is good."
    : ratio && ratio.won / ratio.of >= 0.4
      ? `You already win ${ratioText(ratio)} people who ask — a solid base.`
      : "You know exactly where it feels stuck — that is the first step to fixing it.";

  const said: string[] = [];
  if (priceIssue) said.push("people often go quiet once they hear the price");
  else if (facts.bottleneck) said.push(`growth feels stuck at "${facts.bottleneck}"`);
  if (ratio) said.push(`about ${ratioText(ratio)} people who ask go on to pay`);
  if (facts.channels.length) said.push(`most work comes through ${channels}`);
  const story = said.length
    ? `You told us ${said.slice(0, 2).join(", and ")}. That points to ${FOCUS_STAGES.find((s) => s.id === stage)?.label.toLowerCase() ?? "one step"} as the place to focus first.`
    : `You told us most of your work comes through ${channels}. That points to one clear place to focus first.`;

  const stake = computeStake(facts, cur, stage);

  const meaningByStage: Record<FocusStage, string> = {
    convert: priceIssue
      ? "People are interested enough to ask, so finding customers is not your main problem. The drop happens when a single price lands without anything to compare it to, and with no easy way to say yes. Options, payment in parts and one friendly follow-up usually change that."
      : "People already find you and ask, so demand is not your main problem. Most of the lost growth happens after the first conversation — slow replies, quotes with no follow-up, or an unclear next step.",
    found: `When most work comes through ${channels}, new business depends on how often other people mention you. That is steady but hard to grow on purpose, so quiet months are hard to predict.`,
    enquire: "Interest that never turns into a message or a call is invisible, so it is easy to miss. A clear way to reach you and a simple next step usually close this gap.",
    deliver: "When you are already stretched, more enquiries can hurt: slower replies, rushed work and missed chances. The fix is usually price, time or process rather than marketing.",
    return: "Past customers already trust you, so they are the easiest source of new work. Without a simple habit of staying in touch, that trust fades quietly.",
  };

  return {
    version: DIAGNOSIS_VERSION,
    headline: headlineByStage[stage],
    insight,
    working,
    story,
    meaning: meaningByStage[stage],
    whyItMatters: stake
      ? `${stake.working[stake.working.length - 1]} Small changes at this one step are worth more than any amount of extra marketing.`
      : "Fixing the step where people already drop off grows the business without spending more to find new customers.",
    nextInvestigation:
      stage === "convert"
        ? "Start with the people who already said no or went quiet — they know you, they wanted the work, and one friendly message costs nothing."
        : stage === "found"
          ? "Start with your happiest customers — one message asking them to pass your name on is the cheapest new customer you will ever get."
          : "Start with the one change below that takes the least time — then watch what happens over the next two weeks.",
    steps: templateSteps(stage, facts),
    tools: templateTools(stage),
    stake,
    deltas: directionDeltas(facts),
    confidence: facts.bottleneck || facts.closeRate ? 58 : 48,
    focusStage: stage,
  };
}

/* ------------------------------------------------------------------ */
/* Model output → clean, validated diagnosis                            */
/* ------------------------------------------------------------------ */

interface ModelDiagnosis {
  headline?: string;
  insight?: string;
  working?: string;
  story?: string;
  meaning?: string;
  whyItMatters?: string;
  nextInvestigation?: string;
  confidence?: number;
  focusStage?: string;
  steps?: unknown;
  tools?: unknown;
}

const GIVES_UP = /insufficient|not enough (information|data|signal)|cannot (tell|determine)|can't (tell|determine)|unable to (diagnose|determine)/i;

function cleanText(v: unknown, cap: number, ownerText: string): string {
  return toSecondPerson(plainify(String(v ?? "").replace(/\s+/g, " ").trim(), ownerText)).slice(0, cap);
}

function cleanTools(raw: unknown, stage: FocusStage, ownerText: string): DiagnosisTool[] {
  const kinds: DiagnosisTool["kind"][] = ["message", "script", "offer"];
  const fromModel: DiagnosisTool[] = [];
  if (Array.isArray(raw)) {
    for (const t of raw) {
      if (!t || typeof t !== "object") continue;
      const o = t as Record<string, unknown>;
      const kind = kinds.find((k) => k === String(o.kind));
      const title = cleanText(o.title, 70, ownerText);
      const body = plainify(String(o.body ?? "").trim(), ownerText).slice(0, 700);
      if (!kind || title.length <= 3 || body.length <= 20) continue;
      fromModel.push({ kind, title, body, ...(o.when ? { when: cleanText(o.when, 100, ownerText) } : {}) });
    }
  }
  // One of each kind; any kind the model missed comes from the template set.
  const template = templateTools(stage);
  return kinds
    .map((k) => fromModel.find((t) => t.kind === k) ?? template.find((t) => t.kind === k))
    .filter((t): t is DiagnosisTool => Boolean(t));
}

/** The prose fields of a model diagnosis, for the grounding check. */
function proseOf(p: ModelDiagnosis): string[] {
  const steps = Array.isArray(p.steps) ? p.steps.filter((s): s is string => typeof s === "string") : [];
  return [p.headline, p.insight, p.working, p.story, p.meaning, p.whyItMatters, p.nextInvestigation, ...steps].map((s) => String(s ?? ""));
}

/** Why a model diagnosis is not good enough to show, or null when it is. */
function rejectReason(p: ModelDiagnosis | null, allowed: AllowedNumbers): string | null {
  if (!p) return "not valid JSON";
  if (!p.headline || !p.story || !p.meaning) return "missing headline, story or meaning";
  const h = String(p.headline).trim().toLowerCase();
  if (GENERIC_HEADLINES.includes(h) || /turning it into signed/.test(h)) return "the headline is generic — it would fit any business";
  if (GIVES_UP.test(String(p.headline)) || GIVES_UP.test(String(p.story))) return "it gave up instead of committing to a read";
  if (!p.insight || String(p.insight).trim().length < 30) return "missing a real insight";
  const invented = [...new Set(proseOf(p).flatMap((t) => ungroundedNumbers(t, allowed)))];
  if (invented.length) return `it used figures that are not in the facts or the COMPUTED lines (${invented.join(", ")}). Remove them, or use only the owner's own numbers and the COMPUTED lines`;
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      workspaceName?: string;
      country?: string;
      currency?: string;
      facts?: BusinessFacts;
      transcript?: { role?: string; text?: string }[];
    };

    const facts = body.facts;
    if (!facts || !facts.trends) {
      return NextResponse.json({ ok: false, error: "Missing checkup facts" }, { status: 400 });
    }

    const name = (body.workspaceName ?? "Your business").slice(0, 120);
    const cur = currencySymbol(body.currency);
    const country = (body.country ?? "Nigeria").slice(0, 80);
    const ownerText = Array.isArray(body.transcript)
      ? body.transcript
          .filter((t) => t && t.role === "user" && typeof t.text === "string")
          .map((t) => String(t.text))
          .join("\n")
          .slice(0, 4000)
      : "";

    const computed = stakeLinesForPrompt(facts, cur);
    const userPayload = {
      business: { name, country, currency: cur, type: facts.businessType },
      whatTheySell: facts.whatTheySell,
      whoTheyServe: facts.customers,
      primaryGoal: facts.primaryGoal,
      howPeopleFindThem: facts.channels,
      journey: facts.journey,
      whereGrowthFeelsStuck: facts.bottleneck ?? null,
      whatTheOwnerThinksIsCausingIt: facts.ownerTheory ?? null,
      outOfThePeopleWhoAskHowManyPay: facts.closeRate ?? null,
      howTheyHandleEnquiriesAndFollowUp: facts.followUp ?? null,
      typicalJobValue: facts.jobValue ?? null,
      peopleAskingPerMonth: facts.monthlyEnquiries ?? null,
      howTheyGiveThePrice: facts.pricePresentation ?? null,
      whatPeopleSayWhenTheyDontBuy: facts.lostReason ?? null,
      doNewPeopleSeePastWorkBeforeThePrice: facts.proof ?? null,
      couldTheyTakeOnMoreWork: facts.capacity ?? null,
      doPastCustomersComeBack: facts.repeat ?? null,
      statedTrends: facts.trends,
      recentChanges: facts.recentChanges,
    };
    const prompt = [
      "FACTS FROM THE CHECKUP (the owner's own answers):",
      JSON.stringify(userPayload, null, 2),
      "",
      computed.length
        ? `COMPUTED FROM THEIR OWN ESTIMATES (you may quote these exactly; do not change them or add other numbers):\n${computed.map((c) => `- ${c}`).join("\n")}`
        : "COMPUTED: none — they did not give enough numbers. Use no figures at all.",
      ownerText ? `\nTHE OWNER'S OWN WORDS IN THE CHECKUP (for tone and specifics):\n${ownerText}` : "",
    ].join("\n");

    // The only figures the diagnosis may use: the owner's answers and the computed lines.
    const allowed = collectAllowedNumbers(prompt, ownerText);
    const priceRange = parseAmount(facts.jobValue);

    let parsed: ModelDiagnosis | null = null;
    let reason: string | null = "not attempted";
    for (let attempt = 0; attempt < 2 && reason; attempt++) {
      const raw = await completeText(
        SYSTEM,
        attempt === 0 ? prompt : `${prompt}\n\nYOUR PREVIOUS ANSWER WAS REJECTED: ${reason}. Fix that and return the full JSON again.`,
        { maxTokens: 3500, profile: "quality" },
      );
      if (!raw) break; // every provider failed — no point retrying
      parsed = extractJson<ModelDiagnosis>(raw);
      reason = rejectReason(parsed, allowed);
    }

    // Untraceable figures after a retry: drop those sentences rather than the whole read.
    const onlyFigures = Boolean(reason && reason.startsWith("it used figures"));
    if (!parsed || (reason && !onlyFigures)) {
      return NextResponse.json({ ok: true, diagnosis: { ...templateDiagnosis(facts, cur), checked: true }, degraded: true });
    }
    const grounded = (s: unknown) => (onlyFigures ? dropUngroundedSentences(String(s ?? ""), allowed) : String(s ?? ""));

    const stage: FocusStage = FOCUS_STAGES.some((st) => st.id === parsed!.focusStage) ? (parsed.focusStage as FocusStage) : inferStage(facts);
    const steps = Array.isArray(parsed.steps)
      ? parsed.steps
          .filter((x): x is string => typeof x === "string" && x.trim().length > 0 && ungroundedNumbers(x, allowed).length === 0)
          .map((x) => cleanText(x, 120, ownerText))
          .slice(0, 3)
      : [];
    const template = templateDiagnosis(facts, cur);
    // A tool whose words carry an untraceable figure is swapped for the stage template.
    const tools = cleanTools(parsed.tools, stage, ownerText).map((t) =>
      ungroundedNumbers(t.body, allowed, { priceRange }).length === 0 && ungroundedNumbers(t.title, allowed).length === 0
        ? t
        : templateTools(stage).find((x) => x.kind === t.kind) ?? t,
    );

    // Figures and stage-matched tools are deterministic; the words are the model's.
    const headline = cleanText(grounded(parsed.headline), 120, ownerText);
    const diagnosis: DiagnosisContent = {
      version: DIAGNOSIS_VERSION,
      headline: headline || template.headline,
      insight: cleanText(grounded(parsed.insight), 360, ownerText) || template.insight,
      working: parsed.working ? cleanText(grounded(parsed.working), 200, ownerText) || undefined : undefined,
      story: cleanText(grounded(parsed.story), 420, ownerText) || template.story,
      deltas: directionDeltas(facts),
      meaning: cleanText(grounded(parsed.meaning), 600, ownerText) || template.meaning,
      whyItMatters: cleanText(grounded(parsed.whyItMatters ?? ""), 500, ownerText) || template.whyItMatters,
      nextInvestigation: cleanText(grounded(parsed.nextInvestigation ?? ""), 500, ownerText) || template.nextInvestigation,
      confidence: clampPercent(parsed.confidence, 40, 72, 58),
      focusStage: stage,
      steps: steps.length >= 2 ? steps : templateSteps(stage, facts),
      tools,
      stake: computeStake(facts, cur, stage),
      checked: true,
    };

    return NextResponse.json({ ok: true, diagnosis, degraded: false });
  } catch (error) {
    console.error("[api/checkup/diagnosis] error:", error);
    return NextResponse.json({ ok: false, error: "Diagnosis generation failed" }, { status: 500 });
  }
}
