/**
 * Behavioral tests for the corrected intake engine.
 * Run: bun /home/z/my-project/scripts/test-engine.ts
 * Reproduces every bug observed in the live chat transcript and asserts the fix.
 */
import {
  IntakeEngine,
  extractFromText,
  parseMonth,
  type EngineTurn,
} from "/home/z/my-project/download/chat-fix/chat-engine.ts";

let failures = 0;
function check(name: string, cond: boolean, detail = "") {
  if (cond) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}${detail ? " — " + detail : ""}`);
  }
}

const TODAY = new Date(2026, 10, 18); // 18 Nov 2026

async function runConversation(script: string[]) {
  const e = new IntakeEngine({ today: TODAY, businessName: "Node 71 limited" });
  const turns: EngineTurn[] = [e.open()];
  for (const msg of script) {
    turns.push(await e.handleUserMessage(msg));
  }
  return turns;
}

console.log("== unit: parseMonth ==");
check("last month -> October 2026", parseMonth("last month", TODAY)?.label === "October 2026");
check("october -> October 2026", parseMonth("october", TODAY)?.label === "October 2026");
check("october 2026", parseMonth("october 2026", TODAY)?.label === "October 2026");
check("2026-10 -> October 2026", parseMonth("2026-10", TODAY)?.label === "October 2026");
check("10/2026 -> October 2026", parseMonth("10/2026", TODAY)?.label === "October 2026");
check("'marketing' does not match march", parseMonth("we spent 200k on marketing", TODAY) === undefined);
check("'may have made' does not match May", parseMonth("we may have made 700k", TODAY) === undefined);
check("january -> January 2026 (past)", parseMonth("january", TODAY)?.label === "January 2026");

console.log("== unit: extractor ==");
const e1 = extractFromText("we didnt do any marketing", "marketing", TODAY);
check("negation -> marketing 0", e1.marketing?.amount === 0 && e1.marketing?.isZero === true);
const e2 = extractFromText("200,000 naira", "revenue", TODAY);
check("200,000 naira -> revenue 200000", e2.revenue?.amount === 200000);
const e3 = extractFromText("we made about 700k, spent 200k on ads", "revenue", TODAY);
check("combined sentence: revenue 700k", e3.revenue?.amount === 700000);
check("combined sentence: marketing 200k", e3.marketing?.amount === 200000);
const e4 = extractFromText("₦0 — we did none", "marketing", TODAY);
check("quick reply zero -> 0", e4.marketing?.amount === 0);

console.log("== scenario 1: the exact flow from the broken transcript ==");
const t1 = await runConversation([
  "Last month",
  "Last month", // stale quick-reply tap (the bug trigger)
  "200,000 naira",
  "we didnt do any marketing",
]);
const [o, a1, a2, a3, a4] = t1;
check("open asks month", /which month/i.test(o.assistantText));
check("turn1 leads with month-only ack, no ₦ echo", /^got it — october 2026\./i.test(a1.assistantText.trim()) && !/₦/.test(a1.assistantText), a1.assistantText);
check("turn1 asks revenue", /how much/i.test(a1.assistantText));
check("turn1 chips: month + no revenue yet", a1.chips.some(c => c.label === "October 2026") && !a1.chips.some(c => c.label.startsWith("Revenue")));
// the duplicate "Last month" must NOT re-ask revenue verbatim
check("turn2 flags duplicate", /(already noted|i have that) — october 2026/i.test(a2.assistantText), a2.assistantText);
check("turn2 does NOT repeat revenue wording verbatim", !/Roughly how much did the business make/i.test(a2.assistantText), a2.assistantText);
check("turn2 progress 1/3", a2.progress.answered === 1);
check("turn3 captures revenue 200000", a3.chips.some(c => c.label === "Revenue: ₦200,000"), a3.chips.map(c=>c.label).join("|"));
check("turn3 asks marketing", /marketing/i.test(a3.assistantText));
// THE critical bug: "we didnt do any marketing" must capture 0 and move to done
check("turn4 captures Marketing ₦0", a4.chips.some(c => c.label === "Marketing: ₦0"), a4.chips.map(c=>c.label).join("|"));
check("turn4 is done", a4.done === true);
check("turn4 result marketing=0", a4.result?.marketing === 0);
check("turn4 result revenue=200000", a4.result?.revenue === 200000);
check("turn4 mentions ROAS n/a or no spend", /₦0|no marketing spend/i.test(a4.assistantText), a4.assistantText);
check("turn4 quick replies offer save/edit", a4.quickReplies.includes("Save it") && a4.quickReplies.some(q=>q.startsWith("Edit")));
// no verbatim repeats anywhere in bot turns
const botTexts = t1.map(t => t.assistantText);
const uniq = new Set(botTexts);
check("no duplicate bot texts in whole flow", uniq.size === botTexts.length);

console.log("== scenario 2: combined answer in one message ==");
const t2 = await runConversation(["September", "we made about 700k, spent 200k on ads"]);
const last2 = t2[t2.length - 1];
check("both slots captured in one turn", last2.done && last2.result?.revenue === 700000 && last2.result?.marketing === 200000);
check("chips show both", last2.chips.some(c=>c.label==="Revenue: ₦700,000") && last2.chips.some(c=>c.label==="Marketing: ₦200,000"));

console.log("== scenario 3: not sure / skip / that's everything ==");
const e3s = new IntakeEngine({ today: TODAY });
await e3s.handleUserMessage("october");
const tA = await e3s.handleUserMessage("I'm not sure");
check("revenue 'not sure' -> unknown chip", tA.chips.some(c => c.label === "Revenue: not sure" && c.muted), tA.chips.map(c=>c.label).join("|"));
const tB = await e3s.handleUserMessage("that's everything I have");
check("finishes with marketing unknown", tB.done && tB.result?.marketing === null && tB.result?.revenue === null);

console.log("== scenario 4: gibberish x3 on a skippable slot -> auto-skip ==");
const e4s = new IntakeEngine({ today: TODAY });
await e4s.open();
await e4s.handleUserMessage("october"); // month answered
await e4s.handleUserMessage("banana");  // revenue attempt 1 (rephrase)
await e4s.handleUserMessage("banana");  // revenue attempt 2 (rephrase + skip hint)
const tC = await e4s.handleUserMessage("banana"); // attempt 3 -> auto-skip
check("after 3 failures revenue skipped, marketing asked", /marketing/i.test(tC.assistantText) && tC.chips.some(c=>c.label==="Revenue: not sure"), tC.assistantText);
check("no verbatim repeat of revenue wording", !/Roughly how much did the business make/i.test(tC.assistantText), tC.assistantText);

console.log("== scenario 5: edit flow ==");
const e5s = new IntakeEngine({ today: TODAY });
await e5s.handleUserMessage("october 2026");
await e5s.handleUserMessage("500k");
const tD = await e5s.handleUserMessage("edit revenue");
check("edit reopens slot", /revenue again/i.test(tD.assistantText), tD.assistantText);
check("revenue chip removed", !tD.chips.some(c=>c.label.startsWith("Revenue")));
const tE = await e5s.handleUserMessage("250k");
check("new value captured", tE.chips.some(c=>c.label==="Revenue: ₦250,000"));

console.log("== scenario 6: month fallback after 3 failures ==");
const e6s = new IntakeEngine({ today: TODAY });
await e6s.open();
await e6s.handleUserMessage("banana");
await e6s.handleUserMessage("banana");
const tF = await e6s.handleUserMessage("banana");
check("month falls back to last month", /I'll use October 2026/i.test(tF.assistantText) && tF.chips.some(c=>c.label==="October 2026"), tF.assistantText);

console.log(failures === 0 ? "\nALL TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
