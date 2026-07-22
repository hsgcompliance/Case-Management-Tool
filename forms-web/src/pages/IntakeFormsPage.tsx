import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FormsCategoryView } from "@/components/FormsCategoryView";
import { useCatalog } from "@/hooks/useCatalog";
import { INTAKE_FLOW, INTAKE_RESOURCES, formInCategory } from "@/lib/formsCatalog";
import { loadCustomers } from "@/lib/customersApi";
import { useCurrentCustomer } from "@/context/CurrentCustomer";

export default function IntakeFormsPage() {
  // ?start=… (e.g. from a completed referral) jumps into the first open step.
  const [params] = useSearchParams();
  const { customer, setCustomer } = useCurrentCustomer();
  const linkedCustomerId = params.get("customerId")?.trim() || "";
  const [resolvingLink, setResolvingLink] = useState(!!linkedCustomerId && customer?.id !== linkedCustomerId);
  useEffect(() => {
    if (!linkedCustomerId || customer?.id === linkedCustomerId) {
      setResolvingLink(false);
      return;
    }
    setResolvingLink(true);
    let cancelled = false;
    void loadCustomers().then((items) => {
      if (cancelled) return;
      const match = items.find((item) => item.id === linkedCustomerId);
      if (match) setCustomer(match);
      setResolvingLink(false);
    }).catch(() => { if (!cancelled) setResolvingLink(false); });
    return () => { cancelled = true; };
  }, [linkedCustomerId, customer?.id, setCustomer]);
  // Full catalog: flow steps reference forms outside the "intake" category
  // (citizenship, TSS, landlord verification, zero income/assets).
  const catalog = useCatalog();
  const forms = catalog.filter((f) => formInCategory(f, "intake"));
  if (resolvingLink) {
    return <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-500">Opening intake workflow...</div>;
  }
  return (
    <FormsCategoryView
      heading="Intake flow"
      description="Work through the numbered steps in order — progress is saved per customer, and each step has next/back buttons."
      forms={forms}
      showCustomerHeader
      customerNav
      flowSteps={INTAKE_FLOW}
      catalog={catalog}
      webhooksSidebar
      resources={INTAKE_RESOURCES}
      autoStart={params.has("start")}
    />
  );
}
