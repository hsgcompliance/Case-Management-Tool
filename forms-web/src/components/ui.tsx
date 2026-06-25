import type { ReactNode } from "react";

/** Centered card shell used by every forms page. */
export function FormShell({ title, subtitle, children }: { title?: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="min-h-full flex items-start justify-center px-4 py-8 sm:py-16">
      <div className="w-full max-w-md">
        <div className="mb-4 text-center">
          <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600">HDB Forms</div>
          {title ? <h1 className="mt-1 text-xl font-bold text-slate-900">{title}</h1> : null}
          {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">{children}</div>
      </div>
    </div>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <FormShell>
      <div className="flex items-center justify-center gap-3 py-8 text-slate-500">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-600" />
        <span className="text-sm">{label}</span>
      </div>
    </FormShell>
  );
}

export function MessageState({
  variant = "error",
  title,
  message,
  onRetry,
}: {
  variant?: "error" | "expired" | "unauthorized" | "info";
  title: string;
  message?: string;
  onRetry?: () => void;
}) {
  const tone =
    variant === "expired"
      ? "text-amber-700 bg-amber-50 border-amber-200"
      : variant === "unauthorized"
        ? "text-slate-700 bg-slate-50 border-slate-200"
        : variant === "info"
          ? "text-indigo-700 bg-indigo-50 border-indigo-200"
          : "text-red-700 bg-red-50 border-red-200";
  return (
    <FormShell>
      <div className={`rounded-xl border px-4 py-6 text-center ${tone}`}>
        <div className="text-base font-semibold">{title}</div>
        {message ? <div className="mt-1 text-sm opacity-90">{message}</div> : null}
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
        >
          Try again
        </button>
      ) : null}
    </FormShell>
  );
}

export function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-right text-sm font-medium text-slate-900">{value}</span>
    </div>
  );
}

export function PrimaryButton({
  children,
  onClick,
  href,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
}) {
  const cls =
    "block w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50";
  if (href) {
    return (
      <a className={cls} href={href} target="_blank" rel="noreferrer">
        {children}
      </a>
    );
  }
  return (
    <button type="button" className={cls} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

export function SecondaryButton({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="block w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
    >
      {children}
    </button>
  );
}
