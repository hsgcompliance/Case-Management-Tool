# Production Audit — 2026-07-28

Production site: `https://hrdc-screening-tools.web.app`

## Deployment boundary

- Dedicated Firebase project: `hrdc-screening-tools`
- Hosting only; calculators do not call Firebase APIs
- No sign-in or authentication redirect
- Billing enabled and verified against the same billing account association as `housing-db-v2`
- Deployed Firebase Hosting version: `ee0ec9b9ac8ac9fc`
- Deployed Firebase Hosting release: `1785260310289000`

## Live HTTP verification

The landing page, `/ami`, and `/income` each returned anonymous HTTP 200 responses with no redirect
and no `Set-Cookie` header. The deployed bytes matched the local production files by SHA-256.

Verified response controls:

- `Cache-Control: no-store, max-age=0`
- `Referrer-Policy: no-referrer`
- `X-Content-Type-Options: nosniff`
- camera, geolocation, microphone, payment, and USB disabled by Permissions Policy
- `connect-src 'none'`, `object-src 'none'`, `base-uri 'none'`, and `form-action 'none'`
- framing limited to this Firebase site and the official `thehrdc.org` / `www.thehrdc.org` origins
- popups remain available for locally generated print/PDF reports

## Privacy verification

Static source and deployed files were checked for:

- Jotform runtime or submission hooks in public editions
- `fetch`, XMLHttpRequest, beacon, or WebSocket calls
- cookies, local storage, session storage, or IndexedDB
- analytics/tag-manager integrations
- remote scripts, images, stylesheets, or iframes
- query-string prefill

None were present. A request containing test query values did not place those values in the returned
page and the calculator contains no query-reading code.

## Calculation verification

- Existing calculator suite: 12/12 passing
- Hourly schedule suite: 4/4 passing
- Inline scripts parsed successfully in Jotform, iframe/deploy, and public builds
- Calculation method is exposed as a two-option toggle rather than a select menu
- AMI is open by default and has an independent toggle between the annualized 30-day estimate and
  actual income received during the previous 30 days
- Optional documentation fields and calculation notes are grouped in a collapsed expander
- Optional paystub classification/note columns are hidden by default; the standard-width table does
  not overflow horizontally
- Browser smoke test passed for a temporary reduced-hours case:
  - $20/hour
  - 40 usual weekly hours
  - 20 reduced weekly hours for 10 days
  - 142.86 scheduled hours in the 30-day window
  - $2,857.14 scheduled 30-day pay
  - $3,466.67 average monthly wages
  - versioned `CalcV:4.0` audit output

## Jotform compatibility

The live object at
`https://storage.googleapis.com/jotform-widgets-host/income_calculator_widget.html` was updated from
the canonical source. Anonymous retrieval returned HTTP 200, the live SHA-256 matched the source,
and the deployed widget retained the Jotform runtime, hourly-schedule method, simplified options,
and AMI income-basis toggle.

- GCS object generation: `1785260262577833`
- GCS response cache policy: `no-store`

The canonical widget, `forms-web/public/tools/`, `forms-web/dist/tools/`, and the deploy copy were
verified byte-for-byte identical after synchronization.

The existing iframe URL was updated with a clone-and-replace deployment so unrelated Forms-site
assets were not redeployed:

- URL: `https://housing-db-forms.web.app/tools/income-calculator-widget.html`
- Hosting version: `27bd805a8adc8f83`
- Release: `1785260350739000`
- Live HTTP status: 200
- Live SHA-256 matched the synchronized local iframe file
- Calculation-method and AMI-basis toggles, the collapsed documentation options, hourly method,
  `CalcV:4.0`, and the Jotform runtime were all present

The public `/income` page, existing iframe URL, and GCS/Jotform object were fetched anonymously
after deployment. Each returned HTTP 200 with no `Set-Cookie`, matched its corresponding local file
by SHA-256, and contained the new controls. The removed “avoid full name/employer” wording was
absent from all three live copies.

The automatic `hrdc-screening-tools.firebaseapp.com/income` and
`housing-db-forms.firebaseapp.com/tools/income-calculator-widget.html` aliases also returned HTTP
200 with no `Set-Cookie` and matched their corresponding canonical `web.app` files by SHA-256.

## Remaining program control

These are screening estimates, not final eligibility determinations. HRDC remains responsible for
approving current AMI values, applicable program rules, and supporting documentation.
