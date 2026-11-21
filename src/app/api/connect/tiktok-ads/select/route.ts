import { NextRequest, NextResponse } from "next/server";
import { readJson, sameOrigin, str } from "@/lib/auth/http";
import { getSession } from "@/lib/auth/session";
import { advertiserIds } from "@/lib/connectors/tiktok";
import { getCredential, upsertConnection } from "@/lib/connectors/store";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, error: "Cross-site request rejected" }, { status: 403 });
  const session = await getSession().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });
  const credential = await getCredential(session.userId, "tiktok-ads");
  if (!credential) return NextResponse.json({ ok: false, error: "Connect TikTok Ads first" }, { status: 404 });
  const advertiserId = str((await readJson(request))?.advertiserId, 40);
  if (!advertiserIds(credential.metadata).includes(advertiserId)) return NextResponse.json({ ok: false, error: "That TikTok advertiser is not available" }, { status: 403 });
  const id = await upsertConnection({ userId: session.userId, workspaceId: session.workspaceId, credentialId: credential.id, provider: "tiktok-ads", product: "ads", accountId: advertiserId, accountLabel: `TikTok Ads ${advertiserId}`, scopes: credential.scopes.split(/\s+/).filter(Boolean) });
  return NextResponse.json({ ok: true, connectionIds: [id] });
}
