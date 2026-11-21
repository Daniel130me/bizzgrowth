"use client";
// Screen 5 — Sign In.

import React, { useState } from "react";
import { toast } from "sonner";
import { useBizz } from "@/lib/store";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { landingFor, signIn } from "@/lib/auth/client";
import { AuthShell, Field, PasswordField, SubmitButton, isEmail } from "./auth-shared";

export default function SigninScreen() {
  const navigate = useBizz((s) => s.navigate);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});

  const emailError = isEmail(email) ? "" : "Enter a valid email address.";
  const passwordError = password.length >= 8 ? "" : "Password must be at least 8 characters.";
  const valid = !emailError && !passwordError;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ email: true, password: true });
    setServerError("");
    if (!valid) return;
    setSubmitting(true);
    // The password is checked on the server; a session cookie is issued on success.
    const r = await signIn(email.trim().toLowerCase(), password, remember);
    setSubmitting(false);
    if (!r.ok) {
      setServerError(r.error);
      setPassword("");
      return;
    }
    toast.success("Signed in", { description: "Continuing where you left off." });
    navigate(landingFor(r.user));
  }

  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to your Nellovia workspace."
      footer={
        <>
          New to Nellovia?{" "}
          <button
            onClick={() => navigate("signup")}
            className="font-medium text-brand-700 underline-offset-2 hover:underline"
          >
            Create an account
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field
          id="signin-email"
          label="Email"
          error={touched.email ? emailError : ""}
          hint={touched.email ? undefined : "The email you registered with."}
        >
          <Input
            id="signin-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            autoComplete="email"
            placeholder="you@yourbusiness.ng"
            aria-invalid={Boolean(touched.email && emailError)}
          />
        </Field>
        <PasswordField
          id="signin-password"
          label="Password"
          value={password}
          onChange={setPassword}
          onBlur={() => setTouched((t) => ({ ...t, password: true }))}
          autoComplete="current-password"
          error={touched.password ? passwordError : ""}
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Checkbox id="remember" checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
            <Label htmlFor="remember" className="text-sm font-normal text-slate-600">
              Remember me
            </Label>
          </div>
          <button
            type="button"
            onClick={() => navigate("forgot-password")}
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            Forgot password?
          </button>
        </div>
        {serverError ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700" role="alert">
            {serverError}
          </p>
        ) : null}
        <SubmitButton loading={submitting}>Sign in</SubmitButton>
      </form>
    </AuthShell>
  );
}
