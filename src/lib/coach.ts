// The coaching loop — shared by the API routes and the screens (pure, no React).
//
//   diagnosis → ONE next step (an experiment or a recommendation)
//             → the owner accepts it (an experiment records a starting number)
//             → check-ins halfway and at the end ask what happened OFFLINE
//             → the result updates the experiment, the timeline and the diagnosis
//             → the next step.
//
// Most of what changes a small business happens where the app can't see it
// (WhatsApp chats, walk-ins, a price change, a slow week), so asking — briefly,
// kindly, with tap answers — is the app's only way of knowing.

import type { BusinessFacts, FocusStage, MoneyUpdates } from "./checkup";
import { parseCloseRate, wordsToDigits } from "./checkup-math";
import { businessWords } from "./business-words";

/* ------------------------------------------------------------------ */
/* Drafts — ready-to-send words, written only when the owner asks       */
/* ------------------------------------------------------------------ */

// Every kind of business writes different things: a salon needs a bio, a price
// list and a deposit policy; a bakery a flyer and thank-you cards; an online
// store product descriptions, ads and FAQs; a studio its website words,
// proposals and briefs. A message is only one of them.
export type DraftKind =
  // Messages
  | "whatsapp"
  | "sms"
  | "email"
  | "newsletter"
  | "reply"
  | "note"
  | "call-script"
  // Getting found
  | "post"
  | "ad"
  | "video"
  | "article"
  | "case-study"
  // Website and listings
  | "website"
  | "description"
  | "profile"
  | "faq"
  // Printed
  | "flyer"
  // Selling
  | "price-list"
  | "proposal"
  | "agreement"
  // Running the business
  | "brief"
  | "job-post"
  | "policy"
  | "checklist"
  | "survey"
  // Anything else
  | "ideas"
  | "other";
export const DRAFT_KINDS: DraftKind[] = [
  "whatsapp",
  "sms",
  "email",
  "newsletter",
  "reply",
  "note",
  "call-script",
  "post",
  "ad",
  "video",
  "article",
  "case-study",
  "website",
  "description",
  "profile",
  "faq",
  "flyer",
  "price-list",
  "proposal",
  "agreement",
  "brief",
  "job-post",
  "policy",
  "checklist",
  "survey",
  "ideas",
  "other",
];

export type DraftGroup = "Messages" | "Getting found" | "Website and listings" | "Printed" | "Selling" | "Running the business" | "Anything else";
const DRAFT_GROUPS: DraftGroup[] = ["Messages", "Getting found", "Website and listings", "Printed", "Selling", "Running the business", "Anything else"];

/** What an AI feature hands the screen instead of pre-written words: a button to write them. */
export interface DraftHint {
  kind: DraftKind;
  /** Button text, named after what it makes: "Write the follow-up message". */
  label: string;
  /** What the words are for and who receives them — the brief the writer gets. */
  purpose: string;
}

export interface DraftMeta {
  group: DraftGroup;
  /** Shown above the words: "Website words — ready to use". */
  noun: string;
  defaultLabel: string;
  /** What this kind is for — the AI picks a kind from these. */
  use: string;
  /** Buttons beside Copy: "Open in WhatsApp" / "Open in email" / "Open in Messages". */
  whatsapp: boolean;
  email: boolean;
  sms?: boolean;
  /** Has a subject line (email, newsletter). */
  subject?: boolean;
  /** Longer pieces (website words, an article) get more room. */
  long?: boolean;
  /** Can be posted to the specialists marketplace as a task (a brief). */
  task?: boolean;
  /** A short honest note under the words (e.g. "not legal advice"). */
  note?: string;
  /** The check-in question once the owner copied it, and its tap answers ("Not yet" last). */
  usedAsk: string;
  usedChoices: string[];
}

const SENT = ["Yes, I sent it", "Sent it to some people", "Not yet"];
const NOT_LEGAL = "Plain words, not legal advice. For anything big, ask a lawyer to check it.";

function draftMeta(
  group: DraftGroup,
  noun: string,
  defaultLabel: string,
  use: string,
  usedAsk: string,
  usedChoices: string[],
  extra: Partial<DraftMeta> = {},
): DraftMeta {
  return { group, noun, defaultLabel, use, usedAsk, usedChoices, whatsapp: false, email: false, ...extra };
}

export const DRAFT_META: Record<DraftKind, DraftMeta> = {
  whatsapp: draftMeta("Messages", "WhatsApp message", "Write the WhatsApp message", "a chat message to a customer, or a broadcast (WhatsApp, Instagram or Facebook DM)", "Did you get to send it?", SENT, { whatsapp: true }),
  sms: draftMeta("Messages", "Text message", "Write the text message", "an SMS text message, at most 160 characters", "Did you get to send it?", SENT, { sms: true }),
  email: draftMeta("Messages", "Email", "Draft the email", "an email to one customer, supplier or partner", "Did you get to send it?", SENT, { email: true, subject: true }),
  newsletter: draftMeta("Messages", "Newsletter", "Write the newsletter", "an email newsletter or update to many customers at once", "Did you get to send it?", SENT, { email: true, subject: true, long: true }),
  reply: draftMeta("Messages", "Reply", "Write my reply", "a reply to a review, complaint or comment", "Did you get to reply?", ["Yes, I replied", "Not yet"], { whatsapp: true }),
  note: draftMeta("Messages", "Note or card", "Write the note", "a short note or card: a thank-you card, a note in the package, a gift message", "Did you get to use it?", ["Yes, I'm using it", "Not yet"]),
  "call-script": draftMeta("Messages", "What to say", "Show me what to say", "what to say on a call, face to face or in a voice note", "Did you get to use it?", ["Yes, I used it", "Used it with some people", "Not yet"]),
  post: draftMeta("Getting found", "Post", "Write the post", "a social media post, caption or WhatsApp status", "Did you get to post it?", ["Yes, I posted it", "Not yet"], { whatsapp: true }),
  ad: draftMeta("Getting found", "Ad", "Write the ad", "a paid ad (Facebook/Instagram, Google, TikTok): headline, main text and button", "Is the ad running yet?", ["Yes, it's running", "Not yet"]),
  video: draftMeta("Getting found", "Video script", "Write the video script", "a script for a short video (a Reel, TikTok, YouTube Short or status video)", "Did you get to make the video?", ["Yes, I posted it", "Made it, posting soon", "Not yet"]),
  article: draftMeta("Getting found", "Article", "Write the article", "a blog post or article (for a website, LinkedIn or Medium)", "Did you get to publish it?", ["Yes, it's published", "Not yet"], { long: true }),
  "case-study": draftMeta("Getting found", "Customer story", "Write the customer story", "a short customer story or case study: their problem, what you did and the result", "Did you get to share it?", ["Yes, I shared it", "Not yet"], { long: true }),
  website: draftMeta("Website and listings", "Website words", "Write the words for my website", "words for a website or landing page: a homepage, about, services, products or contact section", "Are the words on your website yet?", ["Yes, they're up", "Some of them", "Not yet"], { long: true }),
  description: draftMeta("Website and listings", "Description", "Write the description", "a description of one product, service, package or menu item, for a listing, catalogue, online store or menu", "Did you get to use it?", ["Yes, it's up", "Some of it", "Not yet"]),
  profile: draftMeta("Website and listings", "Business profile", "Write my business profile", "a bio or business profile: an Instagram or TikTok bio, Google Business Profile, WhatsApp Business description, a directory or marketplace listing", "Did you get to update your profile?", ["Yes, it's updated", "Not yet"]),
  faq: draftMeta("Website and listings", "Questions and answers", "Write the FAQs", "frequently asked questions with short answers (for a website, a WhatsApp catalogue or Instagram highlights)", "Did you get to put them up?", ["Yes, they're up", "Not yet"], { whatsapp: true }),
  flyer: draftMeta("Printed", "Flyer or sign", "Write the flyer", "printed words: a flyer, poster, banner, shop sign, menu board, business card or label", "Did you get to print or share it?", ["Yes, it's out", "Not yet"]),
  "price-list": draftMeta("Selling", "Price options", "Lay out my price options", "price options, packages, or a simple price list or menu with prices", "Did you get to use it?", ["Yes, I'm using it", "Used it with some people", "Not yet"], { whatsapp: true }),
  proposal: draftMeta("Selling", "Proposal", "Write the proposal", "a proposal, quote or estimate for a customer: what you'll do, what's included, price, timeline and next step", "Did you get to send it?", SENT, { whatsapp: true, email: true, long: true }),
  agreement: draftMeta("Selling", "Agreement", "Write the agreement", "simple terms to agree with a customer before a job or order: what's included, payment, timeline, changes and cancellation", "Did you get to use it?", ["Yes, I'm using it", "Not yet"], { whatsapp: true, email: true, long: true, note: NOT_LEGAL }),
  brief: draftMeta("Running the business", "Brief", "Write the brief", "a brief for someone you'll hire or work with (a developer, designer, photographer, printer or supplier): what you need, by when, budget and how to reply", "Did you get to send the brief?", ["Yes, I sent it", "Not yet"], { whatsapp: true, email: true, long: true, task: true }),
  "job-post": draftMeta("Running the business", "Job post", "Write the job post", "a post to hire staff or a helper: the role, what they'll do, who fits, pay and how to apply", "Did you get to post it?", ["Yes, I posted it", "Not yet"], { whatsapp: true }),
  policy: draftMeta("Running the business", "Policy", "Write the policy", "rules customers see: deposits, bookings, lateness, cancellations, delivery, returns or refunds", "Did you get to share it?", ["Yes, it's up", "Not yet"], { whatsapp: true, note: NOT_LEGAL }),
  checklist: draftMeta("Running the business", "Checklist", "Write the checklist", "a short checklist or step-by-step routine for you or your staff", "Did you get to use it?", ["Yes, I'm using it", "Not yet"]),
  survey: draftMeta("Running the business", "Questions to ask", "Write the questions", "a few short questions to ask customers (a feedback form, survey or poll)", "Did you get to ask them?", ["Yes, I asked", "Asked some people", "Not yet"], { whatsapp: true }),
  ideas: draftMeta("Anything else", "Ideas to choose from", "Give me some ideas", "a few options to choose from: names, slogans, taglines, headlines or offer ideas", "Did you pick one?", ["Yes, I picked one", "Not yet"]),
  other: draftMeta("Anything else", "Your words", "Write it for me", "anything else written — the label says exactly what", "Did you get to use it?", ["Yes, I used it", "Not yet"]),
};

