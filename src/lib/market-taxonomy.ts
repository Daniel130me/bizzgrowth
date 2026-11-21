// Client-safe marketplace taxonomy shared by onboarding, task creation and APIs.
// Suggestions improve consistency for matching, while specialists may still add
// a precise custom skill when the catalogue does not describe their work.

export const MARKET_CATEGORIES = [
  { id: "marketing", label: "Marketing & Ads" },
  { id: "sales", label: "Sales & Outreach" },
  { id: "content", label: "Content & Social" },
  { id: "design", label: "Brand & Design" },
  { id: "web", label: "Web & Tech" },
  { id: "ops", label: "Operations" },
  { id: "finance", label: "Finance & Books" },
  { id: "data", label: "Data & Analytics" },
  { id: "people", label: "People & HR" },
  { id: "legal", label: "Legal" },
] as const;

export type MarketCategoryId = (typeof MARKET_CATEGORIES)[number]["id"];

export const MARKET_SKILLS: Record<MarketCategoryId, readonly string[]> = {
  marketing: [
    "Marketing Strategy", "Meta Ads", "Google Ads", "TikTok Ads", "Media Buying",
    "Performance Marketing", "PPC Campaign Management", "Conversion Optimization",
    "Search Engine Optimization", "Email Marketing", "Marketing Automation",
    "Lead Generation", "Affiliate Marketing", "Campaign Analytics",
  ],
  sales: [
    "Sales Strategy", "B2B Sales", "Prospecting", "Cold Email", "Cold Calling",
    "Lead Generation", "CRM Setup", "HubSpot", "Salesforce", "Pipedrive",
    "Pipeline Management", "Sales Copywriting", "Account Management", "Customer Success",
  ],
  content: [
    "Content Strategy", "Social Media Management", "Copywriting", "Blog Writing",
    "Video Editing", "Short-form Video", "Scriptwriting", "YouTube Management",
    "Instagram Content", "TikTok Content", "Community Management", "Email Newsletters",
    "Content Calendar", "Influencer Marketing",
  ],
  design: [
    "Brand Identity", "Logo Design", "Graphic Design", "UI Design", "UX Design",
    "Figma", "Canva", "Packaging Design", "Presentation Design", "Illustration",
    "Motion Design", "Social Media Design", "Print Design", "Design Systems",
  ],
  web: [
    "Web Development", "Frontend Development", "Backend Development", "Full-stack Development",
    "Web Design", "WordPress", "Shopify Development", "WooCommerce", "Next.js", "React",
    "TypeScript", "JavaScript", "Node.js", "API Integration", "Payment Integration",
    "Technical SEO", "Website Performance", "Cybersecurity", "No-code Development",
  ],
  ops: [
    "Operations Strategy", "Process Improvement", "Project Management", "Inventory Management",
    "Supply Chain", "Vendor Management", "Procurement", "Logistics", "Quality Assurance",
    "Customer Support", "Standard Operating Procedures", "Business Administration",
    "Virtual Assistance", "Event Operations",
  ],
  finance: [
    "Bookkeeping", "Financial Accounting", "Management Accounting", "Tax Preparation",
    "Payroll", "Budgeting", "Financial Modelling", "Cash Flow Management", "Bank Reconciliation",
    "Accounts Payable", "Accounts Receivable", "QuickBooks", "Xero", "Zoho Books",
  ],
  data: [
    "Data Analysis", "Business Intelligence", "Dashboard Design", "Google Analytics 4",
    "Google Sheets", "Microsoft Excel", "SQL", "Power BI", "Tableau", "Looker Studio",
    "Data Visualization", "Reporting Automation", "Data Cleaning", "Experiment Analysis",
  ],
  people: [
    "Recruitment", "Talent Sourcing", "Interview Design", "Employee Onboarding",
    "Performance Management", "Learning and Development", "HR Operations", "Payroll Administration",
    "Compensation and Benefits", "Culture Development", "Employee Relations", "HR Policy",
  ],
  legal: [
    "Business Registration", "Contract Drafting", "Contract Review", "Commercial Law",
    "Employment Law", "Intellectual Property", "Privacy Compliance", "Regulatory Compliance",
    "Terms and Conditions", "Non-disclosure Agreements", "Corporate Governance", "Legal Research",
  ],
};

// Common choices are suggestions, not an allowlist. Specialists can add any
// language they work in, including regional languages and signed languages.
export const MARKET_LANGUAGES = [
  "English", "Nigerian Pidgin", "Hausa", "Yoruba", "Igbo", "French",
  "Arabic", "Portuguese", "Spanish", "German", "Mandarin Chinese",
  "Swahili", "Twi", "Amharic", "Dutch", "Italian", "Hindi",
] as const;

export function isMarketCategory(value: string): value is MarketCategoryId {
  return MARKET_CATEGORIES.some((category) => category.id === value);
}

export function skillsForCategory(value: string): readonly string[] {
  return isMarketCategory(value) ? MARKET_SKILLS[value] : [];
}
