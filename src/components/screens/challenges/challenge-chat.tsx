"use client";
// Report a new challenge (or tell us more about one already on the list):
// a SHORT, focused chat — what's happening, since when, how often, what you've
// tried, and one or two questions picked for it. It reuses everything already
// known about the business, so it never redoes the checkup. If it sounds like
// the same problem as one already on the list, it offers to link them instead.
// At the end the challenge gets its own diagnosis and next step.

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Flag, Loader2, RotateCcw, SendHorizontal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/components/shared/states";
import { useBizz, useChallenge, useOwnChallenges } from "@/lib/store";
import { otherChallengeChips, type ChallengeDetails } from "@/lib/challenges";
import type { ChallengeChatState, ChallengeTurnResult } from "@/lib/challenge-chat";
import type { BusinessFacts, TranscriptTurn } from "@/lib/checkup";
import { requestChallengeDiagnosis } from "@/lib/challenge-client";
import { shorten } from "@/lib/checkup-math";
import { cn } from "@/lib/utils";
import type { ScreenProps } from "../view-types";

interface Bubble {
  role: "ai" | "user";
  text: string;
  why?: string;
  note?: boolean;
}

const OPENER = "What's holding the business back? Say it in your own words — a sentence is enough.";

export function ChallengeChatScreen({ params }: ScreenProps) {
  const id = params.id;
  const existing = useChallenge(id);
  const list = useOwnChallenges();
  const navigate = useBizz((s) => s.navigate);
  const hydrated = useBizz((s) => s.hydrated);
  const businessId = useBizz((s) => s.businessId);
  const facts = useBizz((s) => s.checkup.facts);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const addChallenge = useBizz((s) => s.addChallenge);
  const updateChallenge = useBizz((s) => s.updateChallenge);
  const addAngle = useBizz((s) => s.addChallengeAngle);
  const patchCheckupFacts = useBizz((s) => s.patchCheckupFacts);

  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [chips, setChips] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [phase, setPhase] = useState<"chat" | "diagnosing" | "failed" | "linked">("chat");
  const [linkedTo, setLinkedTo] = useState<string | null>(null);
  const challengeIdRef = useRef<string | null>(id ?? null);
  const transcriptRef = useRef<TranscriptTurn[]>([]);
  const stateRef = useRef<ChallengeChatState>({ answers: {} });
  const started = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);

  // Example answers for a new challenge — fitted to this kind of business, minus what's already on the list.
  const examples = useMemo(
    () =>
      otherChallengeChips(
        { sells: facts?.whatTheySell, businessType: facts?.businessType === "ecommerce" ? "I sell products" : undefined, targetMarket: facts?.customers, channels: facts?.channels },
        list.filter((c) => c.status === "working" || c.status === "up-next").map((c) => c.title),
        { includeNone: false, limit: 4 },
      ),
    [facts, list],
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [bubbles, typing, phase]);

  // Start, or pick up where the chat stopped.
  useEffect(() => {
    if (!hydrated || started.current) return;
    if (id && !existing) return;
    started.current = true;
    if (existing) {
      if (existing.chatDone) return;
      const saved = existing.transcript ?? [];
      if (saved.length && existing.chat) {
        transcriptRef.current = [...saved];
        stateRef.current = existing.chat.state;
        setBubbles(saved.map((t) => ({ role: t.role, text: t.text })));
        setChips(existing.chat.chips);
        return;
      }
      stateRef.current = { answers: {}, stage: existing.stage, title: existing.title };
      void turn();
      return;
    }
    setBubbles([{ role: "ai", text: OPENER }]);
    transcriptRef.current = [{ role: "ai", text: OPENER }];
  }, [hydrated, existing, id]);

  function persist(cid: string, result: ChallengeTurnResult) {
    updateChallenge(cid, {
      details: result.details as ChallengeDetails,
      transcript: [...transcriptRef.current],
      ...(result.state.title && !existing ? { title: result.state.title } : {}),
      ...(result.state.stage ? { stage: result.state.stage } : {}),
      chat: result.phase === "done" ? null : { state: result.state, chips: result.chips, why: result.why },
      chatDone: result.phase === "done",
    });
  }

  async function turn() {
    setTyping(true);
    setChips([]);
    try {
      const res = await fetch("/api/challenges/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceName: userWorkspace?.name ?? "Your business",
          country: userWorkspace?.country,
          currency: userWorkspace?.currency,
          facts: facts ? ({ ...facts, facts: [], chips: [] } as BusinessFacts) : null,
          challenge: existing ? { id: existing.id, title: existing.title } : null,
          others: list.filter((c) => c.id !== challengeIdRef.current).map((c) => ({ id: c.id, title: c.title, status: c.status })),
          transcript: transcriptRef.current,
          state: stateRef.current,
        }),
      });
      const data = (await res.json()) as { ok?: boolean } & ChallengeTurnResult;
      if (!data.ok || typeof data.reply !== "string") throw new Error("bad reply");
      stateRef.current = data.state;
      transcriptRef.current = [...transcriptRef.current, { role: "ai", text: data.reply }];
      setBubbles((b) => [...b, { role: "ai", text: data.reply, why: data.why }]);
      setChips(data.chips ?? []);

      // The owner agreed it's the same problem as one already on the list.
      if (data.phase === "done" && data.linkedTo) {
        addAngle(data.linkedTo, { text: data.details.what ?? transcriptRef.current.find((t) => t.role === "user")?.text ?? "", source: "reported", details: data.details });
        setLinkedTo(data.linkedTo);
        setPhase("linked");
        return;
      }

      // A new challenge goes on the list once we know it isn't a duplicate.
      if (!challengeIdRef.current && data.state.pending !== "link") {
        challengeIdRef.current = addChallenge({
          title: data.state.title ?? data.details.what ?? "What's holding the business back",
          source: "reported",
          stage: data.state.stage,
          details: data.details,
          transcript: [...transcriptRef.current],
          chatDone: false,
        });
      }
      if (challengeIdRef.current) persist(challengeIdRef.current, data);
      if (Object.keys(data.factUpdates ?? {}).length) patchCheckupFacts(data.factUpdates as Partial<BusinessFacts>);

      if (data.phase === "done" && challengeIdRef.current) {
        setPhase("diagnosing");
        const cid = challengeIdRef.current;
        const ok = await requestChallengeDiagnosis(cid);
        if (ok) navigate(`challenges/${cid}`);
        else setPhase("failed");
      }
    } catch {
      setBubbles((b) => [...b, { role: "ai", text: "Sorry — I lost the connection for a moment. Could you send that again?", note: true }]);
      // Let them resend their last answer.
      const lastUser = [...transcriptRef.current].reverse().find((t) => t.role === "user");
      if (lastUser && transcriptRef.current[transcriptRef.current.length - 1]?.role === "user") {
        transcriptRef.current = transcriptRef.current.slice(0, -1);
        setInput(lastUser.text);
      }
    } finally {
      setTyping(false);
    }
  }

  function send(raw?: string) {
    const text = (raw ?? input).trim();
    if (!text || typing || phase !== "chat") return;
    setInput("");
    transcriptRef.current = [...transcriptRef.current, { role: "user", text }];
    setBubbles((b) => [...b, { role: "user", text }]);
    void turn();
  }

  async function retryDiagnosis() {
    const cid = challengeIdRef.current;
    if (!cid) return;
    setPhase("diagnosing");
    const ok = await requestChallengeDiagnosis(cid);
    if (ok) navigate(`challenges/${cid}`);
    else setPhase("failed");
  }

  /* ---------- states ---------- */
  if (!hydrated) return <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>;
  if (businessId !== "user-workspace" || !facts) {
    return (
      <div className="mx-auto w-full max-w-xl py-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">Challenges</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">Your checkup comes first</h1>
        <p className="mt-2 text-sm text-muted-foreground">Challenges are tracked in your own workspace, built on what your checkup learned about the business.</p>
        <Button className="mt-5 bg-brand-600 hover:bg-brand-700" onClick={() => navigate(userWorkspace ? "onboarding-chat" : "create-workspace")}>
          {userWorkspace ? "Do my checkup" : "Create my workspace"}
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
    );
  }
  if (id && !existing) {
    return <ErrorState title="Challenge not found" description="It may have been removed, or it belongs to another workspace." onHome={() => navigate("challenges")} />;
  }
  if (existing?.chatDone && phase === "chat" && bubbles.length === 0) {
    return (
      <div className="mx-auto w-full max-w-xl py-10 text-center">
        <h1 className="text-xl font-bold tracking-tight">We already talked about this one</h1>
        <p className="mt-2 text-sm text-muted-foreground">“{shorten(existing.title, 90)}” has its answers and diagnosis.</p>
        <Button className="mt-5 bg-brand-600 hover:bg-brand-700" onClick={() => navigate(`challenges/${existing.id}`)}>
          See it
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
    );
  }

  const answered = Object.keys(stateRef.current.answers).length;
  const total = 4 + Math.min(2, stateRef.current.targeted?.length ?? 2);
  const linkedTitle = linkedTo ? list.find((c) => c.id === linkedTo)?.title : null;
  const firstAnswer = !existing && transcriptRef.current.filter((t) => t.role === "user").length === 0;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <button type="button" onClick={() => navigate("challenges")} className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" aria-hidden /> Challenges
      </button>

      <div className="overflow-clip rounded-3xl border border-brand-200 bg-white shadow-sm">
        <div className="border-b border-brand-100 bg-brand-50/70 px-5 py-4 sm:px-6">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-brand-700">
            <Flag className="size-3.5" aria-hidden />
            {existing ? "Tell me more" : "Report a new challenge"}
          </p>
          <h1 className="mt-1 text-lg font-semibold leading-snug text-slate-900">
            {existing ? `“${shorten(existing.title, 90)}”` : "Something else holding the business back?"}
          </h1>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex gap-1" aria-hidden>
              {Array.from({ length: total }).map((_, i) => (
                <span key={i} className={cn("h-1.5 w-6 rounded-full", i < answered ? "bg-brand-600" : "bg-brand-100")} />
              ))}
            </div>
            <span className="text-xs text-slate-500">A few quick questions · tap or type · I already know your business</span>
          </div>
        </div>

        <div className="space-y-3 px-4 py-5 sm:px-6" aria-live="polite" aria-label="Challenge conversation">
          {bubbles.map((b, i) =>
            b.role === "ai" ? (
              <div key={i} className="flex gap-2.5">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
                  <Sparkles className="size-3.5" aria-hidden />
                </span>
                <div className="max-w-[85%]">
                  <p className={cn("rounded-2xl rounded-tl-md px-4 py-2.5 text-[15px] leading-relaxed", b.note ? "bg-amber-50 text-amber-900" : "bg-slate-100 text-slate-800")}>{b.text}</p>
                  {b.why ? <p className="mt-1 px-1 text-xs text-slate-500">Why I’m asking: {b.why.replace(/^./, (c) => c.toLowerCase())}</p> : null}
                </div>
              </div>
            ) : (
              <div key={i} className="flex justify-end">
                <p className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-slate-800 px-4 py-2.5 text-[15px] leading-relaxed text-white">{b.text}</p>
              </div>
            ),
          )}
          {typing ? (
            <div className="flex items-center gap-2.5 text-sm text-slate-500" role="status">
              <span className="flex size-7 items-center justify-center rounded-full bg-brand-600 text-white">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
              </span>
              Thinking about your answer…
            </div>
          ) : null}
          {phase === "diagnosing" ? (
            <div className="flex items-center gap-2.5 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900" role="status">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Working out what&apos;s behind it, and the first thing to try — this can take up to a minute…
            </div>
          ) : null}
          {phase === "failed" ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Your answers are saved — I just couldn&apos;t write the diagnosis yet.
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="bg-white" onClick={retryDiagnosis}>
                  <RotateCcw className="size-3.5" aria-hidden /> Try again
                </Button>
                <Button size="sm" variant="ghost" onClick={() => navigate(`challenges/${challengeIdRef.current}`)}>
                  See it on your list
                </Button>
              </div>
            </div>
          ) : null}
          {phase === "linked" && linkedTo ? (
            <div className="flex flex-col gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-600" aria-hidden /> Added to “{shorten(linkedTitle ?? "", 70)}” — tracked in one place.
              </span>
              <Button size="sm" variant="outline" className="bg-white" onClick={() => navigate(`challenges/${linkedTo}`)}>
                See it
              </Button>
            </div>
          ) : null}
          <div ref={endRef} aria-hidden />
        </div>

        {phase === "chat" ? (
          <div className="sticky bottom-0 border-t border-slate-100 bg-white/95 px-4 py-4 backdrop-blur sm:px-6">
            {(firstAnswer ? examples : chips).length && !typing ? (
              <>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  {firstAnswer ? "For example — tap one, or type your own" : "Tap an answer — or type your own"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {(firstAnswer ? examples : chips).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => send(c)}
                      className="min-h-10 rounded-full border border-brand-200 bg-brand-50/60 px-4 py-2 text-sm font-medium text-brand-800 transition-colors hover:border-brand-400 hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={firstAnswer ? "e.g. what's happening, in a sentence" : "Your answer…"}
                aria-label="Your answer"
                disabled={typing}
                className="h-11 border-brand-200 bg-white text-base"
              />
              <Button type="submit" size="icon" className="size-11 shrink-0 bg-brand-600 hover:bg-brand-700" disabled={typing || !input.trim()} aria-label="Send">
                <SendHorizontal className="size-4" aria-hidden />
              </Button>
            </form>
          </div>
        ) : null}
      </div>
    </div>
  );
}
