"use client";
// Screens 51–56 — Sources Library, Integration Detail, Permission Review,
// Initial Sync, Connection Error, Connected Source Settings.

import { useEffect, useRef, useState, type ComponentType } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Database,
  Eye,
  Lock,
  PenLine,
  Plug,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Unlock,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/shared/states";
import { InfoBanner, KeyValue, PageHeader, SectionCard } from "@/components/shared/layout";
import { StatusBadge } from "@/components/shared/badges";
import { useBizz, useConnectionsFor } from "@/lib/store";
import { getBusiness } from "@/lib/data/businesses";
import { INTEGRATIONS, integrationById } from "@/lib/data/operations";
import { getPendingConnection, setPendingConnection } from "./session";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Business, ConnectionStatus, IntegrationDef } from "@/lib/types";
import type { ViewMap } from "../view-types";
import {
  GoogleAccountPicker,
  MetaAccountPicker,
  ShopifyConnectScreen,
  TikTokAdsAccountPicker,
  RealConnectPermission,
  RealConnectionError,
  RealIntegrationDetail,
  RealIntegrationsLibrary,
  RealSourceSettings,
  RealSyncing,
} from "./real-connections";

// ---------- Shared bits ----------

function effectiveStatus(int: IntegrationDef, connections: Record<string, ConnectionStatus>): ConnectionStatus {
  return connections[int.id] ?? int.status;
}

function CapabilityBadge({ badge }: { badge: IntegrationDef["badge"] }) {
  const cls =
    badge === "Read"
      ? "bg-brand-50 text-brand-700 border-brand-200"
      : badge === "Observe"
        ? "bg-slate-100 text-slate-600 border-slate-200"
        : "bg-amber-50 text-amber-700 border-amber-200";
  const icon = badge === "Read" ? <Unlock className="size-3" aria-hidden /> : badge === "Observe" ? <Eye className="size-3" aria-hidden /> : <PenLine className="size-3" aria-hidden />;
  return (
    <Badge variant="outline" className={cn("gap-1 font-normal", cls)}>
      {icon}
      {badge}
    </Badge>
  );
}

const CATEGORY_ORDER = ["Website analytics", "Advertising", "Ecommerce", "Payments", "Manual / import"];

const UNLOCK_BY_CATEGORY: Record<string, string[]> = {
  "Website analytics": ["Funnel and website conversion diagnosis", "Upstream analysis of what happens before enquiries or visits convert"],
  Advertising: ["Channel efficiency, CAC and budget guidance", "Detection of spend changes during experiments"],
  Ecommerce: ["Checkout funnel and product performance analysis", "Device-level completion and abandonment diagnosis"],
  Payments: ["Payment-reliability diagnosis and failure-reason analysis"],
  "Manual / import": ["A baseline diagnosis with zero connections", "Aggregate-level intelligence while integrations are pending"],
};

function accountNameFor(int: IntegrationDef, business: Business): string {
  switch (int.id) {
    case "meta-ads":
      return `${business.name} — Meta Business`;
    case "google-ads":
      return `${business.name} — Google Ads (CID 482-990-1128)`;
    case "google-analytics":
      return `${business.name} — GA4 property`;
    case "shopify":
      return `${business.name} — ${business.name.toLowerCase().replace(/[^a-z]/g, "")}.myshopify.com`;
    case "woocommerce":
      return `${business.name} — WooCommerce store`;
    case "paystack":
      return `${business.name} — Paystack primary`;
    case "flutterwave":
      return `${business.name} — Flutterwave NG`;
    case "csv":
      return "Uploaded files";
    case "manual":
      return `${business.name} — manual entries`;
    default:
      return `${business.name} — ${int.name}`;
  }
}

// ---------- Screen 51 — Sources Library ----------

