import "server-only";

import { createHmac } from "node:crypto";

import { getCurrentMerchantSession, type MerchantSession } from "@/lib/auth/current-user";
import { query } from "@/lib/db";
import { merchantScopeCte } from "@/lib/merchant-scope";
import type {
  DashboardBootstrap,
  DashboardFilterOptions,
  DashboardFilterSelection,
  FeedbackItem,
  FilterOption,
  OperationalResponse,
  OverviewResponse,
  ProgramsResponse,
} from "@/lib/merchant-dashboard/types";

type SearchParamsInput = Record<string, string | string[] | undefined>;

const MONTH_REGEX = /^\d{4}-\d{2}$/;
const scopedMerchantCte = merchantScopeCte(1, 2);

const monthLabel = (value: string) => {
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
};

const formatMonth = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const monthToDateUtc = (value: string) => {
  const [year, month] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
};

const parseMonth = (value: string) => {
  const [year, month] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
};

const addMonths = (date: Date, offset: number) => {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + offset);
  return next;
};

const toNumber = (value: unknown) => Number(value ?? 0);

const unique = (values: string[]) => Array.from(new Set(values));

const latestMonthValue = (months: string[]) =>
  [...months].sort().at(-1) ?? "";

const toUrlSearchParams = (input: SearchParamsInput) => {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(input)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        params.append(key, item);
      }
      continue;
    }

    if (typeof value === "string") {
      params.append(key, value);
    }
  }

  return params;
};

const parseMultiParam = (searchParams: URLSearchParams, key: string) =>
  unique(
    searchParams
      .getAll(key)
      .flatMap((value) => value.split(","))
      .map((value) => value.trim())
      .filter(Boolean),
  );

const parseExplicitSelection = (
  searchParams: URLSearchParams,
  monthOptions: FilterOption[],
): DashboardFilterSelection => {
  const allMonths = monthOptions.map((option) => option.value);
  const months = parseMultiParam(searchParams, "month")
    .filter((value) => MONTH_REGEX.test(value) && allMonths.includes(value))
    .sort();

  return {
    months: months.length ? months : allMonths,
    categories: parseMultiParam(searchParams, "category").filter((value) => value !== "all"),
    branches: parseMultiParam(searchParams, "branch").filter((value) => value !== "all"),
    keywords: parseMultiParam(searchParams, "keyword").filter((value) => value !== "all"),
  };
};

async function getAvailableMonthOptions(session: MerchantSession): Promise<FilterOption[]> {
  const rows = await query<{ month: string }>(
    `
      ${scopedMerchantCte}
      select to_char(date_trunc('month', ft.transaction_at), 'YYYY-MM') as month
      from fact_transaction ft
      where ft.status = 'success'
        and ft.merchant_key in (select merchant_key from merchant_scope)
      group by date_trunc('month', ft.transaction_at)
      order by date_trunc('month', ft.transaction_at) desc
    `,
    [session.userId, session.scopeType],
  );

  const now = new Date();
  const currentMonth = formatMonth(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
  const earliestDataMonth = rows.rows.at(-1)?.month;

  if (!earliestDataMonth) {
    return [{ value: currentMonth, label: monthLabel(currentMonth) }];
  }

  const months: FilterOption[] = [];
  let cursor = monthToDateUtc(currentMonth);
  const min = monthToDateUtc(earliestDataMonth);

  while (cursor >= min) {
    const monthValue = formatMonth(cursor);
    months.push({ value: monthValue, label: monthLabel(monthValue) });
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() - 1, 1));
  }

  return months;
}

