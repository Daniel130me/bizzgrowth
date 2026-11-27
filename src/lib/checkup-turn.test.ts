import { describe, expect, test } from "bun:test";
import { amountFromOwner, classifyQuestion, countFromOwner, ownerSpokeOfChange, questionCore } from "./checkup-turn";

describe("questionCore: only the clause that asks", () => {
  test("a lead-in before a semicolon or colon is not the question", () => {
    expect(questionCore("Got the weekly picture; what do you sell most, and who buys it?")).toBe("what do you sell most, and who buys it?");
    expect(questionCore("What do you think is behind it: the season, prices, or something else?")).toBe("What do you think is behind it");
  });
  test("an options list after a dash is not the question", () => {
    expect(questionCore("How do new people usually find you — passing by, regulars, friends, or online?")).toBe("How do new people usually find you");
    expect(questionCore("Roughly how many people ask about buying in a normal week — a guess is fine?")).toBe("Roughly how many people ask about buying in a normal week");
  });
  test("a plain question stays whole", () => {
    expect(questionCore("Thanks. Do you send a second message when someone goes quiet?")).toBe("Do you send a second message when someone goes quiet?");
  });
});

describe("classifyQuestion", () => {
  test("'monthly' in a lead-in does not make it the people-asking question", () => {
    expect(classifyQuestion("I have your rough monthly takings now; what do you sell most?")).toBe("sells");
  });
  test("'how many people ask about buying' is the people-asking question, not how many pay", () => {
    expect(classifyQuestion("Roughly how many people ask about buying in a normal month — a range is fine?")).toBe("monthlyEnquiries");
    expect(classifyQuestion("About how many people get in touch to buy in a typical month — 5, 20, more?")).toBe("monthlyEnquiries");
  });
  test("an options list does not decide it", () => {
    // "regulars who come back" in the options used to make this the repeat question.
    expect(classifyQuestion("How do new people find you — passing by, regulars who come back, friends, or online?")).toBe("channels");
  });
  test("asking about chasing people who go quiet is the follow-up question", () => {
    expect(classifyQuestion("Do you send a second message or call back when someone goes quiet, or leave it?")).toBe("followUp");
  });
  test("each kind of question still lands on its own answer", () => {
    expect(classifyQuestion("Out of every 10 people who ask, roughly how many end up paying?")).toBe("closeRate");
    expect(classifyQuestion("When 10 people ask about your price, about how many go ahead and pay?")).toBe("closeRate");
    expect(classifyQuestion("Of the people who ask each month, how many go on to pay?")).toBe("closeRate");
    expect(classifyQuestion("What do you think is behind that?")).toBe("ownerTheory");
    expect(classifyQuestion("Roughly how much does one customer pay you for a typical order?")).toBe("jobValue");
    expect(classifyQuestion("How quickly do you usually get back to people who message?")).toBe("followUp");
    expect(classifyQuestion("Do customers usually come back to you again, or is it mostly one-off work?")).toBe("repeat");
    expect(classifyQuestion("If twice as many people paid you next month, could you keep up?")).toBe("capacity");
    expect(classifyQuestion("Before hearing your price, do new people see photos or past work?")).toBe("proof");
    expect(classifyQuestion("When someone doesn't go ahead, what do they usually say?")).toBe("lostReason");
    expect(classifyQuestion("How do you usually give your price — straight away, or after a call?")).toBe("pricePresentation");
    expect(classifyQuestion("What feels hardest right now?")).toBe("bottleneck");
    expect(classifyQuestion("Who usually pays you — people nearby, other businesses?")).toBe("targetMarket");
    expect(classifyQuestion("Thanks for that.")).toBeNull();
  });
});

describe("countFromOwner: a count the model worked out is not the owner's", () => {
  test("a per-day figure turned into a monthly total is rejected", () => {
    expect(countFromOwner("About 450 a month", "Maybe 15 sales a day")).toBe(false);
  });
  test("the same numbers but a different period is rejected", () => {
    expect(countFromOwner("About 15 a month", "Maybe 15 sales a day")).toBe(false);
  });
  test("their own numbers pass", () => {
    expect(countFromOwner("6 to 15 a month", "between six and fifteen")).toBe(true);
    expect(countFromOwner("About 15 a day", "Maybe 15 sales a day")).toBe(true);
  });
});

describe("amountFromOwner", () => {
  test("their amount in another format passes", () => {
    expect(amountFromOwner("₦2,000 to ₦8,000", "2k to 8k")).toBe(true);
  });
  test("an amount they never said is rejected", () => {
    expect(amountFromOwner("About ₦12,000", "2k to 8k")).toBe(false);
  });
});

describe("ownerSpokeOfChange: a trend needs a change in their words", () => {
  test("a general 'it's okay' is not a trend", () => {
    expect(ownerSpokeOfChange("Business is fine, we sell well. I just need help.")).toBe(false);
  });
  test("comparisons are", () => {
    expect(ownerSpokeOfChange("Fewer people come in than last year")).toBe(true);
    expect(ownerSpokeOfChange("It's about the same as before")).toBe(true);
    expect(ownerSpokeOfChange("Things have been slower since the road works")).toBe(true);
  });
});
