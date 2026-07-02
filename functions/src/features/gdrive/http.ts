// functions/src/features/gdrive/http.ts
import {
  secureHandler,
  GOOGLE_OAUTH_CLIENT_ID,
  GOOGLE_OAUTH_CLIENT_SECRET,
  GOOGLE_OAUTH_REFRESH_TOKEN,
  DRIVE_SANDBOX_FOLDER_ID,
  requireOrg,
  db,
  FieldValue,
} from "../../core";
import { GDriveListQuery, GDriveCreateFolderBody, GDriveUploadBody, GDriveBuildCustomerFolderBody, GDriveCopyGrantTemplatesBody } from "./schemas";
import {
  listInFolder,
  createFolder,
  uploadSmallFile,
  buildCustomerFolder,
  copyTemplatesIntoFolder,
  ScopeMissingError,
  type DriveListDiagnostics,
} from "./service";
import { z } from "zod";
import { tss } from "@hdb/contracts";
import { getOrgGDriveConfig, patchOrgGDriveConfig } from "./orgConfig";
import { linkFolderToCustomer } from "./customerFolderLink";
import { upsertFolderIndexEntry } from "./folderIndexCache";
import { isoNow } from "../../core";

// -- Scope error helper --------------------------------------------------------

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

function queryFlag(v: unknown): boolean {
  const raw = Array.isArray(v) ? v[0] : v;
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  return s === "1" || s === "true" || s === "yes" || s === "y" || s === "on";
}

