"use client";
// Screen 80 — Roles & Permissions (kept deliberately simple: 3 roles).

import { Check, Minus } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Breadcrumbs, InfoBanner, PageHeader, SectionCard } from "@/components/shared/layout";
import { useBizz } from "@/lib/store";
import { ROLE_CAPABILITIES, ROLE_LABEL } from "./helpers";
import type { TeamRole } from "./helpers";

const COLUMNS: TeamRole[] = ["owner", "admin", "member"];

interface Capability {
  label: string;
  allowed: Record<TeamRole, boolean>;
}

const CAPABILITIES: Capability[] = [
  { label: "View business performance", allowed: { owner: true, admin: true, member: true } },
  { label: "Manage data sources", allowed: { owner: true, admin: true, member: false } },
  { label: "Create / edit goals", allowed: { owner: true, admin: true, member: false } },
  { label: "Manage actions", allowed: { owner: true, admin: true, member: false } },
  { label: "Invite / remove members", allowed: { owner: true, admin: true, member: false } },
  { label: "Billing & plan changes", allowed: { owner: true, admin: false, member: false } },
  { label: "Export / delete workspace", allowed: { owner: true, admin: false, member: false } },
];

export function RolesPermissions() {
  const navigate = useBizz((s) => s.navigate);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <Breadcrumbs items={[{ label: "Team", onClick: () => navigate("team") }, { label: "Roles & permissions" }]} />
      <PageHeader
        title="Roles & Permissions"
        description="Three roles keep things simple. Owner has full control; Admins run day-to-day operations; Members work their assigned actions."
      />

      <SectionCard
        title="Permission matrix"
        description="What each role can do inside this workspace."
        contentClassName="p-0"
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-1/2">Capability</TableHead>
                {COLUMNS.map((c) => (
                  <TableHead key={c} className="text-center">
                    {ROLE_LABEL[c]}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {CAPABILITIES.map((cap) => (
                <TableRow key={cap.label}>
                  <TableCell className="text-sm">{cap.label}</TableCell>
                  {COLUMNS.map((c) => (
                    <TableCell key={c} className="text-center">
                      {cap.allowed[c] ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                          <Check className="size-4" aria-hidden />
                          <span className="sr-only">Allowed</span>
                          <span aria-hidden className="hidden sm:inline">
                            Allowed
                          </span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                          <Minus className="size-4" aria-hidden />
                          <span className="sr-only">Not available</span>
                          <span aria-hidden className="hidden sm:inline">
                            Not available
                          </span>
                        </span>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="border-t px-5 py-3">
          <p className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Check className="size-3.5 text-emerald-600" aria-hidden /> Can do
            </span>
            <span className="inline-flex items-center gap-1">
              <Minus className="size-3.5 text-slate-400" aria-hidden /> Not available to this role
            </span>
          </p>
        </div>
      </SectionCard>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {COLUMNS.map((c) => (
          <div key={c} className={"rounded-xl border p-4" + (c === "owner" ? " border-brand-200 bg-brand-50/40" : "")}>
            <h3 className="text-sm font-semibold">{ROLE_LABEL[c]}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{ROLE_CAPABILITIES[c]}</p>
          </div>
        ))}
      </div>

      <InfoBanner tone="info" title="Changing roles">
        Change a member&apos;s role from their profile: Team Members → select the member → change role. The workspace has
        exactly one Owner; ownership transfer arrives after beta.
      </InfoBanner>
    </div>
  );
}
