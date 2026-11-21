import type { MeasuredSummary } from "./types";
import { metricRows, type MetricRow } from "./store";
import { entryForProduct } from "./catalogue";

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysBefore(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return iso(date);
}

function sum(rows: MetricRow[], metric: string, from: string, to: string, dimension = ""): number {
  return rows
    .filter((row) => row.metric === metric && row.dimension === dimension && iso(row.date) >= from && iso(row.date) <= to)
    .reduce((total, row) => total + row.value, 0);
}

function latestDailyDate(rows: MetricRow[]): string | null {
  const dates = rows.filter((row) => row.dimension === "").map((row) => iso(row.date)).sort();
  return dates.at(-1) ?? null;
}

function topDimension(rows: MetricRow[], dimension: string) {
  const clicks = new Map<string, number>();
  const impressions = new Map<string, number>();
  for (const row of rows.filter((item) => item.dimension === dimension)) {
    const map = row.metric === "clicks" ? clicks : row.metric === "impressions" ? impressions : null;
    if (map) map.set(row.dimensionValue, (map.get(row.dimensionValue) ?? 0) + row.value);
  }
  return [...clicks]
    .map(([key, value]) => ({ key, clicks: value, impressions: impressions.get(key) ?? 0, prevClicks: 0 }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10);
}

export async function measuredSummary(userId: string, workspaceId: string | null): Promise<MeasuredSummary> {
  const from = daysBefore(iso(new Date()), 100);
  const rows = await metricRows(userId, workspaceId, from);
  const searchRows = rows.filter((row) => row.product === "search-console");
  const analyticsRows = rows.filter((row) => row.product === "analytics");
  const genericRows = rows.filter((row) => !(row.provider === "google" && (row.product === "search-console" || row.product === "analytics")));

  const searchTo = latestDailyDate(searchRows);
  const analyticsTo = latestDailyDate(analyticsRows);
  const searchConsole = searchTo
    ? (() => {
        const current = { from: daysBefore(searchTo, 27), to: searchTo };
        const previous = { from: daysBefore(current.from, 28), to: daysBefore(current.from, 1) };
        const currentImpressions = sum(searchRows, "impressions", current.from, current.to);
        const previousImpressions = sum(searchRows, "impressions", previous.from, previous.to);
        const weightedPosition = (window: { from: string; to: string }) => {
          const daily = searchRows.filter((row) => row.metric === "position" && row.dimension === "" && iso(row.date) >= window.from && iso(row.date) <= window.to);
          const weighted = daily.reduce((total, row) => {
            const impressions = searchRows.find((item) => item.metric === "impressions" && item.dimension === "" && iso(item.date) === iso(row.date))?.value ?? 0;
            return total + row.value * impressions;
          }, 0);
          const impressions = sum(searchRows, "impressions", window.from, window.to);
          return impressions ? weighted / impressions : null;
        };
        return {
          connectionId: searchRows[0].connectionId,
          site: searchRows[0].accountLabel ?? "Google Search Console",
          window: current,
          prevWindow: previous,
          clicks: { now: sum(searchRows, "clicks", current.from, current.to), prev: sum(searchRows, "clicks", previous.from, previous.to) },
          impressions: { now: currentImpressions, prev: previousImpressions },
          ctr: {
            now: currentImpressions ? (sum(searchRows, "clicks", current.from, current.to) / currentImpressions) * 100 : null,
            prev: previousImpressions ? (sum(searchRows, "clicks", previous.from, previous.to) / previousImpressions) * 100 : null,
          },
          position: { now: weightedPosition(current), prev: weightedPosition(previous) },
          topQueries: topDimension(searchRows, "query"),
          topPages: topDimension(searchRows, "page"),
          daily: searchRows
            .filter((row) => row.dimension === "" && row.metric === "clicks" && iso(row.date) >= current.from)
            .map((row) => ({ date: iso(row.date), clicks: row.value, impressions: searchRows.find((item) => item.metric === "impressions" && item.dimension === "" && iso(item.date) === iso(row.date))?.value ?? 0 })),
          lastSyncAt: searchRows[0].lastSyncAt?.toISOString() ?? null,
        };
      })()
    : null;

  const analytics = analyticsTo
    ? (() => {
        const current = { from: daysBefore(analyticsTo, 27), to: analyticsTo };
        const previous = { from: daysBefore(current.from, 28), to: daysBefore(current.from, 1) };
        const usersFor = (window: { from: string; to: string }) =>
          analyticsRows.find((row) => row.metric === "users28d" && row.dimension === "window" && row.dimensionValue === `${window.from}:${window.to}`)?.value ?? null;
        const channelNames = new Set(analyticsRows.filter((row) => row.dimension.startsWith("channel-")).map((row) => row.dimensionValue));
        const channelValue = (key: string, metric: string, dimension: string) =>
          analyticsRows.find((row) => row.dimensionValue === key && row.metric === metric && row.dimension === dimension)?.value ?? 0;
        return {
          connectionId: analyticsRows[0].connectionId,
          property: analyticsRows[0].accountLabel ?? "Google Analytics",
          window: current,
          prevWindow: previous,
          sessions: { now: sum(analyticsRows, "sessions", current.from, current.to), prev: sum(analyticsRows, "sessions", previous.from, previous.to) },
          users: { now: usersFor(current), prev: usersFor(previous) },
          newUsers: { now: sum(analyticsRows, "newUsers", current.from, current.to), prev: sum(analyticsRows, "newUsers", previous.from, previous.to) },
          keyEvents: { now: sum(analyticsRows, "keyEvents", current.from, current.to), prev: sum(analyticsRows, "keyEvents", previous.from, previous.to) },
          channels: [...channelNames]
            .map((key) => ({ key, sessions: channelValue(key, "sessions", "channel-current"), prevSessions: channelValue(key, "sessions", "channel-previous"), keyEvents: channelValue(key, "keyEvents", "channel-current") }))
            .sort((a, b) => b.sessions - a.sessions)
            .slice(0, 10),
          daily: analyticsRows
            .filter((row) => row.dimension === "" && row.metric === "sessions" && iso(row.date) >= current.from)
            .map((row) => ({ date: iso(row.date), sessions: row.value, keyEvents: analyticsRows.find((item) => item.metric === "keyEvents" && item.dimension === "" && iso(item.date) === iso(row.date))?.value ?? 0 })),
          lastSyncAt: analyticsRows[0].lastSyncAt?.toISOString() ?? null,
        };
      })()
    : null;

  const byConnection = new Map<string, MetricRow[]>();
  for (const row of genericRows) byConnection.set(row.connectionId, [...(byConnection.get(row.connectionId) ?? []), row]);
  const cumulative = new Set(["followers"]);
  const otherSources = [...byConnection.values()].flatMap((sourceRows) => {
    const to = latestDailyDate(sourceRows);
    if (!to) return [];
    const current = { from: daysBefore(to, 27), to };
    const previous = { from: daysBefore(current.from, 28), to: daysBefore(current.from, 1) };
    const metricNames = [...new Set(sourceRows.filter((row) => row.dimension === "").map((row) => row.metric))];
    const value = (metric: string, window: { from: string; to: string }) => {
      if (!cumulative.has(metric)) return sum(sourceRows, metric, window.from, window.to);
      return sourceRows.filter((row) => row.metric === metric && row.dimension === "" && iso(row.date) >= window.from && iso(row.date) <= window.to).sort((a, b) => b.date.getTime() - a.date.getTime())[0]?.value ?? 0;
    };
    const first = sourceRows[0];
    return [{
      connectionId: first.connectionId, provider: first.provider, product: first.product,
      source: entryForProduct(first.provider, first.product)?.name ?? `${first.provider} ${first.product}`,
      account: first.accountLabel ?? "Connected account", window: current, prevWindow: previous,
      metrics: Object.fromEntries(metricNames.map((metric) => [metric, { now: value(metric, current), prev: value(metric, previous) }])),
      lastSyncAt: first.lastSyncAt?.toISOString() ?? null,
    }];
  });

  return { generatedAt: new Date().toISOString(), searchConsole, analytics, otherSources };
}

function pct(now: number, prev: number): string {
  if (!prev) return "no previous comparison";
  const change = ((now - prev) / prev) * 100;
  return `${change >= 0 ? "+" : ""}${change.toFixed(1)}% vs previous 28 days`;
}

/** Compact, server-owned context. Every figure is traceable to MetricDaily. */
export function formatMeasuredContext(summary: MeasuredSummary): string {
  const lines = ["MEASURED FROM CONNECTED SOURCES (read-only; safe to cite as provenance measured):"];
  const sc = summary.searchConsole;
  if (sc) {
    lines.push(
      `Google Search Console — ${sc.site}, ${sc.window.from} to ${sc.window.to}: ${sc.clicks.now} clicks (${pct(sc.clicks.now, sc.clicks.prev)}), ${sc.impressions.now} impressions (${pct(sc.impressions.now, sc.impressions.prev)}), CTR ${sc.ctr.now?.toFixed(2) ?? "unknown"}%.`,
    );
    if (sc.topQueries.length) lines.push(`Top Google searches by clicks: ${sc.topQueries.slice(0, 5).map((q) => `${q.key} (${q.clicks})`).join("; ")}.`);
    if (sc.topPages.length) lines.push(`Top pages from Google by clicks: ${sc.topPages.slice(0, 5).map((p) => `${p.key} (${p.clicks})`).join("; ")}.`);
  }
  const ga = summary.analytics;
  if (ga) {
    lines.push(
      `Google Analytics — ${ga.property}, ${ga.window.from} to ${ga.window.to}: ${ga.sessions.now} sessions (${pct(ga.sessions.now, ga.sessions.prev)}), ${ga.users.now ?? "unknown"} users, ${ga.keyEvents.now} key events (${pct(ga.keyEvents.now, ga.keyEvents.prev)}).`,
    );
    if (ga.channels.length) lines.push(`Top traffic channels: ${ga.channels.slice(0, 5).map((c) => `${c.key} (${c.sessions} sessions, ${c.keyEvents} key events)`).join("; ")}.`);
  }
  for (const source of summary.otherSources) {
    const metrics = Object.entries(source.metrics).filter(([, change]) => change.now !== 0 || change.prev !== 0).slice(0, 8);
    if (metrics.length) lines.push(`${source.source} — ${source.account}, ${source.window.from} to ${source.window.to}: ${metrics.map(([name, change]) => `${name} ${change.now} (${pct(change.now, change.prev)})`).join(", ")}.`);
  }
  return lines.length === 1 ? "" : lines.join("\n");
}

export async function measuredContext(userId: string, workspaceId: string | null): Promise<string> {
  try {
    return formatMeasuredContext(await measuredSummary(userId, workspaceId));
  } catch (error) {
    // Connector tables are optional until the additive SQL is applied. AI
    // features continue with owner-supplied context instead of failing.
    console.warn("[connectors] measured context unavailable", error instanceof Error ? error.message : String(error));
    return "";
  }
}
