"use client";
// Screen 119 — Task Detail & Bids: the bidding heart of the marketplace.
// Shows the brief, the AI matchmaker's picks ("who fits this work"), incoming
// bids from invited specialists, and the award flow.

import { useCallback, useEffect, useMemo, useState } from "react";
import { BadgeCheck, Gavel, Loader2, Sparkles, UserRoundCheck, X } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Breadcrumbs, InfoBanner, SectionCard } from "@/components/shared/layout";
import { ErrorState, EmptyState, LoadingState } from "@/components/shared/states";
import { fmtDate, fmtNaira } from "@/lib/format";
import { useBizz } from "@/lib/store";
import type { BidDTO, MatchItem, MatchResult, SpecialistDTO, TaskDTO } from "@/lib/market";
import type { ScreenProps } from "../view-types";
import { MarketStatusBadge, SpecialistAvatar, SpecialistRow, URGENCY_LABEL, categoryLabel } from "./parts";

interface TaskDetailData {
  task: TaskDTO;
  bids: BidDTO[];
}

const INVITE_PILOT_NOTE =
  "Pilot marketplace: invited roster specialists respond automatically with indicative bids derived from their profile.";

export function TaskDetail({ params }: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);
  const businessId = useBizz((s) => s.businessId);

  const [data, setData] = useState<TaskDetailData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);

  const [match, setMatch] = useState<MatchResult | null>(null);
  const [matching, setMatching] = useState(false);
  const [matchError, setMatchError] = useState("");

  const [inviting, setInviting] = useState(false);
  const [awardingBidId, setAwardingBidId] = useState("");
  const [closing, setClosing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch(`/api/market/tasks/${params.id}`);
      const json = (await res.json()) as { ok: boolean; task?: TaskDTO; bids?: BidDTO[]; error?: string };
      if (!res.ok || !json.ok || !json.task || !json.bids) {
        setLoadError(json.error ?? "This task could not be loaded.");
        return;
      }
      setData({ task: json.task, bids: json.bids });
    } catch {
      setLoadError("The marketplace could not be reached just now. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load, reload]);

  const runMatch = useCallback(
    async (task: TaskDTO) => {
      setMatching(true);
      setMatchError("");
      try {
        const res = await fetch("/api/market/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: task.title, description: task.description, category: task.category, skills: task.skills }),
        });
        const json = (await res.json()) as { ok: boolean; error?: string } & Partial<MatchResult>;
        if (!res.ok || !json.ok || !json.matches) {
          setMatchError(json.error ?? "Matchmaking is unavailable right now.");
          return;
        }
        setMatch({ aiInterpreted: Boolean(json.aiInterpreted), category: json.category ?? task.category, skillsToSeek: json.skillsToSeek ?? [], note: json.note ?? "", matches: json.matches });
      } catch {
        setMatchError("Matchmaking could not be reached just now.");
      } finally {
        setMatching(false);
      }
    },
    [],
  );

  // Run the matchmaker once for open tasks (they are the ones that hire).
  useEffect(() => {
    if (data && data.task.status === "open" && !match && !matching && !matchError) {
      void runMatch(data.task);
    }
  }, [data, match, matching, matchError, runMatch]);

  const invitedNames = useMemo(() => new Set(data?.bids.map((b) => b.specialist.id) ?? []), [data]);
  const acceptedBid = data?.bids.find((b) => b.status === "accepted") ?? null;

  const inviteMatched = async () => {
    if (!data) return;
    setInviting(true);
    try {
      const res = await fetch(`/api/market/tasks/${data.task.id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "ai" }),
      });
      const json = (await res.json()) as { ok: boolean; invited?: number; message?: string; error?: string };
      if (!res.ok || !json.ok) {
        toast.error("Could not send the invitations", { description: json.error ?? "Please try again." });
        return;
      }
      if (json.invited === 0) {
        toast(json.message ?? "Those specialists have already bid on this task.");
      } else {
        toast.success(`${json.invited} ${json.invited === 1 ? "specialist" : "specialists"} invited`, {
          description: "Indicative bids will appear here shortly.",
        });
      }
      setReload((r) => r + 1);
    } catch {
      toast.error("Could not send the invitations", { description: "Check your connection and try again." });
    } finally {
      setInviting(false);
    }
  };

  const awardBid = async (bid: BidDTO) => {
    if (!data) return;
    setAwardingBidId(bid.id);
    try {
      const res = await fetch(`/api/market/tasks/${data.task.id}/award`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bidId: bid.id }),
      });
      const json = (await res.json()) as { ok: boolean; task?: TaskDTO; bids?: BidDTO[]; error?: string };
      if (!res.ok || !json.ok || !json.task || !json.bids) {
        toast.error("Could not award the task", { description: json.error ?? "Please try again." });
        return;
      }
      setData({ task: json.task, bids: json.bids });
      toast.success("Task awarded", { description: `${bid.specialist.name} will take it from here.` });
    } catch {
      toast.error("Could not award the task", { description: "Check your connection and try again." });
    } finally {
      setAwardingBidId("");
    }
  };

  const closeTask = async () => {
    if (!data) return;
    setClosing(true);
    try {
      const res = await fetch(`/api/market/tasks/${data.task.id}/close`, { method: "POST" });
      const json = (await res.json()) as { ok: boolean; task?: TaskDTO; error?: string };
      if (!res.ok || !json.ok || !json.task) {
        toast.error("Could not close the task", { description: json.error ?? "Please try again." });
        return;
      }
      setData({ ...data, task: json.task });
      toast("Task closed", { description: "No one was hired from this brief." });
    } catch {
      toast.error("Could not close the task", { description: "Check your connection and try again." });
    } finally {
      setClosing(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="mx-auto max-w-4xl">
        <LoadingState label="Loading task" rows={4} />
      </div>
    );
  }

  if (loadError && !data) {
    return (
      <div className="mx-auto max-w-2xl py-10">
        <ErrorState
          title={loadError.includes("not found") ? "Task not found" : "Task unavailable"}
          description={loadError}
          onRetry={() => setReload((r) => r + 1)}
          onHome={() => navigate("market")}
        />
      </div>
    );
  }

  if (!data) return null;
  const { task, bids } = data;

  if (task.workspaceId !== businessId) {
    return (
      <div className="mx-auto max-w-2xl py-10">
        <ErrorState
          title="This task belongs to another workspace"
          description="Tasks are private to the business that posted them. Switch workspaces to see this brief."
          onRetry={() => navigate("market")}
          onHome={() => navigate("market")}
        />
      </div>
    );
  }

  const awarded = task.status === "awarded";
  const closed = task.status === "closed";

  return (
    <div className="mx-auto max-w-4xl">
      <Breadcrumbs
        items={[
          { label: "Specialists marketplace", onClick: () => navigate("market") },
          { label: "Your tasks", onClick: () => navigate("market") },
          { label: "Task" },
        ]}
      />

      <div className="mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{task.title}</h1>
          <MarketStatusBadge status={task.status} />
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>{categoryLabel(task.category)}</span>
          <span aria-hidden>·</span>
          <span>{URGENCY_LABEL[task.urgency] ?? task.urgency}</span>
          <span aria-hidden>·</span>
          <span>Posted {fmtDate(task.createdAt)}</span>
          {(task.budgetMin || task.budgetMax) && (
            <>
              <span aria-hidden>·</span>
              <span className="tnum">
                Budget {task.budgetMin ? fmtNaira(task.budgetMin) : "up to"} {task.budgetMin && task.budgetMax ? "–" : ""} {task.budgetMax ? fmtNaira(task.budgetMax) : ""}
              </span>
            </>
          )}
        </div>
        {task.source === "recommendation" && (
          <div className="mt-3">
            <InfoBanner tone="ai">
              <span className="inline-flex items-center gap-1.5">
                <Sparkles className="size-4 shrink-0" aria-hidden />
                Recommended by your intelligence{task.sourceTitle ? <> — “{task.sourceTitle}”</> : null}
              </span>
            </InfoBanner>
          </div>
        )}
      </div>

      <div className="space-y-5">
        <SectionCard title="The brief" description="Specialists bid against this description.">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{task.description}</p>
          {task.skills.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {task.skills.map((s) => (
                <Badge key={s} variant="outline" className="font-normal">
                  {s}
                </Badge>
              ))}
            </div>
          )}
        </SectionCard>

        {task.status === "open" && (
          <SectionCard
            title="Who fits this work"
            description="The matchmaker reads your brief against the vetted roster."
            action={
              matching ? <Loader2 className="size-4 animate-spin text-violet-600" aria-label="Matching" /> : (
                <Badge variant="outline" className="font-normal">
                  {match?.aiInterpreted ? "AI-matched" : match ? "Category-matched" : "Pending"}
                </Badge>
              )
            }
          >
            {matching && <LoadingState label="Matching specialists to this brief" rows={3} />}
            {!matching && matchError && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-semibold">Matchmaker unavailable</p>
                <p className="mt-1">{matchError} You can still invite matched-by-category specialists to bid below.</p>
                <Button size="sm" variant="outline" className="mt-3" onClick={() => data && runMatch(task)}>
                  Try matching again
                </Button>
              </div>
            )}
            {!matching && !matchError && match && (
              <div className="space-y-3">
                {match.note && <p className="text-sm text-muted-foreground">{match.note}</p>}
                {match.skillsToSeek.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Skills to look for</span>
                    {match.skillsToSeek.map((s) => (
                      <Badge key={s} className="border-transparent bg-violet-100 font-normal text-violet-800">
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}
                <div className="space-y-2">
                  {match.matches.map((m: MatchItem) => (
                    <div key={m.specialistId}>
                      <SpecialistRow
                        s={m.specialist}
                        onClick={() => navigate(`market/specialist/${m.specialistId}`)}
                        right={
                          invitedNames.has(m.specialistId) || bids.some((b) => b.specialist.id === m.specialistId) ? (
                            <Badge variant="outline" className="shrink-0 font-normal text-emerald-700">
                              Bid received
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="shrink-0 font-normal text-slate-500">
                              {m.source === "ai" ? "AI-matched" : "Category match"}
                            </Badge>
                          )
                        }
                      />
                      <p className="mt-1.5 pl-1 text-xs leading-relaxed text-muted-foreground">{m.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </SectionCard>
        )}

        <SectionCard
          title={`Bids (${bids.length})`}
          description={awarded ? "The accepted bid is highlighted. Others were declined automatically." : "Compare price, delivery time and the specialist behind each bid."}
          action={task.status === "open" && bids.length > 0 ? (
            <Button size="sm" variant="outline" onClick={inviteMatched} disabled={inviting}>
              {inviting ? <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden /> : <Gavel className="mr-1.5 size-3.5" aria-hidden />}
              Invite more
            </Button>
          ) : null}
        >
          {bids.length === 0 ? (
            <EmptyState
              icon={<Gavel className="size-5" />}
              title="No bids yet"
              description="Invite matched specialists and their indicative bids will appear here — you award only when you choose one."
              actions={
                task.status === "open" ? (
                  <Button size="sm" onClick={inviteMatched} disabled={inviting}>
                    {inviting ? (
                      <>
                        <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden /> Inviting…
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-1.5 size-4" aria-hidden /> Invite matched specialists
                      </>
                    )}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-4">
              {acceptedBid && (
                <InfoBanner tone="success" title={`Awarded to ${acceptedBid.specialist.name} — ${fmtNaira(acceptedBid.amount)}, about ${acceptedBid.days} ${acceptedBid.days === 1 ? "day" : "days"}`}>
                  You will be contacted to confirm scope and start. Payment and delivery happen directly between you and the specialist — this pilot does not process payments.{" "}
                  <button className="font-semibold underline" onClick={() => navigate(`market/specialist/${acceptedBid.specialist.id}`)}>
                    View profile
                  </button>
                </InfoBanner>
              )}
              <div className="grid gap-4 md:grid-cols-2">
                {bids.map((bid) => (
                  <BidCard
                    key={bid.id}
                    bid={bid}
                    canAward={task.status === "open" && bid.status === "pending"}
                    awarding={awardingBidId === bid.id}
                    onAward={() => void awardBid(bid)}
                    onProfile={() => navigate(`market/specialist/${bid.specialist.id}`)}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{INVITE_PILOT_NOTE}</p>
            </div>
          )}
        </SectionCard>

        {task.status === "open" && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">Not hiring for this any more? Closing it declines any pending bids.</p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 hover:text-red-700" disabled={closing}>
                  <X className="mr-1.5 size-4" aria-hidden /> Close without hiring
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Close this task?</AlertDialogTitle>
                  <AlertDialogDescription>
                    “{task.title}” will stop accepting bids and any pending bids will be declined. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep it open</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void closeTask()} className="bg-red-600 text-white hover:bg-red-700">
                    Close task
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {closed && <InfoBanner tone="info" title="Task closed">This brief was closed without hiring. You can always post a new one.</InfoBanner>}
      </div>
    </div>
  );
}

function BidCard({
  bid,
  canAward,
  awarding,
  onAward,
  onProfile,
}: {
  bid: BidDTO;
  canAward: boolean;
  awarding: boolean;
  onAward: () => void;
  onProfile: () => void;
}) {
  const s: SpecialistDTO = bid.specialist;
  const accepted = bid.status === "accepted";
  const declined = bid.status === "declined";

  return (
    <div className={`rounded-xl border p-4 ${accepted ? "border-emerald-300 bg-emerald-50/40" : declined ? "opacity-60" : "bg-white"}`}>
      <div className="flex items-start gap-3">
        <SpecialistAvatar id={s.id} name={s.name} />
        <div className="min-w-0 flex-1">
          <button onClick={onProfile} className="flex items-center gap-1.5 text-sm font-semibold hover:underline" aria-label={`View ${s.name}'s profile`}>
            <span className="truncate">{s.name}</span>
            {s.verified && <BadgeCheck className="size-4 shrink-0 text-emerald-600" aria-label="Verified specialist" />}
          </button>
          <p className="truncate text-xs text-muted-foreground">{s.headline}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold tnum leading-none">{fmtNaira(bid.amount)}</p>
          <p className="mt-1 text-xs text-muted-foreground">~{bid.days} {bid.days === 1 ? "day" : "days"} delivery</p>
        </div>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-slate-700">{bid.coverNote}</p>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="font-normal text-slate-500">
            {bid.inviteSource === "ai-match" ? "AI-matched invite" : "Direct invite"}
          </Badge>
          {accepted && (
            <Badge className="border-transparent bg-emerald-100 text-emerald-800">
              <UserRoundCheck className="mr-1 size-3" aria-hidden /> Accepted
            </Badge>
          )}
          {declined && <Badge variant="outline" className="font-normal text-slate-400">Declined</Badge>}
          {!accepted && !declined && <Badge variant="outline" className="font-normal text-slate-500">Pending</Badge>}
        </div>
        {canAward && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" disabled={awarding}>
                {awarding ? <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden /> : <Gavel className="mr-1.5 size-3.5" aria-hidden />}
                Accept bid
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Award the task to {s.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  {fmtNaira(bid.amount)} for about {bid.days} {bid.days === 1 ? "day" : "days"}. Other pending bids on this task will be declined automatically.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Not yet</AlertDialogCancel>
                <AlertDialogAction onClick={onAward}>Award task</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  );
}
