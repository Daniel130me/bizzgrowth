// The full list of platforms an owner might use, grouped by the five journey
// stages plus "Money and books" and "Everything else". Client-safe (no secrets).
//
// availability:
//   "live"     — a real connector exists (src/lib/connectors/registry.ts)
//   "built-in" — already works inside Nellovia (CSV upload, manual entry)
//   "soon"     — not connectable yet; owners can say "I use this"
//
// Adding a platform later: build its connector, register it, then flip its
// entry here to "live" with `connector: { id, product }`.

import type { FocusStage } from "@/lib/checkup";

export type CatalogueGroup = FocusStage | "money" | "other";

export const CATALOGUE_GROUPS: { id: CatalogueGroup; label: string; hint: string }[] = [
  { id: "found", label: "Getting found", hint: "How people discover you — search, maps, ads, social" },
  { id: "enquire", label: "Enquiries", hint: "People reaching out — chats, forms, bookings" },
  { id: "convert", label: "Becoming customers", hint: "Payments, orders, sales and deals" },
  { id: "deliver", label: "Delivering", hint: "Support requests and deliveries" },
  { id: "return", label: "Coming back", hint: "Reminders, newsletters and reviews" },
  { id: "money", label: "Money and books", hint: "Your accounting" },
  { id: "other", label: "Everything else", hint: "Any other tool, a spreadsheet, or typing totals in" },
];

/** What a live connector reads, in the owner's words, and the exact Google/OAuth scope behind it. */
export interface ScopeLine {
  scope: string;
  label: string;
}

export interface CatalogueEntry {
  id: string;
  name: string;
  group: CatalogueGroup;
  /** One plain sentence: what Nellovia would learn from it. */
  blurb: string;
  availability: "live" | "built-in" | "soon";
  /** Live entries: which connector and product handle it. */
  connector?: { id: string; product: string };
  /** Built-in entries: where it lives in the app. */
  route?: string;
  /** Where it works, when that matters (e.g. "Nigeria"). */
  region?: string;
  /** An honest caveat shown on the card. */
  note?: string;
  /** Live entries: what is read and what can never be done. */
  reads?: string[];
  cannot?: string[];
  scopes?: ScopeLine[];
}

const SOON = "soon" as const;

export const GOOGLE_SCOPES = {
  searchConsole: "https://www.googleapis.com/auth/webmasters.readonly",
  analytics: "https://www.googleapis.com/auth/analytics.readonly",
  sheets: "https://www.googleapis.com/auth/spreadsheets.readonly",
  ads: "https://www.googleapis.com/auth/adwords",
} as const;

export const META_SCOPES = {
  ads: "ads_read",
  pages: "pages_show_list",
  pageEngagement: "pages_read_engagement",
  insights: "read_insights",
  instagram: "instagram_basic",
  instagramInsights: "instagram_manage_insights",
} as const;

export const TIKTOK_PROFILE_SCOPES = {
  basic: "user.info.basic",
  profile: "user.info.profile",
  stats: "user.info.stats",
  videos: "video.list",
} as const;

