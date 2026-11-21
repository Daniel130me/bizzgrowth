"use client";
// Nellovia single-page application root.
// Served from the only Next route ("/"); everything below is client-side hash navigation.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AppShell, AdminShell, OnboardingLayout, PublicLayout, BareLayout } from "@/components/shell/shell";
import { SpecialistShell } from "@/components/specialist-shell";
import { syncSession } from "@/lib/auth/client";
import { noteRouteForDiagnosis, sameDiagnosisPage } from "@/lib/diagnosis-route";
import { navigate, useHashRoute } from "@/lib/router";
import { useBizz } from "@/lib/store";
import { SCREENS, type ScreenGroup, type ScreenMeta } from "./screens/registry";
import type { ScreenComponent, ViewMap } from "./screens/view-types";

type Layout = "app" | "admin" | "onboarding" | "specialist" | "public" | "bare";
type ViewModule = { views: ViewMap };

/**
 * Screen groups are intentionally loaded on demand. Importing all screen files
 * here made a cold route compile the entire product before showing one page.
 */
const GROUP_LOADERS: Record<ScreenGroup, () => Promise<ViewMap>> = {
  public: () => import("./screens/public").then(({ views }) => views),
  onboarding: () => import("./screens/onboarding").then(({ views }) => views),
  home: () => import("./screens/home").then(({ views }) => views),
  performance: () => import("./screens/performance").then(({ views }) => views),
  insights: () => import("./screens/insights").then(({ views }) => views),
  actions: () => import("./screens/actions").then(({ views }) => views),
  challenges: () => import("./screens/challenges").then(({ views }) => views),
  diagnosis: () => import("./screens/diagnosis").then(({ views }) => views),
  ask: () => import("./screens/ask").then(({ views }) => views),
  data: () => import("./screens/data").then(({ views }) => views),
  goals: () => import("./screens/goals").then(({ views }) => views),
  reports: () => import("./screens/reports").then(({ views }) => views),
  brain: () => import("./screens/brain").then(({ views }) => views),
  team: () => import("./screens/team").then(({ views }) => views),
  market: async () => {
    const [market, specialist] = await Promise.all([
      import("./screens/market") as Promise<ViewModule>,
      import("./screens/specialist") as Promise<ViewModule>,
    ]);
    return { ...market.views, ...specialist.views };
  },
  settings: () => import("./screens/settings").then(({ views }) => views),
  states: () => import("./screens/states").then(({ views }) => views),
  admin: () => import("./screens/admin").then(({ views }) => views),
  prototype: () => import("./screens/prototype").then(({ views }) => views),
};

const groupCache = new Map<ScreenGroup, Promise<ViewMap>>();
/** Groups already loaded: their screens render at once, and one screen serving several routes (a page's tabs) stays mounted. */
const loadedGroups = new Map<ScreenGroup, ViewMap>();

function loadGroup(group: ScreenGroup): Promise<ViewMap> {
  const cached = groupCache.get(group);
  if (cached) return cached;
  const request = GROUP_LOADERS[group]()
    .then((views) => {
      loadedGroups.set(group, views);
      return views;
    })
    .catch((error) => {
      groupCache.delete(group);
      throw error;
    });
  groupCache.set(group, request);
  return request;
}

const PUBLIC_ROUTES = new Set(["landing", "pricing", "signup", "verify-email", "signin", "forgot-password", "reset-password", "accept-invite", "privacy-policy", "terms"]);
const ONBOARDING_ROUTES = new Set(["welcome", "create-workspace", "checkup-intro", "onboarding-chat", "journey-confirm", "business-understanding", "first-diagnosis", "first-diagnosis-evidence", "improve-diagnosis", "setup-complete"]);
const STANDALONE_ROUTES = new Set(["state/404", "state/session-expired", "prototype-index"]);

