"use client";
// Home for a USER-CREATED workspace — the owner's own command centre.
//
// Trust rules baked in:
//  1. Every number shown comes from the owner (checkup answers or manual
//     entries) and is labelled as such. Sample figures NEVER appear here.
//  2. Where no data exists we say so plainly and offer honest paths to add it:
//     enter estimates, upload a file, or connect a third-party source.
//  3. The first diagnosis is the owner's own AI diagnosis from the checkup.

import React from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Calculator,
  CircleDashed,
  Database,
  Eye,
  FileSpreadsheet,
  Lightbulb,
  ListChecks,
  Minus,
  PenLine,
  Plug,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ProvenanceBadge } from "@/components/shared/badges";
import { SectionCard } from "@/components/shared/layout";
import { useActiveCoachStep, useBizz, useFocusChallenge, useLatestCoachStep, useOwnChallenges } from "@/lib/store";
import { ActiveStepCard, NextStepCard, VerdictPill } from "@/components/shared/coach";
import { ChallengesStrip, SolvedSuggestion, StuckNotice, WorkOnThisButton } from "@/components/shared/challenges";
import { templateNextStep } from "@/lib/coach";
import { fmtDelta, fmtNum, fmtNaira } from "@/lib/format";
import { ownerMonthsFromEntries, type OwnerMonth } from "@/lib/data/user-business";
import { improveHelps, type BusinessFacts, type DiagnosisContent, type ImprovedDiagnosis, type TranscriptTurn, type TrendDirection } from "@/lib/checkup";
import type { ManualEntry } from "@/lib/types";
import { tidyOwnerText } from "@/lib/checkup-math";
import { loadPlanProgress, planIdFor } from "@/lib/plan-progress";
import type { ScreenProps } from "../view-types";

/* ---------- small pieces ---------- */

const TREND_STYLE: Record<TrendDirection, { word: string; icon: React.ReactNode; cls: string }> = {
  Increased: { word: "Increasing", icon: <ArrowUpRight className="size-4" aria-hidden />, cls: "text-emerald-700" },
  Decreased: { word: "Decreasing", icon: <ArrowDownRight className="size-4" aria-hidden />, cls: "text-red-700" },
  "About the same": { word: "About the same", icon: <Minus className="size-4" aria-hidden />, cls: "text-slate-600" },
  "Don't know": { word: "Not reported", icon: <CircleDashed className="size-4" aria-hidden />, cls: "text-slate-400" },
};

function TrendWord({ trend }: { trend: TrendDirection }) {
  const s = TREND_STYLE[trend];
  return (
    <span className={`inline-flex items-center gap-1 text-sm font-semibold ${s.cls}`}>
      {s.icon}
      {s.word}
    </span>
  );
}

function monthMoney(v?: number): string {
  return v === undefined ? "—" : fmtNaira(v, { compact: true });
}

/** Compare the two most recent owner-entered months for one metric. */
function ownerDelta(months: OwnerMonth[], pick: (m: OwnerMonth) => number | undefined): { text: string; cls: string } | null {
  if (months.length < 2) return null;
  const cur = pick(months[months.length - 1]);
  const prev = pick(months[months.length - 2]);
  if (cur === undefined || prev === undefined || prev === 0) return null;
  const d = Math.round(((cur - prev) / prev) * 100);
  if (d === 0) return { text: "Same as previous month", cls: "text-slate-600" };
  const up = d > 0;
  return {
    text: `${fmtDelta(d)} vs ${months[months.length - 2].label}`,
    cls: up ? "text-emerald-700" : "text-red-700",
  };
}

interface OwnerNumberCard {
  label: string;
  display: string;
  delta: { text: string; cls: string } | null;
}

function ownerNumberCards(month: OwnerMonth, months: OwnerMonth[]): OwnerNumberCard[] {
  const cards: OwnerNumberCard[] = [];
  if (month.revenue !== undefined)
    cards.push({ label: "Revenue", display: monthMoney(month.revenue), delta: ownerDelta(months, (m) => m.revenue) });
  if (month.enquiries !== undefined)
    cards.push({ label: "Enquiries", display: fmtNum(month.enquiries), delta: ownerDelta(months, (m) => m.enquiries) });
  if (month.customers !== undefined)
    cards.push({ label: "New customers", display: fmtNum(month.customers), delta: ownerDelta(months, (m) => m.customers) });
  if (month.orders !== undefined)
    cards.push({ label: "Orders", display: fmtNum(month.orders), delta: ownerDelta(months, (m) => m.orders) });
  if (month.traffic !== undefined)
    cards.push({ label: "Visitors", display: fmtNum(month.traffic), delta: ownerDelta(months, (m) => m.traffic) });
  if (month.spend !== undefined)
    cards.push({ label: "Marketing spend", display: monthMoney(month.spend), delta: ownerDelta(months, (m) => m.spend) });
  return cards;
}

