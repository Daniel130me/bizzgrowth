import { NextRequest, NextResponse } from "next/server";
import { requireAiSession } from "@/lib/ai-route-guard";
import { completeText } from "@/lib/ai";
import {
  ASK_CAP,
  MIN_SIGNALS,
  MONEY_SLOTS,
  SIGNAL_SLOTS,
  SLOT_KEYS,
  SLOT_LABELS,
  depthSlotsFor,
  requiredSlotsFor,
  extractJson,
  emptySlots,
  type AskCounts,
  type CheckupPhase,
  type CheckupSlots,
  type ChatRead,
  type ChatTurnResult,
  type SlotKey,
  type TranscriptTurn,
  type TrendDirection,
} from "@/lib/checkup";
import { amountInFull, currencySymbol, isBareNumber, parseCloseRate, plainify, shorten, tidyOwnerText, wordsToDigits } from "@/lib/checkup-math";
import { amountFromOwner, classifyQuestion, countFromOwner, listenOnly, neutralReply, ownerSpokeOfChange, usableChip } from "@/lib/checkup-turn";
import { isMoneyTrouble, moneyClauses, speaksOfCosts } from "@/lib/checkup-money";
import { HONESTY_RULES, I_VOICE } from "@/lib/ai-voice";
import { businessKind, otherChallengeChips, parseOtherChallenges } from "@/lib/challenges";

export const runtime = "nodejs";

const TREND_VALUES: TrendDirection[] = ["Increased", "Decreased", "About the same", "Don't know"];

const READ_VALUES: ChatRead[] = ["answer", "correction", "partial", "dodge", "question", "other"];

const TREND_SLOT_KEYS: SlotKey[] = ["enquiries", "customers", "revenue"];

const TEXT_SLOT_KEYS = [
  "businessType",
  "sells",
  "targetMarket",
  "location",
  "goal",
  "bottleneck",
  "closeRate",
  "followUp",
  "jobValue",
  "monthlyEnquiries",
  "pricePresentation",
  "lostReason",
  "capacity",
  "proof",
  "repeat",
  "ownerTheory",
  "moneyDue",
  "otherDebts",
  "cashNow",
  "moneyInOut",
  "coverPlan",
  "pricesChanged",
  "platformFees",
  "owedFlex",
] as const satisfies readonly SlotKey[];

/** Hard cap on owner replies — generous, because depth beats speed for the diagnosis. */
const MAX_USER_TURNS = 18;

/**
 * Ready-made ANSWERS the owner can tap for each slot (never questions).
 * `{cur}` is replaced with the workspace currency symbol.
 */
const ANSWER_CHIPS: Record<SlotKey, string[]> = {
  businessType: ["I offer a service", "I sell products", "Both — products and services", "Not sure"],
  sells: ["A service I do for people", "Things I make or stock", "Food or drinks", "Not sure"],
  targetMarket: ["People in my area", "Other businesses", "Big companies", "Not sure"],
  location: ["Just my area", "Across the country", "Other countries too", "Skip this"],
  goal: ["More people asking to buy", "More of them actually buying", "Bigger orders or better prices", "Not sure"],
  channels: ["Word of mouth", "Walk-ins / my shop", "WhatsApp or phone", "Instagram or Facebook"],
  enquiries: ["More", "Fewer", "About the same", "Don't know"],
  customers: ["More", "Fewer", "About the same", "Don't know"],
  revenue: ["More money", "Less money", "About the same", "Don't know"],
  changes: ["Nothing major", "Changed my prices", "New way of finding customers", "Skip this"],
  bottleneck: ["Not enough people asking", "People ask but don't buy", "Too busy to take more work", "Not making enough profit"],
  closeRate: ["1 or 2 out of 10", "3 to 5 out of 10", "6 to 8 out of 10", "Not sure"],
  followUp: ["Same day, and I check back", "Same day, I don't check back", "Within a few days", "It varies a lot"],
  jobValue: ["Under {cur}50,000", "{cur}50,000 – {cur}200,000", "{cur}200,000 – {cur}1 million", "Over {cur}1 million"],
  monthlyEnquiries: ["1 to 5 a month", "6 to 15 a month", "16 to 40 a month", "More than 40"],
  pricePresentation: ["A quick price on WhatsApp", "After a call or a visit", "A written quote", "It's on a price list or menu"],
  lostReason: ["They say it's too expensive", "They just stop replying", "\"I'll get back to you\"", "They go with someone cheaper"],
  capacity: ["Yes, easily", "A bit more, not double", "No, I'm already full", "Only if I get help"],
  proof: ["Yes, photos or past work", "Only if they ask", "Not really", "Nothing to show yet"],
  repeat: ["Yes, many come back", "A few come back", "Rarely", "It's mostly one-off work"],
  ownerTheory: ["Prices — others charge less", "Not enough people know me", "Customers forget about me", "Not sure"],
  // Built per business from what the owner said (see chipsFor) — never a fixed list.
  otherChallenges: [],
  // Money trouble: amounts are typed, so these are the common short answers.
  moneyDue: [],
  otherDebts: ["Nothing else", "A loan repayment", "Money I owe a supplier", "Wages or bills too"],
  cashNow: ["Almost nothing", "Less than half of it", "About half of it", "Rather not say"],
  moneyInOut: ["Sales cover costs, with a bit left", "About break-even", "Costs are more than sales", "Not sure"],
  coverPlan: ["Borrow the rest", "Ask family or friends", "Sell something", "No plan yet"],
  pricesChanged: ["Raised them this year", "Over a year ago", "Never changed them", "Not sure"],
  platformFees: ["Yes, they take a cut", "No fees", "Not sure"],
  owedFlex: ["Yes, they've agreed before", "Never asked them", "They said no before", "Not sure"],
};

/** Smaller ranges for currencies whose typical job is not in the hundreds of thousands. */
const JOB_VALUE_CHIPS_SMALL = ["Under {cur}100", "{cur}100 – {cur}500", "{cur}500 – {cur}2,000", "Over {cur}2,000"];
/** Orders of food or goods from a shop are usually far smaller than service jobs (naira). */
const ORDER_VALUE_CHIPS_NGN = ["Under {cur}5,000", "{cur}5,000 – {cur}20,000", "{cur}20,000 – {cur}100,000", "Over {cur}100,000"];
/** Orders of food or goods in smaller currencies. */
const ORDER_VALUE_CHIPS_SMALL = ["Under {cur}20", "{cur}20 – {cur}100", "{cur}100 – {cur}500", "Over {cur}500"];

/** Likely causes offered as hints, matched to what the owner said is hard. */
function theoryChips(bottleneck?: string): string[] {
  const b = (bottleneck ?? "").toLowerCase();
  if (/price|expensive|cost|afford|pay|buy|quote|quiet|leave|commit/.test(b)) {
    return ["Others charge less", "They don't see the value yet", "They're just comparing prices", "Not sure"];
  }
  if (/steady|season|some months|irregular|up and down|quiet months|slow/.test(b)) {
    return ["It depends on the season", "I only promote when it's quiet", "People forget about me", "Not sure"];
  }
  if (/not enough|find|visib|reach|known|more (people|customers|clients)|enquir/.test(b)) {
    return ["Not many people know me yet", "I don't promote much", "Others are more visible", "Not sure"];
  }
  if (/busy|time|capacity|staff|overwhelm|too much/.test(b)) {
    return ["I do everything myself", "My prices are too low", "I take on too much", "Not sure"];
  }
  return ANSWER_CHIPS.ownerTheory;
}

function chipsFor(slot: SlotKey, cur: string, slots?: CheckupSlots): string[] {
  if (slot === "ownerTheory") return theoryChips(slots?.bottleneck);
  if (slot === "otherChallenges") {
    // Fitted to the kind of business they described, minus the problem they already named.
    return otherChallengeChips({
      businessType: slots?.businessType,
      sells: slots?.sells,
      targetMarket: slots?.targetMarket,
      channels: slots?.channels,
      bottleneck: slots?.bottleneck,
    });
  }
  // Food, shops and product sellers get order-sized ranges; services keep job-sized ones.
  const goods = slot === "jobValue" && ["food", "retail", "online", "product"].includes(businessKind({ businessType: slots?.businessType, sells: slots?.sells, targetMarket: slots?.targetMarket, channels: slots?.channels }));
  const base =
    slot === "jobValue"
      ? goods
        ? cur === "₦" ? ORDER_VALUE_CHIPS_NGN : ORDER_VALUE_CHIPS_SMALL
        : cur !== "₦" ? JOB_VALUE_CHIPS_SMALL : ANSWER_CHIPS.jobValue
      : ANSWER_CHIPS[slot];
  return base.map((c) => c.replaceAll("{cur}", cur));
}

