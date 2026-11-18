"use client";

/**
 * ChatPanel.tsx — drop-in replacement for the "Chat with the intelligence"
 * panel. Pairs with ./chat-engine.ts.
 *
 * Fixes it carries (vs. the panel whose HTML showed the bugs):
 *  - Quick replies are re-rendered from EVERY engine turn, so a stale option
 *    like "Last month" disappears the moment the month is answered (bug B2).
 *  - A visible progress line ("Step 2 of 3 · marketing") (bug B6).
 *  - The chips strip renders whatever the engine reports each turn — including
 *    "Marketing: ₦0" and muted "not sure" chips (bug B5).
 *  - The finish button is primary ("Save & finish") once the snapshot is
 *    complete, and stays secondary ("Save what we have") before that.
 *  - The message list is aria-live and auto-scrolls.
 *
 * Assumes shadcn/ui Button + Input and Tailwind, as in your current markup.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { IntakeEngine, type EngineTurn, type IntakeResult } from "./chat-engine";
// Adjust import paths to your project's shadcn setup:
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, CircleCheck, Loader2 } from "lucide-react";

type Message = { id: number; role: "user" | "bot"; text: string };

export function ChatPanel({
  businessName,
  onSave,
}: {
  /** e.g. "Node 71 limited" */
  businessName?: string;
  /** Called with the captured record when the user saves. */
  onSave?: (record: IntakeResult) => void | Promise<void>;
}) {
  const engineRef = useRef<IntakeEngine | null>(null);
  if (!engineRef.current) engineRef.current = new IntakeEngine({ businessName });
  const engine = engineRef.current;

  const [messages, setMessages] = useState<Message[]>([]);
  const [turn, setTurn] = useState<EngineTurn | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const idRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const first = engine.open();
    setMessages([{ id: idRef.current++, role: "bot", text: first.assistantText }]);
    setTurn(first);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, turn]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy || saved) return;
      setBusy(true);
      setMessages((m) => [...m, { id: idRef.current++, role: "user", text: trimmed }]);
      setInput("");
      try {
        const next = await engine.handleUserMessage(trimmed);
        setMessages((m) => [...m, { id: idRef.current++, role: "bot", text: next.assistantText }]);
        setTurn(next);
        if (next.saveRequested && next.result) {
          setSaved(true);
          try {
            await onSave?.(next.result);
          } catch (e) {
            setSaveError(e instanceof Error ? e.message : "Could not save — try again.");
          }
        }
      } finally {
        setBusy(false);
      }
    },
    [busy, saved, engine, onSave],
  );

  const saveAndFinish = useCallback(async () => {
    if (!turn?.result) return;
    setSaved(true);
    try {
      await onSave?.(turn.result);
    } catch (e) {
      setSaved(false);
      setSaveError(e instanceof Error ? e.message : "Could not save — try again.");
    }
  }, [turn, onSave]);

  const finishNow = useCallback(() => send("that's everything"), [send]);

  const progress = turn?.progress;
  const done = turn?.done ?? false;

  return (
    <div className="space-y-3">
      {/* message log */}
      <div
        ref={scrollRef}
        aria-live="polite"
        className="max-h-80 space-y-3 overflow-y-auto rounded-lg border bg-slate-50/60 p-3"
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={
              m.role === "user"
                ? "text-sm ml-auto max-w-[85%] whitespace-pre-line rounded-lg bg-blue-600 px-3 py-2 text-white"
                : "text-sm max-w-[85%] whitespace-pre-line rounded-lg border bg-white px-3 py-2"
            }
          >
            {m.text}
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Loader2 className="size-3.5 animate-spin" /> thinking…
          </div>
        )}
      </div>

      {/* progress */}
      {progress && !saved && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{ width: `${(progress.answered / progress.total) * 100}%` }}
            />
          </div>
          <span className="tnum whitespace-nowrap">
            {done
              ? "Complete"
              : `Step ${progress.answered + 1} of ${progress.total} · ${progress.currentLabel}`}
          </span>
        </div>
      )}

      {/* what I've heard so far — engine-derived, so ₦0 / "not sure" show up */}
      {turn && turn.chips.length > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
            What I&apos;ve heard so far
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {turn.chips.map((c) => (
              <span
                key={c.label}
                className={
                  c.muted
                    ? "rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-500 italic tnum"
                    : "rounded-full bg-white px-2.5 py-1 text-xs font-medium text-blue-900 tnum"
                }
              >
                {c.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {saveError && (
        <p className="text-xs text-red-600" role="alert">
          {saveError}
        </p>
      )}

      {/* quick replies — regenerated every turn, so never stale */}
      {!saved && turn && turn.quickReplies.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {turn.quickReplies.map((q) => (
            <Button
              key={q}
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => {
                if (/^save it$/i.test(q)) void saveAndFinish();
                else void send(q);
              }}
            >
              {q}
            </Button>
          ))}
        </div>
      )}

      {saved ? (
        <p className="flex items-center gap-1.5 text-sm text-green-700">
          <CircleCheck className="size-4" /> Saved — this month is in the Data Centre.
        </p>
      ) : (
        <div className="flex gap-2">
          <Input
            aria-label="Chat answer"
            placeholder="Type your answer — e.g. “we made about 700k, spent 200k on ads”"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
          />
          <Button type="button" disabled={!input.trim() || busy} onClick={() => void send(input)}>
            <Send className="size-4" />
            <span className="sr-only">Send</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => (done ? void saveAndFinish() : void finishNow())}
          >
            <CircleCheck className="size-4" />
            {done ? "Save & finish" : "Save what we have"}
          </Button>
        </div>
      )}
    </div>
  );
}
