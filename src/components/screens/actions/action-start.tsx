"use client";
// Screen 40 — Start Action / Implementation Setup.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ConfidenceBadge, ImpactBadge } from "@/components/shared/badges";
import { InfoBanner, PageHeader, SectionCard } from "@/components/shared/layout";
import { recommendationById } from "@/lib/data/intelligence";
import { TEAM } from "@/lib/data/operations";
import { useBizz } from "@/lib/store";
import type { ScreenProps } from "../view-types";
import { categoryForRecId } from "./helpers";

const OWNER_OPTIONS = TEAM.map((m) => `${m.name} (${m.jobTitle})`);

export function ActionStart({ params }: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);
  const startAction = useBizz((s) => s.startAction);
  const updateAction = useBizz((s) => s.updateAction);

  const rec = recommendationById(params.id);
  const category = rec ? categoryForRecId(rec.id) : null;

  const [title, setTitle] = useState(rec?.title ?? "");
  const [owner, setOwner] = useState(OWNER_OPTIONS[0]);
  const [due, setDue] = useState("2026-10-15");
  const [approach, setApproach] = useState(rec ? rec.tasks.map((t) => `• ${t}`).join("\n") : "");
  const [metric, setMetric] = useState(rec?.primaryMetric ?? "");
  const [period, setPeriod] = useState(String(rec ? parseInt(rec.measurementWindow, 10) || 30 : 30));
  const [notes, setNotes] = useState("");
  // Default to an experiment except for data-tracking work, where the tracking
  // setup is the action itself.
  const [asExperiment, setAsExperiment] = useState(rec ? category !== "Data" : true);

  const valid = Boolean(title.trim() && owner && due);

  const submit = () => {
    if (!valid) return;
    const newId = startAction({
      recommendationId: rec?.id ?? "manual",
      title: title.trim(),
      owner,
      due,
      asExperiment,
      notes: notes.trim() || undefined,
    });
    const metricValue = metric.trim();
    const steps = approach
      .split("\n")
      .map((l) => l.replace(/^[•\-\s]+/, "").trim())
      .filter(Boolean);
    if (metricValue || steps.length) {
      updateAction(newId, {
        ...(metricValue ? { metric: metricValue } : {}),
        ...(steps.length ? { checklist: steps.map((label) => ({ label, done: false })) } : {}),
      });
    }
    if (asExperiment) navigate(`experiment-setup/${newId}`);
    else navigate(`actions/${newId}`);
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="Start action"
        description={
          rec
            ? "Turn this recommendation into trackable work with an owner, a due date and a success metric."
            : "Create trackable work manually. You can attach evidence later from the Action Centre."
        }
        back={
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 mb-2"
            onClick={() => navigate(rec ? `recommendations/${rec.id}` : "actions")}
          >
            {rec ? "Back to recommendation" : "Back to Action Centre"}
          </Button>
        }
      />

      {rec && (
        <SectionCard title="Recommendation origin" className="mb-5">
          <p className="text-sm font-medium">{rec.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{rec.recommendation}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ImpactBadge impact={rec.impact} />
            <ConfidenceBadge
              level={rec.confidence >= 75 ? "high" : rec.confidence >= 50 ? "medium" : "low"}
              value={rec.confidence}
            />
          </div>
        </SectionCard>
      )}

      <SectionCard title="Implementation setup">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="action-title">Action title *</Label>
            <Input
              id="action-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What will be done?"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="action-owner">Owner *</Label>
            <Select value={owner} onValueChange={setOwner}>
              <SelectTrigger id="action-owner" className="mt-1.5 w-full">
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
          <div>
            <Label htmlFor="action-due">Due date *</Label>
            <Input id="action-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="action-metric">Success metric</Label>
            <Input
              id="action-metric"
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              placeholder="e.g. Instagram enquiry → customer conversion"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="action-period">Measurement period</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger id="action-period" className="mt-1.5 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="14">14 days</SelectItem>
                <SelectItem value="21">21 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="action-approach">Implementation approach</Label>
            <Textarea
              id="action-approach"
              rows={5}
              value={approach}
              onChange={(e) => setApproach(e.target.value)}
              placeholder="How will this be carried out? One step per line."
              className="mt-1.5"
            />
            <p className="mt-1 text-xs text-muted-foreground">Each line becomes a step on the action checklist.</p>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="action-notes">Notes</Label>
            <Textarea
              id="action-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Context the team should know (optional)."
              className="mt-1.5"
            />
          </div>
          <div className="sm:col-span-2">
            <div className="flex items-start gap-3 rounded-xl border p-4">
              <Checkbox
                id="as-experiment"
                checked={asExperiment}
                onCheckedChange={(v) => setAsExperiment(v === true)}
                className="mt-0.5"
              />
              <div>
                <Label htmlFor="as-experiment" className="font-medium">
                  Create as experiment
                </Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Opens a measurement window with a baseline and a target, so the result is interpreted honestly.
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Button disabled={!valid} onClick={submit}>
            Start action
          </Button>
          <Button variant="ghost" onClick={() => navigate(rec ? `recommendations/${rec.id}` : "actions")}>
            Cancel
          </Button>
          {!valid && <span className="text-xs text-muted-foreground">Title, owner and due date are required.</span>}
        </div>
      </SectionCard>

      <div className="mt-5">
        <InfoBanner tone="info" title="What happens next">
          {asExperiment
            ? "After setup, you define the experiment: hypothesis, baseline, target and the other changes to watch during the window."
            : "The action appears in the Action Centre, where its checklist, notes and status can be tracked."}
        </InfoBanner>
      </div>
    </div>
  );
}
