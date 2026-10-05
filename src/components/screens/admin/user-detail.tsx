"use client";
// Screen 109 — User Admin Detail: profile, memberships, invitation history, security metadata, support actions.
// Privacy: IPs are partially masked; no passwords, tokens or full contact history are exposed.

import { useMemo, useState } from "react";
import { Ban, KeyRound, LogIn, MailPlus, ShieldCheck, ShieldOff, UserCheck } from "lucide-react";
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
import { AdminBackLink, AdminBadge, InitialsAvatar, NotFoundLite } from "./parts";
import { KeyValue, PageHeader, SectionCard } from "@/components/shared/layout";
import { EmptyState } from "@/components/shared/states";
import { ADMIN_USERS } from "@/lib/data/admin";
import { fmtDate } from "@/lib/format";
import { useBizz } from "@/lib/store";
import { toast } from "sonner";
import type { ScreenProps } from "../view-types";
import type { AdminUser } from "@/lib/types";

const WORKSPACE_OWNERS: Record<string, string> = {
  "SwiftHaul Logistics": "Amara Okafor",
  "KoraHome Store": "Ifeoma Nwosu",
  "NaijaThreads": "Sade Balogun",
  "GreenLeaf Foods": "Halima Bello",
  "Kola Interiors": "Kola Adesanya",
  "Lagos Smile Dental": "Dr. Kelechi Umeh",
  "BrightPath Tutors": "Deji Afolabi",
  "Zenith Fitness Studio": "Rex Johnson",
};

/** Deterministic mock invitation record for each account. */
function invitationFor(u: AdminUser): { invitedBy: string; invitedOn: string; accepted: string } {
  if (u.status === "invited") {
    return { invitedBy: WORKSPACE_OWNERS[u.business] ?? "Workspace owner", invitedOn: "2026-09-28", accepted: "Pending" };
  }
  if (u.role === "Owner") {
    return { invitedBy: "Platform onboarding", invitedOn: u.joined, accepted: fmtDate(u.joined) };
  }
  const d = new Date(u.joined + "T12:00:00");
  d.setDate(d.getDate() - 4);
  const invitedOn = d.toISOString().slice(0, 10);
  return { invitedBy: WORKSPACE_OWNERS[u.business] ?? "Workspace owner", invitedOn, accepted: fmtDate(u.joined) };
}

type ConfirmAction = "reset-password" | "disable" | "enable" | "resend-invite";

