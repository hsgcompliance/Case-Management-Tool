import { Link } from "react-router-dom";

// Staff landing page (/staff) — sleek quick-link cards, no iframes.
// Forms: the really common referrals + checkout. Resources: portals + apps.

type Card = {
  label: string;
  description: string;
  href: string;
  /** Internal router link instead of a new tab. */
  internal?: boolean;
};

const FORM_CARDS: Card[] = [
  {
    label: "Referral to Rental Assistance",
    description: "Refer a household experiencing homelessness to rental assistance.",
    href: "https://form.jotform.com/251346523348053",
  },
  {
    label: "Bridging Home Referral",
    description: "Refer a household to the Bridging Home program.",
    href: "https://form.jotform.com/253555227407155",
  },
  {
    label: "Referral to Homelessness Prevention Screening",
    description: "Screen a household at risk of losing housing (eviction prevention).",
    href: "https://form.jotform.com/250021786346152",
  },
  {
    label: "Credit Card Checkout",
    description: "Check out a card with live monthly spend context.",
    href: "/staff/checkout",
    internal: true,
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
    label: "Referral Status",
    description: "Track incoming referrals on the intake board.",
    href: "https://www.jotform.com/boards/251318461516050",
  },
  {
    label: "HHDB",
    description: "The main Households DB web app — customers, grants, payments.",
    href: "https://housing-db-v2.web.app",
  },
  {
    label: "HHDB Mobile",
    description: "Sessions, goals, and case notes on the go.",
    href: "https://housing-db-mobile.web.app",
  },
];

function CardLink({ card }: { card: Card }) {
  const inner = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-900 group-hover:text-indigo-700">{card.label}</span>
        <span className="shrink-0 text-slate-300 group-hover:text-indigo-400">{card.internal ? "→" : "↗"}</span>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">{card.description}</p>
    </>
  );
  const cls =
    "group block rounded-xl border border-slate-200 bg-white px-4 py-3.5 transition hover:border-indigo-300 hover:bg-indigo-50/40 hover:shadow-sm";
  return card.internal ? (
    <Link to={card.href} className={cls}>{inner}</Link>
  ) : (
    <a href={card.href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>
  );
}

export default function StaffLandingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-slate-900">Quick links</h2>
        <p className="text-sm text-slate-500">The everyday forms and tools, one click away.</p>
      </div>

      <section className="space-y-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Forms</h3>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {FORM_CARDS.map((c) => <CardLink key={c.href} card={c} />)}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Resources</h3>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {RESOURCE_CARDS.map((c) => <CardLink key={c.href} card={c} />)}
        </div>
      </section>
    </div>
  );
}
