import { NextResponse } from "next/server";

import { getCurrentMerchantSession } from "@/lib/auth/current-user";
import { query } from "@/lib/db";
import { parseFilterParams, parseMonthParams } from "@/lib/dashboard-filters";

const parseMonth = (value: string) => {
  const [year, month] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
};

const monthLabel = (value: string) => {
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
};

const formatMonth = (date: Date) => {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}`;
};

const addMonths = (date: Date, offset: number) => {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + offset);
  return next;
};

const toNumber = (value: unknown) => Number(value ?? 0);

const canonicalScopeCte = `
  with canonical_key as (
    select coalesce(
      (select canonical_merchant_key from merchant_canonical_map where merchant_key = $1::uuid),
      $1::uuid
    ) as key
  ),
  canonical_scope as (
    select merchant_key from merchant_canonical_map where canonical_merchant_key = (select key from canonical_key)
    union
    select key from canonical_key
  )
`;

export async function GET(request: Request) {
  const session = await getCurrentMerchantSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const selectedMonths = parseMonthParams(searchParams);
  const categoryFilters = parseFilterParams(searchParams, "category");
  const branchFilters = parseFilterParams(searchParams, "branch");

  const latestMonth = selectedMonths[selectedMonths.length - 1];
  const latestStart = parseMonth(latestMonth);
  const latestEnd = addMonths(latestStart, 1);
  const previousMonth = formatMonth(addMonths(latestStart, -1));

  const [kpiCurrent, kpiPrevious, merchantProfile] = await Promise.all([
    query<{
      redeem: string;
      unique_redeemer: string;
      burning_poin: string;
    }>(
      `
        ${canonicalScopeCte}
        select
          count(*)::int as redeem,
          count(distinct ft.msisdn)::int as unique_redeemer,
          coalesce(sum(ft.qty * ft.point_redeem), 0)::bigint as burning_poin
        from fact_transaction ft
        join dim_merchant dm on dm.merchant_key = ft.merchant_key
        join dim_cluster dcl on dcl.cluster_id = dm.cluster_id
        join dim_category dc on dc.category_id = dm.category_id
        where ft.status = 'success'
          and ft.merchant_key in (select merchant_key from canonical_scope)
          and to_char(date_trunc('month', ft.transaction_at), 'YYYY-MM') = any($2::text[])
          and ($3::text[] is null or cardinality($3::text[]) = 0 or dc.category = any($3::text[]))
          and ($4::text[] is null or cardinality($4::text[]) = 0 or dcl.branch = any($4::text[]))
      `,
      [session.merchantKey, selectedMonths, categoryFilters, branchFilters]
    ),
    query<{
      redeem: string;
      unique_redeemer: string;
      burning_poin: string;
    }>(
      `
        ${canonicalScopeCte}
        select
          count(*)::int as redeem,
          count(distinct ft.msisdn)::int as unique_redeemer,
          coalesce(sum(ft.qty * ft.point_redeem), 0)::bigint as burning_poin
        from fact_transaction ft
        join dim_merchant dm on dm.merchant_key = ft.merchant_key
        join dim_cluster dcl on dcl.cluster_id = dm.cluster_id
        join dim_category dc on dc.category_id = dm.category_id
        where ft.status = 'success'
          and ft.merchant_key in (select merchant_key from canonical_scope)
          and to_char(date_trunc('month', ft.transaction_at), 'YYYY-MM') = $2
          and ($3::text[] is null or cardinality($3::text[]) = 0 or dc.category = any($3::text[]))
          and ($4::text[] is null or cardinality($4::text[]) = 0 or dcl.branch = any($4::text[]))
      `,
      [session.merchantKey, previousMonth, categoryFilters, branchFilters]
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
        ${canonicalScopeCte}
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
        where dm.merchant_key in (select merchant_key from canonical_scope)
          and ($2::text[] is null or cardinality($2::text[]) = 0 or dc.category = any($2::text[]))
          and ($3::text[] is null or cardinality($3::text[]) = 0 or dcl.branch = any($3::text[]))
      `,
      [session.merchantKey, categoryFilters, branchFilters]
    ),
  ]);

  const [dailyTrend, monthlyTrend, ruleStatus, transactions] = await Promise.all([
    query<{
      date: string;
      redeem: string;
      unique_redeemer: string;
      burning_poin: string;
    }>(
      `
        ${canonicalScopeCte}
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
          and ft.merchant_key in (select merchant_key from canonical_scope)
          and to_char(date_trunc('month', ft.transaction_at), 'YYYY-MM') = any($2::text[])
          and ($3::text[] is null or cardinality($3::text[]) = 0 or dc.category = any($3::text[]))
          and ($4::text[] is null or cardinality($4::text[]) = 0 or dcl.branch = any($4::text[]))
        group by date(ft.transaction_at)
        order by date(ft.transaction_at)
      `,
      [session.merchantKey, selectedMonths, categoryFilters, branchFilters]
    ),
    query<{
      month: string;
      redeem: string;
      unique_redeemer: string;
      burning_poin: string;
    }>(
      `
        ${canonicalScopeCte}
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
          and ft.merchant_key in (select merchant_key from canonical_scope)
          and ft.transaction_at >= $2
          and ft.transaction_at < $3
          and ($4::text[] is null or cardinality($4::text[]) = 0 or dc.category = any($4::text[]))
          and ($5::text[] is null or cardinality($5::text[]) = 0 or dcl.branch = any($5::text[]))
        group by date_trunc('month', ft.transaction_at)
        order by date_trunc('month', ft.transaction_at)
      `,
      [session.merchantKey, addMonths(latestStart, -11), latestEnd, categoryFilters, branchFilters]
    ),
    query<{
      keyword: string;
      start_period: string;
      end_period: string;
      status: "active" | "upcoming" | "expired";
      days_to_end: string;
    }>(
      `
        ${canonicalScopeCte}
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
        where vrmd.merchant_key in (select merchant_key from canonical_scope)
        order by vrmd.end_period asc
        limit 50
      `,
      [session.merchantKey]
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
    }>(
      `
        ${canonicalScopeCte}
        select
          ft.transaction_at::text as transaction_at,
          dm.keyword_code as keyword,
          ft.status::text as status,
          ft.qty::int as qty,
          ft.point_redeem::int as point_redeem,
          (ft.qty * ft.point_redeem)::bigint as redeem_point_total,
          ft.msisdn as msisdn,
          dc.category as category,
          dcl.branch as branch
        from fact_transaction ft
        join dim_merchant dm on dm.merchant_key = ft.merchant_key
        join dim_cluster dcl on dcl.cluster_id = dm.cluster_id
        join dim_category dc on dc.category_id = dm.category_id
        where ft.merchant_key in (select merchant_key from canonical_scope)
          and to_char(date_trunc('month', ft.transaction_at), 'YYYY-MM') = any($2::text[])
          and ($3::text[] is null or cardinality($3::text[]) = 0 or dc.category = any($3::text[]))
          and ($4::text[] is null or cardinality($4::text[]) = 0 or dcl.branch = any($4::text[]))
        order by ft.transaction_at desc
        limit 1000
      `,
      [session.merchantKey, selectedMonths, categoryFilters, branchFilters]
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

  return NextResponse.json({
    month: latestMonth,
    monthLabel: monthLabel(latestMonth),
    previousMonth,
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
    monthlyTrend: monthlyTrend.rows.map((row) => ({
      month: row.month,
      redeem: toNumber(row.redeem),
      uniqueRedeemer: toNumber(row.unique_redeemer),
      burningPoin: toNumber(row.burning_poin),
    })),
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
    })),
  });
}
