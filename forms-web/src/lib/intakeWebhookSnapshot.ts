import type { HouseholdInfo, SlotValue } from "./householdExtract";

export type IntakeWebhookSubmission = {
  formId: string;
  formTitle: string;
  submissionId: string;
  receivedAtISO: string | null;
  linkedToCurrent: boolean;
};

export type IntakeWebhookSnapshot = {
  household: HouseholdInfo;
  submissions: IntakeWebhookSubmission[];
};

export type AssistancePrefill = {
  programName: string;
  assistanceStart: string;
  assistanceEnd: string;
  landlordName: string;
  landlordContact: string;
  landlordPhone: string;
  landlordEmail: string;
  landlordAddress: string;
  unitAddress: string;
  monthlyRent: string;
  depositAmount: string;
  arrearsAmount: string;
  proratedAmount: string;
  utilityAmount: string;
};

const EMPTY_PREFILL: AssistancePrefill = {
  programName: "",
  assistanceStart: "",
  assistanceEnd: "",
  landlordName: "",
  landlordContact: "",
  landlordPhone: "",
  landlordEmail: "",
  landlordAddress: "",
  unitAddress: "",
  monthlyRent: "",
  depositAmount: "",
  arrearsAmount: "",
  proratedAmount: "",
  utilityAmount: "",
};

function slotValue(rows: SlotValue[], key: string): string {
  return rows.find((row) => row.key === key)?.found?.value?.trim() || "";
}

function money(value: string): string {
  const match = String(value || "").replace(/,/g, "").match(/-?\d+(?:\.\d{1,2})?/);
  if (!match) return "";
  const amount = Number(match[0]);
  return Number.isFinite(amount) && amount >= 0 ? String(amount) : "";
}

function isoDate(value: string): string {
  const text = String(value || "").trim();
  const iso = text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const us = text.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
  if (us) return `${us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  return "";
}

/** AMI tool-widget prefill: only fields already extracted elsewhere (household size, monthly income). */
export function extractAmiPrefill(snapshot: IntakeWebhookSnapshot | null): { hh?: string; income?: string } {
  if (!snapshot) return {};
  const hh = slotValue(snapshot.household.household, "hhSize");
  const income = money(slotValue(snapshot.household.household, "totalIncome"));
  return {
    ...(hh && /^\d{1,2}$/.test(hh) ? { hh } : {}),
    ...(income ? { income } : {}),
  };
}

export function extractAssistancePrefill(snapshot: IntakeWebhookSnapshot | null): AssistancePrefill {
  if (!snapshot) return EMPTY_PREFILL;
  const fields = snapshot.household.trace.flatMap((event) => event.fields);
  const pick = (matches: RegExp[], excludes: RegExp[] = []): string => {
    const hit = fields.find((field) => {
      const label = field.label.trim();
      return matches.some((match) => match.test(label)) && !excludes.some((exclude) => exclude.test(label));
    });
    return hit?.value?.trim() || "";
  };

  const housing = snapshot.household.housing;
  return {
    programName: pick([/grant\s*\/\s*program/i, /program name/i, /funding source/i, /assistance program/i]),
    assistanceStart: isoDate(pick([/assistance start/i, /effective date/i, /lease start/i, /move.?in date/i])),
    assistanceEnd: isoDate(pick([/assistance end/i, /expiration date/i, /lease end/i])),
    landlordName: pick(
      [/landlord.*name/i, /property (owner|management).*name/i, /^payee(?:\s*\/\s*vendor)?$/i, /^vendor$/i],
      [/tenant/i],
    ),
    landlordContact: pick([/landlord.*contact( person)?$/i, /property manager.*name/i, /contact person.*landlord/i]),
    landlordPhone: pick([/landlord.*phone/i, /property (owner|manager).*phone/i]),
    landlordEmail: pick([/landlord.*e-?mail/i, /property (owner|manager).*e-?mail/i]),
    landlordAddress: pick([/landlord.*address/i, /property (owner|management).*address/i, /payee.*address/i]),
    unitAddress: slotValue(housing, "address") || pick([/unit address/i, /rental address/i, /address for current living/i]),
    monthlyRent: money(
      pick([/hrdc (rent )?payment/i, /rental assistance amount/i, /^rent amount/i, /monthly rent/i]) ||
        slotValue(housing, "monthlyRent"),
    ),
    depositAmount: money(pick([/security deposit/i, /deposit amount/i])),
    arrearsAmount: money(pick([/arrears amount/i, /rent arrears/i, /back rent/i]) || slotValue(housing, "backRent")),
    proratedAmount: money(pick([/prorated.*amount/i, /prorated rent/i])),
    utilityAmount: money(pick([/utility allowance/i, /utility assistance amount/i, /^utility amount/i])),
  };
}
