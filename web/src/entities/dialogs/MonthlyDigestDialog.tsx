"use client";

import React from "react";
import Modal from "@entities/ui/Modal";
import { toApiError } from "@client/api";
import { useDigestPreview, useScheduleDigest, useSendDigestNow } from "@hooks/useInbox";
import { toast } from "@lib/toast";

type Props = {
  open: boolean;
  month: string;
  cmUid: string;
  cmName: string;
  onClose: () => void;
};

function defaultScheduleValue(): string {
  const next = new Date(Date.now() + 30 * 60 * 1000);
  const yyyy = next.getFullYear();
  const mm = String(next.getMonth() + 1).padStart(2, "0");
  const dd = String(next.getDate()).padStart(2, "0");
  const hh = String(next.getHours()).padStart(2, "0");
  const mi = String(next.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function readPreviewItems(data: unknown): Array<Record<string, unknown>> {
  if (!data || typeof data !== "object") return [];
  const items = (data as { items?: unknown }).items;
  return Array.isArray(items) ? (items as Array<Record<string, unknown>>) : [];
}

export default function MonthlyDigestDialog({ open, month, cmUid, cmName, onClose }: Props) {
  const previewQ = useDigestPreview(month, cmUid, { enabled: open });
  const sendNow = useSendDigestNow();
  const scheduleSend = useScheduleDigest();

  const [subject, setSubject] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [sendAtLocal, setSendAtLocal] = React.useState(defaultScheduleValue());

  React.useEffect(() => {
    if (!open) return;
    setSubject("");
    setMessage("");
    setSendAtLocal(defaultScheduleValue());
  }, [open, month, cmUid]);

  const items = React.useMemo(() => readPreviewItems(previewQ.data), [previewQ.data]);
  const pending = sendNow.isPending || scheduleSend.isPending;

  const handleSendNow = React.useCallback(async () => {
    try {
      await sendNow.mutateAsync({
        months: [month],
        cmUid,
        combine: true,
        ...(String(subject || "").trim() ? { subject: String(subject).trim() } : {}),
        ...(String(message || "").trim() ? { message: String(message).trim() } : {}),
      });
      toast(`Monthly digest sent to ${cmName}.`, { type: "success" });
      onClose();
    } catch (error: unknown) {
      toast(toApiError(error, "Failed to send digest.").error, { type: "error" });
    }
  }, [sendNow, month, cmUid, subject, message, cmName, onClose]);

  const handleSchedule = React.useCallback(async () => {
    try {
      const sendAt = new Date(sendAtLocal);
      if (!Number.isFinite(sendAt.getTime())) {
        toast("Enter a valid schedule date and time.", { type: "error" });
        return;
      }
      await scheduleSend.mutateAsync({
        months: [month],
        cmUid,
        combine: true,
        sendAt: sendAt.toISOString(),
        ...(String(subject || "").trim() ? { subject: String(subject).trim() } : {}),
        ...(String(message || "").trim() ? { message: String(message).trim() } : {}),
      });
      toast(`Monthly digest scheduled for ${cmName}.`, { type: "success" });
      onClose();
    } catch (error: unknown) {
      toast(toApiError(error, "Failed to schedule digest.").error, { type: "error" });
    }
  }, [scheduleSend, month, cmUid, sendAtLocal, subject, message, cmName, onClose]);

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      widthClass="max-w-4xl"
      title={<span className="text-base font-semibold">Monthly Digest Preview</span>}
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            {cmName} · {month}
          </div>
          <div className="flex items-center gap-2">
            <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={pending}>
              Cancel
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => void handleSchedule()} disabled={pending || previewQ.isLoading}>
              {scheduleSend.isPending ? "Scheduling..." : "Schedule Send"}
            </button>
            <button className="btn btn-sm" onClick={() => void handleSendNow()} disabled={pending || previewQ.isLoading}>
              {sendNow.isPending ? "Sending..." : "Send Now"}
            </button>
          </div>
        </div>
      }
    >
      <div className="grid gap-4 md:grid-cols-[1.1fr,0.9fr]">
        <div className="space-y-3">
          <label className="block">
            <div className="mb-1 text-xs font-medium text-slate-600">Subject override</div>
            <input
              className="input w-full"
              value={subject}
              onChange={(e) => setSubject(e.currentTarget.value)}
              disabled={pending}
              placeholder="Leave blank to use the default digest subject"
            />
          </label>
          <label className="block">
            <div className="mb-1 text-xs font-medium text-slate-600">Intro / custom message</div>
            <textarea
              className="w-full rounded border border-slate-300 p-2 text-sm"
              rows={8}
              value={message}
              onChange={(e) => setMessage(e.currentTarget.value)}
              disabled={pending}
              placeholder="Optional note to include above the digest content"
            />
          </label>
          <label className="block">
            <div className="mb-1 text-xs font-medium text-slate-600">Schedule send</div>
            <input
              type="datetime-local"
              className="input w-full"
              value={sendAtLocal}
              onChange={(e) => setSendAtLocal(e.currentTarget.value)}
              disabled={pending}
            />
          </label>
        </div>

        <div className="space-y-3">
          <div className="rounded border border-slate-200 p-3">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Preview summary</div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
              <div className="rounded border border-slate-200 bg-slate-50 p-2">
                <div className="text-xs text-slate-500">Items</div>
                <div className="text-lg font-semibold">{items.length}</div>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 p-2">
                <div className="text-xs text-slate-500">Open</div>
                <div className="text-lg font-semibold">{items.filter((item) => String(item.status || "") !== "done").length}</div>
              </div>
              <div className="rounded border border-slate-200 bg-slate-50 p-2">
                <div className="text-xs text-slate-500">Done</div>
                <div className="text-lg font-semibold">{items.filter((item) => String(item.status || "") === "done").length}</div>
              </div>
            </div>
          </div>

          <div className="rounded border border-slate-200">
            <div className="border-b border-slate-200 px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-500">
              Tasks included
            </div>
            <div className="max-h-[360px] overflow-auto">
              {previewQ.isLoading ? (
                <div className="p-3 text-sm text-slate-500">Loading preview...</div>
              ) : previewQ.isError ? (
                <div className="p-3 text-sm text-rose-600">Failed to load digest preview.</div>
              ) : items.length ? (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left">Due</th>
                      <th className="px-3 py-2 text-left">Title</th>
                      <th className="px-3 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={String(item.id || item.utid || idx)} className="border-t border-slate-100">
                        <td className="px-3 py-2 align-top">{String(item.dueDate || "—")}</td>
                        <td className="px-3 py-2 align-top">{String(item.title || item.subtitle || "Untitled")}</td>
                        <td className="px-3 py-2 align-top capitalize">{String(item.status || "open")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-3 text-sm text-slate-500">No digest items found for this month.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
