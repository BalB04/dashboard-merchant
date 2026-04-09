import { NextResponse } from "next/server";

import { getCurrentMerchantSession } from "@/lib/auth/current-user";
import { parseFilterParams, parseMonthParams } from "@/lib/dashboard-filters";
import { query } from "@/lib/db";
import { merchantScopeCte } from "@/lib/merchant-scope";

const monthLabel = (value: string) => {
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
};

const toNumber = (value: unknown) => Number(value ?? 0);

const loadProviderBanners = async () => {
  const result = await query<{
    id: string;
    image_key: string;
    title: string;
    subtitle: string;
    cta: string;
  }>(
    `
      select
        id::text as id,
        image_key,
        title,
        subtitle,
        cta
      from provider_banners
      where is_active = true
        and (starts_at is null or starts_at <= now())
        and (ends_at is null or ends_at >= now())
      order by sort_order asc, created_at desc
    `
  );

  return result.rows.map((row) => ({
    id: row.id,
    imageKey: row.image_key,
    title: row.title,
    subtitle: row.subtitle,
    cta: row.cta,
  }));
};

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

  const [rules, keywordMetrics, banners] = await Promise.all([
    query<{
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
      [session.merchantKey, session.scopeType]
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
        group by dm.keyword_code
        order by total_redeem desc, dm.keyword_code asc
      `,
      [session.merchantKey, session.scopeType, selectedMonths, categoryFilters, branchFilters]
    ),
    loadProviderBanners(),
  ]);

  const metricsByKeyword = new Map(
    keywordMetrics.rows.map((row) => [
      row.keyword,
      {
        redeem: toNumber(row.total_redeem),
        uniqueRedeemer: toNumber(row.unique_redeemer),
        burningPoin: toNumber(row.burning_poin),
        failed: toNumber(row.failed),
      },
    ])
  );

  const totals = keywordMetrics.rows.reduce(
    (acc, row) => {
      acc.redeem += toNumber(row.total_redeem);
      acc.uniqueRedeemer += toNumber(row.unique_redeemer);
      acc.burningPoin += toNumber(row.burning_poin);
      acc.failed += toNumber(row.failed);
      return acc;
    },
    { redeem: 0, uniqueRedeemer: 0, burningPoin: 0, failed: 0 }
  );

  return NextResponse.json({
    month: latestMonth,
    monthLabel: monthLabel(latestMonth),
    merchant: {
      merchantKey: session.merchantKey,
      email: session.email,
    },
    banners,
    programs: rules.rows.map((row) => ({
      keyword: row.keyword,
      merchantName: row.merchant_name ?? row.keyword,
      uniqMerchant: row.uniq_merchant ?? row.keyword,
      programName: row.keyword,
      startPeriod: row.start_period,
      endPeriod: row.end_period,
      status: row.status,
      redeem: metricsByKeyword.get(row.keyword)?.redeem ?? 0,
      uniqueRedeemer: metricsByKeyword.get(row.keyword)?.uniqueRedeemer ?? 0,
      burningPoin: metricsByKeyword.get(row.keyword)?.burningPoin ?? 0,
      failed: metricsByKeyword.get(row.keyword)?.failed ?? 0,
    })),
    promotionPerformance: {
      redeem: totals.redeem,
      uniqueRedeemer: totals.uniqueRedeemer,
      burningPoin: totals.burningPoin,
      failed: totals.failed,
    },
  });
}
