// functions/src/features/gdrive/customerFolderLink.ts
//
// Link an existing Drive folder (or a freshly-built one) to a customer, writing
// the folder reference in the Google-integrations storage order and stamping the
// cached index. Shared by the mobile "link a suggested folder" / "paste a folder
// link" flows and the build-and-link path.

import admin from "../../core/admin";
import { FieldValue } from "../../core";
import { secureHandler, requireOrg } from "../../core";
import { z } from "zod";
import { stampFolderIndexLinked } from "./folderIndexCache";

const FOLDER_ID_RE = /^[-\w]{20,}$/;

/** Accept a bare Drive folder id or any Drive folder URL. */
export function extractFolderId(input: unknown): string {
  const text = String(input ?? "").trim();
  if (!text) return "";
  const byPath = text.match(/\/folders\/([-\w]{20,})/i)?.[1];
  const byQuery = text.match(/[?&]id=([-\w]{20,})/i)?.[1];
  const id = byPath || byQuery || (FOLDER_ID_RE.test(text) ? text : "");
  return id;
}

type DriveFolderRef = { id?: string | null; url?: string | null; name?: string | null; alias?: string | null };

/**
 * Persist a folder link on the customer doc (customerDrive.folderId is the new
 * canonical home; meta.driveFolders[] + meta.driveFolderId are kept for the
 * legacy card/list resolvers) and stamp the cached index entry.
 */
export async function linkFolderToCustomer(args: {
  customerId: string;
  orgId: string;
  folderId: string;
  folderUrl?: string;
  folderName?: string;
}): Promise<void> {
  const { customerId, orgId, folderId } = args;
  const url = String(args.folderUrl || "").trim() || `https://drive.google.com/drive/folders/${folderId}`;
  const name = String(args.folderName || "").trim();

  const ref = admin.firestore().collection("customers").doc(customerId);
  const snap = await ref.get();
  if (!snap.exists) {
    const err: any = new Error("customer_not_found");
    err.code = 404;
    throw err;
  }
  const data = snap.data() || {};
  if (String(data.orgId || "").trim() && String(data.orgId).trim() !== orgId) {
    const err: any = new Error("forbidden");
    err.code = 403;
    throw err;
  }

  const meta = data.meta && typeof data.meta === "object" ? { ...(data.meta as Record<string, unknown>) } : {};
  const existing: DriveFolderRef[] = Array.isArray(meta.driveFolders) ? (meta.driveFolders as DriveFolderRef[]) : [];
  const filtered = existing.filter((f) => String(f?.id || "").trim() !== folderId);
  const entry: DriveFolderRef = { id: folderId, url, ...(name ? { name } : {}) };

  await ref.set(
    {
      customerDrive: { folderId, folderUrl: url },
      meta: { ...meta, driveFolders: [entry, ...filtered], driveFolderId: folderId },
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  await stampFolderIndexLinked(orgId, folderId, customerId);
}

const LinkBody = z.object({
  customerId: z.string().min(1),
  folderId: z.string().optional(),
  folderUrl: z.string().optional(),
  folderName: z.string().optional(),
});

export const customerFolderLink = secureHandler(
  async (req, res) => {
    const caller = (req as any).user;
    const orgId = requireOrg(caller);
    try {
      const body = LinkBody.parse(req.body ?? {});
      const folderId = extractFolderId(body.folderId || body.folderUrl);
      if (!folderId) {
        res.status(400).json({ ok: false, error: "invalid_folder_ref" });
        return;
      }
      await linkFolderToCustomer({
        customerId: body.customerId,
        orgId,
        folderId,
        folderUrl: body.folderUrl,
        folderName: body.folderName,
      });
      res.status(200).json({ ok: true, folderId });
    } catch (e: any) {
      const code = Number(e?.code);
      const isZod = e?.name === "ZodError";
      res.status(isZod ? 400 : Number.isFinite(code) && code >= 400 && code <= 599 ? code : 500).json({
        ok: false,
        error: isZod ? "invalid_request" : String(e?.message || "folder_link_failed"),
      });
    }
  },
  {
    auth: "user",
    methods: ["POST", "OPTIONS"],
  },
);
