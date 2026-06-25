// functions/src/features/budgetPipeline/service.ts
import {db, isoNow} from '../../core';
import {
  type TBudgetPipeline,
  type TBudgetPipelineUpsertBody,
  type TBudgetPipelineListQuery,
  type TBudgetPipelinePreviewBody,
  type TPipelineCondition,
  type TPipelineConditionGroup,
  type TPipelineFormSchema,
  type TPipelineOperator,
  type TPipelineRuleNode,
  type TBudgetPipelineRollupResult,
  type TBudgetPipelineRollupRow,
} from './schemas';

const COLLECTION = 'budgetPipelines';
const QUEUE_COLLECTION = 'paymentQueue';

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function isoDate10(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') {
    const s = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  }
  if (typeof value === 'object' && value && typeof (value as {toDate?: unknown}).toDate === 'function') {
    const d = (value as {toDate: () => Date}).toDate();
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  }
  const d = new Date(value as never);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

function budgetRowDate(row: Record<string, unknown>): string {
  return isoDate10(row.dueDate || row.date || row.paymentDate || row.serviceDate || row.postedAt || row.createdAt || row.updatedAtISO || row.updatedAt);
}

function rowAmount(row: Record<string, unknown>): number {
  if (row.amountCents != null) return round2((Number(row.amountCents) || 0) / 100);
  return round2(Number(row.amount || 0));
}

function inWindow(date: string, start?: string, end?: string): boolean {
  if (!date) return true;
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
}

function sourceLabel(row: Record<string, unknown>, fallback: string) {
  return String(row.customer || row.customerName || row.vendor || row.merchant || row.formTitle || row.note || fallback || '').trim();
}

export type BudgetRollupPreviewSource = {
  id: string;
  sourceType: 'ledger' | 'paymentQueue';
  date: string;
  amount: number;
  status: 'spent' | 'projected';
  label: string;
  grantId: string;
  lineItemId: string;
  splitGoalId: string | null;
  customerId: string;
  caseManagerId: string;
  ledgerId: string | null;
  paymentQueueId: string | null;
  reason?: string;
};

export type BudgetRollupPreview = {
  grant: {
    id: string;
    name: string;
    budget: number;
    spent: number;
    projected: number;
    balance: number;
    projectedBalance: number;
  };
  lineItems: Array<{
    id: string;
    label: string;
    budget: number;
    spent: number;
    projected: number;
    balance: number;
    projectedBalance: number;
    splitGoals: Array<{
      id: string;
      label: string;
      startDate: string;
      endDate: string;
      amount: number;
      spent: number;
      projected: number;
      balance: number;
      projectedBalance: number;
      sources: BudgetRollupPreviewSource[];
    }>;
    sources: BudgetRollupPreviewSource[];
  }>;
  unmatched: BudgetRollupPreviewSource[];
  sourceCounts: {ledger: number; paymentQueue: number; unmatched: number};
};

// ─── Field extraction ─────────────────────────────────────────────────────────

const WIDE_GRANT_TEXT_FIELDS = [
  'program_raw',
  'program',
  'billed_to_raw',
  'billedTo',
  'project_raw',
  'project',
  'descriptor',
  'serviceType',
  'otherService',
  'expense_type_raw',
  'expenseType',
  'paymentMethod',
  'serviceScope',
  'wex',
  'card',
  'cardBucket',
  'merchant',
  'customer',
  'purpose',
  'notes',
  'note',
  'source',
  'formTitle',
] as const;

function stringifySearchValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(stringifySearchValue).filter(Boolean).join(' ');
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if ('answer' in obj) return stringifySearchValue(obj.answer);
    if ('prettyFormat' in obj) return stringifySearchValue(obj.prettyFormat);
    if ('text' in obj) return stringifySearchValue(obj.text);
  }
  return '';
}

function getWideGrantText(item: Record<string, unknown>): string {
  const parts = WIDE_GRANT_TEXT_FIELDS.map((field) => stringifySearchValue(item[field]));
  const transactionFields = item.transactionFields as Record<string, unknown> | undefined;
  if (transactionFields && typeof transactionFields === 'object') {
    for (const value of Object.values(transactionFields)) {
      parts.push(stringifySearchValue(value));
    }
  }
  return parts.filter(Boolean).join(' ').toLowerCase();
}

