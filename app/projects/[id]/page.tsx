"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ProjectEditor({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  useEffect(() => {
    params.then((p) => router.replace(`/projects/${p.id}/studio`));
  }, [params, router]);

  return (
    <div className="grid h-screen w-screen place-items-center bg-zinc-950">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
    </div>
  );
}
