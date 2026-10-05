// Operations data — notifications, goals, team, integrations, data quality,
// provenance records, manual entries, timeline (change ledger), briefs.
import type {
  Brief,
  DataQualityIssue,
  GoalRecord,
  IntegrationDef,
  ManualEntry,
  NotificationItem,
  ProvenanceFact,
  TeamMember,
  TimelineEvent,
} from "../types";

export const NOTIFICATIONS: NotificationItem[] = [
  { id: "n-1", businessId: "swifthaul", category: "alert", title: "New warning alert: CAC increased 34%", body: "Blended CAC rose to ₦7,551 in September. Review before adding budget.", time: "09:04", read: false, targetRoute: "alerts/al-sh-1" },
  { id: "n-2", businessId: "swifthaul", category: "assignment", title: "Tunde updated your assigned action", body: "Faster Instagram enquiry follow-up — 3 of 5 checklist items complete.", time: "08:40", read: false, targetRoute: "actions/act-sh-1" },
  { id: "n-3", businessId: "swifthaul", category: "report", title: "Your weekly business brief is ready", body: "Sep 21–27 brief: enquiries up 9%, conversion still the constraint.", time: "07:30", read: false, targetRoute: "brief/weekly" },
  { id: "n-4", businessId: "swifthaul", category: "experiment", title: "Measurement complete: Google budget reallocation test", body: "Outcome available — conversion improved; attribution confidence medium.", time: "Sep 10", read: true, targetRoute: "outcome/exp-sh-0" },
  { id: "n-5", businessId: "swifthaul", category: "connection", title: "Meta Ads connected (read-only)", body: "Instagram spend data now feeds marketing analysis.", time: "Sep 5", read: true, targetRoute: "source-settings/meta-ads" },
  { id: "n-6", businessId: "swifthaul", category: "goal", title: "Goal check-in: 60 customers by Oct 31", body: "49 of 60 so far. Conversion improvement is the fastest path.", time: "Sep 28", read: true, targetRoute: "goals/goal-sh-1" },
  { id: "n-7", businessId: "swifthaul", category: "team", title: "Ngozi accepted your invitation", body: "Ngozi Eze joined as Member (Marketing).", time: "Sep 2", read: true, targetRoute: "team" },
  { id: "n-8", businessId: "swifthaul", category: "report", title: "September monthly review is ready", body: "Executive summary, marketing analysis and next-month priorities.", time: "Oct 1", read: false, targetRoute: "brief/monthly" },
  { id: "n-9", businessId: "korahome", category: "alert", title: "New critical alert: Shopify stopped syncing", body: "Connection inactive for 3 hours. Shopify-sourced data may be stale.", time: "14:05", read: false, targetRoute: "alerts/al-kh-1" },
  { id: "n-10", businessId: "korahome", category: "alert", title: "Mobile checkout completion dropped below 50%", body: "Completion fell 71% → 48%. Diagnosis and action available.", time: "09:02", read: false, targetRoute: "alerts/al-kh-2" },
  { id: "n-11", businessId: "korahome", category: "experiment", title: "Checkout recovery test — 12 days remaining", body: "Mobile completion tracking 54% vs 48% baseline.", time: "Sep 30", read: false, targetRoute: "experiments/exp-kh-1" },
  { id: "n-12", businessId: "korahome", category: "assignment", title: "Emeka updated the checkout action", body: "Payment failure logs reviewed — 62% transient failures.", time: "Sep 30", read: true, targetRoute: "actions/act-kh-1" },
];

