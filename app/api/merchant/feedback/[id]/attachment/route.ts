import { NextResponse } from "next/server";

import { getCurrentMerchantSession } from "@/lib/auth/current-user";
import { query } from "@/lib/db";
import { readFeedbackAttachment } from "@/lib/feedback-attachments";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  const session = await getCurrentMerchantSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const result = await query<{
    attachment_key: string | null;
    attachment_file_name: string | null;
    attachment_mime_type: string | null;
  }>(
    `
      select
        attachment_key,
        attachment_file_name,
        attachment_mime_type
      from merchant_feedback
      where id = $1::bigint
        and merchant_key = $2
        and user_id = $3
      limit 1
    `,
    [id, session.merchantKey, session.userId],
  );

  const row = result.rows[0];
  if (!row?.attachment_key) {
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  }

  try {
    const attachment = await readFeedbackAttachment(row.attachment_key);
    return new NextResponse(attachment.content, {
      headers: {
        "Content-Type": row.attachment_mime_type || "application/octet-stream",
        "Content-Disposition": `inline; filename="${encodeURIComponent(row.attachment_file_name || "attachment")}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Attachment file is missing" }, { status: 404 });
  }
}
