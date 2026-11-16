import { NextRequest, NextResponse } from "next/server";
import { completeText } from "@/lib/ai";
import { extractJson, type BusinessFacts } from "@/lib/checkup";
import type { Brief, BriefSection } from "@/lib/types";

export const runtime = "nodejs";

const KINDS = ["weekly", "monthly"] as const;

const SYSTEM = `You are the report writer inside bizzGrowth. You write the FIRST business brief for a small-business owner from their checkup facts — before measured data exists. The brief must read like a consultant's honest note, not a marketing document.

Return ONLY valid JSON, no markdown:
{
  "title": "e.g. 'Weekly brief — <business name>' (<= 70 chars)",
  "sections": [
    { "heading": "This week", "paragraphs": ["2-3 sentences summarising where the business stands, using ONLY the facts provided"] },
    { "heading": "What we know", "bullets": ["3-5 short bullets, each traced to the owner's own words or stated trends"] },
    { "heading": "Watch-outs", "bullets": ["1-3 short bullets: risks implied by their stated trends or changes — qualitative only"] },
    { "heading": "Next steps", "bullets": ["2-4 short, concrete actions that do NOT require measured data"] },
    { "heading": "Data gaps", "paragraphs": ["1-2 sentences naming what connected data or entered totals would settle first, and why"] }
  ]
}

HARD RULES
- NEVER invent a number, percentage, or currency amount not present in the facts. Direction words from their stated trends are fine.
- Keep every section specific to THIS business (name what they sell, their channels, their goal).
- No emoji, no markdown, plain professional English.`;

interface BriefInput {
  workspaceName?: string;
  country?: string;
  kind?: string;
  facts?: BusinessFacts;
  months?: { label: string; revenue?: number; enquiries?: number; customers?: number }[];
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as BriefInput;
    const facts = body.facts;
    if (!facts) {
      return NextResponse.json({ ok: false, error: "Missing checkup facts" }, { status: 400 });
    }

    const name = (body.workspaceName ?? "Your business").slice(0, 120);
    const country = (body.country ?? "Nigeria").slice(0, 80);
    const kind = (KINDS as readonly string[]).includes(String(body.kind)) ? (body.kind as "weekly" | "monthly") : "weekly";

    const userPrompt = [
      `Business: ${name} (${country})`,
      `Type: ${facts.businessType}`,
      `What they sell: ${facts.whatTheySell}`,
      `Customers: ${facts.customers}`,
      `Goal: ${facts.primaryGoal}`,
      `Channels: ${facts.channels.join(", ") || "not specified"}`,
      `Stated trends: enquiries ${facts.trends.enquiries}, customers ${facts.trends.customers}, revenue ${facts.trends.revenue}`,
      `Recent changes: ${facts.recentChanges.join("; ") || "none reported"}`,
      body.months?.length
        ? `Owner-entered months (their own numbers): ${JSON.stringify(body.months.slice(-3))}`
        : "Owner-entered months: none yet",
    ].join("\n");

    const raw = await completeText(SYSTEM, userPrompt, { maxTokens: 1200 });
    const parsed = extractJson<{ title?: unknown; sections?: unknown }>(raw);

    if (!parsed || !Array.isArray(parsed.sections) || parsed.sections.length === 0) {
      return NextResponse.json({ ok: false, error: "No brief produced" }, { status: 502 });
    }

    const sections: BriefSection[] = (parsed.sections as Record<string, unknown>[])
      .filter((s) => s && typeof s.heading === "string")
      .map((s) => ({
        heading: String(s.heading).slice(0, 60),
        paragraphs: Array.isArray(s.paragraphs)
          ? s.paragraphs.filter((p: unknown) => typeof p === "string").map((p) => String(p).slice(0, 500)).slice(0, 3)
          : undefined,
        bullets: Array.isArray(s.bullets)
          ? s.bullets.filter((b: unknown) => typeof b === "string").map((b) => String(b).slice(0, 200)).slice(0, 5)
          : undefined,
      }))
      .slice(0, 6);

    const brief: Brief = {
      id: `brief-ai-${kind}-${Date.now().toString(36)}`,
      businessId: "user-workspace",
      kind,
      period: new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
      title: String(parsed.title ?? `${kind === "weekly" ? "Weekly" : "Monthly"} brief — ${name}`).slice(0, 90),
      sections,
    };

    return NextResponse.json({ ok: true, brief, degraded: false });
  } catch (error) {
    console.error("[api/brief/generate] error:", error);
    return NextResponse.json({ ok: false, error: "Generation failed" }, { status: 500 });
  }
}
