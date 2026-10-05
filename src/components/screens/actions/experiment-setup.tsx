"use client";
// Screen 42 — Experiment Setup.

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/shared/badges";
import { InfoBanner, PageHeader, SectionCard } from "@/components/shared/layout";
import { getBusiness } from "@/lib/data/businesses";
import { recommendationById } from "@/lib/data/intelligence";
import { TEAM } from "@/lib/data/operations";
import { useBizz } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { ScreenProps } from "../view-types";
import { useCombinedActions, useCombinedExperiments } from "./helpers";

// Known baseline/target pairs from the shared dataset — never invented.
const BASELINE_BY_REC: Record<string, string> = { "rec-sh-1": "6.0%", "rec-kh-1": "48%" };
const TARGET_BY_REC: Record<string, string> = { "rec-sh-1": "10%", "rec-kh-1": "65%" };
const OWNER_OPTIONS = TEAM.map((m) => `${m.name} (${m.jobTitle})`);

export function ExperimentSetup({ params }: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);
  const businessId = useBizz((s) => s.businessId);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const createExperiment = useBizz((s) => s.createExperiment);

  const actions = useCombinedActions(businessId);
  const experiments = useCombinedExperiments(businessId);
  const business = getBusiness(businessId, userWorkspace);

  const action = actions.find((a) => a.id === params.id);
  const rec = recommendationById(params.id) ??
    (action?.recommendationId ? recommendationById(action.recommendationId) : undefined);
  const existing = action ? experiments.find((e) => e.actionId === action.id) : undefined;

  const [title, setTitle] = useState(existing?.title ?? action?.title ?? rec?.title ?? "");
  const [hypothesis, setHypothesis] = useState(
    existing?.hypothesis ?? (rec ? `If we complete this action, ${rec.primaryMetric.toLowerCase()} will improve.` : ""),
  );
  const [change, setChange] = useState(existing?.change ?? action?.title ?? rec?.recommendation ?? "");
  const [baseline, setBaseline] = useState(existing?.baseline ?? (rec ? BASELINE_BY_REC[rec.id] ?? "" : ""));
  const [target, setTarget] = useState(existing?.target ?? (rec ? TARGET_BY_REC[rec.id] ?? "" : ""));
  const [windowDays, setWindowDays] = useState(String(existing?.windowDays ?? 30));
  const [startDate, setStartDate] = useState(existing?.startedAt ?? "2026-10-01");
  const [owner, setOwner] = useState(existing?.owner ?? action?.owner ?? OWNER_OPTIONS[0]);
  const [watch, setWatch] = useState<string[]>(existing?.watchMetrics ?? []);

  const candidates = useMemo(() => {
    const base =
      business.type === "ecommerce"
        ? ["Orders", "Revenue", "Payment failure rate", "Average order value", "Traffic by device"]
        : ["Customers", "Revenue", "Response time", "CAC by channel", "Enquiries per week"];
    return Array.from(new Set([...(existing?.watchMetrics ?? []), ...base]));
  }, [business.type, existing]);

  const valid = Boolean(title.trim() && hypothesis.trim() && change.trim() && baseline.trim() && target.trim() && owner);

  const submit = () => {
    if (!valid) return;
    const newId = createExperiment({
      actionId: action?.id,
      title: title.trim(),
      hypothesis: hypothesis.trim(),
      change: change.trim(),
      baseline: baseline.trim(),
      target: target.trim(),
      windowDays: Number(windowDays) || 30,
      owner,
      watchMetrics: watch,
    });
    navigate(`experiments/${newId}`);
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="Set up experiment"
        description="Define the hypothesis, baseline and target before the measurement window opens — results are only as honest as the setup."
        back={
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 mb-2"
            onClick={() => navigate(action ? `actions/${action.id}` : "actions")}
          >
            {action ? "Back to action" : "Back to Action Centre"}
          </Button>
        }
      />

      {action && (
        <SectionCard title="Action being tested" className="mb-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{action.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">Owner: {action.owner}</p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={action.status} />
              <Button variant="outline" size="sm" onClick={() => navigate(`actions/${action.id}`)}>
                View action
              </Button>
            </div>
          </div>
        </SectionCard>
      )}

      <div className="mb-5">
        <InfoBanner tone="ai" title="Honest measurement">
          We watch for other changes during the window so results are interpreted honestly. The outcome page records every
          other change we detect — and never assumes the recommendation caused the result.
        </InfoBanner>
      </div>

      <SectionCard title="Experiment definition">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="exp-title">Experiment name *</Label>
            <Input
              id="exp-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="A short name for this test"
              className="mt-1.5"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="exp-hypothesis">Hypothesis *</Label>
            <Textarea
              id="exp-hypothesis"
              rows={3}
              value={hypothesis}
              onChange={(e) => setHypothesis(e.target.value)}
              placeholder="e.g. Responding within 30 minutes improves Instagram conversion."
              className="mt-1.5"
            />
            <p className="mt-1 text-xs text-muted-foreground">State it as: doing X will improve Y.</p>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="exp-change">Change being tested *</Label>
            <Textarea
              id="exp-change"
              rows={2}
              value={change}
              onChange={(e) => setChange(e.target.value)}
              placeholder="Exactly what will change, so the window can be judged fairly."
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="exp-baseline">Baseline metric value *</Label>
            <Input
              id="exp-baseline"
              value={baseline}
              onChange={(e) => setBaseline(e.target.value)}
              placeholder='e.g. "6.0%" or "₦5,638"'
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="exp-target">Target value *</Label>
            <Input
              id="exp-target"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder='e.g. "10%"'
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="exp-window">Measurement window</Label>
            <Select value={windowDays} onValueChange={setWindowDays}>
              <SelectTrigger id="exp-window" className="mt-1.5 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="21">21 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="exp-start">Start date</Label>
            <Input
              id="exp-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="exp-owner">Owner *</Label>
            <Select value={owner} onValueChange={setOwner}>
              <SelectTrigger id="exp-owner" className="mt-1.5 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OWNER_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Other metrics to watch</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Selected metrics are tracked alongside the primary metric — a result explained by something else is not a result.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {candidates.map((m) => {
                const checked = watch.includes(m);
                return (
                  <label
                    key={m}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                      checked ? "border-blue-300 bg-blue-50 text-blue-800" : "bg-white text-slate-600 hover:border-slate-300",
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => setWatch(v === true ? [...watch, m] : watch.filter((x) => x !== m))}
                      aria-label={`Watch ${m}`}
                    />
                    {m}
                  </label>
                );
              })}
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Button disabled={!valid} onClick={submit}>
            Create experiment
          </Button>
          <Button variant="ghost" onClick={() => navigate(action ? `actions/${action.id}` : "actions")}>
            Cancel
          </Button>
          {!valid && (
            <span className="text-xs text-muted-foreground">Name, hypothesis, change, baseline, target and owner are required.</span>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