export const GOALS: GoalRecord[] = [
  {
    id: "goal-sh-1",
    businessId: "swifthaul",
    title: "Increase monthly paying customers",
    metric: "New customers per month",
    baseline: 49,
    target: 60,
    current: 49,
    unit: "customers",
    deadline: "2026-10-31",
    owner: "Amara Okafor",
    priority: "high",
    status: "active",
    contributing: ["Enquiry → customer conversion", "Instagram enquiry → customer conversion", "Enquiry volume"],
    relatedRecommendations: ["rec-sh-1", "rec-sh-2"],
    risks: "Conversion constraint must improve first; buying more enquiries alone will not reach the target.",
    summary: "To reach 60 customers, September performance requires approximately 11 additional customers. The fastest path is lifting Instagram conversion while protecting efficient Google and Referral volume.",
  },
  {
    id: "goal-kh-1",
    businessId: "korahome",
    title: "Recover mobile checkout completion",
    metric: "Mobile checkout completion",
    baseline: 48,
    target: 65,
    current: 54,
    unit: "% completion",
    deadline: "2026-10-31",
    owner: "Emeka Obi",
    priority: "high",
    status: "at-risk",
    contributing: ["Payment failure recovery rate", "Checkout completion by device", "Orders"],
    relatedRecommendations: ["rec-kh-1", "rec-kh-2", "rec-kh-3"],
    risks: "Payment retry rollout must complete before the measurement window closes.",
    summary: "Checkout completion is tracking 54% against a 65% target. Recovering to 65% would restore roughly 180–200 orders per month at current traffic.",
  },
  {
    id: "goal-sh-0",
    businessId: "swifthaul",
    title: "Launch interstate delivery service",
    metric: "Service live",
    baseline: 0,
    target: 1,
    current: 1,
    unit: "",
    deadline: "2026-08-31",
    owner: "Amara Okafor",
    priority: "medium",
    status: "completed",
    contributing: [],
    relatedRecommendations: [],
    summary: "Launched Aug 31. Interstate Delivery produced ₦1.98m revenue in its first full month.",
  },
];

export const TEAM: TeamMember[] = [
  { id: "mem-1", name: "Amara Okafor", email: "amara@swifthaul.ng", role: "owner", jobTitle: "Founder / CEO", status: "active", lastActive: "Active now", assignedActions: 3 },
  { id: "mem-2", name: "Tunde Bakare", email: "tunde@swifthaul.ng", role: "admin", jobTitle: "Sales Manager", status: "active", lastActive: "2 hours ago", assignedActions: 5 },
  { id: "mem-3", name: "Ngozi Eze", email: "ngozi@swifthaul.ng", role: "member", jobTitle: "Marketing", status: "active", lastActive: "1 day ago", assignedActions: 2 },
  { id: "mem-4", name: "Emeka Obi", email: "emeka@swifthaul.ng", role: "member", jobTitle: "Operations", status: "active", lastActive: "3 days ago", assignedActions: 1 },
  { id: "mem-5", name: "Chioma Ade", email: "chioma@swifthaul.ng", role: "member", jobTitle: "Customer Service", status: "invited", lastActive: "Invitation sent — expires in 6 days", assignedActions: 0 },
];

