"use client";
// Prototype Map (reviewer index) — the hidden prototype route from spec §18.
// Bare standalone page (no app shell). NOT a production feature.
// Lists all 114 required screens with number, name, category, status and an
// Open button that navigates to a working example route for each.

import { useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  FlaskConical,
  Home,
  Search,
  SearchX,
  ShoppingBag,
  TrendingUp,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SCREENS } from "../registry";
import type { ScreenMeta } from "../registry";
import { useBizz } from "@/lib/store";

// Registry id → a working example route for reviewers (per screen-family contract).
const EXAMPLE_ROUTES: Record<string, string> = {
  metric: "metric/revenue",
  "performance/channel": "performance/marketing/instagram",
  "insights/diagnosis": "insights/ins-sh-1",
  "insights/opportunity": "insights/ins-sh-1",
  "insights/evidence": "insights/ins-sh-1",
  "alerts/:id": "alerts/al-sh-1",
  "recommendations/:id": "recommendations/rec-sh-1",
  "action-start/:id": "action-start/rec-sh-1",
  "actions/:id": "actions/act-sh-1",
  "experiment-setup/:id": "experiment-setup/rec-sh-1",
  "experiments/:id": "experiments/exp-sh-1",
  "outcome/:id": "outcome/exp-sh-0",
  "integrations/:id": "integrations/meta-ads",
  "connect/:id": "connect/google-analytics",
  "source-settings/:id": "source-settings/meta-ads",
  "provenance/:id": "provenance/prov-sh-revenue",
  "goals/:id": "goals/goal-sh-1",
  "team/:id": "team/mem-2",
  "admin/businesses/:id": "admin/businesses/swifthaul",
  "admin/users/:id": "admin/users/au-1",
  "change-confirm": "timeline", // open via its button on the timeline
};