function matchPattern(pattern: string, path: string): Record<string, string> | null {
  const patternSegments = pattern.split("/");
  const pathSegments = path.split("/").filter(Boolean);
  if (patternSegments.length !== pathSegments.length) return null;

  const params: Record<string, string> = {};
  for (let index = 0; index < patternSegments.length; index += 1) {
    const patternSegment = patternSegments[index];
    const pathSegment = pathSegments[index];
    if (patternSegment.startsWith(":")) {
      try {
        params[patternSegment.slice(1)] = decodeURIComponent(pathSegment);
      } catch {
        return null;
      }
    } else if (patternSegment !== pathSegment) {
      return null;
    }
  }
  return params;
}

function resolveScreen(path: string): { screen: ScreenMeta; params: Record<string, string> } | null {
  // Static routes must win over generic routes such as challenges/:id.
  const exact = SCREENS.find((screen) => !screen.route.includes(":") && screen.route === path);
  if (exact) return { screen: exact, params: {} };

  for (const screen of SCREENS) {
    if (!screen.route.includes(":")) continue;
    const params = matchPattern(screen.route, path);
    if (params) return { screen, params };
  }
  return null;
}

function layoutFor(route: string): Layout {
  if (route.startsWith("admin")) return "admin";
  if (STANDALONE_ROUTES.has(route)) return "bare";
  if (ONBOARDING_ROUTES.has(route) || route.startsWith("first-diagnosis/")) return "onboarding";
  if (route.startsWith("specialist/")) return "specialist";
  if (PUBLIC_ROUTES.has(route)) return "public";
  return "app";
}

export default function AppRoot() {
  const { path, ready } = useHashRoute();
  const hydrate = useBizz((state) => state.hydrate);
  const authChecked = useBizz((state) => state.authChecked);
  const authUserId = useBizz((state) => state.authUserId);
  const authIsPlatformAdmin = useBizz((state) => state.authIsPlatformAdmin);
  const scrolledRef = useRef("");
  // Undefined means the server could not answer (offline / DB waking up), so do not lock the owner out.
  const [authUnknown, setAuthUnknown] = useState(false);

  useEffect(() => {
    hydrate();
    void syncSession().then((me) => {
      if (me === undefined) setAuthUnknown(true);
      if (me) {
        // Cheap on-open maintenance: the endpoint only syncs sources older than
        // 24 hours and uses a database claim to prevent concurrent runs.
        void fetch("/api/connect/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ staleOnly: true }),
        }).catch(() => {});
      }
    });
  }, [hydrate]);

  useEffect(() => {
    if (path && scrolledRef.current !== path) {
      if (!sameDiagnosisPage(scrolledRef.current, path)) window.scrollTo({ top: 0 });
      scrolledRef.current = path;
    }
  }, [path]);

  const resolved = useMemo(() => {
    if (!ready) return null;
    const route = path || "landing";
    const match = resolveScreen(route) ?? resolveScreen("state/404");
    if (!match) return null;
    return {
      ...match,
      route,
      layout: route === "state/404" || match.screen.route === "state/404" ? ("bare" as const) : layoutFor(route),
    };
  }, [path, ready]);

  useEffect(() => {
    if (resolved) noteRouteForDiagnosis(resolved.route, resolved.layout);
  }, [resolved]);

  useEffect(() => {
    if (authChecked && authIsPlatformAdmin && resolved && !resolved.route.startsWith("admin")) {
      navigate("admin");
    }
  }, [authChecked, authIsPlatformAdmin, resolved]);

  if (!resolved) return <FullPageStatus label="Loading Nellovia…" />;

  const { screen, params, route, layout } = resolved;
  if (authChecked && authIsPlatformAdmin && !route.startsWith("admin")) {
    return <FullPageStatus label="Opening platform administration…" />;
  }

  const needsAuth = layout === "app" || layout === "admin" || layout === "onboarding" || layout === "specialist";
  if (needsAuth && !authUnknown && !authUserId) {
    if (authChecked) return <RedirectToSignin />;
    return <FullPageStatus label="Checking your session…" />;
  }

  if (layout === "admin" && authChecked && !authIsPlatformAdmin) {
    return <AdminAccessDenied />;
  }

  const content = <LazyRouteView group={screen.group} pattern={screen.route} params={params} />;
  if (layout === "bare") return <BareLayout>{content}</BareLayout>;
  if (layout === "admin") return <AdminShell route={route}>{content}</AdminShell>;
  if (layout === "onboarding") return <OnboardingLayout route={route}>{content}</OnboardingLayout>;
  if (layout === "specialist") return <SpecialistShell route={route}>{content}</SpecialistShell>;
  if (layout === "public") return <PublicLayout route={route}>{content}</PublicLayout>;
  return <AppShell route={route}>{content}</AppShell>;
}

