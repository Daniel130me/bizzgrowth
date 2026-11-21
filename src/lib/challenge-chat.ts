// The short, focused chat for ONE challenge: what's happening, since when, how
// often, what they've tried — plus one or two questions picked for this
// challenge from what is still unknown about the business. Pure (no React):
// the API route runs it and the screen shows it.
//
// It never redoes the checkup: everything already known about the business is
// passed in, and the targeted questions skip any answer the owner already gave.

import type { BusinessFacts } from "./checkup";
import { outsideKind, type ChallengeDetails, type ChallengeStage } from "./challenges";

export type ChallengeSlot = "what" | "since" | "often" | "tried" | "extra1" | "extra2";

export const SLOT_ORDER: ChallengeSlot[] = ["what", "since", "often", "tried", "extra1", "extra2"];

export type FactSlot = "lostReason" | "pricePresentation" | "followUp" | "proof" | "repeat" | "capacity";

export interface TargetedQuestion {
  key: string;
  question: string;
  why: string;
  chips: string[];
  /** The business answer this fills in, when it is one of the checkup's. */
  fact?: FactSlot;
}

export interface ChallengeChatState {
  answers: Partial<Record<ChallengeSlot, string>>;
  pending?: ChallengeSlot | "link";
  stage?: ChallengeStage;
  title?: string;
  theory?: string;
  targeted?: TargetedQuestion[];
  /** An existing challenge this may duplicate, and what the owner said. */
  link?: { id: string; title: string; why?: string; answered?: "yes" | "no" } | null;
}

export interface ChallengeTurnResult {
  reply: string;
  chips: string[];
  /** Why the question is asked, in a few words. */
  why?: string;
  phase: "chat" | "done";
  state: ChallengeChatState;
  details: ChallengeDetails;
  /** The owner agreed it is the same problem as this challenge. */
  linkedTo?: string | null;
  /** Business answers learned on the way (e.g. what people say when they don't buy). */
  factUpdates: Partial<Record<FactSlot, string>>;
  degraded: boolean;
}

export const LINK_YES = "Yes, add it to that one";
export const LINK_NO = "No, it's a different problem";

