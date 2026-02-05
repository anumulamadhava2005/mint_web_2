"use client";

import { useRouter } from "next/navigation";

export default function Projects() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    // Clear client-side cookie as backup
    document.cookie = "token=; path=/; max-age=0";
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">
          Projects
        </h1>
        <button
          onClick={handleLogout}
          className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Log Out
        </button>
      </header>
      <main className="p-6">
        <p className="text-zinc-600 dark:text-zinc-400">
          Welcome! You are logged in.
        </p>
      </main>
    </div>
  );
}