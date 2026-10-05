"use client";
// Screen 91 — Invoices / Billing History (mock data; illustrative during beta).

import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs, PageHeader, SectionCard } from "@/components/shared/layout";
import { useBizz } from "@/lib/store";

const INVOICES = [
  { id: "INV-2026-0007", date: "1 Sept 2026", amount: "₦45,000", plan: "Growth", status: "Paid" },
  { id: "INV-2026-0006", date: "1 Aug 2026", amount: "₦45,000", plan: "Growth", status: "Paid" },
  { id: "INV-2026-0005", date: "1 Jul 2026", amount: "₦45,000", plan: "Growth", status: "Paid" },
];

export function Invoices() {
  const navigate = useBizz((s) => s.navigate);
  const plan = useBizz((s) => s.settings.plan);

  const download = (id: string) =>
    toast.success("Invoice download simulated", { description: `${id}.pdf would download in the full product.` });

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Breadcrumbs items={[{ label: "Plan & Subscription", onClick: () => navigate("settings/plan") }, { label: "Billing history" }]} />
      <PageHeader
        title="Billing History"
        description="Past invoices for this workspace. Amounts and statuses are illustrative."
      />

      <SectionCard title="Invoices" contentClassName="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="hidden sm:table-cell">Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Download</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {INVOICES.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="text-sm font-medium tnum">{inv.id}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{inv.date}</TableCell>
                  <TableCell className="text-right text-sm tnum">{inv.amount}</TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">{inv.plan}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-emerald-50 font-normal text-emerald-700 border-emerald-200">
                      {inv.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={`Download ${inv.id}`}
                      onClick={() => download(inv.id)}
                    >
                      <Download className="size-4" aria-hidden />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="border-t px-5 py-3 text-xs text-muted-foreground">
          These invoices are illustrative. Your workspace is on the {plan} plan, so no real charges have been made —
          paid-plan invoices will appear here in the same format after beta.
        </p>
      </SectionCard>

      <p className="text-xs text-muted-foreground">
        Questions about a charge? Send us a note via <Button variant="link" className="h-auto p-0 text-xs" onClick={() => navigate("feedback")}>Send feedback</Button> and the billing team will follow up.
      </p>
    </div>
  );
}
