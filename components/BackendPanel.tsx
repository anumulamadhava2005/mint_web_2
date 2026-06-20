"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useRuntimeStore } from "@/lib/runtime/runtime-store";

// ── Icons (inline SVG) ───────────────────────────────────────
const Icon = ({ d, sz = 16 }: { d: string; sz?: number }) => (
  <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);
const PlusIcon = () => <Icon d="M12 5v14M5 12h14" />;
const TrashIcon = () => <Icon d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />;
const DBIcon = () => <Icon d="M12 2C6.5 2 2 4 2 6v12c0 2 4.5 4 10 4s10-2 10-4V6c0-2-4.5-4-10-4M2 6c0 2 4.5 4 10 4s10-2 10-4M2 12c0 2 4.5 4 10 4s10-2 10-4" />;
const SaveIcon = () => <Icon d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2M17 21v-8H7v8M7 3v5h8" />;

type SubTab = "screens" | "state" | "actions" | "database" | "workflows";

export type CanvasFrame = { id: string; name: string };

const FIELD_TYPES = ["text","integer","float","boolean","date","datetime","json","jsonb","enum","uuid","array"] as const;

const EMPTY: any[] = [];

export default function BackendPanel({ projectId, frames = [] }: { projectId: string; frames?: CanvasFrame[] }) {
  const [subTab, setSubTab] = useState<SubTab>("screens");
  const [saving, setSaving] = useState(false);
  const schema = useRuntimeStore((s) => s.schema);
  const dirty = useRuntimeStore((s) => s.dirty);
  const initSchema = useRuntimeStore((s) => s.initSchema);
  const addGlobalState = useRuntimeStore((s) => s.addGlobalState);
  const removeGlobalState = useRuntimeStore((s) => s.removeGlobalState);
  const addGlobalAction = useRuntimeStore((s) => s.addGlobalAction);
  const removeGlobalAction = useRuntimeStore((s) => s.removeGlobalAction);
  const addTable = useRuntimeStore((s) => s.addTable);
  const updateTable = useRuntimeStore((s) => s.updateTable);
  const removeTable = useRuntimeStore((s) => s.removeTable);
  const addField = useRuntimeStore((s) => s.addField);
  const removeField = useRuntimeStore((s) => s.removeField);
  const setDatabaseConfig = useRuntimeStore((s) => s.setDatabaseConfig);
  const addWorkflow = useRuntimeStore((s) => s.addWorkflow);
  const removeWorkflow = useRuntimeStore((s) => s.removeWorkflow);

  // Load schema on mount
  useEffect(() => {
    fetch(`/api/runtime-schema/${projectId}`, { credentials: "include" })
      .then((r) => r.json())
      .then(({ schema: saved }) => initSchema(projectId, "", saved || undefined))
      .catch(() => initSchema(projectId, ""));
  }, [projectId, initSchema]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await fetch(`/api/runtime-schema/${projectId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schema }),
      });
    } catch {}
    setSaving(false);
  }, [projectId, schema]);

  const handleDeploy = useCallback(async () => {
    if (!schema.database?.tables?.length) return;
    setSaving(true);
    try {
      await fetch(`/api/db/migrate/${projectId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schema: schema.database }),
      });
    } catch {}
    setSaving(false);
  }, [projectId, schema]);

  const tabs: { id: SubTab; label: string }[] = [
    { id: "screens", label: "UI" },
    { id: "database", label: "DB" },
    { id: "state", label: "State" },
    { id: "actions", label: "Actions" },
    { id: "workflows", label: "Flows" },
  ];

  return (
    <div className="flex h-full flex-col text-xs">
      {/* Sub-tabs */}
      <div className="flex border-b border-zinc-700/50">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setSubTab(t.id)}
            className={`flex-1 py-1.5 text-[10px] font-semibold tracking-wide uppercase ${subTab === t.id ? "text-emerald-400 border-b-2 border-emerald-400" : "text-zinc-500 hover:text-zinc-300"}`}
          >{t.label}</button>
        ))}
      </div>

      {/* Save / Deploy bar */}
      <div className="flex items-center gap-1 border-b border-zinc-700/50 px-2 py-1.5">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1 rounded bg-emerald-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
          <SaveIcon /> {saving ? "Saving..." : "Save"}
        </button>
        {subTab === "database" && (
          <button onClick={handleDeploy} disabled={saving}
            className="flex items-center gap-1 rounded bg-indigo-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
            <DBIcon /> Deploy
          </button>
        )}
        {dirty && <span className="ml-auto text-[10px] text-amber-400">● unsaved</span>}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {subTab === "screens" && <ComponentsTab frames={frames} />}
        {subTab === "database" && <DatabaseTab projectId={projectId} />}
        {subTab === "state" && <StateTab />}
        {subTab === "actions" && <ActionsTab />}
        {subTab === "workflows" && <WorkflowsTab />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Database Tab
// ═══════════════════════════════════════════════════════════════
const RELATION_TYPES = ["one-to-one", "one-to-many", "many-to-many"] as const;
const ON_DELETE = ["cascade", "set-null", "restrict", "no-action"] as const;
const INDEX_TYPES = ["btree", "hash", "gin", "gist"] as const;
const POLICY_OPS = ["all", "select", "insert", "update", "delete"] as const;

function DatabaseTab({ projectId }: { projectId: string }) {
  const tables = useRuntimeStore((s) => (s.schema.database as any)?.tables ?? EMPTY);
  const addTable = useRuntimeStore((s) => s.addTable);
  const removeTable = useRuntimeStore((s) => s.removeTable);
  const addField = useRuntimeStore((s) => s.addField);
  const removeField = useRuntimeStore((s) => s.removeField);
  const updateTable = useRuntimeStore((s) => s.updateTable);
  const setDatabaseConfig = useRuntimeStore((s) => s.setDatabaseConfig);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newTableName, setNewTableName] = useState("");

  const handleAddTable = () => {
    if (!newTableName.trim()) return;
    const db = useRuntimeStore.getState().schema.database;
    if (!db) setDatabaseConfig({ provider: "mint", connectionUrl: `https://${projectId}.mintit.pro`, tables: [] });
    addTable({
      id: crypto.randomUUID(),
      name: newTableName.trim().toLowerCase().replace(/\s+/g, "_"),
      fields: [],
      relations: [],
      indexes: [],
      policies: [],
      timestamps: true,
      softDelete: false,
    });
    setNewTableName("");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <input value={newTableName} onChange={(e) => setNewTableName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddTable()}
          placeholder="Table name..." className="flex-1 rounded bg-zinc-800 px-2 py-1 text-xs text-white outline-none ring-1 ring-zinc-700 focus:ring-emerald-500" />
        <button onClick={handleAddTable} className="rounded bg-emerald-600 p-1 text-white hover:bg-emerald-500"><PlusIcon /></button>
      </div>

      {tables.length === 0 && (
        <div className="rounded-lg border border-dashed border-zinc-700 p-4 text-center text-zinc-500">
          <DBIcon /><p className="mt-1">No tables yet</p>
          <p className="text-[10px]">Add a table to start building your database</p>
        </div>
      )}

      {tables.map((table: any) => (
        <div key={table.id} className="rounded-lg border border-zinc-700/60 bg-zinc-800/50">
          {/* Table header */}
          <div className="flex items-center gap-2 px-2 py-1.5 cursor-pointer" onClick={() => setExpanded(expanded === table.id ? null : table.id)}>
            <span className="text-[10px] text-emerald-400">{expanded === table.id ? "▼" : "▶"}</span>
            <span className="font-medium text-white">{table.name}</span>
            <span className="ml-auto flex items-center gap-1 text-[9px] text-zinc-500">
              <span>{table.fields?.length || 0}f</span>
              {!!table.relations?.length && <span className="text-sky-400" title="Relations">{table.relations.length}↔</span>}
              {!!table.indexes?.length && <span className="text-fuchsia-400" title="Indexes">{table.indexes.length}⌗</span>}
              {!!table.policies?.length && <span className="text-amber-400" title="RLS policies">{table.policies.length}🔒</span>}
            </span>
            <button onClick={(e) => { e.stopPropagation(); removeTable(table.id); }}
              className="text-zinc-500 hover:text-red-400"><TrashIcon /></button>
          </div>

          {/* Fields */}
          {expanded === table.id && (
            <div className="border-t border-zinc-700/50 px-2 py-1.5 space-y-1">
              {/* Options */}
              <div className="flex gap-2 pb-1">
                <label className="flex items-center gap-1 text-[10px] text-zinc-400">
                  <input type="checkbox" checked={table.timestamps ?? true}
                    onChange={(e) => updateTable(table.id, { timestamps: e.target.checked })}
                    className="rounded" /> Timestamps
                </label>
                <label className="flex items-center gap-1 text-[10px] text-zinc-400">
                  <input type="checkbox" checked={table.softDelete ?? false}
                    onChange={(e) => updateTable(table.id, { softDelete: e.target.checked })}
                    className="rounded" /> Soft Delete
                </label>
              </div>

              {/* Existing fields */}
              {(table.fields || []).map((f: any, i: number) => (
                <div key={i} className="flex items-center gap-1 rounded bg-zinc-900/60 px-1.5 py-1">
                  <span className="flex-1 text-white">{f.name}</span>
                  {f.type === "enum" && f.enumValues?.length > 0 && (
                    <span className="rounded bg-fuchsia-900/40 px-1 py-0.5 text-[9px] text-fuchsia-300" title={f.enumValues.join(", ")}>{f.enumValues.length} vals</span>
                  )}
                  {f.default !== undefined && f.default !== "" && (
                    <span className="rounded bg-zinc-800 px-1 py-0.5 text-[9px] text-zinc-400 font-mono max-w-[60px] truncate" title={`default: ${String(f.default)}`}>={String(f.default)}</span>
                  )}
                  <span className="rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-300">{f.type}</span>
                  {f.required && <span className="text-[10px] text-amber-400">req</span>}
                  {f.unique && <span className="text-[10px] text-indigo-400">uniq</span>}
                  <button onClick={() => removeField(table.id, f.name)} className="text-zinc-500 hover:text-red-400">×</button>
                </div>
              ))}

              {/* Add field form */}
              <AddFieldForm tableId={table.id} onAdd={addField} />

              {/* Relations / Indexes / Policies */}
              <RelationsSection table={table} tables={tables} />
              <IndexesSection table={table} />
              <PoliciesSection table={table} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AddFieldForm({ tableId, onAdd }: { tableId: string; onAdd: (tid: string, f: any) => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("text");
  const [required, setRequired] = useState(false);
  const [unique, setUnique] = useState(false);
  const [defaultVal, setDefaultVal] = useState("");
  const [enumVals, setEnumVals] = useState("");

  const handleAdd = () => {
    if (!name.trim()) return;
    const field: any = { name: name.trim().toLowerCase().replace(/\s+/g, "_"), type, required, unique };
    // Coerce the default value to match the field type
    if (defaultVal.trim() !== "") {
      if (type === "integer" || type === "float") field.default = Number(defaultVal);
      else if (type === "boolean") field.default = defaultVal === "true";
      else field.default = defaultVal;
    }
    if (type === "enum") {
      const values = enumVals.split(",").map((v) => v.trim()).filter(Boolean);
      if (values.length) field.enumValues = values;
    }
    onAdd(tableId, field);
    setName(""); setRequired(false); setUnique(false); setDefaultVal(""); setEnumVals("");
  };

  return (
    <div className="mt-1 space-y-1 rounded border border-dashed border-zinc-600 p-1.5">
      <div className="flex gap-1">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="field_name"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className="flex-1 rounded bg-zinc-900 px-1.5 py-0.5 text-xs text-white outline-none ring-1 ring-zinc-700 focus:ring-emerald-500" />
        <select value={type} onChange={(e) => setType(e.target.value)}
          className="rounded bg-zinc-900 px-1 py-0.5 text-[10px] text-zinc-300 outline-none ring-1 ring-zinc-700">
          {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className="flex gap-1">
        <input value={defaultVal} onChange={(e) => setDefaultVal(e.target.value)} placeholder="default (optional)"
          className="flex-1 rounded bg-zinc-900 px-1.5 py-0.5 text-[11px] text-white outline-none ring-1 ring-zinc-700 focus:ring-emerald-500" />
        {type === "enum" && (
          <input value={enumVals} onChange={(e) => setEnumVals(e.target.value)} placeholder="enum: a, b, c"
            className="flex-1 rounded bg-zinc-900 px-1.5 py-0.5 text-[11px] text-white outline-none ring-1 ring-zinc-700 focus:ring-fuchsia-500" />
        )}
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1 text-[10px] text-zinc-400">
          <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} /> Required
        </label>
        <label className="flex items-center gap-1 text-[10px] text-zinc-400">
          <input type="checkbox" checked={unique} onChange={(e) => setUnique(e.target.checked)} /> Unique
        </label>
        <button onClick={handleAdd} className="ml-auto rounded bg-emerald-600 px-2 py-0.5 text-[10px] text-white hover:bg-emerald-500">+ Add</button>
      </div>
    </div>
  );
}

// ── Collapsible sub-section wrapper ──────────────────────────
function SubSection({ title, count, accent, children }: { title: string; count: number; accent: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1 rounded border border-zinc-700/50 bg-zinc-900/40">
      <button onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 hover:text-zinc-200">
        <span className={accent}>{open ? "▼" : "▶"}</span>
        <span>{title}</span>
        <span className="ml-auto rounded bg-zinc-800 px-1 text-[9px] text-zinc-500">{count}</span>
      </button>
      {open && <div className="border-t border-zinc-700/40 px-1.5 py-1.5 space-y-1">{children}</div>}
    </div>
  );
}

// ── Relations ────────────────────────────────────────────────
function RelationsSection({ table, tables }: { table: any; tables: any[] }) {
  const addRelation = useRuntimeStore((s) => s.addRelation);
  const removeRelation = useRuntimeStore((s) => s.removeRelation);
  const relations: any[] = table.relations || [];
  const otherTables = tables.filter((t) => t.id !== table.id);

  const [type, setType] = useState<string>("one-to-many");
  const [target, setTarget] = useState("");
  const [fk, setFk] = useState("");
  const [targetKey, setTargetKey] = useState("");
  const [junction, setJunction] = useState("");
  const [onDelete, setOnDelete] = useState<string>("cascade");

  const handleAdd = () => {
    const targetTable = target || otherTables[0]?.name;
    if (!targetTable) return;
    const isM2M = type === "many-to-many";
    const fkValue = fk.trim() || (isM2M ? "" : `${targetTable}_id`);
    addRelation(table.id, {
      type: type as any,
      targetTable,
      foreignKey: fkValue,
      targetKey: targetKey.trim() || undefined,
      junctionTable: isM2M ? (junction.trim() || `${table.name}_${targetTable}`) : undefined,
      onDelete: onDelete as any,
    });
    setFk(""); setTargetKey(""); setJunction("");
  };

  const isM2M = type === "many-to-many";

  return (
    <SubSection title="Relations" count={relations.length} accent="text-sky-400">
      {relations.map((r, i) => (
        <div key={i} className="flex items-center gap-1 rounded bg-zinc-900/60 px-1.5 py-1 text-[10px]">
          <span className="rounded bg-sky-900/40 px-1 py-0.5 text-sky-300">{r.type}</span>
          <span className="text-zinc-500">→</span>
          <span className="text-white font-medium">{r.targetTable}</span>
          {r.foreignKey && <span className="text-zinc-500 font-mono">fk:{r.foreignKey}</span>}
          {r.junctionTable && <span className="text-zinc-600 font-mono truncate">via {r.junctionTable}</span>}
          <button onClick={() => removeRelation(table.id, i)} className="ml-auto text-zinc-500 hover:text-red-400">×</button>
        </div>
      ))}
      {otherTables.length === 0 ? (
        <p className="text-[10px] text-zinc-600">Add another table to create a relation.</p>
      ) : (
        <div className="space-y-1 rounded border border-dashed border-zinc-700 p-1.5">
          <div className="flex gap-1">
            <select value={type} onChange={(e) => setType(e.target.value)}
              className="rounded bg-zinc-900 px-1 py-0.5 text-[10px] text-zinc-300 outline-none ring-1 ring-zinc-700">
              {RELATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={target} onChange={(e) => setTarget(e.target.value)}
              className="flex-1 rounded bg-zinc-900 px-1 py-0.5 text-[10px] text-zinc-300 outline-none ring-1 ring-zinc-700">
              {otherTables.map((t) => <option key={t.id} value={t.name}>{t.name}</option>)}
            </select>
          </div>
          <div className="flex gap-1">
            {!isM2M && (
              <input value={fk} onChange={(e) => setFk(e.target.value)} placeholder="foreign_key"
                className="flex-1 rounded bg-zinc-900 px-1.5 py-0.5 text-[11px] text-white outline-none ring-1 ring-zinc-700 focus:ring-sky-500" />
            )}
            {isM2M && (
              <input value={junction} onChange={(e) => setJunction(e.target.value)} placeholder="junction_table"
                className="flex-1 rounded bg-zinc-900 px-1.5 py-0.5 text-[11px] text-white outline-none ring-1 ring-zinc-700 focus:ring-sky-500" />
            )}
            <input value={targetKey} onChange={(e) => setTargetKey(e.target.value)} placeholder="target key (id)"
              className="w-24 rounded bg-zinc-900 px-1.5 py-0.5 text-[11px] text-white outline-none ring-1 ring-zinc-700 focus:ring-sky-500" />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-zinc-500">on delete</span>
            <select value={onDelete} onChange={(e) => setOnDelete(e.target.value)}
              className="rounded bg-zinc-900 px-1 py-0.5 text-[10px] text-zinc-300 outline-none ring-1 ring-zinc-700">
              {ON_DELETE.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            <button onClick={handleAdd} className="ml-auto rounded bg-sky-600 px-2 py-0.5 text-[10px] text-white hover:bg-sky-500">+ Add</button>
          </div>
        </div>
      )}
    </SubSection>
  );
}

// ── Indexes ──────────────────────────────────────────────────
function IndexesSection({ table }: { table: any }) {
  const addIndex = useRuntimeStore((s) => s.addIndex);
  const removeIndex = useRuntimeStore((s) => s.removeIndex);
  const indexes: any[] = table.indexes || [];
  const fieldNames: string[] = (table.fields || []).map((f: any) => f.name);

  const [selected, setSelected] = useState<string[]>([]);
  const [unique, setUnique] = useState(false);
  const [type, setType] = useState<string>("btree");

  const toggle = (name: string) =>
    setSelected((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));

  const handleAdd = () => {
    if (selected.length === 0) return;
    const name = `idx_${table.name}_${selected.join("_")}`;
    addIndex(table.id, { name, fields: selected, unique, type: type as any });
    setSelected([]); setUnique(false);
  };

  return (
    <SubSection title="Indexes" count={indexes.length} accent="text-fuchsia-400">
      {indexes.map((idx, i) => (
        <div key={i} className="flex items-center gap-1 rounded bg-zinc-900/60 px-1.5 py-1 text-[10px]">
          {idx.unique && <span className="rounded bg-indigo-900/40 px-1 py-0.5 text-indigo-300">uniq</span>}
          <span className="text-white font-mono">{(idx.fields || []).join(", ")}</span>
          <span className="rounded bg-zinc-700 px-1 py-0.5 text-[9px] text-zinc-400">{idx.type || "btree"}</span>
          <button onClick={() => removeIndex(table.id, idx.name)} className="ml-auto text-zinc-500 hover:text-red-400">×</button>
        </div>
      ))}
      {fieldNames.length === 0 ? (
        <p className="text-[10px] text-zinc-600">Add fields first to index them.</p>
      ) : (
        <div className="space-y-1 rounded border border-dashed border-zinc-700 p-1.5">
          <div className="flex flex-wrap gap-1">
            {fieldNames.map((name) => (
              <button key={name} onClick={() => toggle(name)}
                className={`rounded px-1.5 py-0.5 text-[10px] border transition-colors ${selected.includes(name) ? "border-fuchsia-500 bg-fuchsia-900/40 text-fuchsia-200" : "border-zinc-700 bg-zinc-900/60 text-zinc-400 hover:text-white"}`}>
                {name}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-[10px] text-zinc-400">
              <input type="checkbox" checked={unique} onChange={(e) => setUnique(e.target.checked)} /> Unique
            </label>
            <select value={type} onChange={(e) => setType(e.target.value)}
              className="rounded bg-zinc-900 px-1 py-0.5 text-[10px] text-zinc-300 outline-none ring-1 ring-zinc-700">
              {INDEX_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <button onClick={handleAdd} disabled={selected.length === 0}
              className="ml-auto rounded bg-fuchsia-600 px-2 py-0.5 text-[10px] text-white hover:bg-fuchsia-500 disabled:opacity-40">+ Add</button>
          </div>
        </div>
      )}
    </SubSection>
  );
}

// ── Policies (Row Level Security) ────────────────────────────
function PoliciesSection({ table }: { table: any }) {
  const addPolicy = useRuntimeStore((s) => s.addPolicy);
  const removePolicy = useRuntimeStore((s) => s.removePolicy);
  const policies: any[] = table.policies || [];

  const [name, setName] = useState("");
  const [operation, setOperation] = useState<string>("all");
  const [role, setRole] = useState("");
  const [condition, setCondition] = useState("");
  const [check, setCheck] = useState("");

  const handleAdd = () => {
    if (!name.trim()) return;
    addPolicy(table.id, {
      name: name.trim().toLowerCase().replace(/\s+/g, "_"),
      operation: operation as any,
      role: role.trim() || undefined,
      condition: condition.trim() || undefined,
      check: check.trim() || undefined,
    });
    setName(""); setRole(""); setCondition(""); setCheck("");
  };

  return (
    <SubSection title="RLS Policies" count={policies.length} accent="text-amber-400">
      {policies.map((p, i) => (
        <div key={i} className="rounded bg-zinc-900/60 px-1.5 py-1 text-[10px] space-y-0.5">
          <div className="flex items-center gap-1">
            <span className="rounded bg-amber-900/40 px-1 py-0.5 text-amber-300">{p.operation}</span>
            <span className="text-white font-medium">{p.name}</span>
            {p.role && <span className="text-zinc-500">role: {p.role}</span>}
            <button onClick={() => removePolicy(table.id, p.name)} className="ml-auto text-zinc-500 hover:text-red-400">×</button>
          </div>
          {p.condition && <p className="text-[9px] text-zinc-500 font-mono truncate">USING ({p.condition})</p>}
          {p.check && <p className="text-[9px] text-zinc-500 font-mono truncate">WITH CHECK ({p.check})</p>}
        </div>
      ))}
      <div className="space-y-1 rounded border border-dashed border-zinc-700 p-1.5">
        <div className="flex gap-1">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="policy_name"
            className="flex-1 rounded bg-zinc-900 px-1.5 py-0.5 text-[11px] text-white outline-none ring-1 ring-zinc-700 focus:ring-amber-500" />
          <select value={operation} onChange={(e) => setOperation(e.target.value)}
            className="rounded bg-zinc-900 px-1 py-0.5 text-[10px] text-zinc-300 outline-none ring-1 ring-zinc-700">
            {POLICY_OPS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="role"
            className="w-16 rounded bg-zinc-900 px-1.5 py-0.5 text-[11px] text-white outline-none ring-1 ring-zinc-700 focus:ring-amber-500" />
        </div>
        <input value={condition} onChange={(e) => setCondition(e.target.value)} placeholder="USING expr — e.g. user_id = current_user_id()"
          className="w-full rounded bg-zinc-900 px-1.5 py-0.5 text-[11px] text-white font-mono outline-none ring-1 ring-zinc-700 focus:ring-amber-500" />
        <div className="flex gap-1">
          <input value={check} onChange={(e) => setCheck(e.target.value)} placeholder="WITH CHECK expr (optional)"
            className="flex-1 rounded bg-zinc-900 px-1.5 py-0.5 text-[11px] text-white font-mono outline-none ring-1 ring-zinc-700 focus:ring-amber-500" />
          <button onClick={handleAdd} className="rounded bg-amber-600 px-2 py-0.5 text-[10px] text-white hover:bg-amber-500">+ Add</button>
        </div>
      </div>
    </SubSection>
  );
}

// ═══════════════════════════════════════════════════════════════
// State Tab — Enhanced with scope, persist, groups
// ═══════════════════════════════════════════════════════════════
const STATE_TYPES = ["string","number","boolean","object","array","any"] as const;
const STATE_SCOPES = ["global","local","session","persisted"] as const;
const STORAGE_TYPES = ["localStorage","sessionStorage","asyncStorage","secureStorage"] as const;

function StateTab() {
  const globalState = useRuntimeStore((s) => s.schema.globalState ?? EMPTY);
  const addGlobalState = useRuntimeStore((s) => s.addGlobalState);
  const removeGlobalState = useRuntimeStore((s) => s.removeGlobalState);
  const updateGlobalState = useRuntimeStore((s) => s.updateGlobalState);
  const [name, setName] = useState("");
  const [type, setType] = useState("string");
  const [scope, setScope] = useState<string>("global");
  const [group, setGroup] = useState("");
  const [defaultVal, setDefaultVal] = useState("");
  const [persist, setPersist] = useState(false);
  const [storage, setStorage] = useState("localStorage");

  const handleAdd = () => {
    if (!name.trim()) return;
    let parsed: any = defaultVal;
    if (type === "number") parsed = Number(defaultVal) || 0;
    else if (type === "boolean") parsed = defaultVal === "true";
    else if (type === "object" || type === "array") try { parsed = JSON.parse(defaultVal); } catch { parsed = type === "array" ? [] : {}; }

    addGlobalState({
      id: crypto.randomUUID(), name: name.trim(), scope: scope as any, defaultValue: parsed,
      type: type as any, group: group.trim() || undefined,
      persist: persist ? { storage: storage as any } : undefined,
    });
    setName(""); setDefaultVal(""); setGroup("");
  };

  // Group state variables
  const groups = new Map<string, any[]>();
  globalState.forEach((s: any) => {
    const g = s.group || "ungrouped";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(s);
  });

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-zinc-500 uppercase font-semibold tracking-wider">State Stores</p>

      {/* Grouped state cards */}
      {Array.from(groups.entries()).map(([groupName, items]) => (
        <div key={groupName} className="rounded-lg border border-zinc-700/60 bg-zinc-800/50 overflow-hidden">
          <div className="flex items-center gap-1.5 px-2 py-1.5 bg-zinc-800/80 border-b border-zinc-700/40">
            <span className="text-[10px] text-violet-400">■</span>
            <span className="text-[10px] font-semibold text-zinc-300 uppercase tracking-wider">{groupName}</span>
            <span className="ml-auto text-[10px] text-zinc-600">{items.length}</span>
          </div>
          {/* Mini table */}
          <div className="divide-y divide-zinc-700/30">
            {items.map((s: any) => (
              <div key={s.id} className="flex items-center gap-1 px-2 py-1 hover:bg-zinc-700/20 transition-colors">
                <span className="text-[10px] text-emerald-400 font-mono">$</span>
                <span className="font-medium text-white text-[11px]">{s.name}</span>
                <span className="rounded bg-zinc-700 px-1 py-0.5 text-[9px] text-zinc-300">{s.type || "any"}</span>
                <span className="rounded bg-zinc-700/60 px-1 py-0.5 text-[9px] text-zinc-400">{s.scope}</span>
                {s.persist && <span className="text-[9px] text-amber-400" title="Persisted">💾</span>}
                <span className="ml-auto text-[9px] text-zinc-600 font-mono max-w-[60px] truncate">{JSON.stringify(s.defaultValue)}</span>
                <button onClick={() => removeGlobalState(s.id)} className="text-zinc-500 hover:text-red-400 ml-1">×</button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {globalState.length === 0 && (
        <div className="rounded-lg border border-dashed border-zinc-700 p-4 text-center text-zinc-500">
          <p className="text-[11px]">No state variables</p>
          <p className="text-[10px]">Create a store to manage your app&apos;s data</p>
        </div>
      )}

      {/* Add form */}
      <div className="space-y-1.5 rounded border border-dashed border-zinc-600 p-1.5">
        <div className="flex gap-1">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="variable_name"
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="flex-1 rounded bg-zinc-900 px-1.5 py-0.5 text-xs text-white outline-none ring-1 ring-zinc-700 focus:ring-emerald-500" />
          <select value={type} onChange={(e) => setType(e.target.value)}
            className="rounded bg-zinc-900 px-1 py-0.5 text-[10px] text-zinc-300 outline-none ring-1 ring-zinc-700">
            {STATE_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="flex gap-1">
          <select value={scope} onChange={(e) => setScope(e.target.value)}
            className="rounded bg-zinc-900 px-1 py-0.5 text-[10px] text-zinc-300 outline-none ring-1 ring-zinc-700">
            {STATE_SCOPES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <input value={group} onChange={(e) => setGroup(e.target.value)} placeholder="group"
            className="flex-1 rounded bg-zinc-900 px-1.5 py-0.5 text-xs text-white outline-none ring-1 ring-zinc-700 focus:ring-violet-500" />
        </div>
        <div className="flex gap-1">
          <input value={defaultVal} onChange={(e) => setDefaultVal(e.target.value)} placeholder="Default value"
            className="flex-1 rounded bg-zinc-900 px-1.5 py-0.5 text-xs text-white outline-none ring-1 ring-zinc-700 focus:ring-emerald-500" />
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-[10px] text-zinc-400">
            <input type="checkbox" checked={persist} onChange={(e) => setPersist(e.target.checked)} /> Persist
          </label>
          {persist && (
            <select value={storage} onChange={(e) => setStorage(e.target.value)}
              className="rounded bg-zinc-900 px-1 py-0.5 text-[10px] text-zinc-300 outline-none ring-1 ring-zinc-700">
              {STORAGE_TYPES.map((s) => <option key={s}>{s}</option>)}
            </select>
          )}
          <button onClick={handleAdd} className="ml-auto rounded bg-emerald-600 px-2 py-0.5 text-[10px] text-white hover:bg-emerald-500">+ Add</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Actions Tab — Extended with state & logic actions
// ═══════════════════════════════════════════════════════════════
const ACTION_TYPES_GROUPED = [
  { group: "State", types: ["setState","updateState","resetState","removeState"] },
  { group: "Data", types: ["fetch","mutate","upload","sync"] },
  { group: "Logic", types: ["condition","sequence","parallel","loop","forEach","map","filter","transform"] },
  { group: "UI", types: ["navigate","goBack","openModal","closeModal","toast","alert","animate","scroll","focus"] },
  { group: "Auth", types: ["signIn","signUp","signOut"] },
  { group: "Device", types: ["camera","notifications","location","biometrics","haptics","share","clipboard","openUrl"] },
  { group: "Timing", types: ["delay","debounce","throttle"] },
] as const;
const ALL_ACTION_TYPES = ACTION_TYPES_GROUPED.flatMap((g) => g.types);

// Color for action type badges
const ACTION_COLORS: Record<string, string> = {
  setState: "bg-emerald-900/50 text-emerald-300", updateState: "bg-emerald-900/50 text-emerald-300",
  resetState: "bg-amber-900/50 text-amber-300", removeState: "bg-red-900/50 text-red-300",
  fetch: "bg-blue-900/50 text-blue-300", mutate: "bg-blue-900/50 text-blue-300",
  condition: "bg-violet-900/50 text-violet-300", forEach: "bg-violet-900/50 text-violet-300",
  map: "bg-violet-900/50 text-violet-300", filter: "bg-violet-900/50 text-violet-300",
  transform: "bg-violet-900/50 text-violet-300",
  navigate: "bg-indigo-900/50 text-indigo-300", toast: "bg-indigo-900/50 text-indigo-300",
  delay: "bg-zinc-700 text-zinc-300", debounce: "bg-zinc-700 text-zinc-300",
};

// Direction indicators
const ACTION_DIRECTION: Record<string, { in: string; out: string }> = {
  setState: { in: "value", out: "state" }, updateState: { in: "partial", out: "state" },
  resetState: { in: "name", out: "state" }, removeState: { in: "name", out: "—" },
  fetch: { in: "url", out: "data" }, condition: { in: "expr", out: "branch" },
  forEach: { in: "items", out: "item" }, map: { in: "items", out: "mapped" },
  filter: { in: "items", out: "filtered" }, transform: { in: "data", out: "result" },
};

function ActionsTab() {
  const actions = useRuntimeStore((s) => s.schema.globalActions ?? EMPTY);
  const addGlobalAction = useRuntimeStore((s) => s.addGlobalAction);
  const removeGlobalAction = useRuntimeStore((s) => s.removeGlobalAction);
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("setState");
  const [expanded, setExpanded] = useState<string | null>(null);

  const handleAdd = () => {
    if (!name.trim()) return;
    addGlobalAction({ id: crypto.randomUUID(), name: name.trim(), type: type as any, config: {} });
    setName("");
  };

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-zinc-500 uppercase font-semibold tracking-wider">Global Actions</p>

      {actions.map((a: any) => {
        const dir = ACTION_DIRECTION[a.type];
        const color = ACTION_COLORS[a.type] || "bg-indigo-900/50 text-indigo-300";
        return (
          <div key={a.id} className="rounded-lg border border-zinc-700/60 bg-zinc-800/50">
            <div className="flex items-center gap-1.5 px-2 py-1.5 cursor-pointer" onClick={() => setExpanded(expanded === a.id ? null : a.id)}>
              <span className="text-[10px] text-indigo-400">{expanded === a.id ? "▼" : "▶"}</span>
              <span className="font-medium text-white text-[11px]">{a.name}</span>
              <span className={`rounded px-1.5 py-0.5 text-[9px] ${color}`}>{a.type}</span>
              {dir && (
                <span className="flex items-center gap-0.5 text-[9px] text-zinc-600 ml-auto mr-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-500/60" title="Input" />
                  {dir.in}
                  <span className="text-zinc-700">→</span>
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500/60" title="Output" />
                  {dir.out}
                </span>
              )}
              <button onClick={(e) => { e.stopPropagation(); removeGlobalAction(a.id); }}
                className={`${dir ? "" : "ml-auto"} text-zinc-500 hover:text-red-400`}>×</button>
            </div>
            {expanded === a.id && (
              <div className="border-t border-zinc-700/50 px-2 py-1.5">
                <ActionConfigEditor action={a} />
              </div>
            )}
          </div>
        );
      })}

      {actions.length === 0 && (
        <div className="rounded-lg border border-dashed border-zinc-700 p-4 text-center text-zinc-500">
          <p className="text-[11px]">No actions</p>
          <p className="text-[10px]">Add state, logic, or UI actions</p>
        </div>
      )}

      <div className="flex gap-1">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Action name"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className="flex-1 rounded bg-zinc-900 px-1.5 py-0.5 text-xs text-white outline-none ring-1 ring-zinc-700 focus:ring-emerald-500" />
        <select value={type} onChange={(e) => setType(e.target.value)}
          className="rounded bg-zinc-900 px-1 py-0.5 text-[10px] text-zinc-300 outline-none ring-1 ring-zinc-700">
          {ACTION_TYPES_GROUPED.map((g) => (
            <optgroup key={g.group} label={g.group}>
              {g.types.map((t) => <option key={t} value={t}>{t}</option>)}
            </optgroup>
          ))}
        </select>
        <button onClick={handleAdd} className="rounded bg-indigo-600 px-2 py-0.5 text-[10px] text-white hover:bg-indigo-500">+</button>
      </div>
    </div>
  );
}

function ActionConfigEditor({ action }: { action: any }) {
  const updateGlobalAction = useRuntimeStore((s) => s.updateGlobalAction);
  const [config, setConfig] = useState(JSON.stringify(action.config || {}, null, 2));

  const handleSave = () => {
    try {
      updateGlobalAction(action.id, { config: JSON.parse(config) });
    } catch {}
  };

  return (
    <div className="space-y-1">
      <textarea value={config} onChange={(e) => setConfig(e.target.value)}
        className="w-full rounded bg-zinc-900 p-1.5 text-[10px] text-zinc-300 font-mono outline-none ring-1 ring-zinc-700 focus:ring-indigo-500"
        rows={4} />
      <button onClick={handleSave} className="rounded bg-indigo-600 px-2 py-0.5 text-[10px] text-white hover:bg-indigo-500">Apply Config</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Workflows Tab — Enhanced with node palette & visual cards
// ═══════════════════════════════════════════════════════════════
const NODE_PALETTE = [
  { group: "Logic", nodes: [
    { type: "condition", label: "If/Else", icon: "◇" },
    { type: "switch", label: "Switch", icon: "⊞" },
    { type: "loop", label: "Loop", icon: "↻" },
    { type: "forEach", label: "ForEach", icon: "⫶" },
    { type: "map", label: "Map", icon: "⇄" },
    { type: "filter", label: "Filter", icon: "⊗" },
  ]},
  { group: "State", nodes: [
    { type: "setState", label: "SetState", icon: "◉" },
    { type: "updateState", label: "Update", icon: "↺" },
    { type: "resetState", label: "Reset", icon: "⟲" },
    { type: "removeState", label: "Remove", icon: "⊖" },
  ]},
  { group: "Utility", nodes: [
    { type: "delay", label: "Delay", icon: "⏱" },
    { type: "debounce", label: "Debounce", icon: "⧖" },
    { type: "transform", label: "Transform", icon: "⚙" },
    { type: "parallel", label: "Parallel", icon: "⫼" },
  ]},
  { group: "Backend", nodes: [
    { type: "apiCall", label: "API Call", icon: "⇆" },
    { type: "dbQuery", label: "DB Query", icon: "⛁" },
    { type: "dbMutate", label: "DB Write", icon: "⛃" },
    { type: "authCheck", label: "Auth", icon: "🔑" },
  ]},
  { group: "UI", nodes: [
    { type: "navigate", label: "Navigate", icon: "→" },
    { type: "showModal", label: "Modal", icon: "□" },
    { type: "toast", label: "Toast", icon: "💬" },
  ]},
] as const;

const NODE_COLORS: Record<string, string> = {
  condition: "border-l-violet-500", switch: "border-l-violet-500", loop: "border-l-violet-500",
  forEach: "border-l-violet-500", map: "border-l-violet-500", filter: "border-l-violet-500",
  setState: "border-l-emerald-500", updateState: "border-l-emerald-500",
  resetState: "border-l-amber-500", removeState: "border-l-red-500",
  delay: "border-l-zinc-500", debounce: "border-l-zinc-500", transform: "border-l-cyan-500",
  parallel: "border-l-cyan-500",
  apiCall: "border-l-blue-500", dbQuery: "border-l-blue-500", dbMutate: "border-l-blue-500",
  authCheck: "border-l-amber-500",
  navigate: "border-l-indigo-500", showModal: "border-l-indigo-500", toast: "border-l-indigo-500",
};

function WorkflowsTab() {
  const workflows = useRuntimeStore((s) => s.schema.workflows ?? EMPTY);
  const addWorkflow = useRuntimeStore((s) => s.addWorkflow);
  const removeWorkflow = useRuntimeStore((s) => s.removeWorkflow);
  const addWorkflowNode = useRuntimeStore((s) => s.addWorkflowNode);
  const removeWorkflowNode = useRuntimeStore((s) => s.removeWorkflowNode);
  const [name, setName] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showPalette, setShowPalette] = useState<string | null>(null);

  const handleAdd = () => {
    if (!name.trim()) return;
    addWorkflow({
      id: crypto.randomUUID(), name: name.trim(),
      trigger: { type: "action", config: {} },
      nodes: [], edges: [],
    });
    setName("");
  };

  const handleAddNode = (workflowId: string, type: string, label: string) => {
    addWorkflowNode(workflowId, {
      id: crypto.randomUUID(),
      type: type as any,
      label,
      config: {},
      position: { x: 100, y: 50 + (workflows.find((w: any) => w.id === workflowId)?.nodes?.length || 0) * 60 },
    });
  };

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-zinc-500 uppercase font-semibold tracking-wider">Workflows</p>

      {workflows.length === 0 && (
        <div className="rounded-lg border border-dashed border-zinc-700 p-4 text-center text-zinc-500">
          <p className="text-[11px]">No workflows yet</p>
          <p className="text-[10px]">Create visual logic flows for your app</p>
        </div>
      )}

      {workflows.map((w: any) => (
        <div key={w.id} className="rounded-lg border border-zinc-700/60 bg-zinc-800/50 overflow-hidden">
          {/* Workflow header */}
          <div className="flex items-center gap-2 px-2 py-1.5 cursor-pointer bg-zinc-800/80"
            onClick={() => setExpanded(expanded === w.id ? null : w.id)}>
            <span className="text-amber-400 text-[11px]">{expanded === w.id ? "▼" : "▶"}</span>
            <span className="text-amber-400 text-[11px]">⚡</span>
            <span className="font-medium text-white text-[11px]">{w.name}</span>
            <span className="ml-auto text-[10px] text-zinc-500">{w.nodes?.length || 0} nodes</span>
            <button onClick={(e) => { e.stopPropagation(); removeWorkflow(w.id); }}
              className="text-zinc-500 hover:text-red-400">×</button>
          </div>

          {/* Expanded: nodes + palette */}
          {expanded === w.id && (
            <div className="border-t border-zinc-700/40">
              {/* Node list */}
              <div className="divide-y divide-zinc-700/30">
                {(w.nodes || []).map((node: any) => (
                  <div key={node.id} className={`flex items-center gap-1.5 px-2 py-1.5 border-l-2 ${NODE_COLORS[node.type] || "border-l-zinc-600"} hover:bg-zinc-700/20 transition-colors`}>
                    {/* Input connection point */}
                    <span className="inline-block w-2 h-2 rounded-full border border-cyan-500/60 bg-zinc-900" title="Input" />
                    <span className="text-[10px] text-zinc-400">{
                      ((NODE_PALETTE as any).flatMap((g: any) => g.nodes) as any[]).find((n: any) => n.type === node.type)?.icon || "●"
                    }</span>
                    <span className="text-[11px] text-white">{node.label || node.type}</span>
                    <span className="rounded bg-zinc-700 px-1 py-0.5 text-[9px] text-zinc-400">{node.type}</span>
                    {/* Output connection point */}
                    <span className="ml-auto inline-block w-2 h-2 rounded-full border border-amber-500/60 bg-zinc-900" title="Output" />
                    <button onClick={() => removeWorkflowNode(w.id, node.id)}
                      className="text-zinc-500 hover:text-red-400 ml-1">×</button>
                  </div>
                ))}
              </div>

              {/* Add node: toggle palette */}
              <div className="px-2 py-1.5 border-t border-zinc-700/40">
                <button onClick={() => setShowPalette(showPalette === w.id ? null : w.id)}
                  className="w-full rounded bg-zinc-700/50 py-1 text-[10px] text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors">
                  {showPalette === w.id ? "Hide palette" : "+ Add Node"}
                </button>
              </div>

              {/* Node palette */}
              {showPalette === w.id && (
                <div className="px-2 py-1.5 border-t border-zinc-700/40 space-y-1.5">
                  {NODE_PALETTE.map((group) => (
                    <div key={group.group}>
                      <p className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1">{group.group}</p>
                      <div className="flex flex-wrap gap-1">
                        {group.nodes.map((node) => (
                          <button key={node.type}
                            onClick={() => handleAddNode(w.id, node.type, node.label)}
                            className={`flex items-center gap-1 rounded border border-zinc-700/50 bg-zinc-900/60 px-1.5 py-0.5 text-[10px] text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors`}>
                            <span>{node.icon}</span>
                            <span>{node.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      <div className="flex gap-1">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Workflow name"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className="flex-1 rounded bg-zinc-900 px-1.5 py-0.5 text-xs text-white outline-none ring-1 ring-zinc-700 focus:ring-emerald-500" />
        <button onClick={handleAdd} className="rounded bg-amber-600 px-2 py-0.5 text-[10px] text-white hover:bg-amber-500">+ Add</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Screens & Components Tab — author the runtime UI tree
// (dataTable, dropdown/select, tabs, fileUpload, …) per screen.
// Writes into schema.screens[].components — consumed by the preview
// (SchemaRenderer) and the React Native (schema) exporter.
// ═══════════════════════════════════════════════════════════════
export const COMPONENT_PALETTE = [
  { group: "Layout", items: [
    { type: "view", label: "View", icon: "▭" },
    { type: "scroll", label: "Scroll", icon: "↕" },
    { type: "card", label: "Card", icon: "▢" },
    { type: "list", label: "List", icon: "≣" },
    { type: "grid", label: "Grid", icon: "▦" },
    { type: "form", label: "Form", icon: "▤" },
    { type: "tabs", label: "Tabs", icon: "⊟" },
  ]},
  { group: "Inputs", items: [
    { type: "input", label: "Text Input", icon: "✎" },
    { type: "select", label: "Dropdown", icon: "▾" },
    { type: "checkbox", label: "Checkbox", icon: "☑" },
    { type: "switch", label: "Switch", icon: "⇄" },
    { type: "datePicker", label: "Date", icon: "📅" },
    { type: "searchInput", label: "Search", icon: "🔍" },
    { type: "fileUpload", label: "File Upload", icon: "📎" },
  ]},
  { group: "Media", items: [
    { type: "image", label: "Image", icon: "🖼" },
    { type: "camera", label: "Camera", icon: "📷" },
    { type: "fileUpload", label: "File Upload", icon: "📎" },
  ]},
  { group: "Data", items: [
    { type: "dataTable", label: "Data Table", icon: "▦" },
    { type: "timeline", label: "Timeline", icon: "┊" },
    { type: "chart", label: "Chart", icon: "📈" },
    { type: "statCard", label: "Stat Card", icon: "▣" },
  ]},
  { group: "Display", items: [
    { type: "text", label: "Text", icon: "T" },
    { type: "button", label: "Button", icon: "⬚" },
    { type: "divider", label: "Divider", icon: "—" },
    { type: "avatar", label: "Avatar", icon: "◍" },
    { type: "badge", label: "Badge", icon: "•" },
    { type: "statusChip", label: "Status", icon: "◆" },
  ]},
] as const;

// Sensible default props/bindings per component type.
export function defaultComponent(type: string): any {
  const base: any = { id: crypto.randomUUID(), type, props: {}, bindings: {}, style: {} };
  switch (type) {
    case "text": base.props = { text: "Text" }; break;
    case "button": base.props = { label: "Button" }; break;
    case "input": base.props = { placeholder: "Enter value…" }; break;
    case "searchInput": base.props = { placeholder: "Search…" }; break;
    case "select": base.props = { placeholder: "Select…", options: [] }; break;
    case "checkbox":
    case "switch": base.props = { label: "Toggle" }; break;
    case "fileUpload": base.props = { storePath: "local.file", label: "Upload" }; break;
    case "statusChip": base.props = { value: "active" }; break;
    case "image": base.props = { fit: "cover", height: 160, radius: 8 }; base.bindings = { src: "$row.photo_url" }; break;
    case "camera": base.props = { storePath: "local.photo", facing: "back", label: "Take Photo", previewEnabled: true }; break;
    case "chart":
      base.props = { type: "line", dataSource: "$local.weights", xKey: "date", yKey: "weight", height: 180, showGrid: true, title: "Weight" };
      base.bindings = { dataSource: "$local.weights" };
      break;
    case "statCard": base.props = { label: "Current Weight", value: "0", unit: "kg", deltaDirection: "down-good", icon: "⚖️" }; base.bindings = { value: "$local.currentWeight" }; break;
    case "dataTable":
      base.props = { columns: [], dataSource: "$local.rows", searchable: true, pagination: { enabled: true, pageSize: 10 } };
      base.bindings = { dataSource: "$local.rows" };
      break;
    case "timeline":
      base.props = { dataSource: "$local.events", titleKey: "label", orientation: "vertical" };
      base.bindings = { dataSource: "$local.events" };
      break;
    case "tabs": base.props = { tabs: [] }; base.children = []; break;
    case "list":
    case "grid":
    case "view":
    case "scroll":
    case "card":
    case "form": base.children = []; break;
  }
  return base;
}

export function componentSummary(c: any): string {
  const p = c.props || {};
  if (c.type === "dataTable") return `${(p.columns || []).length} cols · ${c.bindings?.dataSource || p.dataSource || "—"}`;
  if (c.type === "select") return `${(p.options || []).length} options`;
  if (c.type === "timeline") return c.bindings?.dataSource || p.dataSource || "—";
  if (c.type === "chart") return `${p.type || "line"} · ${c.bindings?.dataSource || p.dataSource || "—"}`;
  if (c.type === "statCard") return p.label || (c.bindings?.value || p.value || "");
  if (c.type === "image") return c.bindings?.src || p.src || "image";
  if (c.type === "camera") return p.storePath || "photo";
  return p.label || p.text || p.placeholder || p.value || "";
}

function ComponentsTab({ frames }: { frames: CanvasFrame[] }) {
  const screens = useRuntimeStore((s) => s.schema.screens ?? EMPTY);
  const addScreen = useRuntimeStore((s) => s.addScreen);
  const removeScreen = useRuntimeStore((s) => s.removeScreen);
  const syncFromCanvas = useRuntimeStore((s) => s.syncFromCanvas);
  const addComponent = useRuntimeStore((s) => s.addComponent);
  const removeComponent = useRuntimeStore((s) => s.removeComponent);
  const moveComponent = useRuntimeStore((s) => s.moveComponent);

  const [selectedId, setSelectedId] = useState<string>("");
  const [newScreen, setNewScreen] = useState("");
  const [showPalette, setShowPalette] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Default-select the first screen.
  useEffect(() => {
    if (!selectedId && screens.length) setSelectedId((screens[0] as any).id);
  }, [screens, selectedId]);

  const screen: any = screens.find((s: any) => s.id === selectedId) || screens[0];
  const components: any[] = screen?.components || [];

  const unsyncedFrames = frames.filter((f) => !screens.some((s: any) => s.id === f.id));

  const handleAddScreen = () => {
    if (!newScreen.trim()) return;
    const slug = newScreen.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const id = crypto.randomUUID();
    addScreen({ id, name: newScreen.trim(), route: `/${slug}`, components: [], localState: [], actions: [] } as any);
    setSelectedId(id);
    setNewScreen("");
  };

  return (
    <div className="space-y-2">
      {/* Screen selector */}
      <div className="flex items-center gap-1">
        <select value={screen?.id || ""} onChange={(e) => setSelectedId(e.target.value)}
          className="flex-1 rounded bg-zinc-800 px-2 py-1 text-xs text-white outline-none ring-1 ring-zinc-700 focus:ring-indigo-500">
          {screens.length === 0 && <option value="">No screens</option>}
          {screens.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {screen && (
          <button onClick={() => { removeScreen(screen.id); setSelectedId(""); }}
            title="Delete screen" className="text-zinc-500 hover:text-red-400"><TrashIcon /></button>
        )}
      </div>

      {/* Sync frames / add screen */}
      <div className="flex items-center gap-1">
        <input value={newScreen} onChange={(e) => setNewScreen(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddScreen()}
          placeholder="New screen name…" className="flex-1 rounded bg-zinc-900 px-1.5 py-0.5 text-xs text-white outline-none ring-1 ring-zinc-700 focus:ring-indigo-500" />
        <button onClick={handleAddScreen} className="rounded bg-indigo-600 p-1 text-white hover:bg-indigo-500"><PlusIcon /></button>
      </div>
      {unsyncedFrames.length > 0 && (
        <button onClick={() => { syncFromCanvas(frames); if (!selectedId && frames[0]) setSelectedId(frames[0].id); }}
          className="w-full rounded border border-dashed border-indigo-700/60 bg-indigo-900/20 py-1 text-[10px] text-indigo-300 hover:bg-indigo-900/40">
          ⟳ Sync {unsyncedFrames.length} canvas frame{unsyncedFrames.length > 1 ? "s" : ""} → screens
        </button>
      )}

      {screens.length === 0 && (
        <div className="rounded-lg border border-dashed border-zinc-700 p-4 text-center text-zinc-500">
          <p className="text-[11px]">No screens yet</p>
          <p className="text-[10px]">Sync from the canvas or add a screen to place components.</p>
        </div>
      )}

      {/* Component list */}
      {screen && (
        <>
          <p className="text-[10px] text-zinc-500 uppercase font-semibold tracking-wider">Components · {screen.name}</p>
          {components.length === 0 && (
            <div className="rounded-lg border border-dashed border-zinc-700 p-3 text-center text-zinc-500">
              <p className="text-[10px]">No components. Add a data table, dropdown, or more below.</p>
            </div>
          )}
          {components.map((c, i) => (
            <div key={c.id} className="rounded-lg border border-zinc-700/60 bg-zinc-800/50">
              <div className="flex items-center gap-1.5 px-2 py-1.5 cursor-pointer" onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
                <span className="text-[10px] text-indigo-400">{expanded === c.id ? "▼" : "▶"}</span>
                <span className="rounded bg-indigo-900/40 px-1 py-0.5 text-[9px] text-indigo-300">{c.type}</span>
                <span className="truncate text-[11px] text-zinc-300">{componentSummary(c)}</span>
                <span className="ml-auto flex items-center gap-0.5">
                  <button onClick={(e) => { e.stopPropagation(); moveComponent(screen.id, c.id, -1); }} disabled={i === 0}
                    className="px-0.5 text-zinc-500 hover:text-zinc-200 disabled:opacity-30">↑</button>
                  <button onClick={(e) => { e.stopPropagation(); moveComponent(screen.id, c.id, 1); }} disabled={i === components.length - 1}
                    className="px-0.5 text-zinc-500 hover:text-zinc-200 disabled:opacity-30">↓</button>
                  <button onClick={(e) => { e.stopPropagation(); removeComponent(screen.id, c.id); }}
                    className="px-0.5 text-zinc-500 hover:text-red-400">×</button>
                </span>
              </div>
              {expanded === c.id && (
                <div className="border-t border-zinc-700/50 px-2 py-1.5">
                  <ComponentConfigEditor screenId={screen.id} component={c} />
                </div>
              )}
            </div>
          ))}

          {/* Palette */}
          <button onClick={() => setShowPalette(!showPalette)}
            className="w-full rounded bg-zinc-700/50 py-1 text-[10px] text-zinc-300 hover:bg-zinc-700">
            {showPalette ? "Hide components" : "+ Add Component"}
          </button>
          {showPalette && (
            <div className="space-y-1.5 rounded border border-zinc-700/50 bg-zinc-900/40 p-1.5">
              {COMPONENT_PALETTE.map((g) => (
                <div key={g.group}>
                  <p className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1">{g.group}</p>
                  <div className="flex flex-wrap gap-1">
                    {g.items.map((it) => (
                      <button key={it.type}
                        onClick={() => { const comp = defaultComponent(it.type); addComponent(screen.id, comp); setExpanded(comp.id); }}
                        className="flex items-center gap-1 rounded border border-zinc-700/50 bg-zinc-900/60 px-1.5 py-0.5 text-[10px] text-zinc-400 hover:text-white hover:border-zinc-500">
                        <span>{it.icon}</span><span>{it.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Labeled text field (module-level so inputs keep focus) ───
export function CfgField({ label, value, onChange, placeholder, mono }: {
  label: string; value: any; onChange: (v: string) => void; placeholder?: string; mono?: boolean;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[9px] text-zinc-500 uppercase tracking-wider">{label}</span>
      <input value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className={`rounded bg-zinc-900 px-1.5 py-0.5 text-[11px] text-white outline-none ring-1 ring-zinc-700 focus:ring-indigo-500 ${mono ? "font-mono" : ""}`} />
    </label>
  );
}

// ── Per-component config editor (dispatch by type) ───────────
export function ComponentConfigEditor({ screenId, component }: { screenId: string; component: any }) {
  const updateComponent = useRuntimeStore((s) => s.updateComponent);
  const c = component;
  const patchProps = (patch: any) => updateComponent(screenId, c.id, { props: { ...(c.props || {}), ...patch } } as any);
  const patchBindings = (patch: any) => updateComponent(screenId, c.id, { bindings: { ...(c.bindings || {}), ...patch } } as any);

  return (
    <div className="space-y-1.5 text-xs">
      {/* Type-specific editors */}
      {c.type === "select" && (
        <>
          <CfgField label="Bind value to (state)" value={c.bindings?.inputBind} mono
            onChange={(v: string) => patchBindings({ inputBind: v })} placeholder="$form.country" />
          <CfgField label="Placeholder" value={c.props?.placeholder}
            onChange={(v: string) => patchProps({ placeholder: v })} placeholder="Select…" />
          <SelectOptionsEditor options={c.props?.options || []} onChange={(opts: any) => patchProps({ options: opts })} />
        </>
      )}

      {c.type === "dataTable" && (
        <>
          <CfgField label="Data source (state / table)" value={c.bindings?.dataSource || c.props?.dataSource} mono
            onChange={(v: string) => { patchBindings({ dataSource: v }); patchProps({ dataSource: v }); }} placeholder="$local.expenses" />
          <DataTableColumnsEditor columns={c.props?.columns || []} onChange={(cols: any) => patchProps({ columns: cols })} />
          <label className="flex items-center gap-1 text-[10px] text-zinc-400">
            <input type="checkbox" checked={c.props?.searchable ?? false} onChange={(e) => patchProps({ searchable: e.target.checked })} /> Searchable
          </label>
        </>
      )}

      {c.type === "timeline" && (
        <>
          <CfgField label="Data source" value={c.bindings?.dataSource || c.props?.dataSource} mono
            onChange={(v: string) => { patchBindings({ dataSource: v }); patchProps({ dataSource: v }); }} placeholder="$local.history" />
          <div className="grid grid-cols-2 gap-1">
            <CfgField label="Title key" value={c.props?.titleKey} onChange={(v: string) => patchProps({ titleKey: v })} placeholder="label" />
            <CfgField label="Status key" value={c.props?.statusKey} onChange={(v: string) => patchProps({ statusKey: v })} placeholder="status" />
          </div>
        </>
      )}

      {(c.type === "text" || c.type === "button") && (
        <>
          <CfgField label="Label / text" value={c.props?.label ?? c.props?.text}
            onChange={(v: string) => patchProps(c.type === "button" ? { label: v } : { text: v })} placeholder="Label" />
          <CfgField label="Bind text to (state)" value={c.bindings?.textBind} mono
            onChange={(v: string) => patchBindings({ textBind: v })} placeholder="$user.name" />
          {c.type === "button" && (
            <CfgField label="On press (action id)" value={c.bindings?.onClick} mono
              onChange={(v: string) => patchBindings({ onClick: v })} placeholder="submitForm" />
          )}
        </>
      )}

      {(c.type === "input" || c.type === "searchInput" || c.type === "checkbox" || c.type === "switch" || c.type === "datePicker") && (
        <>
          <CfgField label="Bind value to (state)" value={c.bindings?.inputBind} mono
            onChange={(v: string) => patchBindings({ inputBind: v })} placeholder="$form.email" />
          {(c.type === "input" || c.type === "searchInput" || c.type === "datePicker") && (
            <CfgField label="Placeholder" value={c.props?.placeholder} onChange={(v: string) => patchProps({ placeholder: v })} placeholder="Placeholder" />
          )}
          {(c.type === "checkbox" || c.type === "switch") && (
            <CfgField label="Label" value={c.props?.label} onChange={(v: string) => patchProps({ label: v })} placeholder="Toggle" />
          )}
        </>
      )}

      {c.type === "fileUpload" && (
        <CfgField label="Store URL to (state)" value={c.props?.storePath} mono
          onChange={(v: string) => patchProps({ storePath: v })} placeholder="local.receipt_url" />
      )}

      {c.type === "statusChip" && (
        <CfgField label="Value (state / static)" value={c.bindings?.textBind || c.props?.value} mono
          onChange={(v: string) => v.startsWith("$") ? patchBindings({ textBind: v }) : patchProps({ value: v })} placeholder="$row.status" />
      )}

      {c.type === "image" && (
        <>
          <CfgField label="Image source (state / URL)" value={c.bindings?.src || c.props?.src} mono
            onChange={(v: string) => v.startsWith("$") ? patchBindings({ src: v }) : patchProps({ src: v })} placeholder="$row.photo_url" />
          <div className="grid grid-cols-2 gap-1">
            <label className="flex flex-col gap-0.5">
              <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Fit</span>
              <select value={c.props?.fit || "cover"} onChange={(e) => patchProps({ fit: e.target.value })}
                className="rounded bg-zinc-900 px-1 py-0.5 text-[10px] text-zinc-300 outline-none ring-1 ring-zinc-700">
                {["cover", "contain", "fill"].map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>
            <CfgField label="Height (px)" value={c.props?.height} onChange={(v: string) => patchProps({ height: Number(v) || undefined })} placeholder="160" />
          </div>
        </>
      )}

      {c.type === "camera" && (
        <>
          <CfgField label="Store photo URL to (state)" value={c.props?.storePath} mono
            onChange={(v: string) => patchProps({ storePath: v })} placeholder="local.body_photo" />
          <div className="grid grid-cols-2 gap-1">
            <label className="flex flex-col gap-0.5">
              <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Facing</span>
              <select value={c.props?.facing || "back"} onChange={(e) => patchProps({ facing: e.target.value })}
                className="rounded bg-zinc-900 px-1 py-0.5 text-[10px] text-zinc-300 outline-none ring-1 ring-zinc-700">
                {["back", "front"].map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>
            <CfgField label="Button label" value={c.props?.label} onChange={(v: string) => patchProps({ label: v })} placeholder="Take Photo" />
          </div>
        </>
      )}

      {c.type === "chart" && (
        <>
          <CfgField label="Data source (state)" value={c.bindings?.dataSource || c.props?.dataSource} mono
            onChange={(v: string) => { patchBindings({ dataSource: v }); patchProps({ dataSource: v }); }} placeholder="$local.weights" />
          <div className="grid grid-cols-3 gap-1">
            <label className="flex flex-col gap-0.5">
              <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Type</span>
              <select value={c.props?.type || "line"} onChange={(e) => patchProps({ type: e.target.value })}
                className="rounded bg-zinc-900 px-1 py-0.5 text-[10px] text-zinc-300 outline-none ring-1 ring-zinc-700">
                {["line", "bar", "area"].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <CfgField label="X key" value={c.props?.xKey} onChange={(v: string) => patchProps({ xKey: v })} placeholder="date" />
            <CfgField label="Y key" value={c.props?.yKey} onChange={(v: string) => patchProps({ yKey: v })} placeholder="weight" />
          </div>
          <CfgField label="Title" value={c.props?.title} onChange={(v: string) => patchProps({ title: v })} placeholder="Weight over time" />
        </>
      )}

      {c.type === "statCard" && (
        <>
          <CfgField label="Label" value={c.props?.label} onChange={(v: string) => patchProps({ label: v })} placeholder="Current Weight" />
          <CfgField label="Value (state / static)" value={c.bindings?.value || c.props?.value} mono
            onChange={(v: string) => v.startsWith("$") ? patchBindings({ value: v }) : patchProps({ value: v })} placeholder="$local.currentWeight" />
          <div className="grid grid-cols-2 gap-1">
            <CfgField label="Unit" value={c.props?.unit} onChange={(v: string) => patchProps({ unit: v })} placeholder="kg" />
            <CfgField label="Delta (state)" value={c.bindings?.delta || c.props?.delta} mono
              onChange={(v: string) => v.startsWith("$") ? patchBindings({ delta: v }) : patchProps({ delta: v })} placeholder="$local.weightDelta" />
          </div>
          <label className="flex flex-col gap-0.5">
            <span className="text-[9px] text-zinc-500 uppercase tracking-wider">Good direction</span>
            <select value={c.props?.deltaDirection || "down-good"} onChange={(e) => patchProps({ deltaDirection: e.target.value })}
              className="rounded bg-zinc-900 px-1 py-0.5 text-[10px] text-zinc-300 outline-none ring-1 ring-zinc-700">
              <option value="down-good">down is good (weight loss)</option>
              <option value="up-good">up is good (gains/streak)</option>
            </select>
          </label>
        </>
      )}

      {/* Advanced raw props for power users / unlisted types */}
      <AdvancedPropsEditor screenId={screenId} component={c} />
    </div>
  );
}

export function SelectOptionsEditor({ options, onChange }: { options: any[]; onChange: (o: any[]) => void }) {
  const [val, setVal] = useState("");
  const [lab, setLab] = useState("");
  const add = () => {
    if (!val.trim()) return;
    onChange([...options, { value: val.trim(), label: lab.trim() || val.trim() }]);
    setVal(""); setLab("");
  };
  return (
    <div className="space-y-1 rounded border border-dashed border-zinc-700 p-1.5">
      <p className="text-[9px] text-zinc-500 uppercase tracking-wider">Options</p>
      {options.map((o, i) => (
        <div key={i} className="flex items-center gap-1 rounded bg-zinc-900/60 px-1.5 py-0.5 text-[10px]">
          <span className="font-mono text-white">{String(o.value)}</span>
          <span className="text-zinc-500">→ {String(o.label ?? o.value)}</span>
          <button onClick={() => onChange(options.filter((_, j) => j !== i))} className="ml-auto text-zinc-500 hover:text-red-400">×</button>
        </div>
      ))}
      <div className="flex gap-1">
        <input value={val} onChange={(e) => setVal(e.target.value)} placeholder="value"
          className="w-1/2 rounded bg-zinc-900 px-1.5 py-0.5 text-[11px] text-white outline-none ring-1 ring-zinc-700 focus:ring-indigo-500" />
        <input value={lab} onChange={(e) => setLab(e.target.value)} placeholder="label" onKeyDown={(e) => e.key === "Enter" && add()}
          className="flex-1 rounded bg-zinc-900 px-1.5 py-0.5 text-[11px] text-white outline-none ring-1 ring-zinc-700 focus:ring-indigo-500" />
        <button onClick={add} className="rounded bg-indigo-600 px-2 py-0.5 text-[10px] text-white hover:bg-indigo-500">+</button>
      </div>
    </div>
  );
}

export const COLUMN_TYPES = ["text", "number", "currency", "date", "status", "avatar", "actions"] as const;

export function DataTableColumnsEditor({ columns, onChange }: { columns: any[]; onChange: (c: any[]) => void }) {
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [type, setType] = useState<string>("text");
  const add = () => {
    if (!key.trim()) return;
    onChange([...columns, { key: key.trim(), label: label.trim() || key.trim(), type }]);
    setKey(""); setLabel("");
  };
  return (
    <div className="space-y-1 rounded border border-dashed border-zinc-700 p-1.5">
      <p className="text-[9px] text-zinc-500 uppercase tracking-wider">Columns</p>
      {columns.map((col, i) => (
        <div key={i} className="flex items-center gap-1 rounded bg-zinc-900/60 px-1.5 py-0.5 text-[10px]">
          <span className="font-mono text-white">{col.key}</span>
          <span className="text-zinc-500">{col.label}</span>
          <span className="rounded bg-zinc-700 px-1 py-0.5 text-[9px] text-zinc-400">{col.type || "text"}</span>
          <button onClick={() => onChange(columns.filter((_, j) => j !== i))} className="ml-auto text-zinc-500 hover:text-red-400">×</button>
        </div>
      ))}
      <div className="flex gap-1">
        <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="key"
          className="w-1/3 rounded bg-zinc-900 px-1.5 py-0.5 text-[11px] text-white outline-none ring-1 ring-zinc-700 focus:ring-indigo-500" />
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="label" onKeyDown={(e) => e.key === "Enter" && add()}
          className="flex-1 rounded bg-zinc-900 px-1.5 py-0.5 text-[11px] text-white outline-none ring-1 ring-zinc-700 focus:ring-indigo-500" />
        <select value={type} onChange={(e) => setType(e.target.value)}
          className="rounded bg-zinc-900 px-1 py-0.5 text-[10px] text-zinc-300 outline-none ring-1 ring-zinc-700">
          {COLUMN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={add} className="rounded bg-indigo-600 px-2 py-0.5 text-[10px] text-white hover:bg-indigo-500">+</button>
      </div>
    </div>
  );
}

export function AdvancedPropsEditor({ screenId, component }: { screenId: string; component: any }) {
  const updateComponent = useRuntimeStore((s) => s.updateComponent);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => JSON.stringify(component.props || {}, null, 2));
  const apply = () => { try { updateComponent(screenId, component.id, { props: JSON.parse(text) } as any); } catch {} };
  return (
    <div className="rounded border border-zinc-700/40">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-1 px-1.5 py-1 text-[9px] uppercase tracking-wider text-zinc-500 hover:text-zinc-300">
        <span>{open ? "▼" : "▶"}</span> Advanced (raw props)
      </button>
      {open && (
        <div className="border-t border-zinc-700/40 p-1.5 space-y-1">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4}
            className="w-full rounded bg-zinc-900 p-1.5 text-[10px] font-mono text-zinc-300 outline-none ring-1 ring-zinc-700 focus:ring-indigo-500" />
          <button onClick={apply} className="rounded bg-indigo-600 px-2 py-0.5 text-[10px] text-white hover:bg-indigo-500">Apply props</button>
        </div>
      )}
    </div>
  );
}
