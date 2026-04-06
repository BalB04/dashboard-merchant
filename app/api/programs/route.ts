import { NextResponse } from "next/server";

import { getCurrentMerchantSession } from "@/lib/auth/current-user";
import { parseFilterParams, parseMonthParams } from "@/lib/dashboard-filters";
import { query } from "@/lib/db";

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

  const [rules, keywordRedeem, performance, banners] = await Promise.all([
    query<{
      keyword: string;
      start_period: string;
      end_period: string;
      status: "active" | "upcoming" | "expired";
    }>(
      `
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
        select
          vrmd.keyword_code as keyword,
          vrmd.start_period::text as start_period,
          vrmd.end_period::text as end_period,
          case
            when vrmd.end_period < current_date then 'expired'
            when vrmd.start_period > current_date then 'upcoming'
            else 'active'
          end as status
        from vw_rule_merchant_dim vrmd
        where vrmd.merchant_key in (select merchant_key from canonical_scope)
        order by vrmd.end_period asc
      `,
      [session.merchantKey]
    ),
    query<{
      keyword: string;
      total_redeem: string;
    }>(
      `
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
        select
          dm.keyword_code as keyword,
          count(*) filter (where ft.status = 'success')::int as total_redeem
        from fact_transaction ft
        join dim_merchant dm on dm.merchant_key = ft.merchant_key
        join dim_cluster dcl on dcl.cluster_id = dm.cluster_id
        join dim_category dc on dc.category_id = dm.category_id
        where ft.merchant_key in (select merchant_key from canonical_scope)
          and to_char(date_trunc('month', ft.transaction_at), 'YYYY-MM') = any($2::text[])
          and ($3::text[] is null or cardinality($3::text[]) = 0 or dc.category = any($3::text[]))
          and ($4::text[] is null or cardinality($4::text[]) = 0 or dcl.branch = any($4::text[]))
        group by dm.keyword_code
      `,
      [session.merchantKey, selectedMonths, categoryFilters, branchFilters]
    ),
    query<{
      impression: string;
      clicks: string;
      redeem_from_promo: string;
    }>(
      `
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
        select
          count(*)::int as impression,
          count(distinct ft.msisdn) filter (where ft.status = 'success')::int as clicks,
          count(*) filter (where ft.status = 'success')::int as redeem_from_promo
        from fact_transaction ft
        join dim_merchant dm on dm.merchant_key = ft.merchant_key
        join dim_cluster dcl on dcl.cluster_id = dm.cluster_id
        join dim_category dc on dc.category_id = dm.category_id
        where ft.merchant_key in (select merchant_key from canonical_scope)
          and to_char(date_trunc('month', ft.transaction_at), 'YYYY-MM') = any($2::text[])
          and ($3::text[] is null or cardinality($3::text[]) = 0 or dc.category = any($3::text[]))
          and ($4::text[] is null or cardinality($4::text[]) = 0 or dcl.branch = any($4::text[]))
      `,
      [session.merchantKey, selectedMonths, categoryFilters, branchFilters]
    ),
    loadProviderBanners(),
  ]);

  const redeemByKeyword = new Map(keywordRedeem.rows.map((row) => [row.keyword, toNumber(row.total_redeem)]));
  const perf = performance.rows[0] ?? { impression: 0, clicks: 0, redeem_from_promo: 0 };
  const impression = toNumber(perf.impression);
  const clicks = toNumber(perf.clicks);

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
      programName: row.keyword,
      startPeriod: row.start_period,
      endPeriod: row.end_period,
      status: row.status,
      redeem: redeemByKeyword.get(row.keyword) ?? 0,
    })),
    promotionPerformance: {
      impression,
      clicks,
      ctr: impression > 0 ? (clicks / impression) * 100 : 0,
      redeemFromPromo: toNumber(perf.redeem_from_promo),
    },
  });
}
