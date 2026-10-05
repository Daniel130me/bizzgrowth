"use client";
// Screens 48–49 — Ask Your Business + Conversation History.
// Answers are canned but always grounded in the shared dataset numbers,
// with AI interpretation explicitly labelled (Ask principle).

import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CircleDashed,
  Database,
  History,
  MessageCircleQuestion,
  Search,
  Send,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/states";
import { PageHeader } from "@/components/shared/layout";
import { ProvenanceBadge } from "@/components/shared/badges";
import { useBizz } from "@/lib/store";
import { getBusiness } from "@/lib/data/businesses";
import type { BusinessType, Provenance } from "@/lib/types";
import type { ViewMap } from "../view-types";

// ---------- Canned answer model ----------

interface AskEvidence {
  label: string;
  value: string;
  provenance: Provenance;
  source: string;
  factId?: string;
}

interface AnswerContent {
  grounded: string[];
  interpretation?: string;
  limitations?: string[];
  evidence: AskEvidence[];
  referencedPeriod: string;
}

const SH_ENQUIRY: AnswerContent = {
  grounded: [
    "Instagram produced 184 enquiries during September but only 11 became customers (6.0%), compared with 24 customers from 62 Google enquiries (38.7%). Referral converted 31 enquiries into 14 customers (45.2%).",
    "Enquiries grew 50% month over month while customers grew only 4% — the top of the funnel is working; conversion is not. We do not currently know whether lower conversion is caused by lead quality or follow-up speed — the faster-follow-up experiment is tracking toward 8–9%.",
  ],
  interpretation:
    "The main issue therefore appears to be conversion quality rather than enquiry volume.",
  limitations: [
    "Response times are not recorded, so lead quality and follow-up speed cannot be separated yet.",
    "23% of September customers have no recorded acquisition source, so channel conversion figures could shift slightly.",
  ],
  evidence: [
    { label: "Instagram enquiries → customers", value: "184 → 11", provenance: "measured", source: "Meta Ads + manual reconciliation", factId: "prov-sh-instagram-enquiries" },
    { label: "Google enquiries → customers", value: "62 → 24", provenance: "measured", source: "Google Ads integration" },
    { label: "Referral enquiries → customers", value: "31 → 14", provenance: "user-supplied", source: "Entered by Tunde Bakare (Sales Manager)", factId: "prov-sh-referral" },
    { label: "Instagram CAC", value: "₦18,182", provenance: "estimated", source: "₦200,000 spend ÷ 11 customers", factId: "prov-sh-cac-instagram" },
  ],
  referencedPeriod: "September 2026",
};

const KH_ORDERS: AnswerContent = {
  grounded: [
    "Traffic grew 24% to 18,430 visitors, but orders fell 8% to 740.",
    "Mobile checkout completion fell from 71% to 48% and payment failures rose 31%; desktop completion was broadly stable (78% → 77%).",
  ],
  interpretation: "Demand is healthy — the checkout is the constraint.",
  limitations: [
    "Exit-step error logs are not captured, so the exact failing checkout step is not yet known.",
    "Heatmaps and session recordings would pinpoint where mobile users abandon.",
  ],
  evidence: [
    { label: "Traffic (September)", value: "18,430 (+24%)", provenance: "measured", source: "Shopify" },
    { label: "Orders (September)", value: "740 (−8%)", provenance: "measured", source: "Shopify" },
    { label: "Mobile checkout completion", value: "48% (Aug: 71%)", provenance: "measured", source: "Shopify checkout analytics", factId: "prov-kh-checkout" },
    { label: "Payment failures", value: "+31% vs August", provenance: "measured", source: "Paystack via Shopify", factId: "prov-kh-payment-failures" },
  ],
  referencedPeriod: "September 2026",
};

const SH_FOCUS: AnswerContent = {
  grounded: [
    "Three things: (1) keep the faster-follow-up experiment unchanged — 18 days remain; (2) complete lead-status tracking (2 checklist items); (3) avoid budget changes until the experiment closes.",
  ],
  interpretation:
    "Holding spend steady keeps the experiment attributable — a budget change now would confound the result.",
  evidence: [
    { label: "Faster-follow-up experiment", value: "18 days remaining", provenance: "measured", source: "Experiment exp-sh-1" },
    { label: "Instagram conversion (baseline)", value: "6.0%", provenance: "measured", source: "Meta Ads + manual reconciliation", factId: "prov-sh-instagram-enquiries" },
    { label: "Lead-status checklist", value: "2 items open", provenance: "user-supplied", source: "Action act-sh-1" },
  ],
  referencedPeriod: "Week of Sep 28 – Oct 4",
};

