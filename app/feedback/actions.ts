"use server";

import { revalidatePath } from "next/cache";

import { cancelFeedback, createFeedback } from "@/lib/merchant-feedback/server";
import type { FeedbackType } from "@/lib/merchant-dashboard/types";

export async function submitFeedbackAction(formData: FormData) {
  const type = String(formData.get("type") ?? "") as FeedbackType;
  const category = String(formData.get("category") ?? "");
  const title = String(formData.get("title") ?? "");
  const message = String(formData.get("message") ?? "");
  const attachmentValue = formData.get("attachment");
  const attachmentFile = attachmentValue instanceof File && attachmentValue.size > 0 ? attachmentValue : null;

  const feedback = await createFeedback({
    type,
    category,
    title,
    message,
    attachmentFile,
  });

  revalidatePath("/feedback");
  return feedback;
}

export async function cancelFeedbackAction(id: string) {
  await cancelFeedback(id);
  revalidatePath("/feedback");
  return { ok: true as const };
}