/** For the AI prompts — one source, so every feature offers the same kinds. */
export const DRAFT_KIND_ENUM = DRAFT_KINDS.join("|");
export const DRAFT_KIND_GUIDE = DRAFT_GROUPS.map(
  (g) =>
    `  · ${g}: ${DRAFT_KINDS.filter((k) => DRAFT_META[k].group === g)
      .map((k) => `${k} = ${DRAFT_META[k].use}`)
      .join("; ")}`,
).join("\n");

export type DraftTweak = "shorter" | "friendlier" | "formal";

// Kinds a model may name loosely.
const KIND_ALIASES: Record<string, DraftKind> = {
  message: "whatsapp", "whatsapp-message": "whatsapp", dm: "whatsapp", broadcast: "whatsapp", chat: "whatsapp", "follow-up": "whatsapp",
  "text-message": "sms", text: "other",
  "e-mail": "email", "email-newsletter": "newsletter", mailing: "newsletter",
  "review-reply": "reply", response: "reply", "complaint-reply": "reply",
  card: "note", "thank-you-card": "note", "thank-you-note": "note", "gift-message": "note", "package-insert": "note",
  script: "call-script", "what-to-say": "call-script", pitch: "call-script", "voice-note": "call-script", "sales-script": "call-script",
  "social-post": "post", caption: "post", status: "post", social: "post", story: "post",
  advert: "ad", ads: "ad", "ad-copy": "ad", advertisement: "ad",
  "video-script": "video", reel: "video", tiktok: "video",
  blog: "article", "blog-post": "article", "linkedin-article": "article",
  "customer-story": "case-study", "success-story": "case-study", testimonial: "case-study",
  "website-copy": "website", "website-words": "website", web: "website", "web-copy": "website", "landing-page": "website", homepage: "website", "home-page": "website", site: "website", "about-page": "website",
  "product-description": "description", listing: "description", "product-listing": "description", "menu-item": "description",
  bio: "profile", "business-profile": "profile", "google-business-profile": "profile",
  faqs: "faq", "q-and-a": "faq", "questions-and-answers": "faq",
  poster: "flyer", banner: "flyer", sign: "flyer", signage: "flyer", leaflet: "flyer", brochure: "flyer", "menu-board": "flyer", "business-card": "flyer", label: "flyer",
  "price-options": "price-list", prices: "price-list", packages: "price-list", pricing: "price-list", menu: "price-list",
  quote: "proposal", quotation: "proposal", estimate: "proposal",
  contract: "agreement", terms: "policy",
  "job-description": "job-post", "job-ad": "job-post", "job-advert": "job-post", vacancy: "job-post", hiring: "job-post",
  "returns-policy": "policy", "refund-policy": "policy", rules: "policy",
  sop: "checklist", process: "checklist", routine: "checklist", steps: "checklist",
  "feedback-form": "survey", questionnaire: "survey", poll: "survey",
  names: "ideas", slogans: "ideas", taglines: "ideas",
  general: "other", copy: "other", words: "other", document: "other",
};

