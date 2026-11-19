import { NextResponse } from "next/server";
import { clearSessionCookie, revokeCurrentSession } from "@/lib/auth/session";
import { jsonError, sameOrigin } from "@/lib/auth/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError(403, "Cross-site request blocked.");
  try {
    await revokeCurrentSession();
  } catch (err) {
    // Still clear the cookie: the browser must end up signed out.
    console.error("[auth/logout]", (err as Error)?.message);
  }
  const res = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  clearSessionCookie(res);
  return res;
}