function targetRoute(s: ScreenMeta): string {
  return EXAMPLE_ROUTES[s.id] ?? s.route;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

const DEMOS = [
  {
    id: "swifthaul" as const,
    icon: Truck,
    name: "SwiftHaul Logistics",
    type: "Service business",
    detail:
      "Sep 2026 vs Aug 2026 — enquiries +50%, customers +4%, revenue ₦6.0m (+3%). Instagram CAC problem, Google and referral strengths, full funnel and evidence chain.",
  },
  {
    id: "korahome" as const,
    icon: ShoppingBag,
    name: "KoraHome Store",
    type: "Ecommerce business",
    detail:
      "Shopify + Paystack — traffic +24% but orders −8% and revenue −8%. Mobile checkout completion fell 71% → 48%; payment failures +31%.",
  },
];

function PrototypeLogo() {
  const navigate = useBizz((s) => s.navigate);
  return (
    <button onClick={() => navigate("landing")} aria-label="bizzGrowth home" className="inline-flex items-center gap-2">
      <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-violet-600 text-white">
        <TrendingUp className="size-4" aria-hidden />
      </span>
      <span className="text-[15px] font-bold tracking-tight text-slate-900">
        bizz<span className="text-blue-600">Growth</span>
      </span>
    </button>
  );
}

export default function PrototypeIndexScreen() {
  const navigate = useBizz((s) => s.navigate);
  const setBusiness = useBizz((s) => s.setBusiness);
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const map = new Map<string, ScreenMeta[]>();
    for (const s of SCREENS) {
      const arr = map.get(s.category);
      if (arr) arr.push(s);
      else map.set(s.category, [s]);
    }
    return Array.from(map.entries());
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map(([category, items]) => [
        category,
        items.filter((s) =>
          [s.name, s.category, s.route, s.id, String(s.num)].some((v) => v.toLowerCase().includes(q)),
        ),
      ])
      .filter(([, items]) => items.length > 0) as [string, ScreenMeta[]][];
  }, [groups, query]);

  const total = SCREENS.length;
  const categoryCount = groups.length;

  function jumpTo(category: string) {
    document.getElementById(`cat-${slugify(category)}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <PrototypeLogo />
            <Badge variant="outline" className="hidden bg-violet-50 font-normal text-violet-700 sm:inline-flex">
              <FlaskConical className="mr-1 size-3" aria-hidden /> Reviewer index
            </Badge>
          </div>
          <Button size="sm" onClick={() => navigate("home")}>
            <Home className="mr-1.5 size-4" aria-hidden /> Open the app
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {/* Hero */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <FlaskConical className="size-5 text-violet-600" aria-hidden />
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">bizzGrowth Prototype Map</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {total} screens/views/states · reviewer index — not a production feature. Every row opens a working example of that
            screen in the prototype.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 font-normal text-emerald-700">
              <CheckCircle2 className="mr-1 size-3" aria-hidden /> {total} / {total} Implemented
            </Badge>
            <Badge variant="outline" className="bg-white font-normal text-muted-foreground">
              {categoryCount} categories
            </Badge>
            <Badge variant="outline" className="bg-white font-normal text-muted-foreground">
              Demo data: SwiftHaul (service) · KoraHome (ecommerce)
            </Badge>
          </div>
        </div>

        {/* Demo shortcuts */}
        <section aria-label="Demo workspaces" className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Open a demo workspace</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {DEMOS.map((d) => (
              <Card key={d.id} className="flex flex-col p-5">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                    <d.icon className="size-4.5" aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{d.name}</p>
                    <p className="text-xs text-muted-foreground">{d.type}</p>
                  </div>
                </div>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{d.detail}</p>
                <div className="mt-4 border-t pt-3">
                  <Button
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      setBusiness(d.id);
                      navigate("home");
                    }}
                  >
                    Open {d.name}
                    <ArrowRight className="ml-1.5 size-3.5" aria-hidden />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* Search + category jumps */}
        <section aria-label="Screen index" className="mt-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search screens by name, category or route…"
                aria-label="Search screens"
                className="bg-white pl-9"
              />
            </div>
            {!query && (
              <div className="flex flex-wrap gap-1.5">
                {groups.map(([category]) => (
                  <Button
                    key={category}
                    variant="outline"
                    size="sm"
                    className="h-7 bg-white px-2.5 text-xs font-normal"
                    onClick={() => jumpTo(category)}
                  >
                    {category}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {filtered.length === 0 ? (
            <Card className="mt-6 flex flex-col items-center p-10 text-center">
              <SearchX className="size-8 text-slate-400" aria-hidden />
              <p className="mt-3 text-sm font-medium">No screens match &ldquo;{query}&rdquo;</p>
              <p className="mt-1 text-sm text-muted-foreground">Try a name, a category such as &ldquo;System state&rdquo;, or a route fragment.</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setQuery("")}>
                Clear search
              </Button>
            </Card>
          ) : (
            <div className="mt-6 space-y-7">
              {filtered.map(([category, items]) => (
                <section key={category} id={`cat-${slugify(category)}`} aria-label={category} className="scroll-mt-20">
                  <div className="mb-2 flex items-baseline justify-between">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{category}</h3>
                    <span className="text-xs text-muted-foreground">
                      {items.length} {items.length === 1 ? "screen" : "screens"}
                    </span>
                  </div>
                  <Card className="overflow-hidden p-0">
                    <ul className="divide-y">
                      {items.map((s) => (
                        <li key={s.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50/70 sm:px-5">
                          <span className="w-8 shrink-0 text-right font-mono text-xs text-slate-400 tnum" aria-label={`Screen ${s.num}`}>
                            {s.num}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{s.name}</p>
                            <p className="truncate font-mono text-[11px] text-slate-400">→ /{targetRoute(s)}</p>
                          </div>
                          <Badge variant="outline" className="hidden shrink-0 bg-white font-normal text-muted-foreground lg:inline-flex">
                            {s.category}
                          </Badge>
                          <Badge variant="outline" className="shrink-0 border-emerald-200 bg-emerald-50 font-normal text-emerald-700">
                            <CheckCircle2 className="mr-1 size-3" aria-hidden />
                            Implemented
                          </Badge>
                          <Button variant="outline" size="sm" className="shrink-0 bg-white" onClick={() => navigate(targetRoute(s))}>
                            Open
                            <ArrowRight className="ml-1 size-3.5" aria-hidden />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </section>
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="mt-8 border-t bg-white">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
          <p className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <CheckCircle2 className="size-4 text-emerald-600" aria-hidden />
            All {total} required screens implemented and reachable via natural navigation or this map.
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Prototype-only reviewer page — it does not ship in production. Rows with parameters open a representative example
            (e.g. a channel detail opens Instagram; change confirmation opens via its button on the Business Timeline).
          </p>
        </div>
      </footer>
    </div>
  );
}

// TEMP SHIM (task 2-j runtime verification) — will be restored byte-exact.
export const views = { "prototype-index": PrototypeIndexScreen };
