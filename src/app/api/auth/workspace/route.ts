import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, newId, publicUser, setSessionWorkspace, withDbRetry } from "@/lib/auth/session";
import { jsonError, readJson, sameOrigin, str } from "@/lib/auth/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Onboarding "Create workspace": creates a real Workspace row owned by the
 * signed-in user (WorkspaceMembership role OWNER) and pins it on the session.
 */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return jsonError(403, "Cross-site request blocked.");
  const session = await getSession().catch(() => null);
  if (!session) return jsonError(401, "Your session has ended. Please sign in again.");

  const body = await readJson(req);
  const name = str(body?.name, 120).trim();
  if (!name) return jsonError(400, "Give your workspace a business name.", { field: "name" });
  const type = str(body?.type, 20).toLowerCase() === "ecommerce" ? "ECOMMERCE" : "SERVICE";
  const country = str(body?.country, 80).trim() || null;
  const currency = str(body?.currency, 80).trim() || "₦ (Nigerian Naira)";
  const website = str(body?.website, 300).trim();

  try {
    const workspaceId = newId();
    await withDbRetry(() =>
      db.$transaction([
        db.$executeRaw`
          INSERT INTO "Workspace" ("id", "name", "type", "location", "currency", "websiteData", "updatedAt")
          VALUES (${workspaceId}, ${name}, ${type}::"BusinessType", ${country}, ${currency},
                  ${website ? JSON.stringify({ url: website }) : null}::jsonb, NOW())`,
        db.$executeRaw`
          INSERT INTO "WorkspaceMembership" ("id", "workspaceId", "userId", "role", "status")
          VALUES (${newId()}, ${workspaceId}, ${session.userId}, 'OWNER'::"MemberRole", 'ACTIVE'::"MemberStatus")`,
      ]),
    );
    await setSessionWorkspace(session.sessionId, workspaceId);
    return NextResponse.json(
      { ok: true, user: publicUser({ ...session, workspaceId, workspaceName: name, workspace: { type: type === "ECOMMERCE" ? "ecommerce" : "service", country, currency } }) },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[auth/workspace]", (err as Error)?.message);
    return jsonError(503, "We couldn't save your workspace right now. Please try again.");
  }
}
