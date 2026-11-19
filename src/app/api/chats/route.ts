// Chat conversation log API.
//   POST /api/chats            — upsert a conversation + any new messages (called by every chat screen)
//   GET  /api/chats?id=<id>    — one conversation with its messages (owner only, once it has an owner)
//   GET  /api/chats?resume=<chatType>&workspace=<slug>
//                              — the signed-in user's latest conversation of that type (resume after logout)
//   GET  /api/chats?chatType=… — list recent conversations for quality review.
//                                Requires header `x-review-token: $CHAT_REVIEW_TOKEN`.
// Storage: Neon (ChatConversation / ChatMessage). If the database is unreachable
// the conversation is written to db/chat-logs/<id>.json instead, so nothing is lost.
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession, type SessionUser } from "@/lib/auth/session";
import type { ChatLogMessage, ChatLogPayload } from "@/lib/chat-log";

export const runtime = "nodejs";

const FALLBACK_DIR = path.join(process.cwd(), "db", "chat-logs");
const MAX_MESSAGES = 400;

const str = (v: unknown, cap: number): string | undefined => {
  const s = typeof v === "string" ? v.trim().slice(0, cap) : "";
  return s.length > 0 ? s : undefined;
};

/** JSON-safe clone, capped in size so a bad client cannot flood the table. */
function jsonValue(v: unknown, cap = 20_000): Prisma.InputJsonValue | undefined {
  if (v === undefined || v === null) return undefined;
  try {
    const text = JSON.stringify(v);
    if (!text || text.length > cap) return undefined;
    return JSON.parse(text) as Prisma.InputJsonValue;
  } catch {
    return undefined;
  }
}

function sanitize(body: unknown): ChatLogPayload | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const id = str(b.id, 120);
  const chatType = str(b.chatType, 40);
  if (!id || !/^[A-Za-z0-9_:-]+$/.test(id) || !chatType) return null;
  const messages: ChatLogMessage[] = Array.isArray(b.messages)
    ? b.messages
        .filter((m): m is Record<string, unknown> => !!m && typeof m === "object")
        .filter((m) => (m.role === "ai" || m.role === "user") && typeof m.text === "string" && Number.isInteger(m.seq))
        .slice(0, MAX_MESSAGES)
        .map((m) => {
          const at = typeof m.at === "string" && !Number.isNaN(Date.parse(m.at)) ? m.at : new Date().toISOString();
          return {
            seq: Math.max(0, Math.min(10_000, m.seq as number)),
            role: m.role as "ai" | "user",
            text: (m.text as string).slice(0, 4000),
            at,
            meta: m.meta && typeof m.meta === "object" ? (m.meta as Record<string, unknown>) : undefined,
          };
        })
    : [];
  return {
    id,
    chatType: chatType as ChatLogPayload["chatType"],
    screen: str(b.screen, 80) ?? chatType,
    clientId: str(b.clientId, 120),
    workspaceId: str(b.workspaceId, 120),
    workspaceName: str(b.workspaceName, 120),
    country: str(b.country, 80),
    phase: str(b.phase, 40),
    slots: b.slots,
    facts: b.facts,
    meta: b.meta && typeof b.meta === "object" ? (b.meta as Record<string, unknown>) : undefined,
    source: b.source === "captured" ? "captured" : "live",
    startedAt: typeof b.startedAt === "string" && !Number.isNaN(Date.parse(b.startedAt)) ? b.startedAt : undefined,
    messages,
  };
}

/** The signed-in user, or null (never throws: a DB hiccup must not lose the chat). */
async function currentUser(): Promise<SessionUser | null> {
  try {
    return await getSession();
  } catch {
    return null;
  }
}

/** Owner identity is set by the SERVER from the session — never trusted from the client. */
function withOwner(p: ChatLogPayload, user: SessionUser | null): ChatLogPayload {
  const meta = { ...(p.meta ?? {}) };
  delete meta.userId;
  delete meta.userEmail;
  delete meta.authWorkspaceId;
  if (user) {
    meta.userId = user.userId;
    meta.userEmail = user.email.toLowerCase();
    if (user.workspaceId) meta.authWorkspaceId = user.workspaceId;
  }
  return { ...p, meta };
}

function ownerOf(meta: unknown): string | null {
  const id = meta && typeof meta === "object" ? (meta as Record<string, unknown>).userId : null;
  return typeof id === "string" && id ? id : null;
}

class NotOwnerError extends Error {}

async function saveToDb(p: ChatLogPayload) {
  // A conversation that already belongs to someone can only be written by them.
  const existing = await db.chatConversation.findUnique({ where: { id: p.id }, select: { meta: true } });
  const existingOwner = existing ? ownerOf(existing.meta) : null;
  if (existingOwner && existingOwner !== ownerOf(p.meta)) throw new NotOwnerError();

  const fields = {
    chatType: p.chatType,
    screen: p.screen,
    clientId: p.clientId,
    workspaceId: p.workspaceId,
    workspaceName: p.workspaceName,
    country: p.country,
    phase: p.phase,
    slots: jsonValue(p.slots),
    facts: jsonValue(p.facts),
    meta: jsonValue(p.meta),
    source: p.source ?? "live",
  };
  await db.chatConversation.upsert({
    where: { id: p.id },
    create: { id: p.id, ...fields, startedAt: p.startedAt ? new Date(p.startedAt) : undefined },
    update: fields,
  });
  if (p.messages.length > 0) {
    await db.chatMessage.createMany({
      data: p.messages.map((m) => ({
        conversationId: p.id,
        seq: m.seq,
        role: m.role,
        text: m.text,
        meta: jsonValue(m.meta, 4000),
        sentAt: new Date(m.at),
      })),
      skipDuplicates: true,
    });
  }
  const count = await db.chatMessage.count({ where: { conversationId: p.id } });
  await db.chatConversation.update({ where: { id: p.id }, data: { messageCount: count } });
  return count;
}

