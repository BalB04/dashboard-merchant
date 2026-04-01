export type DashboardFilterSelection = {
  months: string[];
  categories: string[];
  branches: string[];
};

const MONTH_REGEX = /^\d{4}-\d{2}$/;

const unique = (values: string[]) => Array.from(new Set(values));

const parseMultiParam = (searchParams: URLSearchParams, key: string) => {
  return unique(
    searchParams
      .getAll(key)
      .flatMap((value) => value.split(","))
      .map((value) => value.trim())
      .filter(Boolean)
  );
};

export const parseMonthParams = (searchParams: URLSearchParams) => {
  const months = parseMultiParam(searchParams, "month").filter((value) => MONTH_REGEX.test(value));
  if (months.length) {
    return months.sort();
  }

  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return [`${now.getFullYear()}-${month}`];
};

export const parseFilterParams = (searchParams: URLSearchParams, key: string) => {
  return parseMultiParam(searchParams, key).filter((value) => value !== "all");
};

export const buildFilterSearchParams = (filters: DashboardFilterSelection) => {
  const params = new URLSearchParams();
  filters.months.forEach((month) => params.append("month", month));
  filters.categories.forEach((category) => params.append("category", category));
  filters.branches.forEach((branch) => params.append("branch", branch));
  return params;
};
