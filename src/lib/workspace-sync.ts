"use client";
// Keeps the owner's workspace data in step between this browser and their
// account, so it survives a cleared browser, an app update, another browser or a
// new device. That covers challenges, coaching steps and check-ins, actions and
// experiments, Ask history, entered totals, AI insights, the checkup, settings and
// drafts.
//
// The app keeps reading and writing localStorage exactly as before. This module
// splits that data into separately versioned entries (one per challenge, step,
// action, ...). It sends what changed to /api/workspace-state shortly after each
// change. When someone signs in, it merges the account's copy in: per entry, the
// newest change wins (src/lib/workspace-doc.ts).
//
// - A deletion is recorded only when an item this browser had goes away, so
//   nothing is removed unless the owner removed it.
// - A browser's first sync is a merge. What only it has goes up, what only the
//   account has comes down, and nothing of either is thrown away.
// - Nothing is sent while a test business is open, and never for a business
//   other than the session's workspace.

import { useBizz } from "@/lib/store";
import { TOUCHED_KEY, VIEWING_KEY, viewingTestBusiness } from "@/lib/test-businesses";
import { workspaceKey } from "@/lib/chat-log";
import type { MeUser } from "@/lib/auth/client";
import { EPOCH, LIST_MARK, emptyDoc, hashOf, mergeDocs, parseDoc, sameEntry, type DocEntry, type WorkspaceDoc } from "@/lib/workspace-doc";

const API = "/api/workspace-state";
// All storage keys here keep the old "bizzgrowth-" prefix on purpose: they name the
// owner's saved data, and renaming one would hide it (the product is now Nellovia).
const META_KEY = "bizzgrowth-sync-v1";
const CHECKUP_KEY = "bizzgrowth-checkup-v1";
/** A previous owner's data kept aside in this browser (IndexedDB, or localStorage if that fails). */
const PARKED_PREFIX = "bizzgrowth-parked-v1:";
const PARKED_INDEX = `${PARKED_PREFIX}ids`;
const PARK_DB = "bizzgrowth-parked-v1";
const PARK_STORE = "owners";
/** sessionStorage: when this tab last reloaded to show the account's copy (prevents loops). */
const RELOADED_KEY = "bizzgrowth-sync-reloaded-at";

/** Keys about this browser rather than the business: they never leave it. */
const LOCAL_ONLY = new Set([
  "bizzgrowth-auth-owner-v1",
  "bizzgrowth-client-id-v1",
  VIEWING_KEY,
  TOUCHED_KEY,
  "bizzgrowth-land-after-signin",
  META_KEY,
]);

export function isParkedKey(k: string): boolean {
  return k.startsWith(PARKED_PREFIX);
}
export function isSyncedKey(k: string): boolean {
  return k.startsWith("bizzgrowth-") && !LOCAL_ONLY.has(k) && !isParkedKey(k);
}

/* ------------------------------------------------------------------ */
/* Stored values ⇄ entries                                             */
/* ------------------------------------------------------------------ */

type ItemId = (x: unknown) => string | null;
const byId: ItemId = (x) => {
  const id = (x as { id?: unknown } | null)?.id;
  return typeof id === "string" && id ? id : null;
};
const learningId: ItemId = (x) => {
  const l = x as { at?: unknown; text?: unknown } | null;
  return typeof l?.at === "string" && typeof l?.text === "string" ? `${l.at}|${l.text}` : null;
};

/** Lists inside stored values whose items are versioned one by one (everything else is versioned per key). */
const LISTS: Record<string, { path: string[]; id: ItemId }[]> = {
  "bizzgrowth-coach-v1": [
    { path: ["actions"], id: byId },
    { path: ["experiments"], id: byId },
    { path: ["timelineEvents"], id: byId },
    { path: ["coach", "steps"], id: byId },
    { path: ["coach", "learnings"], id: learningId },
  ],
  "bizzgrowth-challenges-v1": [{ path: ["items"], id: byId }],
  "bizzgrowth-asklog-v1": [{ path: [], id: byId }],
  "bizzgrowth-manual-v1": [{ path: [], id: byId }],
};
const LIST_KEYS = Object.keys(LISTS);

