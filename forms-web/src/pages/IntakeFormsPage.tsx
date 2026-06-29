import { FormsCategoryView } from "@/components/FormsCategoryView";
import { useCatalogByCategory } from "@/hooks/useCatalog";

export default function IntakeFormsPage() {
  const forms = useCatalogByCategory("intake");
  return (
    <FormsCategoryView
      heading="Intake forms"
      description="Eligibility, disclosures, and releases. Forms auto-appear here when a kind=intake webhook arrives."
      forms={forms}
      showCustomerHeader
      customerNav
    />
  );
}
