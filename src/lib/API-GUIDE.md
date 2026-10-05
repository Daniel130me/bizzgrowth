# bizzGrowth — Screen Builder API Guide (READ THIS FULLY BEFORE CODING)

You are building screens for the **bizzGrowth** clickable MVP prototype (AI Business Growth OS).
All code is TypeScript + React client components. Target quality: premium SaaS (Stripe/Linear/Notion clarity), calm evidence-based copy, NO lorem ipsum, NO dead primary buttons.

## Hard rules

1. `use client` at top of every component file.
2. Never create Next.js routes/pages — navigation is hash-based via store: `navigate("metric/revenue")`, `navigate("insights/" + id)`.
3. Use ONLY the shared dataset in `src/lib/data/*` for numbers (consistency requirement). Never invent metrics that contradict it.
4. Every primary button must do something: navigate / open dialog / toast (`import { toast } from "sonner"`).
5. Semantic colour rules: blue-600 = data/primary; violet-600 = AI/intelligence; emerald-500 = positive; amber-500 = attention/opportunity; red-500 = risk. 70–80% neutral slate. **Never colour-code direction without goodness** (CAC ↑ is red/bad).
6. Provenance badges on important facts: Measured / User supplied / Estimated / AI interpretation. AI conclusions must never look like measured data.
7. Confidence language: High / Medium / Low (low is NOT an error — never red for uncertainty).
8. Accessibility: semantic HTML, aria-labels on icon buttons, keyboard focusable cards, colour+icon+label (never colour alone).
9. Responsive: mobile-first; desktop 1440 target. Cards `p-4`/`p-6`, gaps `gap-4`/`gap-6`. Long lists: `max-h-96 overflow-y-auto`.
10. No emojis in UI copy. Calm business tone ("Revenue increased 3% this month.", not "Awesome! 🎉").

## Navigation

```tsx
import { useBizz } from "@/lib/store";
const navigate = useBizz((s) => s.navigate);
navigate("home"); navigate("metric/revenue"); navigate("insights/ins-sh-1");
```

Route = view key in a group's `ViewMap`. Your group's `index.tsx` exports:

```tsx
"use client";
import type { ViewMap } from "../view-types";
export const views: ViewMap = { "my-route": MyScreen, "detail/:id": DetailScreen };
```

Each screen component receives `props: { params: Record<string,string> }`.

## Store (`src/lib/store.ts` — zustand)

```tsx
const businessId = useBizz((s) => s.businessId);            // 'swifthaul' | 'korahome' | 'user-workspace'
const userWorkspace = useBizz((s) => s.userWorkspace);      // user-created workspace meta (may be null)
const dateRange = useBizz((s) => s.dateRange);              // DateRangeId
const setDateRange = useBizz((s) => s.setDateRange);
const setBusiness = useBizz((s) => s.setBusiness);          // switches workspace
const user = useBizz((s) => s.user);                        // { name, email, jobRole }
const settings = useBizz((s) => s.settings);
const updateSettings = useBizz((s) => s.updateSettings);    // shows toast "Settings saved"
const updateProfile = useBizz((s) => s.updateProfile);
const connections = useBizz((s) => s.connections);          // Record<integrationId, ConnectionStatus>
const setConnection = useBizz((s) => s.setConnection);
const startAction / updateAction / toggleChecklist / addActionActivity
const createExperiment / updateExperiment
const addGoal / updateGoal
const markRead / markAllRead
const setRecommendationState  // 'open' | 'dismissed' | 'saved'
const createWorkspace / sendInvite
```

## Data layer (`src/lib/data/`)

```tsx
import { SWIFTHAUL, KORAHOME, getBusiness, getPeriod, DATE_RANGES, REPORTING_MONTH } from "@/lib/data/businesses";
const business = getBusiness(businessId, userWorkspace);    // full Business object
const period = getPeriod(business, dateRange);              // { label, compareLabel, current, previous, series }
// period.current: { spend, enquiries, customers, revenue, orders, traffic } (+ .previous)
import { insightsFor, insightById, recommendationsFor, recommendationById, alertsFor, alertById,
         experimentsFor, experimentById, actionsFor, actionById } from "@/lib/data/intelligence";
import { NOTIFICATIONS, GOALS, TEAM, INTEGRATIONS, integrationsFor, integrationById,
         DATA_QUALITY, PROVENANCE_FACTS, provenanceFor, provenanceById,
         MANUAL_ENTRIES, TIMELINE, timelineFor, WEEKLY_BRIEF, MONTHLY_REVIEW, BRIEF_ARCHIVE } from "@/lib/data/operations";
import { ADMIN_BUSINESSES, ADMIN_USERS, ADMIN_SUBSCRIPTIONS, SYNC_HEALTH, JOBS, AI_AUDIT, SUPPORT_TICKETS, ADMIN_SYSTEM_EVENTS } from "@/lib/data/admin";
```

