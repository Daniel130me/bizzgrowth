import { describe, expect, test } from "bun:test";
import { formatBusinessContext } from "./ai-voice";
import { ownerWordsFrom } from "./ai-context";
import type { BusinessContextPayload, BusinessFacts } from "./checkup";

const facts: BusinessFacts = {
  businessType: "service",
  whatTheySell: "Hair braiding",
  primaryGoal: "Pay the shop's bills on time",
  customers: "Women nearby",
  channels: ["Walk-ins"],
  journey: [],
  trends: { enquiries: "Don't know", customers: "Don't know", revenue: "Don't know" },
  recentChanges: [],
  closeRate: "4 out of 10",
  jobValue: "₦8,000",
  monthlyEnquiries: "About 40 a month",
  chips: [],
  facts: [],
  confidence: 60,
};

function ctx(diagnosis: BusinessContextPayload["diagnosis"], ownerWords?: string[]): BusinessContextPayload {
  return { name: "Test Salon", country: "Nigeria", currency: "₦", facts, diagnosis, ...(ownerWords ? { ownerWords } : {}) };
}

describe("formatBusinessContext: what-it's-worth figures", () => {
  test("shown before there is a diagnosis", () => {
    expect(formatBusinessContext(ctx(null))).toContain("COMPUTED FROM THEIR OWN ESTIMATES");
  });
  test("shown when the diagnosis has one", () => {
    const d = { headline: "x", stake: { figure: "₦32k", label: "more a month", working: ["…"] } };
    expect(formatBusinessContext(ctx(d))).toContain("COMPUTED FROM THEIR OWN ESTIMATES");
  });
  test("left out when the diagnosis decided there is none (e.g. a money problem the app can't see)", () => {
    expect(formatBusinessContext(ctx({ headline: "x", stake: null }))).not.toContain("COMPUTED FROM THEIR OWN ESTIMATES");
  });
});

describe("formatBusinessContext: the owner's own words", () => {
  test("included word for word, so figures they gave are known", () => {
    const text = formatBusinessContext(ctx(null, ["My electricity bill of ₦180k is due Friday and I have ₦40k."]));
    expect(text).toContain("THE OWNER'S OWN WORDS IN THEIR CHECKUP");
    expect(text).toContain("₦180k is due Friday");
  });
});

describe("ownerWordsFrom", () => {
  test("keeps only the owner's replies, in order", () => {
    const words = ownerWordsFrom([
      { role: "ai", text: "Hi, what do you do?" },
      { role: "user", text: "I braid hair." },
      { role: "ai", text: "Who pays you?" },
      { role: "user", text: "Women nearby." },
    ]);
    expect(words).toEqual(["I braid hair.", "Women nearby."]);
  });
  test("keeps the first reply and the latest ones when it is long", () => {
    const transcript = Array.from({ length: 30 }, (_, i) => ({ role: "user" as const, text: `${i === 0 ? "FIRST" : `reply ${i}`} ${"x".repeat(150)}` }));
    const words = ownerWordsFrom(transcript, 1000);
    expect(words[0].startsWith("FIRST")).toBe(true);
    expect(words[words.length - 1].startsWith("reply 29")).toBe(true);
    expect(words.length).toBeLessThan(30);
  });
});
