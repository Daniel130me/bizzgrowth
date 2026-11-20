"use client";
// Browser side of auth: talks to /api/auth/* and keeps the store in sync with
// the server session (httpOnly cookie — never readable from JS).

import { useBizz } from "@/lib/store";
import type { UserWorkspaceMeta } from "@/lib/data/businesses";
import { restoreFinishedCheckup } from "@/lib/checkup-restore";
import { navigate } from "@/lib/router";

export interface MeUser {
  id: string;
  email: string;
  name: string;
  jobRole: string | null;
  workspaceId: string | null;
  workspaceName: string | null;
  workspace: { type: string; country: string | null; currency: string } | null;
}

type Result = { ok: true } | { ok: false; error: string; field?: string; status: number };

// Which server user the local (per-browser) workspace data belongs to.
const OWNER_KEY = "bizzgrowth-auth-owner-v1";
// Set when sign-in had to reload the page: pick the landing page once the
// reloaded app knows whether this user's checkup is done.
const LAND_AFTER_RELOAD = "bizzgrowth-land-after-signin";

async function post(path: string, body?: unknown): Promise<Result> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string; field?: string };
    if (res.ok) return { ok: true };
    return { ok: false, status: res.status, error: data.error || "Something went wrong. Please try again.", field: data.field };
  } catch {
    return { ok: false, status: 0, error: "You appear to be offline. Check your connection and try again." };
  }
}

/** Ask the server who is signed in. Returns undefined when the server can't tell (offline / DB down). */
export async function fetchMe(): Promise<MeUser | null | undefined> {
  try {
    const res = await fetch("/api/auth/me", { cache: "no-store", credentials: "same-origin" });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { user: MeUser | null };
    return data.user;
  } catch {
    return undefined;
  }
}

/**
 * Local workspace data (localStorage) is per browser, not per account. If a
 * different account signs in on this browser, drop the previous owner's local
 * copy so nobody sees another person's business. Their data stays on the server.
 */
function claimLocalData(userId: string): boolean {
  try {
    const prev = localStorage.getItem(OWNER_KEY);
    localStorage.setItem(OWNER_KEY, userId);
    if (prev && prev !== userId) {
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith("bizzgrowth-") && k !== OWNER_KEY) localStorage.removeItem(k);
      }
      return true;
    }
  } catch {}
  return false;
}

/** Push the server session into the store. Returns the user (or null). */
export async function syncSession(opts?: { thenGoTo?: string; land?: boolean }): Promise<MeUser | null | undefined> {
  const me = await fetchMe();
  if (me === undefined) return undefined; // unknown: keep whatever we had
  if (me && claimLocalData(me.id)) {
    // Another account's data was in memory; reload so the store starts clean.
    if (opts?.thenGoTo) window.history.replaceState(null, "", `#/${opts.thenGoTo}`);
    if (opts?.land) {
      try {
        sessionStorage.setItem(LAND_AFTER_RELOAD, "1");
      } catch {}
    }
    window.location.reload();
    return me;
  }
  restoreWorkspace(me);
  // Onboarding finished earlier but this browser lost it → bring it back, so a
  // returning owner goes to their workspace instead of through setup again.
  // Capped so a slow server never holds up sign-in; the restore still lands later.
  if (me) await Promise.race([restoreFinishedCheckup(), new Promise((r) => setTimeout(r, 4000))]);
  useBizz.getState().setSession(me);
  if (me && consumeLandAfterReload()) navigate(landingFor(me));
  return me;
}

/** A workspace saved on the server but missing in this browser (new device, cleared storage). */
function restoreWorkspace(me: MeUser | null) {
  const s = useBizz.getState();
  if (!me?.workspaceId || !me.workspaceName || !me.workspace || s.userWorkspace) return;
  const meta: UserWorkspaceMeta = {
    name: me.workspaceName,
    type: me.workspace.type === "ecommerce" ? "ecommerce" : "service",
    country: me.workspace.country ?? "",
    currency: me.workspace.currency,
  };
  useBizz.setState({ userWorkspace: meta, businessId: "user-workspace", settings: { ...s.settings, businessName: meta.name } });
}

function consumeLandAfterReload(): boolean {
  try {
    if (!sessionStorage.getItem(LAND_AFTER_RELOAD)) return false;
    sessionStorage.removeItem(LAND_AFTER_RELOAD);
    return true;
  } catch {
    return false;
  }
}

/** Where a signed-in user should land: setup if they have no workspace yet, else Home. */
export function landingFor(_user?: MeUser | null): string {
  // Finished checkup (restored from the saved chat if needed) → Home; otherwise
  // the setup start page, which offers "Resume setup" for an unfinished chat.
  return useBizz.getState().checkup.facts ? "home" : "welcome";
}

export async function signIn(email: string, password: string, remember: boolean): Promise<Result & { user?: MeUser | null }> {
  const r = await post("/api/auth/login", { email, password, remember });
  if (!r.ok) return r;
  return { ...r, user: await syncSession({ thenGoTo: "welcome", land: true }) };
}

export async function signUp(name: string, email: string, password: string): Promise<Result> {
  const r = await post("/api/auth/signup", { name, email, password });
  if (r.ok) await syncSession({ thenGoTo: "verify-email" });
  return r;
}

export async function signOut(): Promise<void> {
  await post("/api/auth/logout");
  useBizz.getState().setSession(null);
}

export async function saveWorkspace(input: {
  name: string;
  type: string;
  country?: string;
  currency?: string;
  website?: string;
}): Promise<Result> {
  const r = await post("/api/auth/workspace", input);
  if (r.ok) await syncSession();
  return r;
}