/** The localStorage key an entry (or list) belongs to. */
function storageKeyOf(entryKey: string): string {
  return LIST_KEYS.find((k) => entryKey.startsWith(`${k}|`)) ?? entryKey;
}

interface View {
  entries: Record<string, { v: unknown; h: string }>;
  orders: Record<string, string[]>;
}

function getAt(obj: unknown, path: string[]): unknown {
  let cur = obj;
  for (const p of path) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function setAt(obj: unknown, path: string[], value: unknown): unknown {
  if (!path.length) return value;
  const [head, ...rest] = path;
  const o = obj && typeof obj === "object" ? (obj as Record<string, unknown>) : {};
  return { ...o, [head]: setAt(o[head], rest, value) };
}

function safeKeys(): string[] {
  try {
    return Object.keys(localStorage);
  } catch {
    return [];
  }
}
function safeGet(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}

/** This browser's data (or a saved set of keys) as entries. */
function viewOf(source?: Record<string, string>): View {
  const view: View = { entries: {}, orders: {} };
  for (const key of source ? Object.keys(source) : safeKeys()) {
    if (!isSyncedKey(key)) continue;
    const raw = source ? source[key] : safeGet(key);
    if (raw == null) continue;
    if (LISTS[key] && split(key, raw, view)) continue;
    view.entries[key] = { v: raw, h: hashOf(raw) };
  }
  return view;
}

function split(key: string, raw: string, view: View): boolean {
  let rest: unknown;
  try {
    rest = JSON.parse(raw);
  } catch {
    return false;
  }
  const items: [string, unknown][] = [];
  const lists: [string, string[]][] = [];
  for (const spec of LISTS[key]) {
    const arr = getAt(rest, spec.path);
    if (!Array.isArray(arr)) continue;
    // An item without a usable id is known by its content; repeated ids are numbered.
    const used = new Map<string, number>();
    const ids = arr.map((item) => {
      const base = spec.id(item) ?? `~${hashOf(item)}`;
      const n = (used.get(base) ?? 0) + 1;
      used.set(base, n);
      return n === 1 ? base : `${base}#${n}`;
    });
    const list = `${key}|${spec.path.join(".")}`;
    arr.forEach((item, i) => items.push([`${list}|${ids[i]}`, item]));
    lists.push([list, ids]);
    rest = setAt(rest, spec.path, LIST_MARK);
  }
  if (!lists.length) return false;
  const v = { $rest: rest };
  view.entries[key] = { v, h: hashOf(v) };
  for (const [k, item] of items) view.entries[k] = { v: item, h: hashOf(item) };
  for (const [list, ids] of lists) view.orders[list] = ids;
  return true;
}

/** A stored value rebuilt from a document (null: the key isn't there). */
function assemble(key: string, doc: WorkspaceDoc): string | null {
  const e = doc.entries[key];
  if (!e || e.d) return null;
  const v = e.v;
  const wrapped = LISTS[key] && v && typeof v === "object" && "$rest" in v;
  if (!wrapped) return typeof v === "string" ? v : JSON.stringify(v);
  let out: unknown = JSON.parse(JSON.stringify((v as { $rest: unknown }).$rest));
  for (const spec of LISTS[key]) {
    if (getAt(out, spec.path) !== LIST_MARK) continue;
    const list = `${key}|${spec.path.join(".")}`;
    const prefix = `${list}|`;
    const live = new Map<string, unknown>();
    for (const [k, x] of Object.entries(doc.entries)) if (k.startsWith(prefix) && !x.d) live.set(k.slice(prefix.length), x.v);
    const order = (doc.orders[list] ?? []).filter((id) => live.has(id));
    const placed = new Set(order);
    for (const id of live.keys()) if (!placed.has(id)) order.push(id);
    out = setAt(out, spec.path, order.map((id) => live.get(id)));
  }
  return JSON.stringify(out);
}

/** Two stored values hold the same data (formatting and key order aside). */
function sameStored(a: string | null, b: string | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  try {
    return hashOf(JSON.parse(a)) === hashOf(JSON.parse(b));
  } catch {
    return false;
  }
}

const sameIds = (a: string[] | undefined, b: string[] | undefined) =>
  !!a && !!b && a.length === b.length && a.every((x, i) => x === b[i]);

/* ------------------------------------------------------------------ */
/* What this browser has seen and sent                                 */
/* ------------------------------------------------------------------ */

interface Seen {
  t: string;
  h: string;
  d?: 1;
  /** Not on the account yet. */
  p?: 1;
}
interface Meta {
  v: 1;
  userId: string;
  workspaceId: string;
  seen: Record<string, Seen>;
  ord: Record<string, { h: string; p?: 1 }>;
}
interface Who {
  id: string;
  workspaceId: string;
  workspaceName: string;
}

function loadMeta(): Meta | null {
  try {
    const raw = localStorage.getItem(META_KEY);
    const m = raw ? (JSON.parse(raw) as Meta) : null;
    return m && m.v === 1 && m.seen && m.ord ? m : null;
  } catch {
    return null;
  }
}
function saveMeta(m: Meta) {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(m));
  } catch {}
}
const newMeta = (w: Who): Meta => ({ v: 1, userId: w.id, workspaceId: w.workspaceId, seen: {}, ord: {} });
const metaFor = (m: Meta | null, w: Who): m is Meta => !!m && m.userId === w.id && m.workspaceId === w.workspaceId;
const sameWho = (a: Who | null, b: Who | null) => !!a && !!b && a.id === b.id && a.workspaceId === b.workspaceId;
const nowIso = () => new Date().toISOString();