function readGoogleAccessToken(req: { header(name: string): string | undefined }) {
  return String(req.header("x-drive-access-token") || "").trim() || undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function displayName(record: Record<string, unknown>): string {
  return (
    String(record.name || "").trim() ||
    [record.firstName, record.lastName].map((part) => String(part || "").trim()).filter(Boolean).join(" ") ||
    "Customer"
  );
}

function folderIdFromCustomer(customer: Record<string, unknown>): string {
  const customerDrive = asRecord(customer.customerDrive);
  const meta = asRecord(customer.meta);
  const metaFolders = Array.isArray(meta.driveFolders) ? meta.driveFolders : [];
  const firstMetaFolder = asRecord(metaFolders[0]);
  return (
    String(customerDrive.folderId || "").trim() ||
    String(meta.driveFolderId || "").trim() ||
    String(firstMetaFolder.id || "").trim()
  );
}

function folderPatch(folder: { id: string; name: string; url?: string }, existingMeta: Record<string, unknown>) {
  return {
    customerDrive: {
      folderId: folder.id,
      folderUrl: folder.url || `https://drive.google.com/drive/folders/${folder.id}`,
      folderName: folder.name,
      updatedAt: FieldValue.serverTimestamp(),
    },
    meta: {
      ...existingMeta,
      driveFolderId: folder.id,
      driveFolders: [{ id: folder.id, name: folder.name, alias: null }],
    },
  };
}

function cleanFolderPart(value: unknown): string {
  return String(value || "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .slice(0, 120);
}

function enrollmentFolderName(grantName: string, startDate?: string) {
  const parts = [cleanFolderPart(grantName) || "Grant", String(startDate || "").slice(0, 10)].filter(Boolean);
  return parts.join(" ").slice(0, 255);
}

function grantDriveTemplates(grant: Record<string, unknown>) {
  const rows = Array.isArray(grant.driveTemplates) ? grant.driveTemplates : [];
  return rows
    .map((raw) => {
      const row = asRecord(raw);
      const key = String(row.key || row.fileId || "").trim();
      const fileId = String(row.fileId || "").trim();
      const label = String(row.label || row.name || key || "Template").trim();
      return key && fileId && label ? { key, fileId, name: label, defaultChecked: row.defaultChecked !== false } : null;
    })
    .filter((row): row is { key: string; fileId: string; name: string; defaultChecked: boolean } => !!row);
}

function inferStatusCode(message: string, diagnostics?: DriveListDiagnostics): number {
  const status = Number(
    diagnostics?.fallbackListError?.status ??
      diagnostics?.scopedLookupError?.status ??
      NaN
  );
  if (Number.isFinite(status) && status >= 400 && status <= 599) return status;
  if (/insufficient permissions|file not found|not found|forbidden|permission/i.test(message)) return 400;
  return 500;
}

function buildHints(message: string, diagnostics?: DriveListDiagnostics): string[] {
  const hints = new Set<string>();
  const msg = String(message || "").toLowerCase();
  if (diagnostics?.authMode === "user_access_token") {
    hints.add("Drive access used the signed-in user's Google access token.");
  }
  if (diagnostics?.authMode === "server_user_oauth") {
    hints.add("Drive access used the user's permanent server-side Google Drive connection.");
  }
  if (diagnostics?.authMode === "service_account") {
    hints.add("Drive access used the project service account.");
  }
  if (diagnostics?.authMode === "shared_refresh_token") {
    hints.add("Drive access used the shared OAuth account. Shared OAuth is read-only; write actions require permanent per-user Drive access or a temporary user token.");
  }
  if (msg.includes("shared_oauth_read_only")) {
    hints.add("Shared OAuth is configured as read-only. Connect Google Drive permanently or use temporary browser access before creating, moving, renaming, uploading, or writing Sheets data.");
  }
  if (diagnostics?.auth?.hasDriveScope === false) {
    hints.add("The current access token does not include a Google Drive scope.");
  }
  if (Array.isArray(diagnostics?.auth?.missingExpectedScopes) && diagnostics.auth.missingExpectedScopes.length) {
    hints.add(`Token missing expected scopes: ${diagnostics.auth.missingExpectedScopes.join(", ")}`);
  }
  if (diagnostics?.folderMimeType && diagnostics.folderMimeType !== "application/vnd.google-apps.folder") {
    hints.add(`folderId resolved to ${diagnostics.folderMimeType}, not a folder.`);
  }
  if (
    diagnostics?.scopedLookupError?.status === 404 ||
    /file not found|not found/i.test(diagnostics?.scopedLookupError?.message || "")
  ) {
    hints.add("Folder ID is invalid or not visible to the OAuth token owner account.");
  }
  if (
    diagnostics?.scopedLookupError?.status === 403 ||
    diagnostics?.fallbackListError?.status === 403 ||
    /insufficient permissions|forbidden|permission/i.test(msg)
  ) {
    hints.add("Token owner lacks permission to this folder/shared drive. Share it with that account.");
  }
  if (diagnostics?.usedFallback && diagnostics?.resultCount === 0) {
    hints.add("Fallback allDrives query returned 0 children. Folder may be empty or inaccessible with this token.");
  }
  if (!hints.size) {
    hints.add("Use ?debug=1 to return Drive diagnostics (scopes, fallback path, and API error details).");
  }
  return Array.from(hints);
}

function classifyError(message: string, diagnostics?: DriveListDiagnostics): string {
  const msg = String(message || "").toLowerCase();
  if (msg.includes("missing_oauth_secrets")) return "auth_config";
  if (msg.includes("shared_oauth_read_only")) return "auth_mode_read_only";
  if (diagnostics?.auth?.hasDriveScope === false) return "oauth_scope";
  if (Array.isArray(diagnostics?.auth?.missingExpectedScopes) && diagnostics.auth.missingExpectedScopes.length) {
    return "oauth_scope";
  }
  if (/file not found|not found/i.test(msg)) return "not_found_or_unshared";
  if (/insufficient permissions|forbidden|permission/i.test(msg)) return "permission_denied";
  if (/invalid credentials|unauthenticated|unauthorized/i.test(msg)) return "auth_failed";
  return "drive_api_error";
}

export const gdriveList = secureHandler(
  async (req, res) => {
    try {
      const parsed = GDriveListQuery.parse(req.query ?? {});
      const debug = queryFlag((req.query as Record<string, unknown> | undefined)?.debug);
      const sandbox = DRIVE_SANDBOX_FOLDER_ID.value();
      const folderId = parsed.folderId || (sandbox ? String(sandbox) : "");

      if (!folderId) {
        res.status(400).json({ ok: false, error: "missing_folderId" });
        return;
      }

      const out = await listInFolder(folderId, {
        includeDiagnostics: debug,
        googleAccessToken: readGoogleAccessToken(req),
        userUid: String((req as any).user?.uid || ""),
      });
      const hints = buildHints("", out.diagnostics);
      res.status(200).json({
        ok: true,
        ...(out.data || {}),
        ...(debug
          ? {
              debug: {
                diagnostics: out.diagnostics,
                hints,
              },
            }
          : {}),
      });
    } catch (e: any) {
      if (e instanceof ScopeMissingError) {
        res.status(403).json(buildScopeErrorResponse(e));
        return;
      }
      const msg = String(e?.message || e || "gdrive_list_failed");
      const diagnostics = (e?.diagnostics || undefined) as DriveListDiagnostics | undefined;
      const code = inferStatusCode(msg, diagnostics);
      const hints = buildHints(msg, diagnostics);
      const category = classifyError(msg, diagnostics);
      const debug = queryFlag((req.query as Record<string, unknown> | undefined)?.debug);
      res.status(code).json({
        ok: false,
        error: msg,
        category,
        hint: hints[0],
        ...(debug
          ? {
              debug: {
                diagnostics,
                hints,
              },
            }
          : {}),
      });
    }
  },
  {
    auth: "viewer",
    methods: ["GET", "OPTIONS"],
    secrets: [GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN, DRIVE_SANDBOX_FOLDER_ID],
    memory: "512MiB",
    concurrency: 4,
    timeoutSeconds: 60,
  }
);

export const gdriveCreateFolder = secureHandler(
  async (req, res) => {
    try {
      const body = GDriveCreateFolderBody.parse(req.body ?? {});
      const r = await createFolder(body.parentId, body.name, {
        googleAccessToken: readGoogleAccessToken(req),
        userUid: String((req as any).user?.uid || ""),
      });
      res.status(200).json({ ok: true, folder: r });
    } catch (e: any) {
      if (e instanceof ScopeMissingError) { res.status(403).json(buildScopeErrorResponse(e)); return; }
      const msg = String(e?.message || e || "gdrive_create_folder_failed");
      const readOnly = msg.includes("shared_oauth_read_only");
      res.status(readOnly ? 403 : 500).json({
        ok: false,
        error: msg,
        ...(readOnly
          ? {
              category: "auth_mode_read_only",
              hint: "Shared OAuth is read-only. Connect Google Drive permanently or use temporary browser access before creating folders.",
            }
          : {}),
      });
    }
  },
  {
    auth: "viewer",
    methods: ["POST", "OPTIONS"],
    secrets: [GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN],
    // googleapis barrel OOMs under 256MiB. See gdriveBuildCustomerFolder.
    memory: "512MiB",
  }
);

export const gdriveBuildCustomerFolder = secureHandler(
  async (req, res) => {
    const body = GDriveBuildCustomerFolderBody.parse(req.body ?? {});
    const uid = String((req as any).user?.uid || "");
    try {
      const folder = await buildCustomerFolder({
        ...body,
        googleAccessToken: readGoogleAccessToken(req),
        userUid: uid,
        ...(body.customerId
          ? {
              existingFolderId: String(
                (await db.collection("customers").doc(body.customerId).get()).data()?.customerDrive?.folderId || "",
              ).trim() || undefined,
            }
          : {}),
      });

      // Atomically link to the customer (folder ref + auto-linked TSS workbook)
      // and seed the cached index, so the new folder is usable immediately
      // without waiting for the nightly index sync.
      let linked = false;
      if (body.customerId) {
        const orgId = requireOrg((req as any).user);
        try {
          await linkFolderToCustomer({
            customerId: body.customerId,
            orgId,
            folderId: folder.id,
            folderUrl: folder.url,
            folderName: folder.name,
          });
          if (folder.workbook?.spreadsheetId) {
            await db.collection("customers").doc(body.customerId).set(
              {
                customerDrive: {
                  linkedWorkbooks: {
                    tss: {
                      spreadsheetId: folder.workbook.spreadsheetId,
                      spreadsheetUrl: folder.workbook.url,
                      spreadsheetName: folder.workbook.name,
                      status: "linked",
                      linkedAt: isoNow(),
                      updatedAt: isoNow(),
                      linkedBy: uid,
                    },
                  },
                },
                updatedAt: FieldValue.serverTimestamp(),
              },
              { merge: true },
            );
          }
          await upsertFolderIndexEntry(orgId, { id: folder.id, name: folder.name, url: folder.url, status: "active" }, body.customerId);
          linked = true;
        } catch (linkErr: any) {
          // The folder exists; surface the link failure but don't 500 the build.
          res.status(200).json({ ok: true, folder, linked: false, linkError: String(linkErr?.message || linkErr) });
          return;
        }
      }

      res.status(200).json({ ok: true, folder, linked });
    } catch (e: any) {
      if (e instanceof ScopeMissingError) { res.status(403).json(buildScopeErrorResponse(e)); return; }
      const msg = String(e?.message || e || "gdrive_build_failed");
      const readOnly = msg.includes("shared_oauth_read_only");
      res.status(readOnly ? 403 : 500).json({
        ok: false,
        error: msg,
        ...(readOnly
          ? {
              category: "auth_mode_read_only",
              hint: "Shared OAuth is read-only. Connect Google Drive permanently or use temporary browser access before building customer folders.",
            }
          : {}),
      });
    }
  },
  {
    auth: "user",
    methods: ["POST", "OPTIONS"],
    secrets: [GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN],
    timeoutSeconds: 120,
    // googleapis is imported lazily as a full barrel; under 256MiB the instance
    // OOMs (~268MiB observed) once it copies templates → 500. Match gdriveList.
    memory: "512MiB",
    // This workflow is most failure-prone while googleapis initializes on a
    // cold instance. Keep one ready and retain resumability for platform faults.
    minInstances: 1,
  },
);

export const gdriveCopyGrantTemplates = secureHandler(
  async (req, res) => {
    try {
      const body = GDriveCopyGrantTemplatesBody.parse(req.body ?? {});
      const user = (req as any).user || {};
      const orgId = requireOrg(user);
      const [customerSnap, grantSnap] = await Promise.all([
        db.collection("customers").doc(body.customerId).get(),
        db.collection("grants").doc(body.grantId).get(),
      ]);
      if (!customerSnap.exists) {
        res.status(404).json({ ok: false, error: "customer_not_found" });
        return;
      }
      if (!grantSnap.exists) {
        res.status(404).json({ ok: false, error: "grant_not_found" });
        return;
      }

      const customer = customerSnap.data() || {};
      const grant = grantSnap.data() || {};
      if (String(customer.orgId || "") !== orgId || String(grant.orgId || "") !== orgId) {
        res.status(403).json({ ok: false, error: "forbidden_org" });
        return;
      }

      const allTemplates = grantDriveTemplates(grant);
      const selectedKeys = new Set((body.templateKeys?.length ? body.templateKeys : allTemplates.filter((t) => t.defaultChecked).map((t) => t.key)).map(String));
      const templates = allTemplates.filter((tmpl) => selectedKeys.has(tmpl.key));
      if (!templates.length) {
        res.status(400).json({ ok: false, error: "no_grant_templates_selected" });
        return;
      }

      const access = {
        googleAccessToken: readGoogleAccessToken(req),
        userUid: String(user.uid || ""),
      };
      let rootFolderId = folderIdFromCustomer(customer);
      let rootFolderName = String(asRecord(customer.customerDrive).folderName || asRecord(customer.meta).driveFolderName || "").trim();

      if (!rootFolderId) {
        if (!body.createCustomerFolderIfMissing || !body.parentId) {
          res.status(400).json({ ok: false, error: "customer_folder_missing" });
          return;
        }
        const built = await createFolder(body.parentId, displayName(customer), access);
        rootFolderId = String(built.id || "").trim();
        rootFolderName = String(built.name || displayName(customer));
        await customerSnap.ref.set(folderPatch({ id: rootFolderId, name: rootFolderName, url: built.webViewLink || "" }, asRecord(customer.meta)), { merge: true });
      }

      const grantName = String(grant.name || body.grantId);
      const startDate = body.startDate || (body.enrollmentId
        ? String((await db.collection("customerEnrollments").doc(body.enrollmentId).get()).data()?.startDate || "")
        : "");
      const subfolderName = enrollmentFolderName(grantName, startDate);
      const subfolder = await createFolder(rootFolderId, subfolderName, access);
      const subfolderId = String(subfolder.id || "").trim();
      if (!subfolderId) throw new Error("enrollment_template_folder_create_no_id");

      const copied = await copyTemplatesIntoFolder({
        folderId: subfolderId,
        customerName: displayName(customer),
        templates,
        ...access,
      });

      res.status(200).json({
        ok: true,
        folder: {
          id: subfolderId,
          name: String(subfolder.name || subfolderName),
          url: subfolder.webViewLink || `https://drive.google.com/drive/folders/${subfolderId}`,
        },
        copied: copied.copied,
        ...(copied.warnings ? { warnings: copied.warnings } : {}),
      });
    } catch (e: any) {
      if (e instanceof ScopeMissingError) { res.status(403).json(buildScopeErrorResponse(e)); return; }
      const msg = String(e?.message || e || "gdrive_copy_grant_templates_failed");
      const readOnly = msg.includes("shared_oauth_read_only");
      res.status(readOnly ? 403 : 500).json({
        ok: false,
        error: msg,
        ...(readOnly
          ? {
              category: "auth_mode_read_only",
              hint: "Shared OAuth is read-only. Connect Google Drive permanently or use temporary browser access before copying grant templates.",
            }
          : {}),
      });
    }
  },
  {
    auth: "user",
    methods: ["POST", "OPTIONS"],
    secrets: [GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN],
    timeoutSeconds: 120,
    // googleapis barrel OOMs under 256MiB once copying templates → 500. See gdriveBuildCustomerFolder.
    memory: "512MiB",
  },
);

export const gdriveUpload = secureHandler(
  async (req, res) => {
    const body = GDriveUploadBody.parse(req.body ?? {});
    try {
      const r = await uploadSmallFile({
        ...body,
        googleAccessToken: readGoogleAccessToken(req),
        userUid: String((req as any).user?.uid || ""),
      });
      res.status(200).json({ ok: true, file: r });
    } catch (e: any) {
      if (e instanceof ScopeMissingError) { res.status(403).json(buildScopeErrorResponse(e)); return; }
      const msg = String(e?.message || e);
      const readOnly = msg.includes("shared_oauth_read_only");
      const code = readOnly ? 403 : msg.includes("file_too_large") ? 413 : 400;
      res.status(code).json({
        ok: false,
        error: msg,
        ...(readOnly
          ? {
              category: "auth_mode_read_only",
              hint: "Shared OAuth is read-only. Connect Google Drive permanently or use temporary browser access before uploading files.",
            }
          : {}),
      });
    }
  },
  {
    auth: "user",
    methods: ["POST", "OPTIONS"],
    secrets: [GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN],
    // googleapis barrel OOMs under 256MiB. See gdriveBuildCustomerFolder.
    memory: "512MiB",
  }
);

const GDriveTemplateBody = z.object({
  key: z.string().min(1).max(100),
  // Relaxed from min(1): variant-only templates carry source ids in `variants`.
  fileId: z.string().max(300).optional().default(""),
  fileUrl: z.string().max(500).optional(),
  type: z.enum(["doc", "sheet", "pdf", "folder", "other"]),
  alias: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  defaultChecked: z.boolean().optional(),
  variants: z
    .object({
      payer: z.string().max(300).optional().default(""),
      nonpayer: z.string().max(300).optional().default(""),
    })
    .optional(),
});

const GDriveBuildSettingsBody = z.object({
  defaultSubfolders: z.array(z.string().min(1).max(200)).optional(),
  defaultTemplateKeys: z.array(z.string().min(1)).optional(),
});

const GDriveConfigPatchBody = z.object({
  activeParent: z.union([z.string(), z.null()]).optional(),
  exitedParent: z.union([z.string(), z.null()]).optional(),
  customerIndexSheet: z.union([z.string(), z.null()]).optional(),
  orgId: z.string().optional(),
  templates: z.array(GDriveTemplateBody).optional(),
  buildSettings: GDriveBuildSettingsBody.optional(),
  // null clears the override (revert to baseline); object is validated against
  // the contracts schema inside patchOrgGDriveConfig.
  worksheetConfig: z.union([tss.TssOrgConfigOverrideSchema, z.null()]).optional(),
});

export const gdriveConfigGet = secureHandler(
  async (req, res) => {
    const caller = (req as any).user;
    const orgId = requireOrg(caller);
    const config = await getOrgGDriveConfig(orgId);
    res.status(200).json({ ok: true, orgId, config });
  },
  {
    auth: "user",
    methods: ["GET", "OPTIONS"],
  }
);

export const gdriveConfigPatch = secureHandler(
  async (req, res) => {
    try {
      const caller = (req as any).user;
      const body = GDriveConfigPatchBody.parse(req.body ?? {});
      const updated = await patchOrgGDriveConfig({
        caller,
        orgId: body.orgId,
        patch: {
          ...(Object.prototype.hasOwnProperty.call(body, "activeParent")
            ? { activeParent: body.activeParent }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(body, "exitedParent")
            ? { exitedParent: body.exitedParent }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(body, "customerIndexSheet")
            ? { customerIndexSheet: body.customerIndexSheet }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(body, "templates")
            ? { templates: body.templates as any }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(body, "buildSettings")
            ? { buildSettings: body.buildSettings as any }
            : {}),
          ...(Object.prototype.hasOwnProperty.call(body, "worksheetConfig")
            ? { worksheetConfig: body.worksheetConfig as any }
            : {}),
        },
      });
      res.status(200).json({ ok: true, ...updated });
    } catch (e: any) {
      const code = Number(e?.code);
      res.status(Number.isFinite(code) ? code : 500).json({
        ok: false,
        error: String(e?.message || e || "gdrive_config_patch_failed"),
      });
    }
  },
  {
    auth: "user",
    methods: ["POST", "PATCH", "OPTIONS"],
  }
);
