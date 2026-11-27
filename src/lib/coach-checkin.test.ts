import { describe, expect, test } from "bun:test";
import { acknowledge, isYesNoMeasure, nextCheckInQuestion, SERIOUS_RE, withCare, yesNoAnswer, type CheckInAnswer, type NextStep } from "./coach";

const step: NextStep = {
  kind: "recommendation",
  title: "Talk to the supplier about a payment plan",
  why: "It comes first.",
  how: ["Call them today"],
  days: 10,
  unit: "count",
  measure: "How many payment plans you agreed",
};
const facts = { closeRate: "2 out of 10" }; // plenty of checkup answers still missing, so fact questions would follow

const answer = (id: string, text: string, typed = false): CheckInAnswer => ({ id, question: id, answer: text, ...(typed ? { typed: true } : {}) });

describe("check-in: something serious in their own words", () => {
  test("routine questions stop once they say it", () => {
    const answers = [answer("tried", "Yes, most of the time"), answer("count", "1 or 2"), answer("changes", "The collectors keep calling my family and I'm so tired, I want to give up", true)];
    expect(nextCheckInQuestion({ step, kind: "mid", facts, answers })).toBeNull();
  });
  test("without it, the check-in carries on to a still-missing checkup answer", () => {
    const answers = [answer("tried", "Yes, most of the time"), answer("count", "1 or 2"), answer("changes", "I changed my prices", true)];
    expect(nextCheckInQuestion({ step, kind: "mid", facts, answers })?.id.startsWith("fact:")).toBe(true);
  });
  test("a tapped answer is not their own words", () => {
    const answers = [answer("tried", "Yes, most of the time"), answer("count", "1 or 2"), answer("changes", "It was a slow or busy period")];
    expect(nextCheckInQuestion({ step, kind: "mid", facts, answers })).not.toBeNull();
  });
  test("the acknowledgement is never breezy", () => {
    expect(acknowledge("changes", "They are threatening me and messaging my contacts")).toContain("sounds really hard");
    expect(acknowledge("changes", "I raised my prices")).toBe("Good to know — I'll keep that in mind when I read the result.");
  });
  test("what counts as serious", () => {
    for (const t of ["I'm tired of everything", "sometimes I want to shut down the shop", "they are harassing me", "the lender is texting my family", "I can't cope"]) expect(SERIOUS_RE.test(t)).toBe(true);
    for (const t of ["We shut at 6pm", "Sales were tired this week? no", "I raised prices on three items"]) expect(SERIOUS_RE.test(t)).toBe(false);
  });
});

describe("check-in: a yes/no step is asked as one", () => {
  const ynStep: NextStep = { ...step, measure: "Did the supplier agree to a payment plan?" };
  test("one question mark, and yes/no answers to tap — not counts", () => {
    const q = nextCheckInQuestion({ step: ynStep, kind: "end", facts, answers: [answer("tried", "Yes, I did it")] });
    expect(q?.id).toBe("count");
    expect(q?.text).toBe("Since you started, did the supplier agree to a payment plan?");
    expect(q?.choices).toEqual(["Yes", "Partly", "Not yet", "Not sure"]);
  });
  test("a counted step keeps its count answers", () => {
    const q = nextCheckInQuestion({ step, kind: "end", facts, answers: [answer("tried", "Yes, I did it")] });
    expect(q?.choices).toContain("3 to 5");
  });
  test("the answer is read as yes or no", () => {
    expect(isYesNoMeasure("Did the supplier agree to a payment plan?")).toBe(true);
    expect(isYesNoMeasure("How many payment plans you agreed")).toBe(false);
    expect(yesNoAnswer("Yes, he agreed.")).toBe("yes");
    expect(yesNoAnswer("They said no")).toBe("no");
    expect(yesNoAnswer("Not yet")).toBe("no");
    expect(yesNoAnswer("He wants half first")).toBeNull();
  });
});

describe("check-in: an exhausted owner is answered as a person", () => {
  test("a reply that skipped it gets one kind sentence — after a safety point, before the business", () => {
    const reply = "First, threats from a lender are not acceptable — keep screenshots. On the step, it worked. Sales still need watching.";
    const out = withCare(reply, "It worked. But honestly I'm tired, sometimes I feel like closing everything.");
    const sentences = out.split(/(?<=[.!?])\s+/);
    expect(sentences[0]).toContain("not acceptable");
    expect(sentences[1]).toContain("you don't have to decide anything big today");
  });
  test("a reply that already answers it, or an owner who didn't say it, is left alone", () => {
    const caring = "That sounds really hard, and you're not alone in it. On the step, it worked.";
    expect(withCare(caring, "I'm so tired")).toBe(caring);
    expect(withCare("On the step, it worked.", "It worked fine")).toBe("On the step, it worked.");
  });
  test("harassment in other words still stops the routine questions", () => {
    expect(SERIOUS_RE.test("the loan app people are disturbing my contacts")).toBe(true);
    expect(SERIOUS_RE.test("they keep bothering my family")).toBe(true);
  });
});
