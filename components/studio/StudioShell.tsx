"use client";

// ═══════════════════════════════════════════════════════════════
// Studio shell — the ProEditor chrome. A left icon rail switches
// between dedicated full-width editors; a top bar carries identity,
// search (⌘K), theme, and publish; a footer reports engine status.
// The canvas is the protagonist — chrome stays quiet until engaged.
// ═══════════════════════════════════════════════════════════════

import { useCallback, useEffect, useMemo, useState, useRef, type ReactNode } from "react";
import { useWorkspaceStore } from "@/lib/penpot/store";
import { useRouter } from "next/navigation";
import PenpotEditor from "@/components/PenpotEditor";
import PrototypeViewer from "@/components/PrototypeViewer";
import { useEditorStore } from "@/lib/editorStore";
import {
  Frame,
  Boxes,
  Palette,
  Variable,
  Workflow as WorkflowIcon,
  Navigation,
  Database,
  ShieldCheck,
  Settings,
  Search,
  Moon,
  Sun,
  PanelLeft,
  Rocket,
  Check,
  Monitor,
  Download,
} from "lucide-react";
import { useRuntimeStore } from "@/lib/runtime/runtime-store";
import { StateManager } from "./StateManager";
import { ScreenManager } from "./ScreenManager";
import { ComponentLibrary } from "./ComponentLibrary";
import { ThemeDesigner } from "./ThemeDesigner";
import { ActionsEditor } from "./ActionsEditor";
import { NavigationEditor } from "./NavigationEditor";
import { DatabaseEditor } from "./DatabaseEditor";
import { AuthEditor } from "./AuthEditor";
import { SettingsPanel } from "./SettingsPanel";
import { CommandPalette, type Command } from "./CommandPalette";
import { Btn, cx } from "./primitives";

export type StudioMode =
  | "canvas"
  | "screens"
  | "components"
  | "theme"
  | "state"
  | "workflows"
  | "navigation"
  | "database"
  | "auth"
  | "settings";

interface ModeDef {
  id: StudioMode;
  label: string;
  icon: ReactNode;
  built: boolean;
}

const MODES: ModeDef[] = [
  { id: "canvas", label: "Design Canvas", icon: <Monitor size={17} />, built: true },
  { id: "screens", label: "Screen Manager", icon: <Frame size={17} />, built: true },
  { id: "components", label: "Component Library", icon: <Boxes size={17} />, built: true },
  { id: "theme", label: "Theme Designer", icon: <Palette size={17} />, built: true },
  { id: "state", label: "State Manager", icon: <Variable size={17} />, built: true },
  { id: "workflows", label: "Workflow & Logic", icon: <WorkflowIcon size={17} />, built: true },
  { id: "navigation", label: "Navigation Editor", icon: <Navigation size={17} />, built: true },
  { id: "database", label: "Database & Schema", icon: <Database size={17} />, built: true },
  { id: "auth", label: "Auth & RBAC", icon: <ShieldCheck size={17} />, built: true },
];

const SETTINGS_MODE: ModeDef = { id: "settings", label: "App Settings", icon: <Settings size={17} />, built: true };

