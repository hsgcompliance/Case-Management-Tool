(function () {
  "use strict";

  const Calc = window.EPCalculator;
  const STORAGE_KEY = "hrdc-eviction-prevention-calculator-v1";
  let saveTimer = null;
  let state = loadState() || createDefaultState();
  let lastSavedState = JSON.stringify(state);

  const elements = {};
  const ids = [
    "caseReference", "county", "householdSize", "asOfDate", "incomeMethod", "otherIncome",
    "otherIncomeNote", "unitSize", "requestedAssistance", "housingNote", "preparedBy",
    "reviewDate", "calculationNotes", "sources", "sourceTemplate", "stubTemplate", "saveStatus"
  ];
  ids.forEach(id => elements[id] = document.getElementById(id));

  function localToday() {
    const date = new Date();
    const offset = date.getTimezoneOffset() * 60 * 1000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 10);
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function emptyStub(overrides) {
    return Object.assign({ id: uid("stub"), workStart: "", workEnd: "", payDate: "", gross: "", note: "" }, overrides || {});
  }

  function emptySource(overrides) {
    return Object.assign({
      id: uid("source"),
      person: "",
      employer: "",
      frequency: "biweekly",
      stubs: [emptyStub(), emptyStub()]
    }, overrides || {});
  }

  function createDefaultState() {
    const today = localToday();
    return {
      version: 1,
      caseReference: "",
      county: "",
      householdSize: "",
      asOfDate: today,
      incomeMethod: "earned",
      sources: [emptySource()],
      otherIncome: "",
      otherIncomeNote: "",
      unitSize: "",
      requestedAssistance: "",
      housingNote: "",
      preparedBy: "",
      reviewDate: today,
      calculationNotes: ""
    };
  }

  function sanitizeLoadedState(candidate) {
    if (!candidate || typeof candidate !== "object") return null;
    const base = createDefaultState();
    const merged = Object.assign(base, candidate);
    merged.sources = Array.isArray(candidate.sources) && candidate.sources.length
      ? candidate.sources.map(source => Object.assign(emptySource(), source, {
          id: source.id || uid("source"),
          stubs: Array.isArray(source.stubs) && source.stubs.length
            ? source.stubs.map(stub => Object.assign(emptyStub(), stub, { id: stub.id || uid("stub") }))
            : [emptyStub()]
        }))
      : [emptySource()];
    return merged;
  }

  function loadState() {
    try {
      return sanitizeLoadedState(JSON.parse(localStorage.getItem(STORAGE_KEY)));
    } catch (_) {
      return null;
    }
  }

  function persistState() {
    const serialized = JSON.stringify(state);
    if (serialized === lastSavedState) {
      elements.saveStatus.textContent = "Saved locally";
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, serialized);
      lastSavedState = serialized;
      elements.saveStatus.textContent = "Saved locally";
    } catch (_) {
      elements.saveStatus.textContent = "Local save unavailable";
    }
  }

  function scheduleSave() {
    if (JSON.stringify(state) === lastSavedState) return;
    elements.saveStatus.textContent = "Saving…";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persistState, 250);
  }

  function money(value, decimals) {
    if (value == null || !Number.isFinite(Number(value))) return "—";
    return Number(value).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: decimals == null ? 2 : decimals,
      maximumFractionDigits: decimals == null ? 2 : decimals
    });
  }

  function dateLabel(value) {
    const date = Calc.parseDate(value);
    if (!date) return "—";
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function fillStaticFields() {
    Object.keys(Calc.AMI_TABLE).forEach(county => {
      const option = document.createElement("option");
      option.value = county;
      option.textContent = county;
      elements.county.appendChild(option);
    });
    [
      "caseReference", "county", "householdSize", "asOfDate", "incomeMethod", "otherIncome",
      "otherIncomeNote", "unitSize", "requestedAssistance", "housingNote", "preparedBy",
      "reviewDate", "calculationNotes"
    ].forEach(key => {
      elements[key].value = state[key] == null ? "" : state[key];
      elements[key].addEventListener("input", event => {
        state[key] = event.target.value;
        update();
      });
    });
  }

  function renderSources() {
    elements.sources.innerHTML = "";
    state.sources.forEach((source, sourceIndex) => {
      const fragment = elements.sourceTemplate.content.cloneNode(true);
      const article = fragment.querySelector(".income-source");
      article.dataset.sourceId = source.id;
      fragment.querySelector(".source-title").textContent = source.person || source.employer || `Employment income ${sourceIndex + 1}`;
      fragment.querySelector(".remove-source").hidden = state.sources.length === 1;

      fragment.querySelectorAll("[data-field]").forEach(input => {
        const field = input.dataset.field;
        input.value = source[field] || "";
        input.addEventListener("input", event => {
          source[field] = event.target.value;
          const title = article.querySelector(".source-title");
          title.textContent = source.person || source.employer || `Employment income ${sourceIndex + 1}`;
          update(false);
        });
      });

      const rows = fragment.querySelector(".stub-rows");
      source.stubs.forEach(stub => rows.appendChild(buildStubRow(source, stub)));
      fragment.querySelector(".add-stub").addEventListener("click", () => {
        source.stubs.push(emptyStub());
        renderSources();
        update(false);
      });
      fragment.querySelector(".remove-source").addEventListener("click", () => {
        state.sources = state.sources.filter(item => item.id !== source.id);
        renderSources();
        update(false);
      });
      elements.sources.appendChild(fragment);
    });
  }

  function buildStubRow(source, stub) {
    const fragment = elements.stubTemplate.content.cloneNode(true);
    const row = fragment.querySelector(".stub-row");
    row.dataset.stubId = stub.id;
    fragment.querySelectorAll("[data-stub-field]").forEach(input => {
      const field = input.dataset.stubField;
      input.value = stub[field] == null ? "" : stub[field];
      input.addEventListener("input", event => {
        stub[field] = event.target.value;
        update(false);
      });
    });
    fragment.querySelector(".remove-stub").addEventListener("click", () => {
      source.stubs = source.stubs.filter(item => item.id !== stub.id);
      if (!source.stubs.length) source.stubs.push(emptyStub());
      renderSources();
      update(false);
    });
    return fragment;
  }

  function renderCoverage(result) {
    result.sourceResults.forEach(sourceResult => {
      const article = elements.sources.querySelector(`[data-source-id="${sourceResult.source.id}"]`);
      if (!article) return;
      const note = article.querySelector(".coverage-note");
      const frequency = sourceResult.frequency;
      const count = sourceResult.primaryCount;
      const enough = count >= frequency.minimum;
      note.className = `coverage-note ${enough ? "good" : "warn"}`;
      note.textContent = enough
        ? `${count} qualifying paystub${count === 1 ? "" : "s"} entered. Typical ${frequency.label} coverage is ${frequency.expected}.`
        : `${count} qualifying paystub${count === 1 ? "" : "s"} entered. Collect all pay covering the period—typically ${frequency.expected} for ${frequency.label} pay.`;
    });
  }

  function renderPeriod(result) {
    document.getElementById("periodLabel").textContent = result.period.start
      ? `${dateLabel(result.period.startISO)} – ${dateLabel(result.period.endISO)}`
      : "Choose an as-of date";
    const earned = state.incomeMethod === "earned";
    document.getElementById("methodTitle").textContent = earned ? "Earned method" : "Received method";
    document.getElementById("methodDescription").textContent = earned
      ? "Allocates each check to the work-period days that overlap the 30-day window."
      : "Counts the full gross amount of each check with a pay date inside the 30-day window.";
  }

  function renderIncomeResults(result) {
    document.getElementById("primaryIncomeResult").textContent = money(result.primaryTotal);
    document.getElementById("primaryMethodResult").textContent = state.incomeMethod === "earned"
      ? "Earned during period"
      : "Received during period";
    document.getElementById("receivedIncomeResult").textContent = money(result.receivedTotal);
    document.getElementById("earnedIncomeResult").textContent = money(result.earnedTotal);
    document.getElementById("annualIncomeResult").textContent = money(result.estimatedAnnual);
  }

  function renderAmi(result) {
    const percentElement = document.getElementById("amiPercent");
    const status = document.getElementById("amiStatus");
    const fill = document.getElementById("amiMeterFill");
    if (!result.ami) {
      percentElement.textContent = "—";
      status.className = "status neutral";
      status.textContent = "Select county and household size";
      fill.style.width = "0";
      ["30", "50", "60", "80", "100"].forEach(level => document.getElementById(`ami${level}`).textContent = "—");
      document.getElementById("ami30Difference").textContent = "—";
      return;
    }

    percentElement.textContent = `${result.amiPercent.toFixed(1)}%`;
    fill.style.width = `${Math.min(Math.max(result.amiPercent, 0), 100)}%`;
    fill.style.background = result.isAtOrBelow30 ? "var(--green)" : result.amiPercent <= 80 ? "var(--gold)" : "var(--red)";
    status.className = `status ${result.isAtOrBelow30 ? "pass" : "fail"}`;
    status.textContent = result.isAtOrBelow30 ? "At or below 30% AMI" : "Above 30% AMI";
    ["30", "50", "60", "80", "100"].forEach(level => {
      document.getElementById(`ami${level}`).textContent = money(result.ami[level], 0);
    });
    const difference = result.ami[30] - result.primaryTotal;
    document.getElementById("ami30Difference").textContent = difference >= 0
      ? `${money(difference)} below`
      : `${money(Math.abs(difference))} over`;
  }

  function renderHousing(result) {
    document.getElementById("fmrResult").textContent = money(result.fmr, 0);
    document.getElementById("esgLimitResult").textContent = money(result.esgLimit, 0);
    document.getElementById("fmrContext").textContent = result.fmr == null
      ? "Select county and unit size"
      : `${state.county} County • ${state.unitSize}`;
    document.getElementById("fmrDetailCounty").textContent = state.county || "—";
    document.getElementById("fmrDetailSize").textContent = state.unitSize || "—";
    document.getElementById("fmrDetailValue").textContent = money(result.fmr, 0);
    document.getElementById("esgDetailFmr").textContent = money(result.fmr, 0);
    document.getElementById("esgDetailEighty").textContent = result.fmr == null ? "—" : money(result.fmr * 0.8, 2);
    document.getElementById("esgDetailLimit").textContent = money(result.esgLimit, 0);
    document.getElementById("esgFormula").textContent = result.fmr == null
      ? "2 × 80% × FMR = —"
      : `2 × 80% × ${money(result.fmr, 0)} = ${money(result.esgLimit, 0)}`;
    document.querySelectorAll("[data-copy-result]").forEach(button => {
      const value = button.dataset.copyResult === "fmr" ? result.fmr : result.esgLimit;
      button.disabled = value == null;
      button.dataset.copyValue = value == null ? "" : String(value);
    });
    const review = document.getElementById("assistanceReview");
    const difference = document.getElementById("assistanceDifference");
    if (result.requestedAssistance == null || result.esgLimit == null) {
      review.textContent = "—";
      difference.textContent = result.esgLimit == null ? "Select county and unit size" : "Enter an amount to compare";
      return;
    }
    const gap = result.esgLimit - result.requestedAssistance;
    review.textContent = result.isWithinEsgLimit ? "Within limit" : "Over limit";
    review.style.color = result.isWithinEsgLimit ? "var(--green)" : "var(--red)";
    difference.textContent = result.isWithinEsgLimit
      ? `${money(gap)} remaining`
      : `${money(Math.abs(gap))} over the limit`;
  }

  function sourceNarrative(sourceResult, result) {
    const source = sourceResult.source;
    const name = [source.person, source.employer].filter(Boolean).join(" / ") || "Unnamed income source";
    const qualifying = sourceResult.stubResults
      .map((stubResult, index) => ({ stubResult, stub: source.stubs[index] }))
      .filter(item => state.incomeMethod === "received" ? item.stubResult.receivedAmount > 0 : item.stubResult.earnedAmount > 0);

    const details = qualifying.map(item => {
      const stub = item.stub;
      const calc = item.stubResult;
      if (state.incomeMethod === "received") {
        return `${dateLabel(stub.payDate)} pay date: ${money(calc.gross)} gross${stub.note ? ` (${escapeHtml(stub.note)})` : ""}`;
      }
      if (calc.hasValidWorkPeriod) {
        return `${dateLabel(stub.workStart)}–${dateLabel(stub.workEnd)}: ${money(calc.gross)} × ${calc.overlapDays}/${calc.workDays} days = ${money(calc.earnedAmount)}${stub.note ? ` (${escapeHtml(stub.note)})` : ""}`;
      }
      return `${dateLabel(stub.payDate)} pay date: ${money(calc.gross)} fallback because work dates were unavailable`;
    });

    const total = qualifying.reduce((sum, item) => sum + (
      state.incomeMethod === "received" ? item.stubResult.receivedAmount : item.stubResult.earnedAmount
    ), 0);
    return `<li><strong>${escapeHtml(name)}</strong> (${sourceResult.frequency.label}): ${sourceResult.primaryCount} qualifying stub${sourceResult.primaryCount === 1 ? "" : "s"}, ${money(total)} counted.${details.length ? `<ul>${details.map(detail => `<li>${detail}</li>`).join("")}</ul>` : ""}</li>`;
  }

  function renderDocumentation(result) {
    const warnings = document.getElementById("warnings");
    warnings.innerHTML = result.warnings.map(message => `<div class="warning">${escapeHtml(message)}</div>`).join("");
    const methodName = state.incomeMethod === "earned" ? "earned-during-period" : "pay-date received";
    const amiText = result.ami
      ? `${money(result.primaryTotal)} ÷ ${money(result.ami100, 0)} = ${result.amiPercent.toFixed(1)}% AMI. The 30% monthly threshold is ${money(result.ami[30], 0)}; household income is ${result.isAtOrBelow30 ? "at or below" : "above"} that threshold.`
      : "AMI cannot be calculated until county and household size are selected.";
    const housingText = result.fmr == null
      ? "FMR and ESG assistance limit are pending county and unit-size selection."
      : `${state.county} County ${state.unitSize} FMR is ${money(result.fmr, 0)}. ESG assistance limit = 2 × 80% × ${money(result.fmr, 0)} = ${money(result.esgLimit, 0)}.${result.requestedAssistance == null ? "" : ` Requested assistance of ${money(result.requestedAssistance)} is ${result.isWithinEsgLimit ? "within" : "over"} the calculated limit.`}`;

    document.getElementById("narrative").innerHTML = `
      <h3>${state.caseReference ? `Case ${escapeHtml(state.caseReference)} — ` : ""}Income and eligibility calculation</h3>
      <p><strong>Period and method.</strong> The 30-day calculation period is ${dateLabel(result.period.startISO)} through ${dateLabel(result.period.endISO)}, inclusive. The primary method is <strong>${methodName}</strong>.</p>
      <ul>${result.sourceResults.map(sourceResult => sourceNarrative(sourceResult, result)).join("") || "<li>No employment income source entered.</li>"}</ul>
      <p class="formula">Counted payroll ${money(result.primaryTotal - result.otherIncome)} + other countable income ${money(result.otherIncome)} = 30-day income ${money(result.primaryTotal)}. Estimated annual income = ${money(result.primaryTotal)} × 12 = ${money(result.estimatedAnnual)}.</p>
      <p><strong>AMI.</strong> ${amiText}</p>
      <p><strong>Housing limits.</strong> ${housingText}</p>
      ${state.otherIncomeNote ? `<p><strong>Other income note.</strong> ${escapeHtml(state.otherIncomeNote)}</p>` : ""}
      ${state.housingNote ? `<p><strong>Housing note.</strong> ${escapeHtml(state.housingNote)}</p>` : ""}
    `;
  }

  function plainNarrative(result) {
    const container = document.createElement("div");
    container.innerHTML = document.getElementById("narrative").innerHTML;
    return container.innerText.replace(/\n{3,}/g, "\n\n").trim() +
      (state.calculationNotes ? `\n\nCalculation notes: ${state.calculationNotes}` : "");
  }

  function update(shouldRenderSources) {
    const result = Calc.calculate(state);
    if (shouldRenderSources) renderSources();
    renderPeriod(result);
    renderCoverage(result);
    renderIncomeResults(result);
    renderAmi(result);
    renderHousing(result);
    renderDocumentation(result);
    scheduleSave();
  }

  async function copyText(value, button) {
    if (!value) return;
    const original = button.textContent;
    try {
      await navigator.clipboard.writeText(value);
      button.textContent = "Copied";
    } catch (_) {
      const input = document.createElement("textarea");
      input.value = value;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
      button.textContent = "Copied";
    }
    setTimeout(() => button.textContent = original, 1000);
  }

  function exportFormattedWorksheetPDF() {
    const result = Calc.calculate(state);
    const report = window.open("", "_blank", "width=950,height=900");
    if (!report) {
      window.alert("Allow pop-ups to export the formatted PDF.");
      return;
    }
    const paystubRows = result.sourceResults.flatMap((sourceResult, sourceIndex) =>
      sourceResult.source.stubs
        .map((stub, stubIndex) => ({ sourceResult, sourceIndex, stub, calculation: sourceResult.stubResults[stubIndex] }))
        .filter(item => item.calculation.gross > 0)
    ).map(item => `
      <tr>
        <td>${escapeHtml(item.sourceResult.source.person || `Source ${item.sourceIndex + 1}`)}</td>
        <td>${escapeHtml(item.sourceResult.source.employer || "—")}</td>
        <td>${escapeHtml(item.sourceResult.frequency.label)}</td>
        <td>${escapeHtml(item.stub.workStart || "—")} – ${escapeHtml(item.stub.workEnd || "—")}</td>
        <td>${escapeHtml(item.stub.payDate || "—")}</td>
        <td class="num">${money(item.calculation.gross)}</td>
        <td class="num">${money(state.incomeMethod === "received" ? item.calculation.receivedAmount : item.calculation.earnedAmount)}</td>
        <td>${escapeHtml(item.stub.note || "—")}</td>
      </tr>
    `).join("");
    const warnings = result.warnings.length
      ? `<ul>${result.warnings.map(warning => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>`
      : "<p>No calculation warnings.</p>";
    const amiSection = result.ami ? `
      <h2>Area Median Income</h2>
      <section class="highlight">
        <strong>${result.amiPercent.toFixed(1)}% of AMI — ${result.isAtOrBelow30 ? "At or below 30% AMI" : "Above 30% AMI"}</strong>
        <p>${money(result.primaryTotal)} monthly income ÷ ${money(result.ami100, 0)} 100% AMI. The 30% monthly threshold is ${money(result.ami[30], 0)}.</p>
      </section>
    ` : "";
    const housingSection = result.fmr == null ? "" : `
      <h2>Housing Limits</h2>
      <section class="cards">
        <div class="card"><span>Monthly FMR</span><strong>${money(result.fmr, 0)}</strong></div>
        <div class="card"><span>ESG asset limit</span><strong>${money(result.esgLimit, 0)}</strong></div>
        <div class="card"><span>Requested assistance</span><strong>${result.requestedAssistance == null ? "—" : money(result.requestedAssistance)}</strong></div>
      </section>
    `;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Eligibility Calculation Report</title><style>
      @page{size:letter;margin:.45in}*{box-sizing:border-box}body{margin:0;color:#17211d;font:10px/1.4 Arial,sans-serif}
      header{padding-bottom:12px;border-bottom:3px solid #146b4a}h1{margin:0;font-size:21px}header p{margin:3px 0 0;color:#66736d}
      h2{margin:15px 0 6px;color:#0e4d36;font-size:13px}.meta,.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:10px}
      .meta div,.card{padding:7px;border:1px solid #d8e1dc;border-radius:5px}.meta span,.card span{display:block;color:#66736d;font-size:7px;font-weight:bold;text-transform:uppercase}
      .card strong{display:block;margin-top:2px;font-size:14px}.primary{color:white;background:#146b4a}.primary span{color:#d7eee3}
      table{width:100%;border-collapse:collapse}th,td{padding:4px;border-bottom:1px solid #d8e1dc;text-align:left;vertical-align:top}th{font-size:7px;text-transform:uppercase}.num{text-align:right}
      .formula,.highlight,.narrative{padding:8px;border-radius:5px}.formula{background:#fff7e5;border:1px solid #ead9b7;font:8px Consolas,monospace}.highlight{background:#e6f4ed}.highlight p{margin:3px 0 0}
      .narrative{white-space:pre-wrap;background:#f5f7f6}.warnings{color:#74480a}footer{margin-top:12px;padding-top:7px;color:#66736d;border-top:1px solid #d8e1dc;font-size:7px}
    </style></head><body>
      <header><h1>Eviction Prevention Eligibility Calculation</h1><p>Formatted calculation report</p></header>
      <section class="meta">
        <div><span>Case reference</span>${escapeHtml(state.caseReference || "Not entered")}</div>
        <div><span>Calculation period</span>${escapeHtml(result.period.startISO || "—")} – ${escapeHtml(result.period.endISO || "—")}</div>
        <div><span>Income method</span>${state.incomeMethod === "earned" ? "Rolling 30-day earned" : "Rolling 30-day received"}</div>
        <div><span>County</span>${escapeHtml(state.county || "Not entered")}</div>
        <div><span>Household size</span>${escapeHtml(state.householdSize || "Not entered")}</div>
        <div><span>Prepared by</span>${escapeHtml(state.preparedBy || "Not entered")}</div>
      </section>
      <section class="cards">
        <div class="card primary"><span>30-day income used</span><strong>${money(result.primaryTotal)}</strong></div>
        <div class="card"><span>Received by pay date</span><strong>${money(result.receivedTotal)}</strong></div>
        <div class="card"><span>Earned by work period</span><strong>${money(result.earnedTotal)}</strong></div>
      </section>
      <h2>Income Calculation</h2>
      <div class="formula">Counted payroll ${money(result.primaryTotal - result.otherIncome)} + other countable income ${money(result.otherIncome)} = ${money(result.primaryTotal)} monthly income used; estimated annual income ${money(result.estimatedAnnual)}.</div>
      <table><thead><tr><th>Member</th><th>Employer</th><th>Frequency</th><th>Work period</th><th>Pay date</th><th class="num">Gross</th><th class="num">Counted</th><th>Note</th></tr></thead><tbody>${paystubRows || '<tr><td colspan="8">No paystubs entered.</td></tr>'}</tbody></table>
      ${amiSection}${housingSection}
      <h2>Warnings and Notes</h2><div class="warnings">${warnings}</div>
      ${state.calculationNotes ? `<p><strong>Calculation notes:</strong> ${escapeHtml(state.calculationNotes)}</p>` : ""}
      <h2>Calculation Narrative</h2><div class="narrative">${escapeHtml(plainNarrative(result))}</div>
      <footer>AMI and FMR matrix version 05-2026. Confirm applicable program rules and source verification before eligibility approval.</footer>
    </body></html>`;
    report.document.open();
    report.document.write(html);
    report.document.close();
    setTimeout(() => {
      report.focus();
      report.print();
    }, 300);
  }

  function bindActions() {
    document.getElementById("addSourceButton").addEventListener("click", () => {
      state.sources.push(emptySource());
      renderSources();
      update(false);
    });
    document.getElementById("printButton").addEventListener("click", exportFormattedWorksheetPDF);
    document.getElementById("resetButton").addEventListener("click", () => {
      if (!window.confirm("Clear this locally saved worksheet and start over?")) return;
      state = createDefaultState();
      hydrate();
    });
    document.getElementById("loadExampleButton").addEventListener("click", loadExample);
    document.querySelectorAll("[data-copy-result]").forEach(button => {
      button.addEventListener("click", () => copyText(button.dataset.copyValue, button));
    });
    document.getElementById("copyNarrativeButton").addEventListener("click", async event => {
      const result = Calc.calculate(state);
      try {
        await navigator.clipboard.writeText(plainNarrative(result));
        const original = event.target.textContent;
        event.target.textContent = "Copied";
        setTimeout(() => event.target.textContent = original, 1200);
      } catch (_) {
        window.prompt("Copy the calculation narrative:", plainNarrative(result));
      }
    });
    document.getElementById("downloadButton").addEventListener("click", () => {
      const result = Calc.calculate(state);
      const payload = {
        exportedAt: new Date().toISOString(),
        worksheet: state,
        calculation: {
          period: { start: result.period.startISO, end: result.period.endISO },
          receivedTotal: result.receivedTotal,
          earnedTotal: result.earnedTotal,
          primaryTotal: result.primaryTotal,
          annualIncome: result.estimatedAnnual,
          amiPercent: result.amiPercent,
          ami30MonthlyLimit: result.ami && result.ami[30],
          fmr: result.fmr,
          esgAssistanceLimit: result.esgLimit,
          warnings: result.warnings
        },
        narrative: plainNarrative(result)
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${state.caseReference || "eligibility-worksheet"}-${state.asOfDate || "undated"}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
    });
  }

  function hydrate() {
    [
      "caseReference", "county", "householdSize", "asOfDate", "incomeMethod", "otherIncome",
      "otherIncomeNote", "unitSize", "requestedAssistance", "housingNote", "preparedBy",
      "reviewDate", "calculationNotes"
    ].forEach(key => elements[key].value = state[key] == null ? "" : state[key]);
    renderSources();
    update(false);
  }

  function loadExample() {
    const asOf = state.asOfDate || localToday();
    state = Object.assign(createDefaultState(), {
      caseReference: "EXAMPLE-001",
      county: "Gallatin",
      householdSize: "2",
      asOfDate: asOf,
      unitSize: "1BR",
      requestedAssistance: "2100",
      sources: [{
        id: uid("source"),
        person: "Household member A",
        employer: "Example employer",
        frequency: "biweekly",
        stubs: [
          emptyStub({ workStart: Calc.toISODate(Calc.addDays(asOf, -35)), workEnd: Calc.toISODate(Calc.addDays(asOf, -22)), payDate: Calc.toISODate(Calc.addDays(asOf, -18)), gross: "920.50", note: "Regular pay" }),
          emptyStub({ workStart: Calc.toISODate(Calc.addDays(asOf, -21)), workEnd: Calc.toISODate(Calc.addDays(asOf, -8)), payDate: Calc.toISODate(Calc.addDays(asOf, -4)), gross: "985.25", note: "Includes overtime" }),
          emptyStub({ workStart: Calc.toISODate(Calc.addDays(asOf, -7)), workEnd: Calc.toISODate(Calc.addDays(asOf, 6)), payDate: Calc.toISODate(Calc.addDays(asOf, 10)), gross: "940.00", note: "Work period crosses as-of date" })
        ]
      }]
    });
    hydrate();
  }

  fillStaticFields();
  bindActions();
  hydrate();
  window.EPApp = {
    getState: () => JSON.parse(JSON.stringify(state)),
    getCalculation: () => Calc.calculate(state)
  };
})();
