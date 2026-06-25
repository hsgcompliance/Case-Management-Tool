import {
  z
} from "./chunk-AXFMCCQR.js";
import {
  __export
} from "./chunk-MLKGABMK.js";

// src/tss.ts
var tss_exports = {};
__export(tss_exports, {
  TSS_BUDGET_ENTITY: () => TSS_BUDGET_ENTITY,
  TSS_COVER_ENTITY: () => TSS_COVER_ENTITY,
  TSS_CUSTOMER_STRENGTHS_ENTITY: () => TSS_CUSTOMER_STRENGTHS_ENTITY,
  TSS_DISPLAY_ENTITIES: () => TSS_DISPLAY_ENTITIES,
  TSS_DROPDOWN_LISTS: () => TSS_DROPDOWN_LISTS,
  TSS_GOALS_ENTITY: () => TSS_GOALS_ENTITY,
  TSS_HEADER_ALIASES: () => TSS_HEADER_ALIASES,
  TSS_HOUSING_BARRIERS_ENTITY: () => TSS_HOUSING_BARRIERS_ENTITY,
  TSS_PROGRESS_NOTES_ENTITY: () => TSS_PROGRESS_NOTES_ENTITY,
  TSS_SHEETS: () => TSS_SHEETS,
  TSS_SMART_GOALS_ACRONYM_ENTITY: () => TSS_SMART_GOALS_ACRONYM_ENTITY,
  TSS_WORKBOOK_VARIANT_RULES: () => TSS_WORKBOOK_VARIANT_RULES,
  TSS_WORKSHEET_CONFIG: () => TSS_WORKSHEET_CONFIG,
  TssDataTypeSchema: () => TssDataTypeSchema,
  TssDirectionSchema: () => TssDirectionSchema,
  TssDisplayEntityConfigSchema: () => TssDisplayEntityConfigSchema,
  TssDropdownListSchema: () => TssDropdownListSchema,
  TssEntitySectionSchema: () => TssEntitySectionSchema,
  TssExtractedCellSchema: () => TssExtractedCellSchema,
  TssExtractedEntitySchema: () => TssExtractedEntitySchema,
  TssExtractedEntityStatusSchema: () => TssExtractedEntityStatusSchema,
  TssExtractedRowSchema: () => TssExtractedRowSchema,
  TssExtractionWarningSchema: () => TssExtractionWarningSchema,
  TssHeaderResolutionModeSchema: () => TssHeaderResolutionModeSchema,
  TssInlineDropdownListSchema: () => TssInlineDropdownListSchema,
  TssKeyValueCellConfigSchema: () => TssKeyValueCellConfigSchema,
  TssNoteSectionBreakSchema: () => TssNoteSectionBreakSchema,
  TssOrgConfigOverrideSchema: () => TssOrgConfigOverrideSchema,
  TssParsingDefaultsSchema: () => TssParsingDefaultsSchema,
  TssRenderKindSchema: () => TssRenderKindSchema,
  TssSheetConfigSchema: () => TssSheetConfigSchema,
  TssSheetDropdownListSchema: () => TssSheetDropdownListSchema,
  TssSheetResolutionModeSchema: () => TssSheetResolutionModeSchema,
  TssSmartHeaderConfigSchema: () => TssSmartHeaderConfigSchema,
  TssTableRangeConfigSchema: () => TssTableRangeConfigSchema,
  TssVariantRuleSchema: () => TssVariantRuleSchema,
  TssWorkbookExtractSchema: () => TssWorkbookExtractSchema,
  TssWorkbookVariantSchema: () => TssWorkbookVariantSchema,
  TssWorksheetConfigSchema: () => TssWorksheetConfigSchema,
  resolveTssWorksheetConfig: () => resolveTssWorksheetConfig,
  resolveWorkbookVariant: () => resolveWorkbookVariant,
  smartHeaderId: () => smartHeaderId
});
var TssWorkbookVariantSchema = z.enum(["payer", "nonPayer", "unknown"]);
var TssDirectionSchema = z.enum(["worksheetToApp", "appToWorksheet", "bidirectional"]);
var TssDataTypeSchema = z.enum([
  "string",
  "longText",
  "number",
  "currency",
  "date",
  "time",
  "duration",
  "url",
  "select",
  "signature",
  "computed"
]);
var TssRenderKindSchema = z.enum([
  "keyValueCard",
  "summaryBox",
  "sectionedTable",
  "dataTable",
  "budgetTable",
  "acronymCard"
]);
var TssSheetResolutionModeSchema = z.enum([
  "exactOrAlias",
  "containsAnyAlias",
  "anchorScanFallback"
]);
var TssHeaderResolutionModeSchema = z.enum([
  "fixedRowPreferred",
  "anchorThenOffset",
  "scanWindow"
]);
var TssEntitySectionSchema = z.enum([
  "cover",
  "housingPlan",
  "notes",
  "budget",
  "reference"
]);
var TssSmartHeaderConfigSchema = z.object({
  id: z.string(),
  expected: z.string(),
  aliases: z.array(z.string()).optional(),
  required: z.boolean().optional(),
  dataType: TssDataTypeSchema.optional(),
  optionSourceId: z.string().optional(),
  appField: z.string().optional(),
  clientDocField: z.string().optional(),
  display: z.object({
    label: z.string().optional(),
    width: z.enum(["xs", "sm", "md", "lg", "xl"]).optional(),
    multiline: z.boolean().optional(),
    hideInCompact: z.boolean().optional(),
    badge: z.boolean().optional()
  }).passthrough().optional(),
  write: z.object({
    enabled: z.boolean(),
    lockIfFormula: z.boolean().optional()
  }).passthrough().optional()
}).passthrough();
var TssSheetConfigSchema = z.object({
  id: z.string(),
  expectedNames: z.array(z.string()),
  aliases: z.array(z.string()).optional(),
  hidden: z.boolean().optional(),
  resolutionMode: TssSheetResolutionModeSchema,
  headerIdStrategy: z.object({
    normalize: z.literal("smartHeaderIdV1"),
    collisionPolicy: z.enum(["preferExactThenAliasThenLeftmost", "throw"])
  }).passthrough().optional()
}).passthrough();
var TssTableRangeConfigSchema = z.object({
  sheetId: z.string(),
  anchorText: z.string().optional(),
  headerRow: z.number().int().optional(),
  headerRowCandidates: z.array(z.number().int()).optional(),
  headerScan: z.object({
    mode: TssHeaderResolutionModeSchema,
    minRow: z.number().int(),
    maxRow: z.number().int(),
    mustContainHeaderIds: z.array(z.string()),
    scoreHeaderIds: z.array(z.string()).optional()
  }).passthrough().optional(),
  dataStartRowOffset: z.number().int().optional(),
  dataStartRow: z.number().int().optional(),
  dataEnd: z.object({
    mode: z.enum(["firstBlankRow", "untilNextAnchor", "fixedRow", "worksheetUsedRange"]),
    fixedRow: z.number().int().optional(),
    nextAnchorText: z.string().optional(),
    minConsecutiveBlankRows: z.number().int().optional()
  }).passthrough().optional(),
  expectedColumns: z.array(z.string()).optional()
}).passthrough();
var TssKeyValueCellConfigSchema = z.object({
  id: z.string(),
  label: z.string(),
  aliases: z.array(z.string()).optional(),
  appField: z.string(),
  clientDocField: z.string().optional(),
  dataType: TssDataTypeSchema,
  sheetLabelCell: z.string().optional(),
  sheetValueCell: z.string().optional(),
  labelSearch: z.object({
    sheetId: z.string(),
    labelAliases: z.array(z.string()),
    scanRange: z.string(),
    valueOffset: z.object({ rows: z.number().int(), cols: z.number().int() }).optional(),
    fallbackValueOffsets: z.array(z.object({ rows: z.number().int(), cols: z.number().int() })).optional()
  }).passthrough().optional(),
  tunnelToClientDoc: z.boolean().optional(),
  required: z.boolean().optional()
}).passthrough();
var TssEntitySourceSchema = z.object({
  sheetId: z.string().optional(),
  range: TssTableRangeConfigSchema.optional(),
  keyValues: z.array(TssKeyValueCellConfigSchema).optional(),
  staticContent: z.unknown().optional()
}).passthrough();
var TssEntityDisplaySchema = z.object({
  titleField: z.string().optional(),
  subtitleField: z.string().optional(),
  emptyState: z.string().optional(),
  compactFields: z.array(z.string()).optional(),
  sort: z.array(z.object({ field: z.string(), direction: z.enum(["asc", "desc"]) })).optional(),
  groupBy: z.string().optional(),
  totalFields: z.array(z.string()).optional()
}).passthrough();
var TssVariantOverrideSchema = z.object({
  source: TssEntitySourceSchema.optional(),
  fields: z.array(TssSmartHeaderConfigSchema).optional(),
  display: TssEntityDisplaySchema.optional()
}).passthrough();
var TssDisplayEntityConfigSchema = z.object({
  id: z.string(),
  label: z.string(),
  section: TssEntitySectionSchema,
  renderKind: TssRenderKindSchema,
  direction: TssDirectionSchema,
  source: TssEntitySourceSchema,
  fields: z.array(TssSmartHeaderConfigSchema).optional(),
  dropdowns: z.record(z.string(), z.string()).optional(),
  display: TssEntityDisplaySchema.optional(),
  // Per-variant source/field overrides — keyed by TssWorkbookVariant value.
  variantOverrides: z.record(z.string(), TssVariantOverrideSchema).optional()
}).passthrough();
var TssSheetDropdownListSchema = z.object({
  id: z.string(),
  sheetId: z.string(),
  namedRange: z.string(),
  expectedHeader: z.string(),
  expectedColumn: z.string(),
  values: z.array(z.string())
}).passthrough();
var TssInlineDropdownListSchema = z.object({
  id: z.string(),
  inlineValues: z.literal(true),
  values: z.array(z.string())
}).passthrough();
var TssDropdownListSchema = z.union([
  TssSheetDropdownListSchema,
  TssInlineDropdownListSchema
]);
var TssVariantRuleSchema = z.object({
  variant: TssWorkbookVariantSchema,
  ifSheetExists: z.string(),
  notes: z.string().optional()
}).passthrough();
var TssParsingDefaultsSchema = z.object({
  rowDriftTolerance: z.number().int().optional(),
  emptyRowPolicy: z.string().optional(),
  mergedCellPolicy: z.string().optional(),
  coverSheetTunnelPolicy: z.string().optional(),
  datePolicy: z.string().optional()
}).passthrough();
var TssWorksheetConfigSchema = z.object({
  version: z.string(),
  workbookKind: z.string(),
  smartHeaderIdVersion: z.string(),
  sheets: z.record(z.string(), TssSheetConfigSchema),
  variantRules: z.array(TssVariantRuleSchema),
  dropdownLists: z.record(z.string(), TssDropdownListSchema),
  headerAliases: z.record(z.string(), z.array(z.string()).or(z.array(z.string()).readonly())),
  entities: z.record(z.string(), TssDisplayEntityConfigSchema),
  parsingDefaults: TssParsingDefaultsSchema.optional()
}).passthrough();
var TssOrgConfigOverrideSchema = z.object({
  // Force a specific variant instead of auto-detecting from sheet names.
  forceVariant: TssWorkbookVariantSchema.optional(),
  // Disable specific entity IDs (e.g. ["budget"] for orgs that don't use budget sheet).
  disabledEntityIds: z.array(z.string()).optional(),
  // Extend (not replace) sheet tab name aliases per sheet ID.
  // e.g. { progressNotes: ["Service Notes", "Case Notes"] }
  sheetAliasExtensions: z.record(z.string(), z.array(z.string())).optional(),
  // Extend header aliases per entity ID → field ID → extra alias strings.
  // e.g. { progressNotes: { summary: ["Note Summary", "What Happened"] } }
  fieldAliasExtensions: z.record(z.string(), z.record(z.string(), z.array(z.string()))).optional(),
  // Override display properties per entity ID → field ID.
  // e.g. { goals: { status: { label: "Goal Status", badge: true } } }
  fieldDisplayOverrides: z.record(z.string(), z.record(
    z.string(),
    z.object({
      label: z.string().optional(),
      width: z.enum(["xs", "sm", "md", "lg", "xl"]).optional(),
      hideInCompact: z.boolean().optional(),
      badge: z.boolean().optional()
    }).passthrough()
  )).optional(),
  // Override the empty state message per entity ID.
  entityEmptyStateOverrides: z.record(z.string(), z.string()).optional(),
  // Override entity label (display name) per entity ID.
  entityLabelOverrides: z.record(z.string(), z.string()).optional()
}).passthrough();
var TssExtractionWarningSchema = z.object({
  code: z.string(),
  message: z.string(),
  entityId: z.string().optional(),
  sheetId: z.string().optional(),
  fieldId: z.string().optional(),
  severity: z.enum(["info", "warning", "error"]).optional()
}).passthrough();
var TssExtractedEntityStatusSchema = z.enum([
  "extracted",
  // data found and mapped
  "empty",
  // sheet+headers resolved, but no data rows / values
  "unsupported",
  // renderKind not implemented in this slice
  "missing_sheet",
  // entity's sheet could not be resolved in the workbook
  "missing_headers",
  // sheet found but required headers/anchors not located
  "error"
  // unexpected failure extracting this entity
]);
var TssExtractedCellSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  displayValue: z.string().optional(),
  kind: z.enum(["string", "number", "boolean", "date", "empty"]).optional()
}).passthrough();
var TssExtractedRowSchema = z.object({
  // Stable per-row key for React keys and future write targeting. NOT an A1 range.
  rowKey: z.string(),
  values: z.record(z.string(), TssExtractedCellSchema),
  warnings: z.array(TssExtractionWarningSchema).optional()
}).passthrough();
var TssNoteSectionBreakSchema = z.object({
  rowKey: z.string(),
  text: z.string()
}).passthrough();
var TssExtractedEntitySchema = z.object({
  entityId: z.string(),
  renderKind: TssRenderKindSchema,
  label: z.string(),
  section: TssEntitySectionSchema,
  status: TssExtractedEntityStatusSchema,
  // keyValueCard / summaryBox — single record of fieldId → cell
  values: z.record(z.string(), TssExtractedCellSchema).optional(),
  // dataTable — ordered rows. For stacked multi-variant tables (progress notes),
  // each row's values are mapped per ITS OWN section's column layout.
  rows: z.array(TssExtractedRowSchema).optional(),
  // Status-change banners separating stacked sections (progress notes).
  sectionBreaks: z.array(TssNoteSectionBreakSchema).optional(),
  // budgetTable — structured later; left loose for now
  budget: z.unknown().optional(),
  warnings: z.array(TssExtractionWarningSchema).optional()
}).passthrough();
var TssWorkbookExtractSchema = z.object({
  customerId: z.string(),
  spreadsheetId: z.string(),
  spreadsheetName: z.string().optional(),
  variant: TssWorkbookVariantSchema,
  entities: z.array(TssExtractedEntitySchema),
  warnings: z.array(TssExtractionWarningSchema),
  extractedAt: z.string(),
  // ISO
  // Deferred: requires Drive metadata, not just Sheets scope. Optional for slice A.
  spreadsheetModifiedTime: z.string().nullable().optional(),
  configVersion: z.string().optional()
}).passthrough();
function smartHeaderId(value) {
  return String(value || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[≤]/g, " less than or equal ").replace(/[≥]/g, " greater than or equal ").replace(/[#]/g, " number ").replace(/[&/+]/g, " and ").replace(/[()\[\]{}:;,.!?"""'`]/g, " ").replace(/\s+/g, " ").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
var TSS_SHEETS = {
  lists: {
    id: "lists",
    expectedNames: ["_Lists"],
    aliases: ["Lists", "Dropdown Lists", "_lists"],
    hidden: true,
    resolutionMode: "exactOrAlias",
    headerIdStrategy: { normalize: "smartHeaderIdV1", collisionPolicy: "preferExactThenAliasThenLeftmost" }
  },
  cover: {
    id: "cover",
    expectedNames: ["1. Cover Sheet"],
    aliases: ["Cover Sheet", "Client Cover Sheet", "1 Cover Sheet"],
    resolutionMode: "exactOrAlias"
  },
  housingPlan: {
    id: "housingPlan",
    expectedNames: ["4. Housing Plan"],
    aliases: ["Housing Plan", "4 Housing Plan", "Plan"],
    resolutionMode: "exactOrAlias",
    headerIdStrategy: { normalize: "smartHeaderIdV1", collisionPolicy: "preferExactThenAliasThenLeftmost" }
  },
  progressNotes: {
    id: "progressNotes",
    expectedNames: ["6. Progress Notes", "Progress Notes"],
    aliases: ["Progress Notes", "Notes", "Service Notes", "6 Progress Notes"],
    resolutionMode: "exactOrAlias",
    headerIdStrategy: { normalize: "smartHeaderIdV1", collisionPolicy: "preferExactThenAliasThenLeftmost" }
  },
  budget: {
    id: "budget",
    expectedNames: ["Budget"],
    aliases: ["Client Budget", "Monthly Budget"],
    resolutionMode: "exactOrAlias",
    headerIdStrategy: { normalize: "smartHeaderIdV1", collisionPolicy: "preferExactThenAliasThenLeftmost" }
  }
};
var TSS_WORKBOOK_VARIANT_RULES = [
  {
    variant: "payer",
    ifSheetExists: "6. Progress Notes",
    notes: "Full worksheet. Progress Notes header usually row 3; Housing Plan goal table usually starts row 22."
  },
  {
    variant: "nonPayer",
    ifSheetExists: "Progress Notes",
    notes: "Simplified worksheet. Progress Notes header usually row 1; Housing Plan goal table usually starts row 19."
  }
];
var TSS_HEADER_ALIASES = {
  clientName: ["Client Name", "Member Name", "Customer Name", "Participant Name"],
  dob: ["DOB", "Date of Birth"],
  hmisCwId: ["HMIS/CW ID", "HMIS ID", "CWID", "CaseWorthy ID", "Caseworthy ID", "HMIS/CWID"],
  medicaidId: ["Medicaid ID", "MA ID", "Montana Medicaid ID"],
  primaryCaseManager: ["Primary CM", "Case Manager", "Primary Case Manager", "Staff Name"],
  phone: ["Phone", "Phone Number", "Client Phone"],
  email: ["Email", "Email Address", "Client Email"],
  providerSelection: ["Provider Selection", "Provider Choice"],
  otherProviderName: ["If Other, Provider Name", "Other Provider Name", "Provider Name"],
  quickLinks: ["Quick Links (paste URLs to tabs/docs)", "Quick Links", "Links"],
  currentPaNumber: ["Current PA Number", "PA Number", "Prior Authorization Number"],
  paEffective: ["PA Effective", "PA Effective Date", "Authorization Start"],
  paExpiration: ["PA Expiration", "PA Expiration Date", "Authorization End"],
  next120DayReviewDue: ["Next 120-day Review Due", "Review Due (\u2264120 days)", "Next Review Due"],
  nextAnnualReAuthDue: ["Next Annual Re-Auth Due", "Next Annual Reauth Due", "Annual Re-Authorization Due"],
  planDate: ["Plan Date", "Housing Plan Date"],
  reviewDue: ["Review Due (\u2264120 days)", "Review Due", "Next Review Due"],
  clientStrengths: ["Client Strengths", "Strengths", "Customer Strengths"],
  cmSummary: ["CM Summary", "Case Manager Summary", "Staff Summary"],
  barrier: ["Barrier", "Housing Barrier", "Housing Barriers"],
  mitigationSupports: ["Mitigation/Supports", "Mitigation Supports", "Supports", "Plan to Address Barrier"],
  serviceTier: ["Service Tier (U1/U2/U3)", "Service Tier: cheatsheets here and here ", "Service Tier", "Tier"],
  goalSmart: ["Goal (SMART)", "SMART Goal", "Goal"],
  objective: ["Objective", "Objectives"],
  interventionTask: ["Intervention/Task", "Intervention", "Task"],
  goalCompletionCriteria: ["Goal Completion Criteria", "Completion Criteria", "Success Criteria"],
  responsible: ["Responsible", "Responsible Party", "Owner"],
  targetDate: ["Target Date", "Due Date"],
  status: ["Status", "Goal Status"],
  notes: ["Notes", "Goal Notes"],
  progressDate: ["Date", "Service Date", "Note Date"],
  startTime: ["Start Time"],
  endTime: ["End Time"],
  totalTime: ["Total Time", "Duration"],
  summary: ["Summary (what & why)", "Summary", "Note Summary"],
  clientResponseProgress: ["Client Response/Progress", "Client Response", "Progress"],
  linkedPlanGoal: ["Linked Plan Goal", "Linked Goal", "Goal #"],
  location: ["Location of appointment", "Location", "Appointment Location"],
  staffName: ["Staff name ", "Staff Name", "Staff"],
  staffInitial: ["Staff initial", "Staff Initial", "Staff Initials"],
  staffSignature: ["Staff signature", "Staff Signature", "Signature"],
  completionDate: ["Date of completion", "Completion Date"]
};
var TSS_DROPDOWN_LISTS = {
  yesNo: { id: "yesNo", sheetId: "lists", namedRange: "YesNo", expectedHeader: "YesNo", expectedColumn: "A", values: ["Yes", "No"] },
  providerChoice: { id: "providerChoice", sheetId: "lists", namedRange: "ProviderChoice", expectedHeader: "ProviderChoice", expectedColumn: "B", values: ["HRDC", "Other"] },
  supportItem: { id: "supportItem", sheetId: "lists", namedRange: "SupportItem", expectedHeader: "SupportItem", expectedColumn: "C", values: ["Application Fee (H0044-UA)", "Security Deposit (H0044-UD)"] },
  serviceTier: { id: "serviceTier", sheetId: "lists", namedRange: "ServiceTier", expectedHeader: "ServiceTier", expectedColumn: "D", values: ["U1 - Assessment & Planning", "U2 - Pre-Tenancy", "U3 - Tenancy Sustaining"] },
  method: { id: "method", sheetId: "lists", namedRange: "Method", expectedHeader: "Method", expectedColumn: "E", values: ["Portal", "IVR", "Email", "Phone", "In Person"] },
  placeOfService: { id: "placeOfService", sheetId: "lists", namedRange: "POS_List", expectedHeader: "POS_List", expectedColumn: "F", values: ["11 - Office", "12 - Home", "99 - Other"] },
  statusList: { id: "statusList", sheetId: "lists", namedRange: "StatusList", expectedHeader: "StatusList", expectedColumn: "G", values: ["Open", "Closed", "On Hold"] },
  hardshipDetermination: { id: "hardshipDetermination", sheetId: "lists", namedRange: "HardshipDet", expectedHeader: "HardshipDet", expectedColumn: "H", values: ["Full Waiver", "Partial Waiver", "Denied", "N/A"] },
  finalStatus: { id: "finalStatus", sheetId: "lists", namedRange: "FinalStatus", expectedHeader: "FinalStatus", expectedColumn: "I", values: ["Paid in Full", "Partially Paid", "Unpaid", "Waived (Hardship)"] },
  denialReason: { id: "denialReason", sheetId: "lists", namedRange: "DenialReason", expectedHeader: "DenialReason", expectedColumn: "J", values: ["Missing PA", "Eligibility Issue", "Incorrect Code/Modifier", "Missing Documentation", "Other"] },
  actionTaken: { id: "actionTaken", sheetId: "lists", namedRange: "ActionTaken", expectedHeader: "ActionTaken", expectedColumn: "K", values: ["Initial Invoice", "Reminder Sent", "Follow-Up Call", "Hardship Offered", "Hardship Reviewed", "Final Notice", "Payment Received"] },
  contactMethod: { id: "contactMethod", sheetId: "lists", namedRange: "ContactMethod", expectedHeader: "ContactMethod", expectedColumn: "L", values: ["Email", "Phone", "Mail", "In Person"] },
  clientResponse: { id: "clientResponse", sheetId: "lists", namedRange: "ClientResponse", expectedHeader: "ClientResponse", expectedColumn: "M", values: ["Engaged", "No Response", "Partial Payment", "Requested Hardship", "Unable to Contact", "Declined"] },
  responsibleParty: { id: "responsibleParty", inlineValues: true, values: ["Client", "Case Manager", "Client and Case Manager", "Other", "Select"] },
  appointmentLocation: { id: "appointmentLocation", inlineValues: true, values: ["Market Place", "Tracy Office", "Homeward Point", "LWC", "Livingston Office", "Wheat Suites", "Other"] }
};
var TSS_COVER_ENTITY = {
  id: "coverSheet",
  label: "Cover Sheet",
  section: "cover",
  renderKind: "keyValueCard",
  direction: "bidirectional",
  source: {
    sheetId: "cover",
    keyValues: [
      { id: "clientName", label: "Client Name", appField: "clientName", clientDocField: "client.name", dataType: "string", sheetLabelCell: "A3", sheetValueCell: "B3", tunnelToClientDoc: true, required: true },
      { id: "dob", label: "DOB", appField: "dob", clientDocField: "client.dob", dataType: "date", sheetLabelCell: "C3", sheetValueCell: "D3", labelSearch: { sheetId: "cover", labelAliases: [...TSS_HEADER_ALIASES.dob], scanRange: "A1:E12", valueOffset: { rows: 0, cols: 1 }, fallbackValueOffsets: [{ rows: 1, cols: 0 }, { rows: 0, cols: -1 }] }, tunnelToClientDoc: true },
      { id: "hmisCwId", label: "HMIS/CW ID", appField: "hmisCwId", clientDocField: "client.caseworthyId", dataType: "string", labelSearch: { sheetId: "cover", labelAliases: [...TSS_HEADER_ALIASES.hmisCwId], scanRange: "A1:E12", valueOffset: { rows: 0, cols: 1 }, fallbackValueOffsets: [{ rows: 1, cols: 0 }, { rows: 0, cols: -1 }] }, tunnelToClientDoc: true },
      { id: "medicaidId", label: "Medicaid ID", appField: "medicaidId", clientDocField: "client.medicaidId", dataType: "string", sheetLabelCell: "E3", labelSearch: { sheetId: "cover", labelAliases: [...TSS_HEADER_ALIASES.medicaidId], scanRange: "A1:E12", valueOffset: { rows: 0, cols: 1 }, fallbackValueOffsets: [{ rows: 1, cols: 0 }, { rows: 0, cols: -1 }] }, tunnelToClientDoc: true },
      { id: "primaryCaseManager", label: "Primary CM", appField: "primaryCaseManager", clientDocField: "client.caseManager", dataType: "string", sheetLabelCell: "A4", sheetValueCell: "B4", tunnelToClientDoc: true },
      { id: "phone", label: "Phone", appField: "phone", clientDocField: "client.phone", dataType: "string", sheetLabelCell: "C4", sheetValueCell: "D4", tunnelToClientDoc: true },
      { id: "email", label: "Email", appField: "email", clientDocField: "client.email", dataType: "string", sheetLabelCell: "E4", labelSearch: { sheetId: "cover", labelAliases: [...TSS_HEADER_ALIASES.email], scanRange: "A1:E12", valueOffset: { rows: 0, cols: 1 }, fallbackValueOffsets: [{ rows: 1, cols: 0 }, { rows: 0, cols: -1 }] }, tunnelToClientDoc: true },
      { id: "providerSelection", label: "Provider Selection", appField: "providerSelection", dataType: "select", sheetLabelCell: "A5", sheetValueCell: "B5", aliases: [...TSS_HEADER_ALIASES.providerSelection] },
      { id: "otherProviderName", label: "If Other, Provider Name", appField: "otherProviderName", dataType: "string", sheetLabelCell: "C5", sheetValueCell: "D5" },
      { id: "quickLinks", label: "Quick Links", appField: "quickLinks", dataType: "url", sheetLabelCell: "E5" },
      { id: "currentPaNumber", label: "Current PA Number", appField: "currentPaNumber", dataType: "string", sheetLabelCell: "A8", sheetValueCell: "A9" },
      { id: "paEffective", label: "PA Effective", appField: "paEffective", dataType: "date", sheetLabelCell: "B8", sheetValueCell: "B9" },
      { id: "paExpiration", label: "PA Expiration", appField: "paExpiration", dataType: "date", sheetLabelCell: "C8", sheetValueCell: "C9" },
      { id: "next120DayReviewDue", label: "Next 120-day Review Due", appField: "next120DayReviewDue", dataType: "date", sheetLabelCell: "D8", sheetValueCell: "D9" },
      { id: "nextAnnualReAuthDue", label: "Next Annual Re-Auth Due", appField: "nextAnnualReAuthDue", dataType: "date", sheetLabelCell: "E8", sheetValueCell: "E9" }
    ]
  },
  dropdowns: { providerSelection: "providerChoice" },
  display: { titleField: "clientName", compactFields: ["dob", "phone", "hmisCwId", "medicaidId", "primaryCaseManager"], emptyState: "No cover sheet values found." }
};
var TSS_CUSTOMER_STRENGTHS_ENTITY = {
  id: "customerStrengths",
  label: "Customer Strengths",
  section: "housingPlan",
  renderKind: "summaryBox",
  direction: "bidirectional",
  source: {
    sheetId: "housingPlan",
    range: {
      sheetId: "housingPlan",
      anchorText: "Client Strengths",
      headerRowCandidates: [4, 7],
      headerScan: { mode: "scanWindow", minRow: 1, maxRow: 12, mustContainHeaderIds: ["client_strengths"], scoreHeaderIds: ["client_strengths", "cm_summary"] },
      dataStartRowOffset: 1,
      dataEnd: { mode: "untilNextAnchor", nextAnchorText: "Barrier", minConsecutiveBlankRows: 2 },
      expectedColumns: ["clientStrengths", "cmSummary"]
    }
  },
  fields: [
    { id: "clientStrengths", expected: "Client Strengths", appField: "clientStrengths", dataType: "longText", required: true, display: { label: "Customer Strengths", width: "xl", multiline: true } },
    { id: "cmSummary", expected: "CM Summary", appField: "cmSummary", dataType: "longText", display: { label: "Case Manager Summary", width: "xl", multiline: true } }
  ],
  variantOverrides: {
    payer: { source: { sheetId: "housingPlan", range: { sheetId: "housingPlan", anchorText: "Client Strengths", headerRow: 7, dataStartRow: 8, dataEnd: { mode: "untilNextAnchor", nextAnchorText: "Barrier", minConsecutiveBlankRows: 2 }, expectedColumns: ["clientStrengths"] } } },
    nonPayer: { source: { sheetId: "housingPlan", range: { sheetId: "housingPlan", anchorText: "Client Strengths", headerRow: 4, dataStartRow: 5, dataEnd: { mode: "untilNextAnchor", nextAnchorText: "Barrier", minConsecutiveBlankRows: 2 }, expectedColumns: ["clientStrengths", "cmSummary"] } } }
  },
  display: { emptyState: "No customer strengths entered yet." }
};
var TSS_HOUSING_BARRIERS_ENTITY = {
  id: "housingBarriers",
  label: "Housing Barriers",
  section: "housingPlan",
  renderKind: "dataTable",
  direction: "bidirectional",
  source: {
    sheetId: "housingPlan",
    range: {
      sheetId: "housingPlan",
      anchorText: "Barrier",
      headerRowCandidates: [10, 13],
      headerScan: { mode: "scanWindow", minRow: 8, maxRow: 20, mustContainHeaderIds: ["barrier"], scoreHeaderIds: ["barrier", "mitigation_supports", "service_tier_u1_u2_u3", "service_tier"] },
      dataStartRowOffset: 1,
      dataEnd: { mode: "untilNextAnchor", nextAnchorText: "SMART Goals / Objectives / Interventions", minConsecutiveBlankRows: 2 },
      expectedColumns: ["barrier", "mitigationSupports", "serviceTier"]
    }
  },
  fields: [
    { id: "barrier", expected: "Barrier", appField: "barrier", dataType: "longText", required: true, display: { label: "Barrier", width: "lg", multiline: true } },
    { id: "mitigationSupports", expected: "Mitigation/Supports", appField: "mitigationSupports", dataType: "longText", display: { label: "Mitigation / Supports", width: "xl", multiline: true } },
    { id: "serviceTier", expected: "Service Tier (U1/U2/U3)", appField: "serviceTier", dataType: "select", optionSourceId: "serviceTier", display: { label: "Tier", width: "md", badge: true } }
  ],
  dropdowns: { serviceTier: "serviceTier" },
  variantOverrides: {
    payer: { source: { sheetId: "housingPlan", range: { sheetId: "housingPlan", anchorText: "Barrier", headerRow: 13, dataStartRow: 14, dataEnd: { mode: "untilNextAnchor", nextAnchorText: "SMART Goals / Objectives / Interventions", minConsecutiveBlankRows: 2 }, expectedColumns: ["barrier", "mitigationSupports", "serviceTier"] } } },
    nonPayer: { source: { sheetId: "housingPlan", range: { sheetId: "housingPlan", anchorText: "Barrier", headerRow: 10, dataStartRow: 11, dataEnd: { mode: "untilNextAnchor", nextAnchorText: "SMART Goals / Objectives / Interventions", minConsecutiveBlankRows: 2 }, expectedColumns: ["barrier", "mitigationSupports"] } } }
  },
  display: { emptyState: "No housing barriers entered yet.", compactFields: ["barrier", "serviceTier"] }
};
var TSS_GOALS_ENTITY = {
  id: "goals",
  label: "Goals",
  section: "housingPlan",
  renderKind: "dataTable",
  direction: "bidirectional",
  source: {
    sheetId: "housingPlan",
    range: {
      sheetId: "housingPlan",
      anchorText: "SMART Goals / Objectives / Interventions",
      headerRowCandidates: [19, 22],
      headerScan: { mode: "anchorThenOffset", minRow: 15, maxRow: 28, mustContainHeaderIds: ["goal_smart", "objective", "intervention_task"], scoreHeaderIds: ["goal_smart", "objective", "intervention_task", "goal_completion_criteria", "responsible", "target_date", "service_tier", "status", "notes"] },
      dataStartRowOffset: 1,
      dataEnd: { mode: "untilNextAnchor", nextAnchorText: "Plan Reviews", minConsecutiveBlankRows: 3 },
      expectedColumns: ["goalSmart", "objective", "interventionTask", "goalCompletionCriteria", "responsible", "targetDate", "serviceTier", "status", "notes"]
    }
  },
  fields: [
    { id: "goalSmart", expected: "Goal (SMART)", appField: "goalSmart", dataType: "longText", required: true, display: { label: "Goal", width: "xl", multiline: true } },
    { id: "objective", expected: "Objective", appField: "objective", dataType: "longText", required: true, display: { label: "Objective", width: "xl", multiline: true } },
    { id: "interventionTask", expected: "Intervention/Task", appField: "interventionTask", dataType: "longText", display: { label: "Intervention / Task", width: "xl", multiline: true } },
    { id: "goalCompletionCriteria", expected: "Goal Completion Criteria", appField: "goalCompletionCriteria", dataType: "longText", display: { label: "Completion Criteria", width: "lg", multiline: true } },
    { id: "responsible", expected: "Responsible", appField: "responsible", dataType: "select", optionSourceId: "responsibleParty", display: { label: "Responsible", width: "md" } },
    { id: "targetDate", expected: "Target Date", appField: "targetDate", dataType: "date", display: { label: "Target Date", width: "sm" } },
    { id: "serviceTier", expected: "Service Tier", appField: "serviceTier", dataType: "select", optionSourceId: "serviceTier", display: { label: "Tier", width: "md", badge: true } },
    { id: "status", expected: "Status", appField: "status", dataType: "select", optionSourceId: "statusList", display: { label: "Status", width: "sm", badge: true } },
    { id: "notes", expected: "Notes", appField: "notes", dataType: "longText", display: { label: "Notes", width: "xl", multiline: true, hideInCompact: true } }
  ],
  dropdowns: { responsible: "responsibleParty", serviceTier: "serviceTier", status: "statusList" },
  variantOverrides: {
    payer: { source: { sheetId: "housingPlan", range: { sheetId: "housingPlan", anchorText: "SMART Goals / Objectives / Interventions", headerRow: 22, dataStartRow: 23, dataEnd: { mode: "untilNextAnchor", nextAnchorText: "Plan Reviews", minConsecutiveBlankRows: 3 }, expectedColumns: ["goalSmart", "objective", "interventionTask", "goalCompletionCriteria", "responsible", "targetDate", "serviceTier", "status", "notes"] } } },
    nonPayer: { source: { sheetId: "housingPlan", range: { sheetId: "housingPlan", anchorText: "SMART Goals / Objectives / Interventions", headerRow: 19, dataStartRow: 20, dataEnd: { mode: "firstBlankRow", minConsecutiveBlankRows: 3 }, expectedColumns: ["goalSmart", "objective", "interventionTask", "responsible"] } } }
  },
  display: { titleField: "goalSmart", subtitleField: "objective", compactFields: ["goalSmart", "objective", "responsible", "targetDate", "status"], emptyState: "No SMART goals entered yet.", sort: [{ field: "targetDate", direction: "asc" }] }
};
var TSS_SMART_GOALS_ACRONYM_ENTITY = {
  id: "smartGoalsAcronym",
  label: "SMART Goals",
  section: "reference",
  renderKind: "acronymCard",
  direction: "worksheetToApp",
  source: { staticContent: { title: "SMART GOALS", items: [{ letter: "S", label: "Specific" }, { letter: "M", label: "Measurable" }, { letter: "A", label: "Achievable" }, { letter: "R", label: "Realistic" }, { letter: "T", label: "Timely" }] } },
  display: { emptyState: "Use SMART criteria to keep goals concrete, reviewable, and tied to service activity." }
};
var TSS_PROGRESS_NOTES_ENTITY = {
  id: "progressNotes",
  label: "Progress Notes",
  section: "notes",
  renderKind: "dataTable",
  direction: "bidirectional",
  source: {
    sheetId: "progressNotes",
    range: {
      sheetId: "progressNotes",
      headerRowCandidates: [1, 3],
      headerScan: { mode: "scanWindow", minRow: 1, maxRow: 6, mustContainHeaderIds: ["date", "summary_what_and_why"], scoreHeaderIds: ["date", "start_time", "end_time", "total_time", "service_tier_cheatsheets_here_and_here", "summary_what_and_why", "client_response_progress", "linked_plan_goal", "location_of_appointment", "staff_name", "staff_initial", "staff_signature", "date_of_completion"] },
      dataStartRowOffset: 1,
      dataEnd: { mode: "firstBlankRow", minConsecutiveBlankRows: 10 },
      expectedColumns: ["progressDate", "startTime", "endTime", "totalTime", "serviceTier", "summary", "clientResponseProgress", "linkedPlanGoal", "location", "staffName", "staffSignature", "completionDate"]
    }
  },
  fields: [
    { id: "progressDate", expected: "Date", appField: "progressDate", dataType: "date", required: true, display: { label: "Date", width: "sm" } },
    { id: "startTime", expected: "Start Time", appField: "startTime", dataType: "time", display: { label: "Start", width: "xs" } },
    { id: "endTime", expected: "End Time", appField: "endTime", dataType: "time", display: { label: "End", width: "xs" } },
    { id: "totalTime", expected: "Total Time", appField: "totalTime", dataType: "duration", display: { label: "Total", width: "xs" }, write: { enabled: false, lockIfFormula: true } },
    { id: "serviceTier", expected: "Service Tier", appField: "serviceTier", dataType: "select", optionSourceId: "serviceTier", display: { label: "Tier", width: "md", badge: true } },
    { id: "summary", expected: "Summary (what & why)", appField: "summary", dataType: "longText", required: true, display: { label: "Summary", width: "xl", multiline: true } },
    { id: "clientResponseProgress", expected: "Client Response/Progress", appField: "clientResponseProgress", dataType: "longText", display: { label: "Client Response / Progress", width: "xl", multiline: true } },
    { id: "linkedPlanGoal", expected: "Linked Plan Goal", appField: "linkedPlanGoal", dataType: "string", display: { label: "Linked Goal", width: "sm" } },
    { id: "location", expected: "Location of appointment", appField: "location", dataType: "select", optionSourceId: "appointmentLocation", display: { label: "Location", width: "md" } },
    { id: "staffName", expected: "Staff name", appField: "staffName", dataType: "string", display: { label: "Staff", width: "md" } },
    { id: "staffInitial", expected: "Staff initial", appField: "staffInitial", dataType: "string", display: { label: "Staff Initial", width: "xs" } },
    { id: "staffSignature", expected: "Staff signature", appField: "staffSignature", dataType: "signature", display: { label: "Signature", width: "md", hideInCompact: true } },
    { id: "completionDate", expected: "Date of completion", appField: "completionDate", dataType: "date", display: { label: "Completed", width: "sm", hideInCompact: true } }
  ],
  dropdowns: { serviceTier: "serviceTier", location: "appointmentLocation" },
  variantOverrides: {
    payer: { source: { sheetId: "progressNotes", range: { sheetId: "progressNotes", headerRow: 3, dataStartRow: 4, dataEnd: { mode: "firstBlankRow", minConsecutiveBlankRows: 10 }, expectedColumns: ["progressDate", "startTime", "endTime", "totalTime", "serviceTier", "summary", "clientResponseProgress", "linkedPlanGoal", "location", "staffName", "staffSignature", "completionDate"] } } },
    nonPayer: { source: { sheetId: "progressNotes", range: { sheetId: "progressNotes", headerRow: 1, dataStartRow: 2, dataEnd: { mode: "firstBlankRow", minConsecutiveBlankRows: 5 }, expectedColumns: ["progressDate", "summary", "clientResponseProgress", "linkedPlanGoal", "staffInitial"] } } }
  },
  display: { titleField: "summary", subtitleField: "progressDate", compactFields: ["progressDate", "serviceTier", "summary", "linkedPlanGoal", "staffName", "staffInitial"], emptyState: "No progress notes entered yet.", sort: [{ field: "progressDate", direction: "desc" }] }
};
var TSS_BUDGET_ENTITY = {
  id: "budget",
  label: "Budget",
  section: "budget",
  renderKind: "budgetTable",
  direction: "bidirectional",
  source: {
    sheetId: "budget",
    staticContent: {
      amountColumn: "B",
      itemColumn: "A",
      sections: [
        { id: "monthlyIncome", label: "Monthly Income", anchorText: "Monthly income", expectedHeaderRow: 1, itemRows: [2, 3], optionalRows: [4], totalRow: 9, totalLabel: "Total", expectedFormula: "SUM(B2:B4,B6:B8)" },
        { id: "benefitsIncomeSupports", label: "Benefits + Income Supports", anchorText: "Benefits + income supports (SNAP, WIC, TANF, child support, etc.)", expectedHeaderRow: 5, itemRows: [6, 7], optionalRows: [8], totalRow: 9, rollsInto: "monthlyIncome" },
        { id: "fixedExpenses", label: "Fixed Expenses", anchorText: "Fixed Expenses (Monthly)", expectedHeaderRow: 11, itemRows: [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24], subsections: [{ id: "insurance", label: "Insurance", anchorText: "Insurance", expectedHeaderRow: 25, itemRows: [26, 27] }, { id: "debts", label: "Debts", anchorText: "Debts", expectedHeaderRow: 28, itemRows: [29, 30, 31, 32], totalRow: 33, expectedFormula: "SUM(B29:B32)" }], totalRow: 34, totalLabel: "Fixed Expenses Total", expectedFormula: "SUM(B12:B24,B26:B27,B33)" },
        { id: "flexibleExpenses", label: "Flexible Expenses", anchorText: "Flexible Expenses (Monthly)", expectedHeaderRow: 36, itemRows: [37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47], subsections: [{ id: "children", label: "Children", anchorText: "Children", expectedHeaderRow: 48, itemRows: [49, 50, 51, 52, 53] }], totalRow: 54, totalLabel: "Flexible Expenses Total", expectedFormula: "SUM(B37:B47,B49:B53)" },
        { id: "annualExpenses", label: "Annual Expenses", anchorText: "Annual Expenses", expectedHeaderRow: 56, itemRows: [57, 58], subsections: [{ id: "vehicle", label: "Vehicle", anchorText: "Vehicle", expectedHeaderRow: 59, itemRows: [60, 61, 62, 63] }], totalRow: 64, totalLabel: "Annual Expenses Total \xF7 12", expectedFormula: "SUM(B57:B58,B60:B63)/12" },
        { id: "savings", label: "Savings", anchorText: "Savings (Monthly)", expectedHeaderRow: 66, itemRows: [67, 68, 69, 70], totalRow: 71, totalLabel: "Savings Total", expectedFormula: "SUM(B67:B70)", countAsExpense: false }
      ],
      summaryRows: [
        { id: "totalExpenses", label: "Total Expenses", row: 73, expectedFormula: "SUM(B34,B54, B64)" },
        { id: "incomeRemaining", label: "Income Remaining", row: 74, expectedFormula: "(B9 - B73)" }
      ],
      signatureRow: 77
    }
  },
  fields: [
    { id: "budgetItem", expected: "Budget Item", appField: "budgetItem", dataType: "string", display: { label: "Item", width: "xl" } },
    { id: "amount", expected: "Amount", appField: "amount", dataType: "currency", display: { label: "Amount", width: "sm" } },
    { id: "section", expected: "Section", appField: "section", dataType: "string", display: { label: "Section", width: "md" } },
    { id: "isTotal", expected: "Is Total", appField: "isTotal", dataType: "computed", write: { enabled: false } }
  ],
  display: { titleField: "section", totalFields: ["monthlyIncome.total", "totalExpenses", "incomeRemaining"], emptyState: "No budget values entered yet." }
};
var TSS_DISPLAY_ENTITIES = {
  coverSheet: TSS_COVER_ENTITY,
  customerStrengths: TSS_CUSTOMER_STRENGTHS_ENTITY,
  housingBarriers: TSS_HOUSING_BARRIERS_ENTITY,
  goals: TSS_GOALS_ENTITY,
  smartGoalsAcronym: TSS_SMART_GOALS_ACRONYM_ENTITY,
  progressNotes: TSS_PROGRESS_NOTES_ENTITY,
  budget: TSS_BUDGET_ENTITY
};
var TSS_WORKSHEET_CONFIG = {
  version: "2026-06-02.tss-display-config.v1",
  workbookKind: "tssWorksheet",
  smartHeaderIdVersion: "smartHeaderIdV1",
  sheets: TSS_SHEETS,
  variantRules: TSS_WORKBOOK_VARIANT_RULES,
  dropdownLists: TSS_DROPDOWN_LISTS,
  headerAliases: TSS_HEADER_ALIASES,
  entities: TSS_DISPLAY_ENTITIES,
  parsingDefaults: {
    rowDriftTolerance: 8,
    emptyRowPolicy: "skipRowsWhereAllMappedFieldsBlank",
    mergedCellPolicy: "topLeftValueAppliesToMergedRange",
    coverSheetTunnelPolicy: "sheetValueOverridesClientDocWhenNonBlank",
    datePolicy: "excelSerialOrIsoToIsoDate"
  }
};
function deepCloneConfig(value) {
  return JSON.parse(JSON.stringify(value));
}
function uniqStrings(...lists) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const list of lists) {
    if (!list) continue;
    for (const s of list) {
      const v = String(s).trim();
      if (v && !seen.has(v)) {
        seen.add(v);
        out.push(v);
      }
    }
  }
  return out;
}
function entityFieldsForAlias(entity) {
  const out = [];
  if (Array.isArray(entity.fields)) out.push(...entity.fields);
  if (Array.isArray(entity.source?.keyValues)) out.push(...entity.source.keyValues);
  return out;
}
function matchesFieldKey(field, key) {
  return field.id === key || field.appField === key;
}
function resolveTssWorksheetConfig(override) {
  const cfg = deepCloneConfig(TSS_WORKSHEET_CONFIG);
  if (!override) return cfg;
  if (override.disabledEntityIds?.length) {
    for (const id of override.disabledEntityIds) {
      delete cfg.entities[id];
    }
  }
  if (override.sheetAliasExtensions) {
    for (const [sheetId, extra] of Object.entries(override.sheetAliasExtensions)) {
      const sheet = cfg.sheets[sheetId];
      if (!sheet) continue;
      sheet.aliases = uniqStrings(sheet.aliases, extra);
    }
  }
  if (override.fieldAliasExtensions) {
    for (const [entityId, fieldMap] of Object.entries(override.fieldAliasExtensions)) {
      const entity = cfg.entities[entityId];
      if (!entity) continue;
      const fields = entityFieldsForAlias(entity);
      for (const [fieldKey, extra] of Object.entries(fieldMap)) {
        for (const field of fields) {
          if (matchesFieldKey(field, fieldKey)) {
            field.aliases = uniqStrings(field.aliases, extra);
          }
        }
      }
    }
  }
  if (override.fieldDisplayOverrides) {
    for (const [entityId, fieldMap] of Object.entries(override.fieldDisplayOverrides)) {
      const entity = cfg.entities[entityId];
      if (!entity?.fields) continue;
      for (const [fieldKey, displayPatch] of Object.entries(fieldMap)) {
        for (const field of entity.fields) {
          if (matchesFieldKey(field, fieldKey)) {
            field.display = { ...field.display ?? {}, ...displayPatch };
          }
        }
      }
    }
  }
  if (override.entityEmptyStateOverrides) {
    for (const [entityId, emptyState] of Object.entries(override.entityEmptyStateOverrides)) {
      const entity = cfg.entities[entityId];
      if (!entity) continue;
      entity.display = { ...entity.display ?? {}, emptyState };
    }
  }
  if (override.entityLabelOverrides) {
    for (const [entityId, label] of Object.entries(override.entityLabelOverrides)) {
      const entity = cfg.entities[entityId];
      if (!entity) continue;
      entity.label = label;
    }
  }
  return cfg;
}
function resolveWorkbookVariant(override, detectedVariant) {
  if (override?.forceVariant) return override.forceVariant;
  return detectedVariant ?? "unknown";
}

export {
  TssWorkbookVariantSchema,
  TssDirectionSchema,
  TssDataTypeSchema,
  TssRenderKindSchema,
  TssSheetResolutionModeSchema,
  TssHeaderResolutionModeSchema,
  TssEntitySectionSchema,
  TssSmartHeaderConfigSchema,
  TssSheetConfigSchema,
  TssTableRangeConfigSchema,
  TssKeyValueCellConfigSchema,
  TssDisplayEntityConfigSchema,
  TssSheetDropdownListSchema,
  TssInlineDropdownListSchema,
  TssDropdownListSchema,
  TssVariantRuleSchema,
  TssParsingDefaultsSchema,
  TssWorksheetConfigSchema,
  TssOrgConfigOverrideSchema,
  TssExtractionWarningSchema,
  TssExtractedEntityStatusSchema,
  TssExtractedCellSchema,
  TssExtractedRowSchema,
  TssNoteSectionBreakSchema,
  TssExtractedEntitySchema,
  TssWorkbookExtractSchema,
  smartHeaderId,
  TSS_SHEETS,
  TSS_WORKBOOK_VARIANT_RULES,
  TSS_HEADER_ALIASES,
  TSS_DROPDOWN_LISTS,
  TSS_COVER_ENTITY,
  TSS_CUSTOMER_STRENGTHS_ENTITY,
  TSS_HOUSING_BARRIERS_ENTITY,
  TSS_GOALS_ENTITY,
  TSS_SMART_GOALS_ACRONYM_ENTITY,
  TSS_PROGRESS_NOTES_ENTITY,
  TSS_BUDGET_ENTITY,
  TSS_DISPLAY_ENTITIES,
  TSS_WORKSHEET_CONFIG,
  resolveTssWorksheetConfig,
  resolveWorkbookVariant,
  tss_exports
};