/* ---------- data paths (estimates / upload / connect) ---------- */

const DATA_PATHS = [
  {
    id: "manual",
    icon: PenLine,
    title: "Type your totals",
    body: "Monthly spend, enquiries, customers and revenue — exact or estimated, takes two minutes.",
    cta: "Enter totals",
    route: "manual-entry",
  },
  {
    id: "csv",
    icon: FileSpreadsheet,
    title: "Upload a file",
    body: "Export from your spreadsheet or tool and upload it — we map the columns with you.",
    cta: "Upload CSV",
    route: "csv-upload",
  },
  {
    id: "connect",
    icon: Plug,
    title: "Connect a service",
    body: "Meta Ads, Google Ads, Shopify, Paystack and more — data flows in automatically, read-only.",
    cta: "See sources",
    route: "integrations",
  },
];

function DataPathsRow() {
  const navigate = useBizz((s) => s.navigate);
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {DATA_PATHS.map((p) => (
        <Card key={p.id} className="flex flex-col p-4">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
            <p.icon className="size-4" aria-hidden />
          </span>
          <p className="mt-2.5 text-sm font-semibold">{p.title}</p>
          <p className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground">{p.body}</p>
          <Button size="sm" variant="outline" className="mt-3 w-fit" onClick={() => navigate(p.route)}>
            {p.cta}
            <ArrowRight className="ml-1 size-3.5" aria-hidden />
          </Button>
        </Card>
      ))}
    </div>
  );
}

/* ---------- the screen ---------- */

