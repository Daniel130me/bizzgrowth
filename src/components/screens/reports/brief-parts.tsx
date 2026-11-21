"use client";
// Shared document-style building blocks for the brief screens (68–69):
// metric chips with goodness colours, accent sections with CTA links,
// executive-summary chips parsed from dataset bullet strings.

import React from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, CheckCircle2, Info, Lightbulb, Minus, ShieldAlert, Sparkles, XCircle } from "lucide-react";
import type { Brief, BriefSection, Goodness } from "@/lib/types";
import { goodnessFor } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useBizz } from "@/lib/store";
import { toast } from "sonner";
import { TryThisBox } from "@/components/shared/try-this";

// ---------- Goodness styling ----------

const GOODNESS_CLS: Record<Goodness, string> = {
  good: "border-emerald-200 bg-emerald-50 text-emerald-800",
  bad: "border-red-200 bg-red-50 text-red-800",
  neutral: "border-slate-200 bg-slate-50 text-slate-700",
};

function DirectionIcon({ text, goodness }: { text: string; goodness: Goodness }) {
  const up = text.includes("+");
  const down = text.includes("−") || text.includes("-");
  const Icon = up ? ArrowUpRight : down ? ArrowDownRight : goodness === "neutral" ? Minus : ArrowRight;
  return <Icon className="size-3.5 shrink-0" aria-hidden />;
}

// ---------- "This week" metric chips ----------

export function BriefMetricChip({ label, value, note, goodness }: { label: string; value: string; note?: string; goodness: Goodness }) {
  return (
    <div className={cn("rounded-xl border p-4", GOODNESS_CLS[goodness])}>
      <p className="text-xs font-medium opacity-80">{label}</p>
      <p className="mt-1 text-xl font-semibold tnum">{value}</p>
      {note ? (
        <p className="mt-1 flex items-center gap-1 text-xs tnum">
          <DirectionIcon text={note} goodness={goodness} />
          {note}
        </p>
      ) : null}
    </div>
  );
}

// ---------- Executive summary chips (parsed from bullet strings) ----------

export interface ParsedMetric {
  label: string;
  value: string;
  delta: string;
  goodness: Goodness;
}

const METRIC_KEYWORDS: [string, string][] = [
  ["customer", "customers"],
  ["enquir", "enquiries"],
  ["order", "orders"],
  ["traffic", "traffic"],
  ["spend", "spend"],
  ["cac", "cac"],
  ["revenue", "revenue"],
];

/** Parse "Revenue ₦6.0m (+3%)" into label / value / delta with goodness. */
export function parseMetricBullet(raw: string): ParsedMetric | null {
  const m = raw.match(/^(.+?)\s+([₦]?[\d.,]+(?:m|k)?%?)\s*\(([+−-][\d.,]+%?)\)$/);
  if (!m) return null;
  const label = m[1].trim();
  const value = m[2];
  const delta = m[3].replace("-", "−");
  const dir: "up" | "down" = delta.includes("+") ? "up" : "down";
  const l = label.toLowerCase();
  const hit = METRIC_KEYWORDS.find(([k]) => l.includes(k));
  return { label, value, delta, goodness: hit ? goodnessFor(hit[1], dir) : "neutral" };
}

export function ExecMetricChip({ metric }: { metric: ParsedMetric }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm", GOODNESS_CLS[metric.goodness])}>
      <span className="font-medium">{metric.label}</span>
      <span className="font-semibold tnum">{metric.value}</span>
      <span className="inline-flex items-center tnum">
        <DirectionIcon text={metric.delta} goodness={metric.goodness} />
        {metric.delta}
      </span>
    </span>
  );
}

// ---------- Accent sections with CTA links ----------

type CtaRoute = "goals" | "experiments/exp-sh-1" | "experiments/exp-kh-1" | "performance/marketing" | "performance/website" | "diagnosis" | "diagnosis/what-to-do" | "ask";

