"use client";
// System states — Screens 95–104 (registry group "states").
// 95 no-data · 96 insufficient · 97 syncing · 98 stale · 99 disconnected ·
// 100 permission-denied · 101 plan-limit · 102 session-expired (bare) ·
// 103 404 (bare) · 104 error (bare).
//
// Layout contract (app-root): state/session-expired, state/404 and state/error
// render BARE (no shell) and are therefore fully self-contained pages with
// their own top bar. All other state/* screens render inside AppShell and use
// PageHeader + SectionCard.

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock,
  Compass,
  Copy,
  Database,
  HelpCircle,
  History,
  Home,
  KeyRound,
  Loader2,
  Lock,
  LogIn,
  PenLine,
  Plug,
  RefreshCw,
  ServerOff,
  ShieldCheck,
  Sparkles,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { InfoBanner, KeyValue, PageHeader, SectionCard } from "@/components/shared/layout";
import { ProvenanceBadge } from "@/components/shared/badges";
import { NelloviaLogo } from "@/components/brand/logo";
import { useBizz } from "@/lib/store";
import { getBusiness } from "@/lib/data/businesses";
import type { ReactNode } from "react";
import type { ViewMap } from "../view-types";

// ---------- Shared bits ----------

/** Small chip marking these screens as system states (demo artifacts). */
function SystemStateChip() {
  return (
    <Badge variant="outline" className="bg-slate-100 font-normal text-slate-600">
      System state
    </Badge>
  );
}

/** Wordmark used by the bare (standalone) state pages — links back to the landing page. */
function BareLogo() {
  const navigate = useBizz((s) => s.navigate);
  return (
    <button onClick={() => navigate("landing")} aria-label="Nellovia home" className="inline-flex items-center rounded-lg">
      <NelloviaLogo />
    </button>
  );
}

/** Standalone page chrome for bare states: minimal top bar + centered card. */
function BareShell({ children, link }: { children: ReactNode; link?: { label: string; onClick: () => void } }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <BareLogo />
          {link ? (
            <Button variant="ghost" size="sm" onClick={link.onClick}>
              {link.label}
            </Button>
          ) : null}
        </div>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-12 sm:py-20">
        <div className="w-full max-w-xl">{children}</div>
      </main>
    </div>
  );
}

/** history.back() with a safe in-app fallback. */
function useGoBack(fallback: string) {
  const navigate = useBizz((s) => s.navigate);
  return () => {
    if (window.history.length > 1) window.history.back();
    else navigate(fallback);
  };
}

// ---------- Screen 95 — New Workspace / No Data Yet ----------

