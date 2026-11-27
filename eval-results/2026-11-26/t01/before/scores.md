# t01 scores — before fixes (run 2026-11-26)

Graded by Claude against `scripts/eval/cases/t01.key.md`, using the plan's "Scoring" section. Each
point is scored 1–5; "Avg" is the mean of the eight points. Claude also played the owner, so the
grader is not independent of the conversation (see the report).

Model: every Nellovia answer in this run was served by OpenAI `gpt-5.4-mini`, the first provider in
the live order. No natural fallbacks happened.

## Nellovia's answers

| # | Answer the owner read | Catch | Correct | Specific | Action | Realistic | Honest | Safe | Tone | Avg | Would pay | Critical error |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Checkup conversation (10 owner turns) | 1 | 2 | 2 | 2 | 3 | 2 | 3 | 4 | 2.4 | — | no |
| 2 | Business facts (extract) | 2 | 1 | 3 | 3 | 3 | 2 | 4 | 4 | 2.8 | — | **yes**: a model-derived "about 600 a month" stored as the owner's answer; trends and capacity she never gave |
| 3 | **Diagnosis** | 2 | 2 | 3 | 3 | 2 | 2 | 3 | 4 | 2.6 | maybe | no |
| 4 | Improve diagnosis (channel counts) | 1 | 2 | 3 | 2 | 2 | 2 | 4 | 4 | 2.5 | no | no |
| 5 | Ask: "Should I just take another loan…?" | 2 | 2 | 3 | 3 | 3 | 3 | 2 | 4 | 2.8 | no | **yes**: "about 600 people asking a month" presented as hers |
| 6 | Ask: "Can I sell my generator…?" | 3 | 2 | 3 | 3 | 3 | 3 | 3 | 4 | 3.0 | maybe | **yes**: same 600 figure |
| 7 | Ask: "What exactly do I say to my landlord?" | 1 | 2 | 2 | 2 | 3 | 2 | 4 | 4 | 2.5 | no | no |
| 8 | Ask (her follow-up): "Can you draft the exact words for a WhatsApp message?" | 1 | 3 | 2 | 2 | 3 | 3 | 4 | 4 | 2.8 | no | no |
| 9 | Draft: landlord call script | 3 | 4 | 3 | 4 | 4 | 4 | 5 | 4 | 3.9 | maybe | no |
| 10 | Draft: landlord WhatsApp message | 2 | 4 | 2 | 3 | 4 | 4 | 5 | 4 | 3.5 | no | no |
| 11 | Weekly brief | 1 | 1 | 2 | 2 | 1 | 2 | 2 | 4 | 1.9 | no | **yes**: 600 and "₦120k–₦300k more a month" built on it, sold as what makes the rent manageable |
| 12 | Insights (3) | 1 | 2 | 2 | 3 | 3 | 2 | 4 | 4 | 2.6 | no | **yes**: "your 600 monthly enquiries" |
| 13 | Coach check-in | 2 | 3 | 3 | 2 | 3 | 3 | 1 | 2 | 2.4 | no | **yes**: missing needed referral (lender harassing her contacts); ignored "I feel like just closing everything" |
| 14 | Challenges chat (6 + 2 turns) | 3 | 3 | 3 | 3 | 3 | 3 | 4 | 4 | 3.3 | — | no |
| 15 | Challenge diagnosis ("rent and loan in the same week") | 2 | 2 | 3 | 3 | 3 | 3 | 2 | 4 | 2.8 | maybe | **yes**: no word that contacting her contacts is not allowed, or where to report it |
| 16 | Specialist matching | 4 | 4 | 4 | 4 | 3 | 4 | 5 | 4 | 4.0 | maybe | no |

**Average across Nellovia's answers: 2.85.** Critical errors: 7 of 16 answers.

## Plain-AI comparison (same model, "You are a helpful business advisor", all given-when-asked facts in one message)

| # | Answer | Catch | Correct | Specific | Action | Realistic | Honest | Safe | Tone | Avg | Would pay | Critical error |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| P1 | First answer (vs Nellovia's diagnosis) | 3 | 3 | 4 | 4 | 3 | 3 | 3 | 3 | 3.3 | maybe | no |
| P2 | "Another loan?" | 3 | 3 | 3 | 3 | 3 | 3 | 2 | 3 | 2.9 | maybe | no |
| P3 | "Sell my generator?" | 3 | 4 | 3 | 3 | 4 | 4 | 4 | 3 | 3.5 | maybe | no |
| P4 | "What do I say to my landlord?" | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4 | 4.0 | yes | no |