export default function OwnerHome(_props: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);
  const user = useBizz((s) => s.user);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const facts = useBizz((s) => s.checkup.facts) as BusinessFacts | null;
  const diagnosis = useBizz((s) => s.checkup.diagnosis) as DiagnosisContent | null;
  const improved = useBizz((s) => s.checkup.improved) as ImprovedDiagnosis | null;
  const manualEntries = useBizz((s) => s.manualEntries) as ManualEntry[];
  const coachSteps = useBizz((s) => s.coach.steps);
  const activeStep = useActiveCoachStep();
  const latestStep = useLatestCoachStep();
  const focus = useFocusChallenge();
  const challenges = useOwnChallenges();
  // Nothing in focus (the last one was solved or stopped): the next one waits for the owner's go.
  const nextUp = !focus ? challenges.filter((c) => c.status === "up-next").sort((a, b) => a.order - b.order)[0] ?? null : null;
  const noFocus = challenges.length > 0 && !focus;

  const firstName = user.name.split(" ")[0];
  const businessName = userWorkspace?.name ?? "Your business";
  const hour = new Date().getHours();
  const partOfDay = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";

  const months = ownerMonthsFromEntries(manualEntries);
  const latest = months.length ? months[months.length - 1] : null;
  const numberCards = latest ? ownerNumberCards(latest, months) : [];
  const content: DiagnosisContent | null = diagnosis;

  // Plan progress (ticked on the diagnosis page) — read after mount, it lives in this browser.
  const planSteps = content?.steps ?? [];
  const [planDoneMap, setPlanDoneMap] = React.useState<Record<number, boolean>>({});
  React.useEffect(() => {
    if (content) setPlanDoneMap(loadPlanProgress(planIdFor(businessName, content.headline)));
  }, [content, businessName]);
  const planDone = planSteps.filter((_, i) => planDoneMap[i]).length;
  const nextStep = planSteps.find((_, i) => !planDoneMap[i]);

  // The coaching next step: the diagnosis's own, or the ready-made one for its stage.
  const tried = coachSteps.filter((x) => x.workspaceId === "user-workspace").map((x) => x.step.title);
  const coachNext = content && !noFocus ? content.nextStep ?? templateNextStep(content.focusStage ?? "convert", facts, tried) : null;
  const lastResult = !activeStep && latestStep?.status === "done" ? latestStep : null;

  // The answers that matter most, in the owner's own (tidied) words — only the ones they gave.
  const establishedRows = (
    [
      ["You sell", facts?.whatTheySell],
      ["You serve", facts?.customers],
      ["People find you through", facts?.channels?.length ? facts.channels.join(", ") : undefined],
      [challenges.length > 1 ? "Working on now" : "Where it feels stuck", noFocus ? undefined : facts?.bottleneck],
      ["How many go on to pay", facts?.closeRate],
      ["People asking each month", facts?.monthlyEnquiries],
      ["A typical job", facts?.jobValue],
    ] as [string, string | undefined][]
  )
    .filter((r): r is [string, string] => typeof r[1] === "string" && r[1].trim().length > 0 && !/^described during/i.test(r[1]))
    .map(([label, value]) => [label, tidyOwnerText(value)] as [string, string]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {/* Greeting + honest status */}
      <header>
        <h1 className="text-2xl font-bold tracking-tight" suppressHydrationWarning>
          Good {partOfDay}, {firstName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {businessName} · your private workspace
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline" className="gap-1 border-amber-200 bg-amber-50 font-normal text-amber-700">
            <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
            No data sources connected yet
          </Badge>
          <span>
            {months.length
              ? `${months.length} month${months.length > 1 ? "s" : ""} of your own entered totals`
              : "Everything below comes from your checkup — nothing is sampled or invented."}
          </span>
          <button onClick={() => navigate("data")} className="font-medium text-brand-700 hover:underline">
            Data centre
          </button>
        </div>
      </header>

      {/* The list of challenges at a glance — and a way to add another */}
      <ChallengesStrip />

      {/* The one being worked on: solved? stuck? — said plainly, the owner decides */}
      {focus ? <SolvedSuggestion challenge={focus} /> : null}
      {focus ? <StuckNotice challenge={focus} steps={coachSteps} /> : null}

      {/* Nothing in focus: suggest what's next, the owner says go */}
      {noFocus ? (
        <section aria-label="What's next" className="rounded-3xl border border-brand-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">What&apos;s next</p>
          {nextUp ? (
            <>
              <p className="mt-1.5 text-lg font-semibold leading-snug text-slate-900">“{nextUp.title}”</p>
              {nextUp.orderReason ? <p className="mt-1 text-sm text-slate-600">{nextUp.orderReason}</p> : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <WorkOnThisButton challenge={nextUp} />
                <Button variant="ghost" onClick={() => navigate("challenges")}>
                  See all challenges
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="mt-1.5 text-sm text-slate-700">Nothing is waiting on your list. Is anything else holding the business back?</p>
              <Button className="mt-3 bg-brand-600 hover:bg-brand-700" onClick={() => navigate("challenges/new")}>
                Report a new challenge
              </Button>
            </>
          )}
        </section>
      ) : null}

      {/* Just switched to a challenge that has no diagnosis yet */}
      {focus && !content && facts ? (
        <section aria-label="Working on now" className="rounded-3xl border border-brand-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">Working on now</p>
          <p className="mt-1.5 text-lg font-semibold leading-snug text-slate-900">“{focus.title}”</p>
          <p className="mt-1 text-sm text-slate-600">
            {focus.chatDone ? "Its diagnosis and first step are on its page." : "A few quick questions about it first — then its own diagnosis and first step."}
          </p>
          <Button className="mt-3 bg-brand-600 hover:bg-brand-700" onClick={() => navigate(focus.chatDone ? `challenges/${focus.id}` : `challenges/${focus.id}/chat`)}>
            {focus.chatDone ? "Open it" : "Start — about a minute"}
            <ArrowRight className="ml-1 size-3.5" aria-hidden />
          </Button>
        </section>
      ) : null}

      {/* The coaching loop: what to do next, or how the current step is going */}
      {activeStep ? (
        <ActiveStepCard coachStep={activeStep} />
      ) : coachNext ? (
        <div className="space-y-3">
          {lastResult?.result ? (
            <section aria-label="Your last step" className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Your last step</span>
                <VerdictPill verdict={lastResult.result.verdict} />
              </div>
              <p className="mt-1 text-sm font-semibold text-slate-900">{lastResult.step.title}</p>
              <p className="mt-0.5 text-sm text-slate-600">{lastResult.result.summary}</p>
              {lastResult.experimentId ? (
                <button onClick={() => navigate(`outcome/${lastResult.experimentId}`)} className="mt-1.5 text-xs font-medium text-brand-700 hover:underline">
                  See the result
                </button>
              ) : null}
            </section>
          ) : null}
          <NextStepCard step={coachNext} facts={facts} heading={lastResult ? "Your next step" : "Your first step"} challengeId={focus?.id} />
        </div>
      ) : null}

      {/* First diagnosis + what the checkup established */}
      <section className="grid gap-4 lg:grid-cols-2" aria-label="Your diagnosis and checkup summary">
        {/* The diagnosis belongs to the challenge being worked on — none in focus, none shown. */}
        {noFocus ? null : (
        <Card className="border-brand-200 bg-brand-50/60 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Sparkles className="size-4 text-brand-600" aria-hidden />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">
              {improved ? "Your sharpened diagnosis" : focus && focus.source !== "onboarding" ? "Your diagnosis — working on now" : "Your first diagnosis"}
            </span>
            <ProvenanceBadge provenance="ai-interpretation" />
          </div>
          {content ? (
            <>
              <p className="mt-2 text-lg font-semibold leading-snug">{improved?.headline ?? content.headline}</p>
              {content.insight && !improved ? (
                <p className="mt-2 flex gap-2 text-sm leading-relaxed text-slate-700">
                  <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
                  <span>{content.insight}</span>
                </p>
              ) : (
                <p className="mt-1.5 line-clamp-3 text-sm text-muted-foreground">{improved?.story ?? content.story}</p>
              )}
              {content.stake ? (
                <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
                  <p className="text-xl font-bold text-brand-700 tnum">{content.stake.figure}</p>
                  <p className="text-xs text-slate-700">
                    {content.stake.label}
                    {content.stake.detail ? ` — ${content.stake.detail.replace(/^If /, "if ")}` : ""}
                  </p>
                </div>
              ) : null}
              {planSteps.length > 0 ? (
                <div className="mt-3 rounded-xl border border-brand-200 bg-white px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                      <ListChecks className="size-4 text-brand-600" aria-hidden /> Your plan this week
                    </p>
                    <span className="text-xs text-slate-500 tnum">
                      {planDone} of {planSteps.length} done
                    </span>
                  </div>
                  <Progress value={(planDone / planSteps.length) * 100} className="mt-2 h-1.5" />
                  {nextStep ? (
                    <p className="mt-2 text-sm text-slate-700">
                      <span className="font-medium">Next: </span>
                      {nextStep}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm font-medium text-emerald-700">All done — add what happened to sharpen your diagnosis.</p>
                  )}
                  <button type="button" onClick={() => navigate("diagnosis/what-to-do")} className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
                    Tick them off — and the help written for you
                    <ArrowRight className="size-3" aria-hidden />
                  </button>
                </div>
              ) : null}
              <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-800">
                <ShieldCheck className="size-3.5" aria-hidden />
                {improved
                  ? "Every figure comes from your answers and the counts you entered."
                  : "Every figure checked against your answers — nothing invented."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" className="bg-brand-600 hover:bg-brand-700" onClick={() => navigate("diagnosis")}>
                  <Eye className="mr-1.5 size-3.5" aria-hidden /> Open my diagnosis &amp; plan
                </Button>
                <Button size="sm" variant="outline" className="bg-white" onClick={() => navigate("ask")}>
                  <Sparkles className="mr-1.5 size-3.5" aria-hidden /> Ask about it
                </Button>
                <Button size="sm" variant="ghost" className="text-brand-700 hover:text-brand-800" onClick={() => navigate("first-diagnosis-evidence")}>
                  <Search className="mr-1.5 size-3.5" aria-hidden /> See the evidence
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="mt-2 text-[15px] font-semibold leading-snug">Your diagnosis is being prepared.</p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Finish the checkup conversation and your first diagnosis will appear here, built only from what you told us.
              </p>
              <Button size="sm" className="mt-3 bg-brand-600 hover:bg-brand-700" onClick={() => navigate("checkup-intro")}>
                Start the checkup <ArrowRight className="ml-1 size-3.5" aria-hidden />
              </Button>
            </>
          )}
        </Card>
        )}

        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-brand-600" aria-hidden />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">What your checkup established</span>
            </div>
            <ProvenanceBadge provenance="user-supplied" />
          </div>
          <dl className="mt-3 space-y-2.5 text-sm">
            {establishedRows.map(([label, value]) => (
              <div key={label} className="flex flex-wrap items-baseline justify-between gap-2">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="max-w-[60%] text-right font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          {/* Trends only when the owner actually gave them — never a wall of "not reported". */}
          {facts?.trends && (["enquiries", "customers", "revenue"] as const).some((k) => facts.trends[k] !== "Don't know") ? (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-dashed pt-3">
              {(["enquiries", "customers", "revenue"] as const)
                .filter((k) => facts.trends[k] !== "Don't know")
                .map((k) => (
                  <span key={k} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {k === "enquiries" ? "People asking" : k === "customers" ? "Paying customers" : "Money coming in"}: <TrendWord trend={facts.trends[k]} />
                  </span>
                ))}
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => navigate("brain")}>
              Review business model
            </Button>
            {facts?.journey?.length ? (
              <Button size="sm" variant="ghost" onClick={() => navigate("journey-confirm")}>
                Edit customer journey
              </Button>
            ) : null}
          </div>
        </Card>
      </section>

      {/* Your numbers — real or honestly empty */}
      <section aria-label="Your numbers">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Your numbers</p>
          {latest ? (
            <p className="text-xs text-muted-foreground">
              {latest.label} · entered by you <ProvenanceBadge provenance="user-supplied" className="ml-1 align-middle" />
            </p>
          ) : null}
        </div>

        {latest ? (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {numberCards.map((c) => (
                <Card key={c.label} className="p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{c.label}</p>
                  <p className="mt-1.5 text-2xl font-semibold tnum">{c.display}</p>
                  {c.delta ? (
                    <p className={`mt-1 text-xs font-medium ${c.delta.cls}`}>{c.delta.text}</p>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">{months.length > 1 ? "No earlier month to compare" : "Enter another month to see change"}</p>
                  )}
                </Card>
              ))}
            </div>
            <Card className="mt-4 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Coverage so far: {Math.round(((facts ? 1 : 0) + Math.min(months.length, 2) / 2) / 2 * 100)}%</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Context from your checkup {months.length ? `+ ${months.length} month${months.length > 1 ? "s" : ""} of entered totals` : ""} — connecting a source raises coverage and sharpens the diagnosis.
                  </p>
                </div>
                <div className="w-full sm:w-64">
                  <Progress value={Math.round(((facts ? 1 : 0) + Math.min(months.length, 2) / 2) / 2 * 100)} className="h-2" aria-label="Data coverage" />
                </div>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {DATA_PATHS.map((p) => (
                  <Button key={p.id} size="sm" variant="outline" onClick={() => navigate(p.route)}>
                    <p.icon className="mr-1.5 size-3.5" aria-hidden />
                    {p.cta}
                  </Button>
                ))}
              </div>
            </Card>
          </>
        ) : (
          <>
            <Card className="p-5">
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                  <Database className="size-4.5" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold">No measured numbers yet — and that is stated plainly here.</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Nellovia will not fill this space with sample figures. Your diagnosis still works from what you described —
                    and it gets sharper the moment real numbers arrive. Pick whichever path suits you; all are optional.
                  </p>
                </div>
              </div>
            </Card>
            <div className="mt-4">
              <DataPathsRow />
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calculator className="size-3.5" aria-hidden />
              Estimates are welcome — every value is labelled with who supplied it.
            </p>
          </>
        )}
      </section>

      {/* Keep improving */}
      <section aria-label="Keep improving">
        <SectionCard
          title="Keep improving this workspace"
          description="Each path below uses only your own data."
        >
          <div className={`grid gap-3 ${improveHelps(facts, diagnosis, focus?.stage) ? "sm:grid-cols-2" : ""}`}>
            {/* Only where channel counts can change the read (not money trouble, delivery, repeat customers…). */}
            {improveHelps(facts, diagnosis, focus?.stage) ? (
              <Card className="flex flex-col justify-between p-4">
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-semibold">
                    <Target className="size-4 text-brand-600" aria-hidden /> Improve the diagnosis with channel counts
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Enter last month&apos;s enquiries and paying customers for each way people find you — we work out how many go on to pay from your own counts, so the
                    numbers are real the moment you type them.
                  </p>
                </div>
                <Button size="sm" variant="outline" className="mt-3 w-fit" onClick={() => navigate("improve-diagnosis")}>
                  Enter channel counts <ArrowRight className="ml-1 size-3.5" aria-hidden />
                </Button>
              </Card>
            ) : null}
            <Card className="flex flex-col justify-between p-4">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <Sparkles className="size-4 text-brand-600" aria-hidden /> Ask about your business
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Ask anything — answers are grounded in your checkup facts and whatever numbers you have added, and they say
                  plainly when something is not known yet.
                </p>
              </div>
              <Button size="sm" variant="outline" className="mt-3 w-fit" onClick={() => navigate("ask")}>
                Open Ask <ArrowRight className="ml-1 size-3.5" aria-hidden />
              </Button>
            </Card>
          </div>
        </SectionCard>
      </section>
    </div>
  );
}
