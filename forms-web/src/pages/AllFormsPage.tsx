import { FormsCategoryView } from "@/components/FormsCategoryView";
import { useCatalog } from "@/hooks/useCatalog";

export default function AllFormsPage() {
  const forms = useCatalog();
  return (
    <FormsCategoryView
      heading="All forms"
      description="High-volume Jotforms from the inventory plus any auto-discovered from webhook traffic. Pick one to open it embedded."
      forms={forms}
      showCustomerHeader
    />
  );
}
