// ═══════════════════════════════════════════════════════════════
// Data Table Engine — Client-side sort, search, filter, pagination
//
// Framework-agnostic logic that can be used by React, Vue, or
// the bundled runtime. UI renderers call these functions.
// ═══════════════════════════════════════════════════════════════

import type { DataTableConfig, DataTableColumn } from "./configs";

// ── Types ────────────────────────────────────────────────────

export interface DataTableState {
  page: number;
  pageSize: number;
  sortKey: string | null;
  sortDirection: "asc" | "desc";
  searchQuery: string;
  filters: Record<string, unknown>;
  selectedRows: Set<string>;
}

export interface DataTableResult {
  rows: Record<string, unknown>[];
  totalRows: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  sortKey: string | null;
  sortDirection: "asc" | "desc";
  hasNext: boolean;
  hasPrev: boolean;
}

// ── Engine ───────────────────────────────────────────────────

export class DataTableEngine {
  private config: DataTableConfig;
  private state: DataTableState;

  constructor(config: DataTableConfig) {
    this.config = config;
    this.state = {
      page: 1,
      pageSize: config.pagination?.pageSize || 10,
      sortKey: config.defaultSort?.key || null,
      sortDirection: config.defaultSort?.direction || "asc",
      searchQuery: "",
      filters: {},
      selectedRows: new Set(),
    };
  }

  /** Process raw data through search → filter → sort → paginate pipeline */
  process(rawData: Record<string, unknown>[]): DataTableResult {
    let rows = [...rawData];

    // 1. Search
    if (this.state.searchQuery && this.config.searchable) {
      const query = this.state.searchQuery.toLowerCase();
      const searchFields = this.config.searchFields ||
        this.config.columns.map((c) => c.key);

      rows = rows.filter((row) =>
        searchFields.some((field) => {
          const val = row[field];
          return val != null && String(val).toLowerCase().includes(query);
        })
      );
    }

    // 2. Column filters
    for (const [key, filterVal] of Object.entries(this.state.filters)) {
      if (filterVal == null || filterVal === "" || filterVal === "all") continue;
      rows = rows.filter((row) => {
        const val = row[key];
        if (Array.isArray(filterVal)) {
          return (filterVal as unknown[]).includes(val);
        }
        return String(val) === String(filterVal);
      });
    }

    const totalRows = rows.length;

    // 3. Sort
    if (this.state.sortKey) {
      const key = this.state.sortKey;
      const dir = this.state.sortDirection === "asc" ? 1 : -1;
      const col = this.config.columns.find((c) => c.key === key);

      rows.sort((a, b) => {
        const aVal = a[key];
        const bVal = b[key];

        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return dir;
        if (bVal == null) return -dir;

        // Numeric sort for number/currency types
        if (col?.type === "number" || col?.type === "currency") {
          return (Number(aVal) - Number(bVal)) * dir;
        }

        // Date sort
        if (col?.type === "date") {
          return (new Date(String(aVal)).getTime() - new Date(String(bVal)).getTime()) * dir;
        }

        // String sort
        return String(aVal).localeCompare(String(bVal)) * dir;
      });
    }

    // 4. Paginate
    const pageSize = this.state.pageSize;
    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
    const page = Math.min(this.state.page, totalPages);
    const start = (page - 1) * pageSize;
    const paginatedRows = this.config.pagination?.enabled
      ? rows.slice(start, start + pageSize)
      : rows;

    return {
      rows: paginatedRows,
      totalRows,
      totalPages,
      currentPage: page,
      pageSize,
      sortKey: this.state.sortKey,
      sortDirection: this.state.sortDirection,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  // ── State Mutations ────────────────────────────────────────

  setPage(page: number): void {
    this.state.page = Math.max(1, page);
  }

  setPageSize(size: number): void {
    this.state.pageSize = size;
    this.state.page = 1; // Reset to first page
  }

  setSort(key: string): void {
    if (this.state.sortKey === key) {
      this.state.sortDirection = this.state.sortDirection === "asc" ? "desc" : "asc";
    } else {
      this.state.sortKey = key;
      this.state.sortDirection = "asc";
    }
    this.state.page = 1;
  }

  setSearch(query: string): void {
    this.state.searchQuery = query;
    this.state.page = 1;
  }

  setFilter(column: string, value: unknown): void {
    this.state.filters[column] = value;
    this.state.page = 1;
  }

  clearFilters(): void {
    this.state.filters = {};
    this.state.searchQuery = "";
    this.state.page = 1;
  }

  toggleRowSelection(rowKey: string): void {
    if (this.state.selectedRows.has(rowKey)) {
      this.state.selectedRows.delete(rowKey);
    } else {
      this.state.selectedRows.add(rowKey);
    }
  }

  selectAll(rows: Record<string, unknown>[]): void {
    const keyField = this.config.rowKey || "id";
    for (const row of rows) {
      const key = String(row[keyField] || "");
      if (key) this.state.selectedRows.add(key);
    }
  }

  clearSelection(): void {
    this.state.selectedRows.clear();
  }

  isSelected(rowKey: string): boolean {
    return this.state.selectedRows.has(rowKey);
  }

  getSelectedRows(): string[] {
    return Array.from(this.state.selectedRows);
  }

  getState(): DataTableState {
    return { ...this.state, selectedRows: new Set(this.state.selectedRows) };
  }

  /** Get unique values for a column (for filter dropdowns) */
  getColumnValues(data: Record<string, unknown>[], column: string): unknown[] {
    const values = new Set<unknown>();
    for (const row of data) {
      if (row[column] != null) values.add(row[column]);
    }
    return Array.from(values).sort();
  }
}

// ── Formatting Helpers ───────────────────────────────────────

export function formatCellValue(
  value: unknown,
  column: DataTableColumn
): string {
  if (value == null) return "—";

  switch (column.type) {
    case "currency": {
      const num = Number(value);
      const format = column.format || "USD";
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: format,
      }).format(num);
    }
    case "date": {
      const date = new Date(String(value));
      if (isNaN(date.getTime())) return String(value);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
    case "number":
      return Number(value).toLocaleString();
    case "status":
      return String(value).replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
    default:
      return String(value);
  }
}
