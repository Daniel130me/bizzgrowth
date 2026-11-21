"use client";
// Screen 89 — Upgrade / Checkout (sandbox — no real processor).

import { useEffect, useRef, useState } from "react";
import { Check, CreditCard, Loader2, Lock, ShieldCheck } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Breadcrumbs, InfoBanner, PageHeader, SectionCard } from "@/components/shared/layout";
import { useBizz } from "@/lib/store";

type PlanId = "Growth" | "Team";
type Frequency = "monthly" | "annual";

const PLANS: Record<PlanId, { name: string; monthly: number; blurb: string }> = {
  Growth: { name: "Growth", monthly: 45_000, blurb: "For a single business getting systematic about growth." },
  Team: { name: "Team", monthly: 120_000, blurb: "Multiple workspaces, roles and shared accountability." },
};

const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;

export function Upgrade() {
  const navigate = useBizz((s) => s.navigate);
  const updateSettings = useBizz((s) => s.updateSettings);

  const [plan, setPlan] = useState<PlanId>("Growth");
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const monthlyEquivalent = frequency === "annual" ? Math.round(PLANS[plan].monthly * 0.85) : PLANS[plan].monthly;
  const dueToday = frequency === "annual" ? PLANS[plan].monthly * 12 * 0.85 : PLANS[plan].monthly;

  const completeUpgrade = () => {
    setProcessing(true);
    timerRef.current = setTimeout(() => {
      setProcessing(false);
      setSuccess(true);
    }, 1500);
  };

  const finishUpgrade = () => {
    updateSettings({ plan });
    setSuccess(false);
    navigate("settings/plan");
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Breadcrumbs items={[{ label: "Plan & Subscription", onClick: () => navigate("settings/plan") }, { label: "Upgrade" }]} />
      <PageHeader
        title="Upgrade Your Plan"
        description="Choose a plan and billing frequency. This is a sandbox checkout — no real payment is processed."
      />

      <SectionCard title="1. Choose a plan">
        <RadioGroup value={plan} onValueChange={(v) => setPlan(v as PlanId)} className="gap-3" aria-label="Plan">
          {(Object.keys(PLANS) as PlanId[]).map((p) => (
            <Label
              key={p}
              htmlFor={`plan-${p}`}
              className={
                "flex cursor-pointer items-start justify-between gap-3 rounded-xl border p-4 transition-colors " +
                (plan === p ? "border-brand-300 bg-brand-50/50" : "hover:bg-slate-50")
              }
            >
              <span className="flex items-start gap-3">
                <RadioGroupItem id={`plan-${p}`} value={p} className="mt-0.5" />
                <span>
                  <span className="block text-sm font-medium">{PLANS[p].name}</span>
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{PLANS[p].blurb}</span>
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-sm font-semibold tnum">{naira(PLANS[p].monthly)}</span>
                <span className="block text-xs text-muted-foreground">per month</span>
                <Badge variant="outline" className="mt-1 bg-amber-50 font-normal text-amber-700 border-amber-200">
                  Indicative
                </Badge>
              </span>
            </Label>
          ))}
        </RadioGroup>
      </SectionCard>

      <SectionCard title="2. Billing frequency">
        <RadioGroup
          value={frequency}
          onValueChange={(v) => setFrequency(v as Frequency)}
          className="flex gap-3"
          aria-label="Billing frequency"
        >
          <Label
            htmlFor="freq-monthly"
            className={
              "flex flex-1 cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors " +
              (frequency === "monthly" ? "border-brand-300 bg-brand-50/50" : "hover:bg-slate-50")
            }
          >
            <RadioGroupItem id="freq-monthly" value="monthly" />
            <span>
              <span className="block text-sm font-medium">Monthly</span>
              <span className="block text-xs text-muted-foreground">Billed every month. Cancel any time.</span>
            </span>
          </Label>
          <Label
            htmlFor="freq-annual"
            className={
              "flex flex-1 cursor-pointer items-center gap-3 rounded-xl border p-4 transition-colors " +
              (frequency === "annual" ? "border-brand-300 bg-brand-50/50" : "hover:bg-slate-50")
            }
          >
            <RadioGroupItem id="freq-annual" value="annual" />
            <span>
              <span className="block text-sm font-medium">Annual — save 15%</span>
              <span className="block text-xs text-muted-foreground">One payment covering 12 months.</span>
            </span>
          </Label>
        </RadioGroup>
      </SectionCard>

      <SectionCard title="3. Order summary">
        <ul className="space-y-2 text-sm">
          <li className="flex justify-between">
            <span className="text-muted-foreground">Plan</span>
            <span className="font-medium">{PLANS[plan].name}</span>
          </li>
          <li className="flex justify-between">
            <span className="text-muted-foreground">Billing</span>
            <span className="font-medium">{frequency === "annual" ? "Annual" : "Monthly"}</span>
          </li>
          <li className="flex justify-between">
            <span className="text-muted-foreground">
              {frequency === "annual" ? "Monthly equivalent (15% off)" : "Monthly price"}
            </span>
            <span className="tnum">{naira(monthlyEquivalent)}/mo</span>
          </li>
          <li className="flex justify-between border-t pt-2 text-base">
            <span className="font-medium">Due today</span>
            <span className="font-semibold tnum">{naira(dueToday)}</span>
          </li>
        </ul>
      </SectionCard>

      <SectionCard title="4. Payment details" description="Sandbox checkout — fields are prefilled with test values.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="cc-number">Card number</Label>
            <div className="relative">
              <CreditCard className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <Input id="cc-number" disabled value="4242 4242 4242 4242" className="pl-9 tnum" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cc-exp">Expiry</Label>
            <Input id="cc-exp" disabled value="09 / 28" className="tnum" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cc-cvc">CVC</Label>
            <Input id="cc-cvc" disabled value="123" className="tnum" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="cc-name">Name on card</Label>
            <Input id="cc-name" disabled value="Amara Okafor" />
          </div>
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3.5" aria-hidden /> Sandbox checkout — this prototype does not process payments or store
          card data.
        </p>
      </SectionCard>

      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={() => navigate("settings/plan")}>
          Cancel
        </Button>
        <Button onClick={completeUpgrade} disabled={processing} className="min-w-56">
          {processing ? (
            <>
              <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden /> Processing…
            </>
          ) : (
            <>
              <ShieldCheck className="mr-1.5 size-4" aria-hidden /> Complete upgrade — {naira(dueToday)}
            </>
          )}
        </Button>
      </div>

      <InfoBanner tone="info" title="What happens next">
        Upgrading unlocks the limits shown on your plan page. In this prototype the plan change is simulated and no
        charge is made.
      </InfoBanner>

      <Dialog open={success} onOpenChange={setSuccess}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Check className="size-6" aria-hidden />
            </span>
            <DialogTitle className="text-center">Welcome to {PLANS[plan].name}</DialogTitle>
            <DialogDescription className="text-center">
              Your workspace is now on the {PLANS[plan].name} plan ({frequency === "annual" ? "annual" : "monthly"}{" "}
              billing, indicative pricing). No charge was made — this was a sandbox checkout.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <Button onClick={finishUpgrade}>Go to plan settings</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
