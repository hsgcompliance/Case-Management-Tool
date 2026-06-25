import { FormsCategoryView } from "@/components/FormsCategoryView";
import { CreditCardCards } from "@/components/CreditCardCards";
import { useCatalogByCategory } from "@/hooks/useCatalog";

export default function PurchasesPage() {
  const forms = useCatalogByCategory("purchases");
  return (
    <div className="space-y-4">
      <CreditCardCards />
      <FormsCategoryView
        heading="Purchases"
        description="Credit card & invoice forms — staff only. Forms auto-appear here when a kind=payment webhook arrives. Submitting runs Jotform's native workflows."
        forms={forms}
      />
    </div>
  );
}