/** Note what changed since last time, as of `stamp`. Returns whether anything did. */
function observe(meta: Meta, view: View, stamp: string): boolean {
  let changed = false;
  for (const [k, e] of Object.entries(view.entries)) {
    const s = meta.seen[k];
    if (!s || s.d || s.h !== e.h) {
      meta.seen[k] = { t: stamp, h: e.h, p: 1 };
      changed = true;
    }
  }
  // Gone from this browser after it had it: the owner deleted it.
  for (const [k, s] of Object.entries(meta.seen)) {
    if (!s.d && !view.entries[k]) {
      meta.seen[k] = { t: stamp, h: "", d: 1, p: 1 };
      changed = true;
    }
  }
  for (const [list, ids] of Object.entries(view.orders)) {
    const h = hashOf(ids);
    if (meta.ord[list]?.h !== h) {
      meta.ord[list] = { h, p: 1 };
      changed = true;
    }
  }
  return changed;
}

/** This browser's entries as a document (`onlyPending`: just what the account still lacks). */
function docOf(meta: Meta, view: View, onlyPending: boolean): WorkspaceDoc {
  const doc = emptyDoc();
  for (const [k, s] of Object.entries(meta.seen)) {
    if (onlyPending && !s.p) continue;
    if (s.d) doc.entries[k] = { t: s.t, h: "", d: 1 };
    else if (view.entries[k]?.h === s.h) doc.entries[k] = { v: view.entries[k].v, t: s.t, h: s.h };
  }
  for (const [list, o] of Object.entries(meta.ord)) {
    if (onlyPending && !o.p) continue;
    if (view.orders[list]) doc.orders[list] = view.orders[list];
  }
  return doc;
}

/* ------------------------------------------------------------------ */
/* Talking to the account                                              */
/* ------------------------------------------------------------------ */

function localWorkspaceName(source?: Record<string, string>): string | null {
  if (!source) {
    const name = useBizz.getState().userWorkspace?.name;
    if (name) return name;
  }
  try {
    const raw = source ? source[CHECKUP_KEY] : safeGet(CHECKUP_KEY);
    const parsed = raw ? (JSON.parse(raw) as { userWorkspace?: { name?: string } | null }) : null;
    return parsed?.userWorkspace?.name || null;
  } catch {
    return null;
  }
}

