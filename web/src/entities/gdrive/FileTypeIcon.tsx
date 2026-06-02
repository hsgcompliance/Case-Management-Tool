// Canonical file-type icon + MIME helpers for Drive entities.
// Import from here — do not redefine inline in panels.

export const FOLDER_MIME  = "application/vnd.google-apps.folder";
export const SHEETS_MIME  = "application/vnd.google-apps.spreadsheet";
export const DOCS_MIME    = "application/vnd.google-apps.document";
export const SLIDES_MIME  = "application/vnd.google-apps.presentation";
export const FORMS_MIME   = "application/vnd.google-apps.form";
export const PDF_MIME     = "application/pdf";

export type MimeCategory = "folder" | "sheets" | "docs" | "slides" | "forms" | "pdf" | "file";

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
