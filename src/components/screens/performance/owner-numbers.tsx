"use client";
// "Your numbers" — every figure the owner has given Nellovia (checkup, check-ins,
// challenge chats, their own edits), in their own words, with where each came from
// and what it was before. Nothing here is estimated or filled in.

import React, { useState } from "react";
import { Check, ChevronDown, CircleCheck, History, Pencil, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useBizz } from "@/lib/store";
import { fmtDateShort } from "@/lib/format";
import { editableNumber, isMoneyNumber, numberRows, sourceLabel, type NumberGroup, type NumberRow } from "@/lib/number-log";
import { amountInFull, currencySymbol, foreignCurrency, parseAmount } from "@/lib/checkup-math";

const GROUPS: { id: NumberGroup; title: string }[] = [
  { id: "owed", title: "What you owe" },
  { id: "money", title: "Money in and out" },
  { id: "customers", title: "Customers" },
];

const LINK =
  "inline-flex min-h-6 items-center gap-1 rounded text-xs font-medium text-brand-700 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function when(at?: string): string {
  return at ? ` · ${fmtDateShort(at)}` : "";
}

function Row({ row }: { row: NumberRow }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const facts = useBizz((s) => s.checkup.facts);
  const correctNumber = useBizz((s) => s.correctNumber);
  const cur = currencySymbol(useBizz((s) => s.userWorkspace?.currency));
  const editable = editableNumber(facts, row.key);
  const money = isMoneyNumber(row.key);
  // Money is shown written out in full, so the owner sees exactly what was understood.
  const show = (v: string) => (money ? amountInFull(v, cur) : v);
  const readable = money ? parseAmount(draft) !== null : true;
  // Amounts stay in the business's own currency — never converted, so another one is refused.
  const foreign = money && draft.trim() ? foreignCurrency(draft, cur) : null;
  const preview = money && draft.trim() && readable && !foreign ? amountInFull(draft, cur) : null;
  const [confirmRemove, setConfirmRemove] = useState(false);
  const removeOwnerNumber = useBizz((s) => s.removeOwnerNumber);
  const before = row.history[0];
  const paid = row.status === "paid";
  const owed = row.group === "owed";

  function startEdit() {
    setDraft(editable?.value ?? "");
    setEditing(true);
  }
  /** "change": the figure really changed (the old one stays in its history). "mistake": it was wrong. */
  function save(kind: "change" | "mistake") {
    if (!draft.trim()) {
      toast.error("Type a figure first — or press Cancel to keep it.");
      return;
    }
    if (foreign) {
      toast.error(`Your business uses ${cur} — write this in ${cur}. Nellovia never converts between currencies.`);
      return;
    }
    if (!readable) {
      toast.error(`I couldn't read an amount there — write it in full, like ${cur}300,000.`);
      return;
    }
    // Saved written out in full: what they confirmed in the preview is what is kept.
    const changed = correctNumber(row.key, { value: preview ?? draft }, kind);
    setEditing(false);
    if (changed) {
      toast.success(
        kind === "mistake"
          ? `${row.label} corrected — the wrong figure is gone, and it isn't counted as a change in your business.`
          : `${row.label} updated — what it was is kept in its history.`,
      );
    }
  }
  function remove() {
    setConfirmRemove(false);
    const undo = removeOwnerNumber(row.key);
    // Long enough to read and change their mind: a removed number can't be added back by hand.
    if (undo) toast.success(`${row.label} removed — anything worked out from it has been worked out again.`, { action: { label: "Undo", onClick: undo }, duration: 10_000 });
  }
  function setPaid(p: boolean) {
    if (correctNumber(row.key, { paid: p })) toast.success(p ? `${row.label} marked as paid.` : `${row.label} is back on what you owe.`);
  }

  if (editing) {
    return (
      <li className="py-3">
        <label htmlFor={`num-${row.key}`} className="text-sm font-medium text-slate-900">
          {row.label}
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Input
              id={`num-${row.key}`}
              value={draft}
              autoFocus
              maxLength={80}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setEditing(false);
              }}
              className="h-9 w-full sm:w-56"
            />
            {editable?.suffix ? <span className="shrink-0 text-sm text-muted-foreground">{editable.suffix}</span> : null}
          </div>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground" aria-live="polite">
          {!money
            ? "Write it the way you would say it — for example a range is fine."
            : !draft.trim()
              ? `Write the amount — for example ${cur}300,000, or a range like ${cur}50,000 to ${cur}70,000.`
              : foreign
                ? <span className="text-amber-700">Your business uses {cur}, and this looks like {foreign}. Write it in {cur} — Nellovia never converts between currencies.</span>
                : preview
                  ? <>I&apos;ll save this as <span className="font-semibold text-slate-900">{preview}</span>{editable?.suffix ? ` ${editable.suffix}` : ""} — check it&apos;s right.</>
                  : <span className="text-amber-700">I can&apos;t read an amount there yet — write it in full, like {cur}300,000.</span>}
        </p>
        {/* A typo fixed is not a change in the business: the owner says which it is. */}
        <p className="mt-3 text-xs font-medium text-slate-700">What happened?</p>
        <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button size="sm" onClick={() => save("change")}>
            <Check className="size-3.5" aria-hidden />
            It changed
          </Button>
          <Button size="sm" variant="outline" onClick={() => save("mistake")}>
            <Pencil className="size-3.5" aria-hidden />
            Fix a mistake
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          &ldquo;It changed&rdquo; keeps what it was in its history. &ldquo;Fix a mistake&rdquo; replaces a wrong figure, and it isn&apos;t counted as your business doing better or worse.
        </p>
      </li>
    );
  }

  return (
    <li className="py-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className={`text-sm font-medium text-slate-900 ${paid ? "text-slate-500" : ""}`}>{row.label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {paid && row.source === "you" ? "You marked it paid" : row.corrected ? "You corrected it" : sourceLabel(row.source, row.history.length > 0)}
            {when(row.at)}
          </p>
        </div>
        <div className="sm:text-right">
          {paid ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-sm font-semibold text-emerald-700">
              <CircleCheck className="size-4" aria-hidden />
              Paid
            </span>
          ) : (
            <p className="text-base font-semibold text-slate-900 tnum">{show(row.value)}</p>
          )}
          {before ? (
            <p className="mt-0.5 text-xs text-slate-500">
              Was {show(before.value)}
              {when(before.at)}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
        {editable ? (
          <button type="button" onClick={startEdit} className={LINK} aria-label={`Correct ${row.label}`}>
            <Pencil className="size-3.5" aria-hidden />
            Edit
          </button>
        ) : null}
        {owed && !paid ? (
          <button type="button" onClick={() => setPaid(true)} className={LINK}>
            <CircleCheck className="size-3.5" aria-hidden />
            Mark as paid
          </button>
        ) : null}
        {owed && paid ? (
          <button type="button" onClick={() => setPaid(false)} className={LINK}>
            <Undo2 className="size-3.5" aria-hidden />
            Not paid yet
          </button>
        ) : null}
        {!confirmRemove ? (
          <button type="button" onClick={() => setConfirmRemove(true)} className={`${LINK} text-slate-500 hover:text-red-700`} aria-label={`Remove ${row.label}`}>
            <Trash2 className="size-3.5" aria-hidden />
            Remove
          </button>
        ) : null}
      </div>
      {confirmRemove ? (
        <div role="alertdialog" aria-label={`Remove ${row.label}?`} className="mt-2 rounded-lg border border-red-200 bg-red-50/60 p-3">
          <p className="text-sm text-slate-800">
            Remove <span className="font-medium">{row.label}</span> from your numbers? Anything worked out from it will be worked out again without it. You can undo this straight after.
          </p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="destructive" onClick={remove}>
              Remove
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmRemove(false)} autoFocus>
              Keep it
            </Button>
          </div>
        </div>
      ) : null}
      {row.history.length > 1 ? (
        <div className="mt-1.5">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className={LINK}
          >
            <History className="size-3.5" aria-hidden />
            {open ? "Hide history" : `See all ${row.history.length + 1} values`}
            <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
          </button>
          {open ? (
            <ol className="mt-2 space-y-1 border-l-2 border-slate-200 pl-3 text-xs text-slate-600">
              <li>
                <span className="font-medium text-slate-900">{show(row.value)}</span> — now{when(row.at)}
              </li>
              {row.history.map((h, i) => (
                <li key={`${h.value}-${h.at ?? i}`}>
                  {show(h.value)} — {sourceLabel(h.source, false).toLowerCase()}
                  {when(h.at)}
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/** The owner's own numbers, or nothing at all when they haven't given any. */
export function OwnerNumbers({ className = "" }: { className?: string }) {
  const facts = useBizz((s) => s.checkup.facts);
  const log = useBizz((s) => s.checkup.numberLog);
  const rows = numberRows(facts, log);
  if (!rows.length) return null;
  const changed = rows.filter((r) => r.history.length > 0).length;

  return (
    <Card className={`p-5 sm:p-6 ${className}`}>
      <div>
        <div>
          <h2 className="text-lg font-semibold">Your numbers</h2>
          <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Everything you&apos;ve told Nellovia, in your own words.{" "}
            {changed
              ? `${changed === 1 ? "One has" : `${changed} have`} changed since you first gave ${changed === 1 ? "it" : "them"} — you can see what each was before.`
              : "When one changes in a check-in, you'll see what it was before."}{" "}
            If one is wrong, press Edit — anything worked out from it updates straight away.
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-5">
        {GROUPS.map((g) => {
          const mine = rows.filter((r) => r.group === g.id);
          if (!mine.length) return null;
          return (
            <section key={g.id} aria-label={g.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.title}</h3>
              <ul className="divide-y divide-slate-100">
                {mine.map((r) => (
                  <Row key={r.key} row={r} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </Card>
  );
}

/** Whether the owner has given any numbers (for headlines that must not say "nothing"). */
export function useHasOwnerNumbers(): boolean {
  const facts = useBizz((s) => s.checkup.facts);
  const log = useBizz((s) => s.checkup.numberLog);
  return numberRows(facts, log).length > 0;
}
