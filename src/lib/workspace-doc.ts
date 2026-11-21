// An owner's workspace data as one document of separately versioned entries:
// one per challenge, coaching step, action, experiment, timeline event, Ask
// entry and entered total, plus the checkup, settings, AI insights and drafts.
// Two copies (this browser's and the account's) are merged entry by entry.
// Shared by the browser (src/lib/workspace-sync.ts) and the server
// (src/app/api/workspace-state/route.ts). Pure functions, no imports.
//
// Merge rules, per entry:
// - the newest change wins (`t`: when the owner's change was noticed);
// - a deletion is an entry too (`d`), so an older copy can't bring the item back;
// - a copy of unknown age (a browser's first sync, `t` = EPOCH) never replaces a
//   known change. Between two copies of unknown age the fuller one is used and
//   the other is kept in `kept`, so nothing is thrown away.

/** "Age unknown": what a browser holds the first time it syncs. */
export const EPOCH = "1970-01-01T00:00:00.000Z";
/** Stands in for a list inside a stored value whose items are entries of their own. */
export const LIST_MARK = "$list";

export interface DocEntry {
  /** The value (absent once deleted). */
  v?: unknown;
  /** When this version was made (ISO, UTC). */
  t: string;
  /** Hash of the value ("" once deleted). */
  h: string;
  /** Deleted by the owner. */
  d?: 1;
}

export interface WorkspaceDoc {
  v: 1;
  entries: Record<string, DocEntry>;
  /** Item order per list, e.g. "bizzgrowth-coach-v1|actions" → ids. */
  orders: Record<string, string[]>;
  /** Copies of unknown age that lost to another copy of unknown age (a few per entry, newest last). */
  kept?: Record<string, DocEntry[]>;
}

export const emptyDoc = (): WorkspaceDoc => ({ v: 1, entries: {}, orders: {} });

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const MAX_KEPT = 3;

