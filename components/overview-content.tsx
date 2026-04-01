"use client";

import Link from "next/link";
import * as React from "react";

import { DashboardFilterControls } from "@/components/dashboard-filter-controls";
import { useDashboardFilters } from "@/components/dashboard-filter-provider";
import { KeywordPieChart, MiniLineChart, MonthlyBarChart } from "@/components/simple-charts";
import { Activity, BarChart3, ListChecks, PieChart, Receipt } from "lucide-react";
import { buildFilterSearchParams } from "@/lib/dashboard-filters";

type OverviewResponse = {
  month: string;
  monthLabel: string;
  previousMonthLabel: string;
  myKpi: {
    redeem: number;
    uniqueRedeemer: number;
    burningPoin: number;
    previous: {
      redeem: number;
      uniqueRedeemer: number;
      burningPoin: number;
    };
  };
  monthlyTrend: { month: string; redeem: number; uniqueRedeemer: number; burningPoin: number }[];
  dailyTrend: { date: string; redeem: number; uniqueRedeemer: number; burningPoin: number }[];
  keywordRules: {
    keyword: string;
    startPeriod: string;
    endPeriod: string;
    status: "active" | "upcoming" | "expired";
    daysToEnd: number;
  }[];
  transactions: {
    transactionAt: string;
    keyword: string;
    status: string;
    qty: number;
    pointRedeem: number;
    redeemPointTotal: number;
    msisdn: string;
    category: string;
    branch: string;
  }[];
};

const PAGE_SIZE = 10;

const getPageItems = (page: number, totalPages: number) => {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  if (page <= 4) return [1, 2, 3, 4, 5, "...", totalPages] as const;
  if (page >= totalPages - 3) return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages] as const;
  return [1, "...", page - 1, page, page + 1, "...", totalPages] as const;
};

const fmt = (value: number) => new Intl.NumberFormat("id-ID").format(value);
const pct = (current: number, previous: number) => {
  if (!previous) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};

