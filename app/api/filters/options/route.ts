import { NextResponse } from "next/server";

import { getCurrentMerchantSession } from "@/lib/auth/current-user";
import { query } from "@/lib/db";
import { parseFilterParams, parseMonthParams } from "@/lib/dashboard-filters";
import { merchantScopeCte } from "@/lib/merchant-scope";

const scopedMerchantCte = merchantScopeCte(1, 2);

export async function GET(request: Request) {
  const session = await getCurrentMerchantSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const months = parseMonthParams(searchParams);
  const categoryFilters = parseFilterParams(searchParams, "category");
  const branchFilters = parseFilterParams(searchParams, "branch");

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
      [session.merchantKey, session.scopeType, months, branchFilters]
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
      [session.merchantKey, session.scopeType, months, categoryFilters]
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
      [session.merchantKey, session.scopeType, months, categoryFilters, branchFilters]
    ),
  ]);

  return NextResponse.json({
    categories: categories.rows.map((row) => ({ value: row.value, label: row.value })),
    branches: branches.rows.map((row) => ({ value: row.value, label: row.value })),
    keywords: keywords.rows.map((row) => ({ value: row.value, label: row.value })),
  });
}