- `business.monthly` = 8 months Feb–Sep 2026 (spend/enquiries/customers/revenue; orders/traffic for KoraHome).
- `business.channels` = per-channel spend, enquiries, customers, revenue, cac, conversion (+ orders for ecommerce).
- `business.funnel` = funnel steps (service: Enquiries 277→120→77→49; ecommerce: 18430→12800→2560→1510→740).
- `business.services` / `business.products`, `business.website`, `business.retention`, `business.dataCoverage`, `business.health`.
- Key story numbers (must never change): Sep spend ₦370k (+40%), enquiries 277 (+50%), customers 49 (+4%), revenue ₦6.0m (+3%); Instagram 184→11 (6.0%, CAC ₦18,182), Google 62→24 (38.7%, ₦6,250), Referral 31→14 (45.2%, ₦1,429). KoraHome: traffic +24%, orders −8%, revenue −8%, mobile checkout 71%→48%, payment failures +31%.

## Formatting (`src/lib/format.ts`)

```tsx
fmtNaira(6000000) => "₦6,000,000";  fmtNaira(6000000, { compact: true }) => "₦6m"
fmtNum(18430); fmtPct(6.0); fmtDelta(40) => "+40%" (uses − for negative)
goodnessFor("revenue", "up") => "good"; goodnessFor("cac", "up") => "bad"
fmtDate("2026-09-30") => "30 Sept 2026" style
```

## Shared components (`src/components/shared/`)

### badges.tsx
- `<ProvenanceBadge provenance="measured|user-supplied|estimated|ai-interpretation" source?="..." />`
- `<ConfidenceBadge level="high|medium|low" value?={82} />`
- `<TrendBadge delta={40} goodness="bad" />` (goodness = whether the change is good for the business)
- `<StatusBadge status="in-progress|measuring|completed|open|resolved|connected|error|..." />`
- `<SeverityBadge severity="critical|warning|opportunity|info" />`, `<ImpactBadge impact="high|medium|low" />`, `<EffortBadge effort="..." />`, `<ExecutionTypeBadge type="guided|human|connected" />`

### cards.tsx
- `<MetricCard label value delta? goodness? provenance? source? onClick? footnote? />`
- `<InsightCard insight onOpen />` (purple intelligence treatment; type = problem/opportunity/improvement/watch)
- `<RecommendationCard rec onOpen onStart />`
- `<ActionCard action onOpen />`, `<AlertCard alert onOpen />`, `<GoalProgressCard ... />`

### charts.tsx
- `<TrendLineChart data xKey series={[{key,label,color?,dashed?}]} valueFormatter? />`
- `<RevenueAreaChart data xKey />`, `<CompareBarChart data xKey series layout? />`, `<DonutChart data />`
- `<ExperimentProgressChart baseline current target label />`, `<ChannelConversionChart data />`
- Colors via `import { CHART_COLORS } from "@/lib/chart-colors"` (blue=violet etc. predefined).

### evidence.tsx
- `<KnowThinkUnknown known={[]} think="..." unknown={[]} onImprove? />` — the signature 3-panel
- `<EvidencePanel items={EvidenceItem[]} onOpenFact?={(factId) => navigate("provenance/"+factId)} />`
- `<ConfidencePanel level value? coverage sources missing />`
- `<RootCauseTree steps={[{step,note?}]} />` — numbered reasoning chain
- `<ProvenanceLegend />`

### funnel.tsx
- `<FunnelView steps={business.funnel} orientation? onSelect? />` — highlights largest loss automatically

### states.tsx
- `<EmptyState icon title description actions />`, `<NoDataYetState onConnect onEnterData onDemo />`
- `<ErrorState onRetry onHome onSupport />`, `<LoadingState />`, `<SkeletonCards />`

### layout.tsx
- `<PageHeader title description? actions? badge? back? />`, `<Breadcrumbs items />`
- `<SectionCard title? description? action? children />`, `<KeyValue label>value</KeyValue>`
- `<SettingsShell title description>...` , `<IntelligenceDetail eyebrow title meta actions>...`
- `<InfoBanner tone="info|warning|danger|success|ai" title?>...</InfoBanner>`

## shadcn/ui

All standard components exist in `@/components/ui/*`: button, card, badge, tabs, dialog, sheet, drawer, dropdown-menu, select, input, textarea, label, checkbox, radio-group, switch, slider, table, progress, separator, avatar, tooltip, popover, alert, alert-dialog, breadcrumb, command, calendar, accordion, skeleton, sonner (toaster already mounted). Use them instead of custom UI.

## Toasts

```tsx
import { toast } from "sonner";
toast.success("Action started", { description: "Track it in the Action Centre." });
toast.error("Could not connect", { description: "..." });
```

## Workspace adaptation (service vs ecommerce)

Use `business.type` to switch terminology:
- service: Enquiries / Qualified / Quotes / Customers · CAC · "customers"
- ecommerce: Visitors / Product views / Carts / Checkouts / Orders · AOV · "orders"
Same navigation, same intelligence core — only labels/numbers change.

## Copy principles

- What happened (measured) → What it may mean (AI interpretation, labelled) → What could be done (recommendation) → What changed → Outcome (attribution confidence, never causal overclaim).
- Never say "the recommendation caused the improvement" unless evidence supports causation — use "may have contributed".
- Bad-data states explain what's missing and what connecting would unlock. Never bare "No data".
