// ═══════════════════════════════════════════════════════════════
// Timeline Engine — Processes timeline data for rendering
//
// Used for:
//   - Workflow step visualization
//   - Approval history trails
//   - Activity logs
// ═══════════════════════════════════════════════════════════════

import type { TimelineConfig } from "./configs";

// ── Types ────────────────────────────────────────────────────

export interface TimelineItem {
  key: string;
  title: string;
  subtitle?: string;
  timestamp?: string;
  comment?: string;
  status: "completed" | "active" | "pending" | "failed" | "skipped";
  icon?: string;
  raw: Record<string, unknown>;
}

export interface TimelineResult {
  items: TimelineItem[];
  activeIndex: number;
  totalSteps: number;
  completedSteps: number;
}

// ── Engine ───────────────────────────────────────────────────

export class TimelineEngine {
  private config: TimelineConfig;

  constructor(config: TimelineConfig) {
    this.config = config;
  }

  /** Process raw data into timeline items */
  process(
    data: Record<string, unknown>[],
    activeStepValue?: unknown
  ): TimelineResult {
    const maxItems = this.config.maxItems || data.length;
    const slicedData = data.slice(0, maxItems);

    let activeIndex = -1;

    const items: TimelineItem[] = slicedData.map((row, index) => {
      const title = String(row[this.config.titleKey] || "");
      const subtitle = this.config.subtitleKey
        ? String(row[this.config.subtitleKey] || "")
        : undefined;
      const timestamp = this.config.timestampKey
        ? formatTimestamp(row[this.config.timestampKey])
        : undefined;
      const comment = this.config.commentKey
        ? String(row[this.config.commentKey] || "")
        : undefined;
      const icon = this.config.iconKey
        ? String(row[this.config.iconKey] || "")
        : undefined;

      // Determine status
      let status: TimelineItem["status"] = "pending";

      if (activeStepValue != null && this.config.activeMatchKey) {
        const matchValue = row[this.config.activeMatchKey];
        if (matchValue === activeStepValue) {
          status = "active";
          activeIndex = index;
        } else if (activeIndex >= 0) {
          status = "pending"; // After active
        } else {
          status = "completed"; // Before active
        }
      } else if (this.config.statusKey) {
        const rawStatus = String(row[this.config.statusKey] || "");
        status = mapStatusValue(rawStatus);
      } else {
        // Default: all items are "completed" in a history view
        status = "completed";
      }

      return {
        key: String(row.id || row.step_key || index),
        title,
        subtitle,
        timestamp,
        comment: comment && comment !== "undefined" && comment !== "null" ? comment : undefined,
        status,
        icon,
        raw: row,
      };
    });

    const completedSteps = items.filter((i) => i.status === "completed").length;

    return {
      items,
      activeIndex,
      totalSteps: items.length,
      completedSteps,
    };
  }

  /** Get config */
  getConfig(): TimelineConfig {
    return this.config;
  }
}

// ── Helpers ──────────────────────────────────────────────────

function formatTimestamp(value: unknown): string {
  if (!value) return "";
  const date = new Date(String(value));
  if (isNaN(date.getTime())) return String(value);

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

function mapStatusValue(value: string): TimelineItem["status"] {
  const lower = value.toLowerCase();

  if (["completed", "done", "approved", "reimbursed", "success"].includes(lower)) {
    return "completed";
  }
  if (["active", "running", "in_progress", "current", "pending_manager", "pending_finance", "pending_department_head"].includes(lower)) {
    return "active";
  }
  if (["failed", "error", "rejected"].includes(lower)) {
    return "failed";
  }
  if (["skipped", "cancelled"].includes(lower)) {
    return "skipped";
  }

  return "pending";
}

// ── Serialization for Bundle ─────────────────────────────────

/** Generate timeline processing code for the bundled runtime */
export function generateTimelineBundle(): string {
  return `
// Timeline processor
function processTimeline(data, config, activeStepValue) {
  let activeIndex = -1;
  const items = data.map(function(row, index) {
    const title = String(row[config.titleKey] || "");
    const subtitle = config.subtitleKey ? String(row[config.subtitleKey] || "") : undefined;
    const timestamp = config.timestampKey ? row[config.timestampKey] : undefined;
    const comment = config.commentKey ? String(row[config.commentKey] || "") : undefined;

    let status = "pending";
    if (activeStepValue != null && config.activeMatchKey) {
      if (row[config.activeMatchKey] === activeStepValue) { status = "active"; activeIndex = index; }
      else if (activeIndex >= 0) { status = "pending"; }
      else { status = "completed"; }
    } else if (config.statusKey) {
      const s = String(row[config.statusKey] || "").toLowerCase();
      if (["completed","done","approved","reimbursed","success"].indexOf(s) >= 0) status = "completed";
      else if (["active","running","current"].indexOf(s) >= 0) status = "active";
      else if (["failed","error","rejected"].indexOf(s) >= 0) status = "failed";
      else if (["skipped","cancelled"].indexOf(s) >= 0) status = "skipped";
    } else { status = "completed"; }

    return { key: String(row.id || row.step_key || index), title: title, subtitle: subtitle, timestamp: timestamp, comment: comment, status: status, raw: row };
  });
  return { items: items, activeIndex: activeIndex, totalSteps: items.length, completedSteps: items.filter(function(i) { return i.status === "completed"; }).length };
}`;
}