export const CATALOGUE: CatalogueEntry[] = [
  // ---------- Getting found ----------
  {
    id: "google-search-console",
    name: "Google Search Console",
    group: "found",
    blurb: "What people type into Google before they find your website, how often you show up, and how many click through.",
    availability: "live",
    connector: { id: "google", product: "search-console" },
    reads: [
      "Daily totals for your site: clicks from Google, times you showed up, average position",
      "Your top searches and top pages over the last 90 days",
    ],
    cannot: ["Change your website or your Search Console settings", "Add or remove people", "Submit or remove pages"],
    scopes: [{ scope: GOOGLE_SCOPES.searchConsole, label: "View Search Console data for your verified sites (read-only)" }],
  },
  {
    id: "google-analytics",
    name: "Google Analytics",
    group: "found",
    blurb: "How many people visit your website, how they arrive, and how many take a key action like sending a form.",
    availability: "live",
    connector: { id: "google", product: "analytics" },
    reads: [
      "Daily visits, people and key actions (key events) for one GA4 property",
      "Visits by channel — search, social, direct, referrals — over the last 90 days",
    ],
    cannot: ["Change tags, key events or settings", "Add or remove people", "See who any single visitor is"],
    scopes: [{ scope: GOOGLE_SCOPES.analytics, label: "See your Google Analytics data (read-only)" }],
  },
  { id: "google-business-profile", name: "Google Business Profile", group: "found", availability: SOON, blurb: "Calls, direction requests, website taps and reviews from your Google Maps listing." },
  { id: "youtube", name: "YouTube", group: "found", availability: SOON, blurb: "Views, watch time and subscribers on your channel." },
  {
    id: "meta-ads", name: "Meta Ads", group: "found", availability: "live", connector: { id: "meta", product: "ads" },
    blurb: "What you spend on Facebook and Instagram ads and what it brings in.",
    reads: ["Daily spend, impressions, reach and clicks", "Leads, purchases and purchase value reported by Meta"],
    cannot: ["Create, edit or pause campaigns", "Change budgets or audiences"],
    scopes: [{ scope: META_SCOPES.ads, label: "Read advertising accounts and performance" }],
  },
  {
    id: "instagram-insights", name: "Instagram insights", group: "found", availability: "live", connector: { id: "meta", product: "instagram" },
    blurb: "Reach, profile views and interactions for a professional Instagram account linked to a Facebook Page.",
    reads: ["Daily reach, profile views and interactions", "The linked professional account name"],
    cannot: ["Read personal Instagram accounts", "Publish, edit or delete posts", "Read private messages"],
    scopes: [
      { scope: META_SCOPES.instagram, label: "Identify linked professional Instagram accounts" },
      { scope: META_SCOPES.instagramInsights, label: "Read Instagram account insights" },
    ],
  },
  {
    id: "facebook-page-insights", name: "Facebook Page insights", group: "found", availability: "live", connector: { id: "meta", product: "facebook-pages" },
    blurb: "How often Page content is shown, how people engage and whether the audience is growing.",
    reads: ["Daily Page impressions and post engagements", "Followers, follows and unfollows"],
    cannot: ["Publish or edit Page content", "Read private messages", "Change Page roles or settings"],
    scopes: [
      { scope: META_SCOPES.pages, label: "List Pages you manage" },
      { scope: META_SCOPES.pageEngagement, label: "Read Page engagement data" },
      { scope: META_SCOPES.insights, label: "Read Page insights" },
    ],
  },
  {
    id: "google-ads", name: "Google Ads", group: "found", availability: "live", connector: { id: "google", product: "ads" },
    blurb: "What you spend on Google ads, how many people click, and the conversions Google records.",
    reads: ["Daily spend, impressions, clicks and conversions", "Conversion value and top search terms"],
    cannot: ["Create, edit or pause campaigns", "Change bids, budgets, audiences or billing"],
    scopes: [{ scope: GOOGLE_SCOPES.ads, label: "View Google Ads accounts and reporting data" }],
  },
  {
    id: "tiktok-ads", name: "TikTok Ads", group: "found", availability: "live", connector: { id: "tiktok-ads", product: "ads" },
    blurb: "Daily TikTok ad spend, reach, clicks and conversions.",
    reads: ["Daily spend, impressions, reach and clicks", "Conversions reported by TikTok Ads"],
    cannot: ["Create, edit or pause campaigns", "Change budgets, audiences or billing"],
    scopes: [{ scope: "Reporting > Consolidated Report", label: "Read TikTok Ads performance reports" }],
  },
  {
    id: "tiktok-business", name: "TikTok business account", group: "found", availability: "live", connector: { id: "tiktok-business", product: "profile" },
    blurb: "Followers and engagement on the public videos from your TikTok business or creator account.",
    reads: ["Follower, following, profile-like and video totals", "Views, likes, comments and shares on recent public videos"],
    cannot: ["Publish, edit or delete videos", "Read private messages", "Read private or restricted videos"],
    scopes: [
      { scope: TIKTOK_PROFILE_SCOPES.basic, label: "Identify your TikTok account" },
      { scope: TIKTOK_PROFILE_SCOPES.profile, label: "Read profile details" },
      { scope: TIKTOK_PROFILE_SCOPES.stats, label: "Read profile statistics" },
      { scope: TIKTOK_PROFILE_SCOPES.videos, label: "Read public videos and their engagement" },
    ],
  },
  { id: "microsoft-ads", name: "Microsoft Advertising", group: "found", availability: SOON, blurb: "Spend and clicks on Bing search ads." },
  { id: "linkedin", name: "LinkedIn Ads & Pages", group: "found", availability: SOON, blurb: "Ad spend and page followers on LinkedIn." },
  { id: "snapchat-ads", name: "Snapchat Ads", group: "found", availability: SOON, blurb: "Ad spend and results on Snapchat." },
  { id: "pinterest-ads", name: "Pinterest Ads", group: "found", availability: SOON, blurb: "Ad spend and results on Pinterest." },
  { id: "x-ads", name: "X Ads", group: "found", availability: SOON, blurb: "Ad spend and results on X (Twitter)." },
  { id: "bing-webmaster", name: "Bing Webmaster Tools", group: "found", availability: SOON, blurb: "What people search on Bing before they find your website." },

  // ---------- Enquiries ----------
  {
    id: "whatsapp",
    name: "WhatsApp",
    group: "enquire",
    availability: SOON,
    blurb: "How many people message you to ask, and how quickly they hear back.",
    note: "The ordinary WhatsApp Business app has no way for other apps to read chats. Options we're looking at: Meta's \"coexistence\" mode (WhatsApp Business Platform alongside the app) or uploading an exported chat.",
  },
  { id: "meta-messages", name: "Instagram & Facebook messages", group: "enquire", availability: SOON, blurb: "DMs and comments from people asking about prices and availability." },
  { id: "google-forms", name: "Google Forms", group: "enquire", availability: SOON, blurb: "Enquiries people send through your Google Forms." },
  { id: "typeform", name: "Typeform", group: "enquire", availability: SOON, blurb: "Enquiries and answers from your Typeform forms." },
  { id: "jotform", name: "Jotform", group: "enquire", availability: SOON, blurb: "Enquiries and orders from your Jotform forms." },
  { id: "tally", name: "Tally", group: "enquire", availability: SOON, blurb: "Enquiries from your Tally forms." },
  { id: "calendly", name: "Calendly", group: "enquire", availability: SOON, blurb: "Bookings, cancellations and no-shows." },
  { id: "acuity", name: "Acuity Scheduling", group: "enquire", availability: SOON, blurb: "Appointments booked, cancelled and missed." },
  { id: "google-calendar", name: "Google Calendar", group: "enquire", availability: SOON, blurb: "How full your diary is with appointments and jobs." },
  { id: "intercom", name: "Intercom", group: "enquire", availability: SOON, blurb: "Website chat conversations and how fast they're answered." },
  { id: "crisp", name: "Crisp", group: "enquire", availability: SOON, blurb: "Website chat conversations and how fast they're answered." },

  // ---------- Becoming customers ----------
  { id: "paystack", name: "Paystack", group: "convert", availability: SOON, region: "Nigeria, Ghana, Kenya, South Africa", blurb: "Payments coming in, and payments that failed and why." },
  { id: "flutterwave", name: "Flutterwave", group: "convert", availability: SOON, region: "Africa-wide", blurb: "Payments coming in, and payments that failed and why." },
  { id: "monnify", name: "Monnify", group: "convert", availability: SOON, region: "Nigeria", blurb: "Bank transfers and card payments coming in." },
  { id: "stripe", name: "Stripe", group: "convert", availability: SOON, blurb: "Payments coming in, refunds and failed payments." },
  { id: "paypal", name: "PayPal", group: "convert", availability: SOON, blurb: "Payments coming in from PayPal." },
  { id: "square", name: "Square", group: "convert", availability: SOON, blurb: "In-person and online payments taken with Square." },
  { id: "mono", name: "Mono", group: "convert", availability: SOON, region: "Nigeria", blurb: "Money in and out of your bank account, read-only and only with your permission." },
  { id: "plaid", name: "Plaid", group: "convert", availability: SOON, region: "US, Canada, UK, Europe", blurb: "Money in and out of your bank account, read-only and only with your permission." },
  { id: "truelayer", name: "TrueLayer", group: "convert", availability: SOON, region: "UK and Europe", blurb: "Money in and out of your bank account, read-only and only with your permission." },
  { id: "stitch", name: "Stitch", group: "convert", availability: SOON, region: "South Africa, Nigeria", blurb: "Money in and out of your bank account, read-only and only with your permission." },
  {
    id: "shopify", name: "Shopify", group: "convert", availability: "live", connector: { id: "shopify", product: "orders" },
    blurb: "Orders, sales, refunds and cancellations from your Shopify store.",
    reads: ["Daily order and item counts", "Gross sales, current revenue, refunds and cancelled orders"],
    cannot: ["See customer names, emails or addresses", "Edit products, orders, inventory or store settings", "Issue refunds or capture payments"],
    scopes: [{ scope: "read_orders", label: "Read order totals from the last 60 days" }],
  },
  { id: "woocommerce", name: "WooCommerce", group: "convert", availability: SOON, blurb: "Orders and sales from your WooCommerce store." },
  { id: "wix", name: "Wix", group: "convert", availability: SOON, blurb: "Orders, bookings and sales from your Wix site." },
  { id: "squarespace", name: "Squarespace", group: "convert", availability: SOON, blurb: "Orders and sales from your Squarespace site." },
  { id: "bigcommerce", name: "BigCommerce", group: "convert", availability: SOON, blurb: "Orders and sales from your BigCommerce store." },
  { id: "etsy", name: "Etsy", group: "convert", availability: SOON, blurb: "Orders, views and favourites on your Etsy shop." },
  { id: "amazon-seller", name: "Amazon Seller Central", group: "convert", availability: SOON, blurb: "Orders and sales on Amazon." },
  { id: "loyverse", name: "Loyverse", group: "convert", availability: SOON, blurb: "Sales from your shop till (point of sale)." },
  { id: "clover", name: "Clover", group: "convert", availability: SOON, blurb: "Sales from your shop till (point of sale)." },
  { id: "sumup", name: "SumUp", group: "convert", availability: SOON, blurb: "Card payments taken in person." },
  { id: "lightspeed", name: "Lightspeed", group: "convert", availability: SOON, blurb: "Sales from your shop or restaurant till." },
  { id: "hubspot", name: "HubSpot", group: "convert", availability: SOON, blurb: "The people you're talking to and the deals you win or lose." },
  { id: "zoho-crm", name: "Zoho CRM", group: "convert", availability: SOON, blurb: "The people you're talking to and the deals you win or lose." },
  { id: "pipedrive", name: "Pipedrive", group: "convert", availability: SOON, blurb: "Deals in progress, won and lost." },
  { id: "salesforce", name: "Salesforce", group: "convert", availability: SOON, blurb: "Deals in progress, won and lost." },
  {
    id: "google-sheets", name: "Google Sheets", group: "money", availability: "live", connector: { id: "google", product: "sheets" },
    blurb: "Read the sales, expenses, customers or orders you already track in one selected spreadsheet.",
    reads: ["Only the spreadsheet URL and tab you select", "The date and numeric columns you map for analysis"],
    cannot: ["Edit cells or formulas", "Create, rename or delete spreadsheets", "Read Google Docs or other Drive files"],
    scopes: [{ scope: GOOGLE_SCOPES.sheets, label: "View Google Sheets spreadsheets (read-only)" }],
  },
  { id: "airtable", name: "Airtable", group: "convert", availability: SOON, blurb: "The lists you already keep — customers, orders, enquiries." },
  { id: "notion", name: "Notion", group: "convert", availability: SOON, blurb: "The lists and trackers you already keep in Notion." },

  // ---------- Delivering ----------
  { id: "zendesk", name: "Zendesk", group: "deliver", availability: SOON, blurb: "Complaints and support requests, and how fast they're solved." },
  { id: "freshdesk", name: "Freshdesk", group: "deliver", availability: SOON, blurb: "Complaints and support requests, and how fast they're solved." },
  { id: "shipstation", name: "ShipStation", group: "deliver", availability: SOON, blurb: "Deliveries sent and how long they take." },
  { id: "shippo", name: "Shippo", group: "deliver", availability: SOON, blurb: "Deliveries sent and how long they take." },

  // ---------- Coming back ----------
  { id: "mailchimp", name: "Mailchimp", group: "return", availability: SOON, blurb: "Emails to past customers and who opens and clicks them." },
  { id: "klaviyo", name: "Klaviyo", group: "return", availability: SOON, blurb: "Emails and texts to past customers and what they bring back." },
  { id: "brevo", name: "Brevo", group: "return", availability: SOON, blurb: "Emails and SMS to past customers and who responds." },
  { id: "mailerlite", name: "MailerLite", group: "return", availability: SOON, blurb: "Emails to past customers and who opens them." },
  { id: "kit", name: "Kit", group: "return", availability: SOON, blurb: "Emails to your subscribers and who opens them." },
  { id: "termii", name: "Termii", group: "return", availability: SOON, region: "Nigeria and across Africa", blurb: "SMS reminders to past customers and how many arrive." },
  { id: "trustpilot", name: "Trustpilot", group: "return", availability: SOON, blurb: "Reviews from your customers.", note: "Google reviews will come through Google Business Profile." },

  // ---------- Money and books ----------
  { id: "quickbooks", name: "QuickBooks", group: "money", availability: SOON, blurb: "Your books: money in, money out and what you're owed." },
  { id: "xero", name: "Xero", group: "money", availability: SOON, blurb: "Your books: money in, money out and what you're owed." },
  { id: "zoho-books", name: "Zoho Books", group: "money", availability: SOON, blurb: "Your books: money in, money out and what you're owed." },
  { id: "freshbooks", name: "FreshBooks", group: "money", availability: SOON, blurb: "Invoices sent and paid, and expenses." },
  { id: "sage", name: "Sage", group: "money", availability: SOON, blurb: "Your books: money in, money out and what you're owed." },

  // ---------- Everything else ----------
  { id: "webhook", name: "Zapier / Make / n8n webhook", group: "other", availability: SOON, blurb: "Send numbers from any other tool you use, automatically." },
  { id: "csv", name: "CSV / Excel upload", group: "other", availability: "built-in", route: "csv-upload", blurb: "Upload a spreadsheet of enquiries, orders, spend or sales." },
  { id: "manual", name: "Manual entry", group: "other", availability: "built-in", route: "manual-entry", blurb: "Type in your monthly totals — exact numbers or your best guess." },
];

export function catalogueEntry(id: string): CatalogueEntry | undefined {
  return CATALOGUE.find((e) => e.id === id);
}

/** Catalogue entries handled by one connector (e.g. both Google products). */
export function entriesForConnector(connectorId: string): CatalogueEntry[] {
  return CATALOGUE.filter((e) => e.connector?.id === connectorId);
}

/** The catalogue entry for a connector product, e.g. ("google", "analytics"). */
export function entryForProduct(connectorId: string, product: string): CatalogueEntry | undefined {
  return CATALOGUE.find((e) => e.connector?.id === connectorId && e.connector.product === product);
}