/** A kind from a model or a saved record, read loosely ("Website copy" → website); null when unknown. */
export function normaliseDraftKind(raw: unknown): DraftKind | null {
  const k = String(raw ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-");
  if (!k) return null;
  return DRAFT_KINDS.find((d) => d === k) ?? KIND_ALIASES[k] ?? null;
}

// What a button label says it makes. On a tie, the earlier (more specific) wins.
const KIND_CUES: [DraftKind, RegExp][] = [
  // "brief" the noun ("the developer brief", "a brief for…"), not "a brief intro".
  ["brief", /\b(brief(?=\s*$|\s+(for|to)\b)|scope of work|specification|requirements|request for (a )?quote|rfq)\b/i],
  ["job-post", /\b(job (posts?|adverts?|ads?|listings?|openings?|descriptions?|spec)|vacanc(y|ies)|hiring (post|ad)|we('re| are) hiring|recruitment (post|ad))\b/i],
  ["proposal", /\b(proposals?|quotations?|quotes?|estimates?|pitch deck|tenders?|bids?)\b/i],
  ["agreement", /\b(agreements?|contracts?|client terms|terms of (work|engagement))\b/i],
  ["policy", /\b(polic(y|ies)|terms( and conditions| of service)?|t ?& ?cs|house rules|booking rules|(deposit|cancellation|refund|returns?|delivery) (rules|terms))\b/i],
  ["checklist", /\b(checklists?|step-by-step|routine|sop|process (steps|guide)|to-?do list)\b/i],
  ["survey", /\b(surveys?|questionnaires?|feedback (form|questions)|polls?|questions to ask)\b/i],
  ["faq", /\b(faqs?|frequently asked|questions and answers|q ?& ?a)\b/i],
  ["case-study", /\b(case stud(y|ies)|customer stor(y|ies)|success stor(y|ies))\b/i],
  ["article", /\b(articles?|blogs?( posts?)?)\b/i],
  ["newsletter", /\b(newsletters?|mailing)\b/i],
  ["video", /\b(videos?|reel script|tiktok script|youtube shorts?|voice-?over|skit)\b/i],
  ["website", /\b(web ?site|homepage|home page|landing ?page|web ?page|web copy|site copy|about us|(services?|products?|contact) (page|section)|hero (section|text|headline))\b/i],
  ["ad", /\b(ads?|adverts?|advertisements?|ad copy|sponsored post|boosted post)\b/i],
  ["profile", /\b(bio|business profile|profile (text|description)|google business( profile| description| listing)?|google maps listing|directory listing|about (section|text)|(whatsapp )?business description)\b/i],
  ["flyer", /\b(flyers?|fliers?|posters?|banners?|signage|signboard|(shop|window|door|road|store) sign|handbills?|leaflets?|brochures?|menu board|billboard|business cards?|labels?|stickers?)\b/i],
  ["call-script", /\b((?<!video )script|what to say|talking points|pitch|voice note)\b/i],
  ["note", /\b(thank-?you (cards?|notes?)|cards?|notes?|gift message|(package|packaging) insert)\b/i],
  ["reply", /\b(repl(y|ies)|respon(d|se)|answer)\b[^.]*\b(reviews?|complaints?|comments?|feedback)\b|\b(review|complaint|comment) (reply|response)\b/i],
  ["description", /\b(descriptions?|product listing|(store|shop|jumia|konga|etsy|amazon|catalog(ue)?) listing|menu (items?|descriptions?)|product (copy|text))\b/i],
  ["price-list", /\b(price ?list|price options|pricing (options|table)|packages?|rate card|menu prices)\b/i],
  ["sms", /\b(sms|text messages?)\b/i],
  ["email", /\b(e-?mails?)\b/i],
  ["post", /\b(posts?|captions?|reels?|tweets?|(whatsapp|wa) status|(instagram|ig|whatsapp|facebook|tiktok) story)\b/i],
  ["ideas", /\b(ideas?|name ideas|names for|slogans?|taglines?)\b/i],
  ["whatsapp", /\b(whats ?app|messages?|dms?|broadcast|follow-?up)\b/i],
];

// After these words a label talks ABOUT something instead of naming what it
// makes: "Announce the new website" is a message, not website words.
const ABOUT_RE = /\b(about(?!\s+(us|section|text)\b)|announc\w*|launch\w*|tell\w*|introduc\w*|promot\w*|shar(e|ing)|invit\w*|remind\w*|news of)\b.*$/i;
// A label that asks for an action, not for words: "Ask for a website review".
const NOT_WRITING_RE = /^\s*(ask|get|tell|announce|invite|remind|share|promote|call|visit|contact|reach|thank|collect|request|book)\b/i;
// The part of a label before "for / to / on…" names the thing made: "the brief for the website".
const PREPOSITION_RE = /\s(for|to|on|with|in|of|from|that|which|so|at|by)\s/i;
// A head that only says "words": "Write the copy for my website" — look past it.
const GENERIC_HEAD_RE = /\b(copy|words?|wording|text|content|intro(duction)?|headlines?|lines|blurb|version|piece)\s*$/i;

/** Every kind a text mentions, in cue order. */
function cueKinds(text: string): DraftKind[] {
  return KIND_CUES.filter(([, re]) => re.test(text)).map(([k]) => k);
}

/** Kinds named in the head of a label (latest match first — the head noun), and those after it. */
function rankedCues(label: string): { head: DraftKind[]; rest: DraftKind[]; headText: string } {
  const t = label.replace(ABOUT_RE, "");
  const cut = t.search(PREPOSITION_RE);
  const headEnd = cut < 0 ? t.length : cut;
  const head: { kind: DraftKind; end: number; order: number }[] = [];
  const rest: DraftKind[] = [];
  KIND_CUES.forEach(([kind, re], order) => {
    for (const m of t.matchAll(new RegExp(re.source, "gi"))) {
      const start = m.index ?? 0;
      if (start < headEnd) head.push({ kind, end: start + m[0].length, order });
      else if (!rest.includes(kind)) rest.push(kind);
    }
  });
  head.sort((a, b) => b.end - a.end || a.order - b.order);
  return { head: [...new Set(head.map((h) => h.kind))], rest, headText: t.slice(0, headEnd).trim() };
}

/**
 * The kind that matches what the button says it makes. Models — and answers
 * saved before there were more kinds — sometimes file website words or a brief
 * as an email; the label is what the owner tapped, so it wins when it names
 * something else and doesn't mention the kind at all. The purpose decides only
 * when there is no label.
 */
export function resolveDraftKind(kind: DraftKind | null, label: string, purpose = ""): DraftKind {
  const text = label.trim();
  if (text) {
    if (kind && cueKinds(text).includes(kind)) return kind;
    if (!NOT_WRITING_RE.test(text)) {
      const { head, rest, headText } = rankedCues(text);
      if (head.length) return head[0];
      if (rest.length && GENERIC_HEAD_RE.test(headText)) return rest[0];
    }
    return kind ?? "other";
  }
  if (kind && kind !== "other") return kind;
  return rankedCues(purpose).head[0] ?? cueKinds(purpose.replace(ABOUT_RE, ""))[0] ?? "other";
}

/** A saved or model-made hint with its kind matched to its label (see resolveDraftKind). */
export function fixDraftHint(hint: DraftHint): DraftHint {
  const kind = resolveDraftKind(normaliseDraftKind(hint.kind), hint.label ?? "", hint.purpose ?? "");
  return kind === hint.kind ? hint : { ...hint, kind };
}

/** Validate a draft hint from a model (or an old stored record). */
export function cleanDraftHint(raw: unknown): DraftHint | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const purpose = String(o.purpose ?? "").replace(/\s+/g, " ").trim().slice(0, 240);
  if (purpose.length < 8) return null;
  let label = String(o.label ?? "").replace(/\s+/g, " ").trim().slice(0, 48);
  // The app never sends anything — the button names what it WRITES.
  label = label.replace(/^(send|post|email|text|message)\b\s*(the\s+|a\s+)?/i, "Write the ");
  const usable = !(label.length < 6 || /\?$/.test(label) || /^write the\s*$/i.test(label));
  const kind = resolveDraftKind(normaliseDraftKind(o.kind), usable ? label : "", purpose);
  return { kind, label: usable ? label : DRAFT_META[kind].defaultLabel, purpose };
}

/* ------------------------------------------------------------------ */
/* The next step                                                        */
/* ------------------------------------------------------------------ */

export type NextStepKind = "experiment" | "recommendation";
/** How the experiment's count is read: "in10" = out of every 10 who ask; "count" = a plain number. */
export type CountUnit = "in10" | "count";

export interface NextStep {
  kind: NextStepKind;
  /** <= 70 chars, starts with a verb. */
  title: string;
  /** One sentence: why this comes first, from their own answers. */
  why: string;
  /** 2-3 short how-to steps. */
  how: string[];
  /** Experiment window, or when to check back on a recommendation. */
  days: number;
  /** What to count, in plain words (experiments; optional for recommendations). */
  measure?: string;
  unit?: CountUnit;
  /** How to count without any app. */
  countHow?: string;
  /** The words the app can write for this step, on request. */
  draft?: DraftHint | null;
  /** True when sending the message IS the step — the draft button is the card's main button. */
  draftIsMain?: boolean;
}

export function stepKey(step: Pick<NextStep, "title">): string {
  return step.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function stepBadge(step: Pick<NextStep, "kind" | "days">): string {
  return step.kind === "experiment" ? `Experiment · ${step.days} days` : "Recommendation";
}

const PRICE_RE = /price|expensive|cost|afford|cheap|budget/i;

/**
 * Ready-made next steps for each focus stage, best first. Used when the model
 * is unreachable, for diagnoses written before next steps existed, and to pick
 * the next untried step after a check-in.
 */
export function templateStepsFor(stage: FocusStage, facts: Partial<BusinessFacts> | null): NextStep[] {
  const priceIssue = PRICE_RE.test(`${facts?.bottleneck ?? ""} ${facts?.lostReason ?? ""}`);
  // "order" or "job", "what you sell" or "your work" — the words for this kind of business.
  const w = businessWords(facts);
  const followUpStep: NextStep = {
    kind: "experiment",
    title: "Follow up once with everyone who goes quiet after your price",
    why: "People who go quiet are often still deciding — one friendly nudge brings some of them back.",
    how: [
      "Two days after giving a price, send one short, friendly check-in",
      "Ask a simple question they can answer in one word",
      "Note each person in your notebook: replied, paid or no answer",
    ],
    days: 14,
    measure: "Out of the people who ask, how many go on to pay",
    unit: "in10",
    countHow: "Keep a tally in a notebook or your phone notes: one line for each person who asks, a tick when they pay.",
    draft: { kind: "whatsapp", label: "Write the follow-up message", purpose: "A short, friendly one-time follow-up to someone who went quiet after hearing my price" },
    draftIsMain: true,
  };
  const optionsStep: NextStep = {
    kind: "experiment",
    title: "Give three options instead of one price",
    why: "With one price the only answer is yes or no — options turn it into “which one?”.",
    how: w.goods
      ? ["Offer a small, a regular and a large or special option", "Say what each one includes in one line", "Mention that paying in parts is possible, if it is"]
      : ["Offer a small, a standard and a full option on your next quotes", "Say what each one includes in one line", "Mention that paying in parts is possible, if it is"],
    days: 14,
    measure: "Out of the people who ask, how many go on to pay",
    unit: "in10",
    countHow: "Keep the same tally as before: one line for each person who asks, a tick when they pay.",
    draft: { kind: "price-list", label: "Lay out my three options", purpose: "A small, standard and full option for my usual work, one per line, with what each includes" },
    draftIsMain: false,
  };
  const sameDayStep: NextStep = {
    kind: "experiment",
    title: "Reply to every new enquiry the same day",
    why: "People who ask usually buy from whoever answers first and makes the next step easy.",
    how: ["Reply to every new enquiry before the end of the day", "End your reply with one clear next step", "Note each person who asks, and who goes on to pay"],
    days: 14,
    measure: "Out of the people who ask, how many go on to pay",
    unit: "in10",
    countHow: "A tally in your notebook: one line for each person who asks, a tick when they pay.",
    draft: { kind: "whatsapp", label: "Write my first reply", purpose: "A quick, warm first reply to a new enquiry that moves them to the next step" },
    draftIsMain: false,
  };
  const referralStep: NextStep = {
    kind: "recommendation",
    title: "Ask your three happiest customers to pass your name on",
    why: `People who already like ${w.offer} are the cheapest way to reach new customers.`,
    how: [
      w.goods ? "Pick three customers who were really happy with their order" : "Pick three customers who were really happy with your work",
      "Send each of them a short personal message",
      "Ask every new enquiry how they heard about you",
    ],
    days: 7,
    measure: "How many new people got in touch through them",
    unit: "count",
    draft: { kind: "whatsapp", label: "Write the message to my customers", purpose: "Asking a happy past customer to recommend me to someone who might need what I do" },
    draftIsMain: true,
  };
  const visibleStep: NextStep = {
    kind: "experiment",
    title: "Make it obvious how to reach you, everywhere people see you",
    why: "Interest that never turns into a message is invisible — a clear next step catches it.",
    how: ["Put your number and one clear next step on every post, card and sign", "Use the same short line everywhere", "Count the people who get in touch each week"],
    days: 14,
    measure: "How many people get in touch in a week",
    unit: "count",
    countHow: "A tally in your notebook: one line for each new person who gets in touch.",
    draft: { kind: "post", label: "Write the post", purpose: "A short post that says what I do, who it's for and exactly how to reach me" },
    draftIsMain: false,
  };
  const pastCustomersStep: NextStep = {
    kind: "recommendation",
    title: "Message five past customers to check in",
    why: "Past customers already trust you — a friendly check-in is the easiest new work there is.",
    how: ["Pick five customers you haven't heard from in a while", "Send each a short, personal check-in", "Mention one thing you can help with now"],
    days: 7,
    measure: w.goods ? "How many replied or ordered again" : "How many replied or asked about working with you again",
    unit: "count",
    draft: { kind: "whatsapp", label: "Write the check-in message", purpose: "A friendly check-in to a past customer I haven't spoken to in a while, without sounding salesy" },
    draftIsMain: true,
  };
  const pricesStep: NextStep = {
    kind: "recommendation",
    title: w.goods ? "Raise your prices for new orders" : "Raise your prices for new work",
    why: "When you're already stretched, a higher price brings in more money without more hours.",
    how: ["Decide your new price for new enquiries only", "Keep current customers on the old price for now", "Say the new price calmly, with what's included"],
    days: 14,
    measure: "How many new enquiries still went ahead",
    unit: "count",
    draft: { kind: "whatsapp", label: "Write how to give my new price", purpose: "Telling a new enquiry my updated price in a calm, confident way, with what's included" },
    draftIsMain: false,
  };
  const hoursStep: NextStep = {
    kind: "experiment",
    title: "Write down where your hours go for one week",
    why: "You can't free up time until you can see which jobs eat it.",
    how: ["Each evening, note the main things you spent time on", "Mark the ones only you can do", "Pick one task to hand off or turn into a template"],
    days: 7,
    measure: "Hours a week spent on tasks someone else could do",
    unit: "count",
    countHow: "A short list each evening in your notebook: task and roughly how long.",
    draft: null,
  };

  switch (stage) {
    case "found":
      return [referralStep, visibleStep, pastCustomersStep];
    case "enquire":
      return [visibleStep, sameDayStep, referralStep];
    case "deliver":
      return [pricesStep, hoursStep, optionsStep];
    case "return":
      return [pastCustomersStep, referralStep, optionsStep];
    case "convert":
    default:
      return priceIssue ? [followUpStep, optionsStep, sameDayStep] : [sameDayStep, followUpStep, optionsStep];
  }
}

/** The best ready-made step for this stage that hasn't been tried yet. */
export function templateNextStep(stage: FocusStage, facts: Parameters<typeof templateStepsFor>[1], tried: string[] = []): NextStep {
  const triedKeys = new Set(tried.map((t) => stepKey({ title: t })));
  const list = templateStepsFor(stage, facts);
  return list.find((s) => !triedKeys.has(stepKey(s))) ?? list[0];
}

/** Validate a next step written by a model; anything missing comes from the fallback. */
export function cleanNextStep(raw: unknown, fallback: NextStep, clean: (s: string, cap: number) => string = (s, cap) => s.slice(0, cap)): NextStep {
  if (!raw || typeof raw !== "object") return fallback;
  const o = raw as Record<string, unknown>;
  const kind: NextStepKind = o.kind === "experiment" || o.kind === "recommendation" ? o.kind : fallback.kind;
  const title = clean(String(o.title ?? "").replace(/\s+/g, " ").trim(), 90);
  const why = clean(String(o.why ?? "").replace(/\s+/g, " ").trim(), 220);
  if (title.length < 8 || why.length < 12) return fallback;
  const how = Array.isArray(o.how)
    ? o.how
        .filter((h): h is string => typeof h === "string" && h.trim().length > 4)
        .map((h) => clean(h.replace(/\s+/g, " ").trim(), 110))
        .slice(0, 3)
    : [];
  const daysRaw = Math.round(Number(o.days));
  const days = Number.isFinite(daysRaw) ? Math.max(7, Math.min(21, daysRaw)) : fallback.days;
  const unit: CountUnit = o.unit === "count" || o.unit === "in10" ? o.unit : fallback.unit ?? "in10";
  const measure = typeof o.measure === "string" && o.measure.trim().length > 6 ? clean(o.measure.trim(), 120) : undefined;
  const countHow = typeof o.countHow === "string" && o.countHow.trim().length > 8 ? clean(o.countHow.trim(), 200) : undefined;
  const draft = cleanDraftHint(o.draft);
  return {
    kind,
    title,
    why,
    how: how.length >= 2 ? how : fallback.how,
    days,
    measure: measure ?? (kind === "experiment" ? fallback.measure ?? "Out of the people who ask, how many go on to pay" : undefined),
    unit,
    countHow: countHow ?? (kind === "experiment" ? fallback.countHow ?? "A tally in your notebook: one line for each person, a tick when it happens." : undefined),
    draft,
    draftIsMain: Boolean(draft && o.draftIsMain === true),
  };
}

/** Prompt block describing the next-step JSON (shared by the diagnosis and check-in routes). */
export const NEXT_STEP_SCHEMA = `{
    "kind": "experiment|recommendation",
    "title": "<= 70 chars, starts with a verb — the ONE thing to do next",
    "why": "1 sentence — why this comes first, from their own answers",
    "how": ["2-3 short, concrete how-to steps, each <= 90 chars"],
    "days": 14,
    "measure": "what to count, in plain words (e.g. 'Out of the people who ask, how many go on to pay')",
    "unit": "in10|count",
    "countHow": "how to count it without any app (e.g. a tally in a notebook)",
    "draft": { "kind": "${DRAFT_KIND_ENUM}", "label": "button text naming what it makes, <= 40 chars, e.g. 'Write the follow-up message'", "purpose": "what the words are for and who receives them, 1 sentence" } or null,
    "draftIsMain": true
  }`;

export const NEXT_STEP_RULES = `- nextStep.kind: "experiment" when you are not sure the cause is right (two likely causes, or a rough read) AND the change is cheap and easy to undo — it tests the cause over 7-21 days and needs something to count ("in10" = out of every 10 people who ask; "count" = a plain number like enquiries a week). "recommendation" when the fix is well proven for this situation or their answers make the cause clear; days = when to check back (7-14).
- nextStep.how is the HOW: specific steps they can follow today without any app. Each step stands on its own — never "the message above" or "see below". Never describe menus or buttons inside other apps — keep it general.
- nextStep.draft only when the step involves writing, sending or saying something the app can write (a message, email, reply, post, ad, website words, a description, a bio or profile, a flyer or sign, what to say, price options); otherwise null. Its kind is what it makes: ${DRAFT_KIND_GUIDE}. If none fits, use "other" — never squeeze website words, an ad or a sign into an email or a message. draftIsMain true only when sending or putting up those words IS the step.
- No numbers in nextStep text except the owner's own.
- If the owner has something due by a date or within a number of days (a payment, an order, a deadline), the step must fit before it: days no more than the days left, and "how" says what to do before the due date.
- Never invent a specific offer, discount, bonus or deadline for them. If an offer could help, describe it as their choice ("a small extra you're happy to give") or use [brackets] for them to fill in.`;

/* ------------------------------------------------------------------ */
/* Starting numbers and counts                                          */
/* ------------------------------------------------------------------ */

export interface CountChoice {
  label: string;
  /** Stored in the owner's words, e.g. "3 in 10". */
  value: string;
}

// Ranges stay ranges ("3 or 4 in 10" reads as 3.5) so a rough answer is never
// rounded into a change that didn't happen.
export const IN10_CHOICES: CountChoice[] = [
  { label: "None", value: "0 in 10" },
  { label: "1 or 2 in 10", value: "1 or 2 in 10" },
  { label: "3 or 4 in 10", value: "3 or 4 in 10" },
  { label: "About half", value: "5 in 10" },
  { label: "Most of them", value: "8 in 10" },
];

export const COUNT_CHOICES: CountChoice[] = [
  { label: "None", value: "0" },
  { label: "1 or 2", value: "1 or 2" },
  { label: "3 to 5", value: "3 to 5" },
  { label: "6 to 10", value: "6 to 10" },
  { label: "More than 10", value: "More than 10" },
];

/** A number to plot from a stored count ("3 in 10", "2 out of 5", "4"). */
export function countValue(raw: string | undefined | null, unit: CountUnit): number | null {
  if (!raw) return null;
  const text = wordsToDigits(raw.toLowerCase());
  if (unit === "in10") {
    const r = parseCloseRate(text);
    if (r && r.of > 0) return Math.round((r.won / r.of) * 10 * 10) / 10;
    const m = text.match(/(\d+(?:\.\d+)?)\s*in\s*10/);
    if (m) return Number(m[1]);
    if (/\bnone\b|\bno one\b|nobody|zero/i.test(text)) return 0;
    if (/half/i.test(text)) return 5;
    if (/most/i.test(text)) return 8;
    if (/few|one or two/i.test(text)) return 2;
    return null;
  }
  const range = text.match(/(\d+(?:\.\d+)?)\s*(?:to|or|-|–)\s*(\d+(?:\.\d+)?)/);
  if (range) return (Number(range[1]) + Number(range[2])) / 2;
  const n = text.match(/(\d+(?:\.\d+)?)/);
  if (n) return Number(n[1]);
  if (/\bnone\b|\bno one\b|nobody|zero/i.test(text)) return 0;
  return null;
}

export function formatCount(v: number, unit: CountUnit): string {
  const n = Math.round(v * 10) / 10;
  return unit === "in10" ? `${n} in 10` : `${n}`;
}

/** The owner's earlier estimate as a starting number, when they gave one. */
export function suggestedBaseline(step: Pick<NextStep, "unit">, facts: Pick<BusinessFacts, "closeRate"> | null): CountChoice | null {
  if (step.unit !== "in10" || !facts?.closeRate) return null;
  const v = countValue(facts.closeRate, "in10");
  if (v === null) return null;
  const rounded = Math.round(v);
  return { label: `About ${rounded} in 10 — what you told me`, value: `${rounded} in 10` };
}

export function baselineQuestion(step: Pick<NextStep, "unit" | "measure">): string {
  if (step.unit === "in10") return "Right now, out of every 10 people who ask or come in, roughly how many go on to pay?";
  const m = (step.measure ?? "how many").replace(/\.$/, "");
  return `Right now, in a normal week: ${m.charAt(0).toLowerCase()}${m.slice(1)}?`;
}

/* ------------------------------------------------------------------ */
/* Check-ins                                                            */
/* ------------------------------------------------------------------ */

export type CheckInKind = "mid" | "end" | "weekly";

export interface CheckInAnswer {
  id: string;
  question: string;
  answer: string;
  /** Typed in their own words (not a tap answer) — only these can reveal a new problem. */
  typed?: boolean;
}

export interface CheckInRecord {
  id: string;
  kind: CheckInKind;
  dueAt: string;
  doneAt?: string;
  answers?: CheckInAnswer[];
  summary?: string;
  /** What this check-in showed (kept per check-in, so a challenge's story can be told). */
  verdict?: CheckInVerdict;
  /** The count they gave, in their words. */
  after?: string;
}

export type CheckInVerdict = "working" | "no-change" | "worse" | "not-tried" | "too-early" | "unclear";

export interface CheckInResult {
  /** Warm 2-3 sentence wrap-up, said to the owner. */
  reply: string;
  verdict: CheckInVerdict;
  /** One sentence for the diagnosis update ("That ruled out slow replies — let's look at pricing next."). */
  learned: string;
  /** The count they gave, in their words. */
  after?: string;
  /** Other changes outside the app, short phrases. */
  otherChanges: string[];
  /** Answers to still-missing checkup questions, by fact key. */
  factUpdates: Partial<Record<FactKey, string>>;
  /** What they said changed in their money (paid, a plan, a new debt, cash, sales, prices) — checked on the server. */
  moneyUpdates?: MoneyUpdates | null;
  /** Mid check-in: carry on with the same step. */
  keepGoing: boolean;
  /** A small adjustment to make it easier or sharper. */
  tweak?: string;
  /** What to do next — end check-ins, or a gentler step when it wasn't tried. */
  nextStep?: NextStep | null;
  /** A new problem they mentioned, offered as a challenge to add (never added by itself). */
  newChallenge?: { title: string; stage: string; sameAs: string | null; why?: string } | null;
}

export interface CoachPrefs {
  midpoint: boolean;
  weekly: boolean;
}

export const DEFAULT_COACH_PREFS: CoachPrefs = { midpoint: true, weekly: false };

export const FREQUENCY_OPTIONS: { id: string; label: string; hint: string; prefs: CoachPrefs }[] = [
  { id: "plan", label: "Halfway and at the end", hint: "Recommended — two quick check-ins per step", prefs: { midpoint: true, weekly: false } },
  { id: "end", label: "Only at the end", hint: "One check-in when the step is done", prefs: { midpoint: false, weekly: false } },
  { id: "weekly", label: "Halfway, at the end, and weekly", hint: "Plus a 20-second “anything change?” each week", prefs: { midpoint: true, weekly: true } },
];

export function frequencyIdFor(prefs: CoachPrefs): string {
  return FREQUENCY_OPTIONS.find((o) => o.prefs.midpoint === prefs.midpoint && o.prefs.weekly === prefs.weekly)?.id ?? "plan";
}

const DAY = 86_400_000;

export function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * DAY).toISOString();
}

/** Whole days since a date (0 on the day it started). */
export function daysSince(iso: string, now = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / DAY));
}

