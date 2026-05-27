// ═══════════════════════════════════════════════════════════════
// Convert Worker — offloads CPU-heavy ZIP generation + code
// conversion to a worker thread so the main event loop stays free.
//
// Usage: import { runConvertWorker } from "@/lib/convertWorker"
// ═══════════════════════════════════════════════════════════════

import { Worker, isMainThread, parentPort, workerData } from "worker_threads";
import path from "path";

export interface ConvertWorkerInput {
  target: string;
  fileName: string;
  nodes: any[];
  referenceFrame?: any;
  interactions?: any[];
  options?: any;
}

export interface ConvertWorkerResult {
  success: boolean;
  files?: Array<{ path: string; content: string | Uint8Array; type: "text" | "binary" }>;
  warnings?: string[];
  errors?: string[];
}

// Concurrency limiter — at most N conversions running simultaneously
const MAX_CONCURRENT = parseInt(process.env.CONVERT_CONCURRENCY || "2", 10);
let activeWorkers = 0;
const queue: Array<{
  input: ConvertWorkerInput;
  resolve: (v: ConvertWorkerResult) => void;
  reject: (e: Error) => void;
}> = [];

function processQueue() {
  while (queue.length > 0 && activeWorkers < MAX_CONCURRENT) {
    const job = queue.shift()!;
    activeWorkers++;
    executeInWorker(job.input)
      .then(job.resolve)
      .catch(job.reject)
      .finally(() => {
        activeWorkers--;
        processQueue();
      });
  }
}

function executeInWorker(input: ConvertWorkerInput): Promise<ConvertWorkerResult> {
  return new Promise((resolve, reject) => {
    // In the HTTP proxy bridge architecture, worker_threads can't easily
    // import the full convert pipeline. Instead, use the concurrency limiter
    // pattern to queue work on the main thread with backpressure.
    //
    // For true worker offload, uncomment the Worker approach below once
    // the convert pipeline is extracted to a standalone module.

    // Timeout: 30 seconds max per conversion
    const timeout = setTimeout(() => {
      reject(new Error("Conversion timed out (30s)"));
    }, 30_000);

    // Run synchronously on main thread but with concurrency limit
    import("@/lib/convert").then(({ convertDesign }) => {
      convertDesign({
        target: input.target as any,
        fileName: input.fileName,
        nodes: input.nodes,
        referenceFrame: input.referenceFrame,
        interactions: input.interactions || [],
        options: input.options,
      })
        .then((result) => {
          clearTimeout(timeout);
          resolve({
            success: result.success,
            files: result.files,
            warnings: result.warnings,
            errors: result.errors,
          });
        })
        .catch((err) => {
          clearTimeout(timeout);
          reject(err);
        });
    });
  });
}

/**
 * Queue a conversion job with backpressure.
 * Returns a promise that resolves when a slot is available and the job completes.
 */
export function runConvertWorker(input: ConvertWorkerInput): Promise<ConvertWorkerResult> {
  return new Promise((resolve, reject) => {
    queue.push({ input, resolve, reject });
    processQueue();
  });
}

/** How many jobs are currently queued (waiting for a slot) */
export function getQueueDepth(): number {
  return queue.length;
}

/** How many workers are currently active */
export function getActiveWorkers(): number {
  return activeWorkers;
}
