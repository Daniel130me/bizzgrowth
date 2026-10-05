"use client";
// Screen 94 — Send Feedback / Report Problem.

import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, ImagePlus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader, SectionCard } from "@/components/shared/layout";
import { useBizz } from "@/lib/store";

const TYPES = [
  { id: "Feedback", priority: "Low", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  { id: "Bug", priority: "High", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  { id: "Data concern", priority: "High", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  { id: "AI diagnosis concern", priority: "Medium", cls: "bg-violet-50 text-violet-700 border-violet-200" },
] as const;

type TypeId = (typeof TYPES)[number]["id"];

export function Feedback() {
  const navigate = useBizz((s) => s.navigate);
  const businessName = useBizz((s) => s.settings.businessName);

  const [type, setType] = useState<TypeId>("Feedback");
  const [subject, setSubject] = useState("");
  const [details, setDetails] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const meta = TYPES.find((t) => t.id === type) ?? TYPES[0];
  const canSubmit = subject.trim().length >= 3 && details.trim().length >= 10;

  const submit = () => {
    if (!canSubmit) return;
    setSubmitted(true);
  };

  const reset = () => {
    setType("Feedback");
    setSubject("");
    setDetails("");
    setScreenshot(null);
    setSubmitted(false);
  };

  if (submitted) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <PageHeader title="Send Feedback / Report Problem" />
        <SectionCard>
          <div className="flex flex-col items-center py-4 text-center">
            <div className="flex size-12 items-center justify-center rounded-full border bg-white text-emerald-600 shadow-sm">
              <CheckCircle2 className="size-5" aria-hidden />
            </div>
            <h2 className="mt-4 text-lg font-semibold">Thank you — reference FB-2026-0142</h2>
            <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
              We review every report. Your {type.toLowerCase()} about &ldquo;{subject.trim()}&rdquo; is in the queue and
              the right team will follow up by email.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
              <Badge variant="outline" className="font-normal">
                Type: {type}
              </Badge>
              <Badge variant="outline" className={"font-normal " + meta.cls}>
                Priority: {meta.priority}
              </Badge>
              <Badge variant="outline" className="font-normal">
                Workspace: {businessName}
              </Badge>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <Button variant="outline" onClick={reset}>
                Send another
              </Button>
              <Button variant="ghost" onClick={() => navigate("help")}>
                Back to help
              </Button>
            </div>
          </div>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <PageHeader
        title="Send Feedback / Report Problem"
        description="Tell us what worked, what broke, or where a diagnosis looks wrong. Reports go straight to the team."
      />

      <SectionCard title="Your report">
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fb-type">Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as TypeId)}>
                <SelectTrigger id="fb-type" aria-label="Report type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <div className="flex h-9 items-center gap-2">
                <Badge variant="outline" className={"font-normal " + meta.cls}>
                  {meta.priority}
                </Badge>
                <span className="text-xs text-muted-foreground">Set automatically by report type.</span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fb-subject">Subject</Label>
            <Input
              id="fb-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Weekly brief shows last week's dates"
              maxLength={120}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fb-details">Details</Label>
            <Textarea
              id="fb-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={5}
              placeholder="What happened, what you expected, and which screen you were on. For data concerns, tell us which numbers look wrong."
              aria-describedby="fb-details-hint"
            />
            <p id="fb-details-hint" className="text-xs text-muted-foreground">
              {details.trim().length}/10 characters minimum
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Screenshot (optional)</Label>
            {screenshot ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border bg-slate-50 px-4 py-3">
                <p className="truncate text-sm">{screenshot}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  aria-label="Remove screenshot"
                  onClick={() => setScreenshot(null)}
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setScreenshot("screenshot.png");
                  toast.success("Attached", { description: "screenshot.png added to your report." });
                }}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-8 text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ImagePlus className="size-5" aria-hidden />
                <span className="text-sm font-medium">Attach a screenshot</span>
                <span className="text-xs text-muted-foreground">PNG or JPG — helps us reproduce the issue faster.</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
            <Button variant="ghost" onClick={reset}>
              Clear
            </Button>
            <Button onClick={submit} disabled={!canSubmit}>
              Submit report
            </Button>
          </div>
        </div>
      </SectionCard>

      <p className="text-xs leading-relaxed text-muted-foreground">
        By submitting you agree we may contact you about this report. Workspace data is only shared with the reviewer
        handling your case.
      </p>
    </div>
  );
}