/**
 * How far along a step is, counting only the days it ran. Picking a paused step
 * up again moves its remaining check-ins (its end among them) on by the pause,
 * so the end check-in says how many days are left; a paused step stands still
 * at the day it was paused. Day 1 is the day it started.
 */
export function stepProgress(
  st: { step: { days: number }; acceptedAt: string; pausedAt?: string; checkIns: Pick<CheckInRecord, "kind" | "dueAt" | "doneAt">[] },
  now = Date.now(),
): { day: number; daysLeft: number } {
  const days = Math.max(1, st.step.days);
  const at = st.pausedAt ? Math.min(now, new Date(st.pausedAt).getTime()) : now;
  const end = st.checkIns.filter((c) => c.kind === "end" && !c.doneAt).sort((a, b) => b.dueAt.localeCompare(a.dueAt))[0];
  const left = end ? Math.ceil((new Date(end.dueAt).getTime() - at) / DAY) : days - daysSince(st.acceptedAt, at);
  const daysLeft = Math.max(0, Math.min(days, left));
  return { day: Math.max(1, Math.min(days, days - daysLeft + 1)), daysLeft };
}

/** Check-ins for a step: halfway (if wanted), at the end, and weekly ones in between (if wanted). */
export function scheduleCheckIns(startIso: string, days: number, prefs: CoachPrefs, idPrefix: string): CheckInRecord[] {
  const out: CheckInRecord[] = [];
  const mid = Math.round(days / 2);
  if (prefs.midpoint && days >= 6) out.push({ id: `${idPrefix}-mid`, kind: "mid", dueAt: addDays(startIso, mid) });
  if (prefs.weekly) {
    for (let d = 7; d < days - 1; d += 7) {
      if (prefs.midpoint && Math.abs(d - mid) <= 2) continue;
      out.push({ id: `${idPrefix}-w${d}`, kind: "weekly", dueAt: addDays(startIso, d) });
    }
  }
  out.push({ id: `${idPrefix}-end`, kind: "end", dueAt: addDays(startIso, days) });
  return out.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

/** The next check-in that hasn't happened, and whether it is due now. */
export function nextCheckIn(checkIns: CheckInRecord[], now = Date.now()): { checkIn: CheckInRecord; due: boolean } | null {
  const pending = checkIns.filter((c) => !c.doneAt).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  if (!pending.length) return null;
  const due = pending.filter((c) => new Date(c.dueAt).getTime() <= now);
  // When several are overdue, the latest one is the one worth asking.
  if (due.length) return { checkIn: due[due.length - 1], due: true };
  return { checkIn: pending[0], due: false };
}

export function friendlyDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const diff = Math.round((new Date(d.toDateString()).getTime() - new Date(today.toDateString()).getTime()) / DAY);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  return d.toLocaleDateString("en-GB", { weekday: diff > 0 && diff < 7 ? "long" : undefined, day: "numeric", month: "short" });
}

