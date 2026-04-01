import { NextResponse } from "next/server";

import { getCurrentMerchantSession } from "@/lib/auth/current-user";
import { query } from "@/lib/db";

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

export async function GET() {
  const session = await getCurrentMerchantSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await query<{ month: string }>(
    `
      ${canonicalScopeCte}
      select to_char(date_trunc('month', ft.transaction_at), 'YYYY-MM') as month
      from fact_transaction ft
      where ft.status = 'success'
        and ft.merchant_key in (select merchant_key from canonical_scope)
      group by date_trunc('month', ft.transaction_at)
      order by date_trunc('month', ft.transaction_at) desc
    `,
    [session.merchantKey]
  );

  const now = new Date();
  const currentMonth = formatMonth(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
  const earliestDataMonth = rows.rows.at(-1)?.month;

  if (!earliestDataMonth) {
    return NextResponse.json({
      months: [{ value: currentMonth, label: monthLabel(currentMonth) }],
    });
  }

  const months: { value: string; label: string }[] = [];
  let cursor = monthToDateUtc(currentMonth);
  const min = monthToDateUtc(earliestDataMonth);

  while (cursor >= min) {
    const monthValue = formatMonth(cursor);
    months.push({ value: monthValue, label: monthLabel(monthValue) });
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() - 1, 1));
  }

  return NextResponse.json({ months });
}
