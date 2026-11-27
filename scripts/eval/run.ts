// Nellovia AI quality test runner. See scripts/eval/README.md.
//
//   bun scripts/eval/run.ts <case> <command> [args] [--run before|after] [--date YYYY-MM-DD]
//
// Every command is one thing the owner does in the app (send a message, tap an
// answer, fill a form, open a page that asks the AI). It builds the request the
// way that screen builds it, from the app's own state, calls the real route on
// the local dev server and records the call. The owner's words come from the
// operator, one turn at a time — the runner never answers for the owner.

import { appendFileSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs, readJson, rel, runContext, writeJson } from "./lib/context";
import { apiCall, callLine, type ApiResult, type CallRecord } from "./lib/http";
import { asFeature, openApp, saveApp } from "./lib/app";
import { CHALLENGE_OPENER, CHECKUP_DONE, CHECKUP_INTRO_CHIPS, CHECKUP_MAX_USER_TURNS, CHECKUP_OPENER, checkUiCopies } from "./lib/owner-ui";
import { plainChat, providerSnapshot, type PlainTurn } from "./lib/providers";
import { renderRun } from "./lib/render";
import { emptySlots, type AskAnswerContent, type AskCounts, type BusinessFacts, type CheckupPhase, type CheckupSlots, type ChatTurnResult, type DiagnosisContent, type ImprovedDiagnosis, type TranscriptTurn } from "@/lib/checkup";
import { buildBusinessContext, coachingContext, ownerWordsFrom } from "@/lib/ai-context";
import { challengesContext, NONE_CHIP, otherChallengeChips, type ChallengeDetails, type ChallengePlan } from "@/lib/challenges";
import { challengePayload, requestChallengeDiagnosis } from "@/lib/challenge-client";
import { generateOwnerInsights } from "@/lib/insights-client";
import { acknowledge, baselineQuestion, COUNT_CHOICES, daysSince, fixDraftHint, IN10_CHOICES, nextCheckIn, nextCheckInQuestion, suggestedBaseline, type CheckInAnswer, type CheckInQuestion, type CheckInResult, type DraftHint } from "@/lib/coach";
import { FOCUS_STAGES } from "@/lib/checkup";
import type { ChallengeChatState, ChallengeTurnResult } from "@/lib/challenge-chat";
import { getBusiness } from "@/lib/data/businesses";
import { ownerMonthsFromEntries } from "@/lib/data/user-business";
import { collectAllowedNumbers, ungroundedNumbers } from "@/lib/grounding";
import type { Brief, Insight } from "@/lib/types";

const OWN = "user-workspace";

interface RunnerState {
  checkup: {
    opener: string;
    transcript: TranscriptTurn[];
    messages: { role: "ai" | "user"; text: string; learned?: string[]; degraded?: boolean; chips?: string[]; note?: boolean }[];
    phase: CheckupPhase;
    slots: CheckupSlots;
    askCounts: AskCounts;
    chips: string[];
    finished: boolean;
  } | null;
  ask: { question: string; answer: AskAnswerContent }[];
  checkin: { stepId: string; checkInId: string; kind: string; day: number; answers: CheckInAnswer[]; question: CheckInQuestion | null; thread: { role: "ai" | "user"; text: string }[]; result?: CheckInResult } | null;
  challenge: { id: string | null; transcript: TranscriptTurn[]; state: ChallengeChatState; chips: string[]; phase: "chat" | "done" | "linked"; linkedTo?: string | null } | null;
  challengeChats: { id: string | null; transcript: TranscriptTurn[]; phase: string; linkedTo?: string | null }[];
  notes: string[];
}

const { positional, flags } = parseArgs(process.argv.slice(2));
const [caseId, command, ...rest] = positional;
if (!caseId || !command) {
  console.log("Usage: bun scripts/eval/run.ts <case> <command> [args] [--run before|after]\nSee scripts/eval/README.md for the commands.");
  process.exit(1);
}
const ctx = runContext(caseId, flags);
checkUiCopies();
const useBizz = await openApp(ctx);
const S = () => useBizz.getState();
const rs: RunnerState = readJson<RunnerState>(ctx.runnerStatePath, { checkup: null, ask: [], checkin: null, challenge: null, challengeChats: [], notes: [] });
const text = rest.join(" ").trim();

function save(): void {
  saveApp();
  writeJson(ctx.runnerStatePath, rs);
}

function out(line = ""): void {
  console.log(line);
}

function numbered(chips: string[]): void {
  chips.forEach((c, i) => out(`   [${i + 1}] ${c}`));
}

function ws() {
  const uw = S().userWorkspace;
  if (!uw) throw new Error("No workspace yet — run `setup` first.");
  return uw;
}

const own = () => S().challenges.filter((c) => c.workspaceId === OWN);
const focus = () => own().find((c) => c.status === "working") ?? null;

/* ------------------------------------------------------------------ */
/* Account, workspace, live settings                                    */
/* ------------------------------------------------------------------ */

async function setup(): Promise<void> {
  const health = await fetch(`${ctx.baseUrl}/api/health`).then((r) => r.status).catch(() => 0);
  if (!health) throw new Error(`The dev server is not reachable at ${ctx.baseUrl}. Start it with: bun scripts/eval/run.ts ${caseId} server-cmd`);
  const c = ctx.evalCase;
  interface Creds { name: string; email: string; password: string; created?: boolean }
  let creds = readJson<Creds | null>(ctx.credentialsPath, null);
  if (!creds) {
    const rand = Math.random().toString(36).slice(2, 10);
    creds = { name: c.ownerName, email: `eval-${caseId}-${rand}@example.com`, password: `${crypto.randomUUID()}A1!` };
    writeJson(ctx.credentialsPath, creds);
  }
  let me = (await apiCall<{ user: Record<string, unknown> | null }>(ctx, "setup", "/api/auth/me", undefined, { record: false })).json.user;
  if (!me) {
    const r = creds.created
      ? await apiCall(ctx, "setup", "/api/auth/login", { email: creds.email, password: creds.password, remember: true }, { record: false })
      : await apiCall(ctx, "setup", "/api/auth/signup", { name: creds.name, email: creds.email, password: creds.password }, { record: false });
    if (r.status >= 300) throw new Error(`Sign-in failed (${r.status}): ${JSON.stringify(r.json)}`);
    if (!creds.created) writeJson(ctx.credentialsPath, { ...creds, created: true });
    me = (await apiCall<{ user: Record<string, unknown> | null }>(ctx, "setup", "/api/auth/me", undefined, { record: false })).json.user;
  }
  if (!me) throw new Error("Signed in, but /api/auth/me returned no user.");
  if (me.workspaceName !== c.workspace.name) {
    // The create-workspace form: name, country, currency (type is always "service" there), optional website.
    const r = await apiCall(ctx, "setup", "/api/auth/workspace", { name: c.workspace.name, type: "service", country: c.workspace.country, currency: c.workspace.currency, ...(c.workspace.website ? { website: c.workspace.website } : {}) }, { record: false });
    if (r.status >= 300) throw new Error(`Workspace creation failed (${r.status}): ${JSON.stringify(r.json)}`);
    me = (await apiCall<{ user: Record<string, unknown> | null }>(ctx, "setup", "/api/auth/me", undefined, { record: false })).json.user;
  }
  if (S().userWorkspace?.name !== c.workspace.name) {
    S().createWorkspace({ name: c.workspace.name, type: "service", country: c.workspace.country, currency: c.workspace.currency, website: c.workspace.website });
  }
  S().setSession({ id: String(me!.id), name: String(me!.name), email: String(me!.email), workspaceId: (me!.workspaceId as string) ?? null, isPlatformAdmin: me!.isPlatformAdmin === true });
  const snap = await providerSnapshot();
  writeJson(path.join(ctx.runDir, "provider-settings.json"), snap);
  save();
  out(`Signed in as the test owner "${me!.name}" (credentials in ${rel(ctx.credentialsPath)}, gitignored).`);
  out(`Workspace: ${me!.workspaceName} · ${c.workspace.country} · ${c.workspace.currency}`);
  out(`Live provider order (read-only snapshot, ${rel(path.join(ctx.runDir, "provider-settings.json"))}):`);
  out(`   ${((snap.adminOrder as string[] | null) ?? ["(none set — env/profile orders apply)"]).join(" → ")}`);
}

