"use client";
// Screen 17 — First Diagnosis: the payoff for the checkup, and the moment a
// new owner decides whether bizzGrowth is worth paying for. It has to:
//   1. Name the real problem in their terms, with an insight they had not
//      connected themselves (not their complaint repeated back).
//   2. Show what fixing it is WORTH — computed from their own estimates, with
//      the working one tap away (nothing invented).
//   3. Hand them help they can use in the next five minutes: a message to send
//      (copy or open in WhatsApp), what to say, an offer to use.
//   4. Give them a plan to tick off and a reason to come back.
// The wait is part of the experience: an analysis view walks through their
// own answers while the diagnosis is written.

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Calculator,
  CheckCircle2,
  ChevronDown,
  Circle,
  CircleDashed,
  ClipboardCheck,
  Copy,
  Eye,
  Gauge,
  Lightbulb,
  ListChecks,
  Loader2,
  MessageCircle,
  MessagesSquare,
  Pencil,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Tags,
  Target,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InfoBanner } from "@/components/shared/layout";
import { useBizz } from "@/lib/store";
import { restoreFinishedCheckup } from "@/lib/checkup-restore";
import {
  DIAGNOSIS_VERSION,
  FOCUS_STAGES,
  type BusinessFacts,
  type DiagnosisContent,
  type DiagnosisTool,
  type FocusStage,
} from "@/lib/checkup";
import { computeStake, currencySymbol, shorten, tidyOwnerText } from "@/lib/checkup-math";
import { attachDiagnosisToChat } from "@/lib/chat-log";
import { loadPlanProgress, planIdFor, savePlanProgress } from "@/lib/plan-progress";
import { cn } from "@/lib/utils";
import type { ScreenProps } from "../view-types";

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function confidenceWord(c: number) {
  if (c >= 65) return "Solid first read";
  if (c >= 52) return "Good first read";
  return "Early first read";
}

