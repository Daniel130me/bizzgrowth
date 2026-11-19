// One voice and one source of truth for every AI feature in bizzGrowth.
// Server-side prompt building blocks: the plain-language rules, the number
// rules, the patterns experienced consultants look for, and the business
// context formatted the same way for Ask, insights, briefs and diagnoses.

import { FOCUS_STAGES, type BusinessContextPayload } from "./checkup";
import { currencySymbol, stakeLinesForPrompt } from "./checkup-math";

export const VOICE_RULES = `VOICE — EVERY ANSWER
- Speak to the owner as "you": warm, direct and confident, like a trusted consultant who knows their business and has seen many like it.
- Plain everyday words a market trader understands, short sentences. Never use: signed, sign up, leads, prospects, conversion, convert, funnel, pipeline, CTR, traffic, visitors, impressions, acquisition, CAC, ROAS, retention, churn, ROI, KPI, metrics, B2B, B2C, leverage, optimise — unless the owner used the word first (if measured data uses such a term, explain it in plain words).
- Never assume they have a website, ads, an app or a CRM — a notebook, WhatsApp or a phone call is fine.
- Never blame or scold. Describe what happens and the opportunity.
- Be specific to THIS business — name what they sell, who they serve, how people find them, what they told you. If a sentence would fit any business, rewrite it.
- No emoji, no markdown.`;

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
      lines.push("", "WHAT THE OWNER TOLD US IN THEIR CHECKUP (their own answers):");
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
    if (d.insight) lines.push(`- What we noticed: ${d.insight}`);
    if (d.focusStage) lines.push(`- Focus: ${FOCUS_STAGES.find((s) => s.id === d.focusStage)?.label ?? d.focusStage}`);
    if (d.stake) lines.push(`- What fixing it is worth: ${d.stake.figure} ${d.stake.label}`);
    if (d.steps?.length) {
      lines.push("- Their plan this week:");
      d.steps.forEach((s) => lines.push(`  - ${s} — ${d.stepsDone?.includes(s) ? "DONE" : "not done yet"}`));
    }
    if (d.tools?.length) lines.push(`- Ready-made help they already have: ${d.tools.map((t) => t.title).join("; ")}`);
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