/* ------------------------------------------------------------------ */
/* Checkup conversation + extraction (onboarding-chat.tsx)              */
/* ------------------------------------------------------------------ */

function checkupState() {
  if (!rs.checkup) {
    rs.checkup = {
      opener: CHECKUP_OPENER,
      transcript: [],
      messages: [{ role: "ai", text: CHECKUP_OPENER, chips: CHECKUP_INTRO_CHIPS }],
      phase: "interview",
      slots: emptySlots(),
      askCounts: {},
      chips: CHECKUP_INTRO_CHIPS,
      finished: false,
    };
    // The opener is shown by the screen, and is part of the transcript the routes receive.
    rs.checkup.transcript.push({ role: "ai", text: CHECKUP_OPENER });
  }
  return rs.checkup;
}

function showCheckup(): void {
  const c = checkupState();
  const last = c.messages[c.messages.length - 1];
  out(`NELLOVIA: ${last.role === "ai" ? last.text : "(waiting for the reply)"}`);
  if (last.learned?.length) out(`   Understood as: ${last.learned.join(" | ")}`);
  if (c.chips.length && c.phase !== "done") {
    out(c.slots.pending === "otherChallenges" ? "   Tap any that apply — or type your own:" : "   Tap an answer — or type your own:");
    numbered(c.chips);
  }
  const s = c.slots;
  const learned = (Object.keys(s) as (keyof CheckupSlots)[])
    .filter((k) => !["pending", "declined", "corrections"].includes(k) && s[k] !== undefined && !(Array.isArray(s[k]) && (s[k] as unknown[]).length === 0 && k !== "otherChallenges"))
    .map((k) => `${k}=${JSON.stringify(s[k])}`);
  out(`   [phase ${c.phase} · asking about ${s.pending ?? "—"} · owner turns ${c.transcript.filter((t) => t.role === "user").length}${s.declined.length ? ` · skipped ${s.declined.join(",")}` : ""}]`);
  if (learned.length) out(`   [side panel] ${learned.join(" · ")}`);
}

async function finishCheckup(): Promise<void> {
  const c = checkupState();
  const uw = ws();
  const r = await apiCall<{ ok?: boolean; facts?: BusinessFacts; ack?: string | null; degraded?: boolean }>(ctx, "checkup-extract", "/api/checkup/extract", {
    workspaceName: uw.name ?? "Your business",
    country: uw.country ?? "Nigeria",
    currency: uw.currency,
    transcript: c.transcript,
    slots: c.slots,
  });
  out(`   extract: ${callLine(r as ApiResult)}`);
  if (!r.json.ok || !r.json.facts) {
    out("   The extraction failed — the screen would fall back to its offline facts. Stopping so the run can be repeated.");
    return;
  }
  S().setCheckupFacts(r.json.facts, [...c.transcript]);
  c.messages.push({ role: "ai", text: CHECKUP_DONE });
  c.finished = true;
  out(`NELLOVIA: ${CHECKUP_DONE}`);
  out(`   [the screen moves to the diagnosis — run \`diagnosis\`]`);
}

async function checkupSay(message: string): Promise<void> {
  const c = checkupState();
  if (c.phase === "done") throw new Error("The checkup is finished.");
  const uw = ws();
  c.transcript.push({ role: "user", text: message });
  c.messages.push({ role: "user", text: message });
  const userTurns = c.transcript.filter((t) => t.role === "user").length;
  const r = await apiCall<{ ok?: boolean } & Partial<ChatTurnResult>>(ctx, "checkup-chat", "/api/checkup/chat", {
    workspaceName: uw.name ?? "Your business",
    country: uw.country ?? "Nigeria",
    currency: uw.currency,
    transcript: c.transcript,
    phase: c.phase,
    slots: c.slots,
    askCounts: c.askCounts,
  });
  out(`   ${callLine(r as ApiResult)}`);
  const d = r.json;
  if (!d?.ok || typeof d.reply !== "string" || d.reply.length === 0) {
    c.messages.push({ role: "ai", text: "Sorry — I lost the connection for a moment. Could you send that again?", note: true });
    c.chips = [];
    save();
    out("NELLOVIA (connection note, not part of the transcript): Sorry — I lost the connection for a moment. Could you send that again?");
    return;
  }
  c.transcript.push({ role: "ai", text: d.reply });
  c.messages.push({ role: "ai", text: d.reply, learned: d.learnedChips ?? [], degraded: d.degraded === true, chips: d.chips ?? [] });
  c.phase = (d.phase ?? "interview") as CheckupPhase;
  c.slots = d.slots ?? c.slots;
  c.askCounts = d.askCounts ?? {};
  c.chips = d.chips ?? [];
  if (d.degraded) out("   (Simple mode — the reply came from the offline fallback)");
  showCheckup();
  save();
  if (c.phase === "done" || userTurns + 1 >= CHECKUP_MAX_USER_TURNS) {
    await finishCheckup();
    save();
  }
}

async function checkupTap(arg: string): Promise<void> {
  const c = checkupState();
  const picks = arg.split(",").map((n) => Number(n.trim()) - 1);
  const chosen = picks.map((i) => c.chips[i]).filter(Boolean);
  if (!chosen.length) throw new Error(`No tap answer ${arg}`);
  // "Anything else holding you back?": several can be picked and sent together; "No, that's the main one" goes alone.
  const message = c.slots.pending === "otherChallenges" && !chosen.includes(NONE_CHIP) ? chosen.slice(0, 3).join("; ") : chosen[0];
  out(`OWNER (tap): ${message}`);
  await checkupSay(message);
}

/* ------------------------------------------------------------------ */
/* Diagnosis (diagnosis-view.tsx generate())                            */
/* ------------------------------------------------------------------ */

async function diagnosis(): Promise<void> {
  const s = S();
  const facts = s.checkup.facts;
  if (!facts) throw new Error("No checkup facts yet.");
  const uw = ws();
  const f = focus();
  const openOthers = own().filter((c) => c.id !== f?.id && (c.status === "working" || c.status === "up-next"));
  const learnings = s.coach.learnings.map((l) => l.text);
  const tried = s.coach.steps.filter((x) => x.workspaceId === OWN).map((x) => x.step.title);
  const chooseFocus = Boolean(f) && openOthers.length > 0 && !s.challengePlanAt && tried.length === 0;
  const r = await apiCall<{ ok?: boolean; diagnosis?: DiagnosisContent; plan?: ChallengePlan | null; degraded?: boolean }>(ctx, "diagnosis", "/api/checkup/diagnosis", {
    workspaceName: uw.name ?? "Your business",
    country: uw.country ?? "Nigeria",
    currency: uw.currency ?? "₦",
    facts,
    transcript: [...(f?.transcript ?? []), ...s.checkup.transcript],
    learnings,
    tried,
    challenge: f ? challengePayload(f) : null,
    others: openOthers.map(challengePayload),
    chooseFocus,
  });
  out(`   ${callLine(r as ApiResult)}${r.json.degraded ? " · DEGRADED (ready-made template shown)" : ""}`);
  if (!r.json.ok || !r.json.diagnosis) {
    out("   The diagnosis failed — the page shows a retry.");
    return;
  }
  if (r.json.plan && chooseFocus) S().applyChallengePlan(r.json.plan, r.json.diagnosis);
  else S().setCheckupDiagnosis(r.json.diagnosis);
  save();
  showDiagnosis();
}

