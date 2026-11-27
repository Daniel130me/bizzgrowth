import { describe, expect, test } from "bun:test";
import { improveHelps, type MoneyFacts } from "./checkup";

const money: MoneyFacts = { due: [{ what: "Lease", amount: "₵9,000" }], costs: [] };

describe("improveHelps: channel counts are offered only where they can change the read", () => {
  test("a read about getting found, enquiries or winning customers", () => {
    for (const focusStage of ["found", "enquire", "convert"] as const) expect(improveHelps({}, { focusStage })).toBe(true);
    expect(improveHelps({}, {})).toBe(true); // older reads had no stage: they were about winning customers
  });
  test("not for delivering, repeat customers, money trouble or a problem outside sales", () => {
    expect(improveHelps({}, { focusStage: "deliver" })).toBe(false);
    expect(improveHelps({}, { focusStage: "return" })).toBe(false);
    expect(improveHelps({ money }, { focusStage: "convert" })).toBe(false);
    expect(improveHelps({}, { focusStage: "convert" }, "outside")).toBe(false);
    expect(improveHelps(null, { focusStage: "convert" })).toBe(false);
  });
});
