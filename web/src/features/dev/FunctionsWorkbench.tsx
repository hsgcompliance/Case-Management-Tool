"use client";

import React from "react";
import Modal from "@entities/ui/Modal";
import api, { endpointsStrict, type StrictEndpointName } from "@client/api";
import { getReqTemplateForEndpoint } from "./contractsReqTemplates";

type EndpointEntry = {
  name: StrictEndpointName;
  method: "GET" | "POST" | "PATCH" | "DELETE" | "OPTIONS";
  path: string;
};

type RunnerState = {
  endpoint: EndpointEntry;
  payloadText: string;
  payloadSource: string;
  responseText: string;
  errorText: string;
};

const endpointEntries = Object.entries(endpointsStrict)
  .map(([name, def]) => ({
    name: name as StrictEndpointName,
    method: def.method,
    path: def.path,
  }))
  .sort((a, b) => a.name.localeCompare(b.name)) satisfies EndpointEntry[];

function groupLabel(name: string) {
  if (name.startsWith("users") || name === "devGrantAdmin") return "Users";
  if (name.startsWith("assessment")) return "Assessments";
  if (name.startsWith("customers")) return "Customers";
  if (name.startsWith("creditCards")) return "Credit Cards";
  if (name.startsWith("enrollments") || name.startsWith("enrollment")) return "Enrollments";
  if (name.startsWith("grants")) return "Grants";
  if (name.startsWith("jotform")) return "Jotform";
  if (name.startsWith("payments")) return "Payments";
  if (name.startsWith("tasks")) return "Tasks";
  if (name.startsWith("inbox")) return "Inbox";
  if (name.startsWith("gdrive")) return "Drive";
  if (name.startsWith("ledger")) return "Ledger";
  if (name.startsWith("tours")) return "Tours";
  return "Misc";
}

function prettyJson(value: unknown) {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return "{}";
  }
}

function parsePayload(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return {};
  return JSON.parse(trimmed);
}

function errorMessage(input: unknown) {
  if (input instanceof Error) return input.message;
  return String(input);
}

export default function FunctionsWorkbench() {
  const [filter, setFilter] = React.useState("");
  const [runner, setRunner] = React.useState<RunnerState | null>(null);
  const [isRunning, setIsRunning] = React.useState(false);

  const filtered = React.useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return endpointEntries;
    return endpointEntries.filter((e) =>
      [e.name, e.method, e.path, groupLabel(e.name)].some((v) => v.toLowerCase().includes(q)),
    );
  }, [filter]);

  const groups = React.useMemo(() => {
    const map = new Map<string, EndpointEntry[]>();
    for (const entry of filtered) {
      const key = groupLabel(entry.name);
      const list = map.get(key) || [];
      list.push(entry);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const openRunner = (endpoint: EndpointEntry) => {
    const template = getReqTemplateForEndpoint(endpoint.name);
    setRunner({
      endpoint,
      payloadText: prettyJson(template.payload),
      payloadSource: template.sourceLabel,
      responseText: "",
      errorText: "",
    });
  };

  const runEndpoint = async () => {
    if (!runner || isRunning) return;
    let parsed: unknown;
    try {
      parsed = parsePayload(runner.payloadText);
    } catch (e: unknown) {
      setRunner((prev) =>
        prev
          ? { ...prev, errorText: `Invalid JSON payload: ${errorMessage(e)}`, responseText: "" }
          : prev,
      );
      return;
    }

    setIsRunning(true);
    setRunner((prev) => (prev ? { ...prev, errorText: "", responseText: "" } : prev));
    try {
      const result =
        runner.endpoint.method === "GET"
          ? await api.call(runner.endpoint.name, { query: parsed as never })
          : await api.call(runner.endpoint.name, { body: parsed as never });

      setRunner((prev) => (prev ? { ...prev, responseText: prettyJson(result), errorText: "" } : prev));
    } catch (e: unknown) {
      const err = e as { message?: unknown; meta?: unknown } | null;
      const details =
        err && typeof err === "object" && "meta" in err && err.meta
          ? { message: errorMessage(err.message), meta: err.meta }
          : { message: errorMessage(e) };
      setRunner((prev) => (prev ? { ...prev, errorText: prettyJson(details), responseText: "" } : prev));
    } finally {
      setIsRunning(false);
    }
  };

  const resetPayload = () => {
    if (!runner) return;
    const template = getReqTemplateForEndpoint(runner.endpoint.name);
    setRunner((prev) =>
      prev
        ? {
            ...prev,
            payloadText: prettyJson(template.payload),
            payloadSource: template.sourceLabel,
          }
        : prev,
    );
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Dev Function Runner</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Open any strict endpoint, inspect/edit a contracts-based request payload, and call it directly.
            </p>
          </div>
          <div className="w-full md:w-80">
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300">Filter endpoints</label>
            <input
              value={filter}
              onChange={(e) => setFilter(e.currentTarget.value)}
              placeholder="payments, usersMe, GET..."
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-0 focus:border-blue-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {groups.map(([label, items]) => (
          <section key={label} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{label}</h2>
              <span className="text-xs text-slate-500 dark:text-slate-400">{items.length}</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((endpoint) => (
                <button
                  key={endpoint.name}
                  type="button"
                  onClick={() => openRunner(endpoint)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-left hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  title={`${endpoint.method} /${endpoint.path}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <code className="truncate text-xs text-slate-800 dark:text-slate-200">{endpoint.name}</code>
                    <span
                      className={[
                        "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold",
                        endpoint.method === "GET"
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                          : endpoint.method === "PATCH"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                          : endpoint.method === "DELETE"
                          ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                          : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
                      ].join(" ")}
                    >
                      {endpoint.method}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">/{endpoint.path}</div>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>

      <Modal
        isOpen={!!runner}
        onClose={() => !isRunning && setRunner(null)}
        disableOverlayClose={isRunning}
        disableEscClose={isRunning}
        widthClass="max-w-6xl"
        title={
          runner ? (
            <div className="flex items-center gap-3">
              <code className="text-sm">{runner.endpoint.name}</code>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">
                {runner.endpoint.method}
              </span>
              <span className="text-xs text-slate-500">/{runner.endpoint.path}</span>
            </div>
          ) : null
        }
        footer={
          <div className="flex w-full items-center justify-between gap-2">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {runner?.payloadSource || ""}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetPayload}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                disabled={!runner || isRunning}
              >
                Reset payload
              </button>
              <button
                type="button"
                onClick={() => setRunner(null)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                disabled={isRunning}
              >
                Close
              </button>
              <button
                type="button"
                onClick={runEndpoint}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                disabled={!runner || isRunning}
              >
                {isRunning ? "Running..." : "Run"}
              </button>
            </div>
          </div>
        }
      >
        {runner ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
                Request payload ({runner.endpoint.method === "GET" ? "query" : "body"})
              </label>
              <textarea
                value={runner.payloadText}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  setRunner((prev) => (prev ? { ...prev, payloadText: value } : prev));
                }}
                className="h-[420px] w-full rounded-md border border-slate-300 bg-white p-3 font-mono text-xs text-slate-900 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                spellCheck={false}
              />
            </div>

            <div className="space-y-3">
              <div>
                <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-300">Response</div>
                <pre className="h-[200px] overflow-auto rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                  {runner.responseText || "(none yet)"}
                </pre>
              </div>

              <div>
                <div className="mb-1 text-xs font-medium text-rose-600 dark:text-rose-300">Error</div>
                <pre className="h-[200px] overflow-auto rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-200">
                  {runner.errorText || "(none)"}
                </pre>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
