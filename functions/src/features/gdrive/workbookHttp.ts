// functions/src/features/gdrive/workbookHttp.ts
//
// HTTP endpoints for customer workbook linking.
// All three functions use the server-side per-user Google OAuth connector pattern.

import { z } from "zod";
import { secureHandler, requireOrg } from "../../core";
import admin from "../../core/admin";
import { GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_STATE_SECRET } from "../../core/env";
import { deleteCalendarEvent } from "../calendar/calendarApi";
import {
  attachWorkbookByUrl,
  listFolderCandidates,
  attachWorkbookCandidate,
  convertXlsxAndAttach,
  copyWorkbookFromTemplate,
  setWorkbookVariant,
} from "./workbookService";
import { ScopeMissingError } from "./service";
import {
  extractWorkbook,
  appendWorkbookRow,
  deleteWorkbookRow,
  patchWorkbookScaffold,
  WorkbookNotLinkedError,
  WorkbookNotConnectedError,
  WorkbookEntityNotWritableError,
  WorkbookRowOutOfSyncError,
} from "./workbookExtractor";

function buildScopeErrorResponse(err: ScopeMissingError) {
  const permissions = err.missingPermissions;
  const hint =
    `${permissions.join(" and ")} ${permissions.length === 1 ? "was" : "were"} not granted during Google setup. ` +
    `Click Re-authorize to add ${permissions.length === 1 ? "it" : "them"}.`;
  return {
    ok: false as const,
    error: "oauth_scope_missing",
    category: "oauth_scope" as const,
    missingScopes: err.missingScopes,
    missingPermissions: permissions,
    hint,
    reconnectService: err.reconnectService,
  };
}

const SECRETS = [GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_STATE_SECRET];

function readGoogleAccessToken(req: { header(name: string): string | undefined }) {
  return String(req.header("x-drive-access-token") || "").trim() || undefined;
}

// ── POST attachCustomerWorkbookByUrl ─────────────────────────────────────────
// Parses a Google Sheets URL, optionally validates access via per-user Drive OAuth,
// and saves the workbook metadata to customers/{customerId}.customerDrive.linkedWorkbooks.tss

const AttachByUrlBody = z.object({
  customerId: z.string().min(1),
  workbookUrl: z.string().min(1),
  enrollmentId: z.string().optional(),
  variant: z.enum(["payer", "nonpayer"]).optional(),
});

export const attachCustomerWorkbookByUrl = secureHandler(
  async (req, res) => {
    const caller = (req as any).user;
    const uid = String(caller?.uid || "");
    requireOrg(caller);

    try {
      const body = AttachByUrlBody.parse(req.body ?? {});
      const result = await attachWorkbookByUrl({
        customerId: body.customerId,
        uid,
        workbookUrl: body.workbookUrl,
        enrollmentId: body.enrollmentId,
        variant: body.variant,
        googleAccessToken: readGoogleAccessToken(req),
        caller,
      });
      res.json({ ok: true, ...result });
    } catch (err: any) {
      if (err instanceof ScopeMissingError) { res.status(403).json(buildScopeErrorResponse(err)); return; }
      const isZod = err?.name === "ZodError";
      const msg = isZod ? "invalid_request" : String(err?.message || "attach_workbook_failed");
      const code = isZod ? 400 : Number(err?.code);
      res.status(isZod ? 400 : (Number.isFinite(code) && code >= 400 && code <= 599 ? code : 500)).json({
        ok: false,
        error: msg,
      });
    }
  },
  {
    auth: "user",
    methods: ["POST", "OPTIONS"],
    secrets: SECRETS,
    // 256MiB OOMs on the lazy monolithic `googleapis` import (peaks >256MiB)
    // → the worker is killed and Cloud Run returns an opaque plain-text 500
    // before the handler can respond. 512 is the floor the other workbook
    // endpoints (convert/append/getWorkbookData) already use.
    memory: "512MiB",
    timeoutSeconds: 60,
  },
);

// ── GET listCustomerFolderWorkbookCandidates ─────────────────────────────────
// Lists immediate Google Sheets + folders from the customer's linked Drive folder.
// Uses the per-user server-side OAuth (googleDrive service).
// Returns { status, folderId?, items[] } — non-throwing even when Drive is not connected.

