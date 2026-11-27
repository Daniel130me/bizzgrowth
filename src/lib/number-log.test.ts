import { describe, expect, test } from "bun:test";
import type { BusinessFacts } from "./checkup";
import { appendNumbers, diffNumbers, editableNumber, logChanges, logCorrection, logRemoval, missingNumbers, NUMBER_LOG_CAP, removeNumber, setNumber, numberRows, numbersFromFacts, sourceLabel, type NumberEntry } from "./number-log";

const base = {
  businessType: "service",
  whatTheySell: "Hair and nails",
  primaryGoal: "",
  customers: "",
  channels: [],
  journey: [],
  trends: { enquiries: "Don't know", customers: "Don't know", revenue: "Don't know" },
  recentChanges: [],
  chips: [],
  facts: [],
  confidence: 60,
} as unknown as BusinessFacts;

const money: BusinessFacts = {
  ...base,
  closeRate: "about 3 in 10",
  money: {
    due: [{ what: "Shop lease", amount: "₵9,000", when: "in two weeks" }],
    cashNow: "₵2,000",
    moneyIn: { amount: "₵300–₵450", per: "day" },
    costs: [{ what: "Products", amount: "₵3,000", per: "month" }],
  },
};

describe("numbersFromFacts: every figure they gave, in their words", () => {
  test("money, payments and customer numbers, grouped", () => {
    expect(numbersFromFacts(money).map((n) => [n.key, n.group, n.value])).toEqual([
      ["due:shop lease", "owed", "₵9,000, in two weeks"],
      ["cashNow", "money", "₵2,000"],
      ["moneyIn", "money", "₵300–₵450 a day"],
      ["cost:products", "money", "₵3,000 a month"],
      ["closeRate", "customers", "about 3 in 10"],
    ]);
  });
  test("no facts, or no figures, means no numbers — nothing is filled in", () => {
    expect(numbersFromFacts(null)).toEqual([]);
    expect(numbersFromFacts(base)).toEqual([]);
  });
  test("a paid payment and one on a plan say so", () => {
    const f: BusinessFacts = { ...money, money: { ...money.money!, due: [{ what: "Lease", amount: "₵1,000", when: "every month", status: "plan" }, { what: "Supplier", amount: "₵1,200", status: "paid" }] } };
    expect(numbersFromFacts(f).slice(0, 2).map((n) => [n.value, n.status])).toEqual([
      ["On a plan: ₵1,000, every month", "plan"],
      ["Paid", "paid"],
    ]);
  });
});

describe("diffNumbers and the log", () => {
  test("the first checkup logs every number; a check-in logs only what changed", () => {
    expect(diffNumbers(null, money, "checkup", "t1")).toHaveLength(5);
    const after: BusinessFacts = { ...money, money: { ...money.money!, cashNow: "₵3,500" } };
    expect(diffNumbers(money, after, "check-in", "t2")).toEqual([{ key: "cashNow", label: "Cash in hand", group: "money", value: "₵3,500", at: "t2", source: "check-in" }]);
    expect(diffNumbers(money, money, "check-in", "t2")).toEqual([]);
  });
  test("the log is capped, oldest first out", () => {
    const one = (i: number): NumberEntry => ({ key: "cashNow", label: "Cash in hand", group: "money", value: String(i), source: "check-in", at: String(i) });
    const log = appendNumbers(Array.from({ length: NUMBER_LOG_CAP }, (_, i) => one(i)), [one(9999)]);
    expect(log).toHaveLength(NUMBER_LOG_CAP);
    expect(log[0].value).toBe("1");
    expect(log[log.length - 1].value).toBe("9999");
  });
});

