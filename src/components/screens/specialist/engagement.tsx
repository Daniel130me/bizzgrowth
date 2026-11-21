"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Breadcrumbs, InfoBanner, SectionCard } from "@/components/shared/layout";
import { ErrorState, LoadingState } from "@/components/shared/states";
import { fmtDate, fmtNaira } from "@/lib/format";
import { navigate } from "@/lib/router";
import type { ScreenProps } from "../view-types";

type EngagementData = {
  id: string;
  status: string;
  paymentStatus: string;
  agreedAmount: number;
  deliveryDays: number;
  scope: string;
  startedAt: string | null;
  deliveredAt: string | null;
  completedAt: string | null;
  hasReviewed?: boolean;
  task: { title: string; businessName: string };
  specialist: { name: string };
};
type Message = { id: string; senderUserId: string; senderRole: string; body: string; createdAt: string };

const ACTIONS: Record<string, { action: string; label: string }[]> = {
  awarded: [{ action: "accept", label: "Accept award" }],
  accepted: [{ action: "start", label: "Start work" }],
  "in-progress": [{ action: "deliver", label: "Mark delivered" }],
};

export function SpecialistEngagement({ params }: ScreenProps) {
  const [engagement, setEngagement] = useState<EngagementData | null>(null);
  const [role, setRole] = useState<"owner" | "specialist">("specialist");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [error, setError] = useState("");
  const [disputeReason, setDisputeReason] = useState("");
  const [rating, setRating] = useState("5");
  const [reviewComment, setReviewComment] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [engagementResponse, messagesResponse] = await Promise.all([
        fetch(`/api/market/engagements/${encodeURIComponent(params.id)}`, { cache: "no-store" }),
        fetch(`/api/market/engagements/${encodeURIComponent(params.id)}/messages`, { cache: "no-store" }),
      ]);
      const engagementJson = (await engagementResponse.json()) as { ok?: boolean; engagement?: EngagementData; role?: "owner" | "specialist"; error?: string };
      const messagesJson = (await messagesResponse.json()) as { ok?: boolean; messages?: Message[]; error?: string };
      if (!engagementResponse.ok || !engagementJson.ok || !engagementJson.engagement) throw new Error(engagementJson.error || "Engagement not found.");
      if (!messagesResponse.ok || !messagesJson.ok) throw new Error(messagesJson.error || "Messages could not be loaded.");
      setEngagement(engagementJson.engagement);
      setRole(engagementJson.role || "specialist");
      setMessages(messagesJson.messages || []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load this engagement.");
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => { void load(); }, [load]);

  async function transition(action: string, reason?: string) {
    setWorking(action);
    try {
      const response = await fetch(`/api/market/engagements/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const json = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !json.ok) throw new Error(json.error || "Status could not be updated.");
      toast.success("Engagement updated");
      await load();
    } catch (caught) {
      toast.error("Could not update engagement", { description: caught instanceof Error ? caught.message : "Please try again." });
    } finally {
      setWorking("");
    }
  }

  async function submitReview() {
    setWorking("review");
    try {
      const response = await fetch(`/api/market/engagements/${params.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: Number(rating), comment: reviewComment }),
      });
      const json = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !json.ok) throw new Error(json.error || "Review could not be saved.");
      toast.success("Review published");
      setReviewComment("");
      await load();
    } catch (caught) {
      toast.error("Review not saved", { description: caught instanceof Error ? caught.message : "Please try again." });
    } finally {
      setWorking("");
    }
  }

  async function sendMessage() {
    if (!draft.trim()) return;
    setWorking("message");
    try {
      const response = await fetch(`/api/market/engagements/${params.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: draft }),
      });
      const json = (await response.json()) as { ok?: boolean; message?: Message; error?: string };
      if (!response.ok || !json.ok || !json.message) throw new Error(json.error || "Message was not sent.");
      setMessages((current) => [...current, json.message!]);
      setDraft("");
    } catch (caught) {
      toast.error("Message not sent", { description: caught instanceof Error ? caught.message : "Please try again." });
    } finally {
      setWorking("");
    }
  }

  if (loading && !engagement) return <div className="mx-auto max-w-4xl"><LoadingState label="Loading engagement" rows={5} /></div>;
  if (error || !engagement) return <div className="mx-auto max-w-3xl"><ErrorState title="Engagement unavailable" description={error} onRetry={() => void load()} onHome={() => navigate(role === "specialist" ? "specialist/dashboard" : "market")} /></div>;

  const actions = role === "specialist" ? ACTIONS[engagement.status] || [] : engagement.status === "delivered" ? [{ action: "complete", label: "Accept delivery" }] : [];
  const ownerCanCancel = role === "owner" && ["awarded", "accepted"].includes(engagement.status);
  const ownerCanDispute = role === "owner" && ["in-progress", "delivered"].includes(engagement.status);
  const ownerCanMarkPaid = role === "owner" && engagement.paymentStatus !== "paid" && ["accepted", "in-progress", "delivered", "completed"].includes(engagement.status);
  const closed = ["completed", "cancelled"].includes(engagement.status);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Breadcrumbs items={[{ label: role === "specialist" ? "Dashboard" : "Marketplace", onClick: () => navigate(role === "specialist" ? "specialist/dashboard" : "market") }, { label: "Engagement" }]} />
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-bold">{engagement.task.title}</h1><p className="mt-1 text-sm text-muted-foreground">{role === "specialist" ? engagement.task.businessName : engagement.specialist.name}</p></div><div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{engagement.status}</Badge>{actions.map((item) => <Button key={item.action} disabled={Boolean(working)} onClick={() => void transition(item.action)}>{working === item.action ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}{item.label}</Button>)}{ownerCanMarkPaid ? <Button variant="outline" disabled={Boolean(working)} onClick={() => void transition("mark-paid")}>Mark paid</Button> : null}{ownerCanCancel ? <Button variant="outline" disabled={Boolean(working)} onClick={() => void transition("cancel")}>Cancel engagement</Button> : null}</div></div>
      <div className="grid gap-3 sm:grid-cols-3"><Summary label="Agreed amount" value={fmtNaira(engagement.agreedAmount)} /><Summary label="Delivery" value={`${engagement.deliveryDays} days`} /><Summary label="Payment" value={engagement.paymentStatus} /></div>
      {engagement.status === "awarded" && role === "specialist" ? <InfoBanner tone="warning" title="Accept before starting">Confirm the award only when you can deliver the agreed scope and timeline.</InfoBanner> : null}
      {engagement.status === "delivered" ? <InfoBanner tone="success" title="Work delivered">The hiring business can review and accept the delivery.</InfoBanner> : null}
      <SectionCard title="Agreed scope"><p className="whitespace-pre-wrap text-sm leading-relaxed">{engagement.scope}</p></SectionCard>
      {ownerCanDispute ? <SectionCard title="Raise a dispute" description="Explain the issue clearly. The reason is stored with the engagement for platform review."><div className="space-y-3"><Textarea value={disputeReason} maxLength={1500} rows={4} onChange={(event) => setDisputeReason(event.target.value)} placeholder="Describe the scope, delivery or communication issue…" /><div className="flex justify-end"><Button variant="outline" disabled={Boolean(working) || disputeReason.trim().length < 20} onClick={() => void transition("dispute", disputeReason)}>Raise dispute</Button></div></div></SectionCard> : null}
      {role === "owner" && engagement.status === "completed" && !engagement.hasReviewed ? <SectionCard title="Review the specialist" description="Your review updates the specialist's verified marketplace track record."><div className="space-y-3"><div><label htmlFor="review-rating" className="text-sm font-medium">Rating</label><select id="review-rating" className="mt-1 h-10 w-full rounded-md border bg-white px-3 text-sm" value={rating} onChange={(event) => setRating(event.target.value)}>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} / 5</option>)}</select></div><Textarea value={reviewComment} maxLength={2000} rows={4} onChange={(event) => setReviewComment(event.target.value)} placeholder="Describe the quality, communication and delivery…" /><div className="flex justify-end"><Button disabled={Boolean(working) || reviewComment.trim().length < 20} onClick={() => void submitReview()}>{working === "review" ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}Publish review</Button></div></div></SectionCard> : null}
      <SectionCard title="Messages" description="Keep scope decisions and delivery updates attached to the engagement.">
        {messages.length === 0 ? <div className="py-6 text-center text-sm text-muted-foreground"><MessageSquare className="mx-auto mb-2 size-5" />No messages yet.</div> : <div className="max-h-96 space-y-3 overflow-y-auto pr-1">{messages.map((message) => <div key={message.id} className={`max-w-[85%] rounded-xl p-3 text-sm ${message.senderRole === role ? "ml-auto bg-slate-900 text-white" : "border bg-white"}`}><p className="whitespace-pre-wrap">{message.body}</p><p className={`mt-1 text-[11px] ${message.senderRole === role ? "text-slate-300" : "text-muted-foreground"}`}>{message.senderRole} · {fmtDate(message.createdAt)}</p></div>)}</div>}
        {!closed ? <div className="mt-4 flex gap-2"><Textarea value={draft} maxLength={4000} rows={3} placeholder="Write a scope, progress or delivery message…" onChange={(event) => setDraft(event.target.value)} /><Button size="icon" disabled={!draft.trim() || working === "message"} onClick={() => void sendMessage()} aria-label="Send message">{working === "message" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}</Button></div> : null}
      </SectionCard>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border bg-white p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-semibold capitalize">{value}</p></div>; }
