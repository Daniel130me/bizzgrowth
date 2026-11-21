// Prototype Map registry — all 119 screens/views/states.
// Group = which screen-group directory owns the implementation.

export type ScreenGroup =
  | "public"
  | "onboarding"
  | "home"
  | "performance"
  | "insights"
  | "actions"
  | "ask"
  | "data"
  | "goals"
  | "reports"
  | "brain"
  | "team"
  | "settings"
  | "states"
  | "admin"
  | "market"
  | "challenges"
  | "diagnosis"
  | "prototype";

export interface ScreenMeta {
  num: number;
  id: string; // registry key
  route: string; // hash route pattern (":param" supported)
  name: string;
  category: string;
  group: ScreenGroup;
}

export const SCREENS: ScreenMeta[] = [
  // A. Public, authentication and access
  { num: 1, id: "landing", route: "landing", name: "Landing Page", category: "Public", group: "public" },
  { num: 2, id: "pricing", route: "pricing", name: "Pricing / Plans", category: "Public", group: "public" },
  { num: 3, id: "signup", route: "signup", name: "Create Account", category: "Authentication", group: "public" },
  { num: 4, id: "verify-email", route: "verify-email", name: "Verify Email", category: "Authentication", group: "public" },
  { num: 5, id: "signin", route: "signin", name: "Sign In", category: "Authentication", group: "public" },
  { num: 6, id: "forgot-password", route: "forgot-password", name: "Forgot Password", category: "Authentication", group: "public" },
  { num: 7, id: "reset-password", route: "reset-password", name: "Reset Password", category: "Authentication", group: "public" },
  { num: 8, id: "accept-invite", route: "accept-invite", name: "Accept Team Invitation", category: "Authentication", group: "public" },
  { num: 9, id: "privacy-policy", route: "privacy-policy", name: "Privacy Policy", category: "Public", group: "public" },
  { num: 10, id: "terms", route: "terms", name: "Terms of Service", category: "Public", group: "public" },
  // B. First-time setup and diagnosis
  { num: 11, id: "welcome", route: "welcome", name: "Welcome / Choose How to Start", category: "Onboarding", group: "onboarding" },
  { num: 12, id: "create-workspace", route: "create-workspace", name: "Create Business Workspace", category: "Onboarding", group: "onboarding" },
  { num: 13, id: "checkup-intro", route: "checkup-intro", name: "Private Checkup Introduction", category: "Onboarding", group: "onboarding" },
  { num: 14, id: "onboarding-chat", route: "onboarding-chat", name: "Conversational Onboarding", category: "Onboarding", group: "onboarding" },
  { num: 15, id: "journey-confirm", route: "journey-confirm", name: "Business Model / Journey Confirmation", category: "Onboarding", group: "onboarding" },
  { num: 16, id: "business-understanding", route: "business-understanding", name: "What We Understand About Your Business", category: "Onboarding", group: "onboarding" },
  { num: 17, id: "first-diagnosis", route: "first-diagnosis", name: "First Diagnosis", category: "Onboarding", group: "onboarding" },
  { num: 18, id: "first-diagnosis-evidence", route: "first-diagnosis-evidence", name: "First Diagnosis Evidence", category: "Onboarding", group: "onboarding" },
  { num: 19, id: "improve-diagnosis", route: "improve-diagnosis", name: "Improve My Diagnosis", category: "Onboarding", group: "onboarding" },
  { num: 20, id: "setup-complete", route: "setup-complete", name: "Setup Complete / Enter Workspace", category: "Onboarding", group: "onboarding" },
  // B2. The owner's diagnosis on its own page (sidebar), in tabs — the reveal above uses the same tabs
  // Routes are patterns that match the page's view map (one screen serves every tab, so it stays mounted).
  { num: 130, id: "diagnosis", route: "diagnosis", name: "Your Diagnosis — Summary", category: "Diagnosis", group: "diagnosis" },
  { num: 131, id: "diagnosis/tab", route: "diagnosis/:tab", name: "Your Diagnosis — a tab (summary, what-to-do, why, more = the owner's insights)", category: "Diagnosis", group: "diagnosis" },
  { num: 132, id: "diagnosis/challenge", route: "diagnosis/:tab/:challenge", name: "Your Diagnosis — another challenge's diagnosis", category: "Diagnosis", group: "diagnosis" },
  { num: 133, id: "first-diagnosis/tab", route: "first-diagnosis/:tab", name: "First Diagnosis — a tab (setup reveal)", category: "Onboarding", group: "onboarding" },
  // C. Home and executive overview
  { num: 21, id: "home", route: "home", name: "Home / Business Overview", category: "Home", group: "home" },
  { num: 22, id: "health-detail", route: "health-detail", name: "Business Health Detail", category: "Home", group: "home" },
  { num: 23, id: "metric", route: "metric/:id", name: "Metric Drill-down", category: "Home", group: "home" },
  // D. Business performance
  { num: 24, id: "performance", route: "performance", name: "Performance Overview", category: "Performance", group: "performance" },
  { num: 25, id: "performance/revenue", route: "performance/revenue", name: "Revenue & Sales Performance", category: "Performance", group: "performance" },
  { num: 26, id: "performance/funnel", route: "performance/funnel", name: "Customer Journey / Funnel", category: "Performance", group: "performance" },
  { num: 27, id: "performance/marketing", route: "performance/marketing", name: "Marketing Performance", category: "Performance", group: "performance" },
  { num: 28, id: "performance/channel", route: "performance/marketing/:channel", name: "Marketing Channel Detail", category: "Performance", group: "performance" },
  { num: 29, id: "performance/website", route: "performance/website", name: "Website & Conversion Performance", category: "Performance", group: "performance" },
  { num: 30, id: "performance/products", route: "performance/products", name: "Product / Service Performance", category: "Performance", group: "performance" },
  { num: 31, id: "performance/retention", route: "performance/retention", name: "Customer / Retention Performance", category: "Performance", group: "performance" },
  // E. Insights, diagnosis and opportunities
  { num: 32, id: "insights", route: "insights", name: "Insights Feed", category: "Insights", group: "insights" },
  { num: 33, id: "insights/diagnosis", route: "insights/:id", name: "Diagnosis / Root-Cause Detail", category: "Insights", group: "insights" },
  { num: 34, id: "insights/opportunity", route: "insights/:id", name: "Opportunity Detail", category: "Insights", group: "insights" },
  { num: 35, id: "insights/evidence", route: "insights/:id", name: "Confidence / Evidence Detail", category: "Insights", group: "insights" },
  { num: 36, id: "alerts", route: "alerts", name: "Alerts Centre", category: "Insights", group: "insights" },
  { num: 37, id: "alerts/:id", route: "alerts/:id", name: "Alert Detail", category: "Insights", group: "insights" },
  // F. Recommendations, actions and experiments
  { num: 38, id: "actions", route: "actions", name: "Action Centre", category: "Actions", group: "actions" },
  { num: 39, id: "recommendations/:id", route: "recommendations/:id", name: "Recommendation Detail", category: "Actions", group: "actions" },
  { num: 40, id: "action-start/:id", route: "action-start/:id", name: "Start Action / Implementation Setup", category: "Actions", group: "actions" },
  { num: 41, id: "actions/:id", route: "actions/:id", name: "Action Detail / Progress", category: "Actions", group: "actions" },
  { num: 42, id: "experiment-setup/:id", route: "experiment-setup/:id", name: "Experiment Setup", category: "Actions", group: "actions" },
  { num: 43, id: "experiments/:id", route: "experiments/:id", name: "Experiment / Measurement Tracking", category: "Actions", group: "actions" },
  { num: 44, id: "outcome/:id", route: "outcome/:id", name: "Outcome / Result Detail", category: "Actions", group: "actions" },
  { num: 45, id: "timeline", route: "timeline", name: "Business Timeline / Change Ledger", category: "Actions", group: "actions" },
  { num: 46, id: "change-add", route: "change-add", name: "Add / Edit Business Change", category: "Actions", group: "actions" },
  { num: 47, id: "change-confirm", route: "timeline", name: "Detected Change Confirmation (dialog)", category: "Actions", group: "actions" },
  { num: 120, id: "check-in/:id", route: "check-in/:id", name: "Check-in (coaching follow-up)", category: "Actions", group: "actions" },
  // F2. Challenges — what's holding the business back, one at a time
  { num: 121, id: "challenges", route: "challenges", name: "Challenges (list and summary)", category: "Challenges", group: "challenges" },
  { num: 122, id: "challenges/:id", route: "challenges/:id", name: "Challenge Detail / Full Story", category: "Challenges", group: "challenges" },
  { num: 123, id: "challenges/new", route: "challenges/new", name: "Report a New Challenge (short chat)", category: "Challenges", group: "challenges" },
  { num: 124, id: "challenges/:id/chat", route: "challenges/:id/chat", name: "Challenge Short Chat (tell me more)", category: "Challenges", group: "challenges" },
  { num: 125, id: "test-businesses", route: "test-businesses", name: "Test Businesses (development only)", category: "Prototype", group: "prototype" },
  // G. Ask your business
  { num: 48, id: "ask", route: "ask", name: "Ask Your Business", category: "Ask", group: "ask" },
  { num: 49, id: "ask/history", route: "ask/history", name: "Conversation History", category: "Ask", group: "ask" },
  // H. Data centre
  { num: 50, id: "data", route: "data", name: "Data Coverage Overview", category: "Data", group: "data" },
  { num: 51, id: "integrations", route: "integrations", name: "Integrations / Sources Library", category: "Data", group: "data" },
  { num: 52, id: "integrations/:id", route: "integrations/:id", name: "Integration Detail", category: "Data", group: "data" },
  { num: 53, id: "connect/:id", route: "connect/:id", name: "Permission Review Before Connecting", category: "Data", group: "data" },
  { num: 125, id: "connect/google", route: "connect/google", name: "Choose Google Sites and Properties", category: "Data", group: "data" },
  { num: 127, id: "connect/meta", route: "connect/meta", name: "Choose Meta Accounts and Pages", category: "Data", group: "data" },
  { num: 128, id: "connect/tiktok-ads", route: "connect/tiktok-ads", name: "Choose TikTok Advertiser", category: "Data", group: "data" },
  { num: 129, id: "connect/shopify", route: "connect/shopify", name: "Connect Shopify Store", category: "Data", group: "data" },
  { num: 54, id: "syncing", route: "syncing", name: "Connection Success / Initial Sync", category: "Data", group: "data" },
  { num: 55, id: "connection-error", route: "connection-error", name: "Connection Error / Reconnect", category: "Data", group: "data" },
  { num: 126, id: "connection-error/:id", route: "connection-error/:id", name: "Connection Error Detail", category: "Data", group: "data" },
  { num: 56, id: "source-settings/:id", route: "source-settings/:id", name: "Connected Source Settings", category: "Data", group: "data" },
  { num: 57, id: "manual-entry", route: "manual-entry", name: "Manual Data Entry", category: "Data", group: "data" },
  { num: 58, id: "manual-history", route: "manual-history", name: "Manual Data History", category: "Data", group: "data" },
  { num: 59, id: "csv-upload", route: "csv-upload", name: "CSV / Excel Upload", category: "Data", group: "data" },
  { num: 60, id: "csv-mapping", route: "csv-mapping", name: "CSV Column Mapping", category: "Data", group: "data" },
  { num: 61, id: "csv-review", route: "csv-review", name: "Import Review & Validation", category: "Data", group: "data" },
  { num: 62, id: "csv-result", route: "csv-result", name: "Import Result / Error Report", category: "Data", group: "data" },
  { num: 63, id: "data-quality", route: "data-quality", name: "Data Quality Issues", category: "Data", group: "data" },
  { num: 64, id: "provenance/:id", route: "provenance/:id", name: "Data Provenance / Fact Detail", category: "Data", group: "data" },
  // I. Business goals
  { num: 65, id: "goals", route: "goals", name: "Goals Overview", category: "Goals", group: "goals" },
  { num: 66, id: "goal-create", route: "goal-create", name: "Create / Edit Goal", category: "Goals", group: "goals" },
  { num: 67, id: "goals/:id", route: "goals/:id", name: "Goal Detail & Progress", category: "Goals", group: "goals" },
  // J. Briefs and reporting
  { num: 68, id: "brief/weekly", route: "brief/weekly", name: "Weekly Business Brief", category: "Reports", group: "reports" },
  { num: 69, id: "brief/monthly", route: "brief/monthly", name: "Monthly Business Review", category: "Reports", group: "reports" },
  { num: 70, id: "reports", route: "reports", name: "Reports / Brief Archive", category: "Reports", group: "reports" },
  // K. Business profile / brain
  { num: 71, id: "brain", route: "brain", name: "Business Profile / Business Brain", category: "Business Brain", group: "brain" },
  { num: 72, id: "brain/products", route: "brain/products", name: "Products & Services Configuration", category: "Business Brain", group: "brain" },
  { num: 73, id: "brain/customers", route: "brain/customers", name: "Customer / Target Market", category: "Business Brain", group: "brain" },
  { num: 74, id: "brain/journey", route: "brain/journey", name: "Customer Journey Configuration", category: "Business Brain", group: "brain" },
  { num: 75, id: "brain/channels", route: "brain/channels", name: "Channels Configuration", category: "Business Brain", group: "brain" },
  { num: 76, id: "brain/priorities", route: "brain/priorities", name: "Goals & Priorities Configuration", category: "Business Brain", group: "brain" },
  // L. Team and accountability
  { num: 77, id: "team", route: "team", name: "Team Members", category: "Team", group: "team" },
  { num: 78, id: "team/invite", route: "team/invite", name: "Invite Team Member", category: "Team", group: "team" },
  { num: 79, id: "team/:id", route: "team/:id", name: "Member Detail / Edit Access", category: "Team", group: "team" },
  { num: 80, id: "team/roles", route: "team/roles", name: "Roles & Permissions", category: "Team", group: "team" },
  { num: 81, id: "my-actions", route: "my-actions", name: "My Assigned Actions", category: "Team", group: "team" },
  // M. Notifications
  { num: 82, id: "notifications", route: "notifications", name: "Notifications Centre", category: "Notifications", group: "team" },
  { num: 83, id: "notification-prefs", route: "notification-prefs", name: "Notification Preferences", category: "Notifications", group: "team" },
  // N. Account, workspace and billing settings
  { num: 84, id: "settings/business", route: "settings/business", name: "Workspace / Business Settings", category: "Settings", group: "settings" },
  { num: 85, id: "settings/profile", route: "settings/profile", name: "User Profile", category: "Settings", group: "settings" },
  { num: 86, id: "settings/security", route: "settings/security", name: "Security & Password", category: "Settings", group: "settings" },
  { num: 87, id: "settings/privacy", route: "settings/privacy", name: "Privacy & Data Permissions", category: "Settings", group: "settings" },
  { num: 88, id: "settings/plan", route: "settings/plan", name: "Plan / Subscription", category: "Billing", group: "settings" },
  { num: 89, id: "upgrade", route: "upgrade", name: "Upgrade / Checkout", category: "Billing", group: "settings" },
  { num: 90, id: "payment-method", route: "payment-method", name: "Payment Method", category: "Billing", group: "settings" },
  { num: 91, id: "invoices", route: "invoices", name: "Invoices / Billing History", category: "Billing", group: "settings" },
  { num: 92, id: "settings/export-delete", route: "settings/export-delete", name: "Export / Delete Business Data", category: "Settings", group: "settings" },
  { num: 93, id: "help", route: "help", name: "Help & Support", category: "Support", group: "settings" },
  { num: 94, id: "feedback", route: "feedback", name: "Send Feedback / Report Problem", category: "Support", group: "settings" },
  { num: 115, id: "settings/ai", route: "settings/ai", name: "AI Gateway / Providers", category: "Settings", group: "settings" },
  // Q. Specialists marketplace
  { num: 116, id: "market", route: "market", name: "Specialists Marketplace", category: "Specialists", group: "market" },
  { num: 117, id: "market/specialist", route: "market/specialist/:id", name: "Specialist Profile / Showcase", category: "Specialists", group: "market" },
  { num: 118, id: "market/post", route: "market/post", name: "Post a Task / Brief", category: "Specialists", group: "market" },
  { num: 119, id: "market/task", route: "market/task/:id", name: "Task Detail & Bids", category: "Specialists", group: "market" },
  { num: 120, id: "specialist/onboarding", route: "specialist/onboarding", name: "Specialist Application & Profile", category: "Specialists", group: "market" },
  { num: 121, id: "specialist/dashboard", route: "specialist/dashboard", name: "Specialist Work Dashboard", category: "Specialists", group: "market" },
  { num: 122, id: "specialist/engagement", route: "specialist/engagement/:id", name: "Specialist Engagement Workspace", category: "Specialists", group: "market" },
  { num: 123, id: "market/engagement", route: "market/engagement/:id", name: "Engagement Workspace", category: "Specialists", group: "market" },
  // O. Critical system states
  { num: 95, id: "state/no-data", route: "state/no-data", name: "New Workspace / No Data Yet", category: "System state", group: "states" },
  { num: 96, id: "state/insufficient", route: "state/insufficient", name: "Insufficient Data for Diagnosis", category: "System state", group: "states" },
  { num: 97, id: "state/syncing", route: "state/syncing", name: "Data Syncing", category: "System state", group: "states" },
  { num: 98, id: "state/stale", route: "state/stale", name: "Data Stale / Sync Delayed", category: "System state", group: "states" },
  { num: 99, id: "state/disconnected", route: "state/disconnected", name: "Integration Disconnected", category: "System state", group: "states" },
  { num: 100, id: "state/permission-denied", route: "state/permission-denied", name: "Permission Denied", category: "System state", group: "states" },
  { num: 101, id: "state/plan-limit", route: "state/plan-limit", name: "Plan Limit / Subscription Expired", category: "System state", group: "states" },
  { num: 102, id: "state/session-expired", route: "state/session-expired", name: "Session Expired", category: "System state", group: "states" },
  { num: 103, id: "state/404", route: "state/404", name: "404 / Page Not Found", category: "System state", group: "states" },
  { num: 104, id: "state/error", route: "state/error", name: "General Error / Service Unavailable", category: "System state", group: "states" },
  // P. Internal platform administration
  { num: 105, id: "admin", route: "admin", name: "Admin Dashboard", category: "Admin", group: "admin" },
  { num: 106, id: "admin/businesses", route: "admin/businesses", name: "Businesses Management", category: "Admin", group: "admin" },
  { num: 107, id: "admin/businesses/:id", route: "admin/businesses/:id", name: "Business Admin Detail", category: "Admin", group: "admin" },
  { num: 108, id: "admin/users", route: "admin/users", name: "Users Management", category: "Admin", group: "admin" },
  { num: 109, id: "admin/users/:id", route: "admin/users/:id", name: "User Admin Detail", category: "Admin", group: "admin" },
  { num: 110, id: "admin/subscriptions", route: "admin/subscriptions", name: "Subscriptions & Payments Admin", category: "Admin", group: "admin" },
  { num: 111, id: "admin/sync-health", route: "admin/sync-health", name: "Integration / Sync Health", category: "Admin", group: "admin" },
  { num: 112, id: "admin/jobs", route: "admin/jobs", name: "Background Jobs / Import Errors", category: "Admin", group: "admin" },
  { num: 113, id: "admin/ai-audit", route: "admin/ai-audit", name: "AI Diagnosis & Recommendation Audit", category: "Admin", group: "admin" },
  { num: 114, id: "admin/support", route: "admin/support", name: "Support / Feedback Inbox", category: "Admin", group: "admin" },
  { num: 124, id: "admin/specialists", route: "admin/specialists", name: "Specialist Application Review", category: "Admin", group: "admin" },
  { num: 125, id: "admin/ai-providers", route: "admin/ai-providers", name: "AI Provider Management", category: "Admin", group: "admin" },
  { num: 126, id: "admin/ai-gateway", route: "admin/ai-gateway", name: "AI Gateway Status", category: "Admin", group: "admin" },
];

export const SCREENS_WITH_MAP = SCREENS;