export const INTEGRATIONS: IntegrationDef[] = [
  {
    id: "meta-ads",
    name: "Meta Ads",
    category: "Advertising",
    description: "Instagram and Facebook advertising spend and delivery data.",
    provides: ["Channel spend", "Reach and frequency", "Ad set level spend"],
    unlocks: "Campaign-level marketing efficiency and creative diagnosis.",
    permissions: { read: ["Ad account spend", "Campaign structure", "Delivery metrics"], cannot: ["Modify campaigns", "Change budgets", "Publish content"] },
    badge: "Read",
    status: "connected",
    businessId: "swifthaul",
    connectedSince: "2026-09-05",
    lastSync: "12 minutes ago",
    nextSync: "in 48 minutes",
  },
  {
    id: "google-ads",
    name: "Google Ads",
    category: "Advertising",
    description: "Search advertising spend and performance data.",
    provides: ["Campaign spend", "Clicks and impressions", "Search terms"],
    unlocks: "Search efficiency analysis and impression-share-aware budget guidance.",
    permissions: { read: ["Ad account spend", "Campaign metrics"], cannot: ["Modify campaigns", "Change bids"] },
    badge: "Read",
    status: "connected",
    businessId: "swifthaul",
    connectedSince: "2026-09-05",
    lastSync: "26 minutes ago",
    nextSync: "in 34 minutes",
  },
  {
    id: "google-analytics",
    name: "Google Analytics",
    category: "Website analytics",
    description: "Website traffic, sessions, pages and on-site conversion behaviour.",
    provides: ["Traffic and sessions", "Device mix", "Top landing pages", "Visitor → enquiry conversion"],
    unlocks: "Website conversion analysis and upstream funnel diagnosis (what happens before enquiries).",
    permissions: { read: ["Analytics reporting data"], cannot: ["Modify your website", "Change tags or settings"] },
    badge: "Read",
    status: "available",
  },
  {
    id: "shopify",
    name: "Shopify",
    category: "Ecommerce",
    description: "Orders, revenue and full click-funnel behaviour for Shopify stores.",
    provides: ["Orders and revenue", "Product views, carts, checkouts", "Device-level checkout completion"],
    unlocks: "Ecommerce funnel diagnosis, product performance and checkout analysis.",
    permissions: { read: ["Orders and checkout analytics", "Product catalogue"], cannot: ["Modify your store", "Edit products or prices"] },
    badge: "Read",
    status: "error",
    businessId: "korahome",
    connectedSince: "2026-08-02",
    lastSync: "3 hours ago (failed)",
    nextSync: "paused",
    error: {
      title: "Authorization expired",
      detail: "The access token Shopify issued expired during the 14:00 sync attempt. Historical data is retained.",
      affected: "Orders, revenue, funnel and checkout analytics after 11:02 today.",
      resolution: "Reconnect the Shopify source to refresh authorization and backfill the gap.",
      time: "2026-09-30 14:03",
    },
  },
  {
    id: "woocommerce",
    name: "WooCommerce",
    category: "Ecommerce",
    description: "Orders and revenue for WooCommerce stores.",
    provides: ["Orders and revenue", "Product performance"],
    unlocks: "Ecommerce funnel and product analysis for WooCommerce stores.",
    permissions: { read: ["Orders", "Products"], cannot: ["Modify your store"] },
    badge: "Read",
    status: "available",
  },
  {
    id: "paystack",
    name: "Paystack",
    category: "Payments",
    description: "Payment success, failures and settlement data.",
    provides: ["Transaction success/failure", "Failure reasons", "Settlement totals"],
    unlocks: "Payment-reliability diagnosis (critical for checkout analysis).",
    permissions: { read: ["Transaction metadata"], cannot: ["Refund or move money", "Change account settings"] },
    badge: "Read",
    status: "connected",
    businessId: "korahome",
    connectedSince: "2026-08-02",
    lastSync: "3 hours ago (via Shopify window)",
    nextSync: "paused",
  },
  {
    id: "flutterwave",
    name: "Flutterwave",
    category: "Payments",
    description: "Payment success, failures and settlement data.",
    provides: ["Transaction success/failure", "Failure reasons"],
    unlocks: "Payment-reliability diagnosis across gateways.",
    permissions: { read: ["Transaction metadata"], cannot: ["Refund or move money"] },
    badge: "Read",
    status: "available",
  },
  {
    id: "csv",
    name: "CSV / Excel upload",
    category: "Manual / import",
    description: "Import spreadsheets of enquiries, orders, spend or revenue.",
    provides: ["Any tabular monthly or daily data"],
    unlocks: "Immediate aggregate-level intelligence without integrations.",
    permissions: { read: ["Uploaded files only"], cannot: ["Access any external account"] },
    badge: "Observe",
    status: "available",
  },
  {
    id: "manual",
    name: "Manual data entry",
    category: "Manual / import",
    description: "Enter monthly totals directly — exact values, approximations or ranges.",
    provides: ["Spend, enquiries, customers, revenue (or traffic/orders for ecommerce)"],
    unlocks: "A Level-2 baseline diagnosis with zero connections.",
    permissions: { read: ["What you enter"], cannot: ["Anything else"] },
    badge: "Observe",
    status: "connected",
  },
];

export function integrationsFor(businessId: string): IntegrationDef[] {
  return INTEGRATIONS.filter((i) => !i.businessId || i.businessId === businessId || i.status === "available");
}
export function integrationById(id: string): IntegrationDef | undefined {
  return INTEGRATIONS.find((i) => i.id === id);
}

