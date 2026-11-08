// Honest business object for USER-CREATED workspaces.
//
// bizzGrowth rule: a real owner's workspace NEVER inherits sample numbers.
// Everything measured comes from what the owner actually gave us — the checkup
// conversation and any manual entries. Where we have nothing, we say so.
import type { Business, BusinessType, MonthlyPoint } from "../types";
import type { BusinessFacts } from "../checkup";
import type { UserWorkspaceMeta, WorkspaceId } from "./businesses";
import type { ManualEntry } from "../types";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Last N real calendar months, most recent last — e.g. ["July 2025", "August 2025", "September 2025"]. */
export function recentMonthLabels(count: number, now = new Date()): string[] {
  const out: string[] = [];
  const d = new Date(now.getFullYear(), now.getMonth(), 1);
  for (let i = 0; i < count; i++) {
    out.unshift(`${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`);
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

/** Numbers the owner entered by hand, in month order (oldest → newest). */
export interface OwnerMonth {
  label: string;
  revenue?: number;
  spend?: number;
  enquiries?: number;
  customers?: number;
  orders?: number;
  traffic?: number;
  entryId: string;
}

function num(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const n = Number(v.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/** "September 2026" → epoch millis of that month. Unknown formats sort first. */
function monthSortKey(period: string): number {
  const m = period.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (m) {
    const d = new Date(`${m[1]} 1, ${m[2]}`);
    if (!Number.isNaN(d.getTime())) return d.getTime();
  }
  return 0;
}

/**
 * Build OwnerMonths from manual entries for the user workspace.
 * Entries are store records created on the Manual Data Entry screen.
 */
export function ownerMonthsFromEntries(entries: ManualEntry[]): OwnerMonth[] {
  return [...entries]
    .sort((a, b) => monthSortKey(a.period) - monthSortKey(b.period) || a.period.localeCompare(b.period))
    .map((e) => {
      const month: OwnerMonth = { label: e.period, entryId: e.id };
      for (const m of e.metrics) {
        const v = num(m.value);
        if (v === undefined) continue;
        const label = m.label.toLowerCase();
        if (label.includes("revenue")) month.revenue = v;
        else if (label.includes("spend")) month.spend = v;
        else if (label.includes("enquir")) month.enquiries = v;
        else if (label.includes("customer")) month.customers = v;
        else if (label.includes("order")) month.orders = v;
        else if (label.includes("traffic") || label.includes("visitor")) month.traffic = v;
      }
      return month;
    });
}

/** Turn OwnerMonths into the monthly series the charts understand. */
export function monthlyFromOwner(months: OwnerMonth[]): MonthlyPoint[] {
  return months.map((m, i) => ({
    key: `owner-${i}`,
    label: m.label.split(" ")[0].slice(0, 3),
    fullLabel: m.label,
    spend: m.spend ?? 0,
    enquiries: m.enquiries ?? 0,
    customers: m.customers ?? 0,
    revenue: m.revenue ?? 0,
    orders: m.orders,
    traffic: m.traffic,
  }));
}

function coverageAreas(facts: BusinessFacts | null, hasEntries: boolean) {
  const areas: Business["dataCoverage"]["areas"] = [];
  areas.push(
    facts
      ? {
          area: "Business context",
          coverage: 100,
          known: "What you sell, who you serve, your channels, goal and recent changes — from your checkup conversation.",
          missing: "Nothing — this came from you directly.",
          unlocks: "Already powering your first diagnosis and Ask.",
        }
      : {
          area: "Business context",
          coverage: 30,
          known: "Workspace name and country only.",
          missing: "A checkup conversation so the diagnosis understands the business.",
          unlocks: "A first diagnosis without any connections.",
        },
  );
  areas.push(
    hasEntries
      ? {
          area: "Monthly totals",
          coverage: 80,
          known: "Totals you entered by hand — labelled user supplied in analysis.",
          missing: "More months make trends measurable.",
          unlocks: "Trend-based diagnosis instead of direction-only.",
        }
      : {
          area: "Monthly totals",
          coverage: 0,
          known: "Nothing yet — no totals entered.",
          missing: "Spend, enquiries, customers and revenue (or traffic and orders) for at least one month.",
          unlocks: "A Level-2 baseline diagnosis with zero connections.",
        },
  );
  areas.push({
    area: "Connected sources",
    coverage: 0,
    known: "Nothing yet — no third-party account connected.",
    missing: "Ads platforms, store, payments or website analytics.",
    unlocks: "Measured channel data, automatic updates and deeper diagnosis.",
  });
  return areas;
}

export interface BuildUserBusinessInput {
  workspace: UserWorkspaceMeta;
  facts: BusinessFacts | null;
  entries: ManualEntry[];
}

/**
 * The user's OWN business — zero sample figures. Channels and journey come
 * from the owner's checkup answers; all measured arrays stay empty until the
 * owner enters data or connects a source.
 */
export function buildUserBusiness({ workspace, facts, entries }: BuildUserBusinessInput): Business & { isUserWorkspace: true } {
  const type: BusinessType = facts?.businessType ?? workspace.type;
  const months = ownerMonthsFromEntries(entries);
  const channelNames = facts?.channels ?? [];

  const business: Business = {
    id: "user-workspace" satisfies WorkspaceId,
    name: workspace.name,
    type,
    location: workspace.country,
    platform: workspace.type === "ecommerce" ? null : null, // platform only counts once a store is actually connected
    model: facts?.whatTheySell
      ? `${facts.whatTheySell}${type === "ecommerce" ? " (online sales)" : " (services)"}`
      : type === "ecommerce"
        ? "Ecommerce"
        : "Services",
    goal: facts?.primaryGoal ?? "Set a growth goal in your checkup",
    journey: facts?.journey?.length ? facts.journey : [],
    monthly: monthlyFromOwner(months),
    daily: [],
    channels: [], // channel names are known from the checkup; measured channel rows only exist with connected data
    funnel: [],
    services: [],
    products: [],
    website: { connected: false },
    retention: {
      connected: false,
      note: "Repeat-customer tracking needs a payments or store connection. Nothing is estimated in the meantime.",
    },
    dataCoverage: {
      overall: Math.round(coverageAreas(facts, months.length > 0).reduce((a, c) => a + c.coverage, 0) / 3),
      areas: coverageAreas(facts, months.length > 0),
    },
    health: [], // health scores are only computed from measured data — never from sample figures
    lastSyncNote: months.length
      ? `Owner-entered totals for ${months.length} month${months.length > 1 ? "s" : ""} · no sources connected yet`
      : "No data sources connected yet — your checkup answers are the only data so far",
    lastSyncOk: false,
  };

  return { ...business, isUserWorkspace: true };
}

/** Channel display names from the checkup (no invented metrics attached). */
export function userChannelNames(facts: BusinessFacts | null): string[] {
  return facts?.channels ?? [];
}
