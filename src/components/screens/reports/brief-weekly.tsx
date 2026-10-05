"use client";
// Screen 68 — Weekly Business Brief: a readable executive brief document.

import React from "react";
import { useBizz } from "@/lib/store";
import { getBusiness } from "@/lib/data/businesses";
import { BriefDocShell, BriefMetricChip, BriefSectionBlock } from "./brief-parts";
import { weeklyBriefFor } from "./brief-data";
import type { ScreenProps } from "../view-types";

export function BriefWeekly({ params: _params }: ScreenProps) {
  const businessId = useBizz((s) => s.businessId);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const business = getBusiness(businessId, userWorkspace);
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
