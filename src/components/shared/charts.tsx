"use client";
// Chart wrappers with consistent semantic colours:
// blue = measured/current · slate = comparison · navy dashed = target/forecast.

import React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CHART_COLORS } from "@/lib/chart-colors";

const AXIS = { stroke: "#94a3b8", fontSize: 11 };
const GRID = "#e2e8f0";

const tooltipStyle = {
  borderRadius: 8,
  border: "1px solid #e2e8f0",
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(15,23,42,0.08)",
};

export function TrendLineChart({
  data,
  xKey,
  series,
  height = 240,
  valueFormatter = (v: number) => v.toLocaleString(),
  legend = true,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  series: { key: string; label: string; color?: string; dashed?: boolean }[];
  height?: number;
  valueFormatter?: (v: number) => string;
  legend?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={54} tickFormatter={(v: number) => valueFormatter(v)} />
        <Tooltip contentStyle={tooltipStyle} formatter={(value) => [valueFormatter(Number(value))]} />
        {legend && <Legend wrapperStyle={{ fontSize: 12 }} iconType="plainline" />}
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color ?? CHART_COLORS.blue}
            strokeWidth={2}
            strokeDasharray={s.dashed ? "6 4" : undefined}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function RevenueAreaChart({
  data,
  xKey,
  height = 240,
  valueFormatter = (v: number) => `₦${(v / 1e6).toFixed(1)}m`,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  height?: number;
  valueFormatter?: (v: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="areaBlue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLORS.blue} stopOpacity={0.25} />
            <stop offset="100%" stopColor={CHART_COLORS.blue} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={54} tickFormatter={(v: number) => valueFormatter(v)} />
        <Tooltip contentStyle={tooltipStyle} formatter={(value) => [valueFormatter(Number(value))]} />
        <Area type="monotone" dataKey="current" name="Value" stroke={CHART_COLORS.blue} strokeWidth={2} fill="url(#areaBlue)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function CompareBarChart({
  data,
  xKey,
  series,
  height = 260,
  valueFormatter = (v: number) => v.toLocaleString(),
  layout = "horizontal",
  showLegend = true,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  series: { key: string; label: string; color?: string }[];
  height?: number;
  valueFormatter?: (v: number) => string;
  layout?: "horizontal" | "vertical";
  showLegend?: boolean;
}) {
  const vertical = layout === "vertical";
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={layout} margin={{ top: 8, right: 16, bottom: 0, left: vertical ? 90 : 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={vertical} horizontal={!vertical} />
        {vertical ? (
          <>
            <XAxis type="number" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} tickFormatter={(v: number) => valueFormatter(v)} />
            <YAxis type="category" dataKey={xKey} tick={{ ...AXIS, fontSize: 12 }} tickLine={false} axisLine={false} width={90} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} width={54} tickFormatter={(v: number) => valueFormatter(v)} />
          </>
        )}
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(148,163,184,0.08)" }} formatter={(value) => [valueFormatter(Number(value))]} />
        {showLegend && <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />}
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color ?? CHART_COLORS.blue} radius={vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={vertical ? 22 : 40} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({
  data,
  height = 220,
  valueFormatter = (v: number) => `${v}%`,
}: {
  data: { name: string; value: number; color?: string }[];
  height?: number;
  valueFormatter?: (v: number) => string;
}) {
  const palette = [CHART_COLORS.blue, CHART_COLORS.navy, CHART_COLORS.amber, CHART_COLORS.slate, CHART_COLORS.green];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={2} strokeWidth={0}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color ?? palette[i % palette.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} formatter={(value) => [valueFormatter(Number(value))]} />
        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/** Baseline → current → target progress chart used by experiments. */
export function ExperimentProgressChart({
  baseline,
  current,
  target,
  label,
  height = 180,
  formatter = (v: number) => `${v}%`,
  axisFormatter,
}: {
  baseline: number;
  current: number;
  target: number;
  label: string;
  height?: number;
  formatter?: (v: number) => string;
  /** Shorter labels for the axis (defaults to `formatter`). */
  axisFormatter?: (v: number) => string;
}) {
  const data = [
    { name: "Baseline", value: baseline, fill: CHART_COLORS.slate },
    { name: "Current", value: current, fill: CHART_COLORS.blue },
    { name: "Target", value: target, fill: CHART_COLORS.navy },
  ];
  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => (axisFormatter ?? formatter)(v)} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(148,163,184,0.08)" }} formatter={(value) => [formatter(Number(value)), label]} />
          <ReferenceLine y={target} stroke={CHART_COLORS.navy} strokeDasharray="6 4" />
          <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={64}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Conversion funnel between two channel conversion rates (for diagnoses). */
export function ChannelConversionChart({
  data,
  height = 220,
}: {
  data: { name: string; conversion: number; color?: string }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} tickFormatter={(v: number) => `${v}%`} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(148,163,184,0.08)" }} formatter={(value) => [`${Number(value).toFixed(1)}%`, "Enquiry → customer"]} />
        <Bar dataKey="conversion" radius={[6, 6, 0, 0]} maxBarSize={72}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.color ?? (d.conversion < 10 ? CHART_COLORS.red : d.conversion > 30 ? CHART_COLORS.green : CHART_COLORS.amber)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
