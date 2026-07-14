import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

// Quick-links landing — sleek cards, no iframes. Rendered authed at /staff
// (inside StaffLayout) AND public at /. Signed-in users get "Open" (embedded,
// internal route) plus "New tab"; signed-out visitors get new-tab links only.

type Card = {
  label: string;
  description: string;
  /** External URL (Jotform/portal) — always available, opens a new tab. */
  href: string;
  /** Authed-only internal route that opens the embedded experience. */
  internalHref?: string;
};

const FORM_CARDS: Card[] = [
  {
    label: "Referral to Rental Assistance",
    description: "Refer a household experiencing homelessness to rental assistance.",
    href: "https://form.jotform.com/251346523348053",
    internalHref: "/staff/referrals?open=251346523348053",
  },
  {
    label: "Bridging Home Referral",
    description: "Refer a household to the Bridging Home program.",
    href: "https://form.jotform.com/253555227407155",
    internalHref: "/staff/referrals?open=253555227407155",
  },
  {
    label: "Referral to Homelessness Prevention Screening",
    description: "Screen a household at risk of losing housing (eviction prevention).",
    href: "https://form.jotform.com/250021786346152",
    internalHref: "/staff/referrals?open=250021786346152",
  },
  {
    label: "Credit Card Checkout",
    description: "Check out a card with live monthly spend context.",
    href: "https://form.jotform.com/251590902397160",
    internalHref: "/staff/checkout",
  },
];

const RESOURCE_CARDS: Card[] = [
  {
    label: "Housing & Youth Compliance Portal",
    description: "Compliance forms and reporting for Housing & Youth programs.",
    href: "https://app.jotform.com/251348223649157?st=ZTQ4UzNqLzUzS0hXWXJrZThhUHJ0cDBxQWR2NTU0L014ZksydWNMZW16OEYyYkJCNmtFZ2tnYzBscUlMSzVZd1I3K2h3SUZkd3QxaU9FcDdxa2xvZDA0a1RMZEVZZFUyV05BNTA5S3JOdzB4eGptMFFiUnFvYVhPR291eGVlWnI%3D",
  },
  {
    label: "Resource Navigation Portal",
    description: "Resource Navigation team forms and tools.",
    href: "https://www.jotform.com/app/251040945339153?st=bmU3aUNmekdJWXVtUEhpaUhYN2pGT0tFR250elk3TkhEOXpyRlZwZXNKS1phNVI1UGo2U200bW1SZ2JJUGxQTHpBMU16N0pZUnB2S3pNS2lSd2htc2NHRGVINnRhNENNL2R1ZUtreE9VNEtpNnBNNVBxZzY2NXh1alQ2Y0EwaTI=",
  },
  {
    label: "Referral Board",
    description: "Track the status of your referrals to rental assistance, Bridging Home, and homelessness prevention.",
    href: "https://www.jotform.com/boards/251318461516050",
  },
  {
    label: "Case Management Dashboard",
    description: "See Budgets, Caseloads, Customer payment schedules, invoicing, and more.",
    href: "https://housing-db-v2.web.app",
  },
  {
    label: "Case Manager Mobile",
    description: "Quickly manage your case loads, update enrollments and Workbooks.",
    href: "https://housing-db-mobile.web.app",
  },
];

function CardItem({ card, authed }: { card: Card; authed: boolean }) {
  const showBoth = authed && !!card.internalHref;
  const cls =
    "group flex flex-col rounded-xl border border-slate-200 bg-white px-4 py-3.5 transition hover:border-indigo-300 hover:bg-indigo-50/40 hover:shadow-sm";

  const body = (
    <>
      <span className="text-sm font-semibold text-slate-900 group-hover:text-indigo-700">{card.label}</span>
      <p className="mt-1 flex-1 text-xs leading-relaxed text-slate-500">{card.description}</p>
    </>
  );

  if (!showBoth) {
    // Signed out (or no internal experience): the whole card opens a new tab.
    return (
      <a href={card.href} target="_blank" rel="noopener noreferrer" className={cls}>
        <div className="flex items-center justify-between gap-2">
          {body}
          <span className="shrink-0 self-start text-slate-300 group-hover:text-indigo-400">↗</span>
        </div>
      </a>
    );
  }

  // Signed in: card opens the embedded experience; a small chip opens the raw
  // form in a new tab instead.
  return (
    <div className={`${cls} relative`}>
      <Link to={card.internalHref!} className="flex min-h-full flex-col pr-16">
        {body}
        <span className="mt-2 text-xs font-semibold text-indigo-600">Open →</span>
      </Link>
      <a
        href={card.href}
        target="_blank"
        rel="noopener noreferrer"
        title="Open the live form in a new tab"
        className="absolute right-3 top-3 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-50"
      >
        New tab ↗
      </a>
    </div>
  );
}

export default function StaffLandingPage() {
  const { user } = useAuth();
  const authed = !!user;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Quick links</h2>
        <p className="text-sm text-slate-500">The everyday forms and tools, one click away.</p>
      </div>

      <section className="space-y-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Forms</h3>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {FORM_CARDS.map((c) => <CardItem key={c.href} card={c} authed={authed} />)}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Resources</h3>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {RESOURCE_CARDS.map((c) => <CardItem key={c.href} card={c} authed={authed} />)}
        </div>
      </section>
    </div>
  );
}
