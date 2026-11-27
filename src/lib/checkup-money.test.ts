import { describe, expect, test } from "bun:test";
import { applyMoneyUpdates, cleanMoneyUpdates, daysBeforeDeadline, daysToFirstDue, isMoneyTrouble, matchDue, moneyClauses, moneyFindings, moneyFindingsBlock, moneyLinesForPrompt, speaksOfCosts, withHarassmentSafety } from "./checkup-money";
import { classifyQuestion } from "./checkup-turn";
import { depthSlotsFor, requiredSlotsFor, type MoneyFacts } from "./checkup";

describe("isMoneyTrouble", () => {
  test("a payment they can't cover", () => {
    for (const t of [
      "Our shop lease of 2 million is due in two weeks and we have 300k",
      "I can't pay my staff this month",
      "We owe the supplier and they stopped delivering",
      "The electricity bill is overdue",
      "I will lose my shop if I don't pay by Friday",
      "I have a loan repayment coming and no money for it",
    ]) expect(isMoneyTrouble(t)).toBe(true);
  });
  test("ordinary mentions of money are not trouble", () => {
    for (const t of ["We pay rent of 200k a month for the shop", "I sell shoes in Kumasi", "Customers pay by transfer", "Sales are fine, I want more customers"]) {
      expect(isMoneyTrouble(t)).toBe(false);
    }
  });
});

describe("moneyClauses: what is due and what they have, in their own words (no AI needed)", () => {
  test("an opener with both", () => {
    expect(moneyClauses("Our shop lease of 2 million is due in two weeks and we have 300k. Sales are fine.")).toEqual({
      due: "Our shop lease of 2 million is due in two weeks",
      cash: "we have 300k",
    });
    expect(moneyClauses("We owe the supplier ₵4,000 by Friday, only have ₵900 in the account")).toEqual({
      due: "We owe the supplier ₵4,000 by Friday",
      cash: "only have ₵900 in the account",
    });
  });
  test("decimals are not sentence ends, and a day count is not money", () => {
    expect(moneyClauses("The loan of $2.5k is due in 9 days.")).toEqual({ due: "The loan of $2.5k is due in 9 days" });
    expect(moneyClauses("Rent is due in 9 days and I have 2 shops")).toEqual({});
  });
  test("a sales figure is neither what is due nor what they have", () => {
    expect(moneyClauses("Business is OK, we make about 800k a month")).toEqual({});
    expect(moneyClauses("I can't pay my staff this month")).toEqual({});
  });
});

describe("speaksOfCosts: a sales figure alone doesn't answer money in and out", () => {
  test("a monthly sales claim is not enough", () => {
    expect(speaksOfCosts("Business makes about ₦4m a month")).toBe(false);
    expect(speaksOfCosts("We sell around 60k a day")).toBe(false);
  });
  test("money in with costs is", () => {
    expect(speaksOfCosts("About 60k a day; stock is 900k a month and staff 300k")).toBe(true);
    expect(speaksOfCosts("Costs are more than sales")).toBe(true);
  });
});

describe("money questions come first when there is money trouble", () => {
  test("required questions switch to the money picture", () => {
    expect(requiredSlotsFor({ money: true })).toEqual(["sells", "bottleneck", "moneyDue", "otherDebts", "cashNow", "moneyInOut", "coverPlan", "ownerTheory"]);
    expect(requiredSlotsFor({})).toContain("closeRate");
  });
  test("follow-ups: how they sell, then fees only when a platform takes a cut", () => {
    expect(depthSlotsFor({ money: true })).toEqual(["channels", "pricesChanged", "owedFlex"]);
    expect(depthSlotsFor({ money: true, channels: ["Walk-ins", "Food delivery apps"] })).toEqual(["platformFees", "pricesChanged", "owedFlex"]);
    expect(depthSlotsFor({ money: true, channels: ["Walk-ins"] })).toEqual(["pricesChanged", "owedFlex"]);
  });
  test("the money questions are recognised", () => {
    expect(classifyQuestion("Is anything else due or owed in the next few weeks — a loan, a supplier, wages?")).toBe("otherDebts");
    expect(classifyQuestion("Roughly how much money does the business have right now to pay with?")).toBe("cashNow");
    expect(classifyQuestion("In a normal week, roughly how much comes in from sales?")).toBe("moneyInOut");
    expect(classifyQuestion("When did you last change your prices — and have costs gone up since?")).toBe("pricesChanged");
    expect(classifyQuestion("Does the app take a fee or commission on each order?")).toBe("platformFees");
    expect(classifyQuestion("Has whoever you owe ever agreed to a payment plan before?")).toBe("owedFlex");
    expect(classifyQuestion("How were you planning to cover the rest of it?")).toBe("coverPlan");
    // A question about who buys is recognised, so in money trouble it can be swapped for a money question.
    expect(classifyQuestion("When people buy from you most often, who is it usually: office workers, students, or another group?")).toBe("targetMarket");
    // …and the usual ones are unchanged.
    expect(classifyQuestion("Roughly how much does one customer pay you for a typical order?")).toBe("jobValue");
    expect(classifyQuestion("Is anything else holding the business back right now?")).toBe("otherChallenges");
  });
});

