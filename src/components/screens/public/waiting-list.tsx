"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, BriefcaseBusiness, CheckCircle2, Loader2, LockKeyhole, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBizz } from "@/lib/store";
import { WAITLIST_EXPERIENCE_OPTIONS, type WaitlistAudience } from "@/lib/waitlist";

type SubmitResponse = { ok?: boolean; error?: string; field?: string };

export default function WaitingListScreen() {
  const navigate = useBizz((state) => state.navigate);
  const [audience, setAudience] = useState<WaitlistAudience>("business");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [experience, setExperience] = useState("");
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function updateField(field: string, setter: (value: string) => void, value: string) {
    setter(value);
    if (fieldError === field) {
      setFieldError("");
      setError("");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFieldError("");
    setSubmitting(true);
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          audience,
          businessName: audience === "business" ? businessName : undefined,
          industry: audience === "business" ? industry : undefined,
          specialty: audience === "specialist" ? specialty : undefined,
          experience: audience === "specialist" ? experience : undefined,
          website,
        }),
      });
      const result = (await response.json().catch(() => ({}))) as SubmitResponse;
      if (!response.ok || !result.ok) {
        if (result.field) setFieldError(result.field);
        throw new Error(result.error || "We couldn't save your request. Please try again.");
      }
      setSubmitted(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't save your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const inputError = (field: string) => (fieldError === field ? "border-red-500 focus-visible:ring-red-500/30" : "");

  return (
    <div className="bg-slate-50">
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 sm:gap-10 sm:px-6 sm:py-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-start lg:gap-16 lg:py-20">
        <section className="pt-2 lg:pt-8" aria-labelledby="waiting-list-title">
          <h1 id="waiting-list-title" className="max-w-xl text-4xl font-bold leading-tight tracking-tight text-slate-950 sm:text-5xl">
            Get first access to Nellovia.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
            We’re preparing a better way for businesses to understand what is driving growth — and for specialists to help them act on it.
          </p>
          <div className="mt-9 hidden max-w-lg border-t border-slate-200 pt-6 sm:block">
            <p className="text-sm font-semibold text-slate-900">Choose the list that fits you</p>
            <ul className="mt-4 space-y-4 text-sm leading-relaxed text-slate-600">
              <li className="flex gap-3">
                <BriefcaseBusiness className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
                <span><strong className="font-semibold text-slate-800">Businesses</strong> get a clearer picture of their growth and what to improve next.</span>
              </li>
              <li className="flex gap-3">
                <UserRound className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
                <span><strong className="font-semibold text-slate-800">Specialists</strong> bring their expertise to businesses ready to make progress.</span>
              </li>
            </ul>
          </div>
          <p className="mt-8 hidden items-center gap-2 text-xs text-slate-500 sm:flex">
            <LockKeyhole className="size-3.5 text-brand-600" aria-hidden />
            Your details are used only to manage early access.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-8" aria-label="Early access request">
          {submitted ? (
            <div className="py-8 text-center sm:py-12" role="status">
              <CheckCircle2 className="mx-auto size-10 text-emerald-600" aria-hidden />
              <h2 className="mt-4 text-xl font-bold text-slate-900">You’re on the list.</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-600">
                Thanks for your interest. We’ll use your details to manage early access and share updates about getting started.
              </p>
              <Button variant="outline" className="mt-6" onClick={() => navigate("landing")}>Back to Nellovia</Button>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">Join the waiting list</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">This request does not create an account.</p>

              <form className="mt-4 space-y-3 sm:mt-6 sm:space-y-4" onSubmit={(event) => void submit(event)} noValidate>
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium text-slate-800">I’m joining as a</legend>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { value: "business", label: "Business", Icon: BriefcaseBusiness },
                      { value: "specialist", label: "Specialist", Icon: UserRound },
                    ] as const).map(({ value, label, Icon }) => (
                      <button
                        key={value}
                        type="button"
                        disabled={submitting}
                        aria-pressed={audience === value}
                        onClick={() => {
                          setAudience(value);
                          setFieldError("");
                          setError("");
                        }}
                        className={`flex min-h-11 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 ${
                          audience === value ? "border-brand-600 bg-brand-50 text-brand-800" : "border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <Icon className="size-4" aria-hidden />
                        {label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="waitlist-name">Full name</Label>
                    <Input id="waitlist-name" autoComplete="name" maxLength={120} value={name} onChange={(event) => updateField("name", setName, event.target.value)} className={inputError("name")} aria-invalid={fieldError === "name"} aria-describedby={fieldError === "name" ? "waitlist-error" : undefined} required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="waitlist-email">Email address</Label>
                    <Input id="waitlist-email" type="email" autoComplete="email" maxLength={254} value={email} onChange={(event) => updateField("email", setEmail, event.target.value)} className={inputError("email")} aria-invalid={fieldError === "email"} aria-describedby={fieldError === "email" ? "waitlist-error" : undefined} required />
                  </div>
                </div>

                {audience === "business" ? (
                  <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="waitlist-business">Business name</Label>
                      <Input id="waitlist-business" autoComplete="organization" maxLength={140} value={businessName} onChange={(event) => updateField("businessName", setBusinessName, event.target.value)} className={inputError("businessName")} aria-invalid={fieldError === "businessName"} aria-describedby={fieldError === "businessName" ? "waitlist-error" : undefined} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="waitlist-industry">Industry</Label>
                      <Input id="waitlist-industry" maxLength={120} value={industry} onChange={(event) => updateField("industry", setIndustry, event.target.value)} placeholder="e.g. Retail, logistics" className={inputError("industry")} aria-invalid={fieldError === "industry"} aria-describedby={fieldError === "industry" ? "waitlist-error" : undefined} required />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="waitlist-specialty">Area of expertise</Label>
                      <Input id="waitlist-specialty" maxLength={140} value={specialty} onChange={(event) => updateField("specialty", setSpecialty, event.target.value)} placeholder="e.g. Paid media, finance" className={inputError("specialty")} aria-invalid={fieldError === "specialty"} aria-describedby={fieldError === "specialty" ? "waitlist-error" : undefined} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="waitlist-experience">Years of experience</Label>
                      <Select value={experience} onValueChange={(value) => updateField("experience", setExperience, value)}>
                        <SelectTrigger id="waitlist-experience" aria-label="Years of experience" aria-required="true" aria-invalid={fieldError === "experience"} aria-describedby={fieldError === "experience" ? "waitlist-error" : undefined} className={`w-full ${inputError("experience")}`}>
                          <SelectValue placeholder="Choose a range" />
                        </SelectTrigger>
                        <SelectContent>
                          {WAITLIST_EXPERIENCE_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <div className="absolute -left-[10000px] top-auto size-px overflow-hidden" aria-hidden="true">
                  <Label htmlFor="waitlist-website">Leave this field empty</Label>
                  <Input id="waitlist-website" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
                </div>

                {error ? <p id="waitlist-error" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">{error}</p> : null}

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                  {submitting ? "Adding you…" : "Join the waiting list"}
                  {!submitting ? <ArrowRight className="size-4" aria-hidden /> : null}
                </Button>
                <p className="text-xs leading-relaxed text-slate-500">
                  We’ll use your details only to manage early access. Read our{" "}
                  <button type="button" className="font-medium text-brand-700 underline underline-offset-2" onClick={() => navigate("privacy-policy")}>Privacy Policy</button>.
                </p>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