function ctaFor(heading: string, businessId: string): { label: string; route: CtaRoute } | null {
  const h = heading.toLowerCase();
  // The owner's own brief links to THEIR diagnosis, plan and Ask page — never to a sample business.
  if (businessId === "user-workspace") {
    if (h.startsWith("pay attention")) return { label: "Open my diagnosis", route: "diagnosis" };
    if (h.startsWith("opportunity")) return { label: "Ask about this opportunity", route: "ask" };
    if (h.startsWith("recommended action")) return { label: "Open my plan", route: "diagnosis/what-to-do" };
    if (h.startsWith("goal progress")) return { label: "View goals", route: "goals" };
    return null;
  }
  const isKora = businessId === "korahome";
  if (h.startsWith("pay attention")) return { label: isKora ? "Open website performance" : "Open marketing performance", route: isKora ? "performance/website" : "performance/marketing" };
  if (h.startsWith("opportunity")) return { label: "Open marketing performance", route: "performance/marketing" };
  if (h.startsWith("recommended action")) return { label: isKora ? "View the running experiment" : "View the running experiment", route: isKora ? "experiments/exp-kh-1" : "experiments/exp-sh-1" };
  if (h.startsWith("goal progress")) return { label: "View goals", route: "goals" };
  return null;
}

const ACCENTS: Record<string, { border: string; bg: string; text: string; icon: React.ReactNode }> = {
  attention: { border: "border-l-amber-500", bg: "bg-amber-50/60", text: "text-amber-700", icon: <Info className="size-4" aria-hidden /> },
  opportunity: { border: "border-l-amber-500", bg: "bg-amber-50/60", text: "text-amber-700", icon: <Lightbulb className="size-4" aria-hidden /> },
  action: { border: "border-l-brand-600", bg: "bg-brand-50/50", text: "text-brand-700", icon: <CheckCircle2 className="size-4" aria-hidden /> },
  goal: { border: "border-l-emerald-500", bg: "bg-emerald-50/50", text: "text-emerald-700", icon: <ArrowRight className="size-4" aria-hidden /> },
};

function accentFor(heading: string) {
  const h = heading.toLowerCase();
  if (h.startsWith("pay attention")) return ACCENTS.attention;
  if (h.startsWith("opportunity")) return ACCENTS.opportunity;
  if (h.startsWith("recommended action")) return ACCENTS.action;
  if (h.startsWith("goal progress") || h.startsWith("what's working") || h.startsWith("what is working")) return ACCENTS.goal;
  return null;
}

export function BriefSectionBlock({ section, businessId }: { section: BriefSection; businessId: string }) {
  const accent = accentFor(section.heading);
  const cta = ctaFor(section.heading, businessId);
  const navigate = useBizz((s) => s.navigate);
  // The week's ready-to-send message: one tap to copy or open in WhatsApp.
  if (/^something to send/i.test(section.heading) && section.paragraphs?.[0]) {
    return <TryThisBox label={section.heading} title="Ready to send — tweak a word or two first" body={section.paragraphs.join("\n\n")} />;
  }
  const body = (
    <>
      {section.paragraphs?.map((p, i) => (
        <p key={i} className="text-[15px] leading-7 text-slate-700">
          {p}
        </p>
      ))}
      {section.bullets ? (
        <ul className="space-y-1.5">
          {section.bullets.map((b, i) => (
            <li key={i} className="text-[15px] leading-7 text-slate-700">
              · {b}
            </li>
          ))}
        </ul>
      ) : null}
      {cta ? (
        <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate(cta.route)}>
          {cta.label} <ArrowRight className="size-3.5" aria-hidden />
        </Button>
      ) : null}
    </>
  );

  if (!accent) {
    return (
      <section className="border-t pt-6">
        <h2 className="text-base font-semibold">{section.heading}</h2>
        <div className="mt-3 space-y-3">{body}</div>
      </section>
    );
  }
  return (
    <section className={cn("rounded-xl border border-l-4 p-5", accent.border, accent.bg)}>
      <h2 className={cn("flex items-center gap-1.5 text-base font-semibold", accent.text)}>
        {accent.icon}
        {section.heading}
      </h2>
      <div className="mt-3 space-y-3">{body}</div>
    </section>
  );
}

