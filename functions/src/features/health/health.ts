// functions/src/features/health/health.ts
import {secureHandler} from "../../core";

export const health = secureHandler(async (_req, res) => {
  res.status(200).json({ok: true, ts: Date.now()});
}, {auth: "public", methods: ["GET"]});
