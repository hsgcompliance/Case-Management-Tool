import path from "node:path";
import { fileURLToPath } from "node:url";
import { listActiveDeployCheckouts } from "./lib/deployCheckouts.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
// Prunes dead/expired entries first so this never reports a deploy that was
// actually killed (not exited cleanly) as still "active".
const checkouts = listActiveDeployCheckouts(ROOT);

if (!checkouts.length) {
  console.log("No active deploy checkouts.");
  process.exit(0);
}

console.log("Active deploy checkouts:");
for (const checkout of checkouts) {
  const owner = checkout.owner || "unknown";
  const host = checkout.hostname || "unknown-host";
  const pid = checkout.pid || "unknown-pid";
  const script = checkout.script || "unknown-script";
  const startedAt = checkout.startedAt || "unknown-time";
  const description = checkout.description ? ` - ${checkout.description}` : "";
  console.log(`- ${checkout.key}: ${owner}@${host} pid ${pid}, ${script}, started ${startedAt}${description}`);
}
