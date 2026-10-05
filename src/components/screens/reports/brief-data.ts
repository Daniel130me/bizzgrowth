"use client";
// KoraHome brief variants — built strictly from the shared KoraHome dataset
// (business.monthly / business.daily / business.website / known story numbers).
// Weekly metric values are computed from the daily series with the same
// 7-day windows the rest of the app uses, so nothing can contradict the data.

import type { Business, DailyPoint } from "@/lib/types";
import type { Brief, Goodness } from "@/lib/types";
import { deltaPct, fmtDelta, fmtNaira, goodnessFor } from "@/lib/format";
import { MONTHLY_REVIEW, WEEKLY_BRIEF } from "@/lib/data/operations";

function sumDays(days: DailyPoint[], key: "revenue" | "orders" | "traffic" | "spend"): number {
  return days.reduce((a, d) => a + (d[key] ?? 0), 0);
}

function weekMetric(label: string, value: string, current: number, previous: number, metric: string, unitless = false): { label: string; value: string; goodness: Goodness; note: string } {
  const pct = deltaPct(current, previous);
  const dir = pct >= 0 ? "up" : "down";
  return {
    label,
    value,
    goodness: goodnessFor(metric, dir),
    note: `${fmtDelta(pct)} vs previous week${unitless ? "" : ""}`,
  };
}

export function korahomeWeekly(business: Business): Brief {
  const last7 = business.daily.slice(23);
  const prev7 = business.daily.slice(16, 23);
  const revenue = sumDays(last7, "revenue");
  const revenuePrev = sumDays(prev7, "revenue");
  const orders = sumDays(last7, "orders");
  const ordersPrev = sumDays(prev7, "orders");
  const traffic = sumDays(last7, "traffic");
  const trafficPrev = sumDays(prev7, "traffic");
  const spend = sumDays(last7, "spend");
  const spendPrev = sumDays(prev7, "spend");

  return {
    id: "brief-kh-week-38",
    businessId: business.id,
    kind: "weekly",
    period: "September 21–27, 2026",
    title: "Weekly business brief",
    sections: [
      {
        heading: "This week",
        metrics: [
          weekMetric("Revenue", fmtNaira(revenue), revenue, revenuePrev, "revenue"),
          weekMetric("Orders", String(orders), orders, ordersPrev, "orders"),
          weekMetric("Visitors", traffic.toLocaleString(), traffic, trafficPrev, "traffic"),
          weekMetric("Marketing spend", fmtNaira(spend), spend, spendPrev, "spend"),
        ],
      },
      {
        heading: "What changed",
        paragraphs: [
          "The mobile checkout recovery experiment opened on September 22 with a 30-day window. Recovery messages sent one hour after abandonment are already recovering roughly 11% of abandoned checkouts. Weekly revenue moved in line with the September pattern — visitors are not the constraint, checkout completion is.",
        ],
      },
      {
        heading: "Pay attention to this",
        paragraphs: [
          "Mobile checkout completion stands at 48% against 77% on desktop, and payment failures are up 31% versus August. With 87% of traffic arriving on mobile, this gap drives the order shortfall.",
        ],
      },
      {
        heading: "Opportunity",
        paragraphs: [
          "Recovering mobile completion to the 65% target would restore roughly 180–200 orders per month at current traffic — with no additional advertising spend.",
        ],
      },
      {
        heading: "Recommended action",
        paragraphs: [
          "Continue the mobile checkout recovery test unchanged and finish the payment retry rollout, including alternative payment methods shown after a failed card attempt.",
        ],
      },
      {
        heading: "Goal progress",
        paragraphs: [
          "Mobile checkout completion is tracking 54% against the 65% goal (deadline Oct 31). Checkout recovery remains the fastest path to the remaining 11 points.",
        ],
      },
    ],
  };
}

