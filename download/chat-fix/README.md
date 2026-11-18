# Chat quality fix — evaluation + corrected code

Fixes for the "Chat with the intelligence" intake and the Ask page
(software workspace "Node 71 limited"). Based on the live transcript and
screenshot supplied by the user.

---

## 1. What was wrong (from your transcript, turn by turn)

| # | Severity | Observed behaviour in your chat | Root cause |
|---|----------|--------------------------------|------------|
| B1 | **Critical** | User: *"we didnt do any marketing"* → bot answered *"Perfect — October 2026, revenue ₦200,000. **And how much went into marketing that month…**"* — the same question again. Nothing was captured. | Extraction only matches digits/currency. Negation answers ("none", "nothing", "didn't do any", "zero") fail silently, and on failure the bot re-asks **verbatim**. |
| B2 | High | The quick reply **"Last month"** stayed on screen *after* the month was answered. The user tapped it, producing a junk turn. | Quick replies are static per question and never filtered against already-collected values. |
| B3 | Medium | The duplicate *"Last month"* got acknowledged as new (*"Noted — October 2026"*) and the revenue question was repeated **word-for-word**. | No duplicate guard; no wording variants; the bot can't tell "new info" from "repeat". |
| B4 | Medium | *"October 2026, revenue ₦200,000"* restated in **three consecutive bot turns**. | Prompt-level "confirm what I've heard so far" leaks the whole state into every message. |
| B5 | Medium | "What I've heard so far" never gained **Marketing: ₦0** even after the user answered the marketing question. | Chips don't derive from state each turn; zero is treated as "missing" instead of a value. ₦0 marketing is a real business fact (ROAS = n/a). |
| B6 | Medium | No progress indicator; after the last answer nothing synthesises automatically — the only finish path is the easy-to-miss "Save what we have". | No step counter; no auto-finish transition. |
| Ask | **Critical** | User typed *"where are we in the business right now?"* with no recorded data → **nothing rendered at all**. | The ask handler returns an empty response when the workspace has zero records, and the UI renders `""`. An assistant must never answer with silence. |

## 2. The design rule that fixes all of it

> **The code decides which question comes next. The model (if you keep one) only extracts values.**

- Deterministic slot state machine: `month → revenue → marketing`, each slot is `empty / answered / unknown`.
- A slot that is answered is **never** asked again; duplicates get a one-line nudge ("Already noted — October 2026.").
- Every re-ask uses a **different wording variant** — verbatim repeats are structurally impossible.
- Quick replies are regenerated for the current question on **every** turn, so stale options vanish.
- Zero / negation answers ("we didnt do any marketing") parse to **₦0** and show as a chip.
- Acknowledgements mention **only** what was just captured; the running summary lives in the chips strip.
- Failure ladder per slot: rephrase (1) → help + "skip" offer (2) → auto-skip as "not sure" (3). The month can't be unknown — after 3 failures it falls back to *last month*, clearly flagged and editable.
- After the last slot, the engine **auto-finishes** with a snapshot card and returns the record to save.
- The Ask page always renders one of four structured responses: `answer | no_data | no_match | error`.

## 3. Files

| File | What it is |
|------|------------|
| `chat-engine.ts` | The engine (framework-agnostic TypeScript). Rule-based extractor + optional `llmExtract` hook — the LLM may only *fill gaps*; rules win on conflicts. |
| `ChatPanel.tsx` | Drop-in React panel (shadcn/ui + Tailwind, matches your current markup: blue bubbles, chips strip, quick replies). Adds progress bar, aria-live log, Save & finish. |
| `ask-answer.ts` | `buildAskResponse()` — guaranteed non-empty structured response for the Ask page, including the `no_data` card with CTAs. |
| `AskResponseCard.tsx` | Renders the four response kinds (never blank; includes loading state). |
| `chat-demo.html` | Self-contained reference demo. The **exact** `chat-engine.ts` / `ask-answer.ts` are transpiled into it — open it, press **Replay the broken scenario** and watch your failing sequence handled correctly. |

## 4. Integration

1. Copy `chat-engine.ts` next to your chat panel; adjust the shadcn import paths in `ChatPanel.tsx` / `AskResponseCard.tsx` to your project's aliases.
2. Replace your intake panel with `<ChatPanel businessName="Node 71 limited" onSave={record => api.saveMonth(record)} />`.
   - `IntakeResult = { month, revenue, marketing, unknownSlots }` — `null` value = user wasn't sure; store it as unknown, not 0.
3. In your ask API route, return `buildAskResponse(query, workspaceData, compute)` — and if you keep an LLM for answering, feed it only the `compute()` result; the empty-workspace case must return the `no_data` object **before** any model call.
4. Optional: pass `llmExtract` to the engine for fuzzy phrasings. Signature: `(text, currentSlot) => { month?, revenue?, marketing? }`. Rules run first and win on conflicts, so a hallucinated extraction can never overwrite captured data.

**What NOT to change back:** don't let the LLM compose the next question, don't render quick replies from a static list, don't skip the `no_data` branch in the ask route.

## 5. Verified

- 42/42 behavioural tests pass (`scripts/test-engine.ts`, run with `bun`): the exact broken transcript sequence, combined answers ("we made about 700k, spent 200k on ads"), not-sure/skip, gibberish ×3 auto-skip, edit flow, month fallback, and unit coverage of month/money parsing (including "marketing" no longer false-matching "march").
- `tsc --strict` clean on `chat-engine.ts` + `ask-answer.ts`.
- Browser click-through (headless Chrome) of the demo: duplicate "Last month" flagged with new wording; "we didnt do any marketing" → chip **Marketing: ₦0**; auto-finish snapshot; Ask page returns the `no_data` card for *"where are we in the business right now?"*, a computed answer with data, and an error card for an empty submit. Layout checked at 1280px and 375px — no overflow.

## 6. Assumptions (no app source was available in this sandbox)

- The app is React + shadcn/ui + Tailwind + lucide-react (from the `data-slot` markup you pasted). If not, `chat-engine.ts` and `ask-answer.ts` are framework-agnostic and port directly.
- Currency ₦, naira formatting `₦200,000`; slot order month → revenue → marketing as in your flow.
- "Save" posts `IntakeResult` to your existing endpoint — wire it in `onSave`.