function showDiagnosis(): void {
  const d = S().checkup.diagnosis;
  if (!d) return out("(no diagnosis yet)");
  out(`HEADLINE: ${d.headline}`);
  if (d.working) out(`WHAT'S WORKING: ${d.working}`);
  if (d.insight) out(`INSIGHT: ${d.insight}`);
  out(`STORY: ${d.story}`);
  out(`MEANING: ${d.meaning}`);
  out(`WHY IT MATTERS: ${d.whyItMatters}`);
  out(`FIRST, THIS WEEK: ${d.nextInvestigation}`);
  if (d.stake) out(`WHAT IT'S WORTH: ${d.stake.figure} — ${d.stake.label}${d.stake.detail ? ` (${d.stake.detail})` : ""}\n   working: ${d.stake.working.join(" / ")}`);
  out(`FOCUS: ${d.focusStage} · confidence ${d.confidence}% · checked ${d.checked === true}`);
  (d.steps ?? []).forEach((st, i) => out(`STEP ${i + 1}: ${st}`));
  (d.tools ?? []).forEach((t, i) => out(`TOOL ${i + 1} [${t.kind}] ${t.title}${t.when ? ` — ${t.when}` : ""}\n   ${t.body.replace(/\n/g, "\n   ")}`));
  if (d.nextStep) {
    const n = d.nextStep;
    out(`NEXT STEP [${n.kind}, ${n.days} days${n.unit ? `, counts ${n.unit}` : ""}]: ${n.title}\n   why: ${n.why}\n   how: ${n.how.join(" / ")}${n.measure ? `\n   measure: ${n.measure}` : ""}${n.draft ? `\n   draft button: "${n.draft.label}" (${n.draft.kind}) — ${n.draft.purpose}` : ""}`);
  }
  const plan = own().map((c) => `${c.status === "working" ? "WORKING ON" : c.status.toUpperCase()}: ${c.title} (${c.stage})${c.whyFirst ? ` — why first: ${c.whyFirst}` : ""}${c.orderReason ? ` — ${c.orderReason}` : ""}`);
  if (plan.length) out(`CHALLENGES:\n   ${plan.join("\n   ")}`);
}

/* ------------------------------------------------------------------ */
/* Improve my diagnosis (improve-diagnosis.tsx)                         */
/* ------------------------------------------------------------------ */

function improveRows(): { name: string; hint: string }[] {
  const facts = S().checkup.facts;
  if (facts?.channels && facts.channels.length >= 1) {
    const ownRows = facts.channels.slice(0, 3).map((name, i) => ({ name, hint: i === 0 ? "From your checkup conversation" : "Enter last month's counts" }));
    return ownRows.length === 1 ? [...ownRows, { name: "Everything else", hint: "Any other way people found you" }] : ownRows;
  }
  return [
    { name: "Instagram", hint: "Most enquiries, fewest customers per enquiry" },
    { name: "Google Search", hint: "Smaller volume, strong conversion" },
    { name: "Referral", hint: "Best conversion, no ad spend" },
  ];
}

async function improve(json: string): Promise<void> {
  const facts = S().checkup.facts;
  if (!facts) throw new Error("No checkup facts yet.");
  const rows = improveRows();
  const counts = JSON.parse(json) as [number, number][];
  const filled = rows.map((ch, i) => ({ name: ch.name, enquiries: Math.max(0, Math.round(counts[i]?.[0] ?? 0)), customers: Math.max(0, Math.round(counts[i]?.[1] ?? 0)) }));
  const usable = filled.filter((r) => r.enquiries > 0);
  out(`OWNER (form): ${filled.map((r) => `${r.name}: ${r.enquiries} asked, ${r.customers} paid`).join(" · ")}`);
  if (!usable.length) return out("   The form says: Add enquiries for at least one channel.");
  const r = await apiCall<{ ok?: boolean; improved?: ImprovedDiagnosis; degraded?: boolean }>(ctx, "improve", "/api/checkup/improve", { workspaceName: ws().name ?? "Your business", facts, channels: usable });
  out(`   ${callLine(r as ApiResult)}${r.json.degraded ? " · DEGRADED (computed narrative)" : ""}`);
  if (!r.json.ok || !r.json.improved) return out("   Improve failed — the screen stores the measured rows with its template narrative.");
  S().setImprovedDiagnosis(r.json.improved);
  save();
  const im = r.json.improved;
  out(`SHARPENED HEADLINE: ${im.headline}\nSTORY: ${im.story}\nMEANING: ${im.meaning}\nWHY IT MATTERS: ${im.whyItMatters}\nNEXT: ${im.nextInvestigation}\nROWS: ${im.channelRows.map((x) => `${x.name} ${x.customers}/${x.enquiries} = ${x.conversion}%`).join(" · ")} · confidence ${im.confidence}%`);
}

/* ------------------------------------------------------------------ */
/* Next step + check-in (shared/coach.tsx, actions/check-in.tsx)        */
/* ------------------------------------------------------------------ */

function acceptStep(arg: string): void {
  const s = S();
  const step = s.checkup.diagnosis?.nextStep;
  if (!step) throw new Error("The diagnosis has no next step.");
  if (step.kind === "experiment") {
    const suggested = suggestedBaseline(step, s.checkup.facts);
    const choices = [...(suggested ? [suggested] : []), ...(step.unit === "count" ? COUNT_CHOICES : IN10_CHOICES).filter((c) => c.value !== suggested?.value)];
    if (!arg) {
      out(`Before you start — one number: ${baselineQuestion(step)}`);
      choices.forEach((c, i) => out(`   [${i + 1}] ${c.label}`));
      out("   …or `accept-step none` for “Not sure? Start without measuring”.");
      return;
    }
    const asRecommendation = arg === "none";
    const baseline = asRecommendation ? undefined : choices[Number(arg) - 1]?.value;
    if (!asRecommendation && !baseline) throw new Error(`No choice ${arg}`);
    s.acceptNextStep(step, { baseline, asRecommendation, challengeId: focus()?.id });
  } else {
    s.acceptNextStep(step, { challengeId: focus()?.id });
  }
  save();
  const active = S().coach.steps.find((x) => x.workspaceId === OWN && x.status === "active");
  out(`Started: ${active?.step.title} (${active?.step.kind}, ${active?.step.days} days)${active?.baseline ? ` · starting point ${active.baseline}` : ""} · check-ins: ${active?.checkIns.map((c) => `${c.kind} ${c.dueAt.slice(0, 10)}`).join(", ")}`);
}

/** Test set-up: move the step being tried N days into the past, as if that time had gone by. */
function timeTravel(days: number): void {
  const s = S();
  const shift = (iso: string) => new Date(new Date(iso).getTime() - days * 86_400_000).toISOString();
  const active = s.coach.steps.find((x) => x.workspaceId === OWN && x.status === "active");
  if (!active) throw new Error("No step is being tried.");
  // Everything dated on the step moves together: when it started, its check-ins, and drafts copied for it.
  const steps = s.coach.steps.map((x) =>
    x.id === active.id
      ? {
          ...x,
          acceptedAt: shift(x.acceptedAt),
          checkIns: x.checkIns.map((c) => (c.doneAt ? c : { ...c, dueAt: shift(c.dueAt) })),
          draftUses: x.draftUses.map((u) => ({ ...u, at: shift(u.at) })),
        }
      : x,
  );
  useBizz.setState({ coach: { ...s.coach, steps } });
  // Persist the way the store does (completeCheckIn and friends read it back on the next command).
  S().makeCheckInDue(active.id);
  rs.notes.push(`time-travel: "${active.step.title}" moved ${days} days into the past (accepted ${shift(active.acceptedAt).slice(0, 10)}), so the check-in runs as if ${days} days had passed.`);
  save();
  const st = S().coach.steps.find((x) => x.id === active.id)!;
  out(`Moved ${days} days on: day ${Math.min(st.step.days, daysSince(st.acceptedAt) + 1)} of ${st.step.days}; next check-in due ${nextCheckIn(st.checkIns)?.checkIn.dueAt.slice(0, 16)}.`);
}

