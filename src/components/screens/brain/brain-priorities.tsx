"use client";
// Screen 76 — Business Goals & Priorities Configuration.
// Rank the five growth priorities and pick the primary goal the AI optimises for.

import { useState } from "react";
import { useBizz } from "@/lib/store";
import { getBusiness } from "@/lib/data/businesses";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SectionCard } from "@/components/shared/layout";
import { ProvenanceBadge } from "@/components/shared/badges";
import { ConfigShell, SaveRow, defaultRankingFor, savedToast, PRIORITY_OPTIONS } from "./parts";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { ScreenProps } from "../view-types";

export function BrainPriorities({ params: _params }: ScreenProps) {
  const businessId = useBizz((s) => s.businessId);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const business = getBusiness(businessId, userWorkspace);

  const [store, setStore] = useState<{ owner: string; ranking: string[]; primary: string } | null>(null);
  const isCurrent = store?.owner === businessId;
  const ranking = isCurrent ? store.ranking : defaultRankingFor(business.type);
  const primary = isCurrent ? store.primary : "current";
  const update = (patch: { ranking?: string[]; primary?: string }) => setStore({ owner: businessId, ranking, primary, ...patch });

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= ranking.length) return;
    const next = [...ranking];
    [next[i], next[j]] = [next[j], next[i]];
    update({ ranking: next });
  };

  const save = () => {
    savedToast("Priorities saved — recommendations now weight these higher");
  };

  const radioOptions = [
    { value: "current", label: business.goal, hint: "From your checkup — current primary goal" },
    ...PRIORITY_OPTIONS.map((p) => ({ value: p, label: p, hint: "Standard priority" })),
  ];

  return (
    <ConfigShell
      title="Business goals & priorities"
      description="Strategic context the AI uses when choosing what to diagnose and recommend. Rank what matters most, then confirm the primary goal."
    >
      <SectionCard
        title="Priority ranking"
        description="Rank 1 carries the most weight in recommendations and weekly briefs."
        action={<ProvenanceBadge provenance="user-supplied" source="Conversational checkup" />}
        contentClassName="p-0"
      >
        <ol className="px-5 py-4">
          {ranking.map((item, i) => (
            <li key={item} className="flex items-center gap-3 border-b py-3 first:pt-0 last:border-0 last:pb-0">
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tnum ${
                  i === 0 ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                {i + 1}
              </span>
              <p className="min-w-0 flex-1 text-sm font-medium">{item}</p>
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="ghost" size="icon" className="size-8" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${item.toLowerCase()} up in ranking`}>
                  <ArrowUp className="size-3.5" aria-hidden />
                </Button>
                <Button variant="ghost" size="icon" className="size-8" onClick={() => move(i, 1)} disabled={i === ranking.length - 1} aria-label={`Move ${item.toLowerCase()} down in ranking`}>
                  <ArrowDown className="size-3.5" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      </SectionCard>

      <SectionCard title="Primary goal" description="The single objective the AI optimises for first.">
        <RadioGroup value={primary} onValueChange={(v) => update({ primary: v })} className="gap-2">
          {radioOptions.map((opt) => (
            <div key={opt.value} className="flex items-start gap-3 rounded-xl border p-3.5 transition-colors hover:bg-slate-50/60">
              <RadioGroupItem value={opt.value} id={`goal-${opt.value.replace(/\s+/g, "-").toLowerCase()}`} className="mt-0.5" />
              <div>
                <Label htmlFor={`goal-${opt.value.replace(/\s+/g, "-").toLowerCase()}`} className="cursor-pointer text-sm font-medium leading-snug">
                  {opt.label}
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">{opt.hint}</p>
              </div>
            </div>
          ))}
        </RadioGroup>
      </SectionCard>

      <SaveRow onSave={save} label="Save priorities" note="Ranking influences how strongly recommendations are weighted." />
    </ConfigShell>
  );
}
