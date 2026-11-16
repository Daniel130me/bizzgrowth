// Seed the specialists marketplace roster.
// Run: bun prisma/seed-market.ts        (skips when roster already exists)
//       bun prisma/seed-market.ts --force   (wipes roster + bids, reseeds)
//
// The roster is the marketplace's supply side — like any real marketplace,
// these profiles represent vetted humans with their own rates, track records
// and availability. Tasks and bids created by owners are NEVER touched here
// (except with --force, which also clears bid records that reference them).

import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function loadDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const env = readFileSync(join(process.cwd(), ".env"), "utf8");
    const line = env.split("\n").find((l) => l.startsWith("DATABASE_URL="));
    if (line) return line.slice("DATABASE_URL=".length).trim();
  } catch {}
  throw new Error("DATABASE_URL not found");
}

const prisma = new PrismaClient({
  datasources: { db: { url: loadDatabaseUrl() } },
});

interface SeedSpecialist {
  name: string;
  headline: string;
  category: string;
  skills: string[];
  hourlyRate: number;
  rating: number;
  reviews: number;
  completedJobs: number;
  responseTime: string;
  location: string;
  languages: string[];
  bio: string;
  portfolio: { title: string; blurb: string }[];
  badges: string[];
  available: string;
}

const ROSTER: SeedSpecialist[] = [
  {
    name: "Tunde Bakare",
    headline: "Meta ads for Nigerian retail and service businesses",
    category: "marketing",
    skills: ["Meta Ads", "Instagram growth", "Lead generation", "Retargeting", "WhatsApp funnels"],
    hourlyRate: 12000,
    rating: 4.9,
    reviews: 87,
    completedJobs: 132,
    responseTime: "Within 2 hours",
    location: "Lekki, Lagos",
    languages: ["English", "Yoruba", "Pidgin"],
    bio: "I plan and run Meta ad campaigns for small businesses across Nigeria — from first pixel install to a repeatable enquiry machine. Eight years in performance marketing, the last five focused on SMEs who need every naira of spend accounted for. I report in plain language: what was spent, what came back, what changes next week.",
    portfolio: [
      { title: "Fashion retailer, Ikeja — enquiry engine", blurb: "Rebuilt campaigns around catalogue + WhatsApp retargeting; enquiries tripled in 9 weeks at the same budget." },
      { title: "Logistics startup — cost per lead cut 41%", blurb: "Audited existing ads, killed waste spend, rebuilt audiences from their delivery zones." },
      { title: "Dental clinic, Lekki — steady bookings", blurb: "Local awareness plus lead forms routed to WhatsApp; 30+ confirmed appointments a month." },
    ],
    badges: ["Top rated", "58 repeat clients"],
    available: "Available now",
  },
  {
    name: "Chinelo Okafor",
    headline: "Google Ads and search visibility for growing SMEs",
    category: "marketing",
    skills: ["Google Ads", "Search intent", "Landing pages", "Keyword research", "Conversion tracking"],
    hourlyRate: 14000,
    rating: 4.8,
    reviews: 64,
    completedJobs: 95,
    responseTime: "Within 4 hours",
    location: "Wuse, Abuja",
    languages: ["English", "Igbo"],
    bio: "Certified Google Ads specialist. I build search campaigns that capture people already looking for what you sell, then tighten them weekly using search-term reports. Strong with service businesses — clinics, law firms, logistics, training — where the enquiry, not the click, is the goal.",
    portfolio: [
      { title: "Immigration consultancy — 6.2% enquiry rate", blurb: "Restructured account into intent-based ad groups; cost per enquiry down from ₦9,800 to ₦4,100." },
      { title: "Solar installer, Abuja — quote requests", blurb: "Search + call campaigns with location scheduling; 45 qualified quote requests in the first month." },
    ],
    badges: ["Top rated", "Google certified"],
    available: "Available now",
  },
  {
    name: "Ifeanyi Eze",
    headline: "End-to-end sales pipelines and outbound that books meetings",
    category: "sales",
    skills: ["B2B sales", "Cold outreach", "CRM setup", "Sales scripts", "Follow-up systems"],
    hourlyRate: 15000,
    rating: 4.7,
    reviews: 52,
    completedJobs: 78,
    responseTime: "Within 6 hours",
    location: "Port Harcourt",
    languages: ["English", "Pidgin"],
    bio: "I set up the whole sales pipeline for small teams: who to contact, what to say, how to follow up, and how to record every outcome in a simple CRM. B2B focus — suppliers, corporate clients, contracts. I have booked meetings in logistics, printing, cleaning services and wholesale distribution.",
    portfolio: [
      { title: "Cleaning company — 12 corporate contracts", blurb: "Built a 300-company target list and a call + email sequence; first contracts signed in week 3." },
      { title: "Water treatment supplier — follow-up rescue", blurb: "Re-engaged 90 stale enquiries with a structured call plan; ₦4.2m in closed deals." },
    ],
    badges: ["Top rated"],
    available: "From Monday 20 Oct",
  },
  {
    name: "Amaka Obi",
    headline: "Content, SEO and social media that compounds",
    category: "content",
    skills: ["SEO writing", "Content calendar", "Instagram content", "Email newsletters", "Copywriting"],
    hourlyRate: 9000,
    rating: 4.9,
    reviews: 112,
    completedJobs: 168,
    responseTime: "Within 3 hours",
    location: "Yaba, Lagos",
    languages: ["English", "Igbo"],
    bio: "Content is the cheapest growth channel a small business owns — if it is consistent. I write and plan content calendars, product pages and newsletters that answer real customer questions. Everything I publish is tied to one of your business goals: enquiries, orders or trust.",
    portfolio: [
      { title: "Skincare brand — organic sales channel", blurb: "Weekly educational content plus email flows; organic became 30% of orders within 5 months." },
      { title: "Restaurant group — Google reviews flywheel", blurb: "Review-request system plus location pages; map-pack ranking top 3 for their area." },
    ],
    badges: ["Top rated", "Fastest reply"],
    available: "Available now",
  },
  {
    name: "Kemi Adeyemi",
    headline: "Short-form video and social campaigns for local brands",
    category: "content",
    skills: ["TikTok / Reels", "Video scripting", "Community management", "Influencer briefs", "Analytics"],
    hourlyRate: 8500,
    rating: 4.6,
    reviews: 71,
    completedJobs: 104,
    responseTime: "Within 5 hours",
    location: "Ibadan",
    languages: ["English", "Yoruba"],
    bio: "I make short-form video the engine of a small brand's social presence — scripted, shot on your phone or mine, edited fast. I have run 90-day content sprints for food brands, boutiques and service providers, always with a clear view of which videos actually moved enquiries.",
    portfolio: [
      { title: "Food brand — Reels to wholesale interest", blurb: "Simple recipe Reels series; two distributors found them via Instagram within 6 weeks." },
      { title: "Fitness studio — class bookings", blurb: "Member-story videos plus booking link CTAs; class attendance up 35% over a quarter." },
    ],
    badges: [],
    available: "Available now",
  },
  {
    name: "Sola Johnson",
    headline: "Brand identity, packaging and print that earns trust",
    category: "design",
    skills: ["Logo & identity", "Packaging", "Brand guidelines", "Print design", "Canva templates"],
    hourlyRate: 10000,
    rating: 4.8,
    reviews: 93,
    completedJobs: 141,
    responseTime: "Within 4 hours",
    location: "Surulere, Lagos",
    languages: ["English", "Yoruba"],
    bio: "Ten years designing brands that look credible at their price point. I deliver complete identity kits — logo, colours, type, packaging, social templates — with files organised so any printer or future designer can work from them. Good for rebrands, product launches and shelf-ready packaging.",
    portfolio: [
      { title: "Spice brand — shelf-ready packaging", blurb: "Full packaging suite for 6 SKUs; cleared supermarket listing review on first submission." },
      { title: "Law firm — credibility rebrand", blurb: "Identity refresh plus document templates; win rate on proposals visibly improved." },
    ],
    badges: ["Top rated", "58 repeat clients"],
    available: "Available now",
  },
  {
    name: "David Nwachukwu",
    headline: "Product and UI design for web and mobile",
    category: "design",
    skills: ["UI design", "Figma", "Design systems", "Landing pages", "Prototyping"],
    hourlyRate: 16000,
    rating: 4.7,
    reviews: 48,
    completedJobs: 66,
    responseTime: "Within 6 hours",
    location: "Enugu",
    languages: ["English", "Igbo"],
    bio: "I design interfaces that make small companies feel established — websites, dashboards, mobile apps. Every design ships with a component file your developer can build from without guessing. I work closely with the web developers in my network when you need design and build together.",
    portfolio: [
      { title: "Fintech MVP — investor-ready UI", blurb: "12-screen app design in 3 weeks; used directly for their seed pitch and beta." },
      { title: "Travel agency — booking revamp", blurb: "Simplified a 9-step booking flow to 4 steps; completion rate up 22% after launch." },
    ],
    badges: [],
    available: "From Wednesday 22 Oct",
  },
  {
    name: "Emeka Uche",
    headline: "Websites, e-commerce and integrations — built to convert",
    category: "web",
    skills: ["Websites", "Shopify / WooCommerce", "Landing pages", "Payment integration", "Site speed"],
    hourlyRate: 18000,
    rating: 4.8,
    reviews: 77,
    completedJobs: 110,
    responseTime: "Within 3 hours",
    location: "Lagos (remote across NG)",
    languages: ["English", "Pidgin"],
    bio: "I build sites that load fast on Nigerian networks and turn visitors into enquiries or orders. Business sites, online stores, booking pages — with analytics, WhatsApp contact and Paystack / Flutterwave wired in from day one. You own everything: domain, hosting, code.",
    portfolio: [
      { title: "Furniture maker — online store", blurb: "WooCommerce store with delivery-zone pricing; online orders within the first fortnight." },
      { title: "Clinic group — booking website", blurb: "Multi-location site with per-clinic booking forms; 200+ bookings in month one." },
      { title: "Checkout rescue — payment failures", blurb: "Diagnosed gateway timeout issues and rebuilt checkout; failed payments down 60%." },
    ],
    badges: ["Top rated", "Fastest reply"],
    available: "Available now",
  },
  {
    name: "Fatima Bello",
    headline: "Automation, spreadsheets and tool setup for lean teams",
    category: "web",
    skills: ["Process automation", "Google Workspace", "Airtable", "Zapier / Make", "Dashboard setup"],
    hourlyRate: 11000,
    rating: 4.6,
    reviews: 39,
    completedJobs: 57,
    responseTime: "Within 8 hours",
    location: "Kano",
    languages: ["English", "Hausa"],
    bio: "I remove the copy-paste work from small businesses: enquiry forms that file themselves, invoices that generate from a template, weekly reports that build themselves. If your team still moves data between WhatsApp, notebooks and Excel by hand, I can probably save you 5+ hours a week.",
    portfolio: [
      { title: "School — admissions on autopilot", blurb: "Enquiry form to Airtable to automated follow-up emails; nothing falls through anymore." },
      { title: "Wholesaler — daily stock dashboard", blurb: "Simple stock + sales dashboard from their existing spreadsheets, refreshed automatically." },
    ],
    badges: [],
    available: "Available now",
  },
  {
    name: "Ngozi Ilodibe",
    headline: "Bookkeeping, payroll and financial order for SMEs",
    category: "finance",
    skills: ["Bookkeeping", "Payroll", "Expense tracking", "Management reports", "Tax filing prep"],
    hourlyRate: 10000,
    rating: 4.9,
    reviews: 85,
    completedJobs: 124,
    responseTime: "Within 4 hours",
    location: "Awka / remote",
    languages: ["English", "Igbo"],
    bio: "Chartered accountant focused on small-business financial hygiene: proper books, monthly management reports you can actually read, payroll that lands on time, and clean records your accountant will thank you for. I work in QuickBooks, Zoho Books or well-structured spreadsheets.",
    portfolio: [
      { title: "Logistics firm — books rescue", blurb: "Rebuilt 14 months of records from bank statements and receipts; VAT filings brought current." },
      { title: "Retail chain — monthly close", blurb: "Set a repeatable monthly close with a one-page owner report: cash, profit, receivables." },
    ],
    badges: ["Top rated", "58 repeat clients"],
    available: "Available now",
  },
  {
    name: "Yusuf Danjuma",
    headline: "Business data, KPI dashboards and honest numbers",
    category: "data",
    skills: ["KPI dashboards", "Excel / Sheets modelling", "Looker Studio", "Data cleanup", "Reporting"],
    hourlyRate: 13000,
    rating: 4.7,
    reviews: 44,
    completedJobs: 61,
    responseTime: "Within 6 hours",
    location: "Kaduna",
    languages: ["English", "Hausa"],
    bio: "I turn the numbers a business already has — sales sheets, bank statements, channel reports — into one dashboard the owner checks weekly. No vanity metrics: the four or five numbers that tell you if the month is going well, with sources noted so figures stay trustworthy.",
    portfolio: [
      { title: "Pharmacy group — weekly trading view", blurb: "Per-branch sales, margin and stockout dashboard updated every Monday from POS exports." },
      { title: "Agency — channel profitability", blurb: "Client-level revenue vs ad spend model; two loss-making accounts discovered and fixed." },
    ],
    badges: [],
    available: "From Monday 20 Oct",
  },
  {
    name: "Bisi Ogundairo",
    headline: "Operations, delivery and vendor management that scales",
    category: "ops",
    skills: ["Process documentation", "Vendor management", "Inventory process", "Delivery operations", "SLAs"],
    hourlyRate: 12000,
    rating: 4.8,
    reviews: 58,
    completedJobs: 83,
    responseTime: "Within 5 hours",
    location: "Ikeja, Lagos",
    languages: ["English", "Yoruba"],
    bio: "Former operations lead for two Lagos logistics companies. I document how work actually flows, find where orders get stuck, and rebuild the process with clear ownership. Useful when you are drowning in operational decisions only you can currently make.",
    portfolio: [
      { title: "Food distributor — delivery redesign", blurb: "Re-routed delivery day by zone with a checklist handover; late deliveries down by half." },
      { title: "Event company — vendor playbook", blurb: "Vendor scorecards and booking calendar; owner now approves instead of chasing." },
    ],
    badges: ["Top rated"],
    available: "Available now",
  },
  {
    name: "Tosin Ajayi",
    headline: "Hiring, onboarding and HR basics for small teams",
    category: "people",
    skills: ["Recruiting", "Onboarding design", "Role scorecards", "HR policies", "Performance basics"],
    hourlyRate: 9500,
    rating: 4.6,
    reviews: 36,
    completedJobs: 49,
    responseTime: "Within 8 hours",
    location: "Lagos / remote",
    languages: ["English", "Yoruba"],
    bio: "I help businesses of 2–30 people hire properly: role scorecards, structured interviews, offer letters and onboarding that gets someone productive in week one. Also sensible contracts-of-employment and basic HR policies that fit Nigerian labour norms.",
    portfolio: [
      { title: "Retail brand — first 5 hires", blurb: "Scorecard-driven hiring for store and ops roles; all five still with the company a year on." },
      { title: "Tech services — onboarding playbook", blurb: "30-day onboarding plan per role; new-starter ramp time visibly shorter." },
    ],
    badges: [],
    available: "Available now",
  },
  {
    name: "Chuka Ogbodo",
    headline: "Contracts, compliance and business registration support",
    category: "legal",
    skills: ["Contracts", "Client agreements", "CAC registration", "NDPR basics", "Lease review"],
    hourlyRate: 20000,
    rating: 4.9,
    reviews: 61,
    completedJobs: 88,
    responseTime: "Within 6 hours",
    location: "Abuja",
    languages: ["English", "Igbo", "Hausa"],
    bio: "Barrister and solicitor working with SMEs on the documents that protect them: client agreements, supplier terms, NDAs, employment contracts, plus CAC registration and NDPR data basics. I write in plain language and flag the three clauses that actually matter in any contract you are about to sign.",
    portfolio: [
      { title: "Software agency — master services agreement", blurb: "Re-usable MSA with clear scope and payment protection; late payments stopped." },
      { title: "Import business — supplier terms", blurb: "Supplier agreement with delivery and quality clauses; first dispute resolved in their favour." },
    ],
    badges: ["Top rated"],
    available: "From Thursday 23 Oct",
  },
];