export const listCustomerFolderWorkbookCandidates = secureHandler(
  async (req, res) => {
    const caller = (req as any).user;
    const uid = String(caller?.uid || "");
    requireOrg(caller);
    const customerId = String((req.query as Record<string, unknown>)?.customerId || "").trim();

    if (!customerId) {
      res.status(400).json({ ok: false, error: "missing_customerId" });
      return;
    }

    try {
      const result = await listFolderCandidates({ customerId, uid, googleAccessToken: readGoogleAccessToken(req), caller });
      res.json({ ok: true, ...result });
    } catch (err: any) {
      const msg = String(err?.message || "list_candidates_failed");
      const code = Number(err?.code);
      res.status(Number.isFinite(code) && code >= 400 && code <= 599 ? code : 500).json({
        ok: false,
        error: msg,
      });
    }
  },
  {
    auth: "user",
    methods: ["GET", "OPTIONS"],
    secrets: SECRETS,
    // 256MiB OOMs on the lazy monolithic `googleapis` import (peaks >256MiB)
    // → opaque plain-text 500. Match the 512 floor used by sibling endpoints.
    memory: "512MiB",
    timeoutSeconds: 60,
  },
);

// ── POST attachCustomerWorkbookCandidate ─────────────────────────────────────
// Links a spreadsheet chosen from the folder listing.
// Optionally validates that the file is still a Spreadsheet via Drive API.

const AttachCandidateBody = z.object({
  customerId: z.string().min(1),
  spreadsheetId: z.string().min(1),
  spreadsheetName: z.string().optional(),
  enrollmentId: z.string().optional(),
  variant: z.enum(["payer", "nonpayer"]).optional(),
});

export const attachCustomerWorkbookCandidate = secureHandler(
  async (req, res) => {
    const caller = (req as any).user;
    const uid = String(caller?.uid || "");
    requireOrg(caller);

    try {
      const body = AttachCandidateBody.parse(req.body ?? {});
      const result = await attachWorkbookCandidate({
        customerId: body.customerId,
        uid,
        spreadsheetId: body.spreadsheetId,
        spreadsheetName: body.spreadsheetName,
        enrollmentId: body.enrollmentId,
        variant: body.variant,
        googleAccessToken: readGoogleAccessToken(req),
        caller,
      });
      res.json({ ok: true, ...result });
    } catch (err: any) {
      if (err instanceof ScopeMissingError) { res.status(403).json(buildScopeErrorResponse(err)); return; }
      const isZod = err?.name === "ZodError";
      const msg = isZod ? "invalid_request" : String(err?.message || "attach_candidate_failed");
      const code = isZod ? 400 : Number(err?.code);
      res.status(isZod ? 400 : (Number.isFinite(code) && code >= 400 && code <= 599 ? code : 500)).json({
        ok: false,
        error: msg,
      });
    }
  },
  {
    auth: "user",
    methods: ["POST", "OPTIONS"],
    secrets: SECRETS,
    // 256MiB OOMs on the lazy monolithic `googleapis` import (peaks >256MiB)
    // → the worker is killed and Cloud Run returns an opaque plain-text 500
    // before the handler can respond. 512 is the floor the other workbook
    // endpoints (convert/append/getWorkbookData) already use.
    memory: "512MiB",
    timeoutSeconds: 60,
  },
);

// ── POST convertCustomerWorkbookXlsx ──────────────────────────────────────────
// Converts an .xlsx/.xls file in the customer folder into a native Google Sheet
// and links it as the TSS workbook. Folder-surface write (user OAuth preferred).

const ConvertXlsxBody = z.object({
  customerId: z.string().min(1),
  fileId: z.string().min(1),
  fileName: z.string().optional(),
  enrollmentId: z.string().optional(),
  variant: z.enum(["payer", "nonpayer"]).optional(),
});

