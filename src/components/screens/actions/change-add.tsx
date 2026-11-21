"use client";
// Screen 46 — Add / Edit Business Change.

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { InfoBanner, PageHeader, SectionCard } from "@/components/shared/layout";
import { recommendationsFor } from "@/lib/data/intelligence";
import { useBizz } from "@/lib/store";

const CATEGORIES = ["Staffing", "Pricing", "Promotion", "Website", "Product launch", "Process", "Other"];

export function ChangeAdd() {
  const navigate = useBizz((s) => s.navigate);
  const businessId = useBizz((s) => s.businessId);
  const recs = recommendationsFor(businessId);
  const addTimelineEvent = useBizz((s) => s.addTimelineEvent);
  const experiments = useBizz((s) => s.experiments);
  const updateExperiment = useBizz((s) => s.updateExperiment);

  const [what, setWhat] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [before, setBefore] = useState("");
  const [after, setAfter] = useState("");
  const [notes, setNotes] = useState("");
  const [recId, setRecId] = useState("none");

  const valid = Boolean(what.trim() && category && date);

  const submit = () => {
    if (!valid) return;
    const change = before.trim() || after.trim() ? `${before.trim() || "?"} → ${after.trim() || "?"}` : "";
    addTimelineEvent({
      date,
      type: "external",
      title: what.trim(),
      description: [category, change, notes.trim()].filter(Boolean).join(" · "),
      source: "Recorded by you",
      provenance: "user-supplied",
    });
    // A running experiment keeps the change in view, so its result is read honestly.
    for (const e of experiments.filter((x) => x.businessId === businessId && x.status !== "complete")) {
      const kept = e.otherChanges.filter((c) => !/nothing reported yet|nothing else changed/i.test(c));
      updateExperiment(e.id, { otherChanges: [...kept, what.trim()] });
    }
    toast.success("Change recorded — your timeline and experiment results now account for it.");
    navigate("timeline");
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader
        title="Add business change"
        description="Record an offline or opaque change — a hire, a price move, a promotion — so experiment results are interpreted with everything in view."
        back={
          <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => navigate("timeline")}>
            Back to timeline
          </Button>
        }
      />

      <div className="mb-5">
        <InfoBanner tone="info" title="Why this matters">
          Examples: hired two salespeople · started free delivery · changed pricing · launched a promotion. If several things
          change during a measurement window, results are reported with all of them in view.
        </InfoBanner>
      </div>

      <SectionCard title="Change details">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="change-what">What changed? *</Label>
            <Input
              id="change-what"
              value={what}
              onChange={(e) => setWhat(e.target.value)}
              placeholder="e.g. Started free delivery for orders above ₦50,000"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="change-category">Category *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="change-category" className="mt-1.5 w-full">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="change-date">Date *</Label>
            <Input id="change-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="change-before">Before</Label>
            <Input
              id="change-before"
              value={before}
              onChange={(e) => setBefore(e.target.value)}
              placeholder="e.g. Delivery fee ₦3,500"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="change-after">After</Label>
            <Input
              id="change-after"
              value={after}
              onChange={(e) => setAfter(e.target.value)}
              placeholder="e.g. Free"
              className="mt-1.5"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="change-notes">Notes</Label>
            <Textarea
              id="change-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Context — who decided it, why, and anything that could affect results."
              className="mt-1.5"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="change-rec">Related recommendation?</Label>
            <Select value={recId} onValueChange={setRecId}>
              <SelectTrigger id="change-rec" className="mt-1.5 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None — not related to a recommendation</SelectItem>
                {recs.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Linking helps interpret whether the recommendation and the change overlapped in time.
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Button disabled={!valid} onClick={submit}>
            Record change
          </Button>
          <Button variant="ghost" onClick={() => navigate("timeline")}>
            Cancel
          </Button>
          {!valid && <span className="text-xs text-muted-foreground">What changed, category and date are required.</span>}
        </div>
      </SectionCard>
    </div>
  );
}
