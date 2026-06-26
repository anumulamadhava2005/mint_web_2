"use client";

// ═══════════════════════════════════════════════════════════════
// DatabaseEditor — Visual ERD / schema editor. 3-column layout:
// table list sidebar | card grid canvas | field inspector.
// Binds to useRuntimeStore database CRUD.
// ═══════════════════════════════════════════════════════════════

import { useState, useCallback, useMemo } from "react";
import { v4 as uuid } from "uuid";
import {
  Plus, Trash2, Settings, Key, Link2, Code2, AlertCircle,
  ChevronRight, Table2, Columns, Sliders, Users, Rocket,
} from "lucide-react";
import { useRuntimeStore } from "@/lib/runtime/runtime-store";
import type { TableSchema, FieldSchema, RelationSchema } from "@/lib/runtime/schema";
import {
  Inspector, InspectorTabs, Section, Field, TextField, SelectField,
  ToggleRow, Btn, IconBtn, Pill, cx, EmptyState,
} from "./primitives";

// ── Local types ───────────────────────────────────────────────────

type InspTab = "props" | "style" | "events" | "collab";
type Sel = { tableId: string; fieldName: string } | null;

const FTYPES: FieldSchema["type"][] = ["uuid","text","integer","float","boolean","timestamp","jsonb"];
const RTYPES: RelationSchema["type"][] = ["one-to-one","one-to-many","many-to-many"];

// ── SQL generation ────────────────────────────────────────────────

export function genSQL(tables: TableSchema[]): string {
  const pgType: Record<string, string> = {
    uuid: "UUID", text: "TEXT", integer: "INTEGER", float: "FLOAT",
    boolean: "BOOLEAN", timestamp: "TIMESTAMPTZ", jsonb: "JSONB",
  };
  return tables.map((t) => {
    const cols = t.fields.map((f) => {
      const pk = f.name === "id" ? " PRIMARY KEY" : "";
      const nn = f.required ? " NOT NULL" : "";
      const uq = f.unique && !pk ? " UNIQUE" : "";
      return `  ${f.name} ${pgType[f.type] ?? "TEXT"}${pk}${nn}${uq}`;
    });
    const fks = t.relations.map((r) =>
      `  FOREIGN KEY (${r.foreignKey}) REFERENCES ${r.targetTable}(${r.targetKey ?? "id"})`
    );
    return `CREATE TABLE IF NOT EXISTS ${t.name} (\n${[...cols, ...fks].join(",\n")}\n);`;
  }).join("\n\n");
}

// ── TypeChip ──────────────────────────────────────────────────────

const TYPE_COLOR: Record<string, string> = {
  uuid: "var(--st-brand)", text: "var(--st-success)", integer: "var(--st-warning)",
  float: "var(--st-warning)", boolean: "#60a5fa", timestamp: "var(--st-text-2)", jsonb: "var(--st-error)",
};

function TypeChip({ type }: { type: string }) {
  return (
    <span
      className="rounded-[var(--st-r-sm)] px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide"
      style={{ background: "var(--st-surface-2)", color: TYPE_COLOR[type] ?? "var(--st-text-2)" }}
    >{type}</span>
  );
}

// ── TableCard ─────────────────────────────────────────────────────

