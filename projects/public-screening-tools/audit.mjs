import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";

const root = new URL(".", import.meta.url);
const publicDir = new URL("public/", root);
const failures = [];

for (const name of await readdir(publicDir)) {
  if (!name.endsWith(".html")) continue;
  const html = await readFile(new URL(name, publicDir), "utf8");
  const forbidden = [
    ["Jotform runtime", /js\.jotform\.com|JFCustomWidget/i],
    ["network request", /\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket\s*\(/i],
    ["browser persistence", /localStorage|sessionStorage|indexedDB|document\.cookie/i],
    ["sensitive URL prefill", /URLSearchParams\s*\(\s*location\.search|location\.search/i],
    ["analytics", /google-analytics|googletagmanager|gtag\s*\(|segment\.com|mixpanel/i]
  ];
  for (const [label, pattern] of forbidden) {
    if (pattern.test(html)) failures.push(`${name}: contains ${label}`);
  }
  for (const match of html.matchAll(/<(?:script|link|img|iframe)[^>]+(?:src|href)="([^"]+)"/gi)) {
    if (/^https?:\/\//i.test(match[1])) failures.push(`${name}: remote dependency ${match[1]}`);
  }
  if (!html.includes('meta name="referrer" content="no-referrer"')) failures.push(`${name}: missing no-referrer metadata`);
}

const firebase = JSON.parse(await readFile(new URL("firebase.json", root), "utf8"));
const headers = firebase.hosting.headers?.flatMap(rule => rule.headers ?? []) ?? [];
const headerMap = new Map(headers.map(header => [header.key.toLowerCase(), header.value]));
for (const required of ["content-security-policy", "referrer-policy", "x-content-type-options", "permissions-policy"]) {
  if (!headerMap.has(required)) failures.push(`firebase.json: missing ${required}`);
}
const csp = headerMap.get("content-security-policy") ?? "";
for (const directive of ["connect-src 'none'", "object-src 'none'", "form-action 'none'", "frame-ancestors 'self' https://thehrdc.org https://www.thehrdc.org"]) {
  if (!csp.includes(directive)) failures.push(`firebase.json: CSP missing ${directive}`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Privacy/security audit passed: no remote runtime, network requests, persistence, analytics, or URL prefill.");
}
