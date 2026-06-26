"use client";

// ═══════════════════════════════════════════════════════════════
// SettingsPanel — App Settings page for the studio. Covers core
// configuration, build status simulation, data management, backups,
// and the danger zone. Self-contained; reads projectId from props
// and patches via /api/projects.
// ═══════════════════════════════════════════════════════════════

import { useRef, useState, useEffect } from "react";
import {
  Download,
  Upload,
  Trash2,
  RotateCcw,
  Plus,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRuntimeStore } from "@/lib/runtime/runtime-store";
import { Field, TextField, Btn, Pill, cx } from "./primitives";

// ── Types ────────────────────────────────────────────────────────

type BuildPhase = "idle" | "building" | "complete";

interface BackupEntry {
  id: string;
  label: string;
  timestamp: string;
}

// ── Constants ────────────────────────────────────────────────────

const BACKUPS: BackupEntry[] = [
  { id: "b1", label: "Auto-save (Before Build)", timestamp: "Today, 14:02" },
  { id: "b2", label: "Manual Backup (v1.0.3)", timestamp: "Yesterday, 09:15" },
  { id: "b3", label: "Initial Setup", timestamp: "Oct 12, 10:00" },
];

const BUILD_LOG_LINES = [
  "[10:04:01] Starting build pipeline...",
  "[10:04:02] Resolving dependencies",
  "[10:04:03] Bundling runtime schema",
  "[10:04:05] Compiling assets (Web)",
  "[10:04:08] Optimizing images",
  "[10:04:10] Generating output files",
  "[10:04:12] Build complete.",
];

// ── Card shell ───────────────────────────────────────────────────

function Card({ children, danger }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <div
      className="rounded-[var(--st-r-lg)] p-5"
      style={{
        background: "var(--st-surface)",
        boxShadow: danger
          ? "inset 0 0 0 1.5px var(--st-error)"
          : "inset 0 0 0 1px var(--st-border)",
      }}
    >
      {children}
    </div>
  );
}

function CardTitle({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <p
      className="mb-3.5 text-[10.5px] font-semibold uppercase tracking-[0.08em]"
      style={{ color: color ?? "var(--st-text-2)" }}
    >
      {children}
    </p>
  );
}

// ── Toast ────────────────────────────────────────────────────────

function Toast({ msg, show }: { msg: string; show: boolean }) {
  return (
    <div
      className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 transition-all duration-300"
      style={{ opacity: show ? 1 : 0, transform: `translateX(-50%) translateY(${show ? 0 : 8}px)` }}
    >
      <div
        className="flex items-center gap-2 rounded-[var(--st-r-md)] px-4 py-2.5 text-[12.5px] font-medium"
        style={{ background: "var(--st-elevated)", color: "var(--st-text)", boxShadow: "var(--st-shadow-raised)" }}
      >
        <CheckCircle2 size={14} style={{ color: "var(--st-success)" }} />
        {msg}
      </div>
    </div>
  );
}

// ── BackupRow ────────────────────────────────────────────────────

