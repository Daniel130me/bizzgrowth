import { describe, expect, mock, test } from "bun:test";
import type { Specialist } from "@prisma/client";

// Scoring is pure; the database and the AI are never reached here.
mock.module("server-only", () => ({}));
mock.module("./db", () => ({ db: {} }));
mock.module("./ai", () => ({ completeText: async () => null }));

const { scoreSpecialist } = await import("./market");

const specialist = (category: string, skills: string[], headline: string) =>
  ({ category, skills: JSON.stringify(skills), headline, rating: 4.8, completedJobs: 60, available: "Available now" }) as unknown as Specialist;

const task = {
  title: "Set up simple weekly bookkeeping",
  description: "I need someone to set up a simple way to write down sales, costs and what I owe each week. We have 4 staff.",
  category: "finance",
  skills: ["bookkeeping"],
};

describe("specialist matching: a skill counts only when the specialist offers it", () => {
  test("a writer is not a bookkeeping match because the task mentions accounts and staff", () => {
    const writer = scoreSpecialist(specialist("content", ["SEO writing", "Copywriting", "Email newsletters"], "Content and social media"), task);
    expect(writer.overlap).not.toContain("bookkeeping");
    expect(writer.overlap).not.toContain("hiring");
  });
  test("words that describe the business are not what it asks for: \"we have 4 staff\" is not a hiring request", () => {
    const hr = scoreSpecialist(specialist("people", ["Hiring", "Onboarding", "HR basics"], "Hiring and HR for small teams"), task);
    expect(hr.overlap).toEqual([]);
  });
  test("a bookkeeper is, and ranks well above the writer", () => {
    const bookkeeper = scoreSpecialist(specialist("finance", ["Bookkeeping", "Payroll", "Expense tracking"], "Bookkeeping and payroll for small businesses"), task);
    const writer = scoreSpecialist(specialist("content", ["SEO writing", "Copywriting"], "Content and social media"), task);
    expect(bookkeeper.overlap).toContain("bookkeeping");
    expect(bookkeeper.score).toBeGreaterThan(writer.score + 40);
  });
});
