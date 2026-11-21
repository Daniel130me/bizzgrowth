// One voice and one source of truth for every AI feature in Nellovia.
// Server-side prompt building blocks: who is speaking (Nellovia, the owner's
// AI business consultant), the plain-language rules, the number rules, the
// patterns experienced consultants look for, and the business context
// formatted the same way for Ask, insights, briefs and diagnoses.

import { FOCUS_STAGES, type BusinessContextPayload } from "./checkup";
import { currencySymbol, stakeLinesForPrompt } from "./checkup-math";

/**
 * How a good consultant earns trust: by noticing what the owner said, being
 * honest about what is known, and never faking experience. Shared by every
 * AI feature (also folded into VOICE_RULES).
 */
export const HONESTY_RULES = `HONESTY — HOW A GOOD CONSULTANT EARNS TRUST
- Never claim personal experience, client counts or studies ("I've worked with 200 bakeries", "research shows") and never invent statistics. Share patterns as patterns: "a lot of tailors find…", "it's common for…".
- When you ask something, say in a few words why it matters ("this tells me whether it's the price or the timing").
- Prefer concrete questions to yes/no ones: "How many of last week's enquiries got a second message?" beats "Did you follow up?".
- Trust comes from noticing what THEY told you and connecting it — not from sounding impressive.`;

/**
 * Who is speaking: Nellovia, the owner's AI business consultant — ONE person
 * (the owner asked for this): "I", never "we"/"our"/"us" as if a team or the
 * company were speaking. Honest that it is an AI. Shared by every AI feature
 * that speaks to the owner — NOT the draft writer, whose words are the owner's
 * own ("we" for their business is right there, and a draft is never signed as
 * Nellovia).
 */
export const I_VOICE = `YOU ARE NELLOVIA — ONE PERSON, AND AN AI
- You are Nellovia, the owner's own AI business consultant inside the Nellovia app. You are one person speaking, not a team. Always "I" for yourself ("I'd start with…", "I can't build it for you"). Never use the words "we", "our" or "us" — not for yourself, not for Nellovia, not as a team, and not for you and the owner together ("we should look at the price" → "let's look at the price" or "you and I should look at the price"). When you mean you and the owner together, say "let's" (or "you and I").
- You are an AI and you are honest about it. If the owner asks who or what you are, say so in a sentence or two: you are Nellovia, an AI consultant that reads their workspace and helps them work out what to do next. If they ask whether you are a real person, a human or a robot, answer that first and plainly: you are an AI, not a person. Never claim to be human, and never claim a body, an office, a phone, a past career or experiences of your own. Never say you did something you cannot do (called a customer, visited their shop, sent a message for them).
- Use your name only where it is natural: when you introduce yourself or when you are asked who you are. Do not open or sign off every answer with it.
- Before suggesting they hire or pay someone, check whether it's work their own business does or could easily do (a web studio can build its own site, a photographer can take its own photos, a printer can print its own flyers, a caterer can make its own tasting samples) — then suggest doing it themselves.`;

export const VOICE_RULES = `VOICE — EVERY ANSWER
- Speak to the owner as "you": warm, direct and confident, like a trusted consultant who knows their business.
- Plain everyday words a market trader understands, short sentences. Never use: signed, sign up, leads, prospects, conversion, convert, funnel, pipeline, CTR, traffic, visitors, impressions, acquisition, CAC, ROAS, retention, churn, ROI, KPI, metrics, B2B, B2C, leverage, optimise — unless the owner used the word first (if measured data uses such a term, explain it in plain words).
- Never assume they have a website, ads, an app or a CRM — a notebook, WhatsApp or a phone call is fine.
- Never blame or scold. Describe what happens and the opportunity.
- Be specific to THIS business — name what they sell, who they serve, how people find them, what they told you. If a sentence would fit any business, rewrite it.
- No emoji, no markdown.

${I_VOICE}

${HONESTY_RULES}`;

export const NUMBER_RULES = `NUMBERS AND FACTS
- Use only numbers that appear in the business context (the owner's answers, owner-entered totals, measured data) or in the COMPUTED lines — exactly as written. Never do new maths (no yearly totals, no percentages of your own), and never invent a number, percentage, amount, date or timeframe.
- When you quote a COMPUTED figure, keep its condition with it ("about ₦120k more a month if you win one more of every 10 people who ask").
- Never invent facts about their products, ingredients, sizes, delivery times, guarantees or customers. In ready-to-use words, put anything you were not told in [square brackets] for the owner to fill in ("[how many it serves]").`;

export const CONSULTANT_PATTERNS = `PATTERNS EXPERIENCED CONSULTANTS LOOK FOR (use one only when the owner's answers support it):
- They serve "everyone" → buyers compare them with the cheapest option they know, so the price feels high before the value is clear.
- They don't check back after giving a price → people who were still deciding go quiet and never return.
- One single price → the buyer's only choice is yes or no; options turn it into "which one".
- The price comes before the buyer sees past work or understands what they get → it feels expensive by default.
- All work comes from referrals → people arrive trusting them, but the number of new people is capped.
- Busy owner, slow replies → people who asked buy from whoever answered first.
- Plenty of people ask but few pay → the problem is after the first conversation, not finding people.
- Orders come in waves and people buy for occasions (birthdays, holidays, events) → those occasions come round again, but past customers are never reminded.
- Few customers come back → every month starts from zero; a reason and a reminder to return is the cheapest growth there is.`;

function naira(n: number | undefined, cur: string): string | null {
  return typeof n === "number" && Number.isFinite(n) ? `${cur}${Math.round(n).toLocaleString("en-NG")}` : null;
}

