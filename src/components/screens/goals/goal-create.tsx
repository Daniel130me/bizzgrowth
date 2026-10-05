"use client";
// Screen 66 — Create / Edit Goal. Type selection prefills sensible defaults
// (SwiftHaul customers: 49 → 60 · KoraHome orders: 740 → 850).

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useBizz } from "@/lib/store";
import { getBusiness, getPeriod } from "@/lib/data/businesses";
import { TEAM } from "@/lib/data/operations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader, SectionCard, InfoBanner } from "@/components/shared/layout";
import { ArrowLeft } from "lucide-react";
import type { Business, GoalRecord } from "@/lib/types";
import type { ScreenProps } from "../view-types";
import { EDIT_PREFILL_KEY, dropGoalEdit, goalById, peekGoalEdit, saveGoalEdit } from "./parts";

type GoalType = "revenue" | "customers" | "orders" | "conversion" | "efficiency" | "custom";

const TYPE_OPTIONS: { value: GoalType; label: string }[] = [
  { value: "revenue", label: "Revenue" },
  { value: "customers", label: "Customers" },
  { value: "orders", label: "Orders" },
  { value: "conversion", label: "Conversion" },
  { value: "efficiency", label: "Marketing efficiency" },
  { value: "custom", label: "Custom" },
];

function roundTo(value: number, step: number) {
  return Math.round(value / step) * step;
}

interface Defaults {
  title: string;
  baseline: number;
  target: number;
  unit: string;
  priority: "high" | "medium" | "low";
}

/** Sensible prefill per goal type, anchored on the current reporting month. */
function defaultsFor(type: GoalType, business: Business): Defaults {
  const cur = getPeriod(business, "this-month").current;
  const isSwift = business.id === "swifthaul";
  const isKora = business.id === "korahome";
  switch (type) {
    case "customers":
      // Spec prefill: SwiftHaul customers 49 → 60.
      if (isSwift) return { title: "Increase monthly paying customers", baseline: 49, target: 60, unit: "customers", priority: "high" };
      return {
        title: "Increase monthly paying customers",
        baseline: cur.customers,
        target: cur.customers + Math.max(5, Math.round(cur.customers * 0.1)),
        unit: "customers",
        priority: "medium",
      };
    case "orders":
      // Spec prefill: KoraHome orders 740 → 850.
      if (isKora) return { title: "Recover monthly orders", baseline: 740, target: 850, unit: "orders", priority: "high" };
      return {
        title: "Grow monthly orders",
        baseline: cur.orders,
        target: cur.orders + Math.max(20, Math.round(cur.orders * 0.1)),
        unit: "orders",
        priority: "medium",
      };
    case "revenue":
      return {
        title: "Increase monthly revenue",
        baseline: cur.revenue,
        target: roundTo(cur.revenue * 1.15, 100_000),
        unit: "₦ per month",
        priority: "medium",
      };
    case "conversion": {
      const base = business.type === "ecommerce" && cur.traffic ? +((cur.orders / cur.traffic) * 100).toFixed(1) : cur.enquiries ? +((cur.customers / cur.enquiries) * 100).toFixed(1) : 0;
      return {
        title: business.type === "ecommerce" ? "Improve visitor-to-purchase conversion" : "Improve enquiry-to-customer conversion",
        baseline: base,
        target: business.type === "ecommerce" ? 5.4 : 25,
        unit: "% conversion",
        priority: "medium",
      };
    }
    case "efficiency": {
      const base = cur.spend ? +((cur.revenue / cur.spend) * 1).toFixed(1) : 0;
      return { title: "Improve marketing efficiency", baseline: base, target: roundTo(base * 1.2, 1), unit: "₦ revenue per ₦1 spend", priority: "medium" };
    }
    case "custom":
    default:
      return { title: "", baseline: 0, target: 0, unit: "", priority: "medium" };
  }
}

