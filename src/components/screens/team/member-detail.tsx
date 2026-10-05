"use client";
// Screen 79 — Member Detail / Edit Access.

import { useState } from "react";
import { toast } from "sonner";
import { ShieldAlert, UserMinus } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Breadcrumbs, InfoBanner, KeyValue, PageHeader, SectionCard } from "@/components/shared/layout";
import { StatusBadge } from "@/components/shared/badges";
import { ErrorState } from "@/components/shared/states";
import { useBizz } from "@/lib/store";
import { fmtDate } from "@/lib/format";
import type { ScreenProps } from "../view-types";
import {
  JOINED,
  MemberAvatar,
  ROLE_CAPABILITIES,
  ROLE_LABEL,
  RoleBadge,
  actionOwnedBy,
  dueInfo,
  DUE_TONE_CLS,
  useTeam,
  useTeamActions,
  writeRemovedMember,
  writeRoleOverride,
} from "./helpers";
import type { TeamRole } from "./helpers";

const ROLE_OPTIONS: TeamRole[] = ["owner", "admin", "member"];

export function MemberDetail({ params }: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);
  const businessId = useBizz((s) => s.businessId);
  const businessName = useBizz((s) => s.settings.businessName);
  const user = useBizz((s) => s.user);
  const team = useTeam();
  const actions = useTeamActions(businessId);

  const member = team.find((m) => m.id === params.id);
  const [role, setRole] = useState<TeamRole>(member?.role ?? "member");
  const [pendingRole, setPendingRole] = useState<TeamRole | null>(null);
  const [removing, setRemoving] = useState(false);

  if (!member) {
    return (
      <ErrorState
        title="Member not found"
        description="This member may have been removed, or the link is out of date."
        onHome={() => navigate("team")}
      />
    );
  }

  const isSelf = member.email === user.email;
  const assigned = actions.filter((a) => actionOwnedBy(a, member.name) && a.status !== "completed");
  const completedCount = actions.filter((a) => actionOwnedBy(a, member.name) && a.status === "completed").length;

  const requestRoleChange = (v: string) => {
    const next = v as TeamRole;
    if (next === role) return;
    setPendingRole(next);
  };

  const confirmRoleChange = () => {
    if (!pendingRole) return;
    setRole(pendingRole);
    writeRoleOverride(member.id, pendingRole);
    toast.success("Access updated", {
      description: `${member.name} now has the ${ROLE_LABEL[pendingRole]} role in ${businessName}.`,
    });
    setPendingRole(null);
  };

  const confirmRemove = () => {
    writeRemovedMember(member.id);
    toast.success(member.status === "invited" ? "Invitation revoked" : "Access removed", {
      description:
        member.status === "invited"
          ? `${member.email} can no longer use the invitation link.`
          : `${member.name} no longer has access to ${businessName}. Workspace data was not deleted.`,
    });
    setRemoving(false);
    navigate("team");
  };

  return (
    <div>
      <Breadcrumbs items={[{ label: "Team", onClick: () => navigate("team") }, { label: member.name }]} />
      <PageHeader
        title={member.name}
        badge={
          <>
            <RoleBadge role={role} />
            <StatusBadge status={member.status} />
          </>
        }
        description={member.jobTitle}
        actions={
          <>
            <Select
              value={role}
              onValueChange={requestRoleChange}
              disabled={member.role === "owner"}
              aria-label={`Change ${member.name}'s role`}
            >
              <SelectTrigger className="w-[190px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r} value={r} disabled={r === "owner" && member.role !== "owner"}>
                    {ROLE_LABEL[r]}
                    {r === "owner" && member.role !== "owner" ? " (after beta)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              disabled={isSelf}
              onClick={() => toast("Sign-in method", { description: "Password resets are managed per member from their sign-in page." })}
            >
              Reset password
            </Button>
          </>
        }
      />

      {isSelf ? (
        <InfoBanner tone="info">
          This is your own account. You can edit your name, email and job role under Settings → Your profile.
        </InfoBanner>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <SectionCard title="Member">
          <div className="flex items-center gap-4">
            <MemberAvatar name={member.name} className="size-14 text-base" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{member.name}</p>
              <p className="truncate text-sm text-muted-foreground">{member.email}</p>
            </div>
          </div>
          <div className="mt-4 space-y-3 border-t pt-4">
            <KeyValue label="Job title">{member.jobTitle}</KeyValue>
            <KeyValue label="Role">
              {ROLE_LABEL[role]} — {ROLE_CAPABILITIES[role]}
            </KeyValue>
            <KeyValue label="Status">{member.status === "invited" ? "Invited (pending acceptance)" : "Active"}</KeyValue>
          </div>
        </SectionCard>

        <SectionCard title="Activity" description="When this member last used the workspace.">
          <div className="space-y-3">
            <KeyValue label="Last active">{member.lastActive}</KeyValue>
            <KeyValue label="Joined">
              {member.status === "invited"
                ? "Invitation sent 30 Sept 2026 — expires in 6 days"
                : JOINED[member.id]
                  ? fmtDate(JOINED[member.id])
                  : "Before records began"}
            </KeyValue>
            <KeyValue label="Actions completed">{`${completedCount} in this workspace`}</KeyValue>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Detailed per-action history is available on each action page under Activity.
          </p>
        </SectionCard>

        <SectionCard
          title="Assigned actions"
          description={
            assigned.length
              ? "Open actions owned by this member. Select one to review progress."
              : "No open actions for this member right now."
          }
          className="lg:col-span-2"
          contentClassName={assigned.length ? "p-0" : undefined}
        >
          {assigned.length > 0 ? (
            <ul className="max-h-96 divide-y overflow-y-auto">
              {assigned.map((a) => {
                const due = dueInfo(a.due);
                return (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`actions/${a.id}`)}
                      className="flex w-full flex-wrap items-center justify-between gap-2 px-5 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{a.title}</span>
                        <span className={`block text-xs ${DUE_TONE_CLS[due.tone]}`}>{due.text}</span>
                      </span>
                      <StatusBadge status={a.status} />
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              The count shown in the team list includes completed history. Start an action from a recommendation to
              assign one.
            </p>
          )}
        </SectionCard>

        <div className="rounded-xl border-2 border-red-200 bg-red-50 p-5 lg:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-red-600" aria-hidden />
              <div>
                <h2 className="text-sm font-semibold text-red-900">
                  {member.status === "invited" ? "Revoke invitation" : "Remove access"}
                </h2>
                <p className="mt-0.5 max-w-xl text-xs text-red-800/90">
                  {role === "owner"
                    ? "The workspace Owner cannot be removed. Ownership transfer will come after beta."
                    : member.status === "invited"
                      ? `Revokes the pending invitation for ${member.email}. The link will stop working immediately.`
                      : `${member.name} loses access to ${businessName} immediately. Assigned actions (${assigned.length}) will need a new owner. Workspace data is not deleted.`}
                </p>
              </div>
            </div>
            <AlertDialog open={removing} onOpenChange={setRemoving}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={role === "owner"} className="shrink-0">
                  <UserMinus className="mr-1.5 size-4" aria-hidden />
                  {member.status === "invited" ? "Revoke invitation" : "Remove access"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {member.status === "invited" ? "Revoke this invitation?" : `Remove ${member.name} from ${businessName}?`}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {member.status === "invited"
                      ? "The invitation link stops working and the pending seat is freed. You can invite them again later."
                      : `Access is removed immediately. Their ${assigned.length} open action${assigned.length === 1 ? "" : "s"} stay in the workspace and can be reassigned. This cannot be undone in the prototype.`}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-red-600 text-white hover:bg-red-700"
                    onClick={(e) => {
                      e.preventDefault();
                      confirmRemove();
                    }}
                  >
                    {member.status === "invited" ? "Revoke invitation" : "Remove access"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>

      <Dialog open={pendingRole !== null} onOpenChange={(open) => !open && setPendingRole(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Change role to {pendingRole ? ROLE_LABEL[pendingRole] : ""}?</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  {member.name} will immediately be able to:
                </p>
                <p className="rounded-lg border bg-slate-50 p-3 leading-relaxed text-muted-foreground">
                  {pendingRole ? ROLE_CAPABILITIES[pendingRole] : ""}
                </p>
                <p className="text-muted-foreground">
                  {pendingRole === "admin"
                    ? "Admins can connect data sources and manage the team. Review the roles matrix if unsure."
                    : pendingRole === "member"
                      ? "Members keep access to business views and their assigned actions only."
                      : "Owner access includes billing and workspace deletion."}
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingRole(null)}>
              Cancel
            </Button>
            <Button onClick={confirmRoleChange}>Confirm change</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
