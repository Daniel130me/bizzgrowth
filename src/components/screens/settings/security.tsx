"use client";
// Screen 86 — Security & Password.

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Laptop, LogOut, Monitor, Smartphone } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PageHeader, SectionCard } from "@/components/shared/layout";

interface SessionRow {
  id: string;
  icon: React.ReactNode;
  device: string;
  detail: string;
  when: string;
  current: boolean;
}

const SESSIONS: SessionRow[] = [
  { id: "s1", icon: <Laptop className="size-4" aria-hidden />, device: "Chrome on MacBook Pro", detail: "Lagos, Nigeria", when: "Active now", current: true },
  { id: "s2", icon: <Smartphone className="size-4" aria-hidden />, device: "Safari on iPhone 13", detail: "Lagos, Nigeria", when: "2 days ago", current: false },
  { id: "s3", icon: <Monitor className="size-4" aria-hidden />, device: "Edge on Windows PC", detail: "Abuja, Nigeria", when: "6 days ago", current: false },
];

type Strength = { label: string; cls: string; hint: string };

export function SecuritySettings() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false);

  const strength: Strength = useMemo(() => {
    const hasLen = next.length >= 8;
    const hasMixed = /[a-z]/.test(next) && /[A-Z]/.test(next);
    const hasNum = /\d/.test(next);
    const score = [hasLen, hasMixed, hasNum].filter(Boolean).length;
    if (!next) return { label: "", cls: "", hint: "Use at least 8 characters with a number and mixed case." };
    if (score >= 3) return { label: "Strong", cls: "text-emerald-600", hint: "Good — hard to guess." };
    if (score === 2) return { label: "Fair", cls: "text-amber-600", hint: "Add a number or mixed case to make it stronger." };
    return { label: "Weak", cls: "text-red-600", hint: "Use at least 8 characters with a number and mixed case." };
  }, [next]);

  const error = useMemo(() => {
    if (!touched) return "";
    if (!current) return "Enter your current password.";
    if (next.length < 8) return "The new password must be at least 8 characters.";
    if (next === current) return "The new password must be different from the current one.";
    if (next !== confirm) return "The confirmation does not match the new password.";
    return "";
  }, [touched, current, next, confirm]);

  const canSubmit = Boolean(current && next && confirm) && !error;

  const submit = () => {
    setTouched(true);
    if (!canSubmit) return;
    toast.success("Password changed", { description: "All other sessions were signed out for safety." });
    setCurrent("");
    setNext("");
    setConfirm("");
    setTouched(false);
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="Security & Password"
        description="Protect your account and review where you are signed in."
      />

      <SectionCard title="Change password">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pw-current">Current password</Label>
            <Input id="pw-current" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pw-new">New password</Label>
              <Input id="pw-new" type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" aria-describedby="pw-strength" />
              <p id="pw-strength" className={"text-xs " + strength.cls}>
                {strength.label ? `Strength: ${strength.label}. ` : ""}
                <span className="text-muted-foreground">{strength.hint}</span>
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw-confirm">Confirm new password</Label>
              <Input id="pw-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
            </div>
          </div>
          {error ? (
            <p className="text-xs text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button onClick={submit} disabled={!current || !next || !confirm}>
              Update password
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Active sessions"
        description="Devices currently signed in to this account."
        action={
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm">
                <LogOut className="mr-1.5 size-3.5" aria-hidden /> Sign out other sessions
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Sign out other sessions?</AlertDialogTitle>
                <AlertDialogDescription>
                  The 2 other sessions will end immediately. Anyone using them can sign in again with their password.
                  Your current session stays active.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() =>
                    toast.success("Other sessions signed out", {
                      description: "2 sessions were ended. They can sign in again with their password.",
                    })
                  }
                >
                  Sign out 2 sessions
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        }
        contentClassName="p-0"
      >
        <ul className="divide-y">
          {SESSIONS.map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-5 py-3.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                {s.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {s.device}
                  {s.current ? (
                    <Badge variant="outline" className="bg-emerald-50 font-normal text-emerald-700 border-emerald-200">
                      Current session
                    </Badge>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {s.detail} · {s.when}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="Multi-factor authentication">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Authenticator app (TOTP)</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              A second step at sign-in using an authenticator app. Coming after beta — we will email you when it is
              ready.
            </p>
          </div>
          <Switch disabled checked={false} aria-label="Multi-factor authentication (coming after beta)" />
        </div>
        <Badge variant="outline" className="mt-3 bg-slate-100 font-normal text-slate-600">
          Coming after beta
        </Badge>
      </SectionCard>
    </div>
  );
}
