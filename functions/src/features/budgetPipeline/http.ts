// functions/src/features/budgetPipeline/http.ts
import {z} from 'zod';
import {secureHandler, orgIdFromClaims, requireUid, requireOrg, hasLevel} from '../../core';
import {
  BudgetPipelineUpsertBody,
  BudgetPipelineListQuery,
  BudgetPipelineDeleteBody,
  BudgetPipelinePreviewBody,
  BudgetPipelineRollupBody,
} from './schemas';
import {
  listBudgetPipelines,
  getBudgetPipeline,
  upsertBudgetPipeline,
  deleteBudgetPipeline,
  previewBudgetPipeline,
  rollupBudgetPipelines,
  previewGrantBudgetRollup,
} from './service';

function resolveOrgId(req: any): string {
  const caller = req.user || {};
  const callerOrg = orgIdFromClaims(caller);
  if (callerOrg) return callerOrg;
  if (hasLevel(caller, 'dev')) {
    const fromBody = req.body?.orgId || req.query?.orgId;
    if (fromBody) return String(fromBody);
  }
  return requireOrg(caller);
}

/* ============================================================================
   GET|POST /budgetPipelineList
============================================================================ */

export const budgetPipelineList = secureHandler(async (req, res): Promise<void> => {
  const src = req.method === 'GET' ? req.query : req.body;
  const parsed = BudgetPipelineListQuery.safeParse(src || {});
  if (!parsed.success) {
    res.status(400).json({ok: false, error: 'invalid_query', issues: parsed.error.issues});
    return;
  }
  const orgId = resolveOrgId(req);
  const result = await listBudgetPipelines(orgId, parsed.data);
  res.json({ok: true, ...result});
}, {auth: 'viewer', methods: ['GET', 'POST', 'OPTIONS']});

/* ============================================================================
   GET /budgetPipelineGet?id=…
============================================================================ */

export const budgetPipelineGet = secureHandler(async (req, res): Promise<void> => {
  const id = String(req.query.id || '').trim();
  if (!id) {
    res.status(400).json({ok: false, error: 'id_required'});
    return;
  }
  const orgId = resolveOrgId(req);
  const pipeline = await getBudgetPipeline(id, orgId);
  if (!pipeline) {
    res.status(404).json({ok: false, error: 'not_found'});
    return;
  }
  res.json({ok: true, pipeline});
}, {auth: 'viewer', methods: ['GET', 'POST', 'OPTIONS']});

/* ============================================================================
   POST /budgetPipelineUpsert
============================================================================ */

export const budgetPipelineUpsert = secureHandler(async (req, res): Promise<void> => {
  const parsed = BudgetPipelineUpsertBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ok: false, error: 'invalid_body', issues: parsed.error.issues});
    return;
  }
  const orgId = resolveOrgId(req);
  const uid = requireUid(req as any);
  try {
    const result = await upsertBudgetPipeline(parsed.data, orgId, uid);
    res.status(201).json({ok: true, ...result});
  } catch (err) {
    if ((err as Error)?.message === 'not_found') {
      res.status(404).json({ok: false, error: 'not_found'});
      return;
    }
    throw err;
  }
}, {auth: 'user', methods: ['POST', 'OPTIONS']});

/* ============================================================================
   POST /budgetPipelineDelete
============================================================================ */

export const budgetPipelineDelete = secureHandler(async (req, res): Promise<void> => {
  const parsed = BudgetPipelineDeleteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ok: false, error: 'invalid_body', issues: parsed.error.issues});
    return;
  }
  const orgId = resolveOrgId(req);
  const deleted = await deleteBudgetPipeline(parsed.data.id, orgId);
  if (!deleted) {
    res.status(404).json({ok: false, error: 'not_found'});
    return;
  }
  res.json({ok: true, deleted: parsed.data.id});
}, {auth: 'user', methods: ['POST', 'OPTIONS']});

/* ============================================================================
   POST /budgetPipelinePreview  — evaluate draft rules without saving
============================================================================ */

export const budgetPipelinePreview = secureHandler(async (req, res): Promise<void> => {
  const parsed = BudgetPipelinePreviewBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ok: false, error: 'invalid_body', issues: parsed.error.issues});
    return;
  }
  const orgId = (req.body?.orgId as string | undefined) || resolveOrgId(req);
  const result = await previewBudgetPipeline(orgId, parsed.data);
  res.json({ok: true, ...result});
}, {auth: 'viewer', methods: ['POST', 'OPTIONS'], memory: '512MiB'});

/* ============================================================================
   GET|POST /budgetPipelineRollup — per-pipeline pending/posted vs line-item budget
============================================================================ */

export const budgetPipelineRollup = secureHandler(async (req, res): Promise<void> => {
  const src = req.method === 'GET' ? req.query : (req.body || {});
  const parsed = BudgetPipelineRollupBody.safeParse(src);
  if (!parsed.success) {
    res.status(400).json({ok: false, error: 'invalid_query', issues: parsed.error.issues});
    return;
  }
  const orgId = resolveOrgId(req);
  const result = await rollupBudgetPipelines(orgId, {pipelineId: parsed.data.pipelineId});
  res.json({ok: true, ...result});
}, {auth: 'viewer', methods: ['GET', 'POST', 'OPTIONS']});

const BudgetRollupPreviewQuery = z.object({
  grantId: z.string().trim().min(1),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  focusSourceId: z.string().optional(),
});

/* ============================================================================
   GET|POST /budgetRollupPreview — read-only grant → line item → split explain
============================================================================ */

export const budgetRollupPreview = secureHandler(async (req, res): Promise<void> => {
  const src = req.method === 'GET' ? req.query : (req.body || {});
  const parsed = BudgetRollupPreviewQuery.safeParse(src);
  if (!parsed.success) {
    res.status(400).json({ok: false, error: 'invalid_query', issues: parsed.error.issues});
    return;
  }
  const orgId = resolveOrgId(req);
  try {
    const preview = await previewGrantBudgetRollup(orgId, parsed.data);
    res.json({ok: true, preview});
  } catch (error) {
    const code = Number((error as {code?: unknown})?.code || 500);
    if (code === 400 || code === 404) {
      res.status(code).json({ok: false, error: (error as Error)?.message || 'rollup_preview_failed'});
      return;
    }
    throw error;
  }
}, {auth: 'viewer', methods: ['GET', 'POST', 'OPTIONS'], memory: '512MiB'});
