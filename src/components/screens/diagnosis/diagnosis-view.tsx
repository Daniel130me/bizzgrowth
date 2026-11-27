"use client";
// The owner's diagnosis — what's holding the business back, what to do about
// it, and why I think so — in three tabs, so the one next step never sits at
// the bottom of a long page.
//   • "page":   its own page in the workspace (sidebar → Diagnosis). It shows
//               the challenge being worked on now; any other diagnosed
//               challenge is one tap away. Tab and challenge live in the URL.
//   • "reveal": the first-time payoff right after the checkup, in the setup
//               layout. While it is written, an analysis walks through their
//               answers — the wait is part of the experience.
// Summary always carries the ONE next step and its buttons. "What to do"
// counts the ready-to-use help not used yet, so it isn't missed.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BadgeCheck, Check, ChevronDown, Eye, Flag, Gauge, History, Lightbulb, Pencil, Search, ShieldCheck, Sparkles, Stethoscope, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InfoBanner } from "@/components/shared/layout";
import { ActiveStepCard, MissingAnswers, NextStepCard } from "@/components/shared/coach";
import { ChallengeStatusPill, WorkOnThisButton } from "@/components/shared/challenges";
import { useActiveCoachStep, useBizz, useFocusChallenge, useOwnChallenges } from "@/lib/store";
import { STATUS_META, templateOutsideStep, type Challenge, type ChallengePlan } from "@/lib/challenges";
import { challengePayload } from "@/lib/challenge-client";
import { friendlyDate, templateNextStep } from "@/lib/coach";
import { restoreFinishedCheckup } from "@/lib/checkup-restore";
import { DIAGNOSIS_VERSION, type BusinessFacts, type DiagnosisContent, type FocusStage, type ImprovedDiagnosis } from "@/lib/checkup";
import { computeStake, currencySymbol, shorten } from "@/lib/checkup-math";
import { attachDiagnosisToChat } from "@/lib/chat-log";
import { loadHelpOpened, loadPlanProgress, planIdFor, saveHelpOpened, savePlanProgress } from "@/lib/plan-progress";
import { replaceRoute } from "@/lib/router";
import { DIAGNOSIS_TABS, asDiagnosisTab, diagnosisRoute, rememberDiagnosisRoute, type DiagnosisBase, type DiagnosisTab } from "@/lib/diagnosis-route";
import { cn } from "@/lib/utils";
import { AnalysisProgress, JourneyFocus, MoneyCard, OutsideNote, PlanChecklist, StakeCard, StakeLine, ToolCard, challengeRows, confidenceWord, toldUs, toolKey, type AnswerRow } from "./parts";
import { MoreWorthKnowing } from "./more-worth-knowing";

const OWN = "user-workspace";

type Mode = "page" | "reveal";

/** A sharpened diagnosis (from the owner's channel numbers) on top of the one it sharpened. */
function withImproved(base: DiagnosisContent | null, improved: ImprovedDiagnosis | null): DiagnosisContent | null {
  if (!improved) return base;
  return {
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
  };
}

/** The diagnosed challenges, in the order the owner thinks of them: now, up next, then done. */
function diagnosedList(challenges: Challenge[], focusHasDiagnosis: boolean): Challenge[] {
  const has = (c: Challenge) => (c.status === "working" ? focusHasDiagnosis : Boolean(c.parked?.diagnosis));
  const working = challenges.filter((c) => c.status === "working");
  const next = challenges.filter((c) => c.status === "up-next" && has(c)).sort((a, b) => a.order - b.order);
  const done = challenges
    .filter((c) => (c.status === "solved" || c.status === "stopped" || c.status === "no-longer") && has(c))
    .sort((a, b) => (b.solvedAt ?? b.stoppedAt ?? "").localeCompare(a.solvedAt ?? a.stoppedAt ?? ""));
  return [...working, ...next, ...done];
}

