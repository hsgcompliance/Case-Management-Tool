//scripts/lib/config.mjs
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LIB_DIR = path.dirname(fileURLToPath(import.meta.url)); // .../scripts/lib
const TOOLBELT = process.env.TOOLBELT_DIR
  ? path.resolve(process.env.TOOLBELT_DIR)          // (already .../scripts)
  : path.resolve(LIB_DIR, "..");  
const CONFIG_PATH = path.join(TOOLBELT, "env.config");

export async function loadConfig() {
  const raw = await fs.readFile(CONFIG_PATH, "utf8").catch(() => {
    throw new Error(`Missing env.config at ${CONFIG_PATH}`);
  });

  let cfg;
  try {
    cfg = JSON.parse(raw);
  } catch (err) {
    throw new Error(`env.config is not valid JSON: ${err.message}`);
  }

  // Required bits
  if (!cfg.base) throw new Error(`env.config missing required "base"`);
  if (!cfg.tokens?.id || !cfg.tokens?.app)
    throw new Error(`env.config missing required "tokens.id" or "tokens.app"`);

  // Paths
  cfg.ROOT = TOOLBELT;                       // toolbelt directory
  cfg.appDir = cfg.appDir ?? "../repo";      // where package.json + vite live
  cfg.appAbs = path.resolve(cfg.ROOT, cfg.appDir);
  cfg.OUT = path.join(TOOLBELT, "out");
  await fs.mkdir(cfg.OUT, { recursive: true });

  // Defaults
  cfg.limits ??= { hardCap: 5000, activityLimit: 500 };
  cfg.build ??= {
    mode: "production",
    host: "0.0.0.0",
    port: 5173,
    basePath: "/",
    strict: true,
    open: true,
    emulate: false,
  };

  return cfg;
}

export default { loadConfig };
