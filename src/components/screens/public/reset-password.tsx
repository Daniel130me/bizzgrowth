"use client";
// Screen 7 — Reset Password (arrived from the emailed reset link).

import React, { useState } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { useBizz } from "@/lib/store";
import { AuthShell, DemoHint, PasswordField, SubmitButton } from "./auth-shared";
import { cn } from "@/lib/utils";

export default function ResetPasswordScreen() {
  const navigate = useBizz((s) => s.navigate);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState(false);

  const lengthOk = password.length >= 8;
  const matchOk = confirm.length > 0 && password === confirm;
  const valid = lengthOk && matchOk;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    setSubmitting(true);
    window.setTimeout(() => {
      setSubmitting(false);
      toast.success("Password updated", { description: "Sign in with your new password." });
      navigate("signin");
    }, 900);
  }

  const reqClass = (ok: boolean) =>
    cn("flex items-center gap-1.5", ok ? "text-emerald-600" : touched ? "text-red-600" : "text-slate-500");

  return (
    <AuthShell
      title="Choose a new password"
      description="Your new password should be different from passwords you use elsewhere."
      footer={
        <>
          Didn&apos;t request this?{" "}
          <button
            onClick={() => navigate("signin")}
            className="font-medium text-brand-700 underline-offset-2 hover:underline"
          >
            Back to sign in
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <PasswordField
          id="new-password"
          label="New password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          error={touched && !lengthOk ? "Password must be at least 8 characters." : ""}
        />
        <PasswordField
          id="confirm-password"
          label="Confirm new password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          error={touched && !matchOk ? "Passwords don't match." : ""}
        />
        <ul className="space-y-1.5 text-sm" aria-label="Password requirements">
          <li className={reqClass(lengthOk)}>
            {lengthOk ? <Check className="size-3.5" aria-hidden /> : <X className="size-3.5" aria-hidden />}
            At least 8 characters
          </li>
          <li className={reqClass(matchOk)}>
            {matchOk ? <Check className="size-3.5" aria-hidden /> : <X className="size-3.5" aria-hidden />}
            Both passwords match
          </li>
        </ul>
        <SubmitButton loading={submitting}>Update password</SubmitButton>
      </form>
      <div className="mt-4">
        <DemoHint>
          In the prototype you&apos;ll land here directly instead of from an emailed link. After updating you&apos;ll
          return to sign in.
        </DemoHint>
      </div>
    </AuthShell>
  );
}
