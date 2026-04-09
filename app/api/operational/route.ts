import { NextResponse } from "next/server";

import { getCurrentMerchantSession } from "@/lib/auth/current-user";
import { query } from "@/lib/db";
import { parseFilterParams, parseMonthParams } from "@/lib/dashboard-filters";
import { merchantScopeCte } from "@/lib/merchant-scope";

const monthLabel = (value: string) => {
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
};

const toNumber = (value: unknown) => Number(value ?? 0);

const scopedMerchantCte = merchantScopeCte(1, 2);

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

  const [statusSummary, keywordSummary, rules, transactions] = await Promise.all([
    query<{
      status: string;
      total: string;
    }>(
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
        group by ft.status
      `,
      [session.merchantKey, session.scopeType, selectedMonths, categoryFilters, branchFilters]
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
        group by dm.keyword_code
        order by total_redeem desc
      `,
      [session.merchantKey, session.scopeType, selectedMonths, categoryFilters, branchFilters]
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
        order by vrmd.end_period asc
      `,
      [session.merchantKey, session.scopeType]
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
          dcl.branch as branch
        from fact_transaction ft
        join dim_merchant dm on dm.merchant_key = ft.merchant_key
        join dim_cluster dcl on dcl.cluster_id = dm.cluster_id
        join dim_category dc on dc.category_id = dm.category_id
        where ft.merchant_key in (select merchant_key from merchant_scope)
          and to_char(date_trunc('month', ft.transaction_at), 'YYYY-MM') = any($3::text[])
          and ($4::text[] is null or cardinality($4::text[]) = 0 or dc.category = any($4::text[]))
          and ($5::text[] is null or cardinality($5::text[]) = 0 or dcl.branch = any($5::text[]))
        order by ft.transaction_at desc
        limit 1000
      `,
      [session.merchantKey, session.scopeType, selectedMonths, categoryFilters, branchFilters]
    ),
  ]);

  const statusMap = new Map(statusSummary.rows.map((row) => [row.status, toNumber(row.total)]));

  return NextResponse.json({
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
    })),
  });
}
