"use client";

// "Add session" form for the structured view's Progress Notes section — the
// website counterpart of the mobile app's Log Session flow. Saves the session
// to the shared cmActivities activity log FIRST (same doc shape the mobile
// app's All Sessions feed and per-customer Sessions tab query), then pushes a
// progress-note row formatted by the SAME shared helpers (sessionNoteFormat.ts
// mirrors mobile-web/src/lib/sessionSync.ts), so a session logged here is
// indistinguishable from one logged on the phone.

import React from "react";
import Link from "next/link";
import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import api from "@client/api";
import { useAuth } from "@app/auth/AuthProvider";
import { useGoogleIntegrationStatus } from "@hooks/useGoogleIntegrations";
import { db } from "@lib/firebase";
import { getGoogleDriveAccessToken } from "@lib/googleDriveAccessToken";
import { toast } from "@lib/toast";
import type { User } from "firebase/auth";
import {
  buildProgressNoteValues,
  staffInitials,
  type SessionType,
} from "./sessionNoteFormat";

// ── cmActivities write (MIRROR of mobile-web/src/hooks/useCreateActivity.ts) ──
// The mobile feed/per-customer views query cmActivities by caseManagerId, so
// the doc shape here must stay in lockstep with the mobile createActivity.

function resolveOrgId(claims: Record<string, unknown>): string | undefined {
  // Mirror orgIdFromClaims() in functions/src/core/org.ts — supports all claim shapes.
  const direct =
    (claims.orgId as string) ||
    (claims.orgID as string) ||
    (claims.organizationId as string) ||
    (claims.org as string) ||
    undefined;
  if (direct) return direct;
  for (const nested of [claims.customClaims, claims.claims] as Record<string, unknown>[]) {
    if (!nested || typeof nested !== "object") continue;
    const id =
      (nested.orgId as string) ||
      (nested.orgID as string) ||
      (nested.org as string) ||
      undefined;
    if (id) return id;
  }
  return undefined;
}

