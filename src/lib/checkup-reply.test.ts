import { describe, expect, test } from "bun:test";
import { listenOnly, neutralReply, usableChip } from "./checkup-turn";
import { dropForeignScript, plainify } from "./checkup-math";

describe("neutralReply: the checkup listens, it never rules on the cause", () => {
  test("a sentence that sides with the owner's explanation is dropped, the question kept", () => {
    expect(neutralReply("That helps — it sounds like the timing is the pressure point, not the business itself. How do new customers find you?", 1)).toBe("Got it. How do new customers find you?");
    expect(neutralReply("That points to cash timing more than demand. What do you think is behind that?", 0)).toBe("Thanks — noted. What do you think is behind that?");
  });
  test("a judging lead-in inside the question sentence goes, the question stays", () => {
    expect(neutralReply("Understood — the yearly bill is the main squeeze; when did you last change your prices?", 2)).toBe("Understood — when did you last change your prices?");
    expect(neutralReply("It's timing, not demand — how do new customers find you?", 1)).toBe("Got it. How do new customers find you?");
  });
  test("agreeing that the business is sound, or ruling out a sales problem, is judging too", () => {
    expect(neutralReply("That makes sense — a big yearly bill can squeeze even a steady business. Is anything else holding the business back right now?", 0)).toBe(
      "Thanks — noted. Is anything else holding the business back right now?",
    );
    expect(neutralReply("Got it — that points to the lump-sum payment, not a day-to-day sales problem. Who usually buys from you?", 1)).toBe("Got it. Who usually buys from you?");
    expect(neutralReply("Sounds like a one-off. How much cash does the business have right now?", 2)).toBe("That's useful to know. How much cash does the business have right now?");
  });
  test("a neutral reply is untouched", () => {
    const r = "Thanks, that helps. How much cash does the business have right now?";
    expect(neutralReply(r, 3)).toBe(r);
  });
  test("a closing line keeps only what doesn't judge", () => {
    expect(neutralReply("That gives a clear picture: the big squeeze is timing, not demand. I've got enough to work out the next step.", 0)).toBe("I've got enough to work out the next step.");
  });
});

describe("usableChip", () => {
  test("fill-in templates are not answers", () => {
    expect(usableChip("About ₦_____ a week")).toBe(false);
    expect(usableChip("[amount] a day")).toBe(false);
    expect(usableChip("Sales vary by week")).toBe(true);
  });
  test("on money questions, a figure the owner never gave is not offered", () => {
    expect(usableChip("About 5%", { money: true, ownerText: "The apps take a cut" })).toBe(false);
    expect(usableChip("About 15%", { money: true, ownerText: "They take about 15%" })).toBe(true);
    expect(usableChip("Yes, they take a cut", { money: true, ownerText: "" })).toBe(true);
  });
  test("range answers on the usual questions stay", () => {
    expect(usableChip("₦5,000 – ₦20,000")).toBe(true);
  });
});

describe("dropForeignScript", () => {
  test("a stray word from another script is removed", () => {
    expect(dropForeignScript("How quickly do you عادة reply, and do you check back?")).toBe("How quickly do you reply, and do you check back?");
    expect(plainify("Do you повторно check back?")).toBe("Do you check back?");
  });
  test("an owner who writes in that script keeps it", () => {
    expect(dropForeignScript("شكرا — how much is due?", "مرحبا")).toBe("شكرا — how much is due?");
  });
  test("currency signs and dashes are not foreign script", () => {
    expect(dropForeignScript("About ₦40k–₦60k — fine.")).toBe("About ₦40k–₦60k — fine.");
  });
});

describe("listenOnly: after their own explanation, no verdict on it", () => {
  test("agreement in any wording is replaced by a thank-you; the question and its tap hint stay", () => {
    expect(listenOnly("That makes sense — the pressure sounds like the lump sum, not the day-to-day trading. Is anything else holding the business back right now? Tap any that apply.")).toBe(
      "Thanks — it helps to hear it in your own words. Is anything else holding the business back right now? Tap any that apply.",
    );
  });
  test("a reply that is only the question is left alone", () => {
    expect(listenOnly("Is anything else holding the business back right now?")).toBe("Is anything else holding the business back right now?");
  });
});