async function saveToFile(p: ChatLogPayload) {
  await fs.mkdir(FALLBACK_DIR, { recursive: true });
  const file = path.join(FALLBACK_DIR, `${p.id}.json`);
  let previous: ChatLogPayload | null = null;
  try {
    previous = JSON.parse(await fs.readFile(file, "utf8")) as ChatLogPayload;
  } catch {}
  const bySeq = new Map<number, ChatLogMessage>();
  for (const m of previous?.messages ?? []) bySeq.set(m.seq, m);
  for (const m of p.messages) if (!bySeq.has(m.seq)) bySeq.set(m.seq, m);
  const merged = { ...previous, ...p, messages: [...bySeq.values()].sort((a, b) => a.seq - b.seq), savedAt: new Date().toISOString() };
  await fs.writeFile(file, JSON.stringify(merged, null, 2), "utf8");
}

export async function POST(request: NextRequest) {
  let payload: ChatLogPayload | null = null;
  try {
    payload = sanitize(await request.json());
  } catch {
    payload = null;
  }
  if (!payload) return NextResponse.json({ ok: false, error: "Invalid chat payload" }, { status: 400 });
  payload = withOwner(payload, await currentUser());

  try {
    let messageCount: number;
    try {
      messageCount = await saveToDb(payload);
    } catch (first) {
      if (first instanceof NotOwnerError) throw first;
      // Neon may still be waking from suspend — one short retry before the file fallback.
      console.warn("[api/chats] first save attempt failed, retrying:", first instanceof Error ? first.message.split("\n").pop() : first);
      await new Promise((r) => setTimeout(r, 1500));
      messageCount = await saveToDb(payload);
    }
    return NextResponse.json({ ok: true, store: "db", messageCount });
  } catch (error) {
    if (error instanceof NotOwnerError) {
      return NextResponse.json({ ok: false, error: "This conversation belongs to another account" }, { status: 403 });
    }
    console.error("[api/chats] database save failed, writing file fallback:", error instanceof Error ? error.message : error);
    try {
      await saveToFile(payload);
      return NextResponse.json({ ok: true, store: "file" });
    } catch (fileError) {
      console.error("[api/chats] file fallback failed:", fileError);
      return NextResponse.json({ ok: false, error: "Could not save chat" }, { status: 503 });
    }
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  try {
    if (id) {
      const convo = await db.chatConversation.findUnique({
        where: { id },
        include: { messages: { orderBy: { seq: "asc" } } },
      });
      const owner = convo ? ownerOf(convo.meta) : null;
      if (!convo || (owner && owner !== (await currentUser())?.userId)) {
        return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
      }
      return NextResponse.json({ ok: true, conversation: convo });
    }

    // Resume: the signed-in user's latest conversation of this type, so a chat
    // continues after logout, on a fresh browser, or after another account
    // used this browser (which clears local chat drafts). Identity comes from
    // the session cookie only — never from anything the client sends.
    const resume = url.searchParams.get("resume");
    if (resume) {
      const user = await currentUser();
      if (!user) return NextResponse.json({ ok: true, conversation: null });
      const workspace = url.searchParams.get("workspace") ?? "";
      const workspaces = [user.workspaceId, workspace].filter((w): w is string => !!w);
      const convo = await db.chatConversation.findFirst({
        where: {
          chatType: resume,
          AND: [
            { meta: { path: ["userId"], equals: user.userId } },
            {
              OR: [
                ...(workspaces.length ? [{ workspaceId: { in: workspaces } }] : []),
                ...(user.workspaceId ? [{ meta: { path: ["authWorkspaceId"], equals: user.workspaceId } }] : []),
              ],
            },
          ],
        },
        orderBy: { updatedAt: "desc" },
        include: { messages: { orderBy: { seq: "asc" } } },
      });
      return NextResponse.json({ ok: true, conversation: convo });
    }

    // Listing everyone's conversations is for the team only.
    const token = process.env.CHAT_REVIEW_TOKEN;
    if (!token || request.headers.get("x-review-token") !== token) {
      return NextResponse.json({ ok: false, error: "Review token required" }, { status: 401 });
    }
    const chatType = url.searchParams.get("chatType") ?? undefined;
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") ?? 25) || 25));
    const withMessages = url.searchParams.get("messages") === "1";
    const rows = await db.chatConversation.findMany({
      where: chatType ? { chatType } : undefined,
      orderBy: { updatedAt: "desc" },
      take: limit,
      include: withMessages ? { messages: { orderBy: { seq: "asc" } } } : undefined,
    });
    return NextResponse.json({ ok: true, conversations: rows });
  } catch (error) {
    console.error("[api/chats] read failed:", error);
    return NextResponse.json({ ok: false, error: "Chat store unavailable" }, { status: 503 });
  }
}
