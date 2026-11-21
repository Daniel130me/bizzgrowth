"use client";
// Screen 13 — Private Business Checkup introduction.
// Sets expectations honestly before the conversational checkup starts.

import React from "react";
import { ArrowRight, Calculator, Clock, FileSpreadsheet, Link2, PenLine, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useBizz } from "@/lib/store";
import type { ScreenProps } from "../view-types";
import { DemoBusinessButton, TrustRow } from "./parts";

const POINTS = [
  { icon: Clock, title: "Takes only a few minutes", body: "A short conversation, not a 12-step form." },
  { icon: Calculator, title: "Exact financial figures are optional", body: "Directions and rough estimates are enough for a first diagnosis." },
  { icon: ArrowRight, title: "Estimates are acceptable", body: "Imprecise answers still produce useful intelligence — provenance is tracked." },
  { icon: PenLine, title: "Happy to share numbers or files?", body: "During or after the checkup you can enter monthly figures, upload a CSV, or connect a service like Meta Ads or Shopify." },
  { icon: Target, title: "The purpose is understanding", body: "Enough context to produce insight that is useful on day one." },
];

export default function CheckupIntro(_props: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);
  const userWorkspace = useBizz((s) => s.userWorkspace);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Private business checkup</p>
      <h1 className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">
        Get your first diagnosis without connecting any accounts.
      </h1>
      {userWorkspace ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Checkup for <span className="font-medium text-foreground">{userWorkspace.name}</span> — {userWorkspace.country}.
        </p>
      ) : null}

      <Card className="mt-6 p-6">
        <ul className="space-y-4">
          {POINTS.map((p) => (
            <li key={p.title} className="flex items-start gap-3">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <p.icon className="size-4" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold">{p.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{p.body}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-col gap-2 border-t pt-5 sm:flex-row">
          <Button onClick={() => navigate("onboarding-chat")} className="w-full sm:w-auto">
            Start checkup
            <ArrowRight className="size-4" aria-hidden />
          </Button>
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => navigate("integrations")}>
            <Link2 className="size-4" aria-hidden />
            Connect data instead
          </Button>
          <DemoBusinessButton className="w-full sm:w-auto" />
        </div>
      </Card>

      <TrustRow className="mt-6" />

      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <FileSpreadsheet className="size-3.5 shrink-0" aria-hidden />
        Prefer spreadsheets? You can upload a CSV or type totals after the checkup — the diagnosis improves either way.
      </p>
    </div>
  );
}
