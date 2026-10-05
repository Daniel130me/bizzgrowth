"use client";
// Page layout primitives — page headers, breadcrumbs, section cards, settings shell.

import React from "react";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  badge,
  back,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  back?: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      {back}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
            {badge}
          </div>
          {description ? <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; onClick?: () => void }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-3 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="size-3.5 text-slate-300" aria-hidden />}
          {item.onClick ? (
            <button onClick={item.onClick} className="hover:text-foreground hover:underline">
              {item.label}
            </button>
          ) : (
            <span className="font-medium text-foreground">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <Card className={cn("p-0", className)}>
      {(title || action) && (
        <div className="flex flex-wrap items-start justify-between gap-2 border-b px-5 py-4">
          <div>
            {title && <h2 className="text-sm font-semibold">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={cn("p-5", contentClassName)}>{children}</div>
    </Card>
  );
}

export function KeyValue({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-0.5 sm:flex-row sm:gap-4", className)}>
      <span className="w-44 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  );
}

export function SettingsShell({ title, description, children, maxWidth = "max-w-3xl" }: { title: string; description?: string; children: React.ReactNode; maxWidth?: string }) {
  return (
    <div className={cn("mx-auto w-full", maxWidth)}>
      <PageHeader title={title} description={description} />
      <div className="space-y-5">{children}</div>
    </div>
  );
}

/** Intelligence Detail Template — shared by Diagnosis / Opportunity / Alert / Recommendation. */
export function IntelligenceDetail({
  eyebrow,
  eyebrowClass,
  title,
  meta,
  children,
  actions,
}: {
  eyebrow: string;
  eyebrowClass?: string;
  title: string;
  meta?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-4xl">
      <p className={cn("text-xs font-semibold uppercase tracking-wide", eyebrowClass ?? "text-violet-600")}>{eyebrow}</p>
      <h1 className="mt-1.5 text-2xl font-bold tracking-tight">{title}</h1>
      {meta ? <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div> : null}
      {actions ? <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div> : null}
      <div className="mt-6 space-y-5">{children}</div>
    </div>
  );
}

export function InfoBanner({
  tone = "info",
  title,
  children,
  action,
}: {
  tone?: "info" | "warning" | "danger" | "success" | "ai";
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const cls = {
    info: "border-blue-200 bg-blue-50 text-blue-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-red-200 bg-red-50 text-red-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    ai: "border-violet-200 bg-violet-50 text-violet-900",
  }[tone];
  return (
    <div className={cn("flex flex-col gap-2 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between", cls)}>
      <div>
        {title && <p className="text-sm font-semibold">{title}</p>}
        <div className="text-sm opacity-90">{children}</div>
      </div>
      {action}
    </div>
  );
}