function TableCard({ table, allTables, sel, onSel, onAddField }: {
  table: TableSchema; allTables: TableSchema[]; sel: Sel;
  onSel: (s: Sel) => void; onAddField: (id: string) => void;
}) {
  return (
    <div
      className="flex flex-col overflow-hidden rounded-[var(--st-r-lg)]"
      style={{ background: "var(--st-elevated)", boxShadow: "var(--st-shadow-raised)", border: "1px solid var(--st-border)", minWidth: 260, maxWidth: 320, width: "100%" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: "1px solid var(--st-border)", background: "var(--st-surface)" }}>
        <div className="flex min-w-0 items-center gap-2">
          <Table2 size={13} style={{ color: "var(--st-brand)", flexShrink: 0 }} />
          <span className="truncate text-[12.5px] font-semibold font-[family-name:var(--st-mono)]" style={{ color: "var(--st-text)" }}>{table.name}</span>
          <Pill tone="brand">{table.fields.length} cols</Pill>
        </div>
        <IconBtn title="Table settings"><Settings size={13} /></IconBtn>
      </div>
      {/* Fields */}
      <div className="flex flex-col divide-y" style={{ borderColor: "var(--st-border)" }}>
        {table.fields.map((f) => {
          const active = sel?.tableId === table.id && sel?.fieldName === f.name;
          return (
            <button key={f.name} type="button"
              onClick={() => onSel(active ? null : { tableId: table.id, fieldName: f.name })}
              className="flex items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/[0.04]"
              style={{ background: active ? "var(--st-brand-tint)" : undefined, borderLeft: active ? "2px solid var(--st-brand)" : "2px solid transparent" }}
            >
              <span className="w-3 shrink-0">
                {f.name === "id" ? <Key size={11} style={{ color: "var(--st-warning)" }} /> : f.name.endsWith("_id") ? <Link2 size={11} style={{ color: "var(--st-text-3)" }} /> : null}
              </span>
              <span className="flex-1 truncate text-[12px] font-[family-name:var(--st-mono)]" style={{ color: "var(--st-text)" }}>{f.name}</span>
              <TypeChip type={f.type} />
              <div className="flex items-center gap-1">
                {f.required && <span title="Required" style={{ color: "var(--st-error)", fontSize: 10 }}>*</span>}
                {f.unique && <span title="Unique" style={{ color: "var(--st-brand)", fontSize: 9 }}>U</span>}
              </div>
            </button>
          );
        })}
      </div>
      {/* Relations */}
      {table.relations.length > 0 && (
        <div className="flex flex-wrap gap-1 px-3 py-2" style={{ borderTop: "1px solid var(--st-border)" }}>
          {table.relations.map((r, i) => {
            const tgt = allTables.find((t) => t.id === r.targetTable || t.name === r.targetTable)?.name ?? r.targetTable;
            return (
              <div key={i} className="flex items-center gap-1">
                <ChevronRight size={10} style={{ color: "var(--st-text-3)" }} />
                <span className="text-[10px]" style={{ color: "var(--st-text-3)" }}>{r.foreignKey} → {tgt}.{r.targetKey ?? "id"}</span>
              </div>
            );
          })}
        </div>
      )}
      {/* Add field */}
      <div className="px-3 py-2" style={{ borderTop: "1px solid var(--st-border)" }}>
        <Btn variant="ghost" size="sm" className="w-full justify-center gap-1" onClick={() => onAddField(table.id)} style={{ color: "var(--st-text-3)" }}>
          <Plus size={12} /> Add Field
        </Btn>
      </div>
    </div>
  );
}

// ── FieldInspector ────────────────────────────────────────────────