export const convertCustomerWorkbookXlsx = secureHandler(
  async (req, res) => {
    const caller = (req as any).user;
    const uid = String(caller?.uid || "");
    requireOrg(caller);

    try {
      const body = ConvertXlsxBody.parse(req.body ?? {});
      const result = await convertXlsxAndAttach({
        customerId: body.customerId,
        uid,
        fileId: body.fileId,
        fileName: body.fileName,
        enrollmentId: body.enrollmentId,
        variant: body.variant,
        googleAccessToken: readGoogleAccessToken(req),
        caller,
      });
      res.json({ ok: true, ...result });
    } catch (err: any) {
      if (err instanceof ScopeMissingError) { res.status(403).json(buildScopeErrorResponse(err)); return; }
      const isZod = err?.name === "ZodError";
      const msg = isZod ? "invalid_request" : String(err?.message || "workbook_convert_failed");
      const code = isZod ? 400 : Number(err?.code);
      res.status(isZod ? 400 : (Number.isFinite(code) && code >= 400 && code <= 599 ? code : 500)).json({
        ok: false,
        error: msg,
      });
    }
  },
  {
    auth: "user",
    methods: ["POST", "OPTIONS"],
    secrets: SECRETS,
    // 256MiB OOMs (googleapis client + copy peaks ~265MiB) → opaque 500s. 512 is
    // the floor the other workbook endpoints use.
    memory: "512MiB",
    timeoutSeconds: 60,
  },
);

// ── POST copyCustomerWorkbookFromTemplate ────────────────────────────────────
// Copies the org's configured TSS workbook template (payer / non-payer variant)
// into the customer's existing Drive folder and links it as the TSS workbook.
// Source file ids are resolved server-side from org config — the client only
// chooses the variant.

const CopyFromTemplateBody = z.object({
  customerId: z.string().min(1),
  variant: z.enum(["payer", "nonpayer"]),
  enrollmentId: z.string().optional(),
});

export const copyCustomerWorkbookFromTemplate = secureHandler(
  async (req, res) => {
    const caller = (req as any).user;
    const uid = String(caller?.uid || "");
    const orgId = requireOrg(caller);

    try {
      const body = CopyFromTemplateBody.parse(req.body ?? {});
      const result = await copyWorkbookFromTemplate({
        customerId: body.customerId,
        uid,
        orgId,
        variant: body.variant,
        enrollmentId: body.enrollmentId,
        googleAccessToken: readGoogleAccessToken(req),
        caller,
      });
      res.json({ ok: true, ...result });
    } catch (err: any) {
      if (err instanceof ScopeMissingError) { res.status(403).json(buildScopeErrorResponse(err)); return; }
      const isZod = err?.name === "ZodError";
      const msg = isZod ? "invalid_request" : String(err?.message || "tss_template_copy_failed");
      const code = isZod ? 400 : Number(err?.code);
      res.status(isZod ? 400 : (Number.isFinite(code) && code >= 400 && code <= 599 ? code : 500)).json({
        ok: false,
        error: msg,
      });
    }
  },
  {
    auth: "user",
    methods: ["POST", "OPTIONS"],
    secrets: SECRETS,
    // googleapis barrel + files.copy peaks >256MiB → opaque 500. 512 floor.
    memory: "512MiB",
    timeoutSeconds: 120,
  },
);

// ── POST appendWorkbookRow ────────────────────────────────────────────────────
// Append a new row to a writable dataTable entity (Slice A: progress notes).
// Strict per-user server OAuth (write attributed to the signed-in user). The
// caller passes customerId + entityId + field values — never a spreadsheet id
// or range. Append-only: writes into the first empty data row.

const AppendRowBody = z.object({
  customerId: z.string().min(1),
  entityId: z.string().min(1),
  values: z.record(z.string(), z.string()),
  // "append" (default, progress notes) | "insert" (new row, e.g. goals — shifts
  // the table below down) | "update" (overwrite the row identified by rowKey).
  mode: z.enum(["append", "insert", "update"]).optional(),
  rowKey: z.string().optional(),
});

const WorkbookScaffoldPatchBody = z.object({
  customerId: z.string().min(1),
  cover: z.object({
    clientName: z.string().optional(),
    dob: z.string().optional(),
    hmisCwId: z.string().optional(),
  }).optional(),
  strengths: z.object({
    clientStrengths: z.string().optional(),
  }).optional(),
  fillPageNames: z.boolean().optional(),
  planDate: z.enum(["createdAt", "today"]).optional(),
});