export const DATA_QUALITY: DataQualityIssue[] = [
  {
    id: "dq-1",
    businessId: "swifthaul",
    severity: "warning",
    title: "23% of September customers have no recorded acquisition source",
    detail: "12 of 49 new customers did not state how they found SwiftHaul.",
    impact: "Channel conversion analysis is slightly less precise; Instagram's weak conversion could be marginally overstated.",
    resolution: "Ask the team to record source for every new customer, or connect a CRM source.",
  },
  {
    id: "dq-2",
    businessId: "swifthaul",
    severity: "info",
    title: "August and September revenue were entered manually",
    detail: "Revenue totals were submitted by the workspace owner and cannot be verified against an accounting source.",
    impact: "Revenue trend confidence is 'user-supplied' rather than 'measured'.",
    resolution: "Connect a payments or accounting source to upgrade provenance.",
  },
  {
    id: "dq-3",
    businessId: "swifthaul",
    severity: "warning",
    title: "Website analytics not connected",
    detail: "Visitor behaviour before enquiries is not observable.",
    impact: "The diagnosis cannot distinguish weak traffic quality from weak enquiry handling.",
    resolution: "Connect Google Analytics (read-only) or enter monthly website totals.",
  },
  {
    id: "dq-4",
    businessId: "korahome",
    severity: "error",
    title: "Shopify sync stopped 3 hours ago",
    detail: "Authorization token expired during the 14:00 sync attempt.",
    impact: "All Shopify-sourced analyses may be stale.",
    resolution: "Reconnect Shopify from Data Centre → Connected sources.",
  },
  {
    id: "dq-5",
    businessId: "swifthaul",
    severity: "warning",
    title: "2 duplicate rows detected in the last CSV import",
    detail: "The September 12 referral import contained 2 duplicate enquiry rows.",
    impact: "Referral enquiries may be overcounted by 2 (31 → possibly 29).",
    resolution: "Review the import result report; duplicates were excluded from analysis pending confirmation.",
  },
];

export const PROVENANCE_FACTS: ProvenanceFact[] = [
  {
    id: "prov-sh-revenue",
    businessId: "swifthaul",
    label: "Revenue (September)",
    value: "₦6,000,000",
    provenance: "user-supplied",
    source: "Manual monthly submission",
    enteredBy: "Amara Okafor (Workspace owner)",
    date: "2026-09-30",
    precision: "Exact",
    confidence: "high",
    dependencies: ["Revenue change +3%", "Revenue ÷ spend ratio ₦16.2"],
  },
  {
    id: "prov-sh-instagram-enquiries",
    businessId: "swifthaul",
    label: "Instagram enquiries (September)",
    value: "184",
    provenance: "measured",
    source: "Meta Ads integration + manual reconciliation",
    enteredBy: "System",
    date: "2026-09-30",
    precision: "Exact",
    confidence: "high",
    dependencies: ["Instagram conversion 6.0%", "Insight: conversion bottleneck"],
  },
  {
    id: "prov-sh-referral",
    businessId: "swifthaul",
    label: "Referral enquiries → customers",
    value: "31 → 14",
    provenance: "user-supplied",
    source: "Entered by Tunde Bakare (Sales Manager)",
    enteredBy: "Tunde Bakare",
    date: "2026-09-30",
    precision: "Exact",
    confidence: "medium",
    note: "2 possible duplicate rows excluded pending confirmation (see Data Quality).",
    dependencies: ["Referral conversion 45.2%", "Referral CAC ₦1,429"],
  },
  {
    id: "prov-sh-cac-instagram",
    businessId: "swifthaul",
    label: "Instagram CAC (September)",
    value: "₦18,182",
    provenance: "estimated",
    source: "Calculated: ₦200,000 spend ÷ 11 customers",
    date: "2026-09-30",
    precision: "Calculated",
    confidence: "high",
    dependencies: ["Marketing efficiency score 61/100"],
  },
  {
    id: "prov-sh-diagnosis",
    businessId: "swifthaul",
    label: "Diagnosis: conversion is the constraint",
    value: "Confidence 82%",
    provenance: "ai-interpretation",
    source: "Reasoning over channel and monthly data",
    date: "2026-09-30",
    precision: "Interpretation",
    confidence: "medium",
    note: "This is an AI interpretation, not measured data. It can be improved with response-time and lead-quality data.",
    dependencies: ["Recommendation rec-sh-1"],
  },
  {
    id: "prov-kh-checkout",
    businessId: "korahome",
    label: "Mobile checkout completion (September)",
    value: "48% (Aug: 71%)",
    provenance: "measured",
    source: "Shopify checkout analytics",
    date: "2026-09-30 11:02",
    precision: "Exact",
    confidence: "high",
    note: "Sync currently delayed — data reflects the last successful sync at 11:02.",
    dependencies: ["Insight ins-kh-2", "Recommendation rec-kh-1"],
  },
  {
    id: "prov-kh-payment-failures",
    businessId: "korahome",
    label: "Payment failures (September)",
    value: "+31% vs August",
    provenance: "measured",
    source: "Paystack summary via Shopify",
    date: "2026-09-30 11:02",
    precision: "Exact",
    confidence: "medium",
    dependencies: ["Insight ins-kh-3", "Recommendation rec-kh-2"],
  },
];

