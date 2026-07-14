import { CreditCardCards } from "@/components/CreditCardCards";
import { JotformEmbed } from "@/components/JotformEmbed";

// Direct-link landing page: /staff/checkout — straight into the Credit Card
// Checkout form with the card spend context in view. Bookmarkable.

const CHECKOUT_FORM_ID = "251590902397160";

export default function CheckoutLandingPage() {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Credit Card Checkout</h2>
        <p className="text-xs text-slate-500">Direct link — bookmark this page to jump straight to checkout.</p>
      </div>
      <CreditCardCards />
      <JotformEmbed formId={CHECKOUT_FORM_ID} title="Credit Card Checkout" />
    </div>
  );
}
