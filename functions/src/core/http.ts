// functions/src/core/http.ts
import { onRequest } from "firebase-functions/v2/https";
import type { Request, Response } from "express";
import { RUNTIME, ENFORCE_APP_CHECK } from "./env";
import admin, { authAdmin } from "./admin";
import * as logger from "firebase-functions/logger";
import crypto from "node:crypto";
import { requireCaps, requireLevel, requireVerified } from "./rbac";
import { requireOrg, requireTeams } from "./org";
import { attachAuthContext, AuthedRequest } from "./requestContext";
import { verifyUserFromRequest } from "./auth";

type AuthMode = "public" | "authed" | "user" | "admin" | "dev";
type HttpMethod = "GET" | "POST" | "PATCH" | "OPTIONS" | "DELETE";

type Options = {
  auth?: AuthMode;
  methods?: HttpMethod[];
  secrets?: ReadonlyArray<unknown>;
  appCheck?: boolean;
  requireCaps?: string[];
  requireVerified?: boolean;   // staff-only endpoints
  requireOrg?: boolean;        // enforce orgId presence
  requireTeams?: boolean;      // enforce at least one team (org default counts)
  concurrency?: number;
  minInstances?: number;
  timeoutSeconds?: number;
  memory?: "128MiB" | "256MiB" | "512MiB" | "1GiB" | "2GiB" | "4GiB" | "8GiB" | "16GiB" | "32GiB";
};

const readBoolParam = (s: string | null | undefined) =>
  String(s || "").trim().toLowerCase() === "true";

const IS_EMULATOR =
  process.env.FUNCTIONS_EMULATOR === "true" ||
  !!process.env.FIREBASE_AUTH_EMULATOR_HOST;

function normalizeOrigin(value: string | null | undefined): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw).origin;
  } catch {
    return raw;
  }
}


function allowedOrigins() {
  // Read from process.env directly — functions/.env is bundled at deploy time
  // and is always the source of truth for ALLOWED_ORIGINS.
  const rawOrigins = String(process.env.ALLOWED_ORIGINS || "");
  const out = new Set<string>();

  for (const raw of rawOrigins.split(",")) {
    const origin = raw.trim();
    if (!origin) continue;
    if (origin === "*") { out.add("*"); continue; }
    const normalized = normalizeOrigin(origin);
    if (normalized) out.add(normalized);
  }

  out.add("http://localhost:3000");
  out.add("http://127.0.0.1:3000");

  return out;
}

