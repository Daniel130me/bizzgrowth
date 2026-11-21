"use client";
// Screen 111 — Integration / Sync Health: every connection, its state and failure detail.

import { useMemo, useState } from "react";
import { BellRing, PlugZap } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminBadge } from "./parts";
import { InfoBanner, PageHeader, SectionCard } from "@/components/shared/layout";
import { EmptyState } from "@/components/shared/states";
import { SYNC_HEALTH } from "@/lib/data/admin";
import { toast } from "sonner";
import { useBizz } from "@/lib/store";
import type { ScreenProps } from "../view-types";
import type { SyncHealthRow } from "@/lib/types";

type TabId = "all" | "healthy" | "delayed" | "failed";

function suggestedFix(row: SyncHealthRow): string {
  if (row.status === "healthy") return "No action needed — the connector is syncing normally.";
  if (row.source.startsWith("Paystack")) return "No action needed — this source resumes automatically once the upstream Shopify connection recovers.";
  if (row.source === "Shopify" && row.status === "delayed") return "No action needed — the connector is retrying with exponential backoff after rate limiting. Check again after the next sync window.";
  if (row.business === "Zenith Fitness Studio") return "Restore workspace billing first — the connection was revoked when the workspace was suspended. Then send the owner a reconnect link from Businesses → Zenith Fitness Studio.";
  if (row.status === "failed") return `Ask the workspace owner to reconnect ${row.source} from Settings → Data sources. Authorization must be renewed before the next sync window.`;
  return "Monitor for the next sync window. Escalate to engineering if the delay exceeds two hours.";
}

export function SyncHealth(_props: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);
  const [tab, setTab] = useState<TabId>("all");
  const [selected, setSelected] = useState<SyncHealthRow | null>(null);

  const counts = useMemo(
    () => ({
      all: SYNC_HEALTH.length,
      healthy: SYNC_HEALTH.filter((r) => r.status === "healthy").length,
      delayed: SYNC_HEALTH.filter((r) => r.status === "delayed").length,
      failed: SYNC_HEALTH.filter((r) => r.status === "failed").length,
    }),
    []
  );

  const rows = useMemo(() => (tab === "all" ? SYNC_HEALTH : SYNC_HEALTH.filter((r) => r.status === tab)), [tab]);

  const notify = (row: SyncHealthRow) =>
    toast("Simulated: notification sent", {
      description: `The ${row.business} workspace owner would be told that ${row.source} is ${row.status} and how to reconnect it.`,
    });

  return (
    <div>
      <PageHeader
        title="Sync health"
        description="Operational state of every customer data connection. Failed connections block fresh data and eventually block diagnosis."
      />

      <InfoBanner tone={counts.failed > 0 ? "warning" : "success"}>
        {counts.failed > 0 ? (
          <>
            {counts.failed} connection{counts.failed > 1 ? "s" : ""} {counts.failed > 1 ? "are" : "is"} failing right now. KoraHome Store has been out of sync since Sep 30, 14:03 — its owner has been alerted and a support case is open.
          </>
        ) : (
          "All connections are syncing normally."
        )}
      </InfoBanner>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)} className="mt-5">
        <TabsList className="h-auto w-full flex-wrap justify-start sm:w-fit">
          {(["all", "healthy", "delayed", "failed"] as TabId[]).map((t) => (
            <TabsTrigger key={t} value={t} className="flex-none px-3 capitalize">
              {t === "all" ? "All" : t}
              <span className="ml-1.5 rounded-full bg-slate-200/70 px-1.5 text-[11px] font-medium tnum text-slate-600">{counts[t]}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <p className="mt-3 text-xs text-muted-foreground" aria-live="polite">
        {rows.length} connection{rows.length === 1 ? "" : "s"} in this view
      </p>

      <SectionCard className="mt-3" contentClassName="p-0">
        {rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<PlugZap className="size-5" />}
              title="Nothing in this state"
              description="No connections currently match this filter. Switch tabs to see the rest of the fleet."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Source</TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead>Last sync</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Failures</TableHead>
                  <TableHead>Last error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={`${row.business}-${row.source}`}
                    tabIndex={0}
                    role="link"
                    aria-label={`Open sync detail for ${row.source} — ${row.business}`}
                    onClick={() => setSelected(row)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelected(row);
                      }
                    }}
                    className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600"
                  >
                    <TableCell className="font-medium">{row.source}</TableCell>
                    <TableCell>{row.business}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{row.lastSync}</TableCell>
                    <TableCell>
                      <AdminBadge status={row.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className={row.failures > 0 ? "font-semibold text-red-600" : "text-muted-foreground"}>{row.failures}</span>
                    </TableCell>
                    <TableCell className="max-w-64">
                      {row.lastError ? (
                        <span className="block truncate text-xs text-muted-foreground" title={row.lastError}>
                          {row.lastError}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="sm:max-w-xl">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  {selected.source} — {selected.business}
                  <AdminBadge status={selected.status} />
                </DialogTitle>
                <DialogDescription>
                  Last sync {selected.lastSync} · {selected.failures} recorded failure{selected.failures === 1 ? "" : "s"}.
                </DialogDescription>
              </DialogHeader>

              {selected.lastError ? (
                <div>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Last error</p>
                  <pre className="whitespace-pre-wrap rounded-lg border bg-slate-950 p-3 font-mono text-xs leading-relaxed text-slate-100">
                    {selected.lastError}
                  </pre>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No errors recorded for this connection.</p>
              )}

              <div className="rounded-lg border border-brand-200 bg-brand-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Suggested fix</p>
                <p className="mt-1 text-sm text-brand-900">{suggestedFix(selected)}</p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                <button
                  onClick={() => {
                    setSelected(null);
                    navigate("admin/businesses");
                  }}
                  className="text-sm font-medium text-brand-600 underline-offset-2 hover:underline"
                >
                  Open business admin detail
                </button>
                <button
                  onClick={() => notify(selected)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                >
                  <BellRing className="size-3.5" aria-hidden /> Notify business
                </button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