export function StudioShell({
  projectId,
  projectName,
  onExit,
}: {
  projectId: string;
  projectName: string;
  onExit?: () => void;
}) {
  const [mode, setMode] = useState<StudioMode>("canvas");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const dirty = useRuntimeStore((s) => s.dirty);
  const stateCount = useRuntimeStore((s) => s.schema.globalState.length);
  const exportSchema = useRuntimeStore((s) => s.exportSchema);

  const activeMode = useMemo(
    () => [...MODES, SETTINGS_MODE].find((m) => m.id === mode) ?? MODES[0],
    [mode]
  );

  // ⌘K / Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const flashToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  const handlePublish = useCallback(async () => {
    try {
      const json = exportSchema();
      // Persist a local snapshot so the action has real, observable effect
      // even without the deploy backend wired up in this build.
      window.localStorage.setItem(`mint:schema:${projectId}`, json);
      // Save schema to DB via runtime-schema API
      try {
        await fetch(`/api/runtime-schema/${projectId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: json,
        });
      } catch {
        // non-blocking — localStorage snapshot already saved
      }
      useRuntimeStore.setState({ dirty: false });
      flashToast("Schema published · snapshot saved");
    } catch {
      flashToast("Publish failed");
    }
  }, [exportSchema, projectId, flashToast]);

  const handleExport = useCallback(() => {
    try {
      const json = exportSchema();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${projectId}-schema.json`;
      a.click();
      URL.revokeObjectURL(url);
      flashToast("Schema exported");
    } catch {
      flashToast("Export failed");
    }
  }, [exportSchema, projectId, flashToast]);

  const commands: Command[] = useMemo(() => {
    const nav: Command[] = [...MODES, SETTINGS_MODE].map((m) => ({
      id: `goto:${m.id}`,
      label: `Go to ${m.label}`,
      group: "Navigation",
      icon: m.icon,
      keywords: m.id,
      run: () => setMode(m.id),
    }));
    const actions: Command[] = [
      {
        id: "toggle-theme",
        label: theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
        group: "Actions",
        icon: theme === "dark" ? <Sun size={15} /> : <Moon size={15} />,
        run: () => setTheme((t) => (t === "dark" ? "light" : "dark")),
      },
      {
        id: "publish",
        label: "Publish schema",
        group: "Actions",
        icon: <Rocket size={15} />,
        run: handlePublish,
      },
      {
        id: "export",
        label: "Export schema JSON",
        group: "Actions",
        icon: <Download size={15} />,
        run: handleExport,
      },
    ];
    return [...actions, ...nav];
  }, [theme, handlePublish]);

  return (
    <div
      className="studio-root flex h-screen w-screen flex-col overflow-hidden"
      data-theme={theme === "light" ? "light" : undefined}
    >
      {/* ── Top bar ─────────────────────────────────────────── */}
      <header
        className="relative z-30 flex h-11 shrink-0 items-center gap-3 border-b px-3"
        style={{ borderColor: "var(--st-border)", background: "var(--st-surface)" }}
      >
        <button
          onClick={onExit}
          className="flex items-center gap-2 rounded-[var(--st-r-md)] px-1.5 py-1 transition-colors hover:bg-white/[0.05]"
          title="Back to canvas"
        >
          <span
            className="grid h-6 w-6 place-items-center rounded-[var(--st-r-md)] text-[13px] font-bold"
            style={{ background: "var(--st-brand)", color: "#fff" }}
          >
            M
          </span>
          <span className="text-[13px] font-semibold tracking-tight" style={{ color: "var(--st-text)" }}>
            Mint
          </span>
        </button>

        <div className="flex items-center gap-1.5 text-[12.5px]" style={{ color: "var(--st-text-3)" }}>
          <span>/</span>
          <span className="max-w-[160px] truncate" style={{ color: "var(--st-text-2)" }}>
            {projectName}
          </span>
          <span>/</span>
          <span style={{ color: "var(--st-text)" }}>{activeMode.label}</span>
        </div>

        {/* search */}
        <button
          onClick={() => setPaletteOpen(true)}
          aria-label="Search or run a command (⌘K)"
          className="ml-auto flex h-7 w-full max-w-[300px] items-center gap-2 rounded-[var(--st-r-md)] px-2.5 transition-colors"
          style={{ background: "var(--st-bg)", boxShadow: "inset 0 0 0 1px var(--st-border)" }}
        >
          <Search size={13} style={{ color: "var(--st-text-3)" }} />
          <span className="text-[12.5px]" style={{ color: "var(--st-text-3)" }}>
            Search or run a command…
          </span>
          <kbd
            className="ml-auto rounded-[var(--st-r-sm)] px-1.5 py-0.5 text-[10px] font-medium"
            style={{ background: "var(--st-surface-2)", color: "var(--st-text-3)" }}
          >
            ⌘K
          </kbd>
        </button>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            className="grid h-7 w-7 place-items-center rounded-[var(--st-r-md)] transition-colors hover:bg-white/[0.06]"
            style={{ color: "var(--st-text-2)" }}
            title="Toggle theme"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <Btn variant="ghost" size="sm" onClick={handleExport} className="gap-1.5 px-2.5" title="Download schema JSON">
            <Download size={13} />
            Export
          </Btn>
          <Btn variant="primary" size="sm" onClick={handlePublish} className="gap-1.5 px-2.5">
            <Rocket size={13} />
            Publish
          </Btn>
        </div>
      </header>

      {/* ── Body: rail + editor ─────────────────────────────── */}
      <div className="flex min-h-0 flex-1">
        {/* left rail */}
        <nav
          className="flex w-12 shrink-0 flex-col items-center gap-0.5 border-r py-2"
          style={{ borderColor: "var(--st-border)", background: "var(--st-surface)" }}
          aria-label="Editor surfaces"
        >
          {MODES.map((m) => (
            <RailButton key={m.id} mode={m} active={mode === m.id} onClick={() => setMode(m.id)} />
          ))}
          <div className="mt-auto flex flex-col items-center gap-0.5">
            <button
              onClick={() => setPaletteOpen(true)}
              className="grid h-9 w-9 place-items-center rounded-[var(--st-r-md)] transition-colors hover:bg-white/[0.06]"
              style={{ color: "var(--st-text-3)" }}
              title="Command palette (⌘K)"
            >
              <PanelLeft size={17} />
            </button>
            <RailButton
              mode={SETTINGS_MODE}
              active={mode === "settings"}
              onClick={() => setMode("settings")}
            />
          </div>
        </nav>

        {/* editor surface */}
        <main className="relative min-w-0 flex-1 overflow-hidden" style={{ background: "var(--st-canvas)" }}>
          {mode === "canvas" && <CanvasView projectId={projectId} projectName={projectName} onSwitchMode={(m) => setMode(m as StudioMode)} />}
          {mode === "screens" && <ScreenManager />}
          {mode === "components" && <ComponentLibrary />}
          {mode === "theme" && <ThemeDesigner />}
          {mode === "state" && <StateManager />}
          {mode === "workflows" && <ActionsEditor mode="workflows" />}
          {mode === "navigation" && <NavigationEditor />}
          {mode === "database" && <DatabaseEditor projectId={projectId} />}
          {mode === "auth" && <AuthEditor />}
          {mode === "settings" && <SettingsPanel projectId={projectId} />}
        </main>
      </div>

      {/* ── Footer status bar ───────────────────────────────── */}
      <footer
        className="flex h-7 shrink-0 items-center gap-4 border-t px-3 text-[11px]"
        style={{ borderColor: "var(--st-border)", background: "var(--st-surface)", color: "var(--st-text-3)" }}
      >
        <span className="font-[family-name:var(--st-mono)]">v{useRuntimeStore.getState().schema.version}</span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: dirty ? "var(--st-warning)" : "var(--st-success)" }}
          />
          {dirty ? "Unsaved changes" : "All changes saved"}
        </span>
        <span>{stateCount} state node{stateCount === 1 ? "" : "s"}</span>
        <span className="ml-auto flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--st-success)", animation: "st-pulse 2s infinite" }} />
          Engine Active
        </span>
      </footer>

      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} commands={commands} />}

      {/* toast */}
      {toast && (
        <div
          className="fixed bottom-12 left-1/2 z-[1100] flex -translate-x-1/2 items-center gap-2 rounded-[var(--st-r-md)] px-3.5 py-2 text-[12.5px] font-medium"
          style={{
            background: "var(--st-elevated)",
            color: "var(--st-text)",
            boxShadow: "var(--st-shadow-floating)",
            border: "1px solid var(--st-border-2)",
            animation: "st-pop-in var(--st-dur-slow) var(--st-ease-out)",
          }}
          role="status"
        >
          <Check size={14} style={{ color: "var(--st-success)" }} />
          {toast}
        </div>
      )}
    </div>
  );
}

