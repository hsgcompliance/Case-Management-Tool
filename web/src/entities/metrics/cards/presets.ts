import type { MetricColorId } from "@lib/colorRegistry";

export const myDefaultMetrics: MetricColorId[] = [
  "my-customers",
  "my-enrollments",
  "my-acuity",
  "my-open-tasks",
];

export const systemDefaultMetrics: MetricColorId[] = [
  "system-case-managers",
  "system-customers",
  "system-enrollments",
  "system-grants",
];

export const extendedSystemDefaultMetrics: MetricColorId[] = [
  ...systemDefaultMetrics,
  "system-spend",
  "system-avg-acuity",
];

export const populationDefaultMetrics: MetricColorId[] = [
  "pop-youth",
  "pop-family",
  "pop-individual",
];

export const metricCardPresets = {
  myDefaultMetrics,
  systemDefaultMetrics,
  extendedSystemDefaultMetrics,
  populationDefaultMetrics,
} as const;

export const MY_DEFAULT_METRICS = myDefaultMetrics;
export const SYSTEM_DEFAULT_METRICS = systemDefaultMetrics;
export const EXTENDED_SYSTEM_DEFAULT_METRICS = extendedSystemDefaultMetrics;
