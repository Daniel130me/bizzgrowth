import { NextRequest, NextResponse } from "next/server";
import { completeText } from "@/lib/ai";
import { extractJson, type BusinessFacts } from "@/lib/checkup";
import { DRAFT_META, normaliseDraftKind, resolveDraftKind, type DraftKind, type DraftTweak } from "@/lib/coach";
import { businessWords } from "@/lib/business-words";
import { HONESTY_RULES, NUMBER_RULES } from "@/lib/ai-voice";
import { collectAllowedNumbers, ungroundedNumbers } from "@/lib/grounding";
import { parseAmount, plainify } from "@/lib/checkup-math";

export const runtime = "nodejs";

/**
 * Drafts on demand — ready-to-use words written only when the owner asks
 * ("Write the follow-up message", "Write the words for my website", "Write the
 * developer brief"), from their latest checkup answers. The owner uses them
 * themselves; nothing is ever sent or published for them. Every figure is
 * checked against the owner's own numbers; anything unknown stays in
 * [brackets] for them to fill in.
 */

const FORMAT: Record<DraftKind, string> = {
  whatsapp:
    "A WhatsApp message: 2-5 short sentences, warm and natural, like the owner texting a customer. Start with a greeting using [name]. No subject line.",
  sms: "A text message (SMS): at most 160 characters in total, plain and clear, naming the business so the person knows who it's from. No emoji. No link unless the owner gave one.",
  email:
    "An email: a short subject line (<= 60 chars) and a body of 3-6 short sentences, greeting with [name] and signed off with [your name].",
  newsletter:
    'An email newsletter to many customers at once: a subject line (<= 60 chars) in "subject"; a body that opens with a short greeting to everyone (e.g. "Hello [first name]"), then 2-4 short parts, each a heading line followed by 1-3 sentences (news, something useful, an offer only if the owner gave one), one clear thing to do next (how to order, book or reply), and a sign-off with [your name]. About 120-250 words.',
  reply:
    "A reply to a review, complaint or comment, written as the business: 2-4 short sentences. Thank them by [name], acknowledge their point without arguing or blaming, say what you'll do about it, and for anything private invite them to continue on [your number] or in a private message. Calm and kind, never defensive — other customers may read it.",
  note: "A short note or card (a thank-you card, a note in the package, a gift message): 1-3 warm sentences to [name], signed with [your name] or the business name. At most one gentle line about ordering or booking again; nothing else salesy.",
  "call-script":
    "What to say on a call, face to face or in a voice note: 3-5 short lines, each something natural to say, in order. Include one line for when the customer hesitates.",
  post: "A short social post or WhatsApp status: 2-4 short lines saying what they do, who it's for and exactly how to reach them. No greeting to [name]. At most two hashtags, only if natural.",
  ad: 'A paid ad in labelled lines: "Headline:" (<= 40 characters), "Main text:" (1-3 short sentences: who it\'s for, what they get, and why act now — only an offer the owner gave, else [your offer]), "Button:" (one of Order now, Shop now, Book now, Send message, Call now, Learn more — whichever fits how they sell). If the purpose names Google, instead give "Headlines:" (3 lines, each <= 30 characters) and "Descriptions:" (2 lines, each <= 90 characters). No greeting, no hashtags.',
  video:
    'A script for a short video (a Reel, TikTok, YouTube Short or status video) in labelled lines: "Hook:" (what to say or show in the first seconds), then 3-6 numbered lines, each "Show: … — Say: …", then "End:" (how to order, book or reach them), then "Caption:" (1-2 short lines). Spoken, natural words; only things the owner can really show — anything else in [brackets].',
  article:
    'A blog post or article for their website or LinkedIn: the article\'s title in "title"; a body with an opening paragraph that names the reader\'s problem, 3-5 short parts each with a heading line and 2-4 sentences of practical, honest advice from what the owner does, and a closing paragraph with one thing to do next. About 300-600 words. No made-up statistics, studies or quotes.',
  "case-study":
    'A short customer story (case study) in labelled parts: "The customer:" (the kind of customer — a real name only if the owner gave one, else [customer]), "What they needed:", "What we did:", "The result:" (only results the owner gave, else [the result]), and a closing line in quotes only if the owner gave the customer\'s words, else [a line from the customer]. About 120-250 words.',
  website:
    'Words for a website or landing page, laid out in labelled parts the owner can paste into their site: "Headline:" (<= 10 words: what they offer and who it\'s for), "Subheadline:" (1-2 sentences), then 2-4 short sections, each a heading line followed by 1-3 sentences (for example what they offer, why people choose them, how to order or book, and proof — only proof the owner gave, else [a customer\'s words]), then "Button:" a short call to action that fits how they sell (Order now, Book a visit, Get a quote, Chat on WhatsApp). If the purpose names one part (an intro, an about section, a services section), write only that part. Speak to visitors: no greeting, no [name], no sign-off.',
  description:
    'A description of one product, service, package or menu item, for a listing, catalogue, online store or menu: one line naming it plainly, then 2-4 short lines starting with "- " on what it is, what\'s in it or included, sizes or options, and who it\'s for. Only facts the owner gave; anything else in [brackets] (e.g. [size], [ingredients], [delivery time]). No greeting.',
  profile:
    "A business profile. For a social bio (Instagram, TikTok, X): at most 150 characters on 1-3 short lines — what they do, for whom, where, and how to order or book. Otherwise (Google Business Profile, WhatsApp Business description, a directory or marketplace listing): 2-4 plain sentences, under 500 characters — what they offer, who it's for, where they are and how to reach them. No greeting.",
  faq: 'Frequently asked questions: 5-8 questions this business\'s customers really ask (price, how to order or book, delivery or how long it takes, payment, location, changes or refunds — whichever fit), each as "Q: …" on one line and "A: …" in 1-2 short sentences on the next. Anything the owner didn\'t tell you stays in [brackets].',
  flyer:
    'Words for a flyer, poster, banner, shop sign, menu board, business card or label — few words, easy to read at a glance: "Headline:" (<= 8 words), then 1-3 short lines on what they offer and why it\'s worth it, an offer only if the owner gave one (else [your offer, if any]), then how to reach or find them: [phone or WhatsApp number], [address], [opening hours] where they fit. A sign, banner or business card: just the essentials. No greeting.',
  "price-list":
    "Price options: by default exactly 3 lines — a small, a standard and a full option (for goods: sizes or quantities; for services: what's included) — each with what it includes. If the purpose asks for a price list or menu, list the items it names instead, one per line. Use only prices inside the owner's own typical job or order range, or [price] when unknown. Then one short line about paying in parts, if it fits.",
  proposal:
    'A proposal or quote for a customer, in labelled parts: "For:" [customer name], "What you need:" (1-2 sentences in the customer\'s terms), "What I\'ll do:" (3-6 lines starting with "- "), "What\'s included:" (and "Not included:" where it helps), "Price:" (only a price inside the owner\'s own typical range, else [price]), "Timeline:" [start and finish], "Payment:" [deposit and balance], "Next step:" (how to say yes). Confident and clear.',
  agreement:
    'Simple terms for a job or order, in plain words, as 5-8 short numbered points: what\'s included, what\'s not, price and payment ([deposit] and [balance] unless the owner gave them), timeline, changes or extra work, cancellation and refunds, and how both sides agree (e.g. "Reply YES to agree"). Plain words, never legal jargon.',
  brief:
    'A brief for someone the owner will hire or work with (a developer, designer, photographer, printer, supplier or helper), in labelled parts: "What I need:" (1-2 sentences), "About my business:" (1-2 sentences from what they told us), "Who it\'s for:" (their customers), "It must include:" (2-6 lines starting with "- "), "Examples I like:" [links or names], "Timeline:" [date], "Budget:" [budget] (a figure only if the owner gave one), "To reply:" (what to send back, e.g. examples of similar work and a price). No greeting, no sign-off.',
  "job-post":
    'A post to hire staff or a helper, in labelled parts: "Role:" (the job), 1-2 sentences about the business, "What you\'ll do:" (3-5 lines starting with "- "), "Who we\'re looking for:" (2-4 lines), "Pay and hours:" ([pay] and [hours] unless the owner gave them), "Where:" [location], "How to apply:" (e.g. send a message to [number] with [what to send]). Fair and plain; nothing about age, gender, religion or tribe.',
  policy:
    "A short policy customers will see, in plain words: a one-line title, then 3-6 short numbered rules (deposits, bookings and lateness, cancellations, delivery times, returns and refunds — only what the purpose is about), fair and friendly, with any amounts or time limits the owner didn't give in [brackets].",
  checklist:
    'A short checklist or routine: a one-line title, then 5-10 short lines starting with "☐ ", in the order they happen, each a concrete action someone can tick off. For staff: plain enough for a new person on their first day.',
  survey:
    'A few short questions to ask customers (a feedback form, survey or poll): one line to introduce it, then 3-6 numbered questions, each with tap answers in parentheses where it helps, e.g. "(Yes / No)" or "(1 to 5)", and at most one open question (left open — nothing in brackets after it). Short, friendly and quick to answer.',
  ideas:
    "8-10 options to choose from (names, slogans, taglines, headlines or offer ideas — whatever the button asks for), numbered, one per line, each short. Varied in style, fitting what they sell and who they serve; never the name of another real business.",
  other:
    "Exactly the thing the button names, in the layout that thing normally has (labelled parts or short lines where it helps). Keep it short and usable. Greet [name] only if it's a message to one person.",
};

