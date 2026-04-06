// functions/src/features/ledger/service.ts
import { db, Timestamp, toMonthKey, removeUndefinedDeep } from "../../core";
import {
  LedgerEntry,
  type TLedgerEntry,
  type TLedgerListBody,
  type TLedgerClassifyBody,
  type TLedgerClassifyResp,
  type TLedgerAutoAssignBody,
  type TLedgerAutoAssignResp,
  type TLedgerBalanceQuery,
} from "./schemas";

type ListResult = {
  entries: TLedgerEntry[];
  count: number;
  hasMore: boolean;
};

/**
 * Normalize + enforce invariants:
 * - amountCents is truth; derive amount if missing
 * - month derived if missing
 * - dueDate canonical (accept legacy `date` and fold into dueDate)
 * - ts set if missing (Timestamp.now) to avoid "floating" entries
 * - labels always array
 * - createdAt/updatedAt set if missing (Timestamp.now)
 */
export function normalizeLedgerEntry(input: any): TLedgerEntry {
  const parsed = LedgerEntry.parse(input);

  const cents = Number(parsed.amountCents);
  const amt = cents / 100; // amountCents is truth; always derive

  // canonical dueDate: accept legacy `date`
  const dueDate = (parsed as any).dueDate ?? (parsed as any).date ?? null;

  // Ensure ts exists and is a Firestore Timestamp (prevents downstream drift)
  const ts: any = (parsed as any).ts ?? Timestamp.now();

  // Month: prefer dueDate; fallback to ts; final fallback = now
  const month = dueDate
    ? toMonthKey(dueDate)
    : (ts?.toDate ? toMonthKey(ts.toDate()) : toMonthKey(new Date()));

  const createdAt = (parsed as any).createdAt ?? Timestamp.now();
  const updatedAt = (parsed as any).updatedAt ?? Timestamp.now();

  const customerNameAtSpend =
    (parsed as any).customerNameAtSpend ??
    (parsed as any).clientNameAtSpend ??
    null;

  return {
    ...(parsed as any),
    amountCents: cents,
    amount: amt,
    ts,
    dueDate,
    month,
    labels: Array.isArray((parsed as any).labels) ? (parsed as any).labels : [],
    customerNameAtSpend,
    createdAt,
    updatedAt,
    // Do not persist legacy alias once normalized.
     ...( (parsed as any).date !== undefined ? { date: undefined } : {} ),
  } as TLedgerEntry;
}

/**
 * Transaction-safe writer for both Transaction and Batch.
 * Usage: writeLedgerEntry(trx, rawEntry)
 *
 * - If raw.id missing, generates Firestore doc id.
 * - Ensures entry.id matches doc id (doc id is canonical).
 */
export function writeLedgerEntry(
  trx: FirebaseFirestore.Transaction | FirebaseFirestore.WriteBatch,
  raw: any
): TLedgerEntry {
  const normalized = removeUndefinedDeep(normalizeLedgerEntry(raw)) as any;

  const ref = normalized.id
    ? db.collection("ledger").doc(String(normalized.id))
    : db.collection("ledger").doc(); // auto id

  const entry: any = { ...normalized, id: ref.id };

  // Best-effort: fill origin.sourcePath if caller provided origin but not path
  if (entry.origin && !entry.origin.sourcePath) {
    entry.origin = { ...entry.origin, sourcePath: `ledger/${ref.id}` };
  }

  (trx as any).set(ref, entry, { merge: true });
  return entry as TLedgerEntry;
}

function deriveAmountForOutput(entry: TLedgerEntry): TLedgerEntry {
  const cents = Number((entry as any).amountCents || 0) || 0;
  const amt =
    typeof (entry as any).amount === "number" && Number.isFinite((entry as any).amount)
      ? (entry as any).amount
      : cents / 100;
  return { ...(entry as any), amount: amt } as TLedgerEntry;
}

function docToEntry(doc: FirebaseFirestore.QueryDocumentSnapshot): TLedgerEntry {
  const data = doc.data() as TLedgerEntry;
  return deriveAmountForOutput({ ...(data as any), id: doc.id } as TLedgerEntry);
}

