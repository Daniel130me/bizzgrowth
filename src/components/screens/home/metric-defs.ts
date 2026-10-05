// Shared metric configuration for the Home screen group (screens 21–23).
// Every number here is derived from the shared data layer — never invented.
import type { Business, ChannelMetrics, GoalRecord, Goodness, Insight, Provenance, Recommendation, TimelineEvent } from "@/lib/types";
import type { PeriodSelection } from "@/lib/data/businesses";
import { insightsFor, recommendationsFor } from "@/lib/data/intelligence";
import { GOALS, TIMELINE, timelineFor } from "@/lib/data/operations";
import { deltaPct, fmtNaira, fmtNum, fmtPct, goodnessFor } from "@/lib/format";

export type MetricId = "revenue" | "customers" | "enquiries" | "orders" | "traffic" | "spend" | "cac" | "conversion";

export const METRIC_IDS: MetricId[] = ["revenue", "customers", "enquiries", "orders", "traffic", "spend", "cac", "conversion"];

const SERVICE_ONLY: MetricId[] = ["customers", "enquiries"];
const ECOM_ONLY: MetricId[] = ["orders", "traffic"];

/** User-created workspaces inherit their template story — intelligence falls back by type. */
export function demoFallbackId(business: Business): string {
  return business.type === "ecommerce" ? "korahome" : "swifthaul";
}

export function insightsForBusiness(business: Business): Insight[] {
  const direct = insightsFor(business.id);
  return direct.length ? direct : insightsFor(demoFallbackId(business));
}

export function recommendationsForBusiness(business: Business): Recommendation[] {
  const direct = recommendationsFor(business.id);
  return direct.length ? direct : recommendationsFor(demoFallbackId(business));
}

export function timelineForBusiness(business: Business): TimelineEvent[] {
  const direct = timelineFor(business.id);
  return direct.length ? direct : TIMELINE.filter((t) => t.businessId === demoFallbackId(business));
}

export function goalsForBusiness(business: Business): GoalRecord[] {
  const direct = GOALS.filter((g) => g.businessId === business.id);
  return direct.length ? direct : GOALS.filter((g) => g.businessId === demoFallbackId(business));
}

/** The goal the Home screen should highlight: the first active / at-risk one. */
export function primaryGoal(business: Business): GoalRecord | undefined {
  const goals = goalsForBusiness(business);
  return goals.find((g) => g.status === "active" || g.status === "at-risk") ?? goals[0];
}

export function isMetricAvailable(id: MetricId, business: Business): boolean {
  if (SERVICE_ONLY.includes(id)) return business.type === "service";
  if (ECOM_ONLY.includes(id)) return business.type === "ecommerce";
  return true;
}

export function metricLabel(id: MetricId, business: Business): string {
  switch (id) {
    case "revenue":
      return "Revenue";
    case "customers":
      return "New customers";
    case "enquiries":
      return "Enquiries";
    case "orders":
      return "Orders";
    case "traffic":
      return "Visitors";
    case "spend":
      return "Marketing spend";
    case "cac":
      return business.type === "ecommerce" ? "Cost per order (CAC)" : "Customer acquisition cost (CAC)";
    case "conversion":
      return business.type === "ecommerce" ? "Visitor → purchase conversion" : "Enquiry → customer conversion";
  }
}

/** ₦6.0m / ₦370k style compact money for headline cards. */
export function fmtMoneyMajor(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `₦${(v / 1_000_000).toFixed(1)}m`;
  return fmtNaira(v, { compact: true });
}

function denomFor(business: Business, p: PeriodSelection["current"]): number {
  return business.type === "ecommerce" ? p.orders : p.customers;
}

export interface MetricSnapshot {
  id: MetricId;
  label: string;
  available: boolean;
  value: number;
  previous: number;
  /** percent change vs previous period (already rounded for display) */
  delta: number;
  goodness: Goodness;
  provenance: Provenance;
  source: string;
  format: "money" | "count" | "percent";
  /** full-precision display, e.g. ₦370,000 */
  display: string;
  /** compact display for cards, e.g. ₦370k */
  displayCompact: string;
  previousDisplay: string;
}

