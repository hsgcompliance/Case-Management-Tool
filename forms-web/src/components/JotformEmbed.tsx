import { useEffect, useRef, useState } from "react";
import { listSubmissions, type JfSubmission } from "@/lib/jotformManagerApi";
import { matchName } from "@/lib/nameMatch";
import { getSubmissionLabel } from "@/lib/submissionLabel";
import { SubmissionResultPanel } from "./SubmissionResultPanel";

// Embeds a Jotform in an iframe. Because the iframe is cross-origin (jotform.com),
// we CANNOT read field inputs/keystrokes — same-origin policy. What we CAN do:
// listen to Jotform's postMessage events (resize + submission signals) and log
// them to the browser console. The full submission data is retrieved separately
// via the backend API pull (jotformSyncSubmissions) after submit.

function isJotformOrigin(origin: string): boolean {
  try {
    return new URL(origin).hostname.endsWith("jotform.com");
  } catch {
    return false;
  }
}

function asText(data: unknown): string {
  if (typeof data === "string") return data;
  try { return JSON.stringify(data); } catch { return String(data); }
}

function requestsPageScroll(text: string): boolean {
  return /scrollIntoView|page(?:Change|Changed|Navigation)|showPage|goToPage|nextPage|prev(?:ious)?Page|formPageChanged/i.test(text);
}

