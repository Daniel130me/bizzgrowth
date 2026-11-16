// Server-side helpers for the Specialists marketplace. API routes only —
// never import from client components (uses the Prisma client directly).
//
// Design notes:
// - The roster is the marketplace's supply side: vetted humans showcasing
//   proficiency (Fiverr-style profiles with rates, ratings, portfolios).
// - Tasks posted by owners receive BIDS from invited specialists
//   (Upwork-style bidding). The combination is the product decision:
//   showcase + bidding.
// - Matchmaking is AI-first through the shared gateway (src/lib/ai.ts) with
//   an honest deterministic fallback: when the AI is unavailable we say so
//   and match by category + skill overlap instead of pretending.

import { db } from "./db";
import { completeText } from "./ai";
import type { Specialist, MarketTask } from "@prisma/client";

// ---------- DTOs (serialised to the client) ----------

export interface PortfolioItem {
  title: string;
  blurb: string;
}

export interface SpecialistDTO {
  id: string;
  name: string;
  headline: string;
  category: string;
  skills: string[];
  hourlyRate: number;
  rating: number;
  reviews: number;
  completedJobs: number;
  responseTime: string;
  location: string;
  languages: string[];
  bio: string;
  portfolio: PortfolioItem[];
  badges: string[];
  available: string;
  verified: boolean;
}

export interface BidDTO {
  id: string;
  taskId: string;
  amount: number;
  days: number;
  coverNote: string;
  inviteSource: string;
  status: string;
  createdAt: string;
  specialist: SpecialistDTO;
}

export interface TaskDTO {
  id: string;
  workspaceId: string;
  businessName: string;
  title: string;
  description: string;
  category: string;
  skills: string[];
  budgetMin: number | null;
  budgetMax: number | null;
  urgency: string;
  source: string;
  sourceRef: string | null;
  sourceTitle: string | null;
  status: string;
  awardedBidId: string | null;
  matchNote: string | null;
  createdAt: string;
  bidsCount: number;
}

export interface MatchItem {
  specialistId: string;
  reason: string;
  /** "ai" = AI-matched with a grounded reason; "rule" = category/skill overlap. */
  source: "ai" | "rule";
  score: number;
  specialist: SpecialistDTO;
}

export interface MatchResult {
  aiInterpreted: boolean;
  category: string;
  skillsToSeek: string[];
  note: string;
  matches: MatchItem[];
}

// ---------- Parsing helpers ----------

function parseArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function parsePortfolio(raw: string): PortfolioItem[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((p) => p && typeof p.title === "string" && typeof p.blurb === "string")
      .map((p) => ({ title: String(p.title), blurb: String(p.blurb) }));
  } catch {
    return [];
  }
}

export function toSpecialistDTO(s: Specialist): SpecialistDTO {
  return {
    id: s.id,
    name: s.name,
    headline: s.headline,
    category: s.category,
    skills: parseArray(s.skills),
    hourlyRate: s.hourlyRate,
    rating: s.rating,
    reviews: s.reviews,
    completedJobs: s.completedJobs,
    responseTime: s.responseTime,
    location: s.location,
    languages: parseArray(s.languages),
    bio: s.bio,
    portfolio: parsePortfolio(s.portfolio),
    badges: parseArray(s.badges),
    available: s.available,
    verified: s.verified,
  };
}

export function toTaskDTO(t: MarketTask & { _count?: { bids: number } }): TaskDTO {
  return {
    id: t.id,
    workspaceId: t.workspaceId,
    businessName: t.businessName,
    title: t.title,
    description: t.description,
    category: t.category,
    skills: parseArray(t.skills),
    budgetMin: t.budgetMin,
    budgetMax: t.budgetMax,
    urgency: t.urgency,
    source: t.source,
    sourceRef: t.sourceRef,
    sourceTitle: t.sourceTitle,
    status: t.status,
    awardedBidId: t.awardedBidId,
    matchNote: t.matchNote,
    createdAt: t.createdAt.toISOString(),
    bidsCount: t._count?.bids ?? 0,
  };
}

export function toBidDTO(b: { id: string; taskId: string; amount: number; days: number; coverNote: string; inviteSource: string; status: string; createdAt: Date }, specialist: SpecialistDTO): BidDTO {
  return {
    id: b.id,
    taskId: b.taskId,
    amount: b.amount,
    days: b.days,
    coverNote: b.coverNote,
    inviteSource: b.inviteSource,
    status: b.status,
    createdAt: b.createdAt.toISOString(),
    specialist,
  };
}

// ---------- Rule-based matching (honest fallback + ranking prior) ----------

