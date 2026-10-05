"use client";
// Screen 114 — Support / Feedback Inbox: every submitted case with workspace context and internal notes.

import { useMemo, useState } from "react";
import { LifeBuoy, Search } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { AdminBadge, PriorityBadge, SearchInput } from "./parts";
import { InfoBanner, PageHeader, SectionCard } from "@/components/shared/layout";
import { EmptyState } from "@/components/shared/states";
import { SUPPORT_TICKETS } from "@/lib/data/admin";
import { useBizz } from "@/lib/store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { ScreenProps } from "../view-types";
import type { SupportTicket } from "@/lib/types";

type TabId = "all" | "open" | "in-progress" | "resolved";

const TABS: { id: TabId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "in-progress", label: "In progress" },
  { id: "resolved", label: "Resolved" },
];

interface NoteEntry {
  text: string;
  at: string;
}

export function SupportInbox(_props: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);
  const [tab, setTab] = useState<TabId>("all");
  const [query, setQuery] = useState("");
  const [statuses, setStatuses] = useState<Record<string, SupportTicket["status"]>>(() =>
    Object.fromEntries(SUPPORT_TICKETS.map((t) => [t.id, t.status]))
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [notes, setNotes] = useState<Record<string, NoteEntry[]>>({});

  const counts = useMemo(
    () => ({
      all: SUPPORT_TICKETS.length,
      open: SUPPORT_TICKETS.filter((t) => statuses[t.id] === "open").length,
      "in-progress": SUPPORT_TICKETS.filter((t) => statuses[t.id] === "in-progress").length,
      resolved: SUPPORT_TICKETS.filter((t) => statuses[t.id] === "resolved").length,
    }),
    [statuses]
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SUPPORT_TICKETS.filter((t) => {
      if (tab !== "all" && statuses[t.id] !== tab) return false;
      if (!q) return true;
      return (
        t.business.toLowerCase().includes(q) ||
        t.user.toLowerCase().includes(q) ||
        t.summary.toLowerCase().includes(q)
      );
    });
  }, [tab, statuses, query]);

  const selected = SUPPORT_TICKETS.find((t) => t.id === selectedId) ?? null;

  const openCases = counts.open + counts["in-progress"];

  const setStatus = (ticket: SupportTicket, next: SupportTicket["status"]) => {
    setStatuses((s) => ({ ...s, [ticket.id]: next }));
    toast(`Simulated: case marked ${next === "in-progress" ? "in progress" : next}`, {
      description: `${ticket.id} — "${ticket.summary}" would move to ${next === "in-progress" ? "in progress" : next} in the support queue.`,
    });
  };

  const addNote = (ticket: SupportTicket) => {
    const text = noteDraft.trim();
    if (!text) {
      toast.error("Note is empty", { description: "Write the internal note before saving it." });
      return;
    }
    setNotes((n) => ({ ...n, [ticket.id]: [...(n[ticket.id] ?? []), { text, at: "Just now" }] }));
    setNoteDraft("");
    toast("Simulated: internal note added", { description: "Notes are visible to the support team only — never to the workspace." });
  };

  return (
    <div>
      <PageHeader
        title="Support inbox"
        description="Support requests and feedback submitted from customer workspaces — bugs, data concerns, AI concerns and product feedback."
      />

      <InfoBanner tone={openCases > 0 ? "warning" : "success"}>
        {openCases > 0 ? (
          <>
            {openCases} case{openCases > 1 ? "s" : ""} need{openCases === 1 ? "s" : ""} attention. One high-priority data concern (KoraHome Store) is directly linked to the failing Shopify sync.
          </>
        ) : (
          "No open support cases. New submissions arrive here in real time."
        )}
      </InfoBanner>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
          <TabsList className="h-auto w-full flex-wrap justify-start sm:w-fit">
            {TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id} className="flex-none px-3">
                {t.label}
                <span className="ml-1.5 rounded-full bg-slate-200/70 px-1.5 text-[11px] font-medium tnum text-slate-600">{counts[t.id]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <SearchInput value={query} onChange={setQuery} placeholder="Search business, user or summary" label="Search support cases" />
      </div>

      <p className="mt-3 text-xs text-muted-foreground" aria-live="polite">
        {rows.length} case{rows.length === 1 ? "" : "s"} in this view
      </p>

      <SectionCard className="mt-3" contentClassName="p-0">
        {rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<LifeBuoy className="size-5" />}
              title="No cases in this view"
              description="Nothing matches this filter right now. Switch tabs or clear the search to see the rest of the inbox."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-32">Type</TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((t) => (
                  <TableRow
                    key={t.id}
                    tabIndex={0}
                    role="link"
                    aria-label={`Open support case from ${t.user}: ${t.summary}`}
                    onClick={() => setSelectedId(t.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedId(t.id);
                      }
                    }}
                    className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600"
                  >
                    <TableCell>
                      <AdminBadge status={t.type} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-medium">{t.business}</TableCell>
                    <TableCell className="whitespace-nowrap">{t.user}</TableCell>
                    <TableCell className="max-w-72">
                      <span className="block truncate text-sm" title={t.summary}>
                        {t.summary}
                      </span>
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={t.priority} />
                    </TableCell>
                    <TableCell>
                      <AdminBadge status={statuses[t.id]} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">{t.created}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      {/* Case dialog */}
      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2 pr-6">
                  {selected.summary}
                </DialogTitle>
                <DialogDescription className="flex flex-wrap items-center gap-2 pt-1">
                  <AdminBadge status={selected.type} />
                  <PriorityBadge priority={selected.priority} />
                  <AdminBadge status={statuses[selected.id]} />
                  <span className="text-xs">
                    {selected.business} · {selected.user} · {selected.created} · {selected.id}
                  </span>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5">
                <div className="rounded-lg border bg-slate-50/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Message from the workspace</p>
                  <p className="mt-2 text-sm leading-relaxed">{selected.message}</p>
                </div>

                <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Workspace context</p>
                  <p className="mt-1.5 text-sm text-blue-950">{selected.workspaceContext}</p>
                  <p className="mt-2 text-xs text-blue-800">
                    Pulled automatically when the case was submitted, so support can see the state of the workspace without asking.
                  </p>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Case status</p>
                  <div className="flex flex-wrap gap-2">
                    {(["open", "in-progress", "resolved"] as SupportTicket["status"][]).map((s) => {
                      const current = statuses[selected.id] === s;
                      return (
                        <button
                          key={s}
                          onClick={() => setStatus(selected, s)}
                          aria-pressed={current}
                          className={cn(
                            "inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600",
                            current
                              ? "border-blue-600 bg-blue-600 text-white"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                          )}
                        >
                          {s === "in-progress" ? "In progress" : s === "open" ? "Open" : "Resolved"}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Internal notes</p>
                  {(notes[selected.id]?.length ?? 0) === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">No internal notes yet on this case.</p>
                  ) : (
                    <ul className="mt-2 space-y-2">
                      {(notes[selected.id] ?? []).map((n, i) => (
                        <li key={i} className="rounded-lg border bg-slate-50/60 p-2.5">
                          <p className="text-sm">{n.text}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{n.at} · support operator</p>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <Textarea
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      placeholder="Add an internal note for the support team…"
                      aria-label="Internal note"
                      className="min-h-16"
                    />
                    <button
                      onClick={() => addNote(selected)}
                      className="inline-flex h-9 shrink-0 items-center justify-center self-end rounded-lg border bg-white px-3 text-sm font-medium shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 sm:w-28"
                    >
                      Add note
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                <button
                  onClick={() => {
                    setSelectedId(null);
                    navigate("admin/businesses");
                  }}
                  className="text-sm font-medium text-blue-600 underline-offset-2 hover:underline"
                >
                  Open business admin detail
                </button>
                <p className="text-xs text-muted-foreground">Status changes are logged against case {selected.id}.</p>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