function LazyRouteView({ group, pattern, params }: { group: ScreenGroup; pattern: string; params: Record<string, string> }) {
  // Already loaded: render it now (no loading flash, and the same screen isn't remounted).
  const loaded = loadedGroups.get(group)?.[pattern] ?? null;
  const key = `${group}:${pattern}`;
  // What happened for each route is kept with its key, so nothing carries over from the previous route.
  const [entry, setEntry] = useState<{ key: string; View: ScreenComponent } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [slowKey, setSlowKey] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (loadedGroups.get(group)?.[pattern]) return;
    const routeKey = `${group}:${pattern}`;
    let active = true;
    const slowTimer = window.setTimeout(() => {
      if (active) setSlowKey(routeKey);
    }, 8_000);

    void loadGroup(group)
      .then((views) => {
        if (!active) return;
        const routeView = views[pattern];
        if (!routeView) throw new Error(`Screen implementation missing for ${pattern}`);
        setEntry({ key: routeKey, View: routeView });
      })
      .catch((loadError) => {
        console.error("[screen-loader]", loadError);
        if (active) setFailedKey(routeKey);
      })
      .finally(() => window.clearTimeout(slowTimer));

    return () => {
      active = false;
      window.clearTimeout(slowTimer);
    };
  }, [group, pattern, attempt]);

  const Shown = loaded ?? (entry?.key === key ? entry.View : null);
  const slow = slowKey === key;
  if (failedKey === key && !loaded) {
    return (
      <RouteLoadMessage
        title="This page could not load"
        body="The rest of Nellovia is still available. Try loading this page again."
        actionLabel="Try again"
        onAction={() => {
          groupCache.delete(group);
          setFailedKey(null);
          setSlowKey(null);
          setAttempt((value) => value + 1);
        }}
      />
    );
  }
  if (!Shown) {
    return slow ? (
      <RouteLoadMessage
        title="This page is taking longer than expected"
        body="Your session is safe. You can keep waiting or reload this page."
        actionLabel="Reload page"
        onAction={() => window.location.reload()}
      />
    ) : (
      <FullPageStatus label="Loading this page…" contained />
    );
  }
  return <Shown params={params} />;
}

function FullPageStatus({ label, contained = false }: { label: string; contained?: boolean }) {
  return (
    <div className={`flex items-center justify-center bg-slate-50 ${contained ? "min-h-[50vh]" : "min-h-screen"}`}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <span className="size-2 animate-pulse rounded-full bg-brand-600" aria-hidden />
        {label}
      </div>
    </div>
  );
}

function RouteLoadMessage({ title, body, actionLabel, onAction }: { title: string; body: string; actionLabel: string; onAction: () => void }) {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-semibold text-slate-950">{title}</h1>
      <p className="mt-2 text-sm text-slate-600">{body}</p>
      <button type="button" onClick={onAction} className="mt-5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
        {actionLabel}
      </button>
    </div>
  );
}

function AdminAccessDenied() {
  return (
    <BareLayout>
      <RouteLoadMessage
        title="Platform administrator access required"
        body="This area is limited to approved platform administrators. Sign in with an administrator account to continue."
        actionLabel="Return to workspace"
        onAction={() => navigate("home")}
      />
    </BareLayout>
  );
}

function RedirectToSignin() {
  useEffect(() => {
    navigate("signin");
  }, []);
  return null;
}
