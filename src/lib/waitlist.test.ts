import { describe, expect, test } from "bun:test";
import { validateWaitlistSubmission } from "./waitlist";

describe("waitlist submission validation", () => {
  test("normalizes business email and ignores specialist-only fields", () => {
    expect(
      validateWaitlistSubmission({
        name: " Ada Okafor ",
        email: " ADA@EXAMPLE.COM ",
        audience: "business",
        businessName: "Ada Foods",
        industry: "Food retail",
        specialty: "ignored",
        experience: "ignored",
      }),
    ).toEqual({
      ok: true,
      value: {
        name: "Ada Okafor",
        email: "ada@example.com",
        audience: "business",
        businessName: "Ada Foods",
        industry: "Food retail",
        specialty: null,
        experience: null,
      },
    });
  });

  test("accepts specialist expertise and experience", () => {
    expect(
      validateWaitlistSubmission({
        name: "Daniel Doe",
        email: "daniel@example.com",
        audience: "specialist",
        specialty: "Paid media",
        experience: "4–7 years",
      }),
    ).toMatchObject({
      ok: true,
      value: { audience: "specialist", businessName: null, industry: null, specialty: "Paid media", experience: "4–7 years" },
    });
  });

  test("rejects invalid and incomplete submissions", () => {
    expect(validateWaitlistSubmission({ name: "A", email: "bad", audience: "business" })).toMatchObject({
      ok: false,
      field: "name",
    });
    expect(
      validateWaitlistSubmission({ name: "Ada", email: "ada@example.com", audience: "business", businessName: "Ada" }),
    ).toMatchObject({ ok: false, field: "industry" });
    expect(
      validateWaitlistSubmission({
        name: "Dan",
        email: "dan@example.com",
        audience: "specialist",
        specialty: "Design",
        experience: "a long time",
      }),
    ).toMatchObject({ ok: false, field: "experience" });
  });
});