async function getFilterOptions(
  session: MerchantSession,
  selection: DashboardFilterSelection,
): Promise<Omit<DashboardFilterOptions, "months">> {
  const [categories, branches, keywords] = await Promise.all([
    query<{ value: string }>(
      `
        ${scopedMerchantCte}
        select distinct dc.category as value
        from fact_transaction ft
        join dim_merchant dm on dm.merchant_key = ft.merchant_key
        join dim_category dc on dc.category_id = dm.category_id
        join dim_cluster dcl on dcl.cluster_id = dm.cluster_id
        where ft.status = 'success'
          and ft.merchant_key in (select merchant_key from merchant_scope)
          and to_char(date_trunc('month', ft.transaction_at), 'YYYY-MM') = any($3::text[])
          and ($4::text[] is null or cardinality($4::text[]) = 0 or dcl.branch = any($4::text[]))
        order by dc.category
      `,
      [session.userId, session.scopeType, selection.months, selection.branches],
    ),
    query<{ value: string }>(
      `
        ${scopedMerchantCte}
        select distinct dcl.branch as value
        from fact_transaction ft
        join dim_merchant dm on dm.merchant_key = ft.merchant_key
        join dim_cluster dcl on dcl.cluster_id = dm.cluster_id
        join dim_category dc on dc.category_id = dm.category_id
        where ft.status = 'success'
          and ft.merchant_key in (select merchant_key from merchant_scope)
          and to_char(date_trunc('month', ft.transaction_at), 'YYYY-MM') = any($3::text[])
          and ($4::text[] is null or cardinality($4::text[]) = 0 or dc.category = any($4::text[]))
        order by dcl.branch
      `,
      [session.userId, session.scopeType, selection.months, selection.categories],
    ),
    query<{ value: string }>(
      `
        ${scopedMerchantCte}
        select distinct dm.keyword_code as value
        from fact_transaction ft
        join dim_merchant dm on dm.merchant_key = ft.merchant_key
        join dim_cluster dcl on dcl.cluster_id = dm.cluster_id
        join dim_category dc on dc.category_id = dm.category_id
        where ft.status = 'success'
          and ft.merchant_key in (select merchant_key from merchant_scope)
          and to_char(date_trunc('month', ft.transaction_at), 'YYYY-MM') = any($3::text[])
          and ($4::text[] is null or cardinality($4::text[]) = 0 or dc.category = any($4::text[]))
          and ($5::text[] is null or cardinality($5::text[]) = 0 or dcl.branch = any($5::text[]))
        order by dm.keyword_code
      `,
      [session.userId, session.scopeType, selection.months, selection.categories, selection.branches],
    ),
  ]);

  return {
    categories: categories.rows.map((row) => ({ value: row.value, label: row.value })),
    branches: branches.rows.map((row) => ({ value: row.value, label: row.value })),
    keywords: keywords.rows.map((row) => ({ value: row.value, label: row.value })),
  };
}

export async function getDashboardBootstrap(searchParamsInput: SearchParamsInput): Promise<{
  session: MerchantSession;
  bootstrap: DashboardBootstrap;
} | null> {
  const session = await getCurrentMerchantSession();
  if (!session) {
    return null;
  }

  const monthOptions = await getAvailableMonthOptions(session);
  const searchParams = toUrlSearchParams(searchParamsInput);
  const requested = parseExplicitSelection(searchParams, monthOptions);
  const filterOptions = await getFilterOptions(session, requested);

  const bootstrap: DashboardBootstrap = {
    identity: {
      email: session.email,
      merchantKey: session.merchantKey,
    },
    options: {
      months: monthOptions,
      categories: filterOptions.categories,
      branches: filterOptions.branches,
      keywords: filterOptions.keywords,
    },
    applied: {
      months: requested.months,
      categories: requested.categories.filter((value) =>
        filterOptions.categories.some((option) => option.value === value),
      ),
      branches: requested.branches.filter((value) =>
        filterOptions.branches.some((option) => option.value === value),
      ),
      keywords: requested.keywords.filter((value) =>
        filterOptions.keywords.some((option) => option.value === value),
      ),
    },
    latestMonth: latestMonthValue(requested.months),
  };

  return { session, bootstrap };
}

