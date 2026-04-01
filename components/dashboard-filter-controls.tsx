"use client";

import * as React from "react";

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
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-slate-500">Global Filter</div>
        <div className="text-xs text-slate-500">Latest update: {latestMonth ? getMonthLabel(latestMonth) : "-"}</div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1">{selectedSummary.month}</span>
        <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1">{selectedSummary.category}</span>
        <span className="rounded-full border border-slate-300 bg-slate-50 px-3 py-1">{selectedSummary.branch}</span>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded-md bg-[#0E1A35] px-3 py-2 text-sm text-white disabled:opacity-40"
          disabled={!initialized || loading}
          onClick={() => setIsOpen((prev) => !prev)}
        >
          {isOpen ? "Close Filter" : "Open Filter"}
        </button>
        <button type="button" className="rounded-md border px-3 py-2 text-sm" onClick={resetAll}>
          Reset
        </button>
      </div>

      {isOpen ? (
        <div className="mt-4 grid gap-4 md:grid-cols-3">
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
              className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
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
    <div className="rounded-lg border border-slate-200 p-2">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs font-semibold text-slate-600">{title}</div>
        <div className="flex gap-1">
          <button type="button" className="text-[11px] text-blue-700" onClick={onSelectAll}>
            all
          </button>
          <button type="button" className="text-[11px] text-blue-700" onClick={onUnselectAll}>
            none
          </button>
        </div>
      </div>
      <div className="max-h-52 space-y-2 overflow-auto">
        {options.map((option) => {
          const checked = selected.includes(option.value);
          return (
            <label key={option.value} className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={checked} onChange={() => onToggle(option.value)} />
              <span>{formatLabel ? formatLabel(option.value) : option.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
