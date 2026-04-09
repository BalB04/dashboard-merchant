import { NextResponse } from "next/server";

import { getCurrentMerchantSession } from "@/lib/auth/current-user";
import { query } from "@/lib/db";
import { merchantScopeCte } from "@/lib/merchant-scope";

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

const scopedMerchantCte = merchantScopeCte(1, 2);

export async function GET() {
  const session = await getCurrentMerchantSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    [session.merchantKey, session.scopeType]
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
