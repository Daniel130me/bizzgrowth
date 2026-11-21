// Nellovia coherent demo dataset — ONE shared source of truth.
// Every screen must read from here so the same fact never contradicts itself.
// NOTE: demo businesses (SwiftHaul / KoraHome) are SAMPLES. A user's own
// workspace is built honestly by buildUserBusiness() — never from these.
import type { Business, BusinessType, DateRangeId, DailyPoint, MonthlyPoint } from "../types";
import type { BusinessFacts } from "../checkup";
import { buildUserBusiness } from "./user-business";
import type { ManualEntry } from "../types";
import { useBizz } from "@/lib/store";

// Deterministic daily shaping (no Math.random — must be SSR-safe & stable)
function dailySeries(
  month: string,
  totalSpend: number,
  totalEnquiries: number,
  totalCustomers: number,
  totalRevenue: number,
  dailyOrders?: number[],
  dailyTraffic?: number[]
): DailyPoint[] {
  const shape = [
    0.9, 1.05, 1.1, 0.85, 1.0, 1.15, 1.2, 0.8, 0.95, 1.0, 1.1, 1.05, 0.9, 0.85, 1.0, 1.15, 1.2,
    1.05, 0.9, 0.95, 1.0, 1.1, 1.15, 1.0, 0.9, 0.85, 1.05, 1.1, 1.0, 1.2,
  ];
  const sum = shape.reduce((a, b) => a + b, 0);
  return Array.from({ length: 30 }, (_, i) => ({
    day: i + 1,
    label: `${month} ${i + 1}`,
    spend: Math.round((totalSpend * shape[i]) / sum),
    enquiries: Math.max(0, Math.round((totalEnquiries * shape[i]) / sum)),
    customers: Math.round((totalCustomers * shape[i]) / sum),
    revenue: Math.round((totalRevenue * shape[i]) / sum),
    orders: dailyOrders ? Math.max(0, Math.round((dailyOrders[i] ?? 0))) : undefined,
    traffic: dailyTraffic ? Math.round(dailyTraffic[i] ?? 0) : undefined,
  }));
}

const shMonthly: MonthlyPoint[] = [
  { key: "2026-02", label: "Feb", spend: 180000, enquiries: 120, customers: 31, revenue: 3900000 },
  { key: "2026-03", label: "Mar", spend: 195000, enquiries: 128, customers: 33, revenue: 4100000 },
  { key: "2026-04", label: "Apr", spend: 210000, enquiries: 135, customers: 35, revenue: 4300000 },
  { key: "2026-05", label: "May", spend: 225000, enquiries: 142, customers: 38, revenue: 4600000 },
  { key: "2026-06", label: "Jun", spend: 240000, enquiries: 155, customers: 41, revenue: 4900000 },
  { key: "2026-07", label: "Jul", spend: 252000, enquiries: 168, customers: 44, revenue: 5400000 },
  { key: "2026-08", label: "Aug", spend: 265000, enquiries: 185, customers: 47, revenue: 5830000 },
  { key: "2026-09", label: "Sep", spend: 370000, enquiries: 277, customers: 49, revenue: 6000000 },
];

const khMonthly: MonthlyPoint[] = [
  { key: "2026-02", label: "Feb", spend: 420000, enquiries: 0, customers: 0, revenue: 3900000, orders: 520, traffic: 9800 },
  { key: "2026-03", label: "Mar", spend: 445000, enquiries: 0, customers: 0, revenue: 4100000, orders: 548, traffic: 10500 },
  { key: "2026-04", label: "Apr", spend: 470000, enquiries: 0, customers: 0, revenue: 4350000, orders: 580, traffic: 11200 },
  { key: "2026-05", label: "May", spend: 495000, enquiries: 0, customers: 0, revenue: 4600000, orders: 610, traffic: 12050 },
  { key: "2026-06", label: "Jun", spend: 520000, enquiries: 0, customers: 0, revenue: 4950000, orders: 655, traffic: 12900 },
  { key: "2026-07", label: "Jul", spend: 545000, enquiries: 0, customers: 0, revenue: 5300000, orders: 700, traffic: 13700 },
  { key: "2026-08", label: "Aug", spend: 560000, enquiries: 0, customers: 0, revenue: 6740000, orders: 804, traffic: 14863 },
  { key: "2026-09", label: "Sep", spend: 530000, enquiries: 0, customers: 0, revenue: 6200000, orders: 740, traffic: 18430 },
];

