import { secureHandler, db, FieldValue, requireLevel, requireOrg } from "../../core";
import { getDriveClient, getSheetsClient } from "./service";
import { getOrgGDriveConfig } from "./orgConfig";
import { z } from "zod";

type CustomerRow = Record<string, unknown> & {
  id: string;
  orgId?: string;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  cwId?: string | null;
  hmisId?: string | null;
  status?: string | null;
  active?: boolean | null;
  meta?: {
    driveFolders?: Array<{ id?: string | null; name?: string | null; alias?: string | null }>;
  } | null;
};

type IndexFolder = {
  id: string;
  name: string;
  url: string;
  createdTime: string | null;
  status: "active" | "exited";
  last: string | null;
  first: string | null;
  cwid: string | null;
};

const ReconcileBody = z.object({
  mode: z.enum(["setFolderState", "reconcile", "folderCwIdFromCustomer", "customerCwIdFromFolder"]),
  customerId: z.string().trim().optional(),
  folderId: z.string().trim().optional(),
  active: z.boolean().optional(),
  direction: z.enum(["customer_to_folder", "folder_to_customer"]).optional(),
  apply: z.boolean().optional().default(false),
  onlyLinked: z.boolean().optional().default(false),
  limit: z.coerce.number().int().min(1).max(500).optional().default(250),
});

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[_,-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9 ]/g, "");
}

function normalizeId(value: unknown): string {
  return String(value ?? "").trim();
}

function customerIsActive(customer: CustomerRow): boolean {
  if (typeof customer.active === "boolean") return customer.active;
  const status = String(customer.status || "").trim().toLowerCase();
  if (status === "inactive" || status === "deleted") return false;
  return true;
}

function folderTargetStatus(active: boolean): "ACTIVE" | "EXITED" {
  return active ? "ACTIVE" : "EXITED";
}

function folderStatusToken(status: string): "active" | "exited" | "" {
  const token = String(status || "").trim().toLowerCase();
  if (token === "active") return "active";
  if (token === "exited" || token === "archived") return "exited";
  return "";
}

function parseFolderName(name: string) {
  const match = name.match(/^([^,]+),\s*([^_]+?)(?:_(.+))?$/);
  if (!match) return { last: null, first: null, cwid: null };
  return {
    last: (match[1] ?? "").trim() || null,
    first: (match[2] ?? "").trim() || null,
    cwid: (match[3] ?? "").trim() || null,
  };
}

function buildFolderName(last: string, first: string, cwid?: string | null) {
  const base = `${String(last || "").trim()}, ${String(first || "").trim()}`.trim();
  const cleanCwid = String(cwid || "").trim();
  return cleanCwid ? `${base}_${cleanCwid}` : base;
}

function scoreFolderMatch(folder: IndexFolder, customer: CustomerRow): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  const linkedIds = Array.isArray(customer.meta?.driveFolders)
    ? customer.meta?.driveFolders.map((item) => normalizeId(item?.id)).filter(Boolean)
    : [];
  if (linkedIds.includes(folder.id)) {
    score += 100;
    reasons.push("linked");
  }

  const customerFirst = normalizeText(customer.firstName || "");
  const customerLast = normalizeText(customer.lastName || "");
  const customerName = normalizeText(customer.name || "");
  const customerCwId = normalizeId(customer.cwId || customer.hmisId || "");

  const folderFirst = normalizeText(folder.first || "");
  const folderLast = normalizeText(folder.last || "");
  const folderName = normalizeText(folder.name || "");
  const folderCwid = normalizeId(folder.cwid || "");

  if (customerCwId && folderCwid && customerCwId.toLowerCase() === folderCwid.toLowerCase()) {
    score += 95;
    reasons.push("cwid exact");
  } else if (customerCwId && folderCwid) {
    score -= 30;
  }

  if (customerLast && folderLast && customerLast === folderLast) {
    score += 42;
    reasons.push("last exact");
  } else if (customerLast && folderLast && (folderLast.startsWith(customerLast) || customerLast.startsWith(folderLast))) {
    score += 20;
    reasons.push("last partial");
  }

  if (customerFirst && folderFirst && customerFirst === folderFirst) {
    score += 34;
    reasons.push("first exact");
  } else if (customerFirst && folderFirst && (folderFirst.startsWith(customerFirst) || customerFirst.startsWith(folderFirst))) {
    score += 16;
    reasons.push("first partial");
  }

  if (customerName && folderName && folderName.includes(customerName)) {
    score += 12;
    reasons.push("name contains");
  }

  if (customerFirst && customerLast) {
    const expectedFolderName = normalizeText(buildFolderName(customer.lastName as string, customer.firstName as string, customerCwId || null));
    if (expectedFolderName && expectedFolderName === folderName) {
      score += 20;
      reasons.push("folder name exact");
    }
  }

  return { score: Math.max(0, Math.min(100, score)), reasons };
}

