"use client";
// Local building blocks for the Business Brain group (Screens 71–76).

import React from "react";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useBizz } from "@/lib/store";
import type { BusinessType } from "@/lib/types";

// ---------- Shell ----------

export function BrainBackLink() {
  const navigate = useBizz((s) => s.navigate);
  return (
    <Button variant="ghost" size="sm" className="-ml-2 mb-3 text-muted-foreground" onClick={() => navigate("brain")}>
      <ArrowLeft className="size-4" aria-hidden /> Business Brain
    </Button>
  );
}

export function ConfigShell({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <BrainBackLink />
      <h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
      <div className="mt-6 space-y-5">{children}</div>
    </div>
  );
}

export function SaveRow({ onSave, label = "Save changes", note }: { onSave: () => void; label?: string; note?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-slate-50/70 p-4">
      <Button
        onClick={() => {
          onSave();
        }}
      >
        <Save className="size-4" aria-hidden /> {label}
      </Button>
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}

/** Convenience toast for configuration saves. */
export function savedToast(message: string, description?: string) {
  toast.success(message, description ? { description } : undefined);
}

// ---------- Channel defaults (shared by overview count + channels screen) ----------

export interface ChannelDef {
  name: string;
  tracked: boolean;
}

export interface ChannelSection {
  title: string;
  description: string;
  channels: ChannelDef[];
}

const SERVICE_SECTIONS: ChannelSection[] = [
  {
    title: "Customer acquisition channels",
    description: "Where new customers discover you.",
    channels: [
      { name: "Instagram", tracked: true },
      { name: "Google Search", tracked: true },
      { name: "Referral", tracked: true },
      { name: "Walk-in", tracked: false },
    ],
  },
  {
    title: "Sales channels",
    description: "How enquiries become paying customers.",
    channels: [
      { name: "Website", tracked: false },
      { name: "WhatsApp", tracked: true },
      { name: "Phone", tracked: true },
    ],
  },
  {
    title: "Marketing channels",
    description: "Where you actively promote the business.",
    channels: [
      { name: "Instagram", tracked: true },
      { name: "Google Search", tracked: true },
      { name: "Email", tracked: false },
    ],
  },
  {
    title: "Communication channels",
    description: "How customers reach and talk to you.",
    channels: [
      { name: "WhatsApp", tracked: true },
      { name: "Phone", tracked: false },
      { name: "Email", tracked: false },
    ],
  },
];

const ECOMMERCE_SECTIONS: ChannelSection[] = [
  {
    title: "Customer acquisition channels",
    description: "Where new customers discover you.",
    channels: [
      { name: "Instagram Ads", tracked: true },
      { name: "Google Search", tracked: true },
      { name: "Organic social", tracked: true },
      { name: "Direct / repeat", tracked: true },
    ],
  },
  {
    title: "Sales channels",
    description: "How visitors become paying customers.",
    channels: [
      { name: "Website (Shopify)", tracked: true },
      { name: "WhatsApp", tracked: false },
    ],
  },
  {
    title: "Marketing channels",
    description: "Where you actively promote the store.",
    channels: [
      { name: "Instagram", tracked: true },
      { name: "Google Search", tracked: true },
      { name: "Email", tracked: false },
    ],
  },
  {
    title: "Communication channels",
    description: "How customers reach and talk to you.",
    channels: [
      { name: "WhatsApp", tracked: true },
      { name: "Email", tracked: true },
      { name: "Phone", tracked: false },
    ],
  },
];

export function channelSectionsFor(type: BusinessType): ChannelSection[] {
  return type === "ecommerce" ? ECOMMERCE_SECTIONS : SERVICE_SECTIONS;
}

export function trackedChannelCount(type: BusinessType): { tracked: number; total: number } {
  const sections = channelSectionsFor(type);
  const channels = sections.flatMap((s) => s.channels);
  return { tracked: channels.filter((c) => c.tracked).length, total: channels.length };
}

// ---------- Priority defaults ----------

export const PRIORITY_OPTIONS = [
  "Acquire more customers",
  "Improve conversion",
  "Increase sales",
  "Improve profitability",
  "Improve retention",
] as const;

export function defaultRankingFor(type: BusinessType): string[] {
  if (type === "ecommerce") {
    // KoraHome: checkout conversion is the immediate constraint.
    return ["Improve conversion", "Increase sales", "Acquire more customers", "Improve retention", "Improve profitability"];
  }
  // SwiftHaul: customer growth on efficient channels is the primary objective.
  return ["Acquire more customers", "Improve conversion", "Increase sales", "Improve profitability", "Improve retention"];
}
