import { db } from "../../core";

function norm(v: unknown) {
  return String(v || "").trim();
}

function fmtEnrollmentName(grantName: string, startDate?: unknown): string | undefined {
  const date = String(startDate || "").trim();
  if (grantName && date) return `${grantName} - ${date}`;
  if (grantName) return grantName;
  return undefined;
}

export async function deriveEnrollmentNames(input: {
  grantId?: unknown;
  customerId?: unknown;
  startDate?: unknown;
  grantDoc?: any | null;
  customerDoc?: any | null;
}) {
  const grantId = norm(input.grantId);
  const customerId = norm(input.customerId);

  let grant = input.grantDoc ?? null;
  let customer = input.customerDoc ?? null;

  if (!grant && grantId) {
    const snap = await db.collection("grants").doc(grantId).get();
    grant = snap.exists ? (snap.data() || null) : null;
  }
  if (!customer && customerId) {
    const snap = await db.collection("customers").doc(customerId).get();
    customer = snap.exists ? (snap.data() || null) : null;
  }

  const grantName = norm(grant?.name) || undefined;
  const customerName =
    norm(customer?.name) ||
    [norm(customer?.firstName), norm(customer?.lastName)].filter(Boolean).join(" ") ||
    undefined;
  const clientName = customerName;
  const name = fmtEnrollmentName(grantName || "", input.startDate);

  const VALID_POPULATIONS = ["Youth", "Individual", "Family"] as const;
  const rawPop = customer?.population;
  const population = VALID_POPULATIONS.includes(rawPop as any)
    ? (rawPop as "Youth" | "Individual" | "Family")
    : null;

  return {
    ...(grantName ? { grantName } : {}),
    ...(customerName ? { customerName } : {}),
    ...(clientName ? { clientName } : {}),
    ...(name ? { name } : {}),
    population,
  };
}

