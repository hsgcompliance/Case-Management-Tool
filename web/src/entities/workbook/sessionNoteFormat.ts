// Progress-note row formatting for the structured view's "Add session" form.
// MIRROR of mobile-web/src/lib/sessionSync.ts (the mobile sync engine's shared
// helpers) — keep the two in lockstep so a note pushed from the website is
// byte-identical to one pushed from the mobile app.

export type SessionType = "in-person" | "phone" | "data-entry" | "other";

export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  "in-person": "In Person",
  phone: "Phone",
  "data-entry": "Data Entry",
  other: "On Behalf of",
};

/** Initials from a display name: "Griffin Seyfried" → "GS"; single token → first 2. */
export function staffInitials(name?: string | null): string {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** "2026-06-18" → "6/18/2026" for the in-note signature line. */
export function prettyDate(iso: string): string {
  const [y, m, d] = String(iso || "").split("-").map((n) => Number(n));
  if (!y || !m || !d) return iso;
  return `${m}/${d}/${y}`;
}

/** Build the progress-note Summary cell — self-contained + signed (variant-safe). */
export function buildProgressNoteSummary(args: {
  type: SessionType;
  note?: string;
  date: string;
  staffInitial: string;
}): string {
  const modality = SESSION_TYPE_LABELS[args.type] ?? "";
  const noteBody = [modality, (args.note ?? "").trim()].filter(Boolean).join(" — ");
  const signature = [args.staffInitial, prettyDate(args.date)].filter(Boolean).join(" · ");
  return [noteBody, signature ? `— ${signature}` : ""].filter(Boolean).join("\n");
}

/** Linked Plan Goal column — "Goal #1, Goal #3" from selected 1-based numbers. */
export function buildLinkedPlanGoal(linkedGoals: number[]): string {
  return linkedGoals.map((n) => `Goal #${n}`).join(", ");
}

/** Field map for appendCustomerWorkbookRow → progressNotes. */
export function buildProgressNoteValues(args: {
  session: { type: SessionType; date: string; startTime?: string; endTime?: string; note?: string };
  staffName: string;
  staffInitial: string;
  linkedGoals: number[];
}): Record<string, string> {
  const { session, staffName, staffInitial, linkedGoals } = args;
  const summary = buildProgressNoteSummary({
    type: session.type,
    note: session.note,
    date: session.date,
    staffInitial,
  });
  const linkedPlanGoal = buildLinkedPlanGoal(linkedGoals);
  return {
    progressDate: session.date,
    ...(session.startTime ? { startTime: session.startTime } : {}),
    ...(session.endTime ? { endTime: session.endTime } : {}),
    ...(summary ? { summary } : {}),
    ...(linkedPlanGoal ? { linkedPlanGoal } : {}),
    ...(staffName ? { staffName } : {}),
    ...(staffInitial ? { staffInitial } : {}),
  };
}
