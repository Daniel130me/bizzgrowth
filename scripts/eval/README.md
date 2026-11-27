# Nellovia AI quality test runner

The runner for `docs/ai-quality-test-plan.md`. **Run it only when the owner says to.** Each run
calls paid AI providers and creates test data in the shared database.

## How a run works

- **The owner is played by Claude, one turn at a time.** Claude reads each reply, answers in
  character, taps a suggested answer when one fits and fills every form the owner would fill. The
  runner never answers for the owner. Claude follows the plan's rules: answer only what is asked,
  reveal hidden facts only when a question uncovers them, and never volunteer the answer key.
- **Every feature goes through its real route** on a local dev server, as a signed-in test owner.
  Request bodies are built from the app's own state, the way each screen builds them: the real
  store (`src/lib/store.ts`) runs headless in bun, so challenges, the plan order, coach steps and
  check-in schedules behave exactly as in the browser. Text that only exists inside screen
  components is copied in `lib/owner-ui.ts`, and every run checks that the copies still match.
- **Every call is recorded** in `calls.jsonl`: the request, the response, the time taken, and,
  from the gateway trace, which provider and model answered, every failed attempt, and the tokens
  used.
- **Live AI settings are never changed.** `setup` saves a read-only snapshot of the admin order,
  switches, models and key labels to `provider-settings.json`.
- **Nothing goes out.** Drafts stay drafts. Posting a marketplace task is stubbed out (it would
  publish to the shared marketplace); only the match runs.

## Start the dev server for a run

The server needs three test-only settings, each off unless set:

- `AI_GATEWAY_USAGE_FILE` keeps test traffic out of `.ai-gateway/usage.json`.
- `AI_GATEWAY_TRACE_FILE` writes one JSON line per AI completion (labels only, never keys).
- `AI_GATEWAY_FAULTS_FILE` lets the fallback check make one provider fail on purpose while that
  file exists.

```
bun scripts/eval/run.ts t01 server-cmd --run before   # prints the exact command
```

Run that command from `bizzgrowth/`. The runner expects the server at `http://localhost:3017`;
change it with `--base`. Restart the server between runs so each run gets its own trace and usage
files.

## Commands

`bun scripts/eval/run.ts <case> <command> [args] [--run before|after] [--date YYYY-MM-DD]`

| Command | What the owner does |
|---|---|
| `setup` | Creates or signs in to the test account (`EVAL <case>` prefix; credentials in the gitignored `scripts/eval/local-<case>-credentials.json`), creates the workspace, and snapshots the live AI settings |
| `checkup` | Opens the checkup (shows the opener and tap answers) |
| `say <text>` / `tap <n>[,<n>]` | Types or taps an answer in the checkup. The extraction runs when the checkup ends, as on the screen |
| `diagnosis` | Opens the diagnosis page, which writes the first diagnosis |
| `improve-form` / `improve '[[asked,paid],…]'` | Shows the "Improve my diagnosis" rows, then submits the counts row by row |
| `accept-step [n\|none]` | Starts the diagnosis's next step. For an experiment it shows the starting-number question; pass the choice number, or `none` to start without measuring |
| `ask <question>` | Asks Nellovia (history and context as the Ask screen sends them) |
| `draft [ask\|step]` / `copy-draft` | Taps the draft button on the latest Ask answer or the next step (`--tweak shorter` etc. rewrites it), then copies it |
| `brief [weekly\|monthly]` / `insights` | Generates a brief or the insights |
| `time-travel <days>` | Test set-up: moves the step being tried that many days into the past, as if the time had passed. It is recorded in `test-setup-notes.md` |
| `checkin` / `checkin-say <text>` / `checkin-tap <n>` | The coach check-in, question by question |
| `challenge-new` / `challenge-say <text>` / `challenge-tap <n>` | Reports a challenge in the challenges chat. The challenge's own diagnosis runs when the chat ends |
| `match` | Fills the marketplace task form from the case file and runs specialist matching |
| `plain` | Plain-AI comparison on the model that answered the diagnosis: system prompt "You are a helpful business advisor", the case's single message, then the follow-up questions |
| `fallback [http500\|timeout]` | Makes the first provider in the live order fail, replays a fast call and a quality call, then removes the faults file |
| `grounding` | Checks that `src/lib/grounding.ts` catches invented figures in several formats, then audits every figure in the run's answers |
| `render` | Writes `transcripts/`, `timings.md` and `timings.json` from `calls.jsonl` |
| `show diagnosis\|facts\|challenges\|improved\|step\|notes` | Prints the app's current state |

## Files

- `cases/<id>.card.md`, `cases/<id>.key.md`: the case card and the answer key, written before any
  run. `cases/<id>.json` holds the parts the runner uses: workspace, opening line, follow-up
  questions, the plain-AI message, the marketplace task and the owner's figures.
- Sealed cases go in a separate folder that fixing work doesn't open (none yet).
- Results go to `eval-results/<date>/<case>/<run>/`: `calls.jsonl`, `gateway-trace.jsonl`
  (prompts and replies), `gateway-usage.json`, `provider-settings.json`, `transcripts/`,
  `timings.md`, `grounding-check.json` and `state/` (the headless app state, so a run can be
  resumed or inspected).
