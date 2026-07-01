"use client";

// ═══════════════════════════════════════════════════════════════
// PoliciesView — Row-Level Security policy editor for a table.
// Policies live in figmaStore (table.policies); on Deploy the SQL
// generator emits ENABLE ROW LEVEL SECURITY + CREATE POLICY.
// ═══════════════════════════════════════════════════════════════

import React from "react";
import { Plus, Trash2, ShieldCheck } from "lucide-react";
import { useFigmaStore, type DbTable, type DbPolicy } from "@/lib/stores/figmaStore";
import { C, inputStyle } from "./dbStudioTheme";

const OPERATIONS: DbPolicy["operation"][] = ["all", "select", "insert", "update", "delete"];

export default function PoliciesView({ table }: { table: DbTable }) {
  const addPolicy = useFigmaStore((s) => s.addPolicy);
  const updatePolicy = useFigmaStore((s) => s.updatePolicy);
  const deletePolicy = useFigmaStore((s) => s.deletePolicy);
  const policies = table.policies ?? [];

  // USING applies to read/modify; WITH CHECK applies to rows being written.
  const showUsing = (op: DbPolicy["operation"]) => op !== "insert";
  const showCheck = (op: DbPolicy["operation"]) => op === "insert" || op === "update" || op === "all";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: C.canvas, overflow: "hidden" }}>
      <div style={{ height: 40, display: "flex", alignItems: "center", gap: 10, padding: "0 12px",
        borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <ShieldCheck size={13} style={{ color: C.accent }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: C.text, fontFamily: "monospace" }}>{table.name}</span>
        <span style={{ fontSize: 10, color: C.textDim }}>
          {policies.length === 0 ? "RLS off — no policies" : `RLS on · ${policies.length} polic${policies.length !== 1 ? "ies" : "y"}`}
        </span>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => addPolicy(table.id, { name: `${table.name}_policy_${policies.length + 1}`, operation: "select", role: "", condition: "true" })}
          style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 6, border: "none",
            background: C.accent, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
          <Plus size={12} /> New policy
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {policies.length === 0 ? (
          <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: C.textDim }}>
            <ShieldCheck size={36} style={{ color: "#333" }} />
            <p style={{ fontSize: 12, margin: 0 }}>No policies. The table is unrestricted until you add one.</p>
            <p style={{ fontSize: 10, margin: 0 }}>Adding a policy enables Row-Level Security on deploy.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 720 }}>
            {policies.map((p, i) => (
              <div key={i} style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 8, padding: 14 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
                  <input value={p.name} spellCheck={false}
                    onChange={(e) => updatePolicy(table.id, i, { name: e.target.value.replace(/[^a-zA-Z0-9_]/g, "_") })}
                    style={{ ...inputStyle, flex: 1, fontSize: 12, fontWeight: 600 }} />
                  <button onClick={() => deletePolicy(table.id, i)}
                    style={{ background: "none", border: "none", color: C.textDim, cursor: "pointer", padding: 4, flexShrink: 0 }}>
                    <Trash2 size={13} />
                  </button>
                </div>
                <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                  <Field label="Operation">
                    <select value={p.operation} onChange={(e) => updatePolicy(table.id, i, { operation: e.target.value as DbPolicy["operation"] })}
                      style={{ ...inputStyle, cursor: "pointer", textTransform: "uppercase" }}>
                      {OPERATIONS.map((op) => <option key={op} value={op}>{op}</option>)}
                    </select>
                  </Field>
                  <Field label="Role — blank = all (must exist in DB)">
                    <input value={p.role ?? ""} spellCheck={false} placeholder="(all roles)"
                      onChange={(e) => updatePolicy(table.id, i, { role: e.target.value })} style={inputStyle} />
                  </Field>
                </div>
                {showUsing(p.operation) && (
                  <Field label="USING — rows visible / affected (SQL boolean)">
                    <input value={p.condition ?? ""} spellCheck={false} placeholder="auth.uid() = user_id"
                      onChange={(e) => updatePolicy(table.id, i, { condition: e.target.value })} style={inputStyle} />
                  </Field>
                )}
                {showCheck(p.operation) && (
                  <div style={{ marginTop: 8 }}>
                    <Field label="WITH CHECK — rows allowed to write (SQL boolean)">
                      <input value={p.check ?? ""} spellCheck={false} placeholder="auth.uid() = user_id"
                        onChange={(e) => updatePolicy(table.id, i, { check: e.target.value })} style={inputStyle} />
                    </Field>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
      <span style={{ fontSize: 9, color: C.textDim, fontFamily: "monospace" }}>{label}</span>
      {children}
    </label>
  );
}
