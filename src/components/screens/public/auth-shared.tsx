"use client";
// Shared building blocks for the public auth screens (Screens 3-8).
// Owned by the public screen group only.

import React, { useState } from "react";
import { Eye, EyeOff, Loader2, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { navigate } from "@/lib/router";

/** Email/name entered on the signup screen, read by verify-email. Module-level draft state (prototype only). */
export const pendingSignup: { name: string; email: string } = { name: "", email: "" };

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

export function PublicLogo({ center = false }: { center?: boolean }) {
  return (
    <button
      onClick={() => navigate("landing")}
      aria-label="bizzGrowth home"
      className={cn("inline-flex items-center gap-2", center && "justify-center")}
    >
      <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 text-white">
        <TrendingUp className="size-4.5" aria-hidden />
      </span>
      <span className="text-[15px] font-bold tracking-tight text-slate-900">
        bizz<span className="text-blue-600">Growth</span>
      </span>
    </button>
  );
}

/** Centered auth layout: logo, card, optional footer line. */
export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[72vh] items-start justify-center px-4 py-10 sm:py-14">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <PublicLogo center />
        </div>
        <Card className="p-6 shadow-sm sm:p-8">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
          {description ? <p className="mt-1.5 text-sm text-muted-foreground">{description}</p> : null}
          <div className="mt-6">{children}</div>
        </Card>
        {footer ? <div className="mt-5 text-center text-sm text-muted-foreground">{footer}</div> : null}
      </div>
    </div>
  );
}

/** Labelled field with hint and inline validation error. */
export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? (
        <p className="text-xs font-medium text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Password input with visibility toggle. */
export function PasswordField({
  id,
  label,
  value,
  onChange,
  onBlur,
  autoComplete = "new-password",
  placeholder,
  hint,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  autoComplete?: string;
  placeholder?: string;
  hint?: React.ReactNode;
  error?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <div className="relative">
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-400 hover:text-slate-600"
        >
          {show ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        </button>
      </div>
    </Field>
  );
}

/** Submit button with simulated loading state. */
export function SubmitButton({
  loading,
  children,
  disabled,
}: {
  loading: boolean;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <Button type="submit" className="w-full" disabled={disabled || loading}>
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {loading ? "Please wait…" : children}
    </Button>
  );
}

/** Small prototype note shown under forms. */
export function DemoHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500">
      <span className="font-medium text-slate-600">Prototype note:</span> {children}
    </p>
  );
}
