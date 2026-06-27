// ═══════════════════════════════════════════════════════════════
// StudioPreview — instant, interactive preview of the LIVE schema
//
// Unlike /preview/[projectId] (which loads the last committed config),
// this renders the in-memory runtime store directly, so the user sees
// edits immediately. Mounts the active screen through RuntimeProvider +
// SchemaRenderer, so buttons/inputs/actions actually work. Phase-1 proof
// that the runtime engine runs.
// ═══════════════════════════════════════════════════════════════
"use client";

import React from "react";
import { X, RotateCcw } from "lucide-react";
import { useRuntimeStore } from "@/lib/runtime/runtime-store";
import SchemaRenderer from "@/components/SchemaRenderer";
import { RuntimeProvider } from "@/components/runtime/RuntimeProvider";

const FRAME_W = 390;
const FRAME_H = 844;

export function StudioPreview({ onClose }: { onClose: () => void }) {
  const schema = useRuntimeStore((s) => s.schema);
  // Remount key — bumped to reset runtime state (fresh engines) on demand.
  const [resetKey, setResetKey] = React.useState(0);

  const initialRoute = schema.navigation?.initialRoute || schema.screens[0]?.route || "";
  const [route, setRoute] = React.useState(initialRoute);
  const historyRef = React.useRef<string[]>([]);

  const activeScreen =
    schema.screens.find((s) => s.route === route) ?? schema.screens[0] ?? null;

  const navigateToRoute = (next: string) => {
    const target = schema.screens.find((s) => s.route === next || s.id === next);
    if (!target) return;
    setRoute((prev) => {
      if (prev && prev !== target.route) historyRef.current.push(prev);
      return target.route;
    });
  };
  const navigateBack = () => {
    const prev = historyRef.current.pop();
    if (prev) setRoute(prev);
  };

  const themeBg = (schema.theme?.colors?.background as string) || "#FFFFFF";

  return (
    <div className="fixed inset-0 z-[1200] flex flex-col" style={{ background: "rgba(8,8,11,0.92)", backdropFilter: "blur(6px)" }}>
      {/* top bar */}
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-white/10 px-4">
        <span className="text-[13px] font-semibold text-zinc-200">Live Preview</span>
        <span className="text-[11px] text-zinc-500">
          {schema.screens.length} screen{schema.screens.length === 1 ? "" : "s"} · interactive
        </span>

        {/* screen switcher */}
        <select
          value={route}
          onChange={(e) => navigateToRoute(e.target.value)}
          className="ml-2 rounded bg-zinc-800 px-2 py-1 text-[11px] text-zinc-300 border border-zinc-700 focus:border-violet-500 focus:outline-none"
        >
          {schema.screens.map((s) => (
            <option key={s.id} value={s.route}>{s.name} ({s.route})</option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => { historyRef.current = []; setRoute(initialRoute); setResetKey((k) => k + 1); }}
            className="flex items-center gap-1.5 rounded px-2.5 py-1 text-[11.5px] text-zinc-300 hover:bg-white/10"
            title="Reset preview state"
          >
            <RotateCcw size={13} /> Reset
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 rounded px-2.5 py-1 text-[11.5px] text-zinc-300 hover:bg-white/10"
          >
            <X size={14} /> Close
          </button>
        </div>
      </div>

      {/* device frame */}
      <div className="flex flex-1 items-center justify-center overflow-auto p-8">
        <div className="flex flex-col items-center gap-3">
          <div
            className="relative overflow-hidden rounded-[36px] border-[3px] border-zinc-700 bg-black shadow-2xl"
            style={{ width: FRAME_W + 24, height: FRAME_H + 24 }}
          >
            <div className="absolute left-1/2 top-3 z-10 h-[26px] w-[100px] -translate-x-1/2 rounded-full bg-black" />
            <div
              className="absolute left-3 top-3 overflow-auto rounded-[28px]"
              style={{ width: FRAME_W, height: FRAME_H, background: themeBg }}
            >
              {activeScreen ? (
                <RuntimeProvider
                  key={`${activeScreen.id}-${resetKey}`}
                  schema={schema}
                  onNavigate={navigateToRoute}
                  onBack={navigateBack}
                >
                  <SchemaRenderer components={activeScreen.components} />
                </RuntimeProvider>
              ) : (
                <div className="flex h-full items-center justify-center p-6 text-center text-[12.5px] text-zinc-400">
                  No screens yet. Add screens in the Screen Manager.
                </div>
              )}
            </div>
            <div className="absolute bottom-2 left-1/2 h-[4px] w-[100px] -translate-x-1/2 rounded-full bg-zinc-600" />
          </div>
          <span className="text-[11px] text-zinc-600">{activeScreen?.name ?? ""}</span>
        </div>
      </div>
    </div>
  );
}
