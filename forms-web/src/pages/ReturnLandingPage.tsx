import { useCallback, useEffect, useRef, useState } from "react";
import { CreditCardCards } from "@/components/CreditCardCards";
import { JotformEmbed } from "@/components/JotformEmbed";

// Direct-link landing page: /staff/return — the Credit Card Return form, which
// auto-pipes into Credit Card Purchase Documentation after submission (with a
// short pause so the Jotform confirmation is visible).

const RETURN_FORM_ID = "251658579638173";
const PURCHASE_DOC_FORM_ID = "251878265158166";

export default function ReturnLandingPage() {
  const [stage, setStage] = useState<"return" | "doc">("return");
  const [returnDone, setReturnDone] = useState(false);
  const advanceTimer = useRef<number | null>(null);

  const onReturnSubmitted = useCallback(() => {
    setReturnDone(true);
    if (advanceTimer.current == null) {
      advanceTimer.current = window.setTimeout(() => setStage("doc"), 2000);
    }
  }, []);

  useEffect(() => () => {
    if (advanceTimer.current != null) window.clearTimeout(advanceTimer.current);
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            {stage === "return" ? "Credit Card Return" : "Credit Card Purchase Documentation"}
          </h2>
          <p className="text-xs text-slate-500">
            {stage === "return"
              ? "Direct link — submitting the return continues into purchase documentation automatically."
              : "Step 2 of the return flow — document the purchase the return relates to."}
          </p>
        </div>
        {stage === "return" ? (
          <button
            type="button"
            onClick={() => setStage("doc")}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            Skip to purchase documentation →
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setStage("return")}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            ← Back to return form
          </button>
        )}
      </div>

      {returnDone && stage === "return" ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Return submitted — continuing to purchase documentation…
        </div>
      ) : null}
      {returnDone && stage === "doc" ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          ✓ Return submitted. Now document the related purchase below.
        </div>
      ) : null}

      <CreditCardCards />

      {stage === "return" ? (
        <JotformEmbed formId={RETURN_FORM_ID} title="Credit Card Return" onSubmitted={onReturnSubmitted} />
      ) : (
        <JotformEmbed formId={PURCHASE_DOC_FORM_ID} title="Credit Card Purchase Documentation" />
      )}
    </div>
  );
}
