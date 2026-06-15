// ═══════════════════════════════════════════════════════════════
// Component Configs — Schema definitions for complex components
//
// These define the configuration shapes for DataTable, Timeline,
// FileUpload, StatusChip, Tabs, and other rich components.
// ═══════════════════════════════════════════════════════════════

// ── Data Table ───────────────────────────────────────────────

export interface DataTableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  filterable?: boolean;
  width?: number | string;
  type?: "text" | "number" | "currency" | "date" | "status" | "avatar" | "actions";
  format?: string;           // e.g., "USD" for currency, "MMM DD" for date
  enumValues?: string[];     // for filter dropdown options
  render?: string;           // expression for custom rendering
}

export interface DataTableConfig {
  columns: DataTableColumn[];
  dataSource: string;         // expression: "$local.myExpenses"
  searchable?: boolean;
  searchPlaceholder?: string;
  searchFields?: string[];    // fields to search across
  pagination?: {
    enabled: boolean;
    pageSize: number;
    pageSizeOptions?: number[];
  };
  sortable?: boolean;
  defaultSort?: { key: string; direction: "asc" | "desc" };
  onRowClick?: string;        // action ref
  emptyMessage?: string;
  selectable?: boolean;
  rowKey?: string;            // unique identifier field, default "id"
  striped?: boolean;
  compact?: boolean;
}

// ── Timeline ─────────────────────────────────────────────────

export interface TimelineConfig {
  dataSource: string;          // "$local.workflowSteps" or "$local.approvalHistory"
  titleKey: string;            // "label" or "action"
  subtitleKey?: string;        // "approver_role" or "actor_name"
  timestampKey?: string;       // "created_at"
  statusKey?: string;          // "status"
  commentKey?: string;         // "comment"
  iconKey?: string;            // optional icon field
  orientation: "vertical" | "horizontal";
  activeStepExpression?: string;  // "$local.activeExpense.current_step_key"
  activeMatchKey?: string;       // "step_key" — field to match against activeStepExpression
  connectorStyle?: "solid" | "dashed";
  showTimestamps?: boolean;
  showComments?: boolean;
  maxItems?: number;
}

// ── File Upload ──────────────────────────────────────────────

export interface FileUploadConfig {
  accept?: string;            // "image/*,.pdf"
  maxSize?: number;           // bytes, default 10MB
  maxFiles?: number;          // default 1
  multiple?: boolean;
  storePath: string;          // state path to store URL(s)
  uploadUrl?: string;         // API endpoint, default "/api/upload"
  previewEnabled?: boolean;
  dropZone?: boolean;
  label?: string;
  hint?: string;
}

// ── Status Chip ──────────────────────────────────────────────

export interface StatusChipConfig {
  value: string;              // expression or static value
  variant?: "filled" | "outlined" | "subtle";
  size?: "sm" | "md" | "lg";
  colorMap?: Record<string, string>;  // status value → color
  labelMap?: Record<string, string>;  // status value → display label
  icon?: string;
}

// Default status color map for expense app
export const DEFAULT_STATUS_COLORS: Record<string, string> = {
  draft: "#6B7280",
  pending_manager: "#F59E0B",
  pending_department_head: "#F59E0B",
  pending_finance: "#3B82F6",
  approved: "#10B981",
  rejected: "#EF4444",
  changes_requested: "#F97316",
  reimbursed: "#8B5CF6",
  active: "#3B82F6",
  completed: "#10B981",
  // Generic
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#3B82F6",
  default: "#6B7280",
};

// Default status label map
export const DEFAULT_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending_manager: "Pending Manager",
  pending_department_head: "Pending Dept Head",
  pending_finance: "Pending Finance",
  approved: "Approved",
  rejected: "Rejected",
  changes_requested: "Changes Requested",
  reimbursed: "Reimbursed",
  active: "Active",
  completed: "Completed",
};

// ── Tabs ─────────────────────────────────────────────────────

export interface TabsConfig {
  tabs: {
    key: string;
    label: string;
    icon?: string;
    badge?: string;            // expression for badge count
    content?: string;          // component ID to show
    requiredRoles?: string[];  // role-based tab visibility
  }[];
  activeTab?: string;          // expression for active tab
  onTabChange?: string;        // action ref
  variant?: "underline" | "pills" | "enclosed";
  orientation?: "horizontal" | "vertical";
}

// ── Avatar ───────────────────────────────────────────────────

export interface AvatarConfig {
  src?: string;               // image URL expression
  name?: string;              // fallback to initials
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  shape?: "circle" | "square";
  status?: "online" | "offline" | "busy" | "away";
}

// ── Badge ────────────────────────────────────────────────────

export interface BadgeConfig {
  value: string;              // expression
  color?: string;
  variant?: "filled" | "outlined" | "dot";
  max?: number;               // show "99+" when exceeded
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
}

// ── Date Picker ──────────────────────────────────────────────

export interface DatePickerConfig {
  value: string;              // state binding
  format?: string;            // "YYYY-MM-DD" default
  minDate?: string;           // expression
  maxDate?: string;           // expression
  placeholder?: string;
  clearable?: boolean;
}

// ── Search Input ─────────────────────────────────────────────

export interface SearchInputConfig {
  value: string;              // state binding
  placeholder?: string;
  debounce?: number;          // ms, default 300
  onSearch?: string;          // action ref
  clearable?: boolean;
  icon?: boolean;
}

// ── Drawer ───────────────────────────────────────────────────

export interface DrawerConfig {
  isOpen: string;             // state binding (boolean)
  position?: "left" | "right" | "bottom";
  size?: "sm" | "md" | "lg" | "full";
  onClose?: string;           // action ref
  overlay?: boolean;
  closable?: boolean;
}

// ── Accordion ────────────────────────────────────────────────

export interface AccordionConfig {
  items: {
    key: string;
    title: string;
    subtitle?: string;
    icon?: string;
  }[];
  multiple?: boolean;          // allow multiple open
  defaultOpen?: string[];      // keys of initially open items
  variant?: "default" | "bordered" | "separated";
}
