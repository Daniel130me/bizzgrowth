import { describe, expect, test } from "bun:test";
import { engagementTransition, validateBidInput } from "./market-rules";

describe("specialist bid validation", () => {
  test("accepts bounded and complete bids", () => {
    const result = validateBidInput({ amount: 125000.4, days: 7.2, coverNote: "I will audit, implement, test and document each agreed deliverable." });
    expect(result.value).toEqual({ amount: 125000, days: 7, coverNote: "I will audit, implement, test and document each agreed deliverable." });
  });

  test.each([
    [{ amount: 999, days: 2, coverNote: "x".repeat(40) }, "amount"],
    [{ amount: 1000, days: 0, coverNote: "x".repeat(40) }, "Delivery"],
    [{ amount: 1000, days: 2, coverNote: "too short" }, "approach"],
  ])("rejects invalid bid boundaries", (input, message) => {
    expect(validateBidInput(input).error).toContain(message);
  });
});

describe("engagement lifecycle", () => {
  test("keeps specialist and owner responsibilities explicit", () => {
    expect(engagementTransition("accept")).toMatchObject({ role: "specialist", from: ["awarded"], to: "accepted" });
    expect(engagementTransition("complete")).toMatchObject({ role: "owner", from: ["delivered"], to: "completed" });
  });

  test("does not invent a transition for unknown actions", () => {
    expect(engagementTransition("reopen")).toBeNull();
  });
});
