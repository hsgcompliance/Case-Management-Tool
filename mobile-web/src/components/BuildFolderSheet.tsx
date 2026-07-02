import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useDriveIntegration } from "@/hooks/useCalendarIntegration";
import { useOrgGDriveConfig, type GDriveTemplate } from "@/hooks/useOrgGDriveConfig";
import { buildCustomerFolderName, buildTemplateDocName } from "@/hooks/useCustomers";
import { GoogleIntegrations } from "@/lib/googleIntegrations";

const TSS_WORKBOOK_KEY = "tss_workbook";

function roleOf(t: GDriveTemplate): string | undefined {
  return t.role || (t.key === TSS_WORKBOOK_KEY ? "tssWorkbook" : undefined);
}

export function BuildFolderSheet({
  customerId,
  firstName,
  lastName,
  cwId,
  hmisId,
  onClose,
  onBuilt,
}: {
  customerId: string;
  firstName: string;
  lastName: string;
  cwId?: string;
  hmisId?: string;
  onClose: () => void;
  onBuilt: (result: { url: string; name: string }) => void;
}) {
  const { user } = useAuth();
  const drive = useDriveIntegration(user);
  const cfg = useOrgGDriveConfig(user);

  const customerForNaming = useMemo(
    () => ({ firstName, lastName, cwId, hmisId, name: `${firstName} ${lastName}`.trim() }),
    [firstName, lastName, cwId, hmisId],
  );

  const [name, setName] = useState(() => buildCustomerFolderName(customerForNaming));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [variant, setVariant] = useState<"payer" | "nonpayer">("nonpayer");
  const [connecting, setConnecting] = useState(false);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const templates = cfg.data?.templates ?? [];
  const hasVariantTemplate = templates.some((t) => t.variants);

  // Seed the checked set once config loads. The TSS workbook template is always
  // force-included (the backend auto-links its copy as the workbook), plus the
  // org's configured defaults.
  const seeded = useMemo(() => templates.length > 0, [templates.length]);
  useEffect(() => {
    if (!seeded) return;
    const defaults = cfg.data?.buildSettings?.defaultTemplateKeys;
    setSelected((prev) => {
      if (prev.size > 0) return prev;
      const next = new Set<string>();
      for (const t of templates) {
        const isWorkbook = roleOf(t) === "tssWorkbook";
        const isDefault = defaults?.length ? defaults.includes(t.key) : !!t.defaultChecked;
        if (isWorkbook || isDefault) next.add(t.key);
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seeded]);

  function toggle(key: string, isWorkbook: boolean) {
    if (isWorkbook) return; // required — can't be unchecked
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleBuild() {
    setError(null);
    if (!name.trim()) { setError("Enter a folder name."); return; }

    if (!drive.connected) {
      setConnecting(true);
      try {
        const res = await drive.connectViaPopup();
        if (res.result !== "connected") return;
      } finally {
        setConnecting(false);
      }
    }

    const parentId = String(cfg.data?.customerFolderIndex?.activeParentId || "").trim();
    if (!parentId) { setError("No active folder parent configured for your org."); return; }

    const picked = templates.filter((t) => selected.has(t.key));
    const payload = picked
      .map((t) => {
        const role = roleOf(t);
        const fileId = t.variants ? (variant === "payer" ? t.variants.payer : t.variants.nonpayer) : t.fileId;
        return { fileId, name: buildTemplateDocName(customerForNaming, t.alias), ...(role ? { role } : {}) };
      })
      .filter((t) => t.fileId);

    if (!payload.some((t) => t.role === "tssWorkbook")) {
      setError("No TSS workbook template is configured for your org — folder would build without a workbook.");
      return;
    }

    setBuilding(true);
    try {
      const resp = await GoogleIntegrations.buildCustomerFolder({
        name: name.trim(),
        parentId,
        templates: payload,
        subfolders: cfg.data?.buildSettings?.defaultSubfolders ?? [],
        customerId,
      });
      if (!resp.ok || !resp.folder) { setError(resp.error || "Could not build folder."); return; }
      if (resp.linked === false) { setError(resp.linkError || "Folder built but linking failed."); return; }

      // The atomic server-side auto-link (inside gdriveBuildCustomerFolder) writes
      // the workbook without a variant. Re-apply it here so the chosen Medicaid
      // toggle actually sticks (controls AI case note assistant eligibility).
      const builtWorkbook = resp.folder.workbook;
      if (hasVariantTemplate && builtWorkbook?.spreadsheetId) {
        try {
          await GoogleIntegrations.linkWorkbookCandidate({
            customerId,
            spreadsheetId: builtWorkbook.spreadsheetId,
            spreadsheetName: builtWorkbook.name,
            variant,
          });
        } catch {
          // Non-blocking — the folder + workbook are already linked; the variant
          // just didn't stick and can be set later from the Plan tab.
        }
      }

      onBuilt({ url: resp.folder.url, name: resp.folder.name });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not build folder.");
    } finally {
      setBuilding(false);
    }
  }

  const busy = connecting || building;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-2xl shadow-2xl pb-safe-bottom max-h-[90vh] overflow-y-auto">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>
        <div className="px-5 pt-2 pb-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Build Drive Folder</h2>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center active:bg-slate-200"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Folder name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
            <p className="text-[11px] text-slate-400">Convention: Last, First_CWID</p>
          </div>

          {hasVariantTemplate && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Workbook:</span>
              <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                {(["nonpayer", "payer"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVariant(v)}
                    className={`px-3 py-1.5 text-xs font-semibold capitalize ${
                      variant === v ? "bg-indigo-600 text-white" : "bg-white text-slate-600"
                    }`}
                  >
                    {v === "nonpayer" ? "Non-payer" : "Payer"}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Copy templates into folder</label>
            {templates.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No templates configured for your org.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {templates.map((t) => {
                  const isWorkbook = roleOf(t) === "tssWorkbook";
                  const checked = selected.has(t.key);
                  return (
                    <label
                      key={t.key}
                      className={`flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm transition-colors ${
                        isWorkbook ? "cursor-default opacity-90" : "cursor-pointer"
                      } ${checked ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-white"}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={isWorkbook}
                        onChange={() => toggle(t.key, isWorkbook)}
                        className="h-4 w-4 accent-indigo-600 disabled:opacity-60"
                      />
                      <span className="font-medium text-slate-800">{t.alias}</span>
                      {isWorkbook && <span className="ml-auto text-[11px] text-slate-400">Required</span>}
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            type="button"
            onClick={() => void handleBuild()}
            disabled={busy || templates.length === 0}
            className="w-full rounded-xl bg-indigo-600 py-3.5 text-sm font-semibold text-white active:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {connecting ? "Connecting…" : building ? "Building…" : drive.connected ? "Build folder" : "Connect Drive & build"}
          </button>
        </div>
      </div>
    </>
  );
}