/**
 * List ledger entries (limit-based).
 * Cursor is accepted in contracts but not implemented here yet.
 */
export async function listLedgerEntries(
  orgId: string,
  body: TLedgerListBody
): Promise<ListResult> {
  let query: FirebaseFirestore.Query = db.collection("ledger").where("orgId", "==", orgId);

  if (body.grantId) query = query.where("grantId", "==", body.grantId);
  if (body.creditCardId) query = query.where("creditCardId", "==", body.creditCardId);
  if (body.enrollmentId) query = query.where("enrollmentId", "==", body.enrollmentId);
  if (body.customerId) query = query.where("customerId", "==", body.customerId);
  if (body.source) query = query.where("source", "==", body.source);
  if (body.month) query = query.where("month", "==", body.month);

  const sortDir = body.sortOrder === "asc" ? "asc" : "desc";
  query = query.orderBy(body.sortBy as any, sortDir);

  query = query.limit(body.limit);

  const snap = await query.get();
  const entries = snap.docs.map(docToEntry);

  return {
    entries,
    count: entries.length,
    hasMore: entries.length === body.limit,
  };
}

export async function getLedgerEntryById(entryId: string): Promise<TLedgerEntry | null> {
  const doc = await db.collection("ledger").doc(entryId).get();
  if (!doc.exists) return null;
  const data = doc.data() as TLedgerEntry;
  return deriveAmountForOutput({ ...(data as any), id: doc.id } as TLedgerEntry);
}

export function computeLedgerBalances(
  entries: Array<TLedgerEntry>,
  groupBy: TLedgerBalanceQuery["groupBy"]
) {
  const balances: Record<
    string,
    { totalCents: number; totalAmount: number; count: number; entries: string[] }
  > = {};

  for (const e of entries) {
    let groupKey = "total";
    if (groupBy === "grant") groupKey = (e as any).grantId || "unassigned";
    if (groupBy === "month") groupKey = (e as any).month || "unknown";
    if (groupBy === "source") groupKey = (e as any).source || "unknown";

    if (!balances[groupKey]) {
      balances[groupKey] = { totalCents: 0, totalAmount: 0, count: 0, entries: [] };
    }

    const cents = Number((e as any).amountCents || 0) || 0;
    balances[groupKey].totalCents += cents;
    balances[groupKey].count += 1;
    balances[groupKey].entries.push(String((e as any).id || ""));
    balances[groupKey].totalAmount = balances[groupKey].totalCents / 100;
  }

  return balances;
}

export async function fetchEntriesForBalance(orgId: string, body: TLedgerBalanceQuery) {
  let query: FirebaseFirestore.Query = db.collection("ledger").where("orgId", "==", orgId);
  if (body.grantId) query = query.where("grantId", "==", body.grantId);
  if (body.month) query = query.where("month", "==", body.month);

  const snap = await query.get();
  return snap.docs.map(docToEntry);
}

type GrantLineItemLookup = {
  grantId: string;
  lineItemId: string;
  grantName: string | null;
  lineItemLabel: string | null;
  locked: boolean;
};

const STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "this",
  "that",
  "into",
  "onto",
  "was",
  "are",
  "have",
  "has",
  "had",
  "your",
  "our",
  "you",
  "not",
  "all",
  "any",
  "per",
  "inc",
  "llc",
  "co",
  "corp",
  "ltd",
]);

function tokenize(input: unknown): string[] {
  const s = String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return [];
  return s
    .split(" ")
    .map((x) => x.trim())
    .filter((x) => x.length >= 2 && !STOP_WORDS.has(x));
}

function normalizeText(input: unknown): string {
  return String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((x) => String(x || "").trim())
    .filter((x) => x.length > 0);
}

function gatherEntryText(entry: any): { rawText: string; tokenSet: Set<string> } {
  const noteValue = entry?.note;
  const noteParts = Array.isArray(noteValue)
    ? noteValue.map((x: unknown) => String(x || ""))
    : [String(noteValue || "")];

  const textParts = [
    String(entry?.vendor || ""),
    String(entry?.comment || ""),
    ...noteParts,
    ...toStringArray(entry?.labels),
  ];

  const rawText = normalizeText(textParts.join(" "));
  const tokenSet = new Set(tokenize(rawText));
  return { rawText, tokenSet };
}

