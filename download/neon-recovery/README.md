# Neon recovery — "env lost, recorded data not showing"

Good news first: **losing your environment does not delete your Neon data.**
Neon stores the data in their cloud, separate from any sandbox or app
environment. Per Neon's pricing page: compute on Free "suspends after 5 min"
of idle time, "Neon doesn't pause Free projects for inactivity", and "none of
these limits delete your data". What you lost is the **connection string and
other env vars** — the data should still be sitting in your Neon project.

## What I found in this workspace

- `.env` contains only the default placeholder `DATABASE_URL=file:/home/z/my-project/db/custom.db`
  — that's a **SQLite** path, not Neon, and the `db/` folder doesn't exist here.
- No `.db` / `.sqlite` / `.sql` / data files anywhere in the workspace; git
  tracks only the chat-fix files from the previous session.
- The app runtime itself isn't accessible from here, so I can't see what your
  app deployed with — but there is **no local data in this workspace at all**,
  which matches "your data lives in Neon".

## Recovery steps

### Step 1 — Confirm the data still exists (do this first)

1. Log in at **console.neon.tech** with the account you signed up with
   (check other Google/GitHub logins too if the project isn't there).
2. Open your project → **Tables** (Table editor) or **SQL editor** and run:
   `SELECT * FROM <your months table> LIMIT 10;`
   If you see your recorded months — data is safe; it was only the env that was lost.
3. Don't see the project? Check you're in the right **Org** (top-left) and the
   right **branch** (apps often write to a dev branch, not `main`).

### Step 2 — Take an emergency backup (right now)

```bash
pip install psycopg2-binary
DATABASE_URL="postgresql://…" python3 check-neon.py
```

- Takes the URL from `$DATABASE_URL` (or pass it as an argument), retries for
  cold starts, lists every table with row counts, and exports **every table to
  CSV** in a `neon-backup-<timestamp>/` folder.
- Your password is never printed (the URL is shown masked).
- Run with `--no-export` for a quick connect-only check.
- For a full schema+data dump later: `pg_dump "<unpooled URL>" > backup.sql`
  (unpooled = hostname **without** `-pooler`).

### Step 3 — Re-point your app at Neon

1. In the Neon Console press **Connect** → the **"Connect to your branch"**
   modal builds the connection string for you (pooled, `-pooler` host, by
   default). That string **is** your `DATABASE_URL` — copy it as-is.
2. Put it back where your app reads env from:
   - if the app runs from this workspace: replace the placeholder line in
     `/home/z/my-project/.env`;
   - if your platform stores env per app: paste it into that app's
     environment settings instead.
3. Restore your other env vars too (`SESSION_SECRET`, Google Ads keys, …) —
   see `.env.example` in this folder for the checklist.
4. Restart / redeploy the app.

### Step 4 — Verify in the app

- The workspace banner ("none recorded yet") should switch back to your
  recorded months.
- Ask page: "where are we in the business right now?" should return a real
  answer from the recorded month.

## If the Neon project is really gone

Only then is data actually lost — Neon's point-in-time restore on Free covers
**the last 6 hours** (1 GB), so it can only help for a very recent accident.
For a fresh start: create a new project, copy its `DATABASE_URL` into the app,
and re-import the CSVs from Step 2 via `psql \copy` or the Neon console's
import if you made a backup while the old project was still reachable.

## Security notes

- **Never paste a connection string into a chat** (including this one) — it
  contains the password. Put it directly into your env settings.
- If a connection string ever leaked anywhere: Neon Console → **Roles →
  Reset password**, then copy a fresh string from Connect.

## What I could not do from here

The sandbox has no app source, no Neon credentials, and no local data files,
so I could not inspect your app or read your database directly. The toolkit
here verifies and backs up your Neon data as soon as **you** supply the
connection string on your side. `check-neon.py`'s failure diagnostics and
masking were tested; the export path uses standard `COPY … TO STDOUT` and
needs your real URL to run.
