// Internal platform administration mock data (screens 105–114).
import type { AdminBusiness, AdminSubscription, AdminUser, AiAuditItem, JobRow, SupportTicket, SyncHealthRow } from "../types";

export const ADMIN_BUSINESSES: AdminBusiness[] = [
  { id: "swifthaul", name: "SwiftHaul Logistics", type: "service", owner: "Amara Okafor", plan: "Private Beta", status: "active", coverage: 62, lastActive: "12 minutes ago", sources: 3, syncHealth: "healthy", teamSize: 5, recentDiagnoses: 4, openRecommendations: 3, supportCases: 0 },
  { id: "korahome", name: "KoraHome Store", type: "ecommerce", owner: "Ifeoma Nwosu", plan: "Growth", status: "active", coverage: 58, lastActive: "3 hours ago", sources: 2, syncHealth: "failed", teamSize: 3, recentDiagnoses: 5, openRecommendations: 3, supportCases: 1 },
  { id: "lagos-smile", name: "Lagos Smile Dental", type: "service", owner: "Dr. Kelechi Umeh", plan: "Private Beta", status: "trial", coverage: 24, lastActive: "1 day ago", sources: 1, syncHealth: "healthy", teamSize: 2, recentDiagnoses: 1, openRecommendations: 1, supportCases: 0 },
  { id: "naija-threads", name: "NaijaThreads", type: "ecommerce", owner: "Sade Balogun", plan: "Growth", status: "active", coverage: 71, lastActive: "34 minutes ago", sources: 4, syncHealth: "healthy", teamSize: 6, recentDiagnoses: 6, openRecommendations: 4, supportCases: 0 },
  { id: "brightpath", name: "BrightPath Tutors", type: "service", owner: "Deji Afolabi", plan: "Private Beta", status: "trial", coverage: 18, lastActive: "4 days ago", sources: 0, syncHealth: "healthy", teamSize: 1, recentDiagnoses: 0, openRecommendations: 0, supportCases: 1 },
  { id: "greenleaf", name: "GreenLeaf Foods", type: "ecommerce", owner: "Halima Bello", plan: "Team", status: "active", coverage: 66, lastActive: "2 hours ago", sources: 3, syncHealth: "delayed", teamSize: 8, recentDiagnoses: 3, openRecommendations: 2, supportCases: 0 },
  { id: "zenith-fit", name: "Zenith Fitness Studio", type: "service", owner: "Rex Johnson", plan: "Growth", status: "suspended", coverage: 41, lastActive: "22 days ago", sources: 1, syncHealth: "failed", teamSize: 2, recentDiagnoses: 2, openRecommendations: 1, supportCases: 2 },
  { id: "kola-interiors", name: "Kola Interiors", type: "service", owner: "Kola Adesanya", plan: "Private Beta", status: "active", coverage: 37, lastActive: "6 hours ago", sources: 1, syncHealth: "healthy", teamSize: 3, recentDiagnoses: 1, openRecommendations: 2, supportCases: 0 },
];

export const ADMIN_USERS: AdminUser[] = [
  { id: "au-1", name: "Amara Okafor", email: "amara@swifthaul.ng", business: "SwiftHaul Logistics", role: "Owner", status: "active", joined: "2026-07-14", lastActive: "12 minutes ago" },
  { id: "au-2", name: "Tunde Bakare", email: "tunde@swifthaul.ng", business: "SwiftHaul Logistics", role: "Admin", status: "active", joined: "2026-07-20", lastActive: "2 hours ago" },
  { id: "au-3", name: "Ifeoma Nwosu", email: "ifeoma@korahome.ng", business: "KoraHome Store", role: "Owner", status: "active", joined: "2026-07-28", lastActive: "3 hours ago" },
  { id: "au-4", name: "Emeka Obi", email: "emeka@korahome.ng", business: "KoraHome Store", role: "Member", status: "active", joined: "2026-08-02", lastActive: "1 day ago" },
  { id: "au-5", name: "Sade Balogun", email: "sade@naijathreads.com", business: "NaijaThreads", role: "Owner", status: "active", joined: "2026-06-30", lastActive: "34 minutes ago" },
  { id: "au-6", name: "Dr. Kelechi Umeh", email: "kelechi@lagossmile.ng", business: "Lagos Smile Dental", role: "Owner", status: "active", joined: "2026-09-18", lastActive: "1 day ago" },
  { id: "au-7", name: "Halima Bello", email: "halima@greenleaffoods.ng", business: "GreenLeaf Foods", role: "Owner", status: "active", joined: "2026-06-12", lastActive: "2 hours ago" },
  { id: "au-8", name: "Deji Afolabi", email: "deji@brightpath.ng", business: "BrightPath Tutors", role: "Owner", status: "active", joined: "2026-09-25", lastActive: "4 days ago" },
  { id: "au-9", name: "Rex Johnson", email: "rex@zenithfit.ng", business: "Zenith Fitness Studio", role: "Owner", status: "disabled", joined: "2026-05-02", lastActive: "22 days ago" },
  { id: "au-10", name: "Chioma Ade", email: "chioma@swifthaul.ng", business: "SwiftHaul Logistics", role: "Member", status: "invited", joined: "—", lastActive: "Invitation pending" },
  { id: "au-11", name: "Kola Adesanya", email: "kola@kolainteriors.ng", business: "Kola Interiors", role: "Owner", status: "active", joined: "2026-08-15", lastActive: "6 hours ago" },
  { id: "au-12", name: "Bisi Ogundipe", email: "bisi@greenleaffoods.ng", business: "GreenLeaf Foods", role: "Admin", status: "active", joined: "2026-06-20", lastActive: "5 hours ago" },
];

