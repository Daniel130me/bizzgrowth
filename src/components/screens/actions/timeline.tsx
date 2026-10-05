"use client";
// Screen 45 — Business Timeline / Change Ledger.
// Screen 47 — Detected Change Confirmation dialog (state on this page).

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, ScanSearch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ProvenanceBadge } from "@/components/shared/badges";
import { ProvenanceLegend } from "@/components/shared/evidence";
import { InfoBanner, PageHeader, SectionCard } from "@/components/shared/layout";
import { EmptyState } from "@/components/shared/states";
import { timelineFor } from "@/lib/data/operations";
import { useBizz } from "@/lib/store";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TimelineEvent } from "@/lib/types";

const TYPE_META: Record<TimelineEvent["type"], { label: string; cls: string; dot: string }> = {
  action: { label: "Action", cls: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  external: { label: "External change", cls: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  recommendation: { label: "Recommendation", cls: "bg-violet-50 text-violet-700 border-violet-200", dot: "bg-violet-500" },
  experiment: { label: "Experiment", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  outcome: { label: "Outcome", cls: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-600" },
  data: { label: "Data event", cls: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" },
};

const FILTERS = [
  { value: "all", label: "All" },
  { value: "action", label: "Actions" },
  { value: "external", label: "External changes" },
  { value: "recommendation", label: "Recommendations" },
  { value: "experiment", label: "Experiments" },
  { value: "data", label: "Data events" },
] as const;

const ANSWER_OPTIONS = ["Yes", "No", "Partly", "Not sure"];

const DETECTED_CHANGE: Record<string, string> = {
  swifthaul:
    "Instagram advertising spend increased ~10% (₦200k total in September). Was this related to your faster-follow-up experiment?",
  korahome:
    "Product 'Kora Rattan Lounge Chair' price changed ₦35,000 → ₦32,000. Was this related to Recommendation #284?",
};

function matchesFilter(type: TimelineEvent["type"], filter: string): boolean {
  if (filter === "all") return true;
  if (filter === "experiment") return type === "experiment" || type === "outcome";
  return type === filter;
}

export function Timeline() {
  const navigate = useBizz((s) => s.navigate);
  const businessId = useBizz((s) => s.businessId);
  const [filter, setFilter] = useState("all");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [answer, setAnswer] = useState("");
  const [note, setNote] = useState("");

  const events = useMemo(() => timelineFor(businessId), [businessId]);
  const filtered = events.filter((e) => matchesFilter(e.type, filter));
  const question =
    DETECTED_CHANGE[businessId] ??
    "We detected a change in your data during this period. Was it related to one of your recommendations or experiments?";

  const confirm = () => {
    setConfirmOpen(false);
    setAnswer("");
    setNote("");
    toast.success("Thanks — this helps us interpret results correctly.");
  };

  return (
    <div>
      <PageHeader
        title="Business timeline"
        description="The memory of your business — every change, recommendation, action, experiment and outcome in one ledger. It exists so results are never attributed by assumption."
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("change-add")}>
              <Plus className="mr-2 size-4" aria-hidden />
              Add business change
            </Button>
            <Button onClick={() => setConfirmOpen(true)}>
              <ScanSearch className="mr-2 size-4" aria-hidden />
              Review detected change
            </Button>
          </>
        }
      />

      <Tabs value={filter} onValueChange={setFilter} className="mb-5">
        <div className="overflow-x-auto pb-1">
          <TabsList>
            {FILTERS.map((f) => (
              <TabsTrigger key={f.value} value={f.value}>
                {f.label} ({events.filter((e) => matchesFilter(e.type, f.value)).length})
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      {filtered.length === 0 ? (
        <EmptyState
          title="No events in this view"
          description="Change the filter, or record a business change so offline events appear on the ledger."
          actions={
            <Button variant="outline" size="sm" onClick={() => navigate("change-add")}>
              Add business change
            </Button>
          }
        />
      ) : (
        <SectionCard>
          <ol className="relative ml-2 space-y-7 border-l border-slate-200">
            {filtered.map((e) => {
              const meta = TYPE_META[e.type];
              return (
                <li key={e.id} className="relative pl-6">
                  <span
                    className={cn("absolute -left-[7px] top-1.5 size-3 rounded-full border-2 border-white", meta.dot)}
                    aria-hidden
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground tnum">{fmtDate(e.date)}</span>
                    <Badge variant="outline" className={meta.cls}>
                      {meta.label}
                    </Badge>
                    <ProvenanceBadge provenance={e.provenance} source={e.source} />
                  </div>
                  <h3 className="mt-1.5 text-sm font-semibold leading-snug">{e.title}</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">{e.description}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Source: {e.source}</p>
                </li>
              );
            })}
          </ol>
          <ProvenanceLegend className="mt-6 border-t pt-4" />
        </SectionCard>
      )}

      <div className="mt-5">
        <InfoBanner tone="info" title="Change ledger principle">
          The platform never assumes its recommendation caused an outcome. Campaign adjustments, pricing, promotions, staffing
          changes and website updates are all tracked here, so results are interpreted with everything in view.
        </InfoBanner>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>We noticed something changed.</DialogTitle>
            <DialogDescription>{question}</DialogDescription>
          </DialogHeader>
          <RadioGroup value={answer} onValueChange={setAnswer} className="grid grid-cols-2 gap-2">
            {ANSWER_OPTIONS.map((opt) => (
              <Label
                key={opt}
                htmlFor={`answer-${opt}`}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm font-normal transition-colors",
                  answer === opt ? "border-blue-300 bg-blue-50 text-blue-800" : "hover:border-slate-300",
                )}
              >
                <RadioGroupItem value={opt} id={`answer-${opt}`} />
                {opt}
              </Label>
            ))}
          </RadioGroup>
          <div>
            <Label htmlFor="change-note" className="text-xs text-muted-foreground">
              Optional note
            </Label>
            <Textarea
              id="change-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Anything that helps interpret this change."
              className="mt-1.5"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Confirming relationships like this keeps attribution honest — a relationship is confirmed, never invented.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Not now
            </Button>
            <Button disabled={!answer} onClick={confirm}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
