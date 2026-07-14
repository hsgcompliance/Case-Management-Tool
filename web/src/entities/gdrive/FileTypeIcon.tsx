// Canonical file-type icon + MIME helpers for Drive entities.
// Import from here — do not redefine inline in panels.

export const FOLDER_MIME  = "application/vnd.google-apps.folder";
export const SHEETS_MIME  = "application/vnd.google-apps.spreadsheet";
export const DOCS_MIME    = "application/vnd.google-apps.document";
export const SLIDES_MIME  = "application/vnd.google-apps.presentation";
export const FORMS_MIME   = "application/vnd.google-apps.form";
export const PDF_MIME     = "application/pdf";

export type MimeCategory = "folder" | "sheets" | "docs" | "slides" | "forms" | "pdf" | "file";
export type ExternalService = "drive" | "sheets" | "jotform" | "external";

export function getMimeCategory(mime?: string): MimeCategory {
  switch (mime) {
    case FOLDER_MIME:  return "folder";
    case SHEETS_MIME:  return "sheets";
    case DOCS_MIME:    return "docs";
    case SLIDES_MIME:  return "slides";
    case FORMS_MIME:   return "forms";
    case PDF_MIME:     return "pdf";
    default:           return "file";
  }
}

export function FileTypeIcon({
  mime,
  className = "h-4 w-4 shrink-0",
}: {
  mime?: string;
  className?: string;
}) {
  const cat = getMimeCategory(mime);

  if (cat === "folder") return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" style={{ color: "#f59e0b" }}>
      <path d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
    </svg>
  );
  if (cat === "sheets") return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3" y="2" width="14" height="16" rx="1.5" fill="#0f9d58" />
      <rect x="6" y="6" width="8" height="1.5" rx=".5" fill="white" opacity=".9" />
      <rect x="6" y="9" width="8" height="1.5" rx=".5" fill="white" opacity=".9" />
      <rect x="6" y="12" width="5" height="1.5" rx=".5" fill="white" opacity=".9" />
    </svg>
  );
  if (cat === "docs") return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3" y="2" width="14" height="16" rx="1.5" fill="#4285f4" />
      <rect x="6" y="6" width="8" height="1.5" rx=".5" fill="white" opacity=".9" />
      <rect x="6" y="9" width="8" height="1.5" rx=".5" fill="white" opacity=".9" />
      <rect x="6" y="12" width="5" height="1.5" rx=".5" fill="white" opacity=".9" />
    </svg>
  );
  if (cat === "slides") return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3" y="2" width="14" height="16" rx="1.5" fill="#f4b400" />
      <rect x="5" y="5" width="10" height="7" rx="1" fill="white" opacity=".9" />
      <rect x="8" y="13" width="4" height="1.5" rx=".5" fill="white" opacity=".9" />
    </svg>
  );
  if (cat === "pdf") return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3" y="2" width="14" height="16" rx="1.5" fill="#db4437" />
      <path d="M7 8h1.5c.8 0 1.5.7 1.5 1.5S9.3 11 8.5 11H7V8zm0 3h4M7 13h4"
        stroke="white" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" style={{ color: "#94a3b8" }}>
      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h4a1 1 0 100-2H7z" clipRule="evenodd" />
    </svg>
  );
}

export function externalServiceFromUrl(url?: string): ExternalService {
  const value = String(url || "").toLowerCase();
  if (value.includes("docs.google.com/spreadsheets")) return "sheets";
  if (value.includes("drive.google.com")) return "drive";
  if (value.includes("jotform.com")) return "jotform";
  return "external";
}

export function ExternalServiceIcon({
  service,
  href,
  className = "h-4 w-4 shrink-0",
}: {
  service?: ExternalService;
  href?: string;
  className?: string;
}) {
  const resolved = service || externalServiceFromUrl(href);

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
    return <FileTypeIcon mime={SHEETS_MIME} className={className} />;
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
