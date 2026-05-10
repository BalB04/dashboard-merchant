"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

import { useBindGlobalLoading } from "@/components/global-loading-provider";
import type {
  DashboardFilterOptions,
  DashboardFilterSelection,
  MerchantIdentity,
} from "@/lib/merchant-dashboard/types";

type DashboardFilterContextValue = {
  initialized: boolean;
  loading: boolean;
  identity: MerchantIdentity | null;
  options: DashboardFilterOptions;
  applied: DashboardFilterSelection;
  draft: DashboardFilterSelection;
  latestMonth: string;
  setDraft: (next: Partial<DashboardFilterSelection>) => void;
  applyDraft: () => void;
  resetAll: () => void;
};

const STORAGE_KEY = "merchant_dashboard_filters_v1";

const DashboardFilterContext = React.createContext<DashboardFilterContextValue | null>(null);

const normalizeList = (values: string[]) => Array.from(new Set(values.filter(Boolean))).sort();

const sanitizeSelection = (
  value: Partial<DashboardFilterSelection> | null | undefined,
  monthOptions: DashboardFilterOptions["months"],
) => {
  const allMonths = monthOptions.map((option) => option.value);
  const selectedMonths = normalizeList((value?.months ?? []).filter((month) => allMonths.includes(month)));

  return {
    months: selectedMonths.length ? selectedMonths : allMonths,
    categories: normalizeList(value?.categories ?? []),
    branches: normalizeList(value?.branches ?? []),
    keywords: normalizeList(value?.keywords ?? []),
  };
};

export function DashboardFilterProvider({
  children,
  initialIdentity,
  initialOptions,
  initialApplied,
}: {
  children: React.ReactNode;
  initialIdentity: MerchantIdentity;
  initialOptions: DashboardFilterOptions;
  initialApplied: DashboardFilterSelection;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = React.useTransition();
  const [identity, setIdentity] = React.useState<MerchantIdentity | null>(initialIdentity);
  const [options, setOptions] = React.useState(initialOptions);
  const [applied, setApplied] = React.useState(initialApplied);
  const [draft, setDraftState] = React.useState(initialApplied);

  useBindGlobalLoading(isPending);

  React.useEffect(() => {
    setIdentity(initialIdentity);
    setOptions(initialOptions);
    setApplied(initialApplied);
    setDraftState(initialApplied);
  }, [initialApplied, initialIdentity, initialOptions]);

  React.useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(applied));
  }, [applied]);

  const setDraft = React.useCallback((next: Partial<DashboardFilterSelection>) => {
    setDraftState((prev) => ({
      months: next.months ? normalizeList(next.months) : prev.months,
      categories: next.categories ? normalizeList(next.categories) : prev.categories,
      branches: next.branches ? normalizeList(next.branches) : prev.branches,
      keywords: next.keywords ? normalizeList(next.keywords) : prev.keywords,
    }));
  }, []);

  const applySelection = React.useCallback(
    (selection: DashboardFilterSelection) => {
      const normalized = sanitizeSelection(selection, options.months);
      const allMonths = options.months.map((option) => option.value);
      const monthIsNoFilter =
        normalized.months.length === allMonths.length &&
        allMonths.every((month) => normalized.months.includes(month));

      const params = new URLSearchParams();
      if (!monthIsNoFilter) {
        normalized.months.forEach((month) => params.append("month", month));
      }
      normalized.categories.forEach((category) => params.append("category", category));
      normalized.branches.forEach((branch) => params.append("branch", branch));
      normalized.keywords.forEach((keyword) => params.append("keyword", keyword));

      const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;

      setApplied(normalized);
      setDraftState(normalized);
      startTransition(() => {
        router.replace(nextUrl, { scroll: false });
      });
    },
    [options.months, pathname, router],
  );

  const applyDraft = React.useCallback(() => {
    applySelection(draft);
  }, [applySelection, draft]);

  const resetAll = React.useCallback(() => {
    applySelection({
      months: options.months.map((option) => option.value),
      categories: [],
      branches: [],
      keywords: [],
    });
  }, [applySelection, options.months]);

  const latestMonth = React.useMemo(() => {
    if (!applied.months.length) return "";
    return [...applied.months].sort().at(-1) ?? "";
  }, [applied.months]);

  const value = React.useMemo<DashboardFilterContextValue>(
    () => ({
      identity,
      initialized: true,
      loading: isPending,
      options,
      applied,
      draft,
      latestMonth,
      setDraft,
      applyDraft,
      resetAll,
    }),
    [identity, isPending, options, applied, draft, latestMonth, setDraft, applyDraft, resetAll],
  );

  return <DashboardFilterContext.Provider value={value}>{children}</DashboardFilterContext.Provider>;
}

export function useDashboardFilters() {
  const context = React.useContext(DashboardFilterContext);
  if (!context) {
    throw new Error("useDashboardFilters must be used inside DashboardFilterProvider");
  }
  return context;
}
