"use client";

import Link from "next/link";
import * as React from "react";

import { DashboardFilterControls } from "@/components/dashboard-filter-controls";
import { useDashboardFilters } from "@/components/dashboard-filter-provider";
import { KeywordPieChart, MiniLineChart, MonthlyBarChart } from "@/components/simple-charts";
import { Activity, ListChecks, PieChart, Receipt, Search } from "lucide-react";
import { buildFilterSearchParams } from "@/lib/dashboard-filters";

type OverviewResponse = {
  month: string;
  monthLabel: string;
  previousMonthLabel: string;
  merchant: {
    merchantKey: string;
    email: string;
    merchantNames: string[];
    uniqMerchants: string[];
    keywords: string[];
  };
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
    redeemPointTotal: number;
    msisdn: string;
    branch: string;
  }[];
};

const PAGE_SIZE = 10;

const getPageItems = (page: number, totalPages: number) => {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  if (page <= 4) return [1, 2, 3, 4, 5, "...", totalPages] as const;
  if (page >= totalPages - 3)
    return [
      1,
      "...",
      totalPages - 4,
      totalPages - 3,
      totalPages - 2,
      totalPages - 1,
      totalPages,
    ] as const;
  return [1, "...", page - 1, page, page + 1, "...", totalPages] as const;
};

