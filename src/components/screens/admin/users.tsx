"use client";
// Screen 108 — Users Management: search and inspect every account on the platform.

import { useMemo, useState } from "react";
import { ChevronRight, Users } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AdminBadge, InitialsAvatar, SearchInput } from "./parts";
import { EmptyState } from "@/components/shared/states";
import { PageHeader, SectionCard } from "@/components/shared/layout";
import { ADMIN_USERS } from "@/lib/data/admin";
import { fmtDate } from "@/lib/format";
import { useBizz } from "@/lib/store";
import type { ScreenProps } from "../view-types";

type StatusFilter = "all" | "active" | "invited" | "disabled";

export function UsersManagement(_props: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ADMIN_USERS.filter((u) => {
      if (statusFilter !== "all" && u.status !== statusFilter) return false;
      if (!q) return true;
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.business.toLowerCase().includes(q);
    });
  }, [query, statusFilter]);

  return (
    <div>
      <PageHeader
        title="Users"
        description="Every account across all workspaces. Open a user to review memberships, invitation history and security metadata."
      />

      <SectionCard
        title="All accounts"
        description={`${rows.length} of ${ADMIN_USERS.length} users shown.`}
        contentClassName="p-0"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput value={query} onChange={setQuery} placeholder="Search name, email or workspace" label="Search users" />
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="h-9 w-[150px]" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="invited">Invited</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      >
        {rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<Users className="size-5" />}
              title="No users match these filters"
              description="Try a different search term, or reset the status filter to see all accounts."
              actions={
                <button
                  onClick={() => {
                    setQuery("");
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
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Last active</TableHead>
                  <TableHead className="w-8" aria-hidden />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((u) => (
                  <TableRow
                    key={u.id}
                    tabIndex={0}
                    role="link"
                    aria-label={`Open admin detail for ${u.name}`}
                    onClick={() => navigate(`admin/users/${u.id}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        navigate(`admin/users/${u.id}`);
                      }
                    }}
                    className="cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600"
                  >
                    <TableCell>
                      <span className="flex items-center gap-2.5">
                        <InitialsAvatar name={u.name} />
                        <span className="font-medium">{u.name}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>{u.business}</TableCell>
                    <TableCell className="text-muted-foreground">{u.role}</TableCell>
                    <TableCell>
                      <AdminBadge status={u.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">{u.joined === "—" ? "—" : fmtDate(u.joined)}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{u.lastActive}</TableCell>
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
