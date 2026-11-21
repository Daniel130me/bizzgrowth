import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { sameOrigin } from "@/lib/auth/http";
import { decryptSecret } from "@/lib/connectors/crypto";
import { connectorById } from "@/lib/connectors/registry";
import { deleteCredential, deleteOwnedConnection, getCredential } from "@/lib/connectors/store";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return NextResponse.json({ ok: false, error: "Cross-site request rejected" }, { status: 403 });
  const session = await getSession().catch(() => null);
  if (!session) return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });
  const { id } = await context.params;
  const removed = await deleteOwnedConnection(session.userId, id);
  if (!removed) return NextResponse.json({ ok: false, error: "Connection not found" }, { status: 404 });
  if (removed.remaining === 0) {
    const credential = await getCredential(session.userId, removed.provider);
    if (credential?.id === removed.credentialId) {
      const token = credential.refreshTokenEnc ?? credential.accessTokenEnc;
      const connector = connectorById(removed.provider);
      try {
        if (connector?.authType === "oauth2") await connector.revoke(decryptSecret(token));
      } catch (error) {
        console.warn(`[connectors] ${removed.provider} revoke failed; local credential will still be removed`, error instanceof Error ? error.message : "unknown");
      }
      await deleteCredential(session.userId, credential.id);
    }
  }
  return NextResponse.json({ ok: true });
}
