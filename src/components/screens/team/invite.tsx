"use client";
// Screen 78 — Invite Team Member.

import { useState } from "react";
import { toast } from "sonner";
import { MailCheck, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Breadcrumbs, InfoBanner, PageHeader, SectionCard } from "@/components/shared/layout";
import { useBizz } from "@/lib/store";
import { ROLE_CAPABILITIES, ROLE_LABEL } from "./helpers";
import type { TeamRole } from "./helpers";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function InviteMember() {
  const navigate = useBizz((s) => s.navigate);
  const businessName = useBizz((s) => s.settings.businessName);
  const sendInvite = useBizz((s) => s.sendInvite);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("member");
  const [message, setMessage] = useState("");
  const [touched, setTouched] = useState(false);
  const [sentTo, setSentTo] = useState<{ email: string; role: TeamRole } | null>(null);

  const emailOk = EMAIL_RE.test(email.trim());
  const canSend = emailOk;

  const submit = () => {
    setTouched(true);
    if (!canSend) return;
    sendInvite(email.trim(), ROLE_LABEL[role]);
    setSentTo({ email: email.trim(), role });
  };

  if (sentTo) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <PageHeader title="Invite Team Member" />
        <SectionCard>
          <div className="flex flex-col items-center py-4 text-center">
            <div className="flex size-12 items-center justify-center rounded-full border bg-white text-emerald-600 shadow-sm">
              <MailCheck className="size-5" aria-hidden />
            </div>
            <h2 className="mt-4 text-lg font-semibold">Invitation sent</h2>
            <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
              An email invitation was sent to <span className="font-medium text-foreground">{sentTo.email}</span>. They
              will join {businessName} as <span className="font-medium text-foreground">{ROLE_LABEL[sentTo.role]}</span>.
            </p>
            <ul className="mt-4 w-full max-w-md space-y-2 rounded-xl border bg-slate-50 p-4 text-left text-sm text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">Expires in 7 days.</span> After that the link no longer
                works and can be resent.
              </li>
              <li>
                <span className="font-medium text-foreground">{ROLE_LABEL[sentTo.role]} permissions apply.</span>{" "}
                {ROLE_CAPABILITIES[sentTo.role]}
              </li>
              <li>You can change their access at any time from their member profile.</li>
            </ul>
            {message.trim() ? (
              <p className="mt-3 max-w-md text-xs text-muted-foreground">
                Your note was included: &ldquo;{message.trim()}&rdquo;
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  sendInvite(sentTo.email, ROLE_LABEL[sentTo.role]);
                  toast.success("Invitation resent", { description: `${sentTo.email} received a fresh 7-day link.` });
                }}
              >
                Resend invitation
              </Button>
              <Button variant="ghost" onClick={() => setSentTo(null)}>
                Send another invite
              </Button>
              <Button onClick={() => navigate("team")}>Back to team</Button>
            </div>
          </div>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Breadcrumbs items={[{ label: "Team", onClick: () => navigate("team") }, { label: "Invite member" }]} />
      <PageHeader
        title="Invite Team Member"
        description="Teammates see this workspace's business views and can collaborate on actions assigned to them."
      />

      <SectionCard title="Invitation details">
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="invite-email">Email address</Label>
            <Input
              id="invite-email"
              type="email"
              inputMode="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched(true)}
              aria-invalid={touched && !emailOk}
            />
            {touched && !emailOk ? (
              <p className="text-xs text-red-600" role="alert">
                Enter a valid email address, e.g. name@company.com.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">The invitation link is valid for 7 days.</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Role</Label>
            <RadioGroup
              value={role}
              onValueChange={(v) => setRole(v as TeamRole)}
              className="gap-3"
              aria-label="Invite as role"
            >
              {(["admin", "member"] as TeamRole[]).map((r) => (
                <Label
                  key={r}
                  htmlFor={`role-${r}`}
                  className={
                    "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors " +
                    (role === r ? "border-brand-300 bg-brand-50/50" : "hover:bg-slate-50")
                  }
                >
                  <RadioGroupItem id={`role-${r}`} value={r} className="mt-0.5" />
                  <span className="space-y-1">
                    <span className="block text-sm font-medium">{ROLE_LABEL[r]}</span>
                    <span className="block text-xs font-normal leading-relaxed text-muted-foreground">
                      {ROLE_CAPABILITIES[r]}
                    </span>
                  </span>
                </Label>
              ))}
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              The workspace Owner role cannot be granted by invitation — ownership transfer comes after beta.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="invite-message">Message (optional)</Label>
            <Textarea
              id="invite-message"
              placeholder="Add a short note to welcome them or explain what they will work on."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
            <Button variant="ghost" onClick={() => navigate("team")}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!canSend}>
              <Send className="mr-1.5 size-4" aria-hidden /> Send invitation
            </Button>
          </div>
        </div>
      </SectionCard>

      <InfoBanner tone="info" title="What new members see">
        Members get business views and their assigned actions. Data sources, billing and team management stay with
        Admins and the Owner. You can adjust access later from Team Members.
      </InfoBanner>
    </div>
  );
}