export const ADMIN_SUBSCRIPTIONS: AdminSubscription[] = [
  { business: "SwiftHaul Logistics", plan: "Private Beta", state: "active", lastPayment: "— (beta)", nextRenewal: "—", failedPayments: 0, mrr: "₦0" },
  { business: "KoraHome Store", plan: "Growth", state: "active", lastPayment: "Sep 1, 2026 · ₦45,000", nextRenewal: "Oct 1, 2026", failedPayments: 0, mrr: "₦45,000" },
  { business: "NaijaThreads", plan: "Growth", state: "active", lastPayment: "Sep 3, 2026 · ₦45,000", nextRenewal: "Oct 3, 2026", failedPayments: 0, mrr: "₦45,000" },
  { business: "GreenLeaf Foods", plan: "Team", state: "active", lastPayment: "Sep 2, 2026 · ₦120,000", nextRenewal: "Oct 2, 2026", failedPayments: 0, mrr: "₦120,000" },
  { business: "Zenith Fitness Studio", plan: "Growth", state: "past-due", lastPayment: "Aug 20, 2026 · ₦45,000 (failed Sep 20)", nextRenewal: "Sep 20, 2026 (missed)", failedPayments: 2, mrr: "₦0" },
  { business: "Lagos Smile Dental", plan: "Private Beta", state: "trialing", lastPayment: "— (trial)", nextRenewal: "Oct 18, 2026 (trial ends)", failedPayments: 0, mrr: "₦0" },
];

export const SYNC_HEALTH: SyncHealthRow[] = [
  { source: "Meta Ads", business: "SwiftHaul Logistics", lastSync: "12 min ago", status: "healthy", failures: 0 },
  { source: "Google Ads", business: "SwiftHaul Logistics", lastSync: "26 min ago", status: "healthy", failures: 0 },
  { source: "Shopify", business: "KoraHome Store", lastSync: "3 hours ago", status: "failed", failures: 3, lastError: "Authorization expired — token refresh failed at 14:03" },
  { source: "Paystack (via Shopify)", business: "KoraHome Store", lastSync: "3 hours ago", status: "delayed", failures: 1, lastError: "Upstream source paused" },
  { source: "Shopify", business: "NaijaThreads", lastSync: "8 min ago", status: "healthy", failures: 0 },
  { source: "Meta Ads", business: "NaijaThreads", lastSync: "15 min ago", status: "healthy", failures: 0 },
  { source: "Google Analytics", business: "NaijaThreads", lastSync: "22 min ago", status: "healthy", failures: 0 },
  { source: "Shopify", business: "GreenLeaf Foods", lastSync: "51 min ago", status: "delayed", failures: 2, lastError: "Rate limited — retrying with backoff" },
  { source: "Google Analytics", business: "Kola Interiors", lastSync: "6 hours ago", status: "healthy", failures: 0 },
  { source: "Google Ads", business: "Zenith Fitness Studio", lastSync: "22 days ago", status: "failed", failures: 41, lastError: "Workspace suspended — connection revoked" },
];

