import { NextResponse } from "next/server";

import { getCurrentMerchantSession } from "@/lib/auth/current-user";
import { query } from "@/lib/db";

type FeedbackPayload = {
  type?: "report" | "critic" | "suggestion";
  category?: string;
  title?: string;
  message?: string;
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
    status: "open" | "in_progress" | "resolved";
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

  let body: FeedbackPayload;
  try {
    body = (await request.json()) as FeedbackPayload;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const type = body.type;
  const category = body.category?.trim();
  const title = body.title?.trim();
  const message = body.message?.trim();

  if (!type || !category || !title || !message) {
    return NextResponse.json(
      { error: "type, category, title, and message are required" },
      { status: 400 }
    );
  }

  const result = await query<{
    id: string;
    type: "report" | "critic" | "suggestion";
    category: string;
    title: string;
    message: string;
    status: "open" | "in_progress" | "resolved";
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
        message
      ) values (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6
      )
      returning
        id::text as id,
        type,
        category,
        title,
        message,
        status,
        reply,
        replied_at::text,
        created_at::text,
        updated_at::text
    `,
    [session.merchantKey, session.userId, type, category, title, message]
  );

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
        reply: row.reply,
        repliedAt: row.replied_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    },
    { status: 201 }
  );
}