async function main() {
  const force = process.argv.includes("--force");
  const existing = await prisma.specialist.count();

  if (existing > 0 && !force) {
    console.log(`Roster already seeded (${existing} specialists) — nothing to do. Use --force to reseed.`);
    return;
  }

  if (force) {
    // Bids reference specialists, so clear them first (tasks are kept — they
    // are owner data; their bid records are the part being replaced).
    await prisma.marketBid.deleteMany();
    const { count } = await prisma.specialist.deleteMany();
    console.log(`Cleared ${count} existing specialists and their bids.`);
  }

  for (const s of ROSTER) {
    await prisma.specialist.create({
      data: {
        name: s.name,
        headline: s.headline,
        category: s.category,
        skills: JSON.stringify(s.skills),
        hourlyRate: s.hourlyRate,
        rating: s.rating,
        reviews: s.reviews,
        completedJobs: s.completedJobs,
        responseTime: s.responseTime,
        location: s.location,
        languages: JSON.stringify(s.languages),
        bio: s.bio,
        portfolio: JSON.stringify(s.portfolio),
        badges: JSON.stringify(s.badges),
        available: s.available,
        verified: true,
      },
    });
  }

  console.log(`Seeded ${ROSTER.length} specialists across ${new Set(ROSTER.map((s) => s.category)).size} categories.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
