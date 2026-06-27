// ═══════════════════════════════════════════════════════════════
// Mobile Preview Page — Live-updating mobile app simulator
//
// URL: /preview/{projectId}
// Fetches the latest committed config and renders it inside
// a device frame. Subscribes to WebSocket for live updates.
// ═══════════════════════════════════════════════════════════════
"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { io, type Socket } from "socket.io-client";
import { ScreenNavigator } from "@/components/MobileRenderer";
import SchemaRenderer from "@/components/SchemaRenderer";
import { RuntimeProvider } from "@/components/runtime/RuntimeProvider";
import type { MobileScreen } from "@/lib/mobileConfig";
import type { AppSchema } from "@/lib/runtime/schema";
import FigmaPreviewLoader from "./FigmaPreviewLoader";

// Device frame presets
const DEVICES = [
  { name: "iPhone 14", width: 390, height: 844 },
  { name: "iPhone SE", width: 375, height: 667 },
  { name: "Pixel 7", width: 412, height: 915 },
  { name: "iPad Mini", width: 744, height: 1133 },
] as const;

export default function PreviewPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params?.projectId as string;

  // Figma prototype preview mode
  if (searchParams?.get('mode') === 'figma') {
    return <FigmaPreviewLoader projectId={projectId} />;
  }

  const [config, setConfig] = useState<AppSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [deviceIdx, setDeviceIdx] = useState(0);
  const [activeScreenId, setActiveScreenId] = useState<string>("");
  const [version, setVersion] = useState<number>(0);
  const socketRef = useRef<Socket | null>(null);

  const device = DEVICES[deviceIdx];

  const activeScreen = config?.screens.find((s) => s.id === activeScreenId) || config?.screens[0] || null;

  // Back-navigation history (route paths), driven by RuntimeProvider's nav adapter.
  const historyRef = useRef<string[]>([]);

  // Resolve a route path (from a navigate action) to a screen id and switch to it.
  const navigateToRoute = (route: string) => {
    const target = config?.screens.find((s) => s.route === route || s.id === route);
    if (!target) return;
    setActiveScreenId((prev) => {
      if (prev && prev !== target.id) historyRef.current.push(prev);
      return target.id;
    });
  };

  const navigateBack = () => {
    const prev = historyRef.current.pop();
    if (prev) setActiveScreenId(prev);
  };

  // ScreenNavigator expects MobileScreen[]; adapt ScreenSchema → minimal shape.
  const navScreens: MobileScreen[] = (config?.screens || []).map((s) => ({
    id: s.id,
    name: s.name,
    width: device.width,
    height: device.height,
    backgroundColor: "#FFFFFF",
    components: [],
  }));

  // Fetch initial config
  useEffect(() => {
    if (!projectId) return;

    async function fetchConfig() {
      try {
        setLoading(true);
        const res = await fetch(`/api/mobile-config?projectId=${projectId}`);
        if (!res.ok) {
          if (res.status === 404) {
            setConfig(null);
            setError("No commits yet. Open the editor and click Commit.");
            return;
          }
          throw new Error("Failed to fetch config");
        }
        const data = await res.json();
        const schema: AppSchema | null = data.runtimeSchema || null;
        if (!schema) {
          setConfig(null);
          setError("No runtime schema in latest commit.");
          return;
        }
        setConfig(schema);
        setVersion(data.version);
        setActiveScreenId(schema.screens?.[0]?.id || "");
      } catch (e: any) {
        setError(e.message || "Failed to load preview");
      } finally {
        setLoading(false);
      }
    }

    fetchConfig();
  }, [projectId]);

  // WebSocket subscription for live updates
  useEffect(() => {
    if (!projectId) return;

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3002";
    const socket = io(wsUrl, {
      transports: ["websocket", "polling"],
      autoConnect: true,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("subscribe-project", { projectId });
    });

    socket.on("project-subscribed", () => {
      console.log("📱 Subscribed to project updates");
    });

    socket.on("config-update", (data: { projectId: string; version: number; runtimeSchema?: AppSchema; config?: { designData?: { runtimeSchema?: AppSchema } } }) => {
      if (data.projectId === projectId) {
        console.log(`📱 Received config update v${data.version}`);
        const schema = data.runtimeSchema || data.config?.designData?.runtimeSchema || null;
        if (!schema) return;
        setConfig(schema);
        setVersion(data.version);
        setError(null);

        // Update active screen if the current one still exists
        setActiveScreenId((prev) => {
          const exists = schema.screens.some((s) => s.id === prev);
          if (exists) return prev;
          return schema.screens?.[0]?.id || "";
        });
      }
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    return () => {
      socket.emit("unsubscribe-project", { projectId });
      socket.disconnect();
      socketRef.current = null;
    };
  }, [projectId]);

  // Loading state
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
          <p className="text-sm text-zinc-400">Loading preview...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-zinc-950">
      {/* ── Top Bar ── */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900/80 px-4 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2">
              <rect x="7" y="2" width="10" height="20" rx="2" />
              <path d="M11 18h2" />
            </svg>
            <span className="text-sm font-semibold text-zinc-200">Live Preview</span>
          </div>
          <div className="h-4 w-px bg-zinc-700" />
          <span className="text-xs text-zinc-500">
            {config ? `v${version} · ${config.screens.length} screen${config.screens.length !== 1 ? "s" : ""}` : "No config"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Connection status */}
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${connected ? "bg-green-400 animate-pulse" : "bg-zinc-600"}`} />
            <span className="text-xs text-zinc-500">{connected ? "Live" : "Offline"}</span>
          </div>

          {/* Device selector */}
          <select
            value={deviceIdx}
            onChange={(e) => setDeviceIdx(parseInt(e.target.value))}
            className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300 border border-zinc-700 focus:border-violet-500 focus:outline-none"
          >
            {DEVICES.map((d, i) => (
              <option key={d.name} value={i}>
                {d.name} ({d.width}×{d.height})
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* ── Screen navigator ── */}
      {config && config.screens.length > 1 && (
        <div className="shrink-0 border-b border-zinc-800 bg-zinc-900/50">
          <ScreenNavigator
            screens={navScreens}
            currentScreenId={activeScreenId}
            onNavigate={setActiveScreenId}
          />
        </div>
      )}

      {/* ── Device frame ── */}
      <div className="flex flex-1 items-center justify-center overflow-auto p-8">
        {error && !config ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="rounded-full bg-zinc-800 p-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.5">
                <rect x="7" y="2" width="10" height="20" rx="2" />
                <path d="M11 18h2" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-300">No preview available</p>
              <p className="mt-1 text-xs text-zinc-500">{error}</p>
            </div>
          </div>
        ) : config ? (
          <div className="flex flex-col items-center gap-4">
            {/* Device bezel */}
            <div
              className="relative overflow-hidden rounded-[36px] border-[3px] border-zinc-700 bg-black shadow-2xl shadow-black/50"
              style={{
                width: device.width + 24,
                height: device.height + 24,
              }}
            >
              {/* Notch / Dynamic Island */}
              <div className="absolute left-1/2 top-3 z-10 h-[26px] w-[100px] -translate-x-1/2 rounded-full bg-black" />

              {/* Screen content */}
              <div
                className="absolute left-3 top-3 overflow-auto rounded-[28px] bg-white"
                style={{ width: device.width, height: device.height }}
              >
                {activeScreen && config ? (
                  <RuntimeProvider schema={config} onNavigate={navigateToRoute} onBack={navigateBack}>
                    <SchemaRenderer components={activeScreen.components} projectId={projectId} />
                  </RuntimeProvider>
                ) : null}
              </div>

              {/* Home indicator */}
              <div className="absolute bottom-2 left-1/2 h-[4px] w-[100px] -translate-x-1/2 rounded-full bg-zinc-600" />
            </div>

            {/* Device name label */}
            <span className="text-xs text-zinc-600">{device.name}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
