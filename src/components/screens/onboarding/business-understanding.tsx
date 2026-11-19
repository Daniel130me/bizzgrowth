"use client";
// Screen 16 — What We Understand About Your Business.
// Renders the AI-extracted Business Brain model from the checkup conversation
// (store.checkup.facts) with provenance on every fact, and lets the owner
// correct any fact inline before the first diagnosis runs. Falls back to the
// workspace-setup-only view when no checkup facts exist yet.
import { useState } from "react";
import { ArrowRight, Check, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ProvenanceBadge } from "@/components/shared/badges";
import { ProvenanceLegend } from "@/components/shared/evidence";
import type { ScreenProps } from "../view-types";
import { useBizz } from "@/lib/store";
import type { BusinessFacts, CheckupFact, TrendDirection } from "@/lib/checkup";
import type { Provenance } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Fact {
  section: string;
  value: string;
  provenance: Provenance;
  source: string;
}

const TRENDS: TrendDirection[] = ["Increased", "Decreased", "About the same", "Don't know"];
const TREND_KEYS = [
  { key: "enquiries", label: "Enquiries" },
  { key: "customers", label: "Customers" },
  { key: "revenue", label: "Revenue" },
] as const;
type Trends = BusinessFacts["trends"];

const CORRECTED_SOURCE = "Corrected by you";
const isPerformance = (section: string) => /performance/i.test(section);

function trendSummary(t: Trends) {
  return `Enquiries: ${t.enquiries}, Customers: ${t.customers}, Revenue: ${t.revenue}`;
}

function splitList(value: string): string[] {
  if (/^\s*(none|nothing|n\/a|no changes?)\b/i.test(value)) return [];
  return value
    .split(/[,;\n]/)
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, 12);
}

/** Apply edited fact rows back onto the structured model the diagnosis reads. */
function applyEdits(base: BusinessFacts, rows: Fact[], type: BusinessFacts["businessType"], trends: Trends): BusinessFacts {
  const next: BusinessFacts = { ...base, businessType: type, trends };
  for (const r of rows) {
    const s = r.section.toLowerCase();
    // Specific checkup answers first — "Enquiries that become customers" must
    // update the close rate, never the "Customers" description.
    if (/become customers|how many pay|enquiries that/.test(s)) next.closeRate = r.value;
    else if (/give your price|how you give|price is given/.test(s)) next.pricePresentation = r.value;
    else if (/don't buy|dont buy|do not buy|don't go ahead/.test(s)) next.lostReason = r.value;
    else if (/room for more|more work|capacity/.test(s)) next.capacity = r.value;
    else if (/past work|proof|examples/.test(s)) next.proof = r.value;
    else if (/coming back|come back|repeat/.test(s)) next.repeat = r.value;
    else if (/think is causing|your view|your theory/.test(s)) next.ownerTheory = r.value;
    else if (/stuck|bottleneck|hardest/.test(s)) next.bottleneck = r.value;
    else if (/handled|follow|getting back/.test(s)) next.followUp = r.value;
    else if (/job value|typical job|order value/.test(s)) next.jobValue = r.value;
    else if (/each month|a month|per month/.test(s)) next.monthlyEnquiries = r.value;
    else if (/journey/.test(s)) {
      const steps = r.value.split(/\s*(?:→|->|>|,|;|\n)\s*/).map((v) => v.trim()).filter(Boolean);
      if (steps.length > 0) next.journey = steps.slice(0, 12);
    } else if (/channel|source|find you|found via/.test(s)) next.channels = splitList(r.value);
    else if (/recent change/.test(s)) next.recentChanges = splitList(r.value);
    else if (/goal/.test(s)) next.primaryGoal = r.value;
    else if (/sell|offer|product|service/.test(s)) next.whatTheySell = r.value;
    else if (/customer|target|audience|market|client/.test(s) && !isPerformance(s)) next.customers = r.value;
  }
  // Keep the original "Business" fact (workspace-sourced) first, then the edited rows.
  const businessFact = base.facts.find((f) => f.section === "Business");
  const updatedBusiness = businessFact
    ? { ...businessFact, value: businessFact.value.replace(/\b(service|ecommerce)\b/, type) }
    : null;
  next.facts = [...(updatedBusiness ? [updatedBusiness] : []), ...rows];
  return next;
}

