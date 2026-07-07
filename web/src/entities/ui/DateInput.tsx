"use client";

import React from "react";

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DISPLAY_DATE_RE = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/;

function validIsoDate(year: string, month: string, day: string): string | null {
  const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return date.getUTCFullYear() === Number(year)
    && date.getUTCMonth() + 1 === Number(month)
    && date.getUTCDate() === Number(day)
    ? iso
    : null;
}

export function parseDateInput(value: string): string | null {
  const input = value.trim();
  if (!input) return "";

  const isoMatch = input.match(ISO_DATE_RE);
  if (isoMatch) return validIsoDate(isoMatch[1], isoMatch[2], isoMatch[3]);

  const displayMatch = input.match(DISPLAY_DATE_RE);
  if (displayMatch) return validIsoDate(displayMatch[3], displayMatch[1], displayMatch[2]);

  const digits = input.replace(/\D/g, "");
  if (digits.length === 8) {
    return validIsoDate(digits.slice(4), digits.slice(0, 2), digits.slice(2, 4));
  }
  return null;
}

export function formatIsoDateForInput(value?: string | null): string {
  const match = String(value || "").match(ISO_DATE_RE);
  return match ? `${match[2]}/${match[3]}/${match[1]}` : "";
}

function formatDateDraft(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export type DateInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "value" | "defaultValue" | "onChange"
> & {
  value?: string | null;
  onChange: (isoDate: string) => void;
  wrapperClassName?: string;
};

export function DateInput({
  value,
  onChange,
  className = "input",
  wrapperClassName = "",
  placeholder = "MM/DD/YYYY",
  disabled,
  readOnly,
  id,
  name,
  min,
  max,
  ...inputProps
}: DateInputProps) {
  const [draft, setDraft] = React.useState(() => formatIsoDateForInput(value));
  const [invalid, setInvalid] = React.useState(false);
  const pickerRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    setDraft(formatIsoDateForInput(value));
    setInvalid(false);
  }, [value]);

  const commit = React.useCallback((nextDraft: string) => {
    const parsed = parseDateInput(nextDraft);
    setInvalid(parsed === null);
    if (parsed !== null) onChange(parsed);
  }, [onChange]);

  const openPicker = () => {
    const picker = pickerRef.current;
    if (!picker || disabled || readOnly) return;
    if (typeof picker.showPicker === "function") picker.showPicker();
    else picker.click();
  };

  return (
    <div className={["relative flex items-center", wrapperClassName].filter(Boolean).join(" ")}>
      <input
        {...inputProps}
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete={inputProps.autoComplete || "bday"}
        className={[className, "pr-10"].filter(Boolean).join(" ")}
        value={draft}
        placeholder={placeholder}
        min={min}
        max={max}
        disabled={disabled}
        min={min}
        max={max}
        readOnly={readOnly}
        aria-invalid={invalid || undefined}
        onChange={(event) => {
          const next = formatDateDraft(event.currentTarget.value);
          setDraft(next);
          setInvalid(false);
          const parsed = parseDateInput(next);
          if (parsed !== null && parsed !== "") onChange(parsed);
          if (!next) onChange("");
        }}
        onPaste={(event) => {
          const pasted = event.clipboardData.getData("text");
          const parsed = parseDateInput(pasted);
          if (parsed === null) return;
          event.preventDefault();
          setDraft(formatIsoDateForInput(parsed));
          setInvalid(false);
          onChange(parsed);
        }}
        onBlur={(event) => {
          commit(event.currentTarget.value);
          inputProps.onBlur?.(event);
        }}
      />
      <button
        type="button"
        className="absolute right-1 flex h-8 w-8 items-center justify-center rounded text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800"
        onClick={openPicker}
        disabled={disabled || readOnly}
        aria-label="Open calendar"
        tabIndex={-1}
      >
        <span aria-hidden="true">&#128197;</span>
      </button>
      <input
        ref={pickerRef}
        type="date"
        value={value || ""}
        onChange={(event) => {
          const next = event.currentTarget.value;
          setDraft(formatIsoDateForInput(next));
          setInvalid(false);
          onChange(next);
        }}
        disabled={disabled}
        className="pointer-events-none absolute h-px w-px opacity-0"
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  );
}

export default DateInput;
