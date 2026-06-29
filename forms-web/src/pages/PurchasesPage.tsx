import { FormsCategoryView } from "@/components/FormsCategoryView";
import { useCatalogByCategory } from "@/hooks/useCatalog";

export default function PurchasesPage() {
  const forms = useCatalogByCategory("purchases");
  return (
    <FormsCategoryView
      heading="Purchases"
      description="Credit card & invoice forms — staff only. Forms auto-appear here when a kind=payment webhook arrives. Submitting runs Jotform's native workflows."
      forms={forms}
      showCreditCards
    />
  );
}
