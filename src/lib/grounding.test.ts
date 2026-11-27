import { describe, expect, test } from "bun:test";
import { collectAllowedNumbers, dropUngroundedSentences, spelledAmount, ungroundedNumbers } from "./grounding";

// An owner's own figures, as they might type them in a checkup.
const OWNER = "Rent of ₦4.8m is due in 12 days and I have ₦900k. We sell ₦40,000–60,000 a day, 26 days a month.";
const allowed = collectAllowedNumbers(OWNER);

describe("grounding: the owner's own figures pass", () => {
  test("in the format they used", () => {
    expect(ungroundedNumbers("Your rent is ₦4.8m and you have ₦900k.", allowed)).toEqual([]);
  });
  test("in another format", () => {
    expect(ungroundedNumbers("You have ₦900,000 now, against ₦4,800,000.", allowed)).toEqual([]);
    expect(ungroundedNumbers("That is 4.8 million naira.", allowed)).toEqual([]);
  });
  test("a range they gave", () => {
    expect(ungroundedNumbers("Sales of ₦40,000–60,000 a day over 26 days.", allowed)).toEqual([]);
  });
});

describe("grounding: invented figures are caught", () => {
  test("currency with a scale", () => {
    expect(ungroundedNumbers("You could raise ₦7m from a new loan.", allowed)).toEqual(["₦7m"]);
  });
  test("an 'm' written onto the number, with no currency sign", () => {
    // Slipped through before: "1.5" counted as a small number and "m" was ignored.
    expect(ungroundedNumbers("You probably make about 1.5m a month after costs.", allowed)).toEqual(["1.5m"]);
    expect(ungroundedNumbers("Aim for 2b in sales.", allowed)).toEqual(["2b"]);
  });
  test("an amount written in words", () => {
    expect(ungroundedNumbers("You could save three hundred thousand naira.", allowed)).toEqual(["three hundred thousand"]);
    expect(ungroundedNumbers("That frees up half a million.", allowed)).toEqual(["half a million"]);
  });
  test("a figure worked out from theirs is still not theirs", () => {
    expect(ungroundedNumbers("Sales are ₦1,560,000 a month.", allowed)).toEqual(["₦1,560,000"]);
  });
  test("a percentage they never gave", () => {
    expect(ungroundedNumbers("Raise prices by 35%.", allowed)).toEqual(["35%"]);
  });
});

describe("grounding: amounts in words", () => {
  test("values", () => {
    expect(spelledAmount("three hundred thousand")).toBe(300_000);
    expect(spelledAmount("two million")).toBe(2_000_000);
    expect(spelledAmount("half a million")).toBe(500_000);
    expect(spelledAmount("one thousand two hundred")).toBe(1_200);
    expect(spelledAmount("twenty five thousand")).toBe(25_000);
  });
  test("no scale word, no amount (counts are not checked this way)", () => {
    expect(spelledAmount("two hundred")).toBeNull();
    expect(spelledAmount("one")).toBeNull();
  });
  test("an owner who writes an amount in words is allowed to have it quoted back", () => {
    const words = collectAllowedNumbers("I owe about two million naira.");
    expect(ungroundedNumbers("You owe ₦2m.", words)).toEqual([]);
  });
});

describe("grounding: unchanged behaviour", () => {
  test("advice-scale numbers need no source", () => {
    expect(ungroundedNumbers("Offer 3 options and reply within 24 hours, for 30 days.", allowed)).toEqual([]);
  });
  test("number words without a scale, and minutes, are not amounts", () => {
    expect(ungroundedNumbers("Call one person a day — just one, and an hour is enough.", allowed)).toEqual([]);
    expect(ungroundedNumbers("Take 10 minutes, or 10min, to list it.", allowed)).toEqual([]);
  });
  test("only the sentence with the invented figure is dropped", () => {
    expect(dropUngroundedSentences("Your rent is ₦4.8m. You could borrow ₦7m. Talk to them today.", allowed)).toBe("Your rent is ₦4.8m. Talk to them today.");
  });
});
