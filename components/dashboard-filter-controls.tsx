"use client";

import * as React from "react";
import { Filter, RefreshCcw, Sparkles } from "lucide-react";

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

  const selectedSummary = React.useMemo(() => {
    const allMonths = options.months.map((option) => option.value);
    const monthIsNoFilter =
      applied.months.length === allMonths.length &&
      allMonths.every((month) => applied.months.includes(month));

    return {
      month: monthIsNoFilter ? "Semua Periode" : `${applied.months.length} periode`,
      category: applied.categories.length === 0 ? "Semua Kategori" : `${applied.categories.length} kategori`,
      branch: applied.branches.length === 0 ? "Semua Branch" : `${applied.branches.length} branch`,
    };
  }, [applied, options.months]);

  return (
    <div className="glass-panel content-fade-in rounded-[20px] border border-slate-200 p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-red-700">
              <Filter className="h-4 w-4" />
            </span>
            <span>Global Filter</span>
          </div>
          <div className="max-w-xl text-sm leading-6 font-medium text-slate-500">Refine period, category, dan branch untuk membaca performa merchant lebih cepat.</div>
        </div>
        <div className="pill-accent rounded-full px-3 py-1.5 text-xs font-semibold">
          Latest update: {latestMonth ? getMonthLabel(latestMonth) : "-"}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5 font-semibold">{selectedSummary.month}</span>
        <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5 font-semibold">{selectedSummary.category}</span>
        <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1.5 font-semibold">{selectedSummary.branch}</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-[#e60028] px-4 py-2.5 text-sm font-semibold text-white shadow-sm disabled:opacity-40"
          disabled={!initialized || loading}
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <Sparkles className="h-4 w-4" />
          {isOpen ? "Close Filter" : "Open Filter"}
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          onClick={resetAll}
        >
          <RefreshCcw className="h-4 w-4" />
          Reset
        </button>
      </div>

      {isOpen ? (
        <div className="mt-5 grid gap-4 md:grid-cols-3">
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

          <div className="md:col-span-3">
            <button
              type="button"
              className="rounded-full bg-[#e60028] px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#c70022]"
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
    <div className="rounded-[16px] border border-slate-200 bg-slate-50/70 p-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-slate-600">{title}</div>
        <div className="flex gap-1">
          <button type="button" className="rounded-full px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-white" onClick={onSelectAll}>
            all
          </button>
          <button type="button" className="rounded-full px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-white" onClick={onUnselectAll}>
            none
          </button>
        </div>
      </div>
      <div className="max-h-52 space-y-2 overflow-auto pr-1">
        {options.map((option) => {
          const checked = selected.includes(option.value);
          return (
            <label
              key={option.value}
              className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                checked ? "border-red-200 bg-white text-slate-900 shadow-sm ring-1 ring-red-50" : "border-transparent bg-white/65 text-slate-600 hover:border-slate-200 hover:bg-white"
              }`}
            >
              <input type="checkbox" checked={checked} onChange={() => onToggle(option.value)} className="accent-red-600" />
              <span>{formatLabel ? formatLabel(option.value) : option.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
