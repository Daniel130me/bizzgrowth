"use client";
// Screen 74 — Customer Journey Configuration.
// Visual editable funnel: reorder, remove and add steps; templates included.
// This model drives funnel analysis everywhere in the product.

import { useState } from "react";
import { useBizz } from "@/lib/store";
import { getBusiness } from "@/lib/data/businesses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InfoBanner } from "@/components/shared/layout";
import { ProvenanceBadge } from "@/components/shared/badges";
import { ConfigShell, SaveRow, savedToast } from "./parts";
import { ArrowDown, ArrowUp, LayoutTemplate, X } from "lucide-react";
import type { ScreenProps } from "../view-types";

const SERVICE_TEMPLATE = ["Discovery (Google / Instagram / Referral)", "Website / WhatsApp", "Enquiry", "Quote", "Customer"];
const ECOMMERCE_TEMPLATE = ["Discovery (Google / Instagram)", "Website", "Product view", "Add to cart", "Checkout", "Purchase", "Repeat purchase"];

export function BrainJourney({ params: _params }: ScreenProps) {
  const businessId = useBizz((s) => s.businessId);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const business = getBusiness(businessId, userWorkspace);

  const [store, setStore] = useState<{ owner: string; steps: string[] } | null>(null);
  const steps = store?.owner === businessId ? store.steps : business.journey;
  const setSteps = (next: string[]) => setStore({ owner: businessId, steps: next });
  const [newStep, setNewStep] = useState("");

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[i], next[j]] = [next[j], next[i]];
    setSteps(next);
  };

  const remove = (i: number) => {
    if (steps.length <= 2) return;
    setSteps(steps.filter((_, idx) => idx !== i));
  };

  const add = () => {
    const label = newStep.trim();
    if (!label) return;
    setSteps([...steps, label]);
    setNewStep("");
  };

  const applyTemplate = (kind: "service" | "ecommerce") => {
    setSteps(kind === "service" ? SERVICE_TEMPLATE : ECOMMERCE_TEMPLATE);
    savedToast("Template applied", "Review the steps, then save to update funnel analysis.");
  };

  const save = () => {
    savedToast("Journey updated — funnel analysis now uses this model");
  };

  return (
    <ConfigShell
      title="Customer journey"
      description="The steps customers take, from first discovery to repeat purchase. Keep the model close to how your business really works."
    >
      <InfoBanner tone="info" title="This model affects funnel analysis">
        The Performance funnel, conversion diagnosis and drop-off alerts all follow these steps. Changing the order changes how drop-off is measured.
      </InfoBanner>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => applyTemplate("service")}>
          <LayoutTemplate className="size-3.5" aria-hidden /> Use service template
        </Button>
        <Button variant="outline" size="sm" onClick={() => applyTemplate("ecommerce")}>
          <LayoutTemplate className="size-3.5" aria-hidden /> Use ecommerce template
        </Button>
        <ProvenanceBadge provenance="user-supplied" source="Confirmed during your checkup" className="ml-auto" />
      </div>

      <section aria-label="Journey steps" className="rounded-xl border p-4">
        <ol className="space-y-2">
          {steps.map((step, i) => (
            <li key={`${step}-${i}`}>
              <div className="flex items-center gap-3 rounded-xl border bg-white p-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold tnum">{i + 1}</span>
                <p className="min-w-0 flex-1 truncate text-sm font-medium">{step}</p>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${step} up`}>
                    <ArrowUp className="size-3.5" aria-hidden />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8" onClick={() => move(i, 1)} disabled={i === steps.length - 1} aria-label={`Move ${step} down`}>
                    <ArrowDown className="size-3.5" aria-hidden />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-8 text-red-600 hover:bg-red-50" onClick={() => remove(i)} disabled={steps.length <= 2} aria-label={`Remove ${step}`}>
                    <X className="size-3.5" aria-hidden />
                  </Button>
                </div>
              </div>
              {i < steps.length - 1 ? (
                <div className="flex justify-center py-0.5" aria-hidden>
                  <ArrowDown className="size-3.5 text-slate-400" />
                </div>
              ) : null}
            </li>
          ))}
        </ol>

        <div className="mt-4 flex flex-col gap-2 border-t pt-4 sm:flex-row">
          <Input
            value={newStep}
            onChange={(e) => setNewStep(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Add a step, e.g. Delivery feedback call"
            aria-label="New journey step"
          />
          <Button variant="outline" onClick={add} className="shrink-0">
            Add step
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">A journey needs at least two steps. The first step is usually discovery; the last is the outcome you want repeated.</p>
      </section>

      <SaveRow onSave={save} label="Save journey" note="Applies immediately to funnel analysis after saving." />
    </ConfigShell>
  );
}
