"use client";
// Screen 20 — Setup Complete / Enter Workspace.

import React from "react";
import { ArrowRight, CheckCircle2, PartyPopper, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useBizz } from "@/lib/store";
import type { ScreenProps } from "../view-types";
import { openSampleBusiness, TrustRow } from "./parts";

export default function SetupComplete(_props: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);
  const userWorkspace = useBizz((s) => s.userWorkspace);

  const done = [
    { label: "Business profile", detail: userWorkspace ? `${userWorkspace.name} — ${userWorkspace.country}` : "Your business profile" },
    { label: "Initial diagnosis", detail: "1 investigation found — conversion, not lead generation" },
    { label: "Goal configured", detail: "Convert more of the enquiries you already generate" },
  ];

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
          <PartyPopper className="size-6" aria-hidden />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">Your workspace is ready.</h1>
        <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
          Additional connections improve intelligence over time — add them whenever you are ready, or never. The diagnosis
          already works on what you have told the system.
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
            <CheckCircle2 className="mt-0.5 size-4.5 shrink-0 text-blue-600" aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">Data coverage</p>
                <p className="text-sm font-semibold tnum">42%</p>
              </div>
              <Progress value={42} className="mt-1.5 h-2" aria-label="Data coverage 42 percent" />
              <p className="mt-1.5 text-xs text-muted-foreground">Connections raise this over time — coverage is explained, never hidden.</p>
            </div>
          </li>
        </ul>

        <Separator className="my-5" />

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={() => navigate("home")} className="w-full sm:w-auto">
            Enter Business Overview
            <ArrowRight className="size-4" aria-hidden />
          </Button>
          <Button variant="outline" className="w-full sm:w-auto" onClick={openSampleBusiness}>
            <Sparkles className="size-4 text-violet-600" aria-hidden />
            Explore sample business
          </Button>
        </div>
      </Card>

      <div className="mt-6 rounded-xl border border-violet-200 bg-violet-50/60 p-4">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-violet-800">
          <Sparkles className="size-4" aria-hidden />
          What happens next
        </p>
        <p className="mt-1 text-sm leading-relaxed text-violet-900/90">
          The Business Overview opens with your first diagnosis already active. bizzGrowth will keep watching the numbers
          you provided — and anything you connect later — and surface the next thing worth investigating.
        </p>
      </div>

      <TrustRow className="mt-6" />
    </div>
  );
}