const known = (facts: Partial<BusinessFacts> | null | undefined, k: FactSlot) => {
  const v = facts?.[k];
  return typeof v === "string" && v.trim().length > 0 && !/^(not sure|don't know|skip)/i.test(v.trim());
};

/** One or two questions picked for this challenge — never one the owner already answered. */
export function targetedFor(stage: ChallengeStage, title: string, facts: Partial<BusinessFacts> | null | undefined, theoryKnown: boolean): TargetedQuestion[] {
  const out: TargetedQuestion[] = [];
  switch (stage) {
    case "convert":
      if (!known(facts, "lostReason"))
        out.push({
          key: "lostReason",
          fact: "lostReason",
          question: "When someone doesn't go ahead, what do they usually say — or do they just go quiet?",
          why: "It tells me whether it's the price, trust or timing — each needs a different fix.",
          chips: ["They say it's too expensive", "They just stop replying", "They say they'll come back later", "They go with someone else"],
        });
      if (!known(facts, "pricePresentation"))
        out.push({
          key: "pricePresentation",
          fact: "pricePresentation",
          question: "How do people usually get your price — straight away, or after you've talked through what they need?",
          why: "How the price lands often decides whether people go ahead.",
          chips: ["Straight away when they ask", "After a chat about what they need", "A written quote", "It's on my price list"],
        });
      if (!known(facts, "followUp"))
        out.push({
          key: "followUp",
          fact: "followUp",
          question: "When someone goes quiet after asking, what usually happens next?",
          why: "People who go quiet are often still deciding.",
          chips: ["I follow up once or twice", "I wait for them to come back", "It depends how busy I am"],
        });
      out.push({
        key: "lastWin",
        question: "Think of the last person who did go ahead — what was different about them?",
        why: "What worked once often shows what to do more of.",
        chips: ["They'd seen my work before", "Someone recommended me", "They needed it quickly", "Not sure"],
      });
      break;
    case "found":
    case "enquire":
      out.push({
        key: "change",
        question: "Has anything changed in how people find you — fewer recommendations, someone new nearby, a slow season?",
        why: "A change usually points straight at the cause.",
        chips: ["Fewer recommendations than before", "Someone new nearby", "It's a slow season", "Nothing has changed"],
      });
      out.push({
        key: "reach",
        question: "If someone heard about you today, how would they reach you or see what you do?",
        why: "Interest with nowhere to go is easy to lose.",
        chips: ["They'd call or message me", "They'd come by", "They'd look me up online", "They'd have to ask someone"],
      });
      break;
    case "return":
      if (!known(facts, "repeat"))
        out.push({
          key: "repeat",
          fact: "repeat",
          question: "Out of your customers, roughly how many come back or order again?",
          why: "It shows how much is there to win back.",
          chips: ["Hardly any", "A few", "About half", "Most of them"],
        });
      out.push({
        key: "contacts",
        question: "Do you have a way to reach past customers — their numbers, a list, a group?",
        why: "Customers you can reach are the easiest ones to bring back.",
        chips: ["Yes, I have their numbers", "Some of them", "Not really", "I've never kept them"],
      });
      out.push({
        key: "after",
        question: "After someone buys, do you usually get in touch with them again?",
        why: "A reason and a reminder is often all it takes.",
        chips: ["Yes, now and then", "Only if they contact me", "Rarely", "Never"],
      });
      break;
    case "deliver":
      // Wrong sizes, returns, late or damaged deliveries: what goes wrong and what it costs — not capacity.
      if (/return|refund|size|\bfit\b|quality|mistake|damage|wrong|complain|deliver|courier|dispatch|faulty|broken item/i.test(title)) {
        out.push({
          key: "whatWrong",
          question: "When it goes wrong, what usually happens?",
          why: "It shows where in the process it slips.",
          chips: ["Wrong size or wrong item", "It arrives late", "Damaged or poor quality", "Something else"],
        });
        out.push({
          key: "costEach",
          question: "What does it cost you each time?",
          why: "It shows what fixing it is worth to you.",
          chips: ["The delivery fee", "A refund or a redo", "The customer", "My time"],
        });
        break;
      }
      if (!known(facts, "capacity"))
        out.push({
          key: "capacity",
          fact: "capacity",
          question: "If twice as many people paid you next month, could you handle it?",
          why: "If you're already full, more customers isn't the answer — price or process is.",
          chips: ["Yes, easily", "A bit more, not double", "No, I'm already full", "Only if I get help"],
        });
      out.push({
        key: "time",
        question: "What takes up most of your time each week?",
        why: "You can only free up time once you can see where it goes.",
        chips: ["Making or doing the work", "Talking to customers", "Getting supplies", "Admin and paperwork"],
      });
      out.push({
        key: "help",
        question: "Could someone else do part of it — a helper, a simple routine, a ready-made message?",
        why: "Handing off even one task frees time for the work only you can do.",
        chips: ["Yes, if I trained them", "Maybe some of it", "Not really", "I've never thought about it"],
      });
      break;
    case "outside": {
      const k = outsideKind(title);
      out.push({
        key: "impact",
        question: "How is it affecting the business right now?",
        why: "It shows where it touches your customers and sales.",
        chips:
          k === "cash"
            ? ["I can't buy stock or materials", "I'm late paying people", "I turn down work", "Stressful, but manageable"]
            : k === "staff"
              ? ["I'm doing everything myself", "I turn down work", "Quality slips when I'm away", "People don't stay long"]
              : k === "costs"
                ? ["My profit is shrinking", "I've had to raise prices", "Customers complain about prices", "I'm absorbing it for now"]
                : ["It costs me money", "It costs me customers", "It costs me time", "Not sure yet"],
      });
      out.push({
        key: "trend",
        question: "Is it getting better, worse, or staying about the same?",
        why: "It tells us how soon it needs attention.",
        chips: ["Getting worse", "About the same", "Getting a bit better", "It comes and goes"],
      });
      break;
    }
  }
  if (!theoryKnown)
    out.push({
      key: "theory",
      question: "What do you think is behind it? Any hunch helps.",
      why: "You see things the app can't.",
      chips: ["Not sure"],
    });
  return out.slice(0, 2);
}

const OFTEN: Record<ChallengeStage, { q: string; chips: string[] }> = {
  found: { q: "Compared with a good month, how many people ask about buying now?", chips: ["Fewer than before", "A lot fewer", "About the same as always", "It's always been low"] },
  enquire: { q: "Compared with a good month, how many people get in touch now?", chips: ["Fewer than before", "A lot fewer", "About the same as always", "It's always been low"] },
  convert: { q: "How often does it happen?", chips: ["With most people who ask", "About half the time", "Now and then", "Not sure"] },
  deliver: { q: "How often does it happen?", chips: ["Every week", "In busy seasons", "Now and then", "All the time"] },
  return: { q: "How often do you notice it?", chips: ["With most customers", "With about half", "Now and then", "Not sure"] },
  outside: { q: "How often does it hit the business?", chips: ["Every week", "Every month", "Now and then", "All the time"] },
};

const TRIED: Record<ChallengeStage | "cash" | "staff" | "costs", string[]> = {
  found: ["Asked customers to tell others", "Posted or advertised more", "Gave discounts", "Nothing yet"],
  enquire: ["Made my number easier to find", "Posted or advertised more", "Gave discounts", "Nothing yet"],
  convert: ["Lowered my price", "Followed up with them", "Explained the value more", "Nothing yet"],
  deliver: ["Changed how I do it", "Got some help", "Raised my prices", "Nothing yet"],
  return: ["Messaged old customers", "Gave a discount to come back", "Nothing yet", "Not sure what to try"],
  outside: ["A few things", "Nothing yet", "Not sure what to try"],
  cash: ["Cut back on spending", "Borrowed money", "Chased people who owe me", "Nothing yet"],
  staff: ["Asked people I know", "Advertised the job", "Trained someone myself", "Nothing yet"],
  costs: ["Raised my prices", "Found a cheaper supplier", "Bought in bigger amounts", "Nothing yet"],
};

/** The question for a slot, in plain words, with tap answers. */
export function questionFor(slot: ChallengeSlot, state: ChallengeChatState): { text: string; why?: string; chips: string[] } {
  const stage = state.stage ?? "found";
  switch (slot) {
    case "what":
      return { text: "Tell me a bit more — what's happening with it?", chips: [] };
    case "since":
      return {
        text: "How long has this been going on?",
        why: "It tells me whether something changed, or it has always been this way.",
        chips: ["A few weeks", "A few months", "More than a year", "Since I started"],
      };
    case "often":
      return { text: OFTEN[stage].q, chips: OFTEN[stage].chips };
    case "tried": {
      const k = stage === "outside" ? outsideKind(state.title ?? "") : null;
      return { text: "What have you tried so far — even small things?", chips: TRIED[k && k !== "other" ? k : stage] };
    }
    case "extra1":
    case "extra2": {
      const t = state.targeted?.[slot === "extra1" ? 0 : 1];
      return t ? { text: t.question, why: t.why, chips: t.chips } : { text: "", chips: [] };
    }
  }
}

/** The next slot still to ask, or null when the chat is done. */
export function nextSlot(state: ChallengeChatState): ChallengeSlot | null {
  for (const s of SLOT_ORDER) {
    if (state.answers[s] !== undefined) continue;
    if ((s === "extra1" && !state.targeted?.[0]) || (s === "extra2" && !state.targeted?.[1])) continue;
    return s;
  }
  return null;
}

/** The owner's answers as the challenge's details. */
export function detailsFrom(state: ChallengeChatState): ChallengeDetails {
  const a = state.answers;
  const extra = (["extra1", "extra2"] as const)
    .map((s, i) => {
      const t = state.targeted?.[i];
      const ans = a[s];
      return t && ans && t.key !== "theory" ? { key: t.key, question: t.question, answer: ans } : null;
    })
    .filter((x): x is { key: string; question: string; answer: string } => x !== null);
  const theoryAnswer = (["extra1", "extra2"] as const).find((s, i) => state.targeted?.[i]?.key === "theory" && a[s]);
  const theory = state.theory ?? (theoryAnswer ? a[theoryAnswer] : undefined);
  return {
    what: a.what,
    since: a.since,
    often: a.often,
    tried: a.tried,
    theory: theory && !/^not sure/i.test(theory) ? theory : undefined,
    extra: extra.length ? extra : undefined,
  };
}

/** Business answers filled in by the targeted questions. */
export function factUpdatesFrom(state: ChallengeChatState): Partial<Record<FactSlot, string>> {
  const out: Partial<Record<FactSlot, string>> = {};
  (["extra1", "extra2"] as const).forEach((s, i) => {
    const t = state.targeted?.[i];
    const ans = state.answers[s];
    if (t?.fact && ans && !/^(not sure|skip|don't know)/i.test(ans)) out[t.fact] = ans;
  });
  return out;
}

export const ACKS = ["Thanks — that helps.", "Got it.", "That's useful to know.", "Thanks for that.", "Okay, noted."];

export const WRAP_REPLY = "Thank you — that's what I needed. Give me a few seconds to work out what's behind it, and the first thing to try.";

export const YES_RE = /^(y|yes|yeah|yep|sure|ok(ay)?|please|correct|right|it is|same)\b|add it to that/i;
