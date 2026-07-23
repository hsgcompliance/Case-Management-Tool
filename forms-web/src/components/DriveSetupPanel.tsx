import { useMemo, useState } from "react";
import type { CustomerDetail } from "@/lib/customerDetailApi";
import type { FormsCustomer } from "@/lib/customersApi";
import {
  attachIndexedWorkbook,
  buildCustomerFolder,
  createTssWorkbook,
  duplicateCustomers,
  linkIndexedFolder,
  matchingFolders,
  type DriveFolderIndexEntry,
  type FormsDriveConfig,
} from "@/lib/driveReadinessApi";
import { ExternalServiceIcon } from "./ui";

export function DriveSetupPanel({
  customer,
  detail,
  customers,
  folders,
  config,
  variant,
  loading,
  loadError,
  onRefresh,
  onCreateCustomer,
}: {
  customer: FormsCustomer | null;
  detail: CustomerDetail | null;
  customers: FormsCustomer[];
  folders: DriveFolderIndexEntry[];
  config: FormsDriveConfig | null;
  variant: "payer" | "nonpayer";
  loading: boolean;
  loadError: string | null;
  onRefresh: () => Promise<void>;
  onCreateCustomer: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const matches = useMemo(
    () => customer ? matchingFolders(customer, detail, folders) : [],
    [customer, detail, folders],
  );
  const duplicates = useMemo(
    () => customer ? duplicateCustomers(customer, detail, customers) : [],
    [customer, detail, customers],
  );
  const linkedIndexFolder = detail?.driveFolderId
    ? folders.find((folder) => folder.id === detail.driveFolderId) ?? null
    : null;
  const folderLinked = !!detail?.driveFolderId;
  const workbookLinked = !!detail?.tssWorkbook?.spreadsheetId;
  const complete = !!customer && folderLinked && workbookLinked;
  const fallbackFolderUrl =
    detail?.driveFolderUrl ||
    config?.customerFolderIndex.activeParentUrl ||
    (config?.customerFolderIndex.activeParentId
      ? `https://drive.google.com/drive/folders/${config.customerFolderIndex.activeParentId}`
      : "https://drive.google.com");

  const run = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key);
    setActionError(null);
    try {
      await action();
      await onRefresh();
    } catch (error) {
      setActionError((error as Error)?.message || "The Drive repair could not be completed.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Customer files readiness</h3>
          <p className="text-xs text-slate-500">
            Database duplicate check + organization Drive index folder check
            {config?.customerFolderIndex.sheetUrl ? (
              <> · <a href={config.customerFolderIndex.sheetUrl} target="_blank" rel="noreferrer" className="font-semibold text-indigo-600 hover:text-indigo-500">open org index</a></>
            ) : null}
          </p>
        </div>
        <a href={fallbackFolderUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500">
          <ExternalServiceIcon href={fallbackFolderUrl} />
          Open Google Drive
        </a>
      </div>

      {loading ? <div className="rounded-lg bg-slate-50 px-3 py-3 text-xs text-slate-500">Checking customer documents and the organization Drive index…</div> : null}
      {loadError ? <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{loadError}</div> : null}
      {actionError ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{actionError}</div> : null}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Status label="Customer document" ready={!!customer} />
        <Status label="Customer folder linked" ready={folderLinked} />
        <Status label="TSS workbook linked" ready={workbookLinked} />
      </div>

      {duplicates.length ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          <b>Possible duplicate customer document:</b>{" "}
          {duplicates.map((item) => `${item.name}${item.cwId ? ` (${item.cwId})` : ""}`).join(", ")}.
          Review before creating or repairing files.
        </div>
      ) : null}

      {customer && folderLinked && !linkedIndexFolder ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          The linked folder is not present in the current organization index. The link still opens, but the index should be reviewed.
        </div>
      ) : null}

      {!customer ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-3 text-sm text-indigo-900">
          <span>Create or link the customer document first. The create flow checks duplicates and can build the folder and workbook together.</span>
          <button type="button" onClick={onCreateCustomer} className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500">Create / link customer</button>
        </div>
      ) : !folderLinked && matches.length ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="text-sm font-semibold text-amber-950">Existing customer folder found in the org index</div>
          <p className="mt-0.5 text-xs text-amber-800">Link it instead of creating a duplicate folder. An indexed TSS workbook will be linked at the same time.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {matches.map((folder) => (
              <button
                key={folder.id}
                type="button"
                disabled={!!busy}
                onClick={() => run(`link:${folder.id}`, () => linkIndexedFolder(customer.id, folder, variant))}
                className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
              >
                {busy === `link:${folder.id}` ? "Linking…" : `Link ${folder.name}`}
              </button>
            ))}
          </div>
        </div>
      ) : customer && !folderLinked ? (
        <Repair
          title="Create customer folder and TSS workbook"
          detail="No matching active folder was found in the organization index. Build and link the configured customer folder, documents, and TSS workbook."
          label={busy === "build" ? "Building…" : "Build and link all"}
          disabled={!!busy || !config}
          onClick={() => config && run("build", () => buildCustomerFolder(customer, detail, config, variant))}
        />
      ) : customer && folderLinked && !workbookLinked && linkedIndexFolder?.tssWorkbookId ? (
        <Repair
          title="Link the indexed TSS workbook"
          detail="The folder is linked and its existing TSS workbook is present in the organization index."
          label={busy === "attach" ? "Linking…" : "Link existing workbook"}
          disabled={!!busy}
          onClick={() => run("attach", () => attachIndexedWorkbook(customer.id, linkedIndexFolder, variant))}
        />
      ) : customer && folderLinked && !workbookLinked ? (
        <Repair
          title="Create TSS workbook in folder"
          detail="The customer document and folder are linked, but no TSS workbook is linked. Copy the configured payer/non-payer workbook into this folder."
          label={busy === "workbook" ? "Creating…" : "Create TSS workbook"}
          disabled={!!busy}
          onClick={() => run("workbook", () => createTssWorkbook(customer.id, variant))}
        />
      ) : complete ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm font-semibold text-emerald-800">
          ✓ Customer document, Drive folder, and TSS workbook are linked. Step 9 is complete.
        </div>
      ) : null}
    </section>
  );
}

function Status({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className={`rounded-lg border px-3 py-2 text-xs font-semibold ${ready ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
      {ready ? "✓" : "○"} {label}
    </div>
  );
}

function Repair({
  title,
  detail,
  label,
  disabled,
  onClick,
}: {
  title: string;
  detail: string;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-indigo-950">{title}</div>
        <p className="mt-0.5 text-xs text-indigo-700">{detail}</p>
      </div>
      <button type="button" disabled={disabled} onClick={onClick} className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50">
        {label}
      </button>
    </div>
  );
}
