"use client";
// Screen 32 — Insights Feed: the central intelligence feed.
// For a real owner's workspace, the FIRST insights are AI-generated from their
// checkup facts (POST /api/insights/generate) — every conclusion still shows
// evidence + confidence, and says plainly what measured data would settle.

import { useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { InsightCard } from "@/components/shared/cards";
import { InfoBanner, PageHeader } from "@/components/shared/layout";
import { EmptyState } from "@/components/shared/states";
import { insightsFor } from "@/lib/data/intelligence";
import { REPORTING_MONTH } from "@/lib/data/businesses";
import { useBizz } from "@/lib/store";
import { ownerMonthsFromEntries } from "@/lib/data/user-business";
import { buildBusinessContext } from "@/lib/ai-context";
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
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const facts = useBizz((s) => s.checkup.facts);
  const diagnosis = useBizz((s) => s.checkup.diagnosis);
  const manualEntries = useBizz((s) => s.manualEntries);
  const aiInsights = useBizz((s) => s.aiInsights);
  const setAiInsights = useBizz((s) => s.setAiInsights);
  const [tab, setTab] = useState<TabId>("all");
  const [importance, setImportance] = useState<ImportanceFilter>("all");
  const [generating, setGenerating] = useState(false);

  const isOwnerWorkspace = businessId === "user-workspace";

  async function generateInsights() {
    if (!facts) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/insights/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceName: userWorkspace?.name,
          country: userWorkspace?.country,
          facts,
          // Everything the owner told the checkup + their diagnosis and plan — insights build on it.
          context: buildBusinessContext({
            workspace: userWorkspace,
            facts,
            diagnosis,
            months: ownerMonthsFromEntries(manualEntries).slice(-3).map((m) => ({ label: m.label, revenue: m.revenue, enquiries: m.enquiries, customers: m.customers })),
          }),
          months: ownerMonthsFromEntries(manualEntries).slice(-3).map((m) => ({ label: m.label, revenue: m.revenue, enquiries: m.enquiries, customers: m.customers })),
        }),
      });
      const data = (await res.json()) as { ok?: boolean; insights?: Insight[]; error?: string };
      if (data?.ok && data.insights?.length) {
        setAiInsights(data.insights);
        toast.success("Your insights are ready", { description: "Built on your checkup and diagnosis — every figure checked against your answers." });
      } else {
        toast.error("Could not generate insights", { description: "Nothing was invented in the attempt. Please try again in a moment." });
      }
    } catch {
      toast.error("Could not reach the intelligence engine", { description: "Check your connection and try again — nothing was fabricated meanwhile." });
    } finally {
      setGenerating(false);
    }
  }

  // Sample workspaces read the curated dataset; the owner's workspace shows
  // their own AI-generated insights (empty until generated).
  const all = useMemo(
    () => (isOwnerWorkspace ? aiInsights : insightsFor(businessId)),
    [isOwnerWorkspace, aiInsights, businessId]
  );
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

      <InfoBanner tone="ai" title="How insights work">
        {isOwnerWorkspace
          ? "Written from your own checkup answers, your diagnosis and any numbers you entered. Every figure is checked against them before you see it — nothing is made up."
          : "Insights are generated from your connected data and entries. Every conclusion shows its evidence and confidence."}
      </InfoBanner>

      {all.length === 0 ? (
        <div className="mt-6">
          {isOwnerWorkspace && facts ? (
            <EmptyState
              icon={generating ? <Loader2 className="size-5 animate-spin" /> : <Sparkles className="size-5" />}
              title="Three things worth knowing about your business"
              description="Built on your checkup and your diagnosis: an opportunity you may be missing, something to watch, and a quick win for this week — with the exact words to use where it helps. Every figure is checked against your answers; nothing is made up."
              actions={
                <>
                  <Button size="sm" className="bg-violet-600 hover:bg-violet-700" disabled={generating} onClick={() => void generateInsights()}>
                    {generating ? (
                      <>
                        <Loader2 className="mr-1.5 size-3.5 animate-spin" aria-hidden />
                        Studying your answers — up to a minute…
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-1.5 size-3.5" aria-hidden />
                        Show me my insights
                      </>
                    )}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => navigate("manual-entry")}>
                    Enter real numbers instead
                  </Button>
                </>
              }
            />
          ) : (
            <EmptyState
              icon={<Sparkles className="size-5" />}
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
          )}
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
