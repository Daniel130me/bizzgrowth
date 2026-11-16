"use client";
// Screen 118 — Post a Task / Brief: send a piece of work to the marketplace.
// Prefilled when the intelligence recommends work the owner may not execute
// themselves ("Find a specialist" on a recommendation).

import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Breadcrumbs, InfoBanner, SectionCard } from "@/components/shared/layout";
import { useBizz, type TaskPrefill } from "@/lib/store";
import type { ScreenProps } from "../view-types";
import { MARKET_CATEGORIES, URGENCY_LABEL, categoryLabel, guessCategory } from "./parts";

interface TaskCreated {
  id: string;
}

export function TaskPost({ params }: ScreenProps) {
  void params;
  const navigate = useBizz((s) => s.navigate);
  const businessId = useBizz((s) => s.businessId);
  const businessName = useBizz((s) => s.settings.businessName);
  const prefill = useBizz((s) => s.taskPrefill);
  const setTaskPrefill = useBizz((s) => s.setTaskPrefill);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [skills, setSkills] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [urgency, setUrgency] = useState<"asap" | "this-week" | "flexible">("this-week");
  const [posting, setPosting] = useState(false);
  const [formError, setFormError] = useState("");
  // Source metadata captured BEFORE the prefill is cleared, so the posted task
  // keeps its "from your intelligence" provenance.
  const [sourceInfo, setSourceInfo] = useState<Pick<TaskPrefill, "source" | "sourceRef" | "sourceTitle">>({ source: "manual" });

  // Hydrate the form once from a recommendation prefill, then clear it so a
  // manual visit to this screen never inherits an old recommendation.
  useEffect(() => {
    if (prefill) {
      setTitle(prefill.title);
      setDescription(prefill.description);
      setCategory(prefill.category ?? guessCategory(`${prefill.title} ${prefill.description}`) ?? "");
      setSkills((prefill.skills ?? []).join(", "));
      setSourceInfo({ source: prefill.source, sourceRef: prefill.sourceRef, sourceTitle: prefill.sourceTitle });
      setTaskPrefill(null);
    }
  }, []);

  const skillsList = skills
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 8);

  const submit = async () => {
    setFormError("");
    if (title.trim().length < 8) {
      setFormError("Give the task a clear title — at least 8 characters.");
      return;
    }
    if (description.trim().length < 30) {
      setFormError("Describe the work in at least 30 characters — specialists bid on this description.");
      return;
    }
    if (!category) {
      setFormError("Pick the category that fits this work.");
      return;
    }
    const min = Number(budgetMin);
    const max = Number(budgetMax);
    if (budgetMin && (!Number.isFinite(min) || min <= 0)) {
      setFormError("Budget minimum must be a positive number.");
      return;
    }
    if (budgetMax && (!Number.isFinite(max) || max <= 0)) {
      setFormError("Budget maximum must be a positive number.");
      return;
    }
    if (budgetMin && budgetMax && min > max) {
      setFormError("Minimum budget cannot exceed the maximum.");
      return;
    }

    setPosting(true);
    try {
      const res = await fetch("/api/market/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: businessId,
          businessName,
          title: title.trim(),
          description: description.trim(),
          category,
          skills: skillsList,
          budgetMin: budgetMin ? Math.round(min) : undefined,
          budgetMax: budgetMax ? Math.round(max) : undefined,
          urgency,
          source: sourceInfo.source,
          sourceRef: sourceInfo.sourceRef,
          sourceTitle: sourceInfo.sourceTitle,
        }),
      });
      const data = (await res.json()) as { ok: boolean; task?: TaskCreated; error?: string };
      if (!res.ok || !data.ok || !data.task) {
        setFormError(data.error ?? "The task could not be posted. Please try again.");
        return;
      }
      toast.success("Task posted", { description: "Next: match specialists and invite them to bid." });
      navigate(`market/task/${data.task.id}`);
    } catch {
      setFormError("The marketplace could not be reached just now. Check your connection and try again.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Breadcrumbs items={[{ label: "Specialists marketplace", onClick: () => navigate("market") }, { label: "Post a task" }]} />

      {sourceInfo.source === "recommendation" && sourceInfo.sourceTitle ? (
        <div className="mb-4">
          <InfoBanner tone="ai" title="Prefilled from your intelligence">
            This brief comes from the recommendation “{sourceInfo.sourceTitle}”. Adjust anything — you know your business best.
          </InfoBanner>
        </div>
      ) : null}

      <SectionCard
        title="What do you need done?"
        description="Specialists bid on this brief, so write it the way you would explain it to a colleague."
      >
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Task title</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Set up Meta ad campaigns for delivery enquiries"
              maxLength={120}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-desc">Describe the work</Label>
            <Textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is the goal, what exists today, what should the specialist deliver, any tools or constraints…"
              rows={6}
              maxLength={2000}
            />
            <p className="text-xs text-muted-foreground">{description.length}/2000</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger aria-label="Task category">
                  <SelectValue placeholder="Pick a category" />
                </SelectTrigger>
                <SelectContent>
                  {MARKET_CATEGORIES.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-skills">Skills wanted <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input
                id="task-skills"
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="e.g. Meta Ads, Retargeting"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="task-budget-min">Budget min (₦) <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input id="task-budget-min" inputMode="numeric" value={budgetMin} onChange={(e) => setBudgetMin(e.target.value.replace(/[^0-9]/g, ""))} placeholder="100000" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-budget-max">Budget max (₦) <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Input id="task-budget-max" inputMode="numeric" value={budgetMax} onChange={(e) => setBudgetMax(e.target.value.replace(/[^0-9]/g, ""))} placeholder="200000" />
            </div>
            <div className="space-y-1.5">
              <Label>When do you need it?</Label>
              <RadioGroup value={urgency} onValueChange={(v) => setUrgency(v as typeof urgency)} className="flex gap-3">
                {(["asap", "this-week", "flexible"] as const).map((u) => (
                  <div key={u} className="flex items-center gap-1.5">
                    <RadioGroupItem value={u} id={`urgency-${u}`} />
                    <Label htmlFor={`urgency-${u}`} className="cursor-pointer text-sm font-normal">
                      {URGENCY_LABEL[u]}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </div>

          {formError ? (
            <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {formError}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
            <Button variant="ghost" onClick={() => navigate("market")} disabled={posting}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={posting}>
              {posting ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden /> Posting…
                </>
              ) : (
                <>
                  <Sparkles className="mr-1.5 size-4" aria-hidden /> Post task to marketplace
                </>
              )}
            </Button>
          </div>
          {category ? (
            <p className="text-xs text-muted-foreground">
              Posting in <span className="font-medium text-foreground">{categoryLabel(category)}</span> — matched specialists will be able to
              find and bid on this task.
            </p>
          ) : null}
        </div>
      </SectionCard>
    </div>
  );
}
