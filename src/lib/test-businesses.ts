"use client";
// Development only — fictional test businesses (from testing challenges across
// business types) that can be opened in this browser to see how a test went.
//
// The app keeps one business in this browser's local storage. Opening a test
// business first puts the owner's own data aside (in this browser's IndexedDB),
// then shows the test business; "Back to my own data" puts theirs back exactly
// (changes made inside a test business are not kept). While one is open, calls
// that would save to the owner's account — chat logs, the marketplace,
// connections, new workspaces — are stopped in this browser; AI answers still work.

// The database and storage keys below keep the old "bizzgrowth-" prefix on purpose:
// renaming one would hide the owner's saved data and the test businesses.
const DB_NAME = "bizzgrowth-test-businesses";
const STORE = "items";
const OWN_ID = "__own__";
/** Which test business is open (a local-storage flag, so every tab and reload knows). */
export const VIEWING_KEY = "bizzgrowth-viewing-test-v1";
/** Keys written while a test business was open, by the tabs showing it: they're its keys, not the owner's. */
export const TOUCHED_KEY = "bizzgrowth-test-touched-v1";
/** Kept as they are when switching: who owns this browser's data, this browser's id, and the two flags above. */
const KEEP = new Set(["bizzgrowth-auth-owner-v1", "bizzgrowth-client-id-v1", VIEWING_KEY, TOUCHED_KEY]);
const isAppKey = (k: string) => k.startsWith("bizzgrowth-") && !KEEP.has(k);

export interface TestBusiness {
  id: string;
  name: string;
  /** What kind of business it is and what was tested, in a line or two. */
  story: string;
  savedAt: string;
  /** Its local-storage keys and values. */
  data: Record<string, string>;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const r = run(t.objectStore(STORE));
      t.oncomplete = () => resolve(r.result);
      t.onerror = () => reject(t.error);
    });
  } finally {
    db.close();
  }
}

/** This browser's app data, without the keys that stay put. */
function currentData(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(localStorage)) if (isAppKey(k)) out[k] = localStorage.getItem(k) ?? "";
  return out;
}

function touchedKeys(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(TOUCHED_KEY) ?? "[]") as unknown;
    return Array.isArray(list) ? list.filter((k): k is string => typeof k === "string") : [];
  } catch {
    return [];
  }
}

export async function listTestBusinesses(): Promise<TestBusiness[]> {
  const all = await tx<TestBusiness[]>("readonly", (s) => s.getAll() as IDBRequest<TestBusiness[]>);
  return all.filter((b) => b.id !== OWN_ID).sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveTestBusiness(b: TestBusiness): Promise<void> {
  await tx("readwrite", (s) => s.put(b));
}

/** The test business open in this browser, if any. */
export function viewingTestBusiness(): { id: string; name: string } | null {
  try {
    const raw = localStorage.getItem(VIEWING_KEY);
    return raw ? (JSON.parse(raw) as { id: string; name: string }) : null;
  } catch {
    return null;
  }
}

/** Server calls that would save something to the owner's account. */
const SAVES = /^\/api\/(chats|market|connect|workspace-state)(\/|$)|^\/api\/auth\/(workspace|signup)(\/|$)/;

/** While a test business is open, its chats, briefs and syncs never reach the owner's account. */
function stopSavesToAccount() {
  const w = window as Window & { __bizzTestBusinessGuard?: boolean };
  if (w.__bizzTestBusinessGuard) return;
  w.__bizzTestBusinessGuard = true;
  const send = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(href, window.location.href);
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    if (url.origin === window.location.origin && method !== "GET" && method !== "HEAD" && SAVES.test(url.pathname)) {
      const body = JSON.stringify({ ok: false, error: "This is a test business — nothing from it is saved to your account." });
      return Promise.resolve(new Response(body, { status: 403, headers: { "Content-Type": "application/json" } }));
    }
    return send(input, init);
  };
}

/** In a tab showing a test business, every app key it writes is noted as the test business's. */
function noteTestWrites() {
  const w = window as Window & { __bizzTestWritesNoted?: boolean };
  if (w.__bizzTestWritesNoted) return;
  w.__bizzTestWritesNoted = true;
  const set = Storage.prototype.setItem;
  Storage.prototype.setItem = function (this: Storage, key: string, value: string) {
    set.call(this, key, value);
    if (this !== window.localStorage || !isAppKey(key) || !viewingTestBusiness()) return;
    const list = touchedKeys();
    if (!list.includes(key)) set.call(this, TOUCHED_KEY, JSON.stringify([...list, key]));
  };
}

// Before anything on the page runs, so even calls made while the app starts up are stopped.
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production" && viewingTestBusiness()) {
  stopSavesToAccount();
  noteTestWrites();
}

/** The keys a test business uses here: those it was saved with and those written while it was open. */
async function testKeysOf(id: string): Promise<Set<string>> {
  const b = await tx<TestBusiness | undefined>("readonly", (s) => s.get(id) as IDBRequest<TestBusiness | undefined>);
  return new Set([...Object.keys(b?.data ?? {}), ...touchedKeys()]);
}

/** Open a test business (the owner's own data is put aside first, once). */
export async function openTestBusiness(id: string): Promise<void> {
  const b = await tx<TestBusiness | undefined>("readonly", (s) => s.get(id) as IDBRequest<TestBusiness | undefined>);
  if (!b) throw new Error("Test business not found");
  const current = viewingTestBusiness();
  // What makes way: the owner's data, all of it in the put-aside copy (first test business),
  // or the test business being left (switching). Nothing else is removed.
  let leaving: Set<string>;
  if (!current) {
    const own = currentData();
    await saveTestBusiness({ id: OWN_ID, name: "Your own data", story: "", savedAt: new Date().toISOString(), data: own });
    leaving = new Set(Object.keys(own));
  } else {
    leaving = await testKeysOf(current.id);
  }
  // The flag goes first, so nothing (in this tab or another) syncs the test data as the owner's.
  localStorage.setItem(VIEWING_KEY, JSON.stringify({ id: b.id, name: b.name }));
  for (const k of Object.keys(localStorage)) if (isAppKey(k) && leaving.has(k)) localStorage.removeItem(k);
  for (const [k, v] of Object.entries(b.data)) if (!KEEP.has(k)) localStorage.setItem(k, v);
  window.location.hash = "#/home";
  window.location.reload();
}

/**
 * Put the owner's own data back as it was put aside. Only the test business's
 * keys are removed: anything else (such as the owner's own data saved meanwhile
 * by another tab) stays.
 */
export async function backToOwnData(): Promise<void> {
  const own = await tx<TestBusiness | undefined>("readonly", (s) => s.get(OWN_ID) as IDBRequest<TestBusiness | undefined>);
  if (!own) throw new Error("Your own data was not found");
  const current = viewingTestBusiness();
  const leaving = current ? await testKeysOf(current.id) : new Set<string>();
  for (const k of Object.keys(localStorage)) if (isAppKey(k) && leaving.has(k) && !(k in own.data)) localStorage.removeItem(k);
  for (const [k, v] of Object.entries(own.data)) if (!KEEP.has(k)) localStorage.setItem(k, v);
  localStorage.removeItem(TOUCHED_KEY);
  localStorage.removeItem(VIEWING_KEY);
  window.location.hash = "#/home";
  window.location.reload();
}
