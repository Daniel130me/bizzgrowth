"use client";
// Screen 14 — Conversational onboarding: the Business Context Engine.
// EVERY turn is run by the real consultant brain (POST /api/checkup/chat):
// the engine classifies each owner message (answer / correction / partial /
// dodge / question), reacts to specifics, re-asks indirectly when dodged,
// and never turns a non-answer into a trend. The closing structured
// extraction still hits POST /api/checkup/extract; regex parsers remain
// only as offline fallback. Extracted facts persist to the store and drive
// business-understanding, diagnosis and Ask screens.
import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, CircleDashed, Lock, SendHorizontal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBizz } from "@/lib/store";
import {
  emptySlots,
  REQUIRED_SLOTS,
  type AskCounts,
  type BusinessFacts,
  type ChatTurnResult,
  type CheckupPhase,
  type CheckupSlots,
  type TranscriptTurn,
} from "@/lib/checkup";
import { cn } from "@/lib/utils";
import type { ScreenProps } from "../view-types";

type LearnStatus = "done" | "active" | "pending";

interface Msg {
  id: number;
  role: "ai" | "user";
  text: string;
  learned?: string[]; // "Understood as" chips — what the engine learned/updated this turn
  cta?: boolean; // final "review journey" call to action
  degraded?: boolean; // turn produced by the offline fallback (AI briefly unreachable)
}

const INTRO_CHIPS = [
  ["We run a cleaning company in Lagos. Most customers come through Instagram and referrals.", "We sell handmade furniture online and get most visitors from Instagram."],
  ["I run a tailoring studio in Abuja; clients find me on WhatsApp and word of mouth.", "We run an online store selling phone accessories, mostly via Instagram ads."],
  ["We are a small logistics company in Port Harcourt — clients reach us by phone and referrals.", "I sell baked goods from home; orders come through WhatsApp and Instagram."],
];

const OPENERS = [
  "Tell me about your business and what you most want to improve.",
  "Let's start simple: what does your business do, and what's the one thing you'd most like to improve?",
  "Walk me through your business — what you sell, who you serve, and what's been bothering you lately.",
  "What's your business all about, and where does growth feel stuck right now?",
  "Tell me about your business — and if you had to fix one thing this month, what would it be?",
];

/** Client-side regex extraction — offline fallback only, never the primary path. */
function extractFromIntro(text: string): string[] {
  const t = text.toLowerCase();
  const chips: string[] = [];
  if (/clean/.test(t)) chips.push("Service business — cleaning");
  else if (/store|shop|sell|selling|ecommerce|furniture|clothes|products|brand/.test(t)) chips.push("Ecommerce — products online");
  else chips.push("Service business");
  const loc = text.match(/in\s+([A-Z][a-z]+)/);
  if (loc) chips.push(`Location: ${loc[1]}`);
  if (/instagram|\big\b/.test(t)) chips.push("Channel: Instagram");
  if (/referr|word of mouth|recommend/.test(t)) chips.push("Channel: Referrals");
  if (/whatsapp/.test(t)) chips.push("Enquiries via WhatsApp");
  if (/website|site/.test(t)) chips.push("Enquiries via website");
  return chips;
}

