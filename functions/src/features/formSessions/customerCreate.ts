// functions/src/features/formSessions/customerCreate.ts
// Quick "create customer" for the Forms app intake flow. One call does the
// whole job the web NewCustomerFlow does across several steps, kept minimal:
//   1. duplicate guard (CWID / name+DOB against the org's customers)
//   2. canonical create via customers/service.upsertCustomers
//   3. best-effort Drive folder build + link — same gdrive service functions as
//      gdriveBuildCustomerFolder (org config parent/templates/subfolders,
//      "Last, First_CWID" naming, TSS workbook auto-link). A Drive failure
//      NEVER fails the create; it's reported in the response instead.
import { z } from "zod";
import {
  secureHandler,
  db,
  FieldValue,
  isoNow,
  requireOrg,
  orgIdFromClaims,
  hasLevel,
  normId,
  GOOGLE_OAUTH_CLIENT_ID,
  GOOGLE_OAUTH_CLIENT_SECRET,
  GOOGLE_OAUTH_REFRESH_TOKEN,
} from "../../core";
import { patchCustomers, upsertCustomers } from "../customers/service";

const FormsCustomerCreateBody = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  dob: z.string().trim().max(20).optional().default(""),
  cwId: z.string().trim().max(40).optional().default(""),
  /** Primary case manager display name; defaults to the caller. */
  caseManagerName: z.string().trim().max(120).optional().default(""),
  /** Explicit CM uid (from the CM dropdown); wins over the name heuristic. */
  caseManagerId: z.string().trim().max(128).optional().default(""),
  secondaryCaseManagerName: z.string().trim().max(120).optional().default(""),
  secondaryCaseManagerId: z.string().trim().max(128).optional().default(""),
  /** Additional staff contacts (customers service caps at 3, dedupes by uid). */
  otherContacts: z
    .array(
      z.object({
        uid: z.string().trim().min(1).max(128),
        name: z.string().trim().max(120).optional(),
        role: z.string().trim().max(60).optional(),
      })
    )
    .max(3)
    .optional(),
  /** Picks the payer/nonpayer TSS workbook template variant. */
  medicaid: z.enum(["yes", "no", "not_sure"]).optional(),
  /** Build + link the customer's Google Drive folder (default true). */
  buildDrive: z.boolean().optional(),
  /** Skip the duplicate guard (user confirmed "create anyway"). */
  force: z.boolean().optional(),
  /** Dev-only explicit org override (mirrors getTargetOrg). */
  orgId: z.string().trim().optional(),
});

const low = (v: unknown) => String(v ?? "").trim().toLowerCase();

type DriveResult = {
  built: boolean;
  folderId?: string;
  folderUrl?: string;
  folderName?: string;
  workbookLinked?: boolean;
  reason?: string;
  error?: string;
  /** Folder exists but customer linking failed (fix from the web app). */
  linkError?: string;
};

/**
 * GET /formsUsersList — active org users for the forms-app CM dropdowns
 * (primary / secondary / other contacts). Minimal fields only.
 */
