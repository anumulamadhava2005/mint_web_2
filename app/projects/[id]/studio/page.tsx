"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StudioShell } from "@/components/studio/StudioShell";
import { useRuntimeStore } from "@/lib/runtime/runtime-store";

export default function StudioPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [projectId, setProjectId] = useState("");
  const [projectName, setProjectName] = useState("Untitled");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    params.then((p) => setProjectId(p.id));
  }, [params]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    (async () => {
      let name = "Untitled";
      try {
        const res = await fetch(`/api/projects?id=${projectId}`);
        if (res.ok) {
          const data = await res.json();
          name = data.project?.name ?? name;
        }
      } catch {
        /* offline / deep-link — fall back to default name */
      }
      if (cancelled) return;
      setProjectName(name);

      // Only bootstrap the schema if the store isn't already holding this
      // project (e.g. arriving fresh via deep link). Navigating in from the
      // canvas keeps the existing in-memory schema intact.
      const current = useRuntimeStore.getState().schema;
      if (current.id !== projectId) {
        const saved = (() => {
          try {
            const raw = window.localStorage.getItem(`mint:schema:${projectId}`);
            return raw ? JSON.parse(raw) : undefined;
          } catch {
            return undefined;
          }
        })();
        useRuntimeStore.getState().initSchema(projectId, name, saved);
      }
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (!ready || !projectId) {
    return (
      <div className="grid h-screen w-screen place-items-center bg-[#0c0c0c]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
          <p className="text-sm text-zinc-500">Loading studio…</p>
        </div>
      </div>
    );
  }

  return (
    <StudioShell
      projectId={projectId}
      projectName={projectName}
      onExit={() => router.push(`/projects/${projectId}`)}
    />
  );
}
