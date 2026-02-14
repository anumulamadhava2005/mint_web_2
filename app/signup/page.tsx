"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import TextInput from "@/components/TextInput";
import Button from "@/components/Button";
import Card from "@/components/Card";
import Snowfall from "react-snowfall";

export default function Signup() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  function generatePassword(length = 16) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?";
    let out = "";
    const rnd = cryptoRandom();
    for (let i = 0; i < length; i++) {
      out += chars[Math.floor(rnd() * chars.length)];
    }
    return out;
  }

  // small secure random using window.crypto
  function cryptoRandom() {
    const buf = new Uint32Array(1);
    return () => {
      if (typeof window === "undefined" || !window.crypto) return Math.random();
      window.crypto.getRandomValues(buf);
      return buf[0] / (0xffffffff + 1);
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Signup failed");
        setLoading(false);
        return;
      }

      // Automatically log in after signup
      const loginRes = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const loginData = await loginRes.json();

      if (loginRes.ok && loginData.token) {
        document.cookie = `token=${loginData.token}; path=/; max-age=${60 * 60 * 24 * 7}`; // 7 days
        router.replace("/projects");
      } else {
        // Signup succeeded but login failed — redirect to login page
        router.replace("/login");
      }
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black">
        <Snowfall color="white" snowflakeCount={200}  />
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-900/50 via-black to-zinc-900/50" />
      
      {/* Animated orbs - black and white */}
      <div className="absolute -left-40 -top-40 h-80 w-80 animate-pulse rounded-full bg-white/5 blur-[100px]" />
      <div className="absolute -bottom-40 -right-40 h-80 w-80 animate-pulse rounded-full bg-white/10 blur-[100px]" style={{ animationDelay: "1s" }} />
      <div className="absolute left-1/2 top-1/2 h-60 w-60 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-zinc-500/10 blur-[80px]" style={{ animationDelay: "2s" }} />

      {/* Grid pattern overlay */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }}
      />

      {/* Main card */}
      <div className="relative z-10 w-full max-w-md animate-[fadeIn_0.5s_ease-out] px-4">
          <Card>
          {/* Header */}
          <div className="mb-8 text-center">
            <h1 className="bg-gradient-to-r from-white to-zinc-500 bg-clip-text text-3xl font-bold text-transparent">
              Create Account
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              Join us and start your journey
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-6 animate-[shake_0.5s_ease-in-out] rounded-lg border border-zinc-700 bg-zinc-900 p-4 text-center text-sm text-zinc-300">
              <span className="mr-2">⚠️</span>{error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
            {/* Email field */}
              <TextInput id="email" label="Email address" value={email} onChange={setEmail} type="email" autoComplete="off" />

            {/* Password field */}
            <TextInput id="password" label="Password" value={password} onChange={setPassword} type="password" autoComplete="new-password" minLength={6} />

            {/* Suggest password button */}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  const p = generatePassword(16);
                  setPassword(p);
                  setConfirmPassword(p);
                  // copy to clipboard if available
                  try {
                    navigator.clipboard?.writeText(p);
                  } catch {}
                }}
                className="text-sm text-zinc-400 hover:text-zinc-200"
              >
                Suggest password
              </button>
            </div>

            {/* Confirm Password field */}
            <TextInput id="confirmPassword" label="Confirm Password" value={confirmPassword} onChange={setConfirmPassword} type="password" autoComplete="new-password" minLength={6} />

            {/* Submit button */}
            <Button loading={loading} type="submit" >
                Create Account 
            </Button>
          </form>

          {/* Footer link */}
          <p className="mt-8 text-center text-sm text-zinc-500">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-white transition-all duration-300 hover:text-zinc-300"
            >
              Sign in
            </Link>
          </p>

        {/* Terms */}
        <p className="mt-6 text-center text-xs text-zinc-600">
          By signing up, you agree to our{" "}
          <a href="#" className="text-zinc-500 hover:text-zinc-400">Terms of Service</a>
          {" "}and{" "}
          <a href="#" className="text-zinc-500 hover:text-zinc-400">Privacy Policy</a>
        </p>
          </Card>
      </div>
    </div>
  );
}