const SKILL_SYNONYMS: Record<string, string[]> = {
  ads: ["meta ads", "google ads", "facebook ads", "adverts", "advertising", "paid"],
  seo: ["seo", "search", "google ranking", "organic"],
  social: ["social media", "instagram", "tiktok", "facebook page", "reels"],
  content: ["content", "copywriting", "blog", "newsletter", "email"],
  website: ["website", "landing page", "web design", "wordpress", "shopify", "woocommerce", "online store", "e-commerce", "ecommerce"],
  bookkeeping: ["bookkeeping", "accounts", "accounting", "payroll", "tax", "invoice", "financial records"],
  brand: ["logo", "branding", "brand identity", "packaging", "design"],
  operations: ["operations", "delivery", "logistics", "process", "inventory", "vendors"],
  hiring: ["hiring", "recruit", "staff", "employee", "hr", "team"],
  legal: ["contract", "agreement", "legal", "compliance", "registration", "nda"],
  data: ["dashboard", "report", "analytics", "kpi", "spreadsheet", "data"],
  automation: ["automation", "workflow", "zapier", "manual work", "spreadsheet work"],
};

/** Keywords worth matching between a task and a specialist's skills. */
function keywordOverlap(text: string, skills: string[]): string[] {
  const t = text.toLowerCase();
  const hits: string[] = [];
  for (const skill of skills) {
    if (skill.length >= 3 && t.includes(skill.toLowerCase())) hits.push(skill);
  }
  for (const [group, words] of Object.entries(SKILL_SYNONYMS)) {
    if (words.some((w) => t.includes(w))) {
      hits.push(group);
    }
  }
  return hits;
}

export function scoreSpecialist(
  s: Specialist,
  task: { title: string; description: string; category: string; skills: string[] },
): { score: number; overlap: string[] } {
  let score = 0;
  if (s.category === task.category) score += 45;
  const haystack = `${task.title} ${task.description}`;
  const overlap = keywordOverlap(haystack, [...parseArray(s.skills), ...parseArray(s.headline)]);
  score += Math.min(overlap.length, 5) * 9;
  score += (s.rating - 4.0) * 15;
  score += Math.min(s.completedJobs / 25, 1) * 6;
  if (s.available === "Available now") score += 4;
  for (const wanted of task.skills) {
    if (parseArray(s.skills).some((has) => has.toLowerCase().includes(wanted.toLowerCase()))) score += 5;
  }
  return { score: Math.round(score * 10) / 10, overlap };
}

// ---------- AI matchmaking ----------

const CATEGORY_IDS = ["marketing", "sales", "content", "design", "web", "ops", "finance", "data", "people", "legal"];

interface AiMatchPayload {
  category?: unknown;
  skillsToSeek?: unknown;
  note?: unknown;
  matches?: unknown;
}

/**
 * Match a task to the roster. AI pass first (via the shared gateway);
 * every AI claim is validated against real roster rows — invented ids are
 * dropped, missing slots are refilled by deterministic scoring and labelled
 * "rule" so the client can show which is which.
 */
