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
import { ArrowRight, CheckCircle2, CircleDashed, Lock, SendHorizontal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBizz } from "@/lib/store";
import {
  depthSlotsFor,
  emptySlots,
  REQUIRED_SLOTS,
  type AskCounts,
  type BusinessFacts,
  type ChatTurnResult,
  type CheckupPhase,
  type CheckupSlots,
  type SlotKey,
  type TranscriptTurn,
} from "@/lib/checkup";
import { shorten, tidyOwnerText } from "@/lib/checkup-math";
import { cn } from "@/lib/utils";
import { chatDraftKey, clearDraft, fetchResumableChat, getClientId, loadDraft, newChatId, saveDraft, syncChat, workspaceKey, type ChatLogMessage, type StoredConversation } from "@/lib/chat-log";
import type { ScreenProps } from "../view-types";

type LearnStatus = "done" | "active" | "pending";

interface Msg {
  id: number;
  role: "ai" | "user";
  text: string;
  learned?: string[]; // "Understood as" chips — what the engine learned/updated this turn
  cta?: boolean; // final "review journey" call to action
  degraded?: boolean; // turn produced by the offline fallback (AI briefly unreachable)
  at?: string; // ISO time the message appeared
  note?: boolean; // UI-only notice (e.g. connection dropped) — not part of the transcript
}

/** In-progress chat kept in localStorage so a reload resumes where the owner stopped. */
interface ChatDraft {
  v: 1;
  conversationId: string;
  startedAt: string;
  messages: Msg[];
  chips: string[];
  phase: CheckupPhase;
  slots: CheckupSlots;
  askCounts: AskCounts;
  transcript: TranscriptTurn[];
  facts?: BusinessFacts | null;
}

const stamp = () => new Date().toISOString();

const hasOwnerTurn = (d: ChatDraft | null | undefined): d is ChatDraft =>
  !!d && d.v === 1 && Array.isArray(d.messages) && d.messages.some((m) => m.role === "user");

/** Rebuild a browser draft from a conversation stored on the server. */
function draftFromServer(c: StoredConversation): ChatDraft {
  const meta = c.meta ?? {};
  const messages: Msg[] = c.messages.map((m, i) => ({
    id: i + 1,
    role: m.role,
    text: m.text,
    at: m.sentAt,
    learned: Array.isArray(m.meta?.learned) ? (m.meta?.learned as string[]) : undefined,
    degraded: m.meta?.degraded === true || undefined,
    note: m.meta?.note === true || undefined,
  }));
  if (meta.finished === true) messages.push({ id: messages.length + 1, role: "ai", text: "", cta: true, at: c.updatedAt });
  return {
    v: 1,
    conversationId: c.id,
    startedAt: c.startedAt,
    messages,
    chips: Array.isArray(meta.suggestedChips) ? (meta.suggestedChips as string[]) : [],
    phase: c.phase === "done" ? "done" : "interview",
    slots: { ...emptySlots(), ...((c.slots as Partial<CheckupSlots> | null) ?? {}) },
    askCounts: (meta.askCounts as AskCounts | undefined) ?? {},
    transcript: messages.filter((m) => m.text && !m.note).map((m) => ({ role: m.role, text: m.text })),
    facts: (c.facts as BusinessFacts | null) ?? null,
  };
}

const INTRO_CHIPS = [
  ["I run a cleaning company in Lagos. Most customers hear about us from friends.", "I sell handmade furniture from my workshop; people find me on Instagram."],
  ["I run a tailoring shop in Abuja; customers call me or come by on a friend's advice.", "I sell phone accessories from a shop in the market — mostly walk-in customers."],
  ["We are a small delivery business in Port Harcourt — customers call us or are referred.", "I sell baked goods from home; people order on WhatsApp or by phone."],
];

