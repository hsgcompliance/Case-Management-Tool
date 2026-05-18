"use client";

export type ColorTone = "slate" | "sky" | "emerald" | "amber" | "orange" | "violet" | "rose";

type ToneClasses = {
  chip: string;
  activeChip: string;
  pill: string;
  card: string;
  text: string;
  progress: string;
};

export const TONE_CLASS_REGISTRY: Record<ColorTone, ToneClasses> = {
  slate: {
    chip: "border-slate-200 bg-slate-50 text-slate-700",
    activeChip: "border-slate-300 bg-slate-100 text-slate-900",
    pill: "border-slate-200 bg-white text-slate-700",
    card: "border-slate-200 bg-slate-50/70 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
    text: "text-slate-700 dark:text-slate-300",
    progress: "from-slate-300 to-slate-500",
  },
  sky: {
    chip: "border-sky-200 bg-sky-50 text-sky-800",
    activeChip: "border-sky-300 bg-sky-100 text-sky-900",
    pill: "border-sky-200 bg-sky-50 text-sky-800",
    card: "border-sky-200 bg-sky-50/70 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-300",
    text: "text-sky-700 dark:text-sky-300",
    progress: "from-sky-400 to-cyan-400",
  },
  emerald: {
    chip: "border-emerald-200 bg-emerald-50 text-emerald-800",
    activeChip: "border-emerald-300 bg-emerald-100 text-emerald-900",
    pill: "border-emerald-200 bg-emerald-50 text-emerald-800",
    card: "border-emerald-200 bg-emerald-50/70 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300",
    text: "text-emerald-700 dark:text-emerald-300",
    progress: "from-emerald-400 to-green-400",
  },
  amber: {
    chip: "border-amber-200 bg-amber-50 text-amber-800",
    activeChip: "border-amber-300 bg-amber-100 text-amber-900",
    pill: "border-amber-200 bg-amber-50 text-amber-800",
    card: "border-amber-200 bg-amber-50/70 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300",
    text: "text-amber-700 dark:text-amber-300",
    progress: "from-amber-400 to-orange-300",
  },
  orange: {
    chip: "border-orange-200 bg-orange-50 text-orange-800",
    activeChip: "border-orange-300 bg-orange-100 text-orange-900",
    pill: "border-orange-200 bg-orange-50 text-orange-800",
    card: "border-orange-200 bg-orange-50/70 text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/30 dark:text-orange-300",
    text: "text-orange-700 dark:text-orange-300",
    progress: "from-orange-400 to-amber-300",
  },
  violet: {
    chip: "border-violet-200 bg-violet-50 text-violet-800",
    activeChip: "border-violet-300 bg-violet-100 text-violet-900",
    pill: "border-violet-200 bg-violet-50 text-violet-800",
    card: "border-violet-200 bg-violet-50/70 text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-300",
    text: "text-violet-700 dark:text-violet-300",
    progress: "from-violet-400 to-fuchsia-400",
  },
  rose: {
    chip: "border-rose-200 bg-rose-50 text-rose-800",
    activeChip: "border-rose-300 bg-rose-100 text-rose-900",
    pill: "border-rose-200 bg-rose-50 text-rose-800",
    card: "border-rose-200 bg-rose-50/70 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300",
    text: "text-rose-700 dark:text-rose-300",
    progress: "from-rose-500 to-orange-400",
  },
};

export type PopulationColorId = "youth" | "family" | "individual" | "unknown";

export const POPULATION_COLOR_REGISTRY: Record<PopulationColorId, { tone: ColorTone; label: string }> = {
  youth: { tone: "sky", label: "Youth" },
  family: { tone: "amber", label: "Family" },
  individual: { tone: "emerald", label: "Individual" },
  unknown: { tone: "slate", label: "Unknown" },
};

export type StatusColorId =
  | "active"
  | "inactive"
  | "closed"
  | "deleted"
  | "draft"
  | "open"
  | "done"
  | "verified"
  | "warning"
  | "over"
  | "overdue"
  | "assigned"
  | "shared"
  | "secondary"
  | "primary"
  | "unknown";