export const appendCustomerWorkbookRow = secureHandler(
  async (req, res) => {
    const caller = (req as any).user;
    const uid = String(caller?.uid || "");
    const orgId = requireOrg(caller);

    try {
      const body = AppendRowBody.parse(req.body ?? {});
      if (body.mode === "update" && !body.rowKey) {
        res.status(400).json({ ok: false, error: "row_key_required" });
        return;
      }
      const result = await appendWorkbookRow({
        customerId: body.customerId,
        uid,
        orgId,
        entityId: body.entityId,
        values: body.values,
        mode: body.mode,
        rowKey: body.rowKey,
        caller,
      });
      res.json({ ok: true, ...result });
    } catch (err: any) {
      if (err instanceof ScopeMissingError) { res.status(403).json(buildScopeErrorResponse(err)); return; }
      if (err instanceof WorkbookNotConnectedError || String(err?.message) === "google_not_connected") {
        res.status(409).json({ ok: false, error: "google_not_connected", category: "not_connected", reconnectService: "googleDrive" });
        return;
      }
      if (err instanceof WorkbookNotLinkedError || String(err?.message) === "workbook_not_linked") {
        res.status(404).json({ ok: false, error: "workbook_not_linked" });
        return;
      }
      if (err instanceof WorkbookEntityNotWritableError) {
        res.status(422).json({ ok: false, error: String(err?.message || "entity_not_writable") });
        return;
      }
      const isZod = err?.name === "ZodError";
      res.status(isZod ? 400 : 500).json({ ok: false, error: isZod ? "invalid_request" : String(err?.message || "workbook_append_failed") });
    }
  },
  {
    auth: "user",
    methods: ["POST", "OPTIONS"],
    secrets: SECRETS,
    memory: "512MiB",
    timeoutSeconds: 60,
  },
);

// ── GET getWorkbookData ───────────────────────────────────────────────────────
// Read-only native extraction of TSS workbook content (Slice A).
//
// Strict per-user server OAuth ONLY (workbook-content policy). The caller passes
// only customerId — the spreadsheet id is resolved from the customer record and
// the config is resolved server-side. Fails closed: not connected / missing scope
// returns a structured error so the UI falls back to the iframe / open-sheet path.

export const patchCustomerWorkbookScaffold = secureHandler(
  async (req, res) => {
    const caller = (req as any).user;
    const uid = String(caller?.uid || "");
    const orgId = requireOrg(caller);

    try {
      const body = WorkbookScaffoldPatchBody.parse(req.body ?? {});
      const result = await patchWorkbookScaffold({
        customerId: body.customerId,
        uid,
        orgId,
        input: {
          cover: body.cover,
          strengths: body.strengths,
          fillPageNames: body.fillPageNames,
          planDate: body.planDate,
        },
        caller,
      });
      res.json({ ok: true, ...result });
    } catch (err: any) {
      if (err instanceof ScopeMissingError) { res.status(403).json(buildScopeErrorResponse(err)); return; }
      if (err instanceof WorkbookNotConnectedError || String(err?.message) === "google_not_connected") {
        res.status(409).json({ ok: false, error: "google_not_connected", category: "not_connected", reconnectService: "googleDrive" });
        return;
      }
      if (err instanceof WorkbookNotLinkedError || String(err?.message) === "workbook_not_linked") {
        res.status(404).json({ ok: false, error: "workbook_not_linked" });
        return;
      }
      const isZod = err?.name === "ZodError";
      res.status(isZod ? 400 : 500).json({ ok: false, error: isZod ? "invalid_request" : String(err?.message || "workbook_scaffold_patch_failed") });
    }
  },
  {
    auth: "user",
    methods: ["POST", "OPTIONS"],
    secrets: SECRETS,
    memory: "512MiB",
    timeoutSeconds: 90,
  },
);