export function DiagnosisView({ mode, tabParam, challengeParam }: { mode: Mode; tabParam?: string; challengeParam?: string }) {
  const base: DiagnosisBase = mode === "reveal" ? "first-diagnosis" : "diagnosis";
  // The setup reveal keeps to the first three tabs; insights wait until the owner is in their workspace.
  const tabs = mode === "reveal" ? DIAGNOSIS_TABS.filter((t) => t.id !== "more") : DIAGNOSIS_TABS;
  const askedTab = asDiagnosisTab(tabParam);
  const tab: DiagnosisTab = tabs.some((t) => t.id === askedTab) ? askedTab : "summary";
  const navigate = useBizz((s) => s.navigate);
  const businessId = useBizz((s) => s.businessId);
  const setBusiness = useBizz((s) => s.setBusiness);
  const facts = useBizz((s) => s.checkup.facts);
  const transcript = useBizz((s) => s.checkup.transcript);
  const storedDiagnosis = useBizz((s) => s.checkup.diagnosis);
  const improved = useBizz((s) => s.checkup.improved);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const setCheckupDiagnosis = useBizz((s) => s.setCheckupDiagnosis);
  const applyChallengePlan = useBizz((s) => s.applyChallengePlan);
  const challengePlanAt = useBizz((s) => s.challengePlanAt);
  const patchCheckupFacts = useBizz((s) => s.patchCheckupFacts);
  const focus = useFocusChallenge();
  const challenges = useOwnChallenges();
  const coach = useBizz((s) => s.coach);
  const activeStep = useActiveCoachStep();
  // What check-ins taught, and the steps already tried — so a rewrite builds on them.
  const learnings = useMemo(() => coach.learnings.map((l) => l.text), [coach.learnings]);
  const tried = useMemo(() => coach.steps.filter((x) => x.workspaceId === OWN).map((x) => x.step.title), [coach.steps]);

  const demo = mode === "page" && businessId !== OWN;
  const cur = currencySymbol(userWorkspace?.currency);
  const name = userWorkspace?.name ?? "Your business";

  // Which challenge's diagnosis is shown: the one being worked on, unless the URL names another.
  const asked = mode === "page" && challengeParam ? challenges.find((c) => c.id === challengeParam) ?? null : null;
  const viewed: Challenge | null = asked && asked.status !== "working" ? asked : focus;
  const isFocusView = !viewed || viewed.status === "working";
  const noFocus = challenges.length > 0 && !focus;

  // With several challenges and nothing started yet, the first diagnosis also
  // suggests which one comes first — and why. The rest wait "up next".
  const openOthers = useMemo(() => challenges.filter((c) => c.id !== focus?.id && (c.status === "working" || c.status === "up-next")), [challenges, focus]);
  const chooseFocus = Boolean(focus) && openOthers.length > 0 && !challengePlanAt && tried.length === 0;
  // A challenge added later gets a few questions of its own first (on its page), not a guess.
  const needsQuestions = Boolean(focus && !focus.chatDone && !storedDiagnosis);

  const [generating, setGenerating] = useState(false);
  const [generateFailed, setGenerateFailed] = useState(false);
  const requested = useRef(false);

  const generate = useCallback(() => {
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
            transcript: [...(focus?.transcript ?? []), ...transcript],
            learnings,
            tried,
            challenge: focus ? challengePayload(focus) : null,
            others: openOthers.map(challengePayload),
            chooseFocus,
          }),
        });
        const data = (await res.json()) as { ok?: boolean; diagnosis?: DiagnosisContent; plan?: ChallengePlan | null };
        // Let the analysis view breathe for a moment — a flash reads as canned.
        const wait = Math.max(0, 3500 - (Date.now() - started));
        if (wait) await new Promise((r) => window.setTimeout(r, wait));
        if (data?.ok && data.diagnosis) {
          if (data.plan && chooseFocus) applyChallengePlan(data.plan, data.diagnosis);
          else setCheckupDiagnosis(data.diagnosis);
          attachDiagnosisToChat({ workspaceName: userWorkspace?.name, country: userWorkspace?.country, diagnosis: data.diagnosis });
        } else setGenerateFailed(true);
      } catch {
        setGenerateFailed(true);
      } finally {
        setGenerating(false);
      }
    })();
  }, [facts, transcript, userWorkspace, setCheckupDiagnosis, applyChallengePlan, learnings, tried, focus, openOthers, chooseFocus]);

  // Write it once when none exists — or when a stored one predates the current
  // format, so older checkups get the full diagnosis too. Never for a sample
  // business, a challenge still waiting for its questions, or with nothing in focus.
  const outdated = Boolean(storedDiagnosis && storedDiagnosis.version !== DIAGNOSIS_VERSION);
  const mayWrite = !demo && !needsQuestions && !noFocus;
  useEffect(() => {
    if (!facts || (storedDiagnosis && !outdated) || improved || requested.current || !mayWrite) return;
    requested.current = true;
    generate();
  }, [facts, storedDiagnosis, outdated, improved, generate, mayWrite]);

  // No facts in this browser: look for a checkup finished earlier (saved chat) before deciding there is none.
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
  }, [facts]);

  /* ---------- What's shown ---------- */
  const viewedBase: DiagnosisContent | null = isFocusView ? storedDiagnosis : viewed?.parked?.diagnosis ?? null;
  const viewedImproved: ImprovedDiagnosis | null = isFocusView ? improved : viewed?.parked?.improved ?? null;
  const diagnosis = useMemo(() => withImproved(viewedBase, viewedImproved), [viewedBase, viewedImproved]);
  // The checkup's "where it feels stuck" describes the focus; another challenge brings its own words.
  const viewFacts: BusinessFacts | null = useMemo(
    () => (facts && viewed && !isFocusView ? { ...facts, bottleneck: viewed.title, ownerTheory: viewed.details?.theory } : facts),
    [facts, viewed, isFocusView],
  );
  const diagnosed = useMemo(() => diagnosedList(challenges, Boolean(storedDiagnosis)), [challenges, storedDiagnosis]);

  // The week's ticks and the help opened, kept per diagnosis in this browser.
  const planId = viewedBase ? planIdFor(name, viewedBase.headline) : null;
  // Ticks made while a sharpened diagnosis was shown were kept under its headline — read both.
  const sharpenedPlanId = viewedBase && viewedImproved && viewedImproved.headline !== viewedBase.headline ? planIdFor(name, viewedImproved.headline) : null;
  const [ticks, setTicks] = useState<Record<number, boolean>>({});
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (!planId) return;
    setTicks(sharpenedPlanId ? { ...loadPlanProgress(sharpenedPlanId), ...loadPlanProgress(planId) } : loadPlanProgress(planId));
    setOpened(loadHelpOpened(planId));
  }, [planId, sharpenedPlanId]);
  const toggleTick = (i: number) => {
    if (!planId) return;
    setTicks((d) => {
      const next = { ...d, [i]: !d[i] };
      savePlanProgress(planId, next);
      return next;
    });
  };
  const markOpened = (key: string) => {
    if (!planId || opened[key]) return;
    setOpened((o) => {
      const next = { ...o, [key]: true };
      saveHelpOpened(planId, next);
      return next;
    });
  };

  // The URL keeps the tab (and a challenge other than the focus); pages it links to come back here.
  const viewedId = isFocusView ? null : viewed?.id ?? null;
  const here = diagnosisRoute(base, tab, viewedId);
  useEffect(() => {
    rememberDiagnosisRoute(here);
  }, [here]);
  // A link naming the focus itself (or a challenge that's gone) settles on the plain address.
  useEffect(() => {
    if (mode === "page" && challengeParam && !viewedId && businessId === OWN) replaceRoute(diagnosisRoute(base, tab));
  }, [mode, challengeParam, viewedId, businessId, base, tab]);
  const go = useCallback((next: DiagnosisTab, challengeId: string | null = viewedId) => replaceRoute(diagnosisRoute(base, next, challengeId)), [base, viewedId]);

  // Moving to another tab while scrolled down brings the tabs (now the top of the content) into view.
  const tabsTop = useRef<HTMLDivElement>(null);
  const tabList = useRef<HTMLDivElement | null>(null);
  const shownOnce = useRef(false);
  // On a phone the tabs scroll sideways: a soft edge shows there's more that way.
  const [edges, setEdges] = useState({ left: false, right: false });
  const tabListRef = useCallback((el: HTMLDivElement | null) => {
    tabList.current = el;
    if (!el) return;
    const update = () =>
      setEdges((e) => {
        const left = el.scrollLeft > 2;
        const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
        return e.left === left && e.right === right ? e : { left, right };
      });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);
  useEffect(() => {
    // On a phone the tabs scroll sideways: keep the chosen one in view.
    const list = tabList.current;
    const trigger = list?.querySelector<HTMLElement>(`[data-tab="${tab}"]`);
    if (list && trigger) {
      const l = list.getBoundingClientRect();
      const t = trigger.getBoundingClientRect();
      if (t.left < l.left || t.right > l.right) list.scrollBy({ left: t.left < l.left ? t.left - l.left - 16 : t.right - l.right + 16 });
    }
    if (!shownOnce.current) {
      shownOnce.current = true;
      return;
    }
    const top = tabsTop.current?.getBoundingClientRect().top;
    if (top !== undefined && top < 64) window.scrollTo({ top: window.scrollY + top - 64 });
  }, [tab, viewedId]);

  /* ---------- A sample business ---------- */
  if (demo) {
    return (
      <EmptyCard
        icon={Stethoscope}
        title="Your diagnosis lives in your own workspace"
        body="Sample businesses come with their own insights instead. Switch to your workspace to see what's holding your business back and the one thing to do next."
        action={
          userWorkspace ? (
            <Button className="mt-5 bg-brand-600 hover:bg-brand-700" onClick={() => setBusiness(OWN)}>
              Go to my workspace
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          ) : (
            <Button className="mt-5 bg-brand-600 hover:bg-brand-700" onClick={() => navigate("checkup-intro")}>
              Start your checkup
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          )
        }
      />
    );
  }

  /* ---------- No checkup yet ---------- */
  if (!facts && lookingUp) {
    return (
      <div className="mx-auto flex w-full max-w-2xl items-center justify-center gap-2 py-16 text-sm text-muted-foreground" role="status">
        <span className="size-2 animate-pulse rounded-full bg-brand-600" aria-hidden />
        Finding your checkup…
      </div>
    );
  }
  if (!facts) {
    return (
      <EmptyCard
        icon={Stethoscope}
        eyebrow={mode === "reveal" ? "Your first diagnosis" : "Your diagnosis"}
        title="Let's get to know your business first"
        body="Your diagnosis is written from your own answers — what you sell, who pays you and where it feels stuck. A short, friendly checkup is all it takes, and estimates are fine."
        action={
          <Button className="mt-6 bg-brand-600 hover:bg-brand-700" onClick={() => navigate(mode === "reveal" ? "onboarding-chat" : "checkup-intro")}>
            Start your checkup
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        }
      />
    );
  }

  // Without the tabs (nothing in focus, questions first…) the owner's insights still have a place.
  const insightsBelow = mode === "page" ? <MoreWorthKnowing /> : null;

  /* ---------- Nothing being worked on ---------- */
  if (noFocus && !viewed) {
    return (
      <PageFrame mode={mode} name={name}>
        <NoFocusCard challenges={challenges} />
        {diagnosed.length ? <EarlierDiagnoses list={diagnosed} onView={(id) => go("summary", id)} /> : null}
        {insightsBelow}
      </PageFrame>
    );
  }

  /* ---------- The focus has no diagnosis yet: its questions first ---------- */
  if (isFocusView && needsQuestions && focus) {
    return (
      <PageFrame mode={mode} name={name}>
        {mode === "page" ? <ChallengeBar viewed={focus} focus={focus} isFocus diagnosed={diagnosed} onView={(id) => go(tab, id === focus.id ? null : id)} /> : null}
        <section aria-label="Its diagnosis" className="rounded-3xl border border-brand-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">Its diagnosis</p>
          <p className="mt-1.5 text-base font-semibold leading-snug text-slate-900">A few quick questions about it first — then I&apos;ll write its own diagnosis and the first thing to try.</p>
          <Button className="mt-4 bg-brand-600 hover:bg-brand-700" onClick={() => navigate(`challenges/${focus.id}/chat`)}>
            Start — about a minute
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </section>
        {insightsBelow}
      </PageFrame>
    );
  }

  /* ---------- Writing / failed ---------- */
  if (isFocusView && !improved && (!storedDiagnosis || (outdated && (generating || generateFailed || !requested.current)))) {
    return <AnalysisProgress facts={facts} failed={generateFailed && !generating} onRetry={generate} name={name} />;
  }

  /* ---------- Another challenge, not diagnosed ---------- */
  if (!diagnosis || !viewFacts) {
    return (
      <PageFrame mode={mode} name={name}>
        {viewed ? <ChallengeBar viewed={viewed} focus={focus} isFocus={isFocusView} diagnosed={diagnosed} onView={(id) => go(tab, id === focus?.id ? null : id)} /> : null}
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="text-sm text-slate-700">This one doesn&apos;t have its diagnosis yet.</p>
          {viewed ? (
            <Button variant="outline" className="mt-3 bg-white" onClick={() => navigate(viewed.chatDone ? `challenges/${viewed.id}` : `challenges/${viewed.id}/chat`)}>
              {viewed.chatDone ? "Open it" : "Answer a few quick questions"}
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          ) : null}
        </section>
        {insightsBelow}
      </PageFrame>
    );
  }

  /* ---------- The diagnosis ---------- */
  const shownImproved = viewedImproved;
  const stage: FocusStage = diagnosis.focusStage ?? "convert";
  const outside = viewed?.stage === "outside";
  const closed = Boolean(viewed && !isFocusView && viewed.status !== "up-next");
  const tools = diagnosis.tools ?? [];
  const steps = diagnosis.steps ?? [];
  const waiting = challenges.filter((c) => c.status === "up-next").sort((a, b) => a.order - b.order);
  // Diagnoses written before next steps existed get the ready-made one for their stage.
  const nextStep = closed
    ? null
    : viewedBase?.nextStep ?? (outside && viewed ? templateOutsideStep(viewed.title) : templateNextStep(stage, viewFacts, tried));
  const update = viewedBase?.update;
  const viewedPaused = viewed && !isFocusView ? coach.steps.find((x) => x.challengeId === viewed.id && x.status === "paused") ?? null : null;
  const focusHasActive = Boolean(focus && coach.steps.some((x) => x.challengeId === focus.id && x.status === "active"));

  // Help not used yet: pieces of help never opened, and the week's checklist not ticked.
  // A solved or stopped challenge's help is kept for reference — nothing to nudge about.
  const unusedTools = tools.filter((t) => !opened[toolKey(t)]).length;
  const unticked = steps.filter((_, i) => !ticks[i]).length;
  const unused = closed ? 0 : unusedTools + unticked;

  const told = toldUs(viewFacts);
  const toldMore = challengeRows(viewed, told);
  const viewKey = viewed?.id ?? "focus";

  function addNumbers(patch: Partial<BusinessFacts>) {
    if (!facts || !viewedBase || !isFocusView) return;
    const next = { ...facts, ...patch };
    const stake = computeStake(next, cur, viewedBase.focusStage ?? stage);
    patchCheckupFacts(patch, { ...viewedBase, stake });
  }

  /* The ONE next step — or the one they're already on. Shown on Summary AND What to do. */
  const stepBlock = isFocusView ? (
    activeStep ? (
      <ActiveStepCard key={`active-${activeStep.id}`} coachStep={activeStep} />
    ) : nextStep ? (
      <NextStepCard key={`next-${viewKey}-${nextStep.title}`} step={nextStep} facts={viewFacts} challengeId={focus?.id} />
    ) : null
  ) : closed && viewed ? (
    <section aria-label="Where it stands" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <p className="text-sm leading-relaxed text-slate-700">
        {viewed.status === "solved"
          ? "You marked this one solved. Its diagnosis is kept here, so you can see what was behind it."
          : "You stopped working on this one. Its diagnosis is kept here — what it ruled out still counts."}
      </p>
      <Button variant="outline" className="mt-3 bg-white" onClick={() => navigate(`challenges/${viewed.id}`)}>
        See its full story — what was tried and what worked
        <ArrowRight className="size-4" aria-hidden />
      </Button>
    </section>
  ) : nextStep && viewed ? (
    <div key={`next-${viewKey}-${nextStep.title}`} className="space-y-2">
      {viewedPaused ? <p className="text-sm text-slate-600">Paused: “{viewedPaused.step.title}”. It picks up again when you work on this challenge.</p> : null}
      <p className="text-xs text-slate-500">
        Starting this makes it your focus
        {focus ? ` — “${shorten(focus.title, 60)}” goes back to Up next${focusHasActive ? " and its step is paused" : ""}` : ""}.
      </p>
      <NextStepCard step={nextStep} facts={viewFacts} heading={viewed.stepIds.length ? "Its next step" : "The first step for this one"} challengeId={viewed.id} />
    </div>
  ) : null;

  const keepItGoing = isFocusView ? (
    <KeepItGoing
      mode={mode}
      activeStep={Boolean(activeStep)}
      improved={Boolean(improved)}
      onContinue={() => navigate("setup-complete")}
      onImprove={() => navigate("improve-diagnosis")}
      onEvidence={() => navigate("first-diagnosis-evidence")}
    />
  ) : null;

  return (
    <PageFrame mode={mode} name={name} animate={mode === "reveal"}>
      {mode === "page" && viewed ? (
        <ChallengeBar viewed={viewed} focus={focus} isFocus={isFocusView} diagnosed={diagnosed} onView={(id) => go(tab, id === focus?.id ? null : id)} />
      ) : null}

      <Tabs value={tab} onValueChange={(v) => go(asDiagnosisTab(v))} className="gap-0">
        <div ref={tabsTop} aria-hidden className="h-0" />
        <div className="sticky top-14 z-20 -mx-1 bg-background/95 px-1 pt-1 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <TabsList
            ref={tabListRef}
            aria-label={isFocusView ? "Your diagnosis" : `The diagnosis for “${shorten(viewed?.title ?? "", 60)}”`}
            className={cn(
              "flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b border-slate-200 bg-transparent p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
              edges.left && edges.right
                ? "[mask-image:linear-gradient(to_right,transparent,#000_28px,#000_calc(100%_-_28px),transparent)]"
                : edges.right
                  ? "[mask-image:linear-gradient(to_right,#000_calc(100%_-_36px),transparent)]"
                  : edges.left
                    ? "[mask-image:linear-gradient(to_right,transparent,#000_36px)]"
                    : "",
            )}
          >
            {tabs.map((t) => (
              <TabsTrigger
                key={t.id}
                value={t.id}
                data-tab={t.id}
                className="h-11 flex-none rounded-none border-0 border-b-2 border-transparent px-3 text-sm font-semibold text-slate-500 shadow-none hover:text-slate-800 data-[state=active]:border-brand-600 data-[state=active]:bg-transparent data-[state=active]:text-brand-700 data-[state=active]:shadow-none dark:data-[state=active]:border-brand-500 dark:data-[state=active]:bg-transparent sm:px-4"
              >
                {t.label}
                {t.id === "what-to-do" && unused > 0 ? (
                  <>
                    <span aria-hidden className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[11px] font-bold text-white tnum">
                      {unused}
                    </span>
                    <span className="sr-only">, {unused} not used yet</span>
                  </>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Summary: what's holding it back, what I noticed, the ONE next step, what fixing it is worth */}
        <TabsContent value="summary" className="pt-6">
          <div key={viewKey} className="space-y-6 animate-in fade-in-0 duration-300">
            {shownImproved ? (
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-2.5 text-sm text-emerald-900">
                <BadgeCheck className="size-4 shrink-0 text-emerald-600" aria-hidden />
                <span>Sharpened with your numbers — confidence now {shownImproved.confidence}%.</span>
                <button type="button" onClick={() => go("why")} className="font-semibold text-emerald-800 underline-offset-2 hover:underline">
                  See your numbers by channel
                </button>
              </p>
            ) : null}

            <DiagnosisHero diagnosis={diagnosis} improved={Boolean(shownImproved)} onWhy={() => go("why")} />

            {outside && viewed ? <OutsideNote title={viewed.title} /> : null}

            {mode === "reveal" && focus && waiting.length > 0 ? <OneThingAtATime focus={focus} waiting={waiting} onAll={() => navigate("challenges")} /> : null}

            {stepBlock}

            <StakeLine diagnosis={diagnosis} facts={viewFacts} cur={cur} readOnly={!isFocusView} onOpen={() => go("why")} />

            {unused > 0 ? <UnusedHelp tools={unusedTools} steps={unticked} onOpen={() => go("what-to-do")} /> : null}
          </div>
        </TabsContent>

        {/* What to do: the step in full, help for today, the week's list, the latest check-in */}
        <TabsContent value="what-to-do" className="pt-6">
          <div key={viewKey} className="space-y-8 animate-in fade-in-0 duration-300">
            {stepBlock}

            {update ? (
              <section aria-label="Latest from your check-in" className="flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                <History className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden />
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Latest from your check-in · {friendlyDate(update.at)}</p>
                  <p className="mt-1 text-[15px] leading-relaxed text-slate-800">{update.note}</p>
                </div>
              </section>
            ) : null}

            {tools.length > 0 ? (
              <section aria-label="More help for today">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                    <Sparkles className="size-5 text-brand-600" aria-hidden />
                    More help for today
                  </h2>
                  {unusedTools > 0 ? (
                    <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 tnum">{unusedTools} not opened yet</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                      <Check className="size-3.5" aria-hidden /> All opened
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-600">Written for your business. Tap one to see the words — then copy, tweak and send.</p>
                <div className="mt-4 space-y-3">
                  {tools.map((t, i) => (
                    <ToolCard key={`${t.kind}-${t.title}`} tool={t} featured={i === 0} opened={Boolean(opened[toolKey(t)])} onOpen={() => markOpened(toolKey(t))} />
                  ))}
                </div>
              </section>
            ) : null}

            {steps.length > 0 ? <PlanChecklist title="Also worth doing this week" steps={steps} done={ticks} onToggle={toggleTick} /> : null}

            {mode === "page" ? keepItGoing : null}
          </div>
        </TabsContent>

        {/* Why I think this: the reasoning, where it's stuck, what it's worth, the answers it rests on */}
        <TabsContent value="why" className="pt-6">
          <div key={viewKey} className="space-y-8 animate-in fade-in-0 duration-300">
            {shownImproved ? (
              <InfoBanner tone="success" title={`Sharpened with your numbers — confidence now ${shownImproved.confidence}%`}>
                {shownImproved.bestChannel !== shownImproved.worstChannel
                  ? `${shownImproved.worstChannel} turns ${shownImproved.channelRows.find((r) => r.name === shownImproved.worstChannel)?.conversion.toFixed(1) ?? "—"}% of enquiries into customers, compared with ${
                      shownImproved.channelRows.find((r) => r.name === shownImproved.bestChannel)?.conversion.toFixed(1) ?? "—"
                    }% for ${shownImproved.bestChannel}.`
                  : "Your channel numbers are now part of this diagnosis."}
              </InfoBanner>
            ) : null}

            <section aria-label="Why I think this" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
                <Eye className="size-5 text-brand-600" aria-hidden />
                Why I think this
              </h2>
              <div className="mt-4 grid gap-5 sm:grid-cols-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">What you told me</p>
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

            {outside && viewed ? <OutsideNote title={viewed.title} /> : <JourneyFocus stage={stage} />}

            {/* Money trouble: the gap and money in vs out, worked out from their own figures. */}
            {diagnosis.money?.length ? <MoneyCard lines={diagnosis.money} /> : null}

            <StakeCard key={`stake-${viewKey}`} diagnosis={diagnosis} facts={viewFacts} cur={cur} onAddNumbers={addNumbers} readOnly={!isFocusView} />

            {shownImproved ? <ChannelNumbers improved={shownImproved} /> : null}

            {told.length > 0 || toldMore.length > 0 ? (
              <AnswersUsed rows={told} more={toldMore} title={viewed && !isFocusView ? viewed.title : null} onFix={isFocusView ? () => navigate("business-understanding") : null} />
            ) : null}

            {/* The answers that would sharpen it — each with what not knowing it costs. (Not for money
                trouble: questions about winning customers would only distract from this week's money.) */}
            {isFocusView && !improved && !facts?.money ? (
              <MissingAnswers facts={facts} diagnosis={viewedBase} currency={userWorkspace?.currency} exclude={["monthlyEnquiries"]} onUpdate={generate} updating={generating} />
            ) : null}

            <div className="flex flex-col gap-2 border-t border-slate-200 pt-5 sm:flex-row sm:items-center">
              <p className="text-sm text-slate-600 sm:mr-auto">Want to see everything this rests on?</p>
              {isFocusView && !improved ? (
                <Button variant="outline" className="bg-white" onClick={() => navigate("improve-diagnosis")}>
                  <TrendingUp className="size-4" aria-hidden />
                  Add my enquiry numbers
                </Button>
              ) : null}
              <Button variant="ghost" className="text-brand-700 hover:text-brand-800" onClick={() => navigate("first-diagnosis-evidence")}>
                <Search className="size-4" aria-hidden />
                See the evidence
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* More worth knowing: the owner's insights, beyond the main diagnosis (in place of the Insights page) */}
        {mode === "page" ? (
          <TabsContent value="more" className="pt-6">
            <div className="animate-in fade-in-0 duration-300">
              <MoreWorthKnowing />
            </div>
          </TabsContent>
        ) : null}
      </Tabs>

      {/* The setup reveal keeps its way forward under every tab. */}
      {mode === "reveal" ? keepItGoing : null}
    </PageFrame>
  );
}

/* ------------------------------------------------------------------ */
/* Frame and states                                                     */
/* ------------------------------------------------------------------ */

function PageFrame({ mode, name, animate, children }: { mode: Mode; name: string; animate?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("mx-auto w-full max-w-3xl space-y-6 pb-6", animate && "animate-in fade-in-0 slide-in-from-bottom-4 duration-700")}>
      {mode === "page" ? (
        <header>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Your diagnosis</h1>
          <p className="mt-1 text-sm text-muted-foreground">What&apos;s holding {name} back, what to do about it, and why I think so.</p>
        </header>
      ) : (
        <h1 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-700">
          <Sparkles className="size-4" aria-hidden />
          {name} — your diagnosis
        </h1>
      )}
      {children}
    </div>
  );
}

function EmptyCard({ icon: Icon, eyebrow, title, body, action }: { icon: React.ElementType; eyebrow?: string; title: string; body: string; action: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-xl py-10 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
        <Icon className="size-6" aria-hidden />
      </span>
      {eyebrow ? <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-brand-600">{eyebrow}</p> : null}
      <h1 className={cn("text-2xl font-bold tracking-tight sm:text-3xl", eyebrow ? "mt-2" : "mt-4")}>{title}</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
      {action}
    </div>
  );
}

/** Nothing in focus (the last one was solved or stopped): suggest what's next — the owner says go. */
function NoFocusCard({ challenges }: { challenges: Challenge[] }) {
  const navigate = useBizz((s) => s.navigate);
  const next = challenges.filter((c) => c.status === "up-next").sort((a, b) => a.order - b.order)[0] ?? null;
  return (
    <section aria-label="What's next" className="rounded-3xl border border-brand-200 bg-white p-5 shadow-sm sm:p-6">
      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-brand-700">
        <Flag className="size-4" aria-hidden /> Nothing in focus right now
      </p>
      {next ? (
        <>
          <p className="mt-2 text-sm text-slate-600">Suggested next:</p>
          <p className="mt-0.5 text-lg font-semibold leading-snug text-slate-900">“{next.title}”</p>
          {next.orderReason ? <p className="mt-1 text-sm text-slate-600">{next.orderReason}</p> : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <WorkOnThisButton challenge={next} />
            <Button variant="ghost" onClick={() => navigate("challenges")}>
              See all challenges
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 text-sm text-slate-700">Nothing is waiting on your list. Is anything else holding the business back? Tell me and I&apos;ll diagnose it.</p>
          <Button className="mt-3 bg-brand-600 hover:bg-brand-700" onClick={() => navigate("challenges/new")}>
            Report a new challenge
          </Button>
        </>
      )}
    </section>
  );
}

function EarlierDiagnoses({ list, onView }: { list: Challenge[]; onView: (id: string) => void }) {
  return (
    <section aria-label="Earlier diagnoses">
      <h2 className="text-sm font-semibold text-slate-900">Diagnoses you can look back on</h2>
      <ul className="mt-2 space-y-2">
        {list.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onView(c.id)}
              className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-left text-sm transition-colors hover:border-brand-300 hover:bg-brand-50/40"
            >
              <span className="min-w-0 flex-1 font-medium text-slate-900">“{shorten(c.title, 90)}”</span>
              <ChallengeStatusPill status={c.status} />
              <ArrowRight className="size-4 shrink-0 text-slate-400" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Which challenge                                                      */
/* ------------------------------------------------------------------ */

function ChallengeBar({
  viewed,
  focus,
  isFocus,
  diagnosed,
  onView,
}: {
  viewed: Challenge;
  focus: Challenge | null;
  isFocus: boolean;
  diagnosed: Challenge[];
  onView: (id: string) => void;
}) {
  const navigate = useBizz((s) => s.navigate);
  const others = diagnosed.filter((c) => c.id !== viewed.id);
  return (
    <section
      aria-label="Which challenge"
      className={cn("rounded-2xl border px-4 py-3.5 sm:px-5", isFocus ? "border-brand-200 bg-brand-50/50" : "border-amber-200 bg-amber-50/60")}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          {isFocus ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-700">
              <Flag className="size-3.5" aria-hidden /> Working on now
            </span>
          ) : (
            <>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">Looking at</span>
              <ChallengeStatusPill status={viewed.status} />
            </>
          )}
        </span>
        {others.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 bg-white text-xs">
                Other challenges
                <span className="rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-600 tnum">{others.length}</span>
                <ChevronDown className="size-3.5 text-slate-400" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 max-w-[calc(100vw-2rem)]">
              <DropdownMenuLabel className="text-xs text-muted-foreground">See the diagnosis for…</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={viewed.id} onValueChange={onView}>
                {diagnosed.map((c) => (
                  <DropdownMenuRadioItem key={c.id} value={c.id} className="items-start py-2">
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="text-sm leading-snug text-slate-900">“{shorten(c.title, 70)}”</span>
                      <span className={cn("w-fit rounded-full border px-2 py-px text-[10px] font-semibold", STATUS_META[c.status].cls)}>{STATUS_META[c.status].label}</span>
                    </span>
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate("challenges")} className="text-sm font-medium text-brand-700">
                All challenges and progress
                <ArrowRight className="ml-auto size-3.5" aria-hidden />
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      <p className="mt-1.5 text-base font-semibold leading-snug text-slate-900">“{viewed.title}”</p>
      {isFocus && viewed.whyFirst ? (
        <p className="mt-1 text-sm leading-relaxed text-slate-700">
          <span className="font-semibold text-slate-900">Why this first: </span>
          {viewed.whyFirst}
        </p>
      ) : null}
      {!isFocus ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {viewed.status === "up-next" ? <WorkOnThisButton challenge={viewed} size="sm" /> : null}
          {focus ? (
            <Button variant="ghost" size="sm" className="text-slate-700" onClick={() => onView(focus.id)}>
              Back to what I&apos;m working on
            </Button>
          ) : null}
        </div>
      ) : (
        <button type="button" onClick={() => navigate("challenges")} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
          All challenges and progress
          <ArrowRight className="size-3" aria-hidden />
        </button>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Summary pieces                                                       */
/* ------------------------------------------------------------------ */

function DiagnosisHero({ diagnosis, improved, onWhy }: { diagnosis: DiagnosisContent; improved: boolean; onWhy: () => void }) {
  return (
    <section aria-label="What's holding the business back" className="relative overflow-hidden rounded-3xl border border-brand-200 bg-gradient-to-br from-brand-50 via-white to-brand-50 p-6 shadow-sm sm:p-8">
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-brand-200/40 blur-3xl" />
      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">What&apos;s holding growth back</p>
          <button
            type="button"
            onClick={onWhy}
            className="flex items-center gap-2 rounded-full border border-brand-200 bg-white/80 px-3 py-1 transition-colors hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
            title="Based on what you told me. Adding real numbers raises this."
          >
            <Gauge className="size-3.5 text-brand-600" aria-hidden />
            <span className="text-xs font-medium text-brand-800">{confidenceWord(diagnosis.confidence)}</span>
            <span className="h-1.5 w-14 overflow-hidden rounded-full bg-brand-100" aria-hidden>
              <span className="block h-full rounded-full bg-brand-600" style={{ width: `${diagnosis.confidence}%` }} />
            </span>
            <span className="sr-only">, based on what you told me. See why I think this.</span>
          </button>
        </div>
        <h2 className="mt-3 text-[1.6rem] font-bold leading-tight tracking-tight text-slate-900 sm:text-[2rem]">{diagnosis.headline}</h2>

        {diagnosis.insight ? (
          <div className="mt-5 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
            <Lightbulb className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700">What I noticed</p>
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
            {improved ? "Based on your checkup answers and the numbers you entered." : "Based only on what you told me — nothing invented or sampled."}
          </span>
        </div>
      </div>
    </section>
  );
}

/** The setup reveal: why this challenge first, and what waits up next. */
function OneThingAtATime({ focus, waiting, onAll }: { focus: Challenge; waiting: Challenge[]; onAll: () => void }) {
  return (
    <section aria-label="Your challenges, one at a time" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
        <Flag className="size-5 text-brand-600" aria-hidden />
        One thing at a time
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-700">
        <span className="font-semibold text-slate-900">Working on first: </span>“{focus.title}”
      </p>
      {focus.whyFirst ? (
        <p className="mt-1 text-sm leading-relaxed text-slate-700">
          <span className="font-semibold text-slate-900">Why this first: </span>
          {focus.whyFirst}
        </p>
      ) : null}
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Up next</p>
      <ol className="mt-2 space-y-2">
        {waiting.map((c, i) => (
          <li key={c.id} className="flex items-start gap-3 rounded-xl border border-slate-200 px-3.5 py-2.5">
            <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600 tnum">{i + 1}</span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900">“{c.title}”</p>
              {c.orderReason ? <p className="mt-0.5 text-xs text-slate-500">{c.orderReason}</p> : null}
            </div>
          </li>
        ))}
      </ol>
      <Button variant="ghost" size="sm" className="mt-2 -ml-2 text-brand-700 hover:text-brand-800" onClick={onAll}>
        See all your challenges — change the order any time
        <ArrowRight className="size-3.5" aria-hidden />
      </Button>
    </section>
  );
}

/** Points at help on "What to do" that hasn't been used — easy to miss after the first visit. */
function UnusedHelp({ tools, steps, onOpen }: { tools: number; steps: number; onOpen: () => void }) {
  const bits = [
    tools ? `${tools} ${tools === 1 ? "thing" : "things"} I wrote for you to use today` : "",
    steps ? `${steps} ${steps === 1 ? "thing" : "things"} worth doing this week` : "",
  ].filter(Boolean);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-left shadow-sm transition-colors hover:border-brand-300 hover:bg-brand-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 sm:items-center sm:px-5"
    >
      <Sparkles className="mt-0.5 size-5 shrink-0 text-brand-600 sm:mt-0" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-900">More help you haven&apos;t used yet</span>
        <span className="mt-0.5 block text-sm text-slate-600">{bits.join(" · ")}</span>
      </span>
      <span className="hidden shrink-0 items-center gap-1 text-xs font-semibold text-brand-700 sm:flex">
        What to do <ArrowRight className="size-3.5" aria-hidden />
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Why pieces                                                           */
/* ------------------------------------------------------------------ */

function ChannelNumbers({ improved }: { improved: ImprovedDiagnosis }) {
  return (
    <section aria-label="Your numbers by channel">
      <h2 className="text-sm font-semibold text-slate-900">Your numbers by channel</h2>
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
  );
}

/** Their answers, with an easy way to correct them (for the challenge being worked on). */
function AnswersUsed({ rows, more, title, onFix }: { rows: AnswerRow[]; more: AnswerRow[]; title: string | null; onFix: (() => void) | null }) {
  return (
    <section aria-label="Your answers I used">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Your answers I used</h2>
        {onFix ? (
          <Button variant="ghost" size="sm" className="text-brand-700 hover:text-brand-800" onClick={onFix}>
            <Pencil className="size-3.5" aria-hidden />
            Something not right? Fix it
          </Button>
        ) : null}
      </div>
      <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label} className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{r.label}</dt>
            <dd className="mt-0.5 text-sm leading-snug text-slate-800">{r.value}</dd>
          </div>
        ))}
      </dl>
      {more.length ? (
        <>
          <h3 className="mt-5 text-sm font-semibold text-slate-900">{title ? `What you told me about “${shorten(title, 60)}”` : "What you told me about it"}</h3>
          <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {more.map((r) => (
              <div key={r.label} className={cn("rounded-xl border border-slate-200 bg-white px-3.5 py-2.5", r.long && "sm:col-span-2")}>
                <dt className={cn("text-slate-500", r.long ? "text-xs font-medium" : "text-[11px] font-semibold uppercase tracking-wide")}>{r.label}</dt>
                <dd className="mt-0.5 text-sm leading-snug text-slate-800">{r.value}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : null}
    </section>
  );
}

/** A reason to come back — and, in the setup reveal, the way into the workspace. */
function KeepItGoing({
  mode,
  activeStep,
  improved,
  onContinue,
  onImprove,
  onEvidence,
}: {
  mode: Mode;
  activeStep: boolean;
  improved: boolean;
  onContinue: () => void;
  onImprove: () => void;
  onEvidence: () => void;
}) {
  return (
    <section aria-label="Keep it going" className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-base font-semibold text-emerald-900">
        <TrendingUp className="size-5 text-emerald-600" aria-hidden />
        See it working
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-emerald-950/80">
        {activeStep
          ? "You're on your next step. I'll check in with you along the way — a few taps — and every check-in makes this diagnosis sharper."
          : "Start your next step. I'll check in with you along the way — a few taps — so I learn what works for you, even the parts that happen outside the app."}
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        {mode === "reveal" ? (
          <Button onClick={onContinue} className="w-full bg-brand-600 hover:bg-brand-700 sm:w-auto">
            Continue to my workspace
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        ) : null}
        {!improved ? (
          <Button variant="outline" className="w-full border-emerald-300 bg-white sm:w-auto" onClick={onImprove}>
            Add my enquiry numbers
          </Button>
        ) : null}
        <Button variant="ghost" className="w-full text-slate-600 sm:ml-auto sm:w-auto" onClick={onEvidence}>
          See the evidence
        </Button>
      </div>
    </section>
  );
}
