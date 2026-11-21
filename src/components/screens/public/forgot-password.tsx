"use client";
// Screen 6 — Forgot Password.

import React, { useEffect, useState } from "react";
import { ArrowLeft, MailCheck, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { useBizz } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell, DemoHint, Field, SubmitButton, isEmail } from "./auth-shared";

export default function ForgotPasswordScreen() {
  const navigate = useBizz((s) => s.navigate);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const emailError = isEmail(email) ? "" : "Enter a valid email address.";

  useEffect(() => {
    if (seconds <= 0) return;
    const t = window.setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [seconds]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (emailError) return;
    setSubmitting(true);
    window.setTimeout(() => {
      setSubmitting(false);
      setSent(true);
      toast.success("Reset link sent", {
        description: `If an account exists for ${email.trim().toLowerCase()}, a reset link is on its way.`,
      });
    }, 900);
  }

  if (sent) {
    return (
      <AuthShell
        title="Check your inbox"
        description="We've sent a password reset link."
        footer={
          <>
            Remembered it after all?{" "}
            <button
              onClick={() => navigate("signin")}
              className="font-medium text-brand-700 underline-offset-2 hover:underline"
            >
              Back to sign in
            </button>
          </>
        }
      >
        <div className="flex flex-col items-center text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-brand-50">
            <MailCheck className="size-6 text-brand-600" aria-hidden />
          </span>
          <p className="mt-4 text-sm text-slate-600">
            A reset link is on its way to <span className="font-semibold text-slate-900">{email.trim().toLowerCase()}</span>.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            The link expires in 30 minutes. If it doesn&apos;t arrive, check your spam folder or resend below. If no
            account exists for this address, you won&apos;t receive an email.
          </p>
        </div>
        <div className="mt-6 space-y-2">
          <Button
            variant="outline"
            className="w-full"
            disabled={seconds > 0}
            onClick={() => {
              setSeconds(30);
              toast.success("Reset link resent", { description: "Give it a minute, then check your inbox again." });
            }}
          >
            <RotateCw className={seconds > 0 ? "size-4 animate-spin" : "size-4"} aria-hidden />
            {seconds > 0 ? `Resend in ${seconds}s` : "Resend link"}
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => setSent(false)}>
            Use a different email
          </Button>
        </div>
        <div className="mt-6">
          <DemoHint>Email sending is simulated in this prototype — no real email is sent.</DemoHint>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset your password"
      description="Enter the email you registered with and we'll send you a reset link."
      footer={
        <>
          <button
            onClick={() => navigate("signin")}
            className="inline-flex items-center gap-1 font-medium text-brand-700 underline-offset-2 hover:underline"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Back to sign in
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field
          id="forgot-email"
          label="Email"
          error={touched ? emailError : ""}
          hint={touched ? undefined : "For example, you@yourbusiness.ng"}
        >
          <Input
            id="forgot-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@yourbusiness.ng"
            aria-invalid={Boolean(touched && emailError)}
          />
        </Field>
        <SubmitButton loading={submitting}>Send reset link</SubmitButton>
      </form>
      <div className="mt-4">
        <DemoHint>
          For this prototype, any valid email address will move to the success state.
        </DemoHint>
      </div>
    </AuthShell>
  );
}