/** This browser's data is the session's business (or no business yet). */
function namesMatch(w: Who): boolean {
  const name = localWorkspaceName();
  return !name || workspaceKey(name) === workspaceKey(w.workspaceName);
}

const viewing = () => viewingTestBusiness() !== null;

async function fetchAccountCopy(): Promise<{ doc: WorkspaceDoc | null } | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(API, { cache: "no-store", credentials: "same-origin", signal: ctrl.signal });
    if (!res.ok) return null;
    const data = (await res.json()) as { ok?: boolean; doc?: unknown };
    if (!data?.ok) return null;
    if (data.doc == null) return { doc: null };
    const doc = parseDoc(data.doc, { fromClient: false });
    return doc ? { doc } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function put(w: Who, doc: WorkspaceDoc, opts?: { keepalive?: boolean; workspaceName?: string }): Promise<boolean> {
  if (viewing()) return false;
  const body = JSON.stringify({ workspaceName: opts?.workspaceName ?? localWorkspaceName() ?? w.workspaceName, doc });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(API, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body,
      keepalive: !!opts?.keepalive && body.length < 60_000,
      signal: ctrl.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* Another owner's data kept aside in this browser                     */
/* ------------------------------------------------------------------ */

interface Parked {
  userId: string;
  savedAt: string;
  data: Record<string, string>;
  meta: Meta | null;
}

function parkedIds(): string[] {
  try {
    const ids = JSON.parse(localStorage.getItem(PARKED_INDEX) ?? "[]") as unknown;
    return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function setParkedIds(ids: string[]) {
  try {
    if (ids.length) localStorage.setItem(PARKED_INDEX, JSON.stringify(ids));
    else localStorage.removeItem(PARKED_INDEX);
  } catch {}
}

function parkDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(PARK_DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(PARK_STORE)) req.result.createObjectStore(PARK_STORE, { keyPath: "userId" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function parkTx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await parkDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const t = db.transaction(PARK_STORE, mode);
      const r = run(t.objectStore(PARK_STORE));
      t.oncomplete = () => resolve(r.result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  } finally {
    db.close();
  }
}

async function writeParked(rec: Parked): Promise<void> {
  setParkedIds([...parkedIds().filter((id) => id !== rec.userId), rec.userId]);
  try {
    await parkTx("readwrite", (s) => s.put(rec));
    return;
  } catch {}
  try {
    localStorage.setItem(PARKED_PREFIX + rec.userId, JSON.stringify(rec));
  } catch {}
}

async function readParked(userId: string): Promise<Parked | null> {
  if (!parkedIds().includes(userId)) return null;
  try {
    const rec = await parkTx<Parked | undefined>("readonly", (s) => s.get(userId) as IDBRequest<Parked | undefined>);
    if (rec) return rec;
  } catch {}
  try {
    const raw = localStorage.getItem(PARKED_PREFIX + userId);
    return raw ? (JSON.parse(raw) as Parked) : null;
  } catch {
    return null;
  }
}

async function deleteParked(userId: string): Promise<void> {
  try {
    await parkTx("readwrite", (s) => s.delete(userId));
  } catch {}
  try {
    localStorage.removeItem(PARKED_PREFIX + userId);
  } catch {}
  setParkedIds(parkedIds().filter((id) => id !== userId));
}

/**
 * Another account is signing in on this browser. Anything of the previous
 * owner's that hasn't reached their account yet is kept aside for them. It's
 * never shown to anyone else, and it's sent the next time they sign in here.
 */
export async function parkOwnerData(userId: string): Promise<void> {
  const data: Record<string, string> = {};
  for (const k of safeKeys()) {
    if (!isSyncedKey(k)) continue;
    const v = safeGet(k);
    if (v !== null) data[k] = v;
  }
  if (!Object.keys(data).length) return;
  const stored = loadMeta();
  const meta = stored && stored.userId === userId ? stored : null;
  if (meta) {
    const probe = JSON.parse(JSON.stringify(meta)) as Meta;
    const changed = observe(probe, viewOf(data), nowIso());
    const pending = Object.values(probe.seen).some((s) => s.p) || Object.values(probe.ord).some((o) => o.p);
    if (!changed && !pending) return; // all of it is on their account already
  }
  await writeParked({ userId, savedAt: nowIso(), data, meta });
}

/** A copy this owner left here when another account signed in: send it to their account. */
async function sendParked(w: Who): Promise<void> {
  const rec = await readParked(w.id);
  if (!rec) return;
  const known = rec.meta && metaFor(rec.meta, w) ? rec.meta : null;
  const meta = known ?? newMeta(w);
  const view = viewOf(rec.data);
  observe(meta, view, known ? rec.savedAt : EPOCH);
  const doc = docOf(meta, view, false);
  if (!Object.keys(doc.entries).length) {
    await deleteParked(w.id);
    return;
  }
  if (await put(w, doc, { workspaceName: localWorkspaceName(rec.data) ?? w.workspaceName })) await deleteParked(w.id);
}

/* ------------------------------------------------------------------ */
/* Keeping in step                                                     */
/* ------------------------------------------------------------------ */

export type SyncOutcome = "reload" | "ok" | "skip" | "unknown";

const ctx: {
  me: Who | null;
  ready: boolean;
  /** Until when (ms) the account's newer data may be written into this browser (then the page reloads). */
  applyBy: number;
  /** After a failed check, don't ask the account again before this time (ms). */
  retryAt: number;
  pushing: boolean;
  pushAgain: boolean;
  beginning: Promise<SyncOutcome> | null;
} = { me: null, ready: false, applyBy: 0, retryAt: 0, pushing: false, pushAgain: false, beginning: null };

function who(me: MeUser | null): Who | null {
  if (!me || me.accountType === "specialist" || !me.workspaceId || !me.workspaceName) return null;
  return { id: me.id, workspaceId: me.workspaceId, workspaceName: me.workspaceName };
}

function reloadedRecently(): boolean {
  try {
    return Date.now() - Number(sessionStorage.getItem(RELOADED_KEY) ?? 0) < 20_000;
  } catch {
    return false;
  }
}
function markReloaded() {
  try {
    sessionStorage.setItem(RELOADED_KEY, String(Date.now()));
  } catch {}
}

/**
 * Bring this browser and the signed-in owner's account in step. Until `applyBy`
 * (a time in ms), the account's newer data may be written into this browser,
 * and the caller then reloads the page ("reload"). After that time it shows on
 * the next load instead, so the page never changes under the owner's hands.
 */
export async function syncWorkspaceData(me: MeUser | null, opts: { applyBy?: number } = {}): Promise<SyncOutcome> {
  const w = who(me);
  if (!w) {
    stopWorkspaceSync();
    return "skip";
  }
  if (!sameWho(ctx.me, w)) ctx.ready = false;
  ctx.me = w;
  ctx.applyBy = Math.max(ctx.applyBy, opts.applyBy ?? 0);
  if (opts.applyBy) ctx.retryAt = 0;
  startWatcher();
  return beginFor(w);
}

function beginFor(w: Who): Promise<SyncOutcome> {
  if (viewing() || !namesMatch(w)) return Promise.resolve("skip");
  if (!ctx.beginning) {
    ctx.beginning = begin(w)
      .catch((): SyncOutcome => "unknown")
      .then((r) => {
        if (r === "unknown") ctx.retryAt = Date.now() + 60_000;
        return r;
      })
      .finally(() => {
        ctx.beginning = null;
      });
  }
  return ctx.beginning;
}

async function begin(w: Who): Promise<SyncOutcome> {
  await sendParked(w);
  const account = await fetchAccountCopy();
  if (!account) return "unknown"; // offline, or saving to the account isn't switched on yet
  if (!sameWho(ctx.me, w) || viewing() || !namesMatch(w)) return "skip";

  const stored = loadMeta();
  const fresh = !metaFor(stored, w);
  const meta = metaFor(stored, w) ? stored : newMeta(w);
  const view = viewOf();
  // First sync in this browser: what it holds has no known age, so it adds to
  // the account's copy but never replaces a change the account knows about.
  observe(meta, view, fresh ? EPOCH : nowIso());
  const server = account.doc ?? emptyDoc();
  const local = docOf(meta, view, false);
  const sameAsServer = (k: string, e: DocEntry) => {
    const se = server.entries[k];
    return !!se && se.t === e.t && sameEntry(se, e);
  };

  // What the account doesn't have yet goes there first, so nothing of this
  // browser's is lost when it takes the merged copy: a version that loses is
  // kept on the account. If that can't be sent, nothing here is overwritten.
  const outgoing = emptyDoc();
  for (const [k, e] of Object.entries(local.entries)) if (!sameAsServer(k, e)) outgoing.entries[k] = e;
  for (const [list, ids] of Object.entries(local.orders)) if (!sameIds(server.orders[list], ids)) outgoing.orders[list] = ids;
  if ((Object.keys(outgoing.entries).length || Object.keys(outgoing.orders).length) && !(await put(w, outgoing))) return "unknown";
  // Nothing below waits on anything, so the decision to write and reload can't go stale.
  if (!sameWho(ctx.me, w) || viewing() || !namesMatch(w)) return "skip";

  const merged = mergeDocs(server, local).doc;
  const onServer = (k: string, e: DocEntry) => {
    const sent = outgoing.entries[k];
    return sameAsServer(k, e) || (!!sent && sent.t === e.t && sameEntry(sent, e));
  };

  const keys = new Set([...Object.keys(view.entries), ...Object.keys(merged.entries)].map(storageKeyOf));
  const toWrite = [...keys].filter((k) => !sameStored(assemble(k, merged), safeGet(k)));
  const applying = toWrite.length > 0 && Date.now() <= ctx.applyBy && !reloadedRecently();
  ctx.applyBy = 0;

  if (applying) {
    for (const k of toWrite) {
      const value = assemble(k, merged);
      try {
        if (value === null) localStorage.removeItem(k);
        else localStorage.setItem(k, value);
      } catch {}
    }
    // This browser now holds the merged copy; whatever the account lacks is sent after the reload.
    const after = viewOf();
    meta.seen = {};
    for (const [k, e] of Object.entries(merged.entries)) {
      const a = after.entries[k];
      if (e.d) meta.seen[k] = { t: e.t, h: "", d: 1, ...(onServer(k, e) ? {} : { p: 1 as const }) };
      else if (a) meta.seen[k] = { t: e.t, h: a.h, ...(a.h === e.h && onServer(k, e) ? {} : { p: 1 as const }) };
    }
    for (const [k, a] of Object.entries(after.entries)) if (!meta.seen[k]) meta.seen[k] = { t: nowIso(), h: a.h, p: 1 };
    meta.ord = {};
    for (const [list, ids] of Object.entries(after.orders)) {
      meta.ord[list] = { h: hashOf(ids), ...(sameIds(server.orders[list], ids) || sameIds(outgoing.orders[list], ids) ? {} : { p: 1 as const }) };
    }
    saveMeta(meta);
    markReloaded();
    return "reload";
  }

  for (const [k, s] of Object.entries(meta.seen)) {
    const e = merged.entries[k];
    if (!e) continue;
    if (s.t === e.t && sameEntry(s, e)) {
      if (onServer(k, e)) delete s.p;
      else s.p = 1;
    } else {
      delete s.p; // the account has a newer version: it shows after the next reload
    }
  }
  for (const [list, o] of Object.entries(meta.ord)) {
    if (sameIds(server.orders[list], view.orders[list]) || sameIds(outgoing.orders[list], view.orders[list])) delete o.p;
    else o.p = 1;
  }
  saveMeta(meta);
  ctx.ready = true;
  void pushPending();
  return "ok";
}

async function pushPending(opts?: { keepalive?: boolean }): Promise<boolean> {
  const w = ctx.me;
  if (!w || !ctx.ready || viewing()) return false;
  if (ctx.pushing) {
    ctx.pushAgain = true;
    return false;
  }
  const meta = loadMeta();
  if (!metaFor(meta, w) || !namesMatch(w)) {
    ctx.ready = false;
    return false;
  }
  const view = viewOf();
  if (observe(meta, view, nowIso())) saveMeta(meta);
  const doc = docOf(meta, view, true);
  if (!Object.keys(doc.entries).length && !Object.keys(doc.orders).length) return true;
  ctx.pushing = true;
  try {
    if (!(await put(w, doc, { keepalive: opts?.keepalive }))) return false;
    // Saved: clear the marks of what was sent, unless it changed again meanwhile.
    const after = loadMeta();
    if (metaFor(after, w)) {
      for (const [k, e] of Object.entries(doc.entries)) {
        const s = after.seen[k];
        if (s?.p && s.t === e.t && sameEntry(s, e)) delete s.p;
      }
      for (const [list, ids] of Object.entries(doc.orders)) {
        const o = after.ord[list];
        if (o?.p && o.h === hashOf(ids)) delete o.p;
      }
      saveMeta(after);
    }
    return true;
  } finally {
    ctx.pushing = false;
    if (ctx.pushAgain) {
      ctx.pushAgain = false;
      schedule();
    }
  }
}

let watching = false;
let timer: ReturnType<typeof setTimeout> | null = null;

function schedule(ms = 1500) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void tick();
  }, ms);
}

async function tick(opts?: { keepalive?: boolean }): Promise<void> {
  const w = ctx.me;
  if (!w || viewing()) return;
  if (!ctx.ready) {
    // Not in step yet for this owner (e.g. a workspace was just created): try now, without reloading.
    if (Date.now() >= ctx.retryAt) await beginFor(w);
    return;
  }
  await pushPending(opts);
}

function startWatcher() {
  if (watching || typeof window === "undefined") return;
  watching = true;
  // Every change to the app's data goes through the store; chat drafts are caught by the timer.
  useBizz.subscribe(() => schedule());
  window.setInterval(() => void tick(), 15_000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void tick({ keepalive: true });
  });
  window.addEventListener("pagehide", () => void tick({ keepalive: true }));
}

/** Send anything not yet on the account now (before signing out or switching accounts). */
export async function flushWorkspaceSync(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!ctx.me || !ctx.ready) return;
  await Promise.race([pushPending(), new Promise((r) => setTimeout(r, 4000))]);
}

/** Signed out: stop sending until the next sign-in. */
export function stopWorkspaceSync(): void {
  ctx.me = null;
  ctx.ready = false;
  ctx.applyBy = 0;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

/* ------------------------------------------------------------------ */
/* Other tabs                                                          */
/* ------------------------------------------------------------------ */

/**
 * Another tab changed the app's data, or opened or closed a test business. This
 * tab's memory is then out of date, so it reloads before it can write old data
 * over the new.
 */
function watchOtherTabs() {
  const loadedAt = Date.now();
  let reloading = false;
  window.addEventListener("storage", (e) => {
    if (e.storageArea !== window.localStorage || reloading) return;
    if (e.key !== null && e.key !== VIEWING_KEY && !isSyncedKey(e.key)) return;
    reloading = true;
    // Opening or leaving a test business shows at once. Other changes wait until this
    // tab has been open a few seconds, so two tabs can't keep reloading each other.
    const wait = e.key === VIEWING_KEY ? 0 : Math.max(0, loadedAt + 5000 - Date.now());
    setTimeout(() => window.location.reload(), wait);
  });
}

if (typeof window !== "undefined") watchOtherTabs();
