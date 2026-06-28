"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// The standalone studio route has been replaced by the project page.
// Redirect any deep links to /projects/[id].
export default function StudioRedirect({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();

  useEffect(() => {
    params.then((p) => router.replace(`/projects/${p.id}`));
  }, [params, router]);

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