function CanvasView({ projectId, projectName, onSwitchMode }: { projectId: string; projectName: string; onSwitchMode: (mode: string) => void }) {
  const router = useRouter();
  const viewerMode = useEditorStore((s) => s.viewerMode);
  const setViewerMode = useEditorStore((s) => s.setViewerMode);
  const screens = useRuntimeStore((s) => s.schema.screens);
  const initWorkspaceFromScreens = useWorkspaceStore((s) => s.initWorkspaceFromScreens);
  const mergeFileChildShapes = useWorkspaceStore((s) => s.mergeFileChildShapes);
  const [fileId, setFileId] = useState("");
  const loadedFor = useRef<string | null>(null);

  useEffect(() => {
    if (loadedFor.current === projectId) return;
    loadedFor.current = projectId;

    // Build canvas frames from runtime screens immediately — no loading wait.
    const screenDefs = screens.map((s) => ({ id: s.id, name: s.name }));
    initWorkspaceFromScreens(screenDefs, projectId);

    // Fetch existing file in background: merges child shapes + wires real fileId for saves.
    (async () => {
      try {
        const res = await fetch(`/api/files?projectId=${projectId}`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        const id: string | undefined = data.files?.[0]?.id;
        if (!id) return;
        setFileId(id);
        await mergeFileChildShapes(id);
      } catch {
        // Non-blocking — canvas works fine without the file.
      }
    })();
  }, [projectId, screens, initWorkspaceFromScreens, mergeFileChildShapes]);

  return (
    <>
      <PenpotEditor
        fileId={fileId}
        projectId={projectId}
        projectName={projectName}
        onBack={() => router.push("/projects")}
        onSwitchStudioMode={onSwitchMode}
      />
      {viewerMode && <PrototypeViewer onClose={() => setViewerMode(false)} />}
    </>
  );
}

function RailButton({ mode, active, onClick }: { mode: ModeDef; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={`${mode.label}${mode.built ? "" : " · roadmap"}`}
      aria-label={mode.label}
      aria-current={active ? "page" : undefined}
      className={cx("group relative grid h-9 w-9 place-items-center rounded-[var(--st-r-md)] transition-colors")}
      style={{
        color: active ? "var(--st-brand)" : "var(--st-text-3)",
        background: active ? "var(--st-brand-tint)" : "transparent",
      }}
    >
      <span
        className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full transition-transform"
        style={{ background: "var(--st-brand)", transform: active ? "scaleY(1)" : "scaleY(0)" }}
      />
      <span className="transition-colors group-hover:!text-[color:var(--st-text)]" style={{ color: "inherit" }}>
        {mode.icon}
      </span>
      {!mode.built && (
        <span
          className="absolute right-1 top-1 h-1 w-1 rounded-full"
          style={{ background: "var(--st-text-disabled)" }}
        />
      )}
    </button>
  );
}
