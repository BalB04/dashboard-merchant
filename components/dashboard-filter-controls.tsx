"use client";

import * as React from "react";
import { Filter, RefreshCcw, SlidersHorizontal } from "lucide-react";

import { useDashboardFilters } from "@/components/dashboard-filter-provider";

const toggleValue = (current: string[], value: string) =>
  current.includes(value) ? current.filter((item) => item !== value) : [...current, value];

const getMonthLabel = (month: string) => {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
};

export function DashboardFilterControls() {
  const { initialized, loading, options, applied, draft, latestMonth, setDraft, applyDraft, resetAll } =
    useDashboardFilters();

  const [isOpen, setIsOpen] = React.useState(false);
  const hasKeywordFilter = options.keywords.length > 1;

  const selectedSummary = React.useMemo(() => {
    const allMonths = options.months.map((option) => option.value);
    const monthIsNoFilter =
      applied.months.length === allMonths.length &&
      allMonths.every((month) => applied.months.includes(month));

    return {
      month: monthIsNoFilter ? "Semua Periode" : `${applied.months.length} periode`,
      category: applied.categories.length === 0 ? "Semua Kategori" : `${applied.categories.length} kategori`,
      branch: applied.branches.length === 0 ? "Semua Branch" : `${applied.branches.length} branch`,
      keyword: applied.keywords.length === 0 ? "Semua Keyword" : `${applied.keywords.length} keyword`,
    };
  }, [applied, options.months]);

  return (
    <div className="glass-panel content-fade-in rounded-[12px] border border-slate-200 px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-red-600">
            <Filter className="h-4 w-4" />
          </span>
          <div>
            <div className="whitespace-nowrap text-base font-bold text-slate-900">Global Filter</div>
            <div className="text-[11px] font-medium text-slate-500">Filter data merchant aktif</div>
          </div>
        </div>

        <div className="ml-auto whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.08em] text-red-600">
          Latest update: {latestMonth ? getMonthLabel(latestMonth) : "-"}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-[#e60028] bg-[#e60028] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#c70022] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 disabled:opacity-40"
            disabled={!initialized || loading}
            onClick={() => setIsOpen((prev) => !prev)}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {isOpen ? "Close Filter" : "Open Filter"}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200"
            onClick={resetAll}
          >
            <RefreshCcw className="h-4 w-4" />
            Reset
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 shadow-sm">{selectedSummary.month}</span>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 shadow-sm">{selectedSummary.category}</span>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 shadow-sm">{selectedSummary.branch}</span>
        {hasKeywordFilter ? (
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 shadow-sm">{selectedSummary.keyword}</span>
        ) : null}
      </div>

      {isOpen ? (
        <div className="mt-4 border-t border-slate-200 pt-4">
          <div className={`grid items-start gap-3 ${hasKeywordFilter ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
            <FilterColumn
              title="Periode"
              options={options.months}
              selected={draft.months}
              formatLabel={(value) => getMonthLabel(value)}
              onSelectAll={() => setDraft({ months: options.months.map((option) => option.value) })}
              onUnselectAll={() => setDraft({ months: [] })}
              onToggle={(value) => setDraft({ months: toggleValue(draft.months, value) })}
            />

            <FilterColumn
              title="Category"
              options={options.categories}
              selected={draft.categories}
              onSelectAll={() => setDraft({ categories: options.categories.map((option) => option.value) })}
              onUnselectAll={() => setDraft({ categories: [] })}
              onToggle={(value) => setDraft({ categories: toggleValue(draft.categories, value) })}
            />

            <FilterColumn
              title="Branch"
              options={options.branches}
              selected={draft.branches}
              onSelectAll={() => setDraft({ branches: options.branches.map((option) => option.value) })}
              onUnselectAll={() => setDraft({ branches: [] })}
              onToggle={(value) => setDraft({ branches: toggleValue(draft.branches, value) })}
            />

            {hasKeywordFilter ? (
              <FilterColumn
                title="Keyword"
                options={options.keywords}
                selected={draft.keywords}
                onSelectAll={() => setDraft({ keywords: options.keywords.map((option) => option.value) })}
                onUnselectAll={() => setDraft({ keywords: [] })}
                onToggle={(value) => setDraft({ keywords: toggleValue(draft.keywords, value) })}
              />
            ) : null}
          </div>

          <div className="mt-4 flex items-center justify-end">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md bg-[#e60028] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#c70022] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200"
              onClick={() => {
                applyDraft();
                setIsOpen(false);
              }}
            >
              Apply Filter
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type FilterColumnProps = {
  title: string;
  options: { value: string; label: string }[];
  selected: string[];
  onSelectAll: () => void;
  onUnselectAll: () => void;
  onToggle: (value: string) => void;
  formatLabel?: (value: string) => string;
};

function FilterColumn({
  title,
  options,
  selected,
  onSelectAll,
  onUnselectAll,
  onToggle,
  formatLabel,
}: FilterColumnProps) {
  return (
    <div className="h-fit rounded-[10px] border border-slate-200 bg-white/65 p-3 shadow-[0_8px_20px_rgba(15,23,42,0.03)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-600">{title}</div>
        <div className="flex gap-1">
          <button type="button" className="rounded-md px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-rose-50" onClick={onSelectAll}>
            all
          </button>
          <button type="button" className="rounded-md px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-rose-50" onClick={onUnselectAll}>
            none
          </button>
        </div>
      </div>
      <div className="max-h-44 space-y-1 overflow-y-scroll pr-1 [scrollbar-gutter:stable] [scrollbar-color:#94a3b8_#f1f5f9] [scrollbar-width:auto] [&::-webkit-scrollbar]:block [&::-webkit-scrollbar]:w-3 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-slate-100 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-400 [&::-webkit-scrollbar-thumb:hover]:bg-slate-500">
        {options.map((option) => {
          const checked = selected.includes(option.value);
          return (
            <label
              key={option.value}
              className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${
                checked ? "border-red-200 bg-rose-50 text-slate-900 shadow-sm ring-1 ring-red-50" : "border-transparent bg-slate-50/60 text-slate-600 hover:border-slate-200 hover:bg-white"
              }`}
            >
              <input type="checkbox" checked={checked} onChange={() => onToggle(option.value)} className="h-3.5 w-3.5 accent-red-600" />
              <span className="min-w-0 truncate font-semibold">{formatLabel ? formatLabel(option.value) : option.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