export function OverviewContent() {
  const { initialized, applied } = useDashboardFilters();
  const monthsKey = React.useMemo(() => applied.months.join(","), [applied.months]);
  const categoriesKey = React.useMemo(() => applied.categories.join(","), [applied.categories]);
  const branchesKey = React.useMemo(() => applied.branches.join(","), [applied.branches]);
  const [data, setData] = React.useState<OverviewResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const load = async () => {
      try {
        setLoading(true);
        const params = buildFilterSearchParams(applied);
        const response = await fetch(`/api/overview?${params.toString()}`, { signal: controller.signal });
        if (!response.ok) {
          throw new Error("Failed to fetch overview");
        }
        const payload = (await response.json()) as OverviewResponse;
        if (active) {
          setData(payload);
          setSearch("");
          setPage(1);
        }
      } catch (error) {
        if (active) console.error(error);
      } finally {
        if (active) setLoading(false);
      }
    };

    if (initialized && applied.months.length) {
      load();
    }

    return () => {
      active = false;
      controller.abort();
    };
  }, [initialized, monthsKey, categoriesKey, branchesKey, applied]);

  const filteredRows = React.useMemo(() => {
    const rows = data?.transactions ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      `${row.keyword} ${row.status} ${row.category} ${row.branch}`.toLowerCase().includes(term)
    );
  }, [data?.transactions, search]);

  const totalPages = React.useMemo(() => Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE)), [filteredRows.length]);

  const pageRows = React.useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page]);
  const dailyInSelectedMonth = React.useMemo(() => {
    const monthKey = data?.month;
    if (!monthKey) return [];

    const [year, month] = monthKey.split("-").map(Number);
    if (!year || !month) return [];

    const daysInMonth = new Date(year, month, 0).getDate();
    const map = new Map((data?.dailyTrend ?? []).map((row) => [row.date, row]));

    return Array.from({ length: daysInMonth }, (_, index) => {
      const day = String(index + 1).padStart(2, "0");
      const date = `${monthKey}-${day}`;
      const existing = map.get(date);
      return {
        date,
        redeem: existing?.redeem ?? 0,
        uniqueRedeemer: existing?.uniqueRedeemer ?? 0,
        burningPoin: existing?.burningPoin ?? 0,
      };
    });
  }, [data?.dailyTrend, data?.month]);
  const keywordCompositionData = React.useMemo(() => {
    const sums = new Map<string, number>();
    for (const row of data?.transactions ?? []) {
      sums.set(row.keyword, (sums.get(row.keyword) ?? 0) + row.redeemPointTotal);
    }
    return Array.from(sums.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [data?.transactions]);

  if (!data) {
    return <div className="px-6 py-6 text-sm text-slate-500">{loading ? "Loading..." : "No data"}</div>;
  }

  const kpis = [
    { label: "My KPI - Redeem", value: data.myKpi.redeem, prev: data.myKpi.previous.redeem },
    { label: "My KPI - Unique Redeemer", value: data.myKpi.uniqueRedeemer, prev: data.myKpi.previous.uniqueRedeemer },
    { label: "My KPI - Burning Poin", value: data.myKpi.burningPoin, prev: data.myKpi.previous.burningPoin },
  ];

  return (
    <div className="space-y-4 px-3 py-3 md:px-5">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xl font-semibold text-slate-900">Overview</div>
          </div>
          <div className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white">Merchant</div>
        </div>
      </div>

      <DashboardFilterControls />

      <div className="grid gap-3 lg:grid-cols-3">
        {kpis.map((item) => {
          const growth = pct(item.value, item.prev);
          const isUp = growth >= 0;
          const lineData =
            item.label === "My KPI - Redeem"
              ? dailyInSelectedMonth.map((d) => ({ label: d.date, value: d.redeem }))
              : item.label === "My KPI - Unique Redeemer"
                ? dailyInSelectedMonth.map((d) => ({ label: d.date, value: d.uniqueRedeemer }))
                : dailyInSelectedMonth.map((d) => ({ label: d.date, value: d.burningPoin }));

          return (
          <div key={item.label} className="relative rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="absolute -top-2 left-4 h-3 w-16 rounded-full bg-slate-200/70 blur-[6px]" />
            <div className="mb-1 flex items-start justify-between gap-2">
              <div className="text-sm font-medium text-slate-500">{item.label}</div>
              <div
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  isUp ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                }`}
              >
                {isUp ? "+" : ""}
                {growth.toFixed(1)}%
              </div>
            </div>
            <div className="text-[34px] font-bold leading-none text-slate-900">{fmt(item.value)}</div>
            <MiniLineChart data={lineData} />
            <div className="mt-1 flex items-center justify-between text-sm font-semibold text-slate-700">
              <span>{data.monthLabel}</span>
              <span>{fmt(item.value)}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>{data.previousMonthLabel}</span>
              <span>{fmt(item.prev)}</span>
            </div>
          </div>
          );
        })}
      </div>

      <div className="grid gap-3 xl:grid-cols-[1.3fr_1fr]">
        <MonthlyBarChart
          monthlyData={data.monthlyTrend.map((row) => ({
            label: row.month,
            redeem: row.redeem,
            uniqueRedeemer: row.uniqueRedeemer,
          }))}
          dailyData={dailyInSelectedMonth.map((row) => ({
            label: row.date,
            redeem: row.redeem,
            uniqueRedeemer: row.uniqueRedeemer,
          }))}
          monthLabel={data.monthLabel}
        />
        <KeywordPieChart
          data={keywordCompositionData}
          title={
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <PieChart className="h-4 w-4 text-slate-500" />
              <span>Keyword Composition</span>
            </div>
          }
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <Activity className="h-4 w-4 text-slate-500" />
              <span>My Trend (Daily)</span>
            </div>
            <Link className="text-xs font-semibold text-blue-600" href="/operational?focus=trend#trend">
              View more
            </Link>
          </div>
          <div className="space-y-2 md:hidden">
            {data.dailyTrend.slice(-10).map((row) => (
              <div key={row.date} className="rounded-lg border border-slate-200 p-3 text-sm">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-semibold text-slate-700">{row.date}</span>
                  <span className="text-xs text-slate-500">Daily</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div>Redeem</div>
                  <div className="text-right font-semibold text-slate-800">{fmt(row.redeem)}</div>
                  <div>Unique Redeemer</div>
                  <div className="text-right font-semibold text-slate-800">{fmt(row.uniqueRedeemer)}</div>
                  <div>Burning Poin</div>
                  <div className="text-right font-semibold text-slate-800">{fmt(row.burningPoin)}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden overflow-auto md:block">
            <table className="w-full min-w-[460px] text-sm">
              <thead className="bg-[#0E1A35] text-white">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Redeem</th>
                  <th className="px-3 py-2 text-left">Unique Redeemer</th>
                  <th className="px-3 py-2 text-left">Burning Poin</th>
                </tr>
              </thead>
              <tbody>
                {data.dailyTrend.slice(-10).map((row) => (
                  <tr key={row.date} className="border-b border-slate-100">
                    <td className="px-3 py-2">{row.date}</td>
                    <td className="px-3 py-2">{fmt(row.redeem)}</td>
                    <td className="px-3 py-2">{fmt(row.uniqueRedeemer)}</td>
                    <td className="px-3 py-2">{fmt(row.burningPoin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <ListChecks className="h-4 w-4 text-slate-500" />
              <span>My Keywords / Rules Status</span>
            </div>
            <Link className="text-xs font-semibold text-blue-600" href="/operational?focus=rules#rules">
              View more
            </Link>
          </div>
          <div className="space-y-2 md:hidden">
            {data.keywordRules.slice(0, 8).map((row) => (
              <div key={`${row.keyword}-${row.endPeriod}`} className="rounded-lg border border-slate-200 p-3 text-sm">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-semibold text-slate-700">{row.keyword}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] capitalize text-slate-600">
                    {row.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div>Start</div>
                  <div className="text-right font-semibold text-slate-800">{row.startPeriod}</div>
                  <div>End</div>
                  <div className="text-right font-semibold text-slate-800">{row.endPeriod}</div>
                  <div>Days Left</div>
                  <div className="text-right font-semibold text-slate-800">{row.status === "expired" ? "-" : row.daysToEnd}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden overflow-auto md:block">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-[#0E1A35] text-white">
                <tr>
                  <th className="px-3 py-2 text-left">Keyword</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Start Period</th>
                  <th className="px-3 py-2 text-left">End Period</th>
                  <th className="px-3 py-2 text-left">Days Left</th>
                </tr>
              </thead>
              <tbody>
                {data.keywordRules.slice(0, 8).map((row) => (
                  <tr key={`${row.keyword}-${row.endPeriod}`} className="border-b border-slate-100">
                    <td className="px-3 py-2">{row.keyword}</td>
                    <td className="px-3 py-2 capitalize">{row.status}</td>
                    <td className="px-3 py-2">{row.startPeriod}</td>
                    <td className="px-3 py-2">{row.endPeriod}</td>
                    <td className="px-3 py-2">{row.status === "expired" ? "-" : row.daysToEnd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" id="transaction-detail">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <Receipt className="h-4 w-4 text-slate-500" />
              <span>My Transaction Detail</span>
            </div>
            <div className="text-xs text-slate-500">Search and paginate merchant transactions</div>
          </div>
          <Link className="text-xs font-semibold text-blue-600" href="/operational?focus=transactions#transactions">
            View more
          </Link>
        </div>

        <input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Search keyword / status / category / branch"
          className="mb-3 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        />

        <div className="space-y-2 md:hidden">
          {pageRows.map((row) => (
            <div
              key={`${row.transactionAt}-${row.msisdn}-${row.keyword}`}
              className="rounded-lg border border-slate-200 p-3 text-sm"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-700">{row.keyword}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{row.status}</span>
              </div>
              <div className="text-xs text-slate-500">{new Date(row.transactionAt).toLocaleString("id-ID")}</div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                <div>Qty</div>
                <div className="text-right font-semibold text-slate-800">{fmt(row.qty)}</div>
                <div>Point</div>
                <div className="text-right font-semibold text-slate-800">{fmt(row.pointRedeem)}</div>
                <div>Total</div>
                <div className="text-right font-semibold text-slate-800">{fmt(row.redeemPointTotal)}</div>
                <div>Category</div>
                <div className="text-right font-semibold text-slate-800">{row.category}</div>
                <div>Branch</div>
                <div className="text-right font-semibold text-slate-800">{row.branch}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden overflow-auto md:block">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-[#0E1A35] text-white">
              <tr>
                <th className="px-3 py-2 text-left">Time</th>
                <th className="px-3 py-2 text-left">Keyword</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Qty</th>
                <th className="px-3 py-2 text-left">Point</th>
                <th className="px-3 py-2 text-left">Total</th>
                <th className="px-3 py-2 text-left">Category</th>
                <th className="px-3 py-2 text-left">Branch</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => (
                <tr key={`${row.transactionAt}-${row.msisdn}-${row.keyword}`} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-3 py-2">{new Date(row.transactionAt).toLocaleString("id-ID")}</td>
                  <td className="px-3 py-2">{row.keyword}</td>
                  <td className="px-3 py-2">{row.status}</td>
                  <td className="px-3 py-2">{fmt(row.qty)}</td>
                  <td className="px-3 py-2">{fmt(row.pointRedeem)}</td>
                  <td className="px-3 py-2">{fmt(row.redeemPointTotal)}</td>
                  <td className="px-3 py-2">{row.category}</td>
                  <td className="px-3 py-2">{row.branch}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>Showing {pageRows.length} of {filteredRows.length}</span>
          <div className="flex items-center gap-1">
            {getPageItems(page, totalPages).map((item, index) =>
              item === "..." ? (
                <span key={`ellipsis-${index}`} className="px-2 py-1">...</span>
              ) : (
                <button
                  key={item}
                  type="button"
                  className={`rounded border px-2 py-1 ${item === page ? "border-[#0E1A35] bg-[#0E1A35] text-white" : "border-slate-300 hover:bg-slate-100"}`}
                  onClick={() => setPage(item)}
                >
                  {item}
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
