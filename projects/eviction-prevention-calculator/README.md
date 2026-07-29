# Eviction Prevention Calculator and Widget Prototypes

This workspace contains the complete eligibility worksheet plus five standalone Jotform-oriented
calculation widgets:

1. Fair Market Rent
2. ESG Asset Limit
3. Area Median Income
4. Paystub or Hourly-Schedule Income Calculator
5. Calculation Explanation

## Open locally

Double-click `widgets.html` to open the functioning widget gallery.

Double-click `index.html` to open the complete income and eligibility worksheet.

No install, Firebase project, server, or build step is required. For a local HTTP URL instead of
`file://`, optionally run:

```powershell
python -m http.server 8080
```

Then open `http://localhost:8080`.

## Single-file packaging requirement

Files intended for Jotform deployment should ideally be **one self-contained HTML file per
widget**. Each file under `widgets/` contains its own:

- interface and responsive/print CSS;
- trusted calculation matrix and calculation logic;
- PDF/print and JSON export controls;
- compact Jotform submission-value builder;
- `JFCustomWidget` ready, live-data, resize, and submit hooks.

The only remote dependency is Jotform's official custom-widget runtime:
`https://js.jotform.com/JotFormCustomWidget.min.js`.

### Firebase terminology

Firestore is a database and does not directly serve an HTML widget URL. The standalone HTML files
should be uploaded to **Firebase Hosting** (or another HTTPS static host), and the resulting public
HTTPS URL should be registered with Jotform. Firestore can later store widget configuration or
calculation records, but it is not the HTML hosting layer.

Keeping each widget as a single HTML file makes direct Firebase Hosting deployment, versioning,
testing, and Jotform registration much simpler.

## One widget, one Jotform field

Treat each standalone HTML file as one Jotform widget and therefore one Jotform form field. Jotform's
Google Sheets integration normally maps that field to one Sheets column.

The widgets may display several related outputs, but they send **one stable pipe-delimited summary
string** to Jotform. This keeps the Sheets cell readable and avoids putting a large JSON document
into the primary form-response sheet. The separate JSON export retains the full structured detail
for download and audit.

| Widget file | Primary Jotform/Sheets field value |
|---|---|
| `fmr-widget.html` | County, unit size, monthly FMR |
| `esg-asset-limit-widget.html` | County, unit size, FMR, ESG limit, optional request/status |
| `ami-widget.html` | County, household size, monthly income, AMI limits, percentage/status |
| `income-calculator-widget.html` | Period, method, frequency, stub count, rolling/projected income, annual estimate |
| `calculation-explanation-widget.html` | One readable case-file calculation narrative |

Example:

```text
County:Gallatin|HH:2|MonthlyIncome:2100.00|AMI100:8683|AMI30:2605|Pct:24.2|Status:AtOrBelow30
```

The pipe-delimited labels are an output contract. Avoid renaming them after the widgets are in use
unless the downstream Sheets/reporting workflow is updated at the same time.

## Widget exports

Every standalone widget includes:

- **Export formatted PDF** — builds a separate, report-style document containing the relevant
  inputs, results, formulas, audit details, and source/version notes, then opens the browser's
  PDF print dialog. It does not print the interactive widget screen.
- **Export JSON** — downloads the widget inputs, calculated results, version information, and exact
  Jotform field value.
- A copy action for the primary result or explanation.

Exports are operator actions and are not uploaded automatically.

## Calculation rules

- The income widget's primary method averages all paystubs explicitly included as representative,
  annualizes that average using the selected pay frequency, and calculates:
  - average monthly income: `annualized income ÷ 12`;
  - estimated 30-day income: `annualized income × 30 ÷ 365`.
- Paystubs may be older than the historical 30-day window. They remain available for projection,
  while the widget reports the most recent stub's age and warns about stale evidence.
- A **30-day income basis** toggle controls the primary result:
  - annualized 30-day estimate: `annualized income × 30 ÷ 365`;
  - actual prior-30-day received income: checks paid inside the window plus separately entered
    other actual income.
- Both basis values and the work-period earned comparison remain in the JSON, PDF, and Jotform
  audit output regardless of which basis is selected.
- Staff may exclude a check from projection and classify partial periods, overtime, bonuses, leave,
  final checks, or other irregular pay. Excluded checks and decisions remain in the audit output.
- The historical comparison period includes the as-of date and the preceding 29 calendar days.
- **Historical 30-day earned** prorates gross pay using:
  `gross pay × overlapping work-period days ÷ total work-period days`.
- A paid-in-period stub without valid work dates uses the full check as a visible fallback and
  raises a warning.
- **Historical 30-day received** counts the full gross check when its pay date falls inside the window.
- **Annualized pay-frequency projection** uses the average included gross check:
  - weekly: average check × 52 ÷ 12;
  - bi-weekly: average check × 26 ÷ 12;
  - semi-monthly: average check × 24 ÷ 12;
  - monthly: average check × 12 ÷ 12.
- The historical and projected methods can differ due to partial work periods, the number of pay dates
  inside a 30-day window, overtime, bonuses, or irregular pay.
- Optional AMI inside the income widget uses projected average monthly income for the annualized
  basis, or actual prior-30-day received income as the monthly proxy for the actual basis. It uses
  the May 2026 matrix. The complete paystub ledger, inclusion decisions, classifications, warnings, formulas,
  projected results, historical comparisons, and optional AMI result are included in its single
  auditable Jotform field value and JSON export.
