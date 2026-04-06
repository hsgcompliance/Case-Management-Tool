/* ===== FILE: web/src/entities/PageHeader.tsx ===== */
import React from "react";

function cx(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

export function PageHeader({
  title,
  subtitle,
  actions,
  className,
  tourId,
}: {
  title: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  tourId?: string;
}) {
  return (
    <div className={cx("flex items-start justify-between gap-4", className)} data-tour={tourId}>
      <div className="min-w-0" data-tour={tourId ? `${tourId}-content` : undefined}>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100" data-tour={tourId ? `${tourId}-title` : undefined}>{title}</h1>
        {subtitle ? (
          <div
            className="mt-1 text-sm text-slate-600 dark:text-slate-400"
            data-tour={tourId ? `${tourId}-subtitle` : undefined}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2" data-tour={tourId ? `${tourId}-actions` : undefined}>{actions}</div> : null}
    </div>
  );
}

export default PageHeader;
/* ===== END FILE: web/src/entities/PageHeader.tsx ===== */