async function loadGrantLineItem(
  orgId: string,
  grantId: string,
  lineItemId: string
): Promise<{ ok: true; value: GrantLineItemLookup } | { ok: false; error: string }> {
  const snap = await db.collection("grants").doc(grantId).get();
  if (!snap.exists) return { ok: false, error: "grant_not_found" };

  const grant = snap.data() || {};
  if (String((grant as any).orgId || "") !== orgId) return { ok: false, error: "grant_org_mismatch" };

  const lineItems = Array.isArray((grant as any)?.budget?.lineItems)
    ? (grant as any).budget.lineItems
    : [];
  const li = lineItems.find((x: any) => String(x?.id || "") === lineItemId);
  if (!li) return { ok: false, error: "line_item_not_found" };

  return {
    ok: true,
    value: {
      grantId,
      lineItemId,
      grantName: (grant as any)?.name ? String((grant as any).name) : null,
      lineItemLabel: li?.label ? String(li.label) : null,
      locked: !!li?.locked,
    },
  };
}

export async function classifyLedgerEntries(
  orgId: string,
  body: TLedgerClassifyBody,
  user?: { uid?: string | null; email?: string | null; name?: string | null }
): Promise<TLedgerClassifyResp> {
  const rows = Array.isArray(body.items) ? body.items : [];
  const dryRun = !!body.dryRun;
  const now = Timestamp.now();

  const results: TLedgerClassifyResp["results"] = [];
  let updated = 0;

  const grantCache = new Map<string, { ok: true; value: GrantLineItemLookup } | { ok: false; error: string }>();

  const cacheKey = (grantId: string, lineItemId: string) => `${grantId}::${lineItemId}`;

  const writes: Array<{ ref: FirebaseFirestore.DocumentReference; patch: Record<string, unknown> }> = [];

  for (const row of rows) {
    const entryId = String((row as any)?.entryId || "");
    const entrySnap = await db.collection("ledger").doc(entryId).get();
    if (!entrySnap.exists) {
      results.push({ entryId, ok: false, error: "entry_not_found" });
      continue;
    }

    const entry = entrySnap.data() || {};
    if (String((entry as any).orgId || "") !== orgId) {
      results.push({ entryId, ok: false, error: "entry_not_found" });
      continue;
    }

    const beforeGrantId = (entry as any).grantId ? String((entry as any).grantId) : null;
    const beforeLineItemId = (entry as any).lineItemId ? String((entry as any).lineItemId) : null;
    const before = { grantId: beforeGrantId, lineItemId: beforeLineItemId };

    let nextGrantId: string | null = null;
    let nextLineItemId: string | null = null;

    if (!row.clear) {
      nextGrantId = (row as any).grantId ? String((row as any).grantId) : null;
      nextLineItemId = (row as any).lineItemId ? String((row as any).lineItemId) : null;

      if (!!nextGrantId !== !!nextLineItemId) {
        results.push({ entryId, ok: false, error: "grant_lineitem_pair_required", before });
        continue;
      }

      if (nextGrantId && nextLineItemId) {
        const key = cacheKey(nextGrantId, nextLineItemId);
        let lookup = grantCache.get(key);
        if (!lookup) {
          lookup = await loadGrantLineItem(orgId, nextGrantId, nextLineItemId);
          grantCache.set(key, lookup);
        }

        if (!lookup.ok) {
          results.push({ entryId, ok: false, error: lookup.error, before });
          continue;
        }

        if (lookup.value.locked) {
          results.push({ entryId, ok: false, error: "line_item_locked", before });
          continue;
        }
      }
    }

    const after = { grantId: nextGrantId, lineItemId: nextLineItemId };
    const changed = before.grantId !== after.grantId || before.lineItemId !== after.lineItemId;
    if (!changed) {
      results.push({ entryId, ok: true, before, after });
      continue;
    }

    if (!dryRun) {
      writes.push({
        ref: entrySnap.ref,
        patch: {
          grantId: after.grantId,
          lineItemId: after.lineItemId,
          updatedAt: now,
          byUid: user?.uid || null,
          byEmail: user?.email ? String(user.email).toLowerCase() : null,
          byName: user?.name || null,
          classifyReason: body.reason || null,
        },
      });
    }

    updated += 1;
    results.push({ entryId, ok: true, before, after });
  }

  if (!dryRun && writes.length > 0) {
    let batch = db.batch();
    let count = 0;
    for (const w of writes) {
      batch.update(w.ref, w.patch);
      count += 1;
      if (count >= 450) {
        await batch.commit();
        batch = db.batch();
        count = 0;
      }
    }
    if (count > 0) await batch.commit();
  }

  return { ok: true, updated, dryRun, results };
}

