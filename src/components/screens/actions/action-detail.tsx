"use client";
// Screen 41 — Action Detail / Progress.

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Breadcrumbs, InfoBanner, KeyValue, PageHeader, SectionCard } from "@/components/shared/layout";
import { EvidencePanel } from "@/components/shared/evidence";
import { ConfidenceBadge, ImpactBadge, StatusBadge } from "@/components/shared/badges";
import { ErrorState } from "@/components/shared/states";
import { recommendationById } from "@/lib/data/intelligence";
import { useBizz, useCoachStep } from "@/lib/store";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ActionRecord } from "@/lib/types";
import type { ScreenProps } from "../view-types";
import { STATUS_LABEL, useCombinedActions, useCombinedExperiments } from "./helpers";
import { OWN_WORKSPACE, StepStatusPill } from "./your-actions";

const STATUS_OPTIONS = ["in-progress", "measuring", "completed"] as const;

export function ActionDetail({ params }: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);
  const businessId = useBizz((s) => s.businessId);
  const updateAction = useBizz((s) => s.updateAction);
  const toggleChecklist = useBizz((s) => s.toggleChecklist);
  const addActionActivity = useBizz((s) => s.addActionActivity);
  const actions = useCombinedActions(businessId);
  const experiments = useCombinedExperiments(businessId);
  const [note, setNote] = useState("");

  const action = actions.find((a) => a.id === params.id);
  // An action from an accepted step: where it stands comes from the step, as on every other screen.
  const coachStep = useCoachStep(action?.coachStepId);

  if (!action) {
    return (
      <ErrorState
        title="Action not found"
        description="This action may belong to another workspace, or the link is out of date."
        onHome={() => navigate("actions")}
      />
    );
  }

  const rec = action.recommendationId ? recommendationById(action.recommendationId) : undefined;
  const linkedExp = experiments.find((e) => e.actionId === action.id);
  const done = action.checklist.filter((c) => c.done).length;
  const pct = action.checklist.length ? Math.round((done / action.checklist.length) * 100) : 0;

  const setStatus = (v: string) => {
    updateAction(action.id, { status: v as ActionRecord["status"] });
    toast.success("Status updated", { description: `"${action.title}" is now ${STATUS_LABEL[v] ?? v}.` });
  };

  const markImplemented = () => {
    updateAction(action.id, { status: "measuring" });
    toast.success("Measurement window started — track it in Experiments", {
      description: linkedExp
        ? "Open the experiment for interim readings."
        : "Create the experiment to record its baseline and target.",
    });
  };

  const addNote = () => {
    const text = note.trim();
    if (!text) return;
    addActionActivity(action.id, `Note: ${text}`);
    setNote("");
    toast.success("Note added to the activity history");
  };

  const importSteps = () => {
    if (!rec) return;
    updateAction(action.id, { checklist: rec.tasks.map((t) => ({ label: t, done: false })) });
    toast.success("Suggested steps added to the checklist");
  };

  return (
    <div>
      <Breadcrumbs
        items={[{ label: businessId === OWN_WORKSPACE ? "Actions" : "Action Centre", onClick: () => navigate("actions") }, { label: action.title }]}
      />
      <PageHeader
        title={action.title}
        badge={coachStep ? <StepStatusPill status={coachStep.status} /> : <StatusBadge status={action.status} />}
        description={coachStep ? "A step you started from your diagnosis." : rec ? `From recommendation: ${rec.title}` : "Created manually in the Action Centre."}
        actions={
          coachStep ? (
            <>
              {coachStep.status === "active" ? (
                <Button variant="outline" onClick={() => navigate(`check-in/${coachStep.id}`)}>
                  Share how it’s going
                </Button>
              ) : null}
              {linkedExp ? (
                <Button variant="outline" onClick={() => navigate(`experiments/${linkedExp.id}`)}>
                  View experiment
                </Button>
              ) : null}
            </>
          ) : (
          <>
            <Select value={action.status} onValueChange={setStatus}>
              <SelectTrigger className="w-[170px]" aria-label="Update status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" disabled={action.status === "measuring"} onClick={markImplemented}>
              Mark implemented
            </Button>
            {linkedExp ? (
              <Button variant="outline" onClick={() => navigate(`experiments/${linkedExp.id}`)}>
                View experiment
              </Button>
            ) : (
              <Button variant="outline" onClick={() => navigate(`experiment-setup/${action.id}`)}>
                Create experiment
              </Button>
            )}
          </>
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Details">
          <div className="space-y-3">
            <KeyValue label="Owner">{action.owner}</KeyValue>
            <KeyValue label="Started">{action.started ? fmtDate(action.started) : "Not recorded"}</KeyValue>
            <KeyValue label="Target date">{fmtDate(action.due)}</KeyValue>
            <KeyValue label="Primary metric">{action.metric || "Not set"}</KeyValue>
          </div>
        </SectionCard>

        <SectionCard
          title="Checklist"
          description={action.checklist.length ? `${done} of ${action.checklist.length} steps complete` : undefined}
        >
          {action.checklist.length > 0 ? (
            <>
              <Progress value={pct} className="mb-3 h-2" />
              <ul className="max-h-96 overflow-y-auto pr-1">
                {action.checklist.map((c, i) => (
                  <li key={i} className="flex items-center gap-3 border-b py-2.5 last:border-0">
                    <Checkbox
                      id={`${action.id}-step-${i}`}
                      checked={c.done}
                      onCheckedChange={() => toggleChecklist(action.id, i)}
                    />
                    <label
                      htmlFor={`${action.id}-step-${i}`}
                      className={cn("cursor-pointer text-sm", c.done && "text-muted-foreground line-through")}
                    >
                      {c.label}
                    </label>
                  </li>
                ))}
              </ul>
            </>
          ) : rec ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-muted-foreground">
                No checklist steps yet. The originating recommendation suggests {rec.tasks.length} steps.
              </p>
              <Button size="sm" variant="outline" onClick={importSteps}>
                Add suggested steps
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No checklist steps were recorded for this action.</p>
          )}
        </SectionCard>

        <SectionCard title="Notes" description="Notes are recorded in the activity history below.">
          <p className="text-sm leading-relaxed">{action.notes || "No notes yet."}</p>
          <div className="mt-4 flex gap-2">
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addNote();
              }}
              placeholder="Add a note…"
              aria-label="Add note"
            />
            <Button variant="outline" disabled={!note.trim()} onClick={addNote}>
              Add note
            </Button>
          </div>
        </SectionCard>

        <SectionCard title="Activity history">
          <ul className="max-h-96 space-y-3 overflow-y-auto pr-1">
            {action.activity.map((a, i) => (
              <li key={i} className="flex gap-3 text-sm">
                <span className="w-24 shrink-0 text-xs text-muted-foreground tnum">{fmtDate(a.date)}</span>
                <span>{a.text}</span>
              </li>
            ))}
          </ul>
        </SectionCard>

        <SectionCard
          title="Evidence"
          description={rec ? "From the originating diagnosis." : undefined}
          className="lg:col-span-2"
        >
          {rec ? (
            <>
              <EvidencePanel
                items={rec.evidence}
                onOpenFact={(factId) => {
                  if (factId) navigate(`provenance/${factId}`);
                }}
              />
              <Button variant="ghost" size="sm" className="mt-3" onClick={() => navigate(`recommendations/${rec.id}`)}>
                View full recommendation
              </Button>
            </>
          ) : (
            <InfoBanner tone="info">
              This action was created manually, so there is no linked diagnosis evidence. Record a business change on the
              timeline to build evidence for future results.
            </InfoBanner>
          )}
        </SectionCard>

        <SectionCard title="Recommendation origin" className="lg:col-span-2">
          {rec ? (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{rec.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{rec.recommendation}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <ImpactBadge impact={rec.impact} />
                  <ConfidenceBadge
                    level={rec.confidence >= 75 ? "high" : rec.confidence >= 50 ? "medium" : "low"}
                    value={rec.confidence}
                  />
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => navigate(`recommendations/${rec.id}`)}>
                Open recommendation
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Not linked to a recommendation — this action was created manually.</p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
