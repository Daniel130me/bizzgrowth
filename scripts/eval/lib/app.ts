// The app's own state (src/lib/store.ts), run outside the browser.
//
// The runner never re-implements the app's logic: challenges, the plan order,
// coach steps and check-in schedules come from the real store, and every
// request body is built from that state the way the screen builds it. The
// store's localStorage is a file in the run folder, so a run can be driven one
// owner turn at a time across separate commands.
//
// Library code that calls fetch("/api/…") itself (insights, a challenge's
// diagnosis) is pointed at the dev server and recorded like any other call.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { apiCall } from "./http";
import type { RunContext } from "./context";

let mem = new Map<string, string>();
let stateFile = "";
let currentFeature = "background";

function installStorage(file: string): void {
  stateFile = file;
  mem = new Map(Object.entries(existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Record<string, string>) : {}));
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k: string, v: string) => void mem.set(k, String(v)),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
    key: (i: number) => [...mem.keys()][i] ?? null,
    get length() {
      return mem.size;
    },
  } as Storage;
}

function installFetch(ctx: RunContext): void {
  const real = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (!url.startsWith("/api/")) return real(input as RequestInfo, init);
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    const r = await apiCall(ctx, currentFeature, url, body, { method: (init?.method as "GET" | "POST" | undefined) ?? (body ? "POST" : "GET") });
    return new Response(JSON.stringify(r.json), { status: r.status, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
}

/** Calls made by library code from here on are recorded under this feature. */
export function asFeature(feature: string): void {
  currentFeature = feature;
}

export async function openApp(ctx: RunContext) {
  installStorage(ctx.statePath);
  installFetch(ctx);
  const { useBizz } = await import("@/lib/store");
  useBizz.getState().hydrate();
  return useBizz;
}

/** Write the store's localStorage back to the run folder. */
export function saveApp(): void {
  if (!stateFile) return;
  writeFileSync(stateFile, `${JSON.stringify(Object.fromEntries(mem), null, 2)}\n`);
}
