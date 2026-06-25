import type { RenderField } from "@/lib/renderApi";

const SUPPORTED = new Set([
  "control_textbox", "control_textarea", "control_dropdown", "control_radio",
  "control_checkbox", "control_email", "control_phone", "control_number",
  "control_datetime", "control_fullname", "control_fileupload", "control_address",
]);

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

export function FieldRenderer({
  field,
  value,
  onChange,
  onFile,
}: {
  field: RenderField;
  value: string;
  onChange: (qid: string, value: string) => void;
  onFile: (qid: string, file: File | null) => void;
}) {
  const label = (
    <label className="mb-1 block text-sm font-medium text-slate-700">
      {field.label || field.name}
      {field.required ? <span className="text-rose-500"> *</span> : null}
    </label>
  );

  if (!SUPPORTED.has(field.type)) {
    return (
      <div>
        {label}
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          This field isn’t available online yet — your case manager will complete it with you.
        </div>
      </div>
    );
  }

  const set = (v: string) => onChange(field.qid, v);

  let control: React.ReactNode = null;
  switch (field.type) {
    case "control_textarea":
      control = <textarea className={`${inputCls} min-h-24`} value={value} onChange={(e) => set(e.target.value)} />;
      break;
    case "control_dropdown":
      control = (
        <select className={inputCls} value={value} onChange={(e) => set(e.target.value)}>
          <option value="">— select —</option>
          {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
      break;
    case "control_radio":
      control = (
        <div className="space-y-1">
          {field.options.map((o) => (
            <label key={o} className="flex items-center gap-2 text-sm text-slate-700">
              <input type="radio" name={field.qid} checked={value === o} onChange={() => set(o)} />
              {o}
            </label>
          ))}
        </div>
      );
      break;
    case "control_checkbox": {
      const selected = new Set(value ? value.split("\n") : []);
      control = (
        <div className="space-y-1">
          {field.options.map((o) => (
            <label key={o} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={selected.has(o)}
                onChange={(e) => {
                  if (e.target.checked) selected.add(o); else selected.delete(o);
                  set([...selected].join("\n"));
                }}
              />
              {o}
            </label>
          ))}
        </div>
      );
      break;
    }
    case "control_email":
      control = <input type="email" className={inputCls} value={value} onChange={(e) => set(e.target.value)} />;
      break;
    case "control_phone":
      control = <input type="tel" className={inputCls} value={value} onChange={(e) => set(e.target.value)} />;
      break;
    case "control_number":
      control = <input type="number" className={inputCls} value={value} onChange={(e) => set(e.target.value)} />;
      break;
    case "control_datetime":
      control = <input type="date" className={inputCls} value={value} onChange={(e) => set(e.target.value)} />;
      break;
    case "control_fullname":
    case "control_address":
      control = <input type="text" className={inputCls} value={value} onChange={(e) => set(e.target.value)} placeholder={field.type === "control_fullname" ? "First Last" : "Address"} />;
      break;
    case "control_fileupload":
      control = (
        <input
          type="file"
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-indigo-700"
          onChange={(e) => onFile(field.qid, e.target.files?.[0] ?? null)}
        />
      );
      break;
    default:
      control = <input type="text" className={inputCls} value={value} onChange={(e) => set(e.target.value)} />;
  }

  return (
    <div>
      {label}
      {control}
    </div>
  );
}
