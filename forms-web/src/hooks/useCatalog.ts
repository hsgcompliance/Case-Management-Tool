import { useEffect, useState } from "react";
import { ALL_FORMS, mergeWithRegistry, type FormDef, type FormCategory } from "@/lib/formsCatalog";
import { listFormsRegistry } from "@/lib/formsRegistryApi";

/**
 * The forms catalog merged with webhook-auto-discovered forms. Starts with the
 * hardcoded list, then folds in the registry once loaded.
 */
export function useCatalog(): FormDef[] {
  const [forms, setForms] = useState<FormDef[]>(ALL_FORMS);
  useEffect(() => {
    let alive = true;
    listFormsRegistry().then((reg) => { if (alive) setForms(mergeWithRegistry(reg)); });
    return () => { alive = false; };
  }, []);
  return forms;
}

export function useCatalogByCategory(category: FormCategory): FormDef[] {
  const forms = useCatalog();
  return forms.filter((f) => f.category === category);
}