export async function getOverviewData(
  session: MerchantSession,
  selection: DashboardFilterSelection,
): Promise<OverviewResponse> {
  const latestMonth = latestMonthValue(selection.months);
  const latestStart = parseMonth(latestMonth);
  const latestEnd = addMonths(latestStart, 1);
  const previousMonth = formatMonth(addMonths(latestStart, -1));

  const [kpiCurrent, kpiPrevious, merchantProfile] = await Promise.all([
    query<{ redeem: string; unique_redeemer: string; burning_poin: string }>(
      `
        ${scopedMerchantCte}
        select
          count(*)::int as redeem,
          count(distinct ft.msisdn)::int as unique_redeemer,
          coalesce(sum(ft.qty * ft.point_redeem), 0)::bigint as burning_poin
        from fact_transaction ft
        join dim_merchant dm on dm.merchant_key = ft.merchant_key
        join dim_cluster dcl on dcl.cluster_id = dm.cluster_id
        join dim_category dc on dc.category_id = dm.category_id
        where ft.status = 'success'
          and ft.merchant_key in (select merchant_key from merchant_scope)
          and to_char(date_trunc('month', ft.transaction_at), 'YYYY-MM') = any($3::text[])
          and ($4::text[] is null or cardinality($4::text[]) = 0 or dc.category = any($4::text[]))
          and ($5::text[] is null or cardinality($5::text[]) = 0 or dcl.branch = any($5::text[]))
          and ($6::text[] is null or cardinality($6::text[]) = 0 or dm.keyword_code = any($6::text[]))
      `,
      [session.userId, session.scopeType, selection.months, selection.categories, selection.branches, selection.keywords],
    ),
    query<{ redeem: string; unique_redeemer: string; burning_poin: string }>(
      `
        ${scopedMerchantCte}
        select
          count(*)::int as redeem,
          count(distinct ft.msisdn)::int as unique_redeemer,
          coalesce(sum(ft.qty * ft.point_redeem), 0)::bigint as burning_poin
        from fact_transaction ft
        join dim_merchant dm on dm.merchant_key = ft.merchant_key
        join dim_cluster dcl on dcl.cluster_id = dm.cluster_id
        join dim_category dc on dc.category_id = dm.category_id
        where ft.status = 'success'
          and ft.merchant_key in (select merchant_key from merchant_scope)
          and to_char(date_trunc('month', ft.transaction_at), 'YYYY-MM') = $3
          and ($4::text[] is null or cardinality($4::text[]) = 0 or dc.category = any($4::text[]))
          and ($5::text[] is null or cardinality($5::text[]) = 0 or dcl.branch = any($5::text[]))
          and ($6::text[] is null or cardinality($6::text[]) = 0 or dm.keyword_code = any($6::text[]))
      `,
      [session.userId, session.scopeType, previousMonth, selection.categories, selection.branches, selection.keywords],
    ),
    query<{
      merchant_names: string[] | null;
      uniq_merchants: string[] | null;
      categories: string[] | null;
      keywords: string[] | null;
      start_period: string | null;
      end_period: string | null;
      point_redeem: string | null;
    }>(
      `
        ${scopedMerchantCte}
        select
          array_remove(array_agg(distinct dm.merchant_name), null) as merchant_names,
          array_remove(array_agg(distinct dm.uniq_merchant), null) as uniq_merchants,
          array_remove(array_agg(distinct dc.category), null) as categories,
          array_remove(array_agg(distinct dm.keyword_code), null) as keywords,
          min(vrmd.start_period)::text as start_period,
          max(vrmd.end_period)::text as end_period,
          (array_agg(distinct vrmd.point_redeem order by vrmd.point_redeem desc))[1]::int::text as point_redeem
        from dim_merchant dm
        join dim_cluster dcl on dcl.cluster_id = dm.cluster_id
        join dim_category dc on dc.category_id = dm.category_id
        left join vw_rule_merchant_dim vrmd on vrmd.merchant_key = dm.merchant_key
        where dm.merchant_key in (select merchant_key from merchant_scope)
          and ($3::text[] is null or cardinality($3::text[]) = 0 or dc.category = any($3::text[]))
          and ($4::text[] is null or cardinality($4::text[]) = 0 or dcl.branch = any($4::text[]))
          and ($5::text[] is null or cardinality($5::text[]) = 0 or dm.keyword_code = any($5::text[]))
      `,
      [session.userId, session.scopeType, selection.categories, selection.branches, selection.keywords],
    ),
  ]);

  const [dailyTrend, monthlyTrend, ruleStatus, transactions] = await Promise.all([
    query<{ date: string; redeem: string; unique_redeemer: string; burning_poin: string }>(
      `
        ${scopedMerchantCte}
        select
          date(ft.transaction_at)::text as date,
          count(*)::int as redeem,
          count(distinct ft.msisdn)::int as unique_redeemer,
          coalesce(sum(ft.qty * ft.point_redeem), 0)::bigint as burning_poin
        from fact_transaction ft
        join dim_merchant dm on dm.merchant_key = ft.merchant_key
        join dim_cluster dcl on dcl.cluster_id = dm.cluster_id
        join dim_category dc on dc.category_id = dm.category_id
        where ft.status = 'success'
          and ft.merchant_key in (select merchant_key from merchant_scope)
          and to_char(date_trunc('month', ft.transaction_at), 'YYYY-MM') = any($3::text[])
          and ($4::text[] is null or cardinality($4::text[]) = 0 or dc.category = any($4::text[]))
          and ($5::text[] is null or cardinality($5::text[]) = 0 or dcl.branch = any($5::text[]))
          and ($6::text[] is null or cardinality($6::text[]) = 0 or dm.keyword_code = any($6::text[]))
        group by date(ft.transaction_at)
        order by date(ft.transaction_at)
      `,
      [session.userId, session.scopeType, selection.months, selection.categories, selection.branches, selection.keywords],
    ),
    query<{ month: string; redeem: string; unique_redeemer: string; burning_poin: string }>(
      `
        ${scopedMerchantCte}
        select
          to_char(date_trunc('month', ft.transaction_at), 'YYYY-MM') as month,
          count(*)::int as redeem,
          count(distinct ft.msisdn)::int as unique_redeemer,
          coalesce(sum(ft.qty * ft.point_redeem), 0)::bigint as burning_poin
        from fact_transaction ft
        join dim_merchant dm on dm.merchant_key = ft.merchant_key
        join dim_cluster dcl on dcl.cluster_id = dm.cluster_id
        join dim_category dc on dc.category_id = dm.category_id
        where ft.status = 'success'
          and ft.merchant_key in (select merchant_key from merchant_scope)
          and ft.transaction_at >= $3
          and ft.transaction_at < $4
          and ($5::text[] is null or cardinality($5::text[]) = 0 or dc.category = any($5::text[]))
          and ($6::text[] is null or cardinality($6::text[]) = 0 or dcl.branch = any($6::text[]))
          and ($7::text[] is null or cardinality($7::text[]) = 0 or dm.keyword_code = any($7::text[]))
        group by date_trunc('month', ft.transaction_at)
        order by date_trunc('month', ft.transaction_at)
      `,
      [session.userId, session.scopeType, addMonths(latestStart, -5), latestEnd, selection.categories, selection.branches, selection.keywords],
    ),
    query<{
      keyword: string;
      start_period: string;
      end_period: string;
      status: "active" | "upcoming" | "expired";
      days_to_end: string;
    }>(
      `
        ${scopedMerchantCte}
        select
          vrmd.keyword_code as keyword,
          vrmd.start_period::text as start_period,
          vrmd.end_period::text as end_period,
          case
            when vrmd.end_period < current_date then 'expired'
            when vrmd.start_period > current_date then 'upcoming'
            else 'active'
          end as status,
          (vrmd.end_period - current_date)::int as days_to_end
        from vw_rule_merchant_dim vrmd
        where vrmd.merchant_key in (select merchant_key from merchant_scope)
          and ($3::text[] is null or cardinality($3::text[]) = 0 or vrmd.keyword_code = any($3::text[]))
        order by vrmd.end_period asc
        limit 50
      `,
      [session.userId, session.scopeType, selection.keywords],
    ),
    query<{
      transaction_at: string;
      keyword: string;
      status: string;
      qty: string;
      point_redeem: string;
      redeem_point_total: string;
      msisdn: string;
      category: string;
      branch: string;
      cluster: string;
    }>(
      `
        ${scopedMerchantCte}
        select
          ft.transaction_at::text as transaction_at,
          dm.keyword_code as keyword,
          ft.status::text as status,
          ft.qty::int as qty,
          ft.point_redeem::int as point_redeem,
          (ft.qty * ft.point_redeem)::bigint as redeem_point_total,
          ft.msisdn as msisdn,
          dc.category as category,
          dcl.branch as branch,
          dcl.cluster as cluster
        from fact_transaction ft
        join dim_merchant dm on dm.merchant_key = ft.merchant_key
        join dim_cluster dcl on dcl.cluster_id = dm.cluster_id
        join dim_category dc on dc.category_id = dm.category_id
        where ft.merchant_key in (select merchant_key from merchant_scope)
          and to_char(date_trunc('month', ft.transaction_at), 'YYYY-MM') = any($3::text[])
          and ($4::text[] is null or cardinality($4::text[]) = 0 or dc.category = any($4::text[]))
          and ($5::text[] is null or cardinality($5::text[]) = 0 or dcl.branch = any($5::text[]))
          and ($6::text[] is null or cardinality($6::text[]) = 0 or dm.keyword_code = any($6::text[]))
        order by ft.transaction_at desc
        limit 1000
      `,
      [session.userId, session.scopeType, selection.months, selection.categories, selection.branches, selection.keywords],
    ),
  ]);

  const current = kpiCurrent.rows[0] ?? { redeem: 0, unique_redeemer: 0, burning_poin: 0 };
  const previous = kpiPrevious.rows[0] ?? { redeem: 0, unique_redeemer: 0, burning_poin: 0 };
  const merchant = merchantProfile.rows[0] ?? {
    merchant_names: [],
    uniq_merchants: [],
    categories: [],
    keywords: [],
    start_period: null,
    end_period: null,
    point_redeem: null,
  };
  const monthlyTrendMap = new Map(monthlyTrend.rows.map((row) => [row.month, row]));
  const filledMonthlyTrend = Array.from({ length: 6 }, (_, index) => {
    const monthDate = addMonths(latestStart, index - 5);
    const month = formatMonth(monthDate);
    const row = monthlyTrendMap.get(month);

    return {
      month,
      redeem: toNumber(row?.redeem),
      uniqueRedeemer: toNumber(row?.unique_redeemer),
      burningPoin: toNumber(row?.burning_poin),
    };
  });

  return {
    month: latestMonth,
    monthLabel: monthLabel(latestMonth),
    previousMonthLabel: monthLabel(previousMonth),
    merchant: {
      merchantKey: session.merchantKey,
      email: session.email,
      merchantNames: merchant.merchant_names ?? [],
      uniqMerchants: merchant.uniq_merchants ?? [],
      categories: merchant.categories ?? [],
      keywords: merchant.keywords ?? [],
      startPeriod: merchant.start_period,
      endPeriod: merchant.end_period,
      pointRedeem: merchant.point_redeem === null ? null : toNumber(merchant.point_redeem),
    },
    myKpi: {
      redeem: toNumber(current.redeem),
      uniqueRedeemer: toNumber(current.unique_redeemer),
      burningPoin: toNumber(current.burning_poin),
      previous: {
        redeem: toNumber(previous.redeem),
        uniqueRedeemer: toNumber(previous.unique_redeemer),
        burningPoin: toNumber(previous.burning_poin),
      },
    },
    dailyTrend: dailyTrend.rows.map((row) => ({
      date: row.date,
      redeem: toNumber(row.redeem),
      uniqueRedeemer: toNumber(row.unique_redeemer),
      burningPoin: toNumber(row.burning_poin),
    })),
    monthlyTrend: filledMonthlyTrend,
    keywordRules: ruleStatus.rows.map((row) => ({
      keyword: row.keyword,
      startPeriod: row.start_period,
      endPeriod: row.end_period,
      status: row.status,
      daysToEnd: toNumber(row.days_to_end),
    })),
    transactions: transactions.rows.map((row) => ({
      transactionAt: row.transaction_at,
      keyword: row.keyword,
      status: row.status,
      qty: toNumber(row.qty),
      pointRedeem: toNumber(row.point_redeem),
      redeemPointTotal: toNumber(row.redeem_point_total),
      msisdn: row.msisdn,
      category: row.category,
      branch: row.branch,
      cluster: row.cluster,
    })),
  };
}

