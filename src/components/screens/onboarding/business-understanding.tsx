"use client";
// Screen 16 — What We Understand About Your Business.
// Renders the AI-extracted Business Brain model from the checkup conversation
// (store.checkup.facts) with provenance on every fact. Falls back to the
// workspace-setup-only view when no checkup facts exist yet.
import { ArrowRight, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ProvenanceBadge } from "@/components/shared/badges";
import { ProvenanceLegend } from "@/components/shared/evidence";
import type { ScreenProps } from "../view-types";
import { useBizz } from "@/lib/store";
import type { CheckupFact } from "@/lib/checkup";
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
  const checkupFacts = useBizz((s) => s.checkup.facts);
  const businessName = userWorkspace?.name ?? "Your business";

  // The AI-built model from the checkup conversation — the owner's answers,
  // as understood by the engine. Workspace setup supplies the first row.
  const aiFacts: Fact[] | null = checkupFacts
    ? [
        {
          section: "Business",
          value: `${businessName} — a ${checkupFacts.businessType} business in ${userWorkspace?.country ?? "Nigeria"}`,
          provenance: "user-supplied",
          source: "Workspace setup",
        } as Fact,
        ...checkupFacts.facts
          .filter((f: CheckupFact) => f.section !== "Business")
          .map((f: CheckupFact) => ({
            section: f.section,
            value: f.value,
            provenance: f.provenance,
            source: f.source,
          })),
      ]
    : null;

  const facts: Fact[] = aiFacts ?? [
    {
      section: "Business",
      value: `${businessName} — a service business in ${userWorkspace?.country ?? "Nigeria"}`,
      provenance: "user-supplied",
      source: "Workspace setup",
    },
    {
      section: "What you sell",
      value: "Complete the private checkup so the Context Engine can build this from your answers",
      provenance: "ai-interpretation",
      source: "Waiting for your checkup conversation",
    },
    {
      section: "Primary goal",
      value: "Collected during the private checkup",
      provenance: "ai-interpretation",
      source: "Waiting for your checkup conversation",
    },
    {
      section: "Acquisition channels",
      value: "Collected during the private checkup",
      provenance: "user-supplied",
      source: "Waiting for your checkup conversation",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">Business Brain — first pass</p>
      <h1 className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">What we understand about your business</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {aiFacts
          ? "Built by the Context Engine from your checkup answers — the working model the AI reasons over. Every fact carries its source; correct anything that looks wrong."
          : "This is the working model the AI reasons over. Complete the private checkup so every fact is built from your answers."}
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