function scrollHostToTop(): void {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

const FORM_BOTTOM_BUFFER_PX = 240;
const MAX_FORM_HEIGHT_PX = 12_000;

function RefreshIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M16 4v4h-4M4 16v-4h4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.5 10a5.5 5.5 0 0 1 9.3-3.9L16 8M15.5 10a5.5 5.5 0 0 1-9.3 3.9L4 12"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M8 5H5.5A2.5 2.5 0 0 0 3 7.5v7A2.5 2.5 0 0 0 5.5 17h7A2.5 2.5 0 0 0 15 14.5V12"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path d="M11 3h6v6M10 10l7-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const TOOLBAR_BUTTON_CLASS =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50";

export function JotformEmbed({
  formId,
  title,
  onSubmitted,
  onSubmissionReceived,
  onHeightAnomaly,
  hohName,
}: {
  formId: string;
  title: string;
  onSubmitted?: (raw: string) => void;
  /** Supplies the authoritative submission to the in-browser webhook model. */
  onSubmissionReceived?: (submission: JfSubmission) => void;
  /** Fired when the form's height grows on its OWN page (no page-change message nearby) after it already loaded — the only observable symptom of Jotform's "there are N errors on this page" banner, which never crosses postMessage as text. */
  onHeightAnomaly?: () => void;
  /** Head-of-household name to watch for as a fallback: some Jotform dropdowns occasionally refuse to render, forcing staff to finish the submission in a separate tab where the postMessage listener below never fires. */
  hohName?: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(900 + FORM_BOTTOM_BUFFER_PX);
  const [submitted, setSubmitted] = useState(false);
  const [submission, setSubmission] = useState<JfSubmission | null>(null);
  const [loadingSubmission, setLoadingSubmission] = useState(false);
  const [embedKey, setEmbedKey] = useState(0);
  const openedAt = useRef(Date.now());
  const detecting = useRef(false);
  const initialHeightSeen = useRef(false);
  const lastPageChangeAt = useRef(0);

  function resetEmbed() {
    setSubmitted(false);
    setSubmission(null);
    setLoadingSubmission(false);
    detecting.current = false;
    initialHeightSeen.current = false;
    lastPageChangeAt.current = 0;
    openedAt.current = Date.now();
    setEmbedKey((value) => value + 1);
  }

  useEffect(() => {
    setSubmitted(false);
    setSubmission(null);
    setLoadingSubmission(false);
    detecting.current = false;
    initialHeightSeen.current = false;
    lastPageChangeAt.current = 0;
    openedAt.current = Date.now();

    async function resolveSubmission(raw: string) {
      setLoadingSubmission(true);
      const explicitId = /(?:submission(?:id|_id)?)["':=\s]+(\d{8,24})/i.exec(raw)?.[1] || null;
      for (let attempt = 0; attempt < 6; attempt += 1) {
        try {
          const rows = await listSubmissions(formId);
          const exact = explicitId ? rows.find((row) => row.id === explicitId) : null;
          const recent = rows.find((row) => {
            const created = row.created_at ? new Date(row.created_at).getTime() : 0;
            return created >= openedAt.current - 60_000;
          });
          const found = exact || recent;
          if (found) {
            const resolved = {
              ...found,
              formId: String(found.formId || found.form_id || formId),
            };
            setSubmission(resolved);
            onSubmissionReceived?.(resolved);
            setLoadingSubmission(false);
            return;
          }
        } catch { /* webhook/API sync may not be ready yet */ }
        await new Promise<void>((resolve) => window.setTimeout(resolve, 2000));
      }
      setLoadingSubmission(false);
    }

    function onMessage(e: MessageEvent) {
      if (!isJotformOrigin(e.origin)) return;
      const text = asText(e.data);

      // Transparency: surface every Jotform message in our console.
      // eslint-disable-next-line no-console
      console.log("[forms][jotform]", formId, text);

      // Jotform requests scrollIntoView when a multi-page form advances,
      // including submit → signature transitions. Ignore resize-only messages
      // so expanding fields do not unexpectedly move the host page.
      if (requestsPageScroll(text)) {
        scrollHostToTop();
        lastPageChangeAt.current = Date.now();
      }

      // Auto-resize: Jotform posts "setHeight:<px>:<formId>".
      const h = /setHeight:(\d+)/.exec(text);
      if (h) {
        const px = Number(h[1]);
        if (Number.isFinite(px) && px > 0) {
          setHeight(Math.min(MAX_FORM_HEIGHT_PX, px + FORM_BOTTOM_BUFFER_PX));
          // Jotform never posts "there are N errors on this page" as text — the
          // only observable symptom is the iframe growing taller on its OWN
          // page (no page-change message nearby), because the error banner
          // pushed the content down. Heuristic, not proof — hence the callback
          // rather than an outright error state.
          if (!initialHeightSeen.current) {
            initialHeightSeen.current = true;
          } else if (Date.now() - lastPageChangeAt.current > 2_000) {
            onHeightAnomaly?.();
          }
        }
      }

      // Best-effort submission detection (cross-origin, so heuristic).
      if (/submission-completed|submitForm|thankyou|thank-you|formSubmitted|"event":"submit"/i.test(text)) {
        if (detecting.current) return;
        detecting.current = true;
        // eslint-disable-next-line no-console
        console.log("[forms][SUBMITTED]", { formId, raw: text });
        setSubmitted(true);
        scrollHostToTop();
        onSubmitted?.(text);
        void resolveSubmission(text);
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [embedKey, formId, onSubmitted, onSubmissionReceived]);

  // Fallback for the occasional Jotform dropdown that refuses to render: staff
  // finish the submission in a separate tab, so the postMessage listener above
  // never fires. Poll for a same-form submission whose best-guess name matches
  // the household head and treat it exactly like a detected submission.
  useEffect(() => {
    if (!hohName || submitted) return;
    let cancelled = false;
    const poll = async () => {
      if (cancelled || detecting.current) return;
      try {
        const rows = await listSubmissions(formId);
        const match = rows.find((row) => {
          const created = row.created_at ? new Date(row.created_at).getTime() : 0;
          if (created < openedAt.current - 60_000) return false;
          return matchName(getSubmissionLabel(row), hohName) !== "none";
        });
        if (match && !cancelled && !detecting.current) {
          detecting.current = true;
          const resolved = { ...match, formId: String(match.formId || match.form_id || formId) };
          // eslint-disable-next-line no-console
          console.log("[forms][SUBMITTED-fallback]", { formId, submissionId: match.id });
          setSubmitted(true);
          scrollHostToTop();
          setSubmission(resolved);
          onSubmitted?.(`fallback-match:${match.id}`);
          onSubmissionReceived?.(resolved);
        }
      } catch { /* best-effort; try again next tick */ }
    };
    const t = window.setInterval(poll, 8_000);
    return () => { cancelled = true; window.clearInterval(t); };
  }, [formId, hohName, submitted, embedKey, onSubmitted, onSubmissionReceived]);

  // Defensive: Jotform form ids are numeric. Never inject anything else into src.
  if (!/^\d{6,24}$/.test(formId)) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
        Invalid form id.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {submitted ? (
        <SubmissionResultPanel
          formId={formId}
          submission={submission}
          loading={loadingSubmission}
          onSubmitAgain={resetEmbed}
        />
      ) : null}
      <div className="flex items-center justify-end gap-2">
        <button type="button" className={TOOLBAR_BUTTON_CLASS} onClick={resetEmbed}>
          <RefreshIcon />
          Refresh form
        </button>
        <a
          className={TOOLBAR_BUTTON_CLASS}
          href={`https://form.jotform.com/${formId}`}
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLinkIcon />
          Open in new tab
        </a>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <iframe
          ref={iframeRef}
          key={embedKey}
          title={title}
          src={`https://form.jotform.com/${formId}`}
          className="w-full"
          style={{ height, minHeight: 600, border: "0" }}
          allow="geolocation; microphone; camera; fullscreen; payment"
          scrolling="auto"
        />
      </div>
      <p className="px-1 text-center text-xs text-slate-500">
        If scrolling breaks, tap into the bottom field and press Tab.
      </p>
    </div>
  );
}
