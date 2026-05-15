// functions/src/features/budgetPipeline/service.ts
import {db, isoNow} from '../../core';
import {
  type TBudgetPipeline,
  type TBudgetPipelineUpsertBody,
  type TBudgetPipelineListQuery,
  type TBudgetPipelinePreviewBody,
  type TPipelineCondition,
  type TPipelineConditionGroup,
  type TPipelineOperator,
} from './schemas';

const COLLECTION = 'budgetPipelines';
const QUEUE_COLLECTION = 'paymentQueue';

// ─── Field extraction ─────────────────────────────────────────────────────────

function getFieldValue(item: Record<string, unknown>, field: string): unknown {
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

// ─── Condition evaluation ─────────────────────────────────────────────────────

function evalCondition(
  item: Record<string, unknown>,
  cond: TPipelineCondition,
): {match: boolean; reason: string} {
  const rawVal = getFieldValue(item, cond.field);
  const fStr = String(rawVal ?? '').toLowerCase().trim();
  const op = cond.operator as TPipelineOperator;
  const condVal = cond.value;
  const cStr = String(condVal ?? '').toLowerCase().trim();
  const fieldLabel = cond.field.startsWith('raw:') ? `raw:${cond.field.slice(4)}` : cond.field;

  switch (op) {
    case 'equals':
      return {match: fStr === cStr, reason: `${fieldLabel} = "${condVal}"`};
    case 'not_equals':
      return {match: fStr !== cStr, reason: `${fieldLabel} ≠ "${condVal}"`};
    case 'contains':
      return {match: fStr.includes(cStr), reason: `${fieldLabel} contains "${condVal}"`};
    case 'not_contains':
      return {match: !fStr.includes(cStr), reason: `${fieldLabel} not contains "${condVal}"`};
    case 'starts_with':
      return {match: fStr.startsWith(cStr), reason: `${fieldLabel} starts with "${condVal}"`};
    case 'in': {
      const vals = Array.isArray(condVal) ? condVal.map((v) => String(v).toLowerCase()) : [cStr];
      return {match: vals.includes(fStr), reason: `${fieldLabel} in [${vals.join(', ')}]`};
    }
    case 'not_in': {
      const vals = Array.isArray(condVal) ? condVal.map((v) => String(v).toLowerCase()) : [cStr];
      return {match: !vals.includes(fStr), reason: `${fieldLabel} not in [${vals.join(', ')}]`};
    }
    case 'gte':
      return {match: Number(rawVal) >= Number(condVal), reason: `${fieldLabel} ≥ ${condVal}`};
    case 'lte':
      return {match: Number(rawVal) <= Number(condVal), reason: `${fieldLabel} ≤ ${condVal}`};
    case 'gt':
      return {match: Number(rawVal) > Number(condVal), reason: `${fieldLabel} > ${condVal}`};
    case 'lt':
      return {match: Number(rawVal) < Number(condVal), reason: `${fieldLabel} < ${condVal}`};
    case 'is_true':
      return {match: Boolean(rawVal) === true || fStr === 'true', reason: `${fieldLabel} is true`};
    case 'is_false':
      return {match: !Boolean(rawVal) || fStr === 'false', reason: `${fieldLabel} is false`};
    case 'before':
      return {match: fStr < cStr, reason: `${fieldLabel} before ${condVal}`};
    case 'after':
      return {match: fStr > cStr, reason: `${fieldLabel} after ${condVal}`};
    case 'is_empty':
      return {match: !fStr, reason: `${fieldLabel} is empty`};
    case 'is_not_empty':
      return {match: !!fStr, reason: `${fieldLabel} is not empty`};
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

// empty includeGroups = match all
function evalIncludes(
  item: Record<string, unknown>,
  groups: TPipelineConditionGroup[],
): {matched: boolean; reasons: string[]} {
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
): {excluded: boolean; reasons: string[]} {
  for (const group of groups) {
    const {match, reasons} = evalGroup(item, group);
    if (match) return {excluded: true, reasons};
  }
  return {excluded: false, reasons: []};
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

export async function getBudgetPipeline(id: string): Promise<TBudgetPipeline | null> {
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return {...(doc.data() as TBudgetPipeline), id: doc.id};
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
    const data: Omit<TBudgetPipeline, 'id'> = {
      orgId,
      name: body.name,
      status: body.status ?? prev?.status ?? 'draft',
      grantId: body.grantId !== undefined ? (body.grantId ?? null) : (prev?.grantId ?? null),
      lineItemId: body.lineItemId !== undefined ? (body.lineItemId ?? null) : (prev?.lineItemId ?? null),
      sourceFormId: body.sourceFormId !== undefined ? (body.sourceFormId ?? null) : (prev?.sourceFormId ?? null),
      sourceFormTitle: body.sourceFormTitle !== undefined ? (body.sourceFormTitle ?? null) : (prev?.sourceFormTitle ?? null),
      includeGroups: body.includeGroups ?? prev?.includeGroups ?? [],
      excludeGroups: body.excludeGroups ?? prev?.excludeGroups ?? [],
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
    includeGroups: body.includeGroups ?? [],
    excludeGroups: body.excludeGroups ?? [],
    createdAt: now,
    createdBy: uid,
    updatedAt: now,
    updatedBy: uid,
  };
  await ref.set(data);
  return {id: ref.id, pipeline: {...data, id: ref.id}};
}

export async function deleteBudgetPipeline(id: string): Promise<void> {
  await db.collection(COLLECTION).doc(id).delete();
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
  // Load paymentQueue items: only pending, scoped to org
  let q = db
    .collection(QUEUE_COLLECTION)
    .where('orgId', '==', orgId)
    .where('queueStatus', '==', 'pending') as FirebaseFirestore.Query;

  if (body.sourceFormId) q = q.where('formId', '==', body.sourceFormId);
  if (body.month) q = q.where('month', '==', body.month);
  q = q.limit(body.limit);

  const snap = await q.get();
  const items: Array<Record<string, unknown> & {id: string}> = snap.docs.map((d) => ({
    ...(d.data() as Record<string, unknown>),
    id: d.id,
  }));

  // Evaluate each item
  const matched: Array<Record<string, unknown> & {id: string}> = [];
  const perItem: PreviewItemResult[] = [];

  for (const item of items) {
    const inc = evalIncludes(item, body.includeGroups);
    if (!inc.matched) continue;

    const exc = evalExcludes(item, body.excludeGroups);
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
      const pInc = evalIncludes(item, p.includeGroups);
      if (!pInc.matched) continue;
      const pExc = evalExcludes(item, p.excludeGroups);
      if (!pExc.excluded) conflictIds.push(item.id as string);
    }

    if (conflictIds.length > 0) {
      conflicts.push({pipelineId: pDoc.id, pipelineName: p.name, itemIds: conflictIds});
      for (const pi of perItem) {
        if (conflictIds.includes(pi.itemId)) pi.conflictPipelineIds.push(pDoc.id);
      }
    }
  }

  const totalAmount = matched.reduce((s, item) => s + Number(item.amount ?? 0), 0);


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
    matchCount: matched.length,
    perItem,
    conflicts,
  };
}

// ─── Trigger helper ───────────────────────────────────────────────────────────

export function matchesPipeline(
  item: Record<string, unknown>,
  pipeline: TBudgetPipeline,
): boolean {
  if (pipeline.sourceFormId && item.formId !== pipeline.sourceFormId) return false;
  const inc = evalIncludes(item, pipeline.includeGroups);
  if (!inc.matched) return false;
  const exc = evalExcludes(item, pipeline.excludeGroups);
  return !exc.excluded;
}