/* ------------------------------------------------------------------ */
/* Missing answers — asked again only when they would sharpen the read  */
/* ------------------------------------------------------------------ */

export type FactKey =
  | "closeRate"
  | "followUp"
  | "lostReason"
  | "pricePresentation"
  | "monthlyEnquiries"
  | "proof"
  | "repeat"
  | "capacity";

export interface FactQuestion {
  key: FactKey;
  /** Short label for the gap. */
  gap: string;
  question: string;
  /** What not knowing it costs, said plainly. */
  cost: string;
  choices: CountChoice[];
}

export const FACT_QUESTIONS: Record<FactKey, FactQuestion> = {
  closeRate: {
    key: "closeRate",
    gap: "How many people go on to pay",
    question: "Out of every 10 people who ask or come in, roughly how many end up paying?",
    cost: "Without it, I can't tell whether the gap is in finding people or in winning them — or work out what fixing it is worth.",
    choices: [
      { label: "1 or 2", value: "2 out of 10" },
      { label: "3 or 4", value: "3 out of 10" },
      { label: "About half", value: "5 out of 10" },
      { label: "Most of them", value: "8 out of 10" },
    ],
  },
  followUp: {
    key: "followUp",
    gap: "What happens when people go quiet",
    question: "When someone asks and then goes quiet, what usually happens?",
    cost: "Without it, I can't tell whether people drift off after the first chat — one of the most common hidden leaks.",
    choices: [
      { label: "I follow up once or twice", value: "I follow up once or twice" },
      { label: "I wait for them to come back", value: "I wait for them to come back" },
      { label: "Depends how busy I am", value: "It depends how busy I am" },
      { label: "I reply fast but don't chase", value: "I reply fast but don't chase people who go quiet" },
    ],
  },
  lostReason: {
    key: "lostReason",
    gap: "Why people don't go ahead",
    question: "When people don't go ahead, what do they usually say or do?",
    cost: "This tells me whether it's the price, trust or timing — each needs a different fix.",
    choices: [
      { label: "They say it's too expensive", value: "They say it's too expensive" },
      { label: "They just stop replying", value: "They just stop replying" },
      { label: "They go with someone else", value: "They go with someone else" },
      { label: "They say “later”", value: "They say they'll come back later" },
    ],
  },
  pricePresentation: {
    key: "pricePresentation",
    gap: "How you give your price",
    question: "How do you usually give your price?",
    cost: "How the price lands often decides whether people pay — without it the advice stays general.",
    choices: [
      { label: "A quick figure on WhatsApp", value: "A quick figure on WhatsApp" },
      { label: "A written quote", value: "A written quote" },
      { label: "After a call or visit", value: "After a call or visit" },
      { label: "It's on my page or menu", value: "It's on my page or price list" },
    ],
  },
  monthlyEnquiries: {
    key: "monthlyEnquiries",
    gap: "How many people ask each month",
    question: "In a normal month, roughly how many people ask about buying?",
    cost: "Without it, I can't work out what winning one more person is worth.",
    choices: [
      { label: "1 to 5", value: "1 to 5 a month" },
      { label: "6 to 15", value: "6 to 15 a month" },
      { label: "16 to 40", value: "16 to 40 a month" },
      { label: "More than 40", value: "More than 40 a month" },
    ],
  },
  proof: {
    key: "proof",
    gap: "Whether people see examples first",
    question: "Before hearing your price, do new people see examples — photos, past work or reviews?",
    cost: "People who haven't seen what they'd get can only compare on price.",
    choices: [
      { label: "Yes, photos or reviews", value: "Yes, I show photos or reviews first" },
      { label: "Sometimes", value: "Sometimes" },
      { label: "Not really", value: "Not really" },
    ],
  },
  repeat: {
    key: "repeat",
    gap: "Whether customers come back",
    question: "Do past customers come back or order again?",
    cost: "Customers who come back are usually the cheapest growth — I can't tell if that's open to you yet.",
    choices: [
      { label: "Yes, often", value: "Yes, often" },
      { label: "Sometimes", value: "Sometimes" },
      { label: "Rarely — mostly one-off", value: "Rarely — mostly one-off work" },
    ],
  },
  capacity: {
    key: "capacity",
    gap: "Room for more work",
    question: "Could you take on more work right now?",
    cost: "If you're already full, more enquiries won't help — the price or the process will.",
    choices: [
      { label: "Yes, plenty more", value: "Yes, plenty more" },
      { label: "A little more", value: "A little more" },
      { label: "No, I'm full", value: "No, I'm full" },
    ],
  },
};

