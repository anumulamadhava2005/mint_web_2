"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Smartphone, Globe, Monitor, Layout, Briefcase, ShoppingCart,
  MessageSquare, BarChart3, Wrench, Layers, Workflow, FormInput,
  Database, Shield, Zap, Radio, FlaskConical, Flag, ArrowRight,
  ArrowLeft, Rocket, Check, User, Building2, Users, Code,
  Lightbulb, Box, Gauge, TrendingUp, TabletSmartphone
} from "lucide-react";

/* ─── Types ───────────────────────────────────────────────── */
type Step = 1 | 2 | 3 | 4;

/* ─── Chip component ──────────────────────────────────────── */
function Chip({ label, icon: Icon, selected, onClick }: {
  label: string; icon?: any; selected: boolean; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick}
      className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[13px] font-medium transition-all duration-200 ${
        selected
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.1)]"
          : "border-white/[0.06] bg-white/[0.03] text-[#a8a6a2] hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-[#d7d6d2]"
      }`}>
      {Icon && <Icon size={15} />}
      {label}
      {selected && <Check size={13} className="ml-auto" />}
    </button>
  );
}

/* ─── Progress bar ────────────────────────────────────────── */
function StepProgress({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-1 mb-6">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex items-center gap-1">
          <div className={`flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-bold transition-all duration-300 ${
            i + 1 < current ? "bg-emerald-500 text-white" :
            i + 1 === current ? "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.2)]" :
            "bg-white/10 text-white/40 border border-white/10"
          }`}>
            {i + 1 < current ? <Check size={14} /> : i + 1}
          </div>
          {i < total - 1 && (
            <div className={`h-[2px] w-6 rounded-full transition-all duration-500 ${
              i + 1 < current ? "bg-emerald-500/60" : "bg-white/10"
            }`} />
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Step header ─────────────────────────────────────────── */
function StepHeader({ step, title, subtitle }: { step: string; title: string; subtitle: string }) {
  return (
    <div className="mb-6 text-center">
      <span className="inline-block text-[10px] tracking-[0.2em] uppercase text-emerald-400/70 font-semibold mb-2">{step}</span>
      <h1 className="bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-2xl font-bold text-transparent">{title}</h1>
      <p className="mt-2 text-sm text-zinc-500">{subtitle}</p>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/* ─── MAIN ────────────────────────────────────────────────── */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function Signup() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Step 1
  const [fullname, setFullname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [teamSize, setTeamSize] = useState("");

  // Step 2
  const [projectType, setProjectType] = useState("");
  const [industry, setIndustry] = useState("");
  const [stage, setStage] = useState("");

  // Step 3
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [features, setFeatures] = useState<string[]>([]);

  // Step 4
  const [projectName, setProjectName] = useState("");
  const [projectDesc, setProjectDesc] = useState("");
  const [env, setEnv] = useState("development");

  const toggleArr = (arr: string[], set: (v: string[]) => void, val: string) =>
    set(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);

  /* ─── Step 1: Create account ───── */
  async function handleStep1() {
    setError("");
    if (!fullname.trim()) { setError("Please enter your name"); return; }
    if (!email.trim()) { setError("Please enter your email"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/signup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, fullname: fullname.trim(), team_size: teamSize || null }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Signup failed"); setLoading(false); return; }

      // Auto-login
      const loginRes = await fetch("/api/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!loginRes.ok) { router.replace("/login"); return; }
      setStep(2);
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }

  /* ─── Step 3: Save onboarding context ── */
  async function handleStep3() {
    setLoading(true);
    try {
      await fetch("/api/onboarding", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_type: projectType, industry, stage, platforms, features }),
      });
      setStep(4);
      // Auto-populate project name from type
      if (projectType && !projectName) {
        setProjectName(`My ${projectType}`);
      }
    } catch { /* continue anyway */ setStep(4); }
    finally { setLoading(false); }
  }

  /* ─── Step 4: Create project ───── */
  async function handleStep4() {
    setError("");
    if (!projectName.trim()) { setError("Please name your project"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: projectName.trim(), description: projectDesc.trim() || null }),
      });
      if (!res.ok) { setError("Failed to create project"); setLoading(false); return; }
      const data = await res.json();
      router.replace("/waitlist-success");
    } catch { setError("Network error"); setLoading(false); }
  }
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black">

      <div className="relative z-10 w-full max-w-lg px-4 py-8">
        <StepProgress current={step} total={4} />

        <div className="rounded-[28px] border border-white/[0.06] bg-white/[0.04] p-6 sm:p-8 shadow-[0_24px_80px_-48px_rgba(0,0,0,0.6)] backdrop-blur-xl">

          {error && (
            <div className="mb-5 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-center text-sm text-red-400">
               {error}
            </div>
          )}

          {/* ════════ STEP 1 ════════ */}
          {step === 1 && (
            <div>
              <StepHeader step="Step 1 of 4" title="Create your account" subtitle="Tell us a bit about yourself" />

              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[#666] mb-1.5 block">Full Name</label>
                  <input value={fullname} onChange={(e) => setFullname(e.target.value)} placeholder="Jane Smith"
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-[14px] text-white placeholder:text-[#444] outline-none focus:border-emerald-500/40 transition-colors" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[#666] mb-1.5 block">Work Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@company.com"
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-[14px] text-white placeholder:text-[#444] outline-none focus:border-emerald-500/40 transition-colors" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[#666] mb-1.5 block">Password</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 characters"
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-[14px] text-white placeholder:text-[#444] outline-none focus:border-emerald-500/40 transition-colors" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[#666] mb-2 block">Team Size</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { v: "solo", l: "Solo" },
                      { v: "2-5", l: "2–5" },
                      { v: "6-20", l: "6–20" },
                      { v: "20+", l: "20+" },
                    ].map((o) => (
                      <button key={o.v} type="button" onClick={() => setTeamSize(o.v)}
                        className={`rounded-xl border py-2.5 text-[13px] font-medium transition-all ${
                          teamSize === o.v
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                            : "border-white/[0.06] bg-white/[0.03] text-[#a8a6a2] hover:border-white/[0.12]"
                        }`}>{o.l}</button>
                    ))}
                  </div>
                </div>
              </div>

              <button onClick={handleStep1} disabled={loading}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3.5 font-semibold text-black transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50">
                {loading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-black/20 border-t-black" /> : <><span>Continue</span><ArrowRight size={16} /></>}
              </button>

              <p className="mt-6 text-center text-sm text-zinc-500">
                Already have an account?{" "}
                <Link href="/login" className="font-semibold text-white hover:text-zinc-300 transition-colors">Sign in</Link>
              </p>
            </div>
          )}

          {/* ════════ STEP 2 ════════ */}
          {step === 2 && (
            <div>
              <StepHeader step="Step 2 of 4" title="What are you building?" subtitle="This helps us customize your experience" />

              <div className="space-y-5">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[#666] mb-2 block">Project Type</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { v: "Mobile App", i: Smartphone },
                      { v: "Web App", i: Globe },
                      { v: "Internal Tool", i: Wrench },
                      { v: "SaaS", i: Layers },
                      { v: "Dashboard", i: BarChart3 },
                      { v: "E-Commerce", i: ShoppingCart },
                      { v: "Marketplace", i: Building2 },
                      { v: "Other", i: Box },
                    ].map((o) => <Chip key={o.v} label={o.v} icon={o.i} selected={projectType === o.v} onClick={() => setProjectType(o.v)} />)}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[#666] mb-2 block">Industry</label>
                  <div className="flex flex-wrap gap-2">
                    {["Fintech", "Healthcare", "Education", "Retail", "Enterprise", "Dev Tools", "Media", "Other"].map((v) => (
                      <Chip key={v} label={v} selected={industry === v} onClick={() => setIndustry(v)} />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[#666] mb-2 block">Development Stage</label>
                  <div className="flex gap-2">
                    {[
                      { v: "Idea", i: Lightbulb },
                      { v: "Prototype", i: FlaskConical },
                      { v: "MVP", i: Box },
                      { v: "Production", i: Gauge },
                      { v: "Scaling", i: TrendingUp },
                    ].map((o) => <Chip key={o.v} label={o.v} icon={o.i} selected={stage === o.v} onClick={() => setStage(o.v)} />)}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button onClick={() => setStep(1)}
                  className="flex items-center gap-2 rounded-xl border border-white/[0.08] px-4 py-3 text-[13px] font-medium text-[#a8a6a2] hover:bg-white/[0.04] transition-colors">
                  <ArrowLeft size={15} />
                </button>
                <button onClick={() => { setStep(3); setError(""); }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white py-3.5 font-semibold text-black transition-all hover:scale-[1.02] active:scale-[0.98]">
                  Continue <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ════════ STEP 3 ════════ */}
          {step === 3 && (
            <div>
              <StepHeader step="Step 3 of 4" title="Platform & capabilities" subtitle="Select everything that applies" />

              <div className="space-y-5">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[#666] mb-2 block">Target Platforms</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { v: "Web", i: Globe },
                      { v: "iOS", i: TabletSmartphone },
                      { v: "Android", i: Smartphone },
                      { v: "Desktop", i: Monitor },
                    ].map((o) => <Chip key={o.v} label={o.v} icon={o.i} selected={platforms.includes(o.v)} onClick={() => toggleArr(platforms, setPlatforms, o.v)} />)}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[#666] mb-2 block">Runtime Features</label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { v: "Dynamic UI", i: Layout },
                      { v: "Workflows", i: Workflow },
                      { v: "Forms", i: FormInput },
                      { v: "Database", i: Database },
                      { v: "Authentication", i: Shield },
                      { v: "Real-time", i: Zap },
                      { v: "API Integration", i: Code },
                      { v: "Feature Flags", i: Flag },
                    ].map((o) => <Chip key={o.v} label={o.v} icon={o.i} selected={features.includes(o.v)} onClick={() => toggleArr(features, setFeatures, o.v)} />)}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button onClick={() => setStep(2)}
                  className="flex items-center gap-2 rounded-xl border border-white/[0.08] px-4 py-3 text-[13px] font-medium text-[#a8a6a2] hover:bg-white/[0.04] transition-colors">
                  <ArrowLeft size={15} />
                </button>
                <button onClick={handleStep3} disabled={loading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white py-3.5 font-semibold text-black transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50">
                  {loading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-black/20 border-t-black" /> : <><span>Continue</span><ArrowRight size={16} /></>}
                </button>
              </div>
            </div>
          )}

          {/* ════════ STEP 4 ════════ */}
          {step === 4 && (
            <div>
              <StepHeader step="Step 4 of 4" title="Create your first project" subtitle="You can always change this later" />

              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[#666] mb-1.5 block">Project Name</label>
                  <input value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="My Awesome App"
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-[14px] text-white placeholder:text-[#444] outline-none focus:border-emerald-500/40 transition-colors" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[#666] mb-1.5 block">Description <span className="text-[#444] normal-case">(optional)</span></label>
                  <input value={projectDesc} onChange={(e) => setProjectDesc(e.target.value)} placeholder="A brief description of your project"
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-[14px] text-white placeholder:text-[#444] outline-none focus:border-emerald-500/40 transition-colors" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-[#666] mb-2 block">Environment</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { v: "development", l: "Development" },
                      { v: "staging", l: "Staging" },
                      { v: "production", l: "Production" },
                    ].map((o) => (
                      <button key={o.v} type="button" onClick={() => setEnv(o.v)}
                        className={`rounded-xl border py-2.5 text-[13px] font-medium transition-all ${
                          env === o.v
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                            : "border-white/[0.06] bg-white/[0.03] text-[#a8a6a2] hover:border-white/[0.12]"
                        }`}>{o.l}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button onClick={() => setStep(3)}
                  className="flex items-center gap-2 rounded-xl border border-white/[0.08] px-4 py-3 text-[13px] font-medium text-[#a8a6a2] hover:bg-white/[0.04] transition-colors">
                  <ArrowLeft size={15} />
                </button>
                <button onClick={handleStep4} disabled={loading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 py-3.5 font-semibold text-white shadow-lg shadow-emerald-900/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50">
                  {loading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <><Rocket size={16} /> Launch Project</>}
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-zinc-600">
          By signing up, you agree to our{" "}
          <a href="#" className="text-zinc-500 hover:text-zinc-400">Terms of Service</a>
          {" "}and{" "}
          <a href="#" className="text-zinc-500 hover:text-zinc-400">Privacy Policy</a>
        </p>
      </div>
    </div>
  );
}