function getFieldValue(item: Record<string, unknown>, field: string): unknown {
  if (field === 'wideGrantText' || field === 'bucket_text') {
    return getWideGrantText(item);
  }
  if (field.startsWith('tx:')) {
    const transactionFields = item.transactionFields as Record<string, unknown> | undefined;
    return transactionFields?.[field] ?? '';
  }
  if (field.startsWith('raw:')) {
    const fieldId = field.slice(4);
    const answers = item.rawAnswers as Record<string, unknown> | undefined;
    if (!answers) return '';
    const ans = answers[fieldId];
    if (!ans) return '';
    if (typeof ans === 'string') return ans;
    if (Array.isArray(ans)) return ans.join(', ');
    if (typeof ans === 'object' && ans !== null) {
      const a = ans as Record<string, unknown>;
      if ('answer' in a) return String(a.answer ?? '');
      if ('prettyFormat' in a) return String(a.prettyFormat ?? '');
    }
    return String(ans);
  }
  return item[field];
}

function evalCondition(
  item: Record<string, unknown>,
  cond: TPipelineCondition,
): {match: boolean; reason: string} {
  const rawVal = getFieldValue(item, cond.field);
  const fStr = String(rawVal ?? '').toLowerCase().trim();
  const op = cond.operator as TPipelineOperator;
  const condVal = cond.value;
  const cStr = String(condVal ?? '').toLowerCase().trim();
  const fieldLabel = cond.field === 'wideGrantText' || cond.field === 'bucket_text'
    ? 'Any grant field (wide)'
    : cond.field.startsWith('raw:') ? `raw:${cond.field.slice(4)}` : cond.field;
  const empty = !fStr;

  switch (op) {
    case 'equals':
      return {match: !empty && fStr === cStr, reason: `${fieldLabel} = "${condVal}"`};
    case 'not_equals':
      return {match: empty || fStr !== cStr, reason: `${fieldLabel} != "${condVal}"`};
    case 'contains':
      return {match: !empty && fStr.includes(cStr), reason: `${fieldLabel} contains "${condVal}"`};
    case 'not_contains':
      return {match: empty || !fStr.includes(cStr), reason: `${fieldLabel} not contains "${condVal}"`};
    case 'starts_with':
      return {match: !empty && fStr.startsWith(cStr), reason: `${fieldLabel} starts with "${condVal}"`};
    case 'in': {
      const vals = Array.isArray(condVal) ? condVal.map((v) => String(v).toLowerCase()) : [cStr];
      return {match: !empty && vals.includes(fStr), reason: `${fieldLabel} in [${vals.join(', ')}]`};
    }
    case 'not_in': {
      const vals = Array.isArray(condVal) ? condVal.map((v) => String(v).toLowerCase()) : [cStr];
      return {match: empty || !vals.includes(fStr), reason: `${fieldLabel} not in [${vals.join(', ')}]`};
    }
    case 'gte':
      return {match: !empty && Number(rawVal) >= Number(condVal), reason: `${fieldLabel} >= ${condVal}`};
    case 'lte':
      return {match: !empty && Number(rawVal) <= Number(condVal), reason: `${fieldLabel} <= ${condVal}`};
    case 'gt':
      return {match: !empty && Number(rawVal) > Number(condVal), reason: `${fieldLabel} > ${condVal}`};
    case 'lt':
      return {match: !empty && Number(rawVal) < Number(condVal), reason: `${fieldLabel} < ${condVal}`};
    case 'is_true':
      return {match: !empty && (Boolean(rawVal) === true || fStr === 'true'), reason: `${fieldLabel} is true`};
    case 'is_false':
      return {match: empty || !Boolean(rawVal) || fStr === 'false', reason: `${fieldLabel} is false`};
    case 'before':
      return {match: !empty && fStr < cStr, reason: `${fieldLabel} before ${condVal}`};
    case 'after':
      return {match: !empty && fStr > cStr, reason: `${fieldLabel} after ${condVal}`};
    case 'is_empty':
      return {match: empty, reason: `${fieldLabel} is empty`};
    case 'is_not_empty':
      return {match: !empty, reason: `${fieldLabel} is not empty`};
    default:
      return {match: false, reason: 'unknown operator'};
  }
}

function evalGroup(
  item: Record<string, unknown>,
  group: TPipelineConditionGroup,
): {match: boolean; reasons: string[]} {
  if (group.conditions.length === 0) return {match: true, reasons: ['(empty group)']};

  const results = group.conditions.map((c) => evalCondition(item, c));

  if (group.logic === 'AND') {
    const allMatch = results.every((r) => r.match);
    return {match: allMatch, reasons: results.filter((r) => r.match).map((r) => r.reason)};
  }
  // OR
  const anyMatch = results.some((r) => r.match);
  return {match: anyMatch, reasons: results.filter((r) => r.match).map((r) => r.reason)};
}