// ---------- Document shell ----------

export function BriefDocShell({
  brief,
  businessName,
  generated,
  shareable,
  children,
}: {
  brief: Brief;
  businessName: string;
  generated: string;
  shareable?: boolean;
  children: React.ReactNode;
}) {
  const navigate = useBizz((s) => s.navigate);
  return (
    <div className="mx-auto w-full max-w-3xl">
      <Button variant="ghost" size="sm" className="-ml-2 mb-3 text-muted-foreground" onClick={() => navigate("reports")}>
        <ArrowRight className="size-4 rotate-180" aria-hidden /> Reports archive
      </Button>

      <article aria-label={`${brief.title} — ${brief.period}`}>
        <header className="border-b-2 border-slate-900 pb-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">{brief.kind === "weekly" ? "Weekly brief" : "Monthly review"}</p>
              <h1 className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">{businessName}</h1>
              <p className="mt-1 text-sm text-muted-foreground tnum">
                {brief.title} · {brief.period}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => toast.success("PDF export simulated in prototype", { description: "In production this downloads a branded PDF of the brief." })}
              >
                Export PDF
              </Button>
              {shareable ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toast.success("Share link simulated in prototype", { description: "In production this copies a read-only link to the brief." })}
                >
                  Share
                </Button>
              ) : null}
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Generated {generated} · Prepared by Nellovia from connected and manually entered data.
          </p>
        </header>
        <div className="space-y-6 pt-6">{children}</div>
        <footer className="mt-8 border-t pt-4 text-xs leading-6 text-muted-foreground">
          Figures come from measured sources and manual entries recorded in the workspace. Interpretations are labelled as AI interpretation and
          highlight possible paths, not guarantees.
        </footer>
      </article>
    </div>
  );
}

// ---------- Named accent cards for the monthly review ----------

export function OpportunityCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-5">
      <h2 className="flex items-center gap-1.5 text-base font-semibold text-emerald-800">
        <Lightbulb className="size-4" aria-hidden /> Biggest opportunity
      </h2>
      <p className="mt-3 text-[15px] leading-7 text-slate-700">{children}</p>
    </div>
  );
}

export function RiskCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50/60 p-5">
      <h2 className="flex items-center gap-1.5 text-base font-semibold text-red-800">
        <ShieldAlert className="size-4" aria-hidden /> Biggest risk
      </h2>
      <p className="mt-3 text-[15px] leading-7 text-slate-700">{children}</p>
    </div>
  );
}

export function ExplanationsCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-5">
      <h2 className="flex items-center gap-1.5 text-base font-semibold text-brand-800">
        <Sparkles className="size-4" aria-hidden /> Likely explanations
      </h2>
      <p className="mt-3 text-[15px] leading-7 text-slate-700">{children}</p>
      <p className="mt-3 text-xs text-brand-700">AI interpretation — hypotheses to verify, not measured conclusions.</p>
    </div>
  );
}

export function WorkedDidNotGrid({ worked, didNot }: { worked: BriefSection; didNot: BriefSection }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5">
        <h2 className="flex items-center gap-1.5 text-base font-semibold text-emerald-800">
          <CheckCircle2 className="size-4" aria-hidden /> {worked.heading}
        </h2>
        <ul className="mt-3 space-y-1.5">
          {(worked.bullets ?? []).map((b, i) => (
            <li key={i} className="text-[15px] leading-7 text-slate-700">
              · {b}
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-xl border border-red-200 bg-red-50/50 p-5">
        <h2 className="flex items-center gap-1.5 text-base font-semibold text-red-800">
          <XCircle className="size-4" aria-hidden /> {didNot.heading}
        </h2>
        <ul className="mt-3 space-y-1.5">
          {(didNot.bullets ?? []).map((b, i) => (
            <li key={i} className="text-[15px] leading-7 text-slate-700">
              · {b}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
