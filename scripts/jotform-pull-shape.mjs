#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const JOTFORM_API = process.env.JOTFORM_API || "https://api.jotform.com";
const JOTFORM_API_KEY =
  String(process.env.JOTFORM_API_KEY_SECRET || "").trim() ||
  String(process.env.JOTFORM_API_KEY || "").trim();

function arg(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.slice(2).find((item) => item.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

function requiredArg(name) {
  const value = arg(name);
  if (!value) throw new Error(`Missing --${name}=...`);
  return value;
}

async function jotformFetch(apiPath, params = {}) {
  if (!JOTFORM_API_KEY) {
    throw new Error("Missing JOTFORM_API_KEY_SECRET or JOTFORM_API_KEY in environment.");
  }
  const url = new URL(apiPath, JOTFORM_API);
  url.searchParams.set("apiKey", JOTFORM_API_KEY);
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== "") url.searchParams.set(key, String(value));
  }
  const res = await fetch(url);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  if (!res.ok || Number(json?.responseCode) !== 200) {
    throw new Error(`Jotform API error ${res.status}: ${json?.message || text.slice(0, 240)}`);
  }
  return json?.content ?? null;
}

function kind(value) {
  if (value == null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return `object:${Object.keys(value).sort().join(",")}`;
  return typeof value;
}

function answerEntry(answers, key) {
  return answers && typeof answers === "object" ? answers[String(key)] || null : null;
}

function parseOptions(raw) {
  if (raw == null || raw === "") return [];
  if (Array.isArray(raw)) {
    return raw.map((value) => String(value || "").trim()).filter(Boolean);
  }
  if (typeof raw === "object") {
    return Object.values(raw).map((value) => String(value || "").trim()).filter(Boolean);
  }
  return String(raw)
    .split("|")
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeQuestion(key, question, answers) {
  const q = question && typeof question === "object" ? question : {};
  const answer = answerEntry(answers, key);
  const answerObj = answer && typeof answer === "object" ? answer : {};
  const options = parseOptions(q.options);
  const calculation = q.calculation || q.calc || null;

  return {
    key: String(key),
    qid: String(q.qid || q.id || ""),
    order: Number.isFinite(Number(q.order)) ? Number(q.order) : null,
    type: String(q.type || ""),
    name: String(q.name || ""),
    text: q.text ?? null,
    required: q.required ?? null,
    hidden: q.hidden ?? null,
    readonly: q.readonly ?? null,
    hasAnswer: !!answer,
    answerKind: kind(answerObj.answer),
    prettyFormatKind: kind(answerObj.prettyFormat),
    ...(options.length ? { options } : {}),
    ...(calculation ? { calculation } : {}),
  };
}

async function main() {
  const formId = requiredArg("formId");
  const slug = arg("slug", formId);
  const name = arg("name", slug);
  const out = arg("out", path.join("artifacts", "jotform-shapes", `${slug}-${formId}.shape.json`));

  const [questionsContent, submissionsContent] = await Promise.all([
    jotformFetch(`/form/${formId}/questions`),
    jotformFetch(`/form/${formId}/submissions`, { limit: 1, offset: 0 }),
  ]);

  const questions = questionsContent && typeof questionsContent === "object" ? questionsContent : {};
  const submissions = Array.isArray(submissionsContent) ? submissionsContent : [];
  const sample = submissions[0] || {};
  const answers = sample.answers || {};

  const fields = Object.entries(questions)
    .map(([key, question]) => normalizeQuestion(key, question, answers))
    .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));

  const shape = {
    form: { slug, name, id: formId },
    fetchedAt: new Date().toISOString(),
    source: {
      questionsEndpoint: `/form/${formId}/questions`,
      submissionsEndpoint: `/form/${formId}/submissions?limit=1`,
    },
    submission: {
      id: String(sample.id || sample.submission_id || ""),
      form_id: String(sample.form_id || formId),
      status: String(sample.status || ""),
      created_at: sample.created_at ?? null,
      updated_at: sample.updated_at ?? null,
      answerCount: answers && typeof answers === "object" ? Object.keys(answers).length : 0,
    },
    fields,
  };

  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.writeFile(out, `${JSON.stringify(shape, null, 2)}\n`);
  console.log(JSON.stringify({
    ok: true,
    out,
    formId,
    fields: fields.length,
    fieldsWithOptions: fields.filter((field) => Array.isArray(field.options) && field.options.length).length,
  }, null, 2));
}

main().catch((err) => {
  console.error(err?.stack || err?.message || err);
  process.exit(1);
});