export function provenanceFor(businessId: string): ProvenanceFact[] {
  return PROVENANCE_FACTS.filter((p) => p.businessId === businessId);
}
export function provenanceById(id: string): ProvenanceFact | undefined {
  return PROVENANCE_FACTS.find((p) => p.id === id);
}

export const MANUAL_ENTRIES: ManualEntry[] = [
  {
    id: "me-1",
    businessId: "swifthaul",
    period: "September 2026",
    metrics: [
      { label: "Marketing spend", value: "₦370,000", precision: "exact" },
      { label: "Enquiries", value: "277", precision: "exact" },
      { label: "Customers", value: "49", precision: "exact" },
      { label: "Revenue", value: "₦6,000,000", precision: "exact" },
    ],
    updatedBy: "Amara Okafor",
    lastModified: "2026-09-30 18:12",
    status: "verified",
  },
  {
    id: "me-2",
    businessId: "swifthaul",
    period: "August 2026",
    metrics: [
      { label: "Marketing spend", value: "₦265,000", precision: "exact" },
      { label: "Enquiries", value: "185", precision: "exact" },
      { label: "Customers", value: "47", precision: "exact" },
      { label: "Revenue", value: "₦5,830,000", precision: "exact" },
    ],
    updatedBy: "Amara Okafor",
    lastModified: "2026-09-01 09:41",
    status: "verified",
  },
  {
    id: "me-3",
    businessId: "swifthaul",
    period: "July 2026",
    metrics: [
      { label: "Marketing spend", value: "~₦250,000", precision: "approximate" },
      { label: "Enquiries", value: "168", precision: "exact" },
      { label: "Customers", value: "44", precision: "exact" },
      { label: "Revenue", value: "₦5.4m (range ₦5.2–5.6m)", precision: "range" },
    ],
    updatedBy: "Amara Okafor",
    lastModified: "2026-08-02 15:20",
    status: "unverified",
  },
];

