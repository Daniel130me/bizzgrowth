"use client";
// Screen 81 — My Assigned Actions (personal work queue).

import { useMemo } from "react";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, SectionCard } from "@/components/shared/layout";
import { StatusBadge } from "@/components/shared/badges";
import { useBizz } from "@/lib/store";
import { fmtDate } from "@/lib/format";
import { MemberAvatar, DUE_TONE_CLS, dueInfo, PROTOTYPE_TODAY, daysUntil, useTeamActions } from "./helpers";
import type { ActionRecord } from "@/lib/types";

function SectionEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed px-4 py-5 text-center text-xs text-muted-foreground">{children}</div>
  );
}

function ActionRow({ action, isMine, onOpen }: { action: ActionRecord; isMine: boolean; onOpen: () => void }) {
  const due = dueInfo(action.due);
  const completed = action.status === "completed";
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-3.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span className="flex min-w-0 items-center gap-3">
          {isMine ? <MemberAvatar name={action.owner} className="size-8 text-[10px]" /> : null}
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{action.title}</span>
            <span className="block truncate text-xs text-muted-foreground">
              {isMine ? "Assigned to you" : action.owner}
            </span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-3">
          <span className={"text-xs " + (completed ? "text-muted-foreground" : DUE_TONE_CLS[due.tone])}>
            {completed ? `Completed · target was ${fmtDate(action.due)}` : due.text}
          </span>
          <StatusBadge status={action.status} />
        </span>
      </button>
    </li>
  );
}

export function MyActions() {
  const navigate = useBizz((s) => s.navigate);
  const businessId = useBizz((s) => s.businessId);
  const user = useBizz((s) => s.user);
  const actions = useTeamActions(businessId);

  const sections = useMemo(() => {
    const open = actions.filter((a) => a.status !== "completed");
    const dueSoon = open.filter((a) => daysUntil(a.due) <= 14);
    const inProgress = open.filter((a) => a.status === "in-progress" && daysUntil(a.due) > 14);
    const measuring = open.filter((a) => a.status === "measuring" && daysUntil(a.due) > 14);
    const completed = actions.filter((a) => a.status === "completed");
    return { dueSoon, inProgress, measuring, completed };
  }, [actions]);

  const mineCount = actions.filter((a) => a.owner.startsWith(user.name)).length;
  const overdue = sections.dueSoon.filter((a) => daysUntil(a.due) < 0).length;

  const list = (items: ActionRecord[], emptyText: string) =>
    items.length ? (
      <ul className="divide-y">
        {items.map((a) => (
          <ActionRow
            key={a.id}
            action={a}
            isMine={a.owner.startsWith(user.name)}
            onOpen={() => navigate(`actions/${a.id}`)}
          />
        ))}
      </ul>
    ) : (
      <SectionEmpty>{emptyText}</SectionEmpty>
    );

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        title="My Assigned Actions"
        description="A personal work queue across this workspace. Items assigned to you are marked with your avatar."
        actions={
          <>
            {mineCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 text-xs font-medium text-slate-700">
                <MemberAvatar name={user.name} className="size-5 text-[9px]" />
                <span className="tnum">{mineCount}</span> assigned to you
              </span>
            ) : null}
            <Button variant="outline" onClick={() => navigate("actions")}>
              Open Action Centre
            </Button>
          </>
        }
      />

      {overdue > 0 ? (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <CalendarClock className="size-4 shrink-0" aria-hidden />
          <span className="tnum">{overdue}</span> of your workspace&apos;s open actions are past their target date.
        </p>
      ) : null}

      <div className="space-y-4">
        <SectionCard
          title="Due soon"
          description="Open actions due within the next 14 days."
          contentClassName={sections.dueSoon.length ? "p-0" : undefined}
        >
          {list(
            sections.dueSoon,
            "Nothing is due in the next 14 days. Overdue items also appear here.",
          )}
        </SectionCard>

        <SectionCard
          title="In progress"
          description="Being worked on now, with a target date further out."
          contentClassName={sections.inProgress.length ? "p-0" : undefined}
        >
          {list(sections.inProgress, "No in-progress actions beyond the due-soon window.")}
        </SectionCard>

        <SectionCard
          title="Measuring"
          description="Implemented — the measurement window is open and results are being tracked."
          contentClassName={sections.measuring.length ? "p-0" : undefined}
        >
          {list(sections.measuring, "Nothing is measuring right now. Mark an action implemented to open a window.")}
        </SectionCard>

        <SectionCard
          title="Completed"
          description="Finished work. Results live in the linked experiment or outcome."
          contentClassName={sections.completed.length ? "p-0" : undefined}
        >
          {list(sections.completed, "No completed actions yet in this workspace.")}
        </SectionCard>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Queue position is based on target dates (prototype date: {PROTOTYPE_TODAY.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}).
      </p>
    </div>
  );
}
