"use client";
// Screen 16 — What We Understand About Your Business.
// The structured Business Brain summary with provenance on every fact.

import React from "react";
import { ArrowRight, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ProvenanceBadge } from "@/components/shared/badges";
import { ProvenanceLegend } from "@/components/shared/evidence";
import type { ScreenProps } from "../view-types";
import { useBizz } from "@/lib/store";
import type { Provenance } from "@/lib/types";

interface Fact {
  section: string;
  value: string;
  provenance: Provenance;
  source: string;
}

export default function BusinessUnderstanding(_props: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const businessName = userWorkspace?.name ?? "Your business";

  const facts: Fact[] = [
    {
      section: "Business",
      value: `${businessName} — a service business in ${userWorkspace?.country ?? "Nigeria"}`,
      provenance: "user-supplied",
      source: "Workspace setup",
    },
    {
      section: "What you sell",
      value: "Cleaning packages for homes and small offices",
      provenance: "ai-interpretation",
      source: "Interpreted from your checkup conversation",
    },
    {
      section: "Primary goal",
      value: "Convert more of the enquiries you already generate",
      provenance: "ai-interpretation",
      source: "Interpreted from your checkup conversation",
    },
    {
      section: "Customers",
      value: "Households and small offices, mostly found via Instagram and referrals",
      provenance: "user-supplied",
      source: "Your checkup conversation",
    },
    {
      section: "Customer journey",
      value: "Discovery → Website / WhatsApp → Enquiry → Quote → Customer",
      provenance: "ai-interpretation",
      source: "Proposed in the journey you reviewed",
    },
    {
      section: "Acquisition channels",
      value: "Instagram, Google Search, Referrals",
      provenance: "user-supplied",
      source: "Your checkup conversation",
    },
    {
      section: "Known performance changes",
      value: "Enquiries up about 50% last month; customers up only slightly; revenue roughly flat",
      provenance: "estimated",
      source: "Your directional estimates",
    },
    {
      section: "Known recent changes",
      value: "Instagram ad spend increased; no other major changes reported",
      provenance: "user-supplied",
      source: "Your checkup conversation",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">Business Brain — first pass</p>
      <h1 className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">What we understand about your business</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        This is the working model the AI reasons over. Every fact carries its source — correct anything that looks wrong.
      </p>

      <Card className="mt-6 p-0">
        <ul>
          {facts.map((f, i) => (
            <li key={f.section}>
              {i > 0 ? <Separator /> : null}
              <div className="flex flex-col gap-1.5 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0 sm:max-w-md">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{f.section}</p>
                  <p className="mt-1 text-sm">{f.value}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{f.source}</p>
                </div>
                <div className="shrink-0">
                  <ProvenanceBadge provenance={f.provenance} source={f.source} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <ProvenanceLegend className="mt-4" />

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" className="w-full sm:w-auto" onClick={() => toast("Editing opens the Business Brain after setup", { description: "For now, continue with this understanding — every fact can be corrected later." })}>
          <Pencil className="size-4" aria-hidden />
          Edit
        </Button>
        <Button className="w-full sm:w-auto" onClick={() => navigate("first-diagnosis")}>
          Looks right, continue
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
