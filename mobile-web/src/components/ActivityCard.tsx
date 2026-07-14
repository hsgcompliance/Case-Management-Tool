import type { TCmActivity, TCmActivityType } from "@hdb/contracts";
import { SyncChip } from "@/components/SyncControls";

const TYPE_STYLES: Record<TCmActivityType, { label: string; bg: string; text: string }> = {
  "in-person": { label: "In Person", bg: "bg-green-100", text: "text-green-700" },
  phone: { label: "Phone", bg: "bg-blue-100", text: "text-blue-700" },
  "data-entry": { label: "Data Entry", bg: "bg-purple-100", text: "text-purple-700" },
  other: { label: "Other", bg: "bg-slate-100", text: "text-slate-600" },
};

interface Props {
  activity: TCmActivity;
}

export function ActivityCard({ activity }: Props) {
  const style = TYPE_STYLES[activity.type] ?? TYPE_STYLES.other;

  const timeLabel =
    activity.startTime
      ? activity.endTime
        ? `${activity.startTime} – ${activity.endTime}`
        : activity.startTime
      : null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 px-4 py-3 space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-slate-900 leading-tight">{activity.customerName || activity.customerId}</p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${style.bg} ${style.text}`}>
          {style.label}
        </span>
      </div>

      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span>{activity.date}</span>
        {timeLabel && <span>{timeLabel}</span>}
        {activity.calendarSynced && (
          <span className="text-indigo-400">📅 synced</span>
        )}
        <SyncChip kind={activity.workbookSynced ? "synced" : "notsynced"} className="ml-auto" />
      </div>

      {activity.note && (
        <p className="text-sm text-slate-600 leading-snug">{activity.note}</p>
      )}
    </div>
  );
}
