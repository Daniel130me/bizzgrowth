"use client";
// Empty / loading / error state templates — never a bare "No data".

import React from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Database, Inbox, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon,
  title,
  description,
  actions,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed bg-slate-50/60 px-6 py-12 text-center", className)}>
      <div className="flex size-12 items-center justify-center rounded-full bg-white shadow-sm border text-slate-500">{icon ?? <Inbox className="size-5" />}</div>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{description}</p>
      {actions ? <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function NoDataYetState({
  onEnterData,
  onConnect,
  onDemo,
  subject = "this section",
}: {
  onEnterData?: () => void;
  onConnect?: () => void;
  onDemo?: () => void;
  subject?: string;
}) {
  return (
    <EmptyState
      icon={<Database className="size-5" />}
      title={`No information for ${subject} yet`}
      description="You haven't added enough information yet to understand performance here. Connect a source or enter totals to unlock analysis — nothing is required to get started."
      actions={
        <>
          {onConnect && (
            <Button size="sm" onClick={onConnect}>
              Connect data
            </Button>
          )}
          {onEnterData && (
            <Button size="sm" variant="outline" onClick={onEnterData}>
              Enter manually
            </Button>
          )}
          {onDemo && (
            <Button size="sm" variant="ghost" onClick={onDemo}>
              Explore demo business
            </Button>
          )}
        </>
      }
    />
  );
}

export function ErrorState({
  title = "Something went wrong",
  description = "A technical problem occurred while loading this view. Your data is safe.",
  reference = "REF-2026-0930-4172",
  onRetry,
  onHome,
  onSupport,
}: {
  title?: string;
  description?: string;
  reference?: string;
  onRetry?: () => void;
  onHome?: () => void;
  onSupport?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50/50 px-6 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-full border bg-white text-red-500 shadow-sm">
        <AlertTriangle className="size-5" aria-hidden />
      </div>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{description}</p>
      <p className="mt-1 text-xs text-muted-foreground">Reference: {reference}</p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {onRetry && (
          <Button size="sm" onClick={onRetry}>
            <RefreshCw className="mr-1.5 size-3.5" aria-hidden /> Retry
          </Button>
        )}
        {onHome && (
          <Button size="sm" variant="outline" onClick={onHome}>
            Go home
          </Button>
        )}
        {onSupport && (
          <Button size="sm" variant="ghost" onClick={onSupport}>
            Contact support
          </Button>
        )}
      </div>
    </div>
  );
}

export function LoadingState({ label = "Loading", rows = 3 }: { label?: string; rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label={label}>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden /> {label}…
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function SkeletonCards({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)} aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>
  );
}
