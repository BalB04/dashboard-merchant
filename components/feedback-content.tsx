"use client";

import * as React from "react";

type FeedbackType = "report" | "critic" | "suggestion";
type FeedbackStatus = "open" | "in_progress" | "resolved";
type FeedbackAttachment = {
  fileName: string | null;
  mimeType: string | null;
  size: number | null;
  downloadUrl: string;
};

type FeedbackItem = {
  id: string;
  type: FeedbackType;
  category: string;
  title: string;
  message: string;
  status: FeedbackStatus | "canceled";
  attachment: FeedbackAttachment | null;
  reply: string | null;
  repliedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type FeedbackResponse = {
  feedback: FeedbackItem[];
};

const feedbackTypes: FeedbackType[] = ["report", "critic", "suggestion"];
const feedbackCategories = ["UI", "Data", "Rule", "Promotion", "Other"];

const formatDate = (value: string) =>
  new Date(value).toLocaleString("id-ID", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const statusLabel: Record<FeedbackStatus, string> = {
  open: "open",
  in_progress: "in progress",
  resolved: "resolved",
};

const extendedStatusLabel: Record<FeedbackItem["status"], string> = {
  ...statusLabel,
  canceled: "canceled",
};

const formatFileSize = (value: number | null) => {
  if (!value) return null;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

export function FeedbackContent() {
  const [tab, setTab] = React.useState<"create" | "history">("create");
  const [history, setHistory] = React.useState<FeedbackItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingError, setLoadingError] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [cancelingId, setCancelingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    type: "report" as FeedbackType,
    category: "UI",
    title: "",
    message: "",
  });
  const [attachment, setAttachment] = React.useState<File | null>(null);

  const loadFeedback = React.useCallback(async () => {
    setLoading(true);
    setLoadingError(null);

    try {
      const response = await fetch("/api/merchant/feedback", {
        method: "GET",
        cache: "no-store",
      });

      const body = (await response.json()) as FeedbackResponse | { error?: string };
      if (!response.ok) {
        throw new Error("error" in body && body.error ? body.error : "Failed to load feedback");
      }

      setHistory("feedback" in body && Array.isArray(body.feedback) ? body.feedback : []);
    } catch (cause) {
      setLoadingError(cause instanceof Error ? cause.message : "Failed to load feedback");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadFeedback();
  }, [loadFeedback]);

  const updateField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);
    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("type", form.type);
      formData.append("category", form.category);
      formData.append("title", form.title);
      formData.append("message", form.message);
      if (attachment) {
        formData.append("attachment", attachment);
      }

      const response = await fetch("/api/merchant/feedback", {
        method: "POST",
        body: formData,
      });

      const body = (await response.json()) as
        | { feedback: FeedbackItem }
        | { error?: string };

      if (!response.ok) {
        throw new Error("error" in body && body.error ? body.error : "Failed to submit feedback");
      }

      setForm({
        type: "report",
        category: "UI",
        title: "",
        message: "",
      });
      setAttachment(null);
      setSubmitSuccess("Feedback berhasil dikirim.");
      setTab("history");
      await loadFeedback();
    } catch (cause) {
      setSubmitError(cause instanceof Error ? cause.message : "Failed to submit feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    setCancelingId(id);
    setLoadingError(null);

    try {
      const response = await fetch("/api/merchant/feedback", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, status: "canceled" }),
      });
      const body = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(body.error || "Failed to cancel feedback");
      }

      await loadFeedback();
    } catch (cause) {
      setLoadingError(cause instanceof Error ? cause.message : "Failed to cancel feedback");
    } finally {
      setCancelingId(null);
    }
  };

  return (
    <div className="space-y-4 px-3 py-3 md:px-5">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-xl font-semibold text-slate-900">Pusat Feedback</div>
        <div className="text-sm text-slate-500">
          Sampaikan laporan, kritik, dan saran ke provider
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex w-fit items-center gap-1 rounded-md bg-slate-100 p-1 text-xs">
          <button
            type="button"
            onClick={() => setTab("create")}
            className={`rounded px-3 py-1.5 font-semibold ${
              tab === "create" ? "bg-white text-slate-800" : "text-slate-500"
            }`}
          >
            Buat Feedback
          </button>
          <button
            type="button"
            onClick={() => setTab("history")}
            className={`rounded px-3 py-1.5 font-semibold ${
              tab === "history" ? "bg-white text-slate-800" : "text-slate-500"
            }`}
          >
            Riwayat
          </button>
        </div>

        {tab === "create" ? (
          <CreateFeedbackForm
            form={form}
            isSubmitting={isSubmitting}
            submitError={submitError}
            submitSuccess={submitSuccess}
            onFieldChange={updateField}
            attachment={attachment}
            onAttachmentChange={setAttachment}
            onSubmit={handleSubmit}
          />
        ) : (
          <FeedbackHistory
            history={history}
            loading={loading}
            error={loadingError}
            cancelingId={cancelingId}
            onRetry={loadFeedback}
            onCancel={handleCancel}
          />
        )}
      </div>
    </div>
  );
}