export function metricSnapshot(id: MetricId, business: Business, period: PeriodSelection): MetricSnapshot {
  const cur = period.current;
  const prev = period.previous;
  const ecom = business.type === "ecommerce";
  const available = isMetricAvailable(id, business);

  let value = 0;
  let previous = 0;
  let format: MetricSnapshot["format"] = "count";
  let provenance: Provenance = "measured";
  let source = "";

  switch (id) {
    case "revenue":
      value = cur.revenue;
      previous = prev.revenue;
      format = "money";
      provenance = ecom ? "measured" : "user-supplied";
      source = ecom ? "Shopify order revenue" : "Manual monthly submission";
      break;
    case "spend":
      value = cur.spend;
      previous = prev.spend;
      format = "money";
      provenance = "measured";
      source = ecom ? "Meta Ads + Google Ads" : "Manual submission + Meta Ads";
      break;
    case "customers":
      value = cur.customers;
      previous = prev.customers;
      format = "count";
      provenance = "user-supplied";
      source = "Manual monthly submission";
      break;
    case "enquiries":
      value = cur.enquiries;
      previous = prev.enquiries;
      format = "count";
      provenance = "measured";
      source = "Manual submission + Meta Ads";
      break;
    case "orders":
      value = cur.orders;
      previous = prev.orders;
      format = "count";
      provenance = "measured";
      source = "Shopify orders";
      break;
    case "traffic":
      value = cur.traffic;
      previous = prev.traffic;
      format = "count";
      provenance = "measured";
      source = "Shopify sessions";
      break;
    case "cac": {
      const cd = denomFor(business, cur);
      const pd = denomFor(business, prev);
      value = cd ? cur.spend / cd : 0;
      previous = pd ? prev.spend / pd : 0;
      format = "money";
      provenance = "estimated";
      source = `Calculated — spend ÷ ${ecom ? "orders" : "customers"}`;
      break;
    }
    case "conversion": {
      if (ecom) {
        value = cur.traffic ? (cur.orders / cur.traffic) * 100 : 0;
        previous = prev.traffic ? (prev.orders / prev.traffic) * 100 : 0;
      } else {
        value = cur.enquiries ? (cur.customers / cur.enquiries) * 100 : 0;
        previous = prev.enquiries ? (prev.customers / prev.enquiries) * 100 : 0;
      }
      format = "percent";
      provenance = "estimated";
      source = ecom ? "Calculated — orders ÷ visitors" : "Calculated — customers ÷ enquiries";
      break;
    }
  }

  const delta = Math.round(deltaPct(value, previous));
  const goodness = goodnessFor(id, delta >= 0 ? "up" : "down");

  const full =
    format === "money"
      ? fmtNaira(Math.round(value))
      : format === "percent"
        ? fmtPct(value)
        : fmtNum(value);
  const compact =
    format === "money"
      ? fmtMoneyMajor(value)
      : format === "percent"
        ? fmtPct(value)
        : fmtNum(value);
  const prevDisplay =
    format === "money"
      ? fmtNaira(Math.round(previous))
      : format === "percent"
        ? fmtPct(previous)
        : fmtNum(previous);

  return {
    id,
    label: metricLabel(id, business),
    available,
    value,
    previous,
    delta,
    goodness,
    provenance,
    source,
    format,
    display: full,
    displayCompact: compact,
    previousDisplay: prevDisplay,
  };
}

/** Monthly series for the trend chart (always over business.monthly). */
export function metricMonthlySeries(id: MetricId, business: Business): { label: string; value: number }[] {
  const ecom = business.type === "ecommerce";
  return business.monthly.map((m) => {
    let value = 0;
    switch (id) {
      case "revenue":
        value = m.revenue;
        break;
      case "spend":
        value = m.spend;
        break;
      case "customers":
        value = m.customers;
        break;
      case "enquiries":
        value = m.enquiries;
        break;
      case "orders":
        value = m.orders ?? 0;
        break;
      case "traffic":
        value = m.traffic ?? 0;
        break;
      case "cac": {
        const denom = ecom ? m.orders ?? 0 : m.customers;
        value = denom ? m.spend / denom : 0;
        break;
      }
      case "conversion": {
        if (ecom) value = m.traffic ? ((m.orders ?? 0) / m.traffic) * 100 : 0;
        else value = m.enquiries ? (m.customers / m.enquiries) * 100 : 0;
        break;
      }
    }
    return { label: m.label, value };
  });
}

export function metricChartFormatter(id: MetricId): (v: number) => string {
  switch (id) {
    case "revenue":
      return (v) => `₦${(v / 1e6).toFixed(1)}m`;
    case "spend":
    case "cac":
      return (v) => fmtNaira(v, { compact: true });
    case "conversion":
      return (v) => `${v.toFixed(1)}%`;
    default:
      return (v) => fmtNum(Math.round(v));
  }
}

export interface BreakdownTable {
  columns: { key: string; label: string }[];
  rows: { id: string; name: string; cells: string[] }[];
}

/**
 * Channel-level breakdown for a metric. Returns null when the workspace has
 * no per-channel data for it — callers must show an explanatory note, never zeros.
 */