async function listFoldersInParent(folderId: string, status: "active" | "exited"): Promise<IndexFolder[]> {
  const drive = await getDriveClient();
  const out = await drive.files.list({
    q: `'${folderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id,name,webViewLink,createdTime)",
    pageSize: 1000,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: "allDrives",
  });

  return (out.data.files || []).map((file: any) => ({
    id: String(file.id || ""),
    name: String(file.name || ""),
    url: String(file.webViewLink || `https://drive.google.com/drive/folders/${file.id || ""}`),
    createdTime: String(file.createdTime || "") || null,
    status,
    ...parseFolderName(String(file.name || "")),
  }));
}

async function loadIndexFolders(orgId: string) {
  const config = await getOrgGDriveConfig(orgId);
  const folders: IndexFolder[] = [];
  if (config.customerFolderIndex.activeParentId) {
    folders.push(...await listFoldersInParent(config.customerFolderIndex.activeParentId, "active"));
  }
  if (config.customerFolderIndex.exitedParentId) {
    folders.push(...await listFoldersInParent(config.customerFolderIndex.exitedParentId, "exited"));
  }
  return { folders, config };
}

async function loadCustomers(orgId: string, opts?: { customerId?: string; limit?: number }) {
  if (opts?.customerId) {
    const snap = await db.collection("customers").doc(opts.customerId).get();
    if (!snap.exists) return [];
    const row = { id: snap.id, ...(snap.data() || {}) } as CustomerRow;
    return normalizeId(row.orgId) === orgId ? [row] : [];
  }

  const snap = await db
    .collection("customers")
    .where("orgId", "==", orgId)
    .orderBy("updatedAt", "desc")
    .limit(Math.max(1, Math.min(500, Number(opts?.limit ?? 250))))
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) } as CustomerRow));
}

function resolveFolderCandidates(customer: CustomerRow, folders: IndexFolder[]) {
  const linkedIds = new Set(
    Array.isArray(customer.meta?.driveFolders)
      ? customer.meta?.driveFolders.map((item) => normalizeId(item?.id)).filter(Boolean)
      : [],
  );

  return folders
    .map((folder) => {
      const scored = scoreFolderMatch(folder, customer);
      return {
        folder,
        score: scored.score,
        reasons: scored.reasons,
        linked: linkedIds.has(folder.id),
      };
    })
    .filter((candidate) => candidate.linked || candidate.score >= 35)
    .sort((a, b) => {
      if (a.linked !== b.linked) return a.linked ? -1 : 1;
      return b.score - a.score;
    });
}

function quoteSheetTitle(title: string) {
  return `'${String(title || "").replace(/'/g, "''")}'`;
}