const KH_FOCUS: AnswerContent = {
  grounded: [
    "Three things: (1) reconnect Shopify — the sync has been paused since authorization expired at 14:03; (2) start the mobile checkout repair — completion fell from 71% to 48%; (3) hold ad budget changes until checkout recovers, since traffic is already growing (+24%).",
  ],
  interpretation:
    "Fixing the checkout converts demand you have already paid for — it is cheaper than buying more traffic.",
  evidence: [
    { label: "Shopify sync", value: "Paused — authorization expired", provenance: "measured", source: "Data Centre" },
    { label: "Mobile checkout completion", value: "48% (Aug: 71%)", provenance: "measured", source: "Shopify checkout analytics", factId: "prov-kh-checkout" },
    { label: "Traffic (September)", value: "18,430 (+24%)", provenance: "measured", source: "Shopify" },
  ],
  referencedPeriod: "Week of Sep 28 – Oct 4",
};

const SH_CHANNEL: AnswerContent = {
  grounded: [
    "Referral converts best (45.2%) but is small (31 enquiries). Google Search is the best scalable channel: 38.7% conversion at ₦6,250 CAC.",
    "Instagram is the largest volume channel (184 enquiries) but converts at 6.0% with a CAC of ₦18,182.",
  ],
  interpretation:
    "Shifting incremental budget toward Google Search is the most reliable growth lever while the Instagram conversion question is being tested.",
  evidence: [
    { label: "Referral conversion", value: "45.2%", provenance: "user-supplied", source: "Entered by Tunde Bakare (Sales Manager)", factId: "prov-sh-referral" },
    { label: "Google conversion", value: "38.7%", provenance: "measured", source: "Google Ads integration" },
    { label: "Google CAC", value: "₦6,250", provenance: "estimated", source: "₦150,000 spend ÷ 24 customers" },
    { label: "Instagram CAC", value: "₦18,182", provenance: "estimated", source: "₦200,000 spend ÷ 11 customers", factId: "prov-sh-cac-instagram" },
  ],
  referencedPeriod: "September 2026",
};

const KH_CHANNEL: AnswerContent = {
  grounded: [
    "Instagram Ads produced the most orders (296 of 740) and revenue (₦2.48m) at ₦1,081 CAC. Google Search followed with 222 orders at ₦946 CAC.",
    "Organic social (133 orders) and direct/repeat visits (89 orders) carry no ad spend — they are the most profitable order sources.",
  ],
  interpretation:
    "Paid channels are buying traffic efficiently, but the lost orders are recoverable at the checkout rather than at the ad level.",
  evidence: [
    { label: "Instagram Ads orders", value: "296", provenance: "measured", source: "Shopify + Meta Ads spend" },
    { label: "Google Search orders", value: "222", provenance: "measured", source: "Shopify + Google Ads spend" },
    { label: "Organic + repeat orders", value: "222 combined", provenance: "measured", source: "Shopify" },
    { label: "Blended CAC", value: "₦716 (Aug: ₦696)", provenance: "estimated", source: "₦530,000 spend ÷ 740 orders" },
  ],
  referencedPeriod: "September 2026",
};

const SH_CHANGED: AnswerContent = {
  grounded: [
    "Spend +40% (₦370k), enquiries +50% (277), customers +4% (49), revenue +3% (₦6.0m).",
    "Instagram spend rose ~10% during the experiment window (detected Sep 24). It is tracked as an external change so it does not contaminate experiment attribution.",
  ],
  limitations: [
    "Revenue is user-supplied and cannot yet be verified against an accounting source.",
  ],
  evidence: [
    { label: "Marketing spend", value: "₦370,000 (+40%)", provenance: "measured", source: "Meta Ads + Google Ads" },
    { label: "Enquiries", value: "277 (+50%)", provenance: "measured", source: "Manual entry + channel reconciliation" },
    { label: "Customers", value: "49 (+4%)", provenance: "user-supplied", source: "Manual monthly submission" },
    { label: "Revenue", value: "₦6,000,000 (+3%)", provenance: "user-supplied", source: "Manual monthly submission", factId: "prov-sh-revenue" },
    { label: "Instagram spend", value: "+~10% from Sep 24", provenance: "measured", source: "Meta Ads (detected)" },
  ],
  referencedPeriod: "Sep vs Aug 2026",
};

