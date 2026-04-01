import { NextResponse } from "next/server";

import { getCurrentMerchantSession } from "@/lib/auth/current-user";
import { query } from "@/lib/db";
import { parseMonthParams } from "@/lib/dashboard-filters";

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
  const months = parseMonthParams(searchParams);

  const categories = await query<{ value: string }>(
    `
      ${canonicalScopeCte}
      select distinct dc.category as value
      from fact_transaction ft
      join dim_merchant dm on dm.merchant_key = ft.merchant_key
      join dim_category dc on dc.category_id = dm.category_id
      where ft.status = 'success'
        and ft.merchant_key in (select merchant_key from canonical_scope)
        and to_char(date_trunc('month', ft.transaction_at), 'YYYY-MM') = any($2::text[])
      order by dc.category
    `,
    [session.merchantKey, months]
  );

  const branches = await query<{ value: string }>(
    `
      ${canonicalScopeCte}
      select distinct dcl.branch as value
      from fact_transaction ft
      join dim_merchant dm on dm.merchant_key = ft.merchant_key
      join dim_cluster dcl on dcl.cluster_id = dm.cluster_id
      where ft.status = 'success'
        and ft.merchant_key in (select merchant_key from canonical_scope)
        and to_char(date_trunc('month', ft.transaction_at), 'YYYY-MM') = any($2::text[])
      order by dcl.branch
    `,
    [session.merchantKey, months]
  );

  return NextResponse.json({
    categories: categories.rows.map((row) => ({ value: row.value, label: row.value })),
    branches: branches.rows.map((row) => ({ value: row.value, label: row.value })),
  });
}