export const TIMELINE: TimelineEvent[] = [
  { id: "te-sh-1", businessId: "swifthaul", date: "2026-09-30", type: "data", title: "September monthly totals recorded", description: "Spend ₦370,000 · 277 enquiries · 49 customers · ₦6.0m revenue entered by Amara Okafor.", source: "Manual entry", provenance: "user-supplied" },
  { id: "te-sh-2", businessId: "swifthaul", date: "2026-09-28", type: "action", title: "Action started: Faster Instagram enquiry follow-up", description: "Owner Tunde Bakare. 30-minute response rule adopted; follow-up sequence activated Oct 1.", source: "From recommendation rec-sh-1", provenance: "measured" },
  { id: "te-sh-3", businessId: "swifthaul", date: "2026-09-24", type: "external", title: "Instagram advertising spend increased ~10%", description: "Detected from Meta Ads sync. Confirmation requested — may affect experiment attribution.", source: "Meta Ads (detected)", provenance: "measured" },
  { id: "te-sh-4", businessId: "swifthaul", date: "2026-09-20", type: "experiment", title: "Measurement window opened: Faster follow-up experiment", description: "30-day window; baseline Instagram conversion 6.0%; target 10%.", source: "Experiment exp-sh-1", provenance: "measured" },
  { id: "te-sh-5", businessId: "swifthaul", date: "2026-09-12", type: "recommendation", title: "New recommendation: Improve Instagram enquiry qualification", description: "Issued after channel-level data was added. Confidence 82%.", source: "Diagnosis engine", provenance: "ai-interpretation" },
  { id: "te-sh-6", businessId: "swifthaul", date: "2026-09-10", type: "outcome", title: "Outcome recorded: Google budget reallocation test", description: "Google conversion 38.7% → 44.1%. Attribution confidence medium. Decision: keep change.", source: "Experiment exp-sh-0", provenance: "estimated" },
  { id: "te-sh-7", businessId: "swifthaul", date: "2026-09-05", type: "data", title: "Meta Ads connected (read-only)", description: "Instagram spend now flows into marketing analysis weekly.", source: "Integration", provenance: "measured" },
  { id: "te-sh-8", businessId: "swifthaul", date: "2026-08-28", type: "external", title: "Pricing review completed — no changes", description: "Team confirmed pricing unchanged for Q4 planning.", source: "Recorded by Amara Okafor", provenance: "user-supplied" },
  { id: "te-kh-1", businessId: "korahome", date: "2026-09-30", type: "external", title: "Shopify connection stopped syncing", description: "Authorization expired at 14:03. Reconnection required to resume data flow.", source: "Sync monitor", provenance: "measured" },
  { id: "te-kh-2", businessId: "korahome", date: "2026-09-22", type: "experiment", title: "Measurement window opened: Mobile checkout recovery test", description: "30-day window; baseline mobile completion 48%; target 65%.", source: "Experiment exp-kh-1", provenance: "measured" },
  { id: "te-kh-3", businessId: "korahome", date: "2026-09-18", type: "external", title: "Payment failure spike detected", description: "Failed attempts +31% vs August. Correlates with mobile checkout completion decline.", source: "Paystack summary", provenance: "measured" },
  { id: "te-kh-4", businessId: "korahome", date: "2026-09-12", type: "recommendation", title: "New recommendation: Investigate mobile checkout before buying traffic", description: "Confidence 78%. Demand healthy, checkout failing.", source: "Diagnosis engine", provenance: "ai-interpretation" },
  { id: "te-kh-5", businessId: "korahome", date: "2026-10-01", type: "action", title: "Recovery flow activated: abandoned checkout WhatsApp messages", description: "Messages send 1 hour after abandonment. Early recovery ~11%.", source: "Action act-kh-2", provenance: "measured" },
];

export function timelineFor(businessId: string): TimelineEvent[] {
  return TIMELINE.filter((t) => t.businessId === businessId).sort((a, b) => b.date.localeCompare(a.date));
}

export const WEEKLY_BRIEF: Brief = {
  id: "brief-sh-week-38",
  businessId: "swifthaul",
  kind: "weekly",
  period: "September 21–27, 2026",
  title: "Weekly business brief",
  sections: [
    {
      heading: "This week",
      metrics: [
        { label: "Revenue", value: "₦1.42m", goodness: "good", note: "+2% vs previous week" },
        { label: "New customers", value: "12", goodness: "neutral", note: "+1 vs previous week" },
        { label: "Enquiries", value: "71", goodness: "good", note: "+9% vs previous week" },
        { label: "Marketing spend", value: "₦96,000", goodness: "neutral", note: "+11% vs previous week" },
      ],
    },
    {
      heading: "What changed",
      paragraphs: [
        "Enquiry volume continued to grow faster than customer growth, consistent with the September pattern. The 30-minute response rule took full effect on Wednesday; early Instagram conversion is tracking above baseline within the running experiment.",
      ],
    },
    {
      heading: "Pay attention to this",
      paragraphs: [
        "Instagram enquiries converted at roughly 5.2% this week — still far below Google (36%+) and Referral (45%). The follow-up experiment has 18 days remaining; avoid changing pricing or budgets in the meantime so the measurement stays clean.",
      ],
    },
    {
      heading: "Opportunity",
      paragraphs: [
        "Google Search continues to convert at 6× Instagram's rate at one third of the CAC. If search demand supports it, a modest budget shift remains the most efficient lever while conversion work is in progress.",
      ],
    },
    {
      heading: "Recommended action",
      paragraphs: ["Continue the Faster Instagram follow-up experiment unchanged. Complete the remaining checklist items: track lead status and record lost reasons."],
    },
    {
      heading: "Goal progress",
      paragraphs: ["49 of 60 monthly customers (goal deadline Oct 31). Conversion improvement is the fastest path to the remaining 11."],
    },
  ],
};