const TWEAK: Record<DraftTweak, string> = {
  shorter: "Rewrite the CURRENT VERSION shorter — about half the length — keeping the meaning, the layout and every [placeholder].",
  friendlier: "Rewrite the CURRENT VERSION warmer and friendlier — still natural, never over the top — keeping the layout and every [placeholder].",
  formal: "Rewrite the CURRENT VERSION more formal and polished — still short and kind — keeping the layout and every [placeholder].",
};

const SYSTEM = `You write ready-to-use words for a small-business owner — any kind of business: a shop, a food seller, a salon, an online store, a trade, a studio, a supplier to other businesses. Many are in Nigeria and sell through WhatsApp, Instagram, calls, walk-ins or an online store. The owner uses the words THEMSELVES — you never send or publish anything.

RULES
- The button the owner tapped names exactly what they want. Write THAT, in the layout under WHAT TO WRITE. If the layout and the button ever disagree, follow the button — never turn website words, a brief, an ad, a bio or a sign into an email or a chat message.
- Messages (WhatsApp, a text, an email, a reply, a note) speak to one person and greet [name]. Everything else (website words, an ad, a post, a description, a profile, a flyer, a brief, a policy) speaks to whoever reads it: no greeting, no [name], no sign-off.
- Write in the owner's own voice ("I", or "we" for the business). Warm, plain and confident; never pushy or salesy. Short sentences.
- These are the OWNER's words to THEIR customers. Never sign them as, mention or promote Nellovia (or any AI tool), and never write as an AI: the only sign-off is the owner's name or the business name, as a [bracket] when you don't have it.
- Make it specific to what they sell and who they serve. Anything you don't know (a name, a day, what's included, a price, an address) goes in [square brackets], e.g. [name], [day], [what's included].
- Never invent facts, guarantees, discounts, deadlines, reviews, awards, customers or prices. Prices only inside the owner's own typical job or order range.
- No markdown (no #, no **). Labelled lines like "Headline:" are fine. No emoji, except at most one in a WhatsApp message or a post when it fits naturally.

${NUMBER_RULES}

${HONESTY_RULES}

Return ONLY valid JSON, no markdown:
{ "title": "<= 60 chars: what this is", "subject": "email or newsletter only — the subject line; otherwise null", "body": "the exact words" }`;

