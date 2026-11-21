"use client";
// Specialists marketplace home — route "market".
//
// Tab 1 is the supply side: a Fiverr-style showcase of the vetted specialist
// roster, fetched once and filtered client-side on purpose (the roster is
// small). Tab 2 lists the owner's posted tasks with their live bid counts.
// All data comes from the real API — when it cannot be reached the screen
// says so honestly instead of showing a fabricated roster.

import { useEffect, useMemo, useState } from "react";
import { BadgeCheck, Briefcase, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InfoBanner, PageHeader } from "@/components/shared/layout";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { useBizz } from "@/lib/store";
import { fmtDate, fmtNaira } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { SpecialistDTO, TaskDTO } from "@/lib/market";
import {
  MARKET_CATEGORIES,
  URGENCY_LABEL,
  AvailableDot,
  MarketStatusBadge,
  RatingInline,
  SpecialistAvatar,
  categoryLabel,
} from "./parts";
import type { ScreenProps } from "../view-types";

// ---------- Showcase card ----------

function SpecialistCard({ s, onOpen }: { s: SpecialistDTO; onOpen: () => void }) {
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      aria-label={`View profile: ${s.name}`}
      className="cursor-pointer gap-0 p-5 transition hover:border-slate-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-2">
        <SpecialistAvatar id={s.id} name={s.name} size="lg" />
        <div className="flex flex-col items-end gap-1.5">
          <RatingInline rating={s.rating} reviews={s.reviews} />
          {s.badges.length > 0 ? (
            <div className="flex flex-wrap justify-end gap-1">
              {s.badges.map((b) => (
                <Badge key={b} className="border-transparent bg-brand-50 text-[11px] font-normal text-brand-700">
                  {b}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <p className="mt-3 flex items-center gap-1.5">
        <span className="font-semibold">{s.name}</span>
        {s.verified ? <BadgeCheck className="size-4 text-emerald-600" aria-label="Verified specialist" /> : null}
      </p>
      <p className="mt-1 line-clamp-2 text-sm text-slate-600">{s.headline}</p>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {s.skills.slice(0, 3).map((skill) => (
          <Badge key={skill} variant="outline" className="text-[11px] font-normal">
            {skill}
          </Badge>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3">
        <span className="text-sm font-semibold tnum">₦{s.hourlyRate.toLocaleString("en-NG")}/hr</span>
        <AvailableDot available={s.available} />
      </div>
    </Card>
  );
}

// ---------- Task row (your tasks) ----------

function TaskRow({ t, onOpen }: { t: TaskDTO; onOpen: () => void }) {
  const budgetLabel =
    t.budgetMin !== null && t.budgetMax !== null
      ? `${fmtNaira(t.budgetMin, { compact: true })}–${fmtNaira(t.budgetMax, { compact: true })}`
      : t.budgetMin !== null
        ? `From ${fmtNaira(t.budgetMin, { compact: true })}`
        : t.budgetMax !== null
          ? `Up to ${fmtNaira(t.budgetMax, { compact: true })}`
          : null;

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      aria-label={`Open task: ${t.title}`}
      className="cursor-pointer gap-0 p-4 transition hover:border-slate-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <span className="truncate">{t.title}</span>
            {t.source === "recommendation" ? (
              <Badge variant="outline" className="border-brand-200 bg-brand-50 text-[10px] font-normal text-brand-700">
                From your intelligence
              </Badge>
            ) : null}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span>{categoryLabel(t.category)}</span>
            <span aria-hidden>·</span>
            <span>{URGENCY_LABEL[t.urgency] ?? t.urgency}</span>
            <span aria-hidden>·</span>
            <span>Posted {fmtDate(t.createdAt)}</span>
            <span aria-hidden>·</span>
            <span>
              {t.bidsCount} {t.bidsCount === 1 ? "bid" : "bids"}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <MarketStatusBadge status={t.status} />
          {budgetLabel ? <span className="text-xs font-medium text-slate-600 tnum">{budgetLabel}</span> : null}
        </div>
      </div>
    </Card>
  );
}

// ---------- Screen ----------

export function MarketHome({ params }: ScreenProps) {
  void params;
  const navigate = useBizz((s) => s.navigate);

  // ---- Roster: fetched once on mount, then filtered client-side ----
  const [specialists, setSpecialists] = useState<SpecialistDTO[] | null>(null);
  const [rosterLoading, setRosterLoading] = useState(true);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [rosterReload, setRosterReload] = useState(0);

  useEffect(() => {
    async function load() {
      setRosterLoading(true);
      setRosterError(null);
      try {
        const res = await fetch("/api/market/specialists?pageSize=50");
        const data = (await res.json()) as { ok?: boolean; specialists?: SpecialistDTO[]; error?: string };
        if (!data?.ok || !Array.isArray(data.specialists)) {
          throw new Error(data?.error ?? "Could not load the specialist roster.");
        }
        setSpecialists(data.specialists);
      } catch (err) {
        setRosterError(err instanceof Error ? err.message : "Could not load the specialist roster.");
      } finally {
        setRosterLoading(false);
      }
    }
    void load();
  }, [rosterReload]);

  // ---- Search + category filter (client-side: the roster is small) ----
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  const filtered = useMemo(() => {
    if (!specialists) return [];
    const q = query.trim().toLowerCase();
    return specialists.filter((s) => {
      if (category !== "all" && s.category !== category) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.headline.toLowerCase().includes(q) ||
        s.skills.some((skill) => skill.toLowerCase().includes(q))
      );
    });
  }, [specialists, query, category]);

  // ---- Your tasks: fetched the first time the tab is opened ----
  const [tab, setTab] = useState("specialists");
  const [tasks, setTasks] = useState<TaskDTO[] | null>(null);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);
  const [tasksLoaded, setTasksLoaded] = useState(false);
  const [tasksReload, setTasksReload] = useState(0);

  useEffect(() => {
    if (!tasksLoaded) return;
    async function load() {
      setTasksLoading(true);
      setTasksError(null);
      try {
        const res = await fetch("/api/market/tasks");
        const data = (await res.json()) as { ok?: boolean; tasks?: TaskDTO[]; error?: string };
        if (!data?.ok || !Array.isArray(data.tasks)) {
          throw new Error(data?.error ?? "Could not load your tasks.");
        }
        setTasks(data.tasks);
      } catch (err) {
        setTasksError(err instanceof Error ? err.message : "Could not load your tasks.");
      } finally {
        setTasksLoading(false);
      }
    }
    void load();
  }, [tasksLoaded, tasksReload]);

  const sortedTasks = useMemo(
    () => (tasks ?? []).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [tasks],
  );

  function handleTabChange(value: string) {
    setTab(value);
    if (value === "tasks" && !tasksLoaded) {
      setTasksLoaded(true);
      setTasksLoading(true);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title="Specialists marketplace"
        description="When your business intelligence recommends work you cannot execute yourself, hire a vetted human here — matched to the task, bidding for the job."
        actions={
          <Button onClick={() => navigate("market/post")}>
            <Plus className="mr-1.5 size-4" aria-hidden /> Post a task
          </Button>
        }
      />

      <InfoBanner tone="info" title="Two ways to hire">
        Browse the showcase and invite someone directly, or post a task and let matched specialists bid for it. Awards
        happen only when you accept a bid.
      </InfoBanner>

      <Tabs value={tab} onValueChange={handleTabChange} className="mt-5 space-y-5">
        <TabsList>
          <TabsTrigger value="specialists">Find specialists</TabsTrigger>
          <TabsTrigger value="tasks">Your tasks</TabsTrigger>
        </TabsList>

        {/* TAB 1 — Fiverr-style showcase */}
        <TabsContent value="specialists" className="space-y-4">
          <div className="space-y-3">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <label htmlFor="market-search" className="sr-only">
                Search specialists
              </label>
              <Input
                id="market-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search skills, names or expertise…"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter specialists by category">
              {[{ id: "all", label: "All" }, ...MARKET_CATEGORIES].map((c) => {
                const active = category === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.id)}
                    aria-pressed={active}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                      active
                        ? "border border-transparent bg-slate-900 text-white"
                        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          {rosterLoading ? (
            <LoadingState label="Loading specialists" />
          ) : rosterError ? (
            <ErrorState
              title="Roster unavailable"
              description="Could not load the specialist roster."
              onRetry={() => setRosterReload((n) => n + 1)}
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Search className="size-5" />}
              title="No specialists match"
              description="Try a different search term or category — the roster covers marketing, sales, content, design, web, ops, finance, data, people and legal."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((s) => (
                <SpecialistCard key={s.id} s={s} onOpen={() => navigate(`market/specialist/${s.id}`)} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* TAB 2 — your posted tasks */}
        <TabsContent value="tasks">
          {tasksLoading ? (
            <LoadingState label="Loading your tasks" />
          ) : tasksError ? (
            <ErrorState
              title="Tasks unavailable"
              description="Could not load your posted tasks."
              onRetry={() => setTasksReload((n) => n + 1)}
            />
          ) : sortedTasks.length === 0 ? (
            <EmptyState
              icon={<Briefcase className="size-5" />}
              title="No tasks posted yet"
              description="When the intelligence recommends work you cannot execute, post it here and vetted specialists will bid for it."
              actions={
                <Button size="sm" onClick={() => navigate("market/post")}>
                  <Plus className="mr-1.5 size-4" aria-hidden /> Post your first task
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {sortedTasks.map((t) => (
                <TaskRow key={t.id} t={t} onOpen={() => navigate(`market/task/${t.id}`)} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