function setCors(req: Request, res: Response, methods: HttpMethod[]) {
  const allow = allowedOrigins();
  const origin = normalizeOrigin(String(req.headers.origin || ""));
  const allowAnyOrigin = allow.has("*");

  if (origin && (allowAnyOrigin || allow.has(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  }
  res.setHeader(
    "Access-Control-Allow-Headers",
    "authorization, content-type, x-firebase-appcheck, x-correlation-id, idempotency-key"
  );
  res.setHeader("Access-Control-Expose-Headers", "x-correlation-id");
  res.setHeader("Access-Control-Allow-Methods", methods.join(", "));
  res.setHeader("Access-Control-Max-Age", "600");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}

export function secureHandler(
  handler: (req: AuthedRequest, res: Response) => Promise<void>,
  opts: Options = {}
): ReturnType<typeof onRequest> {
  const {
    auth = "public",
    methods = ["GET", "POST", "PATCH", "OPTIONS"],
    secrets = [],
    appCheck,
    requireCaps: caps,
    requireVerified: needVerified,
    requireOrg: needOrg,
    requireTeams: needTeams,
    concurrency,
    minInstances,
    timeoutSeconds,
    memory,
  } = opts;

  return onRequest(
    {
      region: RUNTIME.region,
      concurrency: concurrency ?? RUNTIME.concurrency,
      minInstances: minInstances ?? RUNTIME.minInstances,
      ...(timeoutSeconds ? { timeoutSeconds } : {}),
      ...(memory ? { memory } : {}),
      secrets: secrets as never,
    },
    async (req, res) => {
      // Emulator: never enforce (short-circuits the whole expression).
      // Production non-public endpoints: enforce by default — no param required.
      // Production public endpoints: enforce only if APP_CHECK_ENFORCE param is "true".
      // Any function can override with explicit appCheck: true/false in its opts.
      const useAppCheck =
        !IS_EMULATOR &&
        (appCheck !== undefined
          ? appCheck
          : auth !== "public" || readBoolParam(ENFORCE_APP_CHECK.value()));

      const cid =
        String(req.header("x-correlation-id") || "") ||
        crypto.randomBytes(8).toString("hex");
      res.setHeader("x-correlation-id", cid);
      const authedReq = req as AuthedRequest;

      try {
        if (setCors(req, res, methods)) return;
        res.setHeader("Content-Type", "application/json");

        if (!methods.includes(req.method as HttpMethod)) {
          res.status(405).json({ ok: false, error: "method_not_allowed" });
          return;
        }

        // Security headers
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("X-Frame-Options", "DENY");
        res.setHeader("X-XSS-Protection", "0"); // modern browsers ignore this; CSP is the replacement
        res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
        res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

        if (useAppCheck) {
          const token = String(req.header("x-firebase-appcheck") || "");
          try {
            await admin.appCheck().verifyToken(token);
          } catch {
            res.status(401).json({ ok: false, error: "appcheck_failed" });
            return;
          }
        }

        if (auth !== "public") {
          const user = await verifyUserFromRequest(req);
          const ctx = attachAuthContext(authedReq, user);

          requireLevel(ctx, auth);

          if (needVerified) requireVerified(ctx);
          if (needOrg) requireOrg(ctx);
          if (needTeams) requireTeams(ctx);
          if (caps?.length) requireCaps(ctx, caps);

          logger.info("auth_ok", {
            path: req.path,
            uid: ctx?.uid,
            emailDomain: ctx?.email ? (String(ctx.email).split("@")[1] ?? "unknown") : "none",
            orgId: authedReq.orgId,
            teams: authedReq.teamIds?.length ?? 0,
          });
        }

        await handler(authedReq, res);
      } catch (e: unknown) {
        const err = e as {
          code?: number | string;
          message?: string;
          meta?: Record<string, unknown>;
        };
        const rawCode =
          err?.code && Number.isInteger(Number(err.code)) ? Number(err.code) : 500;

        // Firebase/Firestore often throws gRPC status codes (e.g. 9 = FAILED_PRECONDITION).
        // Convert those to valid HTTP status codes for the response.
        const code =
          rawCode >= 100 && rawCode <= 599
            ? rawCode
            : rawCode === 9
            ? 400
            : rawCode === 5
            ? 404
            : rawCode === 7
            ? 403
            : rawCode === 16
            ? 401
            : 500;

        const msg =
          typeof err?.message === "string" && err.message.trim()
            ? err.message
            : "internal";

        const meta =
          err?.meta && typeof err.meta === "object" ? err.meta : undefined;

        logger.error("http_error", {
          msg,
          code,
          rawCode,
          cid,
          meta,
        });

        const body: {
          ok: false;
          error: string;
          code: number;
          meta?: Record<string, unknown>;
        } = {
          ok: false,
          error: msg,
          code,
        };

        if (meta) body.meta = meta;

        res.status(code).json(body);
      }
    }
  );
}

export async function tryDecodeBearer(req: Request & { __revoked?: boolean }) {
  const hdr = String(req.headers?.authorization || "");
  const token = hdr.startsWith("Bearer ") ? hdr.slice(7) : "";
  if (!token) return null;
  try {
    return await authAdmin.verifyIdToken(token, true);
  } catch {
    (req as Request & { __revoked?: boolean }).__revoked = true;
    return null;
  }
}
