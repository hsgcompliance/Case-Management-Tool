import type {Request} from "express";
import {secureHandler, SHEETS_BRIDGE_SHARED_SECRET} from "../../core";
import {SheetsBridgePullQuery, SheetsBridgePushBody} from "./schemas";
import {
  assertSheetsBridgeSecret,
  getSheetsBridgeManifest,
  pullSheetsBridgeRows,
  pushSheetsBridgeChanges,
} from "./service";

function readBridgeSecret(req: Request): string {
  const headerSecret = String(req.header("x-hdb-sheets-secret") || "").trim();
  if (headerSecret) return headerSecret;
  const auth = String(req.header("authorization") || "").trim();
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return String(match?.[1] || "").trim();
}

export const sheetsBridgeManifest = secureHandler(
  async (req, res) => {
    assertSheetsBridgeSecret(readBridgeSecret(req));
    res.status(200).json({ok: true, ...getSheetsBridgeManifest()});
  },
  {
    auth: "public",
    appCheck: false,
    methods: ["GET", "OPTIONS"],
    secrets: [SHEETS_BRIDGE_SHARED_SECRET],
  },
);

export const sheetsBridgePull = secureHandler(
  async (req, res) => {
    assertSheetsBridgeSecret(readBridgeSecret(req));
    const raw = req.method === "GET" ? req.query : req.body;
    const query = SheetsBridgePullQuery.parse(raw || {});
    const result = await pullSheetsBridgeRows(query);
    res.status(200).json({ok: true, ...result});
  },
  {
    auth: "public",
    appCheck: false,
    methods: ["GET", "POST", "OPTIONS"],
    secrets: [SHEETS_BRIDGE_SHARED_SECRET],
    timeoutSeconds: 120,
    memory: "512MiB",
  },
);

export const sheetsBridgePush = secureHandler(
  async (req, res) => {
    assertSheetsBridgeSecret(readBridgeSecret(req));
    const body = SheetsBridgePushBody.parse(req.body || {});
    const result = await pushSheetsBridgeChanges(body);
    res.status(200).json({ok: true, ...result});
  },
  {
    auth: "public",
    appCheck: false,
    methods: ["POST", "OPTIONS"],
    secrets: [SHEETS_BRIDGE_SHARED_SECRET],
    timeoutSeconds: 120,
    memory: "512MiB",
  },
);