function checkinOpen(): void {
  const s = S();
  const st = s.coach.steps.find((x) => x.workspaceId === OWN && x.status === "active");
  if (!st) throw new Error("No step is being tried.");
  const target = nextCheckIn(st.checkIns);
  if (!target) throw new Error("Nothing left to check in on.");
  const kind = target.checkIn.kind;
  const day = Math.min(st.step.days, daysSince(st.acceptedAt) + 1);
  const lastDraft = st.draftUses.length ? st.draftUses[st.draftUses.length - 1] : null;
  const q = nextCheckInQuestion({ step: st.step, kind, facts: s.checkup.facts, lastDraft, answers: [] });
  const firstName = s.user.name.split(" ")[0];
  const opener = kind === "end"
    ? `Hi ${firstName} — that's the ${st.step.days} days done on “${st.step.title}”. A few quick taps and I'll tell you what it showed.`
    : `Hi ${firstName} — quick check-in, day ${day} of ${st.step.days}. Just a few taps.`;
  rs.checkin = { stepId: st.id, checkInId: target.checkIn.id, kind, day, answers: [], question: q, thread: [{ role: "ai", text: opener }, ...(q ? [{ role: "ai" as const, text: q.text }] : [])] };
  save();
  out(`NELLOVIA: ${opener}`);
  if (q) showCheckinQuestion(q);
}

function showCheckinQuestion(q: CheckInQuestion): void {
  out(`NELLOVIA: ${q.text}${q.why ? `\n   (why: ${q.why})` : ""}`);
  numbered(q.choices);
  out(`   …or type (${q.placeholder})`);
}

async function checkinAnswer(answerText: string, typed: boolean): Promise<void> {
  const s = S();
  const ci = rs.checkin;
  if (!ci || !ci.question) throw new Error("No check-in question open — run `checkin`.");
  const st = s.coach.steps.find((x) => x.id === ci.stepId)!;
  const q = ci.question;
  const all: CheckInAnswer[] = [...ci.answers, { id: q.id, question: q.text, answer: answerText, ...(typed ? { typed: true } : {}) }];
  ci.answers = all;
  const ack = acknowledge(q.id, answerText);
  const lastDraft = st.draftUses.length ? st.draftUses[st.draftUses.length - 1] : null;
  const next = nextCheckInQuestion({ step: st.step, kind: ci.kind as "mid" | "end" | "weekly", facts: s.checkup.facts, lastDraft, answers: all });
  ci.thread.push({ role: "user", text: answerText }, { role: "ai", text: next ? `${ack} ${next.text}` : ack });
  ci.question = next;
  save();
  if (next) {
    out(`NELLOVIA: ${ack}`);
    showCheckinQuestion(next);
    return;
  }
  out(`NELLOVIA: ${ack}`);
  const facts = s.checkup.facts;
  const diag = s.checkup.diagnosis;
  const challenge = st.challengeId ? s.challenges.find((c) => c.id === st.challengeId) ?? null : null;
  const uw = ws();
  const r = await apiCall<{ ok?: boolean; result?: CheckInResult }>(ctx, "coach-checkin", "/api/coach/checkin", {
    workspaceName: uw.name ?? "Your business",
    country: uw.country,
    currency: uw.currency,
    facts: facts ? { ...facts, facts: [], chips: [] } : null,
    stage: challenge && FOCUS_STAGES.some((x) => x.id === challenge.stage) ? challenge.stage : diag?.focusStage,
    challenge: challenge ? { id: challenge.id, title: challenge.title, stage: challenge.stage } : null,
    challenges: challengesContext(s.challenges.filter((c) => c.workspaceId === OWN)),
    step: st.step,
    baseline: st.baseline,
    kind: ci.kind,
    day: ci.day,
    answers: all,
    learnings: s.coach.learnings.map((l) => l.text).slice(-6),
    tried: s.coach.steps.filter((x) => x.workspaceId === st.workspaceId).map((x) => x.step.title),
  });
  out(`   ${callLine(r as ApiResult)}`);
  if (!r.json.ok || !r.json.result) return out("   The check-in failed — the screen shows a retry.");
  S().completeCheckIn({ stepId: st.id, checkInId: ci.checkInId, answers: all, result: r.json.result });
  ci.result = r.json.result;
  ci.thread.push({ role: "ai", text: r.json.result.reply });
  save();
  const res = r.json.result;
  out(`NELLOVIA: ${res.reply}\n   verdict ${res.verdict} · learned: ${res.learned}${res.after ? ` · count: ${res.after}` : ""}${res.tweak ? `\n   tweak: ${res.tweak}` : ""}${res.otherChanges?.length ? `\n   other changes: ${res.otherChanges.join("; ")}` : ""}${Object.keys(res.factUpdates ?? {}).length ? `\n   fact updates: ${JSON.stringify(res.factUpdates)}` : ""}${res.nextStep ? `\n   next step: [${res.nextStep.kind}] ${res.nextStep.title} — ${res.nextStep.why}` : ""}${res.newChallenge ? `\n   noticed challenge: ${res.newChallenge.title} (${res.newChallenge.stage})${res.newChallenge.sameAs ? ` same as ${res.newChallenge.sameAs}` : ""}` : ""}`);
}

/* ------------------------------------------------------------------ */
/* Ask (ask/index.tsx) and drafts (shared/try-this.tsx)                 */
/* ------------------------------------------------------------------ */

