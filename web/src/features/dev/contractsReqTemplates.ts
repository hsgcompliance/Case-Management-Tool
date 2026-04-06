"use client";

import * as Contracts from "@hdb/contracts";
import type { ReqOf } from "@hdb/contracts";
import type { StrictEndpointName } from "@client/api";

type ZodLike = {
  safeParse?: (input: unknown) => { success: boolean; data?: unknown };
  _def?: Record<string, unknown>;
  shape?: Record<string, unknown> | (() => Record<string, unknown>);
  options?: unknown[];
};

type ContractsNamespaceKey =
  | "assessments"
  | "customers"
  | "creditCards"
  | "enrollments"
  | "gdrive"
  | "grants"
  | "inbox"
  | "jotform"
  | "ledger"
  | "payments"
  | "tasks"
  | "tours"
  | "users";

type SchemaRef = { ns: ContractsNamespaceKey; exportName: string };

type TemplateMeta<N extends StrictEndpointName> = {
  payload: ReqOf<N> | Record<string, unknown>;
  sourceLabel: string;
};

const contractNamespaces: Record<ContractsNamespaceKey, Record<string, unknown>> = {
  assessments: Contracts.assessments as Record<string, unknown>,
  customers: Contracts.customers as Record<string, unknown>,
  creditCards: Contracts.creditCards as Record<string, unknown>,
  enrollments: Contracts.enrollments as Record<string, unknown>,
  gdrive: Contracts.gdrive as Record<string, unknown>,
  grants: Contracts.grants as Record<string, unknown>,
  inbox: Contracts.inbox as Record<string, unknown>,
  jotform: Contracts.jotform as Record<string, unknown>,
  ledger: Contracts.ledger as Record<string, unknown>,
  payments: Contracts.payments as Record<string, unknown>,
  tasks: Contracts.tasks as Record<string, unknown>,
  tours: Contracts.tours as Record<string, unknown>,
  users: Contracts.users as Record<string, unknown>,
};

const noReqEndpoints = new Set<StrictEndpointName>([
  "usersMe",
  "creditCardsStructure",
  "grantsStructure",
  "jotformSubmissionsStructure",
  "toursStructure",
  "health",
]);

const schemaOverrides: Partial<Record<StrictEndpointName, SchemaRef | null>> = {
  usersCreate: { ns: "users", exportName: "CreateUserBody" },
  usersInvite: { ns: "users", exportName: "InviteUserBody" },
  usersSetRole: { ns: "users", exportName: "SetRoleBody" },
  usersSetActive: { ns: "users", exportName: "SetActiveBody" },
  usersRevokeSessions: { ns: "users", exportName: "RevokeSessionsBody" },
  usersList: { ns: "users", exportName: "ListUsersBody" },
  devOrgsList: { ns: "users", exportName: "OrgManagerListOrgsBody" },
  devOrgsUpsert: { ns: "users", exportName: "OrgManagerUpsertOrgBody" },
  devOrgsPatchTeams: { ns: "users", exportName: "OrgManagerPatchTeamsBody" },
  usersMe: null,
  usersMeUpdate: { ns: "users", exportName: "UpdateMeBody" },
  devGrantAdmin: null,

  assessmentTemplatesUpsert: { ns: "assessments", exportName: "AssessmentTemplateUpsertBody" },
  assessmentTemplatesGet: { ns: "assessments", exportName: "GetTemplateBody" },
  assessmentTemplatesList: { ns: "assessments", exportName: "ListTemplatesBody" },
  assessmentTemplatesDelete: { ns: "assessments", exportName: "DeleteTemplateBody" },
  assessmentSubmit: { ns: "assessments", exportName: "SubmitAssessmentBody" },
  assessmentSubmissionGet: { ns: "assessments", exportName: "GetSubmissionBody" },
  assessmentSubmissionsList: { ns: "assessments", exportName: "ListSubmissionsBody" },
  assessmentTemplateRecalc: { ns: "assessments", exportName: "RecalcTemplateBody" },

  customersBackfillNames: { ns: "customers", exportName: "CustomersBackfillNamesBody" },
  customersBackfillCaseManagerNames: { ns: "customers", exportName: "CustomersBackfillCaseManagerNamesBody" },
  customersBackfillAssistanceLength: { ns: "customers", exportName: "CustomersBackfillAssistanceLengthBody" },
  enrollmentsBackfillNames: { ns: "enrollments", exportName: "EnrollmentsBackfillNamesBody" },

  createSession: null,

  jotformSyncSubmissions: { ns: "jotform", exportName: "JotformSyncBody" },
};

