# t01 gap list

In the plan's format (`docs/ai-quality-test-plan.md`, "Gap list"). Only t01 was run, so "How often"
is out of 1 case. Ranked by severity, then by how widely the cause reaches beyond this case.
"Missing feature" items are product decisions for the owner, not automatic builds.

Status: **re-tested** = fixed and seen working in a live call on the fixed code (the after run or a
round-3 replay); **fixed** = fixed and covered by a unit test, not seen live; **open** = not fixed.

## Critical

| # | Gap | Cases | Cause | Severity | How often | Fix | Status |
|---|---|---|---|---|---|---|---|
| 1 | A figure the model worked out ("about 600 a month") was saved as the owner's answer, then quoted as hers in Ask, the brief and insights | t01 | Nellovia's instructions; no check that a recorded answer is the owner's | critical | 1 of 1 | Recorded counts and amounts must use only numbers the owner said, with their period; facts keep only answered fields; trends only when they spoke of a change | re-tested |
| 2 | The checkup never asked about other debts, cash in hand, money in vs costs or how they planned to pay, so the loan app and the overdue supplier never came out and every answer planned around the rent alone | t01 | Missing information: no money-trouble questions | critical | 1 of 1 | Money-trouble mode, switched on by the owner's own words: what is due, other debts, cash now, money in and out, how they planned to cover it, then prices, platform fees and whether the people owed were flexible before; funnel questions swapped out | re-tested (5 of 6 hidden facts) |
| 3 | The diagnosis and Ask agreed "it's a timing problem, not the business" when her own figures show it loses money every month | t01 | Nellovia's instructions; no money maths | critical | 1 of 1 | Money worked out in code from the owner's figures (due vs cash, money in vs running costs, biggest cost's share, a stated figure that doesn't add up), given to every feature and shown on a money card with the working; rule: never accept the owner's explanation of a money problem on trust | re-tested |
| 4 | Ask didn't plainly say no to another loan-app loan, and suggested "How much loan can I safely take?" | t01 | Nellovia's instructions | critical | 1 of 1 | Hard-times rules: never suggest new borrowing to cover a shortfall; say plainly why and what to do instead | re-tested |
| 5 | Check-in: a lender contacting her contacts got no "this is not acceptable, keep proof, report it", and "I feel like just closing everything" got no answer | t01 | Instructions; the model skipped the rule | critical | 1 of 1 | Routine questions stop after a serious answer; harassment rule; a kind sentence is added in code when the reply skips distress; harassment wording widened ("disturbing / bothering my contacts") | re-tested (round-3 replay) |
| 6 | The challenge diagnosis ignored the harassment | t01 | The model skipped the rule, even with it in the instructions | critical | 1 of 1 | A safety step is added in code unless the read says both that it is not acceptable and what to do | re-tested (round-3 replay) |
| 7 | AI routes answered with no sign-in, so anyone could spend the AI credit | t01 probe | Missing guard | critical | every AI route | Every AI route needs a signed-in account (401), with a per-account limit (429 after 40 calls a minute) | re-tested (401) |

## Major

| # | Gap | Cases | Cause | Severity | How often | Fix | Status |
|---|---|---|---|---|---|---|---|
| 8 | Ask answers gave no words to use, only a button to open a draft | t01 | Flow / screen | major | 1 of 1 | Ask returns ready-to-use words in a copy box, with the draft button kept | re-tested |
| 9 | Words to someone she owes told them about her other debts (weakens her position) and offered no amount or date | t01 | Nellovia's instructions | major | 1 of 1 | Ask and draft rule: one clear offer — what they can pay now and when the rest follows, [amount] and [date] if unknown — never other debts or all their cash | re-tested (round-3 replay) |
| 10 | The diagnosis didn't say in words that her ₦2.5m a month doesn't add up, gave no words for the supplier, and offered an irrelevant "priority order" tool | t01 | Nellovia's instructions | major | 1 of 1 | The mismatch goes into "meaning" with a question about which months; in money trouble every tool helps with a payment due (one per person owed), no menus or marketing | re-tested (round-3 replay) |
| 11 | The next step's check-in came after the deadline (14 days, rent due in 9, loan on day 8) | t01 | Code: no deadline check | major | 1 of 1 | The step's check-in lands before the first dated payment, in code | re-tested |
| 12 | The checkup sided with her own explanation ("timing, not demand", "…even a steady business", "…points to the yearly rent, not a day-to-day sales problem") | t01 | The model's wording; the first filter chased phrases | major | 1 of 1 | Wider neutrality filter, plus: right after the owner explains the cause in their own words, the reply only thanks them and asks on | re-tested (round-3 replay) |
| 13 | A stuck provider used the whole time limit: a chat turn took 26 s. The first fix (70% for the first try) left the next providers 3 s and 2 s, so nobody answered | t01 fallback | Reliability | major | whenever a provider hangs | One time limit for the whole request: the first try gets half, later tries what is left minus 3 s | re-tested (chat 17.0 s, Ask 37.8 s, both answered) |
| 14 | With every provider down, the no-AI turn filed her rent emergency as "what she sells" and asked a growth question | t01 probe | Flow (no-AI fallback) | major | whenever every provider is down | A money-trouble opener keeps what is due and her cash in her own words, files the message as the main problem, and asks what they sell | re-tested |
| 15 | Specialist matching padded the list with a writer and an ads specialist, "matched by overlapping skills: bookkeeping, hiring" — skills neither has | t01 | Code bug: every specialist was credited with whatever the request mentioned | major | most match requests | A skill counts only when the request asks for it and the specialist offers it; no padding without a category or skill match | re-tested |
| 16 | Grounding missed a bare "1.5m" and amounts in words ("three hundred thousand") | t01 | Code | major | — | Attached m/b suffixes and spelled-out amounts are checked | re-tested (11 of 11 probes) |
| 17 | The money picture goes stale after a check-in: the landlord agreed instalments, but later reads still plan around "rent due in 9 days" | t01 | **Missing feature** | major | every money case with check-ins | Proposed: a list of what is owed (amount, date, to whom), updated from check-ins and shown with reminders | open — product decision |
| 18 | The harassment advice names no body to report to (in Nigeria, the FCCPC handles digital-lender abuse) | t01 | **Missing feature** | major | lender-harassment cases | Proposed: a small, vetted help directory per country (regulators, support lines), quoted only from that list | open — product decision |

