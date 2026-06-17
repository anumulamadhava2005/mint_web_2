"use client";

import React, { useMemo, useState, useCallback } from "react";
import {
  DataTableEngine,
  formatCellValue,
} from "@/lib/runtime/components/data-table";
import type {
  DataTableConfig,
  DataTableColumn,
} from "@/lib/runtime/components/configs";

interface DataTableProps {
  config: DataTableConfig;
  data: Record<string, unknown>[];
  onRowClick?: (row: Record<string, unknown>) => void;
}

export default function DataTable({ config, data, onRowClick }: DataTableProps) {
  const [, forceUpdate] = useState(0);
  const engine = useMemo(() => new DataTableEngine(config), [config]);

  const rerender = useCallback(() => forceUpdate((n) => n + 1), []);

  const result = engine.process(data);

  const handleSort = (key: string) => {
    engine.setSort(key);
    rerender();
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    engine.setSearch(e.target.value);
    rerender();
  };

  const handlePage = (page: number) => {
    engine.setPage(page);
    rerender();
  };

  return (
    <div data-testid="data-table" style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: 14 }}>
      {/* Search */}
      {config.searchable && (
        <div style={{ marginBottom: 12 }}>
          <input
            type="text"
            placeholder={config.searchPlaceholder || "Search…"}
            onChange={handleSearch}
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #D1D5DB",
              outline: "none",
              fontSize: 14,
            }}
          />
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid #E5E7EB" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#F9FAFB" }}>
              {config.columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  style={{
                    padding: config.compact ? "6px 10px" : "10px 14px",
                    textAlign: "left",
                    fontWeight: 600,
                    color: "#374151",
                    borderBottom: "1px solid #E5E7EB",
                    cursor: col.sortable !== false ? "pointer" : "default",
                    userSelect: "none",
                    whiteSpace: "nowrap",
                    width: col.width,
                  }}
                >
                  {col.label}
                  {result.sortKey === col.key && (
                    <span style={{ marginLeft: 4, fontSize: 12 }}>
                      {result.sortDirection === "asc" ? "▲" : "▼"}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={config.columns.length}
                  style={{ padding: 24, textAlign: "center", color: "#9CA3AF" }}
                >
                  {config.emptyMessage || "No data"}
                </td>
              </tr>
            ) : (
              result.rows.map((row, idx) => (
                <tr
                  key={String(row[config.rowKey || "id"] || idx)}
                  onClick={() => onRowClick?.(row)}
                  style={{
                    cursor: onRowClick ? "pointer" : "default",
                    background: config.striped && idx % 2 === 1 ? "#F9FAFB" : "white",
                    borderBottom: "1px solid #F3F4F6",
                  }}
                >
                  {config.columns.map((col) => (
                    <td
                      key={col.key}
                      style={{
                        padding: config.compact ? "6px 10px" : "10px 14px",
                        color: "#1F2937",
                      }}
                    >
                      {col.type === "status" ? (
                        <StatusBadge value={String(row[col.key] || "")} />
                      ) : (
                        formatCellValue(row[col.key], col)
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {config.pagination?.enabled && result.totalPages > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 0",
            fontSize: 13,
            color: "#6B7280",
          }}
        >
          <span>
            {result.totalRows} result{result.totalRows !== 1 ? "s" : ""}
          </span>
          <div style={{ display: "flex", gap: 4 }}>
            <PageBtn disabled={!result.hasPrev} onClick={() => handlePage(result.currentPage - 1)}>
              ← Prev
            </PageBtn>
            <span style={{ padding: "4px 8px" }}>
              {result.currentPage} / {result.totalPages}
            </span>
            <PageBtn disabled={!result.hasNext} onClick={() => handlePage(result.currentPage + 1)}>
              Next →
            </PageBtn>
          </div>
        </div>
      )}
    </div>
  );
}

function PageBtn({ disabled, onClick, children }: { disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        padding: "4px 10px",
        borderRadius: 4,
        border: "1px solid #D1D5DB",
        background: disabled ? "#F3F4F6" : "white",
        color: disabled ? "#D1D5DB" : "#374151",
        cursor: disabled ? "not-allowed" : "pointer",
        fontSize: 13,
      }}
    >
      {children}
    </button>
  );
}

function StatusBadge({ value }: { value: string }) {
  const COLORS: Record<string, string> = {
    approved: "#10B981", rejected: "#EF4444", draft: "#6B7280",
    pending_manager: "#F59E0B", pending_finance: "#3B82F6",
    reimbursed: "#8B5CF6", changes_requested: "#F97316",
  };
  const color = COLORS[value] || "#6B7280";
  const label = value.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: 9999,
        fontSize: 12,
        fontWeight: 500,
        background: color + "18",
        color,
      }}
    >
      {label}
    </span>
  );
}
