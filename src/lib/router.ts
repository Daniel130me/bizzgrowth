"use client";
// Hash-based client router. The app is served from the single "/" route;
// all product navigation happens through location.hash.

import { useEffect, useState } from "react";

export function readHashPath(): string {
  if (typeof window === "undefined") return "landing";
  const raw = window.location.hash.replace(/^#\/?/, "");
  return raw.length ? raw : "landing";
}

export function navigate(path: string) {
  if (typeof window === "undefined") return;
  const clean = path.replace(/^#\/?/, "");
  window.location.hash = `#/${clean}`;
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