function parseTrendLoose(text: string): BusinessFacts["trends"]["enquiries"] {
  const t = text.toLowerCase();
  if (/decreas|down|less|fewer|drop|fell|worse|slower/.test(t)) return "Decreased";
  if (/increas|up|more|grew|rise|rose|better|higher/.test(t)) return "Increased";
  if (/don'|do not|no idea|not sure/.test(t)) return "Don't know";
  return "About the same";
}

export default function OnboardingChat(_props: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);
  const setCheckupFacts = useBizz((s) => s.setCheckupFacts);
  const userWorkspace = useBizz((s) => s.userWorkspace);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [chips, setChips] = useState<string[]>([]);
  const [phase, setPhase] = useState<CheckupPhase>("interview");
  const [slots, setSlots] = useState<CheckupSlots>(emptySlots);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState("");
  const [finishing, setFinishing] = useState(false);
  const started = useRef(false);
  const idRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const transcriptRef = useRef<TranscriptTurn[]>([]);
  const phaseRef = useRef<CheckupPhase>("interview");
  const slotsRef = useRef<CheckupSlots>(emptySlots());
  const askCountsRef = useRef<AskCounts>({});
  const busyRef = useRef(false);

  const nextId = () => {
    idRef.current += 1;
    return idRef.current;
  };

  function pushAi(text: string, opts?: { learned?: string[]; then?: () => void; delay?: number }) {
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      transcriptRef.current.push({ role: "ai", text });
      setMessages((m) => [...m, { id: nextId(), role: "ai", text, learned: opts?.learned }]);
      opts?.then?.();
    }, opts?.delay ?? 850);
  }

  /** Call the real Context Engine for the closing structured extraction. */
  async function extractFacts(): Promise<{ facts: BusinessFacts; ack: string | null } | null> {
    try {
      const res = await fetch("/api/checkup/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceName: userWorkspace?.name ?? "Your business",
          country: userWorkspace?.country ?? "Nigeria",
          transcript: transcriptRef.current,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; facts?: BusinessFacts; ack?: string | null };
      if (data?.ok && data?.facts) return { facts: data.facts, ack: data.ack ?? null };
      return null;
    } catch {
      return null;
    }
  }

  /** Client-side minimal facts if the engine is unreachable — the journey never blocks. */
  function offlineFacts(): BusinessFacts {
    const userText = transcriptRef.current
      .filter((t) => t.role === "user")
      .map((t) => t.text)
      .join(" ");
    const chips = extractFromIntro(userText);
    return {
      businessType: chips.some((c) => c.startsWith("Ecommerce")) ? "ecommerce" : "service",
      whatTheySell: chips[0] ?? "Described during the checkup",
      primaryGoal: "Understand why growth is slow and what to fix next",
      customers: slots.targetMarket ?? "Described during the checkup",
      channels: chips.filter((c) => c.startsWith("Channel:")).map((c) => c.replace("Channel: ", "")),
      journey: [],
      trends: {
        enquiries: slots.enquiries ?? parseTrendLoose(userText),
        customers: slots.customers ?? parseTrendLoose(userText),
        revenue: slots.revenue ?? parseTrendLoose(userText),
      },
      recentChanges: slots.changes?.length ? slots.changes : ["Reported during the checkup"],
      chips,
      facts: [
        { section: "Business", value: `${userWorkspace?.name ?? "Your business"} — described in your checkup conversation`, provenance: "user-supplied", source: "Workspace setup" },
        { section: "Acquisition channels", value: chips.filter((c) => c.startsWith("Channel:")).map((c) => c.replace("Channel: ", "")).join(", ") || "Not specified yet", provenance: "user-supplied", source: "Your checkup conversation" },
      ],
      confidence: 55,
    };
  }

  // Opening question — varied so repeat owners never see the same script.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const opener = OPENERS[Math.floor(Math.random() * OPENERS.length)];
    const chipPair = INTRO_CHIPS[Math.floor(Math.random() * INTRO_CHIPS.length)];
    const t = window.setTimeout(() => {
      setMessages([{ id: nextId(), role: "ai", text: opener }]);
      setChips(chipPair);
    }, 600);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, typing, chips]);

  /** Closing flow: structured extraction → persist → journey CTA. */
  function finishConversation() {
    setFinishing(true);
    setTyping(true);
    setChips([]);
    void (async () => {
      const result = await extractFacts();
      const facts = result?.facts ?? offlineFacts();
      setCheckupFacts(facts, [...transcriptRef.current]);
      setTyping(false);
      setFinishing(false);
      pushAi(
        "I have enough to produce your first diagnosis. I have also mapped the buying journey I believe your customers use — review it and correct anything before it is used.",
        {
          then: () => {
            setMessages((m) => [...m, { id: nextId(), role: "ai", text: "", cta: true }]);
          },
        },
      );
    })();
  }

  /** One consultant turn — the engine classifies, harvests what it can, and chooses its own next question. */
  async function consultantTurn(text: string) {
    busyRef.current = true;
    setTyping(true);
    setChips([]);
    const userTurns = transcriptRef.current.filter((t) => t.role === "user").length;
    const payload = {
      workspaceName: userWorkspace?.name ?? "Your business",
      country: userWorkspace?.country ?? "Nigeria",
      transcript: transcriptRef.current,
      phase: phaseRef.current,
      slots: slotsRef.current,
      askCounts: askCountsRef.current,
    };
    try {
      const res = await fetch("/api/checkup/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok?: boolean } & Partial<ChatTurnResult>;
      if (!data?.ok || typeof data.reply !== "string" || data.reply.length === 0) throw new Error("bad response");

      const nextPhase = (data.phase ?? "interview") as CheckupPhase;
      const nextSlots = data.slots ?? slotsRef.current;
      const learned = data.learnedChips ?? [];
      const degraded = data.degraded === true;

      setTyping(false);
      transcriptRef.current.push({ role: "ai", text: data.reply });
      setMessages((m) => [...m, { id: nextId(), role: "ai", text: data.reply as string, learned, degraded }]);

      phaseRef.current = nextPhase;
      slotsRef.current = nextSlots;
      askCountsRef.current = data.askCounts ?? {};
      setPhase(nextPhase);
      setSlots(nextSlots);
      setChips(data.chips ?? []);

      if (nextPhase === "done" || userTurns + 1 >= 14) finishConversation();
    } catch {
      // Network hiccup — never advance, never guess. Ask the owner to try again.
      setTyping(false);
      setMessages((m) => [
        ...m,
        { id: nextId(), role: "ai", text: "Sorry — my connection dropped for a moment. Could you send that once more?" },
      ]);
      setChips([]);
    } finally {
      busyRef.current = false;
    }
  }

  function send(raw?: string) {
    const text = (raw ?? input).trim();
    if (!text || typing || busyRef.current || finishing || phaseRef.current === "done") return;
    transcriptRef.current.push({ role: "user", text });
    setMessages((m) => [...m, { id: nextId(), role: "user", text }]);
    setInput("");
    void consultantTurn(text);
  }

  // Side panel — what the engine has actually learned, driven by real slots.
  const resolved = (v: unknown) => (Array.isArray(v) ? v.length > 0 : typeof v === "string" && v.length > 0);
  const doneOr = (cond: boolean) => (phase === "done" || cond ? ("done" as const) : ("active" as const));
  const LEARN: { label: string; status: LearnStatus }[] = [
    { label: "Business type", status: doneOr(resolved(slots.businessType)) },
    { label: "What you sell", status: doneOr(resolved(slots.sells)) },
    { label: "Target market", status: doneOr(resolved(slots.targetMarket)) },
    { label: "Goal", status: doneOr(resolved(slots.goal)) },
    { label: "Customer sources", status: doneOr(resolved(slots.channels)) },
    {
      label: "Performance signals",
      status:
        REQUIRED_SLOTS.filter((k) => k === "enquiries" || k === "customers").every((k) => slots.declined.includes(k) || resolved(slots[k]))
          ? ("done" as const)
          : ("active" as const),
    },
    { label: "Recent changes", status: doneOr(resolved(slots.changes) || slots.declined.includes("changes")) },
    { label: "Customer journey", status: phase === "done" ? ("done" as const) : ("active" as const) },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="overflow-clip rounded-2xl border border-violet-200 bg-white shadow-sm">
        {/* Product context header — this is a product surface, not a chat clone */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-violet-100 bg-violet-50/70 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg bg-violet-600 text-white">
              <Sparkles className="size-4.5" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold leading-tight">Business Context Engine</p>
              <p className="text-xs text-muted-foreground">A short conversation so your first diagnosis understands the business.</p>
            </div>
          </div>
          <p className="flex items-center gap-1.5 rounded-md border border-violet-200 bg-white px-2 py-1 text-[11px] font-medium text-violet-700">
            <Lock className="size-3" aria-hidden />
            Private checkup — nothing is shared
          </p>
        </div>

        {/* Compact progress strip — small screens only, where the side panel is hidden */}
        <div className="flex items-center gap-3 border-b border-violet-100 px-4 py-2 md:hidden">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-violet-100">
            <div
              className="h-full rounded-full bg-violet-600 transition-all"
              style={{ width: `${Math.round((LEARN.filter((l) => l.status === "done").length / LEARN.length) * 100)}%` }}
            />
          </div>
          <span className="text-[11px] font-medium text-violet-700">
            {LEARN.filter((l) => l.status === "done").length}/{LEARN.length} understood
          </span>
        </div>

        <div className="grid gap-0 md:grid-cols-[1fr_15rem] lg:grid-cols-[1fr_17rem]">
          {/* Chat thread */}
          <div className="flex min-w-0 flex-col">
            <div
              ref={scrollRef}
              className="h-[clamp(220px,calc(100dvh_-_24rem),460px)] space-y-4 overflow-y-auto p-4 sm:p-5"
              aria-live="polite"
              aria-label="Checkup conversation"
            >
              {messages.map((m) =>
                m.role === "ai" ? (
                  <div key={m.id} className="flex items-start gap-2.5">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                      <Sparkles className="size-3.5" aria-hidden />
                    </span>
                    <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-slate-200 bg-white px-3.5 py-2.5 text-sm leading-relaxed shadow-sm">
                      {m.text ? <p>{m.text}</p> : null}
                      {m.degraded ? (
                        <p className="mt-2 flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800" role="status">
                          <CircleDashed className="size-3 shrink-0 animate-spin" aria-hidden />
                          Reduced mode — my AI is reconnecting, so this reply was simpler than usual. Your answers are still being recorded.
                        </p>
                      ) : null}
                      {m.learned && m.learned.length > 0 ? (
                        <div className="mt-2 border-t border-dashed border-violet-100 pt-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-500">Understood as</p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {m.learned.map((c) => (
                              <span key={c} className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                                {c}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {m.cta ? (
                        <Button size="sm" className="mt-2.5 w-full bg-violet-600 hover:bg-violet-700 sm:w-auto" onClick={() => navigate("journey-confirm")}>
                          Review my business journey
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-slate-800 px-3.5 py-2.5 text-sm leading-relaxed text-white shadow-sm">
                      {m.text}
                    </div>
                  </div>
                ),
              )}
              {typing ? (
                <div className="flex items-start gap-2.5" role="status" aria-label="bizzGrowth is typing">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                    <Sparkles className="size-3.5" aria-hidden />
                  </span>
                  <div className="flex items-center gap-1 rounded-2xl rounded-tl-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <span className="size-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:0ms]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:150ms]" />
                    <span className="size-1.5 animate-bounce rounded-full bg-violet-400 [animation-delay:300ms]" />
                  </div>
                </div>
              ) : null}
            </div>

            {/* Quick answers + composer — sticky so it is always in view */}
            <div className="sticky bottom-0 z-10 border-t border-violet-100 bg-white/95 p-3 shadow-[0_-6px_16px_-10px_rgba(76,29,149,0.25)] backdrop-blur sm:p-4">
              {chips.length > 0 && !typing && phase !== "done" ? (
                <div className="mb-3">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-violet-600">Tap an answer — or type your own</p>
                  <div className="flex flex-wrap gap-2" aria-label="Suggested answers">
                    {chips.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => send(c)}
                        className="rounded-full border border-violet-200 bg-violet-50 px-3.5 py-2 text-sm font-medium text-violet-800 transition-colors hover:border-violet-400 hover:bg-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                      >
                        {c.length > 46 ? c.slice(0, 46) + "…" : c}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
              >
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={phase === "done" ? "Conversation complete — continue below" : "Type your answer in plain language…"}
                  disabled={typing || phase === "done"}
                  aria-label="Your answer"
                  className="h-11 border-violet-200 bg-white text-base focus-visible:ring-violet-400"
                />
                <Button type="submit" size="icon" className="size-11 shrink-0 bg-violet-600 hover:bg-violet-700" disabled={typing || phase === "done" || !input.trim()} aria-label="Send answer">
                  <SendHorizontal className="size-4" aria-hidden />
                </Button>
              </form>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Estimates are fine. Exact figures are optional. Correct me any time — I update as we talk.
              </p>
            </div>
          </div>

          {/* Side panel — what the engine is learning */}
          <aside className="hidden border-l border-violet-100 bg-violet-50/40 p-4 sm:p-5 md:block" aria-label="What I'm learning">
            <h2 className="text-sm font-semibold">What I&apos;m learning</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Built from this conversation. Nothing is shared.</p>
            <ul className="mt-4 max-h-64 space-y-3 overflow-y-auto pr-1">
              {LEARN.map((item) => (
                <li key={item.label} className="flex items-center gap-2.5">
                  {item.status === "done" ? (
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-label="Understood" />
                  ) : item.status === "active" ? (
                    <span className="flex size-4 shrink-0 items-center justify-center" role="img" aria-label="In progress">
                      <span className="flex gap-0.5">
                        <span className="size-1 animate-bounce rounded-full bg-violet-500 [animation-delay:0ms]" />
                        <span className="size-1 animate-bounce rounded-full bg-violet-500 [animation-delay:150ms]" />
                        <span className="size-1 animate-bounce rounded-full bg-violet-500 [animation-delay:300ms]" />
                      </span>
                    </span>
                  ) : (
                    <CircleDashed className="size-4 shrink-0 text-slate-300" aria-label="Pending" />
                  )}
                  <span className={cn("text-sm", item.status === "done" ? "font-medium text-foreground" : item.status === "active" ? "text-foreground" : "text-muted-foreground")}>
                    {item.label}
                  </span>
                  <span className="ml-auto text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {item.status === "done" ? "Understood" : item.status === "active" ? "Learning" : "Pending"}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-5 rounded-lg border border-violet-100 bg-white p-3">
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                The engine reads your own words, corrects itself when you do, and only moves on once it genuinely understands — or honestly records what it does not know. Your answers drive every screen that follows.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
