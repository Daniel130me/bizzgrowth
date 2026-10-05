"use client";
// Screen 112 — Background Jobs / Import Errors: pipeline runs with expandable error detail.

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Database, RotateCcw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminBadge, SearchInput } from "./parts";
import { InfoBanner, PageHeader, SectionCard } from "@/components/shared/layout";
import { EmptyState } from "@/components/shared/states";
import { JOBS } from "@/lib/data/admin";
import { toast } from "sonner";
import { useBizz } from "@/lib/store";
import type { ScreenProps } from "../view-types";

type StatusFilter = "all" | "success" | "running" | "failed";

export function JobsView(_props: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return JOBS.filter((j) => {
      if (statusFilter !== "all" && j.status !== statusFilter) return false;
      if (!q) return true;
      return j.job.toLowerCase().includes(q) || j.business.toLowerCase().includes(q);
    });
  }, [statusFilter, query]);

  const failedCount = JOBS.filter((j) => j.status === "failed").length;

  const retry = (job: string) =>
    toast("Job re-queued (simulated)", { description: `"${job}" would run again at the next scheduler slot with the same input.` });

  return (
    <div>
      <PageHeader
        title="Jobs & imports"
        description="Background pipeline runs — data syncs, CSV imports, metric calculations, diagnosis refreshes and report generation."
      />

      <InfoBanner tone={failedCount > 0 ? "warning" : "success"}>
        {failedCount > 0
          ? `${failedCount} job${failedCount > 1 ? "s" : ""} failed recently. Failed syncs and imports do not block the rest of the pipeline — affected workspaces keep their last good data.`
          : "All background jobs completed successfully."}
      </InfoBanner>

      <SectionCard
        title="Recent runs"
        description={`${rows.length} of ${JOBS.length} jobs shown. Rows with a message can be expanded.`}
        className="mt-5"
        contentClassName="p-0"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput value={query} onChange={setQuery} placeholder="Search job or workspace" label="Search jobs" />
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="h-9 w-[140px]" aria-label="Filter by job status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      >
        {rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<Database className="size-5" />}
              title="No jobs match these filters"
              description="Try a different search term or reset the status filter."
              actions={
                <button
                  onClick={() => {
                    setQuery("");
                    setStatusFilter("all");
                  }}
                  className="text-sm font-medium text-blue-600 underline-offset-2 hover:underline"
                >
                  Reset filters
                </button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-8" aria-hidden />
                  <TableHead>Job</TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead className="w-24 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((job) => {
                  const expandable = Boolean(job.error);
                  const isOpen = expanded === job.id;
                  return (
                    <Fragment key={job.id}>
                      <TableRow className="hover:bg-slate-50/60">
                        <TableCell>
                          {expandable ? (
                            <button
                              onClick={() => setExpanded(isOpen ? null : job.id)}
                              aria-expanded={isOpen}
                              aria-label={isOpen ? `Hide detail for ${job.job}` : `Show detail for ${job.job}`}
                              className="flex size-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                            >
                              {isOpen ? <ChevronDown className="size-4" aria-hidden /> : <ChevronRight className="size-4" aria-hidden />}
                            </button>
                          ) : null}
                        </TableCell>
                        <TableCell className="max-w-72">
                          <span className="block truncate font-medium" title={job.job}>
                            {job.job}
                          </span>
                        </TableCell>
                        <TableCell>{job.business}</TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">{job.started}</TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">{job.duration}</TableCell>
                        <TableCell>
                          <AdminBadge status={job.status} />
                        </TableCell>
                        <TableCell className="max-w-56">
                          {job.error ? (
                            <span className="block truncate text-xs text-muted-foreground" title={job.error}>
                              {job.error}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {job.status === "failed" ? (
                            <button
                              onClick={() => retry(job.job)}
                              aria-label={`Retry ${job.job}`}
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border bg-white px-2.5 text-xs font-medium shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                            >
                              <RotateCcw className="size-3.5" aria-hidden /> Retry
                            </button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                      {isOpen && job.error ? (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={8} className="bg-slate-50/70 px-6 py-4">
                            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              {job.status === "failed" ? "Error detail" : "Warning detail"}
                            </p>
                            <pre className="whitespace-pre-wrap rounded-lg border bg-slate-950 p-3 font-mono text-xs leading-relaxed text-slate-100">
                              {job.error}
                            </pre>
                            {job.status === "failed" ? (
                              <p className="mt-2 text-xs text-muted-foreground">
                                Retrying uses the same input. If the underlying cause (expired authorization, invalid file) is not fixed first, the job will fail again.
                              </p>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      <p className="mt-4 text-xs text-muted-foreground">
        Failed connection jobs also appear in{" "}
        <button onClick={() => navigate("admin/sync-health")} className="font-medium text-blue-600 underline-offset-2 hover:underline">
          Sync health
        </button>
        . Import validation errors surface to the workspace owner in their import result screen.
      </p>
    </div>
  );
}
