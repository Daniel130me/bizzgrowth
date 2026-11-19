// Chat conversation log — shared types + browser helpers.
//
// Every AI chat is (a) kept in localStorage so an owner who leaves by mistake
// comes back to where they stopped, and (b) sent to POST /api/chats so the team
// can review conversations later (stored in Neon: ChatConversation/ChatMessage).

export type ChatType = "onboarding-checkup" | "ask";

export interface ChatLogMessage {
  seq: number; // 0-based order in the conversation
  role: "ai" | "user";
  text: string;
  at: string; // ISO timestamp
  meta?: Record<string, unknown>;
}

export interface ChatLogPayload {
  id: string;
  chatType: ChatType;
  screen: string;
  clientId?: string;
  workspaceId?: string;
  workspaceName?: string;
  country?: string;
  phase?: string;
  slots?: unknown;
  facts?: unknown;
  meta?: Record<string, unknown>;
  source?: "live" | "captured";
  startedAt?: string;
  messages: ChatLogMessage[];
}

const CLIENT_ID_KEY = "bizzgrowth-client-id-v1";

export function newChatId(prefix = "chat"): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${rand}`;
}

/** Stable anonymous id for this browser (there is no sign-in yet). */
export function getClientId(): string {
  try {
    const existing = localStorage.getItem(CLIENT_ID_KEY);
    if (existing) return existing;
    const id = newChatId("client");
    localStorage.setItem(CLIENT_ID_KEY, id);
    return id;
  } catch {
    return "client_unknown";
  }
}

/** Stable key for a workspace (the client app has no workspace ids yet). */
export function workspaceKey(workspaceName: string | undefined): string {
  return (workspaceName ?? "default").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "default";
}

/** localStorage key for an in-progress chat, per browser + workspace. */
export function chatDraftKey(chatType: ChatType, workspaceName: string | undefined): string {
  return `bizzgrowth-chat-v1:${chatType}:${workspaceKey(workspaceName)}`;
}

/** A conversation as GET /api/chats returns it. */
export interface StoredConversation {
  id: string;
  chatType: string;
  phase: string | null;
  slots: unknown;
  facts: unknown;
  meta: Record<string, unknown> | null;
  startedAt: string;
  updatedAt: string;
  messages: { seq: number; role: "ai" | "user"; text: string; meta: Record<string, unknown> | null; sentAt: string }[];
}

/**
 * The signed-in user's latest saved conversation for this workspace, from the
 * server — so a chat continues after logging out or on a different browser.
 * The server identifies the user from the session cookie, never from the client.
 */
export async function fetchResumableChat(chatType: ChatType, workspaceName: string | undefined): Promise<StoredConversation | null> {
  try {
    const qs = new URLSearchParams({ resume: chatType, workspace: workspaceKey(workspaceName) });
    const res = await fetch(`/api/chats?${qs.toString()}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { ok?: boolean; conversation?: StoredConversation | null };
    return data?.ok && data.conversation ? data.conversation : null;
  } catch {
    return null;
  }
}

export function loadDraft<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveDraft(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function clearDraft(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {}
}

/**
 * Re-send the saved onboarding conversation with its diagnosis attached, so
 * the team can review every chat next to the diagnosis it produced.
 */
export function attachDiagnosisToChat(opts: { workspaceName?: string; country?: string; diagnosis: unknown }): void {
  const draft = loadDraft<{
    conversationId?: string;
    startedAt?: string;
    phase?: string;
    slots?: unknown;
    facts?: unknown;
    askCounts?: unknown;
    messages?: { role: "ai" | "user"; text: string; at?: string; learned?: string[]; degraded?: boolean; note?: boolean }[];
  }>(chatDraftKey("onboarding-checkup", opts.workspaceName));
  if (!draft?.conversationId || !Array.isArray(draft.messages)) return;
  const messages: ChatLogMessage[] = draft.messages
    .filter((m) => m && m.text)
    .map((m, i) => ({
      seq: i,
      role: m.role,
      text: m.text,
      at: m.at ?? draft.startedAt ?? new Date().toISOString(),
      meta: {
        ...(m.learned?.length ? { learned: m.learned } : {}),
        ...(m.degraded ? { degraded: true } : {}),
        ...(m.note ? { note: true } : {}),
      },
    }));
  if (!messages.some((m) => m.role === "user")) return;
  syncChat({
    id: draft.conversationId,
    chatType: "onboarding-checkup",
    screen: "onboarding-chat",
    clientId: getClientId(),
    workspaceId: workspaceKey(opts.workspaceName),
    workspaceName: opts.workspaceName,
    country: opts.country,
    phase: draft.phase,
    slots: draft.slots,
    facts: draft.facts,
    meta: { askCounts: draft.askCounts, finished: true, suggestedChips: [], diagnosis: opts.diagnosis },
    startedAt: draft.startedAt,
    messages,
  });
}

/**
 * Send the conversation so far to the server. Fire-and-forget: a failed save
 * never blocks the chat (the server de-duplicates messages by seq, so the
 * next save carries anything that was missed).
 */
export function syncChat(payload: ChatLogPayload): void {
  if (typeof window === "undefined" || payload.messages.length === 0) return;
  try {
    void fetch("/api/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: JSON.stringify(payload).length < 60_000,
    }).catch(() => {});
  } catch {}
}
