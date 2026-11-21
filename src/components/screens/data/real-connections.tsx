"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, CircleAlert, Database, ExternalLink, Loader2, Lock, Plug, RefreshCw, ShieldCheck, Unplug } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { InfoBanner, KeyValue, PageHeader, SectionCard } from "@/components/shared/layout";
import { CATALOGUE, CATALOGUE_GROUPS, catalogueEntry, type CatalogueEntry } from "@/lib/connectors/catalogue";
import type { ConnectStatusResponse, ConnectionView, GoogleAccountsResponse, MeasuredSummary, MetaAccountsResponse, SheetPreviewResponse, TikTokAdsAccountsResponse } from "@/lib/connectors/types";
import { useBizz } from "@/lib/store";

// Keeps the old "bizz-" prefix on purpose: renaming a storage key would lose what was saved under it.
const SYNC_IDS_KEY = "bizz-google-sync-ids";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }, cache: "no-store" });
  const body = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Request failed");
  return body;
}

function useConnectStatus() {
  const [status, setStatus] = useState<ConnectStatusResponse | null>(null);
  const [error, setError] = useState("");
  const readinessRetryUsed = useRef(false);
  const load = useCallback(async () => {
    try {
      setStatus(await api<ConnectStatusResponse>("/api/connect/status"));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Connections could not be loaded");
    }
  }, []);
  useEffect(() => {
    // Defer the external fetch until after the initial client commit. This avoids
    // a synchronous state transition in the mount effect and keeps hydration stable.
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (status?.tablesReady !== false || readinessRetryUsed.current) return;
    readinessRetryUsed.current = true;
    const timer = window.setTimeout(() => void load(), 2_000);
    return () => window.clearTimeout(timer);
  }, [load, status?.tablesReady]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [load]);
  return { status, error, reload: load };
}

function connectionFor(entry: CatalogueEntry, status: ConnectStatusResponse | null): ConnectionView | null {
  return status?.connections.find((connection) => connection.catalogueId === entry.id) ?? null;
}

function ConnectionBadge({ connection }: { connection: ConnectionView | null }) {
  const value = connection?.status ?? "available";
  const cls = value === "connected" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : value === "error" ? "border-red-200 bg-red-50 text-red-700" : value === "syncing" ? "border-brand-200 bg-brand-50 text-brand-700" : "border-slate-200 bg-slate-50 text-slate-600";
  return <Badge variant="outline" className={cls}>{value === "connected" ? "Connected" : value === "syncing" ? "Syncing" : value === "error" ? "Needs attention" : "Not connected"}</Badge>;
}

function SetupWarning({ status, providerId }: { status: ConnectStatusResponse; providerId?: string }) {
  if (!status.tablesReady) return <InfoBanner tone="danger" title="Connections database is not ready">Apply the reviewed additive SQL files through <code>prisma/sql/005_connector_credential_metadata.sql</code>. Existing business tables are not replaced.</InfoBanner>;
  if (!providerId) return null;
  const provider = status.providers[providerId];
  if (!provider?.configured) return <InfoBanner tone="warning" title={`${providerLabel(providerId)} connection is not configured yet`}>Add {provider?.missing.join(", ") || "the connector environment variables"}. The Connect buttons stay safe and inactive until then.</InfoBanner>;
  return null;
}

function providerLabel(id: string): string {
  return ({ google: "Google", meta: "Meta", "tiktok-ads": "TikTok Ads", "tiktok-business": "TikTok", shopify: "Shopify" } as Record<string, string>)[id] ?? id;
}

