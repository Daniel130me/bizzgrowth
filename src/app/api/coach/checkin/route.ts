import { NextRequest, NextResponse } from "next/server";
import { completeText } from "@/lib/ai";
import { extractJson, FOCUS_STAGES, type BusinessFacts, type FocusStage } from "@/lib/checkup";
import {
  NEXT_STEP_RULES,
  NEXT_STEP_SCHEMA,
  NOTHING_CHANGED_RE,
  NOT_TRIED_RE,
  cleanNextStep,
  countAnswerText,
  factValueFor,
  numbersVerdict,
  templateNextStep,
  type CheckInAnswer,
  type CheckInKind,
  type CheckInResult,
  type CheckInVerdict,
  type FactKey,
  type NextStep,
} from "@/lib/coach";
import { NUMBER_RULES, VOICE_RULES, formatBusinessContext } from "@/lib/ai-voice";
import { collectAllowedNumbers, ungroundedNumbers } from "@/lib/grounding";
import { getSession } from "@/lib/auth/session";
import { measuredContext } from "@/lib/connectors/summary";
import { plainify } from "@/lib/checkup-math";
import { CLEAR_PROBLEM_RE, cleanNoticed, stageOfText, templateOutsideStep } from "@/lib/challenges";

export const runtime = "nodejs";

/**
 * The end of a check-in: read what the owner said happened (mostly offline),
 * compare it honestly with their starting number, and say what it showed
 * and what to do next. The comparison itself is computed here, never by the
 * model; the model writes the words and the next step.
 */

const SYSTEM = `You are Nellovia, the owner's AI business consultant inside the Nellovia app. They just finished a quick check-in about a step they are trying in their business (one they accepted from their diagnosis). Read their answers and reply like a kind, sharp consultant who wants them to win.

HOW TO READ IT
- Be honest about what the numbers show. With only a few people it is "an early sign", never proof. Use the COMPUTED comparison exactly — never do your own maths.
- If other things changed outside the app (their prices, a promotion, a slow or busy week), say plainly that those could explain part of the result.
- If they didn't try it: no guilt at all. Offer an easier version that fits their week, or a different step.
- If it is working: say so warmly, suggest keeping it as a habit, and give the next step.
- If nothing changed: that is useful — it rules something out. Say what it rules out and where that points next (e.g. "That ruled out slow replies — let's look at pricing next.").
- Half-way check-ins: encourage them, offer at most one small tweak, and keep going.
- If, in their own typed words, they mention a NEW problem holding the business back that is not on THEIR CHALLENGES list (a worker left, costs jumped, customers complaining about something new), set "newChallenge" — in their words, with its stage, and "sameAs" = the id of a listed challenge only if it is really the same problem. Otherwise null. Never for ordinary ups and downs of the step itself.

${VOICE_RULES}

${NUMBER_RULES}

Return ONLY valid JSON, no markdown:
{
  "reply": "2-3 short sentences to the owner — warm, specific to their answers",
  "verdict": "working|no-change|worse|not-tried|too-early|unclear",
  "learned": "ONE sentence (<= 150 chars) on what this showed, for their diagnosis",
  "tweak": "one small adjustment (<= 120 chars), or null",
  "nextStep": ${NEXT_STEP_SCHEMA} or null,
  "newChallenge": null or { "title": "<= 70 chars, their words", "stage": "found|enquire|convert|deliver|return|outside", "sameAs": "an id from THEIR CHALLENGES, or null", "why": "1 short sentence" }
}
${NEXT_STEP_RULES}
- nextStep: REQUIRED at the end of a step and when they didn't try it (a gentler version, or a different step). null for a half-way check-in where they should keep going. Never suggest a step that is listed as already tried.`;

const VERDICTS: CheckInVerdict[] = ["working", "no-change", "worse", "not-tried", "too-early", "unclear"];

interface CheckInBody {
  workspaceName?: string;
  country?: string;
  currency?: string;
  facts?: BusinessFacts | null;
  stage?: FocusStage;
  step?: NextStep;
  baseline?: string;
  kind?: CheckInKind;
  day?: number;
  answers?: CheckInAnswer[];
  learnings?: string[];
  tried?: string[];
  /** The challenge this step works on. */
  challenge?: { id?: string; title?: string; stage?: string } | null;
  /** Their list of challenges, so a new problem can be noticed (and not added twice). */
  challenges?: { id: string; title: string; status: string; stage?: string }[];
}