export const STATUS_COLOR_REGISTRY: Record<StatusColorId, { tone: ColorTone; label: string }> = {
  active: { tone: "emerald", label: "Active" },
  inactive: { tone: "slate", label: "Inactive" },
  closed: { tone: "amber", label: "Closed" },
  deleted: { tone: "rose", label: "Deleted" },
  draft: { tone: "slate", label: "Draft" },
  open: { tone: "sky", label: "Open" },
  done: { tone: "emerald", label: "Done" },
  verified: { tone: "violet", label: "Verified" },
  warning: { tone: "amber", label: "Warning" },
  over: { tone: "rose", label: "Over" },
  overdue: { tone: "rose", label: "Overdue" },
  assigned: { tone: "slate", label: "Assigned" },
  shared: { tone: "violet", label: "Shared" },
  secondary: { tone: "emerald", label: "Secondary" },
  primary: { tone: "sky", label: "Primary" },
  unknown: { tone: "slate", label: "Unknown" },
};

export type MetricColorId =
  | "my-customers"
  | "my-enrollments"
  | "my-acuity"
  | "my-open-tasks"
  | "system-case-managers"
  | "system-customers"
  | "system-enrollments"
  | "system-grants"
  | "system-spend"
  | "system-avg-acuity"
  | "case-managers"
  | "assessments-due"
  | "payments-due"
  | "open-tasks"
  | "inbox-open"
  | "inbox-completed"
  | "inbox-shared"
  | "inbox-assigned"
  | "inbox-overdue"
  | "tracked-cards"
  | "card-spent"
  | "card-remaining"
  | "pending-jotform"
  | "grant-active-enrollments"
  | "grant-unique-clients"
  // Population chips
  | "pop-youth"
  | "pop-family"
  | "pop-individual"
  // Pinned grant chips
  | "pinned-grant-available"
  | "pinned-grant-projected-spend"
  // Pinned credit card chip
  | "pinned-card-remaining";

export const METRIC_COLOR_REGISTRY: Record<MetricColorId, { tone: ColorTone; label: string; group: string }> = {
  "my-customers": { tone: "orange", label: "My Customers", group: "caseload" },
  "my-enrollments": { tone: "emerald", label: "My Enrollments", group: "caseload" },
  "my-acuity": { tone: "amber", label: "My Acuity", group: "acuity" },
  "my-open-tasks": { tone: "sky", label: "My Open Tasks", group: "tasks" },
  "system-case-managers": { tone: "sky", label: "Total Case Managers", group: "system" },
  "system-customers": { tone: "slate", label: "Total Customers", group: "system" },
  "system-enrollments": { tone: "emerald", label: "Total Enrollments", group: "system" },
  "system-grants": { tone: "amber", label: "Grants & Programs", group: "system" },
  "system-spend": { tone: "orange", label: "Total Spend Amount", group: "finance" },
  "system-avg-acuity": { tone: "amber", label: "System Avg Acuity", group: "acuity" },
  "case-managers": { tone: "sky", label: "Case Managers", group: "system" },
  "assessments-due": { tone: "violet", label: "Assessments Due", group: "tasks" },
  "payments-due": { tone: "amber", label: "Payments Due", group: "tasks" },
  "open-tasks": { tone: "sky", label: "Open Tasks", group: "tasks" },
  "inbox-open": { tone: "sky", label: "Open", group: "tasks" },
  "inbox-completed": { tone: "emerald", label: "Completed", group: "tasks" },
  "inbox-shared": { tone: "violet", label: "Shared", group: "tasks" },
  "inbox-assigned": { tone: "slate", label: "Assigned", group: "tasks" },
  "inbox-overdue": { tone: "rose", label: "Overdue", group: "tasks" },
  "tracked-cards": { tone: "sky", label: "Tracked Cards", group: "finance" },
  "card-spent": { tone: "orange", label: "Spent", group: "finance" },
  "card-remaining": { tone: "emerald", label: "Remaining Limit", group: "finance" },
  "pending-jotform": { tone: "amber", label: "Pending Jotform", group: "finance" },
  "grant-active-enrollments": { tone: "emerald", label: "Active Enrollments", group: "caseload" },
  "grant-unique-clients": { tone: "sky", label: "Unique Clients", group: "caseload" },
  // Population
  "pop-youth": { tone: "sky", label: "Youth", group: "population" },
  "pop-family": { tone: "amber", label: "Family", group: "population" },
  "pop-individual": { tone: "emerald", label: "Individual", group: "population" },
  // Pinned grant
  "pinned-grant-available": { tone: "emerald", label: "Grant Available", group: "finance" },
  "pinned-grant-projected-spend": { tone: "orange", label: "Grant Projected Spend", group: "finance" },
  // Pinned credit card
  "pinned-card-remaining": { tone: "emerald", label: "Card Remaining", group: "finance" },
};