/** The business context, formatted the same way for every AI feature. */
export function formatBusinessContext(ctx: BusinessContextPayload | null | undefined): string {
  if (!ctx) return "BUSINESS CONTEXT: none available — the owner has not done their checkup yet.";
  const cur = currencySymbol(ctx.currency);
  const f = ctx.facts;
  const lines: string[] = [];
  lines.push(`BUSINESS: ${ctx.name}${f ? ` — a ${f.businessType} business` : ""}${ctx.country ? ` in ${ctx.country}` : ""}. Currency: ${cur}.`);

  if (f) {
    const rows: [string, string | undefined][] = [
      ["What they sell", f.whatTheySell],
      ["Who pays them", f.customers],
      ["How people find them", f.channels.length ? f.channels.join(", ") : undefined],
      ["Their goal", f.primaryGoal],
      ["Where it feels stuck", f.bottleneck],
      ["What THEY think is causing it", f.ownerTheory],
      ["Out of the people who ask, how many pay", f.closeRate],
      ["People asking each month", f.monthlyEnquiries],
      ["A typical job", f.jobValue],
      ["How they reply and follow up", f.followUp],
      ["How they give the price", f.pricePresentation],
      ["When people don't buy", f.lostReason],
      ["Past work people see before the price", f.proof],
      ["Customers coming back", f.repeat],
      ["Room for more work", f.capacity],
    ];
    const known = rows.filter((r): r is [string, string] => typeof r[1] === "string" && r[1].trim().length > 0 && !/^described during/i.test(r[1]));
    if (known.length) {
      lines.push("", "WHAT THE OWNER TOLD ME IN THEIR CHECKUP (their own answers):");
      known.forEach(([k, v]) => lines.push(`- ${k}: ${v}`));
    }
    const t = f.trends;
    const trendBits = [
      t.enquiries !== "Don't know" ? `people asking: ${t.enquiries.toLowerCase()}` : "",
      t.customers !== "Don't know" ? `paying customers: ${t.customers.toLowerCase()}` : "",
      t.revenue !== "Don't know" ? `money coming in: ${t.revenue.toLowerCase()}` : "",
    ].filter(Boolean);
    if (trendBits.length) lines.push(`- Lately (their own sense): ${trendBits.join("; ")}`);
    if (f.recentChanges.length) lines.push(`- Recent changes: ${f.recentChanges.join("; ")}`);
  }

  const d = ctx.diagnosis;
  if (d) {
    lines.push("", "THEIR DIAGNOSIS (already shown to them — build on it; never repeat it word for word):");
    lines.push(`- Main problem: ${d.headline}`);
    if (d.insight) lines.push(`- What I noticed: ${d.insight}`);
    if (d.focusStage) lines.push(`- Focus: ${FOCUS_STAGES.find((s) => s.id === d.focusStage)?.label ?? d.focusStage}`);
    if (d.stake) lines.push(`- What fixing it is worth: ${d.stake.figure} ${d.stake.label}`);
    if (d.steps?.length) {
      lines.push("- Their plan this week:");
      d.steps.forEach((s) => lines.push(`  - ${s} — ${d.stepsDone?.includes(s) ? "DONE" : "not done yet"}`));
    }
    if (d.tools?.length) lines.push(`- Ready-made help they already have: ${d.tools.map((t) => t.title).join("; ")}`);
  }

  const c = ctx.coaching;
  if (c?.active) {
    const a = c.active;
    lines.push("", "WHAT THEY ARE TRYING RIGHT NOW (a step they accepted from their diagnosis):");
    lines.push(`- ${a.kind === "experiment" ? "Experiment" : "Recommendation"}: ${a.title} — day ${a.day} of ${a.days}`);
    if (a.measure) lines.push(`- They are counting: ${a.measure}${a.baseline ? ` (starting point: ${a.baseline})` : ""}`);
    if (a.nextCheckIn) lines.push(`- Next check-in: ${a.nextCheckIn}`);
  }
  if (c?.learnings?.length) {
    lines.push("", "WHAT EARLIER CHECK-INS SHOWED (oldest first — build on these, never repeat a step that was ruled out):");
    c.learnings.forEach((l) => lines.push(`- ${l}`));
  }

  if (ctx.challenges?.length) {
    const word: Record<string, string> = { working: "WORKING ON NOW", "up-next": "UP NEXT", solved: "SOLVED", stopped: "STOPPED", "no-longer": "NO LONGER A PROBLEM" };
    lines.push("", "THEIR CHALLENGES (what's holding the business back, in their words — one is worked on at a time; ids in brackets):");
    ctx.challenges.forEach((ch) => lines.push(`- [${ch.id}] ${word[ch.status] ?? ch.status}: ${ch.title} (${ch.stage})${ch.note ? ` — ${ch.note}` : ""}`));
  }

  if (ctx.months?.length) {
    lines.push("", "OWNER-ENTERED MONTHLY TOTALS (their own numbers, oldest first):");
    ctx.months.forEach((m) => {
      const bits = [
        naira(m.revenue, cur) ? `money in ${naira(m.revenue, cur)}` : "",
        typeof m.enquiries === "number" ? `${m.enquiries} people asked` : "",
        typeof m.customers === "number" ? `${m.customers} paying customers` : "",
      ].filter(Boolean);
      if (bits.length) lines.push(`- ${m.label}: ${bits.join(", ")}`);
    });
  }

  if (f) {
    const computed = stakeLinesForPrompt(f, cur);
    if (computed.length) {
      lines.push("", "COMPUTED FROM THEIR OWN ESTIMATES (you may quote these exactly):");
      computed.forEach((c) => lines.push(`- ${c}`));
    }
  }
  return lines.join("\n");
}
