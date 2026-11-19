"use client";
// bizzGrowth single-page application root.
// Served from the only Next route ("/"); everything below is client-side hash navigation.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useHashRoute } from "@/lib/router";
import { useBizz } from "@/lib/store";
import { AppShell, AdminShell, OnboardingLayout, PublicLayout, BareLayout } from "@/components/shell/shell";
import { views as stateViews } from "./screens/states";
import { views as publicViews } from "./screens/public";
import { views as onboardingViews } from "./screens/onboarding";
import { views as homeViews } from "./screens/home";
import { views as performanceViews } from "./screens/performance";
import { views as insightViews } from "./screens/insights";
import { views as actionViews } from "./screens/actions";
import { views as askViews } from "./screens/ask";
import { views as dataViews } from "./screens/data";
import { views as goalViews } from "./screens/goals";
import { views as reportViews } from "./screens/reports";
import { views as brainViews } from "./screens/brain";
import { views as teamViews } from "./screens/team";
import { views as marketViews } from "./screens/market";
import { views as settingsViews } from "./screens/settings";
import { views as adminViews } from "./screens/admin";
import { views as prototypeViews } from "./screens/prototype";
import type { ScreenComponent, ViewMap } from "./screens/view-types";
import { syncSession } from "@/lib/auth/client";
import { navigate } from "@/lib/router";

const EXACT: ViewMap = {
  ...publicViews,
  ...onboardingViews,
  ...homeViews,
  ...performanceViews,
  ...insightViews,
  ...actionViews,
  ...askViews,
  ...dataViews,
  ...goalViews,
  ...reportViews,
  ...brainViews,
  ...teamViews,
  ...marketViews,
  ...settingsViews,
  ...stateViews,
  ...adminViews,
  ...prototypeViews,
};

const PATTERNS: [string, ScreenComponent][] = [
  ...Object.entries(homeViews).filter(([k]) => k.includes(":")).map(([k, v]) => [k, v] as [string, ScreenComponent]),
  ...Object.entries(performanceViews).filter(([k]) => k.includes(":")).map(([k, v]) => [k, v] as [string, ScreenComponent]),
  ...Object.entries(insightViews).filter(([k]) => k.includes(":")).map(([k, v]) => [k, v] as [string, ScreenComponent]),
  ...Object.entries(actionViews).filter(([k]) => k.includes(":")).map(([k, v]) => [k, v] as [string, ScreenComponent]),
  ...Object.entries(dataViews).filter(([k]) => k.includes(":")).map(([k, v]) => [k, v] as [string, ScreenComponent]),
  ...Object.entries(goalViews).filter(([k]) => k.includes(":")).map(([k, v]) => [k, v] as [string, ScreenComponent]),
  ...Object.entries(teamViews).filter(([k]) => k.includes(":")).map(([k, v]) => [k, v] as [string, ScreenComponent]),
  ...Object.entries(marketViews).filter(([k]) => k.includes(":")).map(([k, v]) => [k, v] as [string, ScreenComponent]),
  ...Object.entries(adminViews).filter(([k]) => k.includes(":")).map(([k, v]) => [k, v] as [string, ScreenComponent]),
];

const PUBLIC_ROUTES = new Set(["landing", "pricing", "signup", "verify-email", "signin", "forgot-password", "reset-password", "accept-invite", "privacy-policy", "terms"]);
const ONBOARDING_ROUTES = new Set(["welcome", "create-workspace", "checkup-intro", "onboarding-chat", "journey-confirm", "business-understanding", "first-diagnosis", "first-diagnosis-evidence", "improve-diagnosis", "setup-complete"]);
const STANDALONE_ROUTES = new Set(["state/404", "state/session-expired", "prototype-index"]);

function matchRoute(path: string): { View: ScreenComponent; params: Record<string, string> } | null {
  const exact = EXACT[path];
  if (exact) return { View: exact, params: {} };
  const segs = path.split("/").filter(Boolean);
  for (const [pattern, View] of PATTERNS) {
    const psegs = pattern.split("/");
    if (psegs.length !== segs.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < psegs.length; i++) {
      if (psegs[i].startsWith(":")) params[psegs[i].slice(1)] = decodeURIComponent(segs[i]);
      else if (psegs[i] !== segs[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return { View, params };
  }
  return null;
}

export default function AppRoot() {
  const { path, ready } = useHashRoute();
  const hydrate = useBizz((s) => s.hydrate);
  const scrolledRef = useRef("");

  const authChecked = useBizz((s) => s.authChecked);
  const authUserId = useBizz((s) => s.authUserId);
  // undefined = the server couldn't say (offline / DB waking up): don't lock the owner out.
  const [authUnknown, setAuthUnknown] = useState(false);

  useEffect(() => {
    hydrate();
    // Who is signed in comes from the server session cookie, not localStorage.
    void syncSession().then((me) => {
      if (me === undefined) setAuthUnknown(true);
    });
  }, [hydrate]);

  useEffect(() => {
    if (path && scrolledRef.current !== path) {
      window.scrollTo({ top: 0 });
      scrolledRef.current = path;
    }
  }, [path]);

  const resolved = useMemo(() => {
    if (!ready) return null;
    const route = path || "landing";
    if (route === "state/404" || !matchRoute(route)) {
      const NotFound = stateViews["state/404"] ?? stateViews["state/error"];
      return { View: NotFound, params: {}, route, layout: "bare" as const };
    }
    const m = matchRoute(route)!;
    let layout: "app" | "admin" | "onboarding" | "public" | "bare" = "app";
    if (route.startsWith("admin")) layout = "admin";
    else if (STANDALONE_ROUTES.has(route)) layout = "bare";
    else if (ONBOARDING_ROUTES.has(route)) layout = "onboarding";
    else if (PUBLIC_ROUTES.has(route)) layout = "public";
    return { View: m.View, params: m.params, route, layout };
  }, [path, ready]);

  if (!resolved) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <span className="size-2 animate-pulse rounded-full bg-blue-600" aria-hidden />
          Loading bizzGrowth…
        </div>
      </div>
    );
  }

  const { View, params, route, layout } = resolved;
  const needsAuth = layout === "app" || layout === "admin" || layout === "onboarding";
  if (needsAuth && !authUnknown && !authUserId) {
    if (authChecked) return <RedirectToSignin />;
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <span className="size-2 animate-pulse rounded-full bg-blue-600" aria-hidden />
          Checking your session…
        </div>
      </div>
    );
  }
  const content = <View params={params} />;

  if (layout === "bare") return <BareLayout>{content}</BareLayout>;
  if (layout === "admin") return <AdminShell route={route}>{content}</AdminShell>;
  if (layout === "onboarding") return <OnboardingLayout route={route}>{content}</OnboardingLayout>;
  if (layout === "public") return <PublicLayout route={route}>{content}</PublicLayout>;
  return <AppShell route={route}>{content}</AppShell>;
}

function RedirectToSignin() {
  useEffect(() => {
    navigate("signin");
  }, []);
  return null;
}
