"use client";
// Screens 48–49 — Ask Your Business + Conversation History.
// Questions go to Nellovia, the AI consultant (POST /api/ask), with a snapshot
// of the workspace data; every answer is generated for the exact question asked.
// There are NO canned answers here: if Nellovia cannot be reached, we say
// so honestly and offer a retry instead of showing a scripted reply.

import { useEffect, useId, useRef, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CircleDashed,
  CornerDownRight,
  Database,
  History,
  MessageCircleQuestion,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/states";
import { PageHeader } from "@/components/shared/layout";
import { ProvenanceBadge } from "@/components/shared/badges";
import { useActiveCoachStep, useBizz } from "@/lib/store";
import { getBusiness } from "@/lib/data/businesses";
import { ownerMonthsFromEntries } from "@/lib/data/user-business";
import type { AskWorkspaceContext, NoticedChallenge } from "@/lib/checkup";
import { buildBusinessContext, coachingContext } from "@/lib/ai-context";
import { DraftButton, TryThisBox } from "@/components/shared/try-this";
import { StepKindPill } from "@/components/shared/coach";
import { NoticedChallengeCard } from "@/components/shared/challenges";
import { challengesContext } from "@/lib/challenges";
import { daysSince, nextCheckIn, type DraftHint } from "@/lib/coach";
import { chatDraftKey, getClientId, loadDraft, newChatId, saveDraft, syncChat, type ChatLogMessage } from "@/lib/chat-log";
import type { Provenance } from "@/lib/types";
import type { ViewMap } from "../view-types";

// ---------- Answer model (produced by Nellovia, the AI consultant; never hardcoded) ----------

interface AskEvidence {
  label: string;
  value: string;
  provenance: Provenance;
  source: string;
  factId?: string;
}

interface AnswerContent {
  grounded: string[];
  interpretation?: string;
  limitations?: string[];
  evidence: AskEvidence[];
  referencedPeriod: string;
  tryThis?: { title: string; body: string } | null;
  /** Words the app can write for this answer, on request. */
  draft?: DraftHint | null;
  followUps?: string[];
  verified?: boolean;
  /** A new problem the question described — offered as a challenge, one tap to add. */
  newChallenge?: NoticedChallenge | null;
}

/** Questions worth asking, written from this owner's own checkup and diagnosis. */
function suggestionsFor(
  facts: { bottleneck?: string; pricePresentation?: string; followUp?: string; repeat?: string } | null,
  stage: string | undefined,
): string[] | null {
  if (!facts) return null;
  const b = (facts.bottleneck ?? "").toLowerCase();
  const out: string[] = ["What should I do first this week?"];
  if (stage === "convert" || /price|pay|buy|expensive|leave|quiet/.test(b)) {
    out.push("How do I follow up without sounding pushy?", "What should I say when someone says it's too expensive?", "How should I present my prices?");
  } else if (stage === "found" || /not enough|find|known|visib/.test(b)) {
    out.push("How can I get more people to hear about me?", "How do I ask happy customers to recommend me?", "Where do my best customers come from?");
  } else if (stage === "return" || /steady|season|some months/.test(b)) {
    out.push("How do I get past customers to come back?", "How can I make the quiet months less quiet?", "What should I send past customers?");
  } else if (stage === "deliver" || /busy|time|capacity/.test(b)) {
    out.push("Should I raise my prices?", "How do I turn down work or orders without losing customers?", "What can I stop doing myself?");
  } else {
    out.push("What's holding my business back?", "How do I get more paying customers?", "What should I track each week?");
  }
  out.push("What would make the biggest difference this month?");
  return out.slice(0, 5);
}

// ---------- Screen 48 — Ask Your Business ----------

/** An earlier answer the owner is following up on — sent to Nellovia so it
 *  knows exactly what "this" refers to, even when it's older than the recent turns. */
type ReplyContext = { question: string; summary: string };

type ThreadItem =
  | { kind: "question"; text: string; /** The earlier question this follows up on (shown as a quote). */ replyTo?: string }
  | { kind: "answer"; question: string; content: AnswerContent }
  | { kind: "failed"; question: string; reply?: ReplyContext };

function replyFrom(question: string, answer: AnswerContent): ReplyContext {
  return { question, summary: [...answer.grounded, answer.interpretation ?? ""].join(" ").trim().slice(0, 900) };
}

/** Hand-off from Conversation history: the past answer picked to follow up on.
 *  Read once by the Ask screen when it opens. */
const followUpHandoff: { current: ReplyContext | null } = { current: null };

function AskScreen() {
  const businessId = useBizz((s) => s.businessId);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const checkupFacts = useBizz((s) => s.checkup.facts);
  const checkupDiagnosis = useBizz((s) => s.checkup.diagnosis);
  const checkupImproved = useBizz((s) => s.checkup.improved);
  const checkupTranscript = useBizz((s) => s.checkup.transcript);
  const manualEntries = useBizz((s) => s.manualEntries);
  const recordAsk = useBizz((s) => s.recordAsk);
  const coach = useBizz((s) => s.coach);
  const challenges = useBizz((s) => s.challenges);
  const activeStep = useActiveCoachStep();
  const navigate = useBizz((s) => s.navigate);
  const business = getBusiness(businessId, userWorkspace, checkupFacts, manualEntries);

  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [slow, setSlow] = useState(false);
  const [thread, setThread] = useState<ThreadItem[]>([]);
  const threadRef = useRef<ThreadItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydrated = useBizz((s) => s.hydrated);
  // Chat log: kept in the browser (resume after reload) and on the server (quality review).
  const conversationIdRef = useRef("");
  const startedAtRef = useRef("");
  const logRef = useRef<ChatLogMessage[]>([]);
  const draftKeyRef = useRef("");
  // The newest question bubble — scrolled into view when the owner asks, because
  // the thread sits below the hero and an answer appearing off-screen looks like nothing happened.
  const lastQuestionRef = useRef<HTMLDivElement>(null);
  const [scrollTick, setScrollTick] = useState(0);
  // A past answer picked in Conversation history — the next typed question follows up on it.
  const [replyTarget, setReplyTarget] = useState<ReplyContext | null>(null);
  useEffect(() => {
    if (!followUpHandoff.current) return;
    setReplyTarget(followUpHandoff.current);
    followUpHandoff.current = null;
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);
  useEffect(() => {
    if (!scrollTick) return;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    lastQuestionRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [scrollTick]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!hydrated || draftKeyRef.current) return;
    draftKeyRef.current = chatDraftKey("ask", `${businessId}-${userWorkspace?.name ?? ""}`);
    const draft = loadDraft<{ v: 1; conversationId: string; startedAt: string; thread: ThreadItem[]; log: ChatLogMessage[] }>(draftKeyRef.current);
    if (draft && draft.v === 1 && Array.isArray(draft.thread) && draft.thread.length > 0) {
      conversationIdRef.current = draft.conversationId;
      startedAtRef.current = draft.startedAt;
      logRef.current = draft.log ?? [];
      threadRef.current = draft.thread;
      setThread(draft.thread);
    } else {
      conversationIdRef.current = newChatId("ask");
      startedAtRef.current = new Date().toISOString();
    }
  }, [hydrated, businessId, userWorkspace?.name]);

  // Keep the thread in the browser so a reload resumes the conversation.
  useEffect(() => {
    if (!draftKeyRef.current || thread.length === 0) return;
    saveDraft(draftKeyRef.current, { v: 1, conversationId: conversationIdRef.current, startedAt: startedAtRef.current, thread, log: logRef.current });
  }, [thread]);

  /** Record one chat message on the server (and in the local log). */
  function logMessage(role: "ai" | "user", text: string, meta?: Record<string, unknown>) {
    if (!conversationIdRef.current) {
      conversationIdRef.current = newChatId("ask");
      startedAtRef.current = new Date().toISOString();
    }
    logRef.current = [...logRef.current, { seq: logRef.current.length, role, text, at: new Date().toISOString(), meta }];
    syncChat({
      id: conversationIdRef.current,
      chatType: "ask",
      screen: "ask",
      clientId: getClientId(),
      workspaceId: businessId,
      workspaceName: business.name,
      startedAt: startedAtRef.current,
      facts: checkupFacts,
      messages: logRef.current,
    });
  }

  /** Snapshot of the workspace Nellovia reasons over on the server. */
  function buildContext(): AskWorkspaceContext {
    if (businessId === "user-workspace") {
      // The owner's own workspace: ground Nellovia in their entered totals
      // when they exist, otherwise be honest that nothing is measured yet.
      const months = ownerMonthsFromEntries(manualEntries);
      const last = months.length ? months[months.length - 1] : undefined;
      const prev = months.length > 1 ? months[months.length - 2] : undefined;
      return {
        // Everything the owner told the checkup, their diagnosis and how far they are with the plan.
        business: buildBusinessContext({
          workspace: userWorkspace,
          facts: checkupFacts,
          diagnosis: checkupDiagnosis,
          months: months.map((m) => ({ label: m.label, revenue: m.revenue, enquiries: m.enquiries, customers: m.customers })),
          // The step they're trying right now, so answers can connect to it.
          coaching: coachingContext(coach, businessId),
          // Their list of challenges — so a new problem can be noticed, and an old one isn't added twice.
          challenges: challengesContext(challenges.filter((c) => c.workspaceId === "user-workspace")),
          // What they said in the checkup, word for word (amounts owed, dates, cash…).
          transcript: checkupTranscript,
        }),
        name: business.name,
        type: business.type,
        location: business.location,
        currency: "₦",
        isUserWorkspace: true,
        hasMeasuredData: Boolean(last),
        periodLabel: last ? last.label : "No measured month yet — your checkup answers only",
        metrics: last
          ? {
              spend: last.spend ?? 0,
              enquiries: last.enquiries,
              customers: last.customers,
              orders: last.orders,
              traffic: last.traffic,
              revenue: last.revenue ?? 0,
              prev: prev
                ? {
                    spend: prev.spend ?? 0,
                    enquiries: prev.enquiries,
                    customers: prev.customers,
                    orders: prev.orders,
                    traffic: prev.traffic,
                    revenue: prev.revenue ?? 0,
                  }
                : undefined,
            }
          : undefined,
        channelCounts: checkupImproved?.channelRows ?? undefined,
        userFacts: checkupFacts
          ? {
              whatTheySell: checkupFacts.whatTheySell,
              primaryGoal: checkupFacts.primaryGoal,
              customers: checkupFacts.customers,
              channels: checkupFacts.channels,
              trends: checkupFacts.trends,
              recentChanges: checkupFacts.recentChanges,
            }
          : null,
      };
    }
    const monthly = business.monthly;
    const last = monthly[monthly.length - 1];
    const prev = monthly[monthly.length - 2];
    return {
      name: business.name,
      type: business.type,
      location: business.location,
      currency: "₦",
      isUserWorkspace: false,
      hasMeasuredData: true,
      periodLabel: `${last.label} 2026`,
      metrics: {
        spend: last.spend,
        enquiries: last.enquiries || undefined,
        customers: last.customers || undefined,
        orders: last.orders,
        traffic: last.traffic,
        revenue: last.revenue,
        prev: {
          spend: prev.spend,
          enquiries: prev.enquiries || undefined,
          customers: prev.customers || undefined,
          orders: prev.orders,
          traffic: prev.traffic,
          revenue: prev.revenue,
        },
      },
      channels: business.channels.map((c) => ({
        name: c.name,
        enquiries: c.enquiries,
        customers: c.customers,
        conversion: c.conversion,
        cac: c.cac,
        spend: c.spend,
      })),
      userFacts: null,
    };
  }

  const ownSuggestions = businessId === "user-workspace" ? suggestionsFor(checkupFacts, checkupDiagnosis?.focusStage) : null;
  const suggestions =
    ownSuggestions ??
    (business.type === "service"
      ? [
          "How is my business doing right now?",
          "What should I focus on this week?",
          "Where are my best customers coming from?",
          "What changed recently?",
          "What have we tried before?",
        ]
      : [
          "Why are more people looking but fewer buying?",
          "What should I focus on this week?",
          "Where are my best customers coming from?",
          "What changed recently?",
          "What have we tried before?",
        ]);

  function pushItem(item: ThreadItem) {
    setThread((t) => {
      const next: ThreadItem[] = [...t, item];
      threadRef.current = next;
      return next;
    });
  }

  function removeFailedAndRetry(question: string, reply?: ReplyContext) {
    setThread((t) => {
      // Drop the failed marker, keep everything else (question bubbles stay).
      const next: ThreadItem[] = t.filter((item) => !(item.kind === "failed" && item.question === question));
      threadRef.current = next;
      return next;
    });
    ask(question, reply);
  }

  /** Ask Nellovia. `reply` = the earlier answer this question follows up on. Returns true when sent. */
  function ask(raw: string, reply?: ReplyContext): boolean {
    const q = raw.trim();
    if (!q) {
      toast.error("Type a question first", { description: "Ask in your own words, or pick a suggestion." });
      return false;
    }
    if (typing) return false;
    setInput("");
    pushItem({ kind: "question", text: q, ...(reply ? { replyTo: reply.question } : {}) });
    setScrollTick((n) => n + 1);
    logMessage("user", q, reply ? { replyTo: reply.question } : undefined);
    setTyping(true);
    setSlow(false);
    // A considered answer can take a little while — say so instead of leaving dots.
    const slowTimer = setTimeout(() => setSlow(true), 6000);
    void (async () => {
      try {
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: q,
            history: threadRef.current
              .filter((item): item is Extract<ThreadItem, { kind: "answer" }> => item.kind === "answer")
              .slice(-4)
              .map((item) => ({
                question: item.question,
                summary: item.content.grounded.join(" ").slice(0, 420),
              })),
            ...(reply ? { replyTo: reply } : {}),
            workspace: buildContext(),
          }),
        });
        const data = (await res.json()) as { ok?: boolean; answer?: AnswerContent; error?: string };
        if (data?.ok && data.answer && Array.isArray(data.answer.grounded) && data.answer.grounded.length > 0) {
          pushItem({ kind: "answer", question: q, content: data.answer });
          logMessage("ai", data.answer.grounded.join("\n\n"), { answer: data.answer });
          setTyping(false);
          // Remember the real conversation for the history screen.
          recordAsk({
            workspaceId: businessId,
            question: q,
            // Long enough to follow up on later from Conversation history (the list clamps it).
            summary: [...data.answer.grounded, data.answer.interpretation ?? ""].join(" ").trim().slice(0, 700),
            period: data.answer.referencedPeriod ?? "",
          });
          return;
        }
        throw new Error(data?.error ?? "no answer");
      } catch {
        // Honest failure — no canned answer can stand in for Nellovia.
        pushItem({ kind: "failed", question: q, ...(reply ? { reply } : {}) });
        logMessage("ai", "(Nellovia could not answer — the owner was shown a retry option.)", { failed: true });
        setTyping(false);
      } finally {
        clearTimeout(slowTimer);
        setSlow(false);
      }
    })();
    return true;
  }

  const activeNext = activeStep ? nextCheckIn(activeStep.checkIns) : null;
  const lastQuestionIndex = thread.reduce((last, item, idx) => (item.kind === "question" ? idx : last), -1);
  // Only the newest answer carries the follow-up box, so the conversation always continues at the bottom.
  const lastAnswerIndex = thread.reduce((last, item, idx) => (item.kind === "answer" ? idx : last), -1);

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* The step they're trying — a light reminder, never a nag */}
      {activeStep ? (
        <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-brand-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">You’re trying</span>
              <StepKindPill step={activeStep.step} />
            </div>
            <p className="mt-0.5 truncate text-sm font-medium text-slate-900">
              {activeStep.step.title}
              <span className="font-normal text-slate-500"> · day {Math.min(activeStep.step.days, daysSince(activeStep.acceptedAt) + 1)} of {activeStep.step.days}</span>
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="outline" onClick={() => ask(`How's my step going — "${activeStep.step.title}"? What should I watch for?`)} disabled={typing}>
              Ask about it
            </Button>
            <Button
              size="sm"
              className={activeNext?.due ? "bg-amber-600 hover:bg-amber-700" : "bg-brand-600 hover:bg-brand-700"}
              onClick={() => navigate(`check-in/${activeStep.id}`)}
            >
              {activeNext?.due ? "Check in now" : "Share how it’s going"}
            </Button>
          </div>
        </div>
      ) : null}

      {/* Hero — expressive but serious */}
      <Card className="overflow-hidden border-brand-200 bg-gradient-to-br from-brand-50 via-white to-white p-0">
        <div className="border-b border-brand-100 px-6 pt-6 pb-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
                <Sparkles className="size-5" aria-hidden />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Ask Nellovia anything about your business</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Nellovia, your AI business consultant, reads {business.name}&apos;s workspace data and answers your exact question.
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("ask/history")}>
              <History className="mr-1.5 size-4" aria-hidden /> Conversation history
            </Button>
          </div>
          {replyTarget ? (
            <div className="mt-4 flex items-start justify-between gap-3 rounded-xl border-l-4 border-brand-400 bg-brand-50 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-600">Following up on</p>
                <p className="mt-0.5 line-clamp-2 text-sm text-brand-950">{replyTarget.question}</p>
              </div>
              <button
                type="button"
                onClick={() => setReplyTarget(null)}
                className="-mr-1 shrink-0 rounded-md p-1 text-brand-600 hover:bg-brand-100 hover:text-brand-800"
                aria-label="Don't follow up on this — ask a new question instead"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          ) : null}
          <form
            className={replyTarget ? "mt-2 flex flex-col gap-2 sm:flex-row" : "mt-4 flex flex-col gap-2 sm:flex-row"}
            onSubmit={(e) => {
              e.preventDefault();
              if (ask(input, replyTarget ?? undefined)) setReplyTarget(null);
            }}
          >
            <label htmlFor="ask-input" className="sr-only">
              {replyTarget ? "Ask your follow-up question" : "Ask a question about your business"}
            </label>
            <Input
              id="ask-input"
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={replyTarget ? "Ask your follow-up…" : "Ask in your own words — follow-ups are welcome"}
              className="h-12 flex-1 border-brand-200 bg-white text-base"
              autoComplete="off"
            />
            <Button type="submit" className="h-12 bg-brand-600 px-6 text-base hover:bg-brand-700" disabled={typing}>
              <Send className="mr-2 size-4" aria-hidden /> Ask
            </Button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                disabled={typing}
                className="rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-100 disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <p className="px-6 py-3 text-xs text-muted-foreground">
          Every answer is written fresh for your question, grounded in this workspace&apos;s recorded data and your
          checkup answers, with sources shown. Numbers come only from your data — never invented.
        </p>
      </Card>

      {/* Thread */}
      <div className="mt-6 space-y-4">
        {thread.length === 0 && !typing ? (
          <EmptyState
            icon={<MessageCircleQuestion className="size-5" />}
            title="Start with a question"
            description="Try a suggestion above, or ask Nellovia in your own words. Answers reference the actual data recorded in this workspace and show where each fact came from."
          />
        ) : null}

        {thread.map((item, i) =>
          item.kind === "question" ? (
            <div key={i} ref={i === lastQuestionIndex ? lastQuestionRef : undefined} className="flex scroll-mt-24 justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-600 px-4 py-2.5 text-sm leading-relaxed text-white sm:max-w-[70%]">
                {item.replyTo ? (
                  // WhatsApp-style quote: which earlier answer this question is about.
                  <span className="mb-1.5 block rounded-lg border-l-2 border-white/70 bg-black/10 px-2.5 py-1 text-xs leading-snug text-white/90">
                    <span className="block font-semibold">Following up on</span>
                    <span className="line-clamp-2">{item.replyTo}</span>
                  </span>
                ) : null}
                {item.text}
              </p>
            </div>
          ) : item.kind === "answer" ? (
            <AnswerCard
              key={i}
              answer={item.content}
              question={item.question}
              latest={i === lastAnswerIndex}
              onAsk={(q, reply) => ask(q, reply)}
              canAsk={!typing}
            />
          ) : (
            <FailedCard key={i} question={item.question} onRetry={() => removeFailedAndRetry(item.question, item.reply)} />
          )
        )}

        {typing ? (
          <Card className="flex items-center gap-3 p-4" role="status" aria-label="Nellovia is writing your answer">
            <div className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Sparkles className="size-4" aria-hidden />
            </div>
            <div className="flex items-center gap-1.5" aria-hidden>
              <span className="size-2 animate-bounce rounded-full bg-brand-400 [animation-delay:0ms]" />
              <span className="size-2 animate-bounce rounded-full bg-brand-400 [animation-delay:150ms]" />
              <span className="size-2 animate-bounce rounded-full bg-brand-400 [animation-delay:300ms]" />
            </div>
            <span className="text-sm text-muted-foreground">
              {slow ? "Nellovia is working through your answers and your diagnosis — a good answer is worth a few more seconds…" : "Nellovia is thinking through your business…"}
            </span>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

/** Honest failure state — shown when Nellovia cannot be reached.
 *  Deliberately NOT a canned answer: pretending would break trust. */
function FailedCard({ question, onRetry }: { question: string; onRetry: () => void }) {
  return (
    <Card className="border-amber-200 bg-amber-50/60 p-5" role="alert">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white">
            <AlertTriangle className="size-4" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-900">Nellovia couldn&apos;t be reached just now</p>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-amber-800">
              Rather than show you a canned reply, we stopped here. Nothing about your question or data was changed —
              please try again.
            </p>
            <p className="sr-only">Failed question: {question}</p>
          </div>
        </div>
        <Button size="sm" onClick={onRetry} className="bg-amber-600 text-white hover:bg-amber-700">
          <RotateCcw className="mr-1.5 size-4" aria-hidden /> Retry
        </Button>
      </div>
    </Card>
  );
}

function AnswerCard({
  answer,
  question,
  latest,
  onAsk,
  canAsk,
}: {
  answer: AnswerContent;
  question: string;
  /** The newest answer shows a follow-up box right under it. */
  latest: boolean;
  onAsk: (q: string, reply?: ReplyContext) => void;
  canAsk: boolean;
}) {
  const navigate = useBizz((s) => s.navigate);
  const followUpId = useId();
  const [followUp, setFollowUp] = useState("");
  // Older answers keep a quiet "Follow up on this" that opens the box right here.
  const [replyOpen, setReplyOpen] = useState(false);
  const showBox = latest || replyOpen;
  // Questions about an older answer carry it along, so Nellovia knows what "this" means.
  const replyContext = latest ? undefined : replyFrom(question, answer);

  function sendFollowUp() {
    const q = followUp.trim();
    if (!q || !canAsk) return;
    onAsk(q, replyContext);
    setFollowUp("");
    setReplyOpen(false);
  }
  return (
    <Card className="border-brand-200 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Sparkles className="size-3.5" aria-hidden />
          </div>
          <span className="text-sm font-semibold">Answer</span>
          <ProvenanceBadge provenance="ai-interpretation" />
          {answer.verified === false ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
              <AlertTriangle className="size-3" aria-hidden /> Some figures couldn&apos;t be checked — treat them as a rough guide
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800"
              title="Every amount, percentage and count in this answer was checked against your own answers and data before it was shown."
            >
              <ShieldCheck className="size-3" aria-hidden /> Every figure checked against your data
            </span>
          )}
        </div>
        <Badge variant="outline" className="gap-1 font-normal text-muted-foreground">
          <CalendarDays className="size-3" aria-hidden /> {answer.referencedPeriod}
        </Badge>
      </div>

      <p className="sr-only">Re: {question}</p>

      <div className="mt-3 space-y-2.5">
        {answer.grounded.map((p, i) => (
          <p key={i} className="text-sm leading-relaxed">
            {p}
          </p>
        ))}
        {answer.interpretation ? (
          <div className="rounded-xl border border-brand-200 bg-brand-50/70 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-600">What I think is going on</p>
            <p className="mt-1 text-sm leading-relaxed text-brand-900">{answer.interpretation}</p>
          </div>
        ) : null}
        {/* Asked for the words: they're right here, ready to copy — the button still offers a longer version. */}
        {answer.tryThis ? <TryThisBox title={answer.tryThis.title} body={answer.tryThis.body} /> : null}
        {answer.draft ? (
          <div className="flex pt-1">
            <DraftButton hint={answer.draft} />
          </div>
        ) : null}
        {answer.newChallenge ? <NoticedChallengeCard noticed={answer.newChallenge} source="ask" ownerText={question} /> : null}
        {answer.limitations && answer.limitations.length > 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <CircleDashed className="size-3.5" aria-hidden /> What I don&apos;t know yet
            </p>
            <ul className="mt-1.5 space-y-1">
              {answer.limitations.map((l, i) => (
                <li key={i} className="text-sm text-slate-600">
                  · {l}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      {answer.evidence.length > 0 ? (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Where this comes from</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {answer.evidence.map((e, i) => (
              <button
                key={i}
                onClick={() => {
                  if (e.factId) navigate(`provenance/${e.factId}`);
                  else navigate("data");
                }}
                className="rounded-xl border bg-white p-3 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/40"
                aria-label={`${e.label}: ${e.value}. ${e.factId ? "Open fact detail" : "Open data centre"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">{e.label}</span>
                  <ProvenanceBadge provenance={e.provenance} source={e.source} />
                </div>
                <p className="mt-1 text-base font-semibold tnum">{e.value}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{e.source}</p>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {answer.followUps && answer.followUps.length > 0 ? (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ask next</p>
          <div className="flex flex-wrap gap-2">
            {answer.followUps.map((q) => (
              <button
                key={q}
                type="button"
                disabled={!canAsk}
                onClick={() => onAsk(q, replyContext)}
                className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-white px-3 py-1.5 text-left text-xs font-medium text-brand-700 transition-colors hover:bg-brand-50 disabled:opacity-50"
              >
                <CornerDownRight className="size-3.5 shrink-0" aria-hidden />
                {q}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {showBox ? (
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            sendFollowUp();
          }}
        >
          <label htmlFor={followUpId} className="sr-only">
            Ask a follow-up question about this answer
          </label>
          <Input
            id={followUpId}
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && !latest) setReplyOpen(false);
            }}
            placeholder="Ask a follow-up about this answer…"
            className="h-11 flex-1 border-brand-200 bg-white text-base sm:text-sm"
            autoComplete="off"
            // Only when the owner just opened it on an older answer — never on page load.
            autoFocus={!latest}
          />
          <Button
            type="submit"
            className="h-11 bg-brand-600 px-4 hover:bg-brand-700"
            disabled={!canAsk || !followUp.trim()}
            aria-label="Send follow-up question"
          >
            <Send className="size-4" aria-hidden />
            <span className="hidden sm:inline">Ask</span>
          </Button>
          {!latest ? (
            <Button type="button" variant="ghost" className="h-11 px-3 text-slate-500" onClick={() => setReplyOpen(false)} aria-label="Close the follow-up box">
              <X className="size-4" aria-hidden />
            </Button>
          ) : null}
        </form>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        {!showBox ? (
          <Button variant="outline" size="sm" className="border-brand-200 text-brand-700 hover:bg-brand-50" onClick={() => setReplyOpen(true)}>
            <CornerDownRight className="mr-1.5 size-4" aria-hidden /> Follow up on this
          </Button>
        ) : null}
        <Button variant="outline" size="sm" onClick={() => navigate("data")}>
          <Database className="mr-1.5 size-4" aria-hidden /> View supporting data
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate("actions")}>
          <BarChart3 className="mr-1.5 size-4" aria-hidden /> Create action
        </Button>
      </div>
    </Card>
  );
}

// ---------- Screen 49 — Conversation History (real entries only) ----------

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatAskDate(iso: string): string {
  const datePart = iso.slice(0, 10);
  const [y, m, d] = datePart.split("-");
  const monthIndex = Number(m) - 1;
  if (!y || Number.isNaN(monthIndex) || !MONTHS[monthIndex] || !d) return datePart;
  return `${d} ${MONTHS[monthIndex]} ${y}`;
}

function AskHistoryScreen() {
  const businessId = useBizz((s) => s.businessId);
  const askLog = useBizz((s) => s.askLog);
  const clearAskLog = useBizz((s) => s.clearAskLog);
  const navigate = useBizz((s) => s.navigate);

  const [query, setQuery] = useState("");

  const entries = askLog
    .filter((e) => e.workspaceId === businessId)
    .filter((e) => {
      const q = query.trim().toLowerCase();
      return q.length === 0 || `${e.question} ${e.summary}`.toLowerCase().includes(q);
    });

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        title="Conversation history"
        description="Questions you asked Nellovia in this workspace, with a short summary of each answer."
        back={
          <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => navigate("ask")}>
            Back to Ask
          </Button>
        }
        actions={
          <Button size="sm" onClick={() => navigate("ask")}>
            <MessageCircleQuestion className="mr-1.5 size-4" aria-hidden /> New question
          </Button>
        }
      />

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <label htmlFor="history-search" className="sr-only">
          Search conversations
        </label>
        <Input
          id="history-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your questions and answers…"
          className="pl-9"
        />
      </div>

      <div className="mt-4 space-y-3">
        {entries.length === 0 ? (
          <EmptyState
            icon={<MessageCircleQuestion className="size-5" />}
            title={query.trim() ? "No conversations match" : "No conversations yet"}
            description={
              query.trim()
                ? "Try a different search term."
                : "When you ask a question on the Ask screen, it is saved here with a summary of the answer."
            }
          />
        ) : (
          entries.map((h) => (
            <Card key={h.id} className="p-0 transition-colors hover:border-brand-300">
              <button
                onClick={() => {
                  // Open Ask with this past answer attached — the next question follows up on it.
                  followUpHandoff.current = { question: h.question, summary: h.summary };
                  navigate("ask");
                }}
                className="w-full p-4 text-left"
                aria-label={`Follow up on: ${h.question}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant="outline" className="bg-brand-50 font-normal text-brand-700">
                    Question
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatAskDate(h.at)}
                    {h.period ? ` · Period referenced: ${h.period}` : ""}
                  </span>
                </div>
                <h3 className="mt-1.5 text-sm font-semibold leading-snug">{h.question}</h3>
                <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{h.summary}</p>
                <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-brand-700">
                  <CornerDownRight className="size-3.5" aria-hidden /> Follow up on this
                </span>
              </button>
            </Card>
          ))
        )}
      </div>

      {entries.length > 0 ? (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            History is stored per workspace on this device. Answers reference the data available when they were written.
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => {
              clearAskLog(businessId);
              toast("History cleared", { description: "Your questions for this workspace were removed from this device." });
            }}
          >
            <Trash2 className="mr-1.5 size-4" aria-hidden /> Clear history
          </Button>
        </div>
      ) : (
        <p className="mt-6 text-xs text-muted-foreground">
          History is stored per workspace on this device and is never seeded with sample conversations.
        </p>
      )}
    </div>
  );
}

export const views: ViewMap = {
  ask: AskScreen,
  "ask/history": AskHistoryScreen,
};