function isZodSchema(value: unknown): value is ZodLike {
  return !!value && typeof value === "object" && typeof (value as ZodLike).safeParse === "function";
}

function normalizeToken(v: string) {
  return v.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function toPascalCase(v: string) {
  return v.replace(/(^|[^a-zA-Z0-9]+)([a-zA-Z0-9])/g, (_, _sep, c: string) => c.toUpperCase());
}

function endpointNamespace(endpoint: StrictEndpointName): ContractsNamespaceKey | null {
  if (endpoint.startsWith("assessment")) return "assessments";
  if (endpoint.startsWith("customers")) return "customers";
  if (endpoint.startsWith("creditCards")) return "creditCards";
  if (endpoint.startsWith("enrollments") || endpoint.startsWith("enrollment")) return "enrollments";
  if (endpoint.startsWith("gdrive")) return "gdrive";
  if (endpoint.startsWith("grants")) return "grants";
  if (endpoint.startsWith("inbox")) return "inbox";
  if (endpoint.startsWith("jotform")) return "jotform";
  if (endpoint.startsWith("ledger")) return "ledger";
  if (endpoint.startsWith("payments")) return "payments";
  if (endpoint.startsWith("tasks")) return "tasks";
  if (endpoint.startsWith("tours")) return "tours";
  if (endpoint.startsWith("users") || endpoint === "devGrantAdmin") return "users";
  return null;
}

function guessSchemaRef(endpoint: StrictEndpointName): SchemaRef | null {
  if (endpoint in schemaOverrides) return schemaOverrides[endpoint] ?? null;
  if (noReqEndpoints.has(endpoint)) return null;

  const ns = endpointNamespace(endpoint);
  if (!ns) return null;

  const exportsObj = contractNamespaces[ns];
  const endpointNorm = normalizeToken(endpoint);
  const pascal = toPascalCase(endpoint);
  const suffixes = ["Body", "Query", "Req", "Params"];
  const exactCandidates = suffixes.map((suffix) => `${pascal}${suffix}`);

  for (const exportName of exactCandidates) {
    if (isZodSchema(exportsObj[exportName])) return { ns, exportName };
  }

  const zodExports = Object.entries(exportsObj)
    .filter(([, value]) => isZodSchema(value))
    .map(([exportName]) => exportName);

  const prioritized = zodExports
    .filter((exportName) => /(?:Body|Query|Req|Params)$/.test(exportName))
    .filter((exportName) => scoreCandidate(endpointNorm, exportName) < 99)
    .sort((a, b) => scoreCandidate(endpointNorm, a) - scoreCandidate(endpointNorm, b));

  const best = prioritized[0];
  return best ? { ns, exportName: best } : null;
}

function scoreCandidate(endpointNorm: string, exportName: string) {
  const n = normalizeToken(exportName);
  if (n.startsWith(endpointNorm)) return 0;
  if (n.includes(endpointNorm)) return 1;
  const stem = endpointNorm.replace(/^(assessment|customers|enrollments|enrollment|grants|jotform|payments|tasks|inbox|gdrive|ledger|users|tours)/, "");
  if (stem && n.includes(stem)) return 2;
  return 99;
}

function tryWithDefaults(schema: ZodLike): unknown | undefined {
  try {
    const a = schema.safeParse?.(undefined);
    if (a?.success) return a.data;
  } catch {
    // fall through
  }
  try {
    const b = schema.safeParse?.({});
    if (b?.success) return b.data;
  } catch {
    // fall through
  }
  return undefined;
}

function schemaToTemplate(schema: ZodLike, seen = new WeakSet<object>()): unknown {
  if (!schema || typeof schema !== "object") return null;
  if (seen.has(schema as object)) return null;
  seen.add(schema as object);

  try {
    const withDefaults = tryWithDefaults(schema);
    if (withDefaults !== undefined) return withDefaults;

    const def = schema._def || {};
    const t = String(def.type || "");

    if (t === "optional" || t === "nullable" || t === "default" || t === "readonly" || t === "catch") {
      return schemaToTemplate(def.innerType as ZodLike, seen);
    }

    if (t === "pipe") {
      return schemaToTemplate((def.in || def.out) as ZodLike, seen);
    }

    if (t === "object") {
      const rawShape = typeof schema.shape === "function" ? schema.shape() : schema.shape || def.shape || {};
      const shape = typeof rawShape === "function" ? rawShape() : rawShape;
      const out: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(shape || {})) {
        out[key] = schemaToTemplate(child as ZodLike, seen);
      }
      return out;
    }

    if (t === "array") {
      return [];
    }

    if (t === "union") {
      const options = Array.isArray(def.options) ? (def.options as ZodLike[]) : [];
      const preferred =
        options.find((o) => String(o?._def?.type || "") === "object") ||
        options.find((o) => String(o?._def?.type || "") === "array") ||
        options[0];
      return preferred ? schemaToTemplate(preferred, seen) : null;
    }

    if (t === "intersection") {
      const left = schemaToTemplate(def.left as ZodLike, seen);
      const right = schemaToTemplate(def.right as ZodLike, seen);
      if (left && right && typeof left === "object" && typeof right === "object" && !Array.isArray(left) && !Array.isArray(right)) {
        return { ...(left as Record<string, unknown>), ...(right as Record<string, unknown>) };
      }
      return left ?? right ?? null;
    }

    if (t === "tuple") {
      const items = Array.isArray(def.items) ? (def.items as ZodLike[]) : [];
      return items.map((item) => schemaToTemplate(item, seen));
    }

    if (t === "record" || t === "map" || t === "set") {
      return t === "set" ? [] : {};
    }

    if (t === "enum") {
      const options = (schema as { options?: unknown[] }).options;
      return Array.isArray(options) ? options[0] ?? "" : "";
    }

    if (t === "literal") {
      const literalDef = def as { values?: unknown[]; value?: unknown };
      return Array.isArray(literalDef.values) ? literalDef.values[0] : literalDef.value ?? null;
    }

    if (t === "string") return "";
    if (t === "number") return 0;
    if (t === "boolean") return false;
    if (t === "bigint") return 0;
    if (t === "date") return new Date().toISOString();
    if (t === "null") return null;

    return null;
  } finally {
    seen.delete(schema as object);
  }
}

export function getReqTemplateForEndpoint<N extends StrictEndpointName>(endpoint: N): TemplateMeta<N> {
  const ref = guessSchemaRef(endpoint);
  if (!ref) {
    return {
      payload: {} as ReqOf<N>,
      sourceLabel: noReqEndpoints.has(endpoint)
        ? "No request payload (void req in contracts)"
        : "No runtime req schema mapped; using empty object typed as ReqOf<>",
    };
  }

  const schema = contractNamespaces[ref.ns][ref.exportName];
  if (!isZodSchema(schema)) {
    return {
      payload: {} as ReqOf<N>,
      sourceLabel: `Missing schema export ${ref.ns}.${ref.exportName}; using empty object`,
    };
  }

  const payload = schemaToTemplate(schema) ?? {};
  return {
    payload: payload as ReqOf<N>,
    sourceLabel: `contracts.${ref.ns}.${ref.exportName}`,
  };
}