export const KORAHOME_MONTHLY: Brief = {
  id: "brief-kh-sep",
  businessId: "korahome",
  kind: "monthly",
  period: "September 2026",
  title: "Monthly business review",
  sections: [
    {
      heading: "Executive summary",
      paragraphs: [
        "September brought more visitors but fewer orders. Traffic grew 24% while orders fell 8%, and the decline is concentrated in mobile checkout — completion fell from 71% to 48% amid a 31% rise in payment failures. Demand is healthy; the buying experience is the constraint.",
      ],
      bullets: [
        "Revenue ₦6.2m (−8%)",
        "Orders 740 (−8%)",
        "Traffic 18,430 (+24%)",
        "Marketing spend ₦530,000 (−5%)",
        "Blended CAC ₦716 (+3%)",
      ],
    },
    {
      heading: "Revenue",
      paragraphs: [
        "Revenue reached ₦6.2m, down 8% versus August. Average order value held roughly stable at ₦8,378, so the decline is a volume problem, not a pricing problem.",
      ],
    },
    {
      heading: "Sales / orders",
      paragraphs: [
        "18,430 visitors produced 740 orders — a 4.0% visitor-to-purchase conversion, down from 5.4%. Mobile devices accounted for 87% of traffic and the majority of the lost orders.",
      ],
    },
    {
      heading: "Marketing",
      paragraphs: [
        "Instagram Ads delivered 296 orders at ₦1,081 CAC and Google Search 222 at ₦946. Organic social (133) and direct/repeat (89) orders came at zero ad spend and remain fully profitable.",
      ],
    },
    {
      heading: "Customers",
      paragraphs: [
        "604 new customers with 136 repeat buyers — an 18.4% repeat rate at 1.35 orders per customer. Repeat demand was unaffected by the checkout decline.",
      ],
    },
    {
      heading: "Website",
      paragraphs: [
        "Mobile share was 87%. Mobile checkout completion fell from 71% to 48% while desktop stayed broadly stable at 77%. Payment failures rose 31%. The rattan collection is the top-converting landing page at 5.8%.",
      ],
    },
    {
      heading: "What worked",
      bullets: ["Google Search efficiency (₦946 CAC)", "Organic social — 133 orders at zero spend", "Desktop checkout stability (77%)"],
    },
    {
      heading: "What did not",
      bullets: ["Mobile checkout completion (71% → 48%)", "Payment failures (+31% vs August)", "Visitor → purchase conversion (5.4% → 4.0%)"],
    },
    {
      heading: "Likely explanations",
      paragraphs: [
        "The largest deterioration is concentrated in mobile checkout. Payment failures are the leading hypothesis, followed by address and delivery-cost friction on small screens. Session recordings are missing, so the exact failing step cannot be isolated yet.",
      ],
    },
    {
      heading: "Biggest opportunity",
      paragraphs: [
        "Recovering mobile completion to 65% would restore roughly 180–200 orders per month at current traffic — without any additional advertising spend.",
      ],
    },
    {
      heading: "Biggest risk",
      paragraphs: [
        "Buying more traffic while checkout is failing would scale the loss. The Shopify sync is also delayed, so the freshest figures may be incomplete until reconnection.",
      ],
    },
    {
      heading: "Actions completed",
      bullets: ["Abandoned-checkout WhatsApp recovery flow activated (Oct 1) — early recovery about 11% of abandoned checkouts"],
    },
    {
      heading: "Results measured",
      paragraphs: ["One experiment in flight: the mobile checkout recovery test (baseline 48%, target 65%, 30-day window opened Sep 22)."],
    },
    {
      heading: "Priorities for next month",
      bullets: [
        "Complete the payment retry rollout and show fallback payment methods after a failed attempt",
        "Re-test checkout on three mobile devices and fix the failing step",
        "Reconnect Shopify to resume the data flow",
        "Monitor the recovery flow and push recovery above the early 11% rate",
      ],
    },
  ],
};

export function weeklyBriefFor(business: Business): Brief {
  const isKoraStyle = business.id === "korahome" || (business.id === "user-workspace" && business.type === "ecommerce");
  return isKoraStyle ? korahomeWeekly(business) : WEEKLY_BRIEF;
}

export function monthlyBriefFor(business: Business): Brief {
  const isKoraStyle = business.id === "korahome" || (business.id === "user-workspace" && business.type === "ecommerce");
  return isKoraStyle ? KORAHOME_MONTHLY : MONTHLY_REVIEW;
}