describe("numberRows: now, where it came from, and what it was", () => {
  test("a number that changed shows its earlier value, newest first", () => {
    const after: BusinessFacts = { ...money, money: { ...money.money!, cashNow: "₵3,500" } };
    const log = appendNumbers(diffNumbers(null, money, "checkup", "t1"), diffNumbers(money, after, "check-in", "t2"));
    const cash = numberRows(after, log).find((r) => r.key === "cashNow")!;
    expect(cash).toMatchObject({ value: "₵3,500", source: "check-in", at: "t2" });
    expect(cash.history).toEqual([{ value: "₵2,000", at: "t1", source: "checkup" }]);
    const lease = numberRows(after, log).find((r) => r.key === "due:shop lease")!;
    expect(lease).toMatchObject({ source: "checkup", at: "t1", history: [] });
  });
  test("a workspace from before the log still shows every number, from the checkup, undated", () => {
    const rows = numberRows(money, undefined);
    expect(rows).toHaveLength(5);
    expect(rows.every((r) => r.source === "checkup" && r.at === undefined && r.history.length === 0)).toBe(true);
  });
  test("a value changed outside the log is shown as theirs, with the logged one as history", () => {
    const log = diffNumbers(null, money, "checkup", "t1");
    const edited: BusinessFacts = { ...money, closeRate: "about 4 in 10" };
    const row = numberRows(edited, log).find((r) => r.key === "closeRate")!;
    expect(row).toMatchObject({ value: "about 4 in 10", source: "you", at: undefined });
    expect(row.history).toEqual([{ value: "about 3 in 10", at: "t1", source: "checkup" }]);
  });
  test("a value that went back to an earlier one is not shown as its own history", () => {
    const a: BusinessFacts = { ...money, closeRate: "about 4 in 10" };
    const log = [...diffNumbers(null, money, "checkup", "t1"), ...diffNumbers(money, a, "you", "t2"), ...diffNumbers(a, money, "check-in", "t3")];
    const row = numberRows(money, log).find((r) => r.key === "closeRate")!;
    expect(row).toMatchObject({ value: "about 3 in 10", source: "check-in", at: "t3" });
    expect(row.history.map((h) => h.value)).toEqual(["about 4 in 10"]);
  });
  test("plain labels for where a number came from", () => {
    expect(sourceLabel("check-in", true)).toBe("Updated in a check-in");
    expect(sourceLabel("checkup", false)).toBe("From your checkup");
  });
});

describe("missingNumbers: only what this kind of problem needs, in plain words", () => {
  test("money trouble asks for cash, sales and costs — not sales-funnel figures", () => {
    const f: BusinessFacts = { ...base, money: { due: [{ what: "Lease", amount: "₵9,000" }, { what: "Tax" }], costs: [] } };
    expect(missingNumbers(f)).toEqual([
      "How much cash the business has now",
      "What comes in from sales on a normal day or week",
      "Your main running costs (stock, staff, rent, power…)",
      "How much is due for tax",
    ]);
  });
  test("otherwise, the figures that show where customers are lost", () => {
    expect(missingNumbers({ ...base, closeRate: "3 in 10", followUp: "same day" })).toEqual(["How many people ask about buying each month", "What a typical order or job brings in"]);
    expect(missingNumbers(null)).toEqual([]);
  });
});

describe("correcting a number where it is shown", () => {
  test("the editable part keeps its period fixed", () => {
    expect(editableNumber(money, "moneyIn")).toEqual({ value: "₵300–₵450", suffix: "a day" });
    expect(editableNumber(money, "due:shop lease")).toEqual({ value: "₵9,000", suffix: "in two weeks" });
    expect(editableNumber(money, "closeRate")).toEqual({ value: "about 3 in 10" });
    expect(editableNumber(money, "nope")).toBeNull();
  });
  test("a corrected figure lands in the right fact, and is logged as theirs", () => {
    const next = setNumber(money, "moneyIn", { value: " ₵350–₵500 " }, "t2")!;
    expect(next.money!.moneyIn).toEqual({ amount: "₵350–₵500", per: "day" });
    expect(diffNumbers(money, next, "you", "t2")).toEqual([{ key: "moneyIn", label: "Money coming in from sales", group: "money", value: "₵350–₵500 a day", at: "t2", source: "you" }]);
    expect(setNumber(money, "cost:products", { value: "₵3,400" }, "t2")!.money!.costs[0].amount).toBe("₵3,400");
    expect(setNumber(money, "closeRate", { value: "4 in 10" }, "t2")!.closeRate).toBe("4 in 10");
  });
  test("mark paid, and undo it", () => {
    const paid = setNumber(money, "due:shop lease", { paid: true }, "t2")!;
    expect(paid.money!.due[0]).toMatchObject({ status: "paid", updatedAt: "t2" });
    expect(editableNumber(paid, "due:shop lease")).toBeNull(); // nothing to edit on a paid payment
    expect(setNumber(paid, "due:shop lease", { paid: false }, "t3")!.money!.due[0].status).toBeUndefined();
  });
  test("an empty, unchanged or unknown correction changes nothing", () => {
    expect(setNumber(money, "cashNow", { value: "   " }, "t")).toBeNull();
    expect(setNumber(money, "cashNow", { value: "₵2,000" }, "t")).toBeNull();
    expect(setNumber(money, "nope", { value: "1" }, "t")).toBeNull();
    expect(setNumber(money, "cashNow", { paid: true }, "t")).toBeNull();
    expect(setNumber(base, "cashNow", { value: "₵5" }, "t")).toBeNull();
  });
});