describe("moneyLinesForPrompt: worked out in code from the owner's figures", () => {
  const money: MoneyFacts = {
    due: [
      { what: "Shop lease", amount: "₦2m", when: "in two weeks" },
      { what: "Bank loan instalment", amount: "₦400k", when: "on the 30th" },
    ],
    cashNow: "₦300k",
    moneyIn: { amount: "₦40,000–₦50,000", per: "day", daysOpen: 25 },
    costs: [
      { what: "Stock", amount: "₦800k", per: "month" },
      { what: "Staff", amount: "₦300k", per: "month" },
      { what: "Fuel", amount: "₦50k", per: "week" },
    ],
    statedMonthlySales: "about ₦2m",
  };
  const lines = moneyLinesForPrompt(money, "₦");

  test("what is due, the cash, and the gap", () => {
    expect(lines[0]).toBe("Due, from what they told you: Shop lease ₦2m (in two weeks); Bank loan instalment ₦400k (on the 30th) — ₦2.4m in total.");
    expect(lines[1]).toBe("Cash they have now: ₦300k.");
    expect(lines[2]).toBe("So they are about ₦2.1m short of what is due (₦2.4m due minus ₦300k in hand).");
  });
  test("money in against running costs, per month", () => {
    expect(lines).toContain("Money coming in, from their figures: about ₦1m–₦1.3m a month (₦40k–₦50k a day × 25 days).");
    // 800k + 300k + 50k × 52/12 ≈ 1.32m
    expect(lines).toContain("Running costs they listed: about ₦1.3m a month (Stock ₦800k + Staff ₦300k + Fuel ₦220k).");
    expect(lines.some((l) => l.startsWith("So on their own figures the business loses about"))).toBe(true);
  });
  test("a stated monthly figure their daily figures don't add up to is flagged", () => {
    expect(lines.some((l) => l.startsWith("They also said about ₦2m a month — more than their own figures add up to"))).toBe(true);
  });
  test("nothing is worked out from figures they didn't give", () => {
    expect(moneyLinesForPrompt({ due: [{ what: "Rent" }], costs: [] }, "₦")).toEqual([]);
    expect(moneyLinesForPrompt(undefined, "₦")).toEqual([]);
  });
  test("findings: a business that loses money, and a monthly figure that doesn't add up", () => {
    expect(moneyFindings(money)).toEqual({ losesMoney: true, statedTooHigh: true });
    expect(moneyFindingsBlock(money)).toContain("Sales don't cover the running costs");
    expect(moneyFindingsBlock(money)).toContain("ask which months the bigger figure came from");
    const healthy: MoneyFacts = { due: [], costs: [{ what: "Stock", amount: "₦200k", per: "month" }], moneyIn: { amount: "₦500k", per: "month" } };
    expect(moneyFindings(healthy)).toEqual({ losesMoney: false, statedTooHigh: false });
    expect(moneyFindingsBlock(healthy)).toBe("");
  });
  test("a business that covers its costs is said to", () => {
    const ok = moneyLinesForPrompt({ due: [], costs: [{ what: "Stock", amount: "₦200k", per: "month" }], moneyIn: { amount: "₦500k", per: "month" } }, "₦");
    expect(ok).toContain("So on their own figures about ₦300k a month is left after running costs, before the payments above.");
  });
});