/** Keep only chips that read as answers: drop anything phrased as a question, a fill-in template, or a figure they never gave. */
function answerChips(raw: unknown, slot: SlotKey | "none", cur: string, slots?: CheckupSlots, ownerText = ""): string[] {
  if (slot === "none") return [];
  const QUESTION_START = /^(who|what|which|where|when|why|how|do|does|did|is|are|can|could|would|should|tell me|describe|explain)\b/i;
  const money = (MONEY_SLOTS as string[]).includes(slot);
  let list = Array.isArray(raw)
    ? raw
        .filter((c): c is string => typeof c === "string")
        .map((c) => plainify(c.trim()).slice(0, 40))
        .filter((c) => c && !c.includes("?") && !QUESTION_START.test(c) && usableChip(c, { money, ownerText }))
        .slice(0, 4)
    : [];
  // Close-rate answers must carry both numbers, or the diagnosis cannot use them.
  if (slot === "closeRate") list = list.filter((c) => parseCloseRate(c) !== null || /not sure|skip|don't know/i.test(c));
  if (list.length >= 2) return list;
  return chipsFor(slot, cur, slots);
}

/**
 * Deterministic question variants per slot — used by the offline fallback and
 * whenever the model forgets to ask a question. `{cur}` = currency symbol.
 */
const QUESTION_VARIANTS: Record<SlotKey, string[]> = {
  businessType: [
    "Do you mainly do a service for people, or do you sell things — or a bit of both?",
    "Is your business more about doing work for customers, or selling them goods?",
  ],
  sells: [
    "What does your business sell or do, in your own words?",
    "What exactly do customers pay you for?",
    "If a friend asked what your business does, what would you tell them?",
  ],
  targetMarket: [
    "Who usually pays you — people nearby, other businesses, anyone in particular?",
    "Which kind of customer pays you best, or comes back most often?",
    "Tell me a bit about the kind of person who buys from you most.",
  ],
  location: [
    "Where is the business based, and which areas do your customers come from?",
    "Which town or area do you mostly serve?",
  ],
  goal: [
    "What is the one thing you would most like to get better in the business right now?",
    "If one thing could be better in three months, what would you pick?",
  ],
  channels: [
    "How do new customers usually hear about you or find you?",
    "How do people normally reach you — walk in, call, WhatsApp, a friend telling them?",
    "Where does most of your business come from?",
  ],
  enquiries: [
    "Compared with last month, are more people asking about what you sell, fewer, or about the same?",
    "Lately, are you getting more people asking to buy, fewer, or about the same?",
  ],
  customers: [
    "And people who actually bought from you — more than last month, fewer, or about the same?",
    "Are you getting more new customers who pay you, fewer, or about the same as before?",
  ],
  revenue: [
    "Only if you're comfortable — is the money coming in more than last month, less, or about the same?",
    "On the money side, a rough idea is enough: are sales up, down, or about the same?",
  ],
  changes: [
    "Has anything changed in the business recently — your prices, your staff, or how you find customers?",
    "Anything new lately — a price change, new staff, a new way of getting customers?",
  ],
  bottleneck: [
    "What feels hardest right now — getting enough people to ask, getting them to actually buy, or keeping up with demand?",
    "If you had to name the one thing holding the business back, what would it be?",
  ],
  closeRate: [
    "Out of every 10 people who ask about buying from you, roughly how many end up paying? A guess is fine.",
    "When 10 people ask about your price, about how many go ahead and pay?",
  ],
  followUp: [
    "When someone asks about buying, how quickly do you usually get back to them — and do you check back if they go quiet?",
    "What happens after someone asks — do you reply the same day, send a price, check back later?",
  ],
  jobValue: [
    "Roughly how much does one customer pay you for a typical job or order? A rough range is fine — or skip it.",
    "What does a typical job or order bring in, roughly? A rough range is perfectly fine.",
  ],
  monthlyEnquiries: [
    "In a normal month, roughly how many people ask about buying from you? A rough range is fine.",
    "About how many people get in touch to buy in a typical month — 5, 20, more?",
  ],
  pricePresentation: [
    "When someone asks, how do they usually get your price — a quick figure on WhatsApp, a price list, a written quote, or after a call or visit?",
    "How do you usually give your price — straight away, or after you've talked through what they need?",
  ],
  lostReason: [
    "When someone doesn't go ahead, what do they usually say — or do they just go quiet?",
    "The people who don't buy — what's the most common reason they give, if any?",
  ],
  capacity: [
    "If twice as many people paid you next month, could you keep up?",
    "Do you have room for more work right now, or are you already quite full?",
  ],
  proof: [
    "Before they hear your price, do people get to see examples — photos, past work or reviews?",
    "Do new people see photos, past work or reviews before they hear your price?",
  ],
  repeat: [
    "Do customers usually come back to you again, or is it mostly one-off work?",
    "How often do past customers order again or send someone new your way?",
  ],
  ownerTheory: [
    "What do you think is behind that? Anything you've noticed or tried — even small things — helps.",
    "Why do you think that happens? You know the business best, so any hunch is useful.",
  ],
  otherChallenges: [
    "Is anything else holding the business back right now? Tap any that apply — I'll keep them on your list, and let's take them one at a time.",
    "Apart from that, is anything else making growth hard at the moment? Tap any that apply, or tell me it's just the one.",
  ],
  moneyDue: [
    "What exactly is due, how much is it, and when is it due? This tells me how much time we have.",
    "How much do you have to pay, and by what date?",
  ],
  otherDebts: [
    "Is anything else due or owed in the next few weeks — a loan repayment, a supplier, wages, tax or a bill? How much, and when? This is how I see the whole week, not just one bill.",
    "Do you owe anyone else money right now, or have another payment coming soon?",
  ],
  cashNow: [
    "How much money does the business have right now to pay with — a rough figure is fine?",
    "Roughly how much cash do you have on hand today?",
  ],
  moneyInOut: [
    "In a normal day or week, roughly how much comes in from sales — and what are your main costs each month (stock, staff, power or fuel)? This shows whether the business covers its costs.",
    "What does a normal week bring in, and what are the biggest things you pay for each month?",
  ],
  coverPlan: [
    "How were you planning to cover the rest of it? Even a rough idea helps me check it's a safe way to do it.",
    "Where were you going to find the rest of the money?",
  ],
  pricesChanged: [
    "When did you last change your prices — and have your costs gone up since then?",
    "Have your prices stayed the same while your costs went up?",
  ],
  platformFees: [
    "Does any way you sell — an app, a platform or a card machine — take a fee or a cut? Roughly how much?",
    "Do the apps or platforms you sell through charge you a commission?",
  ],
  owedFlex: [
    "Has whoever you owe ever agreed to part payment or a payment plan before? That tells me how to ask them.",
    "Have they let you pay in parts before?",
  ],
};
const SYSTEM = `You are Nellovia, an AI business consultant inside the Nellovia app — experienced and friendly — having a SHORT first conversation (the business checkup) with a small-business owner. Many owners are in Nigeria and many have NO website or online presence. Warm, sharp, efficient, genuinely listening. You never sound like a survey, a form or a script.

GOAL
Gather what a first growth diagnosis needs — first the REQUIRED slots, then the DEPTH follow-ups the prompt lists. There is NO fixed order: each turn, pick what to ask from what the owner just said. Take the time you need (usually 8-12 owner replies): owners would much rather answer a few more questions than get a shallow diagnosis — but never ask anything that won't change the diagnosis.

WHAT EACH SLOT MEANS
- sells: what they sell or do. targetMarket: who pays them — the kind of customer. channels: how new customers find them.
- bottleneck: where growth feels stuck, in their words.
- ownerTheory: what THEY think is causing it — their own observations, things they have tried or checked, things that happen offline you cannot see (a cheaper competitor nearby, what customers say, a slow season). Ask it right after they tell you where it feels stuck. Ask directly ("What do you think is behind that?") or with gentle hints ("Is it the price itself, the timing, or something else you've noticed?"). Any hunch counts; "not sure" is fine.
- otherChallenges: anything ELSE holding the business back (up to 3). Asked ONCE, right after ownerTheory, when the prompt says ASK NEXT: otherChallenges — the app reads their answer and supplies the tap answers. NEVER ask follow-up questions about those other things and never diagnose them here; each one gets its own short chat later. Do not let them change what you ask about the main problem.
- closeRate: out of the people who ask about buying, how many go ahead and pay. Accept BOTH NUMBERS ("2 out of 5", "about 3 out of 10") or a clear word ("about half", "most of them", "very few") — never push for exact numbers after a clear word. A bare number like "2" is NOT an answer — ask "2 out of how many people who ask?". NEVER assume "out of 10".
- monthlyEnquiries: roughly how many people ask about buying in a normal month (a range is fine, e.g. "6 to 15").
- jobValue: roughly what one customer pays for a typical job or order, in the owner's currency (a range is fine). Say "order" for food, shops and products, "job" for services.
- followUp: how fast they reply when someone asks, and whether they check back with people who go quiet.
- DEPTH follow-ups (asked once the required slots are known, one at a time, only those the prompt lists):
  - pricePresentation: how and when they give the price — a quick figure on WhatsApp, a written quote, after a call or visit, before or after understanding what the customer needs.
  - lostReason: what people say or do when they don't go ahead ("too expensive", "I'll get back to you", they just go quiet, they pick someone cheaper).
  - proof: whether new people see past work, photos, reviews or results before hearing the price.
  - capacity: whether they could take on more work right now (if they could not, more customers is not the answer).
  - repeat: whether past customers come back or order again, or it is mostly one-off work (key when orders come in waves).
  When useful, say in a few words why you're asking ("This tells me whether the price or the timing is the real issue.").
- goal, location, changes and the trend slots (enquiries, customers, revenue) are optional — only when they come up naturally.
- MONEY TROUBLE (only when the prompt says MONEY FIRST — the owner has a payment they can't cover):
  - moneyDue: the payment they named — what, how much, when it is due (often already in their first message: record it).
  - otherDebts: anything ELSE owed or due in the next few weeks (a loan repayment, a supplier, wages, tax, a bill) — how much and when. "Nothing else" is a full answer. Always ask it, even when the first payment is clear: people rarely mention every debt up front.
  - cashNow: the money the business has now to pay with.
  - moneyInOut: roughly what comes in from sales in a normal day, week or month, and the main running costs. If they gave a monthly sales figure, ask what a normal day or week brings in instead of building on the monthly figure — the two often don't match.
  - coverPlan: how they were planning to cover the gap — borrowing, selling something, family, talking to whoever is owed. Ask plainly and without judging; the diagnosis weighs it.
  - pricesChanged: when they last changed prices, and whether costs went up since. platformFees: whether an app, platform or card machine they sell through takes a fee or cut. owedFlex: whether whoever they owe has ever agreed to part payment or a plan before.
  Record every amount exactly as they said it; never add up, convert or estimate anything.
- AMOUNTS YOU ARE NOT SURE OF: if an amount could be read more than one way — a number with no unit where the size matters ("300" for a rent), a word or shorthand for a number you don't recognise or that may mean something else where they are, an amount in a different currency from the business's own (never convert it — ask whether that is right, or what it is in their own currency), or two figures that don't fit together — don't record it yet. Ask one short question that writes it out in full ("Just to check — is that 300,000?") and record it once they confirm. Usual shorthand that is clear (k for thousand, m for million) needs no check: what you understood is shown to them written in full.

CHOOSING WHAT TO ASK NEXT
- Look at COVERAGE: what is KNOWN, MISSING, how often it was ASKED, or DECLINED. Never ask about anything KNOWN or DECLINED. Never reuse a question's wording.
- Bridge from their words. Harvest aggressively: if one message answers several slots, record ALL of them and skip ahead.
- Broad answers: if they say they serve "everyone" or sell "all kinds", ask ONCE which kind of customer pays them best or comes most often, and say in a few words why (it matters for pricing). If they still say everyone, accept it and move on.
- Asked once without an answer → try ONE different angle; asked twice → stop and move on.
- Money questions can feel personal: say a rough range is fine and they can skip.

CLASSIFY THE OWNER'S LATEST MESSAGE BEFORE REPLYING
- "answer": it answers your pending question.
- "correction": it fixes something you got wrong. In ONE short clause say what you had wrong, then ALWAYS carry on with your next question in the same reply. Only say things like "thanks for clarifying" when they actually corrected you.
- "partial": answers part of it — take the part they gave, then ask for the missing piece lightly.
- "dodge": they can't or won't answer, or say "not sure" — that is a real answer. Respect it warmly. If the question matters for the diagnosis (where it's stuck, how many pay, how they follow up, people asking, a typical job), say in ONE short friendly sentence what not knowing it means — e.g. "No problem — without a rough count I can't work out what fixing it is worth, so that part will be a best guess." Then move to a different gap or an easier angle. Never guilt-trip, never ask the same thing twice in a row.
- "question": they asked you something — answer honestly in 1-2 sentences, then ask your next question.

TONE AND STYLE
- 1-3 short sentences. Plain, warm and natural. No emoji, no lists, and never the stiff "As an AI language model…" line — but if they ask who or what you are, say plainly that you are Nellovia, an AI business consultant.
- Your very first message already introduced you by name. Don't introduce yourself again unless they ask.
- Do NOT repeat the owner's answer back to them. At most echo a 2-4 word fragment — better, say what it suggests ("Referrals usually mean people already trust your work.").
- Do not mention their country or city unless they just did.
- Never judge their numbers ("that's low", "that's a big challenge") — stay curious and neutral; the diagnosis interprets them.
- Never agree or disagree with their explanation of the cause, however sure they sound ("so it's only timing", "then the business itself is fine"): you haven't seen enough yet. Note it and keep asking; the diagnosis weighs it against their answers.
- Thank them only now and then, and vary it. Never start two replies the same way.
- Exactly ONE question per reply (none when wrapping), written out inside your reply.

${I_VOICE}

${HONESTY_RULES}

PLAIN LANGUAGE — ANY SMALL-BUSINESS OWNER MUST UNDERSTAND YOU
- Write the way you would talk to a market trader or a tailor: short, everyday words. Never assume they have a website, ads, an app or social media unless they said so.
- NEVER use these words unless the owner used them first: signed / sign up (say "got", "won", "started buying from you"), leads (say "people who asked"), conversion / convert (say "went on to buy"), funnel, pipeline, CTR, traffic, visitors, impressions, engagement, acquisition, channels (say "how people find you"), retention / churn (say "customers who come back"), ROI, KPI, metrics, B2B / B2C, onboarding, checkout, ecommerce.

WRAPPING UP
- When the prompt says WRAP: ask nothing more. Reply with a brief, warm close that mentions one or two specifics in your own clean words, and set nextSlot "none".

SLOT VALUES
- Write every slot value cleanly in plain words: fix spelling and grammar, keep the owner's meaning and their numbers exactly (e.g. "every businesses and invidual" → "any business or individual").

OUTPUT — return ONLY valid JSON, no markdown:
{
  "read": "answer|correction|partial|dodge|question|other",
  "reply": "your reply (<= 3 sentences)",
  "slotUpdates": {
    "businessType": "...", "sells": "...", "targetMarket": "...", "location": "...", "goal": "...",
    "channels": ["full updated list"],
    "enquiries": "Increased|Decreased|About the same|Don't know",
    "customers": "Increased|Decreased|About the same|Don't know",
    "revenue": "Increased|Decreased|About the same|Don't know",
    "changes": ["full updated list"],
    "bottleneck": "...", "closeRate": "X out of Y", "followUp": "...", "jobValue": "...", "monthlyEnquiries": "...",
    "pricePresentation": "...", "lostReason": "...", "proof": "...", "capacity": "...", "repeat": "...", "ownerTheory": "...",
    "moneyDue": "...", "otherDebts": "...", "cashNow": "...", "moneyInOut": "...", "coverPlan": "...", "pricesChanged": "...", "platformFees": "...", "owedFlex": "..."
  },
  "learnedChips": ["up to 3 short plain labels <= 46 chars for what you understood THIS turn, in the form 'Sells: <what they sell>', 'How many pay: <X out of Y>', 'Typical job: <range>' (say 'Typical order' for goods). Never 'Close rate'. Prefix 'Updated:' ONLY when correcting something"],
  "nextSlot": "the ONE missing slot your question goes after, or \\"none\\" when wrapping up",
  "chips": ["up to 4 tap-to-send ANSWERS <= 40 chars the OWNER could give to your NEXT question, in the owner's voice. NEVER a question. Include an easy option like 'Not sure' when sensible; empty when wrapping"]
}
RULES
- slotUpdates: include ONLY slots learned or corrected THIS turn. Trend slots use exactly the enum values.
- nextSlot must be a slot that is currently MISSING (or "none" when wrapping).
- learnedChips: omit if this turn changed nothing.`;

interface ChatBody {
  workspaceName?: string;
  country?: string;
  currency?: string;
  transcript?: TranscriptTurn[];
  phase?: CheckupPhase;
  slots?: Partial<CheckupSlots>;
  askCounts?: AskCounts;
}

function sanitizeSlots(input: Partial<CheckupSlots> | undefined): CheckupSlots {
  const base = emptySlots();
  if (!input) return base;
  const trend = (v: unknown): TrendDirection | undefined =>
    typeof v === "string" && (TREND_VALUES as string[]).includes(v) ? (v as TrendDirection) : undefined;
  // Template placeholders the model sometimes copies ("...", "N/A") are not answers.
  const PLACEHOLDER = /^\s*(\.{2,}|…+|n\/?a|null|none|nil|unknown|not (yet )?(known|given|provided|specified)|-+|tbd|\?+)\s*\.?\s*$/i;
  const str = (v: unknown, cap: number): string | undefined => {
    const s = typeof v === "string" ? v.trim().slice(0, cap) : "";
    return s.length > 0 && !PLACEHOLDER.test(s) ? s : undefined;
  };
  const list = (v: unknown, cap: number, n: number): string[] | undefined => {
    if (!Array.isArray(v) || v.length === 0) return undefined;
    const items = v
      .filter((x) => typeof x === "string" && x.trim().length > 0 && !PLACEHOLDER.test(x))
      .map((x) => String(x).trim().slice(0, cap))
      .slice(0, n);
    return items.length > 0 ? items : undefined;
  };

  return {
    businessType: str(input.businessType, 120),
    sells: str(input.sells, 160),
    targetMarket: str(input.targetMarket, 160),
    location: str(input.location, 80),
    goal: str(input.goal, 160),
    channels: list(input.channels, 40, 6),
    enquiries: trend(input.enquiries),
    customers: trend(input.customers),
    revenue: trend(input.revenue),
    changes: list(input.changes, 80, 5),
    bottleneck: str(input.bottleneck, 160),
    closeRate: str(input.closeRate, 80),
    followUp: str(input.followUp, 160),
    jobValue: str(input.jobValue, 80),
    monthlyEnquiries: str(input.monthlyEnquiries, 80),
    pricePresentation: str(input.pricePresentation, 160),
    lostReason: str(input.lostReason, 160),
    capacity: str(input.capacity, 160),
    proof: str(input.proof, 160),
    repeat: str(input.repeat, 160),
    ownerTheory: str(input.ownerTheory, 220),
    moneyDue: str(input.moneyDue, 220),
    otherDebts: str(input.otherDebts, 220),
    cashNow: str(input.cashNow, 120),
    moneyInOut: str(input.moneyInOut, 300),
    coverPlan: str(input.coverPlan, 200),
    pricesChanged: str(input.pricesChanged, 160),
    platformFees: str(input.platformFees, 160),
    owedFlex: str(input.owedFlex, 160),
    money: input.money === true ? true : undefined,
    // An empty list is a real answer here ("no, that's the main one").
    otherChallenges: Array.isArray(input.otherChallenges) ? (list(input.otherChallenges, 80, 3) ?? []) : undefined,
    pending: typeof input.pending === "string" && (SLOT_KEYS as string[]).includes(input.pending) ? input.pending : undefined,
    declined: (list(input.declined, 20, SLOT_KEYS.length) ?? []).filter((d): d is SlotKey => (SLOT_KEYS as string[]).includes(d)),
    corrections:
      typeof input.corrections === "number" && Number.isFinite(input.corrections)
        ? Math.max(0, Math.min(9, Math.round(input.corrections)))
        : 0,
  };
}

function sanitizeAskCounts(input: AskCounts | undefined): AskCounts {
  if (!input || typeof input !== "object") return {};
  const out: AskCounts = {};
  for (const key of SLOT_KEYS) {
    const v = input[key];
    if (typeof v === "number" && Number.isFinite(v) && v > 0) out[key] = Math.min(5, Math.round(v));
  }
  return out;
}

function isResolved(slots: CheckupSlots, key: SlotKey): boolean {
  if (slots.declined.includes(key)) return true;
  const v = slots[key];
  if (key === "otherChallenges") return Array.isArray(v);
  if (key === "channels" || key === "changes") return Array.isArray(v) && v.length > 0;
  return typeof v === "string" && v.length > 0;
}

/** Signal slots holding a real answer (not "Don't know", not declined). */
function knownSignals(slots: CheckupSlots): number {
  return SIGNAL_SLOTS.filter((k) => {
    if (slots.declined.includes(k)) return false;
    const v = slots[k];
    return typeof v === "string" && v.length > 0 && v !== "Don't know";
  }).length;
}

/**
 * What still has to be gathered before wrapping: the required slots, plus —
 * while the checkup holds too little real signal for a meaningful diagnosis —
 * any unanswered signal slot. A slot is only declined once it was really asked
 * its full number of times without an answer, so this always converges.
 */
function missingRequired(slots: CheckupSlots): SlotKey[] {
  // "Anything else holding you back?" — once, right after the main problem and their view of it.
  const order: SlotKey[] = [...requiredSlotsFor(slots)];
  order.splice(order.indexOf("ownerTheory") + 1, 0, "otherChallenges");
  const missing = order.filter((k) => (k === "otherChallenges" ? isResolved(slots, "bottleneck") && !isResolved(slots, k) : !isResolved(slots, k)));
  // Money trouble: the money answers are the signal; no sales-funnel answers are needed.
  if (!slots.money && knownSignals(slots) < MIN_SIGNALS) {
    for (const k of SIGNAL_SLOTS) {
      if (!missing.includes(k) && !isResolved(slots, k)) missing.push(k);
    }
  }
  return missing;
}

/**
 * Everything still to ask before wrapping: the required slots first; once
 * those are known, the depth follow-ups that fit what the owner finds hard.
 */
function missingAll(slots: CheckupSlots): SlotKey[] {
  const required = missingRequired(slots);
  if (required.length > 0) return required;
  return depthSlotsFor(slots).filter((k) => !isResolved(slots, k));
}

function declineSlot(slots: CheckupSlots, key: SlotKey): void {
  if (!slots.declined.includes(key)) slots.declined = [...slots.declined, key];
  if (key === "enquiries") slots.enquiries = slots.enquiries ?? "Don't know";
  if (key === "customers") slots.customers = slots.customers ?? "Don't know";
  if (key === "revenue") slots.revenue = slots.revenue ?? "Don't know";
}

function deriveLearnedChips(updates: Partial<CheckupSlots>): string[] {
  const chips: string[] = [];
  const push = (label: string, v?: string) => {
    if (v) chips.push(shorten(`${label}: ${v}`, 46));
  };
  push("Business", updates.businessType);
  push("Sells", updates.sells);
  push("Customers", updates.targetMarket);
  push("Location", updates.location);
  push("Goal", updates.goal);
  push("Hardest part", updates.bottleneck);
  push("How many pay", updates.closeRate);
  push("Getting back to people", updates.followUp);
  push("Typical job", updates.jobValue);
  push("People asking a month", updates.monthlyEnquiries);
  push("How you give prices", updates.pricePresentation);
  push("When people don't buy", updates.lostReason);
  push("Room for more work", updates.capacity);
  push("Past work shown", updates.proof);
  push("Customers coming back", updates.repeat);
  push("Your view", updates.ownerTheory);
  push("Due", updates.moneyDue);
  push("Also owed", updates.otherDebts);
  push("Cash now", updates.cashNow);
  push("Money in and out", updates.moneyInOut);
  push("Your plan", updates.coverPlan);
  push("Prices last changed", updates.pricesChanged);
  push("Fees taken", updates.platformFees);
  push("Payment plans before", updates.owedFlex);
  (updates.otherChallenges ?? []).slice(0, 3).forEach((c) => chips.push(shorten(`Also: ${c}`, 46)));
  (updates.channels ?? []).slice(0, 2).forEach((c) => chips.push(shorten(`Found via: ${c}`, 46)));
  (updates.changes ?? []).slice(0, 2).forEach((c) => chips.push(shorten(`Change: ${c}`, 46)));
  TREND_SLOT_KEYS.forEach((k) => {
    if (updates[k]) chips.push(`${k === "enquiries" ? "People asking" : k === "customers" ? "Paying customers" : "Money coming in"}: ${updates[k]}`);
  });
  return chips.slice(0, 3);
}

/** Plain labels for slot keys the model sometimes leaks into chips ("monthlyEnquiries about 5"). */
const CHIP_LABELS: [RegExp, string][] = [
  [/^(other ?debts?|also owed|other payments?|owe(s|d)? also)\b/i, "Also owed"],
  [/^(money ?due|due|payment due|rent due)\b/i, "Due"],
  [/^(cash ?now|cash on hand|cash in hand)\b/i, "Cash now"],
  [/^(money ?in ?(and|&|\/) ?out|money ?in ?out|money in|sales and costs|running costs)\b/i, "Money in and out"],
  [/^(prices? (last )?changed|prices? changed)\b/i, "Prices last changed"],
  [/^(platform ?fees|fees taken|fees|commission)\b/i, "Fees taken"],
  [/^(cover ?plan|your plan|plan to cover)\b/i, "Your plan"],
  [/^(owed ?flex|payment plans? before)\b/i, "Payment plans before"],
  [/^(other ?challenges?|also holding( you)? back|anything else|other problems?|also)\b/i, "Also"],
  [/^(owner ?theory|your view|your theory|you think|cause)\b/i, "Your view"],
  [/^(repeat|customers coming back|come back)\b/i, "Customers coming back"],
  [/^(target ?market|customers?)\b/i, "Customers"],
  [/^(monthly ?enquiries|people asking( a month)?)\b/i, "People asking a month"],
  [/^typical order( value)?\b/i, "Typical order"],
  [/^(job ?value|typical (job|project)( value)?)\b/i, "Typical job"],
  [/^(follow[- ]?up|getting back to people)\b/i, "Getting back to people"],
  [/^(bottleneck|hardest part)\b/i, "Hardest part"],
  [/^(close ?rate|how many pay|conversion(?: rate)?)\b/i, "How many pay"],
  [/^(price ?presentation|how you give prices)\b/i, "How you give prices"],
  [/^(lost ?reason|when people don't buy)\b/i, "When people don't buy"],
  [/^(capacity|room for more work)\b/i, "Room for more work"],
  [/^(proof|past work shown)\b/i, "Past work shown"],
  [/^(channels?|acquisition channels?|found via|how people find you)\b/i, "Found via"],
  [/^(sells|what you sell)\b/i, "Sells"],
];

/** Chip label → the answer it summarises (so a chip only shows when that answer is new). */
const LABEL_SLOT: Record<string, SlotKey> = {
  Customers: "targetMarket",
  "People asking a month": "monthlyEnquiries",
  "Typical job": "jobValue",
  "Typical order": "jobValue",
  "Getting back to people": "followUp",
  "Hardest part": "bottleneck",
  "How many pay": "closeRate",
  "How you give prices": "pricePresentation",
  "When people don't buy": "lostReason",
  "Room for more work": "capacity",
  "Past work shown": "proof",
  "Customers coming back": "repeat",
  "Your view": "ownerTheory",
  Due: "moneyDue",
  "Also owed": "otherDebts",
  "Cash now": "cashNow",
  "Money in and out": "moneyInOut",
  "Your plan": "coverPlan",
  "Prices last changed": "pricesChanged",
  "Fees taken": "platformFees",
  "Payment plans before": "owedFlex",
  Also: "otherChallenges",
  "Found via": "channels",
  Sells: "sells",
};

/** Learned-chip safety net: plain labels, "Updated:" only for corrections, never cut mid-word. */
function cleanChip(raw: string, read: ChatRead): string {
  let c = raw.replace(/\s+/g, " ").trim();
  const updated = /^updated:\s*/i.test(c);
  c = c.replace(/^updated:\s*/i, "");
  for (const [re, label] of CHIP_LABELS) {
    const m = c.match(re);
    if (m) {
      const rest = c.slice(m[0].length).replace(/^\s*[:\-–—=]?\s*/, "");
      c = rest ? `${label}: ${rest}` : label;
      break;
    }
  }
  if (/(^|:\s*)(\.{2,}|…)\s*$/.test(c)) return ""; // placeholder, not something learned
  if (updated && read === "correction") c = `Updated: ${c}`;
  return shorten(plainify(c), 46);
}

const OPENER_RE = /^(got it|thanks( a lot)?|thank you|understood|okay|ok|i see|great|sure|alright|noted|perfect|that'?s (helpful|useful|very helpful))[,.!—-]*\s+/i;

/**
 * "Got it. … Got it. … Got it." reads like a script. If this reply opens the
 * same way as one of the last two, drop the opener and start with the substance.
 */
function varyOpener(reply: string, transcript: TranscriptTurn[]): string {
  const m = reply.match(OPENER_RE);
  if (!m) return reply;
  const word = m[1].toLowerCase().split(" ")[0];
  const recent = transcript
    .filter((t) => t.role === "ai")
    .slice(-2)
    .map((t) => (t.text.match(OPENER_RE)?.[1] ?? "").toLowerCase().split(" ")[0]);
  if (!recent.includes(word)) return reply;
  const rest = reply.slice(m[0].length).replace(/^[\s,.;:!—–-]+/, "").trim();
  return rest.length > 10 && /^[A-Za-z]/.test(rest) ? rest[0].toUpperCase() + rest.slice(1) : reply;
}

/** Words that show the owner actually spoke to a depth topic (so the model can't invent it). */
const DEPTH_EVIDENCE: Partial<Record<SlotKey, RegExp>> = {
  capacity: /more work|busy|full|handle|capacity|time|room|help|stretched|extra|yes|no\b|can\b|can't|cannot/i,
  proof: /portfolio|example|past work|show|sample|review|photo|website|instagram|testimon|results|yes|no\b|not really|only if/i,
  lostReason: /expensive|quiet|stop|reply|cheaper|get back|leave|left|disappear|budget|ghost|later|think about/i,
  pricePresentation: /price|quote|whatsapp|call|visit|invoice|send|figure|tell them|straight|after/i,
  repeat: /back|again|repeat|one[- ]?off|return|regular|loyal|yes|no\b|rarely|few|some/i,
  pricesChanged: /price|raise|rais|increas|changed|same|year|month|never|last/i,
  platformFees: /%|percent|commission|fee|cut|charge|take|nothing|no\b|free/i,
  owedFlex: /yes|no\b|before|agree|accept|half|part|instal|plan|never|ask/i,
  otherDebts: /owe|owing|loan|debt|supplier|wage|salar|tax|bill|due|repay|nothing|no\b|none|just (that|the)/i,
};

/** The close — never pastes the owner's raw words back (typos and all). */
function wrapReply(): string {
  return "Thank you — that's everything I need. Give me a few seconds to work out what's holding the business back, and what fixing it could be worth.";
}

/* --------------------------------------------------------------------------
 * Offline fallback — the consultant's safety net when the model is truly
 * unreachable. Rules for staying HUMAN while degraded:
 *   1. Never wipe what was already learned (state always merges forward).
 *   2. Never repeat a question verbatim (variants + asked-set from transcript).
 *   3. Acknowledge briefly — never parrot the owner's message back in quotes.
 *   4. If their reply substantively answered the pending question, record it
 *      in their own words (the final extract pass re-reads the transcript).
 *   5. If they signal frustration ("i just answered"), apologise and move to a
 *      DIFFERENT gap — never repeat, never defend.
 * ------------------------------------------------------------------------ */

function askedQuestions(transcript: TranscriptTurn[]): Set<string> {
  return new Set(transcript.filter((t) => t.role === "ai").map((t) => t.text.trim()));
}

/** Next question for a slot whose earlier wording was already used. */
function variantFor(slot: SlotKey, asked: Set<string>, cur: string): string | null {
  const list = QUESTION_VARIANTS[slot].map((q) => q.replaceAll("{cur}", cur));
  return list.find((q) => !asked.has(q)) ?? null;
}

function questionFor(slot: SlotKey, asked: Set<string>, cur: string): string {
  return variantFor(slot, asked, cur) ?? QUESTION_VARIANTS[slot][0].replaceAll("{cur}", cur);
}

function snippet(text: string, cap = 120): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > cap ? `${clean.slice(0, cap - 1)}…` : clean;
}

const FRUSTRATION_RE = /(just|already)\s+(said|answered|told)|as i said|i said (this )?already|you (keep|still) ask|same question|asking (me )?again|repeat(ed)?/i;
const DODGE_RE = /rather not|prefer not|skip|don't know|do not know|no idea|not sure|private|confidential/i;
const GREETING_RE = /^(hi|hello|hey|good (morning|afternoon|evening))[\s.,!]*$/i;
const ACKS = ["Thanks, that helps.", "Good to know.", "That's useful.", "Got it.", "Thanks for that."];

/** What skipping a question that matters costs — said plainly, once, then the chat moves on. */
const SKIP_COST: Partial<Record<SlotKey, string>> = {
  closeRate: "No problem — without a rough count of how many pay, I can't tell whether the gap is in finding people or winning them, so that part will be a best guess.",
  monthlyEnquiries: "That's fine — without a rough number I can't work out what fixing it is worth, so I'll leave that figure out.",
  jobValue: "No problem — without a rough amount I can't put a money figure on what fixing it is worth.",
  followUp: "That's okay — I'll go on the rest, though how people are followed up is often where a lot quietly slips away.",
  bottleneck: "No problem — I'll work it out from your other answers, so the diagnosis may be a little broader.",
  ownerTheory: "That's fine — I'll lean on your other answers instead.",
  cashNow: "That's okay — without a rough figure I can't size this week's gap, so I'll go on what's due.",
  moneyInOut: "No problem — without rough figures for money in and out I can't tell whether the business covers its costs, so I'll say what that would show.",
  otherDebts: "That's fine — I'll plan around the payment you named, but anything else due soon could change what comes first.",
};

/** Channels the owner named, harvested conservatively from their own words. */
function harvestChannels(text: string): string[] {
  const t = text.toLowerCase();
  const found: string[] = [];
  const channelWords: [RegExp, string][] = [
    [/instagram/, "Instagram"],
    [/whatsapp/, "WhatsApp"],
    [/tiktok/, "TikTok"],
    [/facebook/, "Facebook"],
    [/referr|word of mouth|recommendation/, "Referrals"],
    [/google/, "Google"],
    [/linkedin/, "LinkedIn"],
    [/twitter|x\.com/, "Twitter/X"],
    [/walk[\s-]?in/, "Walk-ins"],
    [/\bphone call|\bcall(s|ed)? us/, "Phone"],
    [/email/, "Email"],
    [/website|our site/, "Website"],
  ];
  for (const [re, label] of channelWords) {
    if (re.test(t) && !found.includes(label)) found.push(label);
  }
  return found.slice(0, 6);
}

/**
 * The owner answered the close-rate question with a bare number ("2").
 * Ask "out of how many?" instead of guessing a denominator — deterministic,
 * instant, and it never records a ratio the owner did not give.
 */
function closeRateClarifier(
  slots: CheckupSlots,
  askCounts: AskCounts,
  lastUser: string,
  transcript: TranscriptTurn[],
): ChatTurnResult | null {
  if (isResolved(slots, "closeRate")) return null;
  const lastAi = [...transcript].reverse().find((t) => t.role === "ai")?.text ?? "";
  const askedCloseRate =
    slots.pending === "closeRate" ||
    (/how many|out of/i.test(lastAi) && /(pay|buy|go ahead|become|turn into|end up)/i.test(lastAi) && !/month|week/i.test(lastAi));
  if (!askedCloseRate) return null;
  const n = isBareNumber(lastUser);
  if (n === null || n <= 0) return null;
  const v = Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
  const denominators = [5, 10, 20, 50, 100].filter((d) => d > n).slice(0, 3);
  return {
    read: "partial",
    reply: `Just so I get it right — ${v} out of how many people who ask? For example, ${v} out of ${denominators[0] ?? 10}, or ${v} out of ${denominators[1] ?? 20}?`,
    learnedChips: [],
    phase: "interview",
    slots: { ...slots, pending: "closeRate" },
    askCounts,
    chips: [...denominators.map((d) => `${v} out of ${d}`), "Not sure"],
    degraded: false,
  };
}

/**
 * Did the owner really give this ratio — or did the model assume a
 * denominator ("2" → "2 out of 10")? Checked against their last two replies.
 */
function ownerGaveRatio(update: string, transcript: TranscriptTurn[]): boolean {
  const r = parseCloseRate(update);
  if (!r) return true; // words like "most of them" — nothing invented
  const recent = transcript
    .filter((t) => t.role === "user")
    .slice(-2)
    .map((t) => wordsToDigits(t.text.toLowerCase()))
    .join(" ");
  if (/half/.test(recent) && r.won * 2 === r.of) return true;
  if (/%|percent/.test(recent)) return true;
  const nums: string[] = recent.match(/\d+(?:\.\d+)?/g) ?? [];
  return nums.includes(String(r.of));
}

function fallbackTurn(body: {
  phase: CheckupPhase;
  slots: CheckupSlots;
  askCounts: AskCounts;
  lastUser: string;
  transcript: TranscriptTurn[];
  cur: string;
}): ChatTurnResult {
  const { slots, askCounts, lastUser, transcript, cur } = body;
  const t = lastUser.toLowerCase().trim();
  const asked = askedQuestions(transcript);
  const userTurns = transcript.filter((tr) => tr.role === "user").length;

  if (body.phase === "done") {
    return { read: "other", reply: wrapReply(), learnedChips: [], phase: "done", slots, askCounts, chips: [], degraded: true };
  }

  // Trend harvest — ONLY for trend slots this conversation already asked about.
  const correctionish = FRUSTRATION_RE.test(lastUser) || /(^|\s)(no|nope|not just|not only|actually|what i meant|what i mean|correction|we don't|we do not|we also|forget)/i.test(t) || /all over the world|worldwide|globally|everywhere|international/.test(t);
  const dodge = DODGE_RE.test(t) || GREETING_RE.test(t);

  const trendHarvest: Partial<CheckupSlots> = {};
  if (!correctionish && !dodge) {
    let trend: TrendDirection | undefined;
    if (/decreas|down|less|fewer|drop|fell|worse|slower/.test(t)) trend = "Decreased";
    else if (/increas|up|more|grew|rise|rose|better|higher/.test(t)) trend = "Increased";
    else if (/don'|do not|no idea|not sure|skip|rather not|prefer not/.test(t)) trend = "Don't know";
    else if (/same|flat|stable|steady|about/.test(t)) trend = "About the same";
    if (trend) {
      for (const key of TREND_SLOT_KEYS) {
        if (!isResolved(slots, key) && (askCounts[key] ?? 0) > 0) {
          if (key === "enquiries") trendHarvest.enquiries = trend;
          else if (key === "customers") trendHarvest.customers = trend;
          else if (key === "revenue") trendHarvest.revenue = trend;
        }
      }
    }
  }

  const merged: CheckupSlots = { ...slots, ...trendHarvest };

  // Frustration: acknowledge, apologise once, move to a DIFFERENT gap.
  if (FRUSTRATION_RE.test(lastUser)) {
    const missing = missingAll(merged);
    const target = missing.find((k) => (askCounts[k] ?? 0) < ASK_CAP[k] && k !== slots.pending);
    if (!target) {
      return { read: "correction", reply: wrapReply(), learnedChips: [], phase: "done", slots: merged, askCounts, chips: [], degraded: true };
    }
    return {
      read: "correction",
      reply: `You're right — sorry about that, and thank you for being patient. ${questionFor(target, asked, cur)}`,
      learnedChips: [],
      phase: "interview",
      slots: { ...merged, pending: target, corrections: Math.min(9, merged.corrections + 1) },
      askCounts: { ...askCounts, [target]: (askCounts[target] ?? 0) + 1 },
      chips: chipsFor(target, cur, merged),
      degraded: true,
    };
  }

  // "Anything else holding you back?" — their answer, split into up to 3 (none = just the main one).
  const answeringOthers = slots.pending === "otherChallenges";
  const otherUpdate = answeringOthers ? parseOtherChallenges(lastUser, slots.bottleneck) ?? undefined : undefined;
  if (otherUpdate) merged.otherChallenges = otherUpdate;

  // Substantive answer harvest in the owner's own words, for the slot the
  // last question asked about (or "sells" on the very first reply).
  const textUpdates: Partial<CheckupSlots> = {};
  // A first message about money they can't cover is about the problem, not what they sell:
  // what is due and what they have stay in their own words, the message is the main problem,
  // and "what do you sell?" comes next — never their rent filed as what they sell.
  const moneyOpener = Boolean(merged.money) && userTurns <= 1 && !slots.pending;
  if (moneyOpener && !dodge && !correctionish) {
    const { due, cash } = moneyClauses(lastUser);
    if (due && !isResolved(merged, "moneyDue")) textUpdates.moneyDue = tidyOwnerText(snippet(due, 120));
    if (cash && !isResolved(merged, "cashNow")) textUpdates.cashNow = tidyOwnerText(snippet(cash, 80));
    if (!isResolved(merged, "bottleneck")) textUpdates.bottleneck = tidyOwnerText(snippet(lastUser));
  }
  if (!dodge && !correctionish && !answeringOthers && lastUser.trim().length >= 1) {
    const pendingCandidates = TEXT_SLOT_KEYS.filter((k) => !isResolved(merged, k));
    const pending = moneyOpener
      ? undefined
      : ((slots.pending && (pendingCandidates as SlotKey[]).includes(slots.pending) ? slots.pending : undefined) ??
        pendingCandidates.find((k) => (askCounts[k] ?? 0) > 0) ??
        (pendingCandidates.includes("sells") && transcript.filter((tr) => tr.role === "user").length <= 1 ? "sells" : undefined));
    const short = lastUser.trim().length < 8;
    const shortOk: SlotKey[] = ["closeRate", "jobValue", "monthlyEnquiries", "capacity", "proof"];
    if (pending && (!short || shortOk.includes(pending))) {
      if (pending === "closeRate") {
        if (parseCloseRate(lastUser) || /half|most|few|none|all/i.test(lastUser)) textUpdates.closeRate = snippet(lastUser, 80);
      } else if (pending === "jobValue" || pending === "monthlyEnquiries") {
        if (/\d|hundred|thousand|million/i.test(wordsToDigits(lastUser))) textUpdates[pending] = snippet(lastUser, 80);
      } else {
        (textUpdates as Record<string, string>)[pending] = tidyOwnerText(snippet(lastUser));
      }
    }

    if (!isResolved(merged, "channels")) {
      const channels = harvestChannels(lastUser);
      if (channels.length > 0) textUpdates.channels = channels;
    }
    if (!isResolved(merged, "location")) {
      const loc = lastUser.match(/\bin\s+([A-Z][a-zA-Z]+(?:\s[A-Z][a-zA-Z]+)?)\b/);
      if (loc) textUpdates.location = loc[1].slice(0, 80);
    }
  }

  for (const key of TEXT_SLOT_KEYS) {
    if (textUpdates[key]) (merged as unknown as Record<string, unknown>)[key] = textUpdates[key];
  }
  if (textUpdates.channels) merged.channels = textUpdates.channels;

  const learnedChips = deriveLearnedChips({ ...textUpdates, ...(otherUpdate ? { otherChallenges: otherUpdate } : {}) });

  // The last question went unanswered and has used its asks — accept the gap.
  if (slots.pending && !isResolved(merged, slots.pending) && (askCounts[slots.pending] ?? 0) >= ASK_CAP[slots.pending]) {
    declineSlot(merged, slots.pending);
  }

  const missing = missingAll(merged);
  if (missing.length === 0 || userTurns >= MAX_USER_TURNS) {
    return { read: "answer", reply: wrapReply(), learnedChips, phase: "done", slots: { ...merged, pending: undefined }, askCounts, chips: [], degraded: true };
  }

  const nextAskCounts: AskCounts = { ...askCounts };
  const target = missing.find((k) => (nextAskCounts[k] ?? 0) < ASK_CAP[k]);
  if (!target) {
    return { read: "other", reply: wrapReply(), learnedChips, phase: "done", slots: { ...merged, pending: undefined }, askCounts: nextAskCounts, chips: [], degraded: true };
  }
  nextAskCounts[target] = (nextAskCounts[target] ?? 0) + 1;

  // Not sure / skip on a question that matters: say once, plainly, what that costs.
  const skipCost = dodge && slots.pending ? SKIP_COST[slots.pending] : undefined;
  const ack = skipCost ?? (moneyOpener ? "Thank you for telling me — that's a lot of pressure. Let's get the full picture so the plan fits." : ACKS[userTurns % ACKS.length]);
  return {
    read: Object.keys(trendHarvest).length || Object.keys(textUpdates).length || otherUpdate ? "answer" : skipCost ? "dodge" : "other",
    reply: `${ack} ${questionFor(target, asked, cur)}`,
    learnedChips,
    phase: "interview",
    slots: { ...merged, pending: target },
    askCounts: nextAskCounts,
    chips: chipsFor(target, cur, merged),
    degraded: true,
  };
}

export async function POST(request: NextRequest) {
  // Paid AI: signed-in accounts only, with a per-account limit.
  const guard = await requireAiSession("checkup-chat");
  if (guard.response) return guard.response;

  // Parse and normalize the request state FIRST so every error path can
  // preserve what the conversation already learned — wiping state here is
  // what made degraded conversations look scripted and forgetful.
  let body: ChatBody = {};
  try {
    body = (await request.json()) as ChatBody;
  } catch {
    body = {};
  }

  const workspaceName = (body.workspaceName ?? "Your business").slice(0, 120);
  const country = (body.country ?? "Nigeria").slice(0, 80);
  const cur = currencySymbol(body.currency);
  const phase: CheckupPhase = body.phase === "done" ? "done" : "interview";
  const slots = sanitizeSlots(body.slots);
  const askCounts = sanitizeAskCounts(body.askCounts);
  const transcript = Array.isArray(body.transcript)
    ? body.transcript
        .filter((t) => t && typeof t.text === "string" && (t.role === "ai" || t.role === "user"))
        .map((t) => ({ role: t.role, text: t.text.slice(0, 900) }))
        .slice(-24)
    : [];

  const lastUser = [...transcript].reverse().find((t) => t.role === "user")?.text ?? "";
  const userTurns = transcript.filter((t) => t.role === "user").length;
  const ownerText = transcript
    .filter((t) => t.role === "user")
    .map((t) => t.text)
    .join("\n");
  // A payment they can't cover (rent, a loan, a supplier, wages…): this week's money comes first.
  if (!slots.money && isMoneyTrouble(ownerText)) slots.money = true;

  if (phase === "done") {
    const fb = fallbackTurn({ phase, slots, askCounts, lastUser, transcript, cur });
    return NextResponse.json({ ok: true, ...fb });
  }

  // A bare number to the close-rate question: ask "out of how many?" right away.
  const clarify = closeRateClarifier(slots, askCounts, lastUser, transcript);
  if (clarify) return NextResponse.json({ ok: true, ...clarify });

  try {
    // --- Coverage state for the prompt -------------------------------------
    const missing = missingAll(slots);
    const inDepth = missingRequired(slots).length === 0;
    const wrapNow = missing.length === 0 || userTurns >= MAX_USER_TURNS;
    // Compact on purpose: every token here counts against provider rate limits.
    const coverageLines = SLOT_KEYS.map((key) => {
      if (isResolved(slots, key)) {
        if (key === "otherChallenges" && !slots.declined.includes(key)) {
          return slots.otherChallenges?.length ? `- otherChallenges: KNOWN ${JSON.stringify(slots.otherChallenges)} (recorded for later — do not ask about them)` : "- otherChallenges: KNOWN (nothing else — just the main problem)";
        }
        return slots.declined.includes(key) ? `- ${key}: DECLINED` : `- ${key}: KNOWN ${JSON.stringify(slots[key])}`;
      }
      if (key === "otherChallenges" && !isResolved(slots, "bottleneck")) return "- otherChallenges: not yet (asked once, after the main problem)";
      const asked = askCounts[key] ?? 0;
      const required = requiredSlotsFor(slots).includes(key);
      // Money questions are only for owners in money trouble — never shown otherwise.
      if (!slots.money && (MONEY_SLOTS as string[]).includes(key)) return "";
      const tag = required ? "REQUIRED" : "optional";
      return `- ${key}: MISSING, ${tag}, asked ${asked}/${ASK_CAP[key]}${asked >= ASK_CAP[key] ? " (off-limits)" : ""}${required || (MONEY_SLOTS as string[]).includes(key) ? ` — ${SLOT_LABELS[key]}` : ""}`;
    })
      .filter(Boolean)
      .join("\n");
    // Money trouble: what is due, what else is owed, the cash and money in/out come before anything else.
    const moneyGaps = slots.money ? (["moneyDue", "otherDebts", "cashNow", "moneyInOut", "coverPlan"] as SlotKey[]).filter((k) => !isResolved(slots, k) && (askCounts[k] ?? 0) < ASK_CAP[k]) : [];
    const recentOpeners = transcript
      .filter((t) => t.role === "ai")
      .slice(-4)
      .map((t) => t.text.split(/[\s,.!—-]+/).slice(0, 2).join(" "))
      .filter(Boolean);

    const userPrompt = [
      `Workspace: ${workspaceName}`,
      `Country: ${country}`,
      `Currency symbol: ${cur}`,
      "",
      "COVERAGE (your information model):",
      coverageLines,
      "",
      `Your last question was about: ${slots.pending ?? "(not recorded)"}.`,
      recentOpeners.length ? `Your recent replies began with: ${recentOpeners.map((o) => `"${o}"`).join(", ")} — begin this one differently.` : "",
      slots.money
        ? `Owner replies so far: ${userTurns} (hard limit ${MAX_USER_TURNS}).`
        : `Owner replies so far: ${userTurns} (hard limit ${MAX_USER_TURNS}). Known diagnostic signals: ${knownSignals(slots)} of ${MIN_SIGNALS} needed.`,
      !wrapNow && moneyGaps.length
        ? `MONEY FIRST: they have a payment they can't cover, so this week's money comes before anything about customers. Ask next about: ${moneyGaps[0]} (still missing: ${moneyGaps.join(", ")}). Calm and matter-of-fact, one thing at a time, with a few words on why ("so we can see this week's gap"). Harvest anything they already said.`
        : "",
      !wrapNow && !moneyGaps.length && isResolved(slots, "bottleneck") && !isResolved(slots, "ownerTheory")
        ? "ASK NEXT: ownerTheory — they have told you where it feels stuck; now ask what THEY think is causing it (directly, or with 2-3 likely reasons as hints). Their own observations matter."
        : "",
      !wrapNow && !moneyGaps.length && isResolved(slots, "bottleneck") && isResolved(slots, "ownerTheory") && !isResolved(slots, "otherChallenges")
        ? "ASK NEXT: otherChallenges — react briefly to their last answer, then ask ONE question: is anything else holding the business back right now? They can tap any that apply. Never ask about those other things — the app records them for later."
        : "",
      wrapNow
        ? "WRAP: all required information is gathered (or its ask budget is spent). Do NOT ask anything more — close warmly per your wrapping rules, nextSlot \"none\"."
        : inDepth
          ? `DEPTH GAPS (the required slots are done — ask these follow-ups next, one at a time, in whatever order flows best): ${missing.join(", ")}.`
          : `REQUIRED GAPS: ${missing.join(", ")}. Choose your own next question — the one that flows most naturally from the owner's last message.`,
      "",
      "CONVERSATION SO FAR (the last OWNER line is the message you are responding to):",
      transcript.map((t) => `${t.role === "ai" ? "NELLOVIA" : "OWNER"}: ${t.text}`).join("\n"),
    ].join("\n");

    const raw = await completeText(SYSTEM, userPrompt, { maxTokens: 700, profile: "fast" });
    if (!raw) {
      // Model unreachable after retries — honest degraded turn, state intact.
      const fb = fallbackTurn({ phase, slots, askCounts, lastUser, transcript, cur });
      return NextResponse.json({ ok: true, ...fb });
    }

    const parsed = extractJson<{
      read?: string;
      reply?: string;
      slotUpdates?: Partial<CheckupSlots>;
      learnedChips?: unknown;
      nextSlot?: string;
      chips?: unknown;
    }>(raw);

    if (!parsed || typeof parsed.reply !== "string" || parsed.reply.trim().length === 0) {
      const fb = fallbackTurn({ phase, slots, askCounts, lastUser, transcript, cur });
      return NextResponse.json({ ok: true, ...fb });
    }

    // --- Guardrails --------------------------------------------------------
    let reply = parsed.reply.trim().slice(0, 700);
    const read: ChatRead = (READ_VALUES as string[]).includes(parsed.read ?? "") ? (parsed.read as ChatRead) : "other";
    const asked = askedQuestions(transcript);

    const updates = sanitizeSlots(parsed.slotUpdates);
    // "Anything else holding you back?" is read by the app, never guessed by the model
    // (a model "none" the owner didn't say would skip the question for good).
    updates.otherChallenges =
      slots.pending === "otherChallenges" && read !== "question" && read !== "correction" ? parseOtherChallenges(lastUser, slots.bottleneck) ?? undefined : undefined;
    if (updates.otherChallenges) {
      // Their answer to that question is about other problems — not an answer to any other slot.
      for (const key of TEXT_SLOT_KEYS) updates[key] = undefined;
    }
    let ownChips: SlotKey | null = null; // set when we write the question ourselves
    let clarifyN: string | null = null; // set when we ask "N out of how many?"
    const nextSlotRaw = typeof parsed.nextSlot === "string" ? parsed.nextSlot : "";
    let finalSlot: SlotKey | "none" = (SLOT_KEYS as string[]).includes(nextSlotRaw) ? (nextSlotRaw as SlotKey) : "none";

    // A ratio the owner never gave ("2" recorded as "2 out of 10") is dropped,
    // and we ask "out of how many?" instead of building on a guess.
    if (updates.closeRate && !ownerGaveRatio(updates.closeRate, transcript)) {
      const guess = parseCloseRate(updates.closeRate);
      updates.closeRate = undefined;
      if (guess && !isResolved(slots, "closeRate")) {
        clarifyN = Number.isInteger(guess.won) ? String(guess.won) : String(Math.round(guess.won * 10) / 10);
        reply = `Just so I get it right — ${clarifyN} out of how many people who ask? For example, ${clarifyN} out of 5, or ${clarifyN} out of 10?`;
        finalSlot = "closeRate";
      }
    }

    // Follow-up answers the owner never gave are dropped (no invented "Yes").
    for (const key of ["capacity", "proof", "lostReason", "pricePresentation", "repeat", "pricesChanged", "platformFees", "owedFlex", "otherDebts"] as const) {
      const evidence = DEPTH_EVIDENCE[key];
      if (updates[key] && key !== slots.pending && evidence && !evidence.test(lastUser)) updates[key] = undefined;
    }

    // A count or amount the model worked out ("20 a day" recorded as "about 600 a month")
    // is not the owner's answer: keep their own words when they were answering that
    // question, otherwise record nothing.
    const ownerRecent = transcript
      .filter((t) => t.role === "user")
      .slice(-2)
      .map((t) => t.text)
      .join("\n");
    if (updates.monthlyEnquiries && !countFromOwner(updates.monthlyEnquiries, ownerRecent)) {
      updates.monthlyEnquiries = slots.pending === "monthlyEnquiries" && /\d/.test(wordsToDigits(lastUser)) ? tidyOwnerText(snippet(lastUser, 80)) : undefined;
    }
    if (updates.jobValue && !amountFromOwner(updates.jobValue, ownerRecent)) {
      updates.jobValue = slots.pending === "jobValue" && /\d/.test(wordsToDigits(lastUser)) ? tidyOwnerText(snippet(lastUser, 80)) : undefined;
    }
    // A trend is only theirs when they spoke of a change (or were asked about that trend).
    for (const key of TREND_SLOT_KEYS) {
      if (updates[key] && slots.pending !== key && !ownerSpokeOfChange(lastUser)) updates[key] = undefined;
    }
    // Money answers carry amounts the whole diagnosis will be worked out from: every amount
    // must be one the owner said (in any earlier reply), never a sum or a guess.
    for (const key of ["moneyDue", "otherDebts", "cashNow", "moneyInOut"] as const) {
      const v = updates[key];
      if (v && !amountFromOwner(v, ownerText)) {
        updates[key] = slots.pending === key ? tidyOwnerText(snippet(lastUser, 220)) : undefined;
      }
    }
    // A sales figure on its own (often a claim in passing) doesn't answer "money in and out":
    // the costs are what show whether the business covers itself, so it still gets asked.
    if (updates.moneyInOut && !speaksOfCosts(updates.moneyInOut)) updates.moneyInOut = undefined;
    // Money questions belong to owners in money trouble only.
    if (!slots.money) for (const key of MONEY_SLOTS) (updates as unknown as Record<string, unknown>)[key] = undefined;

    // The owner answered the question we asked, but the model recorded nothing:
    // keep their answer (lightly cleaned) against that question.
    const recordedSomething =
      TEXT_SLOT_KEYS.some((k) => updates[k]) ||
      Boolean(updates.channels) ||
      Boolean(updates.enquiries || updates.customers || updates.revenue) ||
      updates.otherChallenges !== undefined;
    const pend = slots.pending;
    if (!recordedSomething && pend && read === "answer" && !isResolved(slots, pend) && !DODGE_RE.test(lastUser)) {
      const text = tidyOwnerText(snippet(lastUser, 160));
      if (pend === "closeRate") {
        if (parseCloseRate(lastUser)) updates.closeRate = snippet(lastUser, 80);
      } else if (pend === "jobValue" || pend === "monthlyEnquiries") {
        if (/\d/.test(wordsToDigits(lastUser))) updates[pend] = snippet(lastUser, 80);
      } else if (pend === "channels") {
        const found = harvestChannels(lastUser);
        if (found.length) updates.channels = found;
      } else if ((TEXT_SLOT_KEYS as readonly string[]).includes(pend) && (text.length >= 8 || pend === "capacity" || pend === "proof")) {
        (updates as unknown as Record<string, unknown>)[pend] = text;
      }
    }

    const nextAskCountsBase = askCounts;
    const merged: CheckupSlots = { ...slots };
    for (const key of TEXT_SLOT_KEYS) {
      if (updates[key]) (merged as unknown as Record<string, unknown>)[key] = updates[key];
    }
    if (updates.channels) merged.channels = updates.channels;
    if (updates.changes) merged.changes = updates.changes;
    if (updates.otherChallenges !== undefined) merged.otherChallenges = updates.otherChallenges;
    for (const key of ["enquiries", "customers", "revenue"] as const) {
      if (updates[key]) merged[key] = updates[key];
    }
    if (read === "correction") merged.corrections = Math.min(9, slots.corrections + 1);

    // The question the owner just replied to went unanswered and has used all
    // its asks — accept the gap now. (Never at the moment of asking, and never
    // while the owner is correcting us.)
    const prevPending = slots.pending;
    if (prevPending && read !== "correction" && !isResolved(merged, prevPending) && (askCounts[prevPending] ?? 0) >= ASK_CAP[prevPending]) {
      declineSlot(merged, prevPending);
    }

    // Phase decision: done when coverage is complete after this turn, or hard caps hit.
    const stillMissing = missingAll(merged);
    const outPhase: CheckupPhase = wrapNow || stillMissing.length === 0 || userTurns >= MAX_USER_TURNS ? "done" : "interview";

    if (outPhase === "done") {
      // If the model asked another question while we must wrap, replace with a clean close.
      if (/\?/.test(reply)) reply = wrapReply();
      finalSlot = "none";
    } else {
      // Never repeat a question the conversation has already asked verbatim.
      if (/\?/.test(reply)) {
        const questionText = reply.split(/(?<=\?)/).map((s) => s.trim()).filter((s) => s.endsWith("?"));
        if (questionText.some((q) => asked.has(q.replace(/^.*?,\s*/, "").trim()) || asked.has(q))) {
          const target = stillMissing.find((k) => (askCounts[k] ?? 0) < ASK_CAP[k]);
          const fresh = target ? variantFor(target, asked, cur) : null;
          if (target && fresh) {
            reply = fresh;
            finalSlot = target;
            ownChips = target;
          }
        }
      }
      // Every interview reply must move the conversation on with a question.
      if (!/\?/.test(reply)) {
        const modelPick = finalSlot !== "none" && !isResolved(merged, finalSlot) && (askCounts[finalSlot] ?? 0) < ASK_CAP[finalSlot] ? finalSlot : null;
        const target = modelPick ?? stillMissing.find((k) => (askCounts[k] ?? 0) < ASK_CAP[k]) ?? null;
        if (target) {
          reply = `${reply.replace(/\s+$/, "")} ${questionFor(target, asked, cur)}`;
          finalSlot = target;
          ownChips = target;
        }
      }
      // Trust what the question actually asks over the model's own label.
      const actuallyAsks = classifyQuestion(reply);
      // Money trouble: a sales-funnel question nobody needs now (reply speed, how many pay…)
      // is swapped for the next money question — the owner's time goes on this week's money.
      const FUNNEL: SlotKey[] = ["closeRate", "followUp", "monthlyEnquiries", "jobValue", "pricePresentation", "lostReason", "proof", "capacity", "repeat", "targetMarket"];
      // When the wording isn't recognised, the model's own label still tells us what it asks.
      const asksAbout = actuallyAsks ?? (finalSlot !== "none" ? finalSlot : null);
      const offTopic = merged.money === true && asksAbout !== null && FUNNEL.includes(asksAbout) && !stillMissing.includes(asksAbout);
      const nextNeeded = offTopic ? stillMissing.find((k) => (askCounts[k] ?? 0) < ASK_CAP[k]) : undefined;
      if (offTopic && nextNeeded && !clarifyN) {
        const lead = reply
          .split(/(?<=[.!?])\s+/)
          .filter((s) => !s.includes("?"))
          .join(" ")
          .trim();
        reply = `${lead} ${questionFor(nextNeeded, asked, cur)}`.trim();
        finalSlot = nextNeeded;
        ownChips = nextNeeded;
      } else if (actuallyAsks && !isResolved(merged, actuallyAsks)) {
        if (actuallyAsks !== finalSlot && !clarifyN) ownChips = ownChips ?? (parsed.chips ? null : actuallyAsks);
        finalSlot = actuallyAsks;
      } else if (actuallyAsks && !clarifyN && !merged.declined.includes(actuallyAsks)) {
        // It is asking about something the owner already answered — ask the next gap instead.
        const target = stillMissing.find((k) => (askCounts[k] ?? 0) < ASK_CAP[k]);
        if (target) {
          const lead = reply
            .split(/(?<=[.!?])\s+/)
            .filter((s) => !s.includes("?"))
            .join(" ")
            .trim();
          reply = `${lead} ${questionFor(target, asked, cur)}`.trim();
          finalSlot = target;
          ownChips = target;
        }
      }
      if (finalSlot !== "none" && isResolved(merged, finalSlot)) finalSlot = stillMissing[0] ?? "none";

      // Right after the main problem and their view of it: "anything else?", asked once,
      // in the app's own words with tap answers fitted to their kind of business.
      // (Money trouble: not before this week's money is clear — "what else do you owe" comes first.)
      const moneyStillOpen = merged.money === true && (["moneyDue", "otherDebts", "cashNow", "moneyInOut", "coverPlan"] as SlotKey[]).some((k) => !isResolved(merged, k) && (nextAskCountsBase[k] ?? 0) < ASK_CAP[k]);
      const askOthersNow =
        isResolved(merged, "bottleneck") &&
        isResolved(merged, "ownerTheory") &&
        !isResolved(merged, "otherChallenges") &&
        (askCounts.otherChallenges ?? 0) < ASK_CAP.otherChallenges &&
        !moneyStillOpen &&
        !clarifyN;
      if (askOthersNow) {
        const lead =
          reply
            .split(/(?<=[.!?])\s+/)
            .filter((s) => !s.includes("?") && !/tap any|anything else|holding (the|your) business back|on your list|one at a time/i.test(s))[0]
            ?.trim() ?? "";
        reply = `${lead} ${questionFor("otherChallenges", asked, cur)}`.trim();
        finalSlot = "otherChallenges";
        ownChips = "otherChallenges";
      }
    }

    // Count an ask only when this reply really asks something.
    const nextAskCounts: AskCounts = { ...askCounts };
    if (outPhase === "interview" && finalSlot !== "none" && /\?/.test(reply) && !isResolved(merged, finalSlot)) {
      nextAskCounts[finalSlot] = (nextAskCounts[finalSlot] ?? 0) + 1;
    }
    merged.pending = outPhase === "interview" && finalSlot !== "none" ? finalSlot : undefined;

    // Not sure / skip on a question that matters: the owner hears, once and kindly, what that costs.
    const answeredPending = Boolean(slots.pending && isResolved(merged, slots.pending) && !merged.declined.includes(slots.pending));
    const skipCost = slots.pending && DODGE_RE.test(lastUser) && !answeredPending ? SKIP_COST[slots.pending] : undefined;
    if (skipCost && outPhase === "interview" && !/without|best guess|can't (work|tell|put)|leave that|broader/i.test(reply)) {
      reply = `${skipCost} ${reply.replace(/^(no problem( at all)?|that's (fine|okay|ok)|okay|ok)[,.!—–-]*\s*/i, "")}`;
    }

    reply = plainify(reply, ownerText);
    // Their own explanation was just given: the reply thanks them and asks on, with no verdict on it.
    if (slots.pending === "ownerTheory" && outPhase === "interview") reply = listenOnly(reply);
    // The checkup listens; it never rules on the cause ("it's timing, not demand") — the diagnosis does, with their figures.
    reply = neutralReply(reply, userTurns);
    if (outPhase === "done" && !reply.replace(/^(thanks — noted\.|got it\.|that's useful to know\.|thanks, that helps\.)\s*/i, "").trim()) reply = wrapReply();
    if (outPhase === "interview") reply = varyOpener(reply, transcript);

    const rawLearned = Array.isArray(parsed.learnedChips) ? parsed.learnedChips.filter((c): c is string => typeof c === "string") : [];
    // Chips show only what is NEW this turn (or corrected), and never a ratio
    // the owner did not give (no "Close rate: 2 out of 10").
    const newThisTurn = new Set<SlotKey>(SLOT_KEYS.filter((k) => !isResolved(slots, k) && isResolved(merged, k) && !merged.declined.includes(k)));
    // Other challenges they named this turn always show, so they can see they were heard.
    const otherChips = updates.otherChallenges?.length ? deriveLearnedChips({ otherChallenges: updates.otherChallenges }) : [];
    const modelChips = (rawLearned.length ? rawLearned : deriveLearnedChips(updates)).filter((c) => !otherChips.length || !/^\s*(updated:\s*)?also\b/i.test(cleanChip(c, read)));
    // Food, shops and product sellers have orders, not jobs.
    const goodsChips = ["food", "retail", "online", "product"].includes(
      businessKind({ businessType: merged.businessType, sells: merged.sells, targetMarket: merged.targetMarket, channels: merged.channels }),
    );
    const learnedChips = [...new Set([...otherChips, ...modelChips].map((c) => cleanChip(c, read)).map((c) => (goodsChips ? c.replace(/^(Updated: )?Typical job:/, "$1Typical order:") : c)))]
      .filter((c) => {
        if (c.length === 0 || !ownerGaveRatio(c, transcript)) return false;
        // "Understood as" shows what they said: never a total the model added up ("Running costs: ₦1.84m"),
        // and never an empty word standing in for it ("Also owed: named").
        if (!amountFromOwner(c, ownerText)) return false;
        if (/:\s*(named|noted|given|known|captured|recorded|mentioned|listed|yes|no|ok)\.?\s*$/i.test(c)) return false;
        const label = c.replace(/^Updated:\s*/, "").split(":")[0].trim();
        const slot = LABEL_SLOT[label];
        return !slot || read === "correction" || newThisTurn.has(slot);
      })
      // Money they gave is shown written out in full ("Cash now: ₦300,000" for "300k"), so they
      // see exactly what was understood and can correct it before it is used.
      .map((c) => {
        const slot = LABEL_SLOT[c.replace(/^Updated:\s*/, "").split(":")[0].trim()];
        return slot && (slot === "jobValue" || (MONEY_SLOTS as string[]).includes(slot)) ? amountInFull(c, cur) : c;
      })
      .slice(0, 3);

    const chips =
      outPhase === "done" || finalSlot === "none"
        ? []
        : clarifyN
          ? [`${clarifyN} out of 5`, `${clarifyN} out of 10`, `${clarifyN} out of 20`, "Not sure"]
          : ownChips
            ? chipsFor(ownChips, cur, merged)
            : answerChips(parsed.chips, finalSlot, cur, merged, ownerText);

    const result: ChatTurnResult = {
      read,
      reply,
      learnedChips,
      phase: outPhase,
      slots: merged,
      askCounts: nextAskCounts,
      chips,
      degraded: false,
    };
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[api/checkup/chat] error:", error);
    return NextResponse.json(
      {
        ok: true,
        ...fallbackTurn({ phase, slots, askCounts, lastUser, transcript, cur }),
        degraded: true,
      },
      { status: 200 },
    );
  }
}
