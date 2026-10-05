"use client";
// Screen 36 — Alerts Centre: important business events, grouped by severity.

import { useMemo, useState } from "react";
import { Bell } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { AlertCard } from "@/components/shared/cards";
import { StatusBadge } from "@/components/shared/badges";
import { InfoBanner, PageHeader } from "@/components/shared/layout";
import { EmptyState } from "@/components/shared/states";
import { alertsFor } from "@/lib/data/intelligence";
import { useBizz } from "@/lib/store";
import type { ScreenProps } from "../view-types";
import { BackLink } from "./parts";

type TabId = "critical" | "warning" | "opportunity" | "info" | "resolved";

const TABS: { id: TabId; label: string }[] = [
  { id: "critical", label: "Critical" },
  { id: "warning", label: "Warning" },
  { id: "opportunity", label: "Opportunity" },
  { id: "info", label: "Information" },
  { id: "resolved", label: "Resolved" },
];

const EMPTY_COPY: Record<TabId, { title: string; description: string }> = {
  critical: { title: "No critical alerts", description: "Critical events — like a broken data connection — would appear here. Nothing needs immediate attention." },
  warning: { title: "No warnings", description: "Warnings flag movements worth reviewing soon. None are open in the current period." },
  opportunity: { title: "No open opportunities", description: "When the system spots a favourable change worth acting on, it will appear here." },
  info: { title: "No information alerts", description: "Routine events — completed imports, finished measurements — would appear here." },
  resolved: { title: "No resolved alerts yet", description: "Resolving alerts keeps the list focused on what still needs action. Resolved events will be kept here for reference." },
};

export function AlertsCentre(_props: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);
  const businessId = useBizz((s) => s.businessId);
  const [tab, setTab] = useState<TabId>("critical");

  const all = useMemo(() => alertsFor(businessId), [businessId]);
  const counts = useMemo(
    () => ({
      critical: all.filter((a) => a.severity === "critical").length,
      warning: all.filter((a) => a.severity === "warning").length,
      opportunity: all.filter((a) => a.severity === "opportunity").length,
      info: all.filter((a) => a.severity === "info").length,
      resolved: all.filter((a) => a.status === "resolved").length,
    }),
    [all]
  );

  const filtered = useMemo(
    () => (tab === "resolved" ? all.filter((a) => a.status === "resolved") : all.filter((a) => a.severity === tab)),
    [all, tab]
  );

  return (
    <div>
      <BackLink label="Back to home" onClick={() => navigate("home")} />
      <PageHeader
        title="Alerts"
        description="Important business events from your data, integrations and measurements — each one explains what happened, why it matters and what to do."
      />

      <InfoBanner tone="info">
        Alerts are meaningful business events. Notifications tell you about them — alerts are where you act.
      </InfoBanner>

      {all.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<Bell className="size-5" />}
            title="No alerts yet"
            description="Alerts appear when something meaningful changes in your connected data — a sync failure, an unusual movement in a metric, or a measurement completing. Connect a source or enter totals to start monitoring."
            actions={
              <>
                <Button size="sm" onClick={() => navigate("integrations")}>
                  Connect data
                </Button>
                <Button size="sm" variant="outline" onClick={() => navigate("manual-entry")}>
                  Enter manually
                </Button>
              </>
            }
          />
        </div>
      ) : (
        <>
          <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)} className="mt-5">
            <TabsList className="h-auto w-full flex-wrap justify-start sm:w-fit">
              {TABS.map((t) => (
                <TabsTrigger key={t.id} value={t.id} className="flex-none px-3">
                  {t.label}
                  <span className="ml-1.5 rounded-full bg-slate-200/70 px-1.5 text-[11px] font-medium tnum text-slate-600">
                    {counts[t.id]}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <p className="mt-3 text-xs text-muted-foreground" aria-live="polite">
            {filtered.length} {filtered.length === 1 ? "alert" : "alerts"} in this view
          </p>

          {filtered.length === 0 ? (
            <div className="mt-4">
              <EmptyState title={EMPTY_COPY[tab].title} description={EMPTY_COPY[tab].description} />
            </div>
          ) : (
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {filtered.map((alert) => (
                <div key={alert.id}>
                  {alert.status !== "open" && (
                    <div className="mb-1 flex justify-end">
                      <StatusBadge status={alert.status} />
                    </div>
                  )}
                  <AlertCard alert={alert} onOpen={() => navigate(`alerts/${alert.id}`)} />
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
