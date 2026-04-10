import { NextResponse } from "next/server";

import { getCurrentMerchantSession } from "@/lib/auth/current-user";
import { query } from "@/lib/db";
import { deleteFeedbackAttachment, saveFeedbackAttachment } from "@/lib/feedback-attachments";

type FeedbackPayload = {
  id?: string;
  type?: "report" | "critic" | "suggestion";
  category?: string;
  title?: string;
  message?: string;
  status?: "canceled";
};

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

const parseJsonBody = async (request: Request) => {
  try {
    return (await request.json()) as FeedbackPayload;
  } catch {
    return null;
  }
};

export async function GET() {
  const session = await getCurrentMerchantSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await query<{
    id: string;
    type: "report" | "critic" | "suggestion";
    category: string;
    title: string;
    message: string;
    status: "open" | "in_progress" | "resolved" | "canceled";
    attachment_key: string | null;
    attachment_file_name: string | null;
    attachment_mime_type: string | null;
    attachment_size: number | null;
    reply: string | null;
    replied_at: string | null;
    created_at: string;
    updated_at: string;
  }>(
    `
      select
        id::text as id,
        type,
        category,
        title,
        message,
        status,
        attachment_key,
        attachment_file_name,
        attachment_mime_type,
        attachment_size,
        reply,
        replied_at::text,
        created_at::text,
        updated_at::text
      from merchant_feedback
      where merchant_key = $1
        and user_id = $2
      order by created_at desc
    `,
    [session.merchantKey, session.userId]
  );

  return NextResponse.json({
    feedback: result.rows.map((row) => ({
      id: row.id,
      type: row.type,
      category: row.category,
      title: row.title,
      message: row.message,
      status: row.status,
      attachment: row.attachment_key
        ? {
            fileName: row.attachment_file_name,
            mimeType: row.attachment_mime_type,
            size: row.attachment_size,
            downloadUrl: `/api/merchant/feedback/${row.id}/attachment`,
          }
        : null,
      reply: row.reply,
      repliedAt: row.replied_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  });
}

export async function POST(request: Request) {
  const session = await getCurrentMerchantSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";

  let type: FeedbackPayload["type"];
  let category: string | undefined;
  let title: string | undefined;
  let message: string | undefined;
  let attachment:
    | {
        key: string;
        fileName: string;
        mimeType: string;
        size: number;
      }
    | null
    | undefined;

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    type = String(formData.get("type") ?? "") as FeedbackPayload["type"];
    category = String(formData.get("category") ?? "").trim();
    title = String(formData.get("title") ?? "").trim();
    message = String(formData.get("message") ?? "").trim();

    const fileValue = formData.get("attachment");
    if (fileValue instanceof File && fileValue.size > 0) {
      if (fileValue.size > MAX_ATTACHMENT_SIZE) {
        return NextResponse.json(
          { error: "Attachment must be 10MB or smaller" },
          { status: 400 },
        );
      }

      attachment = await saveFeedbackAttachment(fileValue);
    }
  } else {
    const body = await parseJsonBody(request);
    if (!body) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    type = body.type;
    category = body.category?.trim();
    title = body.title?.trim();
    message = body.message?.trim();
  }

  if (!type || !category || !title || !message) {
    return NextResponse.json(
      { error: "type, category, title, and message are required" },
      { status: 400 }
    );
  }

  let result;
  try {
    result = await query<{
      id: string;
      type: "report" | "critic" | "suggestion";
      category: string;
      title: string;
      message: string;
      status: "open" | "in_progress" | "resolved" | "canceled";
      attachment_key: string | null;
      attachment_file_name: string | null;
      attachment_mime_type: string | null;
      attachment_size: number | null;
      reply: string | null;
      replied_at: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `
        insert into merchant_feedback (
          merchant_key,
          user_id,
          type,
          category,
          title,
          message,
          attachment_key,
          attachment_file_name,
          attachment_mime_type,
          attachment_size
        ) values (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10
        )
        returning
          id::text as id,
          type,
          category,
          title,
          message,
          status,
          attachment_key,
          attachment_file_name,
          attachment_mime_type,
          attachment_size,
          reply,
          replied_at::text,
          created_at::text,
          updated_at::text
      `,
      [
        session.merchantKey,
        session.userId,
        type,
        category,
        title,
        message,
        attachment?.key ?? null,
        attachment?.fileName ?? null,
        attachment?.mimeType ?? null,
        attachment?.size ?? null,
      ]
    );
  } catch (error) {
    await deleteFeedbackAttachment(attachment?.key);
    throw error;
  }

  const row = result.rows[0];
  return NextResponse.json(
    {
      feedback: {
        id: row.id,
        type: row.type,
        category: row.category,
        title: row.title,
        message: row.message,
        status: row.status,
        attachment: row.attachment_key
          ? {
              fileName: row.attachment_file_name,
              mimeType: row.attachment_mime_type,
              size: row.attachment_size,
              downloadUrl: `/api/merchant/feedback/${row.id}/attachment`,
            }
          : null,
        reply: row.reply,
        repliedAt: row.replied_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    },
    { status: 201 }
  );
}

export async function PATCH(request: Request) {
  const session = await getCurrentMerchantSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await parseJsonBody(request);
  if (!body?.id || body.status !== "canceled") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const result = await query<{
    id: string;
    status: "open" | "in_progress" | "resolved" | "canceled";
  }>(
    `
      update merchant_feedback
      set
        status = 'canceled',
        updated_at = now()
      where id = $1::bigint
        and merchant_key = $2
        and user_id = $3
        and status in ('open', 'in_progress')
      returning id::text as id, status
    `,
    [body.id, session.merchantKey, session.userId],
  );

  const row = result.rows[0];
  if (!row) {
    return NextResponse.json(
      { error: "Feedback cannot be canceled" },
      { status: 400 },
    );
  }

  return NextResponse.json({ feedback: row });
}
