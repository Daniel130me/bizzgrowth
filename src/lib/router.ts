"use client";
// Hash-based client router. The app is served from the single "/" route;
// all product navigation happens through location.hash.

import { useEffect, useState } from "react";

export function readHashPath(): string {
  if (typeof window === "undefined") return "landing";
  const raw = window.location.hash.replace(/^#\/?/, "");
  return raw.length ? raw : "landing";
}

// Which page each page was opened from, so Cancel and Back return there (kept for the tab's
// session, so a reload doesn't lose it).
const CAME_FROM_KEY = "nellovia-came-from";

function cameFromMap(): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(CAME_FROM_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

export function navigate(path: string) {
  if (typeof window === "undefined") return;
  const clean = path.replace(/^#\/?/, "");
  const here = readHashPath();
  if (here !== clean) {
    try {
      sessionStorage.setItem(CAME_FROM_KEY, JSON.stringify({ ...cameFromMap(), [clean]: here }));
    } catch {}
  }
  window.location.hash = `#/${clean}`;
}

/**
 * Where Cancel or Back should go from `current`: the page it was opened from, or `fallback`
 * when it was opened directly (a link, a reload of a fresh tab).
 */
export function backTarget(current: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const from = cameFromMap()[current];
  return from && from !== current && from !== "landing" ? from : fallback;
}

/** Like navigate, without a new history entry — for a tab or view on the same page, so Back leaves the page. */
export function replaceRoute(path: string) {
  if (typeof window === "undefined") return;
  const clean = path.replace(/^#\/?/, "");
  window.location.replace(`#/${clean}`);
}

/** Subscribe to hash changes. Returns current path (may be empty pre-hydration). */
export function useHashRoute(): { path: string; ready: boolean } {
  const [path, setPath] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const update = () => {
      setPath(readHashPath());
      setReady(true);
    };
    update();
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  return { path, ready };
}