## Minor

| # | Gap | Cases | Cause | Severity | How often | Fix | Status |
|---|---|---|---|---|---|---|---|
| 19 | A food shop was labelled "ecommerce" ("a ecommerce business"), and the model read it as an online store | t01 | Flow / screen | minor | every product business | Shown as "a business that sells products"; the toggle reads "Sells products" | fixed |
| 20 | Check-in: "…a later balance??", count answers ("3 to 5") for a yes/no question | t01 | Flow | minor | yes/no steps | Yes/no answers to tap, one question mark, "yes"/"no" read for the verdict | fixed |
| 21 | Check-in re-asked what she had just said in her first answer | t01 | Flow | minor | 1 of 1 | — | open |
| 22 | The checkup asked who buys (not needed in money trouble) because the wording wasn't recognised | t01 | Code | minor | 1 of 1 | That wording is recognised; when none is, the model's own label is used | re-tested |
| 23 | Improve showed 80% confidence while saying it can't tell, and ignored the money picture | t01 | Code; flow | minor | money cases | Confidence capped at 72 for money reads (fixed). Improve asks for channel counts only — proposed: order value and fees per channel | partly fixed; rest open — product decision |
| 24 | After Improve, the toast said confidence went up when it hadn't | t01 | Screen | minor | — | The toast claims an increase only when there is one | fixed |
| 25 | A stray word in another script in a reply ("how quickly do you عادة reply") | t01 | Model | minor | rare | Removed unless the owner writes in that script | fixed |
| 26 | A learned-answer chip read "Cash now: — ₦700k" | t01 | Code | minor | — | The dash is stripped | fixed |
| 27 | A stored check-in note was cut mid-sentence ("…But the ") | t01 | Code | minor | long answers | Proposed: cut at a sentence end | open |
| 28 | The diagnosis headline leads with her framing ("Yearly rent comes as one big amount…"), not the monthly loss | t01 | Model | minor | 1 of 1 | The instructions already say so; the model softens it | open |
| 29 | The checkup never asks where a stated monthly figure came from | t01 | Nellovia's instructions | minor | 1 of 1 | The diagnosis now asks; proposed: a checkup follow-up when a stated figure doesn't match their daily ones | open |
| 30 | After one hang, the next request also waits half the time for the stuck provider (a timeout counts as one failure; two open the circuit) | t01 fallback | Reliability | minor | whenever a provider hangs | Proposed: pause a provider after one timeout. More traffic goes to the second model for a minute — an ops choice | open — owner's call |
| 31 | Matching ignores what she can afford (₦10,000 an hour during a cash crisis) | t01 | **Missing feature** | minor | money cases | Proposed: budget-aware matching | open — product decision |
| 32 | Growth tiles on a money diagnosis ("Marketing spend: not mentioned in your checkup") | t01 | Screen | minor | money cases | Proposed: hide unknown tiles in money mode | open |
| 33 | Cerebras is switched on in the admin screen but has no key, so it is never tried | config | Configuration | minor | — | Add a key or switch it off — not changed here (live AI settings were off-limits) | open — owner's call |
| 34 | The test tool read `.env` through Bun, which keeps only the first of several quoted keys, so the saved provider snapshot under-counted keys. The app itself loads every key | t01 tooling | Test tooling | minor | — | The tool now reads `.env` the way Next.js does; the after snapshot was re-taken | fixed |

## Features this test exposed (not built; product decisions)

- **A week-by-week cash plan** for the days before a payment: what comes in, what must go out,
  what can be paid when. Neither Nellovia nor the plain AI gave one.
- **What's owed, tracked**: amounts, dates and who, updated from check-ins, with reminders before
  each date (gap 17).
- **A vetted help directory per country**: regulators and support lines, so "report it" names
  where (gap 18).
- **Improve for money cases**: order value and fees per channel instead of only channel counts
  (gap 23).
- **A price check against cost rises**: her prices were a year old while diesel doubled; the
  insights noticed, nothing helps her work out new prices.
- **"Since your last visit"**: a short list of what changed and what Nellovia noticed — only when
  something real happened (North Star).
- **Budget-aware specialist matching** (gap 31).