export function RealIntegrationsLibrary() {
  const navigate = useBizz((state) => state.navigate);
  const { status, error, reload } = useConnectStatus();
  const [savingInterest, setSavingInterest] = useState<string | null>(null);

  async function toggleInterest(entry: CatalogueEntry) {
    if (!status) return;
    const enabled = !status.interest.includes(entry.id);
    setSavingInterest(entry.id);
    try {
      await api("/api/connect/interest", { method: "POST", body: JSON.stringify({ platform: entry.id, enabled }) });
      await reload();
      toast.success(enabled ? `We'll prioritise ${entry.name}` : `${entry.name} removed from your list`);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Interest could not be saved");
    } finally {
      setSavingInterest(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader title="Connect your business data" description="Read-only sources that let Nellovia diagnose from measured activity, not guesses." back={<Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => navigate("data")}>Back to Data Centre</Button>} />
      {error ? <InfoBanner tone="danger" title="Connections could not be loaded">{error}</InfoBanner> : null}
      {status ? <SetupWarning status={status} /> : null}
      {!status && !error ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading sources…</div> : null}
      <div className="mt-5 space-y-8">
        {CATALOGUE_GROUPS.map((group) => {
          const entries = CATALOGUE.filter((entry) => entry.group === group.id);
          return (
            <section key={group.id}>
              <div className="mb-3"><h2 className="font-semibold">{group.label}</h2><p className="text-sm text-muted-foreground">{group.hint}</p></div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {entries.map((entry) => {
                  const connection = connectionFor(entry, status);
                  const interested = status?.interest.includes(entry.id) ?? false;
                  const connectorReady = status?.tablesReady && entry.connector && status.providers[entry.connector.id]?.configured;
                  return (
                    <Card key={entry.id} className="flex flex-col p-5">
                      <div className="flex items-start justify-between gap-3"><h3 className="text-sm font-semibold">{entry.name}</h3>{entry.availability === "live" ? <ConnectionBadge connection={connection} /> : <Badge variant="outline">{entry.availability === "built-in" ? "Available" : "Coming soon"}</Badge>}</div>
                      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{entry.blurb}</p>
                      {entry.note ? <p className="mt-2 text-xs leading-relaxed text-amber-700">{entry.note}</p> : null}
                      <div className="mt-4 border-t pt-3">
                        {entry.availability === "built-in" ? <Button size="sm" variant="outline" className="w-full" onClick={() => navigate(entry.route!)}>Open</Button> : null}
                        {entry.availability === "soon" ? <Button size="sm" variant={interested ? "secondary" : "outline"} className="w-full" disabled={savingInterest === entry.id || !status?.tablesReady} onClick={() => void toggleInterest(entry)}>{savingInterest === entry.id ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}{interested ? "I use this — noted" : "I use this"}</Button> : null}
                        {entry.availability === "live" && connection?.status === "connected" ? <Button size="sm" variant="outline" className="w-full" onClick={() => navigate(`source-settings/${entry.id}`)}>Manage</Button> : null}
                        {entry.availability === "live" && connection?.status === "syncing" ? <Button size="sm" variant="outline" className="w-full" onClick={() => navigate("syncing")}><RefreshCw className="mr-1.5 size-4 animate-spin" /> View sync</Button> : null}
                        {entry.availability === "live" && connection?.status === "error" ? <Button size="sm" variant="destructive" className="w-full" onClick={() => navigate(`connection-error/${connection.id}`)}><CircleAlert className="mr-1.5 size-4" /> Fix connection</Button> : null}
                        {entry.availability === "live" && !connection ? <Button size="sm" className="w-full" disabled={!connectorReady} onClick={() => navigate(`connect/${entry.id}`)}><Plug className="mr-1.5 size-4" /> {connectorReady ? "Connect" : "Not set up yet"}</Button> : null}
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

export function RealIntegrationDetail({ params }: { params: Record<string, string> }) {
  const navigate = useBizz((state) => state.navigate);
  const { status } = useConnectStatus();
  const entry = catalogueEntry(params.id);
  useEffect(() => { if (!entry) navigate("integrations"); }, [entry, navigate]);
  if (!entry) return null;
  const connection = connectionFor(entry, status);
  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader title={entry.name} description={entry.blurb} back={<Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => navigate("integrations")}>Back to sources</Button>} badge={<ConnectionBadge connection={connection} />} actions={<Button onClick={() => navigate(connection ? `source-settings/${entry.id}` : `connect/${entry.id}`)}>{connection ? "Manage source" : "Review connection"}</Button>} />
      <div className="space-y-5">
        <SectionCard title="What Nellovia reads"> <ul className="space-y-2">{(entry.reads ?? []).map((line) => <li key={line} className="flex gap-2 text-sm"><Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />{line}</li>)}</ul></SectionCard>
        <SectionCard title="What Nellovia cannot do"><ul className="space-y-2">{(entry.cannot ?? []).map((line) => <li key={line} className="flex gap-2 text-sm"><Lock className="mt-0.5 size-4 shrink-0 text-slate-500" />{line}</li>)}</ul></SectionCard>
        {entry.scopes?.length ? <SectionCard title="Read-only permissions"><ul className="space-y-2">{entry.scopes.map((scope) => <li key={scope.scope} className="text-sm"><span className="font-medium">{scope.label}</span><span className="mt-0.5 block break-all text-xs text-muted-foreground">{scope.scope}</span></li>)}</ul></SectionCard> : null}
      </div>
    </div>
  );
}

export function RealConnectPermission({ params }: { params: Record<string, string> }) {
  const navigate = useBizz((state) => state.navigate);
  const { status } = useConnectStatus();
  const entry = catalogueEntry(params.id);
  useEffect(() => { if (!entry?.connector) navigate("integrations"); }, [entry, navigate]);
  if (!entry?.connector) return null;
  const connector = entry.connector;
  const providerName = providerLabel(connector.id);
  const configured = status?.tablesReady && status.providers[connector.id]?.configured;
  function connect() {
    window.location.assign(`/api/connect/${connector.id}/authorize`);
  }
  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader title={`Connect ${entry.name}`} description={`Review the exact read-only access before leaving for ${providerName} sign-in.`} back={<Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => navigate(`integrations/${entry.id}`)}>Back</Button>} />
      {!configured && status ? <SetupWarning status={status} providerId={connector.id} /> : null}
      <div className="mt-5 space-y-4">
        <SectionCard title="Why this helps"><p className="text-sm leading-relaxed">{entry.blurb}</p></SectionCard>
        <SectionCard title="Read-only permissions"><ul className="space-y-2">{entry.scopes?.map((scope) => <li key={scope.scope} className="flex gap-2 text-sm"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand-600" /><span>{scope.label}<span className="block break-all text-xs text-muted-foreground">{scope.scope}</span></span></li>)}</ul></SectionCard>
        <SectionCard title="What we cannot do"><ul className="space-y-2">{entry.cannot?.map((line) => <li key={line} className="flex gap-2 text-sm"><Lock className="mt-0.5 size-4 shrink-0" />{line}</li>)}</ul></SectionCard>
      </div>
      <div className="mt-6 flex gap-2"><Button className="flex-1" disabled={!configured} onClick={connect}><ExternalLink className="mr-1.5 size-4" /> Continue to {providerName}</Button><Button variant="outline" className="flex-1" onClick={() => navigate("manual-entry")}>Enter totals manually</Button></div>
    </div>
  );
}

export function GoogleAccountPicker() {
  const navigate = useBizz((state) => state.navigate);
  const [accounts, setAccounts] = useState<GoogleAccountsResponse | null>(null);
  const [error, setError] = useState("");
  const [site, setSite] = useState("");
  const [property, setProperty] = useState("");
  const [ads, setAds] = useState("");
  const [sheetUrl, setSheetUrl] = useState("");
  const [sheet, setSheet] = useState<SheetPreviewResponse | null>(null);
  const [sheetTab, setSheetTab] = useState("");
  const [dateColumn, setDateColumn] = useState("");
  const [revenueColumn, setRevenueColumn] = useState("");
  const [expenseColumn, setExpenseColumn] = useState("");
  const [customersColumn, setCustomersColumn] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    void api<GoogleAccountsResponse>("/api/connect/google/accounts").then((data) => {
      setAccounts(data);
      setSite(data.current.searchConsole ?? data.searchConsole.sites[0]?.id ?? "");
      setProperty(data.current.analytics ?? data.analytics.properties[0]?.id ?? "");
      setAds(data.current.ads ?? data.ads.accounts[0]?.id ?? "");
      setSheetUrl(data.current.sheets ?? "");
    }).catch((cause) => setError(cause instanceof Error ? cause.message : "Google accounts could not be loaded"));
  }, []);
  const selectedTab = sheet?.tabs.find((tab) => tab.title === sheetTab) ?? null;
  async function previewSheet() {
    setPreviewing(true); setError(""); setSheet(null);
    try {
      const data = await api<SheetPreviewResponse>("/api/connect/google/sheet-preview", { method: "POST", body: JSON.stringify({ url: sheetUrl }) });
      setSheet(data); setSheetTab(data.tabs[0]?.title ?? "");
      setDateColumn(""); setRevenueColumn(""); setExpenseColumn(""); setCustomersColumn("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The spreadsheet could not be read"); }
    finally { setPreviewing(false); }
  }
  async function save() {
    setSaving(true);
    try {
      const numberOrUndefined = (value: string) => value === "" ? undefined : Number(value);
      const result = await api<{ connectionIds: string[] }>("/api/connect/google/select", { method: "POST", body: JSON.stringify({
        searchConsole: site || null, analytics: property || null, ads: ads || null, sheet: sheet?.spreadsheet.id ?? null,
        sheetConfig: sheet ? { tab: sheetTab, dateColumn: numberOrUndefined(dateColumn), revenueColumn: numberOrUndefined(revenueColumn), expenseColumn: numberOrUndefined(expenseColumn), customersColumn: numberOrUndefined(customersColumn) } : null,
      }) });
      sessionStorage.setItem(SYNC_IDS_KEY, JSON.stringify(result.connectionIds));
      navigate("syncing");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Selections could not be saved");
    } finally { setSaving(false); }
  }
  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader title="Choose what Google should connect" description="One Google sign-in for Search Console, GA4, Ads and one spreadsheet you explicitly select." back={<Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => navigate("integrations")}>Back to sources</Button>} />
      {error ? <InfoBanner tone="danger" title="Google connection needs attention">{error}</InfoBanner> : null}
      {!accounts && !error ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Reading the sites and properties this Google account can access…</div> : null}
      {accounts ? <div className="space-y-5">
        <SectionCard title="Google Search Console" description={accounts.searchConsole.granted ? "Choose the verified website whose Google Search performance should be measured." : "This permission was not granted."}>
          {accounts.searchConsole.error ? <p className="text-sm text-red-700">{accounts.searchConsole.error}</p> : <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={site} onChange={(event) => setSite(event.target.value)}><option value="">Do not connect Search Console</option>{accounts.searchConsole.sites.map((item) => <option key={item.id} value={item.id}>{item.label} — {item.detail}</option>)}</select>}
        </SectionCard>
        <SectionCard title="Google Analytics 4" description={accounts.analytics.granted ? "Choose the GA4 property that measures this business's website." : "This permission was not granted."}>
          {accounts.analytics.error ? <p className="text-sm text-red-700">{accounts.analytics.error}</p> : <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={property} onChange={(event) => setProperty(event.target.value)}><option value="">Do not connect Analytics</option>{accounts.analytics.properties.map((item) => <option key={item.id} value={item.id}>{item.label} — {item.detail}</option>)}</select>}
        </SectionCard>
        <SectionCard title="Google Ads" description={accounts.ads.granted ? "Choose the ad account whose read-only performance should be measured." : "This permission was not granted."}>
          {accounts.ads.error ? <p className="text-sm text-red-700">{accounts.ads.error}</p> : <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={ads} onChange={(event) => setAds(event.target.value)}><option value="">Do not connect Google Ads</option>{accounts.ads.accounts.map((item) => <option key={item.id} value={item.id}>{item.label} — {item.detail}</option>)}</select>}
        </SectionCard>
        <SectionCard title="Google Sheets" description="Paste one spreadsheet URL. Nellovia reads only the tab and columns you map below; it never edits the file.">
          <div className="flex gap-2"><input className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm" value={sheetUrl} onChange={(event) => { setSheetUrl(event.target.value); setSheet(null); }} placeholder="https://docs.google.com/spreadsheets/d/…" /><Button type="button" variant="outline" disabled={!sheetUrl || previewing} onClick={() => void previewSheet()}>{previewing ? <Loader2 className="size-4 animate-spin" /> : "Read columns"}</Button></div>
          {sheet ? <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Tab<select className="mt-1 h-10 w-full rounded-md border bg-background px-3" value={sheetTab} onChange={(event) => { setSheetTab(event.target.value); setDateColumn(""); setRevenueColumn(""); setExpenseColumn(""); setCustomersColumn(""); }}>{sheet.tabs.map((tab) => <option key={tab.title}>{tab.title}</option>)}</select></label>
            <ColumnSelect label="Date column" required headers={selectedTab?.headers ?? []} value={dateColumn} onChange={setDateColumn} />
            <ColumnSelect label="Revenue / sales" headers={selectedTab?.headers ?? []} value={revenueColumn} onChange={setRevenueColumn} />
            <ColumnSelect label="Expenses / costs" headers={selectedTab?.headers ?? []} value={expenseColumn} onChange={setExpenseColumn} />
            <ColumnSelect label="Customers / orders" headers={selectedTab?.headers ?? []} value={customersColumn} onChange={setCustomersColumn} />
          </div> : null}
        </SectionCard>
        <Button className="w-full" disabled={saving || (!site && !property && !ads && !sheet)} onClick={() => void save()}>{saving ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Database className="mr-1.5 size-4" />} Save and import 90 days</Button>
      </div> : null}
    </div>
  );
}

function ColumnSelect({ label, headers, value, onChange, required = false }: { label: string; headers: string[]; value: string; onChange: (value: string) => void; required?: boolean }) {
  return <label className="text-sm">{label}{required ? " *" : ""}<select className="mt-1 h-10 w-full rounded-md border bg-background px-3" value={value} onChange={(event) => onChange(event.target.value)}><option value="">{required ? "Choose a column" : "Not mapped"}</option>{headers.map((header, index) => <option key={`${index}-${header}`} value={index}>{header || `Column ${index + 1}`}</option>)}</select></label>;
}

export function MetaAccountPicker() {
  const navigate = useBizz((state) => state.navigate);
  const [accounts, setAccounts] = useState<MetaAccountsResponse | null>(null);
  const [ads, setAds] = useState(""); const [facebook, setFacebook] = useState(""); const [instagram, setInstagram] = useState("");
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  useEffect(() => { void api<MetaAccountsResponse>("/api/connect/meta/accounts").then((data) => {
    setAccounts(data); setAds(data.current.ads ?? data.ads.accounts[0]?.id ?? ""); setFacebook(data.current.facebook ?? data.pages.pages[0]?.id ?? ""); setInstagram(data.current.instagram ?? data.instagram.accounts[0]?.id ?? "");
  }).catch((cause) => setError(cause instanceof Error ? cause.message : "Meta accounts could not be loaded")); }, []);
  async function save() {
    setSaving(true); setError("");
    try { const result = await api<{ connectionIds: string[] }>("/api/connect/meta/select", { method: "POST", body: JSON.stringify({ ads: ads || null, facebook: facebook || null, instagram: instagram || null }) }); sessionStorage.setItem(SYNC_IDS_KEY, JSON.stringify(result.connectionIds)); navigate("syncing"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Selections could not be saved"); }
    finally { setSaving(false); }
  }
  return <div className="mx-auto w-full max-w-3xl"><PageHeader title="Choose what Meta should connect" description="One Meta sign-in for advertising, Facebook Pages and linked professional Instagram accounts." back={<Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => navigate("integrations")}>Back to sources</Button>} />
    {error ? <InfoBanner tone="danger" title="Meta connection needs attention">{error}</InfoBanner> : null}
    {!accounts && !error ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Reading Meta accounts…</div> : null}
    {accounts ? <div className="space-y-5">
      <AccountSelect title="Meta Ads" description="Choose an ad account." value={ads} onChange={setAds} empty="Do not connect Meta Ads" items={accounts.ads.accounts} error={accounts.ads.error} />
      <AccountSelect title="Facebook Page insights" description="Choose a Page you manage." value={facebook} onChange={setFacebook} empty="Do not connect a Facebook Page" items={accounts.pages.pages} error={accounts.pages.error} />
      <AccountSelect title="Instagram insights" description="Only professional Instagram accounts linked to a Facebook Page can appear." value={instagram} onChange={setInstagram} empty="Do not connect Instagram" items={accounts.instagram.accounts} error={accounts.instagram.error} />
      <Button className="w-full" disabled={saving || (!ads && !facebook && !instagram)} onClick={() => void save()}>{saving ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Database className="mr-1.5 size-4" />} Save and import 90 days</Button>
    </div> : null}
  </div>;
}

export function TikTokAdsAccountPicker() {
  const navigate = useBizz((state) => state.navigate);
  const [accounts, setAccounts] = useState<TikTokAdsAccountsResponse | null>(null);
  const [advertiserId, setAdvertiserId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { void api<TikTokAdsAccountsResponse>("/api/connect/tiktok-ads/accounts").then((data) => { setAccounts(data); setAdvertiserId(data.current ?? data.accounts[0]?.id ?? ""); }).catch((cause) => setError(cause instanceof Error ? cause.message : "TikTok Ads accounts could not be loaded")); }, []);
  async function save() {
    setSaving(true); setError("");
    try {
      const result = await api<{ connectionIds: string[] }>("/api/connect/tiktok-ads/select", { method: "POST", body: JSON.stringify({ advertiserId }) });
      sessionStorage.setItem(SYNC_IDS_KEY, JSON.stringify(result.connectionIds)); navigate("syncing");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "TikTok Ads account could not be saved"); }
    finally { setSaving(false); }
  }
  return <div className="mx-auto w-full max-w-3xl"><PageHeader title="Choose a TikTok Ads account" description="Select the advertiser whose read-only performance should be measured." back={<Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => navigate("integrations")}>Back to sources</Button>} />
    {error ? <InfoBanner tone="danger" title="TikTok Ads connection needs attention">{error}</InfoBanner> : null}
    {!accounts && !error ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Reading TikTok advertisers…</div> : null}
    {accounts ? <div className="space-y-5"><AccountSelect title="TikTok Ads" description="Choose one advertiser account." value={advertiserId} onChange={setAdvertiserId} empty="Choose an advertiser" items={accounts.accounts} /><Button className="w-full" disabled={saving || !advertiserId} onClick={() => void save()}>{saving ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Database className="mr-1.5 size-4" />} Save and import 90 days</Button></div> : null}
  </div>;
}

export function ShopifyConnectScreen() {
  const navigate = useBizz((state) => state.navigate);
  const { status } = useConnectStatus();
  const [shop, setShop] = useState("");
  const configured = status?.tablesReady && status.providers.shopify?.configured;
  const connect = () => window.location.assign(`/api/connect/shopify/authorize?shop=${encodeURIComponent(shop.trim())}`);
  return <div className="mx-auto w-full max-w-3xl"><PageHeader title="Connect Shopify" description="Install the read-only Nellovia app on one Shopify store." back={<Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => navigate("integrations/shopify")}>Back</Button>} />
    {!configured && status ? <SetupWarning status={status} providerId="shopify" /> : null}
    <div className="mt-5 space-y-4"><SectionCard title="Store domain" description="Use the permanent myshopify.com domain, even if the store has a custom public domain."><div className="flex items-center rounded-md border bg-background"><input className="h-10 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none" value={shop} onChange={(event) => setShop(event.target.value)} placeholder="your-store.myshopify.com" /></div></SectionCard>
      <SectionCard title="Read-only access"><p className="text-sm">Nellovia requests only <code>read_orders</code> and imports aggregate daily order, sales, refund, item and cancellation totals. Customer names, emails and addresses are not requested.</p></SectionCard>
      <SectionCard title="What we cannot do"><p className="text-sm">The connector cannot edit products, orders, inventory or settings, issue refunds, or capture payments.</p></SectionCard></div>
    <Button className="mt-6 w-full" disabled={!configured || !shop.trim()} onClick={connect}><ExternalLink className="mr-1.5 size-4" /> Continue to Shopify</Button>
  </div>;
}

function AccountSelect({ title, description, value, onChange, empty, items, error }: { title: string; description: string; value: string; onChange: (value: string) => void; empty: string; items: Array<{ id: string; label: string; detail: string }>; error?: string }) {
  return <SectionCard title={title} description={description}>{error ? <p className="text-sm text-red-700">{error}</p> : <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)}><option value="">{empty}</option>{items.map((item) => <option key={item.id} value={item.id}>{item.label} — {item.detail}</option>)}</select>}</SectionCard>;
}

export function RealSyncing() {
  const navigate = useBizz((state) => state.navigate);
  const { status, error, reload } = useConnectStatus();
  const started = useRef(false);
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    // sessionStorage is browser-only. Deferring the read preserves the server
    // render and avoids a hydration mismatch when a sync is already queued.
    const timer = window.setTimeout(() => {
      try {
        const stored = JSON.parse(sessionStorage.getItem(SYNC_IDS_KEY) ?? "[]") as unknown;
        setIds(Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : []);
      } catch {
        setIds([]);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const selected = status?.connections.filter((connection) => ids.includes(connection.id)) ?? [];
  useEffect(() => {
    if (started.current || !ids.length) return;
    started.current = true;
    void api("/api/connect/sync", { method: "POST", body: JSON.stringify({ connectionIds: ids }) }).finally(() => void reload());
  }, [ids, reload]);
  useEffect(() => {
    const timer = window.setInterval(() => void reload(), 1_500);
    return () => window.clearInterval(timer);
  }, [reload]);
  const finished = selected.length > 0 && selected.every((connection) => connection.status === "connected" || connection.status === "error");
  return (
    <div className="mx-auto w-full max-w-2xl">
      <Card className="p-6"><h1 className="text-lg font-semibold">Importing measured business data</h1><p className="mt-1 text-sm text-muted-foreground">Real progress from the connected platforms and the database. You can leave this screen; the sync continues on the server.</p>
        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
        <div className="mt-6 space-y-5">{selected.map((connection) => { const progress = connection.progress; const value = progress ? Math.round((progress.step / progress.total) * 100) : 5; const name = connection.catalogueId ? catalogueEntry(connection.catalogueId)?.name : null; return <div key={connection.id}><div className="flex justify-between text-sm"><span className="font-medium">{name ?? connection.product}</span><span className="text-muted-foreground">{connection.status === "error" ? "Needs attention" : progress?.label ?? "Queued"}</span></div><Progress value={value} className="mt-2" />{connection.error ? <p className="mt-1 text-xs text-red-700">{connection.error}</p> : null}</div>; })}</div>
        {!selected.length ? <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Preparing selected sources…</div> : null}
        <div className="mt-6 flex gap-2"><Button variant="outline" className="flex-1" onClick={() => navigate("data")}>Continue in background</Button>{finished ? <Button className="flex-1" onClick={() => { sessionStorage.removeItem(SYNC_IDS_KEY); navigate("integrations"); }}>View sources</Button> : null}</div>
      </Card>
    </div>
  );
}

export function RealSourceSettings({ params }: { params: Record<string, string> }) {
  const navigate = useBizz((state) => state.navigate);
  const { status, reload } = useConnectStatus();
  const [summary, setSummary] = useState<MeasuredSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const entry = catalogueEntry(params.id);
  const connection = entry ? connectionFor(entry, status) : null;
  useEffect(() => { void api<{ summary: MeasuredSummary }>("/api/connect/summary").then((data) => setSummary(data.summary)).catch(() => {}); }, []);
  useEffect(() => { if (status && !connection) navigate("integrations"); }, [status, connection, navigate]);
  if (!entry || !connection) return null;
  const selectedEntry = entry;
  const selectedConnection = connection;
  const productSummary = selectedConnection.provider === "google" && selectedConnection.product === "analytics"
    ? summary?.analytics
    : selectedConnection.provider === "google" && selectedConnection.product === "search-console"
      ? summary?.searchConsole
      : summary?.otherSources.find((source) => source.connectionId === selectedConnection.id);
  async function sync() {
    setBusy(true);
    try { await api("/api/connect/sync", { method: "POST", body: JSON.stringify({ connectionIds: [selectedConnection.id] }) }); await reload(); toast.success(`${selectedEntry.name} is up to date`); }
    catch (cause) { toast.error(cause instanceof Error ? cause.message : "Sync failed"); }
    finally { setBusy(false); }
  }
  async function disconnect() {
    setBusy(true);
    try { await api(`/api/connect/${selectedConnection.id}/disconnect`, { method: "POST", body: "{}" }); toast.success(`${selectedEntry.name} disconnected`); navigate("integrations"); }
    catch (cause) { toast.error(cause instanceof Error ? cause.message : "Disconnect failed"); setBusy(false); }
  }
  return (
    <div className="mx-auto w-full max-w-4xl"><PageHeader title={entry.name} description={connection.accountLabel ?? "Connected data source"} back={<Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => navigate("integrations")}>Back to sources</Button>} badge={<ConnectionBadge connection={connection} />} />
      <div className="space-y-5"><SectionCard title="Connection"><div className="space-y-2"><KeyValue label="Account">{connection.accountLabel}</KeyValue><KeyValue label="Last sync">{connection.lastSyncAt ? new Date(connection.lastSyncAt).toLocaleString() : "Not yet synced"}</KeyValue><KeyValue label="Measured history">{connection.dataFrom && connection.dataTo ? `${connection.dataFrom} to ${connection.dataTo}` : "Waiting for first sync"}</KeyValue></div></SectionCard>
      {productSummary ? <SectionCard title="Latest measured window"><pre className="overflow-x-auto whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">{JSON.stringify(productSummary, null, 2)}</pre></SectionCard> : null}
      {connection.error ? <InfoBanner tone="danger" title="Last sync failed">{connection.error}</InfoBanner> : null}</div>
      <div className="mt-6 flex flex-col gap-2 sm:flex-row"><Button className="flex-1" disabled={busy} onClick={() => void sync()}>{busy ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <RefreshCw className="mr-1.5 size-4" />} Sync now</Button><Button variant="outline" className="flex-1" onClick={() => navigate(`connect/${entry.id}`)}>Reconnect</Button><AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" className="flex-1" disabled={busy}><Unplug className="mr-1.5 size-4" /> Disconnect</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Disconnect {entry.name}?</AlertDialogTitle><AlertDialogDescription>This stops future reads and removes its imported metrics. Other products using the same provider remain connected.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => void disconnect()}>Disconnect</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>
    </div>
  );
}

export function RealConnectionError({ params }: { params: Record<string, string> }) {
  const navigate = useBizz((state) => state.navigate);
  const { status } = useConnectStatus();
  const connection = status?.connections.find((item) => item.id === params.id) ?? status?.connections.find((item) => item.status === "error") ?? null;
  const entry = connection?.catalogueId ? catalogueEntry(connection.catalogueId) : null;
  if (!connection || !entry) return <div className="mx-auto max-w-2xl"><InfoBanner tone="warning" title="No connection error found">Return to sources and try syncing again.</InfoBanner><Button className="mt-4" onClick={() => navigate("integrations")}>Back to sources</Button></div>;
  const providerName = connection.provider === "meta" ? "Meta" : "Google";
  return <div className="mx-auto w-full max-w-3xl"><PageHeader title={`${entry.name} needs attention`} description={connection.accountLabel ?? `${providerName} source`} back={<Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => navigate("integrations")}>Back to sources</Button>} /><InfoBanner tone="danger" title={connection.errorCode === "reauth" ? `Reconnect ${providerName}` : "Sync failed"}>{connection.error ?? `${providerName} could not complete the last sync.`}</InfoBanner><div className="mt-5 grid gap-4 sm:grid-cols-2"><Card className="p-5"><CircleAlert className="size-5 text-red-600" /><h2 className="mt-2 font-semibold">What happened</h2><p className="mt-1 text-sm text-muted-foreground">Error code: {connection.errorCode ?? "upstream"}. No token or secret is exposed here.</p></Card><Card className="p-5"><Database className="size-5 text-brand-600" /><h2 className="mt-2 font-semibold">Your existing data</h2><p className="mt-1 text-sm text-muted-foreground">Previously imported measurements remain available while you reconnect.</p></Card></div><Button className="mt-6 w-full" onClick={() => navigate(`connect/${entry.id}`)}>Reconnect {entry.name}</Button></div>;
}
