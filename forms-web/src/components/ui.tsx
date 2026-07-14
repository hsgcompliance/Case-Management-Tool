import type { ReactNode } from "react";

type ExternalService = "drive" | "sheets" | "jotform" | "external";

function serviceFromHref(href?: string): ExternalService {
  const value = String(href || "").toLowerCase();
  if (value.includes("docs.google.com/spreadsheets")) return "sheets";
  if (value.includes("drive.google.com")) return "drive";
  if (value.includes("jotform.com")) return "jotform";
  return "external";
}

export function ExternalServiceIcon({ href, service, className = "h-4 w-4 shrink-0" }: { href?: string; service?: ExternalService; className?: string }) {
  const resolved = service || serviceFromHref(href);

  if (resolved === "drive") {
    return (
      <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M7.1 3.5h5.8l4.6 8H11.7z" fill="#fbbc04" />
        <path d="M2.5 11.5 7.1 3.5l4.6 8-2.9 5z" fill="#34a853" />
        <path d="M8.8 16.5h8.7l-2.9-5H5.9z" fill="#4285f4" />
      </svg>
    );
  }

  if (resolved === "sheets") {
    return (
      <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="3" y="2" width="14" height="16" rx="1.5" fill="#0f9d58" />
        <rect x="6" y="6" width="8" height="1.5" rx=".5" fill="white" opacity=".9" />
        <rect x="6" y="9" width="8" height="1.5" rx=".5" fill="white" opacity=".9" />
        <rect x="6" y="12" width="5" height="1.5" rx=".5" fill="white" opacity=".9" />
      </svg>
    );
  }

  if (resolved === "jotform") {
    return (
      <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <rect x="3" y="2" width="14" height="16" rx="4" fill="#ff6100" />
        <path d="M10.4 5.2h3v7.3c0 2-1.3 3.3-3.5 3.3-1.5 0-2.6-.6-3.3-1.6l2-1.7c.3.4.6.6 1.1.6.4 0 .7-.3.7-.8z" fill="white" />
      </svg>
    );
  }

  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M8 5H5.5A2.5 2.5 0 0 0 3 7.5v7A2.5 2.5 0 0 0 5.5 17h7A2.5 2.5 0 0 0 15 14.5V12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M11 3h6v6M10 10l7-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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
    "flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50";
  if (href) {
    return (
      <a className={cls} href={href} target="_blank" rel="noreferrer">
        <ExternalServiceIcon href={href} />
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
