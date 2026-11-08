"use client";
// Screen 70 — Reports / Brief Archive: previous weekly and monthly reports,
// with a Custom tab explaining the upcoming composer.

import React, { useState } from "react";
import { useBizz } from "@/lib/store";
import { BRIEF_ARCHIVE } from "@/lib/data/operations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/layout";
import { EmptyState } from "@/components/shared/states";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowRight, FileText, FolderOpen } from "lucide-react";
import type { ScreenProps } from "../view-types";

const KIND_CLS: Record<string, string> = {
  Weekly: "border-blue-200 bg-blue-50 text-blue-700",
  Monthly: "border-violet-200 bg-violet-50 text-violet-700",
};

export function ReportsArchive({ params: _params }: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);
  const businessId = useBizz((s) => s.businessId);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const [tab, setTab] = useState<"weekly" | "monthly" | "custom">("weekly");

  // Briefs belong to the workspace that generated them — sample reports never
  // appear inside a user's own workspace.
  const allBriefs = BRIEF_ARCHIVE.filter((b) => b.businessId === businessId);
  const weekly = allBriefs.filter((b) => b.kind === "Weekly");
  const monthly = allBriefs.filter((b) => b.kind === "Monthly");
  const visible = tab === "weekly" ? weekly : tab === "monthly" ? monthly : [];

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Every weekly brief and monthly review is archived here. Briefs are generated automatically from your data — Monday mornings for weekly, the first of the month for monthly."
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="mb-4">
          <TabsTrigger value="weekly">
            Weekly <span className="ml-1.5 rounded-full bg-slate-200/70 px-1.5 text-xs tnum text-slate-600">{weekly.length}</span>
          </TabsTrigger>
          <TabsTrigger value="monthly">
            Monthly <span className="ml-1.5 rounded-full bg-slate-200/70 px-1.5 text-xs tnum text-slate-600">{monthly.length}</span>
          </TabsTrigger>
          <TabsTrigger value="custom">
            Custom <span className="ml-1.5 rounded-full bg-slate-200/70 px-1.5 text-xs tnum text-slate-600">0</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-0">
          {tab === "custom" ? (
            <EmptyState
              icon={<FolderOpen className="size-5" />}
              title="No custom reports yet"
              description="Custom reports can be composed from any date range — coming to the MVP after GA feedback."
            />
          ) : visible.length === 0 ? (
            <EmptyState
              icon={<FileText className="size-5" />}
              title="No reports in this view"
              description={
                businessId === "user-workspace"
                  ? `No briefs yet for ${userWorkspace?.name ?? "your workspace"}. Reports start once real data flows in — entered totals, an upload or a connected source.`
                  : "Reports appear here as soon as the first brief is generated for this workspace."
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Kind</th>
                    <th className="px-4 py-3 font-medium">Period</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">View</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((b) => (
                    <tr key={b.id} className="border-b last:border-0 hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`font-normal ${KIND_CLS[b.kind] ?? ""}`}>
                          {b.kind}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-medium tnum">{b.period}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 font-normal text-emerald-700">
                          {b.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="outline" onClick={() => navigate(b.route)} aria-label={`View ${b.kind.toLowerCase()} brief for ${b.period}`}>
                          View <ArrowRight className="size-3.5" aria-hidden />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <p className="mt-6 text-xs text-muted-foreground">
        {allBriefs.length
          ? `${allBriefs.length} archived report${allBriefs.length === 1 ? "" : "s"} · status shows whether the brief finished generating and is ready to read.`
          : "Briefs are written from your workspace's own data — they appear here once the first one is generated."}
      </p>
    </div>
  );
}