/** JSON with object keys sorted, so equal values hash equally whatever order they were built in. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map((x) => (x === undefined ? "null" : stableStringify(x))).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

/** A short, stable hash of a value (cyrb53 over its sorted JSON). */
export function hashOf(value: unknown): string {
  const s = stableStringify(value);
  let h1 = 0xdeadbeef ^ s.length;
  let h2 = 0x41c6ce57 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** Same content (a deletion only equals a deletion). */
export function sameEntry(a: DocEntry, b: DocEntry): boolean {
  return !!a.d === !!b.d && (a.d ? true : a.h === b.h);
}

const fullness = (e: DocEntry) => (e.d ? -1 : stableStringify(e.v).length);

/** Which version stays: the newer; between two of unknown age, the fuller; otherwise the first. */
function pick(first: DocEntry, second: DocEntry): DocEntry {
  if (first.t !== second.t) return second.t > first.t ? second : first;
  if (first.t === EPOCH && fullness(second) > fullness(first)) return second;
  return first;
}

function keep(kept: Record<string, DocEntry[]>, key: string, e: DocEntry): boolean {
  if (e.d) return false;
  const list = kept[key] ?? [];
  if (list.some((x) => x.h === e.h)) return false;
  kept[key] = [...list, e].slice(-MAX_KEPT);
  return true;
}

/** `primary`'s order, with ids only in `secondary` placed right after the id they follow there. */
export function mergeOrder(primary: string[], secondary: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of primary) {
    if (!seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  let after: string | null = null;
  for (const id of secondary) {
    if (!seen.has(id)) {
      out.splice(after === null ? 0 : out.indexOf(after) + 1, 0, id);
      seen.add(id);
    }
    after = id;
  }
  return out;
}

const sameList = (a: string[] | undefined, b: string[] | undefined) =>
  !!a && !!b && a.length === b.length && a.every((x, i) => x === b[i]);

export interface MergeResult {
  doc: WorkspaceDoc;
  /** Entries `incoming` added or replaced. */
  fromIncoming: string[];
  /** Entries where `base` was kept although `incoming` differed. */
  fromBase: string[];
  /** The result differs from `base`. */
  changed: boolean;
}

/**
 * Merge `incoming` into `base` entry by entry. On an exact tie `base` (the
 * account's copy) stays. Item order: `incoming`'s, with items only `base` has
 * placed where they were.
 */
export function mergeDocs(base: WorkspaceDoc | null, incoming: WorkspaceDoc): MergeResult {
  const b = base ?? emptyDoc();
  const entries: Record<string, DocEntry> = { ...b.entries };
  const kept: Record<string, DocEntry[]> = { ...(b.kept ?? {}) };
  const fromIncoming: string[] = [];
  const fromBase: string[] = [];
  let changed = false;

  for (const [key, inc] of Object.entries(incoming.entries)) {
    const cur = entries[key];
    if (!cur) {
      entries[key] = inc;
      fromIncoming.push(key);
      changed = true;
      continue;
    }
    if (sameEntry(cur, inc)) {
      // Same content: remember the later time, so it isn't beaten by an older change.
      if (inc.t > cur.t) {
        entries[key] = { ...cur, t: inc.t };
        changed = true;
      }
      continue;
    }
    if (pick(cur, inc) === inc) {
      entries[key] = inc;
      fromIncoming.push(key);
      changed = true;
      if (cur.t === EPOCH) keep(kept, key, cur);
    } else {
      fromBase.push(key);
      if (inc.t === EPOCH && keep(kept, key, inc)) changed = true;
    }
  }

  const orders: Record<string, string[]> = { ...b.orders };
  for (const [list, order] of Object.entries(incoming.orders)) {
    const merged = mergeOrder(order, b.orders[list] ?? []);
    if (!sameList(merged, b.orders[list])) {
      orders[list] = merged;
      changed = true;
    }
  }
  // Orders only list what is still there.
  for (const [list, order] of Object.entries(orders)) {
    const live = order.filter((id) => entries[`${list}|${id}`] && !entries[`${list}|${id}`].d);
    if (live.length !== order.length) orders[list] = live;
  }

  const doc: WorkspaceDoc = { v: 1, entries, orders };
  if (Object.keys(kept).length) doc.kept = kept;
  return { doc, fromIncoming, fromBase, changed };
}

/**
 * A document from JSON, checked. `fromClient`: hashes are recomputed and `kept`
 * is ignored (only the server keeps lost copies). Returns null if malformed.
 */
export function parseDoc(raw: unknown, opts: { fromClient: boolean }): WorkspaceDoc | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as { entries?: unknown; orders?: unknown; kept?: unknown };
  const entries = parseEntries(r.entries, opts.fromClient);
  if (!entries) return null;
  const orders: Record<string, string[]> = {};
  if (r.orders !== undefined) {
    if (!r.orders || typeof r.orders !== "object" || Array.isArray(r.orders)) return null;
    for (const [list, order] of Object.entries(r.orders as Record<string, unknown>)) {
      if (!validKey(list) || !Array.isArray(order) || order.length > 5000) return null;
      if (order.some((id) => typeof id !== "string" || id.length > 400)) return null;
      orders[list] = order as string[];
    }
  }
  const doc: WorkspaceDoc = { v: 1, entries, orders };
  if (!opts.fromClient && r.kept && typeof r.kept === "object" && !Array.isArray(r.kept)) {
    const kept: Record<string, DocEntry[]> = {};
    for (const [key, list] of Object.entries(r.kept as Record<string, unknown>)) {
      if (!Array.isArray(list)) continue;
      const parsed = parseEntries(Object.fromEntries(list.map((e, i) => [`${key}#${i}`, e])), false);
      if (parsed) kept[key] = Object.values(parsed);
    }
    if (Object.keys(kept).length) doc.kept = kept;
  }
  return doc;
}

// The synced storage keys keep the old "bizzgrowth-" prefix on purpose (renaming one would hide saved data).
const validKey = (k: string) => k.startsWith("bizzgrowth-") && k.length <= 500;

function parseEntries(raw: unknown, fromClient: boolean): Record<string, DocEntry> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const list = Object.entries(raw as Record<string, unknown>);
  if (list.length > 20000) return null;
  const out: Record<string, DocEntry> = {};
  for (const [key, e] of list) {
    if (!validKey(key) || !e || typeof e !== "object") return null;
    const x = e as Partial<DocEntry>;
    if (typeof x.t !== "string" || !ISO.test(x.t)) return null;
    if (x.d !== undefined && x.d !== 1) return null;
    if (x.d) {
      out[key] = { t: x.t, h: "", d: 1 };
      continue;
    }
    if (!("v" in x) || x.v === undefined) return null;
    const h = fromClient || typeof x.h !== "string" ? hashOf(x.v) : x.h;
    out[key] = { v: x.v, t: x.t, h };
  }
  return out;
}
