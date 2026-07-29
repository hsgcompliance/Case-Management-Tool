# HRDC Public Screening Tools

This is a static, no-sign-in Firebase Hosting site for public AMI and income screening estimates.

## Privacy boundary

- No backend, database, authentication, analytics, cookies, or browser persistence.
- No Jotform runtime in public calculator builds.
- No query-string prefill.
- Entries exist only in the open page.
- PDF and JSON exports are created locally by the browser at the user's request.
- Security headers disable network connections and restrict framing to the Firebase site and HRDC's
  official `thehrdc.org` website origins.

The canonical Jotform widget remains at
`../eviction-prevention-calculator/widgets/income-calculator-widget.html`. `npm run build` creates
the privacy-hardened public edition and synchronizes the checked-in iframe/deploy copies.

The income calculator keeps its main 30-day calculation method separate from the optional AMI
comparison. In paystub mode, the AMI section can use either the annualized 30-day estimate or income
actually received during the previous 30 days. Hourly-schedule mode uses the projected 30-day
schedule because actual received income requires paystub evidence.

## Commands

```powershell
npm run build
npm test
npm run audit
```

Deploy this directory with its dedicated Firebase project:

```powershell
firebase deploy --only hosting
```

The public result is an estimate only. Program staff must validate current tables, program rules,
and supporting documentation before determining eligibility.

## Deployed production surfaces

| Surface | Production URL | Intended use |
|---|---|---|
| Public screening landing page | `https://hrdc-screening-tools.web.app` | No-sign-in client entry point |
| Public AMI calculator | `https://hrdc-screening-tools.web.app/ami` | Email link or iframe on `thehrdc.org` |
| Public payment and income calculator | `https://hrdc-screening-tools.web.app/income` | Email link or iframe on `thehrdc.org` |
| Existing Forms-site income widget | `https://housing-db-forms.web.app/tools/income-calculator-widget.html` | Existing application popup/direct-service surface |
| Jotform income widget | `https://storage.googleapis.com/jotform-widgets-host/income_calculator_widget.html` | Jotform custom-widget registration only |

Firebase also provides equivalent `firebaseapp.com` aliases for its Hosting sites:

- `https://hrdc-screening-tools.firebaseapp.com/income`
- `https://housing-db-forms.firebaseapp.com/tools/income-calculator-widget.html`

The documented `web.app` addresses are the canonical links to distribute.

Firebase project `hrdc-screening-tools` is Hosting-only and is linked to the same Cloud Billing
account as `housing-db-v2`. The Forms-site copy is a single-file deployment within the existing
`housing-db-forms` Hosting site. The GCS copy is the Jotform-enabled canonical widget in
`gs://jotform-widgets-host`.

Use the `hrdc-screening-tools.web.app` URLs for clients and the public website. Do not replace the
GCS URL configured in Jotform with the public `/income` URL: the public build intentionally removes
the Jotform runtime and submission hooks.

## Source and synchronization

The canonical income widget is:

`projects/eviction-prevention-calculator/widgets/income-calculator-widget.html`

Running `npm run build` in this directory synchronizes that file to:

- `forms-web/public/tools/income-calculator-widget.html`
- `forms-web/dist/tools/income-calculator-widget.html`
- `projects/eviction-prevention-calculator/deploy/income_calculator_widget.html`

It also creates the separate privacy-hardened public build at `public/income.html`. See
`AUDIT.md` for the most recently verified Firebase versions, releases, GCS generation, hashes, and
live security checks.