describe("harassment is answered in every read", () => {
  test("a read that missed it gets the safety step first", () => {
    const steps = withHarassmentSafety(["List your best sellers.", "Raise the weak ones."], "The lenders are disturbing my contacts", "Review the menu that still pays.");
    expect(steps[0]).toContain("not acceptable");
    expect(steps).toHaveLength(3);
  });
  test("screenshots alone are not enough: they must hear that it is not acceptable", () => {
    const steps = withHarassmentSafety(["Call the lender."], "They keep calling my family", "Keep screenshots of every message.");
    expect(steps[0]).toContain("not acceptable");
  });
  test("a read that answered it, or no harassment, is left alone", () => {
    const steps = ["Call the landlord."];
    expect(withHarassmentSafety(steps, "They keep calling my family", "That is not acceptable — keep screenshots.")).toEqual(steps);
    expect(withHarassmentSafety(steps, "Rent is due soon", "Call the landlord.")).toEqual(steps);
  });
});

describe("a step's check-in comes before the first payment", () => {
  const money: MoneyFacts = {
    due: [
      { what: "Lease", amount: "₵9,000", when: "In two weeks" },
      { what: "Supplier", amount: "₵1,200", when: "On day 5" },
      { what: "Tax", amount: "₵800", when: "Overdue" },
    ],
    costs: [],
  };
  test("the first dated payment still ahead", () => {
    expect(daysToFirstDue(money)).toBe(5);
    expect(daysToFirstDue({ due: [{ what: "Rent", when: "tomorrow" }], costs: [] })).toBe(1);
    expect(daysToFirstDue({ due: [{ what: "Rent", when: "Overdue" }, { what: "Loan", when: "on the 30th" }], costs: [] })).toBeNull();
  });
  test("a 14-day step is pulled in before it; no dated payment leaves it as it is", () => {
    expect(daysBeforeDeadline(14, money)).toBe(4);
    expect(daysBeforeDeadline(3, money)).toBe(3);
    expect(daysBeforeDeadline(14, { due: [{ what: "Rent", when: "tomorrow" }], costs: [] })).toBe(1);
    expect(daysBeforeDeadline(14, { due: [{ what: "Rent", when: "Overdue" }], costs: [] })).toBe(14);
  });
});