function lower(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function fallbackWords(v: CheckInVerdict, step: NextStep, baseline: string | undefined, after: string | null, blocker: string | undefined, changes: string[]) {
  const t = `“${step.title}”`;
  const measure = lower((step.measure ?? "how many went ahead").replace(/\.$/, ""));
  const other = changes.length ? ` Other things changed too (${changes.join("; ").toLowerCase()}), so part of it may come from those.` : "";
  switch (v) {
    case "working":
      return {
        reply: `That's real progress — ${after ?? "the count"} now${baseline ? `, up from ${baseline}` : ""}.${other} It's worth keeping this as a habit, and let's look at the next lever together.`,
        learned: `${t} is helping — ${after ?? "more"} now${baseline ? ` against ${baseline} before` : ""}. Worth keeping as a habit.`,
      };
    case "no-change":
      return {
        reply: `Thanks for sticking with it. The count barely moved, which is useful: it tells me this step isn't the main thing holding you back.${other} Let's try the next most likely cause.`,
        learned: `${t} didn't change ${measure} much — so it's probably not the main thing holding growth back.`,
      };
    case "worse":
      return {
        reply: `Thanks for being straight about it. Fewer went ahead this time${other ? "," : ""}${other || " — worth a rethink rather than pushing harder."} Let's adjust the approach.`,
        learned: `Fewer went ahead during ${t}${changes.length ? " — other changes may explain part of it" : ""}.`,
      };
    case "not-tried":
      return {
        reply: `That's completely fine — the best step is one that fits your week.${blocker ? ` Since ${lower(blocker)}, ` : " "}let's make the next one smaller and easier to start.`,
        learned: `${t} didn't fit this week${blocker ? ` (${lower(blocker)})` : ""} — trying an easier step next.`,
      };
    case "too-early":
      return {
        reply: `Good start — it's still early, so keep going and keep counting.${other} The end-of-step check-in will show clearly whether it's working.`,
        learned: `Early days on ${t} — keep going and keep counting.`,
      };
    case "unclear":
    default:
      return {
        reply: `Thanks — without a count it's hard to say yet whether this is working.${other} A simple tally in your notebook will make the next check-in much clearer.`,
        learned: `No count yet for ${t} — a simple tally will show whether it's working.`,
      };
  }
}

export async function POST(request: NextRequest) {
  let body: CheckInBody = {};
  try {
    body = (await request.json()) as CheckInBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }
  const step = body.step;
  if (!step || !step.title) return NextResponse.json({ ok: false, error: "Missing step" }, { status: 400 });

  const kind: CheckInKind = body.kind === "mid" || body.kind === "weekly" ? body.kind : "end";
  const answers = Array.isArray(body.answers)
    ? body.answers
        .filter((a) => a && typeof a.id === "string" && typeof a.answer === "string")
        .map((a) => ({ id: a.id, question: String(a.question ?? "").slice(0, 300), answer: String(a.answer).slice(0, 400), typed: a.typed === true }))
    : [];
  const got = (id: string) => answers.find((a) => a.id === id)?.answer;
  const unit = step.unit ?? "in10";
  const facts = body.facts ?? null;
  const stage: FocusStage = FOCUS_STAGES.some((s) => s.id === body.stage) ? (body.stage as FocusStage) : "convert";
  const tried = [...new Set([...(body.tried ?? []), step.title])].slice(0, 12);

  // What the answers say, read deterministically.
  const triedAnswer = got("tried") ?? "";
  const notTried = NOT_TRIED_RE.test(triedAnswer) && !/some|bit|differ/i.test(triedAnswer);
  const after = got("count") ? countAnswerText(got("count")!, unit) : null;
  const dir = numbersVerdict(body.baseline, after, unit);
  const changesAnswer = got("changes");
  const otherChanges = changesAnswer && !NOTHING_CHANGED_RE.test(changesAnswer.trim()) ? [changesAnswer.trim().slice(0, 120)] : [];
  const factUpdates: Partial<Record<FactKey, string>> = {};
  for (const a of answers) {
    if (!a.id.startsWith("fact:")) continue;
    const key = a.id.slice(5) as FactKey;
    const v = factValueFor(key, a.answer);
    if (v) factUpdates[key] = v;
  }
  const blocker = got("blocker");

  const computedVerdict: CheckInVerdict = notTried
    ? "not-tried"
    : kind !== "end"
      ? dir === "up"
        ? "working"
        : "too-early"
      : dir === "up"
        ? "working"
        : dir === "down"
          ? "worse"
          : dir === "same"
            ? "no-change"
            : "unclear";

  const name = (body.workspaceName ?? "Your business").slice(0, 120);
  const list = (Array.isArray(body.challenges) ? body.challenges : [])
    .filter((c) => c && typeof c.id === "string" && typeof c.title === "string")
    .map((c) => ({ id: c.id, title: c.title.slice(0, 120), status: String(c.status ?? "up-next"), stage: String(c.stage ?? "") }))
    .slice(0, 12);
  const context = formatBusinessContext({
    name,
    country: body.country,
    currency: body.currency,
    facts,
    diagnosis: null,
    coaching: { active: null, learnings: body.learnings ?? [] },
    challenges: list,
  });
  const session = await getSession().catch(() => null);
  const connected = session?.workspaceName === name
    ? await measuredContext(session.userId, session.workspaceId)
    : "";
  const prompt = [
    context,
    connected,
    "",
    `THE STEP: ${step.kind === "experiment" ? `Experiment, ${step.days} days` : "Recommendation"} — ${step.title}`,
    `Why: ${step.why}`,
    step.measure ? `What they count: ${step.measure}` : "",
    `CHECK-IN: ${kind === "end" ? "end of the step" : kind === "mid" ? "half-way" : "weekly"} (day ${Math.max(1, Math.round(body.day ?? 1))})`,
    "",
    "THEIR ANSWERS:",
    ...answers.map((a) => `- ${a.question} → ${a.answer}`),
    "",
    `COMPUTED: Starting point: ${body.baseline ?? "not recorded"}. Now: ${after ?? "not counted"}. ${
      dir ? `Direction: ${dir === "up" ? "up" : dir === "down" ? "down" : "about the same"}.` : "No comparison possible."
    }`,
    `READ OF THE ANSWERS: ${computedVerdict}`,
    `STEPS ALREADY TRIED (never suggest again): ${tried.join("; ")}`,
  ]
    .filter(Boolean)
    .join("\n");

  const allowed = collectAllowedNumbers(prompt);
  const ownerText = answers.map((a) => a.answer).join("\n");
  const fallback = fallbackWords(computedVerdict, step, body.baseline, after, blocker, otherChanges);
  const needsNext = kind === "end" || computedVerdict === "not-tried";
  const outside = body.challenge?.stage === "outside";
  const fallbackNext = needsNext ? (outside ? templateOutsideStep(body.challenge?.title ?? step.title) : templateNextStep(stage, facts, tried)) : null;

  let reply = fallback.reply;
  let learned = fallback.learned;
  let tweak: string | undefined;
  let nextStep: NextStep | null = fallbackNext;
  let verdict = computedVerdict;
  let degraded = true;

  const raw = await completeText(SYSTEM, prompt, { maxTokens: 1400, profile: "fast" });
  const parsed = raw ? extractJson<{ reply?: string; verdict?: string; learned?: string; tweak?: string | null; nextStep?: unknown; newChallenge?: unknown }>(raw) : null;
  // Only their own typed words can reveal a new problem (a tapped answer can't).
  const typedText = answers.filter((a) => a.typed).map((a) => a.answer).join("\n");
  let newChallenge = parsed && typedText ? cleanNoticed(parsed.newChallenge, typedText, list) : null;
  // The model missed it, but they plainly typed that something went wrong ("the generator broke",
  // "my helper quit"): offer it anyway, in their own words — they can say "Not now".
  if (!newChallenge) {
    const typed = answers.filter((a) => a.typed && (a.id === "changes" || a.id === "blocker")).map((a) => a.answer.trim());
    const said = typed.find((t) => CLEAR_PROBLEM_RE.test(t) && !NOTHING_CHANGED_RE.test(t));
    if (said) newChallenge = cleanNoticed({ title: said, stage: stageOfText(said) ?? undefined }, said, list);
  }
  if (parsed) {
    degraded = false;
    const clean = (s: unknown, cap: number) => plainify(String(s ?? "").replace(/\s+/g, " ").trim(), ownerText).slice(0, cap);
    const ok = (s: string) => s.length > 10 && ungroundedNumbers(s, allowed).length === 0;
    const r = clean(parsed.reply, 600);
    if (ok(r)) reply = r;
    const l = clean(parsed.learned, 200);
    if (ok(l)) learned = l;
    const tw = parsed.tweak ? clean(parsed.tweak, 160) : "";
    if (tw && ok(tw)) tweak = tw;
    // The numbers decide the verdict when there are numbers; otherwise the model's read.
    const mv = VERDICTS.find((v) => v === parsed.verdict);
    if (mv && dir === null && !notTried) verdict = mv;
    if (needsNext && fallbackNext) {
      const candidate = cleanNextStep(parsed.nextStep, fallbackNext, (t, cap) => plainify(t, ownerText).slice(0, cap));
      const text = [candidate.title, candidate.why, ...candidate.how].join(" ");
      const repeat = tried.some((t) => t.trim().toLowerCase() === candidate.title.trim().toLowerCase());
      nextStep = !repeat && ungroundedNumbers(text, allowed).length === 0 ? candidate : fallbackNext;
    }
  }

  if (otherChanges.length && (verdict === "working" || verdict === "worse") && !/other|also|at the same time|promotion|price change|may explain/i.test(learned)) {
    learned = `${learned.replace(/[.\s]+$/, "")} — other changes at the same time may explain part of it.`.slice(0, 220);
  }
  const result: CheckInResult = {
    reply,
    verdict,
    learned,
    after: after ?? undefined,
    otherChanges,
    factUpdates,
    keepGoing: kind !== "end",
    tweak,
    nextStep,
    newChallenge,
  };
  return NextResponse.json({ ok: true, result, degraded });
}
