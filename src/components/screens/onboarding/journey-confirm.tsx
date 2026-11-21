"use client";
// Screen 15 — Business model / buying journey confirmation.
// Shows the journey the Context Engine proposed from the checkup conversation
// (store.checkup.facts.journey when available); the user can edit, add, remove
// and reorder steps — and the result is SAVED back to the business model.

import React, { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useBizz } from "@/lib/store";
import { diagnosisReturnRoute } from "@/lib/diagnosis-route";
import { cn } from "@/lib/utils";
import { ProvenanceBadge } from "@/components/shared/badges";
import type { ScreenProps } from "../view-types";

interface Step {
  id: number;
  label: string;
  note?: string;
}

const SERVICE_STEPS: Omit<Step, "id">[] = [
  { label: "Discovery", note: "Instagram / Google / Referral" },
  { label: "Website / WhatsApp", note: "First contact" },
  { label: "Enquiry", note: "Customer reaches out" },
  { label: "Quote", note: "You respond with pricing" },
  { label: "Customer", note: "Deal won" },
];

const ECOMMERCE_STEPS: Omit<Step, "id">[] = [
  { label: "Discovery", note: "Instagram / Google / Referral" },
  { label: "Product page", note: "Website visit" },
  { label: "Cart", note: "Product added" },
  { label: "Checkout", note: "Payment started" },
  { label: "Order", note: "Payment completed" },
];

type Model = "service" | "ecommerce" | "both";