function IntegrationsLibraryScreen() {
  const businessId = useBizz((s) => s.businessId);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const connections = useConnectionsFor(businessId);
  const navigate = useBizz((s) => s.navigate);
  const business = getBusiness(businessId, userWorkspace);

  const list = INTEGRATIONS.filter((i) => !i.businessId || i.businessId === businessId || i.status === "available");

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title="Sources library"
        description={`Everything ${business.name} can connect for data. Connectors are read-only by default.`}
        back={
          <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => navigate("data")}>
            Back to Data Centre
          </Button>
        }
      />

      <InfoBanner tone="info" title="Prototype note">
        Connectors are simulated in this prototype — no live accounts are accessed, and connecting takes a few seconds.
      </InfoBanner>

      <div className="mt-5 space-y-6">
        {CATEGORY_ORDER.map((category) => {
          const items = list.filter((i) => i.category === category);
          if (items.length === 0) return null;
          return (
            <section key={category} aria-label={category}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{category}</h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {items.map((int) => {
                  const status = effectiveStatus(int, connections);
                  return (
                    <Card key={int.id} className="flex flex-col p-5">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold">{int.name}</h3>
                        <StatusBadge status={status} />
                      </div>
                      <p className="mt-1.5 flex-1 text-sm leading-relaxed text-muted-foreground">{int.description}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="font-normal text-muted-foreground">
                          {int.category}
                        </Badge>
                        <CapabilityBadge badge={int.badge} />
                      </div>
                      <div className="mt-4 border-t pt-3">
                        {status === "available" ? (
                          <Button size="sm" className="w-full" onClick={() => navigate(`connect/${int.id}`)}>
                            <Plug className="mr-1.5 size-4" aria-hidden /> Connect
                          </Button>
                        ) : status === "connected" ? (
                          <Button size="sm" variant="outline" className="w-full" onClick={() => navigate(`source-settings/${int.id}`)}>
                            <Wrench className="mr-1.5 size-4" aria-hidden /> Manage
                          </Button>
                        ) : status === "syncing" ? (
                          <Button size="sm" variant="outline" className="w-full" onClick={() => navigate("syncing")}>
                            <RefreshCw className="mr-1.5 size-4 animate-spin" aria-hidden /> View sync
                          </Button>
                        ) : (
                          <Button size="sm" variant="destructive" className="w-full" onClick={() => navigate("connection-error")}>
                            <CircleAlert className="mr-1.5 size-4" aria-hidden /> Fix connection
                          </Button>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Screen 52 — Integration Detail ----------

function IntegrationDetailScreen({ params }: { params: Record<string, string> }) {
  const businessId = useBizz((s) => s.businessId);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const connections = useConnectionsFor(businessId);
  const navigate = useBizz((s) => s.navigate);
  const business = getBusiness(businessId, userWorkspace);
  const int = integrationById(params.id);

  useEffect(() => {
    if (!int) navigate("integrations");
  }, [int, navigate]);

  if (!int) return null;
  const status = effectiveStatus(int, connections);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        title={int.name}
        description={int.description}
        back={
          <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => navigate("integrations")}>
            Back to sources
          </Button>
        }
        badge={
          <>
            <Badge variant="outline" className="font-normal text-muted-foreground">
              {int.category}
            </Badge>
            <CapabilityBadge badge={int.badge} />
            <StatusBadge status={status} />
          </>
        }
        actions={
          status === "available" ? (
            <Button onClick={() => navigate(`connect/${int.id}`)}>
              <Plug className="mr-1.5 size-4" aria-hidden /> Connect
            </Button>
          ) : status === "connected" ? (
            <Button variant="outline" onClick={() => navigate(`source-settings/${int.id}`)}>
              <Wrench className="mr-1.5 size-4" aria-hidden /> Manage source
            </Button>
          ) : status === "syncing" ? (
            <Button variant="outline" onClick={() => navigate("syncing")}>
              <RefreshCw className="mr-1.5 size-4 animate-spin" aria-hidden /> View sync
            </Button>
          ) : (
            <Button variant="destructive" onClick={() => navigate("connection-error")}>
              <CircleAlert className="mr-1.5 size-4" aria-hidden /> Fix connection
            </Button>
          )
        }
      />

      <div className="space-y-5">
        <SectionCard title="What it provides" description="Data types this source supplies to your workspace.">
          <ul className="space-y-1.5">
            {int.provides.map((p) => (
              <li key={p} className="flex items-center gap-2 text-sm">
                <Check className="size-4 shrink-0 text-emerald-600" aria-hidden /> {p}
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="What intelligence it unlocks">
          <div className="flex items-start gap-2.5 rounded-xl border border-brand-200 bg-brand-50/60 p-4">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
            <p className="text-sm leading-relaxed text-brand-900">{int.unlocks}</p>
          </div>
        </SectionCard>

        <SectionCard title="Permissions needed" description="What Nellovia will read — and what it cannot do.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-800">
                <Unlock className="size-3.5" aria-hidden /> What we will read
              </p>
              <ul className="mt-2 space-y-1.5">
                {int.permissions.read.map((r) => (
                  <li key={r} className="text-sm text-brand-900/80">
                    · {r}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700">
                <Lock className="size-3.5" aria-hidden /> What we cannot do
              </p>
              <ul className="mt-2 space-y-1.5">
                {int.permissions.cannot.map((c) => (
                  <li key={c} className="text-sm text-slate-600">
                    · {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Current status">
          {status === "available" ? (
            <p className="text-sm text-muted-foreground">
              Not connected yet. Connecting takes about a minute and is read-only — review permissions before you continue.
            </p>
          ) : (
            <div className="space-y-2">
              <KeyValue label="Status">
                <StatusBadge status={status} />
              </KeyValue>
              {int.connectedSince ? (
                <KeyValue label="Connected since">{fmtDate(int.connectedSince)}</KeyValue>
              ) : null}
              <KeyValue label="Last sync">{int.lastSync ?? "—"}</KeyValue>
              <KeyValue label="Next sync">{int.nextSync ?? "—"}</KeyValue>
              <KeyValue label="Workspace">{int.businessId ? business.name : "All workspaces"}</KeyValue>
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

// ---------- Screen 53 — Permission Review ----------

function ConnectPermissionScreen({ params }: { params: Record<string, string> }) {
  const businessId = useBizz((s) => s.businessId);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const navigate = useBizz((s) => s.navigate);
  const setConnection = useBizz((s) => s.setConnection);
  const business = getBusiness(businessId, userWorkspace);
  const int = integrationById(params.id);

  useEffect(() => {
    if (!int) navigate("integrations");
  }, [int, navigate]);

  if (!int) return null;

  function continueReadOnly() {
    if (!int) return;
    setPendingConnection(int.id);
    setConnection(int.id, "syncing");
    navigate("syncing");
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="Review permissions before connecting"
        description={`${int.name} — read-only access. Nothing on your account can be changed without a separate, explicit action.`}
        back={
          <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => navigate(`integrations/${int.id}`)}>
            Back to {int.name}
          </Button>
        }
        badge={<CapabilityBadge badge={int.badge} />}
      />

      <InfoBanner tone="info" title="Read-only by default">
        Nellovia requests read-only access. We never publish content, modify campaigns or move money on your accounts.
      </InfoBanner>

      <div className="mt-5 space-y-4">
        <SectionCard title="Why we need access">
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
            <p className="text-sm leading-relaxed">{int.unlocks}</p>
          </div>
        </SectionCard>

        <SectionCard title="What we will read">
          <ul className="space-y-1.5">
            {int.permissions.read.map((r) => (
              <li key={r} className="flex items-center gap-2 text-sm">
                <Check className="size-4 shrink-0 text-emerald-600" aria-hidden /> {r}
              </li>
            ))}
          </ul>
          <Separator className="my-3" />
          <p className="text-xs text-muted-foreground">Also imported: {int.provides.join(", ")}.</p>
        </SectionCard>

        <SectionCard title="What we cannot do">
          <ul className="space-y-1.5">
            {int.permissions.cannot.map((c) => (
              <li key={c} className="flex items-center gap-2 text-sm">
                <Lock className="size-4 shrink-0 text-slate-500" aria-hidden /> {c}
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard title="How to disconnect">
          <p className="text-sm leading-relaxed text-muted-foreground">
            One click in Data Centre → Connected sources. Imported data is retained for 30 days in case you reconnect, then deleted.
          </p>
        </SectionCard>

        <SectionCard title="What this unlocks">
          <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-brand-700">
              <Sparkles className="size-3.5" aria-hidden /> Insights that improve
            </p>
            <ul className="mt-2 space-y-1.5">
              {(UNLOCK_BY_CATEGORY[int.category] ?? [int.unlocks]).map((u) => (
                <li key={u} className="text-sm text-brand-900">
                  · {u}
                </li>
              ))}
            </ul>
          </div>
        </SectionCard>
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Button onClick={continueReadOnly} className="flex-1">
          <ShieldCheck className="mr-1.5 size-4" aria-hidden /> Continue with read-only connection
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => navigate("manual-entry")}>
          <PenLine className="mr-1.5 size-4" aria-hidden /> Enter totals manually instead
        </Button>
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        You can disconnect at any time. Connecting as {business.name} workspace.
      </p>
    </div>
  );
}

// ---------- Screen 54 — Connection Success / Initial Sync ----------

const SYNC_STEPS = ["Authorizing", "Connecting", "Importing data", "Calculating metrics", "Checking history", "Updating diagnosis"];

function SyncingScreen() {
  const navigate = useBizz((s) => s.navigate);
  const setConnection = useBizz((s) => s.setConnection);
  const [step, setStep] = useState(1); // step 0 (Authorizing) is already complete
  const finishedRef = useRef(false);
  const pendingId = getPendingConnection();
  const int = integrationById(pendingId);
  const name = int?.name ?? "Source";

  useEffect(() => {
    if (step >= SYNC_STEPS.length) {
      if (finishedRef.current) return;
      const t = setTimeout(() => {
        if (finishedRef.current) return;
        finishedRef.current = true;
        setConnection(pendingId, "connected");
        toast.success(`${name} connected — first insights arriving`, {
          description: "Initial history is imported; metrics update on the next pass.",
        });
        navigate(`source-settings/${pendingId}`);
      }, 900);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep((s) => s + 1), 2000);
    return () => clearTimeout(t);
  }, [step, pendingId, name, setConnection, navigate]);

  const progress = Math.round(((step + 0.5) / SYNC_STEPS.length) * 100);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Card className="p-6">
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden />
          <div>
            <h1 className="text-base font-semibold text-emerald-900">{name} authorized successfully</h1>
            <p className="mt-0.5 text-sm text-emerald-800/80">
              Read-only connection established. First sync is running — this usually takes under a minute.
            </p>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Initial sync</span>
            <span className="tnum text-muted-foreground">{progress}%</span>
          </div>
          <Progress value={progress} className="mt-2 h-2 [&>div]:bg-brand-600" aria-label={`Sync progress ${progress}%`} />
        </div>

        <ol className="mt-6 space-y-3" aria-label="Sync steps">
          {SYNC_STEPS.map((label, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <li key={label} className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border",
                    done && "border-emerald-200 bg-emerald-50 text-emerald-600",
                    active && "border-brand-200 bg-brand-50 text-brand-600",
                    !done && !active && "border-slate-200 bg-slate-50 text-slate-400"
                  )}
                  aria-hidden
                >
                  {done ? (
                    <Check className="size-4" />
                  ) : active ? (
                    <RefreshCw className="size-4 animate-spin" />
                  ) : (
                    <span className="text-xs tnum">{i + 1}</span>
                  )}
                </span>
                <span className={cn("text-sm", done && "text-muted-foreground", active && "font-medium", !done && !active && "text-slate-400")}>
                  {label}
                  {done && i === 0 ? " — token verified" : ""}
                </span>
                {active ? (
                  <span className="ml-auto text-xs text-muted-foreground" role="status">
                    in progress…
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>

        <div className="mt-6 flex flex-col gap-2 border-t pt-5 sm:flex-row">
          <Button variant="outline" className="flex-1" onClick={() => { toast("Sync continues in the background", { description: "You can keep working — we will notify you when the first insights arrive." }); navigate("data"); }}>
            Continue in background
          </Button>
          <p className="flex items-center justify-center text-xs text-muted-foreground sm:flex-1">
            Nothing can be changed on your account — this connection is read-only.
          </p>
        </div>
      </Card>
    </div>
  );
}

// ---------- Screen 55 — Connection Error / Reconnect ----------

function ConnectionErrorScreen() {
  const navigate = useBizz((s) => s.navigate);
  const setConnection = useBizz((s) => s.setConnection);
  const shopify = integrationById("shopify");
  const error = shopify?.error;

  if (!shopify || !error) return null;

  function reconnect() {
    setPendingConnection("shopify");
    setConnection("shopify", "syncing");
    navigate("syncing");
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="Connection error"
        description={`${shopify.name} — connected source for KoraHome Store.`}
        back={
          <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => navigate("integrations")}>
            Back to sources
          </Button>
        }
        badge={<StatusBadge status="error" />}
      />

      <InfoBanner tone="danger" title={error.title}>
        {error.detail}
      </InfoBanner>

      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <CircleAlert className="size-4 text-red-500" aria-hidden /> What happened
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{error.detail}</p>
          <p className="mt-2 text-xs text-muted-foreground">Detected: {error.time}</p>
        </Card>
        <Card className="p-5">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Database className="size-4 text-amber-500" aria-hidden /> What data is affected
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{error.affected}</p>
          <p className="mt-2 text-xs text-muted-foreground">Historical data is retained and will backfill on reconnect.</p>
        </Card>
        <Card className="p-5">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Wrench className="size-4 text-brand-600" aria-hidden /> How to resolve
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{error.resolution}</p>
          <p className="mt-2 text-xs text-muted-foreground">Takes under a minute. The connection stays read-only.</p>
        </Card>
      </div>

      <Card className="mt-4 p-5">
        <h2 className="text-sm font-semibold">Sync schedule while paused</h2>
        <div className="mt-3 space-y-2">
          <KeyValue label="Last sync">{shopify.lastSync ?? "—"}</KeyValue>
          <KeyValue label="Next sync">{shopify.nextSync ?? "—"}</KeyValue>
        </div>
      </Card>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Button onClick={reconnect} className="flex-1">
          <RefreshCw className="mr-1.5 size-4" aria-hidden /> Reconnect
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => navigate("source-settings/shopify")}>
          Review source settings
        </Button>
      </div>
    </div>
  );
}

// ---------- Screen 56 — Connected Source Settings ----------

function SourceSettingsScreen({ params }: { params: Record<string, string> }) {
  const businessId = useBizz((s) => s.businessId);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const connections = useConnectionsFor(businessId);
  const setConnection = useBizz((s) => s.setConnection);
  const navigate = useBizz((s) => s.navigate);
  const business = getBusiness(businessId, userWorkspace);
  const int = integrationById(params.id);

  const [syncingNow, setSyncingNow] = useState(false);
  const [lastSyncOverride, setLastSyncOverride] = useState<string | null>(null);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (syncTimer.current) clearTimeout(syncTimer.current);
    };
  }, []);

  if (!int) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <PageHeader title="Connected source" />
        <EmptyState
          icon={<Plug className="size-5" />}
          title="Source not found"
          description="We couldn't find that source. Pick a source from the library instead."
          actions={
            <Button size="sm" onClick={() => navigate("integrations")}>
              Open sources library
            </Button>
          }
        />
      </div>
    );
  }

  const status = effectiveStatus(int, connections);

  if (status === "available") {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <PageHeader title={`${int.name} settings`} back={<Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => navigate("integrations")}>Back to sources</Button>} />
        <EmptyState
          icon={<Plug className="size-5" />}
          title={`${int.name} is not connected yet`}
          description="Connect this source to see settings, sync history and health."
          actions={
            <Button size="sm" onClick={() => navigate(`connect/${int.id}`)}>
              <Plug className="mr-1.5 size-4" aria-hidden /> Connect {int.name}
            </Button>
          }
        />
      </div>
    );
  }

  function syncNow() {
    setSyncingNow(true);
    syncTimer.current = setTimeout(() => {
      setSyncingNow(false);
      setLastSyncOverride("Just now");
      toast.success("Sync complete", { description: `${int?.name ?? "Source"} data is up to date.` });
    }, 2000);
  }

  function reconnect() {
    setPendingConnection(int!.id);
    setConnection(int!.id, "syncing");
    navigate("syncing");
  }

  function disconnect() {
    setConnection(int!.id, "available");
    toast("Source disconnected", { description: `${int?.name ?? "Source"} data is retained for 30 days.` });
    navigate("integrations");
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title={`${int.name} settings`}
        description={int.description}
        back={
          <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => navigate("integrations")}>
            Back to sources
          </Button>
        }
        badge={<StatusBadge status={status} />}
      />

      <div className="space-y-5">
        <SectionCard title="Account">
          <div className="space-y-2">
            <KeyValue label="Account name">{accountNameFor(int, business)}</KeyValue>
            <KeyValue label="Connected since">{int.connectedSince ? fmtDate(int.connectedSince) : "—"}</KeyValue>
            <KeyValue label="Last sync">
              {lastSyncOverride ?? (status === "error" ? int.lastSync ?? "—" : int.lastSync ?? "A few minutes ago")}
            </KeyValue>
            <KeyValue label="Next sync">{status === "error" ? "paused" : int.nextSync ?? "In about an hour"}</KeyValue>
          </div>
        </SectionCard>

        <SectionCard title="Health">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={status} />
            <p className="text-sm text-muted-foreground">
              {status === "connected"
                ? "Syncing normally. Data lands in your workspace within minutes of each sync window."
                : status === "error"
                  ? "Last sync failed — authorization needs to be refreshed. Historical data is retained."
                  : "Initial sync in progress."}
            </p>
          </div>
        </SectionCard>

        <SectionCard title="Permissions" description="Read-only — these cannot be widened from the prototype.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Reads</p>
              <ul className="mt-1.5 space-y-1">
                {int.permissions.read.map((r) => (
                  <li key={r} className="text-sm text-muted-foreground">
                    · {r}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Cannot</p>
              <ul className="mt-1.5 space-y-1">
                {int.permissions.cannot.map((c) => (
                  <li key={c} className="text-sm text-muted-foreground">
                    · {c}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Data types">
          <div className="flex flex-wrap gap-2">
            {int.provides.map((p) => (
              <Badge key={p} variant="outline" className="font-normal text-muted-foreground">
                {p}
              </Badge>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Button onClick={syncNow} disabled={syncingNow} className="flex-1">
          {syncingNow ? (
            <>
              <RefreshCw className="mr-1.5 size-4 animate-spin" aria-hidden /> Syncing…
            </>
          ) : (
            <>
              <RefreshCw className="mr-1.5 size-4" aria-hidden /> Sync now
            </>
          )}
        </Button>
        <Button variant="outline" className="flex-1" onClick={reconnect}>
          Reconnect
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="flex-1">
              Disconnect
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Disconnect {int.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                {accountNameFor(int, business)} will stop syncing. Analyses that use this source will note the gap until you
                reconnect. Imported data is retained for 30 days.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={disconnect} className="bg-red-600 hover:bg-red-700">
                Disconnect
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {status === "error" ? (
        <button
          onClick={() => navigate("connection-error")}
          className="mt-4 flex w-full items-center justify-between rounded-xl border border-red-200 bg-red-50/60 p-4 text-left transition-colors hover:bg-red-50"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-red-800">
            <CircleAlert className="size-4" aria-hidden /> Authorization expired — reconnect required
          </span>
          <ChevronRight className="size-4 text-red-400" aria-hidden />
        </button>
      ) : null}

      <button
        onClick={() => navigate(`integrations/${int.id}`)}
        className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden /> What {int.name} provides and unlocks
      </button>
    </div>
  );
}

function OwnerOrDemo({ owner, demo, params }: { owner: ComponentType<{ params: Record<string, string> }>; demo: ComponentType<{ params: Record<string, string> }>; params: Record<string, string> }) {
  const businessId = useBizz((state) => state.businessId);
  const Component = businessId === "user-workspace" ? owner : demo;
  return <Component params={params} />;
}

const route = (owner: ComponentType<{ params: Record<string, string> }>, demo: ComponentType<{ params: Record<string, string> }>) =>
  function ConnectionRoute({ params }: { params: Record<string, string> }) {
    return <OwnerOrDemo owner={owner} demo={demo} params={params} />;
  };

export const views: ViewMap = {
  integrations: route(RealIntegrationsLibrary, IntegrationsLibraryScreen),
  "integrations/:id": route(RealIntegrationDetail, IntegrationDetailScreen),
  "connect/:id": route(RealConnectPermission, ConnectPermissionScreen),
  "connect/google": GoogleAccountPicker,
  "connect/meta": MetaAccountPicker,
  "connect/tiktok-ads": TikTokAdsAccountPicker,
  "connect/shopify": ShopifyConnectScreen,
  syncing: route(RealSyncing, SyncingScreen),
  "connection-error": route(RealConnectionError, ConnectionErrorScreen),
  "connection-error/:id": RealConnectionError,
  "source-settings/:id": route(RealSourceSettings, SourceSettingsScreen),
};
