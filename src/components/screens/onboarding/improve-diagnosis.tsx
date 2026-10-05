"use client";
// Screen 19 — Improve My Diagnosis. Multiple paths, each explains what it unlocks.

import React, { useState } from "react";
import { ArrowLeft, ArrowRight, Calculator, ChevronDown, ChevronUp, Link2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBizz } from "@/lib/store";
import type { ScreenProps } from "../view-types";

const CHANNELS = [
  { name: "Instagram", hint: "Most enquiries, fewest customers per enquiry" },
  { name: "Google Search", hint: "Smaller volume, strong conversion" },
  { name: "Referral", hint: "Best conversion, no ad spend" },
];

export default function ImproveDiagnosis(_props: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState({
    instagramEnq: "184",
    instagramCus: "11",
    googleEnq: "62",
    googleCus: "24",
    referralEnq: "31",
    referralCus: "14",
  });

  function set(channel: keyof typeof counts, value: string) {
    setCounts((c) => ({ ...c, [channel]: value }));
  }

  function updateDiagnosis() {
    toast.success("Diagnosis improved — confidence increased to 82%", {
      description: "Instagram converts at 6.0% vs 45.2% for referrals — the investigation now has a target.",
    });
    try {
      window.sessionStorage.setItem("bizzg-diag-improved", "1");
    } catch {}
    navigate("first-diagnosis");
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Button variant="ghost" size="sm" className="-ml-2 mb-4 text-slate-500" onClick={() => navigate("first-diagnosis")}>
        <ArrowLeft className="size-4" aria-hidden />
        Back to diagnosis
      </Button>

      <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">First diagnosis</p>
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
            className="flex w-full items-start gap-4 p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
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
                {CHANNELS.map((ch) => (
                  <div key={ch.name} className="rounded-lg border bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{ch.name}</p>
                      <p className="hidden text-[11px] text-muted-foreground sm:block">{ch.hint}</p>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor={`${ch.name}-enq`} className="text-xs text-muted-foreground">
                          Enquiries
                        </Label>
                        <Input
                          id={`${ch.name}-enq`}
                          inputMode="numeric"
                          className="tnum"
                          value={counts[ch.name === "Instagram" ? "instagramEnq" : ch.name === "Google Search" ? "googleEnq" : "referralEnq"]}
                          onChange={(e) =>
                            set(ch.name === "Instagram" ? "instagramEnq" : ch.name === "Google Search" ? "googleEnq" : "referralEnq", e.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`${ch.name}-cus`} className="text-xs text-muted-foreground">
                          Customers
                        </Label>
                        <Input
                          id={`${ch.name}-cus`}
                          inputMode="numeric"
                          className="tnum"
                          value={counts[ch.name === "Instagram" ? "instagramCus" : ch.name === "Google Search" ? "googleCus" : "referralCus"]}
                          onChange={(e) =>
                            set(ch.name === "Instagram" ? "instagramCus" : ch.name === "Google Search" ? "googleCus" : "referralCus", e.target.value)
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Button className="mt-4 w-full sm:w-auto" onClick={updateDiagnosis}>
                Update diagnosis
                <ArrowRight className="size-4" aria-hidden />
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
            className="flex w-full items-start gap-4 p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
            className="flex w-full items-start gap-4 p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
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
