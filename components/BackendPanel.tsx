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

type SubTab = "state" | "actions" | "database" | "workflows";

const FIELD_TYPES = ["text","integer","float","boolean","date","datetime","json","jsonb","enum","uuid","array"] as const;

const EMPTY: any[] = [];

export default function BackendPanel({ projectId }: { projectId: string }) {
  const [subTab, setSubTab] = useState<SubTab>("database");
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
            <span className="ml-auto text-[10px] text-zinc-500">{table.fields?.length || 0} fields</span>
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
                  <span className="rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-300">{f.type}</span>
                  {f.required && <span className="text-[10px] text-amber-400">req</span>}
                  {f.unique && <span className="text-[10px] text-indigo-400">uniq</span>}
                  <button onClick={() => removeField(table.id, f.name)} className="text-zinc-500 hover:text-red-400">×</button>
                </div>
              ))}

              {/* Add field form */}
              <AddFieldForm tableId={table.id} onAdd={addField} />
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

  const handleAdd = () => {
    if (!name.trim()) return;
    onAdd(tableId, { name: name.trim().toLowerCase().replace(/\s+/g, "_"), type, required, unique });
    setName(""); setRequired(false); setUnique(false);
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
