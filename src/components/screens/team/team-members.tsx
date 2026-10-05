"use client";
// Screen 77 — Team Members.

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, SectionCard } from "@/components/shared/layout";
import { StatusBadge } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/states";
import { useBizz } from "@/lib/store";
import { MemberAvatar, RoleBadge, useTeam } from "./helpers";
import type { TeamMember } from "@/lib/types";

export function TeamMembers() {
  const navigate = useBizz((s) => s.navigate);
  const businessName = useBizz((s) => s.settings.businessName);
  const team = useTeam();

  const openRow = (m: TeamMember) => navigate(`team/${m.id}`);

  const active = team.filter((m) => m.status === "active");
  const invited = team.filter((m) => m.status === "invited");
  const totalAssigned = team.reduce((sum, m) => sum + m.assignedActions, 0);

  return (
    <div>
      <PageHeader
        title="Team Members"
        description={`People with access to ${businessName}. Roles control what each person can see and change.`}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("team/roles")}>
              Roles &amp; permissions
            </Button>
            <Button onClick={() => navigate("team/invite")}>Invite member</Button>
          </>
        }
      />

      {team.length === 0 ? (
        <EmptyState
          title="No team members yet"
          description="Invite teammates to share the workspace, assign actions and keep each other accountable."
          actions={
            <Button size="sm" onClick={() => navigate("team/invite")}>
              Invite member
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2 text-sm text-muted-foreground">
            <span className="tnum">{active.length} active</span>
            <span aria-hidden>·</span>
            <span className="tnum">{invited.length} invited</span>
            <span aria-hidden>·</span>
            <span className="tnum">{totalAssigned} actions assigned in total</span>
          </div>

          <SectionCard
            title="Members"
            description="Select a member to review access, assigned actions and activity."
            contentClassName="p-0"
          >
            {/* Desktop / tablet table */}
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead className="hidden lg:table-cell">Job title</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Assigned actions</TableHead>
                    <TableHead className="hidden sm:table-cell">Last active</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {team.map((m) => (
                    <TableRow
                      key={m.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Open ${m.name}`}
                      onClick={() => openRow(m)}
                      onKeyDown={(e) => e.key === "Enter" && openRow(m)}
                      className={
                        "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" +
                        (m.status === "invited" ? " bg-amber-50/60 hover:bg-amber-50" : " hover:bg-slate-50")
                      }
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <MemberAvatar name={m.name} />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{m.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">{m.jobTitle}</TableCell>
                      <TableCell>
                        <RoleBadge role={m.role} />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={m.status} />
                      </TableCell>
                      <TableCell className="text-right text-sm tnum">{m.assignedActions}</TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                        {m.status === "invited" ? (
                          <span className="text-amber-700">Invitation expires in 6 days</span>
                        ) : (
                          m.lastActive
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y md:hidden">
              {team.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => openRow(m)}
                    className={
                      "w-full px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" +
                      (m.status === "invited" ? " bg-amber-50/60" : "")
                    }
                  >
                    <div className="flex items-center gap-3">
                      <MemberAvatar name={m.name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{m.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{m.jobTitle}</p>
                      </div>
                      <RoleBadge role={m.role} />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 pl-12 text-xs text-muted-foreground">
                      <StatusBadge status={m.status} />
                      <span className="tnum">{m.assignedActions} actions</span>
                      <span>
                        {m.status === "invited" ? (
                          <span className="text-amber-700">Invitation expires in 6 days</span>
                        ) : (
                          m.lastActive
                        )}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </SectionCard>

          <p className="mt-4 text-xs text-muted-foreground">
            Pending invitations are highlighted. Expired invitations can be resent from the member&apos;s profile.
          </p>
        </>
      )}
    </div>
  );
}
