"use client";
// Screen 110 — Subscriptions & Payments Admin: MRR, billing states and payment issues.

import { useMemo } from "react";
import { BellRing, CreditCard, TriangleAlert } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminBadge } from "./parts";
import { PageHeader, SectionCard } from "@/components/shared/layout";
import { ADMIN_SUBSCRIPTIONS } from "@/lib/data/admin";
import { useBizz } from "@/lib/store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ScreenProps } from "../view-types";

function SummaryCard({ label, value, subnote, tone }: { label: string; value: string; subnote: string; tone: "neutral" | "warn" | "info" }) {
  return (
    <div className="flex flex-col rounded-xl border bg-white p-4 shadow-sm">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span
        className={cn(
          "mt-1 text-2xl font-bold tracking-tight",
          tone === "warn" ? "text-amber-600" : tone === "info" ? "text-brand-600" : "text-slate-900"
        )}
      >
        {value}
      </span>
      <span className="mt-1 text-xs text-muted-foreground">{subnote}</span>
    </div>
  );
}

export function SubscriptionsAdmin(_props: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);

  const stats = useMemo(() => {
    const pastDue = ADMIN_SUBSCRIPTIONS.filter((s) => s.state === "past-due").length;
    const trialing = ADMIN_SUBSCRIPTIONS.filter((s) => s.state === "trialing").length;
    const activePaid = ADMIN_SUBSCRIPTIONS.filter((s) => s.state === "active");
    const mrrLabel = activePaid.reduce((sum, s) => sum + Number(s.mrr.replace(/[^0-9]/g, "")), 0);
    return { pastDue, trialing, mrr: `₦${mrrLabel.toLocaleString("en-NG")}` };
  }, []);

  const remind = (business: string, state: string) =>
    toast("Simulated: send payment reminder", {
      description:
        state === "past-due"
          ? `${business} would receive an overdue payment notice with a retry link for the failed charge.`
          : `${business} would receive a routine billing summary for their current plan.`,
    });

  return (
    <div>
      <PageHeader
        title="Subscriptions & payments"
        description="Billing state for every paying or trialing workspace. Beta workspaces are listed for completeness but generate no revenue."
      />

      <section aria-label="Billing summary" className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Total MRR" value={stats.mrr} subnote="From paid plans only (beta excluded)" tone="neutral" />
        <SummaryCard label="Past due" value={String(stats.pastDue)} subnote="1 workspace has 2 failed payments" tone="warn" />
        <SummaryCard label="Trialing" value={String(stats.trialing)} subnote="Trial ends Oct 18, 2026" tone="info" />
      </section>

      <SectionCard
        title="All subscriptions"
        description="One row per billing relationship."
        className="mt-6"
        contentClassName="p-0"
        action={
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CreditCard className="size-3.5" aria-hidden /> Payments processed by Paystack (prototype)
          </div>
        }
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Business</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Billing state</TableHead>
                <TableHead>Last payment</TableHead>
                <TableHead>Next renewal</TableHead>
                <TableHead>Failed payments</TableHead>
                <TableHead className="text-right">MRR</TableHead>
                <TableHead className="w-36 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ADMIN_SUBSCRIPTIONS.map((s) => (
                <TableRow key={s.business} className="hover:bg-slate-50/60">
                  <TableCell className="font-medium">{s.business}</TableCell>
                  <TableCell className="text-muted-foreground">{s.plan}</TableCell>
                  <TableCell>
                    <AdminBadge status={s.state} />
                  </TableCell>
                  <TableCell className="max-w-56 truncate text-muted-foreground">{s.lastPayment}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{s.nextRenewal}</TableCell>
                  <TableCell>
                    {s.failedPayments > 0 ? (
                      <span className="inline-flex items-center gap-1 text-sm font-semibold tabular-nums text-red-600">
                        <TriangleAlert className="size-3.5" aria-hidden /> {s.failedPayments}
                      </span>
                    ) : (
                      <span className="tabular-nums text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{s.mrr}</TableCell>
                  <TableCell className="text-right">
                    <button
                      onClick={() => remind(s.business, s.state)}
                      aria-label={`Send payment reminder to ${s.business}`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border bg-white px-2.5 text-xs font-medium shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                    >
                      <BellRing className="size-3.5" aria-hidden /> Send reminder
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SectionCard>

      <p className="mt-4 text-xs text-muted-foreground">
        Need the customer view of billing? Open{" "}
        <button onClick={() => navigate("admin/businesses")} className="font-medium text-brand-600 underline-offset-2 hover:underline">
          Businesses
        </button>{" "}
        and select the workspace to see plan, status and usage together.
      </p>
    </div>
  );
}
