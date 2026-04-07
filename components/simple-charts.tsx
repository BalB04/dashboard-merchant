"use client";

import * as React from "react";
import { BarChart3 } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type SeriesPoint = {
  label: string;
  value: number;
};

const numberFmt = new Intl.NumberFormat("id-ID");

const tooltipStyle = {
  border: "1px solid var(--chart-tooltip-border)",
  borderRadius: 16,
  fontSize: 12,
  background: "var(--chart-tooltip-bg)",
  color: "var(--text)",
  boxShadow: "0 14px 32px rgba(2, 6, 23, 0.24)",
};

export function MiniLineChart({
  data,
  stroke = "#ff8a00",
  fill = "rgba(255, 138, 0, 0.24)",
}: {
  data: SeriesPoint[];
  stroke?: string;
  fill?: string;
}) {
  const safeData = data.length ? data : [{ label: "-", value: 0 }];

  return (
    <div className="mt-2 h-[92px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={safeData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="miniLineFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={fill} stopOpacity={0.75} />
              <stop offset="95%" stopColor={fill} stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <Tooltip
            cursor={{ stroke: "var(--chart-grid)", strokeDasharray: "4 4" }}
            contentStyle={{ ...tooltipStyle, fontSize: 11 }}
            formatter={(value: number) => [numberFmt.format(value), "Value"]}
            labelFormatter={(label: string) => label}
          />
          <Area type="monotone" dataKey="value" stroke={stroke} fill="url(#miniLineFill)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MonthlyBarChart({
  monthlyData,
  dailyData,
  monthLabel,
}: {
  monthlyData: { label: string; redeem: number; uniqueRedeemer: number }[];
  dailyData: { label: string; redeem: number; uniqueRedeemer: number }[];
  monthLabel: string;
}) {
  const latestYear = monthlyData
    .map((d) => Number(d.label.slice(0, 4)))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => b - a)[0];
  const year = latestYear || new Date().getFullYear();
  const [mode, setMode] = React.useState<"monthly" | "daily">("monthly");

  const monthKeys = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  const monthShort = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const monthlyMap = new Map(monthlyData.map((d) => [d.label, d]));
  const normalizedMonthly = monthKeys.map((key, i) => ({
    label: monthShort[i],
    full: key,
    redeem: monthlyMap.get(key)?.redeem ?? 0,
    uniqueRedeemer: monthlyMap.get(key)?.uniqueRedeemer ?? 0,
  }));
  const normalizedDaily = dailyData.map((d) => ({
    label: d.label.slice(-2),
    full: d.label,
    redeem: d.redeem,
    uniqueRedeemer: d.uniqueRedeemer,
  }));
  const chartData = mode === "monthly" ? normalizedMonthly : normalizedDaily;
  const totalRedeem = chartData.reduce((s, x) => s + x.redeem, 0);
  const totalUnique = chartData.reduce((s, x) => s + x.uniqueRedeemer, 0);
  const subLabel = mode === "monthly" ? String(year) : monthLabel;

  return (
    <div className="glass-panel content-fade-in rounded-[28px] border border-slate-200 p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-rose-50 text-red-700">
              <BarChart3 className="h-4 w-4" />
            </span>
            <span>Merchant Analytics</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">{subLabel}</div>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-slate-100 p-1 text-[11px]">
          <button
            type="button"
            className={`rounded-full px-3 py-1 font-medium transition ${mode === "monthly" ? "bg-white text-slate-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            onClick={() => setMode("monthly")}
          >
            Monthly
          </button>
          <button
            type="button"
            className={`rounded-full px-3 py-1 font-medium transition ${mode === "daily" ? "bg-white text-slate-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            onClick={() => setMode("daily")}
          >
            Daily
          </button>
        </div>
      </div>
      <div className="mb-4 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Redeem</div>
          <div className="mt-1 text-[30px] font-bold leading-none text-slate-900">
            {numberFmt.format(totalRedeem)}
          </div>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Unique Redeem</div>
          <div className="mt-1 text-[30px] font-bold leading-none text-slate-900">
            {numberFmt.format(totalUnique)}
          </div>
        </div>
      </div>
      <div className="mb-2 flex items-center gap-4 text-[11px]">
        <div className="flex items-center gap-1.5 text-slate-600">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#e60028]" />
          Redeem
        </div>
        <div className="flex items-center gap-1.5 text-slate-600">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#ffb000]" />
          Unique Redeem
        </div>
      </div>
      <div className="h-[210px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--chart-axis)" }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip
              cursor={{ fill: "var(--chart-cursor)" }}
              contentStyle={tooltipStyle}
              formatter={(value: number, name: string) => [numberFmt.format(value), name]}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.full ?? ""}
            />
            <Legend content={() => null} />
            <Bar dataKey="redeem" stackId="a" radius={[0, 0, 0, 0]} fill="#e60028" name="Redeem" />
            <Bar dataKey="uniqueRedeemer" stackId="a" radius={[6, 6, 0, 0]} fill="#ffb000" name="Unique Redeem" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function KeywordPieChart({
  data,
  title,
}: {
  data: SeriesPoint[];
  title?: React.ReactNode;
}) {
  const safeRaw = data.length ? data : [{ label: "No Keyword", value: 1 }];
  const safe = safeRaw.slice(0, 6).map((item) => ({ ...item, value: Math.max(0, item.value) }));

  const colors = ["#8f1026", "#b0142a", "#d61c32", "#f23d4d", "#ff8a00", "#ffbe18"];

  return (
    <div className="glass-panel content-fade-in rounded-[28px] border border-slate-200 p-5 shadow-sm">
      <div className="mb-2 text-sm font-semibold text-slate-900">{title ?? "Keyword Composition"}</div>
      <div className="h-[210px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value: number) => [numberFmt.format(value), "Share"]}
            />
            <Pie
              data={safe}
              dataKey="value"
              nameKey="label"
              cx="40%"
              cy="50%"
              innerRadius={40}
              outerRadius={74}
              paddingAngle={1.2}
              labelLine={false}
              label={({ percent }) => `${((percent ?? 0) * 100).toFixed(0)}%`}
            >
              {safe.map((entry, colorIndex) => (
                <Cell key={entry.label} fill={colors[colorIndex % colors.length]} />
              ))}
            </Pie>
            <Legend
              layout="vertical"
              align="right"
              verticalAlign="middle"
              wrapperStyle={{ fontSize: 11, right: 0 }}
              formatter={(value) => <span className="text-slate-700">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
