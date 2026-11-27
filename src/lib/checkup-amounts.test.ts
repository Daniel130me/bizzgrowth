import { describe, expect, test } from "bun:test";
import { amountInFull, foreignCurrency, parseAmount, parseCloseRate, wordsToDigits } from "./checkup-math";

describe("amounts written in words are read like digits", () => {
  test("whole numbers in words, with 'and', 'a', 'half'", () => {
    expect(parseAmount("nine hundred and sixty thousand naira")).toEqual({ low: 960000, high: 960000 });
    expect(parseAmount("two million five hundred thousand")).toEqual({ low: 2500000, high: 2500000 });
    expect(parseAmount("half a million")).toEqual({ low: 500000, high: 500000 });
    expect(parseAmount("a thousand cedis")).toEqual({ low: 1000, high: 1000 });
    expect(parseAmount("one hundred and twenty")).toEqual({ low: 120, high: 120 });
  });
  test("lakh and crore, as owners in South Asia write them", () => {
    expect(parseAmount("three lakh")).toEqual({ low: 300000, high: 300000 });
    expect(parseAmount("2 crore")).toEqual({ low: 20000000, high: 20000000 });
  });
  test("every way of writing the same amount gives the same figure", () => {
    for (const s of ["₦960,000", "₦960k", "960k", "N960k", "₦0.96m", "960 thousand", "nine hundred and sixty thousand"]) {
      expect(parseAmount(s)).toEqual({ low: 960000, high: 960000 });
    }
  });
  test("ranges borrow the scale only when it fits", () => {
    expect(parseAmount("fifty to seventy thousand")).toEqual({ low: 50000, high: 70000 });
    expect(parseAmount("between two and three million")).toEqual({ low: 2000000, high: 3000000 });
    expect(parseAmount("₦500 to ₦70,000")).toEqual({ low: 500, high: 70000 });
  });
  test("everyday words around numbers are unchanged", () => {
    expect(wordsToDigits("Two out of five, a lot of people and one of them")).toBe("2 out of 5, a lot of people and 1 of them");
    expect(wordsToDigits("twenty one customers")).toBe("21 customers");
    expect(parseCloseRate("two out of five")).toEqual({ won: 2, of: 5 });
  });
});

describe("amountInFull: what the owner sees is exactly what was understood", () => {
  test("shorthand and words written out in full; counts and percentages untouched", () => {
    expect(amountInFull("₦950k", "₦")).toBe("₦950,000");
    expect(amountInFull("N960k", "₦")).toBe("₦960,000");
    expect(amountInFull("₦3.6m, in 9 days", "₦")).toBe("₦3,600,000, in 9 days");
    expect(amountInFull("₦55,000 to ₦70,000 a day", "₦")).toBe("₦55,000 to ₦70,000 a day");
    expect(amountInFull("fifty to seventy thousand a day", "₵")).toBe("₵50,000 to ₵70,000 a day");
    expect(amountInFull("nine hundred and sixty thousand naira", "₦")).toBe("₦960,000");
    expect(amountInFull("The delivery apps take about 20% before paying me", "₦")).toBe("The delivery apps take about 20% before paying me");
    expect(amountInFull("Open 26 days a month", "₦")).toBe("Open 26 days a month");
  });
});

describe("money in another currency is never mixed in", () => {
  test("a figure in another currency is spotted; the business's own is not", () => {
    expect(foreignCurrency("$960,000", "₦")).toBe("$");
    expect(foreignCurrency("500 dollars", "₦")).toBe("$");
    expect(foreignCurrency("₵1,200", "₦")).toBe("₵");
    for (const own of ["₦960,000", "N960k", "960k", "960 thousand naira", "Rent of 3.6m in 9 days"]) expect(foreignCurrency(own, "₦")).toBeNull();
    expect(foreignCurrency("$500", "$")).toBeNull();
    expect(foreignCurrency("₦500", "$")).toBe("₦");
  });
});