function listToSentence(items: string[]) {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

/** The owner's answers worth showing back, in their own (cleaned) words. */
function toldUs(facts: BusinessFacts): { label: string; value: string }[] {
  const rows: [string, string | undefined][] = [
    ["What you sell", facts.whatTheySell],
    ["Who pays you", facts.customers],
    ["How people find you", facts.channels.length ? facts.channels.join(", ") : undefined],
    ["What feels hardest", facts.bottleneck],
    ["What you think is causing it", facts.ownerTheory],
    ["How many go on to pay", facts.closeRate],
    ["People asking each month", facts.monthlyEnquiries],
    ["A typical job", facts.jobValue],
    ["Getting back to people", facts.followUp],
    ["How you give your price", facts.pricePresentation],
    ["When people don't buy", facts.lostReason],
    ["Past work people see", facts.proof],
    ["Room for more work", facts.capacity],
    ["Customers coming back", facts.repeat],
  ];
  return rows
    .filter((r): r is [string, string] => typeof r[1] === "string" && r[1].trim().length > 0 && !/^described during/i.test(r[1]))
    .map(([label, value]) => ({ label, value: tidyOwnerText(value) }));
}

const JOB_VALUE_OPTIONS_NGN = ["Under ₦50,000", "₦50,000 – ₦200,000", "₦200,000 – ₦1 million", "Over ₦1 million"];
const MONTHLY_OPTIONS = ["1 to 5 a month", "6 to 15 a month", "16 to 40 a month", "More than 40"];

/* ------------------------------------------------------------------ */
/* While it is written: an analysis that walks through their answers    */
/* ------------------------------------------------------------------ */

function AnalysisProgress({ facts, failed, onRetry, name }: { facts: BusinessFacts; failed: boolean; onRetry: () => void; name: string }) {
  const steps = useMemo(
    () => [
      "Reading everything you told us",
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
        className="relative overflow-hidden rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-6 shadow-sm sm:p-10"
      >
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-violet-200/50 blur-3xl" />
        <div className="relative">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-violet-700">
            <Sparkles className="size-4" aria-hidden />
            {name} — your diagnosis
          </p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {failed ? "Almost there — one more try" : "Studying your business…"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-base">
            {failed
              ? "Your answers are saved. It usually works on the second try."
              : "This can take up to a minute. We're doing the thinking properly, so what you get is specific to you — not generic advice."}
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
                    <Loader2 className="mt-0.5 size-5 shrink-0 animate-spin text-violet-600" aria-hidden />
                  ) : (
                    <CircleDashed className="mt-0.5 size-5 shrink-0 text-slate-300" aria-hidden />
                  )}
                  <span className={cn("text-sm leading-snug sm:text-[15px]", current ? "font-semibold text-slate-900" : done ? "text-slate-700" : "text-slate-500")}>{s}</span>
                </li>
              );
            })}
          </ol>

          {failed ? (
            <Button className="mt-6 bg-violet-600 hover:bg-violet-700" onClick={onRetry}>
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
/* Pieces                                                               */
/* ------------------------------------------------------------------ */

function StakeCard({ diagnosis, facts, cur, onAddNumbers }: { diagnosis: DiagnosisContent; facts: BusinessFacts; cur: string; onAddNumbers: (patch: Partial<BusinessFacts>) => void }) {
  const stake = diagnosis.stake;
  const [showWorking, setShowWorking] = useState(false);
  const [jobValue, setJobValue] = useState<string>(facts.jobValue ?? "");
  const [monthly, setMonthly] = useState<string>(facts.monthlyEnquiries ?? "");
  const canAskForMoney = Boolean(facts.closeRate) && !stake?.isMoney;
  const jobOptions = cur === "₦" ? JOB_VALUE_OPTIONS_NGN : ["Under 100", "100 – 500", "500 – 2,000", "Over 2,000"].map((o) => o.replace(/(\d)/, `${cur}$1`));

  if (!stake && !canAskForMoney) return null;

  return (
    <section aria-label="What fixing it is worth" className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-700 via-violet-700 to-indigo-800 p-6 text-white shadow-lg shadow-violet-200 sm:p-8">
      <div aria-hidden className="pointer-events-none absolute -bottom-16 -right-10 size-56 rounded-full bg-white/10 blur-2xl" />
      <div className="relative">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-violet-200">
          <TrendingUp className="size-4" aria-hidden />
          What fixing this is worth
        </p>
        {stake ? (
          <>
            <p className="mt-3 text-4xl font-bold tracking-tight tnum sm:text-5xl">{stake.figure}</p>
            <p className="mt-1 text-base font-medium text-violet-100 sm:text-lg">{stake.label}</p>
            {stake.detail ? <p className="mt-3 max-w-xl text-sm leading-relaxed text-violet-100/90">{stake.detail}</p> : null}
            <button
              type="button"
              onClick={() => setShowWorking((v) => !v)}
              aria-expanded={showWorking}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              <Calculator className="size-3.5" aria-hidden />
              How we worked this out
              <ChevronDown className={cn("size-3.5 transition-transform", showWorking ? "rotate-180" : "")} aria-hidden />
            </button>
            {showWorking ? (
              <ol className="mt-3 space-y-1.5 rounded-2xl bg-white/10 p-4 text-sm leading-relaxed text-violet-50 animate-in fade-in-0 slide-in-from-top-1">
                {stake.working.map((w, i) => (
                  <li key={w} className="flex gap-2">
                    <span className="font-semibold text-violet-200 tnum">{i + 1}.</span>
                    <span>{w}</span>
                  </li>
                ))}
                <li className="pt-1 text-xs text-violet-200">Worked out only from your own estimates — nothing is invented. Rough answers give a rough figure.</li>
              </ol>
            ) : null}
          </>
        ) : null}

        {canAskForMoney ? (
          <div className={cn("rounded-2xl bg-white/10 p-4", stake ? "mt-5" : "mt-3")}>
            <p className="text-sm font-semibold">See it in {cur} — two quick taps</p>
            <p className="mt-0.5 text-xs text-violet-100/90">A rough range is fine. We only use it for this sum.</p>
            <div className="mt-3 space-y-3">
              <fieldset>
                <legend className="text-[11px] font-semibold uppercase tracking-wide text-violet-200">A typical job</legend>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {jobOptions.map((o) => (
                    <button
                      key={o}
                      type="button"
                      aria-pressed={jobValue === o}
                      onClick={() => setJobValue(o)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        jobValue === o ? "border-white bg-white text-violet-800" : "border-white/30 text-white hover:border-white/60",
                      )}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-[11px] font-semibold uppercase tracking-wide text-violet-200">People asking each month</legend>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {MONTHLY_OPTIONS.map((o) => (
                    <button
                      key={o}
                      type="button"
                      aria-pressed={monthly === o}
                      onClick={() => setMonthly(o)}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                        monthly === o ? "border-white bg-white text-violet-800" : "border-white/30 text-white hover:border-white/60",
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
                className="bg-white text-violet-800 hover:bg-violet-50"
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

const TOOL_META: Record<DiagnosisTool["kind"], { icon: React.ElementType; tag: string }> = {
  message: { icon: MessageCircle, tag: "Message to send" },
  script: { icon: MessagesSquare, tag: "What to say" },
  offer: { icon: Tags, tag: "Offer to use" },
};

function ToolCard({ tool, featured }: { tool: DiagnosisTool; featured?: boolean }) {
  const [copied, setCopied] = useState(false);
  const meta = TOOL_META[tool.kind];
  const Icon = meta.icon;
  return (
    <article
      className={cn(
        "flex flex-col rounded-2xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md",
        featured ? "border-violet-300 ring-1 ring-violet-100" : "border-slate-200",
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn("flex size-8 items-center justify-center rounded-lg", featured ? "bg-violet-600 text-white" : "bg-violet-100 text-violet-700")}>
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-violet-600">{meta.tag}</span>
      </div>
      <h3 className="mt-3 text-[15px] font-semibold leading-snug text-slate-900">{tool.title}</h3>
      {tool.when ? <p className="mt-1 text-xs text-slate-500">{tool.when}</p> : null}
      <blockquote className="mt-3 flex-1 whitespace-pre-line rounded-xl border-l-4 border-violet-300 bg-violet-50/60 px-4 py-3 text-sm leading-relaxed text-slate-800">
        {tool.body}
      </blockquote>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={featured ? "default" : "outline"}
          className={featured ? "bg-violet-600 hover:bg-violet-700" : ""}
          onClick={async () => {
            if (await copyText(tool.body)) {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2000);
            }
          }}
        >
          {copied ? <ClipboardCheck className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </Button>
        {tool.kind !== "offer" ? (
          <Button size="sm" variant="outline" asChild>
            <a href={`https://wa.me/?text=${encodeURIComponent(tool.body)}`} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="size-4 text-emerald-600" aria-hidden />
              Open in WhatsApp
            </a>
          </Button>
        ) : null}
      </div>
    </article>
  );
}

function PlanChecklist({ id, intro, steps }: { id: string; intro: string; steps: string[] }) {
  const [done, setDone] = useState<Record<number, boolean>>({});
  useEffect(() => {
    setDone(loadPlanProgress(id));
  }, [id]);
  const toggle = (i: number) =>
    setDone((d) => {
      const next = { ...d, [i]: !d[i] };
      savePlanProgress(id, next);
      return next;
    });
  const count = steps.filter((_, i) => done[i]).length;

  return (
    <section aria-label="Your plan this week" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <ListChecks className="size-5 text-violet-600" aria-hidden />
          Your plan this week
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
              onClick={() => toggle(i)}
              aria-pressed={Boolean(done[i])}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left text-sm transition-colors",
                done[i] ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 hover:border-violet-300 hover:bg-violet-50/40",
              )}
            >
              {done[i] ? (
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden />
              ) : (
                <Circle className="mt-0.5 size-5 shrink-0 text-slate-300" aria-hidden />
              )}
              <span className={cn("leading-snug", done[i] ? "text-slate-400 line-through" : "text-slate-800")}>{step}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function JourneyFocus({ stage }: { stage: FocusStage }) {
  const activeIndex = FOCUS_STAGES.findIndex((s) => s.id === stage);
  return (
    <section aria-label="Where growth is getting stuck">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <Target className="size-4 text-violet-600" aria-hidden />
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
                active ? "border-violet-500 bg-violet-600 text-white shadow-md shadow-violet-200" : "border-slate-200 bg-white text-slate-500",
              )}
            >
              <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", active ? "bg-white text-violet-700" : "bg-slate-100 text-slate-500")}>
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className={cn("text-sm font-semibold leading-tight", active ? "text-white" : "text-slate-700")}>{s.label}</p>
                <p className={cn("text-[11px] leading-snug", active ? "text-violet-100" : "text-slate-400")}>{active ? "Focus here first" : s.hint}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Screen                                                               */
/* ------------------------------------------------------------------ */

export default function FirstDiagnosis(_props: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);
  const facts = useBizz((s) => s.checkup.facts);
  const transcript = useBizz((s) => s.checkup.transcript);
  const storedDiagnosis = useBizz((s) => s.checkup.diagnosis);
  const improved = useBizz((s) => s.checkup.improved);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const setCheckupDiagnosis = useBizz((s) => s.setCheckupDiagnosis);
  const patchCheckupFacts = useBizz((s) => s.patchCheckupFacts);

  const [generating, setGenerating] = useState(false);
  const [generateFailed, setGenerateFailed] = useState(false);
  const requested = useRef(false);
  const cur = currencySymbol(userWorkspace?.currency);
  const name = userWorkspace?.name ?? "Your business";

  const generate = React.useCallback(() => {
    if (!facts) return;
    setGenerating(true);
    setGenerateFailed(false);
    const started = Date.now();
    void (async () => {
      try {
        const res = await fetch("/api/checkup/diagnosis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspaceName: userWorkspace?.name ?? "Your business",
            country: userWorkspace?.country ?? "Nigeria",
            currency: userWorkspace?.currency ?? "₦",
            facts,
            transcript,
          }),
        });
        const data = (await res.json()) as { ok?: boolean; diagnosis?: DiagnosisContent };
        // Let the analysis view breathe for a moment — a flash reads as canned.
        const wait = Math.max(0, 3500 - (Date.now() - started));
        if (wait) await new Promise((r) => window.setTimeout(r, wait));
        if (data?.ok && data.diagnosis) {
          setCheckupDiagnosis(data.diagnosis);
          attachDiagnosisToChat({ workspaceName: userWorkspace?.name, country: userWorkspace?.country, diagnosis: data.diagnosis });
        } else setGenerateFailed(true);
      } catch {
        setGenerateFailed(true);
      } finally {
        setGenerating(false);
      }
    })();
  }, [facts, transcript, userWorkspace, setCheckupDiagnosis]);

  // Generate once when none exists — or when a stored one predates the current
  // format, so older checkups get the full diagnosis too.
  const outdated = Boolean(storedDiagnosis && storedDiagnosis.version !== DIAGNOSIS_VERSION);
  useEffect(() => {
    if (!facts || (storedDiagnosis && !outdated) || improved || requested.current) return;
    requested.current = true;
    generate();
  }, [facts, storedDiagnosis, outdated, improved, generate]);

  const told = useMemo(() => (facts ? toldUs(facts) : []), [facts]);

  // No facts in this browser: look for a checkup finished earlier (saved chat)
  // before deciding there is none.
  const [lookingUp, setLookingUp] = useState(!facts);
  useEffect(() => {
    if (facts) return;
    let live = true;
    void restoreFinishedCheckup().finally(() => {
      if (live) setLookingUp(false);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- No checkup yet ---------- */
  if (!facts && lookingUp) {
    return (
      <div className="mx-auto flex w-full max-w-2xl items-center justify-center gap-2 py-16 text-sm text-muted-foreground" role="status">
        <span className="size-2 animate-pulse rounded-full bg-violet-600" aria-hidden />
        Finding your checkup…
      </div>
    );
  }
  if (!facts) {
    return (
      <div className="mx-auto w-full max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">Your first diagnosis</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Let&apos;s get to know your business first</h1>
        <p className="mt-3 text-sm text-muted-foreground">Your diagnosis is written from your own answers. A short, friendly checkup is all it takes.</p>
        <Button className="mt-6 bg-violet-600 hover:bg-violet-700" onClick={() => navigate("onboarding-chat")}>
          Start the checkup
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
    );
  }

  /* ---------- Writing / failed ---------- */
  if (!improved && (!storedDiagnosis || (outdated && (generating || generateFailed || !requested.current)))) {
    return <AnalysisProgress facts={facts} failed={generateFailed && !generating} onRetry={generate} name={name} />;
  }

  /* ---------- The diagnosis ---------- */
  const base = storedDiagnosis as DiagnosisContent | null;
  const diagnosis: DiagnosisContent = improved
    ? {
        headline: improved.headline,
        story: improved.story,
        deltas: [],
        meaning: improved.meaning,
        whyItMatters: improved.whyItMatters,
        nextInvestigation: improved.nextInvestigation,
        confidence: improved.confidence,
        focusStage: "convert",
        steps: base?.steps,
        insight: base?.insight,
        working: base?.working,
        stake: base?.stake,
        tools: base?.tools,
        version: DIAGNOSIS_VERSION,
      }
    : (base as DiagnosisContent);

  const stage: FocusStage = diagnosis.focusStage ?? "convert";
  const tools = diagnosis.tools ?? [];
  const planId = planIdFor(name, diagnosis.headline);

  function addNumbers(patch: Partial<BusinessFacts>) {
    if (!facts || !base) return;
    const next = { ...facts, ...patch };
    const stake = computeStake(next, cur, base.focusStage ?? stage);
    patchCheckupFacts(patch, { ...base, stake });
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 pb-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-700">
      {improved ? (
        <InfoBanner tone="success" title={`Sharpened with your numbers — confidence now ${improved.confidence}%`}>
          {improved.bestChannel !== improved.worstChannel
            ? `${improved.worstChannel} turns ${improved.channelRows.find((r) => r.name === improved.worstChannel)?.conversion.toFixed(1) ?? "—"}% of enquiries into customers, compared with ${
                improved.channelRows.find((r) => r.name === improved.bestChannel)?.conversion.toFixed(1) ?? "—"
              }% for ${improved.bestChannel}.`
            : "Your channel numbers are now part of this diagnosis."}
        </InfoBanner>
      ) : null}

      {/* Hero: the real problem, the insight, what already works */}
      <section aria-label="Your diagnosis" className="relative overflow-hidden rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-6 shadow-sm sm:p-10">
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-violet-200/40 blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-violet-700">
              <Sparkles className="size-4" aria-hidden />
              {name} — your diagnosis
            </p>
            <div className="flex items-center gap-2 rounded-full border border-violet-200 bg-white/80 px-3 py-1" title="Based on what you told us. Adding real numbers raises this.">
              <Gauge className="size-3.5 text-violet-600" aria-hidden />
              <span className="text-xs font-medium text-violet-800">{confidenceWord(diagnosis.confidence)}</span>
              <span className="h-1.5 w-14 overflow-hidden rounded-full bg-violet-100" aria-hidden>
                <span className="block h-full rounded-full bg-violet-600" style={{ width: `${diagnosis.confidence}%` }} />
              </span>
            </div>
          </div>
          <h1 className="mt-4 text-[1.7rem] font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl">{diagnosis.headline}</h1>

          {diagnosis.insight ? (
            <div className="mt-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
              <Lightbulb className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">What we noticed</p>
                <p className="mt-1 text-[15px] leading-relaxed text-slate-800">{diagnosis.insight}</p>
              </div>
            </div>
          ) : (
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-700 sm:text-lg">{diagnosis.story}</p>
          )}

          {diagnosis.working ? (
            <p className="mt-4 flex items-start gap-2 text-sm text-emerald-800">
              <BadgeCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
              <span>
                <span className="font-semibold">Already working: </span>
                {diagnosis.working}
              </span>
            </p>
          ) : null}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-xs font-medium text-emerald-800"
              title="Every amount, percentage and count on this page was checked against your own answers before it was shown."
            >
              <ShieldCheck className="size-3.5" aria-hidden />
              Every figure checked against your answers
            </span>
            <span className="text-xs text-muted-foreground">
              {improved ? "Built from your checkup answers and the numbers you entered." : "Built only from what you told us — nothing invented or sampled."}
            </span>
          </div>
        </div>
      </section>

      <StakeCard diagnosis={diagnosis} facts={facts} cur={cur} onAddNumbers={addNumbers} />

      {/* Help they can use in the next five minutes */}
      {tools.length > 0 ? (
        <section aria-label="Do this today">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Sparkles className="size-5 text-violet-600" aria-hidden />
            Do this today
          </h2>
          <p className="mt-1 text-sm text-slate-600">Written for your business. Copy it, tweak a word or two, and send.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {tools.map((t, i) => (
              <div key={`${t.kind}-${t.title}`} className={i === 0 ? "md:col-span-2" : ""}>
                <ToolCard tool={t} featured={i === 0} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <PlanChecklist id={planId} intro={diagnosis.nextInvestigation} steps={diagnosis.steps ?? []} />

      <JourneyFocus stage={stage} />

      {/* The reasoning */}
      <section aria-label="Why we think this" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
          <Eye className="size-5 text-violet-600" aria-hidden />
          Why we think this
        </h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">What you told us</p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{diagnosis.story}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">What&apos;s probably happening</p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{diagnosis.meaning}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Why it&apos;s worth fixing</p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{diagnosis.whyItMatters}</p>
          </div>
        </div>
      </section>

      {/* Their answers, with an easy way to correct them */}
      {told.length > 0 ? (
        <section aria-label="What you told us">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Your answers we used</h2>
            <Button variant="ghost" size="sm" className="text-violet-700 hover:text-violet-800" onClick={() => navigate("business-understanding")}>
              <Pencil className="size-3.5" aria-hidden />
              Something not right? Fix it
            </Button>
          </div>
          <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {told.map((r) => (
              <div key={r.label} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{r.label}</dt>
                <dd className="mt-0.5 text-sm leading-snug text-slate-800">{r.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {improved ? (
        <section aria-label="Your numbers">
          <h2 className="text-sm font-semibold">Your numbers by channel</h2>
          <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {improved.channelRows.slice(0, 3).map((r) => (
              <div key={r.name} className="rounded-xl border border-slate-200 bg-white p-3.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{r.name}</p>
                <p className="mt-1 text-2xl font-semibold tnum">{r.conversion.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">
                  {r.customers} of {r.enquiries} enquiries became customers
                </p>
                {r.name === improved.worstChannel ? (
                  <Badge variant="outline" className="mt-2 border-red-200 bg-red-50 font-normal text-red-700">
                    Biggest gap
                  </Badge>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* A reason to come back */}
      <section aria-label="Keep it going" className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 text-base font-semibold text-emerald-900">
          <TrendingUp className="size-5 text-emerald-600" aria-hidden />
          See it working in two weeks
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-emerald-950/80">
          Try the plan, then note your next few enquiries — who asked, and whether they paid. bizzGrowth turns that into a sharper diagnosis and shows you exactly
          what changed.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <Button onClick={() => navigate("setup-complete")} className="w-full bg-violet-600 hover:bg-violet-700 sm:w-auto">
            Continue to my workspace
            <ArrowRight className="size-4" aria-hidden />
          </Button>
          {!improved ? (
            <Button variant="outline" className="w-full border-emerald-300 bg-white sm:w-auto" onClick={() => navigate("improve-diagnosis")}>
              Add my enquiry numbers
            </Button>
          ) : null}
          <Button variant="ghost" className="w-full text-slate-600 sm:ml-auto sm:w-auto" onClick={() => navigate("first-diagnosis-evidence")}>
            See the evidence
          </Button>
        </div>
      </section>
    </div>
  );
}