const OPENERS = [
  "Hi, and welcome! I'd love to hear about your business — what do you do, and what would you most like to improve?",
  "Hello! Let's keep this relaxed. To start, what does your business do, and what's one thing you'd love to get better at?",
  "Welcome — thanks for taking a few minutes. Tell me a little about your business: what you offer and who you serve.",
  "Hi there! I'm here to understand your business so I can help. What do you do, and what part of the business feels hardest right now?",
  "Great to meet you. In your own words, what does your business do — and if you could fix one thing this month, what would it be?",
];

/** Client-side regex extraction — offline fallback only, never the primary path. */
function extractFromIntro(text: string): string[] {
  const t = text.toLowerCase();
  const chips: string[] = [];
  if (/clean/.test(t)) chips.push("Service business — cleaning");
  else if (/store|shop|sell|selling|ecommerce|furniture|clothes|products|brand/.test(t)) chips.push("Sells products");
  else chips.push("Service business");
  const loc = text.match(/in\s+([A-Z][a-z]+)/);
  if (loc) chips.push(`Location: ${loc[1]}`);
  if (/instagram|\big\b/.test(t)) chips.push("Channel: Instagram");
  if (/referr|word of mouth|recommend/.test(t)) chips.push("Channel: Referrals");
  if (/whatsapp/.test(t)) chips.push("Customers reach you on WhatsApp");
  if (/website|site/.test(t)) chips.push("Customers reach you through your website");
  return chips;
}

/** Side-panel labels, in the order the owner sees them fill up. */
const LEARN_LABELS: Partial<Record<SlotKey, string>> = {
  sells: "What you sell",
  targetMarket: "Who pays you",
  channels: "How people find you",
  bottleneck: "What feels hardest",
  ownerTheory: "What you think is causing it",
  closeRate: "How many go on to pay",
  monthlyEnquiries: "People asking each month",
  jobValue: "A typical job",
  followUp: "Getting back to people",
  pricePresentation: "How you give your price",
  lostReason: "When people don't buy",
  proof: "Past work people see",
  repeat: "Customers coming back",
  capacity: "Room for more work",
};

/** Hard cap on owner replies — matches the server; depth beats speed. */
const MAX_USER_TURNS = 18;

/** "Understood as" chip label → the answer it summarises (for the side panel). */
const CHIP_SLOT: Record<string, SlotKey> = {
  sells: "sells",
  customers: "targetMarket",
  "found via": "channels",
  "hardest part": "bottleneck",
  "how many pay": "closeRate",
  "people asking a month": "monthlyEnquiries",
  "typical job": "jobValue",
  "getting back to people": "followUp",
  "how you give prices": "pricePresentation",
  "when people don't buy": "lostReason",
  "past work shown": "proof",
  "room for more work": "capacity",
  "customers coming back": "repeat",
  "your view": "ownerTheory",
};

/** The model's short summaries of each answer, rebuilt from the chips on its replies. */
function summariesFrom(messages: { learned?: string[] }[]): Partial<Record<SlotKey, string>> {
  const out: Partial<Record<SlotKey, string>> = {};
  for (const m of messages) {
    for (const chip of m.learned ?? []) {
      const c = chip.replace(/^updated:\s*/i, "");
      const i = c.indexOf(":");
      if (i <= 0) continue;
      const slot = CHIP_SLOT[c.slice(0, i).trim().toLowerCase()];
      const value = c.slice(i + 1).trim();
      if (slot && value) out[slot] = value;
    }
  }
  return out;
}

