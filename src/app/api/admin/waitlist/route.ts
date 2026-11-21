import { NextRequest, NextResponse } from "next/server";
import { isPlatformAdmin } from "@/lib/auth/platform-admin";
import { db } from "@/lib/db";
import { MarketHttpError, marketErrorResponse, requireMarketSession } from "@/lib/market-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 100;

type WaitlistRow = {
  id: string;
  name: string;
  email: string;
  audience: "business" | "specialist";
  businessName: string | null;
  industry: string | null;
  specialty: string | null;
  experience: string | null;
  createdAt: Date;
};

function isMissingWaitlistTable(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const meta = "meta" in error ? error.meta : null;
  const missingRelationCode =
    typeof meta === "object" && meta !== null && "code" in meta && String(meta.code) === "42P01";
  const message = error instanceof Error ? error.message : "";
  return missingRelationCode || message.includes('relation "WaitlistSignup" does not exist');
}

async function requireAdmin(request: NextRequest) {
  const session = await requireMarketSession(request, { action: "admin:waitlist:list", limit: 120 });
  if (!isPlatformAdmin(session)) throw new MarketHttpError(403, "Platform administrator access required.");
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const params = request.nextUrl.searchParams;
    const requestedAudience = params.get("audience") ?? "all";
    if (!["all", "business", "specialist"].includes(requestedAudience)) {
      throw new MarketHttpError(400, "Choose a valid waitlist type.");
    }
    const audience = requestedAudience as "all" | "business" | "specialist";
    const search = (params.get("q") ?? "").replace(/\u0000/g, "").trim().slice(0, 100);
    const parsedPage = Number.parseInt(params.get("page") ?? "1", 10);
    const page = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.min(parsedPage, 100_000) : 1;
    const offset = (page - 1) * PAGE_SIZE;

    const [rows, countRows] = await Promise.all([
      db.$queryRaw<WaitlistRow[]>`
        SELECT "id", "name", "email", "audience", "businessName", "industry", "specialty", "experience", "createdAt"
        FROM "WaitlistSignup"
        WHERE (${audience} = 'all' OR "audience" = ${audience})
          AND (${search} = ''
            OR position(lower(${search}) in lower("name")) > 0
            OR position(lower(${search}) in lower("email")) > 0
            OR position(lower(${search}) in lower(COALESCE("businessName", ''))) > 0
            OR position(lower(${search}) in lower(COALESCE("industry", ''))) > 0
            OR position(lower(${search}) in lower(COALESCE("specialty", ''))) > 0)
        ORDER BY "createdAt" DESC
        LIMIT ${PAGE_SIZE} OFFSET ${offset}`,
      db.$queryRaw<{ total: bigint }[]>`
        SELECT COUNT(*) AS "total"
        FROM "WaitlistSignup"
        WHERE (${audience} = 'all' OR "audience" = ${audience})
          AND (${search} = ''
            OR position(lower(${search}) in lower("name")) > 0
            OR position(lower(${search}) in lower("email")) > 0
            OR position(lower(${search}) in lower(COALESCE("businessName", ''))) > 0
            OR position(lower(${search}) in lower(COALESCE("industry", ''))) > 0
            OR position(lower(${search}) in lower(COALESCE("specialty", ''))) > 0)`,
    ]);

    const total = Number(countRows[0]?.total ?? 0);
    return NextResponse.json(
      { ok: true, entries: rows, total, page, pageSize: PAGE_SIZE, totalPages: Math.ceil(total / PAGE_SIZE) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (isMissingWaitlistTable(error)) {
      console.error("[api/admin/waitlist] Waiting-list migration 009 is not applied.");
      return NextResponse.json(
        { ok: false, error: "The waiting-list table is not ready. Apply prisma/sql/009_waitlist.sql, then try again." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    return marketErrorResponse(error, "admin:waitlist:list");
  }
}
