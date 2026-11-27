"use client";
// Pieces of the owner's diagnosis: the analysis shown while it is written,
// what fixing it is worth, the ready-to-use help, the week's checklist and
// where in the customer journey growth gets stuck. The consultant speaks as
// one person ("I"), never "we".

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Calculator,
  CheckCircle2,
  ChevronDown,
  Circle,
  CircleDashed,
  ListChecks,
  Loader2,
  MessageCircle,
  MessagesSquare,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Tags,
  Target,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DraftButton } from "@/components/shared/try-this";
import { outsideNote, type Challenge } from "@/lib/challenges";
import type { DraftHint, DraftKind } from "@/lib/coach";
import { FOCUS_STAGES, type BusinessFacts, type DiagnosisContent, type DiagnosisTool, type FocusStage } from "@/lib/checkup";
import { shorten, tidyOwnerText } from "@/lib/checkup-math";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

export function confidenceWord(c: number) {
  if (c >= 65) return "Solid first read";
  if (c >= 52) return "Good first read";
  return "Early first read";
}

function listToSentence(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export type AnswerRow = { label: string; value: string; long?: boolean };

const usable = (v: string | undefined): v is string => typeof v === "string" && v.trim().length > 0 && !/^described during/i.test(v);

/** The owner's answers worth showing back, in their own (cleaned) words. */
export function toldUs(facts: BusinessFacts): AnswerRow[] {
  const rows: [string, string | undefined][] = [
    ["What you sell", facts.whatTheySell],
    ["Who pays you", facts.customers],
    ["How people find you", facts.channels.length ? facts.channels.join(", ") : undefined],
    ["What feels hardest", facts.bottleneck],
    ["What you think is causing it", facts.ownerTheory],
    ["How many go on to pay", facts.closeRate],
    ["People asking each month", facts.monthlyEnquiries],
    ["A typical job or order", facts.jobValue],
    ["Getting back to people", facts.followUp],
    ["How you give your price", facts.pricePresentation],
    ["When people don't buy", facts.lostReason],
    ["What people see before the price", facts.proof],
    ["Room for more work", facts.capacity],
    ["Customers coming back", facts.repeat],
  ];
  return rows.filter((r): r is [string, string] => usable(r[1])).map(([label, value]) => ({ label, value: tidyOwnerText(value) }));
}

/** What the owner said about one challenge in its short chat — skipping anything already shown. */
export function challengeRows(c: Challenge | null, shown: AnswerRow[]): AnswerRow[] {
  const d = c?.details;
  if (!c || !d) return [];
  const seen = new Set([c.title, ...shown.map((r) => r.value)].map((v) => tidyOwnerText(v).toLowerCase()));
  const rows: AnswerRow[] = [];
  const add = (label: string, value: string | undefined, long?: boolean) => {
    if (!usable(value)) return;
    const clean = tidyOwnerText(value);
    if (seen.has(clean.toLowerCase())) return;
    seen.add(clean.toLowerCase());
    rows.push({ label, value: clean, long });
  };
  add("What's happening", d.what);
  add("Since when", d.since);
  add("How often", d.often);
  add("What you've tried", d.tried);
  for (const x of d.extra ?? []) add(shorten(x.question, 90), x.answer, true);
  return rows;
}

const JOB_VALUE_OPTIONS_NGN = ["Under ₦50,000", "₦50,000 – ₦200,000", "₦200,000 – ₦1 million", "Over ₦1 million"];
const MONTHLY_OPTIONS = ["1 to 5 a month", "6 to 15 a month", "16 to 40 a month", "More than 40"];

/** Money can be worked out from people who ask — it doesn't fit a capacity problem. */
export function canAskForMoney(diagnosis: DiagnosisContent, facts: BusinessFacts) {
  return Boolean(facts.closeRate) && !diagnosis.stake?.isMoney && diagnosis.focusStage !== "deliver";
}

/* ------------------------------------------------------------------ */
/* While it is written: an analysis that walks through their answers    */
/* ------------------------------------------------------------------ */

export function AnalysisProgress({ facts, failed, onRetry, name }: { facts: BusinessFacts; failed: boolean; onRetry: () => void; name: string }) {
  const steps = useMemo(
    () => [
      "Reading everything you told me",
      facts.channels.length ? `How people find you — ${listToSentence(facts.channels.slice(0, 3))}` : "How people find you",
      facts.bottleneck ? `Where it gets stuck — ${shorten(facts.bottleneck, 70)}` : "Where growth gets stuck",
      facts.closeRate ? `How many go on to pay — ${facts.closeRate}` : "How many people go on to pay",
      facts.jobValue || facts.closeRate ? "Working out what fixing it is worth, from your numbers" : "Weighing up what matters most",
      "Writing your plan — and the exact words to use",
    ],
    [facts],
  );
  const [active, setActive] = useState(0);
  useEffect(() => {
    if (failed) return;
    const t = window.setInterval(() => setActive((a) => Math.min(a + 1, steps.length - 1)), 1700);
    return () => window.clearInterval(t);
  }, [failed, steps.length]);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <section
        aria-label="Your diagnosis is being prepared"
        className="relative overflow-hidden rounded-3xl border border-brand-200 bg-gradient-to-br from-brand-50 via-white to-brand-50 p-6 shadow-sm sm:p-10"
      >
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-brand-200/50 blur-3xl" />
        <div className="relative">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-700">
            <Sparkles className="size-4" aria-hidden />
            {name} — your diagnosis
          </p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{failed ? "Almost there — one more try" : "Studying your business…"}</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-base">
            {failed
              ? "Your answers are saved. It usually works on the second try."
              : "This can take up to a minute. I'm doing the thinking properly, so what you get is specific to you — not generic advice."}
          </p>

          <ol className="mt-6 space-y-3" aria-live="polite">
            {steps.map((s, i) => {
              const done = !failed && i < active;
              const current = !failed && i === active;
              return (
                <li key={s} className={cn("flex items-start gap-3 transition-opacity duration-500", i > active && !failed ? "opacity-40" : "opacity-100")}>
                  {done ? (
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden />
                  ) : current ? (
                    <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-brand-600" aria-hidden />
                  ) : (
                    <CircleDashed className="mt-0.5 size-5 shrink-0 text-slate-300" aria-hidden />
                  )}
                  <span className={cn("text-sm leading-snug sm:text-[15px]", current ? "font-semibold text-slate-900" : done ? "text-slate-700" : "text-slate-500")}>{s}</span>
                </li>
              );
            })}
          </ol>

          {failed ? (
            <Button className="mt-6 bg-brand-600 hover:bg-brand-700" onClick={onRetry}>
              <RotateCcw className="size-4" aria-hidden />
              Try again
            </Button>
          ) : null}
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* What fixing it is worth                                              */
/* ------------------------------------------------------------------ */

/** One line on Summary; the full working (and the two taps to see it in money) is on "Why I think this". */
export function StakeLine({ diagnosis, facts, cur, readOnly, onOpen }: { diagnosis: DiagnosisContent; facts: BusinessFacts; cur: string; readOnly?: boolean; onOpen: () => void }) {
  const stake = diagnosis.stake;
  const ask = !readOnly && canAskForMoney(diagnosis, facts);
  if (!stake && !ask) return null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full flex-col gap-2 rounded-2xl bg-brand-700 px-4 py-3.5 text-left text-white shadow-sm transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 sm:flex-row sm:items-center sm:gap-3 sm:px-5"
    >
      <span className="flex min-w-0 flex-1 items-start gap-3">
        <TrendingUp className="mt-0.5 size-5 shrink-0 text-brand-200" aria-hidden />
        <span className="min-w-0">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-brand-200">What fixing it is worth</span>
          {stake ? (
            <span className="mt-0.5 block text-sm leading-snug">
              <span className="text-base font-bold tnum">{stake.figure}</span> <span className="text-brand-50">{stake.label}</span>
            </span>
          ) : (
            <span className="mt-0.5 block text-sm leading-snug text-brand-50">See it in {cur} — two quick taps</span>
          )}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1 pl-8 text-xs font-semibold text-brand-100 group-hover:text-white sm:pl-0">
        {stake ? "How I worked it out" : "Work it out"}
        <ArrowRight className="size-3.5" aria-hidden />
      </span>
    </button>
  );
}

export function StakeCard({
  diagnosis,
  facts,
  cur,
  onAddNumbers,
  readOnly,
}: {
  diagnosis: DiagnosisContent;
  facts: BusinessFacts;
  cur: string;
  onAddNumbers: (patch: Partial<BusinessFacts>) => void;
  /** Viewing a challenge that isn't the focus: show the figure, don't ask for numbers. */
  readOnly?: boolean;
}) {
  const stake = diagnosis.stake;
  const [showWorking, setShowWorking] = useState(false);
  const [jobValue, setJobValue] = useState<string>(facts.jobValue ?? "");
  const [monthly, setMonthly] = useState<string>(facts.monthlyEnquiries ?? "");
  const ask = !readOnly && canAskForMoney(diagnosis, facts);
  const jobOptions = cur === "₦" ? JOB_VALUE_OPTIONS_NGN : ["Under 100", "100 – 500", "500 – 2,000", "Over 2,000"].map((o) => o.replace(/(\d)/, `${cur}$1`));

  if (!stake && !ask) return null;

  return (
    <section aria-label="What fixing it is worth" className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-700 to-brand-800 p-6 text-white shadow-lg shadow-brand-200 sm:p-8">
      <div aria-hidden className="pointer-events-none absolute -bottom-16 -right-10 size-56 rounded-full bg-white/10 blur-2xl" />
      <div className="relative">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-200">
          <TrendingUp className="size-4" aria-hidden />
          What fixing it is worth
        </h2>
        {stake ? (
          <>
            <p className="mt-3 text-4xl font-bold tracking-tight tnum sm:text-5xl">{stake.figure}</p>
            <p className="mt-1 text-base font-medium text-brand-100 sm:text-lg">{stake.label}</p>
            {stake.detail ? <p className="mt-3 max-w-xl text-sm leading-relaxed text-brand-100/90">{stake.detail}</p> : null}
            <button
              type="button"
              onClick={() => setShowWorking((v) => !v)}
              aria-expanded={showWorking}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <Calculator className="size-3.5" aria-hidden />
              How I worked this out
              <ChevronDown className={cn("size-3.5 transition-transform", showWorking ? "rotate-180" : "")} aria-hidden />
            </button>
            {showWorking ? (
              <ol className="mt-3 space-y-1.5 rounded-2xl bg-white/10 p-4 text-sm leading-relaxed text-brand-50 animate-in fade-in-0 slide-in-from-top-1">
                {stake.working.map((w, i) => (
                  <li key={w} className="flex gap-2">
                    <span className="font-semibold text-brand-200 tnum">{i + 1}.</span>
                    <span>{w}</span>
                  </li>
                ))}
                <li className="pt-1 text-xs text-brand-200">Worked out only from your own estimates — nothing is invented. Rough answers give a rough figure.</li>
              </ol>
            ) : null}
          </>
        ) : null}

        {ask ? (
          <div className={cn("rounded-2xl bg-white/10 p-4", stake ? "mt-5" : "mt-3")}>
            <p className="text-sm font-semibold">See it in {cur} — two quick taps</p>
            <p className="mt-0.5 text-xs text-brand-100/90">A rough range is fine. I only use it for this sum.</p>
            <div className="mt-3 space-y-3">
              <fieldset>
                <legend className="text-[11px] font-semibold uppercase tracking-wide text-brand-200">A typical job or order</legend>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {jobOptions.map((o) => (
                    <button
                      key={o}
                      type="button"
                      aria-pressed={jobValue === o}
                      onClick={() => setJobValue(o)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        jobValue === o ? "border-white bg-white text-brand-800" : "border-white/30 text-white hover:border-white/60",
                      )}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-[11px] font-semibold uppercase tracking-wide text-brand-200">People asking each month</legend>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {MONTHLY_OPTIONS.map((o) => (
                    <button
                      key={o}
                      type="button"
                      aria-pressed={monthly === o}
                      onClick={() => setMonthly(o)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        monthly === o ? "border-white bg-white text-brand-800" : "border-white/30 text-white hover:border-white/60",
                      )}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </fieldset>
              <Button
                size="sm"
                disabled={!jobValue}
                onClick={() => onAddNumbers({ jobValue, ...(monthly ? { monthlyEnquiries: monthly } : {}) })}
                className="bg-white text-brand-800 hover:bg-brand-50"
              >
                Work it out
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Ready-to-use help                                                    */
/* ------------------------------------------------------------------ */

const TOOL_META: Record<DiagnosisTool["kind"], { icon: React.ElementType; tag: string; show: string; draft: DraftKind }> = {
  message: { icon: MessageCircle, tag: "Message to send", show: "Show the message", draft: "whatsapp" },
  script: { icon: MessagesSquare, tag: "What to say", show: "Show what to say", draft: "call-script" },
  offer: { icon: Tags, tag: "Offer to use", show: "Show the options", draft: "price-list" },
};

/** Stable key for one piece of help, used to remember that it was opened. */
export const toolKey = (tool: DiagnosisTool) => `${tool.kind}:${tool.title}`;

/** Help written for them — the words appear when they ask, so the page stays calm. */
export function ToolCard({ tool, featured, opened, onOpen }: { tool: DiagnosisTool; featured?: boolean; opened?: boolean; onOpen?: () => void }) {
  const meta = TOOL_META[tool.kind];
  const Icon = meta.icon;
  const hint: DraftHint = { kind: meta.draft, label: meta.show, purpose: `${tool.title}${tool.when ? ` — ${tool.when}` : ""}` };
  return (
    <article
      className={cn(
        "rounded-2xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5",
        featured && !opened ? "border-brand-300 ring-1 ring-brand-100" : "border-slate-200",
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", featured ? "bg-brand-600 text-white" : "bg-brand-100 text-brand-700")}>
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-600">{meta.tag}</p>
            {opened ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                <CheckCircle2 className="size-3" aria-hidden /> Opened
              </span>
            ) : null}
          </div>
          <h3 className="mt-0.5 text-[15px] font-semibold leading-snug text-slate-900">{tool.title}</h3>
          {tool.when ? <p className="mt-0.5 text-xs text-slate-500">{tool.when}</p> : null}
        </div>
      </div>
      {/* The draft button has no "opened" signal of its own: a tap anywhere on it counts. */}
      <div className="mt-3 flex" onClickCapture={onOpen}>
        <DraftButton hint={hint} initial={{ title: tool.title, body: tool.body }} main={featured} />
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* The week's checklist                                                 */
/* ------------------------------------------------------------------ */

export function PlanChecklist({
  steps,
  done,
  onToggle,
  title = "Your plan this week",
  intro = "",
}: {
  steps: string[];
  done: Record<number, boolean>;
  onToggle: (index: number) => void;
  title?: string;
  intro?: string;
}) {
  const count = steps.filter((_, i) => done[i]).length;
  return (
    <section aria-label={title} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <ListChecks className="size-5 text-brand-600" aria-hidden />
          {title}
        </h2>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 tnum">
          {count} of {steps.length} done
        </span>
      </div>
      {intro ? (
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          <span className="font-semibold text-slate-800">Start here: </span>
          {intro}
        </p>
      ) : null}
      <ul className="mt-4 space-y-2">
        {steps.map((step, i) => (
          <li key={step}>
            <button
              type="button"
              onClick={() => onToggle(i)}
              aria-pressed={Boolean(done[i])}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left text-sm transition-colors",
                done[i] ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 hover:border-brand-300 hover:bg-brand-50/40",
              )}
            >
              {done[i] ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden /> : <Circle className="mt-0.5 size-5 shrink-0 text-slate-300" aria-hidden />}
              <span className={cn("leading-snug", done[i] ? "text-slate-400 line-through" : "text-slate-800")}>{step}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Where in the journey                                                 */
/* ------------------------------------------------------------------ */

export function JourneyFocus({ stage }: { stage: FocusStage }) {
  const activeIndex = FOCUS_STAGES.findIndex((s) => s.id === stage);
  return (
    <section aria-label="Where growth is getting stuck">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <Target className="size-4 text-brand-600" aria-hidden />
        Where growth is most likely getting stuck
      </h2>
      <ol className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-5">
        {FOCUS_STAGES.map((s, i) => {
          const active = i === activeIndex;
          return (
            <li
              key={s.id}
              aria-current={active ? "step" : undefined}
              className={cn(
                "relative flex items-center gap-3 rounded-xl border px-3 py-2.5 sm:flex-col sm:items-start sm:gap-1",
                active ? "border-brand-500 bg-brand-600 text-white shadow-md shadow-brand-200" : "border-slate-200 bg-white text-slate-500",
              )}
            >
              <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", active ? "bg-white text-brand-700" : "bg-slate-100 text-slate-500")}>
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className={cn("text-sm font-semibold leading-tight", active ? "text-white" : "text-slate-700")}>{s.label}</p>
                <p className={cn("text-[11px] leading-snug", active ? "text-brand-100" : "text-slate-400")}>{active ? "Focus here first" : s.hint}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * An owner in money trouble: what is due against what they have, and whether
 * money in covers the running costs — worked out in code from their own
 * figures, every line showing what it came from.
 */
export function MoneyCard({ lines }: { lines: string[] }) {
  if (!lines.length) return null;
  return (
    <section aria-label="Your money, worked out" className="rounded-3xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm sm:p-6">
      <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
        <Wallet className="size-5 text-amber-700" aria-hidden />
        Your money, worked out from your figures
      </h2>
      <ul className="mt-3 space-y-2">
        {lines.map((l) => (
          <li key={l} className="flex gap-2 text-sm leading-relaxed text-slate-800">
            <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-amber-600" />
            <span>{l}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-slate-500">Only from what you told me — nothing is invented. If a figure is off, correct it and I'll work it out again.</p>
    </section>
  );
}

/** For a challenge outside what the app can measure (cash, staff, costs…): said plainly. */
export function OutsideNote({ title }: { title: string }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
      <ShieldAlert className="mt-0.5 size-5 shrink-0 text-slate-500" aria-hidden />
      <p className="text-sm leading-relaxed text-slate-700">
        <span className="font-semibold text-slate-900">An honest note: </span>
        {outsideNote(title)}
      </p>
    </div>
  );
}