/** Gaps that weaken the read most, first. Money questions are asked by the stake card instead. */
const FACT_PRIORITY: FactKey[] = ["closeRate", "followUp", "lostReason", "pricePresentation", "proof", "repeat", "capacity", "monthlyEnquiries"];

export function missingFacts(facts: Partial<BusinessFacts> | null, opts: { limit?: number; exclude?: FactKey[] } = {}): FactQuestion[] {
  if (!facts) return [];
  const exclude = new Set(opts.exclude ?? []);
  return FACT_PRIORITY.filter((k) => !exclude.has(k))
    .filter((k) => {
      const v = facts[k];
      return !(typeof v === "string" && v.trim().length > 0 && !/^(not sure|don't know|skip)/i.test(v.trim()));
    })
    .map((k) => FACT_QUESTIONS[k])
    .slice(0, opts.limit ?? 3);
}

/* ------------------------------------------------------------------ */
/* The check-in conversation (asked by the screen, read by the server)  */
/* ------------------------------------------------------------------ */

export interface CheckInQuestion {
  id: string;
  text: string;
  /** Why it is asked, in a few words. */
  why?: string;
  choices: string[];
  placeholder: string;
}

export const NOT_TRIED_RE = /\bnot yet\b|\bno\b|\bnope\b|didn'?t|did not|haven'?t|have not|couldn'?t|forgot|no time/i;

/**
 * Something said in their own words that matters more than the step: exhaustion,
 * wanting to give up, threats or harassment. Once it is said, the check-in stops
 * asking routine questions and reads what they told it.
 */
export const SERIOUS_RE =
  /\b(exhausted|tired of|so tired|i'?m tired|burn(ed|t)? out|can'?t cope|cannot cope|can'?t go on|give up|giving up|hopeless|depress\w*|suicid\w*|kill myself|end it all|(close|closing|shut|shutting) (it all|everything|down|the (shop|business|place))|threat\w*|harass\w*|shaming|blackmail\w*|(messag|call|text|contact|disturb|bother|embarrass|insult|abus|disgrac)\w* (all )?(my|our) (contacts|family|friends|relatives|people|customers|neighbou?rs|colleagues))\b/i;

/** A step measured by a yes/no question ("Did the supplier agree…?") is answered yes or no, not counted. */
export function isYesNoMeasure(measure: string | undefined): boolean {
  return /^(did|has|have|is|are|was|were|will|can|could|do|does)\b/i.test((measure ?? "").trim());
}

/** "Yes, he agreed" → "yes"; "Not yet" / "No" → "no"; anything else (a story, "partly") → null. */
export function yesNoAnswer(text: string | null | undefined): "yes" | "no" | null {
  const t = (text ?? "").trim().toLowerCase();
  if (/^(yes|yeah|yep|yup|yes o|(he|she|they|it|we) (did|agreed|said yes)|agreed|done)\b/.test(t)) return "yes";
  if (/^(no|nope|not yet|(he|she|they|it|we) (didn'?t|did not|refused|said no)|refused)\b/.test(t)) return "no";
  return null;
}

const SAID_NO_RE = /\b(refused|declined|rejected|said no|did ?n[o']t agree|won'?t agree|would ?n[o']t agree|not agreed?|turned (me|us|it) down)\b/i;
const SAID_YES_RE = /\b(agreed|accepted|said yes|approved|allowed (me|us)|gave (me|us) (more |extra )?time|signed)\b/i;

/**
 * The step's result, when the owner already typed it in an earlier answer ("Yes, I sent it —
 * the landlord agreed…"), so the check-in doesn't ask for it again. Read only from their own
 * typed words, and only when it is unambiguous; null otherwise.
 */
export function resultAlreadyTold(step: NextStep, answers: CheckInAnswer[]): string | null {
  const said = answers
    .filter((a) => a.typed && a.id !== "count")
    .map((a) => a.answer)
    .join(" ");
  if (!said.trim()) return null;
  if (isYesNoMeasure(step.measure)) {
    if (SAID_NO_RE.test(said)) return "No";
    if (SAID_YES_RE.test(said)) return "Yes";
    return null;
  }
  const t = wordsToDigits(said.toLowerCase());
  if (step.unit === "in10") {
    const ratios = [...t.matchAll(/\b(\d{1,3})\s+(?:out of|of|in)\s+(\d{1,4})\b/g)];
    return ratios.length === 1 && Number(ratios[0][1]) <= Number(ratios[0][2]) ? `${ratios[0][1]} out of ${ratios[0][2]}` : null;
  }
  const counts = [...new Set([...t.matchAll(/\b(\d{1,4})\s+(?:new\s+)?(?:people|customers|clients|orders|bookings|sales|of them|paid|bought|booked|came|signed up)\b/g)].map((m) => m[1]))];
  return counts.length === 1 ? counts[0] : null;
}

const DISTRESS_RE =
  /\b(exhausted|tired of|so tired|i'?m tired|burn(ed|t)? out|can'?t cope|cannot cope|can'?t go on|give up|giving up|hopeless|(close|closing|shut|shutting) (it all|everything|down|the (shop|business|place)))\b/i;
const CARE_RE =
  /\b(sounds (really |so )?(hard|heavy|exhausting|tough)|that'?s a lot|i'?m (so |really )?sorry|you'?re not alone|i hear (you|how)|(you|you'?re) (sound )?(tired|exhausted)|look after yourself|someone you trust)\b/i;
const SAFETY_FIRST_RE = /not acceptable|screenshot|report (it|them|this)|keep (yourself )?safe/i;

/**
 * When the owner says they're exhausted or thinking of closing, the reply answers that —
 * briefly and kindly — before the business (after a safety point, if there is one). Added in
 * code when the model skipped it, which it did even with the rule in its instructions.
 */
export function withCare(reply: string, ownerText: string): string {
  if (!DISTRESS_RE.test(ownerText) || CARE_RE.test(reply)) return reply;
  const care = "I'm sorry it feels this heavy — you don't have to decide anything big today, and we'll take it one step at a time.";
  const sentences = reply.trim().split(/(?<=[.!?])\s+/);
  const at = sentences.length > 1 && SAFETY_FIRST_RE.test(sentences[0]) ? 1 : 0;
  return [...sentences.slice(0, at), care, ...sentences.slice(at)].join(" ");
}
export const NOT_COUNTED_RE = /not sure|didn'?t count|did not count|no idea|don'?t know/i;
export const NOTHING_CHANGED_RE = /^(nothing|no|none|nope)\b|nothing (else )?changed|no (other )?changes?/i;

interface QuestionContext {
  step: NextStep;
  kind: CheckInKind;
  facts: Partial<BusinessFacts> | null;
  lastDraft?: { label: string; at: string } | null;
  answers: CheckInAnswer[];
}

/** The next question in a check-in, or null when it's done. 3-5 taps, about 30 seconds. */
export function nextCheckInQuestion(ctx: QuestionContext): CheckInQuestion | null {
  const { step, kind, facts, lastDraft, answers } = ctx;
  const got = (id: string) => answers.find((a) => a.id === id)?.answer;
  const tried = got("tried");

  if (tried === undefined) {
    if (lastDraft && step.draftIsMain) {
      const when = friendlyDate(lastDraft.at);
      const whenText = when === "today" ? "Earlier today" : when === "yesterday" ? "Yesterday" : `On ${when}`;
      const what = /^(write|draft|show)\b/i.test(lastDraft.label)
        ? lastDraft.label.replace(/^(write|draft|show)(\s+me)?\s+(the\s+|my\s+)?/i, "the ")
        : `“${lastDraft.label}”`;
      // "Did you send it?" fits a message — not website words, an ad or a sign.
      const used = DRAFT_META[step.draft ? fixDraftHint(step.draft).kind : "whatsapp"];
      return {
        id: "tried",
        text: `${whenText} you copied ${what}. ${used.usedAsk}`,
        choices: used.usedChoices,
        placeholder: "Or tell me in your own words…",
      };
    }
    return {
      id: "tried",
      text: `How's it going with “${step.title}”? Did you get to try it?`,
      choices: ["Yes, most of the time", "Some of the time", "Not yet", "I did it a bit differently"],
      placeholder: "Or tell me in your own words…",
    };
  }

  const notTried = NOT_TRIED_RE.test(tried) && !/some|bit|differ/i.test(tried);
  if (notTried && got("blocker") === undefined) {
    return {
      id: "blocker",
      text: "No problem at all — what got in the way?",
      why: "So the next step fits your week better.",
      choices: ["Ran out of time", "Wasn't sure how to start", "Didn't feel right for my customers", "Something else came up"],
      placeholder: "What got in the way?",
    };
  }

  // Already told in their own words ("the landlord agreed"): not asked again.
  if (!notTried && got("count") === undefined && resultAlreadyTold(step, answers) === null) {
    // Always the step's own measure, so the result compares like with like.
    if (step.unit === "count") {
      const what = (step.measure ?? "how many").replace(/[.?!\s]+$/, "").replace(/^./, (c) => c.toLowerCase());
      // "Did the landlord agree…?" is answered yes or no — count buttons ("3 to 5") make no sense for it.
      if (isYesNoMeasure(step.measure)) {
        return {
          id: "count",
          text: `Since you started, ${what}?`,
          why: "This is how we'll know if the step worked.",
          choices: ["Yes", "Partly", "Not yet", "Not sure"],
          placeholder: "Yes, no, or what happened",
        };
      }
      return {
        id: "count",
        text: `Since you started, ${what}?`,
        why: "A rough count is how we'll know if it's working.",
        choices: ["None yet", "1 or 2", "3 to 5", "More than 5", "Not sure — I didn't count"],
        placeholder: "e.g. 3",
      };
    }
    return {
      id: "count",
      text: "Since you started, out of the people who asked or came in, how many went on to pay?",
      why: "This is how we'll know if it's working.",
      choices: ["None yet", "1 or 2 out of 10", "3 or 4 out of 10", "About half", "Not sure — I didn't count"],
      placeholder: "e.g. 2 out of 6",
    };
  }

  if (got("changes") === undefined) {
    return {
      id: "changes",
      text: "Did anything else change outside the app since you started — your prices, a promotion, a slow or busy week, extra help?",
      why: "So we don't credit (or blame) this step for something else.",
      choices: ["Nothing else changed", "I changed my prices", "I ran a promotion", "It was a slow or busy period", "I got some help"],
      placeholder: "What else changed?",
    };
  }

  // They told us something serious in their own words: no more routine questions now.
  if (answers.some((a) => a.typed && SERIOUS_RE.test(a.answer))) return null;
  // Money trouble: the missing checkup answers are about winning customers — not now.
  if (facts?.money) return null;

  // A few still-missing checkup answers, spread over time instead of asked all at once.
  const slotLimit = kind === "end" ? 2 : 1;
  const askedSlots = answers.filter((a) => a.id.startsWith("fact:")).length;
  if (askedSlots < slotLimit) {
    const already = new Set(answers.filter((a) => a.id.startsWith("fact:")).map((a) => a.id.slice(5)));
    const q = missingFacts(facts, { limit: 8 }).find((f) => !already.has(f.key));
    if (q) {
      return {
        id: `fact:${q.key}`,
        text: `${askedSlots === 0 ? "One more, if you have a second. " : "Last one. "}${q.question}`,
        why: q.cost,
        choices: [...q.choices.map((c) => c.label), "Not sure"],
        placeholder: "Your answer…",
      };
    }
  }
  return null;
}

/** A short, kind acknowledgement for an answer — and, when they weren't sure, what that costs. */
export function acknowledge(questionId: string, answer: string): string {
  const a = answer.toLowerCase();
  // Never a breezy "good to know" for something heavy.
  if (SERIOUS_RE.test(a)) return "Thank you for telling me — that sounds really hard. Let me read everything you've said together.";
  if (questionId === "tried") {
    if (NOT_TRIED_RE.test(a) && !/some|bit|differ/.test(a)) return "That's okay — weeks get busy.";
    if (/some/.test(a)) return "Some is a real start.";
    if (/differ/.test(a)) return "Adapting it to your customers is smart.";
    return "Great — that's the hard part done.";
  }
  if (questionId === "blocker") return "Thanks for being honest — that helps me suggest something that fits.";
  if (questionId === "count") {
    if (NOT_COUNTED_RE.test(a)) return "No problem. Without a count I can only go on how it felt, so this read will be rougher — a quick tally next time makes it clear.";
    if (/none/.test(a)) return "Thanks — an early zero is still useful to know.";
    return "Thanks — that's exactly what I needed.";
  }
  if (questionId === "changes") {
    if (NOTHING_CHANGED_RE.test(a)) return "Good — then the result is easier to read.";
    return "Good to know — I'll keep that in mind when I read the result.";
  }
  if (questionId.startsWith("fact:")) {
    if (/not sure|skip|don't know/.test(a)) return "No problem — we'll come back to it when it matters.";
    return "Thanks, that sharpens things.";
  }
  return "Thanks.";
}

/** Map a tapped label back to its stored value for fact questions. */
export function factValueFor(key: FactKey, answer: string): string | null {
  if (/^not sure|^skip|don't know/i.test(answer.trim())) return null;
  const q = FACT_QUESTIONS[key];
  const choice = q.choices.find((c) => c.label === answer);
  return (choice?.value ?? answer).trim().slice(0, 160) || null;
}

/** Turn a count answer into the owner's words for the record ("1 or 2 out of 10" → "2 in 10"). */
export function countAnswerText(answer: string, unit: CountUnit): string | null {
  if (NOT_COUNTED_RE.test(answer)) return null;
  const a = answer.trim();
  if (/^none/i.test(a)) return unit === "in10" ? "0 in 10" : "0";
  if (unit === "in10") {
    if (/1 or 2/.test(a)) return "1 or 2 in 10";
    if (/3 or 4/.test(a)) return "3 or 4 in 10";
    if (/half/i.test(a)) return "5 in 10";
    const r = parseCloseRate(a);
    // "2 out of 6" stays in their words; its value reads as about 3.3 in 10.
    if (r) return a.slice(0, 40);
    const v = countValue(a, "in10");
    return v === null ? a.slice(0, 40) : formatCount(v, "in10");
  }
  if (/1 or 2/.test(a)) return "1 or 2";
  if (/3 to 5/.test(a)) return "3 to 5";
  if (/more than 5/i.test(a)) return "More than 5";
  return a.slice(0, 40);
}

/** Deterministic read of the numbers — the model's verdict is checked against it. */
export function numbersVerdict(baseline: string | undefined, after: string | null | undefined, unit: CountUnit): "up" | "down" | "same" | null {
  const b = countValue(baseline, unit);
  const a = countValue(after, unit);
  if (b === null || a === null) return null;
  const tolerance = unit === "in10" ? 0.5 : 0.5;
  if (a - b > tolerance) return "up";
  if (b - a > tolerance) return "down";
  return "same";
}
