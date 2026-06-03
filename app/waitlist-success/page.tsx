"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import MLogo from "@/app/M.png";
import { 
  CheckCircle2, Sparkles, ArrowLeft, LogOut, 
  Twitter, MessageSquare, Terminal, Compass, 
  ExternalLink, Calendar
} from "lucide-react";

export default function WaitlistSuccess() {
  const router = useRouter();
  const [profile, setProfile] = useState<{ fullname: string; email: string; created_at: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [waitlistNumber, setWaitlistNumber] = useState<number | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch("/api/profile");
        if (res.ok) {
          const data = await res.json();
          setProfile(data.profile);
          
          if (data.profile?.waitlist_position) {
            setWaitlistNumber(data.profile.waitlist_position);
          } else if (data.profile?.created_at) {
            const time = new Date(data.profile.created_at).getTime();
            // Deterministic hash between 1200 and 8500 as fallback
            const spot = 1200 + (time % 7300);
            setWaitlistNumber(spot);
          } else {
            setWaitlistNumber(1429);
          }
        } else {
          // If unauthorized, redirect to home page
          router.replace("/home");
        }
      } catch {
        // Ignore
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, [router]);

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    document.cookie = "token=; path=/; max-age=0";
    router.replace("/home");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  const displayName = profile?.fullname || profile?.email?.split("@")[0] || "Builder";

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-between overflow-hidden bg-[#0a0a0a] text-[#f6f4f0] antialiased">

      {/* Header / Navbar */}
      <header className="relative z-10 w-full flex items-center justify-between px-6 md:px-10 py-6">
        <Link href="/home" className="flex items-center gap-3 group">
          <Image
            src={MLogo}
            alt="mint"
            width={28}
            height={28}
            className="rounded-[6px] transition-transform group-hover:scale-105"
          />
          <span className="text-lg font-semibold tracking-tight text-[#f6f4f0]">
            mint
          </span>
        </Link>

        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-2 text-xs font-medium text-[#a8a6a2] hover:border-white/[0.12] hover:bg-white/[0.04] hover:text-[#f6f4f0] transition-all"
        >
          <LogOut size={13} />
          Sign Out
        </button>
      </header>

      {/* Main Waitlist Content */}
      <main className="relative z-10 w-full max-w-xl px-4 py-12 flex-1 flex flex-col justify-center">
        <div className="rounded-[32px] border border-white/[0.06] bg-white/[0.02] p-8 md:p-10 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.8)] backdrop-blur-xl flex flex-col items-center text-center">
          
          {/* Success Tick & Glow */}
          <div className="relative mb-8">
            <CheckCircle2 size={64} className="text-emerald-400 relative z-10" />
          </div>


          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-[#f6f4f0]">
            You&apos;re in, {displayName}!
          </h1>

          <p className="text-[#a8a6a2] text-sm md:text-base font-light leading-relaxed max-w-md mb-8">
            Thank you for joining the mint waitlist. We are opening access in phases to ensure optimal performance and runtime scalability for all teams.
          </p>

          {/* Waitlist Position Panel */}
          {waitlistNumber && (
            <div className="w-full rounded-2xl border border-white/[0.05] bg-white/[0.01] p-6 mb-8 flex flex-col sm:flex-row items-center justify-around gap-4">
              <div className="text-center sm:text-left">
                <span className="text-xs text-[#a8a6a2] font-mono uppercase tracking-widest block mb-1">Your Waitlist Position</span>
                <span className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                  #{waitlistNumber.toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* Action cards for waitlisted users */}
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            <a 
              href="https://twitter.com/intent/tweet?text=Just%20joined%20the%20waiting%20list%20for%20mint%20%E2%80%94%20a%20runtime-driven%20application%20infrastructure!%20Join%20me%20at%20mintit.pro" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-left hover:bg-white/[0.04] hover:border-white/[0.1] transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/[0.04] flex items-center justify-center text-zinc-400 group-hover:text-white transition-colors">
                  <Twitter size={16} />
                </div>
                <div>
                  <span className="text-xs font-semibold text-[#f6f4f0] block">Share on X</span>
                  <span className="text-[10px] text-[#a8a6a2]">Boost status rank</span>
                </div>
              </div>
              <ExternalLink size={12} className="text-[#a8a6a2] opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>

            <Link 
              href="/docs" 
              className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-left hover:bg-white/[0.04] hover:border-white/[0.1] transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/[0.04] flex items-center justify-center text-zinc-400 group-hover:text-white transition-colors">
                  <Terminal size={16} />
                </div>
                <div>
                  <span className="text-xs font-semibold text-[#f6f4f0] block">Explore Docs</span>
                  <span className="text-[10px] text-[#a8a6a2]">Read the architecture</span>
                </div>
              </div>
              <ExternalLink size={12} className="text-[#a8a6a2] opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          </div>

          {/* Secondary Actions */}
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center">
            <Link 
              href="/home" 
              className="flex items-center gap-2 text-xs font-semibold text-[#a8a6a2] hover:text-[#f6f4f0] transition-colors"
            >
              <ArrowLeft size={14} />
              Back to Home
            </Link>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-6 text-center text-xs text-zinc-600">
        &copy; {new Date().getFullYear()} mint technologies inc. All rights reserved.
      </footer>
    </div>
  );
}
