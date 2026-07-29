import { cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(projectDir, "../..");
const widgetDir = resolve(repoRoot, "projects/eviction-prevention-calculator/widgets");
const publicDir = resolve(projectDir, "public");

async function write(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value, "utf8");
}

function requireReplacement(value, search, replacement, label) {
  if (!value.includes(search)) throw new Error(`Public build could not find ${label}`);
  return value.replace(search, replacement);
}

function hardenCommon(html, { title, description }) {
  html = requireReplacement(
    html,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${description}">
  <meta name="referrer" content="no-referrer">`,
    "viewport metadata"
  );
  html = html.replace(/  <script src="https:\/\/js\.jotform\.com\/JotFormCustomWidget\.min\.js"><\/script>\r?\n/, "");
  html = html.replace(/<title>[^<]+<\/title>/, `<title>${title}</title>`);
  html = requireReplacement(
    html,
    "</style>",
    `    .public-nav{max-width:1040px;margin:0 auto 10px}.public-nav a{color:#355e4b;font-size:12px;font-weight:750;text-decoration:none}.privacy-banner{max-width:1040px;margin:0 auto 12px;padding:11px 13px;color:#0e4d36;background:#e6f4ed;border:1px solid #b9decc;border-radius:10px;font-size:12px}.privacy-banner strong{display:block}.privacy-banner p{margin:2px 0 0}.screening-note{max-width:1040px;margin:14px auto 0;padding:11px 13px;color:#5f5546;background:#fffaf0;border:1px solid #ead9b7;border-radius:10px;font-size:11px}
  </style>`,
    "style closing tag"
  );
  html = requireReplacement(
    html,
    "<body>",
    `<body>
  <nav class="public-nav no-print"><a href="/">← All screening tools</a></nav>
  <section class="privacy-banner" aria-label="Privacy information"><strong>Your entries stay in this browser.</strong><p>This page has no sign-in, account, analytics, or submission service. Closing it clears your entries. Protect any file you choose to print or download.</p></section>`,
    "body opening tag"
  );
  html = requireReplacement(
    html,
    "</body>",
    `  <aside class="screening-note">This is an initial screening estimate, not a final eligibility or assistance decision. HRDC staff must review current program rules and supporting documents.</aside>
</body>`,
    "body closing tag"
  );
  return html;
}

function publicAmi(html) {
  html = hardenCommon(html, {
    title: "AMI Screening Estimate | HRDC",
    description: "Private browser-only Area Median Income screening estimate from HRDC."
  });
  html = html.replace('let state={ami100:null,percent:null,limits:null,status:""},summary="",jfReady=false;', 'let state={ami100:null,percent:null,limits:null,status:""},summary="";');
  html = html.replace(";if(jfReady)JFCustomWidget.sendData(summary)", "");
  html = html.replace(/\s*\(function applyPrefill\(\)\{[^]*?\}\)\(\);\r?\n/, "\n");
  html = html.replace(/\s*if\(window\.JFCustomWidget\)\{[^]*?sendSubmit\(\{valid:!!summary,value:summary\}\)\)\}\r?\n/, "\n");
  html = html.replaceAll("AMI Calculator Widget", "AMI Screening Estimate");
  html = html.replaceAll("Jotform field value:", "Calculation summary:");
  html = html.replaceAll("Jotform audit value:", "Calculation summary:");
  html = html.replaceAll("jotformValue:summary", "calculationSummary:summary");
  return html;
}

function publicIncome(html) {
  html = hardenCommon(html, {
    title: "Payment and Income Estimate | HRDC",
    description: "Private browser-only payment and income screening estimate using paystubs or an hourly work schedule."
  });
  html = html.replace('let stubs=[],result={},summary="",jfReady=false;', 'let stubs=[],result={},summary="";');
  html = html.replaceAll("if(jfReady)JFCustomWidget.sendData(summary);", "");
  html = html.replace(/\s*if\(window\.JFCustomWidget\)\{\s*JFCustomWidget\.subscribe\("ready"[^]*?JFCustomWidget\.subscribe\("submit"[^]*?\);\s*\}\r?\n/, "\n");
  html = html.replaceAll("Copy auditable field value", "Copy calculation summary");
  html = html.replaceAll("Single Jotform field value:", "Calculation summary:");
  html = html.replaceAll("Jotform audit value:", "Calculation summary:");
  html = html.replaceAll("jotformValue:summary", "calculationSummary:summary");
  html = html.replaceAll("Annualized Income Calculator Widget", "Payment and Income Estimate");
  return html;
}

await mkdir(publicDir, { recursive: true });
await cp(resolve(projectDir, "source/index.html"), resolve(publicDir, "index.html"));
await cp(resolve(projectDir, "source/site.css"), resolve(publicDir, "site.css"));

const amiSource = await readFile(resolve(widgetDir, "ami-widget.html"), "utf8");
const incomeSource = await readFile(resolve(widgetDir, "income-calculator-widget.html"), "utf8");
await write(resolve(publicDir, "ami.html"), publicAmi(amiSource));
await write(resolve(publicDir, "income.html"), publicIncome(incomeSource));

// Keep the two checked-in iframe copies aligned with the canonical Jotform widget.
for (const relativePath of [
  "forms-web/public/tools/income-calculator-widget.html",
  "forms-web/dist/tools/income-calculator-widget.html",
  "projects/eviction-prevention-calculator/deploy/income_calculator_widget.html"
]) {
  await write(resolve(repoRoot, relativePath), incomeSource);
}

console.log("Built hardened public tools and synchronized payment-widget copies.");