export async function getOperationalData(
  session: MerchantSession,
  selection: DashboardFilterSelection,
): Promise<OperationalResponse> {
  const latestMonth = latestMonthValue(selection.months);

  const [statusSummary, keywordSummary, rules, transactions] = await Promise.all([
    query<{ status: string; total: string }>(
      `
        ${scopedMerchantCte}
        select ft.status::text as status, count(*)::int as total
        from fact_transaction ft
        join dim_merchant dm on dm.merchant_key = ft.merchant_key
        join dim_cluster dcl on dcl.cluster_id = dm.cluster_id
        join dim_category dc on dc.category_id = dm.category_id
        where ft.merchant_key in (select merchant_key from merchant_scope)
          and to_char(date_trunc('month', ft.transaction_at), 'YYYY-MM') = any($3::text[])
          and ($4::text[] is null or cardinality($4::text[]) = 0 or dc.category = any($4::text[]))
          and ($5::text[] is null or cardinality($5::text[]) = 0 or dcl.branch = any($5::text[]))
          and ($6::text[] is null or cardinality($6::text[]) = 0 or dm.keyword_code = any($6::text[]))
        group by ft.status
      `,
      [session.userId, session.scopeType, selection.months, selection.categories, selection.branches, selection.keywords],
    ),
    query<{
      keyword: string;
      total_redeem: string;
      total_redeemer: string;
      burning_poin: string;
    }>(
      `
        ${scopedMerchantCte}
        select
          dm.keyword_code as keyword,
          count(*) filter (where ft.status = 'success')::int as total_redeem,
          count(distinct ft.msisdn) filter (where ft.status = 'success')::int as total_redeemer,
          coalesce(sum(ft.qty * ft.point_redeem) filter (where ft.status = 'success'), 0)::bigint as burning_poin
        from fact_transaction ft
        join dim_merchant dm on dm.merchant_key = ft.merchant_key
        join dim_cluster dcl on dcl.cluster_id = dm.cluster_id
        join dim_category dc on dc.category_id = dm.category_id
        where ft.merchant_key in (select merchant_key from merchant_scope)
          and to_char(date_trunc('month', ft.transaction_at), 'YYYY-MM') = any($3::text[])
          and ($4::text[] is null or cardinality($4::text[]) = 0 or dc.category = any($4::text[]))
          and ($5::text[] is null or cardinality($5::text[]) = 0 or dcl.branch = any($5::text[]))
          and ($6::text[] is null or cardinality($6::text[]) = 0 or dm.keyword_code = any($6::text[]))
        group by dm.keyword_code
        order by total_redeem desc
      `,
      [session.userId, session.scopeType, selection.months, selection.categories, selection.branches, selection.keywords],
    ),
    query<{
      keyword: string;
      start_period: string;
      end_period: string;
      status: "active" | "upcoming" | "expired";
      days_to_end: string;
    }>(
      `
        ${scopedMerchantCte}
        select
          vrmd.keyword_code as keyword,
          vrmd.start_period::text as start_period,
          vrmd.end_period::text as end_period,
          case
            when vrmd.end_period < current_date then 'expired'
            when vrmd.start_period > current_date then 'upcoming'
            else 'active'
          end as status,
          (vrmd.end_period - current_date)::int as days_to_end
        from vw_rule_merchant_dim vrmd
        where vrmd.merchant_key in (select merchant_key from merchant_scope)
          and ($3::text[] is null or cardinality($3::text[]) = 0 or vrmd.keyword_code = any($3::text[]))
        order by vrmd.end_period asc
      `,
      [session.userId, session.scopeType, selection.keywords],
    ),
    query<{
      transaction_at: string;
      keyword: string;
      status: string;
      qty: string;
      point_redeem: string;
      redeem_point_total: string;
      msisdn: string;
      category: string;
      branch: string;
      cluster: string;
    }>(
      `
        ${scopedMerchantCte}
        select
          ft.transaction_at::text as transaction_at,
          dm.keyword_code as keyword,
          ft.status::text as status,
          ft.qty::int as qty,
          ft.point_redeem::int as point_redeem,
          (ft.qty * ft.point_redeem)::bigint as redeem_point_total,
          ft.msisdn as msisdn,
          dc.category as category,
          dcl.branch as branch,
          dcl.cluster as cluster
        from fact_transaction ft
        join dim_merchant dm on dm.merchant_key = ft.merchant_key
        join dim_cluster dcl on dcl.cluster_id = dm.cluster_id
        join dim_category dc on dc.category_id = dm.category_id
        where ft.merchant_key in (select merchant_key from merchant_scope)
          and to_char(date_trunc('month', ft.transaction_at), 'YYYY-MM') = any($3::text[])
          and ($4::text[] is null or cardinality($4::text[]) = 0 or dc.category = any($4::text[]))
          and ($5::text[] is null or cardinality($5::text[]) = 0 or dcl.branch = any($5::text[]))
          and ($6::text[] is null or cardinality($6::text[]) = 0 or dm.keyword_code = any($6::text[]))
        order by ft.transaction_at desc
        limit 1000
      `,
      [session.userId, session.scopeType, selection.months, selection.categories, selection.branches, selection.keywords],
    ),
  ]);

  const statusMap = new Map(statusSummary.rows.map((row) => [row.status, toNumber(row.total)]));

  return {
    month: latestMonth,
    monthLabel: monthLabel(latestMonth),
    merchant: {
      merchantKey: session.merchantKey,
      email: session.email,
    },
    transactionStatus: {
      success: statusMap.get("success") ?? 0,
      failed: statusMap.get("failed") ?? 0,
    },
    keywordSummary: keywordSummary.rows.map((row) => ({
      keyword: row.keyword,
      totalRedeem: toNumber(row.total_redeem),
      uniqueRedeemer: toNumber(row.total_redeemer),
      burningPoin: toNumber(row.burning_poin),
    })),
    keywordRules: rules.rows.map((row) => ({
      keyword: row.keyword,
      startPeriod: row.start_period,
      endPeriod: row.end_period,
      status: row.status,
      daysToEnd: toNumber(row.days_to_end),
    })),
    transactions: transactions.rows.map((row) => ({
      transactionAt: row.transaction_at,
      keyword: row.keyword,
      status: row.status,
      qty: toNumber(row.qty),
      pointRedeem: toNumber(row.point_redeem),
      redeemPointTotal: toNumber(row.redeem_point_total),
      msisdn: row.msisdn,
      category: row.category,
      branch: row.branch,
      cluster: row.cluster,
    })),
  };
}