function BackupRow({ entry }: { entry: BackupEntry }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      className="flex items-center justify-between rounded-[var(--st-r-sm)] px-2.5 py-2 transition-colors"
      style={{ background: hovered ? "var(--st-surface-2)" : "transparent" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div>
        <div className="text-[12px] font-medium" style={{ color: "var(--st-text)" }}>
          {entry.label}
        </div>
        <div className="text-[10.5px]" style={{ color: "var(--st-text-3)" }}>
          {entry.timestamp}
        </div>
      </div>
      <button
        type="button"
        className={cx(
          "grid h-6 w-6 place-items-center rounded-[var(--st-r-sm)] transition-all",
          hovered ? "opacity-100" : "opacity-0"
        )}
        style={{ color: "var(--st-text-3)" }}
        title="Restore backup"
      >
        <RotateCcw size={12} />
      </button>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────

export function SettingsPanel({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { schema, exportSchema } = useRuntimeStore();

  // Derive default bundle id slug from project name
  const slug = schema.name?.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") ?? "app";

  // Form state
  const [name, setName] = useState(schema.name ?? "");
  const [bundleId, setBundleId] = useState(`com.${slug}.app`);
  const [version, setVersion] = useState(schema.version ?? "1.0.0");
  const [description, setDescription] = useState("");

  // Keep form in sync if schema name/version changes externally (e.g. import)
  useEffect(() => {
    setName(schema.name ?? "");
    setVersion(schema.version ?? "1.0.0");
  }, [schema.name, schema.version]);

  // Toast
  const [toast, setToast] = useState({ show: false, msg: "" });
  function showToast(msg: string) {
    setToast({ show: true, msg });
    setTimeout(() => setToast((t) => ({ ...t, show: false })), 2500);
  }

  // Build simulation state
  const [buildPhase, setBuildPhase] = useState<BuildPhase>("idle");
  const [buildProgress, setBuildProgress] = useState(0);
  const [buildStep, setBuildStep] = useState(0);
  const [lastBuiltAt, setLastBuiltAt] = useState<string | null>(null);
  const buildTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startBuild() {
    setBuildPhase("building");
    setBuildProgress(0);
    setBuildStep(0);
    let pct = 0;
    let step = 0;
    buildTimerRef.current = setInterval(() => {
      pct = Math.min(pct + 20, 100);
      step = Math.min(step + 1, BUILD_LOG_LINES.length - 1);
      setBuildProgress(pct);
      setBuildStep(step);
      if (pct >= 100) {
        clearInterval(buildTimerRef.current!);
        setBuildPhase("complete");
        setLastBuiltAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      }
    }, 600);
  }

  function cancelBuild() {
    if (buildTimerRef.current) clearInterval(buildTimerRef.current);
    setBuildPhase("idle");
    setBuildProgress(0);
    setBuildStep(0);
  }

  // File import ref
  const importRef = useRef<HTMLInputElement>(null);

  // ── Handlers ────────────────────────────────────────────────

  async function handleSave() {
    try {
      await fetch("/api/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: projectId, name, description }),
      });
    } catch {
      // silently ignore network errors
    }
    showToast("Changes saved");
  }

  function handleExport() {
    const json = exportSchema();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}-schema.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        useRuntimeStore.getState().initSchema(parsed.id ?? projectId, parsed.name ?? name, parsed);
        useRuntimeStore.setState({ dirty: true });
        showToast("Project imported");
      } catch {
        showToast("Invalid JSON file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function handleDeleteProject() {
    const ok = window.confirm("Delete this project? This action is permanent and cannot be undone.");
    if (ok) router.push("/projects");
  }

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="h-full w-full overflow-y-auto" style={{ background: "var(--st-canvas)" }}>
      <div className="mx-auto max-w-3xl px-6 pb-10 pt-8">
        {/* Page header */}
        <h1 className="text-2xl font-semibold" style={{ color: "var(--st-text)" }}>
          App Settings
        </h1>
        <p className="mt-1 text-[13px]" style={{ color: "var(--st-text-3)" }}>
          Configure global application properties, manage deployments, and handle project data.
        </p>

        {/* Two-column grid */}
        <div className="mt-6 grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start gap-4">

          {/* ── LEFT COLUMN ─────────────────────────────────── */}
          <div className="flex flex-col gap-4">

            {/* CORE CONFIGURATION */}
            <Card>
              <CardTitle>Core Configuration</CardTitle>
              <div className="flex flex-col gap-3">
                <Field label="App Name" htmlFor="cfg-name">
                  <TextField
                    id="cfg-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="My App"
                  />
                </Field>
                <Field label="App ID / Bundle Identifier" htmlFor="cfg-bundle">
                  <TextField
                    id="cfg-bundle"
                    value={bundleId}
                    onChange={(e) => setBundleId(e.target.value)}
                    placeholder="com.example.app"
                    mono
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Version" htmlFor="cfg-version">
                    <TextField
                      id="cfg-version"
                      value={version}
                      onChange={(e) => setVersion(e.target.value)}
                      placeholder="1.0.0"
                      mono
                    />
                  </Field>
                  <Field label="Schema Version" htmlFor="cfg-schema" hint="read-only">
                    <TextField
                      id="cfg-schema"
                      value={`v${schema.schemaVersion}_stable`}
                      readOnly
                      mono
                      style={{ opacity: 0.6, cursor: "not-allowed" }}
                    />
                  </Field>
                </div>
                <Field label="Description" htmlFor="cfg-desc">
                  <textarea
                    id="cfg-desc"
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe your app..."
                    className="w-full resize-none rounded-[var(--st-r-md)] px-2.5 py-1.5 text-[12.5px] outline-none transition-shadow placeholder:text-[color:var(--st-text-3)]"
                    style={{
                      background: "var(--st-bg)",
                      color: "var(--st-text)",
                      boxShadow: "inset 0 0 0 1px var(--st-border-2)",
                      fontFamily: "inherit",
                    }}
                    onFocus={(e) => (e.currentTarget.style.boxShadow = "inset 0 0 0 1px var(--st-focus)")}
                    onBlur={(e) => (e.currentTarget.style.boxShadow = "inset 0 0 0 1px var(--st-border-2)")}
                  />
                </Field>
                <div className="flex justify-end pt-1">
                  <Btn variant="primary" onClick={handleSave}>
                    Save Changes
                  </Btn>
                </div>
              </div>
            </Card>

            {/* BUILD STATUS */}
            <Card>
              <div className="mb-3.5 flex items-center gap-2">
                <p
                  className="text-[10.5px] font-semibold uppercase tracking-[0.08em]"
                  style={{ color: "var(--st-text-2)" }}
                >
                  Build Status
                </p>
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    background:
                      buildPhase === "building"
                        ? "var(--st-warning)"
                        : buildPhase === "complete"
                        ? "var(--st-success)"
                        : "var(--st-text-3)",
                  }}
                />
                <span className="text-[11px]" style={{ color: "var(--st-text-3)" }}>
                  {buildPhase === "building" ? "Building..." : buildPhase === "complete" ? "Ready" : "Idle"}
                </span>
              </div>

              {buildPhase === "building" && (
                <div className="flex flex-col gap-3">
                  {/* Progress bar */}
                  <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--st-bg)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${buildProgress}%`, background: "var(--st-brand)" }}
                    />
                  </div>
                  {/* Step info */}
                  <div className="flex items-center justify-between">
                    <span className="text-[11.5px]" style={{ color: "var(--st-text-2)" }}>
                      Compiling assets (Web)
                    </span>
                    <div className="flex items-center gap-2">
                      <Pill tone="neutral">Step {Math.min(buildStep + 1, 5)} of 5</Pill>
                      <span
                        className="text-[11.5px] font-semibold tabular-nums"
                        style={{ color: "var(--st-text)" }}
                      >
                        {buildProgress}%
                      </span>
                    </div>
                  </div>
                  {/* Log console */}
                  <div
                    className="max-h-32 overflow-y-auto rounded-[var(--st-r-md)] p-2.5"
                    style={{ background: "var(--st-bg)", boxShadow: "inset 0 0 0 1px var(--st-border)" }}
                  >
                    {BUILD_LOG_LINES.slice(0, buildStep + 1).map((line, i) => (
                      <div
                        key={i}
                        className="text-[11px] leading-relaxed"
                        style={{ color: "var(--st-text-3)", fontFamily: "var(--st-mono)" }}
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                  {/* Actions */}
                  <div className="flex justify-end gap-2 pt-0.5">
                    <Btn variant="danger" onClick={cancelBuild}>
                      Cancel Build
                    </Btn>
                    <Btn variant="primary" disabled>
                      Deploy
                    </Btn>
                  </div>
                </div>
              )}

              {buildPhase === "complete" && (
                <div className="flex flex-col gap-3">
                  <div
                    className="flex items-center gap-2 rounded-[var(--st-r-md)] p-3"
                    style={{
                      background: "rgba(74,222,128,0.08)",
                      boxShadow: "inset 0 0 0 1px rgba(74,222,128,0.2)",
                    }}
                  >
                    <CheckCircle2 size={14} style={{ color: "var(--st-success)" }} />
                    <span className="text-[12px]" style={{ color: "var(--st-text)" }}>
                      Build ready
                    </span>
                    {lastBuiltAt && (
                      <span className="ml-auto text-[11px]" style={{ color: "var(--st-text-3)" }}>
                        Built at {lastBuiltAt}
                      </span>
                    )}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Btn variant="outline" onClick={() => setBuildPhase("idle")}>
                      Reset
                    </Btn>
                    <Btn variant="primary" onClick={startBuild}>
                      Deploy
                    </Btn>
                  </div>
                </div>
              )}

              {buildPhase === "idle" && (
                <div className="flex items-center justify-between">
                  <span className="text-[12px]" style={{ color: "var(--st-text-3)" }}>
                    No active build. Click Deploy to start.
                  </span>
                  <Btn variant="primary" onClick={startBuild}>
                    Deploy
                  </Btn>
                </div>
              )}
            </Card>
          </div>

          {/* ── RIGHT COLUMN ────────────────────────────────── */}
          <div className="flex flex-col gap-4">

            {/* DATA MANAGEMENT */}
            <Card>
              <CardTitle>Data Management</CardTitle>

              {/* Export */}
              <div className="mb-4">
                <p className="mb-1 text-[11.5px] font-medium" style={{ color: "var(--st-text)" }}>
                  Export Project
                </p>
                <p className="mb-3 text-[11px] leading-relaxed" style={{ color: "var(--st-text-3)" }}>
                  Download a full JSON representation of your project, including screens, components, and state.
                </p>
                <Btn variant="outline" onClick={handleExport}>
                  <Download size={13} />
                  Export .json
                </Btn>
              </div>

              {/* Divider */}
              <div className="mb-4" style={{ height: 1, background: "var(--st-border)" }} />

              {/* Import */}
              <div>
                <p className="mb-1 text-[11.5px] font-medium" style={{ color: "var(--st-text)" }}>
                  Import Project
                </p>
                <div
                  className="mb-3 flex items-start gap-1.5 rounded-[var(--st-r-sm)] p-2"
                  style={{
                    background: "rgba(251,191,36,0.08)",
                    boxShadow: "inset 0 0 0 1px rgba(251,191,36,0.2)",
                  }}
                >
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" style={{ color: "var(--st-warning)" }} />
                  <span className="text-[10.5px] leading-relaxed" style={{ color: "var(--st-warning)" }}>
                    Importing will overwrite the current project state.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => importRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center gap-1.5 rounded-[var(--st-r-md)] py-4 text-[12px] transition-colors hover:bg-white/[0.03]"
                  style={{ color: "var(--st-text-3)", border: "1.5px dashed var(--st-border-2)" }}
                >
                  <Upload size={14} />
                  Select File...
                </button>
                <input
                  ref={importRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleImportChange}
                />
              </div>
            </Card>

            {/* BACKUPS */}
            <Card>
              <div className="mb-3.5 flex items-center justify-between">
                <p
                  className="text-[10.5px] font-semibold uppercase tracking-[0.08em]"
                  style={{ color: "var(--st-text-2)" }}
                >
                  Backups
                </p>
                <button
                  type="button"
                  className="grid h-5 w-5 place-items-center rounded-[var(--st-r-sm)] transition-colors hover:bg-white/[0.06]"
                  style={{ color: "var(--st-text-3)" }}
                  title="Add backup"
                >
                  <Plus size={12} />
                </button>
              </div>
              <div className="flex flex-col gap-0.5">
                {BACKUPS.map((b) => (
                  <BackupRow key={b.id} entry={b} />
                ))}
              </div>
            </Card>

            {/* DANGER ZONE */}
            <Card danger>
              <CardTitle color="var(--st-error)">Danger Zone</CardTitle>
              <p className="mb-4 text-[11.5px]" style={{ color: "var(--st-text-3)" }}>
                Irreversible actions for this project.
              </p>
              <Btn
                variant="danger"
                style={{
                  background: "rgba(239,68,68,0.1)",
                  boxShadow: "inset 0 0 0 1px rgba(239,68,68,0.3)",
                  color: "var(--st-error)",
                }}
                onClick={handleDeleteProject}
              >
                <Trash2 size={13} />
                Delete Project
              </Btn>
            </Card>
          </div>
        </div>
      </div>

      <Toast msg={toast.msg} show={toast.show} />
    </div>
  );
}
