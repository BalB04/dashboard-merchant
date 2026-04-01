"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type FilterOption = {
  value: string;
  label: string;
};

type FilterSelection = {
  months: string[];
  categories: string[];
  branches: string[];
};

type MerchantIdentity = {
  email: string;
  merchantKey: string;
};

type DashboardFilterContextValue = {
  initialized: boolean;
  loading: boolean;
  identity: MerchantIdentity | null;
  options: {
    months: FilterOption[];
    categories: FilterOption[];
    branches: FilterOption[];
  };
  applied: FilterSelection;
  draft: FilterSelection;
  latestMonth: string;
  setDraft: (next: Partial<FilterSelection>) => void;
  applyDraft: () => void;
  resetAll: () => void;
};

const STORAGE_KEY = "merchant_dashboard_filters_v1";
const MONTH_REGEX = /^\d{4}-\d{2}$/;

const DashboardFilterContext = React.createContext<DashboardFilterContextValue | null>(null);

const normalizeList = (values: string[]) => Array.from(new Set(values.filter(Boolean))).sort();

const parseMultiParam = (searchParams: URLSearchParams, key: string) =>
  normalizeList(
    searchParams
      .getAll(key)
      .flatMap((value) => value.split(","))
      .map((value) => value.trim())
  );

const safeJsonParse = (raw: string | null): Partial<FilterSelection> | null => {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Partial<FilterSelection>;
  } catch {
    return null;
  }
};

const sanitizeSelection = (
  value: Partial<FilterSelection> | null | undefined,
  monthOptions: FilterOption[]
): FilterSelection => {
  const allMonths = monthOptions.map((option) => option.value);
  const selectedMonths = normalizeList((value?.months ?? []).filter((month) => MONTH_REGEX.test(month)));

  return {
    months: selectedMonths.length ? selectedMonths : allMonths,
    categories: normalizeList(value?.categories ?? []),
    branches: normalizeList(value?.branches ?? []),
  };
};

export function DashboardFilterProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialSearchRef = React.useRef(searchParams.toString());

  const [identity, setIdentity] = React.useState<MerchantIdentity | null>(null);
  const [initialized, setInitialized] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [options, setOptions] = React.useState({
    months: [] as FilterOption[],
    categories: [] as FilterOption[],
    branches: [] as FilterOption[],
  });
  const [applied, setApplied] = React.useState<FilterSelection>({ months: [], categories: [], branches: [] });
  const [draft, setDraftState] = React.useState<FilterSelection>({ months: [], categories: [], branches: [] });
  const appliedMonthsKey = React.useMemo(() => applied.months.join(","), [applied.months]);

  React.useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      try {
        setLoading(true);

        const sessionResponse = await fetch("/api/auth/session");
        if (!sessionResponse.ok) {
          window.location.href = "/login";
          return;
        }
        const sessionPayload = (await sessionResponse.json()) as {
          user: MerchantIdentity;
        };

        const monthResponse = await fetch("/api/overview/months");
        if (!monthResponse.ok) {
          throw new Error("Failed to load month options");
        }
        const monthPayload = (await monthResponse.json()) as { months: FilterOption[] };

        if (!active) return;
        setIdentity(sessionPayload.user);

        const months = monthPayload.months ?? [];
        setOptions((prev) => ({ ...prev, months }));

        const initialSearch = new URLSearchParams(initialSearchRef.current);
        const fromUrl: Partial<FilterSelection> = {
          months: parseMultiParam(initialSearch, "month"),
          categories: parseMultiParam(initialSearch, "category"),
          branches: parseMultiParam(initialSearch, "branch"),
        };

        const hasUrlValues = fromUrl.months?.length || fromUrl.categories?.length || fromUrl.branches?.length;
        const fromStorage = safeJsonParse(window.localStorage.getItem(STORAGE_KEY));
        const initialSelection = sanitizeSelection(hasUrlValues ? fromUrl : fromStorage, months);

        setApplied(initialSelection);
        setDraftState(initialSelection);
        setInitialized(true);
      } catch (error) {
        console.error(error);
      } finally {
        if (active) setLoading(false);
      }
    };

    bootstrap();

    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    if (!initialized) return;
    let active = true;

    const loadFilterOptions = async () => {
      try {
        const params = new URLSearchParams();
        applied.months.forEach((month) => params.append("month", month));
        const response = await fetch(`/api/filters/options?${params.toString()}`);
        if (!response.ok) {
          throw new Error("Failed to load filter options");
        }

        const payload = (await response.json()) as {
          categories: FilterOption[];
          branches: FilterOption[];
        };

        if (!active) return;
        setOptions((prev) => ({
          ...prev,
          categories: payload.categories ?? [],
          branches: payload.branches ?? [],
        }));
      } catch (error) {
        console.error(error);
      }
    };

    loadFilterOptions();

    return () => {
      active = false;
    };
  }, [initialized, appliedMonthsKey, applied.months]);

  React.useEffect(() => {
    if (!initialized) return;

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(applied));

    const params = new URLSearchParams();
    const allMonths = options.months.map((option) => option.value);
    const monthIsNoFilter =
      applied.months.length === allMonths.length &&
      allMonths.every((month) => applied.months.includes(month));

    if (!monthIsNoFilter) {
      applied.months.forEach((month) => params.append("month", month));
    }
    applied.categories.forEach((category) => params.append("category", category));
    applied.branches.forEach((branch) => params.append("branch", branch));

    const query = params.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    router.replace(url, { scroll: false });
  }, [initialized, pathname, router, applied, options.months]);

  const setDraft = React.useCallback((next: Partial<FilterSelection>) => {
    setDraftState((prev) => ({
      months: next.months ? normalizeList(next.months) : prev.months,
      categories: next.categories ? normalizeList(next.categories) : prev.categories,
      branches: next.branches ? normalizeList(next.branches) : prev.branches,
    }));
  }, []);

  const applyDraft = React.useCallback(() => {
    const normalized = sanitizeSelection(draft, options.months);
    setApplied(normalized);
    setDraftState(normalized);
  }, [draft, options.months]);

  const resetAll = React.useCallback(() => {
    const resetValue = sanitizeSelection(
      { months: options.months.map((option) => option.value), categories: [], branches: [] },
      options.months
    );
    setApplied(resetValue);
    setDraftState(resetValue);
  }, [options.months]);

  const latestMonth = React.useMemo(() => {
    if (!applied.months.length) return "";
    return [...applied.months].sort().at(-1) ?? "";
  }, [applied.months]);

  const value = React.useMemo<DashboardFilterContextValue>(
    () => ({
      identity,
      initialized,
      loading,
      options,
      applied,
      draft,
      latestMonth,
      setDraft,
      applyDraft,
      resetAll,
    }),
    [identity, initialized, loading, options, applied, draft, latestMonth, setDraft, applyDraft, resetAll]
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
