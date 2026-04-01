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

export function MiniLineChart({
  data,
  stroke = "#fb923c",
  fill = "rgba(251, 146, 60, 0.18)",
}: {
  data: SeriesPoint[];
  stroke?: string;
  fill?: string;
}) {
  const safeData = data.length ? data : [{ label: "-", value: 0 }];

  return (
    <div className="mt-1 h-[92px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={safeData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="miniLineFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={fill} stopOpacity={0.75} />
              <stop offset="95%" stopColor={fill} stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <Tooltip
            cursor={{ stroke: "#cbd5e1", strokeDasharray: "4 4" }}
            contentStyle={{ border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 11 }}
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
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <BarChart3 className="h-4 w-4 text-slate-500" />
            <span>Merchant Analytics</span>
          </div>
          <div className="text-xs text-slate-500">{subLabel}</div>
        </div>
        <div className="flex items-center gap-1 rounded-md bg-slate-100 p-1 text-[11px]">
          <button
            type="button"
            className={`rounded px-2 py-0.5 font-medium ${mode === "monthly" ? "bg-white text-slate-700" : "text-slate-500"}`}
            onClick={() => setMode("monthly")}
          >
            Monthly
          </button>
          <button
            type="button"
            className={`rounded px-2 py-0.5 font-medium ${mode === "daily" ? "bg-white text-slate-700" : "text-slate-500"}`}
            onClick={() => setMode("daily")}
          >
            Daily
          </button>
        </div>
      </div>
      <div className="mb-3 flex items-end gap-8 border-t border-slate-100 pt-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Redeem</div>
          <div className="text-[30px] font-bold leading-none text-slate-900">
            {numberFmt.format(totalRedeem)}
          </div>
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Unique Redeem</div>
          <div className="text-[30px] font-bold leading-none text-slate-900">
            {numberFmt.format(totalUnique)}
          </div>
        </div>
      </div>
      <div className="mb-2 flex items-center gap-4 text-[11px]">
        <div className="flex items-center gap-1.5 text-slate-600">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#f43f5e]" />
          Redeem
        </div>
        <div className="flex items-center gap-1.5 text-slate-600">
          <span className="h-2.5 w-2.5 rounded-sm bg-[#facc15]" />
          Unique Redeem
        </div>
      </div>
      <div className="h-[210px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip
              cursor={{ fill: "rgba(148,163,184,0.12)" }}
              contentStyle={{ border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12 }}
              formatter={(value: number, name: string) => [numberFmt.format(value), name]}
              labelFormatter={(_, payload) => payload?.[0]?.payload?.full ?? ""}
            />
            <Legend content={() => null} />
            <Bar dataKey="redeem" stackId="a" radius={[0, 0, 0, 0]} fill="#f43f5e" name="Redeem" />
            <Bar dataKey="uniqueRedeemer" stackId="a" radius={[3, 3, 0, 0]} fill="#facc15" name="Unique Redeem" />
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

  const colors = ["#ef4444", "#f97316", "#eab308", "#14b8a6", "#3b82f6", "#8b5cf6"];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 text-sm font-semibold text-slate-900">{title ?? "Keyword Composition"}</div>
      <div className="h-[210px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              contentStyle={{ border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12 }}
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
              {safe.map((entry, index) => (
                <Cell key={`${entry.label}-${index}`} fill={colors[index % colors.length]} />
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