const adminAssetBaseUrl = (
  process.env.ADMIN_ASSET_BASE_URL ??
  process.env.NEXT_PUBLIC_ADMIN_ASSET_BASE_URL ??
  "http://localhost:3000"
).replace(/\/$/, "");

const adminAssetSharedSecret = process.env.ADMIN_ASSET_SHARED_SECRET ?? null;
const adminAssetRoutePrefix = "/api/admin/banner-assets/";
const adminAssetSignedUrlTtlSeconds = 60 * 60;

const signAdminAssetPath = (value: string) => {
  if (!adminAssetSharedSecret || !value.startsWith(adminAssetRoutePrefix)) {
    return value;
  }

  const key = decodeURIComponent(value.slice(adminAssetRoutePrefix.length));
  const expiresAt = Math.floor(Date.now() / 1000) + adminAssetSignedUrlTtlSeconds;
  const signature = createHmac("sha256", adminAssetSharedSecret)
    .update(`${key}:${expiresAt}`)
    .digest("base64url");

  const separator = value.includes("?") ? "&" : "?";
  return `${value}${separator}exp=${expiresAt}&sig=${encodeURIComponent(signature)}`;
};

const resolveAdminAssetUrl = (value: string | null | undefined) => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (!value.startsWith("/")) return value;
  return `${adminAssetBaseUrl}${signAdminAssetPath(value)}`;
};