export const MONTHLY_REVIEW: Brief = {
  id: "brief-sh-sep",
  businessId: "swifthaul",
  kind: "monthly",
  period: "September 2026",
  title: "Monthly business review",
  sections: [
    {
      heading: "Executive summary",
      paragraphs: [
        "September produced significantly more interest but barely more business. Marketing spend rose 40% and enquiries rose 50%, yet customers grew 4% and revenue 3%. The evidence points to conversion — not demand generation — as the immediate constraint.",
      ],
      bullets: [
        "Revenue ₦6.0m (+3%)",
        "New customers 49 (+4%)",
        "Enquiries 277 (+50%)",
        "Marketing spend ₦370,000 (+40%)",
        "Blended CAC ₦7,551 (+34%)",
      ],
    },
    {
      heading: "Revenue",
      paragraphs: ["Revenue reached ₦6.0m, the strongest month to date, but revenue per naira of marketing spend fell from ₦22.0 to ₦16.2. Corporate Logistics remains the largest revenue line (₦2.57m)."],
    },
    {
      heading: "Sales",
      paragraphs: ["277 enquiries produced 120 qualified leads, 77 quotes and 49 customers. The enquiry→customer conversion fell from 25.4% to 17.7%."],
    },
    {
      heading: "Marketing",
      paragraphs: ["Instagram produced the most enquiries (184) but the weakest conversion (6.0%). Google Search delivered 24 customers at ₦6,250 CAC; Referral delivered 14 at ₦1,429."],
    },
    {
      heading: "Customers",
      paragraphs: ["Customer acquisition grew marginally. 23% of new customers lack a recorded acquisition source — an ongoing data-quality item."],
    },
    {
      heading: "What worked",
      bullets: ["Google Search efficiency (16.7× ROAS)", "Referral conversion at 45.2%", "Corporate Logistics revenue growth"],
    },
    {
      heading: "What did not",
      bullets: ["Instagram conversion (6.0%)", "Marketing efficiency overall (revenue ÷ spend fell 26%)"],
    },
    {
      heading: "Likely explanations",
      paragraphs: ["The largest conversion gap appears among Instagram enquiries. Lead quality, response time and follow-up consistency are the leading hypotheses — none can be isolated yet with current data."],
    },
    {
      heading: "Biggest opportunity",
      paragraphs: ["Lifting Instagram conversion toward even 10% adds roughly 7 customers/month at zero extra spend. The faster-follow-up experiment is tracking toward 8–9%."],
    },
    {
      heading: "Biggest risk",
      paragraphs: ["Continued spend increases while conversion is depressed will keep eroding efficiency (CAC +34% this month)."],
    },
    {
      heading: "Actions completed",
      bullets: ["Google budget reallocation (15%) — outcome: Google conversion 38.7% → 44.1% (attribution medium)"],
    },
    {
      heading: "Results measured",
      paragraphs: ["One completed experiment (budget reallocation) and one in flight (faster follow-up, 18 days remaining)."],
    },
    {
      heading: "Priorities for next month",
      bullets: ["Complete the follow-up experiment and record lost reasons", "Decide on budget reallocation based on experiment outcome", "Connect Google Analytics to unlock upstream funnel visibility", "Close the customer-source data gap (23% unattributed)"],
    },
  ],
};

export const BRIEF_ARCHIVE = [
  { id: "br-1", kind: "Weekly", period: "Sep 21–27, 2026", route: "brief/weekly", status: "Ready" },
  { id: "br-2", kind: "Weekly", period: "Sep 14–20, 2026", route: "brief/weekly", status: "Ready" },
  { id: "br-3", kind: "Monthly", period: "September 2026", route: "brief/monthly", status: "Ready" },
  { id: "br-4", kind: "Weekly", period: "Sep 7–13, 2026", route: "brief/weekly", status: "Ready" },
  { id: "br-5", kind: "Monthly", period: "August 2026", route: "brief/monthly", status: "Ready" },
  { id: "br-6", kind: "Weekly", period: "Aug 31 – Sep 6, 2026", route: "brief/weekly", status: "Ready" },
] as const;
