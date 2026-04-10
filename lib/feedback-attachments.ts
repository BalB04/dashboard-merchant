import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const ATTACHMENTS_DIR = path.resolve(process.cwd(), "..", ".feedback-attachments");

const sanitizeExtension = (filename: string) => {
  const extension = path.extname(filename).toLowerCase().replace(/[^a-z0-9.]/g, "");
  return extension.slice(0, 16);
};

export async function saveFeedbackAttachment(file: File) {
  const bytes = Buffer.from(await file.arrayBuffer());
  const key = `${randomUUID()}${sanitizeExtension(file.name)}`;

  await mkdir(ATTACHMENTS_DIR, { recursive: true });
  await writeFile(path.join(ATTACHMENTS_DIR, key), bytes);

  return {
    key,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    size: bytes.byteLength,
  };
}

export async function deleteFeedbackAttachment(key: string | null | undefined) {
  if (!key) {
    return;
  }

  try {
    await unlink(path.join(ATTACHMENTS_DIR, key));
  } catch {
    // Ignore missing file on cleanup.
  }
}

export async function readFeedbackAttachment(key: string) {
  const filePath = path.join(ATTACHMENTS_DIR, key);
  const content = await readFile(filePath);

  return {
    filePath,
    content,
  };
}
