"use client";

import * as React from "react";

type FeedbackType = "report" | "critic" | "suggestion";

type HistoryItem = {
  id: string;
  type: FeedbackType;
  title: string;
  status: "open" | "in_progress" | "resolved";
  createdAt: string;
  reply: string;
};

const sampleHistory: HistoryItem[] = [
  {
    id: "FB-1028",
    type: "report",
    title: "Daily trend data delayed after midnight",
    status: "in_progress",
    createdAt: "2026-03-02",
    reply: "Provider team is checking ETL schedule.",
  },
  {
    id: "FB-1022",
    type: "suggestion",
    title: "Need export button for transaction detail",
    status: "open",
    createdAt: "2026-02-28",
    reply: "Received, queued for roadmap review.",
  },
  {
    id: "FB-1009",
    type: "critic",
    title: "Rule table too dense on small screen",
    status: "resolved",
    createdAt: "2026-02-20",
    reply: "Layout spacing patch deployed.",
  },
];

export function FeedbackContent() {
  const [tab, setTab] = React.useState<"create" | "history">("create");

  return (
    <div className="space-y-4 px-3 py-3 md:px-5">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-xl font-semibold text-slate-900">Feedback Center</div>
        <div className="text-sm text-slate-500">Report issue, critic, and suggestion to provider</div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-1 rounded-md bg-slate-100 p-1 text-xs w-fit">
          <button
            type="button"
            onClick={() => setTab("create")}
            className={`rounded px-3 py-1.5 font-semibold ${tab === "create" ? "bg-white text-slate-800" : "text-slate-500"}`}
          >
            Create Feedback
          </button>
          <button
            type="button"
            onClick={() => setTab("history")}
            className={`rounded px-3 py-1.5 font-semibold ${tab === "history" ? "bg-white text-slate-800" : "text-slate-500"}`}
          >
            History
          </button>
        </div>

        {tab === "create" ? <CreateFeedbackForm /> : <FeedbackHistory />}
      </div>
    </div>
  );
}

function CreateFeedbackForm() {
  return (
    <form className="grid gap-3">
      <div className="grid gap-3 md:grid-cols-3">
        <FieldSelect label="Type" options={["report", "critic", "suggestion"]} />
        <FieldSelect label="Category" options={["UI", "Data", "Rule", "Promotion", "Other"]} />
        <FieldInput label="Title" placeholder="Short summary" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-600">Message</label>
        <textarea
          className="min-h-[120px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          placeholder="Describe issue, criticism, or suggestion..."
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-semibold text-slate-600">Attachment (optional)</label>
        <input type="file" className="block w-full text-sm" />
      </div>
      <div className="flex justify-end">
        <button type="button" className="rounded-md bg-[#0E1A35] px-4 py-2 text-sm font-semibold text-white">
          Submit
        </button>
      </div>
    </form>
  );
}

function FeedbackHistory() {
  return (
    <div>
      <div className="space-y-2 md:hidden">
        {sampleHistory.map((item) => (
          <div key={item.id} className="rounded-lg border border-slate-200 p-3 text-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-700">{item.id}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                  item.status === "resolved"
                    ? "bg-emerald-100 text-emerald-700"
                    : item.status === "in_progress"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-slate-100 text-slate-600"
                }`}
              >
                {item.status}
              </span>
            </div>
            <div className="text-xs text-slate-500">{item.createdAt}</div>
            <div className="mt-2 text-sm font-semibold text-slate-800">{item.title}</div>
            <div className="mt-1 text-xs text-slate-500">Type: {item.type}</div>
            <div className="mt-2 text-xs text-slate-600">{item.reply}</div>
          </div>
        ))}
      </div>
      <div className="hidden overflow-auto md:block">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-[#0E1A35] text-white">
            <tr>
              <th className="px-3 py-2 text-left">Ticket</th>
              <th className="px-3 py-2 text-left">Type</th>
            <th className="px-3 py-2 text-left">Title</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2 text-left">Created</th>
            <th className="px-3 py-2 text-left">Provider Reply</th>
            </tr>
          </thead>
          <tbody>
            {sampleHistory.map((item) => (
              <tr key={item.id} className="border-b border-slate-100">
              <td className="px-3 py-2 font-medium">{item.id}</td>
              <td className="px-3 py-2 capitalize">{item.type}</td>
              <td className="px-3 py-2">{item.title}</td>
              <td className="px-3 py-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    item.status === "resolved"
                      ? "bg-emerald-100 text-emerald-700"
                      : item.status === "in_progress"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {item.status}
                </span>
              </td>
              <td className="px-3 py-2">{item.createdAt}</td>
              <td className="px-3 py-2 text-slate-600">{item.reply}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FieldInput({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-600">{label}</label>
      <input className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" placeholder={placeholder} />
    </div>
  );
}

function FieldSelect({ label, options }: { label: string; options: string[] }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-600">{label}</label>
      <select className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
