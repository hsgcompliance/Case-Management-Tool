import type {Response} from 'express';
import {makeIdempoKey, secureHandler} from '../../core';
import type {AuthedRequest} from '../../core/requestContext';
import {
  PaymentsBulkSpendBody,
  PaymentsBulkUpdateComplianceBody,
  type TPaymentsSpendBody,
  type TPaymentsUpdateComplianceBody,
} from './schemas';
import {paymentsSpendHandler} from './spend';
import {paymentsUpdateComplianceHandler} from './updateCompliance';

type BulkItemResult = {enrollmentId: string; paymentId: string};
type BulkItemFailure = BulkItemResult & {error: string};
type HandlerResult = {status: number; payload: Record<string, unknown>};

function dedupeByPayment<T extends BulkItemResult>(items: T[]): T[] {
  return Array.from(
      new Map(items.map((item) => [
        `${String(item.enrollmentId)}:${String(item.paymentId)}`,
        item,
      ])).values(),
  );
}

async function mapWithConcurrency<T, R>(
    items: T[],
    limit: number,
    work: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workers = Array.from(
      {length: Math.min(Math.max(1, limit), items.length)},
      async () => {
        while (nextIndex < items.length) {
          const index = nextIndex++;
          results[index] = await work(items[index]);
        }
      },
  );
  await Promise.all(workers);
  return results;
}

async function invokePaymentHandler(
    handler: (req: any, res: Response) => Promise<unknown>,
    parentReq: AuthedRequest,
    body: Record<string, unknown>,
    idempotencyKey?: string,
): Promise<HandlerResult> {
  let status = 200;
  let payload: Record<string, unknown> = {};
  const response = {
    status(code: number) {
      status = code;
      return response;
    },
    json(value: unknown) {
      payload = value && typeof value === 'object' ?
        value as Record<string, unknown> :
        {};
      return response;
    },
  } as unknown as Response;

  await handler({
    body,
    user: parentReq.user,
    headers: {
      ...(parentReq.headers || {}),
      ...(idempotencyKey ? {'idempotency-key': idempotencyKey} : {}),
    },
  }, response);
  return {status, payload};
}

function itemError(result: HandlerResult): string {
  return String(result.payload.error || `request_failed_${result.status}`).slice(0, 500);
}

async function paymentsBulkSpendHandler(req: AuthedRequest, res: Response): Promise<void> {
  const body = PaymentsBulkSpendBody.parse(req.body || {});
  const items = dedupeByPayment(body.items as TPaymentsSpendBody[]);
  const bulkIdempotencyKey = String(req.headers['idempotency-key'] || '').trim();

  const outcomes = await mapWithConcurrency(items, 6, async (item) => {
    const key = bulkIdempotencyKey ?
      makeIdempoKey([bulkIdempotencyKey, item.enrollmentId, item.paymentId]) :
      undefined;
    const result = await invokePaymentHandler(
        paymentsSpendHandler,
        req,
        item as unknown as Record<string, unknown>,
        key,
    );
    return {item, result};
  });

  const successful: BulkItemResult[] = [];
  const failed: BulkItemFailure[] = [];
  for (const {item, result} of outcomes) {
    const identity = {enrollmentId: item.enrollmentId, paymentId: item.paymentId};
    if (result.status >= 200 && result.status < 300 && result.payload.ok === true) {
      successful.push(identity);
    } else {
      failed.push({...identity, error: itemError(result)});
    }
  }
  res.json({ok: true, successful, failed});
}

async function paymentsBulkUpdateComplianceHandler(
    req: AuthedRequest,
    res: Response,
): Promise<void> {
  const body = PaymentsBulkUpdateComplianceBody.parse(req.body || {});
  const items = dedupeByPayment(body.items as TPaymentsUpdateComplianceBody[]);

  const outcomes = await mapWithConcurrency(items, 10, async (item) => {
    const result = await invokePaymentHandler(
        paymentsUpdateComplianceHandler,
        req,
        item as unknown as Record<string, unknown>,
    );
    return {item, result};
  });

  const successful: BulkItemResult[] = [];
  const failed: BulkItemFailure[] = [];
  for (const {item, result} of outcomes) {
    const identity = {enrollmentId: item.enrollmentId, paymentId: item.paymentId};
    if (result.status >= 200 && result.status < 300 && result.payload.ok === true) {
      successful.push(identity);
    } else {
      failed.push({...identity, error: itemError(result)});
    }
  }
  res.json({ok: true, successful, failed});
}

export const paymentsSpendBulkAware = secureHandler(
    async (req, res): Promise<void> => {
      if (Array.isArray(req.body?.items)) {
        await paymentsBulkSpendHandler(req as AuthedRequest, res);
        return;
      }
      await paymentsSpendHandler(req as AuthedRequest, res);
    },
    {auth: 'user', methods: ['POST', 'OPTIONS'], memory: '1GiB', timeoutSeconds: 540},
);

export const paymentsUpdateComplianceBulkAware = secureHandler(
    async (req, res): Promise<void> => {
      if (Array.isArray(req.body?.items)) {
        await paymentsBulkUpdateComplianceHandler(req as AuthedRequest, res);
        return;
      }
      await paymentsUpdateComplianceHandler(req as AuthedRequest, res);
    },
    {auth: 'user', methods: ['POST', 'OPTIONS'], memory: '512MiB', timeoutSeconds: 540},
);
