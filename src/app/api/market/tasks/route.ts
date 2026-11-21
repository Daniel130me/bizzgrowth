import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toTaskDTO } from "@/lib/market";
import { marketErrorResponse, requireMarketSession, requireWorkspace } from "@/lib/market-auth";

export const runtime = "nodejs";

const CATEGORIES = ["marketing", "sales", "content", "design", "web", "ops", "finance", "data", "people", "legal"];
const URGENCIES = ["asap", "this-week", "flexible"];

function clean(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** GET /api/market/tasks?workspaceId=… — tasks posted by one workspace. */
export async function GET(req: NextRequest) {
  try {
    const session = await requireMarketSession(req, { action: "tasks:list", limit: 90 });
    const { searchParams } = new URL(req.url);
    const requestedWorkspaceId = searchParams.get("workspaceId")?.trim();
    const workspaceId = requireWorkspace(session, requestedWorkspaceId || undefined);
    const rows = await db.marketTask.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { _count: { select: { bids: true } } },
    });
    return NextResponse.json({ ok: true, tasks: rows.map(toTaskDTO) });
  } catch (error) {
    return marketErrorResponse(error, "tasks:list");
  }
}

/** POST /api/market/tasks — post a task (from a recommendation or by hand). */
export async function POST(req: NextRequest) {
  try {
    const session = await requireMarketSession(req, { mutation: true, action: "tasks:create", limit: 20 });
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
    }

    const workspaceId = requireWorkspace(session, clean(body.workspaceId, 80) || undefined);
    const businessName = session.workspaceName || clean(body.businessName, 120) || "Business";
    const title = clean(body.title, 120);
    const description = clean(body.description, 2000);
    const category = clean(body.category, 30);
    const urgency = clean(body.urgency, 20) || "this-week";
    const source = clean(body.source, 20) || "manual";
    const sourceRef = clean(body.sourceRef, 120) || null;
    const sourceTitle = clean(body.sourceTitle, 200) || null;

    const skills = Array.isArray(body.skills)
      ? body.skills.filter((s: unknown): s is string => typeof s === "string").map((s: string) => s.trim().slice(0, 40)).filter(Boolean).slice(0, 8)
      : [];

    const budgetMinRaw = Number(body.budgetMin);
    const budgetMaxRaw = Number(body.budgetMax);
    const budgetMin = Number.isFinite(budgetMinRaw) && budgetMinRaw > 0 ? Math.round(budgetMinRaw) : null;
    const budgetMax = Number.isFinite(budgetMaxRaw) && budgetMaxRaw > 0 ? Math.round(budgetMaxRaw) : null;

    if (title.length < 8) return NextResponse.json({ ok: false, error: "Give the task a clear title (at least 8 characters)." }, { status: 400 });
    if (description.length < 30) return NextResponse.json({ ok: false, error: "Describe the work in at least 30 characters — specialists bid on this." }, { status: 400 });
    if (!CATEGORIES.includes(category)) return NextResponse.json({ ok: false, error: "Pick a valid category." }, { status: 400 });
    if (!URGENCIES.includes(urgency)) return NextResponse.json({ ok: false, error: "Pick a valid timeframe." }, { status: 400 });
    if (!["manual", "recommendation"].includes(source)) return NextResponse.json({ ok: false, error: "Invalid task source." }, { status: 400 });
    if (budgetMin && budgetMax && budgetMin > budgetMax) {
      return NextResponse.json({ ok: false, error: "Minimum budget cannot exceed maximum." }, { status: 400 });
    }

    const task = await db.marketTask.create({
      data: {
        workspaceId,
        businessName,
        title,
        description,
        category,
        skills: JSON.stringify(skills),
        budgetMin,
        budgetMax,
        urgency,
        source,
        sourceRef,
        sourceTitle,
        status: "open",
      },
      include: { _count: { select: { bids: true } } },
    });

    return NextResponse.json({ ok: true, task: toTaskDTO(task) }, { status: 201 });
  } catch (error) {
    return marketErrorResponse(error, "tasks:create");
  }
}
