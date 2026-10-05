"use client";
// Screen 71 — Business Profile / Business Brain overview.
// Shows what the system currently understands, with provenance and confidence
// on every fact, plus jump-off cards into the five configuration tabs.

import React, { useState } from "react";
import { toast } from "sonner";
import { useBizz } from "@/lib/store";
import { getBusiness } from "@/lib/data/businesses";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/layout";
import { ProvenanceBadge, ConfidenceBadge } from "@/components/shared/badges";
import { ProvenanceLegend } from "@/components/shared/evidence";
import { ArrowRight, Pencil } from "lucide-react";
import type { ConfidenceLevel, Provenance } from "@/lib/types";
import type { ScreenProps } from "../view-types";
import { trackedChannelCount } from "./parts";

interface KeyFact {
  label: string;
  value: string;
  provenance: Provenance;
  source: string;
  confidence: ConfidenceLevel;
}

const BRAIN_TABS = [
  { id: "products", label: "Products & services" },
  { id: "customers", label: "Customers" },
  { id: "journey", label: "Journey" },
  { id: "channels", label: "Channels" },
  { id: "priorities", label: "Priorities" },
] as const;

export function BrainOverview({ params: _params }: ScreenProps) {
  const navigate = useBizz((s) => s.navigate);
  const businessId = useBizz((s) => s.businessId);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const business = getBusiness(businessId, userWorkspace);

  const [tab, setTab] = useState("overview");
  const onTabChange = (v: string) => {
    if (v === "overview") return;
    navigate(`brain/${v}`);
  };

  const facts: KeyFact[] = [
    { label: "Business name", value: business.name, provenance: "user-supplied", source: "Workspace setup", confidence: "high" },
    {
      label: "Business type",
      value: business.type === "service" ? "Service business" : "Ecommerce store",
      provenance: "user-supplied",
      source: "Workspace setup",
      confidence: "high",
    },
    { label: "Location", value: business.location, provenance: "user-supplied", source: "Workspace setup", confidence: "high" },
    { label: "Business model", value: business.model, provenance: "user-supplied", source: "Conversational checkup", confidence: "medium" },
    ...(business.platform
      ? [{ label: "Platform", value: business.platform, provenance: "measured" as Provenance, source: "Connected source", confidence: "high" as ConfidenceLevel }]
      : []),
    { label: "Primary goal", value: business.goal, provenance: "user-supplied", source: "Conversational checkup", confidence: "medium" },
  ];

  const { tracked, total } = trackedChannelCount(business.type);
  const serviceCount = business.services?.length ?? 0;
  const activeCount = business.services?.filter((s) => s.active).length ?? 0;
  const productCount = business.products?.length ?? 0;

  const sectionCards = [
    {
      route: "brain/products",
      title: "Products & services",
      description: "What you sell, at what prices, and what is currently active. Feeds revenue and conversion analysis.",
      fact: business.type === "service" ? `${serviceCount} services · ${activeCount} active` : `${productCount} products tracked via ${business.platform ?? "your store"}`,
    },
    {
      route: "brain/customers",
      title: "Customers",
      description: "Primary segments, the B2B/B2C mix, locations and the typical customer.",
      fact: business.type === "service" ? "B2B SMEs 60% of revenue · B2C individuals 40%" : "Home-decor shoppers, 25–45, urban and mobile-first",
    },
    {
      route: "brain/journey",
      title: "Customer journey",
      description: "The steps customers take from discovery to repeat purchase. Funnel analysis uses this model.",
      fact: `${business.journey.length} steps · ${business.journey[0]} → ${business.journey[business.journey.length - 1]}`,
    },
    {
      route: "brain/channels",
      title: "Channels",
      description: "Acquisition, sales, marketing and communication channels, marked tracked or untracked.",
      fact: `${tracked} of ${total} channels tracked`,
    },
    {
      route: "brain/priorities",
      title: "Priorities",
      description: "How the five growth priorities are ranked, and the primary goal the AI optimises for.",
      fact: business.goal,
    },
  ];

  const editNote = () => toast("Inline editing available in each configuration tab", { description: "Open the related tab to change this fact." });

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        title="Business Brain"
        description="This is what the system currently understands about your business. Every fact carries its provenance and confidence — and each area can be corrected."
      />

      <ProvenanceLegend className="mb-5" />

      <Tabs value={tab} onValueChange={onTabChange}>
        <TabsList className="mb-5 h-auto flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {BRAIN_TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <p className="-mt-3 mb-5 text-xs text-muted-foreground">Selecting a tab opens its configuration screen.</p>

      <section aria-label="Key facts" className="rounded-xl border">
        <div className="border-b bg-slate-50/70 px-5 py-3">
          <h2 className="text-sm font-semibold">Key facts</h2>
        </div>
        <ul>
          {facts.map((f) => (
            <li key={f.label} className="flex flex-col gap-2 border-b px-5 py-3.5 last:border-0 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{f.label}</p>
                <p className="mt-0.5 text-sm font-medium">{f.value}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ProvenanceBadge provenance={f.provenance} source={f.source} />
                <ConfidenceBadge level={f.confidence} />
                <Button variant="ghost" size="icon" className="size-8" onClick={editNote} aria-label={`Edit ${f.label.toLowerCase()}`}>
                  <Pencil className="size-3.5" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Configure each area</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {sectionCards.map((c) => (
          <Card
            key={c.route}
            role="button"
            tabIndex={0}
            onClick={() => navigate(c.route)}
            onKeyDown={(e) => e.key === "Enter" && navigate(c.route)}
            className="flex cursor-pointer flex-col p-5 transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-[15px] font-semibold">{c.title}</h3>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">{c.description}</p>
            <p className="mt-3 text-sm font-medium tnum">{c.fact}</p>
            <div className="mt-4">
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(c.route);
                }}
              >
                Configure
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