export function toneChipClass(tone: ColorTone): string {
  return TONE_CLASS_REGISTRY[tone]?.chip || TONE_CLASS_REGISTRY.slate.chip;
}

export function toneActiveChipClass(tone: ColorTone): string {
  return TONE_CLASS_REGISTRY[tone]?.activeChip || TONE_CLASS_REGISTRY.slate.activeChip;
}

export function tonePillClass(tone: ColorTone): string {
  return TONE_CLASS_REGISTRY[tone]?.pill || TONE_CLASS_REGISTRY.slate.pill;
}

export function toneCardClass(tone: ColorTone): string {
  return TONE_CLASS_REGISTRY[tone]?.card || TONE_CLASS_REGISTRY.slate.card;
}

export function toneTextClass(tone: ColorTone): string {
  return TONE_CLASS_REGISTRY[tone]?.text || TONE_CLASS_REGISTRY.slate.text;
}

export function toneProgressClass(tone: ColorTone): string {
  return TONE_CLASS_REGISTRY[tone]?.progress || TONE_CLASS_REGISTRY.slate.progress;
}

export function populationTone(population: unknown): ColorTone {
  const key = String(population || "").trim().toLowerCase() as PopulationColorId;
  return POPULATION_COLOR_REGISTRY[key]?.tone || POPULATION_COLOR_REGISTRY.unknown.tone;
}

export function populationChipClass(population: unknown): string {
  return toneChipClass(populationTone(population));
}

export function statusTone(status: unknown): ColorTone {
  const key = String(status || "").trim().toLowerCase() as StatusColorId;
  return STATUS_COLOR_REGISTRY[key]?.tone || STATUS_COLOR_REGISTRY.unknown.tone;
}

export function statusChipClass(status: unknown): string {
  return toneChipClass(statusTone(status));
}

export function statusTextClass(status: unknown): string {
  return toneTextClass(statusTone(status));
}

export function metricTone(metricId: MetricColorId): ColorTone {
  return METRIC_COLOR_REGISTRY[metricId]?.tone || "slate";
}

export function metricPillClass(metricId: MetricColorId): string {
  return tonePillClass(metricTone(metricId));
}

export function metricCardClass(metricId: MetricColorId): string {
  return toneCardClass(metricTone(metricId));
}

export function metricChipClass(metricId: MetricColorId, active = false): string {
  return active ? toneActiveChipClass(metricTone(metricId)) : toneChipClass(metricTone(metricId));
}

export function metricTextClass(metricId: MetricColorId): string {
  return toneTextClass(metricTone(metricId));
}

export function metricProgressClass(metricId: MetricColorId): string {
  return toneProgressClass(metricTone(metricId));
}

// ─── Grant Accent Color palette ───────────────────────────────────────────────
// 7-color palette for grant budget groups, cards, tags, and spending presets.
// Chosen for max visual separation — one cool blue, one green, one warm yellow,
// one purple, one red-pink, one orange, one neutral. Keep lookups here so every
// feature (budget config, grant tags, spending views) stays in sync.
//
// Population semantics (pastels via TONE_CLASS_REGISTRY):
//   Youth → sky  |  Family → amber  |  Individual → emerald
//
// Metric semantics (7 tones via ColorTone):
//   sky=tasks/workflow  emerald=positive/available  amber=pending/attention
//   orange=caseload/clients  violet=compliance/assessments  rose=urgent/overdue
//   slate=neutral/system

