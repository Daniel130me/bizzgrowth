"use client";
// Screen 4 — Verify Email.

import React, { useEffect, useState } from "react";
import { Mail, MailCheck, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { useBizz } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { AuthShell, DemoHint, pendingSignup } from "./auth-shared";
import { cn } from "@/lib/utils";

export default function VerifyEmailScreen() {
  const navigate = useBizz((s) => s.navigate);
  const storeEmail = useBizz((s) => s.user.email);
  const email = pendingSignup.email || storeEmail;
  const [seconds, setSeconds] = useState(0);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = window.setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [seconds]);

  function resend() {
    setSeconds(30);
    setResent(true);
    toast.success("Verification email resent", {
      description: `If it doesn't arrive at ${email} within a few minutes, check your spam folder.`,
    });
  }

  return (
    <AuthShell title="Verify your email" description="One quick step before setup.">
      <div className="flex flex-col items-center text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-blue-50">
          <MailCheck className="size-6 text-blue-600" aria-hidden />
        </span>
        <p className="mt-4 text-sm text-slate-600">
          We sent a verification link to <span className="font-semibold text-slate-900">{email}</span>.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Open the email and click <span className="font-medium text-slate-700">Verify my email</span>. This confirms
          the address we should use for briefs, alerts and account recovery.
        </p>
      </div>

      <div className="mt-6 space-y-3">
        <Button className="w-full" onClick={() => navigate("welcome")}>
          I&apos;ve verified — continue setup
        </Button>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => toast("Opening your email app…", { description: "Prototype: this would open your mail client." })}
          >
            <Mail className="size-4" aria-hidden />
            Open email
          </Button>
          <Button variant="outline" className="w-full" disabled={seconds > 0} onClick={resend}>
            <RotateCw className={cn("size-4", seconds > 0 && "animate-spin")} aria-hidden />
            {seconds > 0 ? `Resend in ${seconds}s` : resent ? "Resend again" : "Resend"}
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => navigate("signup")}>
            Change email
          </Button>
        </div>
      </div>

      <div className="mt-6">
        <DemoHint>
          Email verification is simulated in this prototype — you can continue setup without a real inbox.
        </DemoHint>
      </div>
    </AuthShell>
  );
}
