"use client";
// Screen 72 — Products & Services Configuration.
// Service: editable services table (add / edit / archive / active toggle).
// Ecommerce: read-only product summary from the connected store.

import { useMemo, useState } from "react";
import { useBizz } from "@/lib/store";
import { getBusiness } from "@/lib/data/businesses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionCard } from "@/components/shared/layout";
import { ProvenanceBadge } from "@/components/shared/badges";
import { ConfigShell, savedToast } from "./parts";
import { Archive, NotebookPen, Plus } from "lucide-react";
import { fmtNaira, fmtPct } from "@/lib/format";
import type { ScreenProps } from "../view-types";

interface ServiceRow {
  id: string;
  name: string;
  description: string;
  priceRange: string;
  priority: string;
  enquiries: number;
  customers: number;
  revenue: number;
  conversion: number;
  active: boolean;
}

const EMPTY_DRAFT = { name: "", description: "", priceRange: "", priority: "medium" };

function toRow(s: { id: string; name: string; priceRange: string; enquiries: number; customers: number; revenue: number; conversion: number; active: boolean }): ServiceRow {
  return {
    id: s.id,
    name: s.name,
    description: "",
    priceRange: s.priceRange,
    priority: "medium",
    enquiries: s.enquiries,
    customers: s.customers,
    revenue: s.revenue,
    conversion: s.conversion,
    active: s.active,
  };
}