const loadProviderBanners = async () => {
  const result = await query<{
    id: string;
    image_url: string;
    title: string;
    subtitle: string;
    cta: string;
  }>(
    `
      select
        id::text as id,
        image_url,
        title,
        subtitle,
        cta
      from provider_banners
      where is_active = true
        and (starts_at is null or starts_at <= now())
        and (ends_at is null or ends_at >= now())
      order by sort_order asc, created_at desc
    `,
  );

  return result.rows.map((row) => ({
    id: row.id,
    imageUrl: resolveAdminAssetUrl(row.image_url) ?? undefined,
    title: row.title,
    subtitle: row.subtitle,
    cta: row.cta,
  }));
};

const loadProgramBannerAssets = async (ruleKeys: string[], keywordCodes: string[]) => {
  if (ruleKeys.length === 0 && keywordCodes.length === 0) {
    return [];
  }

  const result = await query<{ rule_key: string | null; keyword_code: string | null; image_url: string }>(
    `
      select
        rule_key::text as rule_key,
        keyword_code,
        image_url
      from program_banner_assets
      where is_active = true
        and (
          (cardinality($1::uuid[]) > 0 and rule_key = any($1::uuid[]))
          or
          (cardinality($2::text[]) > 0 and keyword_code = any($2::text[]))
        )
    `,
    [ruleKeys, keywordCodes],
  );

  return result.rows;
};

