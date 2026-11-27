"use client";
// Ready-to-use words. Two shapes:
//  • DraftButton — the default: a button named after what it makes ("Write the
//    follow-up message"). The words are written only when the owner taps it,
//    then shown in an editable panel with Copy / Open in WhatsApp / Open in
//    email and quick tweaks. The app never sends anything itself.
//  • TryThisBox — older answers that already carry pre-written words.

import { useState } from "react";
import {
  BookOpen,
  ClipboardCheck,
  ClipboardList,
  Copy,
  FilePen,
  FileText,
  Globe,
  Handshake,
  HelpCircle,
  Lightbulb,
  ListChecks,
  Loader2,
  Mail,
  Mails,
  Megaphone,
  MessageCircle,
  MessageSquareText,
  MessagesSquare,
  Newspaper,
  PenLine,
  Reply,
  ScrollText,
  Smartphone,
  StickyNote,
  Store,
  Tags,
  Target,
  Trophy,
  Undo2,
  UserPlus,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useBizz } from "@/lib/store";
import { DRAFT_META, fixDraftHint, type DraftHint, type DraftKind, type DraftTweak } from "@/lib/coach";
import { ownerWordsFrom } from "@/lib/ai-context";
import { guessCategory } from "@/components/screens/market/parts";
import { cn } from "@/lib/utils";

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export const DRAFT_ICON: Record<DraftKind, React.ElementType> = {
  whatsapp: MessageCircle,
  sms: Smartphone,
  email: Mail,
  newsletter: Mails,
  reply: Reply,
  note: StickyNote,
  "call-script": MessagesSquare,
  post: Megaphone,
  ad: Target,
  video: Video,
  article: BookOpen,
  "case-study": Trophy,
  website: Globe,
  description: FileText,
  profile: Store,
  faq: HelpCircle,
  flyer: Newspaper,
  "price-list": Tags,
  proposal: FilePen,
  agreement: Handshake,
  brief: ClipboardList,
  "job-post": UserPlus,
  policy: ScrollText,
  checklist: ListChecks,
  survey: MessageSquareText,
  ideas: Lightbulb,
  other: PenLine,
};

const TWEAKS: { id: DraftTweak; label: string }[] = [
  { id: "shorter", label: "Shorter" },
  { id: "friendlier", label: "Friendlier" },
  { id: "formal", label: "More formal" },
];

interface DraftText {
  title?: string;
  subject?: string;
  body: string;
}

/** Calls the draft writer with the owner's latest checkup answers. */
function useDraftWriter() {
  const facts = useBizz((s) => s.checkup.facts);
  const transcript = useBizz((s) => s.checkup.transcript);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const businessName = useBizz((s) => s.settings.businessName);
  return async (hint: DraftHint, tweak?: DraftTweak, current?: string): Promise<DraftText | null> => {
    try {
      const res = await fetch("/api/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: hint.kind,
          purpose: hint.purpose,
          label: hint.label,
          workspaceName: userWorkspace?.name ?? businessName,
          currency: userWorkspace?.currency,
          location: userWorkspace?.country,
          website: userWorkspace?.website,
          facts: facts ? { ...facts, facts: [], chips: [] } : null,
          // What they said in the checkup (an amount they can pay, a date), for words that need it.
          ownerWords: ownerWordsFrom(transcript),
          tweak,
          current,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; draft?: DraftText };
      return data.ok && data.draft ? data.draft : null;
    } catch {
      return null;
    }
  };
}

/**
 * The editable draft: copy it, open it in WhatsApp or email, or tweak it.
 * Every copy/open is noted on the step being tried, so the next check-in can
 * ask how it went.
 */
