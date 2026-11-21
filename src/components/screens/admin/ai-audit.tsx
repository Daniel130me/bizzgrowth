"use client";
// Screen 113 — AI Diagnosis & Recommendation Audit (CRITICAL MVP admin screen).
// Lets platform operators inspect every AI output: its inputs, provenance, confidence,
// missing data and user feedback — and mark it reviewed or flag poor output.

import { useMemo, useState } from "react";
import { Flag, NotebookPen, Search, Sparkles, TriangleAlert } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { AdminBadge, ConfidenceBar, SearchInput } from "./parts";
import { InfoBanner, PageHeader, SectionCard } from "@/components/shared/layout";
import { EmptyState } from "@/components/shared/states";
import { ProvenanceBadge } from "@/components/shared/badges";
import { AI_AUDIT } from "@/lib/data/admin";
import { fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { useBizz } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { ScreenProps } from "../view-types";
import type { AiAuditItem, Provenance } from "@/lib/types";

type TabId = "all" | "pending" | "flagged";

// The audit dataset carries a full input trace for the two flagship workspaces;
// the remaining entries get a consistent synthesized trace so every row is auditable.
const DETAIL_OVERRIDES: Record<string, NonNullable<AiAuditItem["detail"]>> = {
  "audit-3": {
    inputs: [
      { label: "Repeat purchase share", value: "22% of September orders (Aug: 19%)", provenance: "measured" },
      { label: "Instagram CAC", value: "Rising — up ~32% vs August", provenance: "measured" },
      { label: "Cohort age", value: "Median 9 weeks since first order", provenance: "estimated" },
    ],
    interpretation:
      "Compared repeat-purchase share across months against channel CAC movement, and deliberately flagged rising Instagram CAC as a watch signal rather than a confirmed problem.",
    missingData: ["Discount and promotion usage", "Cohort-level revenue"],
    concerns: ["Only eight weeks of cohort data — the repeat-rate trend may be seasonal"],
    userFeedback: "Marked helpful by workspace owner on Sep 29.",
  },
  "audit-4": {
    inputs: [
      { label: "Weekend conversion", value: "1.9% vs 3.1% weekday", provenance: "measured" },
      { label: "Mobile share of traffic", value: "78% of sessions", provenance: "measured" },
      { label: "Hero image weight", value: "~1.8 MB per product page", provenance: "user-supplied" },
    ],
    interpretation:
      "Compared weekend and weekday conversion on mobile and matched the gap with heavy page weight reported during onboarding.",
    missingData: ["Device-level funnel steps", "Page speed from a connected source"],
    concerns: [
      "Sample covers four weekends only",
      "Owner reports images are already WebP and lazy-loaded — the image-weight input may be stale (see support case st-2)",
    ],
    userFeedback: "Marked unhelpful by workspace owner on Sep 29 — recommendation conflicts with their current setup.",
  },
  "audit-5": {
    inputs: [{ label: "Enquiry trend", value: "September totals only — no channel split", provenance: "user-supplied" }],
    interpretation:
      "Withheld a cause-level diagnosis: coverage is below the threshold, so the output states what is missing rather than speculating.",
    missingData: ["Channel-level enquiry totals", "Conversion stage data", "Any connected source"],
    concerns: ["Coverage 24% — any stronger diagnosis at this level would be speculation"],
  },
  "audit-6": {
    inputs: [
      { label: "Quotes issued", value: "31 quotes in September", provenance: "user-supplied" },
      { label: "Quote-to-close time", value: "Median 12 days (Aug: 6 days)", provenance: "user-supplied" },
      { label: "Enquiries", value: "58 recorded enquiries", provenance: "measured" },
    ],
    interpretation:
      "Compared quote volumes and close times across months. The doubling is real in the recorded data, but close times are manually recorded — treat with caution.",
    missingData: ["Quote stage timestamps", "Lost-reason tracking"],
    concerns: ["Close times are user-supplied and not measured from a system of record"],
  },
};

function detailFor(item: AiAuditItem) {
  return item.detail ?? DETAIL_OVERRIDES[item.id];
}

function truncate(text: string, max = 72) {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

interface NoteEntry {
  text: string;
  at: string;
}

export function AiAudit(_props: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);
  const [tab, setTab] = useState<TabId>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, AiAuditItem["status"]>>(() =>
    Object.fromEntries(AI_AUDIT.map((a) => [a.id, a.status]))
  );
  const [flagTarget, setFlagTarget] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [notes, setNotes] = useState<Record<string, NoteEntry[]>>({});

  const counts = useMemo(
    () => ({
      all: AI_AUDIT.length,
      pending: AI_AUDIT.filter((a) => statuses[a.id] === "pending").length,
      flagged: AI_AUDIT.filter((a) => statuses[a.id] === "flagged").length,
    }),
    [statuses]
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return AI_AUDIT.filter((a) => {
      if (tab === "pending" && statuses[a.id] !== "pending") return false;
      if (tab === "flagged" && statuses[a.id] !== "flagged") return false;
      if (!q) return true;
      return a.business.toLowerCase().includes(q) || a.diagnosis.toLowerCase().includes(q);
    });
  }, [tab, statuses, query]);

  const selected = AI_AUDIT.find((a) => a.id === selectedId) ?? null;
  const selectedStatus = selected ? statuses[selected.id] : null;
  const selectedDetail = selected ? detailFor(selected) : null;

  const markReviewed = (item: AiAuditItem) => {
    setStatuses((s) => ({ ...s, [item.id]: "reviewed" }));
    toast("Simulated: marked reviewed", { description: `"${truncate(item.diagnosis, 60)}" would leave the pending review queue.` });
  };

  const flagOutput = (item: AiAuditItem) => {
    setStatuses((s) => ({ ...s, [item.id]: "flagged" }));
    setFlagTarget(null);
    toast("Simulated: output flagged", { description: "The item would be queued for a human re-review and excluded from quality metrics until resolved." });
  };

  const addNote = (item: AiAuditItem) => {
    const text = noteDraft.trim();
    if (!text) {
      toast.error("Note is empty", { description: "Write the internal note before saving it." });
      return;
    }
    setNotes((n) => ({ ...n, [item.id]: [...(n[item.id] ?? []), { text, at: "Just now" }] }));
    setNoteDraft("");
    toast("Simulated: internal note added", { description: "Notes are visible to platform operators only — never to the workspace." });
  };

  return (
    <div>
      <PageHeader
        title="AI audit"
        description="Review AI diagnoses and recommendations across all workspaces — inputs, provenance, confidence and outcomes."
      />

      <InfoBanner tone="ai">
        This screen exists to validate AI quality during the MVP — every diagnosis shows its inputs, provenance and confidence. Nothing is hidden behind a score.
      </InfoBanner>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
          <TabsList className="h-auto w-full flex-wrap justify-start sm:w-fit">
            {(["all", "pending", "flagged"] as TabId[]).map((t) => (
              <TabsTrigger key={t} value={t} className="flex-none px-3 capitalize">
                {t}
                <span className="ml-1.5 rounded-full bg-slate-200/70 px-1.5 text-[11px] font-medium tnum text-slate-600">{counts[t]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <SearchInput value={query} onChange={setQuery} placeholder="Search business or diagnosis" label="Search AI audit" />
      </div>

      <p className="mt-3 text-xs text-muted-foreground" aria-live="polite">
        {rows.length} entr{rows.length === 1 ? "y" : "ies"} in this view
      </p>

      <SectionCard className="mt-3" contentClassName="p-0">
        {rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<Search className="size-5" />}
              title="Nothing in this view"
              description="No audit entries match this filter. Switch tabs or clear the search to see the rest of the audit trail."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Business</TableHead>
                  <TableHead>Diagnosis</TableHead>
                  <TableHead className="w-36">Confidence</TableHead>
                  <TableHead className="text-right">Evidence</TableHead>
                  <TableHead className="text-right">Coverage</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Feedback</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((item) => (
                  <TableRow
                    key={item.id}
                    tabIndex={0}
                    role="link"
                    aria-label={`Open audit detail for ${item.business}`}
                    onClick={() => setSelectedId(item.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedId(item.id);
                      }
                    }}
                    className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600"
                  >
                    <TableCell className="whitespace-nowrap font-medium">{item.business}</TableCell>
                    <TableCell className="max-w-72">
                      <span className="block truncate text-sm" title={item.diagnosis}>
                        {truncate(item.diagnosis)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <ConfidenceBar value={item.confidence} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{item.evidenceCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{item.coverage}%</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">{fmtDate(item.date)}</TableCell>
                    <TableCell>
                      <AdminBadge status={item.feedback} />
                    </TableCell>
                    <TableCell>
                      <AdminBadge status={statuses[item.id]} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      {/* Detail dialog */}
      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          {selected && selectedDetail ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2 pr-6">
                  <Sparkles className="size-4 text-brand-600" aria-hidden />
                  {selected.business}
                  <AdminBadge status={selectedStatus ?? "pending"} />
                  <AdminBadge status={selected.feedback} />
                </DialogTitle>
                <DialogDescription>
                  Generated {fmtDate(selected.date)} · {selected.confidence}% confidence · {selected.evidenceCount} evidence items · {selected.coverage}% data coverage
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5">
                <div className="rounded-lg border border-brand-200 bg-brand-50/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Diagnosis (AI interpretation)</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-brand-950">{selected.diagnosis}</p>
                </div>

                <div className="rounded-lg border p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recommendation</p>
                  <p className="mt-1.5 text-sm leading-relaxed">{selected.recommendation}</p>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Input metrics & facts</p>
                  <ul className="divide-y rounded-lg border">
                    {selectedDetail.inputs.map((input, i) => (
                      <li key={i} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{input.label}</p>
                          <p className="text-sm tabular-nums text-muted-foreground">{input.value}</p>
                        </div>
                        <ProvenanceBadge provenance={input.provenance as Provenance} />
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-lg border border-brand-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">AI interpretation — how it reasoned</p>
                  <p className="mt-1.5 text-sm leading-relaxed">{selectedDetail.interpretation}</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Missing data</p>
                    <ul className="mt-2 space-y-1.5">
                      {selectedDetail.missingData.map((m, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-slate-300" aria-hidden />
                          {m}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className={cn("rounded-lg border p-4", selectedDetail.concerns.length > 0 && "border-amber-200 bg-amber-50/50")}>
                    <p className={cn("flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide", selectedDetail.concerns.length > 0 ? "text-amber-700" : "text-muted-foreground")}>
                      {selectedDetail.concerns.length > 0 ? <TriangleAlert className="size-3.5" aria-hidden /> : null}
                      Potential concerns
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {selectedDetail.concerns.map((c, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", selectedDetail.concerns.length > 0 ? "bg-amber-500" : "bg-slate-300")} aria-hidden />
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {selectedDetail.userFeedback ? (
                  <div className="rounded-lg border p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">User feedback</p>
                    <p className="mt-1.5 text-sm">{selectedDetail.userFeedback}</p>
                  </div>
                ) : null}

                {selectedDetail.outcome ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Outcome</p>
                    <p className="mt-1.5 text-sm text-emerald-950">{selectedDetail.outcome}</p>
                  </div>
                ) : null}

                {/* Internal notes */}
                <div className="rounded-lg border p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Internal notes</p>
                  {(notes[selected.id]?.length ?? 0) === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">No operator notes yet for this entry.</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {(notes[selected.id] ?? []).map((n, i) => (
                        <li key={i} className="rounded-lg border bg-slate-50/60 p-2.5">
                          <p className="text-sm">{n.text}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{n.at} · platform operator</p>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <Textarea
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      placeholder="Add an internal note for the audit trail…"
                      aria-label="Internal note"
                      className="min-h-16"
                    />
                    <button
                      onClick={() => addNote(selected)}
                      className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 self-end rounded-lg border bg-white px-3 text-sm font-medium shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 sm:w-28"
                    >
                      <NotebookPen className="size-3.5" aria-hidden /> Add note
                    </button>
                  </div>
                </div>
              </div>

              {/* Admin actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <p className="text-xs text-muted-foreground">Actions update the audit trail for this entry only.</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => markReviewed(selected)}
                    disabled={selectedStatus === "reviewed"}
                    className={cn(
                      "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600",
                      selectedStatus === "reviewed"
                        ? "cursor-not-allowed border bg-slate-50 text-slate-400"
                        : "bg-brand-600 text-white hover:bg-brand-700"
                    )}
                  >
                    Mark reviewed
                  </button>
                  <button
                    onClick={() => setFlagTarget(selected.id)}
                    disabled={selectedStatus === "flagged"}
                    className={cn(
                      "inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600",
                      selectedStatus === "flagged"
                        ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400"
                        : "border-red-200 bg-red-50 text-red-800 hover:bg-red-100"
                    )}
                  >
                    <Flag className="size-3.5" aria-hidden /> Flag poor output
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Flag confirmation */}
      <AlertDialog open={flagTarget !== null} onOpenChange={(open) => !open && setFlagTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Flag this output as poor quality?</AlertDialogTitle>
            <AlertDialogDescription>
              The entry would be marked flagged, excluded from quality metrics and queued for human re-review. The workspace is not notified by default.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const item = AI_AUDIT.find((a) => a.id === flagTarget);
                if (item) flagOutput(item);
              }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Flag output
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <p className="mt-4 text-xs text-muted-foreground">
        Entries with user feedback or coverage below 40% deserve the closest look. Need the workspace view? Open{" "}
        <button onClick={() => navigate("admin/businesses")} className="font-medium text-brand-600 underline-offset-2 hover:underline">
          Businesses
        </button>
        .
      </p>
    </div>
  );
}
