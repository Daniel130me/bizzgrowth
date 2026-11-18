#!/usr/bin/env python3
"""
check-neon.py — verify your Neon (Postgres) database and take an emergency backup.

What it does:
  1. Connects to the DATABASE_URL (env var, or passed as an argument).
  2. Prints the server version + Neon endpoint id (proves you reached Neon).
  3. Lists every user table with exact row counts.
  4. Exports each table to CSV in a timestamped backup folder (--no-export skips).

Your credentials are never printed — the URL is shown with the password masked.

Usage:
    DATABASE_URL="postgresql://..." python3 check-neon.py            # check + backup
    python3 check-neon.py --no-export                                # quick check only
    python3 check-neon.py --out /path/to/backup                      # custom backup dir

Requires:  pip install psycopg2-binary
"""

import argparse
import csv
import os
import sys
import time
import urllib.parse as up
from datetime import datetime

try:
    import psycopg2
    from psycopg2.extensions import quote_ident
except ImportError:
    sys.exit("psycopg2 is missing — run:  pip install psycopg2-binary")


def masked(url: str) -> str:
    """Return the URL with the password replaced by '***'."""
    p = up.urlsplit(url)
    if p.password is None:
        return url
    netloc = p.hostname or ""
    if p.port:
        netloc += f":{p.port}"
    if p.username:
        netloc = f"{p.username}:***@{netloc}"
    return up.urlunsplit((p.scheme, netloc, p.path, p.query, p.fragment))


def connect(url: str):
    """Connect, retrying twice — Neon compute suspends when idle and the first
    connection may need a few extra seconds (cold start)."""
    if "sslmode=" not in url:
        url = url + ("&" if "?" in url else "?") + "sslmode=require"
    last = None
    for attempt in range(3):
        try:
            return psycopg2.connect(url, connect_timeout=20)
        except psycopg2.OperationalError as e:
            last = e
            if attempt < 2:
                print(f"  connection attempt {attempt + 1} failed ({str(e).strip()[:90]}…) — retrying in 5s (cold start?)")
                time.sleep(5)
    raise last


def main() -> int:
    ap = argparse.ArgumentParser(description="Verify Neon DB and export all tables to CSV.")
    ap.add_argument("url", nargs="?", default=os.environ.get("DATABASE_URL"),
                    help="Postgres URL (defaults to $DATABASE_URL)")
    ap.add_argument("--out", default=None, help="backup directory (default: ./neon-backup-<timestamp>)")
    ap.add_argument("--no-export", action="store_true", help="only check, do not export CSVs")
    args = ap.parse_args()

    if not args.url:
        sys.exit("No DATABASE_URL — set the env var or pass the URL as an argument.")
    if not args.url.lower().startswith(("postgres://", "postgresql://")):
        sys.exit("That doesn't look like a Postgres URL. Neon URLs start with postgresql://… "
                 "(the placeholder in .env — file:/…/custom.db — is SQLite, not Neon).")

    print(f"Connecting to {masked(args.url)}")

    try:
        conn = connect(args.url)
    except psycopg2.OperationalError as e:
        msg = str(e).strip()
        print(f"\nFAILED to connect: {msg}")
        low = msg.lower()
        if "password authentication failed" in low:
            print("  → Wrong user/password. In Neon Console: Project → Roles → reset the role password,")
            print("    then copy a fresh string from the Connect button.")
        elif "getaddrinfo" in low or "name or service" in low or "nodename" in low:
            print("  → Host not found — check the host part (ep-xxxx...neon.tech) and that the")
            print("    project/branch still exists in the Neon Console.")
        elif "timeout" in low or "timed out" in low:
            print("  → Network/compute issue. In the Neon Console check the compute is not disabled;")
            print("    first connection after idle can take a few seconds — just re-run.")
        elif "ssl" in low:
            print("  → SSL required: keep sslmode=require in the URL (added automatically).")
        return 1

    with conn.cursor() as cur:
        cur.execute("SELECT version();")
        print(f"Connected ✓  {cur.fetchone()[0].split(',')[0]}")
        try:
            cur.execute("SHOW neon.endpoint_id;")
            print(f"Neon endpoint: {cur.fetchone()[0]}")
        except Exception:
            print("Note: connected to Postgres but not a Neon endpoint (neon.endpoint_id unavailable).")

        cur.execute(
            """
            SELECT table_schema, table_name
            FROM information_schema.tables
            WHERE table_type = 'BASE TABLE'
              AND table_schema NOT IN ('pg_catalog', 'information_schema')
            ORDER BY table_schema, table_name
            """
        )
        tables = cur.fetchall()

    if not tables:
        print("\nConnected fine, but there are NO user tables — the database is empty.")
        print("If you expected recorded months here, this may be a NEW/different project,")
        print("or a different branch. Check the project and branch in the Neon Console.")
    else:
        print(f"\n{len(tables)} table(s) found:")
        for schema, name in tables:
            with conn.cursor() as cur:
                cur.execute(f"SELECT COUNT(*) FROM {quote_ident(schema, conn)}.{quote_ident(name, conn)}")
                n = cur.fetchone()[0]
            print(f"  • {schema}.{name} — {n} row(s)")

    if args.no_export:
        print("\nCheck complete (--no-export).")
        return 0

    outdir = args.out or f"neon-backup-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
    os.makedirs(outdir, exist_ok=True)
    print(f"\nExporting CSVs to {outdir}/ …")
    ok = 0
    for schema, name in tables:
        fq = f"{quote_ident(schema, conn)}.{quote_ident(name, conn)}"
        fname = os.path.join(outdir, f"{schema}.{name}.csv")
        try:
            with open(fname, "w", newline="", encoding="utf-8") as fh:
                with conn.cursor() as cur:
                    cur.copy_expert(
                        f"COPY (SELECT * FROM {fq}) TO STDOUT WITH (FORMAT csv, HEADER true)", fh
                    )
            with open(fname, "r", encoding="utf-8") as fh:
                lines = sum(1 for _ in fh) - 1
            print(f"  ✓ {fq} → {fname} ({lines} rows)")
            ok += 1
        except Exception as e:  # noqa: BLE001 — report per-table, keep going
            print(f"  ✗ {fq}: {str(e).strip()[:120]}")
            if os.path.exists(fname):
                os.remove(fname)

    conn.close()
    print(f"\nDone — {ok}/{len(tables)} tables exported.")
    if ok:
        print("These CSVs are your emergency backup. For a full schema+data backup run pg_dump")
        print("with the UNPOOLED connection string (hostname without '-pooler').")
    return 0


if __name__ == "__main__":
    sys.exit(main())
