import { getAuthed } from "./authedApi";

export type FormFieldDef = {
  qid: string;
  name: string;
  type: string;
  label: string;
  required: boolean;
  options: string[];
  order: number;
};

export async function getFormSchema(formId: string): Promise<FormFieldDef[]> {
  const out = await getAuthed<{ ok: true; fields: FormFieldDef[] }>("formSchema", { formId });
  return out.fields ?? [];
}