- The income widget also supports an **hourly work schedule** method. It calculates:
  - ongoing annual wages as `hourly wage × current weekly hours × 52`;
  - average monthly wages as `annual wages ÷ 12`;
  - the exact 30-day schedule window by prorating weekly hours across calendar days;
  - no wages for days in the window before the employment start date;
  - reduced weekly hours only for days overlapping an optional reduced-hours start/end range.
- Hourly-schedule mode does not represent pay actually received. It labels its results as scheduled
  hours and scheduled hourly pay and keeps the method, dates, rates, hours, and warning flags in the
  versioned `CalcV:4.0` audit value.
- The plain AMI widget compares gross monthly household income with the trusted monthly AMI matrix.
- ESG Asset Limit preserves the trusted widget formula:
  `round(2 × 80% × monthly FMR)`.

Use the calculation method required by the applicable program and document any exception.

## Source tables

The May 2026 values supplied for this project are the current source of truth in these prototypes.
They supersede the older values in the original completed widgets at:

```text
C:\Users\gseyfried\Desktop\Jotform Scripting\Jotform_widgets\completed
```

- AMI matrix version: `05-2026`
- FMR matrix version: `05-2026`

The original files in that external folder may still contain older matrices; do not copy those
older fallback values back into this project.

Confirm the current program-year values before production use or eligibility approval.

## Files

- `index.html` — complete income and eligibility worksheet.
- `styles.css`, `calculator.js`, `app.js` — full worksheet presentation and behavior.
- `widgets.html`, `widget-gallery.css` — local gallery embedding all standalone widgets.
- `widgets/fmr-widget.html` — self-contained FMR widget.
- `widgets/esg-asset-limit-widget.html` — self-contained ESG Asset Limit widget.
- `widgets/ami-widget.html` — self-contained plain AMI widget.
- `widgets/income-calculator-widget.html` — self-contained paystub/income widget.
- `widgets/calculation-explanation-widget.html` — self-contained narrative widget.
- `tests/calculator.test.js` — shared calculation-engine tests for the full worksheet.

Run shared calculation tests:

```powershell
node --test tests/calculator.test.js
```

## Before production

Test each standalone file as its own Jotform custom widget. Confirm:

1. the iframe height works in the target form;
2. required inputs block submission when incomplete;
3. the response appears in exactly one Jotform field and one Sheets column;
4. pipe-delimited labels remain intact in Jotform exports and Sheets;
5. current AMI/FMR matrices and program rules have been approved;
6. downloaded PDFs and JSON files are handled according to client-data privacy requirements.

## Live Jotform widget hosting

Production widget bucket: `gs://jotform-widgets-host`

| Widget | Public URL | Compatibility |
|---|---|---|
| AMI | `https://storage.googleapis.com/jotform-widgets-host/AMI_calculator.html` | Existing URL, inputs, and settings preserved; new submissions use the `CalcV:2` audit format |
| FMR / ESG combined | `https://storage.googleapis.com/jotform-widgets-host/fmr_widget.html` | Existing URL, inputs, rate-type input, and settings preserved; new submissions use the `CalcV:2` audit format |
| Income calculation | `https://storage.googleapis.com/jotform-widgets-host/income_calculator_widget.html` | Jotform-enabled paystub/hourly calculator with independent AMI income-basis toggle |
| ESG Asset Limit | `https://storage.googleapis.com/jotform-widgets-host/esg_asset_limit_widget.html` | New URL and new Jotform field |

The compatibility replacements retain the optional `ami-matrix`, `fmr-matrix`, `use-commas`, and
`date-stamp` Jotform settings used by the old widgets. A non-empty custom matrix setting overrides
the May 2026 default matrix, so existing form configuration should be checked and updated if it
still contains older values.

The AMI and combined FMR/ESG widgets still write exactly one value to one Jotform field. Their
input element names and optional settings have not changed. Only the value produced for a new
submission is different; historical Jotform and Sheets rows are not rewritten.

Example AMI value:

```text
CalcV:2|Widget:AMI|County:Gallatin|HH:2|MonthlyIncome:1000.00|AMI100Monthly:8683.00|AMI30Monthly:2604.90|AMIPct:11.5|Eligibility:AtOrBelow30|Matrix:05-2026
```

Example combined FMR/ESG value:

```text
CalcV:2|Widget:FMR_ESG|County:Gallatin|UnitSize:2BR|RateType:ESG|MonthlyFMR:2154.00|OutputLimit:3446.00|Formula:2x80pctFMR|Matrix:05-2026
```

## Public screening site

The no-sign-in public editions are deployed separately from Jotform:

- Landing page: `https://hrdc-screening-tools.web.app`
- AMI estimate: `https://hrdc-screening-tools.web.app/ami`
- Payment and income estimate: `https://hrdc-screening-tools.web.app/income`

Their source/build/audit configuration is in `../public-screening-tools/`. Public builds remove the
Jotform runtime, URL prefill, network access, analytics, and browser persistence. Do not replace the
Jotform widget URL with the public build: Jotform still requires its custom-widget runtime and
submission hooks.

The same synchronized income widget is also deployed at:

- Existing Forms-site popup/direct surface:
  `https://housing-db-forms.web.app/tools/income-calculator-widget.html`
- Jotform custom-widget surface:
  `https://storage.googleapis.com/jotform-widgets-host/income_calculator_widget.html`

The canonical source is `widgets/income-calculator-widget.html`. The public-screening build
synchronizes its checked-in Forms and deploy copies and produces a separate hardened public edition.
The complete current deployment inventory and last verified release identifiers are maintained in
`../public-screening-tools/README.md` and `../public-screening-tools/AUDIT.md`.
