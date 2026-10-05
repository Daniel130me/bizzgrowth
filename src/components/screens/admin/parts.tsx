"use client";
// Shared building blocks for the internal admin console (Screens 105–114).
// The admin console is visually related to the app but distinct: dark AdminShell,
// white content cards, amber "Admin action" markers on operator-only controls.

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, AlertTriangle, ArrowLeft, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------- Back link ----------

export function AdminBackLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="ghost" size="sm" className="-ml-2 mb-3 text-muted-foreground" onClick={onClick}>
      <ArrowLeft className="size-4" aria-hidden /> {label}
    </Button>
  );
}

// ---------- Status pills (icon + label — never colour alone) ----------

type AdminStatus =
  | "healthy" | "delayed" | "failed"
  | "success" | "running"
  | "active" | "trial" | "suspended"
  | "past-due" | "trialing"
  | "invited" | "disabled"
  | "pending" | "reviewed" | "flagged"
  | "helpful" | "unhelpful" | "none"
  | "bug" | "feedback" | "data-concern" | "ai-concern"
  | "open" | "in-progress" | "resolved";

const ADMIN_STATUS_META: Record<AdminStatus, { label: string; cls: string; dot?: string; icon?: React.ReactNode }> = {
  healthy: { label: "Healthy", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  delayed: { label: "Delayed", cls: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  failed: { label: "Failed", cls: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  success: { label: "Success", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  running: { label: "Running", cls: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500 animate-pulse" },
  active: { label: "Active", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  trial: { label: "Trial", cls: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  suspended: { label: "Suspended", cls: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  "past-due": { label: "Past due", cls: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  trialing: { label: "Trialing", cls: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  invited: { label: "Invited", cls: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  disabled: { label: "Disabled", cls: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" },
  pending: { label: "Pending review", cls: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  reviewed: { label: "Reviewed", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  flagged: { label: "Flagged", cls: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  helpful: { label: "Helpful", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  unhelpful: { label: "Unhelpful", cls: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  none: { label: "No feedback", cls: "bg-slate-100 text-slate-500 border-slate-200", dot: "bg-slate-300" },
  bug: { label: "Bug", cls: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  feedback: { label: "Feedback", cls: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" },
  "data-concern": { label: "Data concern", cls: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  "ai-concern": { label: "AI concern", cls: "bg-violet-50 text-violet-700 border-violet-200", dot: "bg-violet-500" },
  open: { label: "Open", cls: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  "in-progress": { label: "In progress", cls: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  resolved: { label: "Resolved", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
};

export function AdminBadge({ status, className }: { status: AdminStatus | string; className?: string }) {
  const s = ADMIN_STATUS_META[status as AdminStatus] ?? { label: status, cls: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" };
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-normal", s.cls, className)}>
      <span className={cn("size-1.5 shrink-0 rounded-full", s.dot)} aria-hidden />
      {s.label}
    </Badge>
  );
}

// ---------- Priority ----------

const PRIORITY_META = {
  high: { label: "High priority", cls: "bg-red-50 text-red-700 border-red-200" },
  medium: { label: "Medium", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  low: { label: "Low", cls: "bg-slate-100 text-slate-600 border-slate-200" },
} as const;

export function PriorityBadge({ priority, className }: { priority: "high" | "medium" | "low"; className?: string }) {
  const s = PRIORITY_META[priority];
  return (
    <Badge variant="outline" className={cn("gap-1 font-normal", s.cls, className)}>
      {s.label}
    </Badge>
  );
}

// ---------- Mini data-coverage bar ----------

export function MiniProgress({ value, className, barClassName }: { value: number; className?: string; barClassName?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 w-full min-w-16 overflow-hidden rounded-full bg-slate-100" role="presentation">
        <div
          className={cn("h-full rounded-full bg-blue-600", barClassName)}
          style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
        />
      </div>
      <span className="shrink-0 text-xs tabular-nums text-slate-600">{value}%</span>
    </div>
  );
}

// ---------- Confidence mini bar (AI audit table) ----------

export function ConfidenceBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-100" role="presentation">
        <div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.max(4, Math.min(100, value))}%` }} />
      </div>
      <span className="text-xs tabular-nums text-slate-600">{value}%</span>
    </div>
  );
}

// ---------- Amber "Admin action" marker ----------

export function AdminActionTag({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700", className)}>
      <Wrench className="size-3" aria-hidden /> Admin action
    </span>
  );
}

/** Operator-only action button, visually paired with the amber Admin action tag. */
export function AdminActionButton({ label, icon, onClick, className }: { label: string; icon?: React.ReactNode; onClick: () => void; className?: string }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} className={cn("h-9 border-amber-200 bg-amber-50/60 text-amber-900 hover:bg-amber-100 hover:text-amber-900", className)}>
      {icon}
      {label}
    </Button>
  );
}

// ---------- Not-found (ErrorState-lite) ----------

export function NotFoundLite({ title, description, onBack, backLabel }: { title: string; description: string; onBack: () => void; backLabel: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-amber-200 bg-amber-50/40 px-6 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-full border bg-white text-amber-600 shadow-sm">
        <AlertTriangle className="size-5" aria-hidden />
      </div>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{description}</p>
      <Button size="sm" variant="outline" className="mt-5" onClick={onBack}>
        {backLabel}
      </Button>
    </div>
  );
}

// ---------- Search input with icon ----------

export function SearchInput({ value, onChange, placeholder, label, className }: { value: string; onChange: (v: string) => void; placeholder: string; label: string; className?: string }) {
  return (
    <div className={cn("relative w-full sm:w-64", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-9 pl-8"
      />
    </div>
  );
}

// ---------- Initials avatar ----------

export function InitialsAvatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
  return (
    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600", className)} aria-hidden>
      {initials}
    </span>
  );
}
