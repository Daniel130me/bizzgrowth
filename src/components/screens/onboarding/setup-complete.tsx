"use client";
// Screen 20 — Setup Complete / Enter Workspace.
// Everything here is derived from the owner's OWN checkup. The "Add data your
// way" section offers the three financial-data paths (type estimates, upload a
// file, connect a service) without making any of them required.

import React from "react";
import { ArrowRight, CheckCircle2, FileSpreadsheet, PartyPopper, PenLine, Plug, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useBizz } from "@/lib/store";
import type { ScreenProps } from "../view-types";
import { openSampleBusiness, TrustRow } from "./parts";

export default function SetupComplete(_props: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const facts = useBizz((s) => s.checkup.facts);
  const diagnosis = useBizz((s) => s.checkup.diagnosis);

  const done: { label: string; detail: string }[] = [
    {
      label: "Business profile",
      detail: userWorkspace ? `${userWorkspace.name} — ${userWorkspace.country}` : "Your business profile",
    },
    {
      label: "What the checkup learned",
      detail: facts?.whatTheySell
        ? `${facts.whatTheySell} · serves ${facts.customers} · via ${facts.channels.slice(0, 3).join(", ")}`
        : "Your business, customers and channels — from your own words",
    },
    {
      label: "First diagnosis",
      detail: diagnosis?.headline ?? "Built from the trends you described — no invented figures",
    },
  ];

  const coverage = Math.round(((facts ? 1 : 0) + (diagnosis ? 1 : 0)) / 2 * 100);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
          <PartyPopper className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">Your workspace is ready.</h1>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          The diagnosis already works on what you told us. If you want it sharper, there are three ways to add real numbers —
          all optional, none required.
        </p>
      </div>

      <Card className="mt-8 p-6">
        <h2 className="text-sm font-semibold">Setup summary</h2>
        <ul className="mt-4 space-y-3.5">
          {done.map((d) => (
            <li key={d.label} className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 size-4.5 shrink-0 text-emerald-600" aria-hidden />
              <div>
                <p className="text-sm font-medium">{d.label}</p>
                <p className="text-xs text-muted-foreground">{d.detail}</p>
              </div>
            </li>
          ))}
          <li className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-4.5 shrink-0 text-brand-600" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">Checkup coverage</p>
                <p className="text-sm font-semibold tnum">{coverage}%</p>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Based on what you have told us so far. Measured data — entered or connected — raises it further; nothing is
                assumed in the meantime.
              </p>
            </div>
          </li>
        </ul>

        <div className="mt-6 rounded-xl border border-brand-100 bg-brand-50/50 p-4">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-900">Add data your way — optional, anytime</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => navigate("manual-entry")}
              className="group flex flex-col items-start rounded-lg border border-brand-100 bg-white p-3 text-left transition-colors hover:border-brand-300"
            >
              <PenLine className="size-4 text-brand-700" aria-hidden />
              <span className="mt-1.5 text-sm font-medium">Type your totals</span>
              <span className="text-[11px] leading-snug text-muted-foreground">Monthly figures, exact or estimated</span>
            </button>
            <button
              type="button"
              onClick={() => navigate("csv-upload")}
              className="group flex flex-col items-start rounded-lg border border-brand-100 bg-white p-3 text-left transition-colors hover:border-brand-300"
            >
              <FileSpreadsheet className="size-4 text-brand-700" aria-hidden />
              <span className="mt-1.5 text-sm font-medium">Upload a file</span>
              <span className="text-[11px] leading-snug text-muted-foreground">Bring a CSV export from your tool</span>
            </button>
            <button
              type="button"
              onClick={() => navigate("integrations")}
              className="group flex flex-col items-start rounded-lg border border-brand-100 bg-white p-3 text-left transition-colors hover:border-brand-300"
            >
              <Plug className="size-4 text-brand-700" aria-hidden />
              <span className="mt-1.5 text-sm font-medium">Connect a service</span>
              <span className="text-[11px] leading-snug text-muted-foreground">Meta, Google, Shopify, Paystack — read-only</span>
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button onClick={() => navigate("home")} className="w-full sm:w-auto">
            Enter Business Overview
            <ArrowRight className="size-4" aria-hidden />
          </Button>
          <Button variant="outline" className="w-full sm:w-auto" onClick={openSampleBusiness}>
            <Sparkles className="size-4 text-brand-600" aria-hidden />
            Explore sample business
          </Button>
        </div>
      </Card>

      <div className="mt-6 rounded-xl border border-brand-200 bg-brand-50/60 p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-800">
          <Sparkles className="size-4" aria-hidden />
          What happens next
        </p>
        <p className="mt-1 text-sm leading-relaxed text-brand-900/90">
          The Business Overview opens with your first diagnosis already active. Nothing sample or simulated appears there —
          when you add totals, upload data or connect a service, your own numbers take its place.
        </p>
      </div>

      <TrustRow className="mt-6" />
    </div>
  );
}
