"use client";
// Local parts shared by the onboarding screens (11–20).
// Kept inside this group on purpose — nothing here is reused outside onboarding.

import React from "react";
import { Calculator, Link2, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBizz } from "@/lib/store";
import { cn } from "@/lib/utils";

/** Switch to the SwiftHaul demo workspace and enter the product. */
export function openSampleBusiness() {
  const { setBusiness, navigate } = useBizz.getState();
  setBusiness("swifthaul");
  navigate("home");
}

export function ScreenIntro({
  eyebrow,
  title,
  sub,
  className,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-6", className)}>
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">{eyebrow}</p>
      <h1 className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
      {sub ? <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">{sub}</p> : null}
    </div>
  );
}

/** The trust proposition — visible on every setup screen. */
export function TrustRow({ className }: { className?: string }) {
  const items = [
    { icon: ShieldCheck, text: "Private to your workspace — nothing is shared" },
    { icon: Calculator, text: "Exact figures optional — estimates are fine" },
    { icon: Link2, text: "You can connect accounts later" },
  ];
  return (
    <ul
      aria-label="Privacy and trust"
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-slate-200 bg-white/70 px-4 py-3 text-xs text-slate-600 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5",
        className,
      )}
    >
      {items.map((it) => (
        <li key={it.text} className="flex items-center gap-1.5">
          <it.icon className="size-3.5 shrink-0 text-emerald-600" aria-hidden />
          {it.text}
        </li>
      ))}
    </ul>
  );
}

export function DemoBusinessButton({ className, label = "Use sample business" }: { className?: string; label?: string }) {
  return (
    <Button type="button" variant="outline" className={className} onClick={openSampleBusiness}>
      <Sparkles className="size-4 text-brand-600" aria-hidden />
      {label}
    </Button>
  );
}