export function DraftPanel({
  hint,
  initial,
  onClose,
  main,
}: {
  hint: DraftHint;
  initial: DraftText;
  onClose?: () => void;
  main?: boolean;
}) {
  // A saved answer may have filed website words or a brief as an email — follow the label.
  const fixed = fixDraftHint(hint);
  const meta = DRAFT_META[fixed.kind];
  const Icon = DRAFT_ICON[fixed.kind] ?? PenLine;
  const logDraftUse = useBizz((s) => s.logDraftUse);
  const setTaskPrefill = useBizz((s) => s.setTaskPrefill);
  const navigate = useBizz((s) => s.navigate);
  const write = useDraftWriter();
  const [body, setBody] = useState(initial.body);
  const [subject, setSubject] = useState(initial.subject ?? "");
  const [history, setHistory] = useState<string[]>([]);
  const [busy, setBusy] = useState<DraftTweak | null>(null);
  const [copied, setCopied] = useState(false);

  async function tweak(t: DraftTweak) {
    setBusy(t);
    const next = await write(fixed, t, body);
    setBusy(null);
    if (!next) {
      toast.error("Couldn't rewrite it just now", { description: "Your words are still here — try again in a moment." });
      return;
    }
    setHistory((h) => [...h, body]);
    setBody(next.body);
    if (next.subject) setSubject(next.subject);
  }

  async function copy() {
    const text = meta.subject && subject ? `${subject}\n\n${body}` : body;
    if (await copyText(text)) {
      setCopied(true);
      logDraftUse(fixed.label, "copied");
      window.setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Couldn't copy", { description: "Select the text and copy it instead." });
    }
  }

  /** A brief goes to the specialists marketplace as a ready-to-bid task — the owner reviews it before posting. */
  function postAsTask() {
    setTaskPrefill({
      title: (initial.title || fixed.label.replace(/^(write|draft)\s+(the\s+|my\s+)?/i, "")).slice(0, 80),
      description: body,
      category: guessCategory(`${fixed.label} ${fixed.purpose} ${body}`),
      skills: [],
      source: "manual",
      sourceTitle: fixed.label,
    });
    navigate("market/post");
  }

  const rows = Math.min(meta.long ? 20 : 12, Math.max(4, Math.ceil(body.length / 60) + body.split("\n").length));
  const mailSubject = meta.subject ? subject : (initial.title ?? "");

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 animate-in fade-in-0 slide-in-from-top-1">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
            <Icon className="size-3.5" aria-hidden />
            {meta.noun} — ready to use
          </p>
          {initial.title ? <p className="mt-0.5 text-sm font-semibold text-slate-900">{initial.title}</p> : null}
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="-mr-1 -mt-1 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-white hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Hide the draft"
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>

      {meta.subject ? (
        <label className="mt-3 block">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Subject</span>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
          />
        </label>
      ) : null}
      <label className="mt-3 block">
        <span className="sr-only">The words — edit anything before you use them</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={rows}
          className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm leading-relaxed text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
        />
      </label>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={copy} className={cn("bg-emerald-600 hover:bg-emerald-700", main && "shadow-sm")}>
          {copied ? <ClipboardCheck className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </Button>
        {meta.whatsapp ? (
          <Button size="sm" variant="outline" className="bg-white" asChild>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(body)}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => logDraftUse(fixed.label, "whatsapp")}
            >
              <MessageCircle className="size-4 text-emerald-600" aria-hidden />
              Open in WhatsApp
            </a>
          </Button>
        ) : null}
        {meta.sms ? (
          <Button size="sm" variant="outline" className="bg-white" asChild>
            <a href={`sms:?&body=${encodeURIComponent(body)}`} onClick={() => logDraftUse(fixed.label, "copied")}>
              <Smartphone className="size-4 text-slate-600" aria-hidden />
              Open in Messages
            </a>
          </Button>
        ) : null}
        {meta.email ? (
          <Button size="sm" variant="outline" className="bg-white" asChild>
            <a
              href={`mailto:?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(body)}`}
              onClick={() => logDraftUse(fixed.label, "email")}
            >
              <Mail className="size-4 text-brand-600" aria-hidden />
              Open in email
            </a>
          </Button>
        ) : null}
        {meta.task ? (
          <Button size="sm" variant="outline" className="bg-white" onClick={postAsTask}>
            <UserPlus className="size-4 text-brand-600" aria-hidden />
            Post it as a task
          </Button>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs text-slate-500">Make it:</span>
        {TWEAKS.map((t) => (
          <button
            key={t.id}
            type="button"
            disabled={busy !== null}
            onClick={() => tweak(t.id)}
            className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-emerald-800 transition-colors hover:border-emerald-400 hover:bg-emerald-50 disabled:opacity-60"
          >
            {busy === t.id ? <Loader2 className="size-3 animate-spin" aria-hidden /> : null}
            {t.label}
          </button>
        ))}
        {history.length > 0 ? (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => {
              setBody(history[history.length - 1]);
              setHistory((h) => h.slice(0, -1));
            }}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-white hover:text-slate-800 disabled:opacity-60"
          >
            <Undo2 className="size-3" aria-hidden />
            Undo
          </button>
        ) : null}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        {meta.group === "Messages" ? "Nothing is sent for you — you choose who gets it." : "Nothing is posted or sent for you — use it where you need it."}
        {/\[[^\]]+\]/.test(body) ? " Fill in anything in [brackets] first." : ""}
        {fixed.kind === "sms" || fixed.kind === "profile" ? <span className="tnum"> · {body.length} characters</span> : null}
      </p>
      {meta.note ? <p className="mt-1 text-xs text-amber-700">{meta.note}</p> : null}
    </div>
  );
}

