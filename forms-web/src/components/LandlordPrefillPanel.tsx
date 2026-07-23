import { extractAssistancePrefill, type IntakeWebhookSnapshot } from "@/lib/intakeWebhookSnapshot";

export function LandlordPrefillPanel({ snapshot }: { snapshot: IntakeWebhookSnapshot | null }) {
  const landlord = extractAssistancePrefill(snapshot);
  const fields = [
    ["Landlord / company", landlord.landlordName],
    ["Contact person", landlord.landlordContact],
    ["Address", landlord.landlordAddress],
    ["Phone", landlord.landlordPhone],
    ["Email", landlord.landlordEmail],
    ["Assisted unit", landlord.unitAddress],
  ] as const;
  const hasAny = fields.some(([, value]) => value);

  return (
    <section className="rounded-xl border border-sky-200 bg-sky-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-sky-950">Landlord information from Step 13</h3>
          <p className="mt-0.5 text-xs text-sky-700">Review these values before opening the Landlord Verification prefill builder.</p>
        </div>
        {hasAny ? (
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(fields.filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`).join("\n"))}
            className="rounded-md border border-sky-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-100"
          >
            Copy all
          </button>
        ) : null}
      </div>
      {hasAny ? (
        <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {fields.map(([label, value]) => value ? (
            <div key={label} className="rounded-lg border border-sky-100 bg-white px-3 py-2">
              <dt className="text-[10px] font-bold uppercase tracking-wide text-sky-500">{label}</dt>
              <dd className="mt-0.5 select-all text-sm text-slate-800">{value}</dd>
            </div>
          ) : null)}
        </dl>
      ) : (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          No landlord fields have arrived yet. Complete and submit Step 13, then refresh the submissions sidebar.
        </div>
      )}
    </section>
  );
}
