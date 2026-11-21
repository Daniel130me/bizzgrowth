"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState, LoadingState } from "@/components/shared/states";
import { InfoBanner, PageHeader, SectionCard } from "@/components/shared/layout";
import { navigate } from "@/lib/router";
import { MARKET_CATEGORIES } from "../market/parts";
import type { ScreenProps } from "../view-types";

type PortfolioItem = { title: string; blurb: string };
type SpecialistProfile = {
  name: string;
  headline: string;
  category: string;
  skills: string[];
  hourlyRate: number;
  responseTime: string;
  location: string;
  languages: string[];
  bio: string;
  portfolio: PortfolioItem[];
  available: string;
  status: string;
  onboardingStep: number;
  reviewNote: string | null;
};

const EMPTY: SpecialistProfile = {
  name: "",
  headline: "",
  category: "",
  skills: [],
  hourlyRate: 0,
  responseTime: "Within 1 business day",
  location: "",
  languages: ["English"],
  bio: "",
  portfolio: [{ title: "", blurb: "" }],
  available: "Available now",
  status: "draft",
  onboardingStep: 1,
  reviewNote: null,
};

const STEPS = ["Identity", "Expertise", "Work", "Availability", "Review"];

export function SpecialistOnboarding({ params }: ScreenProps) {
  void params;
  const [profile, setProfile] = useState<SpecialistProfile>(EMPTY);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/market/specialist/me", { cache: "no-store" });
        const data = (await response.json()) as { ok?: boolean; specialist?: SpecialistProfile | null; error?: string };
        if (!response.ok || !data.ok) throw new Error(data.error || "Could not load your profile.");
        if (data.specialist) {
          setProfile({ ...EMPTY, ...data.specialist, portfolio: data.specialist.portfolio.length ? data.specialist.portfolio : EMPTY.portfolio });
          setStep(Math.min(5, Math.max(1, data.specialist.onboardingStep || 1)));
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Could not load your profile.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [reload]);

  const validation = useMemo(() => {
    const errors: Record<number, string> = {};
    if (profile.name.trim().length < 2 || profile.headline.trim().length < 20 || profile.location.trim().length < 2) {
      errors[1] = "Add your name, location and a headline of at least 20 characters.";
    }
    if (!profile.category || profile.skills.length < 3 || profile.bio.trim().length < 80) {
      errors[2] = "Choose a category, add at least 3 skills and write an 80-character bio.";
    }
    if (!profile.portfolio.some((item) => item.title.trim() && item.blurb.trim())) {
      errors[3] = "Add at least one complete portfolio example.";
    }
    if (profile.hourlyRate < 1 || profile.languages.length < 1 || !profile.available) {
      errors[4] = "Add a rate, language and availability.";
    }
    return errors;
  }, [profile]);

  function patch<K extends keyof SpecialistProfile>(key: K, value: SpecialistProfile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }

  async function save(nextStep = step): Promise<boolean> {
    setSaving(true);
    try {
      const response = await fetch("/api/market/specialist/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...profile, onboardingStep: nextStep }),
      });
      const data = (await response.json()) as { ok?: boolean; specialist?: SpecialistProfile; error?: string };
      if (!response.ok || !data.ok || !data.specialist) throw new Error(data.error || "Could not save your profile.");
      setProfile(data.specialist);
      return true;
    } catch (caught) {
      toast.error("Profile not saved", { description: caught instanceof Error ? caught.message : "Please try again." });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function continueTo(next: number) {
    if (validation[step]) {
      toast.error("Finish this step", { description: validation[step] });
      return;
    }
    if (await save(next)) setStep(next);
  }

  async function submit() {
    const firstInvalid = [1, 2, 3, 4].find((candidate) => validation[candidate]);
    if (firstInvalid) {
      setStep(firstInvalid);
      toast.error("Application incomplete", { description: validation[firstInvalid] });
      return;
    }
    if (!(await save(5))) return;
    setSaving(true);
    try {
      const response = await fetch("/api/market/specialist/submit", { method: "POST" });
      const data = (await response.json()) as { ok?: boolean; status?: string; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "Could not submit your application.");
      patch("status", data.status || "submitted");
      toast.success("Application submitted", { description: "You can track the review from your dashboard." });
      navigate("specialist/dashboard");
    } catch (caught) {
      toast.error("Application not submitted", { description: caught instanceof Error ? caught.message : "Please try again." });
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="mx-auto max-w-4xl"><LoadingState label="Loading specialist profile" rows={5} /></div>;
  if (error) return <div className="mx-auto max-w-3xl"><ErrorState title="Profile unavailable" description={error} onRetry={() => setReload((value) => value + 1)} /></div>;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader title="Specialist profile" description="Complete each section carefully. Your public profile is published only after review." />
      {profile.status === "submitted" ? <InfoBanner tone="info" title="Application under review">You can still improve your profile. Any change remains queued for review.</InfoBanner> : null}
      {profile.status === "rejected" ? <InfoBanner tone="warning" title="Changes requested">{profile.reviewNote || "Update your profile and submit it again."}</InfoBanner> : null}
      {profile.status === "approved" ? <InfoBanner tone="success" title="Profile approved">Saving material profile changes sends them for review again to protect marketplace trust.</InfoBanner> : null}

      <ol className="grid grid-cols-5 gap-2" aria-label="Onboarding progress">
        {STEPS.map((label, index) => {
          const number = index + 1;
          return (
            <li key={label}>
              <button type="button" onClick={() => setStep(number)} className={`w-full rounded-lg border px-2 py-2 text-xs font-medium ${step === number ? "border-brand-600 bg-brand-50 text-brand-800" : number < step ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "bg-white text-slate-500"}`}>
                <span className="hidden sm:inline">{number}. </span>{label}
              </button>
            </li>
          );
        })}
      </ol>

      {step === 1 ? <IdentityStep profile={profile} patch={patch} /> : null}
      {step === 2 ? <ExpertiseStep profile={profile} patch={patch} /> : null}
      {step === 3 ? <PortfolioStep profile={profile} patch={patch} /> : null}
      {step === 4 ? <AvailabilityStep profile={profile} patch={patch} /> : null}
      {step === 5 ? <ReviewStep profile={profile} validation={validation} /> : null}

      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" disabled={step === 1 || saving} onClick={() => setStep((value) => Math.max(1, value - 1))}>
          <ChevronLeft className="mr-1.5 size-4" /> Back
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" disabled={saving} onClick={() => void save(step)}>{saving ? "Saving…" : "Save draft"}</Button>
          {step < 5 ? (
            <Button disabled={saving} onClick={() => void continueTo(step + 1)}>Continue <ChevronRight className="ml-1.5 size-4" /></Button>
          ) : (
            <Button disabled={saving || profile.status === "submitted"} onClick={() => void submit()}>
              {saving ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 size-4" />}
              {profile.status === "submitted" ? "Under review" : "Submit for review"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

type StepProps = { profile: SpecialistProfile; patch: <K extends keyof SpecialistProfile>(key: K, value: SpecialistProfile[K]) => void };

function IdentityStep({ profile, patch }: StepProps) {
  return <SectionCard title="Identity and positioning" description="Use your real professional identity. This is what businesses see first."><div className="grid gap-4 sm:grid-cols-2">
    <Field label="Full name"><Input value={profile.name} maxLength={120} onChange={(event) => patch("name", event.target.value)} /></Field>
    <Field label="Location"><Input value={profile.location} maxLength={120} placeholder="Lagos, Nigeria / Remote" onChange={(event) => patch("location", event.target.value)} /></Field>
    <div className="sm:col-span-2"><Field label="Professional headline"><Input value={profile.headline} maxLength={160} placeholder="Meta ads for Nigerian retail businesses" onChange={(event) => patch("headline", event.target.value)} /></Field></div>
  </div></SectionCard>;
}

function ExpertiseStep({ profile, patch }: StepProps) {
  return <SectionCard title="Expertise" description="Specific skills and evidence make matching more accurate."><div className="space-y-4">
    <Field label="Primary category"><Select value={profile.category} onValueChange={(value) => patch("category", value)}><SelectTrigger><SelectValue placeholder="Choose a category" /></SelectTrigger><SelectContent>{MARKET_CATEGORIES.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent></Select></Field>
    <Field label="Skills" hint="Comma-separated; add at least three."><Input value={profile.skills.join(", ")} onChange={(event) => patch("skills", event.target.value.split(",").map((value) => value.trim()).filter(Boolean).slice(0, 20))} placeholder="Meta Ads, campaign strategy, conversion tracking" /></Field>
    <Field label="Professional bio" hint={`${profile.bio.length}/2500`}><Textarea value={profile.bio} maxLength={2500} rows={7} onChange={(event) => patch("bio", event.target.value)} placeholder="Describe the work you do, who you help, and how you work…" /></Field>
  </div></SectionCard>;
}

function PortfolioStep({ profile, patch }: StepProps) {
  function update(index: number, key: keyof PortfolioItem, value: string) {
    patch("portfolio", profile.portfolio.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  }
  return <SectionCard title="Portfolio evidence" description="Add concrete work and outcomes. Do not include confidential client information."><div className="space-y-4">
    {profile.portfolio.map((item, index) => <div key={index} className="rounded-xl border p-4"><div className="mb-3 flex items-center justify-between"><p className="text-sm font-semibold">Example {index + 1}</p>{profile.portfolio.length > 1 ? <Button size="icon" variant="ghost" onClick={() => patch("portfolio", profile.portfolio.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove example ${index + 1}`}><Trash2 className="size-4" /></Button> : null}</div><div className="space-y-3"><Field label="Project title"><Input value={item.title} maxLength={120} onChange={(event) => update(index, "title", event.target.value)} /></Field><Field label="What you did and the outcome"><Textarea value={item.blurb} maxLength={600} rows={4} onChange={(event) => update(index, "blurb", event.target.value)} /></Field></div></div>)}
    {profile.portfolio.length < 8 ? <Button variant="outline" onClick={() => patch("portfolio", [...profile.portfolio, { title: "", blurb: "" }])}><Plus className="mr-1.5 size-4" /> Add another example</Button> : null}
  </div></SectionCard>;
}

function AvailabilityStep({ profile, patch }: StepProps) {
  return <SectionCard title="Rates and availability" description="These details set expectations before you bid."><div className="grid gap-4 sm:grid-cols-2">
    <Field label="Indicative hourly rate (NGN)"><Input type="number" min={0} max={10_000_000} value={profile.hourlyRate || ""} onChange={(event) => patch("hourlyRate", Number(event.target.value))} /></Field>
    <Field label="Typical response time"><Input value={profile.responseTime} maxLength={80} onChange={(event) => patch("responseTime", event.target.value)} /></Field>
    <Field label="Availability"><Select value={profile.available} onValueChange={(value) => patch("available", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Available now">Available now</SelectItem><SelectItem value="Limited availability">Limited availability</SelectItem><SelectItem value="Unavailable">Unavailable</SelectItem></SelectContent></Select></Field>
    <Field label="Languages" hint="Comma-separated"><Input value={profile.languages.join(", ")} onChange={(event) => patch("languages", event.target.value.split(",").map((value) => value.trim()).filter(Boolean).slice(0, 10))} /></Field>
  </div></SectionCard>;
}

function ReviewStep({ profile, validation }: { profile: SpecialistProfile; validation: Record<number, string> }) {
  return <SectionCard title="Review and submit" description="Your application is reviewed before it becomes visible in the marketplace."><div className="space-y-4"><div><p className="text-lg font-bold">{profile.name}</p><p className="text-sm text-muted-foreground">{profile.headline}</p></div><div className="flex flex-wrap gap-1.5">{profile.skills.map((skill) => <Badge key={skill} variant="outline">{skill}</Badge>)}</div><p className="whitespace-pre-wrap text-sm leading-relaxed">{profile.bio}</p>{Object.keys(validation).length ? <InfoBanner tone="warning" title="Some sections need attention">{Object.values(validation)[0]}</InfoBanner> : <InfoBanner tone="success" title="Ready to submit">Your profile has the required information. Reviewers may still request supporting evidence.</InfoBanner>}</div></SectionCard>;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><div className="flex items-center justify-between gap-2"><Label>{label}</Label>{hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}</div>{children}</div>;
}
