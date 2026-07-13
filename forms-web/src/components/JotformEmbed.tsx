import { useEffect, useRef, useState } from "react";

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

export function JotformEmbed({
  formId,
  title,
  onSubmitted,
}: {
  formId: string;
  title: string;
  onSubmitted?: (raw: string) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(900);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setSubmitted(false);

    function onMessage(e: MessageEvent) {
      if (!isJotformOrigin(e.origin)) return;
      const text = asText(e.data);

      // Transparency: surface every Jotform message in our console.
      // eslint-disable-next-line no-console
      console.log("[forms][jotform]", formId, text);

      // Auto-resize: Jotform posts "setHeight:<px>:<formId>".
      const h = /setHeight:(\d+)/.exec(text);
      if (h) {
        const px = Number(h[1]);
        if (Number.isFinite(px) && px > 0) setHeight(Math.min(4000, px + 24));
      }

      // Best-effort submission detection (cross-origin, so heuristic).
      if (/submission-completed|submitForm|thankyou|thank-you|formSubmitted|"event":"submit"/i.test(text)) {
        // eslint-disable-next-line no-console
        console.log("[forms][SUBMITTED]", { formId, raw: text });
        setSubmitted(true);
        onSubmitted?.(text);
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [formId, onSubmitted]);

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
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Submission detected — it will appear in the Webhooks sidebar in a few seconds.
        </div>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <iframe
          ref={iframeRef}
          title={title}
          src={`https://form.jotform.com/${formId}`}
          className="w-full"
          style={{ height, minHeight: 600, border: "0" }}
          allow="geolocation; microphone; camera; fullscreen; payment"
          scrolling="no"
        />
      </div>
    </div>
  );
}
