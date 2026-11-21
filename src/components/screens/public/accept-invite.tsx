"use client";
// Screen 8 — Accept Team Invitation.

import React, { useState } from "react";
import { Building2, Check, Clock, ShieldCheck, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { useBizz } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InfoBanner } from "@/components/shared/layout";
import { AuthShell } from "./auth-shared";

export default function AcceptInviteScreen() {
  const navigate = useBizz((s) => s.navigate);
  const invite = useBizz((s) => s.pendingInvite);
  const [declined, setDeclined] = useState(false);

  if (!invite || declined) {
    return (
      <AuthShell
        title={declined ? "Invitation declined" : "No pending invitation"}
        description={
          declined
            ? "You declined this invitation. If that was a mistake, ask the workspace owner to send it again."
            : "There is no pending invitation on this link. Invitations expire after 7 days and can be sent again by the workspace owner."
        }
      >
        <div className="flex flex-col items-center text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-slate-100">
            <Building2 className="size-6 text-slate-400" aria-hidden />
          </span>
          <p className="mt-4 text-sm leading-relaxed text-slate-500">
            Team invitations let an owner add you to their business workspace with a specific role. You&apos;ll see the
            business name, who invited you and what the role can do before accepting.
          </p>
          <Button className="mt-6 w-full" onClick={() => navigate("landing")}>
            Back to landing page
          </Button>
        </div>
      </AuthShell>
    );
  }

  function accept() {
    toast.success("Invitation accepted", {
      description: `Continue by creating your account to join ${invite?.business} as ${invite?.role}.`,
    });
    navigate("signup");
  }

  function decline() {
    setDeclined(true);
    useBizz.setState({ pendingInvite: null });
    toast("Invitation declined", { description: "The workspace owner will be notified." });
  }

  return (
    <AuthShell
      title="Team invitation"
      description="Review the invitation before deciding — you'll see exactly what you're joining."
    >
      <div className="rounded-xl border bg-slate-50/70 p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
            <Building2 className="size-6" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">You&apos;ve been invited to join</p>
            <p className="truncate text-base font-bold text-slate-900">{invite.business}</p>
          </div>
          <Badge variant="outline" className="ml-auto shrink-0 bg-white text-[11px] font-normal text-slate-500">
            Invitation
          </Badge>
        </div>
        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex items-start gap-2.5">
            <UserRound className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Invited by</dt>
              <dd className="text-slate-800">{invite.inviter}</dd>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Role offered</dt>
              <dd className="text-slate-800">{invite.role}</dd>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <Clock className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Expires</dt>
              <dd className="text-slate-800">{invite.expires}</dd>
            </div>
          </div>
        </dl>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
        <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-500">
          <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-500" aria-hidden />
          <span>
            As <span className="font-medium text-slate-700">{invite.role}</span> you&apos;ll see the business
            overview, insights and the actions assigned to you. Managing billing and data connections stays with the
            workspace owner.
          </span>
        </p>
      </div>

      <div className="mt-4">
        <InfoBanner tone="info">
          If you aren&apos;t signed in, you&apos;ll create your account first — your invitation will be waiting when
          you finish.
        </InfoBanner>
      </div>

      <div className="mt-5 space-y-2">
        <Button className="w-full" onClick={accept}>
          <Check className="size-4" aria-hidden />
          Accept invitation
        </Button>
        <Button variant="outline" className="w-full" onClick={decline}>
          <X className="size-4" aria-hidden />
          Decline
        </Button>
      </div>
    </AuthShell>
  );
}