export default function OnboardingChat(_props: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);
  const setCheckupFacts = useBizz((s) => s.setCheckupFacts);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const hydrated = useBizz((s) => s.hydrated);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [chips, setChips] = useState<string[]>([]);
  const [phase, setPhase] = useState<CheckupPhase>("interview");
  const [slots, setSlots] = useState<CheckupSlots>(emptySlots);
  const [typing, setTyping] = useState(false);
  const [slowReply, setSlowReply] = useState(false);
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
  const conversationIdRef = useRef<string>("");
  const startedAtRef = useRef<string>("");
  const factsRef = useRef<BusinessFacts | null>(null);
  const draftKeyRef = useRef<string>("");
  const syncedCountRef = useRef(0);

  const nextId = () => {
    idRef.current += 1;
    return idRef.current;
  };

  function pushAi(text: string, opts?: { learned?: string[]; then?: () => void; delay?: number }) {
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      transcriptRef.current.push({ role: "ai", text });
      setMessages((m) => [...m, { id: nextId(), role: "ai", text, learned: opts?.learned, at: stamp() }]);
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
          currency: userWorkspace?.currency,
          transcript: transcriptRef.current,
          slots: slotsRef.current,
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
      businessType: chips.some((c) => c === "Sells products") ? "ecommerce" : "service",
      whatTheySell: chips[0] ?? "Described during the checkup",
      primaryGoal: "Understand why growth is slow and what to fix next",
      customers: slots.targetMarket ?? "Described during the checkup",
      channels: chips.filter((c) => c.startsWith("Channel:")).map((c) => c.replace("Channel: ", "")),
      journey: [],
      // Only trends the owner actually gave — never guessed from words like "more".
      trends: {
        enquiries: slots.enquiries ?? "Don't know",
        customers: slots.customers ?? "Don't know",
        revenue: slots.revenue ?? "Don't know",
      },
      recentChanges: slots.changes?.length ? slots.changes : ["Reported during the checkup"],
      bottleneck: slots.bottleneck,
      closeRate: slots.closeRate,
      followUp: slots.followUp,
      jobValue: slots.jobValue,
      monthlyEnquiries: slots.monthlyEnquiries,
      pricePresentation: slots.pricePresentation,
      lostReason: slots.lostReason,
      capacity: slots.capacity,
      proof: slots.proof,
      repeat: slots.repeat,
      ownerTheory: slots.ownerTheory,
      chips,
      facts: [
        { section: "Business", value: `${userWorkspace?.name ?? "Your business"} — described in your checkup conversation`, provenance: "user-supplied", source: "Workspace setup" },
        { section: "How people find you", value: chips.filter((c) => c.startsWith("Channel:")).map((c) => c.replace("Channel: ", "")).join(", ") || "Not specified yet", provenance: "user-supplied", source: "Your checkup conversation" },
      ],
      confidence: 55,
    };
  }

  /** Put a saved conversation back on screen and carry on from where it stopped. */
  function applyDraft(draft: ChatDraft) {
    conversationIdRef.current = draft.conversationId;
    startedAtRef.current = draft.startedAt;
    transcriptRef.current = draft.transcript ?? [];
    phaseRef.current = draft.phase ?? "interview";
    slotsRef.current = { ...emptySlots(), ...draft.slots };
    askCountsRef.current = draft.askCounts ?? {};
    factsRef.current = draft.facts ?? null;
    idRef.current = Math.max(0, ...draft.messages.map((m) => m.id));
    setMessages(draft.messages);
    setPhase(phaseRef.current);
    setSlots(slotsRef.current);
    const last = draft.messages[draft.messages.length - 1];
    if (phaseRef.current === "done") {
      // Finished talking but the closing step never completed — finish it now.
      if (!draft.messages.some((m) => m.cta)) finishConversation();
    } else if (last.role === "user") {
      // Left while the consultant was still replying — get that reply now.
      void consultantTurn(last.text);
    } else {
      setChips(draft.chips ?? []);
    }
  }

  // Start (or resume) the conversation once the store has loaded the workspace.
  // 1. A draft in this browser wins (reload / left by mistake / logged out).
  // 2. Otherwise the latest conversation saved on the server for this
  //    workspace + signed-in user (fresh browser, cleared storage).
  // 3. Otherwise a varied opening question.
  useEffect(() => {
    if (!hydrated || started.current) return;
    started.current = true;
    draftKeyRef.current = chatDraftKey("onboarding-checkup", userWorkspace?.name);
    const local = loadDraft<ChatDraft>(draftKeyRef.current);
    if (hasOwnerTurn(local)) {
      applyDraft(local);
      return;
    }
    let cancelled = false;
    let settled = false;
    let timer = 0;
    setTyping(true);
    void (async () => {
      const stored = await fetchResumableChat("onboarding-checkup", userWorkspace?.name);
      if (cancelled) return;
      settled = true;
      setTyping(false);
      const fromServer = stored ? draftFromServer(stored) : null;
      if (hasOwnerTurn(fromServer)) {
        syncedCountRef.current = fromServer.messages.filter((m) => m.text).length;
        applyDraft(fromServer);
        return;
      }
      conversationIdRef.current = newChatId("onb");
      startedAtRef.current = stamp();
      const opener = OPENERS[Math.floor(Math.random() * OPENERS.length)];
      const chipPair = INTRO_CHIPS[Math.floor(Math.random() * INTRO_CHIPS.length)];
      timer = window.setTimeout(() => {
        setMessages([{ id: nextId(), role: "ai", text: opener, at: stamp() }]);
        setChips(chipPair);
      }, 300);
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      // Unmounted before the lookup finished: let a remount start again.
      if (!settled) started.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  // Keep the draft in the browser and the conversation on the server.
  useEffect(() => {
    if (!started.current || !conversationIdRef.current || messages.length === 0) return;
    const draft: ChatDraft = {
      v: 1,
      conversationId: conversationIdRef.current,
      startedAt: startedAtRef.current,
      messages,
      chips,
      phase: phaseRef.current,
      slots: slotsRef.current,
      askCounts: askCountsRef.current,
      transcript: transcriptRef.current,
      facts: factsRef.current,
    };
    saveDraft(draftKeyRef.current, draft);

    const logged: ChatLogMessage[] = messages
      .filter((m) => m.text)
      .map((m, i) => ({
        seq: i,
        role: m.role,
        text: m.text,
        at: m.at ?? startedAtRef.current,
        meta: {
          ...(m.learned?.length ? { learned: m.learned } : {}),
          ...(m.degraded ? { degraded: true } : {}),
          ...(m.note ? { note: true } : {}),
        },
      }));
    const finished = messages.some((m) => m.cta);
    // Only log real conversations: nothing until the owner has said something.
    if (!logged.some((m) => m.role === "user")) return;
    if (logged.length === syncedCountRef.current && !finished) return;
    syncedCountRef.current = logged.length;
    syncChat({
      id: conversationIdRef.current,
      chatType: "onboarding-checkup",
      screen: "onboarding-chat",
      clientId: getClientId(),
      workspaceId: workspaceKey(userWorkspace?.name),
      workspaceName: userWorkspace?.name,
      country: userWorkspace?.country,
      phase: phaseRef.current,
      slots: slotsRef.current,
      facts: factsRef.current,
      // The diagnosis rides along so the team can review each chat next to what it produced.
      meta: {
        askCounts: askCountsRef.current,
        finished,
        suggestedChips: chips,
        ...(finished && useBizz.getState().checkup.diagnosis ? { diagnosis: useBizz.getState().checkup.diagnosis } : {}),
      },
      startedAt: startedAtRef.current,
      messages: logged,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, chips, phase, slots]);

  /** Throw away the saved conversation and start a fresh one. */
  function startOver() {
    clearDraft(draftKeyRef.current);
    transcriptRef.current = [];
    phaseRef.current = "interview";
    slotsRef.current = emptySlots();
    askCountsRef.current = {};
    factsRef.current = null;
    syncedCountRef.current = 0;
    conversationIdRef.current = newChatId("onb");
    startedAtRef.current = stamp();
    setPhase("interview");
    setSlots(emptySlots());
    setInput("");
    setMessages([{ id: nextId(), role: "ai", text: OPENERS[Math.floor(Math.random() * OPENERS.length)], at: stamp() }]);
    setChips(INTRO_CHIPS[Math.floor(Math.random() * INTRO_CHIPS.length)]);
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, typing, chips]);

  /**
   * Closing flow: structured extraction → persist → straight to the diagnosis.
   * The payoff comes first; checking the details we used is optional, from
   * the diagnosis page — never homework standing between the owner and it.
   */
  function finishConversation() {
    setFinishing(true);
    setTyping(true);
    setChips([]);
    void (async () => {
      const result = await extractFacts();
      const facts = result?.facts ?? offlineFacts();
      factsRef.current = facts;
      setCheckupFacts(facts, [...transcriptRef.current]);
      setTyping(false);
      setFinishing(false);
      pushAi("All done — I'm putting your diagnosis together now. It will show what's holding the business back, what fixing it could be worth, and exactly what to do first.", {
        delay: 400,
        then: () => {
          setMessages((m) => [...m, { id: nextId(), role: "ai", text: "", cta: true, at: stamp() }]);
          window.setTimeout(() => navigate("first-diagnosis"), 1800);
        },
      });
    })();
  }

  /** One consultant turn — the engine classifies, harvests what it can, and chooses its own next question. */
  async function consultantTurn(text: string) {
    busyRef.current = true;
    setTyping(true);
    setChips([]);
    // A thoughtful answer can take a few seconds — say so instead of leaving dots.
    const slowTimer = window.setTimeout(() => setSlowReply(true), 5000);
    const userTurns = transcriptRef.current.filter((t) => t.role === "user").length;
    const payload = {
      workspaceName: userWorkspace?.name ?? "Your business",
      country: userWorkspace?.country ?? "Nigeria",
      currency: userWorkspace?.currency,
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
      setMessages((m) => [...m, { id: nextId(), role: "ai", text: data.reply as string, learned, degraded, at: stamp() }]);

      phaseRef.current = nextPhase;
      slotsRef.current = nextSlots;
      askCountsRef.current = data.askCounts ?? {};
      setPhase(nextPhase);
      setSlots(nextSlots);
      setChips(data.chips ?? []);

      if (nextPhase === "done" || userTurns + 1 >= MAX_USER_TURNS) finishConversation();
    } catch {
      // Network hiccup — never advance, never guess. Ask the owner to try again.
      setTyping(false);
      setMessages((m) => [
        ...m,
        { id: nextId(), role: "ai", text: "Sorry — I lost the connection for a moment. Could you send that again?", at: stamp(), note: true },
      ]);
      setChips([]);
    } finally {
      window.clearTimeout(slowTimer);
      setSlowReply(false);
      busyRef.current = false;
    }
  }

  function send(raw?: string) {
    const text = (raw ?? input).trim();
    if (!text || typing || busyRef.current || finishing || phaseRef.current === "done") return;
    transcriptRef.current.push({ role: "user", text });
    setMessages((m) => [...m, { id: nextId(), role: "user", text, at: stamp() }]);
    setInput("");
    void consultantTurn(text);
  }

  // Side panel — what the checkup has actually learned, with the owner's own
  // answers, driven by real slots. Follow-up topics appear once the answers
  // so far make them relevant.
  const summaries = summariesFrom(messages);
  const valueOf = (key: SlotKey): string | null => {
    const v = slots[key as keyof CheckupSlots];
    const raw = Array.isArray(v) ? (v.length ? v.join(", ") : null) : typeof v === "string" && v.length > 0 && v !== "Don't know" ? v : null;
    if (!raw) return null;
    // Prefer the checkup's own short summary; otherwise the owner's words, tidied.
    return summaries[key] ?? tidyOwnerText(raw);
  };
  const panelKeys: SlotKey[] = [
    ...REQUIRED_SLOTS,
    ...(slots.bottleneck ? depthSlotsFor(slots).filter((k) => !REQUIRED_SLOTS.includes(k)) : []),
  ];
  const LEARN: { key: SlotKey; label: string; value: string | null; status: LearnStatus }[] = panelKeys.map((key) => {
    const value = valueOf(key);
    const skipped = slots.declined.includes(key);
    return {
      key,
      label: LEARN_LABELS[key] ?? key,
      value: skipped && !value ? "Skipped — that's fine" : value,
      status: value || skipped || phase === "done" ? "done" : slots.pending === key ? "active" : "pending",
    };
  });
  const learnedCount = LEARN.filter((l) => l.status === "done").length;

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
              <p className="text-sm font-semibold leading-tight">Your business checkup</p>
              <p className="text-xs text-muted-foreground">A few questions so your diagnosis fits your business — estimates are fine.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {messages.some((m) => m.role === "user") ? (
              <button
                type="button"
                onClick={startOver}
                disabled={typing || finishing}
                className="rounded-md px-2 py-1 text-[11px] font-medium text-violet-700 underline-offset-2 hover:underline disabled:opacity-50"
              >
                Start over
              </button>
            ) : null}
            <p className="flex items-center gap-1.5 rounded-md border border-violet-200 bg-white px-2 py-1 text-[11px] font-medium text-violet-700">
              <Lock className="size-3" aria-hidden />
              Private checkup — saved so you can pick up later
            </p>
          </div>
        </div>

        {/* Compact progress strip — small screens only, where the side panel is hidden */}
        <div className="flex items-center gap-3 border-b border-violet-100 px-4 py-2 md:hidden">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-violet-100">
            <div
              className="h-full rounded-full bg-violet-600 transition-all"
              style={{ width: `${Math.round((learnedCount / Math.max(1, LEARN.length)) * 100)}%` }}
            />
          </div>
          <span className="text-[11px] font-medium text-violet-700">
            {learnedCount}/{LEARN.length} understood
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
                          Simple mode — I&apos;m having trouble connecting, so this reply is simpler than usual. Your answers are still saved.
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
                        <Button size="sm" className="mt-2.5 w-full bg-violet-600 hover:bg-violet-700 sm:w-auto" onClick={() => navigate("first-diagnosis")}>
                          See my diagnosis
                          <ArrowRight className="size-4" aria-hidden />
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
                    {finishing ? (
                      <span className="ml-2 text-xs text-slate-500">Pulling together everything you told me…</span>
                    ) : slowReply ? (
                      <span className="ml-2 text-xs text-slate-500">Thinking about your answer…</span>
                    ) : null}
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
          <aside className="hidden border-l border-violet-100 bg-violet-50/40 p-4 sm:p-5 md:block" aria-label="What I've learned so far">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold">What I&apos;ve learned</h2>
              <span className="text-[11px] font-medium text-violet-700 tnum">
                {learnedCount}/{LEARN.length}
              </span>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-violet-100" aria-hidden>
              <div className="h-full rounded-full bg-violet-600 transition-all duration-500" style={{ width: `${Math.round((learnedCount / Math.max(1, LEARN.length)) * 100)}%` }} />
            </div>
            <ul className="mt-4 max-h-[22rem] space-y-2.5 overflow-y-auto pr-1">
              {LEARN.map((item) => (
                <li key={item.key} className="flex items-start gap-2.5">
                  {item.status === "done" ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-label="Understood" />
                  ) : item.status === "active" ? (
                    <span className="mt-1 flex size-4 shrink-0 items-center justify-center" role="img" aria-label="Asking now">
                      <span className="flex gap-0.5">
                        <span className="size-1 animate-bounce rounded-full bg-violet-500 [animation-delay:0ms]" />
                        <span className="size-1 animate-bounce rounded-full bg-violet-500 [animation-delay:150ms]" />
                        <span className="size-1 animate-bounce rounded-full bg-violet-500 [animation-delay:300ms]" />
                      </span>
                    </span>
                  ) : (
                    <CircleDashed className="mt-0.5 size-4 shrink-0 text-slate-300" aria-label="Not yet" />
                  )}
                  <div className="min-w-0">
                    <p className={cn("text-[13px] leading-snug", item.status === "pending" ? "text-muted-foreground" : "font-medium text-foreground")}>{item.label}</p>
                    {item.value ? <p className="mt-0.5 text-xs leading-snug text-slate-500">{shorten(item.value, 64)}</p> : null}
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-5 rounded-lg border border-violet-100 bg-white p-3">
              <p className="text-[11px] font-semibold text-violet-800">Why all the questions?</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                Each answer makes your diagnosis more specific to you — and lets us work out what fixing the problem is worth, using your own numbers. Rough guesses are fine, and you can skip anything.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
