"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, BriefcaseBusiness, Clock3, Loader2, Send, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, SectionCard, InfoBanner } from "@/components/shared/layout";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { fmtDate, fmtNaira } from "@/lib/format";
import { navigate } from "@/lib/router";
import type { ScreenProps } from "../view-types";

type TaskSummary = { id: string; title: string; description: string; businessName: string; category: string; budgetMin: number | null; budgetMax: number | null; urgency: string; status: string };
type Invitation = { id: string; status: string; source: string; expiresAt: string | null; createdAt: string; task: TaskSummary };
type Bid = { id: string; taskId: string; amount: number; days: number; coverNote: string; status: string; createdAt: string; task: TaskSummary };
type Engagement = { id: string; status: string; agreedAmount: number; deliveryDays: number; paymentStatus: string; updatedAt: string; task: TaskSummary };
type Notification = { id: string; title: string; body: string; readAt: string | null; createdAt: string };
type DashboardData = {
  specialist: { id: string; name: string; status: string; verified: boolean; onboardingStep: number; reviewNote: string | null };
  invitations: Invitation[];
  bids: Bid[];
  engagements: Engagement[];
  notifications: Notification[];
};
type BidTarget = { task: TaskSummary };

export function SpecialistDashboard({ params }: ScreenProps) {
  void params;
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [bidFor, setBidFor] = useState<BidTarget | null>(null);
  const [amount, setAmount] = useState("");
  const [days, setDays] = useState("");
  const [coverNote, setCoverNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/market/specialist/dashboard", { cache: "no-store" });
        const json = (await response.json()) as { ok?: boolean; error?: string } & Partial<DashboardData>;
        if (!response.ok || !json.ok || !json.specialist) throw new Error(json.error || "Could not load your dashboard.");
        setData(json as DashboardData);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not load your dashboard.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [reload]);

  const activeInvitations = useMemo(() => data?.invitations.filter((item) => item.status === "pending") ?? [], [data]);

  async function decline(invitation: Invitation) {
    const response = await fetch(`/api/market/invitations/${invitation.id}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: "decline" }),
    });
    const json = (await response.json()) as { ok?: boolean; error?: string };
    if (!response.ok || !json.ok) return toast.error("Could not decline invitation", { description: json.error });
    toast("Invitation declined");
    setReload((value) => value + 1);
  }

  function startBid(invitation: Invitation) {
    setBidFor(invitation);
    setAmount(invitation.task.budgetMin ? String(invitation.task.budgetMin) : "");
    setDays("");
    setCoverNote("");
  }

  function editBid(bid: Bid) {
    setBidFor({ task: bid.task });
    setAmount(String(bid.amount));
    setDays(String(bid.days));
    setCoverNote(bid.coverNote);
  }

  async function withdrawBid(bid: Bid) {
    const response = await fetch(`/api/market/tasks/${bid.task.id}/bids`, { method: "DELETE" });
    const json = (await response.json()) as { ok?: boolean; error?: string };
    if (!response.ok || !json.ok) return toast.error("Bid not withdrawn", { description: json.error || "Please try again." });
    toast("Bid withdrawn");
    setReload((value) => value + 1);
  }

  async function submitBid() {
    if (!bidFor) return;
    setSubmitting(true);
    try {
      const response = await fetch(`/api/market/tasks/${bidFor.task.id}/bids`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount), days: Number(days), coverNote }),
      });
      const json = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !json.ok) throw new Error(json.error || "Could not submit your bid.");
      toast.success("Bid submitted", { description: "The business can now compare and award it." });
      setBidFor(null);
      setReload((value) => value + 1);
    } catch (caught) {
      toast.error("Bid not submitted", { description: caught instanceof Error ? caught.message : "Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="mx-auto max-w-6xl"><LoadingState label="Loading specialist dashboard" rows={5} /></div>;
  if (error || !data) return <div className="mx-auto max-w-3xl"><ErrorState title="Dashboard unavailable" description={error} onRetry={() => setReload((value) => value + 1)} /></div>;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader title={`Welcome, ${data.specialist.name.split(" ")[0]}`} description="Manage invitations, bids and active client work." actions={<Button variant="outline" onClick={() => navigate("specialist/onboarding")}><UserRound className="mr-1.5 size-4" /> Edit profile</Button>} />

      {data.specialist.status !== "approved" ? (
        <InfoBanner tone={data.specialist.status === "rejected" ? "warning" : "info"} title={data.specialist.status === "submitted" ? "Application under review" : data.specialist.status === "rejected" ? "Profile changes requested" : "Finish your specialist application"}>
          {data.specialist.reviewNote || "Your profile must be approved before businesses can invite you or you can bid."} <button className="font-semibold underline" onClick={() => navigate("specialist/onboarding")}>Open profile</button>
        </InfoBanner>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Metric icon={<Bell className="size-4" />} label="Open invitations" value={activeInvitations.length} />
        <Metric icon={<Send className="size-4" />} label="Active bids" value={data.bids.filter((item) => item.status === "pending").length} />
        <Metric icon={<BriefcaseBusiness className="size-4" />} label="Active engagements" value={data.engagements.filter((item) => !["completed", "cancelled"].includes(item.status)).length} />
      </div>

      <SectionCard title={`Invitations (${activeInvitations.length})`} description="Only bid when the scope, price and delivery time are realistic.">
        {activeInvitations.length === 0 ? <EmptyState icon={<Clock3 className="size-5" />} title="No open invitations" description="Approved specialists receive invitations when their expertise fits a business task." /> : <div className="space-y-3">{activeInvitations.map((invitation) => <div key={invitation.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{invitation.task.title}</p><p className="mt-0.5 text-sm text-muted-foreground">{invitation.task.businessName} · {invitation.task.category}</p></div><Badge variant="outline">{invitation.source === "ai-match" ? "Matched invitation" : "Direct invitation"}</Badge></div><p className="mt-3 line-clamp-3 text-sm leading-relaxed">{invitation.task.description}</p><p className="mt-2 text-xs text-muted-foreground">Budget {budget(invitation.task)}{invitation.expiresAt ? ` · expires ${fmtDate(invitation.expiresAt)}` : ""}</p><div className="mt-3 flex gap-2"><Button size="sm" onClick={() => startBid(invitation)}>Prepare bid</Button><Button size="sm" variant="ghost" onClick={() => void decline(invitation)}>Decline</Button></div></div>)}</div>}
      </SectionCard>

      {bidFor ? <SectionCard title={`Bid on “${bidFor.task.title}”`} description="Your bid is authored by you and can be updated until it is awarded."><div className="grid gap-4 sm:grid-cols-2"><Field label="Total amount (NGN)"><Input type="number" min={1000} value={amount} onChange={(event) => setAmount(event.target.value)} /></Field><Field label="Delivery days"><Input type="number" min={1} max={365} value={days} onChange={(event) => setDays(event.target.value)} /></Field><div className="sm:col-span-2"><Field label="Approach and deliverables"><Textarea rows={6} maxLength={3000} value={coverNote} onChange={(event) => setCoverNote(event.target.value)} placeholder="Explain how you will approach the task, what is included, and what you need from the client…" /></Field></div><div className="sm:col-span-2 flex justify-end gap-2"><Button variant="outline" onClick={() => setBidFor(null)}>Cancel</Button><Button disabled={submitting} onClick={() => void submitBid()}>{submitting ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Send className="mr-1.5 size-4" />} Submit bid</Button></div></div></SectionCard> : null}

      <SectionCard title="Engagements" description="Awarded work, delivery and completion status.">{data.engagements.length === 0 ? <EmptyState title="No engagements yet" description="An engagement appears after a business accepts your bid." /> : <div className="space-y-2">{data.engagements.map((engagement) => <button key={engagement.id} className="flex w-full items-center justify-between gap-3 rounded-xl border p-4 text-left hover:bg-slate-50" onClick={() => navigate(`specialist/engagement/${engagement.id}`)}><div><p className="font-medium">{engagement.task.title}</p><p className="text-xs text-muted-foreground">Updated {fmtDate(engagement.updatedAt)} · payment {engagement.paymentStatus}</p></div><div className="text-right"><Badge variant="outline">{engagement.status}</Badge><p className="mt-1 text-sm font-semibold">{fmtNaira(engagement.agreedAmount)}</p></div></button>)}</div>}</SectionCard>

      <SectionCard title="Recent updates" description="Invitations, awards, messages, payments and reviews.">{data.notifications.length === 0 ? <EmptyState icon={<Bell className="size-5" />} title="No updates yet" description="Marketplace updates will appear here." /> : <div className="space-y-2">{data.notifications.slice(0, 10).map((notification) => <div key={notification.id} className="rounded-xl border p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium">{notification.title}</p><p className="mt-0.5 text-sm text-muted-foreground">{notification.body}</p></div>{notification.readAt ? null : <span className="mt-1 size-2 shrink-0 rounded-full bg-brand-600" aria-label="Unread" />}</div><p className="mt-1 text-xs text-muted-foreground">{fmtDate(notification.createdAt)}</p></div>)}</div>}</SectionCard>

      <SectionCard title="Recent bids">{data.bids.length === 0 ? <EmptyState title="No bids submitted" description="Your submitted bids appear here." /> : <div className="space-y-2">{data.bids.slice(0, 10).map((bid) => <div key={bid.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"><div><p className="text-sm font-medium">{bid.task.title}</p><p className="text-xs text-muted-foreground">{bid.days} days · {fmtDate(bid.createdAt)}</p></div><div className="flex items-center gap-2"><div className="text-right"><p className="text-sm font-semibold">{fmtNaira(bid.amount)}</p><Badge variant="outline">{bid.status}</Badge></div>{bid.status === "pending" ? <><Button size="sm" variant="outline" onClick={() => editBid(bid)}>Edit</Button><Button size="sm" variant="ghost" onClick={() => void withdrawBid(bid)}>Withdraw</Button></> : null}</div></div>)}</div>}</SectionCard>
    </div>
  );
}

function budget(task: TaskSummary): string { if (task.budgetMin && task.budgetMax) return `${fmtNaira(task.budgetMin)}–${fmtNaira(task.budgetMax)}`; if (task.budgetMin) return `from ${fmtNaira(task.budgetMin)}`; if (task.budgetMax) return `up to ${fmtNaira(task.budgetMax)}`; return "not specified"; }
function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) { return <div className="rounded-xl border bg-white p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground">{icon}{label}</div><p className="mt-2 text-2xl font-bold">{value}</p></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>; }
