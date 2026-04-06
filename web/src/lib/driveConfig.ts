function readPublicId(value: string | undefined): string {
  return String(value || "").trim();
}

export const ACTIVE_PARENT_ID = readPublicId(process.env.NEXT_PUBLIC_GDRIVE_ACTIVE_PARENT_ID);
export const EXITED_PARENT_ID = readPublicId(process.env.NEXT_PUBLIC_GDRIVE_EXITED_PARENT_ID);

export const DRIVE_FILE_TEMPLATES = [
  {
    key: "tss_workbook",
    label: "TSS Workbook",
    docNameTpl: "{last}, {first} TSS Workbook",
    defaultChecked: true,
    variants: {
      payer: readPublicId(process.env.NEXT_PUBLIC_GDRIVE_TEMPLATE_TSS_PAYER_ID),
      nonpayer: readPublicId(process.env.NEXT_PUBLIC_GDRIVE_TEMPLATE_TSS_NONPAYER_ID),
    },
  },
  {
    key: "ra_utility_allowance",
    label: "Utility Allowance",
    docNameTpl: "{last}, {first} Utility Allowance",
    id: readPublicId(process.env.NEXT_PUBLIC_GDRIVE_TEMPLATE_UTILITY_ALLOWANCE_ID),
    defaultChecked: false,
  },
  {
    key: "bridging_home_office_use",
    label: "Bridging Home Office Use",
    docNameTpl: "{last}, {first} Bridging Home Office Use",
    id: readPublicId(process.env.NEXT_PUBLIC_GDRIVE_TEMPLATE_BRIDGING_HOME_ID),
    defaultChecked: false,
  },
] as const;
