"use client";
// Screen 14 — Conversational onboarding: the Business Context Engine.
// A scripted branching conversation that visibly "learns" the business.
// All state is local to this screen — nothing persists.

import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, CircleDashed, Lock, SendHorizontal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBizz } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { ScreenProps } from "../view-types";

type Trend = "Increased" | "Decreased" | "About the same" | "Don't know";
type Stage = "intro" | "enquiry" | "customers" | "revenue" | "changes" | "done";
type LearnStatus = "done" | "active" | "pending";

interface Msg {
  id: number;
  role: "ai" | "user";
  text: string;
  chips?: string[]; // violet extraction chips (AI messages only)
  cta?: boolean; // final "review journey" call to action
}

const TREND_CHIPS: Trend[] = ["Increased", "Decreased", "About the same", "Don't know"];
const CHANGE_CHIPS = ["More ad spend", "Changed pricing", "Grew the team", "Nothing major"];
const INTRO_CHIPS = ["We run a cleaning company in Lagos. Most customers come through Instagram and referrals.", "We sell handmade furniture online and get most visitors from Instagram."];

function parseTrend(text: string): Trend {
  const t = text.toLowerCase();
  if (/decreas|down|less|fewer|drop|fell|worse|slower/.test(t)) return "Decreased";
  if (/increas|up|more|grew|rise|rose|better|higher|lot/.test(t)) return "Increased";
  if (/don'|do not|no idea|not sure|know/.test(t)) return "Don't know";
  return "About the same";
}

function extractFromIntro(text: string): string[] {
  const t = text.toLowerCase();
  const chips: string[] = [];
  if (/clean/.test(t)) chips.push("Service business — cleaning");
  else if (/store|shop|sell|selling|ecommerce|furniture|clothes|products|brand/.test(t)) chips.push("Ecommerce — products online");
  else chips.push("Service business");
  const loc = text.match(/in\s+([A-Z][a-z]+)/);
  if (loc) chips.push(`Location: ${loc[1]}`);
  if (/instagram|\big\b/.test(t)) chips.push("Channel: Instagram");
  if (/google|search/.test(t)) chips.push("Channel: Google Search");
  if (/referr|word of mouth|recommend/.test(t)) chips.push("Channel: Referrals");
  if (/whatsapp/.test(t)) chips.push("Enquiries via WhatsApp");
  if (/website|site/.test(t)) chips.push("Enquiries via website");
  if (/spend|ads|advertis|budget/.test(t)) chips.push("Recent change: more ad spend");
  if (/customer|client|sales|bookings/.test(t)) chips.push("Goal: customers not growing despite activity");
  if (chips.length <= 2) chips.push("Goal: understand why growth is slow");
  return chips;
}

export default function OnboardingChat(_props: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [chips, setChips] = useState<string[]>([]);
  const [stage, setStage] = useState<Stage>("intro");
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState("");
  const [signalsDone, setSignalsDone] = useState(false);
  const [changesDone, setChangesDone] = useState(false);
  const started = useRef(false);
  const idRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const nextId = () => {
    idRef.current += 1;
    return idRef.current;
  };

  function aiSay(text: string, opts?: { chips?: string[]; delay?: number; then?: () => void }) {
    setTyping(true);
    setChips([]);
    window.setTimeout(() => {
      setTyping(false);
      setMessages((m) => [...m, { id: nextId(), role: "ai", text, chips: opts?.chips }]);
      setChips([]);
      opts?.then?.();
    }, opts?.delay ?? 900);
  }

  // Opening question — "Tell me about your business..."
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const t = window.setTimeout(() => {
      setMessages([{ id: nextId(), role: "ai", text: "Tell me about your business and what you most want to improve." }]);
      setChips(INTRO_CHIPS);
    }, 600);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, typing, chips]);

  function onIntroAnswer(text: string) {
    const extracted = extractFromIntro(text);
    const ig = extracted.some((c) => c.startsWith("Channel: Instagram"));
    const ref = extracted.includes("Channel: Referrals");
    const confirm = ig && ref ? "I understand that most customers find you through Instagram and referrals." : "I understand — I have noted what you do, where customers come from, and what you want to improve.";
    aiSay(confirm, {
      chips: extracted,
      then: () => {
        setStage("enquiry");
        aiSay(
          "Compared with the previous month, did the number of enquiries increase, decrease, or stay roughly the same?",
          { then: () => setChips(TREND_CHIPS) },
        );
      },
    });
  }

  function onEnquiryAnswer(text: string) {
    const trend = parseTrend(text);
    setStage("customers");
    const ack =
      trend === "Increased"
        ? "Enquiries up — that is a strong demand signal, especially if activity increased too."
        : trend === "Decreased"
          ? "Enquiries down — noted. I will keep that in mind when I look at where customers come from."
          : trend === "Don't know"
            ? "That is fine — directions can be added later in the Business Brain."
            : "Roughly flat enquiries — useful to know.";
    aiSay(ack, {
      then: () =>
        aiSay("And the number of paying customers — increased, decreased, or about the same?", { then: () => setChips(TREND_CHIPS) }),
    });
  }

  function onCustomersAnswer(text: string) {
    const trend = parseTrend(text);
    setStage("revenue");
    const gap =
      trend === "About the same" || trend === "Don't know"
        ? "Interesting — demand moved more than customers did. That is a pattern worth investigating."
        : trend === "Decreased"
          ? "So customers moved less than enquiries. There may be something happening between enquiry and signup."
          : "Customers up as well — good. I will check how the growth splits across channels.";
    aiSay(gap, {
      then: () =>
        aiSay(
          "One more trend question, and it is optional: revenue. I don't need the exact amount — would you say it increased, decreased, or stayed about the same? An estimate or a direction is enough, and it stays inside your workspace.",
          { then: () => setChips(TREND_CHIPS) },
        ),
    });
  }

  function onRevenueAnswer(text: string) {
    const trend = parseTrend(text);
    setStage("changes");
    const ack =
      trend === "Don't know"
        ? "No problem — revenue can be added or estimated later in the Business Brain."
        : `Revenue ${trend.toLowerCase()} — noted as your own estimate.`;
    aiSay(ack, {
      then: () =>
        aiSay("Has anything changed recently in how you run the business — pricing, the team, or how you market?", {
          then: () => setChips(CHANGE_CHIPS),
        }),
    });
  }

  function onChangesAnswer(text: string) {
    setStage("done");
    setSignalsDone(true);
    setChangesDone(true);
    aiSay(
      "I have enough to produce your first diagnosis. I have also mapped the buying journey I believe your customers use — review it and correct anything before it is used.",
      {
        then: () => {
          setMessages((m) => [...m, { id: nextId(), role: "ai", text: "", cta: true }]);
        },
      },
    );
  }

  function send(raw?: string) {
    const text = (raw ?? input).trim();
    if (!text || typing || stage === "done") return;
    setMessages((m) => [...m, { id: nextId(), role: "user", text }]);
    setInput("");
    if (stage === "intro") onIntroAnswer(text);
    else if (stage === "enquiry") onEnquiryAnswer(text);
    else if (stage === "customers") onCustomersAnswer(text);
    else if (stage === "revenue") onRevenueAnswer(text);
    else if (stage === "changes") onChangesAnswer(text);
  }

  const LEARN: { label: string; status: LearnStatus }[] = [
    { label: "Business type", status: messages.some((m) => m.role === "user") ? "done" : "pending" },
    { label: "Goal", status: messages.some((m) => m.role === "user") ? "done" : "pending" },
    { label: "Customer journey", status: messages.some((m) => m.role === "user") ? "active" : "pending" },
    { label: "Performance signals", status: signalsDone ? "done" : stage === "enquiry" || stage === "customers" || stage === "revenue" ? "active" : "pending" },
    { label: "Recent changes", status: changesDone ? "done" : stage === "changes" ? "active" : "pending" },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-sm">
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

        <div className="grid gap-0 lg:grid-cols-[1fr_17rem]">
          {/* Chat thread */}
          <div className="flex flex-col">
            <div ref={scrollRef} className="h-[400px] space-y-4 overflow-y-auto p-4 sm:p-5 lg:h-[460px]" aria-live="polite" aria-label="Checkup conversation">
              {messages.map((m) =>
                m.role === "ai" ? (
                  <div key={m.id} className="flex items-start gap-2.5">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                      <Sparkles className="size-3.5" aria-hidden />
                    </span>
                    <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-slate-200 bg-white px-3.5 py-2.5 text-sm leading-relaxed shadow-sm">
                      {m.text ? <p>{m.text}</p> : null}
                      {m.chips && m.chips.length > 0 ? (
                        <div className="mt-2 border-t border-dashed border-violet-100 pt-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-500">Understood as</p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {m.chips.map((c) => (
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

            {/* Quick chips + composer */}
            <div className="border-t bg-slate-50/70 p-3 sm:p-4">
              {chips.length > 0 && !typing ? (
                <div className="mb-2.5 flex flex-wrap gap-1.5" aria-label="Suggested answers">
                  {chips.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => send(c)}
                      className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
                    >
                      {c.length > 46 ? c.slice(0, 46) + "…" : c}
                    </button>
                  ))}
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
                  placeholder={stage === "done" ? "Conversation complete — continue below" : "Type your answer in plain language…"}
                  disabled={typing || stage === "done"}
                  aria-label="Your answer"
                  className="bg-white"
                />
                <Button type="submit" size="icon" disabled={typing || stage === "done" || !input.trim()} aria-label="Send answer">
                  <SendHorizontal className="size-4" aria-hidden />
                </Button>
              </form>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Estimates are fine. Exact figures are optional. You can connect accounts later.
              </p>
            </div>
          </div>

          {/* Side panel — what the engine is learning */}
          <aside className="border-t border-violet-100 bg-violet-50/40 p-4 sm:p-5 lg:border-l lg:border-t-0" aria-label="What I'm learning">
            <h2 className="text-sm font-semibold">What I&apos;m learning</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Built from this conversation. Nothing is shared.</p>
            <ul className="mt-4 space-y-3">
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
                The engine fills a hidden structured model of your business and stops asking once it has enough evidence for a first diagnosis.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