async function readSheetLookup(sheetId: string) {
  const sheets = await getSheetsClient();
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: sheetId,
    fields: "sheets(properties(sheetId,title,index))",
  });
  const sheetProps = (meta.data.sheets || []).map((sheet: any) => sheet.properties || {});
  const targetSheet =
    sheetProps.find((sheet: any) => String(sheet.title || "").trim().toLowerCase() === "index") ||
    sheetProps.sort((a: any, b: any) => Number(a.index || 0) - Number(b.index || 0))[0];

  if (!targetSheet?.title) {
    throw new Error("customer_index_sheet_missing_tab");
  }

  const title = String(targetSheet.title);
  const values = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${quoteSheetTitle(title)}!A:Z`,
  });

  const rows = Array.isArray(values.data.values) ? values.data.values : [];
  const header = Array.isArray(rows[0]) ? rows[0].map((value) => String(value || "").trim()) : [];
  const headerMap = new Map<string, number>();
  header.forEach((label, index) => {
    if (label) headerMap.set(label, index);
  });

  return { sheets, title, rows, headerMap };
}

function columnToA1(index: number) {
  let value = index + 1;
  let out = "";
  while (value > 0) {
    const rem = (value - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    value = Math.floor((value - 1) / 26);
  }
  return out;
}

async function updateIndexRow(args: {
  sheetId: string;
  folder: IndexFolder;
  targetStatus?: "ACTIVE" | "EXITED";
  resultMessage: string;
  nextName?: string;
  nextCwId?: string | null;
}) {
  const lookup = await readSheetLookup(args.sheetId);
  const folderIdCol = lookup.headerMap.get("Folder ID");
  if (folderIdCol == null) throw new Error("customer_index_sheet_missing_folder_id_column");

  const rowIndex = lookup.rows.findIndex((row, index) => index > 0 && String(row[folderIdCol] || "").trim() === args.folder.id);
  if (rowIndex < 0) {
    return { updated: false, reason: "folder_not_found_in_sheet" };
  }

  const updates: Array<{ range: string; values: string[][] }> = [];
  const a1Title = quoteSheetTitle(lookup.title);

  const pushCell = (header: string, value: string | null | undefined) => {
    const columnIndex = lookup.headerMap.get(header);
    if (columnIndex == null || value == null) return;
    updates.push({
      range: `${a1Title}!${columnToA1(columnIndex)}${rowIndex + 1}`,
      values: [[value]],
    });
  };

  if (args.targetStatus) pushCell("Status", args.targetStatus);
  pushCell("Result", args.resultMessage);

  if (args.nextName) {
    pushCell("Folder Name", args.nextName);
    const parsed = parseFolderName(args.nextName);
    pushCell("First", parsed.first);
    pushCell("Last", parsed.last);
    pushCell("CWID", args.nextCwId ?? parsed.cwid);
  } else if (args.nextCwId != null) {
    pushCell("CWID", args.nextCwId || "");
  }

  if (!updates.length) return { updated: false, reason: "no_sheet_updates" };

  await lookup.sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: args.sheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: updates,
    },
  });

  return { updated: true };
}

async function renameFolderAndUpdateIndex(args: {
  folder: IndexFolder;
  nextName: string;
  sheetId?: string;
}) {
  const drive = await getDriveClient();
  await drive.files.update({
    fileId: args.folder.id,
    requestBody: { name: args.nextName },
    fields: "id,name",
    supportsAllDrives: true,
  });

  if (args.sheetId) {
    await updateIndexRow({
      sheetId: args.sheetId,
      folder: args.folder,
      nextName: args.nextName,
      nextCwId: parseFolderName(args.nextName).cwid,
      resultMessage: `renamed by app (${new Date().toISOString()})`,
    });
  }
}

async function patchCustomerStatus(customerId: string, active: boolean) {
  await db.collection("customers").doc(customerId).set({
    status: active ? "active" : "inactive",
    active,
    deleted: false,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function patchCustomerCwId(customerId: string, cwId: string) {
  await db.collection("customers").doc(customerId).set({
    cwId,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function patchCustomerLinkedFolderName(customer: CustomerRow, folderId: string, nextName: string) {
  const current = Array.isArray(customer.meta?.driveFolders) ? customer.meta?.driveFolders : [];
  const nextFolders = current.map((item) => {
    if (normalizeId(item?.id) !== folderId) return item;
    return {
      ...item,
      name: nextName,
    };
  });
  await db.collection("customers").doc(customer.id).set({
    meta: {
      ...(customer.meta || {}),
      driveFolders: nextFolders,
    },
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}

export const gdriveCustomerFolderSync = secureHandler(
  async (req, res) => {
    const body = ReconcileBody.parse(req.body || {});
    const caller = (req as any).user;
    const orgId = requireOrg(caller);
    if (body.mode === "reconcile") {
      requireLevel(caller, "admin");
    }

    const [{ folders, config }, customers] = await Promise.all([
      loadIndexFolders(orgId),
      loadCustomers(orgId, { customerId: body.customerId, limit: body.limit }),
    ]);

    const sheetId = config.customerFolderIndex.sheetId;

    if (body.mode === "setFolderState") {
      const customer = customers[0];
      if (!customer) {
        res.status(404).json({ ok: false, error: "customer_not_found" });
        return;
      }

      const active = body.active ?? customerIsActive(customer);
      const candidates = resolveFolderCandidates(customer, folders);
      const chosen = body.folderId
        ? candidates.find((candidate) => candidate.folder.id === body.folderId)
        : candidates[0];

      if (!chosen) {
        res.status(200).json({ ok: true, applied: false, reason: "folder_not_found", candidates: [] });
        return;
      }

      if (!sheetId) {
        res.status(400).json({ ok: false, error: "customer_index_sheet_not_configured" });
        return;
      }

      await updateIndexRow({
        sheetId,
        folder: chosen.folder,
        targetStatus: folderTargetStatus(active),
        resultMessage: `${active ? "unarchive" : "archive"} requested by app (${new Date().toISOString()})`,
      });

      res.status(200).json({
        ok: true,
        applied: true,
        folderId: chosen.folder.id,
        folderName: chosen.folder.name,
        targetStatus: folderTargetStatus(active),
        matchScore: chosen.score,
        linked: chosen.linked,
        reasons: chosen.reasons,
      });
      return;
    }

    if (body.mode === "folderCwIdFromCustomer") {
      const customer = customers[0];
      if (!customer) {
        res.status(404).json({ ok: false, error: "customer_not_found" });
        return;
      }

      const targetFolder = folders.find((folder) => folder.id === body.folderId);
      if (!targetFolder) {
        res.status(404).json({ ok: false, error: "folder_not_found" });
        return;
      }

      const nextCwId = normalizeId(customer.cwId || customer.hmisId || "");
      if (!nextCwId) {
        res.status(400).json({ ok: false, error: "customer_cwid_missing" });
        return;
      }

      const nextName = buildFolderName(
        String(customer.lastName || targetFolder.last || "").trim(),
        String(customer.firstName || targetFolder.first || "").trim(),
        nextCwId,
      );

      if (!String(nextName || "").trim()) {
        res.status(400).json({ ok: false, error: "folder_name_unavailable" });
        return;
      }

      if (body.apply !== false) {
        await renameFolderAndUpdateIndex({ folder: targetFolder, nextName, sheetId });
        await patchCustomerLinkedFolderName(customer, targetFolder.id, nextName);
      }

      res.status(200).json({ ok: true, folderId: targetFolder.id, nextName, applied: body.apply !== false });
      return;
    }

    if (body.mode === "customerCwIdFromFolder") {
      const customer = customers[0];
      if (!customer) {
        res.status(404).json({ ok: false, error: "customer_not_found" });
        return;
      }
      const targetFolder = folders.find((folder) => folder.id === body.folderId);
      if (!targetFolder) {
        res.status(404).json({ ok: false, error: "folder_not_found" });
        return;
      }
      const nextCwId = normalizeId(targetFolder.cwid);
      if (!nextCwId) {
        res.status(400).json({ ok: false, error: "folder_cwid_missing" });
        return;
      }
      if (body.apply !== false) {
        await patchCustomerCwId(customer.id, nextCwId);
      }
      res.status(200).json({ ok: true, customerId: customer.id, cwId: nextCwId, applied: body.apply !== false });
      return;
    }

    const results = customers.flatMap((customer) => {
      const active = customerIsActive(customer);
      const candidates = resolveFolderCandidates(customer, folders);
      const relevantCandidates = body.onlyLinked ? candidates.filter((candidate) => candidate.linked) : candidates;
      const primary = relevantCandidates[0];
      if (!primary) return [];

      const folderActive = primary.folder.status === "active";
      if (body.direction === "customer_to_folder" && active === folderActive) return [];
      if (body.direction === "folder_to_customer" && active === folderActive) return [];

      return [{
        customerId: customer.id,
        customerName:
          String(customer.name || "").trim() ||
          [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim() ||
          customer.id,
        customerActive: active,
        folderId: primary.folder.id,
        folderName: primary.folder.name,
        folderStatus: primary.folder.status,
        matchScore: primary.score,
        linked: primary.linked,
        reasons: primary.reasons,
        targetCustomerActive: body.direction === "folder_to_customer" ? folderActive : active,
        targetFolderStatus: body.direction === "customer_to_folder" ? folderTargetStatus(active) : folderTargetStatus(folderActive),
      }];
    });

    if (body.apply) {
      for (const item of results) {
        if (body.direction === "folder_to_customer") {
          await patchCustomerStatus(item.customerId, item.targetCustomerActive);
        } else if (sheetId) {
          const folder = folders.find((entry) => entry.id === item.folderId);
          if (folder) {
            await updateIndexRow({
              sheetId,
              folder,
              targetStatus: item.targetFolderStatus,
              resultMessage: `reconciled from customer status (${new Date().toISOString()})`,
            });
          }
        }
      }
    }

    res.status(200).json({
      ok: true,
      apply: body.apply,
      direction: body.direction,
      count: results.length,
      sheetConfigured: Boolean(sheetId),
      items: results,
    });
  },
  {
    auth: "user",
    methods: ["POST", "OPTIONS"],
    timeoutSeconds: 120,
    memory: "512MiB",
  },
);