/**
 * A button named after what it makes. Tapping it writes the words (or reveals
 * words already written) in an editable panel.
 */
export function DraftButton({
  hint,
  main,
  initial,
  size = "sm",
  className,
}: {
  hint: DraftHint;
  /** The card's main action — when sending the message IS the step. */
  main?: boolean;
  /** Words already written (e.g. the diagnosis help) — shown instantly, no wait. */
  initial?: DraftText;
  size?: "sm" | "default";
  className?: string;
}) {
  const write = useDraftWriter();
  const [draft, setDraft] = useState<DraftText | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  // The kind that matches the label the owner sees (old answers filed some things as emails).
  const fixed = fixDraftHint(hint);
  const Icon = DRAFT_ICON[fixed.kind] ?? PenLine;

  async function show() {
    if (draft) {
      setOpen(true);
      return;
    }
    if (initial) {
      setDraft(initial);
      setOpen(true);
      return;
    }
    setLoading(true);
    const d = await write(fixed);
    setLoading(false);
    if (!d) {
      toast.error("Couldn't write it just now", { description: "Please try again in a moment." });
      return;
    }
    setDraft(d);
    setOpen(true);
  }

  if (open && draft) {
    return (
      <div className={cn("w-full", className)}>
        <DraftPanel hint={fixed} initial={draft} main={main} onClose={() => setOpen(false)} />
      </div>
    );
  }

  return (
    <Button
      type="button"
      size={size}
      onClick={show}
      disabled={loading}
      variant={main ? "default" : "outline"}
      className={cn(main ? "bg-emerald-600 text-white hover:bg-emerald-700" : "border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50", className)}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Icon className="size-4" aria-hidden />}
      {loading ? "Writing it for you…" : hint.label}
    </Button>
  );
}

export function TryThisBox({ title, body, label = "Try this", whatsapp = true }: { title: string; body: string; label?: string; whatsapp?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    if (await copyText(body)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Couldn't copy", { description: "Select the text and copy it instead." });
    }
  }
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{title}</p>
      <blockquote className="mt-2 whitespace-pre-line rounded-lg border-l-4 border-emerald-300 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-slate-800">
        {body}
      </blockquote>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="bg-white" onClick={copy}>
          {copied ? <ClipboardCheck className="mr-1.5 size-4" aria-hidden /> : <Copy className="mr-1.5 size-4" aria-hidden />}
          {copied ? "Copied" : "Copy"}
        </Button>
        {whatsapp ? (
          <Button size="sm" variant="outline" className="bg-white" asChild>
            <a href={`https://wa.me/?text=${encodeURIComponent(body)}`} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="mr-1.5 size-4 text-emerald-600" aria-hidden />
              Open in WhatsApp
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
