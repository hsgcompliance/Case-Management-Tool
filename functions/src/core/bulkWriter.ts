//functions/src/core/bulkWriter.ts
import { db } from "./admin";
import type { BulkWriter, BulkWriterError } from "@google-cloud/firestore";

/** gRPC codes that are safe to retry */
const RETRYABLE = new Set<number>([
  10, // ABORTED
  14, // UNAVAILABLE
  4,  // DEADLINE_EXCEEDED
  8,  // RESOURCE_EXHAUSTED
  13, // INTERNAL
]);

export function newBulkWriter(maxRetries = 2, opsPerSec?: { initial?: number; max?: number }): BulkWriter {
  const writer = db.bulkWriter({
    // Optional throughput controls; leave undefined if you don't need throttling
    throttling: opsPerSec
      ? { initialOpsPerSecond: opsPerSec.initial ?? 200, maxOpsPerSecond: opsPerSec.max ?? 1000 }
      : undefined,
  });

  writer.onWriteError((err: BulkWriterError) => {
    const shouldRetry = RETRYABLE.has(Number(err.code)) && err.failedAttempts < maxRetries;
    return shouldRetry;
  });

  // Optional: observability
  writer.onWriteResult((_ref, _result) => { /* increment success metric if you want */ });

  return writer;
}
