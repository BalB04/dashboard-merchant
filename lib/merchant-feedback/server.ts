import "server-only";

import { getCurrentMerchantSession } from "@/lib/auth/current-user";
import { query } from "@/lib/db";
import { deleteFeedbackAttachment, saveFeedbackAttachment } from "@/lib/feedback-attachments";
import type { FeedbackItem, FeedbackType } from "@/lib/merchant-dashboard/types";

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

const mapFeedbackRow = (row: {
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
}): FeedbackItem => ({
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
});

export async function createFeedback(input: {
  type: FeedbackType;
  category: string;
  title: string;
  message: string;
  attachmentFile: File | null;
}): Promise<FeedbackItem> {
  const session = await getCurrentMerchantSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const type = input.type;
  const category = input.category.trim();
  const title = input.title.trim();
  const message = input.message.trim();

  if (!type || !category || !title || !message) {
    throw new Error("type, category, title, and message are required");
  }

  let attachment:
    | {
        key: string;
        fileName: string;
        mimeType: string;
        size: number;
      }
    | null
    | undefined;

  if (input.attachmentFile && input.attachmentFile.size > 0) {
    if (input.attachmentFile.size > MAX_ATTACHMENT_SIZE) {
      throw new Error("Attachment must be 10MB or smaller");
    }

    attachment = await saveFeedbackAttachment(input.attachmentFile);
  }

  try {
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
      ],
    );

    return mapFeedbackRow(result.rows[0]);
  } catch (error) {
    await deleteFeedbackAttachment(attachment?.key);
    throw error;
  }
}

export async function cancelFeedback(id: string): Promise<void> {
  const session = await getCurrentMerchantSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const result = await query<{ id: string }>(
    `
      update merchant_feedback
      set
        status = 'canceled',
        updated_at = now()
      where id = $1::bigint
        and merchant_key = $2
        and user_id = $3
        and status in ('open', 'in_progress')
      returning id::text as id
    `,
    [id, session.merchantKey, session.userId],
  );

  if (!result.rows[0]) {
    throw new Error("Feedback cannot be canceled");
  }
}
