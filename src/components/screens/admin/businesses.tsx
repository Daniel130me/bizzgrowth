"use client";
// Screen 106 — Businesses Management: search, filter and inspect every workspace.

import { useMemo, useState } from "react";
import { Building2, ChevronRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminBadge, MiniProgress, SearchInput } from "./parts";
import { EmptyState } from "@/components/shared/states";
import { PageHeader, SectionCard } from "@/components/shared/layout";
import { ADMIN_BUSINESSES } from "@/lib/data/admin";
import { useBizz } from "@/lib/store";
import type { ScreenProps } from "../view-types";

type TypeFilter = "all" | "service" | "ecommerce";
type StatusFilter = "all" | "active" | "trial" | "suspended";

export function BusinessesManagement(_props: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ADMIN_BUSINESSES.filter((b) => {
      if (typeFilter !== "all" && b.type !== typeFilter) return false;
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      if (!q) return true;
      return b.name.toLowerCase().includes(q) || b.owner.toLowerCase().includes(q);
    });
  }, [query, typeFilter, statusFilter]);

  return (
    <div>
      <PageHeader
        title="Businesses"
        description="Every workspace on the platform. Open a business to review its data sources, sync state, AI output and support history."
      />

      <SectionCard
        title="All workspaces"
        description={`${rows.length} of ${ADMIN_BUSINESSES.length} businesses shown.`}
        contentClassName="p-0"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput value={query} onChange={setQuery} placeholder="Search name or owner" label="Search businesses" />
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
              <SelectTrigger className="h-9 w-[150px]" aria-label="Filter by business type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="service">Service</SelectItem>
                <SelectItem value="ecommerce">Ecommerce</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="h-9 w-[150px]" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="trial">Trial</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      >
        {rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<Building2 className="size-5" />}
              title="No businesses match these filters"
              description="Try a different search term, or reset the type and status filters to see all workspaces."
              actions={
                <button
                  onClick={() => {
                    setQuery("");
                    setTypeFilter("all");
                    setStatusFilter("all");
                  }}
                  className="text-sm font-medium text-brand-600 underline-offset-2 hover:underline"
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
                  <TableHead>Business</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-40">Data coverage</TableHead>
                  <TableHead>Last active</TableHead>
                  <TableHead className="w-8" aria-hidden />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((b) => (
                  <TableRow
                    key={b.id}
                    tabIndex={0}
                    role="link"
                    aria-label={`Open ${b.name} admin detail`}
                    onClick={() => navigate(`admin/businesses/${b.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(`admin/businesses/${b.id}`);
                      }
                    }}
                    className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600"
                  >
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell className="capitalize text-muted-foreground">{b.type}</TableCell>
                    <TableCell>{b.owner}</TableCell>
                    <TableCell className="text-muted-foreground">{b.plan}</TableCell>
                    <TableCell>
                      <AdminBadge status={b.status} />
                    </TableCell>
                    <TableCell>
                      <MiniProgress value={b.coverage} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{b.lastActive}</TableCell>
                    <TableCell aria-hidden>
                      <ChevronRight className="size-4 text-slate-300" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
