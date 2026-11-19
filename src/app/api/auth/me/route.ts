import { NextResponse } from "next/server";
import { getSession, publicUser } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The signed-in user and their workspace, or { user: null }. */
export async function GET() {
  try {
    const s = await getSession();
    return NextResponse.json({ user: s ? publicUser(s) : null }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[auth/me]", (err as Error)?.message);
    // 503 (not { user: null }) so the client doesn't treat a DB hiccup as "signed out".
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
