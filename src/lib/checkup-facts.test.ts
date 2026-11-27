import { describe, expect, test } from "bun:test";
import { mergeExtractedFacts } from "./checkup-facts";
import type { BusinessFacts } from "./checkup";

// Facts built from what the owner actually answered in the interview.
const base: BusinessFacts = {
  businessType: "service",
  whatTheySell: "Phone repairs",
  primaryGoal: "Grow the business",
  customers: "People nearby",
  channels: ["Walk-ins"],
  journey: ["Hears about you", "Asks", "Pays"],
  trends: { enquiries: "Don't know", customers: "Don't know", revenue: "Don't know" },
  recentChanges: [],
  bottleneck: "Too few people come in",
  closeRate: "3 out of 10",
  followUp: "Reply the same day",
  ownerTheory: "A new shop opened nearby",
  // capacity, proof, pricePresentation, lostReason, repeat: never answered
  chips: [],
  facts: [{ section: "Business", value: "Fix It — a service business in Ghana", provenance: "user-supplied", source: "Your checkup conversation" }],
  confidence: 58,
};

// What a model extraction tends to add on top: guesses for questions never asked, and trends never given.
const parsed = {
  businessType: "service" as const,
  whatTheySell: "Phone and laptop repairs",
  bottleneck: "Not enough people walk in",
  capacity: "Yes, they could take more work",
  proof: "They show photos of past repairs",
  pricePresentation: "They give a quick price at the counter",
  trends: { enquiries: "About the same" as const, customers: "About the same" as const, revenue: "Increased" as const },
  facts: [
    { section: "Business", value: "Fix It — a service business in Ghana", provenance: "user-supplied" as const, source: "Your checkup conversation" },
    { section: "What you sell", value: "Phone and laptop repairs", provenance: "user-supplied" as const, source: "Your checkup conversation" },
    { section: "Customers", value: "People nearby", provenance: "user-supplied" as const, source: "Your checkup conversation" },
    { section: "Where growth feels stuck", value: "Not enough people walk in", provenance: "user-supplied" as const, source: "Your checkup conversation" },
    { section: "Room for more work", value: "Yes, they could take more work", provenance: "user-supplied" as const, source: "Your checkup conversation" },
    { section: "Past work shown before the price", value: "Photos of past repairs", provenance: "user-supplied" as const, source: "Your checkup conversation" },
  ],
  confidence: 70,
};

describe("mergeExtractedFacts", () => {
  const facts = mergeExtractedFacts({ base, parsed, slots: { enquiries: undefined, customers: undefined, revenue: undefined }, ownerText: "" });

  test("a trend the owner never gave stays unknown", () => {
    expect(facts.trends).toEqual({ enquiries: "Don't know", customers: "Don't know", revenue: "Don't know" });
  });
  test("a trend the owner gave in the interview is kept", () => {
    const withTrend = mergeExtractedFacts({ base, parsed, slots: { enquiries: "Decreased" }, ownerText: "" });
    expect(withTrend.trends.enquiries).toBe("Decreased");
  });
  test("answers to questions never asked are not facts", () => {
    expect(facts.capacity).toBeUndefined();
    expect(facts.proof).toBeUndefined();
    expect(facts.pricePresentation).toBeUndefined();
  });
  test("fact rows for those answers are dropped too", () => {
    expect(facts.facts.map((f) => f.section)).toEqual(["Business", "What you sell", "Customers", "Where growth feels stuck"]);
  });
  test("answers they gave keep the model's cleaner wording", () => {
    expect(facts.bottleneck).toBe("Not enough people walk in");
    expect(facts.whatTheySell).toBe("Phone and laptop repairs");
    expect(facts.ownerTheory).toBe("A new shop opened nearby");
  });
  test("numbers come from the interview", () => {
    expect(facts.closeRate).toBe("3 out of 10");
  });
});
