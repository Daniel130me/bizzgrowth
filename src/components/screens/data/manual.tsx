"use client";
// Screens 57–58 — Manual Data Entry + Manual Data History.

import { useState } from "react";
import { Eye, FileSpreadsheet, PenLine, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/states";
import { InfoBanner, PageHeader, SectionCard } from "@/components/shared/layout";
import { ProvenanceBadge } from "@/components/shared/badges";
import { useBizz } from "@/lib/store";
import { getBusiness } from "@/lib/data/businesses";
import { MANUAL_ENTRIES } from "@/lib/data/operations";
import type { ManualEntry } from "@/lib/types";
import type { ViewMap } from "../view-types";

const PERIODS = ["September 2026", "August 2026", "July 2026"];

interface FieldDef {
  id: string;
  label: string;
  prefix?: string;
}

const FIELDS = {
  service: [
    { id: "spend", label: "Marketing spend", prefix: "₦" },
    { id: "enquiries", label: "Enquiries" },
    { id: "customers", label: "Customers" },
    { id: "revenue", label: "Revenue", prefix: "₦" },
  ] as FieldDef[],
  ecommerce: [
    { id: "traffic", label: "Traffic (visitors)" },
    { id: "orders", label: "Orders" },
    { id: "revenue", label: "Revenue", prefix: "₦" },
    { id: "spend", label: "Marketing spend", prefix: "₦" },
  ] as FieldDef[],
};

const SEPTEMBER_PREFILL: Record<BusinessTypeKey, Record<string, string>> = {
  service: { spend: "370000", enquiries: "277", customers: "49", revenue: "6000000" },
  ecommerce: { traffic: "18430", orders: "740", revenue: "6200000", spend: "530000" },
};

type BusinessTypeKey = "service" | "ecommerce";
type Precision = "exact" | "approximate" | "range";

// ---------- Screen 57 — Manual Data Entry ----------

function ManualEntryScreen() {
  const businessId = useBizz((s) => s.businessId);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const navigate = useBizz((s) => s.navigate);
  const business = getBusiness(businessId, userWorkspace);

  const type: BusinessTypeKey = business.type;
  const fields = FIELDS[type];

  const [period, setPeriod] = useState(PERIODS[0]);
  const [values, setValues] = useState<Record<string, string>>(SEPTEMBER_PREFILL[type]);
  const [precisions, setPrecisions] = useState<Record<string, Precision>>(
    Object.fromEntries(fields.map((f) => [f.id, "exact" as Precision]))
  );

  function switchPeriod(p: string) {
    setPeriod(p);
    if (p === PERIODS[0]) {
      setValues(SEPTEMBER_PREFILL[type]);
      setPrecisions(Object.fromEntries(fields.map((f) => [f.id, "exact" as Precision])));
    } else {
      setValues({});
      setPrecisions(Object.fromEntries(fields.map((f) => [f.id, "exact" as Precision])));
    }
  }

  function save() {
    const filled = fields.filter((f) => (values[f.id] ?? "").trim().length > 0);
    if (filled.length === 0) {
      toast.error("Enter at least one value", { description: "Partial months are fine — leave fields you don't know blank." });
      return;
    }
    const approximate = filled.filter((f) => (precisions[f.id] ?? "exact") !== "exact").length;
    toast.success(`${period} totals recorded — diagnosis updated`, {
      description:
        approximate > 0
          ? `${approximate} value${approximate > 1 ? "s" : ""} labelled as approximate and marked in analysis.`
          : "Values are labelled User supplied in analysis.",
    });
    navigate("manual-history");
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="Enter monthly totals"
        description="Aggregate totals only — no customer-level data needed. Values appear in analysis labelled as user supplied."
        back={
          <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => navigate("manual-history")}>
            Back to manual entries
          </Button>
        }
      />

      <InfoBanner tone="info" title="Estimates are fine — they're labelled in analysis.">
        Enter what you know. Exact, approximate or range — each value keeps its own precision label so analysis stays honest.
      </InfoBanner>

      <div className="mt-5 space-y-5">
        <SectionCard title="Period">
          <div className="w-full sm:w-64">
            <Label htmlFor="entry-period">Month</Label>
            <Select value={period} onValueChange={switchPeriod}>
              <SelectTrigger id="entry-period" aria-label="Period" className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </SectionCard>

        <SectionCard title={business.type === "service" ? "Service totals" : "Ecommerce totals"} description={`For ${business.name}.`}>
          <div className="grid gap-5 sm:grid-cols-2">
            {fields.map((f) => {
              const value = values[f.id] ?? "";
              return (
                <div key={f.id}>
                  <Label htmlFor={`field-${f.id}`}>{f.label}</Label>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="relative flex-1">
                      {f.prefix ? (
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground" aria-hidden>
                          {f.prefix}
                        </span>
                      ) : null}
                      <Input
                        id={`field-${f.id}`}
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={value}
                        onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))}
                        className={f.prefix ? "pl-7" : ""}
                        placeholder="—"
                      />
                    </div>
                  </div>
                  {value.trim().length > 0 ? (
                    <div className="mt-2 flex items-center gap-2">
                      <Label htmlFor={`precision-${f.id}`} className="text-xs text-muted-foreground">
                        Precision
                      </Label>
                      <Select
                        value={precisions[f.id] ?? "exact"}
                        onValueChange={(p) => setPrecisions((pr) => ({ ...pr, [f.id]: p as Precision }))}
                      >
                        <SelectTrigger id={`precision-${f.id}`} size="sm" className="h-8 w-36" aria-label={`Precision for ${f.label}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="exact">Exact</SelectItem>
                          <SelectItem value="approximate">Approximate</SelectItem>
                          <SelectItem value="range">Range</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            {period === PERIODS[0]
              ? "September values are prefilled from your last submission — adjust if needed."
              : `No values recorded yet for ${period}.`}
          </p>
        </SectionCard>
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Button onClick={save} className="flex-1">
          Save {period} totals
        </Button>
        <Button variant="ghost" className="flex-1" onClick={() => navigate("manual-history")}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ---------- Screen 58 — Manual Data History ----------

function metricsJoined(entry: ManualEntry): string {
  return entry.metrics.map((m) => `${m.label} ${m.value}`).join(" · ");
}

function EntryStatusBadge({ status }: { status: ManualEntry["status"] }) {
  return status === "verified" ? (
    <Badge variant="outline" className="gap-1 border-emerald-200 bg-emerald-50 font-normal text-emerald-700">
      Verified
    </Badge>
  ) : (
    <Badge variant="outline" className="gap-1 border-amber-200 bg-amber-50 font-normal text-amber-700">
      Unverified
    </Badge>
  );
}

function ManualHistoryScreen() {
  const businessId = useBizz((s) => s.businessId);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const navigate = useBizz((s) => s.navigate);
  const business = getBusiness(businessId, userWorkspace);

  const [entries, setEntries] = useState<ManualEntry[]>(() => MANUAL_ENTRIES.filter((e) => e.businessId === businessId));

  function removeEntry(id: string) {
    setEntries((list) => list.filter((e) => e.id !== id));
    const entry = entries.find((e) => e.id === id);
    toast.success("Entry deleted", { description: `${entry?.period ?? "Entry"} removed from manual records.` });
  }

  function editEntry(entry: ManualEntry) {
    toast("Opening editor", { description: `Update the values for ${entry.period}.` });
    navigate("manual-entry");
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="Manual entries"
        description="Totals entered by your team. Values are labelled User supplied in analysis and count toward data coverage."
        back={
          <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => navigate("data")}>
            Back to Data Centre
          </Button>
        }
        actions={
          <>
            <Button size="sm" onClick={() => navigate("manual-entry")}>
              <Plus className="mr-1.5 size-4" aria-hidden /> Add entry
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("csv-upload")}>
              <FileSpreadsheet className="mr-1.5 size-4" aria-hidden /> Upload CSV
            </Button>
          </>
        }
      />

      {entries.length === 0 ? (
        <EmptyState
          icon={<PenLine className="size-5" />}
          title={`No manual entries for ${business.name} yet`}
          description="Enter monthly totals to unlock a Level-2 baseline diagnosis with zero connections — spend, enquiries, customers and revenue (or traffic and orders for ecommerce)."
          actions={
            <>
              <Button size="sm" onClick={() => navigate("manual-entry")}>
                <Plus className="mr-1.5 size-4" aria-hidden /> Add first entry
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate("csv-upload")}>
                <FileSpreadsheet className="mr-1.5 size-4" aria-hidden /> Upload CSV instead
              </Button>
            </>
          }
        />
      ) : (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead className="min-w-72">Metrics</TableHead>
                  <TableHead>Updated by</TableHead>
                  <TableHead>Last modified</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap font-medium">{entry.period}</TableCell>
                    <TableCell className="max-w-md text-muted-foreground">
                      <span className="line-clamp-2 text-sm">{metricsJoined(entry)}</span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{entry.updatedBy}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{entry.lastModified}</TableCell>
                    <TableCell>
                      <EntryStatusBadge status={entry.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" aria-label={`View ${entry.period} entry`}>
                              <Eye className="size-4" aria-hidden />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>{entry.period} — manual entry</DialogTitle>
                              <DialogDescription>
                                Entered by {entry.updatedBy} · last modified {entry.lastModified}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-2.5">
                              {entry.metrics.map((m) => (
                                <div key={m.label} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                                  <div>
                                    <p className="text-sm font-medium">{m.label}</p>
                                    <p className="text-xs text-muted-foreground">Precision: {m.precision}</p>
                                  </div>
                                  <p className="text-sm font-semibold tnum">{m.value}</p>
                                </div>
                              ))}
                            </div>
                            <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-3">
                              <ProvenanceBadge provenance="user-supplied" />
                              <p className="text-xs text-muted-foreground">
                                These values appear in analysis marked as user supplied.
                              </p>
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Button variant="ghost" size="sm" aria-label={`Edit ${entry.period} entry`} onClick={() => editEntry(entry)}>
                          <PenLine className="size-4" aria-hidden />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" aria-label={`Delete ${entry.period} entry`} className="text-red-600 hover:bg-red-50 hover:text-red-700">
                              <Trash2 className="size-4" aria-hidden />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete {entry.period} entry?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This removes the manual totals for {entry.period}. Coverage may drop and some analyses will note the
                                missing period.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => removeEntry(entry.id)} className="bg-red-600 hover:bg-red-700">
                                Delete entry
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        Status reflects whether another source confirms the totals. Verified entries came from a second source or a second person.
      </p>
    </div>
  );
}

export const views: ViewMap = {
  "manual-entry": ManualEntryScreen,
  "manual-history": ManualHistoryScreen,
};