function legacyGroupsToTree(
  groups: TPipelineConditionGroup[],
  rootLogic: 'AND' | 'OR',
): TPipelineRuleNode {
  return {
    id: 'legacy-root',
    type: 'group',
    logic: rootLogic,
    children: groups.map((group) => ({
      id: group.id,
      type: 'group' as const,
      logic: group.logic,
      children: group.conditions.map((condition) => ({
        id: condition.id,
        type: 'condition' as const,
        condition,
      })),
    })),
  };
}

function evalRuleTree(
  item: Record<string, unknown>,
  node: TPipelineRuleNode,
  opts: {rootEmptyMatch: boolean; childEmptyMatch: boolean; isRoot?: boolean},
): {match: boolean; reasons: string[]} {
  if (node.type === 'condition') {
    const result = evalCondition(item, node.condition);
    return {match: result.match, reasons: result.match ? [result.reason] : []};
  }

  if (node.children.length === 0) {
    return {match: opts.isRoot ? opts.rootEmptyMatch : opts.childEmptyMatch, reasons: []};
  }

  const results = node.children.map((child) => evalRuleTree(item, child, {...opts, isRoot: false}));
  if (node.logic === 'AND') {
    const match = results.every((r) => r.match);
    return {match, reasons: results.flatMap((r) => r.reasons)};
  }

  const match = results.some((r) => r.match);
  return {match, reasons: results.filter((r) => r.match).flatMap((r) => r.reasons)};
}

// empty includeGroups = match all
function evalIncludes(
  item: Record<string, unknown>,
  groups: TPipelineConditionGroup[],
  tree?: TPipelineRuleNode | null,
): {matched: boolean; reasons: string[]} {
  if (tree) {
    const result = evalRuleTree(item, tree, {rootEmptyMatch: true, childEmptyMatch: true, isRoot: true});
    return {matched: result.match, reasons: result.reasons};
  }
  if (groups.length === 0) return {matched: true, reasons: []};
  for (const group of groups) {
    const {match, reasons} = evalGroup(item, group);
    if (match) return {matched: true, reasons};
  }
  return {matched: false, reasons: []};
}

// empty excludeGroups = exclude nothing
function evalExcludes(
  item: Record<string, unknown>,
  groups: TPipelineConditionGroup[],
  tree?: TPipelineRuleNode | null,
): {excluded: boolean; reasons: string[]} {
  if (tree) {
    const result = evalRuleTree(item, tree, {rootEmptyMatch: false, childEmptyMatch: true, isRoot: true});
    return {excluded: result.match, reasons: result.reasons};
  }
  for (const group of groups) {
    const {match, reasons} = evalGroup(item, group);
    if (match) return {excluded: true, reasons};
  }
  return {excluded: false, reasons: []};
}

type RuleSet = {
  includeGroups: TPipelineConditionGroup[];
  excludeGroups: TPipelineConditionGroup[];
  includeTree?: TPipelineRuleNode | null;
  excludeTree?: TPipelineRuleNode | null;
};

function normalizeFormSchemas(
  value: TBudgetPipelineUpsertBody['formSchemas'] | TBudgetPipeline['formSchemas'] | undefined,
): Record<string, TPipelineFormSchema> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const entries = Object.entries(value)
    .filter(([, schema]) => !!schema && typeof schema === 'object' && !!schema.sourceFormId)
    .map(([key, schema]) => [
      key,
      {
        enabled: schema.enabled !== false,
        sourceFormId: schema.sourceFormId,
        sourceFormTitle: schema.sourceFormTitle || schema.sourceFormId,
        includeGroups: schema.includeGroups ?? [],
        excludeGroups: schema.excludeGroups ?? [],
        includeTree: schema.includeTree ?? null,
        excludeTree: schema.excludeTree ?? null,
      } satisfies TPipelineFormSchema,
    ] as const);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function enabledFormSchemas(pipeline: TBudgetPipeline): TPipelineFormSchema[] {
  return Object.values(pipeline.formSchemas ?? {}).filter((schema) => schema && schema.enabled !== false);
}

function rulesForItem(
  item: Record<string, unknown>,
  pipeline: TBudgetPipeline,
): RuleSet | null {
  const schemas = enabledFormSchemas(pipeline);
  if (schemas.length > 0) {
    const formId = String(item.formId ?? '');
    const schema = schemas.find((candidate) => candidate.sourceFormId === formId);
    if (!schema) return null;
    return {
      includeGroups: schema.includeGroups ?? [],
      excludeGroups: schema.excludeGroups ?? [],
      includeTree: schema.includeTree ?? null,
      excludeTree: schema.excludeTree ?? null,
    };
  }

  if (pipeline.sourceFormId && item.formId !== pipeline.sourceFormId) return null;
  return {
    includeGroups: pipeline.includeGroups ?? [],
    excludeGroups: pipeline.excludeGroups ?? [],
    includeTree: pipeline.includeTree ?? null,
    excludeTree: pipeline.excludeTree ?? null,
  };
}