const fmt = (value: number) => new Intl.NumberFormat("id-ID").format(value);
const pct = (current: number, previous: number) => {
  if (!previous) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
};
const formatList = (items: string[], fallback: string) => {
  if (!items.length) return fallback;
  if (items.length <= 2) return items.join(", ");
  return `${items.slice(0, 2).join(", ")} +${items.length - 2} lainnya`;
};
const getStatusTone = (status: string) => {
  switch (status.toLowerCase()) {
    case "active":
    case "success":
      return "bg-emerald-100 text-emerald-700";
    case "upcoming":
    case "pending":
      return "bg-amber-100 text-amber-700";
    case "expired":
    case "failed":
      return "bg-rose-100 text-rose-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
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
        const response = await fetch(`/api/overview?${params.toString()}`, {
          signal: controller.signal,
        });
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
    return rows.filter((row) => `${row.keyword} ${row.status} ${row.branch}`.toLowerCase().includes(term));
  }, [data?.transactions, search]);

  const totalPages = React.useMemo(
    () => Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE)),
    [filteredRows.length],
  );

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
    return (
      <div className="px-6 py-6 text-sm text-slate-500">{loading ? "Loading..." : "No data"}</div>
    );
  }

  const kpis = [
    { label: "Total Transaksi", value: data.myKpi.redeem, prev: data.myKpi.previous.redeem },
    {
      label: "Unique Redeemer",
      value: data.myKpi.uniqueRedeemer,
      prev: data.myKpi.previous.uniqueRedeemer,
    },
    { label: "Burning Poin", value: data.myKpi.burningPoin, prev: data.myKpi.previous.burningPoin },
  ];
  const merchantTitle =
    data.merchant.merchantNames[0] ?? data.merchant.uniqMerchants[0] ?? "Merchant";
  const merchantAlt =
    data.merchant.uniqMerchants[0] && data.merchant.uniqMerchants[0] !== merchantTitle
      ? data.merchant.uniqMerchants[0]
      : "";
  const keywordText = formatList(data.merchant.keywords, "");
  const merchantSecondaryMeta = [merchantAlt, formatList(data.merchant.merchantNames.slice(1), "")]
    .filter(Boolean)
    .join(" / ");

  return (
    <div className="space-y-4 px-3 py-3 md:px-5">
      <div className="content-fade-in my-6 flex flex-col gap-4 xl:my-8 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-[720px]">
          <div className="text-sm font-medium text-slate-500">Ringkasan bulan</div>
          <div className="section-heading mt-2 text-[1.85rem] font-semibold leading-[1.08] text-slate-900 sm:text-[2rem] md:text-[2.4rem]">
            {merchantTitle}.
          </div>
          {merchantSecondaryMeta ? (
            <div className="mt-2 text-[13px] font-medium tracking-[0.02em] text-slate-400 sm:text-sm">
              {merchantSecondaryMeta}
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[14px] leading-6 text-slate-600 sm:gap-x-3 sm:gap-y-1.5 sm:text-[15px] sm:leading-7">
            {keywordText ? (
              <span className="inline-flex max-w-full items-center font-mono text-[12.5px] tracking-[0.04em] text-slate-500 sm:text-[14px]">
                {keywordText}
              </span>
            ) : null}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[520px]">
          <div className="glass-panel rounded-[20px] border border-slate-200 p-4 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              Current Month
            </div>
            <div className="mt-2 text-[1.75rem] font-semibold leading-none text-slate-900">
              {data.monthLabel}
            </div>
          </div>
          <div className="glass-panel rounded-[20px] border border-slate-200 p-4 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              Transactions
            </div>
            <div className="mt-2 text-[1.75rem] font-semibold leading-none text-slate-900">
              {fmt(data.transactions.length)}
            </div>
          </div>
          <div className="glass-panel rounded-[20px] border border-slate-200 p-4 shadow-sm">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              Active Merchant
            </div>
            <div className="mt-2 text-[1.75rem] font-semibold leading-none text-slate-900">
              {fmt(data.keywordRules.filter((row) => row.status === "active").length)}
            </div>
          </div>
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
            <div
              key={item.label}
              className="glass-panel content-fade-in rounded-[20px] border border-slate-200 p-5 shadow-sm"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    {item.label}
                  </div>
                  <div className="mt-3 text-[34px] font-bold leading-none text-slate-900">
                    {fmt(item.value)}
                  </div>
                </div>
                <div
                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${isUp ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}
                >
                  {isUp ? "+" : ""}
                  {growth.toFixed(1)}%
                </div>
              </div>
              <MiniLineChart data={lineData} />
              <div className="mt-3 flex items-center justify-between text-base font-semibold text-slate-700">
                <span>{data.monthLabel}</span>
                <span>{fmt(item.value)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs font-medium text-slate-500">
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
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-rose-50 text-red-700">
                <PieChart className="h-4 w-4" />
              </span>
              <span>Keyword Composition</span>
            </div>
          }
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <div className="glass-panel content-fade-in rounded-[20px] border border-slate-200 p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-rose-50 text-red-700">
                <Activity className="h-4 w-4" />
              </span>
              <span>My Trend (Daily)</span>
            </div>
            <Link
              className="text-xs font-semibold text-blue-600"
              href="/operational?focus=trend#trend"
            >
              View more
            </Link>
          </div>
          <div className="space-y-2 md:hidden">
            {data.dailyTrend.slice(-10).map((row) => (
              <div
                key={row.date}
                className="rounded-[16px] border border-slate-200 bg-slate-50/60 p-3 text-sm"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-semibold text-slate-700">{row.date}</span>
                  <span className="text-xs text-slate-500">Daily</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div>Redeem</div>
                  <div className="text-right font-semibold text-slate-800">{fmt(row.redeem)}</div>
                  <div>Unique Redeemer</div>
                  <div className="text-right font-semibold text-slate-800">
                    {fmt(row.uniqueRedeemer)}
                  </div>
                  <div>Burning Poin</div>
                  <div className="text-right font-semibold text-slate-800">
                    {fmt(row.burningPoin)}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden overflow-auto md:block">
            <table className="data-table w-full min-w-[460px] text-sm">
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

        <div className="glass-panel content-fade-in rounded-[20px] border border-slate-200 p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-rose-50 text-red-700">
                <ListChecks className="h-4 w-4" />
              </span>
              <span>My Keywords / Rules Status</span>
            </div>
            <Link
              className="text-xs font-semibold text-blue-600"
              href="/operational?focus=rules#rules"
            >
              View more
            </Link>
          </div>
          <div className="space-y-2 md:hidden">
            {data.keywordRules.slice(0, 8).map((row) => (
              <div
                key={`${row.keyword}-${row.endPeriod}`}
                className="rounded-[16px] border border-slate-200 bg-slate-50/60 p-3 text-sm"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-semibold text-slate-700">{row.keyword}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] capitalize ${getStatusTone(row.status)}`}
                  >
                    {row.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div>Start</div>
                  <div className="text-right font-semibold text-slate-800">{row.startPeriod}</div>
                  <div>End</div>
                  <div className="text-right font-semibold text-slate-800">{row.endPeriod}</div>
                  <div>Days Left</div>
                  <div className="text-right font-semibold text-slate-800">
                    {row.status === "expired" ? "-" : row.daysToEnd}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="hidden overflow-auto md:block">
            <table className="data-table w-full min-w-[520px] text-sm">
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
                    <td className="px-3 py-2 capitalize">
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] ${getStatusTone(row.status)}`}
                      >
                        {row.status}
                      </span>
                    </td>
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

      <div
        className="glass-panel content-fade-in rounded-[20px] border border-slate-200 p-5 shadow-sm"
        id="transaction-detail"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-rose-50 text-red-700">
                <Receipt className="h-4 w-4" />
              </span>
              <span>My Transaction Detail</span>
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Search and paginate merchant transactions
            </div>
          </div>
          <Link
            className="text-xs font-semibold text-blue-600"
            href="/operational?focus=transactions#transactions"
          >
            View more
          </Link>
        </div>

        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search keyword / status / branch"
            className="soft-input w-full rounded-full py-3 pl-11 pr-4 text-sm"
          />
        </div>

        <div className="space-y-2 md:hidden">
          {pageRows.map((row) => (
            <div
              key={`${row.transactionAt}-${row.msisdn}-${row.keyword}`}
              className="rounded-[16px] border border-slate-200 bg-slate-50/60 p-3 text-sm"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-700">{row.keyword}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] ${getStatusTone(row.status)}`}
                >
                  {row.status}
                </span>
              </div>
              <div className="text-xs text-slate-500">
                {new Date(row.transactionAt).toLocaleString("id-ID")}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                <div>Qty</div>
                <div className="text-right font-semibold text-slate-800">{fmt(row.qty)}</div>
                <div>Total</div>
                <div className="text-right font-semibold text-slate-800">
                  {fmt(row.redeemPointTotal)}
                </div>
                <div>Branch</div>
                <div className="text-right font-semibold text-slate-800">{row.branch}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden overflow-auto md:block">
          <table className="data-table w-full min-w-[860px] text-sm">
            <thead className="bg-[#0E1A35] text-white">
              <tr>
                <th className="px-3 py-2 text-left">Time</th>
                <th className="px-3 py-2 text-left">Keyword</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Qty</th>
                <th className="px-3 py-2 text-left">Total</th>
                <th className="px-3 py-2 text-left">Branch</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => (
                <tr
                  key={`${row.transactionAt}-${row.msisdn}-${row.keyword}`}
                  className="border-b border-slate-100"
                >
                  <td className="px-3 py-2">
                    {new Date(row.transactionAt).toLocaleString("id-ID")}
                  </td>
                  <td className="px-3 py-2">{row.keyword}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-1 text-[11px] ${getStatusTone(row.status)}`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">{fmt(row.qty)}</td>
                  <td className="px-3 py-2">{fmt(row.redeemPointTotal)}</td>
                  <td className="px-3 py-2">{row.branch}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing {pageRows.length} of {filteredRows.length}
          </span>
          <div className="flex items-center gap-1">
            {getPageItems(page, totalPages).map((item, itemIndex) =>
              item === "..." ? (
                <span
                  key={itemIndex === 1 ? "ellipsis-start" : "ellipsis-end"}
                  className="px-2 py-1"
                >
                  ...
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  className={`rounded-full border px-3 py-1.5 font-medium transition ${item === page ? "border-[#0E1A35] bg-[#0E1A35] text-white" : "border-slate-300 hover:bg-slate-100"}`}
                  onClick={() => setPage(item)}
                >
                  {item}
                </button>
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
