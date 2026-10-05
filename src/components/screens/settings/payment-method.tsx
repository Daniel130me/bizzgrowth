"use client";
// Screen 90 — Payment Method (simulated; guard: at least one method must remain).

import { useState } from "react";
import { toast } from "sonner";
import { CreditCard, Plus } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Breadcrumbs, InfoBanner, PageHeader, SectionCard } from "@/components/shared/layout";
import { useBizz } from "@/lib/store";

interface CardMethod {
  id: string;
  brand: string;
  last4: string;
  exp: string;
  isDefault: boolean;
}

export function PaymentMethod() {
  const navigate = useBizz((s) => s.navigate);

  const [methods, setMethods] = useState<CardMethod[]>([
    { id: "pm-1", brand: "Visa", last4: "4921", exp: "08/27", isDefault: true },
  ]);
  const [changeOpen, setChangeOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [removing, setRemoving] = useState<CardMethod | null>(null);

  const current = methods[0];

  const saveChange = () => {
    setChangeOpen(false);
    toast.success("Payment method updated", {
      description: `${current.brand} ending ${current.last4} now expires ${current.exp}.`,
    });
  };

  const addMethod = () => {
    const next: CardMethod = { id: `pm-${methods.length + 1}`, brand: "Mastercard", last4: "5302", exp: "11/28", isDefault: false };
    setMethods((m) => [...m, next]);
    setAddOpen(false);
    toast.success("Payment method added", { description: "Mastercard ending 5302 saved as a backup method." });
  };

  const removeMethod = (target: CardMethod) => {
    const remaining = methods.filter((m) => m.id !== target.id).map((m, i) => (i === 0 ? { ...m, isDefault: true } : m));
    setMethods(remaining);
    setRemoving(null);
    toast.success("Payment method removed", {
      description: `${target.brand} ending ${target.last4} was removed. ${remaining[0]?.brand ?? "Card"} ending ${remaining[0]?.last4 ?? ""} is now the default.`,
    });
  };

  const guardRemove = (target: CardMethod) => {
    if (methods.length === 1) {
      toast.error("You need at least one payment method on file", {
        description: "Add another method first — then you can remove this one.",
      });
      return;
    }
    setRemoving(target);
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Breadcrumbs items={[{ label: "Plan & Subscription", onClick: () => navigate("settings/plan") }, { label: "Payment method" }]} />
      <PageHeader
        title="Payment Method"
        description="Used for plan renewals. Card details are simulated in this prototype."
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 size-4" aria-hidden /> Add payment method
          </Button>
        }
      />

      <SectionCard title="Saved methods" contentClassName="p-0">
        <ul className="divide-y">
          {methods.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-slate-50 text-slate-500">
                  <CreditCard className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {m.brand} &bull;&bull;&bull;&bull; <span className="tnum">{m.last4}</span>
                    {m.isDefault ? (
                      <Badge variant="outline" className="bg-emerald-50 font-normal text-emerald-700 border-emerald-200">
                        Default
                      </Badge>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Expires <span className="tnum">{m.exp}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!m.isDefault}
                  onClick={() => (m.isDefault ? setChangeOpen(true) : undefined)}
                >
                  Change
                </Button>
                <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => guardRemove(m)}>
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </SectionCard>

      <InfoBanner tone="info" title="How billing uses this card">
        The default method is charged on renewal day. If a charge fails we retry twice, then email the workspace Owner
        before any downgrade.
      </InfoBanner>

      <Dialog open={changeOpen} onOpenChange={setChangeOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Change card details</DialogTitle>
            <DialogDescription>
              Replace the expiring details for {current?.brand} ending {current?.last4}. Sandbox fields are prefilled
              with test values.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pm-number">Card number</Label>
              <Input id="pm-number" defaultValue="4921 4921 4921 4921" className="tnum" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pm-exp">Expiry</Label>
                <Input id="pm-exp" defaultValue="08 / 27" className="tnum" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pm-cvc">CVC</Label>
                <Input id="pm-cvc" defaultValue="123" className="tnum" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setChangeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveChange}>Save card</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add payment method</DialogTitle>
            <DialogDescription>Sandbox fields are prefilled with test values — nothing is charged.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pm-new-number">Card number</Label>
              <Input id="pm-new-number" defaultValue="5305 0530 5030 5030" className="tnum" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pm-new-exp">Expiry</Label>
                <Input id="pm-new-exp" defaultValue="11 / 28" className="tnum" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pm-new-cvc">CVC</Label>
                <Input id="pm-new-cvc" defaultValue="452" className="tnum" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={addMethod}>Add card</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing?.brand} ending {removing?.last4}?</AlertDialogTitle>
            <AlertDialogDescription>
              Future renewals will use {methods.filter((m) => m.id !== removing?.id)[0]?.brand ?? "your other card"}.
              You can add the card back at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={(e) => {
                e.preventDefault();
                if (removing) removeMethod(removing);
              }}
            >
              Remove card
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