const DeleteRowBody = z.object({
  customerId: z.string().min(1),
  entityId: z.string().min(1),
  rowKey: z.string().regex(/^row-\d+$/),
  deleteCalendarEvent: z.boolean().optional(),
  rowFingerprint: z.object({
    date: z.string().optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    summary: z.string().optional(),
  }).optional(),
  expectedValues: z.record(z.string(), z.string()).optional(),
});

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function activityMatchesFingerprint(activity: Record<string, any>, fingerprint?: {
  date?: string;
  startTime?: string;
  endTime?: string;
  summary?: string;
}): boolean {
  if (!fingerprint) return true;
  const date = cleanText(fingerprint.date);
  const startTime = cleanText(fingerprint.startTime);
  const endTime = cleanText(fingerprint.endTime);
  const summary = cleanText(fingerprint.summary);
  if (date && cleanText(activity.date) !== date) return false;
  if (startTime && cleanText(activity.startTime) !== startTime) return false;
  if (endTime && cleanText(activity.endTime) !== endTime) return false;
  if (summary) {
    const note = cleanText(activity.note);
    const type = cleanText(activity.type);
    if (note && !summary.includes(note)) return false;
    if (type === "phone" && !/phone/i.test(summary)) return false;
    if (type === "in-person" && !/in person/i.test(summary)) return false;
    if (type === "data-entry" && !/data entry/i.test(summary)) return false;
    if (type === "other" && !/on behalf of/i.test(summary)) return false;
  }
  return true;
}

async function findMatchingProgressActivity(args: {
  customerId: string;
  rowKey: string;
  uid: string;
  fingerprint?: { date?: string; startTime?: string; endTime?: string; summary?: string };
}): Promise<{ id: string; data: Record<string, any> } | null> {
  const snap = await admin.firestore()
    .collection("cmActivities")
    .where("workbookRowKey", "==", args.rowKey)
    .limit(10)
    .get();

  for (const docSnap of snap.docs) {
    const data = docSnap.data() as Record<string, any>;
    if (cleanText(data.customerId) !== args.customerId) continue;
    if (cleanText(data.caseManagerId) !== args.uid) continue;
    if (data.workbookSynced !== true) continue;
    if (!activityMatchesFingerprint(data, args.fingerprint)) continue;
    return { id: docSnap.id, data };
  }
  return null;
}

export const deleteCustomerWorkbookRow = secureHandler(
  async (req, res) => {
    const caller = (req as any).user;
    const uid = String(caller?.uid || "");
    const orgId = requireOrg(caller);

    try {
      const body = DeleteRowBody.parse(req.body ?? {});
      const activity = body.entityId === "progressNotes"
        ? await findMatchingProgressActivity({
            customerId: body.customerId,
            rowKey: body.rowKey,
            uid,
            fingerprint: body.rowFingerprint,
          })
        : null;

      const result = await deleteWorkbookRow({
        customerId: body.customerId,
        uid,
        orgId,
        entityId: body.entityId,
        rowKey: body.rowKey,
        expectedValues: body.expectedValues ?? {},
        caller,
      });

      let calendarDeleted = false;
      let calendarNotFound = false;
      let calendarSkippedReason: string | undefined;
      if (body.entityId === "progressNotes" && body.deleteCalendarEvent) {
        const eventId = cleanText(activity?.data?.calendarEventId);
        if (eventId) {
          const cal = await deleteCalendarEvent(uid, eventId);
          if (!cal.ok) {
            res.status(cal.code === "calendar_not_connected" ? 400 : 502).json(cal);
            return;
          }
          calendarDeleted = true;
          calendarNotFound = cal.notFound === true;
        } else {
          calendarSkippedReason = activity ? "no_calendar_event_id" : "no_matching_activity";
        }
      }

      let activityDeleted = false;
      if (activity) {
        await admin.firestore().collection("cmActivities").doc(activity.id).delete();
        activityDeleted = true;
      }

      res.json({
        ok: true,
        ...result,
        activityDeleted,
        calendarDeleted,
        calendarNotFound,
        ...(calendarSkippedReason ? { calendarSkippedReason } : {}),
      });
    } catch (err: any) {
      if (err instanceof ScopeMissingError) { res.status(403).json(buildScopeErrorResponse(err)); return; }
      if (err instanceof WorkbookNotConnectedError || String(err?.message) === "google_not_connected") {
        res.status(409).json({ ok: false, error: "google_not_connected", category: "not_connected", reconnectService: "googleDrive" });
        return;
      }
      if (err instanceof WorkbookNotLinkedError || String(err?.message) === "workbook_not_linked") {
        res.status(404).json({ ok: false, error: "workbook_not_linked" });
        return;
      }
      if (err instanceof WorkbookEntityNotWritableError) {
        res.status(422).json({ ok: false, error: String(err?.message || "entity_not_writable") });
        return;
      }
      if (err instanceof WorkbookRowOutOfSyncError) {
        res.status(409).json({
          ok: false,
          error: String(err?.message || "row_out_of_sync"),
          manualActionRequired: true,
          message: "The workbook row no longer matches what was loaded. Open the workbook and make the change manually.",
        });
        return;
      }
      const isZod = err?.name === "ZodError";
      res.status(isZod ? 400 : 500).json({ ok: false, error: isZod ? "invalid_request" : String(err?.message || "workbook_delete_failed") });
    }
  },
  {
    auth: "user",
    methods: ["POST", "OPTIONS"],
    secrets: SECRETS,
    memory: "512MiB",
    timeoutSeconds: 60,
  },
);

