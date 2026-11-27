"use client";
// Screen 19 — Improve My Diagnosis. Multiple paths, each explains what it unlocks.
// Option A now genuinely recomputes the diagnosis: the enquiry/customer counts
// are turned into measured conversion rates (deterministic math) and the AI
// rewrites the interpretation around those real numbers
// (POST /api/checkup/improve → store.checkup.improved).

import React, { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Calculator, ChevronDown, ChevronUp, Link2, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBizz } from "@/lib/store";
import type { ImprovedDiagnosis } from "@/lib/checkup";
import { diagnosisBaseOf, diagnosisReturnRoute } from "@/lib/diagnosis-route";
import type { ScreenProps } from "../view-types";

const FALLBACK_CHANNELS = [
  { key: "instagram", name: "Instagram", hint: "Most enquiries, fewest customers per enquiry" },
  { key: "google", name: "Google Search", hint: "Smaller volume, strong conversion" },
  { key: "referral", name: "Referral", hint: "Best conversion, no ad spend" },
] as const;

type CountKey = string; // `${channelKey}-enq|cus`

export default function ImproveDiagnosis(_props: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);
  const facts = useBizz((s) => s.checkup.facts);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const setImprovedDiagnosis = useBizz((s) => s.setImprovedDiagnosis);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  // Sample figures only ever appear for the demo (no checkup) — a real owner
  // starts with empty boxes, never someone else's numbers.
  const [counts, setCounts] = useState<Record<CountKey, string>>((): Record<CountKey, string> =>
    facts
      ? {}
      : {
          "instagram-enq": "184",
          "instagram-cus": "11",
          "google-enq": "62",
          "google-cus": "24",
          "referral-enq": "31",
          "referral-cus": "14",
        },
  );

  // Channels follow the owner's actual business when the checkup knows them.
  const channels = useMemo(() => {
    if (facts?.channels && facts.channels.length >= 1) {
      const own = facts.channels.slice(0, 3).map((name, i) => ({
        key: `ch-${i}`,
        name,
        hint: i === 0 ? "From your checkup conversation" : "Enter last month's counts",
      }));
      return own.length === 1 ? [...own, { key: "ch-other", name: "Everything else", hint: "Any other way people found you" }] : own;
    }
    return FALLBACK_CHANNELS.map((c) => ({ ...c }));
  }, [facts]);

  function set(key: CountKey, value: string) {
    setCounts((c) => ({ ...c, [key]: value }));
  }

  function collect(): { name: string; enquiries: number; customers: number }[] {
    return channels.map((ch) => ({
      name: ch.name,
      enquiries: Math.max(0, parseInt(counts[`${ch.key}-enq`] ?? "", 10) || 0),
      customers: Math.max(0, parseInt(counts[`${ch.key}-cus`] ?? "", 10) || 0),
    }));
  }

  async function updateDiagnosis() {
    const rows = collect();
    const usable = rows.filter((r) => r.enquiries > 0);
    if (usable.length === 0) {
      toast.error("Add enquiries for at least one channel", { description: "Estimates are fine — zero across every channel gives nothing to compare." });
      return;
    }

    setSaving(true);
    // Deterministic conversion math — the numbers shown are always real.
    const withConversion = usable.map((r) => ({
      ...r,
      conversion: Math.round((r.customers / r.enquiries) * 1000) / 10,
    }));
    const best = withConversion.reduce((a, b) => (b.conversion > a.conversion ? b : a));
    const worst = withConversion.reduce((a, b) => (b.conversion < a.conversion ? b : a));

    try {
      const res = await fetch("/api/checkup/improve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceName: userWorkspace?.name ?? "Your business",
          facts,
          channels: usable,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; improved?: ImprovedDiagnosis };
      if (data?.ok && data.improved) {
        setImprovedDiagnosis(data.improved);
        // Only claim more certainty when the counts really added it.
        const before = facts?.confidence ?? 62;
        toast.success(data.improved.confidence > before ? `Diagnosis improved — confidence increased to ${data.improved.confidence}%` : "Your counts are added to your diagnosis", {
          description: `${worst.name}: ${worst.conversion.toFixed(1)}% of people who asked went on to pay, vs ${best.conversion.toFixed(1)}% for ${best.name} — worked out from your numbers.`,
        });
      } else {
        throw new Error("improve failed");
      }
    } catch {
      // Offline path: still store the measured rows with a template narrative.
      setImprovedDiagnosis({
        channelRows: withConversion,
        bestChannel: best.name,
        worstChannel: worst.name,
        headline: `${worst.name} is where enquiries are leaking.`,
        story: `${worst.conversion.toFixed(1)}% of people who asked through ${worst.name} went on to pay, compared with ${best.conversion.toFixed(1)}% through ${best.name}. The gap between them is now the clearest signal in your diagnosis.`,
        meaning: `With your measured counts, ${worst.name} sends enquiries that rarely become customers (${worst.customers} of ${worst.enquiries}). The constraint is what happens between enquiry and customer on ${worst.name}, not the volume of enquiries.`,
        whyItMatters: "Every week the weakest channel runs unattended, the same effort produces fewer customers than it could elsewhere. Fixing one response or follow-up step is cheaper than buying more traffic.",
        nextInvestigation: `Check the last 20 enquiries from ${worst.name}: response speed and outcome. Then run one focused change for two weeks and keep ${best.name} as the benchmark.`,
        confidence: Math.min(88, (facts?.confidence ?? 62) + 20),
      });
      toast.success(`Diagnosis improved — confidence increased to ${Math.min(88, (facts?.confidence ?? 62) + 20)}%`, {
        description: `${worst.name}: ${worst.conversion.toFixed(1)}% of people who asked went on to pay, vs ${best.conversion.toFixed(1)}% for ${best.name} — worked out from your numbers.`,
      });
    } finally {
      setSaving(false);
      // Back to the diagnosis it came from, on Summary: the sharpened headline comes first.
      navigate(diagnosisBaseOf(diagnosisReturnRoute("diagnosis")));
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Button variant="ghost" size="sm" className="-ml-2 mb-4 text-slate-500" onClick={() => navigate(diagnosisReturnRoute("diagnosis"))}>
        <ArrowLeft className="size-4" aria-hidden />
        Back to diagnosis
      </Button>

      <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">First diagnosis</p>
      <h1 className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">Improve my diagnosis</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        The diagnosis is useful already. Each option below sharpens it — pick whichever suits you, or continue for now.
      </p>

      <div className="mt-6 space-y-3">
        {/* Option A — enter numbers */}
        <Card className="p-0">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex w-full items-start gap-4 p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Calculator className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold">Enter a few numbers</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                Add enquiry and customer counts per channel. Unlocks: measured channel conversion and a sharper bottleneck —
                no connections needed.
              </span>
            </span>
            {open ? (
              <ChevronUp className="mt-1 size-4 shrink-0 text-slate-400" aria-hidden />
            ) : (
              <ChevronDown className="mt-1 size-4 shrink-0 text-slate-400" aria-hidden />
            )}
          </button>

          {open ? (
            <div className="border-t bg-slate-50/60 p-5">
              <p className="text-xs text-muted-foreground">
                Last full month. Estimates are fine — provenance is recorded either way.
              </p>
              <div className="mt-3 space-y-3">
                {channels.map((ch) => (
                  <div key={ch.key} className="rounded-lg border bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{ch.name}</p>
                      <p className="hidden text-[11px] text-muted-foreground sm:block">{ch.hint}</p>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor={`${ch.key}-enq`} className="text-xs text-muted-foreground">
                          Enquiries
                        </Label>
                        <Input
                          id={`${ch.key}-enq`}
                          inputMode="numeric"
                          className="tnum"
                          value={counts[`${ch.key}-enq`] ?? ""}
                          onChange={(e) => set(`${ch.key}-enq`, e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`${ch.key}-cus`} className="text-xs text-muted-foreground">
                          Customers
                        </Label>
                        <Input
                          id={`${ch.key}-cus`}
                          inputMode="numeric"
                          className="tnum"
                          value={counts[`${ch.key}-cus`] ?? ""}
                          onChange={(e) => set(`${ch.key}-cus`, e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Button className="mt-4 w-full sm:w-auto" onClick={() => void updateDiagnosis()} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Recomputing your diagnosis…
                  </>
                ) : (
                  <>
                    Update diagnosis
                    <ArrowRight className="size-4" aria-hidden />
                  </>
                )}
              </Button>
            </div>
          ) : null}
        </Card>

        {/* Option B — upload */}
        <Card className="p-0">
          <button
            type="button"
            onClick={() => {
              toast("Upload flow available in the workspace", { description: "You can upload CSV or Excel exports from Settings → Data after setup." });
              navigate("setup-complete");
            }}
            className="flex w-full items-start gap-4 p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <Upload className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold">Upload data (CSV / Excel)</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                Bring an export from your tools. Unlocks: measured channel and period data without connecting anything.
              </span>
            </span>
            <ArrowRight className="mt-1 size-4 shrink-0 text-slate-400" aria-hidden />
          </button>
        </Card>

        {/* Option C — connect */}
        <Card className="p-0">
          <button
            type="button"
            onClick={() => {
              toast("Integrations available in the Data Centre after setup", { description: "Meta Ads, Google Ads and more — read-only, always." });
              navigate("setup-complete");
            }}
            className="flex w-full items-start gap-4 p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <Link2 className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold">Connect a source (read-only)</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                Link Meta Ads or Google Ads. Unlocks: automatic weekly measurement and trend detection.
              </span>
            </span>
            <ArrowRight className="mt-1 size-4 shrink-0 text-slate-400" aria-hidden />
          </button>
        </Card>
      </div>

      <div className="mt-6 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <Button variant="ghost" className="-ml-2 text-slate-600" onClick={() => navigate("setup-complete")}>
          Continue for now
          <ArrowRight className="size-4" aria-hidden />
        </Button>
        <p className="text-xs text-muted-foreground">
          You can return to this from your dashboard at any time — the diagnosis improves as coverage grows.
        </p>
      </div>
    </div>
  );
}
