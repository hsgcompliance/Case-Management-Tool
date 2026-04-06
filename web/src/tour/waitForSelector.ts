//src/features/tutorial/waitForSelector.ts
import { isValidSelector, qsSafe } from "./dom";

type Opts = { timeoutMs?: number; pollMs?: number };

/** Never throws; returns null on invalid selector or timeout. */
export async function waitForSelector<T extends HTMLElement = HTMLElement>(
  selector?: string | null,
  opts: Opts = {}
): Promise<T | null> {
  if (!selector || !selector.trim() || !isValidSelector(selector)) return null;
  const timeoutMs = opts.timeoutMs ?? 5000;
  const pollMs = opts.pollMs ?? 50;
  const t0 = performance.now();
  while (performance.now() - t0 < timeoutMs) {
    const el = qsSafe<T>(selector);
    if (el) return el;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return null;
}
