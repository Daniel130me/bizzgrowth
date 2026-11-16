"use client";
// Screen 68 — Weekly Business Brief: a readable executive brief document.
// Sample briefs exist only for sample workspaces; a user's own workspace gets
// an honest early-state until real data produces a real brief.

import React from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useBizz } from "@/lib/store";
import { getBusiness } from "@/lib/data/businesses";
import { EmptyState } from "@/components/shared/states";
import { BriefDocShell, BriefMetricChip, BriefSectionBlock } from "./brief-parts";
import { weeklyBriefFor } from "./brief-data";
import type { ScreenProps } from "../view-types";

export function BriefWeekly({ params: _params }: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);
  const businessId = useBizz((s) => s.businessId);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const aiBrief = useBizz((s) => s.aiBrief);
  const business = getBusiness(businessId, userWorkspace);

  // A real owner's first weekly brief is the AI-written one from their own
  // checkup facts — never a sample brief carrying someone else's figures.
  if (businessId === "user-workspace") {
    if (aiBrief && aiBrief.kind === "weekly") {
      const thisWeek = aiBrief.sections.find((s) => s.heading === "This week");
      const rest = aiBrief.sections.filter((s) => s.heading !== "This week");
      return (
        <div className="mx-auto w-full max-w-4xl">
          <BriefDocShell brief={aiBrief} businessName={userWorkspace?.name ?? "Your business"} generated={aiBrief.period} shareable={false}>
            {thisWeek?.paragraphs?.length ? (
              <section>
                <h2 className="text-base font-semibold">{thisWeek.heading}</h2>
                {thisWeek.paragraphs.map((p, i) => (
                  <p key={i} className="mt-2 text-sm leading-relaxed text-slate-700">{p}</p>
                ))}
              </section>
            ) : null}
            {rest.map((s) => (
              <BriefSectionBlock key={s.heading} section={s} businessId={businessId} />
            ))}
          </BriefDocShell>
        </div>
      );
    }
    return (
      <div className="mx-auto w-full max-w-4xl">
        <Card className="p-8">
          <EmptyState
            icon={<FileText className="size-5" />}
            title="Your first weekly brief isn't written yet"
            description={`Generate it with AI from your checkup answers, or add real numbers — entered totals, an upload or a connected source. Nothing is drafted from sample data for ${userWorkspace?.name ?? "your workspace"}.`}
            actions={
              <>
                <Button size="sm" onClick={() => navigate("reports")}>Generate it in Reports</Button>
                <Button size="sm" variant="outline" onClick={() => navigate("manual-entry")}>Enter your totals</Button>
              </>
            }
          />
        </Card>
      </div>
    );
  }

  const brief = weeklyBriefFor(business);

  const thisWeek = brief.sections.find((s) => s.heading === "This week");
  const rest = brief.sections.filter((s) => s.heading !== "This week");

  return (
    <BriefDocShell brief={brief} businessName={business.name} generated="Sep 28, 2026" shareable>
      {thisWeek?.metrics ? (
        <section>
          <h2 className="text-base font-semibold">This week</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {thisWeek.metrics.map((m) => (
              <BriefMetricChip key={m.label} label={m.label} value={m.value} note={m.note} goodness={m.goodness} />
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Chip colour reflects whether the movement is good or bad for the business — not simply up or down.
          </p>
        </section>
      ) : null}
      {rest.map((s) => (
        <BriefSectionBlock key={s.heading} section={s} businessId={businessId} />
      ))}
    </BriefDocShell>
  );
}