type AssignmentCandidate = {
  grantId: string;
  lineItemId: string;
  grantName: string;
  lineItemLabel: string;
  keywords: string[];
};

function buildCandidateKeywords(grant: any, li: any): string[] {
  const direct = [
    ...tokenize(li?.label),
    ...tokenize(grant?.name),
  ];

  const extras = [
    ...toStringArray(li?.keywords),
    ...toStringArray(li?.matchKeywords),
    ...toStringArray(li?.tags),
    ...toStringArray(li?.matchTags),
    ...toStringArray(li?.aliases),
  ].flatMap((x) => tokenize(x));

  const out = new Set([...direct, ...extras]);
  return Array.from(out.values());
}

function scoreEntryAgainstCandidate(
  entryText: { rawText: string; tokenSet: Set<string> },
  candidate: AssignmentCandidate
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  for (const kw of candidate.keywords) {
    if (!entryText.tokenSet.has(kw)) continue;
    score += kw.length >= 6 ? 2 : 1;
    if (reasons.length < 5) reasons.push(`kw:${kw}`);
  }

  const labelPhrase = normalizeText(candidate.lineItemLabel);
  if (labelPhrase && entryText.rawText.includes(labelPhrase)) {
    score += 4;
    reasons.push("label_phrase");
  }

  const grantPhrase = normalizeText(candidate.grantName);
  if (grantPhrase && entryText.rawText.includes(grantPhrase)) {
    score += 1;
    reasons.push("grant_phrase");
  }

  return { score, reasons };
}

async function loadAssignmentCandidates(orgId: string, grantIdFilter?: string | null): Promise<AssignmentCandidate[]> {
  const out: AssignmentCandidate[] = [];
  const docs: FirebaseFirestore.DocumentSnapshot[] = [];
  if (grantIdFilter) {
    docs.push(await db.collection("grants").doc(grantIdFilter).get());
  } else {
    const snap = await db.collection("grants").where("orgId", "==", orgId).get();
    docs.push(...snap.docs);
  }

  for (const doc of docs) {
    if (!doc.exists) continue;
    const grant = doc.data() || {};
    if (String((grant as any).orgId || "") !== orgId) continue;
    const grantId = String((grant as any).id || doc.id);
    const grantName = String((grant as any).name || "");
    const lineItems = Array.isArray((grant as any)?.budget?.lineItems)
      ? (grant as any).budget.lineItems
      : [];

    for (const li of lineItems) {
      if (!li || !li.id || li.locked) continue;
      const lineItemId = String(li.id);
      const lineItemLabel = String(li.label || "");
      const keywords = buildCandidateKeywords(grant, li);
      if (!lineItemLabel && keywords.length === 0) continue;
      out.push({
        grantId,
        lineItemId,
        grantName,
        lineItemLabel,
        keywords,
      });
    }
  }

  return out;
}