function CreateFeedbackForm({
  form,
  isSubmitting,
  submitError,
  submitSuccess,
  onFieldChange,
  attachment,
  onAttachmentChange,
  onSubmit,
}: {
  form: {
    type: FeedbackType;
    category: string;
    title: string;
    message: string;
  };
  isSubmitting: boolean;
  submitError: string | null;
  submitSuccess: string | null;
  onFieldChange: <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => void;
  attachment: File | null;
  onAttachmentChange: (file: File | null) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return (
    <form className="grid gap-3" onSubmit={(event) => void onSubmit(event)}>
      <div className="grid gap-3 md:grid-cols-3">
        <FieldSelect
          label="Tipe"
          value={form.type}
          options={feedbackTypes}
          onChange={(value) => onFieldChange("type", value as FeedbackType)}
        />
        <FieldSelect
          label="Category"
          value={form.category}
          options={feedbackCategories}
          onChange={(value) => onFieldChange("category", value)}
        />
        <FieldInput
          label="Judul"
          placeholder="Ringkasan singkat"
          value={form.title}
          onChange={(value) => onFieldChange("title", value)}
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-600">Pesan</label>
        <textarea
          className="min-h-[120px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Jelaskan laporan, kritik, atau saran..."
          value={form.message}
          onChange={(event) => onFieldChange("message", event.target.value)}
          disabled={isSubmitting}
          required
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-600">Lampiran (opsional)</label>
        <input
          type="file"
          className="block w-full text-sm"
          onChange={(event) => onAttachmentChange(event.target.files?.[0] ?? null)}
          disabled={isSubmitting}
        />
        <div className="mt-1 text-xs text-slate-500">
          Maksimal 10MB. File yang di-upload akan bisa dilihat dari dashboard merchant dan admin.
          {attachment ? ` Dipilih: ${attachment.name}` : ""}
        </div>
      </div>
      {submitError ? <div className="text-sm text-rose-600">{submitError}</div> : null}
      {submitSuccess ? <div className="text-sm text-emerald-600">{submitSuccess}</div> : null}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-[#0E1A35] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Mengirim..." : "Kirim"}
        </button>
      </div>
    </form>
  );
}

function FeedbackHistory({
  history,
  loading,
  error,
  cancelingId,
  onRetry,
  onCancel,
}: {
  history: FeedbackItem[];
  loading: boolean;
  error: string | null;
  cancelingId: string | null;
  onRetry: () => Promise<void>;
  onCancel: (id: string) => Promise<void>;
}) {
  if (loading) {
    return <div className="py-6 text-sm text-slate-500">Memuat riwayat feedback...</div>;
  }

  if (error) {
    return (
      <div className="space-y-3 py-4">
        <div className="text-sm text-rose-600">{error}</div>
        <button
          type="button"
          onClick={() => void onRetry()}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700"
        >
          Coba lagi
        </button>
      </div>
    );
  }

  if (history.length === 0) {
    return <div className="py-6 text-sm text-slate-500">Belum ada feedback yang tersimpan.</div>;
  }

  return (
    <div>
      <div className="space-y-2 md:hidden">
        {history.map((item) => (
          <div key={item.id} className="rounded-lg border border-slate-200 p-3 text-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-700">#{item.id}</span>
              <StatusBadge status={item.status} />
            </div>
            <div className="text-xs text-slate-500">{formatDate(item.createdAt)}</div>
            <div className="mt-2 text-sm font-semibold text-slate-800">{item.title}</div>
            <div className="mt-1 text-xs text-slate-500">
              Tipe: {item.type} | Category: {item.category}
            </div>
            <div className="mt-2 text-xs text-slate-600">{item.message}</div>
            {item.attachment ? (
              <div className="mt-2 text-xs">
                <a
                  href={item.attachment.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-blue-600 underline"
                >
                  {item.attachment.fileName || "Lihat lampiran"}
                </a>
              </div>
            ) : null}
            <div className="mt-2 text-xs text-slate-600">
              {item.reply ? `Balasan provider: ${item.reply}` : "Belum ada balasan provider."}
            </div>
            {item.status === "open" || item.status === "in_progress" ? (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => void onCancel(item.id)}
                  disabled={cancelingId === item.id}
                  className="rounded-md border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-60"
                >
                  {cancelingId === item.id ? "Membatalkan..." : "Batalkan Tiket"}
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className="hidden overflow-auto md:block">
        <table className="w-full min-w-[1080px] text-sm">
          <thead className="bg-[#0E1A35] text-white">
            <tr>
              <th className="px-3 py-2 text-left">Ticket</th>
              <th className="px-3 py-2 text-left">Tipe</th>
              <th className="px-3 py-2 text-left">Category</th>
              <th className="px-3 py-2 text-left">Judul</th>
              <th className="px-3 py-2 text-left">Pesan</th>
              <th className="px-3 py-2 text-left">Lampiran</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Dibuat</th>
              <th className="px-3 py-2 text-left">Balasan Provider</th>
              <th className="px-3 py-2 text-left">Action</th>
            </tr>
          </thead>
          <tbody>
            {history.map((item) => (
              <tr key={item.id} className="border-b border-slate-100 align-top">
                <td className="px-3 py-2 font-medium">#{item.id}</td>
                <td className="px-3 py-2 capitalize">{item.type}</td>
                <td className="px-3 py-2">{item.category}</td>
                <td className="px-3 py-2">{item.title}</td>
                <td className="px-3 py-2 text-slate-600">{item.message}</td>
                <td className="px-3 py-2 text-slate-600">
                  {item.attachment ? (
                    <a
                      href={item.attachment.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium text-blue-600 underline"
                    >
                      {item.attachment.fileName || "View attachment"}
                      {formatFileSize(item.attachment.size)
                        ? ` (${formatFileSize(item.attachment.size)})`
                        : ""}
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-3 py-2">
                  <StatusBadge status={item.status} />
                </td>
                <td className="px-3 py-2">{formatDate(item.createdAt)}</td>
                <td className="px-3 py-2 text-slate-600">
                  {item.reply ? (
                    <div className="space-y-1">
                      <div>{item.reply}</div>
                      {item.repliedAt ? (
                        <div className="text-xs text-slate-400">{formatDate(item.repliedAt)}</div>
                      ) : null}
                    </div>
                  ) : (
                    "Belum ada balasan provider."
                  )}
                </td>
                <td className="px-3 py-2">
                  {item.status === "open" || item.status === "in_progress" ? (
                    <button
                      type="button"
                      onClick={() => void onCancel(item.id)}
                      disabled={cancelingId === item.id}
                      className="rounded-md border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-60"
                    >
                      {cancelingId === item.id ? "Canceling..." : "Cancel"}
                    </button>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: FeedbackItem["status"] }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        status === "resolved"
          ? "bg-emerald-100 text-emerald-700"
          : status === "in_progress"
            ? "bg-amber-100 text-amber-700"
            : status === "canceled"
              ? "bg-rose-100 text-rose-700"
            : "bg-slate-100 text-slate-600"
      }`}
    >
      {extendedStatusLabel[status]}
    </span>
  );
}

function FieldInput({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-600">{label}</label>
      <input
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
      />
    </div>
  );
}

function FieldSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-600">{label}</label>
      <select
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
