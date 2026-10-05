"use client";
// Screen 93 — Help & Support.

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { BookOpen, ChevronRight, LifeBuoy, Search } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, SectionCard } from "@/components/shared/layout";
import { useBizz } from "@/lib/store";

interface Topic {
  id: string;
  title: string;
  faqs: { q: string; a: string }[];
}

const TOPICS: Topic[] = [
  {
    id: "connections",
    title: "Connections",
    faqs: [
      {
        q: "Why did my Shopify connection stop syncing?",
        a: "Access tokens can expire. Open the source settings and reconnect — the link refreshes authorization and backfills any gap. Historical data is retained.",
      },
      {
        q: "What can bizzGrowth read from a connected source?",
        a: "Only read-only reporting data, such as spend, orders and funnel metrics. We never modify campaigns, budgets or store content, and we cannot move money.",
      },
      {
        q: "How often do sources sync?",
        a: "Connected sources sync roughly every hour. You can trigger a manual sync at any time from the source's settings page.",
      },
    ],
  },
  {
    id: "uploads",
    title: "Data uploads",
    faqs: [
      {
        q: "Which file types can I upload?",
        a: "CSV and Excel files up to about 10,000 rows. Download the sample template from the upload page to see the expected column layout.",
      },
      {
        q: "What happens to duplicate rows?",
        a: "Duplicates are skipped and listed in the import result, so your totals stay clean. Everything else imports exactly as mapped.",
      },
      {
        q: "Can I fix a mistake after importing?",
        a: "Yes — open Manual data history, edit or delete the entry, and the diagnosis recalculates. Provenance records keep track of the change.",
      },
    ],
  },
  {
    id: "diagnosis",
    title: "Diagnosis",
    faqs: [
      {
        q: "Why does a diagnosis show low confidence?",
        a: "Low confidence is not an error — it means data coverage is limited. Connect a source or enter totals to raise it. We never dress uncertainty up as certainty.",
      },
      {
        q: "What does 'AI interpretation' mean?",
        a: "It marks a conclusion produced by reasoning over evidence rather than a direct measurement. Measured, user-supplied and estimated figures are labelled separately.",
      },
      {
        q: "Can I dispute a diagnosis?",
        a: "Yes. Use Send feedback with the type 'AI diagnosis concern' and include the diagnosis title — a reviewer will look at it.",
      },
    ],
  },
  {
    id: "actions",
    title: "Actions",
    faqs: [
      {
        q: "Who can assign actions?",
        a: "The Owner and Admins create actions and assign owners. Members work on the actions assigned to them and can add notes and checklist progress.",
      },
      {
        q: "What happens when I mark an action implemented?",
        a: "A measurement window opens so results can be interpreted honestly — including any other changes that happened in the same period.",
      },
      {
        q: "Can I record changes I made outside bizzGrowth?",
        a: "Yes — add them to the Business timeline. The change ledger keeps attribution honest when we interpret results.",
      },
    ],
  },
  {
    id: "billing",
    title: "Billing",
    faqs: [
      {
        q: "How much does bizzGrowth cost?",
        a: "The Private Beta is free. Indicative pricing for the Growth and Team plans is on the upgrade page — pricing there is illustrative for this prototype.",
      },
      {
        q: "Where are my invoices?",
        a: "Under Plan & Subscription → View invoices. During beta the invoice table is illustrative — no real charges have been made.",
      },
      {
        q: "How do I change my payment method?",
        a: "Open Plan & Subscription → Manage payment method. At least one method must stay on file, and changes apply to the next renewal.",
      },
    ],
  },
  {
    id: "account",
    title: "Account",
    faqs: [
      {
        q: "How do I change my name, email or photo?",
        a: "Go to Settings → Your profile. Changes apply everywhere your name appears, including action history.",
      },
      {
        q: "How do I remove a team member?",
        a: "Team Members → select the member → Remove access. The workspace Owner cannot be removed while beta ownership transfer is unavailable.",
      },
      {
        q: "Can I export everything?",
        a: "Yes — Settings → Export & delete offers a report PDF and a full data archive by email, plus workspace deletion with strong confirmation.",
      },
    ],
  },
];

const GUIDES = [
  "Connect your first data source",
  "Read your first diagnosis",
  "Set up your first goal",
  "Invite your team",
  "Run your first experiment",
];

export function HelpSupport() {
  const navigate = useBizz((s) => s.navigate);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TOPICS;
    return TOPICS.map((t) => ({
      ...t,
      faqs: t.faqs.filter((f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q) || t.title.toLowerCase().includes(q)),
    })).filter((t) => t.faqs.length > 0);
  }, [query]);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="Help & Support"
        description="Search the topics below, or send us a message — we review every report."
        actions={
          <Button onClick={() => navigate("feedback")}>
            <LifeBuoy className="mr-1.5 size-4" aria-hidden /> Contact support
          </Button>
        }
      />

      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search help topics — e.g. 'sync', 'confidence', 'invoices'…"
          className="pl-9"
          aria-label="Search help topics"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-slate-50/60 px-6 py-12 text-center">
              <p className="text-sm font-medium">No help topics match &ldquo;{query}&rdquo;</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try a different word, or contact support and we will help directly.
              </p>
              <Button size="sm" variant="outline" className="mt-4" onClick={() => navigate("feedback")}>
                Contact support
              </Button>
            </div>
          ) : (
            filtered.map((topic) => (
              <SectionCard key={topic.id} title={topic.title} contentClassName="p-0">
                <Accordion type="single" collapsible className="px-5 py-1">
                  {topic.faqs.map((f, i) => (
                    <AccordionItem key={i} value={`${topic.id}-${i}`}>
                      <AccordionTrigger className="text-left text-sm font-medium">{f.q}</AccordionTrigger>
                      <AccordionContent className="text-sm leading-relaxed text-muted-foreground">{f.a}</AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </SectionCard>
            ))
          )}
        </div>

        <div className="space-y-4">
          <SectionCard title="Guides" description="Short walkthroughs for the first week.">
            <ul className="space-y-1">
              {GUIDES.map((g) => (
                <li key={g}>
                  <button
                    type="button"
                    onClick={() => toast("Guides open in the full product", { description: `"${g}" would open as a step-by-step walkthrough.` })}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="flex items-center gap-2">
                      <BookOpen className="size-3.5 shrink-0 text-slate-400" aria-hidden />
                      {g}
                    </span>
                    <ChevronRight className="size-3.5 shrink-0 text-slate-300" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="Still stuck?">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Send a message with the type that fits best — bug, data concern or AI diagnosis concern — and the right
              team will pick it up. Reports during beta are answered first.
            </p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("feedback")}>
              Send feedback
            </Button>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