export const JOBS: JobRow[] = [
  { id: "jb-1", job: "Data sync — Shopify", business: "KoraHome Store", started: "Sep 30, 14:03", duration: "—", status: "failed", error: "ShopifyAuthError: access_token expired (expected exp 2026-09-30T14:00Z). Reconnection required." },
  { id: "jb-2", job: "Metric calculation", business: "SwiftHaul Logistics", started: "Sep 30, 18:14", duration: "42s", status: "success" },
  { id: "jb-3", job: "CSV import — referral-enquiries-sep.csv", business: "SwiftHaul Logistics", started: "Sep 12, 11:29", duration: "1m 12s", status: "success", error: "2 duplicate rows skipped (warnings)" },
  { id: "jb-4", job: "Report generation — September monthly review", business: "SwiftHaul Logistics", started: "Oct 1, 06:00", duration: "2m 03s", status: "success" },
  { id: "jb-5", job: "Data sync — Meta Ads", business: "SwiftHaul Logistics", started: "Sep 30, 18:10", duration: "35s", status: "success" },
  { id: "jb-6", job: "Diagnosis refresh", business: "NaijaThreads", started: "Sep 30, 17:45", duration: "1m 48s", status: "success" },
  { id: "jb-7", job: "Data sync — Shopify", business: "GreenLeaf Foods", started: "Sep 30, 17:30", duration: "4m 20s", status: "running" },
  { id: "jb-8", job: "CSV import — august-orders.xlsx", business: "BrightPath Tutors", started: "Sep 26, 09:12", duration: "—", status: "failed", error: "ImportValidationError: 14 rows missing required column 'Date' (rows 3, 7, 12–23)." },
];

export const AI_AUDIT: AiAuditItem[] = [
  {
    id: "audit-1",
    business: "SwiftHaul Logistics",
    diagnosis: "Conversion (not lead generation) is the immediate constraint; largest gap among Instagram enquiries.",
    recommendation: "Improve qualification and follow-up for Instagram enquiries before increasing spend.",
    confidence: 82,
    evidenceCount: 5,
    coverage: 62,
    date: "2026-09-30",
    feedback: "helpful",
    status: "reviewed",
    detail: {
      inputs: [
        { label: "Marketing spend", value: "₦370,000 (+40%)", provenance: "measured" },
        { label: "Enquiries", value: "277 (+50%)", provenance: "measured" },
        { label: "Customers", value: "49 (+4%)", provenance: "user-supplied" },
        { label: "Channel split", value: "Instagram 184→11 · Google 62→24 · Referral 31→14", provenance: "measured" },
      ],
      interpretation:
        "System compared growth rates across the funnel and channel-level conversion, identified the largest gap (Instagram 6.0%), and avoided attributing causality to the channel itself.",
      missingData: ["Response time by channel", "Lead quality scoring", "Lost-reason tracking"],
      concerns: ["23% of customers lack acquisition source (may shift channel attribution slightly)"],
      userFeedback: "Marked helpful by workspace owner on Sep 30.",
      outcome: "Action started Sep 28; experiment tracking toward 8–9% vs 6.0% baseline.",
    },
  },
  {
    id: "audit-2",
    business: "KoraHome Store",
    diagnosis: "Mobile checkout is the constraint; demand healthy (traffic +24%, product views +19%).",
    recommendation: "Investigate mobile checkout and payment failures before increasing traffic acquisition.",
    confidence: 78,
    evidenceCount: 5,
    coverage: 58,
    date: "2026-09-30",
    feedback: "none",
    status: "pending",
    detail: {
      inputs: [
        { label: "Traffic", value: "18,430 (+24%)", provenance: "measured" },
        { label: "Orders", value: "740 (−8%)", provenance: "measured" },
        { label: "Mobile checkout completion", value: "48% (Aug: 71%)", provenance: "measured" },
        { label: "Payment failures", value: "+31%", provenance: "measured" },
      ],
      interpretation: "Funnel step analysis isolated checkout as the largest deterioration point; correlated with payment failure data from a second source.",
      missingData: ["Step-level error logs", "Session recordings"],
      concerns: ["Shopify sync failed after diagnosis was generated — underlying data unchanged for the diagnosis period"],
    },
  },
  { id: "audit-3", business: "NaijaThreads", diagnosis: "Repeat purchase rate improving; acquisition CAC rising on Instagram.", recommendation: "Test a loyalty prompt for second purchases.", confidence: 64, evidenceCount: 3, coverage: 71, date: "2026-09-29", feedback: "helpful", status: "reviewed" },
  { id: "audit-4", business: "GreenLeaf Foods", diagnosis: "Weekend traffic converts poorly on mobile product pages.", recommendation: "Compress hero images and lazy-load product galleries.", confidence: 58, evidenceCount: 2, coverage: 66, date: "2026-09-28", feedback: "unhelpful", status: "flagged" },
  { id: "audit-5", business: "Lagos Smile Dental", diagnosis: "Insufficient data for diagnosis — enquiry trend only.", recommendation: "Add channel-level enquiry totals to enable conversion analysis.", confidence: 35, evidenceCount: 1, coverage: 24, date: "2026-09-27", feedback: "none", status: "reviewed" },
  { id: "audit-6", business: "Kola Interiors", diagnosis: "Quote-to-close time doubled in September.", recommendation: "Introduce 48-hour quote follow-up rule.", confidence: 69, evidenceCount: 3, coverage: 37, date: "2026-09-25", feedback: "none", status: "pending" },
];

