import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DEFAULT_WAIT_MS = 3 * 60 * 60 * 1000;
const DEFAULT_STALE_MS = 8 * 60 * 60 * 1000;
const POLL_MS = 5000;
const CHECKOUT_DIR_NAME = ".deploy-checkouts";
const MUTEX_DIR_NAME = ".mutex";

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function nowIso() {
  return new Date().toISOString();
}

function sanitizeKey(key) {
  return String(key).replace(/[^a-zA-Z0-9._-]+/g, "__");
}

function checkoutPath(root, key) {
  return path.join(root, CHECKOUT_DIR_NAME, `${sanitizeKey(key)}.json`);
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function processExists(pid) {
  if (!pid || !Number.isInteger(Number(pid))) return false;
  try {
    process.kill(Number(pid), 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

function keysConflict(a, b) {
  if (a === b) return true;
  if (a === "functions:all" && String(b).startsWith("functions:")) return true;
  if (b === "functions:all" && String(a).startsWith("functions:")) return true;
  if (a === "hosting:all" && String(b).startsWith("hosting:")) return true;
  if (b === "hosting:all" && String(a).startsWith("hosting:")) return true;
  return false;
}

function describeCheckout(checkout) {
  const owner = checkout.owner || checkout.user || "unknown";
  const host = checkout.hostname || "unknown-host";
  const pid = checkout.pid || "unknown-pid";
  const script = checkout.script || "unknown-script";
  const startedAt = checkout.startedAt || "unknown-time";
  const note = checkout.description ? ` (${checkout.description})` : "";
  return `${checkout.key} held by ${owner}@${host} pid ${pid} via ${script} since ${startedAt}${note}`;
}

function ensureCheckoutDir(root) {
  const dir = path.join(root, CHECKOUT_DIR_NAME);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function acquireMutex(root) {
  const dir = ensureCheckoutDir(root);
  const mutexPath = path.join(dir, MUTEX_DIR_NAME);
  const started = Date.now();

  while (true) {
    try {
      fs.mkdirSync(mutexPath);
      return () => {
        try {
          fs.rmdirSync(mutexPath);
        } catch {
          // ignore
        }
      };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      if (Date.now() - started > 30000) {
        try {
          fs.rmdirSync(mutexPath);
          continue;
        } catch {
          // keep waiting
        }
      }
      sleep(250);
    }
  }
}

function listRawCheckouts(root) {
  const dir = ensureCheckoutDir(root);
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => {
      const file = path.join(dir, name);
      const checkout = readJson(file);
      return checkout ? { ...checkout, file } : { key: name.replace(/\.json$/, ""), file };
    });
}

function removeDeadOrExpired(checkout, staleMs) {
  const sameHost = checkout.hostname === os.hostname();
  const startedMs = Date.parse(checkout.startedAt || "");
  const expired = Number.isFinite(startedMs) && Date.now() - startedMs > staleMs;
  const deadSameHost = sameHost && !processExists(checkout.pid);
  const expiredOtherHost = expired && !sameHost;

  if (!expiredOtherHost && !deadSameHost) return false;

  try {
    fs.unlinkSync(checkout.file);
    console.warn(
      `Removed stale deploy checkout: ${describeCheckout(checkout)}${deadSameHost ? " (process is gone)" : ""}`,
    );
    return true;
  } catch {
    return false;
  }
}

function findConflicts(root, keys, staleMs) {
  const checkouts = listRawCheckouts(root);
  const conflicts = [];

  for (const checkout of checkouts) {
    if (!checkout.key) continue;
    if (removeDeadOrExpired(checkout, staleMs)) continue;
    if (keys.some((key) => keysConflict(key, checkout.key))) conflicts.push(checkout);
  }

  return conflicts;
}

function writeCheckouts(root, keys, description) {
  const metadata = {
    owner: os.userInfo().username,
    hostname: os.hostname(),
    pid: process.pid,
    script: path.basename(process.argv[1] || "node"),
    startedAt: nowIso(),
    description,
  };

  const files = [];
  for (const key of keys) {
    const file = checkoutPath(root, key);
    fs.writeFileSync(file, JSON.stringify({ ...metadata, key }, null, 2), { flag: "wx" });
    files.push(file);
  }
  return files;
}

export function listDeployCheckouts(root) {
  return listRawCheckouts(root).sort((a, b) => String(a.key).localeCompare(String(b.key)));
}

export function describeDeployCheckout(checkout) {
  return describeCheckout(checkout);
}

export function getDeployCheckoutConflicts(keys, options = {}) {
  const root = options.root || process.cwd();
  const uniqueKeys = [...new Set(keys)].sort();
  const staleMs = options.staleMs ?? DEFAULT_STALE_MS;

  if (!uniqueKeys.length) return [];

  const releaseMutex = acquireMutex(root);
  try {
    return findConflicts(root, uniqueKeys, staleMs).sort((a, b) => String(a.key).localeCompare(String(b.key)));
  } finally {
    releaseMutex();
  }
}

export function acquireDeployCheckouts(keys, options = {}) {
  const root = options.root || process.cwd();
  const uniqueKeys = [...new Set(keys)].sort();
  const waitMs = options.waitMs ?? DEFAULT_WAIT_MS;
  const staleMs = options.staleMs ?? DEFAULT_STALE_MS;
  const description = options.description || "";
  const started = Date.now();
  let announced = false;

  if (!uniqueKeys.length) {
    return () => {};
  }

  while (true) {
    let releaseMutex = acquireMutex(root);
    let files = [];
    try {
      const conflicts = findConflicts(root, uniqueKeys, staleMs);
      if (!conflicts.length) {
        files = writeCheckouts(root, uniqueKeys, description);
        console.log(`Checked out deploy targets: ${uniqueKeys.join(", ")}`);
        return () => {
          const releaseFiles = files.slice().reverse();
          for (const file of releaseFiles) {
            try {
              fs.unlinkSync(file);
            } catch {
              // ignore
            }
          }
          console.log(`Released deploy targets: ${uniqueKeys.join(", ")}`);
        };
      }

      if (Date.now() - started >= waitMs) {
        throw new Error(`Timed out waiting for deploy checkout:\n${conflicts.map(describeCheckout).join("\n")}`);
      }

      if (!announced) {
        console.log(`Waiting for deploy checkout:\n${conflicts.map(describeCheckout).join("\n")}`);
        announced = true;
      }
    } catch (error) {
      for (const file of files.reverse()) {
        try {
          fs.unlinkSync(file);
        } catch {
          // ignore
        }
      }
      throw error;
    } finally {
      releaseMutex();
    }

    sleep(POLL_MS);
  }
}

export function withDeployCheckouts(keys, options, callback) {
  const release = acquireDeployCheckouts(keys, options);
  try {
    return callback();
  } finally {
    release();
  }
}