export const GRANT_ACCENT_COLORS = [
  "sky", "emerald", "amber", "violet", "rose", "orange", "slate",
] as const;

export type GrantAccentColor = typeof GRANT_ACCENT_COLORS[number];

type GrantAccentClasses = {
  /** Badge / chip with light bg + dark mode variants */
  chip: string;
  /** Solid filled dot / strip */
  solid: string;
  /** Focus / selected ring color */
  ring: string;
  /** Left accent border on cards */
  leftBorder: string;
  /** Subtle tinted header background */
  headerBg: string;
};

export const GRANT_ACCENT_REGISTRY: Record<GrantAccentColor, GrantAccentClasses> = {
  sky:     { chip: "border-sky-300 bg-sky-100 text-sky-800 dark:border-sky-700 dark:bg-sky-900/40 dark:text-sky-200",         solid: "bg-sky-500",     ring: "ring-sky-400",     leftBorder: "border-l-sky-400",     headerBg: "bg-sky-50 dark:bg-sky-900/25"     },
  emerald: { chip: "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200", solid: "bg-emerald-500", ring: "ring-emerald-400", leftBorder: "border-l-emerald-400", headerBg: "bg-emerald-50 dark:bg-emerald-900/25" },
  amber:   { chip: "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-200",    solid: "bg-amber-400",   ring: "ring-amber-400",   leftBorder: "border-l-amber-400",   headerBg: "bg-amber-50 dark:bg-amber-900/25"   },
  violet:  { chip: "border-violet-300 bg-violet-100 text-violet-800 dark:border-violet-700 dark:bg-violet-900/40 dark:text-violet-200",  solid: "bg-violet-500",  ring: "ring-violet-400",  leftBorder: "border-l-violet-400",  headerBg: "bg-violet-50 dark:bg-violet-900/25"  },
  rose:    { chip: "border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-700 dark:bg-rose-900/40 dark:text-rose-200",      solid: "bg-rose-500",    ring: "ring-rose-400",    leftBorder: "border-l-rose-400",    headerBg: "bg-rose-50 dark:bg-rose-900/25"    },
  orange:  { chip: "border-orange-300 bg-orange-100 text-orange-800 dark:border-orange-700 dark:bg-orange-900/40 dark:text-orange-200",  solid: "bg-orange-500",  ring: "ring-orange-400",  leftBorder: "border-l-orange-400",  headerBg: "bg-orange-50 dark:bg-orange-900/25"  },
  slate:   { chip: "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200",   solid: "bg-slate-400",   ring: "ring-slate-400",   leftBorder: "border-l-slate-400",   headerBg: "bg-slate-100 dark:bg-slate-800/40" },
};

export function isGrantAccentColor(color: unknown): color is GrantAccentColor {
  return typeof color === "string" && (GRANT_ACCENT_COLORS as readonly string[]).includes(color);
}

const _defaultAccentEntry = GRANT_ACCENT_REGISTRY.slate;

export function grantAccentChip(color: string | null | undefined): string {
  const c = color && isGrantAccentColor(color) ? color : null;
  return c ? GRANT_ACCENT_REGISTRY[c].chip : _defaultAccentEntry.chip;
}

export function grantAccentSolid(color: string | null | undefined): string {
  const c = color && isGrantAccentColor(color) ? color : null;
  return c ? GRANT_ACCENT_REGISTRY[c].solid : _defaultAccentEntry.solid;
}

export function grantAccentRing(color: string | null | undefined): string {
  const c = color && isGrantAccentColor(color) ? color : null;
  return c ? GRANT_ACCENT_REGISTRY[c].ring : _defaultAccentEntry.ring;
}

export function grantAccentLeftBorder(color: string | null | undefined): string | null {
  return color && isGrantAccentColor(color) ? GRANT_ACCENT_REGISTRY[color].leftBorder : null;
}

export function grantAccentHeaderBg(color: string | null | undefined): string | null {
  return color && isGrantAccentColor(color) ? GRANT_ACCENT_REGISTRY[color].headerBg : null;
}
