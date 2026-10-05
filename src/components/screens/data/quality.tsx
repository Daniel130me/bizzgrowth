"use client";
// Screen 63 — Data Quality Issues.

import { useState } from "react";
import { CheckCircle2, CircleAlert, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/states";
import { PageHeader } from "@/components/shared/layout";
import { SeverityBadge } from "@/components/shared/badges";
import { useBizz } from "@/lib/store";
import { getBusiness } from "@/lib/data/businesses";
import { DATA_QUALITY } from "@/lib/data/operations";
import type { DataQualityIssue } from "@/lib/types";
import type { ViewMap } from "../view-types";

function isConnectionIssue(issue: DataQualityIssue): boolean {
  return /reconnect/i.test(issue.resolution);
}

function DataQualityScreen() {
  const businessId = useBizz((s) => s.businessId);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const navigate = useBizz((s) => s.navigate);
  const business = getBusiness(businessId, userWorkspace);

  const issues = DATA_QUALITY.filter((d) => d.businessId === businessId);
  const [resolved, setResolved] = useState<string[]>([]);
  const [resolveId, setResolveId] = useState<string | null>(null);
  const open = issues.filter((i) => !resolved.includes(i.id));

  function markResolved(issue: DataQualityIssue) {
    setResolved((r) => [...r, issue.id]);
    setResolveId(null);
    toast.success("Issue marked resolved", {
      description: "Diagnosis confidence improves on the next analysis pass.",
    });
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        title="Data quality issues"
        description="Problems that reduce how much of your data the system can trust. Resolving them raises diagnosis confidence."
        back={
          <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => navigate("data")}>
            Back to Data Centre
          </Button>
        }
      />

      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <p className="text-sm">
          <span className="font-semibold tnum">{open.length}</span>{" "}
          <span className="text-muted-foreground">
            open issue{open.length === 1 ? "" : "s"} · resolving these improves diagnosis confidence
          </span>
        </p>
        <Button size="sm" variant="outline" onClick={() => navigate("integrations")}>
          Connect better sources
        </Button>
      </Card>

      <div className="mt-5 space-y-3">
        {issues.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 className="size-5" />}
            title={`No data quality issues for ${business.name}`}
            description="Once sources are connected and totals are entered, issues that affect analysis confidence will appear here with their impact and a resolution path."
            actions={
              <Button size="sm" onClick={() => navigate("data")}>
                Open Data Centre
              </Button>
            }
          />
        ) : (
          issues.map((issue) => {
            const isResolved = resolved.includes(issue.id);
            const connection = isConnectionIssue(issue);
            return (
              <Card key={issue.id} className={`p-5 ${isResolved ? "opacity-70" : ""}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <SeverityBadge severity={issue.severity === "error" ? "critical" : issue.severity} />
                    {isResolved ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
                        <CheckCircle2 className="size-3" aria-hidden /> Resolved
                      </span>
                    ) : null}
                  </div>
                  {!isResolved ? (
                    connection ? (
                      <Button size="sm" variant="destructive" onClick={() => navigate("connection-error")}>
                        <Wrench className="mr-1.5 size-4" aria-hidden /> Fix connection
                      </Button>
                    ) : (
                      <Dialog open={resolveId === issue.id} onOpenChange={(o) => setResolveId(o ? issue.id : null)}>
                        <DialogTrigger asChild>
                          <Button size="sm">Resolve</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>{issue.title}</DialogTitle>
                            <DialogDescription>{issue.detail}</DialogDescription>
                          </DialogHeader>
                          <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">How to resolve</p>
                            <p className="mt-1 text-sm text-blue-900">{issue.resolution}</p>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" onClick={() => setResolveId(null)}>
                              Not now
                            </Button>
                            <Button onClick={() => markResolved(issue)}>Mark resolved</Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )
                  ) : null}
                </div>
                <h2 className="mt-2 text-sm font-semibold leading-snug">{issue.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{issue.detail}</p>
                <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <CircleAlert className="size-3.5" aria-hidden /> Why it matters
                  </p>
                  <p className="mt-1 text-sm text-slate-600">{issue.impact}</p>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

export const views: ViewMap = {
  "data-quality": DataQualityScreen,
};
