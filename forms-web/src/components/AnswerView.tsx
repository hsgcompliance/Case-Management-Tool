// Submission render — ported from next-dashboard-starter AnswerTable.js (Tailwind).
// Type-aware display, no dangerouslySetInnerHTML, PDF links, raw toggle.
import { useMemo, useState, type ReactNode } from "react";
import type { JfAnswer, JfSubmission } from "@/lib/jotformManagerApi";

const isUrl = (s: unknown) => typeof s === "string" && /^https?:\/\//.test(s);
const stripHtml = (s: unknown) =>
  String(s || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const shortTail = (url: unknown, max = 44) => {
  const tail = String(url).split("/").pop() || String(url);
  return tail.length > max ? `${tail.slice(0, max)}…` : tail;
};
const typeOf = (a: JfAnswer) => String(a?.type || "");

function isEmpty(ans: unknown): boolean {
  if (ans == null) return true;
  if (typeof ans === "string") return ans.trim() === "";
  if (Array.isArray(ans)) return ans.length === 0 || ans.every(isEmpty);
  if (typeof ans === "object") {
    const keys = Object.keys(ans as object);
    return keys.length === 0 || keys.every((k) => isEmpty((ans as Record<string, unknown>)[k]));
  }
  return false;
}

function orderNum(a: JfAnswer, fallback: number): number {
  const n = Number(a?.order);
  return Number.isFinite(n) ? n : 100000 + fallback;
}

function htmlish(s: unknown): ReactNode {
  const lines = String(s || "").split(/<br\s*\/?>/i).map((x) => x.trim()).filter(Boolean);
  return (
    <div className="flex flex-col gap-1">
      {lines.map((line, i) => {
        const m = line.match(/<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
        if (m) {
          const href = m[1];
          return <div key={i}><a className="text-indigo-600 hover:underline" href={href} target="_blank" rel="noreferrer">{stripHtml(m[2]) || shortTail(href)}</a></div>;
        }
        const txt = stripHtml(line);
        return txt ? <div key={i}>{txt}</div> : null;
      })}
    </div>
  );
}

function displayAnswer(a: JfAnswer): unknown {
  const t = typeOf(a);
  if (t === "control_fileupload") return a?.answer ?? [];
  if (t === "control_address") return a?.answer ?? null;
  if (t === "control_phone") return (a?.answer as { full?: string })?.full ?? a?.answer ?? "";
  if (t === "control_email") return a?.answer ?? "";
  if (t === "control_datetime") return a?.prettyFormat ?? (a?.answer as { datetime?: string })?.datetime ?? a?.answer ?? "";
  if (t === "control_fullname") {
    const v = a?.answer as Record<string, unknown> | string;
    if (v && typeof v === "object") {
      const full = `${String(v.first ?? "").trim()} ${String(v.last ?? "").trim()}`.trim();
      return full || a?.prettyFormat || "";
    }
    return a?.prettyFormat ?? a?.answer ?? "";
  }
  return a?.prettyFormat ?? a?.answer ?? "";
}

function Cell({ ans }: { ans: unknown }): ReactNode {
  if (isEmpty(ans)) return null;
  if (typeof ans === "object" && !Array.isArray(ans)) {
    const o = ans as Record<string, unknown>;
    const isAddr = "addr_line1" in o || "city" in o || "state" in o || "postal" in o;
    if (isAddr) {
      const cityLine = [String(o.city || "").trim(), String(o.state || "").trim()].filter(Boolean).join(", ");
      const lastLine = [cityLine, String(o.postal || "").trim()].filter(Boolean).join(" ");
      return (
        <div className="flex flex-col gap-0.5">
          {o.addr_line1 ? <div>{String(o.addr_line1)}</div> : null}
          {o.addr_line2 ? <div>{String(o.addr_line2)}</div> : null}
          {lastLine ? <div>{lastLine}</div> : null}
        </div>
      );
    }
    return (
      <table className="text-xs">
        <tbody>
          {Object.entries(o).filter(([, v]) => !isEmpty(v)).map(([k, v]) => (
            <tr key={k}>
              <td className="border border-slate-200 px-1.5 py-1 font-semibold">{stripHtml(k)}</td>
              <td className="border border-slate-200 px-1.5 py-1">{typeof v === "string" && /<[^>]+>/.test(v) ? htmlish(v) : String(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (typeof ans === "string" && /<[^>]+>/.test(ans)) return htmlish(ans);
  if (typeof ans === "string") {
    return isUrl(ans) ? <a className="text-indigo-600 hover:underline" href={ans} target="_blank" rel="noreferrer">{shortTail(ans)}</a> : <>{ans}</>;
  }
  if (Array.isArray(ans)) {
    return ans.map((item, idx) => {
      const tail = idx < ans.length - 1 ? ", " : "";
      return isUrl(item)
        ? <span key={idx}><a className="text-indigo-600 hover:underline" href={String(item)} target="_blank" rel="noreferrer">{shortTail(item)}</a>{tail}</span>
        : <span key={idx}>{String(item)}{tail}</span>;
    });
  }
  return <>{String(ans)}</>;
}

export function AnswerView({ sub }: { sub: JfSubmission }) {
  const [raw, setRaw] = useState(false);
  const answers = sub.answers || {};

  const rows = useMemo(() => {
    return Object.values(answers)
      .map((a, idx) => ({ a, idx, order: orderNum(a, idx), type: typeOf(a), question: stripHtml(a?.text || a?.name || ""), ans: displayAnswer(a), pdfUrl: a?.pdf?.download_url }))
      .sort((x, y) => x.order - y.order || x.idx - y.idx)
      .map((x) => {
        if (x.type === "control_head") { const t = stripHtml(x.a?.text); return t ? { kind: "header" as const, key: `h${x.idx}`, text: t } : null; }
        if (x.type === "control_divider" || x.type === "control_pagebreak") return { kind: "divider" as const, key: `d${x.idx}` };
        const hasAns = !isEmpty(x.ans);
        if (!hasAns && !x.pdfUrl) return null;
        return { kind: "qa" as const, key: `q${x.idx}`, question: x.question, ans: x.ans, pdfUrl: x.pdfUrl };
      })
      .filter(Boolean) as Array<{ kind: "header"; key: string; text: string } | { kind: "divider"; key: string } | { kind: "qa"; key: string; question: string; ans: unknown; pdfUrl?: string }>;
  }, [answers]);

  return (
    <div className="space-y-2.5">
      <div className="flex justify-end">
        <button type="button" onClick={() => setRaw((v) => !v)} className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
          {raw ? "Show formatted" : "Show raw"}
        </button>
      </div>
      {raw ? (
        <pre className="max-h-[60vh] overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] leading-relaxed">{JSON.stringify(sub, null, 2)}</pre>
      ) : (
        rows.map((r) => {
          if (r.kind === "header") return <div key={r.key} className="pt-2"><div className="text-sm font-extrabold text-slate-800">{r.text}</div><div className="mt-2 h-px bg-slate-200" /></div>;
          if (r.kind === "divider") return <div key={r.key} className="my-1 h-px bg-slate-100" />;
          return (
            <div key={r.key} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
              <div className="mb-1 text-xs font-bold text-slate-800">{r.question}</div>
              <div className="text-[13px] text-slate-700">{Cell({ ans: r.ans })}</div>
              {r.pdfUrl ? <div className="mt-2"><a className="inline-block rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100" href={r.pdfUrl} target="_blank" rel="noreferrer">Download PDF ↓</a></div> : null}
            </div>
          );
        })
      )}
    </div>
  );
}