const khDailyOrders = [26, 25, 24, 26, 27, 22, 19, 21, 24, 26, 25, 23, 26, 25, 27, 24, 22, 23, 25, 24, 26, 27, 25, 24, 21, 22, 24, 26, 25, 23];
const khDailyTraffic = [590, 612, 640, 575, 602, 648, 664, 580, 595, 618, 642, 655, 610, 588, 612, 660, 680, 640, 600, 615, 635, 668, 690, 645, 602, 590, 625, 655, 640, 648];

const shDaily = dailySeries("Sep", 370000, 277, 49, 6000000);
const khDaily = dailySeries("Sep", 530000, 0, 0, 6200000, khDailyOrders, khDailyTraffic);

export const SWIFTHAUL: Business = {
  id: "swifthaul",
  name: "SwiftHaul Logistics",
  type: "service",
  location: "Lagos, Nigeria",
  platform: null,
  model: "B2B + B2C logistics services",
  goal: "Increase paying customers without wasting marketing spend",
  journey: ["Discovery (Google / Instagram / Referral)", "Website / WhatsApp", "Enquiry", "Quote", "Customer"],
  monthly: shMonthly,
  daily: shDaily,
  channels: [
    { id: "instagram", name: "Instagram", kind: "paid", spend: 200000, enquiries: 184, customers: 11, revenue: 1800000, cac: 18182, conversion: 6.0, trend: [88, 96, 104, 118, 132, 184] },
    { id: "google", name: "Google Search", kind: "paid", spend: 150000, enquiries: 62, customers: 24, revenue: 2500000, cac: 6250, conversion: 38.7, trend: [41, 44, 47, 52, 57, 62] },
    { id: "referral", name: "Referral", kind: "referral", spend: 20000, enquiries: 31, customers: 14, revenue: 1700000, cac: 1429, conversion: 45.2, trend: [22, 24, 25, 27, 29, 31] },
  ],
  funnel: [
    { id: "enquiries", label: "Enquiries", value: 277 },
    { id: "qualified", label: "Qualified leads", value: 120 },
    { id: "quotes", label: "Quotes sent", value: 77 },
    { id: "customers", label: "New customers", value: 49 },
  ],
  services: [
    { id: "same-day", name: "Same-day Delivery", enquiries: 118, customers: 21, revenue: 1450000, conversion: 17.8, active: true, priceRange: "₦8,000 – ₦35,000" },
    { id: "interstate", name: "Interstate Delivery", enquiries: 96, customers: 17, revenue: 1980000, conversion: 17.7, active: true, priceRange: "₦25,000 – ₦120,000" },
    { id: "corporate", name: "Corporate Logistics", enquiries: 63, customers: 11, revenue: 2570000, conversion: 17.5, active: true, priceRange: "₦150,000+/mo" },
  ],
  website: {
    connected: false,
  },
  retention: {
    connected: false,
    note: "Repeat-purchase tracking is not available for this service workspace yet. Corporate accounts show the strongest repeat usage, but enquiry-level retention data has not been recorded.",
  },
  dataCoverage: {
    overall: 62,
    areas: [
      { area: "Revenue", coverage: 90, known: "Monthly revenue totals for Feb–Sep (manually submitted).", missing: "Invoice-level detail and service-level margin.", unlocks: "Margin-aware recommendations and revenue forecasting." },
      { area: "Marketing", coverage: 85, known: "Instagram, Google and Referral spend, enquiries and customers for September.", missing: "Campaign-level spend and click data.", unlocks: "Campaign-level efficiency and creative diagnosis." },
      { area: "Sales funnel", coverage: 55, known: "Monthly enquiry, qualified, quote and customer totals.", missing: "Response time, follow-up stages and lost-reason tracking.", unlocks: "Root-cause separation between lead quality and follow-up speed." },
      { area: "Website", coverage: 0, known: "Nothing yet — no analytics source connected.", missing: "Traffic, sessions, top pages and visitor→enquiry conversion.", unlocks: "Website conversion analysis and upstream funnel diagnosis." },
      { area: "Customers", coverage: 35, known: "Customer counts per channel and service line.", missing: "Acquisition source for 23% of customers; repeat behaviour.", unlocks: "Retention value and segment-level CAC." },
    ],
  },
  health: [
    { dimension: "Revenue health", score: 74, summary: "Revenue is growing, but more slowly than marketing investment.", why: ["Revenue ₦6.0m in September (+3% vs August)", "Marketing spend grew 40% in the same period", "Revenue per naira of marketing spend declined from ₦22.0 to ₦16.2"] },
    { dimension: "Marketing efficiency", score: 61, summary: "Overall efficiency fell; Google and Referral remain efficient, Instagram does not.", why: ["Marketing spend +40% while customers +4%", "Instagram CAC ₦18,182 vs Google ₦6,250", "Referral CAC ₦1,429 — the most efficient channel"] },
    { dimension: "Customer acquisition", score: 66, summary: "Customer growth is positive but nearly flat.", why: ["49 new customers vs 47 in August (+4%)", "Enquiries grew 50% — acquisition top-of-funnel is not the constraint"] },
    { dimension: "Conversion", score: 48, summary: "Enquiry-to-customer conversion weakened as volume grew.", why: ["Conversion fell from 25.4% to 17.7% overall", "Instagram conversion is 6.0% vs Google 38.7%", "The largest conversion gap is among Instagram enquiries"] },
    { dimension: "Data coverage", score: 62, summary: "Enough for directional diagnosis, not for certainty.", why: ["Marketing and revenue coverage strong", "Website analytics missing", "Response-time and lead-quality data unavailable"] },
  ],
  lastSyncNote: "Data updated 12 minutes ago · manual entries verified Sep 30",
  lastSyncOk: true,
};

