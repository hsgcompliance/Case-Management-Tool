// functions/src/features/gdrive/workbookHttp.ts
//
// HTTP endpoints for customer workbook linking.
// All three functions use the server-side per-user Google OAuth connector pattern.

import { z } from "zod";
import { secureHandler, requireOrg } from "../../core";
import { GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_STATE_SECRET } from "../../core/env";
import {
  attachWorkbookByUrl,
  listFolderCandidates,
  attachWorkbookCandidate,
  convertXlsxAndAttach,
} from "./workbookService";
import { ScopeMissingError } from "./service";
import { extractWorkbook, WorkbookNotLinkedError, WorkbookNotConnectedError } from "./workbookExtractor";

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
        googleAccessToken: readGoogleAccessToken(req),
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
    memory: "256MiB",
    timeoutSeconds: 30,
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
      const result = await listFolderCandidates({ customerId, uid, googleAccessToken: readGoogleAccessToken(req) });
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
    memory: "256MiB",
    timeoutSeconds: 30,
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
        googleAccessToken: readGoogleAccessToken(req),
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
    memory: "256MiB",
    timeoutSeconds: 30,
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
        googleAccessToken: readGoogleAccessToken(req),
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
    memory: "256MiB",
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
      const extract = await extractWorkbook({ customerId, uid, orgId });
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