function askContext() {
  const s = S();
  const uw = ws();
  const months = ownerMonthsFromEntries(s.manualEntries);
  const last = months.length ? months[months.length - 1] : undefined;
  const prev = months.length > 1 ? months[months.length - 2] : undefined;
  const business = getBusiness(s.businessId, uw, s.checkup.facts, s.manualEntries);
  const f = s.checkup.facts;
  return {
    business: buildBusinessContext({
      workspace: uw,
      facts: f,
      diagnosis: s.checkup.diagnosis,
      months: months.map((m) => ({ label: m.label, revenue: m.revenue, enquiries: m.enquiries, customers: m.customers })),
      coaching: coachingContext(s.coach, s.businessId),
      challenges: challengesContext(s.challenges.filter((c) => c.workspaceId === OWN)),
      transcript: s.checkup.transcript,
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
          prev: prev ? { spend: prev.spend ?? 0, enquiries: prev.enquiries, customers: prev.customers, orders: prev.orders, traffic: prev.traffic, revenue: prev.revenue ?? 0 } : undefined,
        }
      : undefined,
    channelCounts: s.checkup.improved?.channelRows ?? undefined,
    userFacts: f ? { whatTheySell: f.whatTheySell, primaryGoal: f.primaryGoal, customers: f.customers, channels: f.channels, trends: f.trends, recentChanges: f.recentChanges } : null,
  };
}

async function ask(question: string, opts: { probe?: boolean } = {}): Promise<void> {
  if (!question) throw new Error("Type a question.");
  out(`OWNER${opts.probe ? " (stress probe, a fresh Ask session)" : ""}: ${question}`);
  const r = await apiCall<{ ok?: boolean; answer?: AskAnswerContent; error?: string }>(ctx, opts.probe ? "probe-ask" : "ask", "/api/ask", {
    question,
    // A probe is asked on its own, as if the owner opened Ask fresh — it never joins the scored thread.
    history: opts.probe ? [] : rs.ask.slice(-4).map((t) => ({ question: t.question, summary: t.answer.grounded.join(" ").slice(0, 420) })),
    workspace: askContext(),
  });
  out(`   ${callLine(r as ApiResult)}`);
  const a = r.json.answer;
  if (!r.json.ok || !a || !a.grounded?.length) return out(`   (failed card with a retry: ${r.json.error ?? "no answer"})`);
  if (!opts.probe) {
    rs.ask.push({ question, answer: a });
    S().recordAsk({ workspaceId: S().businessId, question, summary: [...a.grounded, a.interpretation ?? ""].join(" ").trim().slice(0, 700), period: a.referencedPeriod ?? "" });
  }
  save();
  a.grounded.forEach((p) => out(`NELLOVIA: ${p}`));
  if (a.interpretation) out(`   What I think is going on: ${a.interpretation}`);
  if (a.tryThis) out(`   [copy box] ${a.tryThis.title}\n   ${a.tryThis.body.replace(/\n/g, "\n   ")}`);
  (a.limitations ?? []).forEach((l) => out(`   Not known yet: ${l}`));
  (a.evidence ?? []).forEach((e) => out(`   evidence: ${e.label} = ${e.value} (${e.provenance}, ${e.source})`));
  if (a.draft) out(`   [button] ${a.draft.label} — ${a.draft.kind}: ${a.draft.purpose}`);
  if (a.newChallenge) out(`   [card] Add to your challenges? ${a.newChallenge.title} (${a.newChallenge.stage})${a.newChallenge.sameAs ? ` — same as ${a.newChallenge.sameAs}` : ""}`);
  if (a.followUps?.length) out(`   follow-ups: ${a.followUps.join(" | ")}`);
  out(`   verified ${a.verified !== false} · period ${a.referencedPeriod}`);
}

async function draft(source: string): Promise<void> {
  const s = S();
  let hint: DraftHint | null = null;
  if (!source || source === "ask") hint = [...rs.ask].reverse().find((t) => t.answer.draft)?.answer.draft ?? null;
  else if (source === "step") hint = s.checkup.diagnosis?.nextStep?.draft ?? null;
  if (!hint) throw new Error(`No draft button for "${source || "ask"}".`);
  const fixed = fixDraftHint(hint);
  const uw = ws();
  const tweak = flags.tweak;
  const current = tweak ? (readJson<{ body?: string } | null>(path.join(ctx.runDir, "state", "last-draft.json"), null)?.body ?? "") : undefined;
  out(`OWNER (taps): ${fixed.label}`);
  const r = await apiCall<{ ok?: boolean; kind?: string; draft?: { title?: string; subject?: string; body: string }; degraded?: boolean }>(ctx, tweak ? `draft-${tweak}` : "draft", "/api/draft", {
    kind: fixed.kind,
    purpose: fixed.purpose,
    label: fixed.label,
    workspaceName: uw.name ?? s.settings.businessName,
    currency: uw.currency,
    location: uw.country,
    website: uw.website,
    facts: s.checkup.facts ? { ...s.checkup.facts, facts: [], chips: [] } : null,
    ownerWords: ownerWordsFrom(s.checkup.transcript),
    ...(tweak ? { tweak, current } : {}),
  });
  out(`   ${callLine(r as ApiResult)}${r.json.degraded ? " · DEGRADED (template)" : ""}`);
  if (!r.json.ok || !r.json.draft) return out("   Couldn't write it just now.");
  writeJson(path.join(ctx.runDir, "state", "last-draft.json"), { hint: fixed, ...r.json.draft });
  out(`DRAFT [${r.json.kind}] ${r.json.draft.title ?? ""}${r.json.draft.subject ? `\nSubject: ${r.json.draft.subject}` : ""}\n${r.json.draft.body}`);
}

function copyDraft(): void {
  const d = readJson<{ hint?: DraftHint } | null>(path.join(ctx.runDir, "state", "last-draft.json"), null);
  if (!d?.hint) throw new Error("No draft open.");
  S().logDraftUse(d.hint.label, "copied");
  save();
  out(`Copied "${d.hint.label}" (noted on the step being tried, if any).`);
}

/* ------------------------------------------------------------------ */
/* Brief (reports-archive.tsx) and insights (insights-client.ts)        */
/* ------------------------------------------------------------------ */

async function brief(kind: string): Promise<void> {
  const s = S();
  const facts = s.checkup.facts;
  if (!facts) throw new Error("No checkup facts yet.");
  const uw = ws();
  const months = ownerMonthsFromEntries(s.manualEntries).slice(-3).map((m) => ({ label: m.label, revenue: m.revenue, enquiries: m.enquiries, customers: m.customers }));
  const r = await apiCall<{ ok?: boolean; brief?: Brief }>(ctx, "brief", "/api/brief/generate", {
    workspaceName: uw.name,
    country: uw.country,
    kind: kind === "monthly" ? "monthly" : "weekly",
    facts,
    context: buildBusinessContext({ workspace: uw, facts, diagnosis: s.checkup.diagnosis, months, transcript: s.checkup.transcript }),
    months,
  });
  out(`   ${callLine(r as ApiResult)}`);
  if (!r.json.ok || !r.json.brief) return out("   Could not write the brief.");
  S().setAiBrief(r.json.brief);
  save();
  out(`BRIEF: ${r.json.brief.title}`);
  for (const sec of r.json.brief.sections) {
    out(`## ${sec.heading}`);
    (sec.paragraphs ?? []).forEach((p) => out(p));
    (sec.bullets ?? []).forEach((b) => out(`- ${b}`));
  }
}

async function insights(): Promise<void> {
  asFeature("insights");
  const ok = await generateOwnerInsights();
  save();
  const last = readLastCall("insights");
  if (last) out(`   ${last}`);
  if (!ok) return out("   Could not generate insights.");
  S().aiInsights.forEach((i: Insight, n: number) => {
    const extra = i as Insight & Record<string, unknown>;
    out(`INSIGHT ${n + 1} [${i.type}] ${i.title}\n   ${i.summary}${extra.recommendedAction ? `\n   do: ${extra.recommendedAction}` : ""}${extra.draft ? `\n   draft button: ${(extra.draft as DraftHint).label}` : ""}`);
  });
}

function readLastCall(feature: string): string | null {
  const calls = readCalls().filter((c) => c.feature === feature);
  const c = calls[calls.length - 1];
  if (!c) return null;
  return callLine({ status: c.status, ms: c.ms, gateway: c.gateway, record: c, json: c.response as Record<string, unknown> });
}

function readCalls(): CallRecord[] {
  if (!existsSync(ctx.callsPath)) return [];
  return readFileSync(ctx.callsPath, "utf8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as CallRecord);
}

/* ------------------------------------------------------------------ */
/* Challenges chat (challenges/challenge-chat.tsx)                      */
/* ------------------------------------------------------------------ */

function challengeNew(): void {
  const s = S();
  const facts = s.checkup.facts;
  if (rs.challenge && rs.challenge.phase === "chat") rs.challengeChats.push({ id: rs.challenge.id, transcript: rs.challenge.transcript, phase: "abandoned" });
  const examples = otherChallengeChips(
    { sells: facts?.whatTheySell, businessType: facts?.businessType === "ecommerce" ? "I sell products" : undefined, targetMarket: facts?.customers, channels: facts?.channels },
    own().filter((c) => c.status === "working" || c.status === "up-next").map((c) => c.title),
    { includeNone: false, limit: 4 },
  );
  rs.challenge = { id: null, transcript: [{ role: "ai", text: CHALLENGE_OPENER }], state: { answers: {} }, chips: examples, phase: "chat" };
  save();
  out(`NELLOVIA: ${CHALLENGE_OPENER}`);
  numbered(examples);
}

async function challengeSay(message: string): Promise<void> {
  const ch = rs.challenge;
  if (!ch || ch.phase !== "chat") throw new Error("No challenge chat open — run `challenge-new`.");
  const s = S();
  const uw = ws();
  ch.transcript.push({ role: "user", text: message });
  const r = await apiCall<{ ok?: boolean } & ChallengeTurnResult>(ctx, "challenges-chat", "/api/challenges/chat", {
    workspaceName: uw.name ?? "Your business",
    country: uw.country,
    currency: uw.currency,
    facts: s.checkup.facts ? ({ ...s.checkup.facts, facts: [], chips: [] } as BusinessFacts) : null,
    challenge: null,
    others: own().filter((c) => c.id !== ch.id).map((c) => ({ id: c.id, title: c.title, status: c.status })),
    transcript: ch.transcript,
    state: ch.state,
  });
  out(`   ${callLine(r as unknown as ApiResult)}`);
  const d = r.json;
  if (!d.ok || typeof d.reply !== "string") {
    ch.transcript.pop();
    save();
    return out("NELLOVIA (connection note): Sorry — I lost the connection for a moment. Could you send that again?");
  }
  ch.state = d.state;
  ch.transcript.push({ role: "ai", text: d.reply });
  ch.chips = d.chips ?? [];
  out(`NELLOVIA: ${d.reply}${d.why ? `\n   (why: ${d.why})` : ""}`);
  numbered(ch.chips);
  if (d.phase === "done" && d.linkedTo) {
    S().addChallengeAngle(d.linkedTo, { text: d.details.what ?? ch.transcript.find((t) => t.role === "user")?.text ?? "", source: "reported", details: d.details });
    ch.phase = "linked";
    ch.linkedTo = d.linkedTo;
    rs.challengeChats.push({ id: ch.id, transcript: ch.transcript, phase: "linked", linkedTo: d.linkedTo });
    save();
    return out(`   [linked to the challenge already on the list: ${S().challenges.find((c) => c.id === d.linkedTo)?.title}]`);
  }
  if (!ch.id && d.state.pending !== "link") {
    ch.id = S().addChallenge({
      title: d.state.title ?? d.details.what ?? "What's holding the business back",
      source: "reported",
      stage: d.state.stage,
      details: d.details,
      transcript: [...ch.transcript],
      chatDone: false,
    });
  }
  if (ch.id) {
    S().updateChallenge(ch.id, {
      details: d.details as ChallengeDetails,
      transcript: [...ch.transcript],
      ...(d.state.title ? { title: d.state.title } : {}),
      ...(d.state.stage ? { stage: d.state.stage } : {}),
      chat: d.phase === "done" ? null : { state: d.state, chips: d.chips, why: d.why },
      chatDone: d.phase === "done",
    });
  }
  if (Object.keys(d.factUpdates ?? {}).length) S().patchCheckupFacts(d.factUpdates as Partial<BusinessFacts>);
  save();
  if (d.phase === "done" && ch.id) {
    ch.phase = "done";
    rs.challengeChats.push({ id: ch.id, transcript: ch.transcript, phase: "done" });
    save();
    out("   [diagnosing this challenge…]");
    asFeature("challenge-diagnosis");
    const diag = await requestChallengeDiagnosis(ch.id);
    save();
    const last = readLastCall("challenge-diagnosis");
    if (last) out(`   ${last}`);
    if (!diag) return out("   The challenge's diagnosis failed (the page shows a retry).");
    out(`CHALLENGE DIAGNOSIS: ${diag.headline}\n   ${diag.insight ?? ""}\n   meaning: ${diag.meaning}\n   first: ${diag.nextInvestigation}${diag.nextStep ? `\n   next step: [${diag.nextStep.kind}] ${diag.nextStep.title} — ${diag.nextStep.why}` : ""}${(diag.steps ?? []).map((x, i) => `\n   step ${i + 1}: ${x}`).join("")}`);
    out(`CHALLENGES NOW:\n   ${own().map((c) => `${c.status}: ${c.title} (${c.stage})`).join("\n   ")}`);
  }
}

async function challengeTap(arg: string): Promise<void> {
  const ch = rs.challenge;
  const chip = ch?.chips[Number(arg) - 1];
  if (!chip) throw new Error(`No tap answer ${arg}`);
  out(`OWNER (tap): ${chip}`);
  await challengeSay(chip);
}

/* ------------------------------------------------------------------ */
/* Specialist matching (market/task-post.tsx → task-detail.tsx)         */
/* ------------------------------------------------------------------ */

async function match(): Promise<void> {
  const t = ctx.evalCase.specialistTask;
  out(`OWNER (task form): title "${t.title}" · category ${t.category} · skills ${t.skills.join(", ")}${t.budgetMin ? ` · budget ₦${t.budgetMin}–₦${t.budgetMax}` : ""}\n   ${t.description}`);
  out("   [Posting the task is stubbed out: it would publish to the shared marketplace. Only the match runs.]");
  const r = await apiCall<{ ok?: boolean; aiInterpreted?: boolean; category?: string; skillsToSeek?: string[]; note?: string; matches?: { id?: string; name?: string; reason?: string; hourlyRate?: number; specialist?: Record<string, unknown> }[]; error?: string }>(ctx, "specialist-match", "/api/market/match", { title: t.title, description: t.description, category: t.category, skills: t.skills });
  out(`   ${callLine(r as ApiResult)}`);
  if (!r.json.ok) return out(`   Match failed: ${r.json.error}`);
  out(`AI interpreted: ${r.json.aiInterpreted} · category ${r.json.category} · look for: ${(r.json.skillsToSeek ?? []).join(", ")}\nNOTE: ${r.json.note}`);
  for (const m of r.json.matches ?? []) {
    const sp = (m.specialist ?? m) as Record<string, unknown>;
    out(`   - ${sp.name ?? m.name} (${sp.category ?? ""}, ₦${sp.hourlyRate ?? m.hourlyRate ?? "?"}/hr, rating ${sp.rating ?? "?"}): ${m.reason ?? ""}`);
  }
}

/* ------------------------------------------------------------------ */
/* Plain-AI comparison                                                  */
/* ------------------------------------------------------------------ */

async function plain(): Promise<void> {
  const diagCall = readCalls().find((c) => c.feature === "diagnosis" && c.gateway.some((g) => g.servedBy));
  const served = diagCall?.gateway.find((g) => g.servedBy);
  if (!served?.servedBy || !served.model) throw new Error("Run the diagnosis first — the comparison uses the model that answered it.");
  const messages: PlainTurn[] = [{ role: "system", content: "You are a helpful business advisor" }];
  const turns = [ctx.evalCase.plainAiMessage, ...ctx.evalCase.followUps];
  for (let i = 0; i < turns.length; i++) {
    messages.push({ role: "user", content: turns[i] });
    const maxTokens = i === 0 ? 3500 : 2600; // the same budgets as Nellovia's diagnosis and Ask
    const res = await plainChat(served.servedBy, served.model, messages, maxTokens);
    messages.push({ role: "assistant", content: res.text });
    const record: CallRecord = {
      seq: readCalls().length + 1,
      at: new Date().toISOString(),
      run: ctx.run,
      feature: i === 0 ? "plain-ai-diagnosis" : "plain-ai-ask",
      method: "POST",
      route: `direct:${served.servedBy}`,
      status: 200,
      ms: res.ms,
      request: { messages: messages.slice(0, -1) },
      response: { text: res.text },
      gateway: [{ profile: "plain", maxTokens, servedBy: served.servedBy, model: served.model, latencyMs: res.ms, totalMs: res.ms, usage: res.usage, attempts: [{ routeLabel: served.servedBy, model: served.model, ok: true, latencyMs: res.ms }], systemHead: "You are a helpful business advisor", replyChars: res.text.length }],
      tokens: { prompt: res.usage.promptTokens, completion: res.usage.completionTokens, total: res.usage.totalTokens },
    };
    appendFileSync(ctx.callsPath, `${JSON.stringify(record)}\n`);
    out(`--- plain AI (${served.servedBy}, ${served.model}) · ${res.ms} ms · ${res.usage.totalTokens} tokens\nOWNER: ${turns[i]}\nPLAIN AI: ${res.text}\n`);
  }
}

/* ------------------------------------------------------------------ */
/* Side checks                                                          */
/* ------------------------------------------------------------------ */

async function fallback(modeArg: string): Promise<void> {
  const snap = readJson<{ adminOrder?: string[] | null; providers?: { id: string; enabled: boolean }[] } | null>(path.join(ctx.runDir, "provider-settings.json"), null);
  const first = (snap?.adminOrder ?? []).find((id) => snap?.providers?.find((p) => p.id === id)?.enabled);
  if (!first) throw new Error("No live provider order in provider-settings.json — run `setup`.");
  // "timeout" (both), "timeout:chat" or "timeout:ask" (one replay, e.g. to test the quality profile on its own).
  const [modeOnly, which] = (modeArg || "").split(":");
  const modes = modeOnly ? [modeOnly] : ["http500", "timeout"];
  const calls = readCalls();
  const replays = [which === "ask" ? undefined : calls.find((c) => c.feature === "checkup-chat"), which === "chat" ? undefined : calls.find((c) => c.feature === "ask")].filter((c): c is CallRecord => Boolean(c));
  for (const mode of modes) {
    writeFileSync(ctx.faultsPath, JSON.stringify({ providers: [first], mode }));
    try {
      for (const c of replays) {
        const r = await apiCall(ctx, `fallback-${mode}-${c.feature}`, c.route, c.request);
        out(`${mode} on ${first}, replaying ${c.feature}: ${callLine(r as ApiResult)}\n   attempts: ${r.gateway.flatMap((g) => g.attempts.map((a) => `${a.routeLabel} ${a.ok ? "ok" : `failed (${a.error?.slice(0, 60)})`} ${a.latencyMs} ms`)).join(" → ")}`);
      }
    } finally {
      rmSync(ctx.faultsPath, { force: true });
    }
  }
  out(`Faults file removed (${rel(ctx.faultsPath)}).`);
}

function groundingCheck(): void {
  // 1) Probes: invented figures in every format an answer might use, against this owner's own figures.
  const allowed = collectAllowedNumbers(ctx.evalCase.ownerNumbers);
  const probes: { text: string; invented: boolean; note: string }[] = [
    { text: "Your rent is ₦3.6m and you have ₦700k in cash.", invented: false, note: "owner's own figures" },
    { text: "You have ₦700,000 now.", invented: false, note: "owner's figure, other format" },
    { text: "Takings of ₦55,000–70,000 a day over 26 days.", invented: false, note: "owner's range" },
    { text: "You could raise ₦5m from a new loan.", invented: true, note: "invented amount, ₦ + m" },
    { text: "That is about N4.2m.", invented: true, note: "invented amount, N prefix" },
    { text: "You probably make about 1.5m a month after costs.", invented: true, note: "invented amount, bare m suffix" },
    { text: "Your margin is about 35%.", invented: true, note: "invented percentage" },
    { text: "Expect around 2.2 million naira next month.", invented: true, note: "invented amount, words for the scale" },
    { text: "You could save three hundred thousand naira.", invented: true, note: "invented amount in words" },
    { text: "Sales are ₦1,820,000 a month.", invented: true, note: "derived figure not given (70k × 26)" },
    { text: "Raise prices by 15%.", invented: true, note: "a percentage the owner never gave" },
  ];
  out("GROUNDING PROBES (allowed = every figure this owner ever gives):");
  const results = probes.map((p) => {
    const flagged = ungroundedNumbers(p.text, allowed);
    const pass = p.invented ? flagged.length > 0 : flagged.length === 0;
    out(`   ${pass ? "PASS" : "MISS"} ${p.invented ? "invented" : "owner's "} · ${p.note}: "${p.text}" → flagged ${JSON.stringify(flagged)}`);
    return { ...p, flagged, pass };
  });
  // 2) Audit: every figure in every AI answer of this run, against what the owner said plus the app's own computed lines.
  const calls = readCalls().filter((c) => !c.feature.startsWith("fallback") && !c.feature.startsWith("plain"));
  const ownerSaid = calls.flatMap((c) => ownerTextOf(c)).join("\n");
  const computed = calls.flatMap((c) => computedLinesOf(c)).join("\n");
  const allowedRun = collectAllowedNumbers(ownerSaid, computed);
  const audit: { seq: number; feature: string; figures: string[] }[] = [];
  for (const c of calls) {
    const said = answerTextOf(c);
    if (!said) continue;
    const figures = ungroundedNumbers(said, allowedRun);
    if (figures.length) audit.push({ seq: c.seq, feature: c.feature, figures });
  }
  out("AUDIT — figures in answers that the owner never said and the app never computed:");
  if (!audit.length) out("   none");
  audit.forEach((a) => out(`   #${a.seq} ${a.feature}: ${a.figures.join(", ")}`));
  writeJson(path.join(ctx.runDir, "grounding-check.json"), { probes: results, audit });
}

function ownerTextOf(c: CallRecord): string[] {
  const req = (c.request ?? {}) as Record<string, any>;
  const outText: string[] = [];
  for (const t of (req.transcript ?? []) as TranscriptTurn[]) if (t.role === "user") outText.push(t.text);
  if (typeof req.question === "string") outText.push(req.question);
  for (const a of (req.answers ?? []) as CheckInAnswer[]) outText.push(a.answer);
  for (const ch of (req.channels ?? []) as { enquiries: number; customers: number }[]) outText.push(`${ch.enquiries} ${ch.customers}`);
  return outText;
}

function computedLinesOf(c: CallRecord): string[] {
  const res = (c.response ?? {}) as Record<string, any>;
  const lines: string[] = [];
  if (res.diagnosis?.stake?.working) lines.push(...res.diagnosis.stake.working, res.diagnosis.stake.figure ?? "");
  // The money picture worked out in code (what is due vs cash, money in vs costs) — every feature is given these lines.
  if (Array.isArray(res.diagnosis?.money)) lines.push(...res.diagnosis.money);
  if (res.improved?.channelRows) lines.push(...res.improved.channelRows.map((r: { conversion: number; enquiries: number; customers: number }) => `${r.conversion}% ${r.enquiries} ${r.customers}`));
  return lines;
}

/** What the owner reads in an answer — prose only (no ids, confidence scores or other fields). */
function answerTextOf(c: CallRecord): string {
  const res = (c.response ?? {}) as Record<string, any>;
  const parts: string[] = [];
  const step = (n: any) => (n ? [n.title, n.why, ...(n.how ?? []), n.measure ?? ""].join(" ") : "");
  if (typeof res.reply === "string") parts.push(res.reply);
  if (res.diagnosis) {
    const d = res.diagnosis;
    parts.push([d.headline, d.insight, d.working, d.story, d.meaning, d.whyItMatters, d.nextInvestigation, ...(d.steps ?? []), ...(d.tools ?? []).map((t: any) => `${t.title} ${t.when ?? ""} ${t.body}`), step(d.nextStep)].join(" "));
  }
  if (res.improved) parts.push([res.improved.headline, res.improved.story, res.improved.meaning, res.improved.whyItMatters, res.improved.nextInvestigation].join(" "));
  if (res.answer) parts.push([...(res.answer.grounded ?? []), res.answer.interpretation ?? "", ...(res.answer.limitations ?? [])].join(" "));
  if (res.brief) parts.push(res.brief.sections.flatMap((s: any) => [...(s.paragraphs ?? []), ...(s.bullets ?? [])]).join(" "));
  if (res.insights) parts.push(res.insights.map((i: any) => [i.title, i.summary, i.recommendedAction ?? "", i.whyItMatters ?? ""].join(" ")).join(" "));
  if (res.result) parts.push([res.result.reply, res.result.learned, res.result.tweak ?? "", step(res.result.nextStep)].join(" "));
  if (res.draft) parts.push(res.draft.body ?? "");
  return parts.join("\n");
}

/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  switch (command) {
    case "server-cmd":
      out(`AI_GATEWAY_USAGE_FILE=${rel(ctx.usagePath)} AI_GATEWAY_TRACE_FILE=${rel(ctx.tracePath)} AI_GATEWAY_FAULTS_FILE=${rel(ctx.faultsPath)} npx next dev -p ${new URL(ctx.baseUrl).port || 3017}`);
      return;
    case "setup":
      return setup();
    case "checkup":
      return showCheckup();
    case "say":
      return checkupSay(text);
    case "tap":
      return checkupTap(text);
    case "diagnosis":
      return diagnosis();
    case "show":
      if (text === "diagnosis") return showDiagnosis();
      if (text === "facts") return out(JSON.stringify(S().checkup.facts, null, 2));
      if (text === "challenges") return out(JSON.stringify(own(), null, 2));
      if (text === "improved") return out(JSON.stringify(S().checkup.improved, null, 2));
      if (text === "step") return out(JSON.stringify(S().coach.steps.find((x) => x.workspaceId === OWN && x.status === "active") ?? null, null, 2));
      if (text === "notes") return out(rs.notes.join("\n") || "(none)");
      return out("show diagnosis|facts|challenges|improved|step|notes");
    case "improve-form":
      out("Improve my diagnosis — for each way people find you: how many asked, how many paid (estimates are fine):");
      improveRows().forEach((r, i) => out(`   row ${i + 1}: ${r.name} (${r.hint})`));
      return;
    case "improve":
      return improve(text);
    case "accept-step":
      return acceptStep(text);
    case "time-travel":
      return timeTravel(Number(text));
    case "checkin":
      return checkinOpen();
    case "checkin-say":
      return checkinAnswer(text, true);
    case "checkin-tap": {
      const q = rs.checkin?.question;
      const choice = q?.choices[Number(text) - 1];
      if (!choice) throw new Error(`No choice ${text}`);
      out(`OWNER (tap): ${choice}`);
      return checkinAnswer(choice, false);
    }
    case "ask":
      return ask(text);
    case "probe-ask":
      return ask(text, { probe: true });
    case "probe-anon": {
      // Security probe: an AI route called with no sign-in at all.
      const r = await apiCall(ctx, "probe-anon", "/api/draft", { kind: "whatsapp", label: "Write a message", purpose: "A short hello message to a customer", workspaceName: "Anonymous probe" }, { anonymous: true });
      out(`Anonymous call to /api/draft (no sign-in): ${callLine(r as ApiResult)} → ${r.status === 401 ? "refused (sign-in required)" : "ANSWERED — anyone could spend the AI credit"}`);
      return;
    }
    case "probe-double-fault": {
      // Reliability probe: the top two providers in the live order both fail.
      const snap = readJson<{ adminOrder?: string[] | null; providers?: { id: string; enabled: boolean }[] } | null>(path.join(ctx.runDir, "provider-settings.json"), null);
      const top = (snap?.adminOrder ?? []).filter((id) => snap?.providers?.find((p) => p.id === id)?.enabled).slice(0, 2);
      const replay = readCalls().find((c) => c.feature === "checkup-chat");
      if (top.length < 2 || !replay) throw new Error("Needs the live order and a recorded checkup turn.");
      writeFileSync(ctx.faultsPath, JSON.stringify({ providers: top, mode: "http500" }));
      try {
        const r = await apiCall(ctx, "probe-double-fault-checkup-chat", replay.route, replay.request);
        out(`${top.join(" + ")} failing, replaying a checkup turn: ${callLine(r as ApiResult)}\n   attempts: ${r.gateway.flatMap((g) => g.attempts.map((a) => `${a.routeLabel} ${a.ok ? "ok" : `failed (${(a.error ?? "").slice(0, 70)})`} ${a.latencyMs} ms`)).join(" → ")}\n   reply: ${String((r.json as { reply?: string }).reply ?? "").slice(0, 200)}${(r.json as { degraded?: boolean }).degraded ? " [Simple mode — offline fallback]" : ""}`);
      } finally {
        rmSync(ctx.faultsPath, { force: true });
      }
      return;
    }
    case "replay": {
      // Re-check a fix: send a recorded request again, to the same route, on the current code.
      const seq = Number(text);
      const rec = readCalls().find((c) => c.seq === seq);
      if (!rec) throw new Error(`No recorded call #${text}.`);
      const r = await apiCall(ctx, `recheck-${rec.feature}`, rec.route, rec.request);
      const res = r.json as Record<string, any>;
      const lines: string[] = [`#${seq} ${rec.feature} again: ${callLine(r as ApiResult)}`];
      if (typeof res.reply === "string") lines.push(`   reply: ${res.reply}${res.degraded ? " [no-AI turn]" : ""}`);
      const d = res.diagnosis;
      if (d) {
        lines.push(`   headline: ${d.headline}`, `   working: ${d.working ?? "—"}`, `   meaning: ${d.meaning}`);
        (d.steps ?? []).forEach((s: string, i: number) => lines.push(`   step ${i + 1}: ${s}`));
        (d.tools ?? []).forEach((t: any) => lines.push(`   tool (${t.kind}) ${t.title}: ${String(t.body).replace(/\n/g, " / ")}`));
        if (d.nextStep) lines.push(`   next step: ${d.nextStep.title} — ${d.nextStep.days} days — measure: ${d.nextStep.measure}`);
      }
      if (res.answer) lines.push(`   answer: ${(res.answer.grounded ?? []).join(" ")}`, `   words: ${res.answer.tryThis ? `${res.answer.tryThis.title}: ${String(res.answer.tryThis.body).split("\n").join(" / ")}` : "—"}`);
      if (res.result) lines.push(`   reply: ${res.result.reply}`, `   verdict: ${res.result.verdict}`);
      if (res.draft) lines.push(`   draft: ${res.draft.body}`);
      if (Array.isArray(res.matches)) res.matches.forEach((m: any) => lines.push(`   match (${m.source}, ${m.score}): ${m.specialist?.name} — ${m.specialist?.headline} — ${m.reason}`));
      out(lines.join("\n"));
      return;
    }
    case "probe-all-down": {
      // Reliability probe: every provider fails, so the owner's opening message gets the
      // no-AI turn. It must keep what they said and ask a sensible next question.
      const snap = readJson<{ providers?: { id: string }[] } | null>(path.join(ctx.runDir, "provider-settings.json"), null);
      const all = (snap?.providers ?? []).map((p) => p.id);
      const replay = readCalls().find((c) => c.feature === "checkup-chat");
      if (!all.length || !replay) throw new Error("Needs the provider list and a recorded checkup turn.");
      writeFileSync(ctx.faultsPath, JSON.stringify({ providers: all, mode: "http500" }));
      try {
        const r = await apiCall(ctx, "probe-all-down-checkup-chat", replay.route, replay.request);
        const j = r.json as { reply?: string; degraded?: boolean; learnedChips?: string[]; slots?: Record<string, unknown>; chips?: string[] };
        const kept = Object.fromEntries(Object.entries(j.slots ?? {}).filter(([k]) => !["declined", "corrections"].includes(k)));
        out(`Every provider failing, replaying the opening message: ${callLine(r as ApiResult)}${j.degraded ? " [no-AI turn]" : ""}\n   reply: ${j.reply ?? ""}\n   kept: ${JSON.stringify(kept)}\n   learned: ${(j.learnedChips ?? []).join(" | ")}\n   chips: ${(j.chips ?? []).join(" | ")}`);
      } finally {
        rmSync(ctx.faultsPath, { force: true });
      }
      return;
    }
    case "draft":
      return draft(text);
    case "copy-draft":
      return copyDraft();
    case "brief":
      return brief(text);
    case "insights":
      return insights();
    case "challenge-new":
      return challengeNew();
    case "challenge-say":
      return challengeSay(text);
    case "challenge-tap":
      return challengeTap(text);
    case "match":
      return match();
    case "plain":
      return plain();
    case "fallback":
      return fallback(text);
    case "grounding":
      return groundingCheck();
    case "render":
      renderRun(ctx);
      out(`Wrote transcripts, timings and tokens to ${rel(ctx.runDir)}`);
      return;
    default:
      out(`Unknown command "${command}". See scripts/eval/README.md.`);
  }
}

try {
  await main();
} catch (error) {
  console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  save();
}