export async function getProgramsData(
  session: MerchantSession,
  selection: DashboardFilterSelection,
): Promise<ProgramsResponse> {
  const latestMonth = latestMonthValue(selection.months);

  const [rules, keywordMetrics, banners] = await Promise.all([
    query<{
      rule_key: string;
      keyword: string;
      merchant_name: string | null;
      uniq_merchant: string | null;
      start_period: string;
      end_period: string;
      status: "active" | "upcoming" | "expired";
    }>(
      `
        ${scopedMerchantCte}
        select
          vrmd.rule_key::text as rule_key,
          vrmd.keyword_code as keyword,
          dm.merchant_name as merchant_name,
          dm.uniq_merchant as uniq_merchant,
          vrmd.start_period::text as start_period,
          vrmd.end_period::text as end_period,
          case
            when vrmd.end_period < current_date then 'expired'
            when vrmd.start_period > current_date then 'upcoming'
            else 'active'
          end as status
        from vw_rule_merchant_dim vrmd
        join dim_merchant dm on dm.merchant_key = vrmd.merchant_key
        where vrmd.merchant_key in (select merchant_key from merchant_scope)
        order by vrmd.end_period asc
      `,
      [session.userId, session.scopeType],
    ),
    query<{
      keyword: string;
      total_redeem: string;
      unique_redeemer: string;
      burning_poin: string;
      failed: string;
    }>(
      `
        ${scopedMerchantCte}
        select
          dm.keyword_code as keyword,
          count(*) filter (where ft.status = 'success')::int as total_redeem,
          count(distinct ft.msisdn) filter (where ft.status = 'success')::int as unique_redeemer,
          coalesce(sum(ft.qty * ft.point_redeem) filter (where ft.status = 'success'), 0)::bigint as burning_poin,
          count(*) filter (where ft.status = 'failed')::int as failed
        from fact_transaction ft
        join dim_merchant dm on dm.merchant_key = ft.merchant_key
        join dim_cluster dcl on dcl.cluster_id = dm.cluster_id
        join dim_category dc on dc.category_id = dm.category_id
        where ft.merchant_key in (select merchant_key from merchant_scope)
          and to_char(date_trunc('month', ft.transaction_at), 'YYYY-MM') = any($3::text[])
          and ($4::text[] is null or cardinality($4::text[]) = 0 or dc.category = any($4::text[]))
          and ($5::text[] is null or cardinality($5::text[]) = 0 or dcl.branch = any($5::text[]))
          and ($6::text[] is null or cardinality($6::text[]) = 0 or dm.keyword_code = any($6::text[]))
        group by dm.keyword_code
        order by total_redeem desc, dm.keyword_code asc
      `,
      [session.userId, session.scopeType, selection.months, selection.categories, selection.branches, selection.keywords],
    ),
    loadProviderBanners(),
  ]);

  const programBannerAssets = await loadProgramBannerAssets(
    [...new Set(rules.rows.map((row) => row.rule_key).filter(Boolean))],
    [...new Set(rules.rows.map((row) => row.keyword).filter(Boolean))],
  );

  const assetByRuleKey = new Map(
    programBannerAssets
      .filter((asset) => asset.rule_key)
      .map((asset) => [asset.rule_key as string, resolveAdminAssetUrl(asset.image_url)]),
  );

  const assetByKeywordCode = new Map(
    programBannerAssets
      .filter((asset) => asset.keyword_code)
      .map((asset) => [asset.keyword_code as string, resolveAdminAssetUrl(asset.image_url)]),
  );

  const metricsByKeyword = new Map(
    keywordMetrics.rows.map((row) => [
      row.keyword,
      {
        redeem: toNumber(row.total_redeem),
        uniqueRedeemer: toNumber(row.unique_redeemer),
        burningPoin: toNumber(row.burning_poin),
        failed: toNumber(row.failed),
      },
    ]),
  );

  const totals = keywordMetrics.rows.reduce(
    (acc, row) => {
      acc.redeem += toNumber(row.total_redeem);
      acc.uniqueRedeemer += toNumber(row.unique_redeemer);
      acc.burningPoin += toNumber(row.burning_poin);
      acc.failed += toNumber(row.failed);
      return acc;
    },
    { redeem: 0, uniqueRedeemer: 0, burningPoin: 0, failed: 0 },
  );

  return {
    month: latestMonth,
    monthLabel: monthLabel(latestMonth),
    banners,
    programs: rules.rows
      .filter((row) => selection.keywords.length === 0 || selection.keywords.includes(row.keyword))
      .map((row) => ({
        ruleKey: row.rule_key,
        keyword: row.keyword,
        merchantName: row.merchant_name ?? row.keyword,
        uniqMerchant: row.uniq_merchant ?? row.keyword,
        programName: row.keyword,
        startPeriod: row.start_period,
        endPeriod: row.end_period,
        status: row.status,
        imageUrl: assetByRuleKey.get(row.rule_key) ?? assetByKeywordCode.get(row.keyword) ?? null,
        redeem: metricsByKeyword.get(row.keyword)?.redeem ?? 0,
        uniqueRedeemer: metricsByKeyword.get(row.keyword)?.uniqueRedeemer ?? 0,
        burningPoin: metricsByKeyword.get(row.keyword)?.burningPoin ?? 0,
        failed: metricsByKeyword.get(row.keyword)?.failed ?? 0,
      })),
    promotionPerformance: totals,
  };
}

