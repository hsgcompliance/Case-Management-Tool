import { FormsCategoryView } from "@/components/FormsCategoryView";
import { useCatalog } from "@/hooks/useCatalog";
import { INTAKE_FLOW, INTAKE_RESOURCES } from "@/lib/formsCatalog";

export default function IntakeFormsPage() {
  // Full catalog: flow steps reference forms outside the "intake" category
  // (citizenship, TSS, landlord verification, zero income/assets).
  const catalog = useCatalog();
  const forms = catalog.filter((f) => f.category === "intake");
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
    />
  );
}
