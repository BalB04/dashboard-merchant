"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";

import { DashboardFilterControls } from "@/components/dashboard-filter-controls";
import { useDashboardFilters } from "@/components/dashboard-filter-provider";
import { buildFilterSearchParams } from "@/lib/dashboard-filters";

type OperationalResponse = {
  monthLabel: string;
  transactionStatus: { success: number; failed: number };
  keywordSummary: { keyword: string; totalRedeem: number; uniqueRedeemer: number; burningPoin: number }[];
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

const PAGE_SIZE = 12;
const fmt = (value: number) => new Intl.NumberFormat("id-ID").format(value);

const focusTargets = new Set(["trend", "rules", "transactions"]);

const getPageItems = (page: number, totalPages: number) => {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  if (page <= 4) return [1, 2, 3, 4, 5, "...", totalPages] as const;
  if (page >= totalPages - 3) return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages] as const;
  return [1, "...", page - 1, page, page + 1, "...", totalPages] as const;
};

export function OperationalContent() {
  const { initialized, applied } = useDashboardFilters();
  const monthsKey = React.useMemo(() => applied.months.join(","), [applied.months]);
  const categoriesKey = React.useMemo(() => applied.categories.join(","), [applied.categories]);
  const branchesKey = React.useMemo(() => applied.branches.join(","), [applied.branches]);
  const searchParams = useSearchParams();

  const [data, setData] = React.useState<OperationalResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [highlightedSection, setHighlightedSection] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const load = async () => {
      try {
        setLoading(true);
        const params = buildFilterSearchParams(applied);
        const response = await fetch(`/api/operational?${params.toString()}`, { signal: controller.signal });
        if (!response.ok) {
          throw new Error("Failed to fetch operational");
        }

        const payload = (await response.json()) as OperationalResponse;
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

  React.useEffect(() => {
    if (!data) return;
    const focus = searchParams.get("focus") ?? (typeof window !== "undefined" ? window.location.hash.replace("#", "") : null);
    if (!focus || !focusTargets.has(focus)) return;

    const target = document.getElementById(focus);
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "start" });
    setHighlightedSection(focus);
  }, [data, searchParams]);

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

  if (!data) {
    return <div className="px-6 py-6 text-sm text-slate-500">{loading ? "Loading..." : "No data"}</div>;
  }

  return (
    <div className="space-y-4 px-3 py-3 md:px-5">
      
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="text-xl font-semibold text-slate-900">Operational</div>
          <div className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-semibold text-white">Merchant</div>
        </div>
      </div>

      <DashboardFilterControls />

      <div id="trend" className={`rounded-xl border bg-white p-4 shadow-sm ${highlightedSection === "trend" ? "border-blue-500" : "border-slate-200"}`}>
        <div className="mb-2 font-semibold">My Transaction Status</div>
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-xs text-slate-500">Success</div>
            <div className="text-2xl font-bold">{fmt(data.transactionStatus.success)}</div>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <div className="text-xs text-slate-500">Failed</div>
            <div className="text-2xl font-bold">{fmt(data.transactionStatus.failed)}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">

        <div id="rules" className={`rounded-xl border bg-white p-4 shadow-sm ${highlightedSection === "rules" ? "border-blue-500" : "border-slate-200"}`}>
          <div className="mb-2 font-semibold">My Keywords / Rules Status</div>
        <div className="space-y-2 md:hidden">
          {data.keywordRules.map((row) => (
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
                <div>Days</div>
                <div className="text-right font-semibold text-slate-800">{row.daysToEnd}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden overflow-auto md:block">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-[#0E1A35] text-white">
              <tr>
                <th className="px-3 py-2 text-left">Keyword</th>
                <th className="px-3 py-2 text-left">Start</th>
                  <th className="px-3 py-2 text-left">End</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Days</th>
                </tr>
              </thead>
              <tbody>
                {data.keywordRules.map((row) => (
                  <tr key={`${row.keyword}-${row.endPeriod}`} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2">{row.keyword}</td>
                    <td className="px-3 py-2">{row.startPeriod}</td>
                    <td className="px-3 py-2">{row.endPeriod}</td>
                    <td className="px-3 py-2 capitalize">{row.status}</td>
                    <td className="px-3 py-2">{row.daysToEnd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>


        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-2 font-semibold">My Keyword Performance</div>
        <div className="space-y-2 md:hidden">
          {data.keywordSummary.map((row) => (
            <div key={row.keyword} className="rounded-lg border border-slate-200 p-3 text-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-semibold text-slate-700">{row.keyword}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                <div>Redeem</div>
                <div className="text-right font-semibold text-slate-800">{fmt(row.totalRedeem)}</div>
                <div>Unique</div>
                <div className="text-right font-semibold text-slate-800">{fmt(row.uniqueRedeemer)}</div>
                <div>Burning</div>
                <div className="text-right font-semibold text-slate-800">{fmt(row.burningPoin)}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="hidden overflow-auto md:block">
          <table className="w-full min-w-[700px] text-sm">
            <thead className="bg-[#0E1A35] text-white">
              <tr>
                <th className="px-3 py-2 text-left">Keyword</th>
                <th className="px-3 py-2 text-left">Redeem</th>
                  <th className="px-3 py-2 text-left">Unique Redeemer</th>
                  <th className="px-3 py-2 text-left">Burning Poin</th>
                </tr>
              </thead>
              <tbody>
                {data.keywordSummary.map((row) => (
                  <tr key={row.keyword} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2">{row.keyword}</td>
                    <td className="px-3 py-2">{fmt(row.totalRedeem)}</td>
                    <td className="px-3 py-2">{fmt(row.uniqueRedeemer)}</td>
                    <td className="px-3 py-2">{fmt(row.burningPoin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      

      <div id="transactions" className={`rounded-xl border bg-white p-4 shadow-sm ${highlightedSection === "transactions" ? "border-blue-500" : "border-slate-200"}`}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="font-semibold">My Transaction Detail</div>
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search"
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm md:max-w-[280px]"
          />
        </div>

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
