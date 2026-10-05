"use client";
// Screen 37 — Alert Detail: what happened, why it matters, what to do,
// evidence, historical context, related diagnosis and the response actions.

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SeverityBadge, StatusBadge } from "@/components/shared/badges";
import { EvidencePanel } from "@/components/shared/evidence";
import { IntelligenceDetail, SectionCard } from "@/components/shared/layout";
import { ErrorState } from "@/components/shared/states";
import { TrendLineChart } from "@/components/shared/charts";
import { CHART_COLORS } from "@/lib/chart-colors";
import { getBusiness, type UserWorkspaceMeta, type WorkspaceId } from "@/lib/data/businesses";
import { alertById, insightById } from "@/lib/data/intelligence";
import { fmtNaira } from "@/lib/format";
import { useBizz } from "@/lib/store";
import type { AlertItem } from "@/lib/types";
import type { ScreenProps } from "../view-types";
import { BackLink, evidenceWithFacts, metricSlugFor, severityAccent } from "./parts";

const SEVERITY_EYEBROW: Record<AlertItem["severity"], string> = {
  critical: "Critical alert",
  warning: "Warning",
  opportunity: "Opportunity alert",
  info: "Information",
};

/** Three labelled blocks — styled by severity, never colour alone (icon + label). */
function SeverityBlocks({ alert }: { alert: AlertItem }) {
  const a = severityAccent(alert.severity);
  const rows = [
    { label: "What happened", text: alert.whatHappened },
    { label: "Why it matters", text: alert.whyItMatters },
    { label: "What to do", text: alert.whatToDo },
  ];
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.label} className={`rounded-xl border border-slate-200 border-l-4 p-4 ${a.border} ${a.bg}`}>
          <h3 className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${a.label}`}>
            {a.icon}
            {r.label}
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed">{r.text}</p>
        </div>
      ))}
    </div>
  );
}

/** Historical context — only rendered when the alert metric maps to a monthly series. */
function AlertHistory({ alert, businessId, userWorkspace }: { alert: AlertItem; businessId: WorkspaceId; userWorkspace: UserWorkspaceMeta | null }) {
  const business = getBusiness(businessId, userWorkspace);
  const metric = (alert.metric ?? "").toLowerCase();

  const isCac = metric.includes("blended cac") || metric.includes("cost per customer");
  const isCheckout = metric.includes("mobile checkout") || metric.includes("payment failure");

  let rows: Record<string, string | number>[] | null = null;
  let series: { key: string; label: string; color: string }[] = [];
  let caption = "";
  let formatter: ((v: number) => string) | undefined;

  if (isCac) {
    // Blended CAC per month = marketing spend ÷ new customers (service workspace).
    const computed = business.monthly.map((m) => ({
      label: m.label,
      cac: m.customers > 0 ? Math.round(m.spend / m.customers) : 0,
    }));
    if (computed.some((r) => r.cac > 0)) {
      rows = computed;
      series = [{ key: "cac", label: "Blended CAC", color: CHART_COLORS.blue }];
      formatter = (v) => fmtNaira(v, { compact: true });
      caption = "Blended CAC = marketing spend ÷ new customers, by month.";
    }
  } else if (isCheckout) {
    // Checkout completion by device, from connected website analytics.
    const w = business.website;
    if (w.connected && w.mobileCheckout && w.desktopCheckout) {
      rows = [
        { label: "Aug", mobile: w.mobileCheckout.previous, desktop: w.desktopCheckout.previous },
        { label: "Sep", mobile: w.mobileCheckout.current, desktop: w.desktopCheckout.current },
      ];
      series = [
        { key: "mobile", label: "Mobile", color: CHART_COLORS.blue },
        { key: "desktop", label: "Desktop", color: CHART_COLORS.slate },
      ];
      formatter = (v) => `${v}%`;
      caption =
        metric.includes("payment failure")
          ? "Checkout completion by device — the metric payment failures affect most directly. Absolute failure counts per month are not recorded yet."
          : "Checkout completion by device, from website analytics.";
    }
  }

  return (
    <SectionCard title="Historical context" description="How the affected metric moved before this alert.">
      {rows && rows.length > 0 ? (
        <>
          <TrendLineChart data={rows} xKey="label" series={series} valueFormatter={formatter} height={200} />
          <p className="mt-3 text-xs text-muted-foreground">{caption}</p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          No monthly history is recorded for this metric yet. The evidence above reflects the latest available values —
          connecting the underlying source would add month-by-month context here.
        </p>
      )}
    </SectionCard>
  );
}

export function AlertDetail({ params }: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);
  const businessId = useBizz((s) => s.businessId);
  const userWorkspace = useBizz((s) => s.userWorkspace);

  const alert = alertById(params.id);
  // Local status overrides, keyed by alert id — resolving/dismissing is session-local.
  const [statusOverrides, setStatusOverrides] = useState<Record<string, AlertItem["status"]>>({});
  const status: AlertItem["status"] = statusOverrides[params.id] ?? alert?.status ?? "open";

  if (!alert) {
    return (
      <div className="mx-auto max-w-2xl py-10">
        <BackLink label="Back to alerts" onClick={() => navigate("alerts")} />
        <ErrorState
          title="Alert not found"
          description="This alert is not available. It may belong to another workspace or has been cleared from the list."
          onRetry={() => navigate("alerts")}
          onHome={() => navigate("home")}
        />
      </div>
    );
  }

  const accent = severityAccent(alert.severity);
  const evidence = evidenceWithFacts(alert.businessId, alert.evidence);
  const related = alert.relatedDiagnosisId ? insightById(alert.relatedDiagnosisId) : undefined;

  const setAlertStatus = (next: AlertItem["status"]) => setStatusOverrides((prev) => ({ ...prev, [params.id]: next }));

  const resolve = () => {
    setAlertStatus("resolved");
    toast.success("Alert resolved", {
      description: "It moves to the Resolved filter. Closing the loop keeps the alert list meaningful.",
    });
  };
  const dismiss = () => {
    setAlertStatus("dismissed");
    toast("Alert dismissed", {
      description: "Dismissed alerts stay available in this session and can be reopened from this page.",
    });
  };
  const reopen = () => {
    setAlertStatus("open");
    toast("Alert reopened", { description: "It stays active until you resolve or dismiss it." });
  };
  const investigate = () => {
    if (alert.relatedDiagnosisId) {
      navigate(`insights/${alert.relatedDiagnosisId}`);
      return;
    }
    const slug = metricSlugFor(alert.metric);
    if (slug) {
      navigate(`metric/${slug}`);
      return;
    }
    toast.info("Nothing to investigate yet", {
      description: "This alert has no related diagnosis or drill-down metric. Adding more data would unlock deeper analysis.",
    });
  };

  return (
    <div>
      <BackLink label="Back to alerts" onClick={() => navigate("alerts")} />

      <IntelligenceDetail
        eyebrow={SEVERITY_EYEBROW[alert.severity]}
        eyebrowClass={accent.label}
        title={alert.title}
        meta={
          <>
            <SeverityBadge severity={alert.severity} />
            <StatusBadge status={status} />
            <span className="text-sm text-muted-foreground">{alert.time}</span>
            {alert.metric ? (
              <Badge variant="outline" className="font-normal text-slate-600">
                Affected: {alert.metric}
              </Badge>
            ) : null}
          </>
        }
      >
        {/* What happened / Why it matters / What to do */}
        <SeverityBlocks alert={alert} />

        {/* Evidence */}
        <SectionCard
          title="Evidence"
          description="The records behind this alert. Select a linked source to open its provenance record."
        >
          <EvidencePanel
            items={evidence}
            onOpenFact={(factId) => {
              if (factId) navigate(`provenance/${factId}`);
            }}
          />
        </SectionCard>

        {/* Historical context — anchored to the alert's own workspace data */}
        <AlertHistory alert={alert} businessId={alert.businessId as WorkspaceId} userWorkspace={userWorkspace} />

        {/* Related diagnosis */}
        {related && (
          <SectionCard title="Related diagnosis" description="The system linked this alert to a fuller analysis.">
            <button
              type="button"
              onClick={() => navigate(`insights/${alert.relatedDiagnosisId}`)}
              className="flex w-full items-start justify-between gap-3 rounded-xl border p-4 text-left transition-colors hover:border-violet-300 hover:bg-violet-50/40"
            >
              <span>
                <span className="block text-sm font-semibold">{related.title}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{related.summary}</span>
              </span>
              <ArrowRight className="mt-1 size-4 shrink-0 text-violet-600" aria-hidden />
            </button>
          </SectionCard>
        )}

        {/* Recommended response + actions */}
        <SectionCard
          title="Recommended response"
          className="border-violet-200 bg-violet-50/40"
        >
          <p className="text-[15px] leading-relaxed">{alert.whatToDo}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {status === "resolved" ? (
              <Button size="sm" variant="outline" onClick={reopen}>
                Reopen alert
              </Button>
            ) : (
              <Button size="sm" onClick={resolve}>
                Resolve
              </Button>
            )}
            {status === "dismissed" ? (
              <Button size="sm" variant="outline" onClick={reopen}>
                Reopen alert
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={dismiss}>
                Dismiss
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={investigate}>
              Investigate <ArrowRight className="size-3.5" aria-hidden />
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Resolving or dismissing is kept for this session only in the prototype.
          </p>
        </SectionCard>
      </IntelligenceDetail>
    </div>
  );
}
