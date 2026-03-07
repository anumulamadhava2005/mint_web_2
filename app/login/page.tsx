"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import TextInput from "@/components/TextInput";
import Button from "@/components/Button";
import Card from "@/components/Card";
import Snowfall from "react-snowfall";

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/projects";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }

      // Store token in cookie
      document.cookie = `token=${data.token}; path=/; max-age=${60 * 60 * 24 * 7}`; // 7 days

      router.replace(redirect);
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black">
      <Snowfall color="white" snowflakeCount={150} />
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-900/50 via-black to-zinc-900/50" />
      <div className="absolute -left-40 -top-40 h-80 w-80 animate-pulse rounded-full bg-white/5 blur-[100px]" />
      <div className="absolute -bottom-40 -right-40 h-80 w-80 animate-pulse rounded-full bg-white/10 blur-[100px]" style={{ animationDelay: "1s" }} />
      <div className="absolute left-1/2 top-1/2 h-60 w-60 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-zinc-500/10 blur-[80px]" style={{ animationDelay: "2s" }} />

      <div className="relative z-10 w-full max-w-md animate-[fadeIn_0.5s_ease-out] px-4">
        <Card>
          <div className="mb-6 text-center">
            <h1 className="bg-gradient-to-r from-white to-zinc-500 bg-clip-text text-3xl font-bold text-transparent">Log In</h1>
            <p className="mt-2 text-sm text-zinc-500">Welcome back — please sign in to continue</p>
          </div>

          {error && (
            <div className="mb-6 animate-[shake_0.5s_ease-in-out] rounded-lg border border-zinc-700 bg-zinc-900 p-4 text-center text-sm text-zinc-300">
              <span className="mr-2">⚠️</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <TextInput id="email" label="Email address" value={email} onChange={setEmail} type="email" autoComplete="off" />
            <TextInput id="password" label="Password" value={password} onChange={setPassword} type="password" autoComplete="current-password" />

            <Button loading={loading} type="submit">Log In</Button>
          </form>

          <p className="mt-8 text-center text-sm text-zinc-500">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-semibold text-white transition-all duration-300 hover:text-zinc-300">
              Sign up
            </Link>
          </p>
        </Card>
      </div>
    </div>
  );
}

export default function Login() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-black"><div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" /></div>}>
      <LoginInner />
    </Suspense>
  );
}