"use client";
// Screens 48–49 — Ask Your Business + Conversation History.
// Questions go to the real AI analyst (POST /api/ask) with a snapshot of the
// workspace data; every answer is generated for the exact question asked.
// There are NO canned answers here: if the analyst cannot be reached, we say
// so honestly and offer a retry instead of showing a scripted reply.

import { useEffect, useRef, useState } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/states";
import { PageHeader } from "@/components/shared/layout";
import { ProvenanceBadge } from "@/components/shared/badges";
import { useBizz } from "@/lib/store";
import { getBusiness } from "@/lib/data/businesses";
import { ownerMonthsFromEntries } from "@/lib/data/user-business";
import type { AskWorkspaceContext } from "@/lib/checkup";
import { buildBusinessContext } from "@/lib/ai-context";
import { TryThisBox } from "@/components/shared/try-this";
import { chatDraftKey, getClientId, loadDraft, newChatId, saveDraft, syncChat, type ChatLogMessage } from "@/lib/chat-log";
import type { Provenance } from "@/lib/types";
import type { ViewMap } from "../view-types";

// ---------- Answer model (produced by the AI analyst, never hardcoded) ----------

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
  followUps?: string[];
  verified?: boolean;
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
    out.push("Should I raise my prices?", "How do I say no to work without losing customers?", "What can I stop doing myself?");
  } else {
    out.push("What's holding my business back?", "How do I get more paying customers?", "What should I track each week?");
  }
  out.push("What would make the biggest difference this month?");
  return out.slice(0, 5);
}

// ---------- Screen 48 — Ask Your Business ----------

type ThreadItem =
  | { kind: "question"; text: string }
  | { kind: "answer"; question: string; content: AnswerContent }
  | { kind: "failed"; question: string };