export function BrainProducts({ params: _params }: ScreenProps) {
  const businessId = useBizz((s) => s.businessId);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const business = getBusiness(businessId, userWorkspace);
  const isService = business.type === "service";

  const [store, setStore] = useState<{ owner: string; rows: ServiceRow[] } | null>(null);
  const rows = store?.owner === businessId ? store.rows : (business.services ?? []).map(toRow);
  const setRows = (next: ServiceRow[]) => setStore({ owner: businessId, rows: next });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [archiveTarget, setArchiveTarget] = useState<ServiceRow | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const openAdd = () => {
    setDialogMode("add");
    setEditId(null);
    setDraft(EMPTY_DRAFT);
    setNameError(null);
    setDialogOpen(true);
  };

  const openEdit = (row: ServiceRow) => {
    setDialogMode("edit");
    setEditId(row.id);
    setDraft({ name: row.name, description: row.description, priceRange: row.priceRange, priority: row.priority });
    setNameError(null);
    setDialogOpen(true);
  };

  const saveDialog = () => {
    if (!draft.name.trim()) {
      setNameError("Give the service a name.");
      return;
    }
    if (dialogMode === "add") {
      setRows([
        ...rows,
        {
          id: `svc-user-${rows.length + 1}`,
          name: draft.name.trim(),
          description: draft.description.trim(),
          priceRange: draft.priceRange.trim() || "Not set",
          priority: draft.priority,
          enquiries: 0,
          customers: 0,
          revenue: 0,
          conversion: 0,
          active: true,
        },
      ]);
      savedToast("Catalogue updated", `${draft.name.trim()} added to your services.`);
    } else if (editId) {
      setRows(
        rows.map((row) =>
          row.id === editId
            ? { ...row, name: draft.name.trim(), description: draft.description.trim(), priceRange: draft.priceRange.trim() || "Not set", priority: draft.priority }
            : row
        )
      );
      savedToast("Catalogue updated", `${draft.name.trim()} saved.`);
    }
    setDialogOpen(false);
  };

  const toggleActive = (row: ServiceRow, active: boolean) => {
    setRows(rows.map((x) => (x.id === row.id ? { ...x, active } : x)));
    savedToast("Catalogue updated", `${row.name} marked ${active ? "active" : "inactive"}.`);
  };

  const confirmArchive = () => {
    if (!archiveTarget) return;
    setRows(rows.filter((x) => x.id !== archiveTarget.id));
    savedToast("Catalogue updated", `${archiveTarget.name} was archived and no longer feeds analysis.`);
    setArchiveTarget(null);
  };

  const products = useMemo(() => business.products ?? [], [business.products]);

  return (
    <ConfigShell
      title={isService ? "Products & services" : "Products"}
      description={
        isService
          ? "What you sell, at what price, and what is currently active. The catalogue feeds service-level revenue and conversion analysis."
          : "A summary of your store catalogue. Product analytics come from your connected store — edits happen in your store admin."
      }
    >
      {isService ? (
        <>
          <SectionCard
            title="Services"
            description="Active services feed analysis and recommendations. Archived services are excluded."
            action={
              <Button size="sm" onClick={openAdd}>
                <Plus className="size-3.5" aria-hidden /> Add service
              </Button>
            }
            contentClassName="p-0"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Service</th>
                    <th className="px-4 py-3 font-medium">Price range</th>
                    <th className="px-4 py-3 text-right font-medium">Enquiries</th>
                    <th className="px-4 py-3 text-right font-medium">Customers</th>
                    <th className="px-4 py-3 text-right font-medium">Revenue</th>
                    <th className="px-4 py-3 text-right font-medium">Conversion</th>
                    <th className="px-4 py-3 font-medium">Active</th>
                    <th className="px-4 py-3 text-right font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-medium">{row.name}</p>
                        {row.description ? <p className="mt-0.5 text-xs text-muted-foreground">{row.description}</p> : null}
                        {row.priority === "high" ? (
                          <Badge variant="outline" className="mt-1 border-amber-200 bg-amber-50 font-normal text-amber-700">
                            Primary service
                          </Badge>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 tnum">{row.priceRange}</td>
                      <td className="px-4 py-3 text-right tnum">{row.enquiries}</td>
                      <td className="px-4 py-3 text-right tnum">{row.customers}</td>
                      <td className="px-4 py-3 text-right tnum">{fmtNaira(row.revenue, { compact: true })}</td>
                      <td className="px-4 py-3 text-right tnum">{row.conversion ? fmtPct(row.conversion) : "—"}</td>
                      <td className="px-4 py-3">
                        <Switch checked={row.active} onCheckedChange={(v) => toggleActive(row, v)} aria-label={`Mark ${row.name} ${row.active ? "inactive" : "active"}`} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(row)} aria-label={`Edit ${row.name}`}>
                            <NotebookPen className="size-3.5" aria-hidden />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => setArchiveTarget(row)} aria-label={`Archive ${row.name}`}>
                            <Archive className="size-3.5" aria-hidden />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
              <ProvenanceBadge provenance="user-supplied" source="Catalogue configured by your team" />
              <span>
                Performance columns (enquiries → revenue) come from recorded monthly data:{" "}
                <span className="tnum">{rows.filter((r) => r.active).length} active</span> of <span className="tnum">{rows.length}</span> services.
              </span>
            </div>
          </SectionCard>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{dialogMode === "add" ? "Add service" : "Edit service"}</DialogTitle>
                <DialogDescription>
                  {dialogMode === "add"
                    ? "New services start with no recorded performance; numbers appear as monthly data is entered."
                    : "Update the catalogue entry. Performance figures come from your data and are not editable here."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="svc-name">Name</Label>
                  <Input id="svc-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Same-day Delivery" aria-invalid={Boolean(nameError)} />
                  {nameError ? <p className="text-xs text-red-600">{nameError}</p> : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="svc-desc">Description</Label>
                  <Input id="svc-desc" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="One line describing what is included" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="svc-price">Price range</Label>
                    <Input id="svc-price" value={draft.priceRange} onChange={(e) => setDraft({ ...draft, priceRange: e.target.value })} placeholder="e.g. ₦8,000 – ₦35,000" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="svc-priority">Priority</Label>
                    <Select value={draft.priority} onValueChange={(v) => setDraft({ ...draft, priority: v })}>
                      <SelectTrigger id="svc-priority" aria-label="Service priority">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">High — primary offer</SelectItem>
                        <SelectItem value="medium">Medium — core offer</SelectItem>
                        <SelectItem value="low">Low — occasional</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={saveDialog}>{dialogMode === "add" ? "Add service" : "Save changes"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog open={Boolean(archiveTarget)} onOpenChange={(open) => !open && setArchiveTarget(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Archive {archiveTarget?.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Archived services are excluded from analysis and recommendations. You can add the service again at any time.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep service</AlertDialogCancel>
                <AlertDialogAction onClick={confirmArchive}>Archive</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : (
        <SectionCard title="Products" description="From your connected store — read-only here." contentClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 text-right font-medium">Views</th>
                  <th className="px-4 py-3 text-right font-medium">Carts</th>
                  <th className="px-4 py-3 text-right font-medium">Orders</th>
                  <th className="px-4 py-3 text-right font-medium">Revenue</th>
                  <th className="px-4 py-3 text-right font-medium">View → order</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-right tnum">{p.views.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tnum">{p.carts.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tnum">{p.orders}</td>
                    <td className="px-4 py-3 text-right tnum">{fmtNaira(p.revenue, { compact: true })}</td>
                    <td className="px-4 py-3 text-right tnum">{p.views ? fmtPct((p.orders / p.views) * 100) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
            <ProvenanceBadge provenance="measured" source={`${business.platform ?? "Store"} catalogue analytics`} />
            <span>Add, edit and archiving happen in your store admin; this page mirrors what the analysis uses.</span>
          </div>
        </SectionCard>
      )}
    </ConfigShell>
  );
}