function NoDataScreen() {
  const navigate = useBizz((s) => s.navigate);
  const setBusiness = useBizz((s) => s.setBusiness);
  const businessId = useBizz((s) => s.businessId);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const business = getBusiness(businessId, userWorkspace);

  const levels = [
    {
      level: "Monthly totals only",
      question: "What happened",
      detail: "Which headline metrics changed and where to look first — a baseline diagnosis with zero connections.",
    },
    {
      level: "Totals + funnel or channel data",
      question: "Where it happened",
      detail: "Which journey step or marketing channel moved, so effort goes to the right place.",
    },
    {
      level: "Connected sources with history",
      question: "Why it happened",
      detail: "Root-cause diagnosis with stated confidence, evidence links and provenance on every fact.",
    },
  ];

  const options = [
    {
      icon: ClipboardList,
      title: "Start the private checkup",
      detail:
        "Answer a few questions about how the business runs. No connections needed — you get a first diagnosis and a short list of what to add next.",
      cta: "Start checkup",
      primary: true,
      onClick: () => navigate("welcome"),
    },
    {
      icon: PenLine,
      title: "Enter data manually",
      detail:
        "Type in monthly totals — spend, enquiries, customers and revenue (or traffic and orders). Estimates are fine and are always labelled in analysis.",
      cta: "Enter data",
      primary: false,
      onClick: () => navigate("manual-entry"),
    },
    {
      icon: Plug,
      title: "Connect a source",
      detail:
        "Link Shopify, Meta Ads, Google Analytics or Paystack. Connectors are read-only by default — nothing on your accounts can be changed.",
      cta: "Connect source",
      primary: false,
      onClick: () => navigate("integrations"),
    },
    {
      icon: Compass,
      title: "Explore a demo business",
      detail:
        "Open SwiftHaul Logistics, a fully populated service workspace, to see what a complete diagnosis looks like before adding your own data.",
      cta: "Explore demo",
      primary: false,
      onClick: () => {
        setBusiness("swifthaul");
        navigate("home");
      },
    },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        title="Let's get your first signal"
        description={`You haven't added enough information yet to understand performance in ${business.name}. That is expected for a new workspace — Nellovia works from the very first number you add, and grows sharper as coverage grows.`}
        badge={<SystemStateChip />}
      />

      <SectionCard
        title="What Nellovia can tell you at each level of data"
        description="The product is useful from day one — each level answers a bigger question."
      >
        <ol className="space-y-4">
          {levels.map((l, i) => (
            <li key={l.level} className="flex gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700" aria-hidden>
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-medium">
                  {l.question} <span className="font-normal text-muted-foreground">— {l.level}</span>
                </p>
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{l.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </SectionCard>

      <div className="mt-5">
        <h2 className="mb-3 text-sm font-semibold">Four ways to start — pick whichever is easiest today</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {options.map((o) => (
            <Card key={o.title} className="flex flex-col p-5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                <o.icon className="size-4.5" aria-hidden />
              </div>
              <h3 className="mt-3 text-sm font-semibold">{o.title}</h3>
              <p className="mt-1 flex-1 text-sm leading-relaxed text-muted-foreground">{o.detail}</p>
              <div className="mt-4 border-t pt-3">
                <Button size="sm" variant={o.primary ? "default" : "outline"} className="w-full" onClick={o.onClick}>
                  {o.cta}
                  <ArrowRight className="ml-1.5 size-3.5" aria-hidden />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <p className="mt-5 text-center text-xs text-muted-foreground">
        Nothing here is wasted — manual totals and connected sources combine into one coverage picture in the Data Centre.
      </p>
    </div>
  );
}

// ---------- Screen 96 — Insufficient Data for Diagnosis (signature state) ----------

function InsufficientScreen() {
  const navigate = useBizz((s) => s.navigate);
  const goBack = useGoBack("insights");

  const known = [
    { text: "Customers declined compared with last month", prov: "measured" as const, src: "Payments / order records" },
    { text: "Revenue declined compared with last month", prov: "measured" as const, src: "Payment settlements" },
    { text: "Marketing spend is known for the period", prov: "measured" as const, src: "Connected ad accounts" },
  ];

  const unknown = [
    {
      text: "Lead source — which channels actually produced the customers",
      blocks: "Blocks channel-level attribution and budget guidance",
    },
    {
      text: "Website conversion — how visitors behaved before buying",
      blocks: "Blocks upstream funnel diagnosis and checkout analysis",
    },
  ];

  const unlocks = [
    {
      icon: Plug,
      label: "Connect Google Analytics",
      detail: "Adds sessions, devices and visitor-to-enquiry behaviour. Unlocks the upstream funnel — what happens before customers appear.",
      cta: "Connect Google Analytics",
      onClick: () => navigate("connect/google-analytics"),
    },
    {
      icon: PenLine,
      label: "Add funnel data",
      detail: "Adds step counts between visit and purchase. Unlocks step-level diagnosis — exactly where in the journey visitors drop off.",
      cta: "Add funnel data",
      onClick: () => navigate("manual-entry"),
    },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        title="We can see the problem, but not yet the cause"
        description="There is enough information to know that something changed — not enough to say why. This is a normal stage, and one more data connection usually resolves it."
        badge={<SystemStateChip />}
        back={
          <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={goBack}>
            Back to previous page
          </Button>
        }
      />

      <InfoBanner tone="info" title="Example framing">
        This state is shown for an ecommerce workspace (KoraHome Store) where customers and revenue declined while channel
        and website data were unavailable. In your workspace it appears whenever a diagnosis is requested with partial coverage.
      </InfoBanner>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <SectionCard title="What we know" className="border-emerald-200">
          <ul className="space-y-3">
            {known.map((k) => (
              <li key={k.text} className="flex flex-col gap-1.5">
                <span className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                  {k.text}
                </span>
                <ProvenanceBadge provenance={k.prov} source={k.src} className="ml-6 w-fit" />
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="What we don't know" className="border-amber-200">
          <ul className="space-y-3">
            {unknown.map((u) => (
              <li key={u.text} className="flex flex-col gap-1">
                <span className="flex items-start gap-2 text-sm">
                  <HelpCircle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
                  {u.text}
                </span>
                <span className="ml-6 text-xs text-muted-foreground">{u.blocks}</span>
              </li>
            ))}
          </ul>
          <Separator className="my-3" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Confidence for this diagnosis is currently Low. Low confidence is not an error — it means the evidence is not yet
            complete enough to isolate a cause.
          </p>
        </SectionCard>

        <SectionCard title="What would unlock the answer" className="border-brand-200">
          <div className="space-y-4">
            <div className="flex items-start gap-2.5 rounded-xl border border-brand-200 bg-brand-50/60 p-3">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
              <p className="text-sm leading-relaxed text-brand-900">
                With either addition, this diagnosis upgrades from &ldquo;what changed&rdquo; to a root cause with stated confidence —
                and the recommendation engine can act on it.
              </p>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Any single option below is enough to start. Neither takes more than a few minutes, and both are read-only or
              manually supplied by you.
            </p>
          </div>
        </SectionCard>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        {unlocks.map((u) => (
          <Card key={u.label} className="flex flex-col p-5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <u.icon className="size-4.5" aria-hidden />
            </div>
            <h3 className="mt-3 text-sm font-semibold">{u.label}</h3>
            <p className="mt-1 flex-1 text-sm leading-relaxed text-muted-foreground">{u.detail}</p>
            <div className="mt-4 border-t pt-3">
              <Button size="sm" className="w-full" onClick={u.onClick}>
                {u.cta}
                <ArrowRight className="ml-1.5 size-3.5" aria-hidden />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6 flex flex-col items-center gap-3">
        <p className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <ShieldCheck className="size-4 text-slate-500" aria-hidden />
          We never invent a diagnosis when evidence is missing.
        </p>
        <Button variant="ghost" size="sm" onClick={() => navigate("insights")}>
          Back to insights
        </Button>
      </div>
    </div>
  );
}

// ---------- Screen 97 — Data Syncing ----------

const SYNC_SOURCES = [
  { name: "Shopify", detail: "Orders & checkout analytics — importing the last 3 months" },
  { name: "Paystack", detail: "Payments — success rates, failure reasons and settlement totals" },
];

function SyncingScreen() {
  const navigate = useBizz((s) => s.navigate);
  const [progress, setProgress] = useState(8);
  const [done, setDone] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const iv = window.setInterval(() => {
      setProgress((p) => (p >= 100 ? 100 : Math.min(100, p + 4 + Math.round(Math.random() * 7))));
    }, 550);
    const t = window.setTimeout(() => {
      if (!mountedRef.current) return;
      setProgress(100);
      setDone(true);
      toast.success("Sync complete", {
        description: "Orders, payments and workspace metrics are up to date.",
      });
    }, 10000);
    return () => {
      mountedRef.current = false;
      window.clearInterval(iv);
      window.clearTimeout(t);
    };
  }, []);

  const shopifyDone = progress >= 60;
  const paystackDone = done;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="Importing your data"
        description="This usually takes under a minute. You can leave this screen — we'll notify you when it's ready."
        badge={<SystemStateChip />}
      />

      <SectionCard title="Sync progress" description="Workspace-level import across connected sources.">
        <div className="flex items-center gap-3">
          {done ? (
            <span className="flex size-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="size-5" aria-hidden />
            </span>
          ) : (
            <Loader2 className="size-6 animate-spin text-brand-600" aria-hidden />
          )}
          <div className="flex-1">
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-medium">{done ? "Sync complete" : "Importing your data…"}</p>
              <span className="text-sm font-medium text-muted-foreground tnum">{progress}%</span>
            </div>
            <Progress value={progress} className="mt-2 h-2" aria-label={`Sync progress ${progress}%`} />
          </div>
        </div>

        <Separator className="my-4" />

        <ul className="space-y-3">
          {SYNC_SOURCES.map((src, i) => {
            const isDone = i === 0 ? shopifyDone : paystackDone;
            return (
              <li key={src.name} className="flex items-start gap-3">
                <span className="mt-0.5">
                  {isDone ? (
                    <CheckCircle2 className="size-4.5 text-emerald-600" aria-label={`${src.name} complete`} />
                  ) : (
                    <Loader2 className="size-4.5 animate-spin text-brand-600" aria-label={`${src.name} syncing`} />
                  )}
                </span>
                <div>
                  <p className="text-sm font-medium">
                    {src.name}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">{isDone ? "Done" : "Syncing…"}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{src.detail}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </SectionCard>

      {done ? (
        <InfoBanner tone="success" title="Your data is up to date" >
          Metrics, funnel charts and diagnoses now include everything just imported.
        </InfoBanner>
      ) : (
        <InfoBanner tone="info" title="You can leave this screen">
          The sync continues in the background and we&apos;ll notify you the moment it&apos;s ready — nothing is lost by navigating away.
        </InfoBanner>
      )}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" className="flex-1" onClick={() => navigate("home")}>
          Continue in background
        </Button>
        <Button className="flex-1" onClick={() => navigate("data")} variant={done ? "default" : "ghost"}>
          {done ? "View performance" : "Go to Data Centre"}
        </Button>
      </div>
    </div>
  );
}

// ---------- Screen 98 — Data Stale / Sync Delayed ----------

function StaleScreen() {
  const navigate = useBizz((s) => s.navigate);
  const [syncing, setSyncing] = useState(false);
  const [refreshed, setRefreshed] = useState(false);

  const affected = ["Checkout diagnosis", "Funnel charts", "Revenue reporting"];

  function syncNow() {
    setSyncing(true);
    window.setTimeout(() => {
      setSyncing(false);
      setRefreshed(true);
      toast.success("Data refreshed", {
        description: "Checkout diagnosis, funnel charts and revenue now include all of today's data.",
      });
    }, 2200);
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        title="Data is older than usual"
        description="Scheduled syncs have not completed since 14:00. Analyses below are built on data up to 11:02 today — still useful, no longer current."
        badge={<SystemStateChip />}
        back={
          <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => navigate("home")}>
            Back to Home
          </Button>
        }
      />

      <InfoBanner tone="warning" title="Data is older than usual">
        The last successful update landed at <strong>Today 11:02</strong>. Three scheduled syncs since then did not complete.
      </InfoBanner>

      <div className="mt-5 space-y-5">
        <SectionCard title="Sync status">
          <div className="space-y-2.5">
            <KeyValue label="Last successful update">Today 11:02</KeyValue>
            <KeyValue label="Failed attempts">14:00 · 15:03 · 16:00 (3 of 3 failed)</KeyValue>
            <KeyValue label="Current status">
              <Badge variant="outline" className="border-amber-200 bg-amber-50 font-normal text-amber-700">
                <Clock className="mr-1 size-3" aria-hidden /> Delayed
              </Badge>
            </KeyValue>
          </div>
        </SectionCard>

        <div className="grid gap-5 lg:grid-cols-2">
          <SectionCard title="What this affects">
            <ul className="space-y-2">
              {affected.map((a) => (
                <li key={a} className="flex items-center gap-2 text-sm">
                  <History className="size-4 shrink-0 text-amber-600" aria-hidden />
                  {a} — frozen at 11:02
                </li>
              ))}
            </ul>
            <Separator className="my-3" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              AI interpretations that relied on pre-11:02 data are flagged with a &ldquo;stale data&rdquo; marker in Insights —
              nothing is silently treated as current.
            </p>
          </SectionCard>

          <SectionCard title="Possible reason">
            <p className="text-sm leading-relaxed">
              The Shopify authorization token expired during the 14:00 sync attempt. The connection itself is intact — it needs a
              token refresh, which either a sync or a re-authorization can provide.
            </p>
            <Separator className="my-3" />
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recommended response</p>
            <ol className="mt-2 space-y-1.5 text-sm text-muted-foreground">
              <li>1. Try &ldquo;Sync now&rdquo; first — a token refresh often resolves it within a minute.</li>
              <li>2. If it fails again, review the connection and re-authorize Shopify.</li>
              <li>3. Treat AI conclusions from before 11:02 as provisional until data is current.</li>
            </ol>
          </SectionCard>
        </div>

        {refreshed ? (
          <InfoBanner tone="success" title="You're up to date">
            All analyses now include today&apos;s data. No further action is needed.
          </InfoBanner>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={syncNow} disabled={syncing} className="flex-1 sm:flex-none">
            {syncing ? (
              <>
                <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden /> Syncing…
              </>
            ) : (
              <>
                <RefreshCw className="mr-1.5 size-4" aria-hidden /> Sync now
              </>
            )}
          </Button>
          <Button variant="outline" onClick={() => navigate("connection-error")} className="flex-1 sm:flex-none">
            Review connection
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------- Screen 99 — Integration Disconnected ----------

function DisconnectedScreen() {
  const navigate = useBizz((s) => s.navigate);

  const affected = [
    { label: "Orders and revenue reporting", detail: "Paused — no new orders after 11:02 today will appear until reconnected." },
    { label: "Funnel and checkout analysis", detail: "Paused — charts show data through 11:02 and will not advance." },
    { label: "Payment reliability analysis", detail: "Paused — the Paystack sync runs in the Shopify window." },
    { label: "Alerts and new insights for this source", detail: "Paused — existing insights remain available and marked as of 11:02." },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        title="Shopify disconnected"
        description="A connected source stopped syncing. Historical data is retained — reconnecting restores everything."
        badge={<SystemStateChip />}
        back={
          <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => navigate("data")}>
            Back to Data Centre
          </Button>
        }
      />

      <Card className="border-red-200 bg-red-50/50 p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
            <WifiOff className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-red-900">Shopify — disconnected</h2>
              <Badge variant="outline" className="border-red-200 bg-white font-normal text-red-700">
                <AlertTriangle className="mr-1 size-3" aria-hidden /> Action needed
              </Badge>
            </div>
            <div className="mt-3 space-y-2.5">
              <KeyValue label="Source">Shopify (Ecommerce) — korahome-store.myshopify.com</KeyValue>
              <KeyValue label="Disconnected">Today at 14:03</KeyValue>
              <KeyValue label="Reason">
                Authorization expired — the access token issued to Nellovia timed out during the 14:00 sync attempt.
              </KeyValue>
            </div>
          </div>
        </div>
      </Card>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <SectionCard title="What intelligence is affected">
          <ul className="space-y-3">
            {affected.map((a) => (
              <li key={a.label}>
                <p className="text-sm font-medium">{a.label}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{a.detail}</p>
              </li>
            ))}
          </ul>
        </SectionCard>

        <div className="space-y-5">
          <SectionCard title="What still works">
            <ul className="space-y-2 text-sm">
              {["Home overview and health score", "Goals and assigned actions", "Manual entries and CSV imports", "Insights based on Meta Ads and Google Ads"].map((w) => (
                <li key={w} className="flex items-center gap-2">
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden /> {w}
                </li>
              ))}
            </ul>
          </SectionCard>
          <InfoBanner tone="success" title="Historical data is retained">
            Nothing is deleted. Reconnecting restores full history — data is only removed if a source stays disconnected for
            more than 30 days.
          </InfoBanner>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Button onClick={() => navigate("connection-error")} className="flex-1 sm:flex-none">
          <RefreshCw className="mr-1.5 size-4" aria-hidden /> Reconnect Shopify
        </Button>
        <Button variant="outline" onClick={() => navigate("data")} className="flex-1 sm:flex-none">
          <Database className="mr-1.5 size-4" aria-hidden /> Open Data Centre
        </Button>
      </div>
    </div>
  );
}

// ---------- Screen 100 — Permission Denied ----------

function PermissionDeniedScreen() {
  const navigate = useBizz((s) => s.navigate);
  const goBack = useGoBack("home");

  const whoCan = [
    { role: "Owner", who: "Amara Okafor", note: "Full access, including billing and plan changes." },
    { role: "Admin", who: "Tunde Bakare", note: "Can manage billing, members and connected sources." },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="You don't have permission for this action"
        description="This screen appears when a role tries to open something restricted. Here is exactly what happened and what to do next."
        badge={<SystemStateChip />}
        back={
          <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={goBack}>
            Back to previous page
          </Button>
        }
      />

      <InfoBanner tone="info" title="Prototype note">
        This state is shown from the perspective of a Member role. Your demo account (Amara Okafor) is normally the workspace
        Owner.
      </InfoBanner>

      <div className="mt-5 space-y-5">
        <SectionCard title="What cannot be performed">
          <p className="text-sm leading-relaxed">
            <span className="font-medium">Only workspace owners and admins can manage billing.</span> Opening plan, payment and
            invoice management requires one of those roles.
          </p>
        </SectionCard>

        <SectionCard title="Your current access">
          <div className="space-y-2.5">
            <KeyValue label="Current role">
              <Badge variant="outline" className="bg-slate-100 font-normal text-slate-700">
                <Lock className="mr-1 size-3" aria-hidden /> Member
              </Badge>
            </KeyValue>
            <KeyValue label="Can do">View dashboards, read insights, complete assigned actions, update your own profile</KeyValue>
            <KeyValue label="Cannot do">Manage billing, invite or remove members, connect or disconnect data sources</KeyValue>
          </div>
        </SectionCard>

        <SectionCard title="Who can perform this action" description="Either of the following can make the change — or grant you access.">
          <ul className="space-y-3">
            {whoCan.map((p) => (
              <li key={p.role} className="flex items-start justify-between gap-3 rounded-xl border p-3.5">
                <div>
                  <p className="text-sm font-medium">{p.who}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{p.note}</p>
                </div>
                <Badge variant="outline" className="shrink-0 border-brand-200 bg-brand-50 font-normal text-brand-700">
                  {p.role}
                </Badge>
              </li>
            ))}
          </ul>
        </SectionCard>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            onClick={() =>
              toast.success("Request sent to Amara Okafor", {
                description: "She'll be asked to grant you billing access as the workspace Owner.",
              })
            }
            className="flex-1 sm:flex-none"
          >
            Request access
          </Button>
          <Button variant="outline" onClick={goBack} className="flex-1 sm:flex-none">
            Back to previous page
          </Button>
          <Button variant="ghost" onClick={() => navigate("home")} className="flex-1 sm:flex-none">
            Go Home
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------- Screen 101 — Plan Limit ----------

function PlanLimitScreen() {
  const navigate = useBizz((s) => s.navigate);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="You've reached your plan's source limit"
        description="The feature you tried to use is limited on your current plan. Here is what is included today and what upgrading changes."
        badge={<SystemStateChip />}
        back={
          <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => navigate("integrations")}>
            Back to sources
          </Button>
        }
      />

      <SectionCard title="What you tried to do">
        <div className="space-y-2.5">
          <KeyValue label="Feature requested">Additional data source (4th connection)</KeyValue>
          <KeyValue label="Current plan">
            <Badge variant="outline" className="bg-slate-100 font-normal text-slate-700">
              Private Beta
            </Badge>
          </KeyValue>
          <KeyValue label="Plan limitation">3 connected data sources per workspace</KeyValue>
          <KeyValue label="Currently connected">Meta Ads · Google Ads · Shopify (3 of 3)</KeyValue>
        </div>
      </SectionCard>

      <SectionCard
        title="What upgrading unlocks"
        description="Everything in your current plan stays available — upgrading adds to it."
        className="mt-5"
      >
        <div className="space-y-3">
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
            <p className="text-sm">
              <span className="font-medium">Unlimited data sources</span> — add Google Analytics, Paystack, Flutterwave, CSV and
              more, in any combination.
            </p>
          </div>
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
            <p className="text-sm">
              <span className="font-medium">24 months of history</span> — seasonality baselines and year-over-year comparisons
              instead of the Beta window.
            </p>
          </div>
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
            <p className="text-sm">
              <span className="font-medium">Deeper diagnosis</span> — every added source raises data coverage, which raises
              diagnosis confidence.
            </p>
          </div>
        </div>
        <Separator className="my-4" />
        <p className="text-xs text-muted-foreground">
          In the meantime, manual entries and CSV uploads are unlimited on every plan — you can keep improving coverage without
          upgrading.
        </p>
      </SectionCard>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <Button onClick={() => navigate("settings/plan")} className="flex-1 sm:flex-none">
          View plans
          <ArrowRight className="ml-1.5 size-4" aria-hidden />
        </Button>
        <Button variant="outline" onClick={() => navigate("feedback")} className="flex-1 sm:flex-none">
          Contact us
        </Button>
      </div>
    </div>
  );
}

// ---------- Screen 102 — Session Expired (bare) ----------

function SessionExpiredScreen() {
  const navigate = useBizz((s) => s.navigate);

  return (
    <BareShell link={{ label: "Return to landing page", onClick: () => navigate("landing") }}>
      <Card className="p-6 text-center sm:p-10">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full border bg-amber-50 text-amber-600 shadow-sm">
          <KeyRound className="size-5" aria-hidden />
        </div>
        <h1 className="mt-5 text-xl font-bold tracking-tight sm:text-2xl">Your session expired for security</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          For your protection, Nellovia signs you out after a period of inactivity. Nothing was lost — your workspace and data
          are exactly as you left them.
        </p>
        <div className="mt-6 flex justify-center">
          <Button onClick={() => navigate("signin")} className="w-full sm:w-auto">
            <LogIn className="mr-1.5 size-4" aria-hidden /> Sign in again
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Your intended destination will be restored after signing in.</p>
      </Card>
    </BareShell>
  );
}

// ---------- Screen 103 — 404 / Page Not Found (bare) ----------

function NotFoundScreen() {
  const navigate = useBizz((s) => s.navigate);
  const goBack = useGoBack("home");

  const suggestions = [
    { label: "Home", route: "home" },
    { label: "Performance", route: "performance" },
    { label: "Insights", route: "insights" },
    { label: "Data", route: "data" },
  ];

  return (
    <BareShell>
      <Card className="p-6 text-center sm:p-10">
        <p aria-hidden className="select-none bg-gradient-to-b from-slate-200 to-slate-100 bg-clip-text text-7xl font-black tracking-tight text-transparent sm:text-8xl">
          404
        </p>
        <h1 className="mt-3 text-xl font-bold tracking-tight sm:text-2xl">Page not found</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist, was moved, or the link may be out of date. Everything else is still
          where you left it.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button onClick={() => navigate("home")} className="w-full sm:w-auto">
            <Home className="mr-1.5 size-4" aria-hidden /> Go Home
          </Button>
          <Button variant="outline" onClick={goBack} className="w-full sm:w-auto">
            Back to previous page
          </Button>
        </div>
        <Separator className="my-6" />
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Were you looking for</p>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {suggestions.map((s) => (
            <Button key={s.route} variant="outline" size="sm" onClick={() => navigate(s.route)}>
              {s.label}
            </Button>
          ))}
        </div>
      </Card>
    </BareShell>
  );
}

// ---------- Screen 104 — General Error / Service Unavailable (bare) ----------

const ERROR_REFERENCE = "REF-2026-0930-4172";

function ServiceErrorScreen() {
  const navigate = useBizz((s) => s.navigate);

  function copyReference() {
    try {
      void navigator.clipboard?.writeText(ERROR_REFERENCE);
      toast.success("Reference copied", { description: ERROR_REFERENCE });
    } catch {
      toast(`Reference: ${ERROR_REFERENCE}`);
    }
  }

  return (
    <BareShell link={{ label: "Go to the app", onClick: () => navigate("home") }}>
      <Card className="p-6 text-center sm:p-10">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full border bg-slate-100 text-slate-600 shadow-sm">
          <ServerOff className="size-5" aria-hidden />
        </div>
        <h1 className="mt-5 text-xl font-bold tracking-tight sm:text-2xl">Service unavailable</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          Nellovia couldn&apos;t reach its analysis service. This is a technical problem on our side, not an issue with your
          data — nothing was lost and nothing needs fixing on your end.
        </p>

        <button
          onClick={copyReference}
          className="mx-auto mt-5 flex items-center gap-2 rounded-lg border bg-slate-50 px-3 py-2 font-mono text-xs text-slate-600 transition-colors hover:bg-slate-100"
          aria-label={`Copy reference code ${ERROR_REFERENCE}`}
        >
          Reference: {ERROR_REFERENCE}
          <Copy className="size-3.5" aria-hidden />
        </button>

        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button onClick={() => window.location.reload()} className="w-full sm:w-auto">
            <RefreshCw className="mr-1.5 size-4" aria-hidden /> Retry
          </Button>
          <Button variant="outline" onClick={() => navigate("home")} className="w-full sm:w-auto">
            <Home className="mr-1.5 size-4" aria-hidden /> Go Home
          </Button>
          <Button variant="ghost" onClick={() => navigate("feedback")} className="w-full sm:w-auto">
            Contact support
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          If it persists, contact support with the reference code so we can trace the exact request.
        </p>
      </Card>
    </BareShell>
  );
}

// ---------- Group registration ----------

export const views: ViewMap = {
  "state/no-data": NoDataScreen,
  "state/insufficient": InsufficientScreen,
  "state/syncing": SyncingScreen,
  "state/stale": StaleScreen,
  "state/disconnected": DisconnectedScreen,
  "state/permission-denied": PermissionDeniedScreen,
  "state/plan-limit": PlanLimitScreen,
  "state/session-expired": SessionExpiredScreen,
  "state/404": NotFoundScreen,
  "state/error": ServiceErrorScreen,
};
