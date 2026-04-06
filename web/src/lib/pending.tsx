// web/src/lib/pending.tsx
type Kind = "heavy" | "route" | "api";

type State = {
  counts: Record<Kind, number>;
  subs: Set<(s: State) => void>;
};

const state: State = {
  counts: { heavy: 0, route: 0, api: 0 },
  subs: new Set(),
};

function clamp(n: number) {
  return Math.max(0, n | 0);
}

function notify() {
  for (const fn of state.subs) {
    try {
      fn(state);
    } catch {
      // swallow subscriber errors so we don't break global pending
    }
  }
}

function subscribe(fn: (s: State) => void) {
  state.subs.add(fn);
  // push initial state
  fn(state);
  return () => {
    state.subs.delete(fn);
  };
}

function start(kind: Kind = "api", opts?: { delayMs?: number }) {
  let stopped = false;

  const inc = () => {
    if (stopped) return;
    state.counts[kind] = clamp(state.counts[kind] + 1);
    notify();
  };

  const timer = opts?.delayMs ? setTimeout(inc, opts.delayMs) : null;
  if (!timer) inc();

  return () => {
    if (stopped) return;
    stopped = true;
    if (timer) clearTimeout(timer);
    state.counts[kind] = clamp(state.counts[kind] - 1);
    notify();
  };
}

async function withPending<T>(
  fn: () => Promise<T> | T,
  kind: Kind = "api",
  opts?: { delayMs?: number }
): Promise<T> {
  const stop = start(kind, opts);
  try {
    return await fn();
  } finally {
    stop();
  }
}

export const pending = {
  /** Subscribe to all kinds. */
  subscribe,
  /** Begin a pending operation of a given kind. Returns a stop() function. */
  start,
  /** Convenience wrapper: run async work under a pending indicator. */
  with: withPending,
  /** Snapshot helpers */
  get counts() {
    return { ...state.counts };
  },
};