function metricLabelFor(type: GoalType, business: Business): string {
  switch (type) {
    case "revenue": return "Monthly revenue";
    case "customers": return "New customers per month";
    case "orders": return "Orders per month";
    case "conversion": return business.type === "ecommerce" ? "Visitor → purchase conversion" : "Enquiry → customer conversion";
    case "efficiency": return "Marketing efficiency (revenue ÷ spend)";
    case "custom": return "Custom metric";
  }
}

function inferType(goal: GoalRecord): GoalType {
  const m = `${goal.metric} ${goal.unit}`.toLowerCase();
  if (m.includes("efficiency") || m.includes("spend")) return "efficiency";
  if (m.includes("order")) return "orders";
  if (m.includes("customer")) return "customers";
  if (m.includes("conversion") || m.includes("completion")) return "conversion";
  if (m.includes("revenue") || m.includes("₦")) return "revenue";
  return "custom";
}

export function GoalCreate({ params: _params }: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);
  const businessId = useBizz((s) => s.businessId);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const user = useBizz((s) => s.user);
  const storeGoals = useBizz((s) => s.goals);
  const addGoal = useBizz((s) => s.addGoal);
  const updateGoal = useBizz((s) => s.updateGoal);
  const business = getBusiness(businessId, userWorkspace);

  const [editGoal, setEditGoal] = useState<GoalRecord | null>(null);
  const [type, setType] = useState<GoalType>("customers");
  const [title, setTitle] = useState("");
  const [baseline, setBaseline] = useState("0");
  const [target, setTarget] = useState("0");
  const [unit, setUnit] = useState("");
  const [deadline, setDeadline] = useState("2026-10-31");
  const [owner, setOwner] = useState(user.name);
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");
  const [touched, setTouched] = useState(false);

  // Edit mode: goal-create is reached with a prefill id in sessionStorage.
  useEffect(() => {
    const id = peekGoalEdit(EDIT_PREFILL_KEY);
    if (!id) return;
    dropGoalEdit(EDIT_PREFILL_KEY);
    const goal = goalById(businessId, storeGoals, id);
    if (!goal) return;
    queueMicrotask(() => {
      setEditGoal(goal);
      setType(inferType(goal));
      setTitle(goal.title);
      setBaseline(String(goal.baseline));
      setTarget(String(goal.target));
      setUnit(goal.unit);
      setDeadline(goal.deadline);
      setOwner(goal.owner);
      setPriority(goal.priority);
    });
  }, []);

  const applyType = (next: GoalType) => {
    setType(next);
    const d = defaultsFor(next, business);
    setTitle(d.title);
    setBaseline(String(d.baseline));
    setTarget(String(d.target));
    setUnit(d.unit);
    setPriority(d.priority);
  };

  const titleError = touched && !title.trim() ? "Give the goal a short, specific title." : null;
  const targetError = touched && (!/^\d*\.?\d+$/.test(target) || Number(target) <= 0) ? "Enter a target greater than zero." : null;
  const baselineError = touched && (!/^\d*\.?\d+$/.test(baseline) || Number(baseline) < 0) ? "Enter the current baseline (0 or more)." : null;
  const canSubmit = title.trim().length > 0 && Number(target) > 0 && Number(baseline) >= 0;

  const payload = useMemo(
    () => ({
      title: title.trim(),
      metric: metricLabelFor(type, business),
      baseline: Number(baseline) || 0,
      target: Number(target) || 0,
      current: Number(baseline) || 0,
      unit,
      deadline,
      owner,
      priority,
    }),
    [title, type, business, baseline, target, unit, deadline, owner, priority]
  );

  const submit = () => {
    setTouched(true);
    if (!canSubmit) return;
    if (editGoal) {
      const patch: Partial<GoalRecord> = {
        title: payload.title,
        metric: payload.metric,
        baseline: payload.baseline,
        target: payload.target,
        unit: payload.unit,
        deadline: payload.deadline,
        owner: payload.owner,
        priority: payload.priority,
      };
      const isStoreGoal = storeGoals.some((g) => g.id === editGoal.id);
      if (isStoreGoal) updateGoal(editGoal.id, patch);
      else saveGoalEdit(editGoal.id, patch);
      toast.success("Goal updated", { description: "Progress tracking and related recommendations now use the new definition." });
      navigate("goals");
      return;
    }
    addGoal({ ...payload, contributing: [payload.metric], relatedRecommendations: [], summary: "" });
    navigate("goals");
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Button variant="ghost" size="sm" className="-ml-2 mb-3 text-muted-foreground" onClick={() => navigate("goals")}>
        <ArrowLeft className="size-4" aria-hidden /> Back to goals
      </Button>
      <PageHeader
        title={editGoal ? "Edit goal" : "Create goal"}
        description={
          editGoal
            ? "Adjust the goal definition. Progress already recorded is preserved."
            : "Choose what to improve and by how much. The goal appears in Active and is linked to related recommendations."
        }
      />

      <InfoBanner tone="info" title="How goals are used">
        Goals set the direction for recommendations and weekly briefs. Pick the type first — baseline and target prefill from your latest data.
      </InfoBanner>

      <div className="mt-5 space-y-5">
        <SectionCard title="Goal type" description="What this goal is trying to move.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="goal-type">Type</Label>
              <Select value={type} onValueChange={(v) => applyType(v as GoalType)}>
                <SelectTrigger id="goal-type" aria-label="Goal type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="goal-title">Title</Label>
              <Input
                id="goal-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={type === "custom" ? "e.g. Launch the Abuja pickup point" : "Goal title"}
                aria-invalid={Boolean(titleError)}
              />
              {titleError ? <p className="text-xs text-red-600">{titleError}</p> : null}
            </div>
          </div>
          {type === "custom" ? (
            <div className="mt-4 space-y-1.5">
              <Label htmlFor="goal-unit">Unit</Label>
              <Input id="goal-unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="e.g. qualified leads" />
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">Unit: {unit || "—"}</p>
          )}
        </SectionCard>

        <SectionCard title="Measurement" description="Where you are now, and where you want to be.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="goal-baseline">Current baseline</Label>
              <Input
                id="goal-baseline"
                type="number"
                inputMode="decimal"
                min={0}
                value={baseline}
                onChange={(e) => setBaseline(e.target.value)}
                aria-invalid={Boolean(baselineError)}
              />
              {baselineError ? <p className="text-xs text-red-600">{baselineError}</p> : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="goal-target">Target</Label>
              <Input
                id="goal-target"
                type="number"
                inputMode="decimal"
                min={0}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                aria-invalid={Boolean(targetError)}
              />
              {targetError ? <p className="text-xs text-red-600">{targetError}</p> : null}
            </div>
          </div>
          {type === "customers" && business.id === "swifthaul" ? (
            <p className="mt-3 text-xs text-muted-foreground">Prefilled from September: 49 paying customers, target 60 by the deadline.</p>
          ) : null}
          {type === "orders" && business.id === "korahome" ? (
            <p className="mt-3 text-xs text-muted-foreground">Prefilled from September: 740 orders, target 850 as checkout recovers.</p>
          ) : null}
        </SectionCard>

        <SectionCard title="Accountability" description="Who owns the goal and when it should be reached.">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="goal-deadline">Deadline</Label>
              <Input id="goal-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="goal-owner">Owner</Label>
              <Select value={owner} onValueChange={setOwner}>
                <SelectTrigger id="goal-owner" aria-label="Goal owner">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEAM.map((m) => (
                    <SelectItem key={m.id} value={m.name}>
                      {m.name} — {m.jobTitle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="goal-priority">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as "high" | "medium" | "low")}>
                <SelectTrigger id="goal-priority" aria-label="Goal priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </SectionCard>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={submit}>{editGoal ? "Save changes" : "Create goal"}</Button>
          <Button variant="outline" onClick={() => navigate("goals")}>
            Cancel
          </Button>
          <p className="text-xs text-muted-foreground">New goals start in Active at the baseline you entered.</p>
        </div>
      </div>
    </div>
  );
}
