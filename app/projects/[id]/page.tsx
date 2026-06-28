"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import FigmaEditor from "@/components/figma/FigmaEditor";

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [projectId, setProjectId] = useState<string>("");

  useEffect(() => {
    params.then((p) => setProjectId(p.id));
  }, [params]);

  if (!projectId) {
    return (
      <div style={{ display: "grid", placeItems: "center", width: "100vw", height: "100vh", background: "#1e1e1e" }}>
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          border: "2px solid #7c3aed", borderTopColor: "transparent",
          animation: "spin 0.7s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  return (
    <FigmaEditor
      projectId={projectId}
      onExit={() => router.push("/projects")}
    />
  );
}
