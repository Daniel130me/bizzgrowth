"use client";
// Screen 32 — Insights Feed: the central intelligence feed.

import { useMemo, useState } from "react";
import { Database } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { InsightCard } from "@/components/shared/cards";
import { InfoBanner, PageHeader } from "@/components/shared/layout";
import { EmptyState } from "@/components/shared/states";
import { insightsFor } from "@/lib/data/intelligence";
import { REPORTING_MONTH } from "@/lib/data/businesses";
import { useBizz } from "@/lib/store";
import type { Insight } from "@/lib/types";
import type { ScreenProps } from "../view-types";
import { sortInsights } from "./parts";

type TabId = "all" | Insight["type"];
type ImportanceFilter = "all" | Insight["importance"];

const TABS: { id: TabId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "problem", label: "Problems" },
  { id: "opportunity", label: "Opportunities" },
  { id: "improvement", label: "Improvements" },
  { id: "watch", label: "Watch" },
];

export function InsightsFeed(_props: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);
  const businessId = useBizz((s) => s.businessId);
  const [tab, setTab] = useState<TabId>("all");
  const [importance, setImportance] = useState<ImportanceFilter>("all");

  const all = useMemo(() => insightsFor(businessId), [businessId]);
  const counts = useMemo(
    () => ({
      all: all.length,
      problem: all.filter((i) => i.type === "problem").length,
      opportunity: all.filter((i) => i.type === "opportunity").length,
      improvement: all.filter((i) => i.type === "improvement").length,
      watch: all.filter((i) => i.type === "watch").length,
    }),
    [all]
  );

  const filtered = useMemo(
    () =>
      sortInsights(
        all.filter(
          (i) => (tab === "all" || i.type === tab) && (importance === "all" || i.importance === importance)
        )
      ),
    [all, tab, importance]
  );

  const clearFilters = () => {
    setTab("all");
    setImportance("all");
  };

  return (
    <div>
      <PageHeader
        title="Insights"
        description="What your business data is telling the system this period — with the evidence and confidence behind every conclusion."
      />

      <InfoBanner tone="ai" title="How insights work" >
        Insights are generated from your connected data and entries. Every conclusion shows its evidence and confidence.
      </InfoBanner>

      {all.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<Database className="size-5" />}
            title="No insights yet"
            description="Insights appear once the system has data to reason over — connected sources, manual entries or website analytics. Nothing is invented: every conclusion will trace back to your numbers."
            actions={
              <>
                <Button size="sm" onClick={() => navigate("integrations")}>
                  Connect data
                </Button>
                <Button size="sm" variant="outline" onClick={() => navigate("manual-entry")}>
                  Enter manually
                </Button>
              </>
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
              <TabsList className="h-auto w-full flex-wrap justify-start sm:w-fit">
                {TABS.map((t) => (
                  <TabsTrigger key={t.id} value={t.id} className="flex-none px-3">
                    {t.label}
                    <span className="ml-1.5 rounded-full bg-slate-200/70 px-1.5 text-[11px] font-medium tnum text-slate-600">
                      {counts[t.id]}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <div className="flex items-center gap-2">
              <span className="sr-only" id="importance-filter-label">
                Filter by importance
              </span>
              <Select value={importance} onValueChange={(v) => setImportance(v as ImportanceFilter)}>
                <SelectTrigger size="sm" className="w-44" aria-labelledby="importance-filter-label">
                  <SelectValue placeholder="All importance" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All importance</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High importance</SelectItem>
                  <SelectItem value="medium">Medium importance</SelectItem>
                  <SelectItem value="low">Low importance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="mt-3 text-xs text-muted-foreground" aria-live="polite">
            Showing {filtered.length} of {all.length} insights · {REPORTING_MONTH.current}
          </p>

          {filtered.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="Nothing matches this filter"
                description={`No ${tab === "all" ? "" : `${TABS.find((t) => t.id === tab)?.label.toLowerCase()} `}insights at ${importance === "all" ? "any" : importance} importance in the current period. The underlying data has not changed — try a different filter.`}
                actions={
                  <Button size="sm" variant="outline" onClick={clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((insight) => (
                <InsightCard key={insight.id} insight={insight} onOpen={() => navigate(`insights/${insight.id}`)} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
