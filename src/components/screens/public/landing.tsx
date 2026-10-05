"use client";
// Screen 1 — Landing Page.
// Premium public surface: problem, how it works, example diagnosis, business models,
// progressive privacy ladder, pilot testimonials and final CTA.

import React from "react";
import {
  ArrowRight,
  Briefcase,
  Calculator,
  Compass,
  Database,
  KeyRound,
  Layers,
  Lightbulb,
  Link2,
  Lock,
  MessageSquareText,
  PenLine,
  PlayCircle,
  Quote,
  RefreshCw,
  Ruler,
  SearchCheck,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProvenanceBadge } from "@/components/shared/badges";
import { useBizz } from "@/lib/store";
import { getBusiness, getPeriod } from "@/lib/data/businesses";
import { deltaPct, fmtDelta, fmtNaira, fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";

type Tone = "good" | "bad" | "attention" | "neutral";

/** Direction chip — colour encodes goodness, never direction alone. */
function DeltaChip({ delta, tone }: { delta: number; tone: Tone }) {
  const up = delta >= 0;
  const UpDown = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium tnum",
        tone === "good" && "bg-emerald-50 text-emerald-700",
        tone === "bad" && "bg-red-50 text-red-600",
        tone === "attention" && "bg-amber-50 text-amber-700",
        tone === "neutral" && "bg-slate-100 text-slate-600",
      )}
    >
      <UpDown className="size-3" aria-hidden />
      {fmtDelta(Math.round(delta))}
    </span>
  );
}