export default function BusinessUnderstanding(_props: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const checkupFacts = useBizz((s) => s.checkup.facts);
  const updateCheckupFacts = useBizz((s) => s.updateCheckupFacts);
  const businessName = userWorkspace?.name ?? "Your business";
  const country = userWorkspace?.country ?? "Nigeria";

  // Fact rows below the workspace-sourced "Business" row.
  const factRows: Fact[] = checkupFacts
    ? checkupFacts.facts
        .filter((f: CheckupFact) => f.section !== "Business")
        .map((f: CheckupFact) => ({ section: f.section, value: f.value, provenance: f.provenance, source: f.source }))
    : [];

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Fact[]>([]);
  const [draftType, setDraftType] = useState<BusinessFacts["businessType"]>("service");
  const [draftTrends, setDraftTrends] = useState<Trends>({ enquiries: "Don't know", customers: "Don't know", revenue: "Don't know" });

  function startEditing(focusIndex?: number) {
    if (!checkupFacts) return;
    setDraft(factRows.map((f) => ({ ...f })));
    setDraftType(checkupFacts.businessType);
    setDraftTrends({ ...checkupFacts.trends });
    setEditing(true);
    if (focusIndex !== undefined) {
      window.setTimeout(() => document.getElementById(`fact-edit-${focusIndex}`)?.focus(), 30);
    }
  }

  function cancel() {
    setEditing(false);
  }

  function save() {
    if (!checkupFacts) return;
    let changed = draftType !== checkupFacts.businessType;
    const trendsChanged = TREND_KEYS.some(({ key }) => draftTrends[key] !== checkupFacts.trends[key]);
    const rows: Fact[] = draft.map((row, i) => {
      const original = factRows[i];
      if (isPerformance(row.section)) {
        if (!trendsChanged) return original;
        changed = true;
        return { ...row, value: trendSummary(draftTrends), provenance: "user-supplied", source: CORRECTED_SOURCE };
      }
      const value = row.value.trim() || "Not specified";
      if (value === original.value) return original;
      changed = true;
      return { ...row, value, provenance: "user-supplied", source: CORRECTED_SOURCE };
    });
    if (trendsChanged) changed = true;

    setEditing(false);
    if (!changed) return;
    updateCheckupFacts(applyEdits(checkupFacts, rows, draftType, draftTrends));
    toast.success("Corrections saved", { description: "Your first diagnosis will be built from the updated facts." });
  }

  const fallbackFacts: Fact[] = [
    {
      section: "What you sell",
      value: "Complete the private checkup so the Context Engine can build this from your answers",
      provenance: "ai-interpretation",
      source: "Waiting for your checkup conversation",
    },
    {
      section: "Primary goal",
      value: "Collected during the private checkup",
      provenance: "ai-interpretation",
      source: "Waiting for your checkup conversation",
    },
    {
      section: "How people find you",
      value: "Collected during the private checkup",
      provenance: "user-supplied",
      source: "Waiting for your checkup conversation",
    },
  ];

  const rows = checkupFacts ? (editing ? draft : factRows) : fallbackFacts;
  const businessType = editing ? draftType : checkupFacts?.businessType ?? "service";

  return (
    <div className="mx-auto w-full max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">Business Brain — first pass</p>
      <h1 className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">What we understand about your business</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {checkupFacts
          ? "Built by the Context Engine from your checkup answers — the working model the AI reasons over. Every fact carries its source; correct anything that looks wrong."
          : "This is the working model the AI reasons over. Complete the private checkup so every fact is built from your answers."}
      </p>

      {editing ? (
        <p className="mt-4 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-800" role="status">
          Editing — change anything that is wrong. Corrected facts are marked as supplied by you.
        </p>
      ) : null}

      <Card className={cn("p-0", editing ? "mt-3 border-violet-300 ring-2 ring-violet-100" : "mt-6")}>
        <ul>
          {/* Business row — name and country come from workspace setup; type is editable */}
          <li>
            <div className="flex flex-col gap-1.5 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0 flex-1 sm:max-w-md">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Business</p>
                {editing ? (
                  <div className="mt-2">
                    <p className="text-sm">
                      {businessName} — {country}
                    </p>
                    <div className="mt-2 inline-flex rounded-lg border bg-slate-50 p-0.5" role="radiogroup" aria-label="Business type">
                      {(["service", "ecommerce"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          role="radio"
                          aria-checked={draftType === t}
                          onClick={() => setDraftType(t)}
                          className={cn(
                            "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                            draftType === t ? "bg-white text-violet-700 shadow-sm" : "text-slate-600 hover:text-slate-900",
                          )}
                        >
                          {t === "service" ? "Service business" : "Ecommerce"}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 text-sm">
                    {businessName} — a {businessType} business in {country}
                  </p>
                )}
                <p className="mt-1 text-[11px] text-muted-foreground">Workspace setup</p>
              </div>
              <div className="shrink-0">
                <ProvenanceBadge provenance="user-supplied" source="Workspace setup" />
              </div>
            </div>
          </li>

          {rows.map((f, i) => (
            <li key={f.section}>
              <Separator />
              <div className="group flex flex-col gap-1.5 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0 flex-1 sm:max-w-md">
                  <label
                    htmlFor={`fact-edit-${i}`}
                    className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {f.section}
                  </label>

                  {editing && isPerformance(f.section) ? (
                    <div className="mt-2 space-y-2">
                      {TREND_KEYS.map(({ key, label }, k) => (
                        <div key={key} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                          <span className="w-20 shrink-0 text-xs font-medium text-slate-700">{label}</span>
                          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={`${label} trend`}>
                            {TRENDS.map((t) => (
                              <button
                                key={t}
                                id={k === 0 && t === TRENDS[0] ? `fact-edit-${i}` : undefined}
                                type="button"
                                role="radio"
                                aria-checked={draftTrends[key] === t}
                                onClick={() => setDraftTrends((d) => ({ ...d, [key]: t }))}
                                className={cn(
                                  "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                                  draftTrends[key] === t
                                    ? "border-violet-500 bg-violet-600 text-white"
                                    : "border-slate-200 bg-white text-slate-600 hover:border-violet-300 hover:text-violet-700",
                                )}
                              >
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : editing ? (
                    <Textarea
                      id={`fact-edit-${i}`}
                      value={f.value}
                      rows={Math.min(4, Math.max(1, Math.ceil(f.value.length / 60)))}
                      onChange={(e) =>
                        setDraft((d) => d.map((row, j) => (j === i ? { ...row, value: e.target.value } : row)))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
                        if (e.key === "Escape") cancel();
                      }}
                      className="mt-1.5 min-h-9 resize-y bg-white text-sm"
                      placeholder={/channel|change/i.test(f.section) ? "Separate items with commas" : undefined}
                    />
                  ) : (
                    <p className="mt-1 text-sm">{f.value}</p>
                  )}

                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {editing && /channel|recent change/i.test(f.section) && !isPerformance(f.section)
                      ? "Separate items with commas"
                      : f.source}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
                  <ProvenanceBadge provenance={f.provenance} source={f.source} />
                  {checkupFacts && !editing ? (
                    <button
                      type="button"
                      onClick={() => startEditing(i)}
                      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-violet-700 opacity-100 transition-opacity hover:bg-violet-50 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                      aria-label={`Edit ${f.section}`}
                    >
                      <Pencil className="size-3" aria-hidden />
                      Edit
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <ProvenanceLegend className="mt-4" />

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        {editing ? (
          <>
            <Button className="w-full bg-violet-600 hover:bg-violet-700 sm:w-auto" onClick={save}>
              <Check className="size-4" aria-hidden />
              Save corrections
            </Button>
            <Button variant="outline" className="w-full sm:w-auto" onClick={cancel}>
              <X className="size-4" aria-hidden />
              Cancel
            </Button>
          </>
        ) : (
          <>
            {checkupFacts ? (
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => startEditing(0)}>
                <Pencil className="size-4" aria-hidden />
                Edit
              </Button>
            ) : null}
            <Button className="w-full sm:w-auto" onClick={() => navigate("first-diagnosis")}>
              Looks right, continue
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
