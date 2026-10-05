"use client";
// Screen 2 — Pricing / Plans.
// Pricing is not final, so plans are compared by capability, not price.

import React from "react";
import { ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InfoBanner } from "@/components/shared/layout";
import { useBizz } from "@/lib/store";
import { cn } from "@/lib/utils";

const PLANS = [
  {
    id: "beta",
    name: "Private Beta",
    tagline: "For founders who want their first diagnosis while the product is being built.",
    price: "Free during the beta",
    badge: "Limited places",
    featured: false,
    cta: "Join pilot",
    features: [
      "1 business workspace",
      "2 connected sources",
      "1 team member (owner)",
      "Weekly business brief",
      "3 months data history",
      "Standard diagnosis",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    tagline: "For businesses running the loop every month with a small team.",
    price: "To be confirmed at GA",
    badge: "Most popular",
    featured: true,
    cta: "Choose plan",
    features: [
      "1 business workspace",
      "Up to 5 connected sources",
      "Up to 3 team members",
      "Weekly brief + monthly review",
      "12 months data history",
      "Diagnosis with root-cause chains",
    ],
  },
  {
    id: "team",
    name: "Team",
    tagline: "For agencies and organisations managing several businesses or workspaces.",
    price: "To be confirmed at GA",
    badge: "For organisations",
    featured: false,
    cta: "Contact us",
    features: [
      "Multiple workspaces",
      "10 or more connected sources",
      "Up to 10 team members",
      "Everything in Growth + scheduled reports",
      "Unlimited data history",
      "Everything in Growth + cross-workspace view",
    ],
  },
];

const COMPARISON: { capability: string; beta: string; growth: string; team: string }[] = [
  { capability: "Businesses / workspaces", beta: "1", growth: "1", team: "Multiple" },
  { capability: "Connected sources", beta: "2", growth: "Up to 5", team: "10 or more" },
  { capability: "Team members", beta: "1 (owner)", growth: "Up to 3", team: "Up to 10" },
  { capability: "Reporting", beta: "Weekly brief", growth: "Weekly brief + monthly review", team: "Scheduled reports and exports" },
  { capability: "Data history", beta: "3 months", growth: "12 months", team: "Unlimited" },
  { capability: "Intelligence depth", beta: "Standard diagnosis", growth: "Diagnosis with root-cause chains", team: "Cross-workspace view" },
  { capability: "Price", beta: "Free during beta", growth: "To be confirmed", team: "To be confirmed" },
];

const FAQ = [
  {
    q: "When will pricing be final?",
    a: "At general availability, after the private beta closes. Pilot participants will hear about final pricing first, and beta feedback will shape the plans.",
  },
  {
    q: "What does the private beta cost?",
    a: "Nothing. The beta is free while the product is in development. In exchange we ask for honest feedback so the diagnosis, recommendations and workflows fit real businesses.",
  },
  {
    q: "What happens to my data if plans change?",
    a: "Your data belongs to you regardless of plan. You can export it as CSV or delete it entirely from Settings → Export / delete, before or after any change.",
  },
  {
    q: "Can I move between plans later?",
    a: "Capabilities will be adjustable when paid plans launch. The limits shown are indicative of how the plans will differ, not a commitment to final packaging.",
  },
];

export default function PricingScreen() {
  const navigate = useBizz((s) => s.navigate);

  const handleCta = (planId: string) => {
    if (planId === "beta") {
      toast.success("Pilot request noted", { description: "Create your account to join the private beta — places are limited." });
      navigate("signup");
    } else if (planId === "growth") {
      toast("Growth plan noted", {
        description: "Pricing is confirmed at general availability. Create an account now and we'll hold your place.",
      });
      navigate("signup");
    } else {
      toast("Message started", {
        description: "Tell us about your organisation in the feedback form and we'll follow up.",
      });
      navigate("feedback");
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Pricing</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Plans and capabilities</h1>
        <p className="mt-4 text-sm leading-relaxed text-slate-600 sm:text-base">
          bizzGrowth is in private beta. Start free, invite your team when you need them, and upgrade only when the
          product earns it.
        </p>
      </div>

      <InfoBanner tone="warning" title="Pricing to be confirmed at general availability">
        We haven&apos;t finalised commercial pricing, so the comparison below shows how capabilities differ between
        plans — not prices. Final plans and limits will be announced before general availability.
      </InfoBanner>

      {/* Plan cards */}
      <div className="mt-10 grid gap-4 lg:grid-cols-3 lg:gap-6">
        {PLANS.map((plan) => (
          <Card
            key={plan.id}
            className={cn(
              "flex h-full flex-col p-6 shadow-sm",
              plan.featured && "border-blue-600 shadow-md ring-1 ring-blue-600",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900">{plan.name}</h2>
              <Badge
                variant="outline"
                className={cn(
                  "text-[11px] font-normal",
                  plan.featured ? "border-blue-200 bg-blue-50 text-blue-700" : "bg-slate-50 text-slate-500",
                )}
              >
                {plan.badge}
              </Badge>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{plan.tagline}</p>
            <p className="mt-4 text-xl font-bold tracking-tight text-slate-900">{plan.price}</p>
            <ul className="mt-5 flex-1 space-y-2.5">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm text-slate-600">
                  <Check className={cn("mt-0.5 size-4 shrink-0", plan.featured ? "text-blue-600" : "text-emerald-500")} aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              className="mt-6 w-full"
              variant={plan.featured ? "default" : "outline"}
              onClick={() => handleCta(plan.id)}
            >
              {plan.cta}
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </Card>
        ))}
      </div>

      {/* Capability comparison */}
      <section aria-labelledby="compare-heading" className="mt-14">
        <h2 id="compare-heading" className="text-xl font-bold tracking-tight text-slate-900">
          How the plans compare
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Final packaging may change before general availability.
        </p>
        <Card className="mt-4 p-0 shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-44">Capability</TableHead>
                  <TableHead>Private Beta</TableHead>
                  <TableHead className="bg-blue-50/60 font-semibold text-blue-900">Growth</TableHead>
                  <TableHead>Team</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {COMPARISON.map((row) => (
                  <TableRow key={row.capability}>
                    <TableCell className="font-medium text-slate-700">{row.capability}</TableCell>
                    <TableCell className="text-slate-600">{row.beta}</TableCell>
                    <TableCell className="bg-blue-50/40 text-slate-700">{row.growth}</TableCell>
                    <TableCell className="text-slate-600">{row.team}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq-heading" className="mt-14 max-w-3xl">
        <h2 id="faq-heading" className="text-xl font-bold tracking-tight text-slate-900">
          Questions businesses ask
        </h2>
        <Accordion type="single" collapsible className="mt-4" defaultValue="faq-0">
          {FAQ.map((item, i) => (
            <AccordionItem key={item.q} value={`faq-${i}`}>
              <AccordionTrigger className="text-left text-sm font-medium">{item.q}</AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-slate-600">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </div>
  );
}
