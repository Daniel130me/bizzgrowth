"use client";
// Shared building blocks for the Specialists marketplace screens.

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Star, BadgeCheck, Clock3, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SpecialistDTO } from "@/lib/market";

// ---------- Categories ----------

export const MARKET_CATEGORIES: { id: string; label: string }[] = [
  { id: "marketing", label: "Marketing & Ads" },
  { id: "sales", label: "Sales & Outreach" },
  { id: "content", label: "Content & Social" },
  { id: "design", label: "Brand & Design" },
  { id: "web", label: "Web & Tech" },
  { id: "ops", label: "Operations" },
  { id: "finance", label: "Finance & Books" },
  { id: "data", label: "Data & Analytics" },
  { id: "people", label: "People & HR" },
  { id: "legal", label: "Legal" },
];

export function categoryLabel(id: string): string {
  return MARKET_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

/** Cheap client-side category guess for prefilling from a recommendation. The owner can always change it. */
export function guessCategory(text: string): string | undefined {
  const t = text.toLowerCase();
  const rules: [RegExp, string][] = [
    [/meta ads|facebook ad|instagram ad|google ad|paid (ads|social|channel)|ad spend|advertis|ppc|campaign/, "marketing"],
    [/seo|organic reach|search ranking|blog|newsletter|content calendar|social media content|copywriting|content/, "content"],
    [/website|landing page|web design|woocommerce|shopify|online store|e-?commerce|checkout|payment (gateway|integration)|site speed/, "web"],
    [/logo|brand|packaging|design|ui|figma|mockup/, "design"],
    [/bookkeep|account|payroll|tax|invoice|financial record|reconcil/, "finance"],
    [/cold (call|email|outreach)|sales script|pipeline|crm|follow[- ]up|convert (leads|enquiries)/, "sales"],
    [/dashboard|kpi|spreadsheet|report|data entry|analytic/, "data"],
    [/delivery|logistics|operations|process|vendor|inventory|supplier/, "ops"],
    [/hiring|recruit|onboard|staff|employee|hr |team member/, "people"],
    [/contract|agreement|legal|compliance|registration|nda|terms/, "legal"],
  ];
  for (const [re, id] of rules) if (re.test(t)) return id;
  return undefined;
}

export const URGENCY_LABEL: Record<string, string> = {
  asap: "ASAP",
  "this-week": "This week",
  flexible: "Flexible",
};

// ---------- Status / meta badges ----------

export function MarketStatusBadge({ status }: { status: string }) {
  if (status === "awarded") return <Badge className="border-transparent bg-emerald-100 text-emerald-800">Awarded</Badge>;
  if (status === "closed") return <Badge variant="outline" className="text-slate-500">Closed</Badge>;
  return <Badge className="border-transparent bg-brand-100 text-brand-800">Open for bids</Badge>;
}

export function RatingInline({ rating, reviews, className }: { rating: number; reviews?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium text-slate-700", className)}>
      <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
      {rating.toFixed(1)}
      {typeof reviews === "number" && <span className="font-normal text-slate-400">({reviews})</span>}
    </span>
  );
}

export function AvailableDot({ available }: { available: string }) {
  const now = available.toLowerCase().includes("now");
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
      <span className={cn("size-1.5 rounded-full", now ? "bg-emerald-500" : "bg-amber-400")} aria-hidden />
      {available}
    </span>
  );
}

// ---------- Specialist visuals ----------

const GRADIENTS = [
  "from-brand-600 to-brand-800",
  "from-emerald-500 to-teal-600",
  "from-rose-500 to-pink-600",
  "from-amber-500 to-orange-600",
  "from-cyan-500 to-sky-600",
  "from-slate-600 to-slate-800",
];

function gradientFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

export function SpecialistAvatar({ id, name, size = "md" }: { id: string; name: string; size?: "md" | "lg" }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("");
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br font-bold text-white",
        gradientFor(id),
        size === "lg" ? "size-16 text-xl" : "size-11 text-sm",
      )}
    >
      {initials}
    </span>
  );
}

/** Compact specialist row used in AI-match lists on the task page. */
export function SpecialistRow({ s, right, onClick }: { s: SpecialistDTO; right?: React.ReactNode; onClick?: () => void }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-xl border p-3.5",
        onClick && "cursor-pointer bg-white transition-colors hover:border-slate-300 hover:bg-slate-50",
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <SpecialistAvatar id={s.id} name={s.name} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <span className="truncate">{s.name}</span>
          {s.verified && <BadgeCheck className="size-4 shrink-0 text-emerald-600" aria-label="Verified specialist" />}
        </p>
        <p className="truncate text-xs text-muted-foreground">{s.headline}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <RatingInline rating={s.rating} reviews={s.reviews} />
          <span className="tnum">₦{s.hourlyRate.toLocaleString("en-NG")}/hr</span>
          <span className="inline-flex items-center gap-1">
            <MapPin className="size-3" aria-hidden /> {s.location}
          </span>
        </div>
      </div>
      {right}
    </div>
  );
}

export function ResponseHint({ responseTime }: { responseTime: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
      <Clock3 className="size-3" aria-hidden /> Replies {responseTime.toLowerCase()}
    </span>
  );
}
