// ═══════════════════════════════════════════════════════════════
// previewLog — a tiny in-memory event log for the Live preview console.
//
// The runtime (and any instrumentation) pushes entries; the console panel
// subscribes. Emission is gated by `active` (are there subscribers?) so it's a
// no-op in exported/production apps where nothing is listening.
// ═══════════════════════════════════════════════════════════════

export type LogLevel = "info" | "success" | "error" | "debug";

export interface LogEntry {
  id: number;
  ts: number;
  level: LogLevel;
  source: string;   // e.g. "action", "db", "nav", "state"
  message: string;
  detail?: string;  // optional expandable/monospace payload
}

const MAX = 300;
let seq = 0;
let buffer: LogEntry[] = [];
const subs = new Set<(entries: LogEntry[]) => void>();

export const previewLog = {
  /** True when the console is open — instrumentation can skip work otherwise. */
  get active(): boolean {
    return subs.size > 0;
  },
  push(level: LogLevel, source: string, message: string, detail?: string): void {
    buffer = [...buffer, { id: ++seq, ts: Date.now(), level, source, message, detail }].slice(-MAX);
    subs.forEach((s) => s(buffer));
  },
  clear(): void {
    buffer = [];
    subs.forEach((s) => s(buffer));
  },
  subscribe(cb: (entries: LogEntry[]) => void): () => void {
    subs.add(cb);
    cb(buffer);
    return () => { subs.delete(cb); };
  },
};
