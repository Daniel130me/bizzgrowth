"use client";
// Screen 5 — Sign In.

import React, { useState } from "react";
import { toast } from "sonner";
import { useBizz } from "@/lib/store";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthShell, DemoHint, Field, PasswordField, SubmitButton, isEmail } from "./auth-shared";

export default function SigninScreen() {
  const navigate = useBizz((s) => s.navigate);
  const setAuthUser = useBizz((s) => s.setAuthUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});

  const emailError = isEmail(email) ? "" : "Enter a valid email address.";
  const passwordError = password.length >= 8 ? "" : "Password must be at least 8 characters.";
  const valid = !emailError && !passwordError;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (!valid) return;
    setSubmitting(true);
    window.setTimeout(() => {
      const cleanEmail = email.trim().toLowerCase();
      // Keep the name they signed up with (already in the store); if this is a
      // fresh sign-in, derive a display name from the email — never a sample identity.
      const current = useBizz.getState().user;
      const isSampleIdentity = current.email === "amara@swifthaul.ng";
      const derived = cleanEmail
        .split("@")[0]
        .split(/[._-]/)[0]
        .replace(/[^a-zA-Z]/g, "");
      const displayName = isSampleIdentity && derived
        ? derived.charAt(0).toUpperCase() + derived.slice(1)
        : current.name;
      setAuthUser(displayName || current.name, cleanEmail);
      setSubmitting(false);
      toast.success("Signed in", { description: "Continuing where you left off." });
      navigate("welcome");
    }, 900);
  }

  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to your bizzGrowth workspace."
      footer={
        <>
          New to bizzGrowth?{" "}
          <button
            onClick={() => navigate("signup")}
            className="font-medium text-blue-700 underline-offset-2 hover:underline"
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
            className="text-sm font-medium text-blue-700 hover:underline"
          >
            Forgot password?
          </button>
        </div>
        <SubmitButton loading={submitting}>Sign in</SubmitButton>
      </form>
      <div className="mt-4">
        <DemoHint>
          Demo: this prototype signs in and enters setup. In production, new users continue setup while existing users
          land directly on Home.
        </DemoHint>
      </div>
    </AuthShell>
  );
}