const KH_CHANGED: AnswerContent = {
  grounded: [
    "Traffic +24% (18,430), orders −8% (740), revenue −8% (₦6.2m). Average order value was roughly stable at ₦8,378.",
    "Mobile checkout completion fell 71% → 48% and payment failures rose 31% — both measured up to the last successful Shopify sync at 11:02.",
  ],
  limitations: [
    "Data after 11:02 today is pending the Shopify reconnection.",
  ],
  evidence: [
    { label: "Traffic", value: "18,430 (+24%)", provenance: "measured", source: "Shopify" },
    { label: "Orders", value: "740 (−8%)", provenance: "measured", source: "Shopify" },
    { label: "Revenue", value: "₦6,200,000 (−8%)", provenance: "measured", source: "Shopify" },
    { label: "Payment failures", value: "+31% vs August", provenance: "measured", source: "Paystack via Shopify", factId: "prov-kh-payment-failures" },
  ],
  referencedPeriod: "Sep vs Aug 2026",
};

const SH_TRIED: AnswerContent = {
  grounded: [
    "You completed a Google budget reallocation test (August): Google conversion improved from 38.7% to 44.1%, with attribution confidence medium.",
    "Conclusion: keep the reallocation.",
  ],
  interpretation:
    "The improvement may have been contributed to by the reallocation; other September changes cannot be fully ruled out, hence medium confidence.",
  evidence: [
    { label: "Google conversion before → after", value: "38.7% → 44.1%", provenance: "measured", source: "Experiment outcome exp-sh-0" },
    { label: "Attribution confidence", value: "Medium", provenance: "ai-interpretation", source: "Calculated from August and September totals" },
  ],
  referencedPeriod: "August 2026",
};

const KH_TRIED: AnswerContent = {
  grounded: [
    "No completed experiments are recorded for KoraHome yet.",
    "The closest active change is the open recommendation to repair mobile checkout (completion 48% vs 71% in August). Once a change is started, its outcome will be tracked here with attribution confidence.",
  ],
  evidence: [
    { label: "Completed experiments", value: "None yet", provenance: "measured", source: "Workspace experiment history" },
    { label: "Mobile checkout completion", value: "48% (Aug: 71%)", provenance: "measured", source: "Shopify checkout analytics", factId: "prov-kh-checkout" },
  ],
  referencedPeriod: "All time",
};

interface Matcher {
  test: RegExp;
  content: AnswerContent;
}

const MATCHERS: Record<BusinessType, { list: Matcher[]; fallback: AnswerContent }> = {
  service: {
    list: [
      { test: /enquir|customer|sales|convers|lead/i, content: SH_ENQUIRY },
      { test: /channel|best|perform|platform/i, content: SH_CHANNEL },
      { test: /tried|before|experiment|test|histor/i, content: SH_TRIED },
      { test: /chang|month|trend|happen/i, content: SH_CHANGED },
      { test: /focus|week|priorit|next/i, content: SH_FOCUS },
    ],
    fallback: SH_FOCUS,
  },
  ecommerce: {
    list: [
      { test: /order|checkout|payment|cart|sales|customer|convers|traffic|enquir/i, content: KH_ORDERS },
      { test: /channel|best|perform|ads|platform/i, content: KH_CHANNEL },
      { test: /tried|before|experiment|test|histor/i, content: KH_TRIED },
      { test: /chang|month|trend|happen/i, content: KH_CHANGED },
      { test: /focus|week|priorit|next/i, content: KH_FOCUS },
    ],
    fallback: KH_FOCUS,
  },
};

function answerFor(question: string, type: BusinessType): AnswerContent {
  const m = MATCHERS[type];
  const hit = m.list.find((c) => c.test.test(question));
  return hit ? hit.content : m.fallback;
}

// ---------- Screen 48 — Ask Your Business ----------

interface ThreadAnswer {
  kind: "answer";
  question: string;
  content: AnswerContent;
}
interface ThreadQuestion {
  kind: "question";
  text: string;
}
type ThreadItem = ThreadQuestion | ThreadAnswer;