function SectionHeading({ eyebrow, title, lede }: { eyebrow: string; title: string; lede?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h2>
      {lede ? <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">{lede}</p> : null}
    </div>
  );
}

const PROBLEM_QUESTIONS = [
  "Enquiries went up this month. Why didn't revenue follow?",
  "Which channel brings the customers who actually stay?",
  "Is Instagram still worth the spend?",
  "What should my team focus on this week?",
];

const LOOP = [
  {
    icon: Compass,
    title: "Understand",
    body: "Describe your business model, customer journey and goals in a short guided conversation — no spreadsheets required.",
  },
  {
    icon: Ruler,
    title: "Measure",
    body: "Connect sources or enter aggregate numbers. The metrics that matter for your journey are tracked automatically.",
  },
  {
    icon: SearchCheck,
    title: "Diagnose",
    body: "When results move, bizzGrowth separates what changed from what it may mean — with evidence and confidence levels.",
  },
  {
    icon: Lightbulb,
    title: "Recommend",
    body: "Get specific next steps, ranked by expected impact and the effort they take for a team your size.",
  },
  {
    icon: Zap,
    title: "Act",
    body: "Assign owners, run changes as measured experiments, and keep everyone accountable in one place.",
  },
  {
    icon: RefreshCw,
    title: "Measure again",
    body: "Confirm what actually changed, record the outcome, and feed it back into your business picture.",
  },
];

const MODELS = [
  {
    icon: Briefcase,
    title: "Service businesses",
    body: "Consulting, logistics, agencies, facilities management and other businesses that win work through enquiries and quotes.",
    journey: ["Enquiries", "Qualified", "Quote", "Customer"],
    focus: "Enquiry-to-close rate, customer acquisition cost, repeat business",
  },
  {
    icon: ShoppingCart,
    title: "Ecommerce businesses",
    body: "Fashion, electronics, home goods and other online stores that sell through a website or storefront.",
    journey: ["Visit", "Product view", "Cart", "Checkout", "Order"],
    focus: "Average order value, checkout completion, payment failures",
  },
  {
    icon: Layers,
    title: "Both — hybrid",
    body: "Sell services and products together? Run both journeys in one workspace and see how each contributes to growth.",
    journey: ["One workspace", "Two journeys", "One picture"],
    focus: "Where each line of the business helps or holds you back",
  },
];

const TRUST_LADDER = [
  {
    icon: PlayCircle,
    title: "Explore the demo",
    body: "Walk through a complete sample business with realistic data — no account needed.",
    share: "Nothing at all",
  },
  {
    icon: Users,
    title: "Anonymous trends",
    body: "See how businesses like yours are trending, anonymised and aggregated across the platform.",
    share: "Industry and size only",
  },
  {
    icon: PenLine,
    title: "Enter aggregate numbers",
    body: "Type monthly totals yourself. Estimates are fine — the diagnosis adapts to what you know.",
    share: "The numbers you choose",
  },
  {
    icon: Link2,
    title: "Read-only integrations",
    body: "Connect ad platforms and your store. bizzGrowth reads data and never changes anything in your accounts.",
    share: "Read-only access",
  },
  {
    icon: KeyRound,
    title: "Optional execution permissions",
    body: "Only if you choose, let bizzGrowth draft or schedule approved actions on your behalf. Revoke anytime.",
    share: "Explicit, revocable permission",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "The first diagnosis told us our cheapest customers were coming from referrals — after six months of pouring budget into ads. That reframed our whole month.",
    name: "Chinedu A.",
    role: "Founder, haulage company · Lagos",
  },
  {
    quote:
      "I finally stopped guessing whether Instagram was working. The numbers were uncomfortable, but at least they were numbers I could act on.",
    name: "Ngozi E.",
    role: "Founder, fashion ecommerce store · Aba",
  },
  {
    quote:
      "We quote for facilities jobs. Seeing enquiry-to-close by channel in one place ended a two-month internal argument.",
    name: "Femi B.",
    role: "Managing Director, facilities services · Abuja",
  },
];

export default function LandingScreen() {
  const navigate = useBizz((s) => s.navigate);
  const setBusiness = useBizz((s) => s.setBusiness);

  const exploreSample = () => {
    setBusiness("swifthaul");
    navigate("home");
  };

  // Example diagnosis uses the shared sample dataset (SwiftHaul, September vs August 2026).
  const sample = getBusiness("swifthaul");
  const period = getPeriod(sample, "this-month");
  const diagnosisTiles = [
    {
      label: "Marketing spend",
      value: fmtNaira(period.current.spend, { compact: true }),
      delta: deltaPct(period.current.spend, period.previous.spend),
      tone: "attention" as Tone,
    },
    {
      label: "Enquiries",
      value: fmtNum(period.current.enquiries),
      delta: deltaPct(period.current.enquiries, period.previous.enquiries),
      tone: "good" as Tone,
    },
    {
      label: "New customers",
      value: fmtNum(period.current.customers),
      delta: deltaPct(period.current.customers, period.previous.customers),
      tone: "good" as Tone,
    },
    {
      label: "Revenue",
      value: fmtNaira(period.current.revenue, { compact: true }),
      delta: deltaPct(period.current.revenue, period.previous.revenue),
      tone: "good" as Tone,
    },
  ];

  return (
    <div>
      {/* 1. Hero */}
      <section className="relative overflow-hidden border-b">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(37,99,235,0.08),rgba(124,58,237,0.05)_45%,transparent_75%)]"
          aria-hidden
        />
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-16 text-center sm:px-6 sm:pb-24 sm:pt-24">
          <Badge variant="outline" className="mb-6 gap-1.5 bg-white px-3 py-1 text-xs font-normal text-slate-600">
            <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
            Private beta — now onboarding growing businesses
          </Badge>
          <h1 className="mx-auto max-w-3xl text-balance text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
            Understand what is driving your business growth —{" "}
            <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
              and what to fix next.
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-slate-600 sm:text-lg">
            Connect or enter your business information and turn scattered marketing, sales and website signals into
            clear decisions.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" className="h-12 px-6 text-base" onClick={() => navigate("signup")}>
              Get a private business checkup
              <ArrowRight className="size-4" aria-hidden />
            </Button>
            <Button size="lg" variant="outline" className="h-12 bg-white px-6 text-base" onClick={exploreSample}>
              Explore a sample business
            </Button>
          </div>
          <ul className="mx-auto mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-500">
            <li className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-blue-600" aria-hidden />
              Read-only by default
            </li>
            <li className="flex items-center gap-1.5">
              <Calculator className="size-3.5 text-blue-600" aria-hidden />
              Estimates are welcome
            </li>
            <li className="flex items-center gap-1.5">
              <Lock className="size-3.5 text-blue-600" aria-hidden />
              Your data stays yours
            </li>
          </ul>
        </div>
      </section>

      {/* 2. The problem */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">The problem</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                We have information everywhere, but we don&apos;t know what it means.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
                Ad dashboards, WhatsApp orders, spreadsheets, bank alerts, storefront analytics. Each tool shows a
                slice of the business. None of them tell you what to do next — and hiring an analyst isn&apos;t
                realistic for most growing businesses.
              </p>
              <p className="mt-3 text-sm font-medium text-slate-700">Questions you have probably asked:</p>
              <div className="mt-3 space-y-3">
                {PROBLEM_QUESTIONS.map((q) => (
                  <div key={q} className="flex items-start gap-3 rounded-xl border bg-white p-3.5 shadow-sm">
                    <MessageSquareText className="mt-0.5 size-4 shrink-0 text-blue-600" aria-hidden />
                    <p className="text-sm text-slate-700">{q}</p>
                  </div>
                ))}
              </div>
            </div>
            <Card className="p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Signals your business already produces
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {["Meta Ads", "Google Ads", "WhatsApp orders", "Website analytics", "Shopify", "Bank alerts", "Spreadsheets"].map(
                  (s) => (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1.5 rounded-full border bg-slate-50 px-3 py-1.5 text-xs text-slate-600"
                    >
                      <Database className="size-3 text-slate-400" aria-hidden />
                      {s}
                    </span>
                  ),
                )}
              </div>
              <div className="my-5 flex justify-center" aria-hidden>
                <ArrowRight className="size-4 rotate-90 text-slate-300" />
              </div>
              <div className="rounded-lg border border-violet-200 bg-violet-50/60 p-4">
                <p className="flex items-start gap-2 text-sm font-medium leading-relaxed text-violet-900">
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-violet-600" aria-hidden />
                  One clear picture: what changed, why it may have happened, and what to do next.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* 3. How it works — the loop */}
      <section className="border-y bg-slate-50/70">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <SectionHeading
            eyebrow="How it works"
            title="A continuous loop, not another dashboard"
            lede="bizzGrowth closes the gap between seeing numbers and acting on them. Every month the loop repeats, and the picture gets sharper."
          />
          <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {LOOP.map((step, i) => {
              const Icon = step.icon;
              return (
                <li key={step.title}>
                  <Card className="relative h-full p-5 shadow-sm">
                    <span className="absolute right-4 top-4 text-xs font-semibold text-slate-300 tnum">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="flex size-10 items-center justify-center rounded-lg bg-blue-50">
                      <Icon className="size-5 text-blue-600" aria-hidden />
                    </span>
                    <h3 className="mt-4 text-sm font-semibold text-slate-900">{step.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{step.body}</p>
                  </Card>
                </li>
              );
            })}
          </ol>
          <p className="mt-8 flex items-center justify-center gap-2 text-center text-sm text-slate-500">
            <RefreshCw className="size-3.5 text-violet-600" aria-hidden />
            Act, measure, and feed the result back — so the next diagnosis is sharper than the last.
          </p>
        </div>
      </section>

      {/* 4. Example diagnosis preview */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <SectionHeading
            eyebrow="What you get"
            title="A diagnosis, not just a dashboard"
            lede="This is the kind of conclusion bizzGrowth produces — with the evidence, confidence and provenance attached."
          />
          <Card className="mx-auto mt-10 max-w-3xl p-0 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">SwiftHaul Logistics — sample service business</p>
                <p className="text-xs text-muted-foreground">
                  {period.label} {period.compareLabel}
                </p>
              </div>
              <ProvenanceBadge provenance="ai-interpretation" />
            </div>
            <div className="grid grid-cols-2 gap-3 p-5 lg:grid-cols-4">
              {diagnosisTiles.map((t) => (
                <div key={t.label} className="rounded-lg border bg-white p-3.5">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{t.label}</p>
                  <p className="mt-1 text-lg font-bold tnum">{t.value}</p>
                  <div className="mt-1.5">
                    <DeltaChip delta={t.delta} tone={t.tone} />
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-violet-100 bg-violet-50/60 px-5 py-4">
              <p className="flex items-start gap-2 text-sm leading-relaxed text-violet-900">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-violet-600" aria-hidden />
                <span>
                  <span className="font-semibold">What this may mean:</span> Marketing spend and enquiries are growing
                  far faster than new customers and revenue. Your immediate growth constraint may not be lead
                  generation — it is more likely between enquiry and paying customer.
                </span>
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 sm:pl-6">
                <Badge variant="outline" className="border-violet-200 bg-white text-[11px] font-normal text-violet-700">
                  Medium confidence
                </Badge>
                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={exploreSample}>
                  Explore this sample business
                  <ArrowRight className="size-3.5" aria-hidden />
                </Button>
              </div>
            </div>
          </Card>
          <p className="mx-auto mt-4 max-w-3xl text-center text-xs text-muted-foreground">
            Example uses the sample business included with every account. Your own diagnosis is private to your
            workspace.
          </p>
        </div>
      </section>

      {/* 5. Business models supported */}
      <section className="border-y bg-slate-50/70">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <SectionHeading
            eyebrow="Built for how you sell"
            title="Two journeys. One operating system."
            lede="The same loop adapts to your business model — only the labels and metrics change."
          />
          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {MODELS.map((m) => {
              const Icon = m.icon;
              return (
                <Card key={m.title} className="flex h-full flex-col p-6 shadow-sm">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-blue-50">
                    <Icon className="size-5 text-blue-600" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-sm font-semibold text-slate-900">{m.title}</h3>
                  <p className="mt-1.5 flex-1 text-sm leading-relaxed text-slate-600">{m.body}</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {m.journey.map((j, i) => (
                      <span key={j} className="flex items-center gap-1.5">
                        {i > 0 && <span className="text-slate-300" aria-hidden>→</span>}
                        <span className="rounded-full border bg-white px-2.5 py-0.5 text-[11px] text-slate-600">{j}</span>
                      </span>
                    ))}
                  </div>
                  <p className="mt-4 border-t pt-3 text-xs text-slate-500">
                    <span className="font-medium text-slate-600">Focus metrics: </span>
                    {m.focus}
                  </p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* 6. Progressive privacy & trust ladder */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <SectionHeading
            eyebrow="Progressive privacy"
            title="Share only what you're comfortable with"
            lede="bizzGrowth works in steps. Start with nothing at all, and move up the ladder only when you see the value."
          />
          <ol className="relative mx-auto mt-10 max-w-3xl space-y-4 before:absolute before:bottom-8 before:left-6 before:top-8 before:hidden before:w-px before:bg-slate-200 sm:before:block">
            {TRUST_LADDER.map((step, i) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                  <span className="relative z-10 flex size-12 shrink-0 items-center justify-center rounded-full border bg-white shadow-sm">
                    <Icon className="size-5 text-blue-600" aria-hidden />
                  </span>
                  <Card className="flex-1 p-4 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        <span className="mr-1.5 text-slate-400 tnum">{i + 1}.</span>
                        {step.title}
                      </p>
                      <Badge variant="outline" className="bg-slate-50 text-[11px] font-normal text-slate-600">
                        You share: {step.share}
                      </Badge>
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{step.body}</p>
                  </Card>
                </li>
              );
            })}
          </ol>
          <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-slate-500">
            Most pilot businesses started at step 3 and connected integrations in week two. You can stop at any step —
            and step down just as easily.
          </p>
        </div>
      </section>

      {/* 7. Testimonials */}
      <section className="border-y bg-slate-50/70">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <SectionHeading
            eyebrow="Early signals"
            title="What pilot participants check first"
            lede="Businesses in the private beta are using bizzGrowth to settle the questions that used to start arguments."
          />
          <div className="mt-10 grid gap-4 lg:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <Card key={t.name} className="flex h-full flex-col p-6 shadow-sm">
                <Quote className="size-5 text-slate-300" aria-hidden />
                <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-700">&ldquo;{t.quote}&rdquo;</p>
                <div className="mt-5 flex items-center justify-between gap-3 border-t pt-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-[10px] font-normal text-slate-500">
                    Private beta pilot participant
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Names shortened; quotes are representative of private beta pilot feedback.
          </p>
        </div>
      </section>

      {/* 8. Final CTA */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="relative mx-auto max-w-3xl overflow-hidden rounded-2xl bg-slate-900 px-6 py-12 text-center shadow-sm sm:px-12">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(80%_80%_at_50%_0%,rgba(37,99,235,0.35),transparent_70%)]"
              aria-hidden
            />
            <div className="relative">
              <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Start with a private business checkup
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
                Ten minutes from now you could be looking at what is actually driving your growth — no integrations
                required.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button
                  size="lg"
                  className="h-12 bg-white px-6 text-base text-slate-900 hover:bg-slate-100"
                  onClick={() => navigate("signup")}
                >
                  Get a private business checkup
                  <ArrowRight className="size-4" aria-hidden />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 border-slate-700 bg-transparent px-6 text-base text-slate-200 hover:bg-slate-800 hover:text-white"
                  onClick={exploreSample}
                >
                  Explore a sample business
                </Button>
              </div>
              <p className="mt-6 text-xs text-slate-400">
                Free during the private beta · Read-only by default · Your data stays yours
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
