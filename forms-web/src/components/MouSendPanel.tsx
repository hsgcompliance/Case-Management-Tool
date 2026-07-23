import type { CustomerDetail } from "@/lib/customerDetailApi";
import type { FormsCustomer } from "@/lib/customersApi";
import type { IntakeTypeId } from "@/lib/formsCatalog";
import { extractAssistancePrefill, type IntakeWebhookSnapshot } from "@/lib/intakeWebhookSnapshot";
import { ExternalServiceIcon } from "./ui";

const PRIMARY_MOU_URL = "https://www.jotform.com/sign/250647693231055/send";
const RYAN_WHITE_MOU_URL = "https://www.jotform.com/sign/253276485062057/send/invite";

export function MouSendPanel({
  customer,
  detail,
  snapshot,
  intakeTypes,
}: {
  customer: FormsCustomer | null;
  detail: CustomerDetail | null;
  snapshot: IntakeWebhookSnapshot | null;
  intakeTypes: IntakeTypeId[];
}) {
  const landlord = extractAssistancePrefill(snapshot);
  const head = snapshot?.household.members.find((member) => member.isHoH) ?? null;
  const customerName = detail?.name || customer?.name || head?.name.full || "";
  const customerEmail = detail?.email || head?.email?.value || "";
  const isRyanWhite = intakeTypes.includes("ryan-white-housing");
  const sendUrl = isRyanWhite ? RYAN_WHITE_MOU_URL : PRIMARY_MOU_URL;

  return (
    <section className="space-y-4 rounded-xl border border-violet-200 bg-violet-50 p-4">
      <div>
        <h3 className="text-sm font-semibold text-violet-950">MOU recipients</h3>
        <p className="mt-0.5 text-xs text-violet-700">Confirm these names and email addresses before opening the signature invitation.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Recipient title="Customer" name={customerName} email={customerEmail} />
        <Recipient title="Landlord" name={landlord.landlordName} email={landlord.landlordEmail} />
      </div>
      <div className="flex flex-col items-center gap-2 py-2">
        <a
          href={sendUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-violet-600 px-7 py-3 text-base font-semibold text-white shadow-sm hover:bg-violet-500"
        >
          <ExternalServiceIcon href={sendUrl} className="h-5 w-5" />
          {isRyanWhite ? "Send Ryan White MOU" : "Send MOU for signature"}
        </a>
        <span className="text-[11px] font-medium text-violet-600">
          {isRyanWhite ? "Ryan White-specific signature invitation" : "Primary MOU signature invitation"}
        </span>
      </div>
    </section>
  );
}

function Recipient({ title, name, email }: { title: string; name: string; email: string }) {
  return (
    <div className="rounded-lg border border-violet-100 bg-white p-3">
      <div className="text-[10px] font-bold uppercase tracking-wide text-violet-500">{title}</div>
      <div className={`mt-1 text-sm font-semibold ${name ? "text-slate-900" : "text-amber-700"}`}>
        {name || "Name missing"}
      </div>
      <div className={`mt-0.5 select-all text-sm ${email ? "text-slate-600" : "text-amber-700"}`}>
        {email || "Email missing"}
      </div>
    </div>
  );
}