export async function autoAssignLedgerEntries(
  orgId: string,
  body: TLedgerAutoAssignBody
): Promise<TLedgerAutoAssignResp> {
  const apply = !!body.apply;
  const limit = Number(body.limit || 200);
  const forceReclass = !!body.forceReclass;

  let entries: Array<{ id: string; data: any }> = [];

  if (Array.isArray(body.entryIds) && body.entryIds.length > 0) {
    const unique = Array.from(new Set(body.entryIds.map((x) => String(x)))).slice(0, limit);
    const snaps = await Promise.all(unique.map((id) => db.collection("ledger").doc(id).get()));
    entries = snaps
      .filter((s) => s.exists)
      .map((s) => ({ id: s.id, data: s.data() || {} }))
      .filter((x) => String((x.data as any).orgId || "") === orgId);
  } else {
    let query: FirebaseFirestore.Query = db.collection("ledger").where("orgId", "==", orgId);
    if (body.month) query = query.where("month", "==", body.month);
    query = query.orderBy("updatedAt", "desc").limit(limit);
    const snap = await query.get();
    entries = snap.docs.map((d) => ({ id: d.id, data: d.data() || {} }));
  }

  const candidates = await loadAssignmentCandidates(orgId, body.grantId || null);
  const matches: TLedgerAutoAssignResp["matches"] = [];
  const writes: Array<{ ref: FirebaseFirestore.DocumentReference; patch: Record<string, unknown> }> = [];
  let updated = 0;

  for (const entry of entries) {
    const row = entry.data || {};
    const source = String(row.source || "").toLowerCase();
    if (source === "enrollment") {
      matches.push({
        entryId: entry.id,
        matched: false,
        score: 0,
        grantId: null,
        lineItemId: null,
        reasons: ["skip_enrollment_source"],
      });
      continue;
    }

    const hasExisting = !!row.grantId && !!row.lineItemId;
    if (hasExisting && !forceReclass) {
      matches.push({
        entryId: entry.id,
        matched: false,
        score: 0,
        grantId: String(row.grantId),
        lineItemId: String(row.lineItemId),
        reasons: ["already_classified"],
      });
      continue;
    }

    const entryText = gatherEntryText(row);
    if (!entryText.rawText) {
      matches.push({
        entryId: entry.id,
        matched: false,
        score: 0,
        grantId: null,
        lineItemId: null,
        reasons: ["no_text_to_match"],
      });
      continue;
    }

    let best: { c: AssignmentCandidate; score: number; reasons: string[] } | null = null;
    let secondScore = 0;

    for (const candidate of candidates) {
      const out = scoreEntryAgainstCandidate(entryText, candidate);
      if (out.score <= 0) continue;
      if (!best || out.score > best.score) {
        secondScore = best ? best.score : 0;
        best = { c: candidate, score: out.score, reasons: out.reasons };
      } else if (out.score > secondScore) {
        secondScore = out.score;
      }
    }

    if (!best) {
      matches.push({
        entryId: entry.id,
        matched: false,
        score: 0,
        grantId: null,
        lineItemId: null,
        reasons: ["no_candidate_match"],
      });
      continue;
    }

    if (best.score === secondScore) {
      matches.push({
        entryId: entry.id,
        matched: false,
        score: best.score,
        grantId: null,
        lineItemId: null,
        reasons: ["ambiguous_match", ...best.reasons],
      });
      continue;
    }

    const grantId = best.c.grantId;
    const lineItemId = best.c.lineItemId;
    matches.push({
      entryId: entry.id,
      matched: true,
      score: best.score,
      grantId,
      lineItemId,
      reasons: best.reasons,
    });

    if (apply) {
      const beforeGrantId = row.grantId ? String(row.grantId) : null;
      const beforeLineItemId = row.lineItemId ? String(row.lineItemId) : null;
      const changed = beforeGrantId !== grantId || beforeLineItemId !== lineItemId;
      if (changed) {
        writes.push({
          ref: db.collection("ledger").doc(entry.id),
          patch: {
            grantId,
            lineItemId,
            updatedAt: Timestamp.now(),
            autoAssignedAt: Timestamp.now(),
            autoAssignedScore: best.score,
            autoAssignedReasons: best.reasons.slice(0, 10),
          },
        });
        updated += 1;
      }
    }
  }

  if (apply && writes.length > 0) {
    let batch = db.batch();
    let count = 0;
    for (const w of writes) {
      batch.update(w.ref, w.patch);
      count += 1;
      if (count >= 450) {
        await batch.commit();
        batch = db.batch();
        count = 0;
      }
    }
    if (count > 0) await batch.commit();
  }

  return { ok: true, apply, updated, matches };
}