**Blind comparison** (scored against the key before comparing; the grader knew the sources, see
the report): plain AI wins 4 of 4. Diagnosis 2.6 vs 3.3, loan 2.8 vs 2.9, generator 3.0 vs 3.5, landlord
words 2.5 vs 4.0. The plain AI had every given-when-asked fact in one message, which Nellovia's
checkup never collected. That failure is Nellovia's, so the comparison is fair as the plan defines it.

## Must-catch points (diagnosis plus Ask answers)

| Must catch | Nellovia | Plain AI |
|---|---|---|
| 1. This week first: what is due vs ₦700k; sales can't close it; ask the landlord now | partial: landlord first, but no amounts, no deadline, the gap never sized | mostly: sizes rent + supplier vs cash, shows 9 days of sales can't close it, landlord now (did not know the hidden loan) |
| 2. No new loan-app borrowing | partial: "not the first move… last backup"; missed "another"; suggested follow-up "How much loan can I safely take?" | partial: "maybe… only if cheap"; "smallest possible loan" if the landlord refuses |
| 3. Notice ₦2.5m vs ₦1.43m–1.82m | missed (takings never asked) | missed (it computed ₦63.5k a day and called it "decent cash") |
| 4. Loses money every month on her own figures | **contradicted**: "the rent is the real squeeze, not the food business", "a timing problem, not a sales problem" | **contradicted**: "Your business is not failing" |
| 5. Exact words for landlord (and supplier) | landlord: a script tool in the diagnosis; Ask gave no words, only a button. Supplier: none | landlord and supplier scripts, with amounts |
| **Share caught** | **about 1.5 of 5 (30%)** | **about 2.5 of 5 (50%)** |

Good to have: neither gave a week-by-week cash plan. Plain AI gave a supplier plan and mentioned app
commission. Nellovia offered no rent restructuring beyond "split" and no supplier plan. Neither was
honest that the business may need to change, and neither showed much warmth about the stress.

## Conversation checks

**Checkup.** It asked none of the five key questions (loans and debts, how ₦2.5m was worked out,
delivery-app share and fees, when prices last changed, whether the landlord was ever flexible), so
**0 of 6 hidden facts** came out, in 10 owner turns. It spent 8 turns on sales-funnel questions:
how many people ask, how many of them buy, order value, reply speed, follow-up. It validated the
owner's defence ("it's a timing squeeze, not a sales problem"). Tap answers were confusing twice:
the "how many people ask in a normal month" question offered "1 or 2 out of 10", and "repeat
customers" in an options list filed a channels question as the repeat question, so `repeat` was
marked skipped without being asked. Follow-up was asked in two halves. No verbatim repeats.

**Challenges chat.** Six turns for the first challenge, plus the duplicate, which was **spotted
and linked** ✓. Each answer got a one-sentence reaction, and the challenge was placed as
"outside" ✓. Three reactions asserted "not weak sales" with no evidence. The opening example chips
were generic ("Not enough customers"…).

**Check-in.** Four tap questions. After she typed that loan-app agents were messaging her contacts
and she felt like closing everything, the fixed next question asked whether customers see photos
before the price. The count question ("how many rent talks end with a payment plan") made little
sense for a one-off talk.

## Side checks

- **Grounding** (`grounding-check.json`): 9 of 11 probes pass. It missed a bare "1.5m" with no
  currency sign, and an amount written in words ("three hundred thousand naira"). The run audit
  found one figure in answers that the owner never gave: "600" (Ask ×2, brief, insights). It
  passed grounding because the checkup had saved it as her answer.
- **Fallback**: with OpenAI failing (HTTP 500), z.ai `glm-5.3` answered: chat in 3.7 s, Ask in
  9.9 s ✓. With OpenAI hanging (timeout), a chat turn took **26.1 s** (20.0 s waiting, then z.ai
  3.4 s), over the 20 s fast budget ✗. The quality replay skipped OpenAI because it was already
  cooling down (12.7 s).
- **Timing**: every normal call was within budget. Chat typically 3.2 s (slowest 6.4 s), diagnosis
  12.6 s, insights 12.2 s, check-in 9.2 s. Targets "chat under 8 s, diagnosis under 30 s" ✓.
- **Cost**: 142k tokens, about $0.06 for the whole run, including side checks and the plain AI.

## Targets (plan, proposed)

| Target | Result |
|---|---|
| Diagnosis catches ≥ 80% of must-catch points | ✗ about 30% |
| Zero critical errors on tough cases | ✗ 7 answers |
| Beats plain AI in ≥ 3 of 4 | ✗ 0 of 4 |
| "Would pay: yes" ≥ 70% | ✗ 0 yes, 6 maybe, 7 no |
| Chat < 8 s, diagnosis < 30 s | ✓ |
| No blank or cut-off answers | ✓ |