describe("logChanges: the old value is never lost", () => {
  test("a number changed for the first time in an older workspace keeps what it was", () => {
    const next: BusinessFacts = { ...money, money: { ...money.money!, cashNow: "₵3,500" } };
    const log = logChanges(undefined, money, next, "you", "t2");
    expect(log).toEqual([
      { key: "cashNow", label: "Cash in hand", group: "money", value: "₵2,000", source: "checkup" },
      { key: "cashNow", label: "Cash in hand", group: "money", value: "₵3,500", at: "t2", source: "you" },
    ]);
    const row = numberRows(next, log).find((r) => r.key === "cashNow")!;
    expect(row).toMatchObject({ value: "₵3,500", source: "you", at: "t2", history: [{ value: "₵2,000", source: "checkup" }] });
  });
  test("an already logged number gets no second baseline; nothing changed adds nothing", () => {
    const first = diffNumbers(null, money, "checkup", "t1");
    const next: BusinessFacts = { ...money, money: { ...money.money!, cashNow: "₵3,500" } };
    expect(logChanges(first, money, next, "check-in", "t2")).toHaveLength(first.length + 1);
    expect(logChanges(first, money, money, "check-in", "t2")).toBe(first);
  });
  test("a capitalised date after an amount reads naturally", () => {
    const f: BusinessFacts = { ...money, money: { ...money.money!, due: [{ what: "Rent", amount: "₵9,000", when: "In 9 days" }, { what: "Tax", when: "Overdue" }] } };
    expect(numbersFromFacts(f).slice(0, 2).map((n) => n.value)).toEqual(["₵9,000, in 9 days", "Overdue"]);
  });
});

describe("a fixed mistake is not a change in the business", () => {
  test("the wrong value disappears from the history; the fix is marked a correction", () => {
    const typo: BusinessFacts = { ...money, money: { ...money.money!, cashNow: "₵20,000" } }; // meant ₵2,500
    const fixed: BusinessFacts = { ...money, money: { ...money.money!, cashNow: "₵2,500" } };
    let log = logChanges(diffNumbers(null, money, "checkup", "t1"), money, typo, "you", "t2");
    log = logCorrection(log, typo, fixed, "t3");
    const row = numberRows(fixed, log).find((r) => r.key === "cashNow")!;
    expect(row).toMatchObject({ value: "₵2,500", source: "you", at: "t3", corrected: true });
    // "Was ₵2,000" from the checkup stays; the typo never appears, so nothing reads as a jump and a fall.
    expect(row.history).toEqual([{ value: "₵2,000", at: "t1", source: "checkup" }]);
    expect(log.filter((e) => e.key === "cashNow" && e.wrong).map((e) => e.value)).toEqual(["₵20,000"]);
    expect(log[log.length - 1]).toMatchObject({ value: "₵2,500", correction: true });
  });
  test("a first figure that was wrong (in an older workspace) is replaced with no trace in the history", () => {
    const fixed: BusinessFacts = { ...money, money: { ...money.money!, cashNow: "₵2,500" } };
    const row = numberRows(fixed, logCorrection(undefined, money, fixed, "t2")).find((r) => r.key === "cashNow")!;
    expect(row).toMatchObject({ value: "₵2,500", corrected: true, history: [] });
  });
  test("a real change keeps what it was", () => {
    const later: BusinessFacts = { ...money, money: { ...money.money!, cashNow: "₵2,500" } };
    const row = numberRows(later, logChanges(undefined, money, later, "you", "t2")).find((r) => r.key === "cashNow")!;
    expect(row.corrected).toBeUndefined();
    expect(row.history.map((h) => h.value)).toEqual(["₵2,000"]);
  });
});

describe("removing a number", () => {
  test("a payment or cost leaves the list; a single figure is cleared", () => {
    expect(removeNumber(money, "due:shop lease")!.money!.due).toEqual([]);
    expect(removeNumber(money, "cost:products")!.money!.costs).toEqual([]);
    expect(removeNumber(money, "moneyIn")!.money!.moneyIn).toBeUndefined();
    expect(removeNumber(money, "closeRate")!.closeRate).toBeUndefined();
    expect(numbersFromFacts(removeNumber(money, "cashNow")).some((n) => n.key === "cashNow")).toBe(false);
  });
  test("nothing to remove changes nothing; a removal is recorded, never shown as history", () => {
    expect(removeNumber(money, "nope")).toBeNull();
    expect(removeNumber(base, "cashNow")).toBeNull();
    const log = logRemoval(diffNumbers(null, money, "checkup", "t1"), money, "cashNow", "t2");
    expect(log[log.length - 1]).toMatchObject({ key: "cashNow", value: "₵2,000", removed: true });
    // Given again later: the old value is its history, the removal is not.
    const again: BusinessFacts = { ...money, money: { ...money.money!, cashNow: "₵900" } };
    const row = numberRows(again, logChanges(log, removeNumber(money, "cashNow"), again, "check-in", "t3")).find((r) => r.key === "cashNow")!;
    expect(row.history.map((h) => h.value)).toEqual(["₵2,000"]);
  });
});
