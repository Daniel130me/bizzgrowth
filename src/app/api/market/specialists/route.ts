import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toSpecialistDTO } from "@/lib/market";
import { marketErrorResponse, requireMarketSession } from "@/lib/market-auth";

export const runtime = "nodejs";

/** GET /api/market/specialists — the vetted roster (optionally filtered). */
export async function GET(req: NextRequest) {
  try {
    await requireMarketSession(req, { action: "specialists:list", limit: 60 });
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") ?? undefined;
    const q = (searchParams.get("q") ?? "").trim().toLowerCase();
    const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const pageSize = Math.min(50, Math.max(1, Number.parseInt(searchParams.get("pageSize") ?? "24", 10) || 24));

    const rows = await db.specialist.findMany({
      where: {
        status: "approved",
        verified: true,
        ...(category ? { category } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" as const } },
                { headline: { contains: q, mode: "insensitive" as const } },
                { skills: { contains: q, mode: "insensitive" as const } },
                { bio: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      orderBy: [{ rating: "desc" }, { completedJobs: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize + 1,
    });

    const hasMore = rows.length > pageSize;
    const specialists = rows.slice(0, pageSize).map(toSpecialistDTO);

    return NextResponse.json(
      { ok: true, specialists, page, hasMore },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return marketErrorResponse(error, "specialists:list");
  }
}