export function UserAdminDetail({ params }: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);
  const user = ADMIN_USERS.find((u) => u.id === params.id);
  const [pending, setPending] = useState<ConfirmAction | null>(null);

  const invitation = useMemo(() => (user ? invitationFor(user) : null), [user]);

  if (!user) {
    return (
      <NotFoundLite
        title="User not found"
        description={`No account with id "${params.id}" exists in this prototype. The account may have been removed from the demo dataset.`}
        onBack={() => navigate("admin/users")}
        backLabel="Back to users"
      />
    );
  }

  const CONFIRM_COPY: Record<ConfirmAction, { title: string; description: string; confirm: string; toast: string; detail: string }> = {
    "reset-password": {
      title: "Send password reset?",
      description: `An email with a password reset link would be sent to ${user.email}. Their current sessions stay active until the password changes.`,
      confirm: "Send reset email",
      toast: "Simulated: password reset email sent",
      detail: `${user.email} would receive a reset link valid for 60 minutes.`,
    },
    disable: {
      title: `Disable ${user.name}'s account?`,
      description: "The user would be signed out immediately and unable to sign in. Workspace data is untouched, and the workspace owner would be notified.",
      confirm: "Disable account",
      toast: "Simulated: account disabled",
      detail: `${user.name} would lose access across all workspaces. This is reversible.`,
    },
    enable: {
      title: `Re-enable ${user.name}'s account?`,
      description: "The user would be able to sign in again with their existing credentials. Billing remains paused until the workspace is restored.",
      confirm: "Re-enable account",
      toast: "Simulated: account re-enabled",
      detail: `${user.name} would regain access on next sign-in.`,
    },
    "resend-invite": {
      title: "Resend invitation?",
      description: `A fresh invitation email would be sent to ${user.email}. The previous link would stop working.`,
      confirm: "Resend invitation",
      toast: "Simulated: invitation resent",
      detail: `${user.email} would receive a new invitation to join ${user.business}.`,
    },
  };

  const runAction = (a: ConfirmAction) => {
    const c = CONFIRM_COPY[a];
    toast(c.toast, { description: c.detail });
    setPending(null);
  };

  const invitePending = user.status === "invited";

  return (
    <div>
      <AdminBackLink label="Back to users" onClick={() => navigate("admin/users")} />
      <PageHeader
        title={user.name}
        badge={<AdminBadge status={user.status} />}
        description={`Account ${user.id} · member of ${user.business}.`}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard title="Profile" description="Core account details.">
          <div className="flex items-center gap-4">
            <InitialsAvatar name={user.name} className="size-14 rounded-xl text-base" />
            <div className="min-w-0">
              <p className="text-base font-semibold">{user.name}</p>
              <p className="truncate text-sm text-muted-foreground">{user.email}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <AdminBadge status={user.status} />
                <span className="text-xs text-muted-foreground">{user.role}</span>
              </div>
            </div>
          </div>
          <div className="mt-5 space-y-3 border-t pt-4">
            <KeyValue label="Joined">{user.joined === "—" ? "Not yet — invitation pending" : fmtDate(user.joined)}</KeyValue>
            <KeyValue label="Last active">{user.lastActive}</KeyValue>
            <KeyValue label="Role">{user.role}</KeyValue>
          </div>
        </SectionCard>

        <SectionCard title="Workspace memberships" description="Workspaces this account can access.">
          <ul className="divide-y rounded-lg border">
            <li className="flex items-center justify-between gap-3 px-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{user.business}</p>
                <p className="text-xs text-muted-foreground">
                  {user.role === "Owner" ? "Full billing and workspace control" : user.role === "Admin" ? "Can manage data and team" : "Can view and act on recommendations"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">{user.role}</span>
                <AdminBadge status={user.status} />
              </div>
            </li>
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">1 workspace membership. Cross-workspace access is not available in this prototype.</p>
        </SectionCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SectionCard title="Invitation history" description="How this account reached the platform.">
          {invitation ? (
            <ul className="space-y-3">
              <li className="flex items-start gap-3 rounded-lg border bg-slate-50/60 p-3">
                <MailPlus className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm">
                    Invited by <span className="font-medium">{invitation.invitedBy}</span> on <span className="tabular-nums">{fmtDate(invitation.invitedOn)}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {invitePending ? "Invitation pending — no acceptance yet." : `Accepted ${invitation.accepted}.`}
                  </p>
                </div>
              </li>
              {invitePending ? (
                <li className="text-xs text-muted-foreground">
                  One invitation outstanding. You can resend it from the support actions below.
                </li>
              ) : null}
            </ul>
          ) : (
            <EmptyState title="No invitation history" description="This account has no recorded invitations." />
          )}
        </SectionCard>

        <SectionCard title="Login & security" description="Account security metadata. Sensitive values are partially masked.">
          <div className="space-y-3">
            <KeyValue label="Last sign-in">
              <span className="inline-flex items-center gap-1.5">
                <LogIn className="size-3.5 text-slate-400" aria-hidden />
                {invitePending ? "Never — invitation pending" : user.lastActive}
              </span>
            </KeyValue>
            <KeyValue label="Last IP">
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                102.89.&bull;&bull;.&bull;&bull;
                <span className="text-xs text-muted-foreground">&middot; Lagos, NG</span>
              </span>
            </KeyValue>
            <KeyValue label="Sign-in method">Email and password</KeyValue>
            <KeyValue label="Two-factor auth">
              <span className="inline-flex items-center gap-1.5">
                <ShieldOff className="size-3.5 text-amber-600" aria-hidden />
                Off
                <span className="text-xs text-muted-foreground">— encouraged via in-app prompt</span>
              </span>
            </KeyValue>
          </div>
          <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-xs text-muted-foreground">
            <ShieldCheck className="mr-1 inline size-3.5" aria-hidden />
            Admins can never view or change a user&apos;s password — only trigger a reset email. IP addresses are masked to the first two octets.
          </p>
        </SectionCard>
      </div>

      <SectionCard
        title="Support actions"
        description="Account interventions. Each action is simulated in this prototype — nothing is sent and nothing changes."
        className="mt-6"
      >
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setPending("reset-password")}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border bg-white px-3 text-sm font-medium shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <KeyRound className="size-3.5" aria-hidden /> Reset password
          </button>
          {invitePending ? (
            <button
              onClick={() => setPending("resend-invite")}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border bg-white px-3 text-sm font-medium shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <MailPlus className="size-3.5" aria-hidden /> Resend invite
            </button>
          ) : null}
          {user.status === "disabled" ? (
            <button
              onClick={() => setPending("enable")}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-sm font-medium text-emerald-800 shadow-sm transition-colors hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              <UserCheck className="size-3.5" aria-hidden /> Re-enable account
            </button>
          ) : (
            <button
              onClick={() => setPending("disable")}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-800 shadow-sm transition-colors hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600"
            >
              <Ban className="size-3.5" aria-hidden /> Disable account
            </button>
          )}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Actions are confirmed before they run, and every intervention is written to the system event log.
        </p>
      </SectionCard>

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          {pending ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{CONFIRM_COPY[pending].title}</AlertDialogTitle>
                <AlertDialogDescription>{CONFIRM_COPY[pending].description}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => runAction(pending)}
                  className={pending === "disable" ? "bg-red-600 text-white hover:bg-red-700" : undefined}
                >
                  {CONFIRM_COPY[pending].confirm}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : null}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