interface DraftBody {
  kind?: string;
  purpose?: string;
  label?: string;
  workspaceName?: string;
  currency?: string;
  location?: string;
  website?: string;
  facts?: Partial<BusinessFacts> | null;
  tweak?: string;
  current?: string;
}

function businessLines(name: string, f: Partial<BusinessFacts> | null | undefined, location?: string, website?: string): string {
  const rows: [string, string | undefined][] = [
    ["Where they are", location],
    ["Their website", website],
    ["What they sell", f?.whatTheySell],
    ["Who pays them", f?.customers],
    ["How people find them", f?.channels?.length ? f.channels.join(", ") : undefined],
    ["A typical job or order", f?.jobValue],
    ["How they give the price", f?.pricePresentation],
    ["When people don't buy", f?.lostReason],
    ["How they follow up", f?.followUp],
  ];
  return [
    `BUSINESS: ${name}`,
    ...rows.filter((r): r is [string, string] => typeof r[1] === "string" && r[1].trim().length > 0).map(([k, v]) => `- ${k}: ${v}`),
  ].join("\n");
}

/** Hard limits the owner would hit when pasting: an SMS (160), a social bio (150), ad headlines (Google 30/90, others 40). */
function layoutProblems(kind: DraftKind, label: string, purpose: string, text: string): string[] {
  const problems: string[] = [];
  const brief = `${label} ${purpose}`;
  if (kind === "sms" && text.length > 160) {
    problems.push(`The text message is ${text.length} characters; it must be at most 160.`);
  }
  if (kind === "profile" && /\b(bio|instagram|tiktok|twitter)\b/i.test(brief) && text.length > 150) {
    problems.push(`The bio is ${text.length} characters; a social bio must be at most 150.`);
  }
  if (kind === "ad") {
    const linesUnder = (heading: string) => {
      const m = text.match(new RegExp(`${heading}:[ \\t]*\\n([\\s\\S]*?)(?:\\n[ \\t]*\\n|\\n[A-Z][\\w ]*:|$)`, "i"));
      return m ? m[1].split("\n").map((l) => l.replace(/^[-•\d.)\s]+/, "").trim()).filter(Boolean) : [];
    };
    if (/google/i.test(brief)) {
      const long = linesUnder("Headlines").filter((l) => l.length > 30);
      const longDesc = linesUnder("Descriptions").filter((l) => l.length > 90);
      if (long.length) problems.push(`Google headlines must be at most 30 characters; too long: ${long.map((l) => `"${l}" (${l.length})`).join(", ")}.`);
      if (longDesc.length) problems.push(`Google descriptions must be at most 90 characters; ${longDesc.length} of them are longer.`);
    } else {
      const headline = text.match(/^Headline:[ \t]*(.+)$/im)?.[1]?.trim();
      if (headline && headline.length > 40) problems.push(`The headline is ${headline.length} characters; it must be at most 40.`);
    }
  }
  return problems;
}