describe("money that changed in a check-in", () => {
  const money: MoneyFacts = {
    due: [
      { what: "Shop lease", amount: "₵9,000", when: "in two weeks" },
      { what: "Supplier bill", amount: "₵1,200", when: "overdue" },
      { what: "Hair products loan", amount: "₵800", when: "on day 5" },
    ],
    cashNow: "₵2,000",
    moneyIn: { amount: "₵300–₵450", per: "day", daysOpen: 24 },
    costs: [{ what: "Products", amount: "₵3,000", per: "month" }],
  };
  const typed = "The landlord agreed I pay ₵3,000 now and ₵1,000 every month. I paid off the supplier. This week we made ₵400 to ₵520 a day, and I raised my prices a little.";

  test("only changes the owner typed, to payments on their list, are kept", () => {
    const u = cleanMoneyUpdates(
      {
        due: [
          { what: "Lease", change: "plan", amount: "₵1,000", when: "every month", note: "Paid ₵3,000 now, then ₵1,000 a month" },
          { what: "supplier", change: "paid" },
          { what: "Electricity", change: "paid" }, // not on their list, no amount: dropped
          { what: "Bank loan", change: "new", amount: "₵5,000" }, // an amount they never typed: dropped
        ],
        cashNow: "₵4,500", // never said: dropped
        moneyIn: { amount: "₵400 to ₵520", per: "day" },
        pricesChanged: "Raised prices a little",
      },
      money,
      typed,
    );
    expect(u?.due).toEqual([
      { what: "Shop lease", change: "plan", amount: "₵1,000", when: "every month", note: "Paid ₵3,000 now, then ₵1,000 a month" },
      { what: "Supplier bill", change: "paid", amount: undefined, when: undefined, note: undefined },
    ]);
    expect(u?.cashNow).toBeUndefined();
    expect(u?.moneyIn).toEqual({ amount: "₵400 to ₵520", per: "day" });
    expect(u?.pricesChanged).toBe("Raised prices a little");
  });

  test("a new debt needs the owner's own amount; one already listed is updated, not copied", () => {
    const words = "My brother lent me ₵700 for the lease.";
    expect(cleanMoneyUpdates({ due: [{ what: "Brother's loan", change: "new", amount: "₵700" }] }, money, words)?.due).toEqual([
      { what: "Brother's loan", change: "new", amount: "₵700", when: undefined, note: undefined },
    ]);
    expect(cleanMoneyUpdates({ due: [{ what: "Supplier", change: "new", amount: "₵700" }] }, money, words)?.due?.[0].change).toBe("amount");
    expect(cleanMoneyUpdates({ due: [{ what: "Brother's loan", change: "new" }] }, money, words)).toBeNull();
  });

  test("nothing changes without a money picture, typed words, or anything valid", () => {
    expect(cleanMoneyUpdates({ cashNow: "₵100" }, undefined, "I have ₵100")).toBeNull();
    expect(cleanMoneyUpdates({ cashNow: "₵100" }, money, "")).toBeNull();
    expect(cleanMoneyUpdates({ moneyIn: { amount: "₵400", per: "fortnight" } }, money, "₵400")).toBeNull();
    expect(cleanMoneyUpdates("nonsense", money, typed)).toBeNull();
  });

  test("two payments that fit a name equally are never guessed", () => {
    const two = [{ what: "Car loan" }, { what: "Shop loan" }];
    expect(matchDue("loan", two)).toBe(-1);
    expect(matchDue("the car loan", two)).toBe(0);
    expect(matchDue("rent", two)).toBe(-1);
  });

  test("applied: paid stays on the list marked paid, a plan takes the instalment, open days are kept", () => {
    const u = cleanMoneyUpdates({ due: [{ what: "Lease", change: "plan", amount: "₵1,000", when: "every month" }, { what: "supplier", change: "paid" }], moneyIn: { amount: "₵400 to ₵520", per: "day" } }, money, typed);
    const next = applyMoneyUpdates(money, u, "2026-12-01T10:00:00.000Z");
    expect(next.due[0]).toMatchObject({ what: "Shop lease", amount: "₵1,000", when: "every month", status: "plan", updatedAt: "2026-12-01T10:00:00.000Z" });
    expect(next.due[1]).toMatchObject({ what: "Supplier bill", amount: "₵1,200", status: "paid" });
    expect(next.due).toHaveLength(3);
    expect(next.moneyIn).toEqual({ amount: "₵400 to ₵520", per: "day", daysOpen: 24 });
    expect(money.due[0].status).toBeUndefined(); // the original is untouched
  });

  test("the worked-out money leaves paid payments out of what is due", () => {
    const next = applyMoneyUpdates(money, { due: [{ what: "Supplier bill", change: "paid" }] }, "2026-12-01T10:00:00.000Z");
    const lines = moneyLinesForPrompt(next, "₵");
    expect(lines[0]).toBe("Already paid: Supplier bill.");
    expect(lines[1]).toBe("Due, from what they told you: Shop lease ₵9k (in two weeks); Hair products loan ₵800 (on day 5) — ₵9.8k in total.");
    const plan = applyMoneyUpdates(money, { due: [{ what: "Shop lease", change: "plan", amount: "₵1,000", when: "every month" }] }, "x");
    expect(moneyLinesForPrompt(plan, "₵")[0]).toContain("Shop lease ₵1k (on a plan they agreed, every month)");
  });
});

describe("money in another currency is left out of the sums, never converted", () => {
  test("named, not added up", () => {
    const m: MoneyFacts = { due: [{ what: "Rent", amount: "₦3.6m" }, { what: "Equipment loan", amount: "$500" }], cashNow: "$960,000", costs: [{ what: "Stock", amount: "₦800k", per: "month" }] };
    const lines = moneyLinesForPrompt(m, "₦");
    expect(lines[0]).toBe("Not added up, because it is not in ₦ (Nellovia never converts currencies): Equipment loan $500; Cash now $960,000.");
    expect(lines[1]).toBe("Due, from what they told you: Rent ₦3.6m.");
    expect(lines.some((l) => l.startsWith("Cash they have now"))).toBe(false);
  });
  test("a check-in amount in another currency is not recorded", () => {
    const m: MoneyFacts = { due: [{ what: "Rent", amount: "₦3.6m" }], costs: [] };
    expect(cleanMoneyUpdates({ cashNow: "$900" }, m, "I have $900 now", "₦")).toBeNull();
    expect(cleanMoneyUpdates({ cashNow: "₦900k" }, m, "I have ₦900k now", "₦")?.cashNow).toBe("₦900k");
  });
});
