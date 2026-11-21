"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SectionCard, PageHeader, InfoBanner } from "@/components/shared/layout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type AudienceFilter = "all" | "business" | "specialist";
type WaitlistEntry = {
  id: string;
  name: string;
  email: string;
  audience: Exclude<AudienceFilter, "all">;
  businessName: string | null;
  industry: string | null;
  specialty: string | null;
  experience: string | null;
  createdAt: string;
};
type WaitlistResponse = {
  ok?: boolean;
  entries?: WaitlistEntry[];
  total?: number;
  page?: number;
  totalPages?: number;
  error?: string;
};

const AUDIENCE_FILTERS: { id: AudienceFilter; label: string }[] = [
  { id: "all", label: "Everyone" },
  { id: "business", label: "Businesses" },
  { id: "specialist", label: "Specialists" },
];
const PAGE_SIZE = 100;

export function WaitlistAdmin() {
  const [audience, setAudience] = useState<AudienceFilter>("all");
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({ audience, page: String(page) });
      if (search) params.set("q", search);
      try {
        const response = await fetch(`/api/admin/waitlist?${params}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = (await response.json().catch(() => ({}))) as WaitlistResponse;
        if (!response.ok || !result.ok) {
          throw new Error(result.error || "The waiting list could not be loaded.");
        }
        setEntries(result.entries ?? []);
        setTotal(result.total ?? 0);
        setTotalPages(result.totalPages ?? 0);
      } catch (caught) {
        if (caught instanceof Error && caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "The waiting list could not be loaded.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [audience, page, reloadKey, search]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setSearch(searchText.trim().slice(0, 100));
  }

  const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);

  return (
    <div>
      <PageHeader
        title="Waiting list"
        description="Review early-access requests from businesses and specialists. These entries are separate from user accounts."
      />

      {!error ? (
        <InfoBanner tone="info">
          {total.toLocaleString()} request{total === 1 ? "" : "s"}{audience !== "all" ? ` from ${audience === "business" ? "businesses" : "specialists"}` : ""} in this view.
        </InfoBanner>
      ) : null}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter waiting-list audience">
          {AUDIENCE_FILTERS.map((filter) => (
            <Button
              key={filter.id}
              type="button"
              size="sm"
              variant={audience === filter.id ? "default" : "outline"}
              aria-pressed={audience === filter.id}
              onClick={() => {
                setAudience(filter.id);
                setPage(1);
              }}
            >
              {filter.label}
            </Button>
          ))}
        </div>
        <form className="flex w-full gap-2 sm:max-w-md" onSubmit={submitSearch} role="search">
          <label className="sr-only" htmlFor="waitlist-search">Search waiting-list requests</label>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <Input
              id="waitlist-search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Name, email, business or expertise"
              className="pl-9"
              autoComplete="off"
            />
          </div>
          <Button type="submit" variant="outline" disabled={loading}>
            Search
          </Button>
        </form>
      </div>

      <SectionCard className="mt-4" contentClassName="p-0">
        {loading ? (
          <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-slate-600" role="status">
            <Loader2 className="size-4 animate-spin text-brand-600" aria-hidden />
            Loading waiting-list requests…
          </div>
        ) : error ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 px-5 py-8 text-center">
            <p className="max-w-lg text-sm text-red-800" role="alert">{error}</p>
            <Button variant="outline" size="sm" onClick={() => setReloadKey((current) => current + 1)}>
              Try again
            </Button>
          </div>
        ) : entries.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <h2 className="text-sm font-semibold text-slate-900">
              {search || audience !== "all" ? "No requests match this view" : "No requests yet"}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {search || audience !== "all"
                ? "Try a different search or audience filter."
                : "New early-access requests will appear here."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Name &amp; email</TableHead>
                  <TableHead>Joining as</TableHead>
                  <TableHead>Business / expertise</TableHead>
                  <TableHead>Experience</TableHead>
                  <TableHead className="whitespace-nowrap">Requested</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="min-w-52">
                      <div className="font-medium text-slate-900">{entry.name}</div>
                      <div className="mt-0.5 text-sm text-slate-600">{entry.email}</div>
                    </TableCell>
                    <TableCell className="capitalize">{entry.audience}</TableCell>
                    <TableCell className="min-w-48">
                      <div className="font-medium text-slate-800">{entry.audience === "business" ? entry.businessName : entry.specialty}</div>
                      <div className="mt-0.5 text-sm text-slate-600">{entry.audience === "business" ? entry.industry : "Specialist"}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{entry.experience ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-slate-600">
                      {new Date(entry.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
        <p aria-live="polite">
          {loading ? "Updating list…" : error ? "Waiting-list data is unavailable." : `Showing ${start.toLocaleString()}–${end.toLocaleString()} of ${total.toLocaleString()}`}
        </p>
        <div className="flex items-center gap-2">
          <span className="mr-1 text-xs">Page {page} of {Math.max(1, totalPages)}</span>
          <Button variant="outline" size="sm" disabled={loading || page <= 1} onClick={() => setPage((current) => current - 1)}>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={loading || totalPages === 0 || page >= totalPages} onClick={() => setPage((current) => current + 1)}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