export const getWorkbookData = secureHandler(
  async (req, res) => {
    const caller = (req as any).user;
    const uid = String(caller?.uid || "");
    const orgId = requireOrg(caller);
    const customerId = String((req.query as Record<string, unknown>)?.customerId || "").trim();

    if (!customerId) {
      res.status(400).json({ ok: false, error: "missing_customerId" });
      return;
    }

    try {
      const extract = await extractWorkbook({ customerId, uid, orgId, caller });
      res.json({ ok: true, extract });
    } catch (err: any) {
      // Scope missing → named-permission re-authorize banner.
      if (err instanceof ScopeMissingError) {
        res.status(403).json(buildScopeErrorResponse(err));
        return;
      }
      // Not connected → UI falls back to iframe/open-sheet.
      if (err instanceof WorkbookNotConnectedError || String(err?.message) === "google_not_connected") {
        res.status(409).json({
          ok: false,
          error: "google_not_connected",
          category: "not_connected",
          reconnectService: "googleDrive",
          hint: "Connect Google Drive to view workbook content in the app. You can still open the sheet directly.",
        });
        return;
      }
      // No workbook linked on the customer.
      if (err instanceof WorkbookNotLinkedError || String(err?.message) === "workbook_not_linked") {
        res.status(404).json({ ok: false, error: "workbook_not_linked" });
        return;
      }
      res.status(500).json({ ok: false, error: String(err?.message || "workbook_extract_failed") });
    }
  },
  {
    auth: "user",
    methods: ["GET", "OPTIONS"],
    secrets: SECRETS,
    memory: "512MiB",
    timeoutSeconds: 60,
  },
);

// ── POST setCustomerWorkbookVariant ──────────────────────────────────────────
// Toggles the payer / non-payer variant on an already-linked TSS workbook.
// Pure Firestore metadata write (no Drive call) — used by the Integrations tab
// and workbook detail panel to control AI case-note assistant eligibility.

const SetWorkbookVariantBody = z.object({
  customerId: z.string().min(1),
  variant: z.enum(["payer", "nonpayer"]),
});

export const setCustomerWorkbookVariant = secureHandler(
  async (req, res) => {
    const caller = (req as any).user;
    const uid = String(caller?.uid || "");
    requireOrg(caller);

    try {
      const body = SetWorkbookVariantBody.parse(req.body ?? {});
      const result = await setWorkbookVariant({
        customerId: body.customerId,
        uid,
        variant: body.variant,
        caller,
      });
      res.json({ ok: true, ...result });
    } catch (err: any) {
      const isZod = err?.name === "ZodError";
      const msg = isZod ? "invalid_request" : String(err?.message || "set_workbook_variant_failed");
      const code = isZod ? 400 : Number(err?.code);
      res.status(isZod ? 400 : (Number.isFinite(code) && code >= 400 && code <= 599 ? code : 500)).json({
        ok: false,
        error: msg,
      });
    }
  },
  {
    auth: "user",
    methods: ["POST", "OPTIONS"],
  },
);
