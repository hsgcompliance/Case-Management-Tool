import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);
const repoRoot = new URL("../../../", import.meta.url);

async function text(relative, base = repoRoot) {
  return readFile(new URL(relative, base), "utf8");
}

test("canonical payment widget and iframe/deploy copies remain identical", async () => {
  const canonical = await text("projects/eviction-prevention-calculator/widgets/income-calculator-widget.html");
  const copies = await Promise.all([
    text("forms-web/public/tools/income-calculator-widget.html"),
    text("forms-web/dist/tools/income-calculator-widget.html"),
    text("projects/eviction-prevention-calculator/deploy/income_calculator_widget.html")
  ]);
  for (const copy of copies) assert.equal(copy, canonical);
  assert.match(canonical, /Hourly work schedule/);
  assert.match(canonical, /CALC_VERSION="4\.0"/);
  assert.match(canonical, /JFCustomWidget/);
  assert.match(canonical, /subscribe\("ready",data=>\{restore\(data\?\.value\)/);
  assert.match(canonical, /sendData\(\{value:summary\}\)/);
  assert.match(canonical, /name="calculationMode"/);
  assert.match(canonical, /name="amiIncomeBasis"/);
  assert.match(canonical, /id="documentationOptions"/);
  assert.match(canonical, /id="showPaystubDetails"/);
  assert.doesNotMatch(canonical, /avoid full name|avoid employer/i);
});

test("public builds retain calculations but remove integration and persistence code", async () => {
  const income = await text("public/income.html", projectRoot);
  const ami = await text("public/ami.html", projectRoot);
  for (const html of [income, ami]) {
    assert.doesNotMatch(html, /JFCustomWidget|js\.jotform\.com/);
    assert.doesNotMatch(html, /localStorage|sessionStorage|indexedDB|document\.cookie/);
    assert.doesNotMatch(html, /location\.search|URLSearchParams\s*\(\s*location\.search/);
  }
  assert.match(income, /Hourly work schedule/);
  assert.match(income, /calculateHourly/);
  assert.match(income, /name="calculationMode"/);
  assert.match(income, /name="amiIncomeBasis"/);
  assert.match(income, /id="documentationOptions"/);
  assert.doesNotMatch(income, /avoid full name|avoid employer/i);
});

test("all generated inline calculator scripts parse", async () => {
  for (const path of ["public/ami.html", "public/income.html"]) {
    const html = await text(path, projectRoot);
    const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
      .map(match => match[1])
      .filter(Boolean);
    assert.ok(scripts.length > 0);
    for (const source of scripts) assert.doesNotThrow(() => new Function(source));
  }
});

test("every deployed Jotform calculator restores its saved value on reopen", async () => {
  const paths = [
    "projects/eviction-prevention-calculator/widgets/ami-widget.html",
    "projects/eviction-prevention-calculator/widgets/fmr-widget.html",
    "projects/eviction-prevention-calculator/widgets/esg-asset-limit-widget.html",
    "projects/eviction-prevention-calculator/widgets/income-calculator-widget.html",
    "projects/eviction-prevention-calculator/deploy/AMI_calculator.html",
    "projects/eviction-prevention-calculator/deploy/fmr_widget.html",
    "projects/eviction-prevention-calculator/deploy/income_calculator_widget.html"
  ];
  for (const path of paths) {
    const html = await text(path);
    assert.match(html, /function restore\(value\)/, `${path} must define saved-value hydration`);
    assert.match(html, /subscribe\("ready",data=>\{[^]*restore\(data\?\.value\)[^]*jfReady=true/, `${path} must hydrate before publishing`);
    assert.match(html, /sendData\(\{value:(?:summary|submitString)\}\)/, `${path} must use the Jotform data envelope`);
  }
});

test("all canonical and deployment widget scripts parse", async () => {
  const paths = [
    "projects/eviction-prevention-calculator/widgets/ami-widget.html",
    "projects/eviction-prevention-calculator/widgets/fmr-widget.html",
    "projects/eviction-prevention-calculator/widgets/esg-asset-limit-widget.html",
    "projects/eviction-prevention-calculator/widgets/income-calculator-widget.html",
    "projects/eviction-prevention-calculator/deploy/AMI_calculator.html",
    "projects/eviction-prevention-calculator/deploy/fmr_widget.html"
  ];
  for (const path of paths) {
    const html = await text(path);
    const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
      .map(match => match[1])
      .filter(Boolean);
    for (const source of scripts) assert.doesNotThrow(() => new Function(source), path);
  }
});