async function createActivityDoc(user: User, body: {
  customerId: string;
  customerName: string;
  type: SessionType;
  date: string;
  startTime?: string;
  endTime?: string;
  note?: string;
}): Promise<string> {
  const { claims } = await user.getIdTokenResult();
  const orgId = resolveOrgId(claims as Record<string, unknown>);
  // Only write orgId if resolved — omitting it lets sameOrg() in Firestore rules pass.
  const ref = await addDoc(collection(db, "cmActivities"), {
    ...(orgId ? { orgId } : {}),
    caseManagerId: user.uid,
    caseManagerName: user.displayName ?? "",
    customerId: body.customerId,
    customerName: body.customerName ?? "",
    type: body.type,
    date: body.date,
    startTime: body.startTime ?? null,
    endTime: body.endTime ?? null,
    note: body.note ?? null,
    calendarSynced: false,
    workbookSynced: false,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

async function markSessionWorkbookSynced(sessionId: string, rowKey?: string): Promise<void> {
  await updateDoc(doc(db, "cmActivities", sessionId), {
    workbookSynced: true,
    workbookSyncedAt: new Date().toISOString(),
    ...(rowKey ? { workbookRowKey: rowKey } : {}),
    updatedAt: serverTimestamp(),
  });
}

const TYPES: { value: SessionType; label: string; emoji: string }[] = [
  { value: "in-person",  label: "In Person",   emoji: "🤝" },
  { value: "phone",      label: "Phone",        emoji: "📞" },
  { value: "data-entry", label: "Data Entry",   emoji: "💻" },
  { value: "other",      label: "On Behalf of", emoji: "📋" },
];

// LOCAL date, not UTC: toISOString() rolls to tomorrow in the evening (UTC-6/7),
// which would date the session outside the mobile feed's Today/Week/Month windows.
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function driveHeaders() {
  const token = getGoogleDriveAccessToken();
  return token ? { "x-drive-access-token": token } : undefined;
}

export type GoalOption = { n: number; label: string };

export function AddSessionForm({
  customerId,
  customerName,
  goals,
  onSaved,
  onCancel,
}: {
  customerId: string;
  customerName?: string;
  /** Structured goals from the workbook extract, numbered by table position. */
  goals: GoalOption[];
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { user, profile } = useAuth();
  const staffName = String(profile?.displayName ?? user?.displayName ?? "").trim();

  const [type, setType] = React.useState<SessionType>("in-person");
  const [date, setDate] = React.useState(todayISO());
  const [startTime, setStartTime] = React.useState("");
  const [endTime, setEndTime] = React.useState("");
  const [note, setNote] = React.useState("");
  const [linkedGoals, setLinkedGoals] = React.useState<number[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const toggleGoal = (n: number) =>
    setLinkedGoals((cur) => (cur.includes(n) ? cur.filter((g) => g !== n) : [...cur, n].sort((a, b) => a - b)));

  // Calendar push — defaults from the user's saved pref, like AddRowForm.
  const calendarPushDefault = Boolean(
    (profile?.settings as { calendarPushDefault?: unknown } | undefined)?.calendarPushDefault,
  );
  const calStatusQ = useGoogleIntegrationStatus("googleCalendar", { staleTime: 60_000 });
  const calConnected = !!(
    (calStatusQ.data as Record<string, unknown> | undefined)?.connected === true ||
    (calStatusQ.data as Record<string, unknown> | undefined)?.permissionStatus === "connected"
  );
  const [pushCalendar, setPushCalendar] = React.useState(false);
  React.useEffect(() => { setPushCalendar(calendarPushDefault); }, [calendarPushDefault]);
  const [calNotice, setCalNotice] = React.useState(false);
  // Session doc saved but the workbook push stalled — amber notice; Close refreshes.
  const [savedNotice, setSavedNotice] = React.useState<string | null>(null);

  const save = async () => {
    if (!date) { setError("Pick a session date."); return; }
    if (!user) { setError("You must be signed in to log a session."); return; }
    setSaving(true);
    setError(null);
    setCalNotice(false);
    setSavedNotice(null);

    // 1. Save the session to the shared activity log FIRST (mobile parity: the
    //    record must exist even if the calendar/workbook pushes fail — the
    //    mobile app's per-row Sync can retry those later).
    let sessionId: string;
    try {
      sessionId = await createActivityDoc(user, {
        customerId,
        customerName: customerName || "",
        type,
        date,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        note: note.trim() || undefined,
      });
    } catch (e: unknown) {
      setError(String((e as Error)?.message || "Could not save the session."));
      setSaving(false);
      return;
    }

    // 2. Push the progress-note row to the workbook (independent of calendar).
    let workbookError: string | null = null;
    try {
      const values = buildProgressNoteValues({
        session: {
          type,
          date,
          startTime: startTime || undefined,
          endTime: endTime || undefined,
          note: note.trim() || undefined,
        },
        staffName,
        staffInitial: staffInitials(staffName),
        linkedGoals,
      });
      const resp = (await (api as any).postWith(
        "appendCustomerWorkbookRow",
        { customerId, entityId: "progressNotes", values },
        driveHeaders(),
      )) as Record<string, unknown>;
      if (resp?.ok) {
        // Flag the session doc so both apps show it as synced (non-fatal).
        try { await markSessionWorkbookSynced(sessionId, String(resp.rowKey ?? "") || undefined); } catch { /* row is in the sheet regardless */ }
      } else {
        workbookError = String(resp?.error || "workbook push failed");
      }
    } catch (e: unknown) {
      const body = (e as { meta?: { response?: { error?: string } } })?.meta?.response;
      workbookError = String(body?.error || (e as Error)?.message || "workbook push failed");
    }

    // 3. Optional calendar push. Passing the session id lets the backend dedupe
    //    re-submits and stamp calendarSynced/calendarEventId on the doc.
    let calendarFailed = false;
    let showCalNotice = false;
    if (pushCalendar) {
      if (!calConnected) {
        showCalNotice = true;
        setCalNotice(true);
      } else {
        try {
          await (api as any).postWith("calendarPostEvent", {
            customerName: customerName || "Customer",
            type,
            date,
            startTime: startTime || undefined,
            endTime: endTime || undefined,
            note: note.trim() || undefined,
            activityId: sessionId,
          });
        } catch {
          calendarFailed = true;
        }
      }
    }

    setSaving(false);

    // 4. Surface outcomes. The session itself is already in the activity log.
    if (workbookError) {
      setSavedNotice(
        `Session saved to the activity log, but the workbook push failed (${workbookError}). ` +
        "You can retry the sync from the session's row in the mobile app." +
        (calendarFailed ? " Calendar sync also failed — check Settings." : ""),
      );
      return;
    }
    if (calendarFailed) {
      toast("Session logged and added to the sheet. Calendar push failed — check Settings.", { type: "warn" });
      onSaved();
      return;
    }
    if (showCalNotice) {
      return; // calendar-connect notice is showing; Close refreshes
    }
    toast(pushCalendar ? "Session logged, added to the sheet and your calendar." : "Session logged and added to the sheet.", { type: "success" });
    onSaved();
  };

  const inputCls = "input w-full text-sm";

  return (
    <div className="rounded-lg border border-sky-200 bg-sky-50/50 p-3 space-y-3">
      <div className="text-xs font-semibold text-slate-700">New session</div>

      {/* Type */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            disabled={saving}
            onClick={() => setType(t.value)}
            className={`rounded-lg border px-2.5 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition ${
              type === t.value
                ? "border-sky-400 bg-sky-100 text-sky-800"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span>{t.emoji}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Date + time range */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <label className="field block">
          <span className="label text-xs">Date<span className="text-red-500"> *</span></span>
          <input type="date" className={inputCls} value={date} disabled={saving} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="field block">
          <span className="label text-xs">Start time</span>
          <input type="time" className={inputCls} value={startTime} disabled={saving} onChange={(e) => setStartTime(e.target.value)} />
        </label>
        <label className="field block">
          <span className="label text-xs">End time</span>
          <input type="time" className={inputCls} value={endTime} disabled={saving} onChange={(e) => setEndTime(e.target.value)} />
        </label>
      </div>

      {/* Note */}
      <label className="field block">
        <span className="label text-xs">Case note (optional)</span>
        <textarea
          className={`${inputCls} min-h-[72px]`}
          placeholder="Brief notes for your reference…"
          value={note}
          disabled={saving}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      {/* Link to goals — tap to reference plan goals in this note ("Goal #1, #3"). */}
      {goals.length > 0 ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Link to goals</span>
            {linkedGoals.length > 0 ? (
              <span className="text-xs font-semibold text-sky-700">
                Goal {linkedGoals.map((n) => `#${n}`).join(", ")}
              </span>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            {goals.map((g) => {
              const selected = linkedGoals.includes(g.n);
              return (
                <button
                  key={g.n}
                  type="button"
                  disabled={saving}
                  onClick={() => toggleGoal(g.n)}
                  aria-pressed={selected}
                  className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition ${
                    selected
                      ? "border-sky-300 bg-sky-100 text-sky-900"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded text-[10px] font-bold ${
                      selected ? "bg-sky-600 text-white" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {g.n}
                  </span>
                  <span className="flex-1 leading-snug">{g.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {error ? <div className="text-xs text-red-600">{error}</div> : null}

      {/* Calendar push toggle */}
      <label className="flex items-center gap-2 text-xs text-slate-600">
        <input
          type="checkbox"
          className="h-4 w-4 accent-sky-600"
          checked={pushCalendar}
          disabled={saving}
          onChange={(e) => { setPushCalendar(e.target.checked); setCalNotice(false); }}
        />
        Also push this session to my Google Calendar
      </label>

      {calNotice ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Session saved. To push sessions to your calendar, connect Google Calendar in{" "}
          <Link href="/settings" className="font-semibold underline">Settings</Link>.
        </div>
      ) : null}

      {savedNotice ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {savedNotice}
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        {/* After a save that only stalled on a push notice, the session doc is
            already in the activity log — Close refreshes instead of discarding. */}
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={calNotice || savedNotice ? onSaved : onCancel}
          disabled={saving}
        >
          {calNotice || savedNotice ? "Close" : "Cancel"}
        </button>
        {!calNotice && !savedNotice ? (
          <button type="button" className="btn btn-sm btn-primary" onClick={() => void save()} disabled={saving || !date}>
            {saving ? "Saving…" : "Save session"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
