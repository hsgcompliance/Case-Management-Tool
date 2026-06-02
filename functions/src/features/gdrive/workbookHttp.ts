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
} from "./workbookService";

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