export const KORAHOME: Business = {
  id: "korahome",
  name: "KoraHome Store",
  type: "ecommerce",
  location: "Nigeria",
  platform: "Shopify",
  model: "Home & living products (B2C ecommerce)",
  goal: "Recover order growth without buying more traffic",
  journey: ["Discovery (Google / Instagram)", "Website", "Product view", "Add to cart", "Checkout", "Purchase", "Repeat purchase"],
  monthly: khMonthly,
  daily: khDaily,
  channels: [
    { id: "instagram", name: "Instagram Ads", kind: "paid", spend: 320000, enquiries: 0, customers: 0, revenue: 2480000, cac: 1081, conversion: 0, orders: 296, trend: [180, 205, 228, 251, 270, 296] },
    { id: "google", name: "Google Search", kind: "paid", spend: 210000, enquiries: 0, customers: 0, revenue: 1860000, cac: 946, conversion: 0, orders: 222, trend: [140, 152, 165, 180, 201, 222] },
    { id: "organic", name: "Organic Social", kind: "organic", spend: 0, enquiries: 0, customers: 0, revenue: 1100000, cac: 0, conversion: 0, orders: 133, trend: [95, 104, 110, 118, 126, 133] },
    { id: "direct", name: "Direct / Repeat", kind: "organic", spend: 0, enquiries: 0, customers: 0, revenue: 760000, cac: 0, conversion: 0, orders: 89, trend: [70, 74, 79, 82, 86, 89] },
  ],
  funnel: [
    { id: "visitors", label: "Visitors", value: 18430 },
    { id: "views", label: "Product views", value: 12800 },
    { id: "carts", label: "Add to cart", value: 2560 },
    { id: "checkouts", label: "Checkouts started", value: 1510 },
    { id: "purchases", label: "Purchases", value: 740 },
  ],
  products: [
    { id: "chair", name: "Kora Rattan Lounge Chair", views: 3120, carts: 720, orders: 196, revenue: 2150000, returns: 6 },
    { id: "baskets", name: "Handwoven Basket Set", views: 2450, carts: 505, orders: 142, revenue: 1130000, returns: 3 },
    { id: "dinnerware", name: "Ceramic Dinnerware Set", views: 2130, carts: 431, orders: 121, revenue: 1090000, returns: 4 },
    { id: "rug", name: "Jute Floor Rug", views: 1870, carts: 352, orders: 104, revenue: 920000, returns: 5 },
    { id: "planter", name: "Terracotta Planter Trio", views: 1540, carts: 268, orders: 82, revenue: 550000, returns: 2 },
    { id: "other", name: "Other products", views: 1690, carts: 284, orders: 95, revenue: 360000, returns: 3 },
  ],
  website: {
    connected: true,
    traffic: 18430,
    visitors: 14100,
    mobileShare: 87,
    visitorConversion: 4.0,
    deviceMix: { mobile: 87, desktop: 13 },
    mobileCheckout: { previous: 71, current: 48 },
    desktopCheckout: { previous: 78, current: 77 },
    paymentFailuresDelta: 31,
    landingPages: [
      { path: "/ (home)", visits: 8640, conversion: 3.1 },
      { path: "/collections/rattan-chairs", visits: 4120, conversion: 5.8 },
      { path: "/products/kora-rattan-lounge-chair", visits: 2380, conversion: 6.4 },
      { path: "/collections/kitchen-dining", visits: 1790, conversion: 4.2 },
      { path: "/products/jute-floor-rug", visits: 1500, conversion: 5.1 },
    ],
  },
  retention: {
    connected: true,
    newCustomers: 604,
    repeatCustomers: 136,
    repeatRate: 18.4,
    frequency: 1.35,
  },
  dataCoverage: {
    overall: 58,
    areas: [
      { area: "Revenue", coverage: 92, known: "Order-level revenue via Shopify for Feb–Sep.", missing: "Payment-gateway fee detail.", unlocks: "Net revenue accuracy." },
      { area: "Marketing", coverage: 78, known: "Instagram Ads and Google Search spend and attributed orders.", missing: "Organic social attribution depth.", unlocks: "Cleaner blended CAC." },
      { area: "Sales funnel", coverage: 88, known: "Full click funnel: visitors → product views → carts → checkouts → purchases.", missing: "Exit-step error logs.", unlocks: "Exact step-level failure reasons." },
      { area: "Website", coverage: 72, known: "Traffic, device mix, checkout completion by device, top landing pages.", missing: "Heatmaps and session recordings.", unlocks: "Pinpointing the failing checkout step." },
      { area: "Customers", coverage: 44, known: "New vs repeat split and purchase frequency.", missing: "Addresses/segments and lifetime value.", unlocks: "LTV-based budget decisions." },
    ],
  },
  health: [
    { dimension: "Revenue health", score: 55, summary: "Revenue declined 8% despite healthy demand.", why: ["Revenue ₦6.2m in September (−8% vs August)", "Orders fell 8% while traffic grew 24%", "Average order value roughly stable (₦8,378)"] },
    { dimension: "Marketing efficiency", score: 64, summary: "Traffic growth is being bought but not converting to orders.", why: ["Spend ₦530k produced CAC ₦716 (from ₦696)", "Instagram Ads drive 40% of orders at ₦1,081 CAC", "Organic + repeat orders remain profitable"] },
    { dimension: "Customer acquisition", score: 58, summary: "More visitors, fewer buyers.", why: ["Visitors +24% month over month", "Orders −8% month over month", "Visitor→purchase conversion fell from 5.4% to 4.0%"] },
    { dimension: "Conversion", score: 42, summary: "Mobile checkout is the weakest point in the funnel.", why: ["Mobile checkout completion fell 71% → 48%", "Payment failures +31%", "Desktop completion broadly stable (78% → 77%)"] },
    { dimension: "Data coverage", score: 58, summary: "Strong funnel data; customer-level data is thinner.", why: ["Shopify click-funnel data available", "Sync currently delayed (see Data Centre)", "No session-replay tooling"] },
  ],
  lastSyncNote: "Shopify last synced 3 hours ago — sync delayed",
  lastSyncOk: false,
};