export const SUPPORT_TICKETS: SupportTicket[] = [
  { id: "st-1", type: "data-concern", business: "KoraHome Store", user: "Ifeoma Nwosu", summary: "Checkout completion numbers look wrong after sync failure", message: "After the Shopify sync failure my dashboard shows completion as of 11am. Is my data still being analysed correctly?", priority: "high", status: "open", created: "2026-09-30 15:12", workspaceContext: "Sync failed 14:03 · coverage 58% · 2 open critical alerts" },
  { id: "st-2", type: "ai-concern", business: "GreenLeaf Foods", user: "Halima Bello", summary: "Image compression recommendation doesn't match our setup", message: "Our images are already WebP and lazy-loaded. The AI diagnosis seems wrong.", priority: "medium", status: "in-progress", created: "2026-09-29 10:40", workspaceContext: "Audit audit-4 flagged · confidence 58% · coverage 66%" },
  { id: "st-3", type: "bug", business: "SwiftHaul Logistics", user: "Tunde Bakare", summary: "CSV mapping screen loses selection on back navigation", message: "When I go back from the review step, my column mappings reset.", priority: "medium", status: "in-progress", created: "2026-09-12 12:03", workspaceContext: "CSV import journey · 2 duplicate rows detected same session" },
  { id: "st-4", type: "feedback", business: "NaijaThreads", user: "Sade Balogun", summary: "Love the diagnosis detail screen", message: "The root-cause chain makes it easy to explain to my team. More of this please.", priority: "low", status: "resolved", created: "2026-09-24 16:22", workspaceContext: "Coverage 71% · 6 diagnoses generated" },
  { id: "st-5", type: "bug", business: "Zenith Fitness Studio", user: "Rex Johnson", summary: "Cannot reconnect Google Ads after suspension", message: "Workspace was suspended for payment failure; reconnect button shows permission error.", priority: "low", status: "open", created: "2026-09-21 09:15", workspaceContext: "Subscription past-due · 2 failed payments" },
  { id: "st-6", type: "feedback", business: "Lagos Smile Dental", user: "Dr. Kelechi Umeh", summary: "Onboarding felt quick and private", message: "I liked that I didn't have to connect anything to get a first read on my numbers.", priority: "low", status: "resolved", created: "2026-09-22 11:48", workspaceContext: "Trial workspace · coverage 24%" },
];

export const ADMIN_SYSTEM_EVENTS = [
  { time: "Oct 1, 06:02", event: "September monthly review generated for SwiftHaul Logistics (job jb-4)", level: "info" },
  { time: "Sep 30, 18:14", event: "Metric calculation completed for SwiftHaul Logistics", level: "info" },
  { time: "Sep 30, 14:03", event: "Shopify sync FAILED for KoraHome Store (authorization expired) — alert issued to workspace", level: "error" },
  { time: "Sep 30, 09:00", event: "2 critical alerts issued for KoraHome Store (checkout completion, sync)", level: "warning" },
  { time: "Sep 29, 16:20", event: "Opportunity alert issued for SwiftHaul Logistics (Google efficiency)", level: "info" },
  { time: "Sep 26, 09:12", event: "CSV import failed for BrightPath Tutors (validation errors)", level: "error" },
] as const;