const mapFeedbackRow = (row: {
  id: string;
  type: "report" | "critic" | "suggestion";
  category: string;
  title: string;
  message: string;
  status: "open" | "in_progress" | "resolved" | "canceled";
  attachment_key: string | null;
  attachment_file_name: string | null;
  attachment_mime_type: string | null;
  attachment_size: number | null;
  reply: string | null;
  replied_at: string | null;
  created_at: string;
  updated_at: string;
}): FeedbackItem => ({
  id: row.id,
  type: row.type,
  category: row.category,
  title: row.title,
  message: row.message,
  status: row.status,
  attachment: row.attachment_key
    ? {
        fileName: row.attachment_file_name,
        mimeType: row.attachment_mime_type,
        size: row.attachment_size,
        downloadUrl: `/api/merchant/feedback/${row.id}/attachment`,
      }
    : null,
  reply: row.reply,
  repliedAt: row.replied_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export async function getFeedbackHistory(session: MerchantSession): Promise<FeedbackItem[]> {
  const result = await query<{
    id: string;
    type: "report" | "critic" | "suggestion";
    category: string;
    title: string;
    message: string;
    status: "open" | "in_progress" | "resolved" | "canceled";
    attachment_key: string | null;
    attachment_file_name: string | null;
    attachment_mime_type: string | null;
    attachment_size: number | null;
    reply: string | null;
    replied_at: string | null;
    created_at: string;
    updated_at: string;
  }>(
    `
      select
        id::text as id,
        type,
        category,
        title,
        message,
        status,
        attachment_key,
        attachment_file_name,
        attachment_mime_type,
        attachment_size,
        reply,
        replied_at::text,
        created_at::text,
        updated_at::text
      from merchant_feedback
      where merchant_key = $1
        and user_id = $2
      order by created_at desc
    `,
    [session.merchantKey, session.userId],
  );

  return result.rows.map(mapFeedbackRow);
}