export const formsUsersList_http = secureHandler(
  async (req, res) => {
    const caller = req.user!;
    const orgId = orgIdFromClaims(caller) || requireOrg(caller);
    const { listUsersService } = await import("../users/service.js");
    const { users } = await listUsersService({ limit: 1000, status: "active" }, { orgId });
    const items = users
      .map((u) => ({
        uid: u.uid,
        name: String(u.displayName || u.email || u.uid),
        email: u.email ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.status(200).json({ ok: true, items, count: items.length });
  },
  { auth: "user", methods: ["GET", "OPTIONS"] }
);

const FormsCustomerTssStatusBody = z.object({
  customerId: z.string().trim().min(1),
  status: z.enum(["payer", "nonpayer"]),
});

/**
 * POST /formsCustomerSetTssStatus — persist the intake TSS payer/non-payer
 * gate selection onto the customer doc (org-checked).
 */
export const formsCustomerSetTssStatus_http = secureHandler(
  async (req, res) => {
    const body = FormsCustomerTssStatusBody.parse(req.body ?? {});
    const caller = req.user!;
    const orgId = orgIdFromClaims(caller) || requireOrg(caller);

    const ref = db.collection("customers").doc(body.customerId);
    const snap = await ref.get();
    if (!snap.exists || normId((snap.data() || {}).orgId) !== normId(orgId)) {
      res.status(404).json({ ok: false, error: "not_found" });
      return;
    }
    await ref.set(
      {
        tssPayerStatus: body.status,
        tssPayerStatusUpdatedAt: isoNow(),
        tssPayerStatusUpdatedBy: String(caller.uid || ""),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    res.status(200).json({ ok: true, customerId: body.customerId, status: body.status });
  },
  { auth: "user", methods: ["POST", "OPTIONS"] }
);

const FormsCustomerUpdateBody = z.object({
  customerId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(160),
  cwId: z.string().trim().max(40).nullable(),
  caseManagerId: z.string().trim().max(128).nullable(),
  population: z.enum(["Youth", "Individual", "Family"]).nullable(),
  status: z.enum(["active", "inactive"]),
  tier: z.number().int().min(1).max(3).nullable(),
});

/** Forms-auth adapter over the canonical customer patch service. */
export const formsCustomerUpdate_http = secureHandler(
  async (req, res) => {
    const body = FormsCustomerUpdateBody.parse(req.body ?? {});
    const cleaned = body.name.replace(/\s+/g, " ").trim();
    const comma = cleaned.includes(",") ? cleaned.split(",", 2).map((part) => part.trim()) : null;
    const parts = cleaned.split(" ").filter(Boolean);
    const firstName = comma ? comma[1] : parts[0];
    const lastName = comma ? comma[0] : parts.slice(1).join(" ");
    const out = await patchCustomers({
      id: body.customerId,
      patch: {
        name: cleaned,
        fullName: cleaned,
        firstName: firstName || null,
        lastName: lastName || null,
        cwId: body.cwId,
        caseManagerId: body.caseManagerId,
        population: body.population,
        status: body.status,
        tier: body.tier,
      } as any,
    }, req.user!);
    res.status(200).json({ok: true, ...out});
  },
  {auth: "user", methods: ["POST", "OPTIONS"]},
);

export const formsCustomerCreate_http = secureHandler(
  async (req, res) => {
    const body = FormsCustomerCreateBody.parse(req.body ?? {});
    const caller = req.user!;
    const callerOrg = orgIdFromClaims(caller);
    const orgId =
      callerOrg || (hasLevel(caller, "dev") && normId(body.orgId)) || requireOrg(caller);

    const first = body.firstName;
    const last = body.lastName;
    const cwId = body.cwId || null;
    const dob = body.dob || null;

    // ── Duplicate guard (index-free: same org-scan pattern as the search index) ──
    if (!body.force) {
      const snap = await db
        .collection("customers")
        .where("orgId", "==", orgId)
        .select("firstName", "lastName", "dob", "cwId", "status", "deleted")
        .get();
      for (const d of snap.docs) {
        const r = d.data() as Record<string, unknown>;
        if (r.deleted === true || low(r.status) === "deleted") continue;
        const cwDup = !!cwId && low(r.cwId) === low(cwId);
        const nameDup =
          low(r.firstName) === low(first) &&
          low(r.lastName) === low(last) &&
          low(r.dob) === low(dob);
        if (cwDup || nameDup) {
          res.status(409).json({
            ok: false,
            error: cwDup ? "duplicate_cwid" : "duplicate_customer",
            existingId: d.id,
          });
          return;
        }
      }
    }

    // ── Create via the canonical customers path (org/teamIds/name shaping) ──
    const callerName = String((caller as any).name || (caller as any).email || "").trim();
    const cmName = body.caseManagerName || callerName;
    const input = {
      firstName: first,
      lastName: last,
      dob,
      cwId,
      caseManagerName: cmName || null,
      // Explicit uid from the CM dropdown wins; otherwise only claim the
      // caller's uid when the primary CM actually is the caller.
      caseManagerId:
        body.caseManagerId ||
        (cmName && low(cmName) === low(callerName) ? String(caller.uid || "") : null),
      secondaryCaseManagerName: body.secondaryCaseManagerName || null,
      secondaryCaseManagerId: body.secondaryCaseManagerId || null,
      ...(body.otherContacts?.length ? { otherContacts: body.otherContacts } : {}),
      status: "active",
      // TSS payer status rides along when the intake gate already decided it.
      ...(body.medicaid && body.medicaid !== "not_sure"
        ? { tssPayerStatus: body.medicaid === "yes" ? "payer" : "nonpayer" }
        : {}),
    };
    const { ids } = await upsertCustomers(input as any, caller);
    const customerId = ids[0];

    // ── Drive folder build + link (best effort; same functions as the web app) ──
    let drive: DriveResult = { built: false, reason: "skipped" };
    if (body.buildDrive !== false) {
      try {
        const { getOrgGDriveConfig } = await import("../gdrive/orgConfig.js");
        const config = await getOrgGDriveConfig(orgId);
        const parentId = String(config.customerFolderIndex.activeParentId || "").trim();
        if (!parentId) {
          drive = { built: false, reason: "no_active_parent_configured" };
        } else {
          const medicaid = body.medicaid === "yes" ? "yes" : "no";
          const defaultKeys = config.buildSettings?.defaultTemplateKeys;
          // Default-checked templates only; doc naming mirrors useResolvedDriveConfig
          // ("{last}, {first} {alias}") + the web flow's "(non-Payer)" variant suffix.
          const templates = (config.templates ?? []).flatMap((t) => {
            const selected = defaultKeys?.length ? defaultKeys.includes(t.key) : !!t.defaultChecked;
            if (!selected) return [];
            const fileId = String(
              (t.variants ? (medicaid === "yes" ? t.variants.payer : t.variants.nonpayer) : t.fileId) || ""
            ).trim();
            if (fileId.length < 3) return [];
            const variantSuffix = t.variants && medicaid !== "yes" ? " (non-Payer)" : "";
            const name = `${last}, ${first} ${t.alias}`.replace(/\s{2,}/g, " ").trim() + variantSuffix;
            const role = t.role || (t.key === "tss_workbook" ? "tssWorkbook" : undefined);
            return [{ fileId, name, ...(role ? { role } : {}) }];
          });
          const folderName = `${last}, ${first}${cwId ? `_${cwId}` : ""}`;

          const { buildCustomerFolder } = await import("../gdrive/service.js");
          const folder = await buildCustomerFolder({
            name: folderName,
            parentId,
            templates,
            subfolders: config.buildSettings?.defaultSubfolders ?? [],
            userUid: String(caller.uid || ""),
          });

          // The folder now exists — report built even if linking below fails
          // (mirrors gdriveBuildCustomerFolder's linkError behavior).
          drive = {
            built: true,
            folderId: folder.id,
            folderUrl: folder.url,
            folderName: folder.name,
            workbookLinked: false,
          };
          try {
            // Link atomically like gdriveBuildCustomerFolder: folder ref +
            // auto-linked TSS workbook + cached index seed.
            const { linkFolderToCustomer } = await import("../gdrive/customerFolderLink.js");
            const { upsertFolderIndexEntry } = await import("../gdrive/folderIndexCache.js");
            await linkFolderToCustomer({
              customerId,
              orgId,
              folderId: folder.id,
              folderUrl: folder.url,
              folderName: folder.name,
            });
            if (folder.workbook?.spreadsheetId) {
              await db.collection("customers").doc(customerId).set(
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
                        linkedBy: String(caller.uid || ""),
                        variant: medicaid === "yes" ? "payer" : "nonpayer",
                      },
                    },
                  },
                  updatedAt: FieldValue.serverTimestamp(),
                },
                { merge: true }
              );
              drive.workbookLinked = true;
            }
            await upsertFolderIndexEntry(
              orgId,
              { id: folder.id, name: folder.name, url: folder.url, status: "active" },
              customerId
            );
          } catch (linkErr: any) {
            drive.linkError = String(linkErr?.message || linkErr || "link_failed");
          }
        }
      } catch (e: any) {
        drive = { built: false, error: String(e?.message || e || "drive_build_failed") };
      }
    }

    res.status(201).json({
      ok: true,
      customer: {
        id: customerId,
        name: `${first} ${last}`,
        caseManagerName: cmName || null,
        cwId,
        dob,
      },
      drive,
    });
  },
  {
    auth: "user",
    methods: ["POST", "OPTIONS"],
    secrets: [GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN],
    // googleapis barrel OOMs under 256MiB (see gdriveBuildCustomerFolder).
    memory: "512MiB",
    timeoutSeconds: 120,
  }
);