export type WorkspaceId = "swifthaul" | "korahome" | "user-workspace";

export interface UserWorkspaceMeta {
  name: string;
  type: BusinessType;
  country: string;
  currency: string;
  website?: string;
}

const TEMPLATE_BY_TYPE: Record<BusinessType, Business> = {
  service: SWIFTHAUL,
  ecommerce: KORAHOME,
};

/**
 * Resolve the active business. For a user's own workspace this is built from
 * their checkup facts and manual entries ONLY — sample numbers never leak in.
 *
 * `facts`/`entries` are optional: when a caller omits them we read the live
 * store so low-context screens still resolve the owner's real workspace
 * instead of a thinner (or worse, sample-shaped) one.
 */
export function getBusiness(
  id: WorkspaceId | undefined,
  userWorkspace?: UserWorkspaceMeta | null,
  facts?: BusinessFacts | null,
  entries?: ManualEntry[],
): Business {
  if (id === "user-workspace" && userWorkspace) {
    // Late import avoided: the store owns this data; reading the snapshot here
    // keeps ~25 screens correct without each one subscribing to facts.
    const state = useBizz.getState();
    return buildUserBusiness({
      workspace: userWorkspace,
      facts: facts !== undefined ? facts : state.checkup.facts ?? null,
      entries: entries ?? state.manualEntries,
    });
  }
  if (id === "korahome") return KORAHOME;
  return SWIFTHAUL;
}

// ---------- Period helpers ----------