export async function matchTask(input: {
  title: string;
  description: string;
  category?: string;
  skills?: string[];
  limit?: number;
}): Promise<MatchResult> {
  const limit = Math.min(Math.max(input.limit ?? 4, 2), 6);
  const roster = await db.specialist.findMany();

  const ranked = roster
    .map((s) => ({ s, ...scoreSpecialist(s, { title: input.title, description: input.description, category: input.category ?? "", skills: input.skills ?? [] }) }))
    .sort((a, b) => b.score - a.score);

  const byId = new Map(roster.map((s) => [s.id, s]));
  const result: MatchResult = {
    aiInterpreted: false,
    category: input.category ?? "marketing",
    skillsToSeek: input.skills ?? [],
    note: "",
    matches: [],
  };

  const system = [
    "You are the matchmaking engine inside bizzGrowth, a growth tool for Nigerian small businesses.",
    "Given a work task and a roster of vetted specialists, pick the specialists best able to do THIS task.",
    "Rules:",
    "- ONLY use specialist ids from the roster. Never invent ids, names, numbers or claims.",
    "- Each reason must be grounded in that specialist's listed skills/headline and 1-2 sentences max.",
    "- Prefer breadth of fit, not just rating: the reason should say WHY this person for THIS task.",
    "- If the task's category is unclear, infer the best category id from: " + CATEGORY_IDS.join(", ") + ".",
    "- skillsToSeek: 3-5 concrete skills an owner should look for when hiring for this task.",
    "- note: one sentence of candid hiring advice for the owner (what to watch out for).",
    "Output ONLY raw JSON: {\"category\":string,\"skillsToSeek\":string[],\"note\":string,\"matches\":[{\"id\":string,\"reason\":string}]}",
  ].join("\n");

  const rosterTable = ranked
    .map(
      ({ s }) =>
        `- id:${s.id} | ${s.name} | category:${s.category} | rate:₦${s.hourlyRate}/hr | rating:${s.rating} (${s.reviews} reviews) | headline: ${s.headline} | skills: ${parseArray(s.skills).join(", ")}`,
    )
    .join("\n");

  const user = [
    `TASK TITLE: ${input.title}`,
    `TASK DESCRIPTION: ${input.description}`,
    input.category ? `OWNER-GUESS CATEGORY: ${input.category}` : "",
    input.skills?.length ? `OWNER-GIVEN SKILLS: ${input.skills.join(", ")}` : "",
    "",
    "ROSTER:",
    rosterTable,
  ]
    .filter(Boolean)
    .join("\n");

  let aiPayload: AiMatchPayload | null = null;
  try {
    const raw = await completeText(system, user, { maxTokens: 1200 });
    if (raw) {
      const start = raw.indexOf("{");
      const end = raw.lastIndexOf("}");
      if (start !== -1 && end > start) {
        aiPayload = JSON.parse(raw.slice(start, end + 1)) as AiMatchPayload;
      }
    }
  } catch {
    aiPayload = null;
  }

  const aiReasonById = new Map<string, string>();
  if (aiPayload) {
    if (Array.isArray(aiPayload.matches)) {
      for (const m of aiPayload.matches) {
        if (m && typeof (m as { id?: unknown }).id === "string" && typeof (m as { reason?: unknown }).reason === "string") {
          const { id, reason } = m as { id: string; reason: string };
          if (byId.has(id) && reason.trim()) aiReasonById.set(id, reason.trim().slice(0, 220));
        }
      }
    }
    if (typeof aiPayload.category === "string" && CATEGORY_IDS.includes(aiPayload.category)) {
      result.category = aiPayload.category;
    }
    if (Array.isArray(aiPayload.skillsToSeek)) {
      const seek = aiPayload.skillsToSeek.filter((v): v is string => typeof v === "string" && v.trim().length > 0).map((v) => v.trim().slice(0, 40));
      if (seek.length) result.skillsToSeek = seek.slice(0, 5);
    }
    if (typeof aiPayload.note === "string" && aiPayload.note.trim()) {
      result.note = aiPayload.note.trim().slice(0, 240);
    }
  }

  result.aiInterpreted = aiReasonById.size > 0 || (aiPayload !== null && Boolean(result.note));

  // AI picks first (in AI order), then top rule-ranked fill the rest.
  const picked = new Set<string>();
  for (const [id, reason] of aiReasonById) {
    if (result.matches.length >= limit) break;
    const s = byId.get(id);
    if (!s || picked.has(id)) continue;
    const rule = ranked.find((r) => r.s.id === id);
    picked.add(id);
    result.matches.push({ specialistId: id, reason, source: "ai", score: rule?.score ?? 0, specialist: toSpecialistDTO(s) });
  }
  for (const { s, score, overlap } of ranked) {
    if (result.matches.length >= limit) break;
    if (picked.has(s.id)) continue;
    picked.add(s.id);
    const why = overlap.length
      ? `Matched by category and overlapping skills: ${overlap.slice(0, 3).join(", ")}.`
      : `Matched by category (${s.category}) and track record.`;
    result.matches.push({ specialistId: s.id, reason: why, source: "rule", score, specialist: toSpecialistDTO(s) });
  }

  if (!result.note) {
    result.note = result.aiInterpreted
      ? "Matches are ranked by fit for this task — compare their bids before deciding."
      : "AI matchmaker is unavailable right now — these are straight category and skill matches.";
  }

  return result;
}

// ---------- Bid generation (pilot marketplace simulation) ----------
//
// In the live product real humans bid. In this pilot, invited roster
// specialists respond automatically with indicative bids derived from their
// own profile (hourly rate x estimated scope, budget-aware). The client
// displays this honestly as a pilot behaviour.

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const URGENCY_DAYS: Record<string, number> = { asap: 5, "this-week": 8, flexible: 14 };

export function generateBidFor(s: SpecialistDTO, task: MarketTask): { amount: number; days: number; coverNote: string } {
  const seed = hashString(`${task.id}:${s.id}`);
  const jitter = (seed % 1000) / 1000; // stable 0..1 per task+specialist pair

  // Scope: description length hints effort, clamped to a sane range.
  const scopeHours = Math.min(Math.max(6 + Math.round(task.description.length / 180), 6), 40);
  let amount = Math.round((s.hourlyRate * scopeHours * (0.85 + jitter * 0.5)) / 500) * 500;
  if (task.budgetMax) amount = Math.min(amount, Math.round(task.budgetMax * 1.1));
  if (task.budgetMax && task.budgetMax >= 20000 && amount < task.budgetMax * 0.5) {
    amount = Math.round((task.budgetMax * (0.6 + jitter * 0.35)) / 500) * 500;
  }
  amount = Math.max(amount, 15000);

  const baseDays = URGENCY_DAYS[task.urgency] ?? 8;
  const days = Math.max(2, Math.round(baseDays * (0.8 + jitter * 0.5)));

  const skills = s.skills;
  const lead = skills.slice(0, 2).join(" and ");
  const taskSkills = parseArray(task.skills);
  const focus = taskSkills.length ? taskSkills.slice(0, 2).join(" and ") : lead;
  const coverNote = [
    `I work mainly on ${lead} — this task sits squarely in that lane.`,
    `For "${task.title}", my plan is to start with a short scoping call, agree the deliverables, then run the work in clear checkpoints so you can see progress on ${focus || "the core deliverable"}.`,
    `I can deliver in about ${days} ${days === 1 ? "day" : "days"} at ₦${amount.toLocaleString("en-NG")} for the whole task — that price covers everything, no hidden extras.`,
  ].join(" ");

  return { amount, days, coverNote };
}
