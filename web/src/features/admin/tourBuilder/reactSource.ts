//src/features/tutorial/admin/reactSource.ts
// Dev-only helpers to map a DOM node -> React component source (file:line:col)
// Works in React dev builds where _debugSource exists on Fiber nodes.

export type ReactSourceInfo = {
  file?: string;
  line?: number;
  column?: number;
  componentStack: string[]; // Innermost first
};

function findFiberKey(node: any): string | null {
  for (const k in node) {
    if (k.startsWith("__reactFiber$") || k.startsWith("__reactContainer$")) return k;
  }
  return null;
}

function getFiberForNode(node: Element | null): any | null {
  let cur: any = node;
  for (let i = 0; i < 6 && cur; i++) {
    const key = findFiberKey(cur as any);
    if (key) return (cur as any)[key];
    cur = cur.parentNode;
  }
  return null;
}

function getName(f: any): string | null {
  const t = f?.type;
  return t?.displayName || t?.name || (typeof t === "string" ? t : null);
}

function firstDebugSource(f: any | null): { fileName?: string; lineNumber?: number; columnNumber?: number } | null {
  let cur = f;
  while (cur) {
    if (cur._debugSource) return cur._debugSource;
    cur = cur.return;
  }
  return null;
}

function normalizeFile(fileName?: string): string | undefined {
  if (!fileName) return undefined;
  try {
    // Vite often gives http://localhost:5173/... or /@fs/C:/...
    if (/^https?:\/\//.test(fileName)) {
      const u = new URL(fileName);
      fileName = u.pathname; // strip origin
    }
    // Strip Vite @fs prefix
    fileName = fileName.replace(/^\/@fs\//, "");
    // Collapse to project-relative if possible
    const srcIdx = fileName.lastIndexOf("/src/");
    if (srcIdx >= 0) return fileName.slice(srcIdx + 1); // "src/..."
    // Windows path? try \src\
    const winIdx = fileName.toLowerCase().lastIndexOf("\\src\\");
    if (winIdx >= 0) return fileName.slice(winIdx + 1).replace(/\\/g, "/");
    return fileName.replace(/^\/+/, "");
  } catch {
    return fileName;
  }
}

export function getReactSourceFromDom(node: Element): ReactSourceInfo {
  const fiber = getFiberForNode(node);
  const stack: string[] = [];
  let cur = fiber;
  while (cur) {
    const n = getName(cur);
    if (n) stack.push(n);
    cur = cur.return;
  }
  const src = firstDebugSource(fiber);
  return {
    file: normalizeFile(src?.fileName),
    line: src?.lineNumber,
    column: src?.columnNumber,
    componentStack: stack,
  };
}

export async function openInEditor(file?: string, line?: number, column?: number) {
  if (!file) return;
  // Vite dev server supports this endpoint
  const payload = `${file}${line ? `:${line}` : ""}${column ? `:${column}` : ""}`;
  try {
    await fetch(`/__open-in-editor?file=${encodeURIComponent(payload)}`);
  } catch {
    // ignore
  }
}