export interface PeriodMetrics {
  spend: number;
  enquiries: number;
  customers: number;
  revenue: number;
  orders: number;
  traffic: number;
}

export interface PeriodSelection {
  label: string;
  compareLabel: string;
  current: PeriodMetrics;
  previous: PeriodMetrics;
  series: { label: string; current: number; previous?: number }[];
  seriesKind: "daily" | "monthly";
}

const EMPTY: PeriodMetrics = { spend: 0, enquiries: 0, customers: 0, revenue: 0, orders: 0, traffic: 0 };

/** Full month label ("October 2026") for owner-entered months; sample months keep fixed labels. */
function fullLabelOf(m?: MonthlyPoint): string | null {
  return m?.fullLabel ?? null;
}

function fromMonthly(m?: MonthlyPoint): PeriodMetrics {
  return {
    spend: m?.spend ?? 0,
    enquiries: m?.enquiries ?? 0,
    customers: m?.customers ?? 0,
    revenue: m?.revenue ?? 0,
    orders: m?.orders ?? 0,
    traffic: m?.traffic ?? 0,
  };
}

function sumDaily(days: DailyPoint[]): PeriodMetrics {
  return days.reduce(
    (acc, d) => ({
      spend: acc.spend + d.spend,
      enquiries: acc.enquiries + d.enquiries,
      customers: acc.customers + d.customers,
      revenue: acc.revenue + d.revenue,
      orders: acc.orders + (d.orders ?? 0),
      traffic: acc.traffic + (d.traffic ?? 0),
    }),
    { ...EMPTY }
  );
}

export function getPeriod(business: Business, range: DateRangeId): PeriodSelection {
  const monthly = business.monthly;
  const current = monthly[monthly.length - 1];
  const prev = monthly[monthly.length - 2];
  // A workspace with no measured months yet gets an honest empty period —
  // never a sample month borrowed from a demo business.
  if (!current) {
    return {
      label: "No measured period yet",
      compareLabel: "waiting for your first data",
      current: { ...EMPTY },
      previous: { ...EMPTY },
      seriesKind: "monthly",
      series: [],
    };
  }
  switch (range) {
    case "this-month": {
      const curLabel = fullLabelOf(current);
      const prevLabel = fullLabelOf(prev);
      return {
        label: curLabel ?? "September 2026",
        compareLabel: prevLabel ? `vs ${prevLabel}` : "vs August 2026",
        current: fromMonthly(current),
        previous: fromMonthly(prev),
        seriesKind: "daily",
        series: business.daily.map((d) => ({ label: d.label, current: d.revenue })),
      };
    }
    case "last-month": {
      const prevLabel = fullLabelOf(prev);
      const before = monthly[monthly.length - 3];
      const beforeLabel = fullLabelOf(before);
      return {
        label: prevLabel ?? "August 2026",
        compareLabel: beforeLabel ? `vs ${beforeLabel}` : "vs July 2026",
        current: fromMonthly(prev),
        previous: fromMonthly(before),
        seriesKind: "daily",
        series: business.daily.map((d) => ({ label: d.label, current: d.revenue })),
      };
    }
    case "last-7": {
      const cur = sumDaily(business.daily.slice(23));
      const prv = sumDaily(business.daily.slice(16, 23));
      return {
        label: "Last 7 days (Sep 24–30)",
        compareLabel: "vs previous 7 days",
        current: cur,
        previous: prv,
        seriesKind: "daily",
        series: business.daily.slice(23).map((d) => ({ label: d.label, current: d.revenue })),
      };
    }
    case "last-30":
    default: {
      const curLabel = fullLabelOf(current);
      const prevLabel = fullLabelOf(prev);
      return {
        label: curLabel ? `Last 30 days (${curLabel})` : "Last 30 days (September 2026)",
        compareLabel: prevLabel ? `vs previous 30 days (${prevLabel})` : "vs previous 30 days",
        current: sumDaily(business.daily),
        previous: fromMonthly(prev),
        seriesKind: "daily",
        series: business.daily.map((d) => ({ label: d.label, current: d.revenue })),
      };
    }
  }
}

export const DATE_RANGES: { id: DateRangeId; label: string }[] = [
  { id: "last-7", label: "Last 7 days" },
  { id: "last-30", label: "Last 30 days" },
  { id: "this-month", label: "This month" },
  { id: "last-month", label: "Last month" },
];

export const REPORTING_MONTH = { current: "September 2026", previous: "August 2026" };
