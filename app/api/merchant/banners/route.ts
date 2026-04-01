import { NextResponse } from "next/server";

import { getCurrentMerchantSession } from "@/lib/auth/current-user";
import { query } from "@/lib/db";

export async function GET() {
  const session = await getCurrentMerchantSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  return NextResponse.json({
    banners: result.rows.map((row) => ({
      id: row.id,
      imageKey: row.image_key,
      title: row.title,
      subtitle: row.subtitle,
      cta: row.cta,
    })),
  });
}
