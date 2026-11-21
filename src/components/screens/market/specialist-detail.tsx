"use client";
// Specialist profile — route "market/specialist/:id".
//
// A full Fiverr-style profile: headline, badges, track record, skills,
// showcase and rates — plus the hiring CTA. The owner picks one of their
// OPEN tasks and the specialist can review the brief and submit a bid.

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Breadcrumbs, SectionCard } from "@/components/shared/layout";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { useBizz } from "@/lib/store";
import type { SpecialistDTO, TaskDTO } from "@/lib/market";
import { URGENCY_LABEL, AvailableDot, SpecialistAvatar, categoryLabel } from "./parts";
import type { ScreenProps } from "../view-types";

export function SpecialistDetail({ params }: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);

  // ---- Profile ----
  const [specialist, setSpecialist] = useState<SpecialistDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/market/specialists/${encodeURIComponent(params.id)}`);
        const data = (await res.json()) as { ok?: boolean; specialist?: SpecialistDTO; error?: string };
        if (!data?.ok || !data.specialist) throw new Error(data?.error ?? "Specialist not found.");
        setSpecialist(data.specialist);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Specialist not found.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [params.id, reload]);

  // ---- Owner's tasks (for the invite CTA) ----
  const [tasks, setTasks] = useState<TaskDTO[] | null>(null);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [tasksReload, setTasksReload] = useState(0);

  useEffect(() => {
    async function load() {
      setTasksLoading(true);
      setTasksError(null);
      try {
        const res = await fetch("/api/market/tasks");
        const data = (await res.json()) as { ok?: boolean; tasks?: TaskDTO[]; error?: string };
        if (!data?.ok || !Array.isArray(data.tasks)) {
          throw new Error(data?.error ?? "Could not load your tasks.");
        }
        setTasks(data.tasks);
      } catch (err) {
        setTasksError(err instanceof Error ? err.message : "Could not load your tasks.");
      } finally {
        setTasksLoading(false);
      }
    }
    void load();
  }, [tasksReload]);

  const openTasks = useMemo(
    () =>
      (tasks ?? [])
        .filter((t) => t.status === "open")
        .slice()
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [tasks],
  );

  // ---- Invitations ----
  const [invitedTaskIds, setInvitedTaskIds] = useState<string[]>([]);
  const [invitingTaskId, setInvitingTaskId] = useState<string | null>(null);

  async function invite(task: TaskDTO) {
    if (!specialist) return;
    setInvitingTaskId(task.id);
    try {
      const res = await fetch(`/api/market/tasks/${encodeURIComponent(task.id)}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ specialistIds: [params.id] }),
      });
      const data = (await res.json()) as { ok?: boolean; invited?: number; message?: string; error?: string };
      if (!data?.ok) throw new Error(data?.error ?? "Please try again.");
      if ((data.invited ?? 0) > 0) {
        toast.success("Invitation sent", {
          description: `${specialist.name} can now review the brief and submit a bid.`,
        });
        setInvitedTaskIds((ids) => (ids.includes(task.id) ? ids : [...ids, task.id]));
      } else {
        // The server accepted the request but invited no one (for example,
        // this specialist is already on the task). Say what happened — no
        // pretend success.
        toast("Invitation not sent", {
          description: data.message ?? "This specialist may already be invited on this task.",
        });
      }
    } catch (err) {
      toast.error("Could not send the invitation", {
        description: err instanceof Error && err.message ? err.message : "Please try again.",
      });
    } finally {
      setInvitingTaskId(null);
    }
  }

  function scrollToInvite() {
    document.getElementById("invite")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <Breadcrumbs
        items={[
          { label: "Specialists marketplace", onClick: () => navigate("market") },
          { label: "Profile" },
        ]}
      />

      {loading ? (
        <LoadingState label="Loading profile" />
      ) : error || !specialist ? (
        <ErrorState
          title="Specialist not found"
          description="This profile may have been removed, or the link is out of date."
          onRetry={() => setReload((n) => n + 1)}
          onHome={() => navigate("market")}
        />
      ) : (
        <div className="space-y-5">
          {/* Header block */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-4">
                <SpecialistAvatar id={specialist.id} name={specialist.name} size="lg" />
                <div className="min-w-0">
                  <h1 className="flex items-center gap-1.5 text-xl font-bold">
                    <span className="truncate">{specialist.name}</span>
                    {specialist.verified ? (
                      <BadgeCheck className="size-5 shrink-0 text-emerald-600" aria-label="Verified specialist" />
                    ) : null}
                  </h1>
                  <p className="mt-0.5 text-sm text-slate-600">{specialist.headline}</p>
                </div>
              </div>
              <Button onClick={scrollToInvite}>Invite to bid on a task</Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {specialist.badges.map((b) => (
                <Badge key={b} className="border-transparent bg-brand-50 font-normal text-brand-700">
                  {b}
                </Badge>
              ))}
              <Badge variant="outline" className="font-normal">
                {categoryLabel(specialist.category)}
              </Badge>
              <AvailableDot available={specialist.available} />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border p-3">
                <p className="text-lg font-bold tnum">{specialist.rating.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Star rating</p>
              </div>
              <div className="rounded-xl border p-3">
                <p className="text-lg font-bold tnum">{specialist.reviews.toLocaleString("en-NG")}</p>
                <p className="text-xs text-muted-foreground">Reviews</p>
              </div>
              <div className="rounded-xl border p-3">
                <p className="text-lg font-bold tnum">{specialist.completedJobs.toLocaleString("en-NG")}</p>
                <p className="text-xs text-muted-foreground">Jobs completed</p>
              </div>
              <div className="rounded-xl border p-3">
                <p className="text-lg font-bold leading-snug">{specialist.responseTime}</p>
                <p className="text-xs text-muted-foreground">Typical reply</p>
              </div>
            </div>
          </div>

          <SectionCard title="About">
            <p className="text-sm leading-relaxed">{specialist.bio}</p>
          </SectionCard>

          <SectionCard title="Skills">
            <div className="flex flex-wrap gap-2">
              {specialist.skills.map((skill) => (
                <Badge key={skill} variant="outline" className="font-normal">
                  {skill}
                </Badge>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Showcase" description="Selected work and outcomes.">
            {specialist.portfolio.length === 0 ? (
              <EmptyState
                title="No showcase items yet"
                description="This specialist has not added selected work to their profile yet."
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {specialist.portfolio.map((item, i) => (
                  <div key={i} className="rounded-xl border p-4">
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.blurb}</p>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Rates">
            <p className="flex flex-wrap items-baseline gap-1.5">
              <span className="text-2xl font-bold tnum">₦{specialist.hourlyRate.toLocaleString("en-NG")}</span>
              <span className="text-sm text-muted-foreground">/hour indicative</span>
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Their final price comes as a bid on your task — you always see it before you commit.
              {specialist.languages.length > 0 ? ` Languages: ${specialist.languages.join(", ")}.` : ""}
            </p>
          </SectionCard>

          {/* Invite CTA */}
          <div id="invite" className="scroll-mt-4">
            <SectionCard
              title="Invite to bid"
              description="Pick one of your open tasks. The specialist can review the brief and submit their own proposal."
            >
              {tasksLoading ? (
                <LoadingState label="Loading your tasks" rows={2} />
              ) : tasksError ? (
                <div className="rounded-xl border border-red-200 bg-red-50/50 p-4">
                  <p className="text-sm font-medium text-red-900">Could not load your tasks.</p>
                  <p className="mt-0.5 text-sm text-red-800">{tasksError}</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => setTasksReload((n) => n + 1)}>
                    Retry
                  </Button>
                </div>
              ) : openTasks.length === 0 ? (
                <div>
                  <p className="text-sm text-muted-foreground">You have no open tasks yet.</p>
                  <Button className="mt-3" onClick={() => navigate("market/post")}>
                    <Plus className="mr-1.5 size-4" aria-hidden /> Post a task first
                  </Button>
                </div>
              ) : (
                <div>
                  <div className="space-y-2">
                    {openTasks.map((t) => {
                      const invited = invitedTaskIds.includes(t.id);
                      const sending = invitingTaskId === t.id;
                      return (
                        <div key={t.id} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{t.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {URGENCY_LABEL[t.urgency] ?? t.urgency} · {categoryLabel(t.category)}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant={invited ? "outline" : "default"}
                            disabled={invited || sending}
                            onClick={() => void invite(t)}
                          >
                            {invited ? "Invited" : sending ? "Sending…" : "Invite"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">The invitation does not commit either party. You choose whether to accept the submitted bid.</p>
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      )}
    </div>
  );
}