function AskScreen() {
  const businessId = useBizz((s) => s.businessId);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const navigate = useBizz((s) => s.navigate);
  const business = getBusiness(businessId, userWorkspace);

  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [thread, setThread] = useState<ThreadItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const suggestions =
    business.type === "service"
      ? [
          "Why are we getting more enquiries but not more customers?",
          "What should I focus on this week?",
          "Which channel is performing best?",
          "What changed this month?",
          "What have we tried before?",
        ]
      : [
          "Why is traffic growing but orders falling?",
          "What should I focus on this week?",
          "Which channel is performing best?",
          "What changed this month?",
          "What have we tried before?",
        ];

  function ask(raw: string) {
    const q = raw.trim();
    if (!q) {
      toast.error("Type a question first", { description: "Ask in your own words, or pick a suggestion." });
      return;
    }
    if (typing) return;
    setInput("");
    setThread((t) => [...t, { kind: "question", text: q }]);
    setTyping(true);
    timerRef.current = setTimeout(() => {
      setTyping(false);
      setThread((t) => [...t, { kind: "answer", question: q, content: answerFor(q, business.type) }]);
    }, 1000);
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      {/* Hero — expressive but serious */}
      <Card className="overflow-hidden border-violet-200 bg-gradient-to-br from-violet-50 via-white to-white p-0">
        <div className="border-b border-violet-100 px-6 pt-6 pb-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm">
                <Sparkles className="size-5" aria-hidden />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Ask anything about your business…</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Grounded answers from {business.name}&apos;s workspace data.
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("ask/history")}>
              <History className="mr-1.5 size-4" aria-hidden /> Conversation history
            </Button>
          </div>
          <form
            className="mt-4 flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
          >
            <label htmlFor="ask-input" className="sr-only">
              Ask a question about your business
            </label>
            <Input
              id="ask-input"
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. Why are we getting more enquiries but not more customers?"
              className="h-12 flex-1 border-violet-200 bg-white text-base"
              autoComplete="off"
            />
            <Button type="submit" className="h-12 bg-violet-600 px-6 text-base hover:bg-violet-700" disabled={typing}>
              <Send className="mr-2 size-4" aria-hidden /> Ask
            </Button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => ask(s)}
                disabled={typing}
                className="rounded-full border border-violet-200 bg-white px-3 py-1.5 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-100 disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <p className="px-6 py-3 text-xs text-muted-foreground">
          Answers are grounded in your workspace data and marked with sources. AI interpretation is labelled as such.
        </p>
      </Card>

      {/* Thread */}
      <div className="mt-6 space-y-4">
        {thread.length === 0 && !typing ? (
          <EmptyState
            icon={<MessageCircleQuestion className="size-5" />}
            title="Start with a question"
            description="Try a suggestion above, or ask in your own words. Every answer references the actual numbers recorded in this workspace and shows where each fact came from."
          />
        ) : null}

        {thread.map((item, i) =>
          item.kind === "question" ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-md bg-blue-600 px-4 py-2.5 text-sm leading-relaxed text-white sm:max-w-[70%]">
                {item.text}
              </p>
            </div>
          ) : (
            <AnswerCard key={i} answer={item.content} question={item.question} onFollowUp={() => inputRef.current?.focus()} />
          )
        )}

        {typing ? (
          <Card className="flex items-center gap-3 p-4" role="status" aria-label="Preparing answer">
            <div className="flex size-8 items-center justify-center rounded-lg bg-violet-600 text-white">
              <Sparkles className="size-4" aria-hidden />
            </div>
            <div className="flex items-center gap-1.5" aria-hidden>
              <span className="size-2 animate-bounce rounded-full bg-violet-400 [animation-delay:0ms]" />
              <span className="size-2 animate-bounce rounded-full bg-violet-400 [animation-delay:150ms]" />
              <span className="size-2 animate-bounce rounded-full bg-violet-400 [animation-delay:300ms]" />
            </div>
            <span className="text-sm text-muted-foreground">Reviewing your workspace data…</span>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

function AnswerCard({
  answer,
  question,
  onFollowUp,
}: {
  answer: AnswerContent;
  question: string;
  onFollowUp: () => void;
}) {
  const navigate = useBizz((s) => s.navigate);
  return (
    <Card className="border-violet-200 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-violet-600 text-white">
            <Sparkles className="size-3.5" aria-hidden />
          </div>
          <span className="text-sm font-semibold">Answer</span>
          <ProvenanceBadge provenance="ai-interpretation" />
        </div>
        <Badge variant="outline" className="gap-1 font-normal text-muted-foreground">
          <CalendarDays className="size-3" aria-hidden /> {answer.referencedPeriod}
        </Badge>
      </div>

      <p className="sr-only">Re: {question}</p>

      <div className="mt-3 space-y-2.5">
        {answer.grounded.map((p, i) => (
          <p key={i} className="text-sm leading-relaxed">
            {p}
          </p>
        ))}
        {answer.interpretation ? (
          <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-violet-600">AI interpretation</p>
            <p className="mt-1 text-sm leading-relaxed text-violet-900">{answer.interpretation}</p>
          </div>
        ) : null}
        {answer.limitations && answer.limitations.length > 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
              <CircleDashed className="size-3.5" aria-hidden /> What we don&apos;t know yet
            </p>
            <ul className="mt-1.5 space-y-1">
              {answer.limitations.map((l, i) => (
                <li key={i} className="text-sm text-slate-600">
                  · {l}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Inline evidence</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {answer.evidence.map((e, i) => (
            <button
              key={i}
              onClick={() => {
                if (e.factId) navigate(`provenance/${e.factId}`);
                else navigate("data");
              }}
              className="rounded-xl border bg-white p-3 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/40"
              aria-label={`${e.label}: ${e.value}. ${e.factId ? "Open fact detail" : "Open data centre"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{e.label}</span>
                <ProvenanceBadge provenance={e.provenance} source={e.source} />
              </div>
              <p className="mt-1 text-base font-semibold tnum">{e.value}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{e.source}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        <Button variant="outline" size="sm" onClick={() => navigate("data")}>
          <Database className="mr-1.5 size-4" aria-hidden /> View supporting data
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate("actions")}>
          <BarChart3 className="mr-1.5 size-4" aria-hidden /> Create action
        </Button>
        <Button variant="ghost" size="sm" onClick={onFollowUp}>
          <MessageCircleQuestion className="mr-1.5 size-4" aria-hidden /> Ask follow-up
        </Button>
      </div>
    </Card>
  );
}

// ---------- Screen 49 — Conversation History ----------

interface HistoryEntry {
  id: string;
  type: string;
  title: string;
  date: string;
  summary: string;
  period: string;
}

const HISTORY: Record<BusinessType, HistoryEntry[]> = {
  service: [
    {
      id: "h-sh-1",
      type: "Funnel diagnosis",
      title: "Why are we getting more enquiries but not more customers?",
      date: "2026-09-30",
      summary: "Instagram produced 184 enquiries but converted 6.0% (11 customers); Google converted 38.7%. Conversion quality — not enquiry volume — is the constraint.",
      period: "September 2026",
    },
    {
      id: "h-sh-2",
      type: "Planning",
      title: "What should I focus on this week?",
      date: "2026-09-29",
      summary: "Keep the faster-follow-up experiment unchanged (18 days remain), complete lead-status tracking, and hold budget changes until the experiment closes.",
      period: "Week of Sep 28 – Oct 4",
    },
    {
      id: "h-sh-3",
      type: "Channel performance",
      title: "Which channel is performing best?",
      date: "2026-09-27",
      summary: "Referral converts best (45.2%) but is small (31 enquiries). Google Search is the best scalable channel at 38.7% conversion and ₦6,250 CAC.",
      period: "September 2026",
    },
    {
      id: "h-sh-4",
      type: "Monthly change",
      title: "What changed this month?",
      date: "2026-09-26",
      summary: "Spend +40% (₦370k), enquiries +50% (277), customers +4% (49), revenue +3% (₦6.0m). Instagram spend rose ~10% from Sep 24.",
      period: "Sep vs Aug 2026",
    },
    {
      id: "h-sh-5",
      type: "Experiment history",
      title: "What have we tried before?",
      date: "2026-09-22",
      summary: "Google budget reallocation test (August): conversion 38.7% → 44.1%, attribution confidence medium. Conclusion: keep the reallocation.",
      period: "August 2026",
    },
  ],
  ecommerce: [
    {
      id: "h-kh-1",
      type: "Checkout & payments",
      title: "Why is traffic growing but orders falling?",
      date: "2026-09-30",
      summary: "Traffic +24% (18,430) but orders −8% (740). Mobile checkout completion fell 71% → 48% and payment failures rose 31%. The checkout is the constraint.",
      period: "September 2026",
    },
    {
      id: "h-kh-2",
      type: "Planning",
      title: "What should I focus on this week?",
      date: "2026-09-29",
      summary: "Reconnect Shopify to restore sync, start the mobile checkout repair, and hold ad budget changes until checkout recovers.",
      period: "Week of Sep 28 – Oct 4",
    },
    {
      id: "h-kh-3",
      type: "Channel performance",
      title: "Which channel is performing best?",
      date: "2026-09-27",
      summary: "Instagram Ads lead on volume (296 orders, ₦2.48m at ₦1,081 CAC); Google Search follows (222 orders, ₦946 CAC). Organic and repeat orders are most profitable.",
      period: "September 2026",
    },
    {
      id: "h-kh-4",
      type: "Monthly change",
      title: "What changed this month?",
      date: "2026-09-26",
      summary: "Traffic +24%, orders −8%, revenue −8% (₦6.2m). Mobile checkout completion 71% → 48%; payment failures +31%.",
      period: "Sep vs Aug 2026",
    },
    {
      id: "h-kh-5",
      type: "Experiment history",
      title: "What have we tried before?",
      date: "2026-09-22",
      summary: "No completed experiments recorded yet. The open recommendation is to repair mobile checkout; outcomes will be tracked here once started.",
      period: "All time",
    },
  ],
};

const HISTORY_TYPES = ["All types", "Funnel diagnosis", "Planning", "Channel performance", "Monthly change", "Experiment history", "Checkout & payments"];

function AskHistoryScreen() {
  const businessId = useBizz((s) => s.businessId);
  const userWorkspace = useBizz((s) => s.userWorkspace);
  const navigate = useBizz((s) => s.navigate);
  const business = getBusiness(businessId, userWorkspace);

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("All types");

  const entries = HISTORY[business.type].filter((h) => {
    const matchesQuery =
      query.trim().length === 0 ||
      `${h.title} ${h.summary}`.toLowerCase().includes(query.trim().toLowerCase());
    const matchesType = typeFilter === "All types" || h.type === typeFilter;
    return matchesQuery && matchesType;
  });

  return (
    <div className="mx-auto w-full max-w-4xl">
      <PageHeader
        title="Conversation history"
        description="Previous analyses with the questions asked, the period referenced and a short summary of each answer."
        back={
          <Button variant="ghost" size="sm" className="-ml-2 mb-2" onClick={() => navigate("ask")}>
            Back to Ask
          </Button>
        }
        actions={
          <Button size="sm" onClick={() => navigate("ask")}>
            <MessageCircleQuestion className="mr-1.5 size-4" aria-hidden /> New question
          </Button>
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <label htmlFor="history-search" className="sr-only">
            Search conversations
          </label>
          <Input
            id="history-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search previous analyses…"
            className="pl-9"
          />
        </div>
        <div className="w-full sm:w-56">
          <label htmlFor="history-type" className="sr-only">
            Filter by type
          </label>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger id="history-type" aria-label="Filter by type">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              {HISTORY_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {entries.length === 0 ? (
          <EmptyState
            icon={<Search className="size-5" />}
            title="No conversations match"
            description="Try a different search term or clear the type filter."
          />
        ) : (
          entries.map((h) => (
            <Card
              key={h.id}
              className="p-0 transition-colors hover:border-blue-300"
            >
              <button
                onClick={() => {
                  toast("Conversation view opens in Ask", { description: "The full thread is available in the Ask screen." });
                  navigate("ask");
                }}
                className="w-full p-4 text-left"
                aria-label={`Open conversation: ${h.title}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="bg-violet-50 font-normal text-violet-700">
                      {h.type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {h.date.split("-").reverse().join("/")} · Period: {h.period}
                    </span>
                  </div>
                  <CheckCircle2 className="size-4 text-slate-300" aria-hidden />
                </div>
                <h3 className="mt-1.5 text-sm font-semibold leading-snug">{h.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{h.summary}</p>
              </button>
            </Card>
          ))
        )}
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Conversations are stored per workspace. Answers reference the data available at the time they were generated.
      </p>
    </div>
  );
}

export const views: ViewMap = {
  ask: AskScreen,
  "ask/history": AskHistoryScreen,
};
