"use client";
// Screen 11 — Welcome / Choose How to Start.
// The first meaningful product screen after account entry.

import React from "react";
import { ArrowRight, Building2, CheckCircle2, Clock, RefreshCcw, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useBizz } from "@/lib/store";
import type { ScreenProps } from "../view-types";
import { openSampleBusiness, TrustRow } from "./parts";

function OptionCard({
  icon: Icon,
  iconCls,
  title,
  body,
  badge,
  onClick,
}: {
  icon: React.ElementType;
  iconCls: string;
  title: string;
  body: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <Card
      role="button"
      tabIndex={0}
      aria-label={title}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className="cursor-pointer p-0 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      <div className="flex items-start gap-4 p-5">
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${iconCls}`}>
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">{title}</h2>
            {badge ? <Badge className="bg-blue-600 font-normal text-white hover:bg-blue-600">{badge}</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{body}</p>
        </div>
        <ArrowRight className="mt-1 size-4 shrink-0 text-slate-400" aria-hidden />
      </div>
    </Card>
  );
}

export default function Welcome(_props: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const userName = useBizz((s) => s.user.name);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Welcome, {userName.split(" ")[0]}</p>
        <h1 className="mt-1.5 text-3xl font-bold tracking-tight">How would you like to start?</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          You can change course at any time. Nothing you do here is shared, and you can connect accounts later.
        </p>
      </div>

      <div className="space-y-3">
        <OptionCard
          icon={Building2}
          iconCls="bg-blue-600 text-white"
          title="Start my private business checkup"
          body="Answer a few questions. No integrations required."
          badge="Recommended"
          onClick={() => navigate(userWorkspace ? "checkup-intro" : "create-workspace")}
        />
        <OptionCard
          icon={ArrowRight}
          iconCls="bg-slate-100 text-slate-600"
          title="Explore a sample business"
          body="Instantly open the complete SwiftHaul demo experience."
          onClick={openSampleBusiness}
        />
        {userWorkspace ? (
          <OptionCard
            icon={RefreshCcw}
            iconCls="bg-violet-100 text-violet-700"
            title="Resume setup"
            body={`Continue where you left off — the checkup for ${userWorkspace.name}.`}
            onClick={() => navigate("checkup-intro")}
          />
        ) : null}
      </div>

      <div className="mt-8 space-y-4">
        <TrustRow />
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <ShieldCheck className="size-4 text-emerald-600" aria-hidden />
            How the private checkup works
          </h3>
          <ol className="mt-2 space-y-1.5 text-xs text-muted-foreground">
            <li className="flex items-start gap-1.5">
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-hidden />
              Today: you answer a few questions in plain language. Exact figures are optional — estimates are fine.
            </li>
            <li className="flex items-start gap-1.5">
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-hidden />
              Later: connect ad and sales sources when you are ready. Read-only, always.
            </li>
            <li className="flex items-start gap-1.5">
              <Clock className="mt-0.5 size-3.5 shrink-0 text-blue-600" aria-hidden />
              It takes a few minutes. Answers stay private to your workspace.
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
