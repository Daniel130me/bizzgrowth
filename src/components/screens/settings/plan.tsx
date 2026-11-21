"use client";
// Screen 88 — Plan / Subscription (presentation is illustrative).

import { CreditCard, FileText, Rocket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageHeader, SectionCard } from "@/components/shared/layout";
import { InfoBanner } from "@/components/shared/layout";
import { useBizz, useConnectionsFor } from "@/lib/store";

interface UsageRow {
  label: string;
  used: number;
  limit: number;
  unit?: string;
  caption: string;
}

export function PlanSettings() {
  const navigate = useBizz((s) => s.navigate);
  const plan = useBizz((s) => s.settings.plan);
  const businessId = useBizz((s) => s.businessId);
  const connections = useConnectionsFor(businessId);

  // Connected external sources (manual entry is not counted against integration limits).
  const connectedSources = Object.entries(connections).filter(
    ([id, status]) => status === "connected" && id !== "manual" && id !== "csv",
  ).length;

  const usage: UsageRow[] = [
    { label: "Workspaces", used: 1, limit: 1, caption: "One workspace per account during beta." },
    { label: "Connected sources", used: connectedSources, limit: 3, caption: "Meta Ads and Google Ads count; manual entry does not." },
    { label: "Team members", used: 5, limit: 5, caption: "Includes pending invitations." },
    { label: "Data history", used: 8, limit: 12, unit: "months", caption: "Diagnoses use the available history window." },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="Plan & Subscription"
        description="Your current plan, usage against its limits, and what paid plans add."
      />

      <SectionCard title="Current plan">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">{plan}</h2>
              <Badge variant="outline" className="bg-brand-50 font-normal text-brand-700 border-brand-200">
                Full platform access
              </Badge>
            </div>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              {plan === "Private Beta"
                ? "You are on the Private Beta plan. Every feature is unlocked and no payment is due. Pricing shown on the upgrade page is indicative for the prototype."
                : `Your workspace is on the ${plan} plan. Billing details and invoices are illustrative in this prototype.`}
            </p>
          </div>
          <Button onClick={() => navigate("upgrade")}>
            <Rocket className="mr-1.5 size-4" aria-hidden />
            {plan === "Private Beta" ? "Upgrade" : "Compare plans"}
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="Usage & limits" description="Where this workspace stands against its plan limits.">
        <ul className="space-y-4">
          {usage.map((u) => {
            const pct = Math.min(100, Math.round((u.used / u.limit) * 100));
            const atLimit = u.used >= u.limit;
            return (
              <li key={u.label}>
                <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">{u.label}</span>
                  <span className={"text-sm tnum " + (atLimit ? "font-medium text-amber-700" : "text-muted-foreground")}>
                    {u.used} of {u.limit}
                    {u.unit ? ` ${u.unit}` : ""}
                  </span>
                </div>
                <Progress value={pct} aria-label={`${u.label}: ${u.used} of ${u.limit}`} className="h-2" />
                <p className="mt-1 text-xs text-muted-foreground">{u.caption}</p>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-muted-foreground">
          Reaching a limit never deletes data. We will show a clear upgrade prompt instead, and everything already
          recorded stays safe.
        </p>
      </SectionCard>

      <SectionCard title="What paid plans add" description="Illustrative capabilities for the prototype.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border p-4">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-semibold">Growth</h3>
              <p className="text-sm tnum">
                <span className="text-muted-foreground line-through decoration-slate-300">₦45,000</span>{" "}
                <span className="font-semibold">₦38,250</span>
                <span className="text-xs text-muted-foreground">/mo annual</span>
              </p>
            </div>
            <ul className="mt-2.5 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
              <li>3 workspaces, 10 connected sources</li>
              <li>12-month data history</li>
              <li>Weekly brief + monthly review</li>
              <li>Unlimited actions and experiments</li>
              <li>Priority email support</li>
            </ul>
          </div>
          <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-4">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-semibold">Team</h3>
              <p className="text-sm tnum">
                <span className="text-muted-foreground line-through decoration-slate-300">₦120,000</span>{" "}
                <span className="font-semibold">₦102,000</span>
                <span className="text-xs text-muted-foreground">/mo annual</span>
              </p>
            </div>
            <ul className="mt-2.5 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
              <li>Everything in Growth</li>
              <li>10 workspaces, 25 team members</li>
              <li>Roles &amp; permissions matrix</li>
              <li>Shared action approvals (after beta)</li>
              <li>Dedicated onboarding session</li>
            </ul>
          </div>
        </div>
      </SectionCard>

      <InfoBanner tone="info">
        Pricing is indicative for this prototype — no real charges or plan changes occur.
      </InfoBanner>

      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={() => navigate("payment-method")}>
          <CreditCard className="mr-1.5 size-4" aria-hidden /> Manage payment method
        </Button>
        <Button variant="outline" onClick={() => navigate("invoices")}>
          <FileText className="mr-1.5 size-4" aria-hidden /> View invoices
        </Button>
      </div>
    </div>
  );
}
