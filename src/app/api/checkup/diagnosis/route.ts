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
import { NEXT_STEP_RULES, NEXT_STEP_SCHEMA, cleanNextStep, templateNextStep, type NextStep } from "@/lib/coach";
import { HONESTY_RULES, I_VOICE } from "@/lib/ai-voice";
import { businessWords, type BusinessWords } from "@/lib/business-words";
import {
  detailLines,
  factsForChallenge,
  outsideNote,
  planOrder,
  stageOfText,
  templateOutsideDiagnosis,
  templateOutsideStep,
  type ChallengeDetails,
  type ChallengePlan,
  type ChallengeStage,
  type ChallengeStatus,
} from "@/lib/challenges";
import { getSession } from "@/lib/auth/session";
import { measuredContext } from "@/lib/connectors/summary";

export const runtime = "nodejs";

/**
 * The first diagnosis decides whether a new owner believes in the product.
 * It must (1) say something true they had not connected, (2) read their
 * numbers fairly, (3) show what fixing it is worth — from THEIR estimates,
 * computed in code, never invented — and (4) hand them help they can use today.
 */
const SYSTEM = `You are Nellovia, the owner's AI business consultant inside the Nellovia app. A small-business owner — often in Nigeria, often with no website — has just finished a short checkup. Write their FIRST DIAGNOSIS. It must make them think "this understands my business better than I expected", and give them something they can use today.

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
- Speak to the owner as "you". Warm, direct and confident — like a trusted consultant. Acknowledge what works before the gap.
- Never blame or scold ("you never…", "you fail to…", "you're losing them because you…"). Describe what happens and the opportunity: "People who go quiet after a price hear nothing more, so they drift away."
- Everyday words a market trader understands. NEVER use: signed, sign up, leads, prospects, conversion, convert, funnel, pipeline, CTR, traffic, visitors, acquisition, retention, churn, ROI, KPI, metrics, B2B, B2C, leverage, optimise.
- Do not assume they use spreadsheets, apps, a CRM or a website — a notebook or WhatsApp is fine.
- Do not mention their country unless it matters to the advice.
- Every sentence must be specific to THIS business. If a sentence would fit any business, rewrite it.

${I_VOICE}

${HONESTY_RULES}

5. ONE NEXT STEP — end with the single thing to do first, as an experiment (a small test that checks whether you read the cause right) or a recommendation (a proven fix). If CHECK-IN RESULTS are listed, build on them: never suggest again a step that was tried and ruled out, and say what it taught you.

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
  "nextStep": ${NEXT_STEP_SCHEMA},
  "confidence": 60
}
${NEXT_STEP_RULES}
- THE CHALLENGE TO DIAGNOSE, when given, is what this diagnosis is about: the headline speaks to it, in their terms. Use everything else they told you as background. Their OTHER CHALLENGES are already on their list for later — never diagnose them here, mention one only if it explains this one.
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

function templateTools(stage: FocusStage, w: BusinessWords): DiagnosisTool[] {
  switch (stage) {
    case "found":
      return [
        {
          kind: "message",
          title: "Ask a happy customer to pass your name on",
          when: "Send to your 3 happiest recent customers this week",
          body: w.goods
            ? "Hi [name], thank you for ordering from me — I hope you enjoyed it. If you know anyone who'd like something similar, I'd be grateful if you passed my number on. Thank you!"
            : "Hi [name], I really enjoyed working with you. If you know anyone who needs something similar, I'd be grateful if you passed my number on — I'll take good care of them. Thank you!",
        },
        {
          kind: "script",
          title: "Say what you do in one line",
          when: "Use it every time someone asks what you do",
          body: w.goods
            ? "I sell [what you sell] for [the kind of customer you serve best] — [what makes yours different]. Most of my customers come from people who already buy from me."
            : "I help [the kind of customer you serve best] get [the result they want] — quickly and without stress. Most of my work comes from people my customers recommend.",
        },
        {
          kind: "offer",
          title: "A simple thank-you for referrals",
          when: `Mention it once to every customer after their ${w.sale}`,
          body: `Anyone who sends me a new customer gets [a small thank-you — something off their next ${w.sale}, or a free extra].\nTell customers once, by message, right after their ${w.sale}.`,
        },
      ];
    case "enquire":
      return [
        {
          kind: "message",
          title: "Make it easy to get in touch",
          when: "Put it where people already see you — status, shop sign, flyers",
          body: w.goods
            ? "Looking for [what you sell]? Send me a message with what you'd like and when you need it — I reply the same day with options and prices."
            : "Need [what you do]? Send me a message with what you need and roughly when — I reply the same day with options and prices.",
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
          title: w.goods ? "Raise prices for new orders" : "Raise prices for new work",
          when: "Send to new enquiries and regular customers",
          body: w.goods
            ? "Hi [name], a quick note: from [date], my prices will be [new price]. Anything ordered before then stays at today's price — so if you've been planning an order, now is a good time."
            : "Hi [name], a quick note: from [date], my prices for new work will be [new price]. Anything booked before then stays at today's price — so if you've been planning something, now is a good time.",
        },
        {
          kind: "script",
          title: "Say \"not yet\" without losing the customer",
          when: "When you're fully booked",
          body: w.goods
            ? "I'd love to make this for you, and I want it to be right. The earliest I can have it ready is [date] — shall I put you down for it?"
            : "I'd love to do this, and I want to give it proper attention. My next free slot is [date] — shall I hold it for you?",
        },
        {
          kind: "offer",
          title: w.goods ? "Charge more for rush orders" : "Charge more for urgent work",
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
          body: w.goods
            ? "Hi [name], it's been a while since your last order — I hope you enjoyed it. If there's anything you'd like now, I'd be glad to help."
            : "Hi [name], it's been a while since we worked together — I hope everything is still going well. If there's anything you need now, I'd be glad to help.",
        },
        {
          kind: "script",
          title: "Ask for a referral at the right moment",
          when: "Right after a customer says they're happy",
          body: "I'm really glad you're happy with it. Who else do you know who might like something like this? I'd take good care of them.",
        },
        {
          kind: "offer",
          title: "A follow-on offer for past customers",
          when: "Send with your check-in message",
          body: w.goods
            ? "For past customers this month: [something they'd like next] with [a small discount or free extra]."
            : "For past customers this month: [a useful next service] with [a small discount or free extra].",
        },
      ];
    case "convert":
    default:
      return [
        {
          kind: "message",
          title: "For people who went quiet after your price",
          when: "Send to the last 3 people who didn't reply",
          body: w.goods
            ? "Hi [name], thanks again for asking. If the price was the worry, I can suggest a smaller or simpler option that fits your budget — or hold your order with a deposit. Would either of those help?"
            : "Hi [name], thanks again for asking about the work. I know paying it all at once can feel like a lot — I can split it into 2 or 3 payments, or start with a simpler version and add more later. Would either of those work for you?",
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
          when: `Use it the next time someone asks for a ${w.quote}`,
          body: w.goods
            ? "Small — [what's included] — [lower price]\nRegular — what most customers choose — [your usual price]\nLarge or special — [what's extra] — [higher price]"
            : "Basic — the essentials, done well — [lower price]\nStandard — what most customers choose — [your usual price]\nFull — everything, plus extra support — [higher price]\nPay in 2 or 3 parts if that helps.",
        },
      ];
  }
}

function templateSteps(stage: FocusStage, facts: BusinessFacts, w: BusinessWords): string[] {
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
      return ["Write down where your hours go for one week", w.goods ? "Raise prices for new orders" : "Raise prices for new work", "Hand one repeated task to someone else or a template"];
    case "return":
      return ["Message 5 past customers to check in", "Ask happy customers who else might like what you offer", w.goods ? "Offer past customers something new to try" : "Offer past customers a simple follow-on service"];
    case "convert":
    default:
      return [
        PRICE_RE.test(facts.bottleneck ?? "") ? "Message the last 3 people who went quiet after your price" : "Follow up once with everyone who goes quiet",
        w.goods ? "Offer three sizes or options instead of one price" : "Put three options on your next quote instead of one price",
        "Note what each person says when they don't go ahead",
      ];
  }
}

function templateDiagnosis(facts: BusinessFacts, cur: string, tried: string[] = [], stageOverride?: FocusStage): DiagnosisContent {
  const stage = stageOverride ?? inferStage(facts);
  const w = businessWords(facts);
  const ratio = parseCloseRate(facts.closeRate);
  const channels = facts.channels.length ? facts.channels.join(", ").toLowerCase() : "the places people find you";
  const referrals = /referr|word of mouth|recommend|friend/i.test(channels);
  const priceIssue = PRICE_RE.test(facts.bottleneck ?? "");
  const broad = isBroadMarket(facts.customers) || isBroadMarket(facts.whatTheySell);
  const noFollowUp = NO_FOLLOW_RE.test(`${facts.followUp ?? ""} ${facts.bottleneck ?? ""}`);
  // "your work" for a service, "what you sell" for goods — said the way the owner would.
  const Offer = w.offer[0].toUpperCase() + w.offer.slice(1);

  const headlineByStage: Record<FocusStage, string> = {
    convert: priceIssue
      ? `People like ${w.offer} — the price is where you lose them`
      : `People ask about ${w.offer} — most of them drift away before they pay`,
    found: `${Offer} sells once people find you — too few of the right people find you yet`,
    enquire: "People know about you, but too few of them get in touch",
    deliver: "You have more demand than time — your prices and process are the lever now",
    return: "Your next growth is in customers who already trust you",
  };

  let insight: string;
  if (broad && priceIssue) {
    insight = "You serve almost anyone, so people compare your price with the cheapest option they know — not with what you would actually give them.";
  } else if (noFollowUp && stage === "convert") {
    insight = "People who go quiet after hearing a price are often still deciding — and right now nobody nudges them, so the quiet ones never come back.";
  } else if (referrals && stage === "found") {
    insight = `Most of your ${w.sale}s come through people who already know you. That is great for trust, but it caps how many new people ever hear about you.`;
  } else if (ratio && ratio.won / ratio.of >= 0.3 && stage === "convert") {
    insight = `Winning ${ratioText(ratio)} people who ask is a decent base — the gain is in the ones who were almost ready and simply drifted off.`;
  } else {
    // The default must agree with the stage (a "getting found" read can't say "not from finding more people").
    const defaults: Record<FocusStage, string> = {
      convert: "The fastest growth usually comes from fixing the step where people already drop off — not from finding more people.",
      found: "People who find you tend to buy — the gap is how few of the right people hear about you each week.",
      enquire: "Interest that never turns into a message or a visit is invisible — a clear, easy way to reach you catches it.",
      deliver: "When you're already stretched, more customers can make things worse — price and process are the levers now.",
      return: "Past customers already trust you — a reason and a reminder to come back is the cheapest growth there is.",
    };
    insight = defaults[stage];
  }

  const working = referrals
    ? `People recommend you — that only happens when ${w.offer} is good.`
    : ratio && ratio.won / ratio.of >= 0.4
      ? `You already win ${ratioText(ratio)} people who ask — a solid base.`
      : "You know exactly where it feels stuck — that is the first step to fixing it.";

  const said: string[] = [];
  if (priceIssue) said.push("people often go quiet once they hear the price");
  else if (facts.bottleneck) said.push(`growth feels stuck at "${facts.bottleneck}"`);
  if (ratio) said.push(`about ${ratioText(ratio)} people who ask go on to pay`);
  if (facts.channels.length) said.push(`most customers come through ${channels}`);
  const story = said.length
    ? `You told me ${said.slice(0, 2).join(", and ")}. That points to ${FOCUS_STAGES.find((s) => s.id === stage)?.label.toLowerCase() ?? "one step"} as the place to focus first.`
    : `You told me most of your customers come through ${channels}. That points to one clear place to focus first.`;

  const stake = computeStake(facts, cur, stage);

  const meaningByStage: Record<FocusStage, string> = {
    convert: priceIssue
      ? "People are interested enough to ask, so finding customers is not your main problem. The drop happens when a single price lands without anything to compare it to, and with no easy way to say yes. Options, a smaller starting choice and one friendly follow-up usually change that."
      : "People already find you and ask, so demand is not your main problem. Most of the lost growth happens after the first conversation — slow replies, prices with no follow-up, or an unclear next step.",
    found: `When most customers come through ${channels}, new business depends on how often other people mention you. That is steady but hard to grow on purpose, so quiet months are hard to predict.`,
    enquire: "Interest that never turns into a message or a call is invisible, so it is easy to miss. A clear way to reach you and a simple next step usually close this gap.",
    deliver: w.goods
      ? "When you are already stretched, more orders can hurt: slower replies, rushed orders and missed chances. The fix is usually price, time or process rather than marketing."
      : "When you are already stretched, more enquiries can hurt: slower replies, rushed work and missed chances. The fix is usually price, time or process rather than marketing.",
    return: "Past customers already trust you, so they are the easiest source of new sales. Without a simple habit of staying in touch, that trust fades quietly.",
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
        ? `Start with the people who already said no or went quiet — they know you, they wanted ${w.offer}, and one friendly message costs nothing.`
        : stage === "found"
          ? "Start with your happiest customers — one message asking them to pass your name on is the cheapest new customer you will ever get."
          : "Start with the one change below that takes the least time — then watch what happens over the next two weeks.",
    steps: templateSteps(stage, facts, w),
    tools: templateTools(stage, w),
    stake,
    deltas: directionDeltas(facts),
    confidence: facts.bottleneck || facts.closeRate ? 58 : 48,
    focusStage: stage,
    nextStep: templateNextStep(stage, facts, tried),
  };
}

/**
 * When the app moved the first focus (e.g. "getting more people to ask" before "winning them"),
 * a first step that plainly works on another stage is swapped for the ready-made one for the
 * agreed focus — the order the owner was shown must be the order they're coached in.
 */
function onAgreedFocus(step: NextStep, strictStage: FocusStage | null, fallback: () => NextStep): NextStep {
  if (!strictStage) return step;
  const said = stageOfText(`${step.title} ${step.why}`);
  return said && said !== "outside" && said !== strictStage ? fallback() : step;
}

/** A model next step with an untraceable figure falls back to the ready-made one. */
function groundedNextStep(raw: unknown, fallback: NextStep, allowed: AllowedNumbers, ownerText: string): NextStep {
  const step = cleanNextStep(raw, fallback, (t, cap) => cleanText(t, cap, ownerText));
  if (step === fallback) return fallback;
  const text = [step.title, step.why, ...step.how, step.measure ?? "", step.countHow ?? ""].join(" ");
  return ungroundedNumbers(text, allowed).length === 0 ? step : fallback;
}

/* ------------------------------------------------------------------ */
/* Model output → clean, validated diagnosis                            */
/* ------------------------------------------------------------------ */

/** Extra rules when the challenge is something the app can't see (cash flow, staff, rent, costs…). */
const OUTSIDE_RULES = `THIS CHALLENGE IS OUTSIDE WHAT Nellovia CAN MEASURE (it happens away from the app — e.g. cash flow, staff, rent, costs, suppliers, equipment).
- Be honest about that once, plainly, in "meaning": the app can't see it, so any number is one they count themselves.
- Still be genuinely useful: practical, low-risk help that fits THIS business. Where it touches their customers or sales, say how.
- No "What fixing it is worth" claims. nextStep: a "recommendation" they can count themselves (unit "count"), never a promise.
- tools: only ones that truly help with this (a message to send, what to say); otherwise fewer is fine.
- focusStage: the stage it touches most ("deliver" if none).`;

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
  nextStep?: unknown;
}

interface ChallengeInput {
  id: string;
  title: string;
  main: boolean;
  stage: ChallengeStage;
  status: ChallengeStatus;
  source: "onboarding" | "reported" | "ask" | "check-in";
  details?: ChallengeDetails;
}

const STAGE_IDS: ChallengeStage[] = [...FOCUS_STAGES.map((s) => s.id), "outside"];

function cleanChallenge(raw: unknown): ChallengeInput | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id.slice(0, 60) : "";
  const title = typeof o.title === "string" ? o.title.replace(/\s+/g, " ").trim().slice(0, 170) : "";
  if (!id || title.length < 2) return null;
  const stage = STAGE_IDS.includes(o.stage as ChallengeStage) ? (o.stage as ChallengeStage) : stageOfText(title) ?? "found";
  const status = (["working", "up-next", "solved", "stopped", "no-longer"] as const).find((s) => s === o.status) ?? "up-next";
  const source = (["onboarding", "reported", "ask", "check-in"] as const).find((s) => s === o.source) ?? "reported";
  const d = o.details && typeof o.details === "object" ? (o.details as ChallengeDetails) : undefined;
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 300) : undefined);
  const details: ChallengeDetails | undefined = d
    ? {
        what: text(d.what),
        since: text(d.since),
        often: text(d.often),
        tried: text(d.tried),
        theory: text(d.theory),
        extra: Array.isArray(d.extra)
          ? d.extra
              .filter((e) => e && typeof e.question === "string" && typeof e.answer === "string")
              .map((e) => ({ key: String(e.key ?? "").slice(0, 30), question: e.question.slice(0, 200), answer: e.answer.slice(0, 300) }))
              .slice(0, 2)
          : undefined,
      }
    : undefined;
  return { id, title, stage, status, source, main: o.main === true, details };
}

const GIVES_UP = /insufficient|not enough (information|data|signal)|cannot (tell|determine)|can't (tell|determine)|unable to (diagnose|determine)/i;

function cleanText(v: unknown, cap: number, ownerText: string): string {
  return toSecondPerson(plainify(String(v ?? "").replace(/\s+/g, " ").trim(), ownerText)).slice(0, cap);
}

function cleanTools(raw: unknown, stage: FocusStage, ownerText: string, w: BusinessWords, fill = true): DiagnosisTool[] {
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
  // Outside what the app measures: only the help the model wrote for it (no stage templates).
  if (!fill) return kinds.map((k) => fromModel.find((t) => t.kind === k)).filter((t): t is DiagnosisTool => Boolean(t));
  // One of each kind; any kind the model missed comes from the template set.
  const template = templateTools(stage, w);
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
      /** What earlier check-ins taught us (oldest first). */
      learnings?: string[];
      /** Titles of steps already tried — never suggested again. */
      tried?: string[];
      /** The challenge to diagnose (default: the checkup's "where it feels stuck"). */
      challenge?: unknown;
      /** Their other challenges — for the order, and so this diagnosis stays on its own challenge. */
      others?: unknown[];
      /** First diagnosis with several challenges: choose which one comes first, and why. */
      chooseFocus?: boolean;
      /** Two steps didn't move it: look for a different cause. */
      rethink?: boolean;
    };

    const rawFacts = body.facts;
    if (!rawFacts || !rawFacts.trends) {
      return NextResponse.json({ ok: false, error: "Missing checkup facts" }, { status: 400 });
    }

    // Which challenge this diagnosis is about. With several and none started yet,
    // the app chooses which comes first from the owner's own answers (one that
    // blocks the others first, otherwise the one they said feels hardest).
    const asked = cleanChallenge(body.challenge);
    const all = [
      ...(asked ? [asked] : []),
      ...(Array.isArray(body.others) ? body.others : []).map(cleanChallenge).filter((c): c is ChallengeInput => c !== null && c.id !== asked?.id),
    ].slice(0, 10);
    let target = asked;
    let plan: ChallengePlan | null = null;
    if (body.chooseFocus && asked) {
      const open = all.filter((c) => c.status === "working" || c.status === "up-next");
      if (open.length > 1) {
        plan = planOrder(rawFacts, open, asked.id);
        target = open.find((c) => c.id === plan!.focusId) ?? asked;
      }
    }
    const otherOpen = all.filter((c) => c.id !== target?.id && (c.status === "working" || c.status === "up-next"));
    const outside = target?.stage === "outside";
    // When the app moved the first focus away from the problem the owner named, the diagnosis
    // must follow that order (it may not wander back to the other problem). Otherwise the
    // challenge's place in the journey is a strong hint the model may overrule from its answers.
    const strictStage: FocusStage | null = target && !outside && plan && plan.focusId === target.id && plan.focusId !== asked?.id ? (target.stage as FocusStage) : null;
    const stageHint: FocusStage | null = target && !outside ? (target.stage as FocusStage) : null;
    // "What it's worth" is worked out from people who ask — it doesn't fit capacity or things the app can't see.
    const noStake = outside || stageHint === "deliver";
    // The facts as they apply to this challenge (its words as "where it feels stuck", its own view of the cause).
    const facts: BusinessFacts = target ? factsForChallenge(rawFacts, target, target.status === "working" && target.source === "onboarding") : rawFacts;

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

    const learnings = Array.isArray(body.learnings)
      ? body.learnings.filter((l): l is string => typeof l === "string" && l.trim().length > 0).map((l) => l.slice(0, 240)).slice(-8)
      : [];
    const tried = Array.isArray(body.tried) ? body.tried.filter((t): t is string => typeof t === "string").slice(0, 12) : [];
    // Nothing to work out in money for things the app can't measure (or for capacity).
    const computed = noStake ? [] : stakeLinesForPrompt(facts, cur);
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
    const session = await getSession().catch(() => null);
    const connected = session?.workspaceName === name
      ? await measuredContext(session.userId, session.workspaceId)
      : "";
    const prompt = [
      target
        ? `THIS DIAGNOSIS IS ABOUT ONE CHALLENGE: "${target.title}" (in the owner's words). The headline must name THIS problem in their terms.${
            strictStage
              ? ` focusStage must be "${strictStage}". Rule 1c's exception does not apply — the owner already agreed to work on this one now.`
              : stageHint
                ? ` focusStage is most likely "${stageHint}" — choose another only if what they told you about THIS challenge clearly points elsewhere.`
                : ""
          }\n`
        : "",
      "FACTS FROM THE CHECKUP (the owner's own answers):",
      JSON.stringify(userPayload, null, 2),
      "",
      computed.length
        ? `COMPUTED FROM THEIR OWN ESTIMATES (you may quote these exactly; do not change them or add other numbers):\n${computed.map((c) => `- ${c}`).join("\n")}`
        : "COMPUTED: none — they did not give enough numbers. Use no figures at all.",
      connected ? `\n${connected}` : "",
      ownerText ? `\nTHE OWNER'S OWN WORDS IN THE CHECKUP (for tone and specifics):\n${ownerText}` : "",
      learnings.length ? `\nCHECK-IN RESULTS SO FAR (oldest first — what they tried and what happened):\n${learnings.map((l) => `- ${l}`).join("\n")}` : "",
      tried.length ? `\nSTEPS ALREADY TRIED (do not suggest these again): ${tried.join("; ")}` : "",
      target ? `\nTHE CHALLENGE TO DIAGNOSE (in the owner's words): "${target.title}"` : "",
      target && detailLines(target.details).length ? `WHAT THEY TOLD US ABOUT THIS CHALLENGE:\n${detailLines(target.details).join("\n")}` : "",
      plan && otherOpen.length ? `WHY THIS ONE COMES FIRST (decided from their own answers — the diagnosis must agree with it): ${plan.whyFirst}` : "",
      otherOpen.length ? `THEIR OTHER CHALLENGES (already on their list for later — do NOT diagnose them):\n${otherOpen.map((c) => `- ${c.title}`).join("\n")}` : "",
      outside ? `\n${OUTSIDE_RULES}` : "",
      body.rethink
        ? "\nTWO STEPS HAVE NOT MOVED THIS CHALLENGE (see STEPS ALREADY TRIED and CHECK-IN RESULTS). Say so plainly and kindly in the story, and look for a DIFFERENT cause than those steps assumed — never more of the same."
        : "",
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
      if (!reason && strictStage && parsed?.focusStage !== strictStage) {
        reason = `it is about a different problem — this diagnosis must be about "${target!.title}" (focusStage "${strictStage}")`;
      }
      const norm = (x: string) => x.toLowerCase().replace(/…\s*$/, "").replace(/[^a-z0-9]+/g, " ").trim();
      const echoes = (h: string) => {
        const t = norm(target!.title);
        const w = norm(target!.details?.what ?? "");
        const n = norm(h);
        return n === t || (t.length > 20 && n.startsWith(t)) || (w.length > 0 && (n === w || (w.length > 20 && n.startsWith(w))));
      };
      if (!reason && target && parsed?.headline && echoes(String(parsed.headline))) {
        reason = "the headline only repeats the challenge — say what is really going on, in their terms";
      }
    }

    // Why this challenge comes first: the app's reason, traced to their answers (a model's
    // rewording has turned the reason upside down before, so it is never used for this).
    const planOut = (): ChallengePlan | null => plan;
    const fallbackDiagnosis = (): DiagnosisContent => {
      if (outside && target) return { ...templateOutsideDiagnosis(target), meaning: outsideNote(target.title) };
      // The ready-made read for THIS challenge's place in the journey (not one inferred from other answers).
      const t = templateDiagnosis(facts, cur, tried, stageHint ?? undefined);
      return noStake || t.focusStage === "deliver" ? { ...t, stake: null } : t;
    };

    // Untraceable figures after a retry: drop those sentences rather than the whole read.
    // (Still about another problem after a retry: the ready-made read for this challenge instead.)
    const onlyFigures = Boolean(reason && reason.startsWith("it used figures"));
    if (!parsed || (reason && !onlyFigures)) {
      return NextResponse.json({ ok: true, diagnosis: { ...fallbackDiagnosis(), checked: true }, plan: planOut(), degraded: true });
    }
    const grounded = (s: unknown) => (onlyFigures ? dropUngroundedSentences(String(s ?? ""), allowed) : String(s ?? ""));

    const stage: FocusStage = FOCUS_STAGES.some((st) => st.id === parsed!.focusStage) ? (parsed.focusStage as FocusStage) : inferStage(facts);
    const steps = Array.isArray(parsed.steps)
      ? parsed.steps
          .filter((x): x is string => typeof x === "string" && x.trim().length > 0 && ungroundedNumbers(x, allowed).length === 0)
          .map((x) => cleanText(x, 120, ownerText))
          .slice(0, 3)
      : [];
    const template = fallbackDiagnosis();
    // A tool whose words carry an untraceable figure is swapped for the stage template.
    const words = businessWords(facts);
    const tools = cleanTools(parsed.tools, stage, ownerText, words, !outside).map((t) =>
      outside || (ungroundedNumbers(t.body, allowed, { priceRange }).length === 0 && ungroundedNumbers(t.title, allowed).length === 0)
        ? t
        : templateTools(stage, words).find((x) => x.kind === t.kind) ?? t,
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
      steps: steps.length >= 2 ? steps : outside ? template.steps : templateSteps(stage, facts, words),
      // Outside what the app measures: help with an untraceable figure is dropped, not swapped for a stage template.
      tools: outside ? tools.filter((t) => ungroundedNumbers(`${t.title} ${t.body}`, allowed, { priceRange }).length === 0) : tools,
      stake: noStake || stage === "deliver" ? null : computeStake(facts, cur, stage),
      nextStep: onAgreedFocus(
        groundedNextStep(parsed.nextStep, outside && target ? templateOutsideStep(target.title) : templateNextStep(stage, facts, tried), allowed, ownerText),
        strictStage,
        () => templateNextStep(strictStage ?? stage, facts, tried),
      ),
      checked: true,
    };

    return NextResponse.json({ ok: true, diagnosis, plan: planOut(), degraded: false });
  } catch (error) {
    console.error("[api/checkup/diagnosis] error:", error);
    return NextResponse.json({ ok: false, error: "Diagnosis generation failed" }, { status: 500 });
  }
}