function evaluatePipelineForItem(
  item: Record<string, unknown>,
  pipeline: TBudgetPipeline,
): {matched: boolean; matchReasons: string[]; exclusionReasons: string[]} {
  const rules = rulesForItem(item, pipeline);
  if (!rules) return {matched: false, matchReasons: [], exclusionReasons: []};

  const inc = evalIncludes(item, rules.includeGroups, rules.includeTree ?? null);
  if (!inc.matched) return {matched: false, matchReasons: [], exclusionReasons: []};

  const exc = evalExcludes(item, rules.excludeGroups, rules.excludeTree ?? null);
  if (exc.excluded) {
    return {matched: false, matchReasons: inc.reasons, exclusionReasons: exc.reasons};
  }

  return {matched: true, matchReasons: inc.reasons, exclusionReasons: []};
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function listBudgetPipelines(
  orgId: string,
  query: TBudgetPipelineListQuery,
): Promise<{items: TBudgetPipeline[]; count: number}> {
  let q = db.collection(COLLECTION).where('orgId', '==', orgId) as FirebaseFirestore.Query;
  if (query.grantId) q = q.where('grantId', '==', query.grantId);
  if (query.status) q = q.where('status', '==', query.status);
  q = q.orderBy('updatedAt', 'desc').limit(query.limit);

  const snap = await q.get();
  const items = snap.docs.map((d) => ({...(d.data() as TBudgetPipeline), id: d.id}));
  return {items, count: items.length};
}

export async function getBudgetPipeline(id: string, orgId: string): Promise<TBudgetPipeline | null> {
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  const pipeline = doc.data() as TBudgetPipeline;
  if (pipeline.orgId !== orgId) return null;
  return {...pipeline, id: doc.id};
}

export async function upsertBudgetPipeline(
  body: TBudgetPipelineUpsertBody,
  orgId: string,
  uid: string,
): Promise<{id: string; pipeline: TBudgetPipeline}> {
  const now = isoNow();
  const coll = db.collection(COLLECTION);

  if (body.id) {
    const existing = await coll.doc(body.id).get();
    const prev = existing.exists ? (existing.data() as TBudgetPipeline) : null;
    if (prev && prev.orgId !== orgId) {
      throw new Error('not_found');
    }
    const data: Omit<TBudgetPipeline, 'id'> = {
      orgId,
      name: body.name,
      status: body.status ?? prev?.status ?? 'draft',
      grantId: body.grantId !== undefined ? (body.grantId ?? null) : (prev?.grantId ?? null),
      lineItemId: body.lineItemId !== undefined ? (body.lineItemId ?? null) : (prev?.lineItemId ?? null),
      sourceFormId: body.sourceFormId !== undefined ? (body.sourceFormId ?? null) : (prev?.sourceFormId ?? null),
      sourceFormTitle: body.sourceFormTitle !== undefined ? (body.sourceFormTitle ?? null) : (prev?.sourceFormTitle ?? null),
      formSchemas: body.formSchemas !== undefined
        ? normalizeFormSchemas(body.formSchemas)
        : normalizeFormSchemas(prev?.formSchemas),
      includeGroups: body.includeGroups ?? prev?.includeGroups ?? [],
      excludeGroups: body.excludeGroups ?? prev?.excludeGroups ?? [],
      includeTree: body.includeTree !== undefined
        ? body.includeTree
        : (prev?.includeTree ?? legacyGroupsToTree(prev?.includeGroups ?? [], 'OR')),
      excludeTree: body.excludeTree !== undefined
        ? body.excludeTree
        : (prev?.excludeTree ?? legacyGroupsToTree(prev?.excludeGroups ?? [], 'OR')),
      createdAt: prev?.createdAt ?? now,
      createdBy: prev?.createdBy ?? uid,
      updatedAt: now,
      updatedBy: uid,
    };
    await coll.doc(body.id).set(data, {merge: false});
    return {id: body.id, pipeline: {...data, id: body.id}};
  }

  const ref = coll.doc();
  const data: Omit<TBudgetPipeline, 'id'> = {
    orgId,
    name: body.name,
    status: body.status ?? 'draft',
    grantId: body.grantId ?? null,
    lineItemId: body.lineItemId ?? null,
    sourceFormId: body.sourceFormId ?? null,
    sourceFormTitle: body.sourceFormTitle ?? null,
    formSchemas: normalizeFormSchemas(body.formSchemas),
    includeGroups: body.includeGroups ?? [],
    excludeGroups: body.excludeGroups ?? [],
    includeTree: body.includeTree ?? legacyGroupsToTree(body.includeGroups ?? [], 'AND'),
    excludeTree: body.excludeTree ?? legacyGroupsToTree(body.excludeGroups ?? [], 'OR'),
    createdAt: now,
    createdBy: uid,
    updatedAt: now,
    updatedBy: uid,
  };
  await ref.set(data);
  return {id: ref.id, pipeline: {...data, id: ref.id}};
}

export async function deleteBudgetPipeline(id: string, orgId: string): Promise<boolean> {
  const ref = db.collection(COLLECTION).doc(id);
  const doc = await ref.get();
  if (!doc.exists) return false;
  const pipeline = doc.data() as TBudgetPipeline;
  if (pipeline.orgId !== orgId) return false;
  await ref.delete();
  return true;
}

// ─── Preview ──────────────────────────────────────────────────────────────────

type PreviewItemResult = {
  itemId: string;
  matchReasons: string[];
  exclusionReasons: string[];
  conflictPipelineIds: string[];
};

export async function previewBudgetPipeline(
  orgId: string,
  body: TBudgetPipelinePreviewBody,
) {
  // Load normalized transactions from paymentQueue. Pending rows are projected;
  // posted rows are spent; void rows are excluded below.
  let q = db
    .collection(QUEUE_COLLECTION)
    .where('orgId', '==', orgId) as FirebaseFirestore.Query;

  if (body.sourceFormId) q = q.where('formId', '==', body.sourceFormId);
  if (body.month) q = q.where('month', '==', body.month);
  q = q.limit(body.limit);

  const snap = await q.get();
  const items: Array<Record<string, unknown> & {id: string}> = snap.docs
    .map((d): Record<string, unknown> & {id: string} => {
      const data = d.data() as Record<string, unknown>;
      return {...data, id: d.id};
    })
    .filter((item) => String(item.queueStatus || '') !== 'void');

  // Evaluate each item
  const matched: Array<Record<string, unknown> & {id: string}> = [];
  const perItem: PreviewItemResult[] = [];

  for (const item of items) {
    const inc = evalIncludes(item, body.includeGroups, body.includeTree ?? null);
    if (!inc.matched) continue;

    const exc = evalExcludes(item, body.excludeGroups, body.excludeTree ?? null);
    if (exc.excluded) {
      perItem.push({
        itemId: item.id as string,
        matchReasons: inc.reasons,
        exclusionReasons: exc.reasons,
        conflictPipelineIds: [],
      });
      continue;
    }

    matched.push(item);
    perItem.push({
      itemId: item.id as string,
      matchReasons: inc.reasons,
      exclusionReasons: [],
      conflictPipelineIds: [],
    });
  }

  // Conflict detection: check active pipelines that also match these items
  const activePipelinesSnap = await db
    .collection(COLLECTION)
    .where('orgId', '==', orgId)
    .where('status', '==', 'active')
    .get();

  const conflicts: Array<{pipelineId: string; pipelineName: string; itemIds: string[]}> = [];

  for (const pDoc of activePipelinesSnap.docs) {
    if (body.pipelineId && pDoc.id === body.pipelineId) continue;
    const p = pDoc.data() as TBudgetPipeline;
    const conflictIds: string[] = [];

    for (const item of matched) {
      if (evaluatePipelineForItem(item, p).matched) conflictIds.push(item.id as string);
    }

    if (conflictIds.length > 0) {
      conflicts.push({pipelineId: pDoc.id, pipelineName: p.name, itemIds: conflictIds});
      for (const pi of perItem) {
        if (conflictIds.includes(pi.itemId)) pi.conflictPipelineIds.push(pDoc.id);
      }
    }
  }

  const totalAmount = matched.reduce((s, item) => s + Number(item.amount ?? 0), 0);
  const projected = matched.filter((item) => String(item.queueStatus || '') !== 'posted');
  const posted = matched.filter((item) => String(item.queueStatus || '') === 'posted');


  return {
    matched: matched.map((item) => ({
      id: item.id as string,
      submissionId: String(item.submissionId ?? ''),
      amount: Number(item.amount ?? 0),
      merchant: String(item.merchant ?? ''),
      formTitle: String(item.formTitle ?? ''),
      source: String(item.source ?? ''),
      month: String(item.month ?? ''),
      customer: String(item.customer ?? ''),
      expenseType: String(item.expenseType ?? ''),
      grantId: (item.grantId as string | null) ?? null,
      lineItemId: (item.lineItemId as string | null) ?? null,
      queueStatus: String(item.queueStatus ?? ''),
    })),
    totalAmount,
    projectedAmount: projected.reduce((s, item) => s + Number(item.amount ?? 0), 0),
    postedAmount: posted.reduce((s, item) => s + Number(item.amount ?? 0), 0),
    projectedCount: projected.length,
    postedCount: posted.length,
    matchCount: matched.length,
    perItem,
    conflicts,
  };
}

// ─── Rollup ─────────────────────────────────────────────────────────────────

/**
 * Per-pipeline budget rollup. Attribution comes from `pipelineId` stamped on
 * paymentQueue items by the allocator/re-allocator:
 *   - pending queue rows  → this pipeline's projected contribution
 *   - posted queue rows   → this pipeline's spent contribution (the posted doc
 *     retains pipelineId + amount, so no ledger join is needed)
 * The grant's authoritative line-item projected/spent (ALL sources) is included
 * alongside so the UI can reconcile the pipeline slice against the whole.
 */
export async function rollupBudgetPipelines(
  orgId: string,
  opts: {pipelineId?: string},
): Promise<TBudgetPipelineRollupResult> {
  const empty: TBudgetPipelineRollupResult = {
    rows: [],
    totals: {pendingAmount: 0, postedAmount: 0, pendingCount: 0, postedCount: 0},
  };

  // 1. Resolve the pipeline set (single or all-in-org).
  let pipelines: TBudgetPipeline[];
  if (opts.pipelineId) {
    const doc = await db.collection(COLLECTION).doc(opts.pipelineId).get();
    if (!doc.exists) return empty;
    const p = doc.data() as TBudgetPipeline;
    if (p.orgId !== orgId) return empty;
    pipelines = [{...p, id: doc.id}];
  } else {
    const snap = await db.collection(COLLECTION).where('orgId', '==', orgId).get();
    pipelines = snap.docs.map((d) => ({...(d.data() as TBudgetPipeline), id: d.id}));
  }
  if (pipelines.length === 0) return empty;

  // 2. Batch-load referenced grants for authoritative line-item totals.
  const grantIds = Array.from(new Set(pipelines.map((p) => p.grantId).filter(Boolean) as string[]));
  const grantMap = new Map<string, Record<string, unknown>>();
  if (grantIds.length) {
    const snaps = await db.getAll(...grantIds.map((id) => db.collection('grants').doc(id)));
    for (const s of snaps) if (s.exists) grantMap.set(s.id, s.data() as Record<string, unknown>);
  }

  // 3. Aggregate pending + posted queue rows per pipeline (equality-only queries
  //    need no composite index).
  const sumAmount = (snap: FirebaseFirestore.QuerySnapshot) =>
    snap.docs.reduce((s, d) => s + Number((d.data() as Record<string, unknown>).amount ?? 0), 0);

  const rows: TBudgetPipelineRollupRow[] = await Promise.all(
    pipelines.map(async (p) => {
      const base = db
        .collection(QUEUE_COLLECTION)
        .where('orgId', '==', orgId)
        .where('pipelineId', '==', p.id);
      const [pendingSnap, postedSnap] = await Promise.all([
        base.where('queueStatus', '==', 'pending').get(),
        base.where('queueStatus', '==', 'posted').get(),
      ]);

      const grant = p.grantId ? grantMap.get(p.grantId) : null;
      const lineItems: Array<Record<string, unknown>> = Array.isArray((grant as any)?.budget?.lineItems)
        ? (grant as any).budget.lineItems
        : [];
      const li = p.lineItemId ? lineItems.find((x) => String(x?.id || '') === p.lineItemId) : null;

      return {
        pipelineId: p.id,
        name: p.name,
        status: p.status,
        grantId: p.grantId ?? null,
        grantName: (grant as any)?.name ? String((grant as any).name) : null,
        lineItemId: p.lineItemId ?? null,
        lineItemLabel: (li as any)?.label ? String((li as any).label) : null,
        lineItemBudget: round2(Number((li as any)?.amount ?? 0)),
        lineItemProjected: round2(Number((li as any)?.projected ?? 0)),
        lineItemSpent: round2(Number((li as any)?.spent ?? 0)),
        pendingCount: pendingSnap.size,
        pendingAmount: round2(sumAmount(pendingSnap)),
        postedCount: postedSnap.size,
        postedAmount: round2(sumAmount(postedSnap)),
      } satisfies TBudgetPipelineRollupRow;
    }),
  );

  rows.sort((a, b) => a.name.localeCompare(b.name));

  const totals = rows.reduce(
    (acc, r) => ({
      pendingAmount: round2(acc.pendingAmount + r.pendingAmount),
      postedAmount: round2(acc.postedAmount + r.postedAmount),
      pendingCount: acc.pendingCount + r.pendingCount,
      postedCount: acc.postedCount + r.postedCount,
    }),
    {pendingAmount: 0, postedAmount: 0, pendingCount: 0, postedCount: 0},
  );

  return {rows, totals};
}

export async function previewGrantBudgetRollup(
  orgId: string,
  opts: {grantId: string; startDate?: string; endDate?: string; limit?: number; focusSourceId?: string},
): Promise<BudgetRollupPreview> {
  const grantId = String(opts.grantId || '').trim();
  if (!grantId) throw Object.assign(new Error('grant_required'), {code: 400});

  const gSnap = await db.collection('grants').doc(grantId).get();
  if (!gSnap.exists) throw Object.assign(new Error('grant_not_found'), {code: 404});
  const grant = gSnap.data() as Record<string, unknown>;
  if (orgId && String(grant.orgId || '') && String(grant.orgId || '') !== orgId) {
    throw Object.assign(new Error('grant_not_found'), {code: 404});
  }

  const budget = (grant.budget || {}) as Record<string, unknown>;
  const lineItems = (Array.isArray(budget.lineItems) ? budget.lineItems : []) as Record<string, unknown>[];
  const startDate = isoDate10(opts.startDate);
  const endDate = isoDate10(opts.endDate);
  const limit = Math.max(1, Math.min(Number(opts.limit || 25), 100));

  const baseLineItems = lineItems.map((li) => {
    const amount = round2(Number(li.amount || 0));
    return {
      id: String(li.id || ''),
      label: String(li.label || li.name || li.id || 'Line item'),
      budget: amount,
      spent: 0,
      projected: 0,
      balance: amount,
      projectedBalance: amount,
      splitGoals: (Array.isArray(li.splitGoals) ? li.splitGoals : []).map((goal: Record<string, unknown>) => {
        const goalAmount = round2(Number(goal.amount || 0));
        return {
          id: String(goal.id || ''),
          label: String(goal.label || goal.name || goal.id || 'Cycle'),
          startDate: isoDate10(goal.startDate),
          endDate: isoDate10(goal.endDate),
          amount: goalAmount,
          spent: 0,
          projected: 0,
          balance: goalAmount,
          projectedBalance: goalAmount,
          sources: [] as BudgetRollupPreviewSource[],
        };
      }),
      sources: [] as BudgetRollupPreviewSource[],
    };
  });
  const previewLineById = new Map(baseLineItems.map((li) => [li.id, li]));
  const unmatched: BudgetRollupPreviewSource[] = [];
  let ledgerCount = 0;
  let queueCount = 0;

  function addRow(raw: Record<string, unknown>, id: string, sourceType: 'ledger' | 'paymentQueue') {
    const date = budgetRowDate(raw);
    if (!inWindow(date, startDate, endDate)) return;

    const amount = rowAmount(raw);
    if (!amount) return;

    const status = sourceType === 'ledger' || String(raw.queueStatus || '') === 'posted' ? 'spent' : 'projected';
    const lineItemId = String(raw.lineItemId || '');
    const line = lineItemId ? previewLineById.get(lineItemId) : null;
    let splitGoalId: string | null = null;
    let reason = '';

    if (!lineItemId) reason = 'Missing line item assignment.';
    else if (!line) reason = 'Line item ID does not match this grant budget.';

    const src: BudgetRollupPreviewSource = {
      id,
      sourceType,
      date,
      amount,
      status,
      label: sourceLabel(raw, id),
      grantId,
      lineItemId,
      splitGoalId: null,
      customerId: String(raw.customerId || raw.customerID || ''),
      caseManagerId: String(raw.caseManagerId || raw.caseManagerUid || raw.cmUid || ''),
      ledgerId: sourceType === 'ledger' ? id : (String(raw.ledgerEntryId || '') || null),
      paymentQueueId: sourceType === 'paymentQueue' ? id : null,
      ...(reason ? {reason} : {}),
    };

    if (!line) {
      unmatched.push(src);
      return;
    }

    if (status === 'spent') line.spent = round2(line.spent + amount);
    else line.projected = round2(line.projected + amount);

    for (const goal of line.splitGoals) {
      if (!goal.id || !date || !goal.startDate || !goal.endDate) continue;
      if (date < goal.startDate || date > goal.endDate) continue;
      splitGoalId = goal.id;
      if (status === 'spent') goal.spent = round2(goal.spent + amount);
      else goal.projected = round2(goal.projected + amount);
      if (goal.sources.length < limit) goal.sources.push({...src, splitGoalId});
      break;
    }

    line.sources.push({...src, splitGoalId});
    if (line.sources.length > limit) line.sources = line.sources.slice(0, limit);
  }

  const [ledgerSnap, queueSnap] = await Promise.all([
    db.collection('ledger').where('grantId', '==', grantId).get(),
    db.collection(QUEUE_COLLECTION).where('grantId', '==', grantId).get(),
  ]);

  for (const doc of ledgerSnap.docs) {
    const data = doc.data() as Record<string, unknown>;
    if (orgId && String(data.orgId || '') && String(data.orgId || '') !== orgId) continue;
    ledgerCount += 1;
    addRow(data, doc.id, 'ledger');
  }

  for (const doc of queueSnap.docs) {
    const data = doc.data() as Record<string, unknown>;
    if (orgId && String(data.orgId || '') && String(data.orgId || '') !== orgId) continue;
    if (String(data.queueStatus || '') === 'void') continue;
    queueCount += 1;
    addRow(data, doc.id, 'paymentQueue');
  }

  const lineItemsOut = baseLineItems.map((li) => {
    const budgetCents = Math.round(li.budget * 100);
    const spentCents = Math.round(li.spent * 100);
    const projectedCents = Math.round(li.projected * 100);
    return {
      ...li,
      balance: round2((budgetCents - spentCents) / 100),
      projectedBalance: round2((budgetCents - spentCents - projectedCents) / 100),
      splitGoals: li.splitGoals.map((goal) => {
        const amountCents = Math.round(goal.amount * 100);
        const spentCentsGoal = Math.round(goal.spent * 100);
        const projectedCentsGoal = Math.round(goal.projected * 100);
        return {
          ...goal,
          balance: round2((amountCents - spentCentsGoal) / 100),
          projectedBalance: round2((amountCents - spentCentsGoal - projectedCentsGoal) / 100),
        };
      }),
    };
  });

  const totalBudget = round2(Number(budget.total || lineItemsOut.reduce((sum, li) => sum + li.budget, 0)));
  const totalSpent = round2(lineItemsOut.reduce((sum, li) => sum + li.spent, 0));
  const totalProjected = round2(lineItemsOut.reduce((sum, li) => sum + li.projected, 0));

  return {
    grant: {
      id: grantId,
      name: String(grant.name || grant.label || grantId),
      budget: totalBudget,
      spent: totalSpent,
      projected: totalProjected,
      balance: round2(totalBudget - totalSpent),
      projectedBalance: round2(totalBudget - totalSpent - totalProjected),
    },
    lineItems: lineItemsOut,
    unmatched: unmatched.slice(0, limit),
    sourceCounts: {ledger: ledgerCount, paymentQueue: queueCount, unmatched: unmatched.length},
  };
}

// ─── Trigger helper ───────────────────────────────────────────────────────────

export function matchesPipeline(
  item: Record<string, unknown>,
  pipeline: TBudgetPipeline,
): boolean {
  return evaluatePipelineForItem(item, pipeline).matched;
}

export async function autoAllocatePaymentQueueItem(
  itemId: string,
  data: Record<string, unknown>,
  opts: { force?: boolean; writer?: string } = {},
): Promise<{ pipelineId: string | null; allocated: boolean }> {
  if (!data) return {pipelineId: null, allocated: false};
  if (data.queueStatus !== 'pending') return {pipelineId: null, allocated: false};
  if (!opts.force && data.grantId) return {pipelineId: null, allocated: false};
  if (!data.orgId) return {pipelineId: null, allocated: false};

  const orgId = String(data.orgId);
  const snap = await db
    .collection(COLLECTION)
    .where('orgId', '==', orgId)
    .where('status', '==', 'active')
    .orderBy('createdAt', 'asc')
    .get();

  if (snap.empty) return {pipelineId: null, allocated: false};

  const item = {...data, id: itemId};
  for (const pDoc of snap.docs) {
    const pipeline = pDoc.data() as TBudgetPipeline;
    if (!matchesPipeline(item, pipeline)) continue;

    const patch: Record<string, unknown> = {
      updatedAtISO: isoNow(),
      'system.lastWriter': opts.writer ?? `autoAllocatePaymentQueueItem:pipeline:${pDoc.id}`,
      'system.lastWriteAt': isoNow(),
    };
    if (pipeline.grantId) patch.grantId = pipeline.grantId;
    if (pipeline.lineItemId) patch.lineItemId = pipeline.lineItemId;
    if (patch.grantId || patch.lineItemId) {
      patch.pipelineId = pDoc.id;
      await db.collection(QUEUE_COLLECTION).doc(itemId).update(patch);
      return {pipelineId: pDoc.id, allocated: true};
    }
    break;
  }

  return {pipelineId: null, allocated: false};
}