/** Plain, honest words when the model is unreachable — placeholders instead of guesses.
 *  null where a skeleton would be no help (ideas, an article, anything else). */
function templateDraft(kind: DraftKind, name: string, f: Partial<BusinessFacts> | null | undefined): { title: string; subject?: string; body: string } | null {
  const sells = f?.whatTheySell?.trim() || "[what you offer]";
  const Sells = `${sells.charAt(0).toUpperCase()}${sells.slice(1)}`;
  const w = businessWords(f);
  const who = name && name !== "my business" ? name : "us";
  const act = w.goods ? "Order" : "Book or ask";
  switch (kind) {
    case "email":
      return {
        title: "Follow-up email",
        subject: `Following up from ${who}`,
        body: `Hi [name],\n\nThank you for getting in touch with ${who}. I wanted to follow up on [what you asked about] and see if you have any questions.\n\nI'm happy to [next step] whenever it suits you.\n\nBest regards,\n[your name]`,
      };
    case "sms":
      return { title: "Text message", body: `${who}: [your news or offer in one short line]. ${act} on [your number].` };
    case "newsletter":
      return {
        title: "Newsletter",
        subject: `News from ${who}`,
        body: `Hello [first name],\n\n[Your news in one or two sentences.]\n\nWhat's new\n[What's new at ${who}]\n\n[Something useful, or an offer if you have one]\n\n${act} on [your number] or [your link].\n\n[your name]`,
      };
    case "reply":
      return { title: "Your reply", body: "Thank you for telling us, [name]. I'm sorry about [what went wrong] — that's not what we want for you. Please message me on [your number] so I can put it right." };
    case "note":
      return { title: "Thank-you note", body: `Thank you, [name]! It means a lot that you chose ${who}. [A personal line about their ${w.sale}.]\n— [your name]` };
    case "post":
      return { title: "Short post", body: `${Sells} — for [who it's for].\nMessage me on [your number] and I'll [next step].` };
    case "call-script":
      return {
        title: "What to say",
        body: "Thanks for asking about [what they need].\nCan I ask what matters most to you — the timing, the price or how it's done?\nHere's what I'd suggest: [your suggestion].\nIf it helps, we can start small with [smaller option] and go from there.",
      };
    case "ad":
      return { title: "Your ad", body: `Headline: ${Sells} for [who it's for]\nMain text: [Why it's worth it, in one sentence.] [Your offer, if any.]\nButton: ${w.goods ? "Shop now" : "Send message"}` };
    case "video":
      return {
        title: "Video script",
        body: `Hook: [The first thing you say or show — the problem or the result]\n1. Show: [what to show] — Say: [what to say]\n2. Show: [what to show] — Say: [what to say]\n3. Show: [what to show] — Say: [what to say]\nEnd: ${act} on [your number].\nCaption: ${Sells} — [why it's worth it].`,
      };
    case "case-study":
      return { title: "Customer story", body: `The customer: [customer]\nWhat they needed: [what they needed]\nWhat we did: [what you did]\nThe result: [the result]\n"[A line from the customer]"` };
    case "website":
      return {
        title: "Words for your website",
        body: [
          `Headline: ${Sells} for [who it's for] in [your area]`,
          `Subheadline: [The main reason people choose ${who}, in one sentence.]`,
          "",
          w.goods ? "What we sell" : "What we do",
          "[2-3 lines on what's included or on offer]",
          "",
          `Why people choose ${who}`,
          "[A real reason — e.g. quality, speed, care or being close by]",
          "",
          w.goods ? "How to order" : "How it works",
          "1. [How to reach you or place an order]",
          "2. [What happens next]",
          "3. [When they get it]",
          "",
          `Button: ${w.goods ? "Order now" : "Get in touch"}`,
        ].join("\n"),
      };
    case "description":
      return {
        title: "Description",
        body: `${Sells}\n- What it is: [a short, plain description]\n- ${w.goods ? "What's in it: [materials or ingredients]" : "What's included: [what's included]"}\n- ${w.goods ? "Sizes or options: [sizes or options]" : "How long it takes: [time]"}\n- Price: [price]`,
      };
    case "profile":
      return { title: "Your business profile", body: `${Sells} for [who it's for] in [your area].\n${act} on WhatsApp: [your number]` };
    case "faq":
      return {
        title: "Questions and answers",
        body: `Q: How much does it cost?\nA: [price or price range]\n\nQ: How do I ${w.goods ? "order" : "book"}?\nA: [how to order or book]\n\nQ: How long does it take?\nA: [delivery or turnaround time]\n\nQ: How do I pay?\nA: [payment options]\n\nQ: Where are you?\nA: [address or area]`,
      };
    case "flyer":
      return { title: "Flyer", body: `Headline: [your big promise in a few words]\n${Sells} — [why it's worth it]\n[Your offer, if any]\n${w.goods ? "Order" : "Call or WhatsApp"}: [phone number] · [address]` };
    case "price-list":
      return {
        title: "Three options",
        body: "Small — [what's included] — [price]\nStandard — [what's included] — [price]\nFull — [what's included] — [price]\nYou can pay in parts if that's easier.",
      };
    case "proposal":
      return {
        title: "Proposal",
        body: `For: [customer name]\nWhat you need: [their need in one sentence]\nWhat I'll do:\n- [step]\n- [step]\nWhat's included: [what's included]\nPrice: [price]\nTimeline: [start and finish]\nPayment: [deposit and balance]\nNext step: reply "yes" and I'll [next step].`,
      };
    case "agreement":
      return {
        title: "Simple agreement",
        body: "1. What's included: [what's included]\n2. Not included: [anything not included]\n3. Price and payment: [price] — [deposit] before we start, the balance [when]\n4. Timeline: [start and finish]\n5. Changes: changes after we start may cost extra — we'll agree them first.\n6. Cancellation: [your cancellation and refund terms]\nReply YES to agree.",
      };
    case "brief":
      return {
        title: "Brief",
        body: `What I need: [what you need done]\nAbout my business: ${who} — ${sells}.\nWho it's for: [your customers]\nIt must include:\n- [must-have]\n- [must-have]\nExamples I like: [links or names]\nTimeline: [when you need it]\nBudget: [your budget]\nTo reply: send examples of similar work and your price.`,
      };
    case "job-post":
      return {
        title: "Job post",
        body: `Role: [job title] at ${who}\n[One line about the business]\nWhat you'll do:\n- [task]\n- [task]\nWho we're looking for:\n- [skill or quality]\nPay and hours: [pay] · [hours]\nWhere: [location]\nHow to apply: message [your number] with [what to send].`,
      };
    case "policy":
      return { title: "Policy", body: "[Policy title]\n1. [Rule]\n2. [Rule]\n3. [Rule]\nQuestions? Message [your number]." };
    case "checklist":
      return { title: "Checklist", body: "[Checklist title]\n☐ [First step]\n☐ [Next step]\n☐ [Next step]\n☐ [Last step]" };
    case "survey":
      return {
        title: "Questions to ask",
        body: `We'd love your thoughts — it takes a minute.\n1. How happy were you with your ${w.sale}? (1 to 5)\n2. Would you recommend us to a friend? (Yes / Maybe / No)\n3. What should we do better?`,
      };
    case "article":
    case "ideas":
    case "other":
      return null;
    case "whatsapp":
    default:
      return {
        title: "WhatsApp message",
        body: `Hi [name], it's [your name] from ${who}. I just wanted to check in about [what you asked about] — is there anything I can answer for you? Happy to help whenever you're ready.`,
      };
  }
}

