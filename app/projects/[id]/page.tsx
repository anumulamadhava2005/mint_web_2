"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PenpotEditor from "@/components/PenpotEditor";
import PrototypeViewer from "@/components/PrototypeViewer";
import { useEditorStore } from "@/lib/editorStore";

type Project = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  likes: number;
  views: number;
  owner_email: string;
};

export default function ProjectEditor({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [projectId, setProjectId] = useState<string>("");
  const [fileId, setFileId] = useState<string>("");
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  const viewerMode = useEditorStore((s) => s.viewerMode);
  const setViewerMode = useEditorStore((s) => s.setViewerMode);

  useEffect(() => {
    params.then((p) => setProjectId(p.id));
  }, [params]);

  useEffect(() => {
    if (!projectId) return;

    async function fetchData() {
      try {
        // 1. Fetch project
        const projectRes = await fetch(`/api/projects?id=${projectId}`);
        if (projectRes.ok) {
          const projectData = await projectRes.json();
          setProject(projectData.project);
        }

        // 2. Fetch or create a file for this project
        const filesRes = await fetch(`/api/files?projectId=${projectId}`, {
          credentials: "include",
        });

        if (filesRes.ok) {
          const filesData = await filesRes.json();
          if (filesData.files && filesData.files.length > 0) {
            // Use the first (or most recent) file
            setFileId(filesData.files[0].id);
          } else {
            // No files yet — create one
            const createRes = await fetch("/api/files", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ projectId, name: "Untitled", data: {} }),
            });
            if (createRes.ok) {
              const newFile = await createRes.json();
              setFileId(newFile.file.id);
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [projectId]);

  if (loading || !projectId || !fileId) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p className="text-sm text-zinc-400">Loading project...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-zinc-950">
      {/* Penpot-style editor */}
      <PenpotEditor
        fileId={fileId}
        projectId={projectId}
        projectName={project?.name || "Untitled"}
        onBack={() => router.push("/projects")}
      />

      {/* Prototype viewer overlay */}
      {viewerMode && (
        <PrototypeViewer onClose={() => setViewerMode(false)} />
      )}
    </div>
  );
}