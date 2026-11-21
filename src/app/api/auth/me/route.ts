import { NextResponse } from "next/server";
import { getSession, publicUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { isPlatformAdmin } from "@/lib/auth/platform-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The signed-in user and their workspace, or { user: null }. */
export async function GET() {
  try {
    const s = await getSession();
    const specialist = s
      ? await db.specialist.findUnique({ where: { userId: s.userId }, select: { status: true } })
      : null;
    return NextResponse.json(
      {
        user: s
          ? {
              ...publicUser(s),
              accountType: specialist ? "specialist" : "business",
              specialistStatus: specialist?.status ?? null,
              isPlatformAdmin: isPlatformAdmin(s),
            }
          : null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[auth/me]", (err as Error)?.message);
    // 503 (not { user: null }) so the client doesn't treat a DB hiccup as "signed out".
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