export function breakdownFor(id: MetricId, business: Business): BreakdownTable | null {
  const cs: ChannelMetrics[] = business.channels;
  const ecom = business.type === "ecommerce";
  const na = "—";
  switch (id) {
    case "revenue": {
      const total = cs.reduce((a, c) => a + c.revenue, 0);
      return {
        columns: [
          { key: "revenue", label: "Revenue" },
          { key: "share", label: "Share" },
          { key: "roas", label: "ROAS" },
        ],
        rows: cs.map((c) => ({
          id: c.id,
          name: c.name,
          cells: [
            fmtNaira(c.revenue),
            total ? fmtPct((c.revenue / total) * 100) : na,
            c.spend > 0 ? `${(c.revenue / c.spend).toFixed(1)}x` : na,
          ],
        })),
      };
    }
    case "customers": {
      if (ecom) return null;
      return {
        columns: [
          { key: "customers", label: "Customers" },
          { key: "cac", label: "CAC" },
          { key: "conv", label: "Conversion" },
        ],
        rows: cs.map((c) => ({
          id: c.id,
          name: c.name,
          cells: [fmtNum(c.customers), c.customers > 0 ? fmtNaira(c.cac) : na, fmtPct(c.conversion)],
        })),
      };
    }
    case "enquiries": {
      if (ecom) return null;
      return {
        columns: [
          { key: "enquiries", label: "Enquiries" },
          { key: "customers", label: "Customers" },
          { key: "conv", label: "Conversion" },
        ],
        rows: cs.map((c) => ({
          id: c.id,
          name: c.name,
          cells: [fmtNum(c.enquiries), fmtNum(c.customers), fmtPct(c.conversion)],
        })),
      };
    }
    case "orders": {
      if (!ecom) return null;
      return {
        columns: [
          { key: "orders", label: "Orders" },
          { key: "revenue", label: "Revenue" },
          { key: "cpo", label: "Cost per order" },
        ],
        rows: cs.map((c) => ({
          id: c.id,
          name: c.name,
          cells: [
            fmtNum(c.orders ?? 0),
            fmtNaira(c.revenue),
            c.spend > 0 && (c.orders ?? 0) > 0 ? fmtNaira(Math.round(c.spend / (c.orders ?? 1))) : na,
          ],
        })),
      };
    }
    case "spend": {
      const total = cs.reduce((a, c) => a + c.spend, 0);
      return {
        columns: [
          { key: "spend", label: "Spend" },
          { key: "share", label: "Share of spend" },
          { key: "vol", label: ecom ? "Orders" : "Enquiries" },
        ],
        rows: cs.map((c) => ({
          id: c.id,
          name: c.name,
          cells: [
            c.spend > 0 ? fmtNaira(c.spend) : na,
            c.spend > 0 && total ? fmtPct((c.spend / total) * 100) : na,
            fmtNum(ecom ? c.orders ?? 0 : c.enquiries),
          ],
        })),
      };
    }
    case "cac": {
      if (ecom) {
        return {
          columns: [
            { key: "cpo", label: "Cost per order" },
            { key: "spend", label: "Spend" },
            { key: "orders", label: "Orders" },
          ],
          rows: cs.map((c) => ({
            id: c.id,
            name: c.name,
            cells: [
              c.spend > 0 && (c.orders ?? 0) > 0 ? fmtNaira(Math.round(c.spend / (c.orders ?? 1))) : na,
              c.spend > 0 ? fmtNaira(c.spend) : na,
              fmtNum(c.orders ?? 0),
            ],
          })),
        };
      }
      return {
        columns: [
          { key: "cac", label: "CAC" },
          { key: "spend", label: "Spend" },
          { key: "customers", label: "Customers" },
        ],
        rows: cs.map((c) => ({
          id: c.id,
          name: c.name,
          cells: [c.customers > 0 ? fmtNaira(c.cac) : na, fmtNaira(c.spend), fmtNum(c.customers)],
        })),
      };
    }
    case "conversion": {
      if (ecom) return null;
      return {
        columns: [
          { key: "conv", label: "Enquiry → customer" },
          { key: "enquiries", label: "Enquiries" },
          { key: "customers", label: "Customers" },
        ],
        rows: cs.map((c) => ({
          id: c.id,
          name: c.name,
          cells: [fmtPct(c.conversion), fmtNum(c.enquiries), fmtNum(c.customers)],
        })),
      };
    }
    case "traffic":
      return null;
  }
}

const METRIC_KEYWORDS: Record<MetricId, string[]> = {
  revenue: ["revenue"],
  customers: ["customer", "acquisition"],
  enquiries: ["enquir", "lead"],
  orders: ["order", "checkout", "purchase"],
  traffic: ["traffic", "visitor"],
  spend: ["spend", "budget", "cost"],
  cac: ["cac", "cost per", "efficien"],
  conversion: ["conversion", "qualification", "checkout"],
};

function matchesAny(haystack: string, keywords: string[]): boolean {
  return keywords.some((k) => haystack.includes(k));
}

export function relatedInsights(id: MetricId, business: Business): Insight[] {
  const list = insightsForBusiness(business);
  const kw = METRIC_KEYWORDS[id];
  return list.filter((i) => matchesAny(`${i.primaryMetric} ${i.title} ${i.summary}`.toLowerCase(), kw)).slice(0, 3);
}

export function importantChanges(id: MetricId, business: Business): TimelineEvent[] {
  const list = timelineForBusiness(business);
  const kw = METRIC_KEYWORDS[id];
  const matches = list.filter((t) => matchesAny(`${t.title} ${t.description}`.toLowerCase(), kw));
  return (matches.length ? matches : list).slice(0, 2);
}
