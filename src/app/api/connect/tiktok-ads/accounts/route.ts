import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { advertiserIds } from "@/lib/connectors/tiktok";
import { getCredential, ownedConnections } from "@/lib/connectors/store";

export const runtime = "nodejs";
export async function GET() {
  const session = await getSession().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });
  const [credential, existing] = await Promise.all([getCredential(session.userId, "tiktok-ads"), ownedConnections(session.userId)]);
  if (!credential) return NextResponse.json({ ok: false, error: "Connect TikTok Ads first" }, { status: 404 });
  const accounts = advertiserIds(credential.metadata).map((id) => ({ id, label: `TikTok Ads ${id}`, detail: `Advertiser ID ${id}` }));
  return NextResponse.json({ ok: true, accounts, current: existing.find((row) => row.provider === "tiktok-ads" && row.product === "ads")?.externalAccountId ?? null }, { headers: { "Cache-Control": "no-store" } });
}
