"use client";
// Screen 3 — Create Account.

import React, { useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { useBizz } from "@/lib/store";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { AuthShell, DemoHint, Field, PasswordField, SubmitButton, isEmail, pendingSignup } from "./auth-shared";

type Errors = { name: string; email: string; password: string; agreed: string };
type Touched = { name?: boolean; email?: boolean; password?: boolean; agreed?: boolean };

export default function SignupScreen() {
  const navigate = useBizz((s) => s.navigate);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [touched, setTouched] = useState<Touched>({});

  const errors: Errors = {
    name: name.trim().length >= 2 ? "" : "Enter your full name.",
    email: isEmail(email) ? "" : "Enter a valid email address.",
    password: password.length >= 8 ? "" : "Password must be at least 8 characters.",
    agreed: agreed ? "" : "Please agree to the terms to continue.",
  };
  const valid = !errors.name && !errors.email && !errors.password && !errors.agreed;
  const showErr = (k: keyof Errors) => (touched[k] ? errors[k] : "");
  const blur = (k: keyof Touched) => () => setTouched((t) => ({ ...t, [k]: true }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ name: true, email: true, password: true, agreed: true });
    if (!valid) {
      toast.error("Check the highlighted fields", {
        description: "A couple of details need attention before we can continue.",
      });
      return;
    }
    setSubmitting(true);
    window.setTimeout(() => {
      const cleanName = name.trim();
      const cleanEmail = email.trim().toLowerCase();
      pendingSignup.name = cleanName;
      pendingSignup.email = cleanEmail;
      // Make name/email available to onboarding screens (prototype state only).
      useBizz.setState({ user: { ...useBizz.getState().user, name: cleanName, email: cleanEmail } });
      setSubmitting(false);
      toast.success("Account created", { description: `We sent a verification link to ${cleanEmail}.` });
      navigate("verify-email");
    }, 900);
  }

  return (
    <AuthShell
      title="Create your account"
      description="Start with a private business checkup — no integrations required."
      footer={
        <>
          Already have an account?{" "}
          <button
            onClick={() => navigate("signin")}
            className="font-medium text-blue-700 underline-offset-2 hover:underline"
          >
            Sign in
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <Field id="name" label="Full name" error={showErr("name")}>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={blur("name")}
            autoComplete="name"
            placeholder="Amara Okafor"
            aria-invalid={Boolean(showErr("name"))}
          />
        </Field>
        <Field id="email" label="Work email" error={showErr("email")}>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={blur("email")}
            autoComplete="email"
            placeholder="you@yourbusiness.ng"
            aria-invalid={Boolean(showErr("email"))}
          />
        </Field>
        <PasswordField
          id="password"
          label="Password"
          value={password}
          onChange={setPassword}
          onBlur={blur("password")}
          autoComplete="new-password"
          error={showErr("password")}
          hint={
            password.length >= 8 ? (
              <span className="inline-flex items-center gap-1 text-emerald-600">
                <Check className="size-3" aria-hidden />
                8+ characters
              </span>
            ) : (
              "At least 8 characters."
            )
          }
        />
        <div className="space-y-1.5" onBlur={blur("agreed")}>
          <div className="flex items-start gap-2.5">
            <Checkbox
              id="agree"
              checked={agreed}
              onCheckedChange={(v) => {
                setAgreed(v === true);
                setTouched((t) => ({ ...t, agreed: true }));
              }}
              className="mt-0.5"
              aria-invalid={Boolean(showErr("agreed"))}
            />
            <p className="text-sm leading-relaxed text-slate-600">
              <label htmlFor="agree" className="cursor-pointer">
                I agree to the
              </label>{" "}
              <button
                type="button"
                className="font-medium text-blue-700 underline underline-offset-2 hover:text-blue-800"
                onClick={() => navigate("terms")}
              >
                Terms of Service
              </button>{" "}
              and{" "}
              <button
                type="button"
                className="font-medium text-blue-700 underline underline-offset-2 hover:text-blue-800"
                onClick={() => navigate("privacy-policy")}
              >
                Privacy Policy
              </button>
              .
            </p>
          </div>
          {showErr("agreed") ? (
            <p className="text-xs font-medium text-red-600" role="alert">
              {errors.agreed}
            </p>
          ) : null}
        </div>
        <SubmitButton loading={submitting} disabled={!valid}>
          Create account
        </SubmitButton>
      </form>
      <div className="mt-4">
        <DemoHint>
          This is a clickable prototype — no real account is created and nothing leaves your browser.
        </DemoHint>
      </div>
    </AuthShell>
  );
}
