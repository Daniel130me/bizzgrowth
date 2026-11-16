"use client";
// Screen 69 — Monthly Business Review: professional report-style document.
// Sample reviews exist only for sample workspaces; a user's own workspace gets
// an honest early-state until real data produces a real review.

import React from "react";
import { CheckCircle2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useBizz } from "@/lib/store";
import { getBusiness } from "@/lib/data/businesses";
import { EmptyState } from "@/components/shared/states";
import { BriefDocShell, ExecMetricChip, ExplanationsCard, OpportunityCard, RiskCard, WorkedDidNotGrid, parseMetricBullet } from "./brief-parts";
import { monthlyBriefFor } from "./brief-data";
import type { BriefSection } from "@/lib/types";
import type { ScreenProps } from "../view-types";

const PLAIN_HEADINGS = new Set(["Revenue", "Sales", "Sales / orders", "Marketing", "Customers", "Website", "Results measured"]);

export function BriefMonthly({ params: _params }: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);
  const businessId = useBizz((s) => s.businessId);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const aiBrief = useBizz((s) => s.aiBrief);
  const business = getBusiness(businessId, userWorkspace);

  // A real owner's first monthly review is the AI-written one from their own
  // checkup facts — never a sample review carrying someone else's figures.
  if (businessId === "user-workspace") {
    if (aiBrief && aiBrief.kind === "monthly") {
      return (
        <div className="mx-auto w-full max-w-4xl">
          <BriefDocShell brief={aiBrief} businessName={userWorkspace?.name ?? "Your business"} generated={aiBrief.period} shareable={false}>
            {aiBrief.sections.map((s) => (
              <section key={s.heading} className="border-t pt-6">
                <h2 className="text-base font-semibold">{s.heading}</h2>
                <div className="mt-3 space-y-3">
                  {s.paragraphs?.map((p, i) => (
                    <p key={i} className="text-[15px] leading-7 text-slate-700">{p}</p>
                  ))}
                  {s.bullets?.map((b, i) => (
                    <p key={i} className="text-[15px] leading-7 text-slate-700">· {b}</p>
                  ))}
                </div>
              </section>
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
            title="Your first monthly review isn't written yet"
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

  const brief = monthlyBriefFor(business);

  const exec = brief.sections.find((s) => s.heading === "Executive summary");
  const worked = brief.sections.find((s) => s.heading === "What worked");
  const didNot = brief.sections.find((s) => s.heading === "What did not");
  const explanations = brief.sections.find((s) => s.heading === "Likely explanations");
  const opportunity = brief.sections.find((s) => s.heading === "Biggest opportunity");
  const risk = brief.sections.find((s) => s.heading === "Biggest risk");
  const actionsDone = brief.sections.find((s) => s.heading === "Actions completed");
  const priorities = brief.sections.find((s) => s.heading === "Priorities for next month");

  const handledElsewhere = new Set([
    exec?.heading,
    worked?.heading,
    didNot?.heading,
    explanations?.heading,
    opportunity?.heading,
    risk?.heading,
    actionsDone?.heading,
    priorities?.heading,
  ]);

  const plain = (s: BriefSection) => (
    <section className="border-t pt-6">
      <h2 className="text-base font-semibold">{s.heading}</h2>
      <div className="mt-3 space-y-3">
        {s.paragraphs?.map((p, i) => (
          <p key={i} className="text-[15px] leading-7 text-slate-700">
            {p}
          </p>
        ))}
      </div>
    </section>
  );

  return (
    <BriefDocShell brief={brief} businessName={business.name} generated="Oct 1, 2026">
      {exec ? (
        <section>
          <h2 className="text-base font-semibold">Executive summary</h2>
          {exec.paragraphs?.map((p, i) => (
            <p key={i} className="mt-3 text-[15px] leading-7 text-slate-700">
              {p}
            </p>
          ))}
          {exec.bullets?.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {exec.bullets.map((b, i) => {
                const parsed = parseMetricBullet(b);
                return parsed ? <ExecMetricChip key={i} metric={parsed} /> : <span key={i} className="text-sm text-slate-700">· {b}</span>;
              })}
            </div>
          ) : null}
        </section>
      ) : null}

      {brief.sections.map((s) => {
        if (s.heading && handledElsewhere.has(s.heading)) return null;
        if (PLAIN_HEADINGS.has(s.heading)) return <React.Fragment key={s.heading}>{plain(s)}</React.Fragment>;
        return (
          <section key={s.heading} className="border-t pt-6">
            <h2 className="text-base font-semibold">{s.heading}</h2>
            <div className="mt-3 space-y-3">
              {s.paragraphs?.map((p, i) => (
                <p key={i} className="text-[15px] leading-7 text-slate-700">
                  {p}
                </p>
              ))}
              {s.bullets?.map((b, i) => (
                <p key={i} className="text-[15px] leading-7 text-slate-700">
                  · {b}
                </p>
              ))}
            </div>
          </section>
        );
      })}

      {worked && didNot ? <WorkedDidNotGrid worked={worked} didNot={didNot} /> : null}
      {explanations ? <ExplanationsCard>{explanations.paragraphs?.[0]}</ExplanationsCard> : null}
      {opportunity ? <OpportunityCard>{opportunity.paragraphs?.[0]}</OpportunityCard> : null}
      {risk ? <RiskCard>{risk.paragraphs?.[0]}</RiskCard> : null}

      {actionsDone ? (
        <section className="border-t pt-6">
          <h2 className="text-base font-semibold">Actions completed</h2>
          <ul className="mt-3 space-y-2">
            {(actionsDone.bullets ?? []).map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-[15px] leading-7 text-slate-700">
                <CheckCircle2 className="mt-1.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                {b}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {priorities ? (
        <section className="border-t pt-6">
          <h2 className="text-base font-semibold">Priorities for next month</h2>
          <ol className="mt-3 space-y-2">
            {(priorities.bullets ?? []).map((b, i) => (
              <li key={i} className="flex items-start gap-3 text-[15px] leading-7 text-slate-700">
                <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold tnum">{i + 1}</span>
                {b}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </BriefDocShell>
  );
}