export default function JourneyConfirm(_props: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);
  const checkupFacts = useBizz((s) => s.checkup.facts);
  const hasDiagnosis = useBizz((s) => Boolean(s.checkup.diagnosis));
  const setCheckupJourney = useBizz((s) => s.setCheckupJourney);

  const aiJourney: Step[] | null =
    checkupFacts && checkupFacts.journey.length >= 3
      ? checkupFacts.journey.map((label, i) => ({ id: i + 1, label }))
      : null;

  const [model, setModel] = useState<Model>(checkupFacts?.businessType ?? "service");
  const [steps, setSteps] = useState<Step[]>(
    () =>
      aiJourney ??
      (checkupFacts?.businessType === "ecommerce" ? ECOMMERCE_STEPS : SERVICE_STEPS).map((s, i) => ({ ...s, id: i + 1 })),
  );
  const [editing, setEditing] = useState(false);
  const [newStep, setNewStep] = useState("");
  const idRef = useRef(steps.length);

  /** Persist the reviewed journey into the stored business model. */
  function saveJourney(current: Step[]) {
    if (checkupFacts) setCheckupJourney(current.map((s) => s.label));
  }

  function switchModel(next: Model) {
    setModel(next);
    const base = next === "ecommerce" ? ECOMMERCE_STEPS : SERVICE_STEPS;
    setSteps(base.map((s, i) => ({ ...s, id: i + 1 })));
    idRef.current = base.length;
  }

  function move(index: number, dir: -1 | 1) {
    setSteps((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  }

  function remove(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }

  function add() {
    const label = newStep.trim();
    if (!label) return;
    idRef.current += 1;
    setSteps((prev) => [...prev, { id: idRef.current, label, note: "Added by you" }]);
    setNewStep("");
  }

  const modelLabel = model === "service" ? "Service" : model === "ecommerce" ? "Ecommerce" : "Both";
  const builtFrom = (checkupFacts?.channels ?? []).slice(0, 4);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">From your checkup conversation</p>
      <h1 className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">Here&apos;s how customers find and pay you</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        From your answers, we drafted the steps a customer takes — from first hearing about you to paying you.
        This draft shapes how your diagnosis and future measurements are framed, so it is worth a quick check.
        <ProvenanceBadge provenance="ai-interpretation" className="ml-2 align-middle" />
      </p>

      {/* What to do — explicit instruction, so nobody has to guess */}
      <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50/60 p-4" aria-label="What to do on this page">
        <p className="text-sm font-semibold text-brand-900">What to do here</p>
        <ol className="mt-1.5 list-inside list-decimal space-y-0.5 text-sm text-brand-900/85">
          <li>Read the steps below, top to bottom.</li>
          <li>If that is really how it happens, press “Yes, that&apos;s how it happens”.</li>
          <li>If anything is wrong or missing, press “Edit journey” — you can rename, reorder, remove or add steps.</li>
        </ol>
      </div>

      {/* Business model */}
      <Card className="mt-4 p-5">
        <h2 className="text-sm font-semibold">What kind of business is this?</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          This only changes the words used across the product — for example Enquiries vs Orders. It does not affect your data.
        </p>
        <div className="mt-3 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1" role="radiogroup" aria-label="Business model">
          {(["service", "ecommerce", "both"] as Model[]).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={model === m}
              onClick={() => switchModel(m)}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                model === m ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m === "service" ? "Service" : m === "ecommerce" ? "Ecommerce" : "Both"}
            </button>
          ))}
        </div>
        {model === "both" ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Both models selected — the service journey is shown below; product journeys use Orders instead of Customers.
          </p>
        ) : null}
      </Card>

      {/* Journey */}
      <Card className="mt-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Draft — your customer journey ({modelLabel})</h2>
          <Button variant="outline" size="sm" onClick={() => setEditing((v) => !v)}>
            {editing ? <Check className="size-4" aria-hidden /> : <Pencil className="size-4" aria-hidden />}
            {editing ? "Done editing" : "Edit journey"}
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          A draft built from what you told us — nothing is measured yet. Correcting it now keeps your diagnosis accurate.
        </p>
        {builtFrom.length > 0 ? (
          <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            Built from what you told us:
            {builtFrom.map((c) => (
              <span key={c} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-medium text-slate-600">
                {c}
              </span>
            ))}
          </p>
        ) : null}

        <ol className="mt-2" aria-label="Customer journey timeline">
          {steps.map((s, i) => {
            const last = i === steps.length - 1;
            return (
            <li key={s.id} className="relative flex gap-4 pb-6 last:pb-0">
              {/* Rail: line runs from this marker down to the next one */}
              {!last ? (
                <span className="absolute left-[13px] top-8 bottom-0 w-0.5 bg-gradient-to-b from-brand-300 to-brand-200" aria-hidden />
              ) : null}
              <span
                className={cn(
                  "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tnum ring-4 ring-white",
                  last ? "bg-brand-600 text-white" : "border-2 border-brand-300 bg-white text-brand-700",
                )}
              >
                {last ? <Check className="size-3.5" aria-hidden /> : i + 1}
              </span>
              <div className="flex min-w-0 flex-1 items-start gap-3 pt-0.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-600">
                    {i === 0 ? "Start" : last ? "Goal" : `Step ${i + 1}`}
                  </p>
                  <p className={cn("text-sm leading-snug", last ? "font-semibold text-brand-800" : "font-medium")}>{s.label}</p>
                  {s.note ? <p className="mt-0.5 text-xs text-muted-foreground">{s.note}</p> : null}
                </div>
                {editing ? (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button variant="ghost" size="icon" className="size-7" aria-label={`Move ${s.label} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp className="size-3.5" aria-hidden />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-7" aria-label={`Move ${s.label} down`} disabled={i === steps.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDown className="size-3.5" aria-hidden />
                    </Button>
                    <Button variant="ghost" size="icon" className="size-7 text-red-600 hover:text-red-700" aria-label={`Remove ${s.label}`} onClick={() => remove(i)}>
                      <X className="size-3.5" aria-hidden />
                    </Button>
                  </div>
                ) : null}
              </div>
            </li>
            );
          })}
        </ol>

        {editing ? (
          <form
            className="mt-4 flex items-center gap-2 border-t pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <Input
              value={newStep}
              onChange={(e) => setNewStep(e.target.value)}
              placeholder="Add a step, e.g. Site visit / Proposal call"
              aria-label="New journey step"
            />
            <Button type="submit" variant="outline" disabled={!newStep.trim()}>
              <Plus className="size-4" aria-hidden />
              Add step
            </Button>
          </form>
        ) : null}
      </Card>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Button
          onClick={() => {
            saveJourney(steps);
            // Reached from the diagnosis ("check the details") — go back to it.
            navigate(checkupFacts ? diagnosisReturnRoute(hasDiagnosis ? "diagnosis" : "first-diagnosis") : "business-understanding");
          }}
          className="w-full sm:w-auto"
        >
          <Check className="size-4" aria-hidden />
          Yes, that&apos;s how it happens
        </Button>
        <Button variant="outline" className="w-full sm:w-auto" onClick={() => setEditing((v) => !v)}>
          <Pencil className="size-4" aria-hidden />
          {editing ? "Done editing" : "Edit journey"}
        </Button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        {aiJourney
          ? "Proposed by the Context Engine from your answers. Edits are saved into your business model."
          : "The journey is only a working model — it improves as connections and data are added later."}
      </p>
    </div>
  );
}