export async function POST(request: NextRequest) {
  let body: DraftBody = {};
  try {
    body = (await request.json()) as DraftBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  const purpose = String(body.purpose ?? "").trim().slice(0, 300);
  const label = String(body.label ?? "").replace(/\s+/g, " ").replace(/"/g, "'").trim().slice(0, 60);
  if (purpose.length < 5) {
    return NextResponse.json({ ok: false, error: "Say what the words are for" }, { status: 400 });
  }
  // The label is what the owner tapped: a saved answer that filed website words
  // or a brief as an email is written as what it says it is.
  const kind = resolveDraftKind(normaliseDraftKind(body.kind), label, purpose);
  const meta = DRAFT_META[kind];
  const maxBody = meta.long ? 4500 : 1500;
  const name = String(body.workspaceName ?? "my business").slice(0, 120);
  const location = String(body.location ?? "").trim().slice(0, 80) || undefined;
  const website = String(body.website ?? "").trim().slice(0, 120) || undefined;
  const facts = body.facts ?? null;
  const tweak = (["shorter", "friendlier", "formal"] as const).find((t) => t === body.tweak);
  const current = String(body.current ?? "").trim().slice(0, maxBody);

  const brief = [`WHAT THE OWNER TAPPED: "${label || meta.defaultLabel}"`, `WHAT IT'S FOR: ${purpose}`, "", businessLines(name, facts, location, website)].join("\n");
  const prompt = [`WHAT TO WRITE (${meta.noun}): ${FORMAT[kind]}`, brief, tweak && current ? `\nCURRENT VERSION:\n${current}\n\n${TWEAK[tweak]}` : ""].join("\n");

  // Figures may come only from the owner (never from the layout's own limits, like "150 characters").
  const allowed = collectAllowedNumbers([brief, tweak && current ? current : ""].join("\n"));
  const priceRange = parseAmount(facts?.jobValue);
  const ownerText = [facts?.whatTheySell, facts?.customers].filter(Boolean).join("\n");
  const fallback = templateDraft(kind, name, facts);

  let feedback = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    // Long pieces (website words, an article, a proposal, a brief) need more than the fast profile's 20 s.
    const raw = await completeText(SYSTEM, attempt === 0 ? prompt : `${prompt}\n\n${feedback}`, {
      maxTokens: meta.long ? 2000 : 900,
      profile: "fast",
      timeoutMs: meta.long ? 35_000 : undefined,
    });
    if (raw === null) break;
    const parsed = extractJson<{ title?: string; subject?: string | null; body?: string }>(raw);
    const text = String(parsed?.body ?? "").replace(/\r/g, "").trim();
    if (!parsed || text.length < 15) {
      feedback = "YOUR PREVIOUS ANSWER WAS NOT VALID JSON. Return only the JSON object.";
      continue;
    }
    const invented = ungroundedNumbers(`${text} ${parsed.subject ?? ""}`, allowed, { priceRange });
    if (invented.length) {
      feedback = `YOUR PREVIOUS ANSWER USED FIGURES THE OWNER NEVER GAVE (${invented.join(", ")}). Use [price] or another [placeholder] instead.`;
      continue;
    }
    // One retry for a length the owner couldn't paste; after that the panel shows the count instead.
    const problems = layoutProblems(kind, label, purpose, text);
    if (problems.length && attempt === 0) {
      feedback = `YOUR PREVIOUS ANSWER WAS TOO LONG: ${problems.join(" ")} Write it again within the limits, keeping everything else.`;
      continue;
    }
    return NextResponse.json({
      ok: true,
      kind,
      draft: {
        title: plainify(String(parsed.title ?? "").trim(), ownerText).slice(0, 70) || fallback?.title || meta.noun,
        subject: meta.subject && parsed.subject ? String(parsed.subject).trim().slice(0, 90) : undefined,
        body: plainify(text, ownerText).slice(0, maxBody),
      },
      degraded: false,
    });
  }

  // Unreachable or never clean: honest template — or, for a tweak, a plain local edit.
  if (tweak && current) {
    const sentences = current.split(/(?<=[.!?])\s+/);
    const body2 = tweak === "shorter" && sentences.length > 2 ? sentences.slice(0, Math.ceil(sentences.length / 2)).join(" ") : current;
    return NextResponse.json({ ok: true, kind, draft: { title: "Your draft", body: body2 }, degraded: true });
  }
  if (!fallback) {
    return NextResponse.json({ ok: false, error: "Couldn't write it just now" }, { status: 503 });
  }
  return NextResponse.json({ ok: true, kind, draft: fallback, degraded: true });
}