function FieldInspector({ sel, tables }: { sel: Sel; tables: TableSchema[] }) {
  const { updateField, addRelation, removeRelation } = useRuntimeStore();
  const [tab, setTab] = useState<InspTab>("props");

  const table = tables.find((t) => t.id === sel?.tableId);
  const field = table?.fields.find((f) => f.name === sel?.fieldName);

  const upd = useCallback((updates: Partial<FieldSchema>) => {
    if (!sel) return;
    updateField(sel.tableId, sel.fieldName, updates);
  }, [sel, updateField]);

  const addRel = useCallback(() => {
    if (!sel) return;
    const other = tables.find((t) => t.id !== sel.tableId);
    if (!other) return;
    addRelation(sel.tableId, { type: "one-to-many", targetTable: other.name, foreignKey: sel.fieldName, targetKey: "id" });
  }, [sel, tables, addRelation]);

  const inspTabs = [
    { id: "props" as InspTab, icon: <Sliders size={13} />, label: "Properties" },
    { id: "style" as InspTab, icon: <Columns size={13} />, label: "Style" },
    { id: "events" as InspTab, icon: <AlertCircle size={13} />, label: "Events" },
    { id: "collab" as InspTab, icon: <Users size={13} />, label: "Collaborators" },
  ];

  // suppress unused cx warning
  void cx;

  return (
    <Inspector title="INSPECTOR" tabs={<InspectorTabs tabs={inspTabs} value={tab} onChange={setTab} />}>
      {!field || !table ? (
        <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
          <Columns size={28} style={{ color: "var(--st-border-3)" }} />
          <p className="text-[12px]" style={{ color: "var(--st-text-3)" }}>Select a field to configure</p>
        </div>
      ) : (
        <>
          <Section title="General">
            <Field label="Field Name" htmlFor="db-fn">
              <TextField id="db-fn" mono value={field.name} onChange={(e) => upd({ name: e.target.value })} />
            </Field>
            <Field label="Type" htmlFor="db-ft">
              <SelectField id="db-ft" value={field.type} onChange={(e) => upd({ type: e.target.value as FieldSchema["type"] })}>
                {FTYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </SelectField>
            </Field>
          </Section>

          <Section title="Constraints">
            <ToggleRow label="Required" hint="NOT NULL constraint" checked={field.required} onChange={(v) => upd({ required: v })} />
            <ToggleRow label="Unique" hint="UNIQUE constraint" checked={field.unique} onChange={(v) => upd({ unique: v })} />
            <Field label="Default Value">
              <TextField mono value={String(field.default ?? "")} placeholder="e.g. now(), true, ''" onChange={(e) => upd({ default: e.target.value || undefined })} />
            </Field>
          </Section>

          <Section title="Relations" badge={table.relations.length || undefined} right={<Btn variant="ghost" size="sm" onClick={addRel}><Plus size={11} /> Add</Btn>}>
            {table.relations.length === 0 ? (
              <p className="text-[11px]" style={{ color: "var(--st-text-3)" }}>No relations yet.</p>
            ) : (
              table.relations.map((r, idx) => (
                <div key={idx} className="mb-2 rounded-[var(--st-r-md)] p-2.5 last:mb-0" style={{ background: "var(--st-surface-2)", border: "1px solid var(--st-border)" }}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <SelectField value={r.type} style={{ fontSize: 11 }}
                      onChange={(e) => {
                        const u = { ...r, type: e.target.value as RelationSchema["type"] };
                        removeRelation(table.id, idx);
                        addRelation(table.id, u);
                      }}
                    >
                      {RTYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </SelectField>
                    <IconBtn onClick={() => removeRelation(table.id, idx)} title="Remove"><Trash2 size={12} style={{ color: "var(--st-error)" }} /></IconBtn>
                  </div>
                  <div className="flex items-center gap-1 text-[10.5px]" style={{ color: "var(--st-text-3)" }}>
                    <span style={{ color: "var(--st-text)" }}>{r.foreignKey}</span>
                    <ChevronRight size={10} />
                    <span style={{ color: "var(--st-brand)" }}>{r.targetTable}</span>
                    <span>.{r.targetKey ?? "id"}</span>
                  </div>
                </div>
              ))
            )}
          </Section>
        </>
      )}
    </Inspector>
  );
}

// ── Deploy result type ────────────────────────────────────────────
type DeployResult = { success: boolean; applied: string[]; errors: string[]; totalTables: number } | null;

// ── Main component ────────────────────────────────────────────────

export function DatabaseEditor({ projectId }: { projectId?: string }) {
  const { schema, addTable, updateTable, removeTable, addField } = useRuntimeStore();

  const tables: TableSchema[] = schema.database?.tables ?? [];

  const [selTableId, setSelTableId] = useState<string | null>(tables[0]?.id ?? null);
  const [sel, setSel] = useState<Sel>(null);
  const [rawSQL, setRawSQL] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<DeployResult>(null);

  const handleDeploy = useCallback(async () => {
    if (!projectId) {
      setDeployResult({ success: false, applied: [], errors: ["No projectId — cannot deploy"], totalTables: 0 });
      return;
    }
    if (!tables.length) {
      setDeployResult({ success: false, applied: [], errors: ["No tables defined. Add tables first."], totalTables: 0 });
      return;
    }
    setDeploying(true);
    setDeployResult(null);
    try {
      const res = await fetch(`/api/db/migrate/${projectId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schema: schema.database }),
      });
      const json = await res.json();
      if (!res.ok) {
        setDeployResult({ success: false, applied: [], errors: [json.error ?? `HTTP ${res.status}`], totalTables: tables.length });
      } else {
        setDeployResult(json);
      }
    } catch (e: any) {
      setDeployResult({ success: false, applied: [], errors: [e?.message ?? "Network error — DB bridge unreachable"], totalTables: tables.length });
    }
    setDeploying(false);
  }, [projectId, tables, schema.database]);

  const addNewTable = useCallback(() => {
    const id = uuid();
    addTable({ id, name: `table_${tables.length + 1}`, fields: [{ name: "id", type: "uuid", required: true, unique: true }], relations: [], indexes: [], policies: [] });
    setSelTableId(id);
  }, [addTable, tables.length]);

  const deleteTable = useCallback((id: string) => {
    removeTable(id);
    if (selTableId === id) setSelTableId(tables.find((t) => t.id !== id)?.id ?? null);
    if (sel?.tableId === id) setSel(null);
  }, [removeTable, selTableId, sel, tables]);

  const addNewField = useCallback((tableId: string) => {
    const tbl = tables.find((t) => t.id === tableId);
    if (!tbl) return;
    const name = `field_${tbl.fields.length + 1}`;
    addField(tableId, { name, type: "text", required: false, unique: false });
    setSel({ tableId, fieldName: name });
  }, [addField, tables]);

  const sql = useMemo(() => genSQL(tables), [tables]);

  if (tables.length === 0) {
    return (
      <EmptyState
        icon={<Table2 size={22} />}
        title="No tables yet"
        description="Add your first table to define the database schema for this app."
        action={<Btn variant="primary" size="sm" onClick={addNewTable}>Add Table</Btn>}
      />
    );
  }

  return (
    <div className="flex h-full w-full overflow-hidden" style={{ background: "var(--st-bg)" }}>
      {/* Sidebar */}
      <aside className="flex w-56 shrink-0 flex-col border-r" style={{ background: "var(--st-surface)", borderColor: "var(--st-border)" }}>
        <div className="flex h-11 shrink-0 items-center justify-between border-b px-3" style={{ borderColor: "var(--st-border)" }}>
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--st-text-2)" }}>Database</span>
          <IconBtn onClick={addNewTable} title="New table"><Plus size={14} /></IconBtn>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto py-1">
          {tables.length === 0 ? (
            <p className="px-3 py-4 text-center text-[11px]" style={{ color: "var(--st-text-3)" }}>No tables yet</p>
          ) : tables.map((t) => {
            const active = t.id === selTableId;
            return (
              <div key={t.id} className="group relative flex cursor-pointer items-center gap-2 px-3 py-2 transition-colors"
                style={{ background: active ? "var(--st-brand-tint)" : undefined, borderLeft: active ? "2px solid var(--st-brand)" : "2px solid transparent" }}
                onClick={() => setSelTableId(t.id)}
              >
                <Table2 size={12} style={{ color: active ? "var(--st-brand)" : "var(--st-text-3)", flexShrink: 0 }} />
                {editId === t.id ? (
                  <input autoFocus
                    className="flex-1 bg-transparent text-[12px] font-[family-name:var(--st-mono)] outline-none"
                    style={{ color: "var(--st-text)" }}
                    defaultValue={t.name}
                    onBlur={(e) => { if (e.target.value.trim()) updateTable(t.id, { name: e.target.value.trim() }); setEditId(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur(); }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="flex-1 truncate text-[12px] font-[family-name:var(--st-mono)]"
                    style={{ color: active ? "var(--st-text)" : "var(--st-text-2)" }}
                    onDoubleClick={(e) => { e.stopPropagation(); setEditId(t.id); }}
                  >{t.name}</span>
                )}
                <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] tabular-nums" style={{ background: "var(--st-surface-2)", color: "var(--st-text-3)" }}>{t.fields.length}</span>
                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(e) => { e.stopPropagation(); deleteTable(t.id); }} title="Delete table"
                >
                  <Trash2 size={12} style={{ color: "var(--st-error)" }} />
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-1.5 border-t p-2" style={{ borderColor: "var(--st-border)" }}>
          <Btn variant={rawSQL ? "primary" : "outline"} size="sm" className="w-full justify-center gap-1.5" onClick={() => setRawSQL((v) => !v)}>
            <Code2 size={12} /> Raw SQL
          </Btn>
          <Btn
            variant="primary"
            size="sm"
            className="w-full justify-center gap-1.5"
            onClick={handleDeploy}
            disabled={deploying}
            style={{ background: "var(--st-brand)", opacity: deploying ? 0.6 : 1 }}
          >
            <Rocket size={12} />
            {deploying ? "Deploying…" : "Deploy DB"}
          </Btn>
          {deployResult && (
            <div
              className="rounded p-2 text-[10px]"
              style={{
                background: deployResult.success ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                color: deployResult.success ? "var(--st-success)" : "var(--st-error)",
                border: `1px solid ${deployResult.success ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
              }}
            >
              {deployResult.success ? (
                <>
                  <p className="font-semibold">✓ Deployed</p>
                  <p className="mt-0.5 opacity-80">{deployResult.applied.length} migration{deployResult.applied.length !== 1 ? "s" : ""} · {deployResult.totalTables} table{deployResult.totalTables !== 1 ? "s" : ""}</p>
                  <p className="mt-0.5 opacity-60 font-mono" style={{ fontSize: 9 }}>mint_proj_{projectId?.slice(0, 8)}…_{"{table}"}</p>
                </>
              ) : (
                <>
                  <p className="font-semibold">✗ Failed</p>
                  {deployResult.errors.map((e, i) => <p key={i} className="mt-0.5 opacity-80">{e}</p>)}
                </>
              )}
              <button className="mt-1 opacity-40 hover:opacity-80" style={{ fontSize: 9 }} onClick={() => setDeployResult(null)}>Dismiss</button>
            </div>
          )}
        </div>
      </aside>

      {/* Canvas */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden" style={{ background: "var(--st-canvas)" }}>
        <div className="flex-1 overflow-auto p-6">
          {tables.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <Table2 size={36} style={{ color: "var(--st-border-3)", margin: "0 auto 12px" }} />
                <p className="text-[13px]" style={{ color: "var(--st-text-3)" }}>No tables yet.</p>
                <Btn variant="primary" size="sm" className="mt-3" onClick={addNewTable}><Plus size={13} /> New Table</Btn>
              </div>
            </div>
          ) : (
            <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 320px))" }}>
              {tables.map((t) => (
                <TableCard key={t.id} table={t} allTables={tables} sel={sel}
                  onSel={(s) => { setSel(s); if (s) setSelTableId(s.tableId); }}
                  onAddField={addNewField}
                />
              ))}
            </div>
          )}
        </div>

        {rawSQL && (
          <div className="shrink-0 border-t" style={{ borderColor: "var(--st-border)", background: "var(--st-surface)", maxHeight: 220 }}>
            <div className="flex h-8 items-center gap-2 border-b px-3" style={{ borderColor: "var(--st-border)" }}>
              <Code2 size={12} style={{ color: "var(--st-brand)" }} />
              <span className="text-[10.5px] font-semibold uppercase tracking-widest" style={{ color: "var(--st-text-2)" }}>Generated SQL</span>
            </div>
            <pre className="overflow-auto p-4 text-[11.5px] leading-relaxed" style={{ fontFamily: "var(--st-mono)", color: "var(--st-text-2)", maxHeight: 180, whiteSpace: "pre" }}>
              {sql}
            </pre>
          </div>
        )}
      </div>

      {/* Inspector */}
      <div className="w-72 shrink-0">
        <FieldInspector sel={sel} tables={tables} />
      </div>
    </div>
  );
}
