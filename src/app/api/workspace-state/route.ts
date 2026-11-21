// The signed-in owner's workspace data, saved on their account so it survives a
// cleared browser, an app update, another browser or a new device. The browser
// side is src/lib/workspace-sync.ts; the document format and merge rules are in
// src/lib/workspace-doc.ts.
//
//   GET /api/workspace-state → { ok, doc, rev } for the session's user and workspace
//   PUT /api/workspace-state   { workspaceName, doc }: merged into the saved copy
//       entry by entry (newest change wins; deletions are kept as markers) → { ok, rev }
//
// Only the signed-in user's own copy is ever read or written. The table is
// "WorkspaceState" (prisma/sql/007_workspace_state.sql), read with raw SQL like
// AuthSession. Until that table exists, both calls answer 503 and the app keeps
// working from the browser's copy.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, withDbRetry, type SessionUser } from "@/lib/auth/session";
import { jsonError, sameOrigin } from "@/lib/auth/http";
import { workspaceKey } from "@/lib/chat-log";
import { mergeDocs, parseDoc, type WorkspaceDoc } from "@/lib/workspace-doc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const MAX_BODY = 3_000_000;
const MAX_DOC = 6_000_000;

interface Row {
  doc: WorkspaceDoc;
  rev: number;
}

class Unreadable extends Error {}

function rowFrom(r: { doc: string; rev: number } | undefined): Row | null {
  if (!r) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(r.doc);
  } catch {
    throw new Unreadable("saved copy is not JSON");
  }
  const doc = parseDoc(raw, { fromClient: false });
  if (!doc) throw new Unreadable("saved copy is malformed");
  return { doc, rev: Number(r.rev) };
}

async function loadRow(s: SessionUser): Promise<Row | null> {
  const rows = await withDbRetry(
    () => db.$queryRaw<{ doc: string; rev: number }[]>`
      SELECT "doc", "rev" FROM "WorkspaceState"
      WHERE "userId" = ${s.userId} AND "workspaceId" = ${s.workspaceId ?? ""} LIMIT 1`,
  );
  return rowFrom(rows[0]);
}

/** The same business set up again under a new workspace id (same name): its saved data comes along. */
async function loadSameBusiness(s: SessionUser): Promise<WorkspaceDoc | null> {
  const rows = await withDbRetry(
    () => db.$queryRaw<{ doc: string; rev: number }[]>`
      SELECT "doc", "rev" FROM "WorkspaceState"
      WHERE "userId" = ${s.userId} AND "workspaceSlug" = ${workspaceKey(s.workspaceName ?? "")}
        AND "workspaceId" <> ${s.workspaceId ?? ""}
      ORDER BY "updatedAt" DESC LIMIT 1`,
  );
  return rowFrom(rows[0])?.doc ?? null;
}

function failure(err: unknown, where: string) {
  const e = err as { message?: string; meta?: { code?: string } };
  const message = String(e?.message ?? "");
  if (err instanceof Unreadable) {
    console.error(`[workspace-state] ${where}: ${message}`);
    // Never overwrite a saved copy we can't read; the browser keeps its own.
    return jsonError(500, "Your saved copy couldn't be read, so nothing was changed.", { reason: "unreadable" });
  }
  if (e?.meta?.code === "42P01" || /"WorkspaceState" does not exist/.test(message)) {
    return jsonError(503, "Saving to your account isn't switched on yet.", { reason: "not-ready" });
  }
  console.error(`[workspace-state] ${where}:`, message.split("\n").slice(-1)[0]);
  return jsonError(503, "We couldn't reach your saved copy right now.", { reason: "unavailable" });
}

async function currentSession(): Promise<SessionUser | null | undefined> {
  try {
    return await getSession();
  } catch {
    return undefined;
  }
}

export async function GET() {
  const s = await currentSession();
  if (s === undefined) return jsonError(503, "We couldn't check your session right now.", { reason: "unavailable" });
  if (!s) return jsonError(401, "Your session has ended. Please sign in again.");
  if (!s.workspaceId) return NextResponse.json({ ok: true, doc: null, rev: 0 }, { headers: NO_STORE });
  try {
    const row = await loadRow(s);
    if (row) return NextResponse.json({ ok: true, doc: row.doc, rev: row.rev }, { headers: NO_STORE });
    return NextResponse.json({ ok: true, doc: await loadSameBusiness(s), rev: 0 }, { headers: NO_STORE });
  } catch (err) {
    return failure(err, "GET");
  }
}

export async function PUT(req: Request) {
  if (!sameOrigin(req)) return jsonError(403, "Cross-site request blocked.");
  const s = await currentSession();
  if (s === undefined) return jsonError(503, "We couldn't check your session right now.", { reason: "unavailable" });
  if (!s) return jsonError(401, "Your session has ended. Please sign in again.");
  if (!s.workspaceId || !s.workspaceName) return jsonError(409, "Create your workspace first.", { reason: "no-workspace" });

  const text = await req.text().catch(() => "");
  if (text.length > MAX_BODY) return jsonError(413, "That's more than can be saved at once.");
  let body: { workspaceName?: unknown; doc?: unknown };
  try {
    body = JSON.parse(text) as typeof body;
  } catch {
    return jsonError(400, "Expected JSON.");
  }
  // The browser's data must be this workspace's business, never another one's.
  const name = typeof body?.workspaceName === "string" ? body.workspaceName : "";
  if (workspaceKey(name) !== workspaceKey(s.workspaceName)) {
    return jsonError(409, "This data belongs to another business.", { reason: "other-business" });
  }
  const incoming = parseDoc(body?.doc, { fromClient: true });
  if (!incoming) return jsonError(400, "That data isn't in the expected shape.");
  const slug = workspaceKey(s.workspaceName);

  try {
    // Read, merge, write only if nobody saved in between (rev); otherwise merge again.
    for (let attempt = 0; attempt < 4; attempt++) {
      const row = await loadRow(s);
      if (!row) {
        const merged = mergeDocs(await loadSameBusiness(s), incoming).doc;
        const json = JSON.stringify(merged);
        if (json.length > MAX_DOC) return jsonError(413, "Your saved data has grown too large to save.");
        const inserted = await withDbRetry(
          () => db.$executeRaw`
            INSERT INTO "WorkspaceState" ("userId", "workspaceId", "workspaceSlug", "doc")
            VALUES (${s.userId}, ${s.workspaceId}, ${slug}, ${json})
            ON CONFLICT ("userId", "workspaceId") DO NOTHING`,
        );
        if (inserted === 1) return NextResponse.json({ ok: true, rev: 1 }, { headers: NO_STORE });
        continue;
      }
      const m = mergeDocs(row.doc, incoming);
      if (!m.changed) return NextResponse.json({ ok: true, rev: row.rev }, { headers: NO_STORE });
      const json = JSON.stringify(m.doc);
      if (json.length > MAX_DOC) return jsonError(413, "Your saved data has grown too large to save.");
      const updated = await withDbRetry(
        () => db.$executeRaw`
          UPDATE "WorkspaceState"
          SET "doc" = ${json}, "rev" = "rev" + 1, "workspaceSlug" = ${slug}, "updatedAt" = NOW()
          WHERE "userId" = ${s.userId} AND "workspaceId" = ${s.workspaceId} AND "rev" = ${row.rev}`,
      );
      if (updated === 1) return NextResponse.json({ ok: true, rev: row.rev + 1 }, { headers: NO_STORE });
    }
    return jsonError(409, "Your data was being saved from somewhere else. Please try again.", { reason: "busy" });
  } catch (err) {
    return failure(err, "PUT");
  }
}