function AskScreen() {
  const businessId = useBizz((s) => s.businessId);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const checkupFacts = useBizz((s) => s.checkup.facts);
  const checkupDiagnosis = useBizz((s) => s.checkup.diagnosis);
  const checkupImproved = useBizz((s) => s.checkup.improved);
  const manualEntries = useBizz((s) => s.manualEntries);
  const recordAsk = useBizz((s) => s.recordAsk);
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

  /** Snapshot of the workspace the server-side analyst reasons over. */
  function buildContext(): AskWorkspaceContext {
    if (businessId === "user-workspace") {
      // The owner's own workspace: ground the analyst in their entered totals
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

  function removeFailedAndRetry(question: string) {
    setThread((t) => {
      // Drop the failed marker, keep everything else (question bubbles stay).
      const next: ThreadItem[] = t.filter((item) => !(item.kind === "failed" && item.question === question));
      threadRef.current = next;
      return next;
    });
    ask(question);
  }

  function ask(raw: string) {
    const q = raw.trim();
    if (!q) {
      toast.error("Type a question first", { description: "Ask in your own words, or pick a suggestion." });
      return;
    }
    if (typing) return;
    setInput("");
    pushItem({ kind: "question", text: q });
    logMessage("user", q);
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
            summary: data.answer.grounded.join(" ").slice(0, 220),
            period: data.answer.referencedPeriod ?? "",
          });
          return;
        }
        throw new Error(data?.error ?? "no answer");
      } catch {
        // Honest failure — no canned answer can stand in for the analyst.
        pushItem({ kind: "failed", question: q });
        logMessage("ai", "(The analyst could not answer — the owner was shown a retry option.)", { failed: true });
        setTyping(false);
      } finally {
        clearTimeout(slowTimer);
        setSlow(false);
      }
    })();
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* Hero — expressive but serious */}
      <Card className="overflow-hidden border-violet-200 bg-gradient-to-br from-violet-50 via-white to-white p-0">
        <div className="border-b border-violet-100 px-6 pt-6 pb-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm">
                <Sparkles className="size-5" aria-hidden />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Ask anything about your business…</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  An AI analyst reads {business.name}&apos;s workspace data and answers your exact question.
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("ask/history")}>
              <History className="mr-1.5 size-4" aria-hidden /> Conversation history
            </Button>
          </div>
          <form
            className="mt-4 flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
          >
            <label htmlFor="ask-input" className="sr-only">
              Ask a question about your business
            </label>
            <Input
              id="ask-input"
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask in your own words — follow-ups are welcome"
              className="h-12 flex-1 border-violet-200 bg-white text-base"
              autoComplete="off"
            />
            <Button type="submit" className="h-12 bg-violet-600 px-6 text-base hover:bg-violet-700" disabled={typing}>
              <Send className="mr-2 size-4" aria-hidden /> Ask
            </Button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                disabled={typing}
                className="rounded-full border border-violet-200 bg-white px-3 py-1.5 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-100 disabled:opacity-50"
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
            description="Try a suggestion above, or ask in your own words. Answers reference the actual data recorded in this workspace and show where each fact came from."
          />
        ) : null}

        {thread.map((item, i) =>
          item.kind === "question" ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-md bg-blue-600 px-4 py-2.5 text-sm leading-relaxed text-white sm:max-w-[70%]">
                {item.text}
              </p>
            </div>
          ) : item.kind === "answer" ? (
            <AnswerCard
              key={i}
              answer={item.content}
              question={item.question}
              onFollowUp={() => inputRef.current?.focus()}
              onAsk={(q) => ask(q)}
              canAsk={!typing}
            />
          ) : (
            <FailedCard key={i} question={item.question} onRetry={() => removeFailedAndRetry(item.question)} />
          )
        )}

        {typing ? (
          <Card className="flex items-center gap-3 p-4" role="status" aria-label="Preparing answer">
            <div className="flex size-8 items-center justify-center rounded-lg bg-violet-600 text-white">
              <Sparkles className="size-4" aria-hidden />
            </div>
            <div className="flex items-center gap-1.5" aria-hidden>
              <span className="size-2 animate-bounce rounded-full bg-violet-400 [animation-delay:0ms]" />
              <span className="size-2 animate-bounce rounded-full bg-violet-400 [animation-delay:150ms]" />
              <span className="size-2 animate-bounce rounded-full bg-violet-400 [animation-delay:300ms]" />
            </div>
            <span className="text-sm text-muted-foreground">
              {slow ? "Working through your answers and your diagnosis — a good answer is worth a few more seconds…" : "Thinking through your business…"}
            </span>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

/** Honest failure state — shown when the AI analyst cannot be reached.
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
            <p className="text-sm font-semibold text-amber-900">The analyst couldn&apos;t be reached just now</p>
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
  onFollowUp,
  onAsk,
  canAsk,
}: {
  answer: AnswerContent;
  question: string;
  onFollowUp: () => void;
  onAsk: (q: string) => void;
  canAsk: boolean;
}) {
  const navigate = useBizz((s) => s.navigate);
  return (
    <Card className="border-violet-200 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-violet-600 text-white">
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
          <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-600">What we think is going on</p>
            <p className="mt-1 text-sm leading-relaxed text-violet-900">{answer.interpretation}</p>
          </div>
        ) : null}
        {answer.tryThis ? <TryThisBox title={answer.tryThis.title} body={answer.tryThis.body} /> : null}
        {answer.limitations && answer.limitations.length > 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <CircleDashed className="size-3.5" aria-hidden /> What we don&apos;t know yet
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
                className="rounded-xl border bg-white p-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/40"
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
                onClick={() => onAsk(q)}
                className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-white px-3 py-1.5 text-left text-xs font-medium text-violet-700 transition-colors hover:bg-violet-50 disabled:opacity-50"
              >
                <CornerDownRight className="size-3.5 shrink-0" aria-hidden />
                {q}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        <Button variant="outline" size="sm" onClick={() => navigate("data")}>
          <Database className="mr-1.5 size-4" aria-hidden /> View supporting data
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate("actions")}>
          <BarChart3 className="mr-1.5 size-4" aria-hidden /> Create action
        </Button>
        <Button variant="ghost" size="sm" onClick={onFollowUp}>
          <MessageCircleQuestion className="mr-1.5 size-4" aria-hidden /> Ask follow-up
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
        description="Questions you asked the analyst in this workspace, with a short summary of each answer."
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
            <Card key={h.id} className="p-0 transition-colors hover:border-violet-300">
              <button
                onClick={() => {
                  toast("Continue the conversation in Ask", { description: "Ask a follow-up and the analyst will pick up where you left off." });
                  navigate("ask");
                }}
                className="w-full p-4 text-left"
                aria-label={`Open conversation: ${h.question}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant="outline" className="bg-violet-50 font-normal text-violet-700">
                    Question
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatAskDate(h.at)}
                    {h.period ? ` · Period referenced: ${h.period}` : ""}
                  </span>
                </div>
                <h3 className="mt-1.5 text-sm font-semibold leading-snug">{h.question}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{h.summary}</p>
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
