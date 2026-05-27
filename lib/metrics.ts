// ═══════════════════════════════════════════════════════════════
// Metrics — Structured logging + Prometheus-compatible counters
// No external dependencies. Module-level Maps for counters.
// ═══════════════════════════════════════════════════════════════

const httpRequests = new Map<string, number>();
const httpLatency = new Map<string, number[]>();
const errorCounts = new Map<string, number>();

export function trackRequest(route: string, status: number, durationMs: number): void {
  const key = `${route}:${status}`;
  httpRequests.set(key, (httpRequests.get(key) || 0) + 1);

  const bucket = Math.floor(status / 100) * 100;
  const latencyKey = `${route}:${bucket}`;
  const arr = httpLatency.get(latencyKey) || [];
  arr.push(durationMs);
  // Keep only last 1000 samples per bucket to bound memory
  if (arr.length > 1000) arr.shift();
  httpLatency.set(latencyKey, arr);
}

export function trackError(route: string, errorType: string): void {
  const key = `${route}:${errorType}`;
  errorCounts.set(key, (errorCounts.get(key) || 0) + 1);
}

export function getMetrics(): string {
  const lines: string[] = [];

  lines.push("# HELP http_requests_total Total HTTP requests by route and status");
  lines.push("# TYPE http_requests_total counter");
  for (const [key, count] of httpRequests) {
    const [route, status] = key.split(":");
    lines.push(`http_requests_total{route="${route}",status="${status}"} ${count}`);
  }

  lines.push("# HELP http_request_duration_ms HTTP request duration in milliseconds");
  lines.push("# TYPE http_request_duration_ms summary");
  for (const [key, samples] of httpLatency) {
    if (samples.length === 0) continue;
    const [route, bucket] = key.split(":");
    const sorted = [...samples].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    lines.push(`http_request_duration_ms{route="${route}",status_class="${bucket}",quantile="0.5"} ${p50}`);
    lines.push(`http_request_duration_ms{route="${route}",status_class="${bucket}",quantile="0.95"} ${p95}`);
    lines.push(`http_request_duration_ms{route="${route}",status_class="${bucket}",quantile="0.99"} ${p99}`);
    lines.push(`http_request_duration_ms{route="${route}",status_class="${bucket}",quantile="avg"} ${avg.toFixed(1)}`);
  }

  lines.push("# HELP errors_total Total errors by route and type");
  lines.push("# TYPE errors_total counter");
  for (const [key, count] of errorCounts) {
    const [route, errorType] = key.split(":");
    lines.push(`errors_total{route="${route}",type="${errorType}"} ${count}`);
  }

  return lines.join("\n") + "\n";
}
