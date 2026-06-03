"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import MLogo from "@/app/M.png";
import {
  ArrowRight,
  ArrowUpRight,
  Layers,
  Zap,
  Globe,
  Server,
  RefreshCw,
  Shield,
  GitBranch,
  Terminal,
  Database,
  Workflow,
  ChevronDown,
  Check,
  X,
  Monitor,
  Smartphone,
  Building2,
  Blocks,
  Settings,
  Radio,
} from "lucide-react";

/* ─── fade-in on scroll ──────────────────────────────────────────────── */
function useFadeIn(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          el.classList.add("animate-in");
          obs.unobserve(el);
        }
      },
      { threshold, rootMargin: "-40px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return ref;
}

/* ─── section heading ─────────────────────────────────────────────────── */
function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle: string;
}) {
  const ref = useFadeIn();
  return (
    <div
      ref={ref}
      className="text-center mb-16 md:mb-20 opacity-0 translate-y-8 transition-all duration-700 [&.animate-in]:opacity-100 [&.animate-in]:translate-y-0"
    >
      {eyebrow && (
        <span className="inline-block text-xs tracking-[0.25em] uppercase text-[#a8a6a2] font-medium mb-4">
          {eyebrow}
        </span>
      )}
      <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-5 text-[#f6f4f0]">
        {title}
      </h2>
      <p className="text-[#a8a6a2] text-lg max-w-2xl mx-auto font-light leading-relaxed">
        {subtitle}
      </p>
    </div>
  );
}

/* ─── feature card ────────────────────────────────────────────────────── */
function FeatureCard({
  icon,
  title,
  description,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  accent: string;
}) {
  const ref = useFadeIn();
  return (
    <div
      ref={ref}
      className="group relative rounded-3xl border border-white/[0.06] bg-white/[0.02] p-8 md:p-10 flex flex-col gap-5 opacity-0 translate-y-8 transition-all duration-700 [&.animate-in]:opacity-100 [&.animate-in]:translate-y-0 hover:border-white/[0.12] hover:bg-white/[0.04]"
    >
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center text-white"
        style={{ backgroundColor: accent }}
      >
        {icon}
      </div>
      <h3 className="text-lg md:text-xl font-semibold tracking-tight text-[#f6f4f0]">
        {title}
      </h3>
      <p className="text-[#a8a6a2] leading-relaxed text-[15px] flex-1">
        {description}
      </p>
    </div>
  );
}

/* ─── stat pill ───────────────────────────────────────────────────────── */
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 px-6">
      <span className="text-3xl md:text-4xl font-bold tracking-tight text-[#f6f4f0]">
        {value}
      </span>
      <span className="text-xs md:text-sm text-[#a8a6a2] font-light tracking-wide uppercase">
        {label}
      </span>
    </div>
  );
}

/* ─── how-it-works step ───────────────────────────────────────────────── */
function HowItWorksStep({
  number,
  title,
  description,
  icon,
}: {
  number: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  const ref = useFadeIn();
  return (
    <div
      ref={ref}
      className="relative flex flex-col items-center text-center gap-5 opacity-0 translate-y-8 transition-all duration-700 [&.animate-in]:opacity-100 [&.animate-in]:translate-y-0"
    >
      <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-[#a8a6a2]">
        {icon}
      </div>
      <span className="text-[11px] tracking-[0.3em] uppercase text-[#a8a6a2] font-medium">
        {number}
      </span>
      <h3 className="text-xl md:text-2xl font-semibold tracking-tight text-[#f6f4f0]">
        {title}
      </h3>
      <p className="text-[#a8a6a2] text-[15px] leading-relaxed max-w-sm font-light">
        {description}
      </p>
    </div>
  );
}

/* ─── FAQ item ────────────────────────────────────────────────────────── */
function FAQItem({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/[0.06]">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-6 text-left cursor-pointer group"
      >
        <span className="text-base md:text-lg font-medium text-[#f6f4f0] pr-8 group-hover:text-white transition-colors">
          {question}
        </span>
        <ChevronDown
          size={18}
          className={`text-[#a8a6a2] shrink-0 transition-transform duration-300 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${
          open ? "max-h-[500px] pb-6" : "max-h-0"
        }`}
      >
        <p className="text-[#a8a6a2] text-[15px] leading-relaxed font-light">
          {answer}
        </p>
      </div>
    </div>
  );
}

/* ─── comparison row ──────────────────────────────────────────────────── */
function ComparisonRow({
  label,
  traditional,
  mint,
}: {
  label: string;
  traditional: string;
  mint: string;
}) {
  return (
    <tr className="border-b border-white/[0.04] group">
      <td className="py-4 pr-6 text-sm text-[#f6f4f0] font-medium">{label}</td>
      <td className="py-4 px-6 text-sm text-[#a8a6a2]">
        <span className="inline-flex items-center gap-2">
          <X size={14} className="text-red-400/60 shrink-0" />
          {traditional}
        </span>
      </td>
      <td className="py-4 pl-6 text-sm text-[#f6f4f0]">
        <span className="inline-flex items-center gap-2">
          <Check size={14} className="text-emerald-400 shrink-0" />
          {mint}
        </span>
      </td>
    </tr>
  );
}

/* ─── use case card ───────────────────────────────────────────────────── */
function UseCaseCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  const ref = useFadeIn();
  return (
    <div
      ref={ref}
      className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 flex flex-col gap-4 opacity-0 translate-y-8 transition-all duration-700 [&.animate-in]:opacity-100 [&.animate-in]:translate-y-0 hover:border-white/[0.1] hover:bg-white/[0.03] transition-colors"
    >
      <div className="text-[#a8a6a2]">{icon}</div>
      <h3 className="text-lg font-semibold tracking-tight text-[#f6f4f0]">
        {title}
      </h3>
      <p className="text-[#a8a6a2] text-sm leading-relaxed font-light">
        {description}
      </p>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/* ─── MAIN PAGE ───────────────────────────────────────────────────────── */
/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
export default function HomePage() {
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroOpacity = useTransform(scrollYProgress, [0, 1], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.96]);

  /* Navbar scroll effect */
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f6f4f0] overflow-x-hidden antialiased">
      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── NAVBAR ────────────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <nav
        className={`fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 md:px-10 py-4 transition-all duration-300 ${
          scrolled
            ? "bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-white/[0.06] shadow-[0_1px_20px_rgba(0,0,0,0.5)]"
            : "bg-transparent"
        }`}
      >
        <Link href="/" className="flex items-center gap-3 group">
          <Image
            src={MLogo}
            alt="mint"
            width={28}
            height={28}
            className="rounded-[6px] transition-transform group-hover:scale-110"
          />
          <span className="text-lg font-semibold tracking-tight text-[#f6f4f0]">
            mint
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {["Platform", "Docs", "Solutions", "Pricing"].map((item) => (
            <Link
              key={item}
              href={item === "Docs" ? "/docs" : "#"}
              className="text-[13px] font-medium text-[#a8a6a2] hover:text-[#f6f4f0] transition-colors"
            >
              {item}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-[13px] font-medium text-[#a8a6a2] hover:text-[#f6f4f0] transition-colors hidden sm:block"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="text-[13px] font-semibold bg-[#f6f4f0] text-[#0a0a0a] px-5 py-2 rounded-full hover:bg-white transition-all hover:shadow-[0_0_20px_rgba(246,244,240,0.2)]"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── HERO ──────────────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <motion.section
        ref={heroRef}
        style={{ opacity: heroOpacity, scale: heroScale }}
        className="relative min-h-[100vh] flex flex-col items-center justify-center text-center px-6 pt-28 pb-20 overflow-hidden"
      >
        {/* Background grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(246,244,240,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(246,244,240,0.5) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
            maskImage:
              "radial-gradient(ellipse 70% 60% at 50% 40%, black 20%, transparent 75%)",
          }}
        />
        {/* Radial glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-[radial-gradient(ellipse,rgba(246,244,240,0.06),transparent_70%)] blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center gap-8">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0 }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] text-[12px] font-medium text-[#a8a6a2] tracking-wide">
              <Radio size={12} className="text-emerald-400" />
              Runtime-driven application infrastructure
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-[clamp(2.5rem,7vw,5.5rem)] font-bold tracking-[-0.03em] leading-[1.05] text-[#f6f4f0]"
          >
            Ship configuration,
            <br />
            <span className="bg-gradient-to-r from-[#f6f4f0] via-[#d7d6d2] to-[#a8a6a2] bg-clip-text text-transparent">
              not deployments.
            </span>
          </motion.h1>

          {/* Subheading */}
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg md:text-xl text-[#a8a6a2] max-w-2xl font-light leading-relaxed"
          >
            mint is a runtime engine that interprets application schemas — screens,
            workflows, navigation, and data bindings — so your team can evolve
            production behavior without redeploying frontend code.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center gap-4 mt-2"
          >
            <Link
              href="/signup"
              className="flex items-center gap-2 bg-[#f6f4f0] text-[#0a0a0a] px-7 py-3.5 rounded-full font-semibold text-[15px] transition-all hover:bg-white hover:shadow-[0_0_30px_rgba(246,244,240,0.2)] hover:scale-[1.02] active:scale-[0.98]"
            >
              Start building
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/docs"
              className="flex items-center gap-2 border border-white/[0.1] text-[#a8a6a2] hover:text-[#f6f4f0] hover:border-white/[0.2] px-7 py-3.5 rounded-full font-medium text-[15px] transition-all"
            >
              Read the docs
              <ArrowUpRight size={16} />
            </Link>
          </motion.div>
        </div>

        {/* Hero visual – schema terminal mockup */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="relative z-10 mt-16 max-w-4xl w-full mx-auto px-4"
        >
          <div className="rounded-xl border border-white/[0.08] overflow-hidden shadow-[0_20px_80px_-20px_rgba(0,0,0,0.8)] bg-[#111]">
            {/* Terminal chrome */}
            <div className="flex items-center gap-2 px-4 py-3 bg-[#161616] border-b border-white/[0.06]">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-white/[0.08]" />
                <div className="w-3 h-3 rounded-full bg-white/[0.08]" />
                <div className="w-3 h-3 rounded-full bg-white/[0.08]" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="bg-white/[0.05] rounded-md px-16 py-1.5 text-[11px] text-[#a8a6a2] font-mono">
                  schema.mint.json
                </div>
              </div>
            </div>
            {/* Schema preview */}
            <div className="p-6 md:p-8 font-mono text-[13px] leading-[1.8] text-[#a8a6a2] overflow-x-auto">
              <pre className="whitespace-pre">
{`{
  `}<span className="text-[#8b9dc3]">&quot;screen&quot;</span>{`: `}<span className="text-[#c4a46c]">&quot;dashboard&quot;</span>{`,
  `}<span className="text-[#8b9dc3]">&quot;components&quot;</span>{`: [
    { `}<span className="text-[#8b9dc3]">&quot;type&quot;</span>{`: `}<span className="text-[#c4a46c]">&quot;MetricsGrid&quot;</span>{`, `}<span className="text-[#8b9dc3]">&quot;dataBinding&quot;</span>{`: `}<span className="text-[#c4a46c]">&quot;/api/metrics&quot;</span>{` },
    { `}<span className="text-[#8b9dc3]">&quot;type&quot;</span>{`: `}<span className="text-[#c4a46c]">&quot;ActionList&quot;</span>{`, `}<span className="text-[#8b9dc3]">&quot;workflow&quot;</span>{`: `}<span className="text-[#c4a46c]">&quot;approval_flow&quot;</span>{` }
  ],
  `}<span className="text-[#8b9dc3]">&quot;navigation&quot;</span>{`: { `}<span className="text-[#8b9dc3]">&quot;onComplete&quot;</span>{`: `}<span className="text-[#c4a46c]">&quot;/review&quot;</span>{` },
  `}<span className="text-[#8b9dc3]">&quot;state&quot;</span>{`: { `}<span className="text-[#8b9dc3]">&quot;persist&quot;</span>{`: `}<span className="text-[#d4a0a0]">true</span>{`, `}<span className="text-[#8b9dc3]">&quot;sync&quot;</span>{`: `}<span className="text-[#c4a46c]">&quot;realtime&quot;</span>{` }
}`}
              </pre>
              <div className="mt-4 pt-4 border-t border-white/[0.06] flex items-center gap-3 text-[12px]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Live — synced to 3 clients
                </span>
                <span className="text-white/[0.15]">|</span>
                <span>Last update: 2s ago</span>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.section>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── SOCIAL PROOF ──────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <section className="py-16 border-y border-white/[0.04]">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-center text-xs tracking-[0.2em] uppercase text-[#a8a6a2]/60 font-medium mb-10">
            Trusted by engineering teams shipping production applications
          </p>
          <div className="flex flex-wrap justify-center gap-8 md:gap-16">
            <Stat value="10x" label="Fewer deploys" />
            <Stat value="<50ms" label="Schema sync" />
            <Stat value="5+" label="Platforms" />
            <Stat value="99.9%" label="Uptime SLA" />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── PROBLEM STATEMENT ─────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <SectionHeading
            eyebrow="The problem"
            title="Deployment shouldn't be the bottleneck"
            subtitle="Every screen change, workflow tweak, or copy update triggers the same cycle: modify code, review, build, test, deploy, validate. Most of these changes aren't code problems — they're configuration problems trapped in code."
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                title: "Slow iteration cycles",
                description:
                  "A single text change requires a full CI/CD pipeline run. Teams wait hours to validate what should take seconds.",
              },
              {
                title: "Coupled releases",
                description:
                  "Configuration, layout, and business logic ship together. Changing a workflow means redeploying the entire frontend.",
              },
              {
                title: "Fragile multi-platform parity",
                description:
                  "Maintaining consistent behavior across iOS, Android, and web means synchronizing deploys across three separate codebases.",
              },
            ].map((item) => {
              const ref = useFadeIn();
              return (
                <div
                  key={item.title}
                  ref={ref}
                  className="rounded-2xl border border-red-500/[0.08] bg-red-500/[0.02] p-8 flex flex-col gap-4 opacity-0 translate-y-8 transition-all duration-700 [&.animate-in]:opacity-100 [&.animate-in]:translate-y-0"
                >
                  <h3 className="text-lg font-semibold text-[#f6f4f0]">
                    {item.title}
                  </h3>
                  <p className="text-[#a8a6a2] text-sm leading-relaxed font-light">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── DIVIDER ── */}
      <div className="h-px mx-8 md:mx-20 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── HOW IT WORKS ──────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <SectionHeading
            eyebrow="How it works"
            title="Schema in, application out"
            subtitle="Define your application as a structured schema. The mint runtime interprets it in real time — on every platform, for every user."
          />

          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-6">
            <HowItWorksStep
              number="01"
              title="Define schemas"
              description="Describe screens, components, workflows, actions, and data bindings as declarative JSON schemas."
              icon={<Terminal size={24} />}
            />
            <HowItWorksStep
              number="02"
              title="Publish to runtime"
              description="Push your schema to the mint runtime. No build step, no bundling, no deploy pipeline required."
              icon={<Radio size={24} />}
            />
            <HowItWorksStep
              number="03"
              title="Runtime interprets"
              description="The runtime engine resolves components, executes workflows, binds data, and renders the application dynamically."
              icon={<Server size={24} />}
            />
            <HowItWorksStep
              number="04"
              title="Instant delivery"
              description="Every connected client receives the updated application within milliseconds. No app store review. No downtime."
              icon={<Zap size={24} />}
            />
          </div>
        </div>
      </section>

      {/* ── DIVIDER ── */}
      <div className="h-px mx-8 md:mx-20 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── FEATURES ──────────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            eyebrow="Platform capabilities"
            title="Application infrastructure for dynamic systems"
            subtitle="Everything your team needs to build, orchestrate, and operate applications that evolve at runtime."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <FeatureCard
              icon={<Layers size={20} />}
              title="Server-Driven UI"
              description="Screens are defined as schemas and resolved at runtime. Update layouts, components, and content without touching client code."
              accent="#5b4cd4"
            />
            <FeatureCard
              icon={<Workflow size={20} />}
              title="Visual Workflow Orchestration"
              description="Define multi-step workflows — approvals, conditional logic, API calls — as configurable pipelines that execute server-side."
              accent="#2d8f6f"
            />
            <FeatureCard
              icon={<Database size={20} />}
              title="Database Bindings"
              description="Bind components directly to data sources. The runtime handles queries, pagination, filtering, and real-time subscriptions."
              accent="#c4622d"
            />
            <FeatureCard
              icon={<RefreshCw size={20} />}
              title="Live Production Updates"
              description="Push changes to production applications instantly. Schema updates propagate to all connected clients in real time."
              accent="#2d6dc4"
            />
            <FeatureCard
              icon={<Globe size={20} />}
              title="Cross-Platform Rendering"
              description="A single schema renders natively across iOS, Android, web, and desktop. One source of truth, consistent behavior everywhere."
              accent="#8b5cf6"
            />
            <FeatureCard
              icon={<Settings size={20} />}
              title="Runtime State Management"
              description="Application state — forms, sessions, navigation history — is managed by the runtime with persistence, sync, and rollback built in."
              accent="#d4a44c"
            />
            <FeatureCard
              icon={<GitBranch size={20} />}
              title="Dynamic Navigation"
              description="Define navigation graphs and routing as schema. Add screens, modify flows, and configure deep links without rebuilding."
              accent="#6b7f4c"
            />
            <FeatureCard
              icon={<Shield size={20} />}
              title="Backend Action Configuration"
              description="Configure API calls, webhook triggers, and backend integrations from the schema layer. The runtime handles execution, retries, and error recovery."
              accent="#4c6b8f"
            />
            <FeatureCard
              icon={<Blocks size={20} />}
              title="Schema-Driven Components"
              description="Register your own component library. The runtime maps schema types to your native components — fully typed, fully controlled."
              accent="#8f4c6b"
            />
          </div>
        </div>
      </section>

      {/* ── DIVIDER ── */}
      <div className="h-px mx-8 md:mx-20 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── COMPARISON ────────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-4xl mx-auto">
          <SectionHeading
            eyebrow="Why runtime-driven"
            title="Traditional deploys vs. runtime architecture"
            subtitle="Static deployments solve static problems. When application behavior needs to change continuously, the deployment model itself becomes the constraint."
          />

          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-white/[0.08]">
                    <th className="py-4 px-6 text-left text-xs tracking-[0.15em] uppercase text-[#a8a6a2] font-medium">
                      Capability
                    </th>
                    <th className="py-4 px-6 text-left text-xs tracking-[0.15em] uppercase text-[#a8a6a2] font-medium">
                      Traditional
                    </th>
                    <th className="py-4 px-6 text-left text-xs tracking-[0.15em] uppercase text-[#a8a6a2] font-medium">
                      mint Runtime
                    </th>
                  </tr>
                </thead>
                <tbody className="px-6">
                  <ComparisonRow
                    label="UI changes"
                    traditional="Code → PR → Build → Deploy"
                    mint="Schema update → Instant"
                  />
                  <ComparisonRow
                    label="Workflow updates"
                    traditional="Backend redeploy required"
                    mint="Configure and publish live"
                  />
                  <ComparisonRow
                    label="Multi-platform parity"
                    traditional="Separate codebases synced manually"
                    mint="Single schema, native rendering"
                  />
                  <ComparisonRow
                    label="Rollback"
                    traditional="Revert commit, rebuild, redeploy"
                    mint="One-click schema rollback"
                  />
                  <ComparisonRow
                    label="Feature flags"
                    traditional="Third-party tool + conditional code"
                    mint="Built into schema layer"
                  />
                  <ComparisonRow
                    label="Time to production"
                    traditional="Minutes to hours"
                    mint="Under 50 milliseconds"
                  />
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ── DIVIDER ── */}
      <div className="h-px mx-8 md:mx-20 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── ENTERPRISE USE CASES ──────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            eyebrow="Use cases"
            title="Built for teams that ship continuously"
            subtitle="From internal tools to customer-facing products, the mint runtime adapts to how your team builds and operates software."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <UseCaseCard
              icon={<Building2 size={24} />}
              title="Internal tools & ops platforms"
              description="Build dashboards, admin panels, and operational workflows that product and ops teams can reconfigure without engineering sprints."
            />
            <UseCaseCard
              icon={<Blocks size={24} />}
              title="Multi-tenant applications"
              description="Serve different configurations, layouts, and workflows per tenant from the same codebase. Schema variants replace code branches."
            />
            <UseCaseCard
              icon={<Smartphone size={24} />}
              title="Cross-platform mobile apps"
              description="Ship a single schema to iOS, Android, and web. Update screens, navigation, and behavior without app store review cycles."
            />
            <UseCaseCard
              icon={<Monitor size={24} />}
              title="Configuration-heavy SaaS"
              description="Products with complex settings, user-facing forms, and conditional logic benefit from externalizing configuration from compiled code."
            />
            <UseCaseCard
              icon={<Workflow size={24} />}
              title="Approval & workflow systems"
              description="Define multi-step approval chains, conditional routing, and automated actions as visual workflows that update in production."
            />
            <UseCaseCard
              icon={<Globe size={24} />}
              title="Geo-distributed applications"
              description="Serve region-specific schemas from edge locations. Different markets get localized layouts, content, and compliance logic — instantly."
            />
          </div>
        </div>
      </section>

      {/* ── DIVIDER ── */}
      <div className="h-px mx-8 md:mx-20 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── DEVELOPER SECTION ─────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <SectionHeading
            eyebrow="For developers"
            title="You own the components. We run the runtime."
            subtitle="mint doesn't replace your engineering team. It gives them infrastructure to move faster — separating what changes frequently from what doesn't."
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left: Code example */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#111] overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3 bg-[#161616] border-b border-white/[0.06]">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-white/[0.08]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-white/[0.08]" />
                  <div className="w-2.5 h-2.5 rounded-full bg-white/[0.08]" />
                </div>
                <span className="text-[11px] text-[#a8a6a2] font-mono ml-2">
                  ComponentRegistry.ts
                </span>
              </div>
              <div className="p-6 font-mono text-[13px] leading-[1.8] text-[#a8a6a2]">
                <pre className="whitespace-pre">
{`import { `}<span className="text-[#8b9dc3]">MintRuntime</span>{` } from '@mint/sdk'
import { `}<span className="text-[#8b9dc3]">MetricsGrid</span>{` } from './components'
import { `}<span className="text-[#8b9dc3]">ActionList</span>{` } from './components'
import { `}<span className="text-[#8b9dc3]">UserProfile</span>{` } from './components'

`}<span className="text-[#6b8f71]">// Register your own components</span>{`
`}<span className="text-[#6b8f71]">// The runtime maps schema types to these</span>{`
`}<span className="text-[#c4a0c4]">const</span>{` runtime = `}<span className="text-[#c4a0c4]">new</span>{` `}<span className="text-[#8b9dc3]">MintRuntime</span>{`({
  components: {
    `}<span className="text-[#c4a46c]">MetricsGrid</span>{`,
    `}<span className="text-[#c4a46c]">ActionList</span>{`,
    `}<span className="text-[#c4a46c]">UserProfile</span>{`,
  },
  `}<span className="text-[#6b8f71]">// Schemas resolve at runtime</span>{`
  schemaEndpoint: `}<span className="text-[#c4a46c]">'/api/schema'</span>{`,
  realtimeSync: `}<span className="text-[#d4a0a0]">true</span>{`,
})`}
                </pre>
              </div>
            </div>

            {/* Right: Benefits list */}
            <div className="flex flex-col gap-6 justify-center">
              {[
                {
                  title: "Your component library, your rules",
                  description:
                    "Register React, Flutter, SwiftUI, or Compose components. The runtime resolves schema types to your implementations — fully typed.",
                },
                {
                  title: "Standard tooling, no lock-in",
                  description:
                    "Use your existing IDE, version control, CI pipeline, and testing framework. Schemas are JSON — version them, diff them, review them.",
                },
                {
                  title: "Type-safe schema contracts",
                  description:
                    "Schemas are validated against TypeScript-generated types. Mismatches surface at authoring time, not in production.",
                },
                {
                  title: "Escape hatches everywhere",
                  description:
                    "Any component can break out of the schema layer and run arbitrary native code. The runtime is an accelerator, not a cage.",
                },
              ].map((item) => (
                <div key={item.title} className="flex gap-4">
                  <div className="mt-1 shrink-0">
                    <div className="w-6 h-6 rounded-md bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
                      <Check size={13} className="text-emerald-400" />
                    </div>
                  </div>
                  <div>
                    <h4 className="text-[15px] font-semibold text-[#f6f4f0] mb-1">
                      {item.title}
                    </h4>
                    <p className="text-[#a8a6a2] text-sm leading-relaxed font-light">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── DIVIDER ── */}
      <div className="h-px mx-8 md:mx-20 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── FAQ ───────────────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-3xl mx-auto">
          <SectionHeading
            eyebrow="FAQ"
            title="Frequently asked questions"
            subtitle="Common questions about the mint runtime architecture and how it fits into your development workflow."
          />

          <div className="flex flex-col">
            <FAQItem
              question="Is this a replacement for our frontend framework?"
              answer="No. mint works alongside your existing framework — React, Flutter, SwiftUI, or Compose. You build and register components using your framework of choice. The runtime handles which components render, with what data, and in what order. Your framework still does the rendering."
            />
            <FAQItem
              question="How does the runtime handle performance at scale?"
              answer="Schemas are lightweight JSON payloads — typically under 50KB for a full screen definition. The runtime resolves them locally on the client with sub-50ms latency. Schema delivery uses edge caching and delta synchronization, so only changed portions are transmitted."
            />
            <FAQItem
              question="What happens if the runtime is unreachable?"
              answer="The client SDK caches the last-known schema locally. If the runtime is unreachable, the application continues operating with the cached schema. When connectivity is restored, the runtime syncs the latest version automatically."
            />
            <FAQItem
              question="Can we still use version control and code review?"
              answer="Absolutely. Schemas are JSON files that live in your repository alongside your code. You can diff them, review them in pull requests, run schema validation in CI, and apply the same governance workflows you already use."
            />
            <FAQItem
              question="Does this work for customer-facing applications or just internal tools?"
              answer="Both. The runtime is designed for production-grade, customer-facing applications. It supports authentication scoping, role-based schema resolution, A/B testing via schema variants, and enterprise compliance requirements."
            />
            <FAQItem
              question="What's the deployment model?"
              answer="mint can run as a managed cloud service or be self-hosted in your infrastructure. The runtime engine is stateless and horizontally scalable. Schema storage supports any standard database or object store."
            />
            <FAQItem
              question="How do we handle migrations and breaking changes?"
              answer="Schemas are versioned. The runtime supports simultaneous schema versions, allowing gradual client migration. Breaking changes can be rolled out incrementally with per-client version targeting."
            />
          </div>
        </div>
      </section>

      {/* ── DIVIDER ── */}
      <div className="h-px mx-8 md:mx-20 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── FINAL CTA ─────────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <section className="relative py-32 md:py-44 px-6 text-center overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(246,244,240,0.05),transparent_70%)] blur-[100px] pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto">
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 text-[#f6f4f0] leading-[1.05]">
            Your application
            <br />
            <span className="bg-gradient-to-r from-[#f6f4f0] via-[#d7d6d2] to-[#a8a6a2] bg-clip-text text-transparent">
              is a runtime.
            </span>
          </h2>
          <p className="text-lg md:text-xl text-[#a8a6a2] font-light mb-10 max-w-xl mx-auto leading-relaxed">
            Stop redeploying configuration. Start shipping schemas that evolve
            your application in production — instantly, safely, everywhere.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="flex items-center gap-2 bg-[#f6f4f0] text-[#0a0a0a] px-8 py-4 rounded-full font-semibold text-base transition-all hover:bg-white hover:shadow-[0_0_30px_rgba(246,244,240,0.2)] hover:scale-[1.02] active:scale-[0.98]"
            >
              Start building
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/docs"
              className="flex items-center gap-2 border border-white/[0.1] text-[#a8a6a2] hover:text-[#f6f4f0] hover:border-white/[0.2] px-8 py-4 rounded-full font-medium text-base transition-all"
            >
              Read the docs
              <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── FOOTER ────────────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <footer className="border-t border-white/[0.04] bg-[#080808]">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-16">
            {/* Col 1 - Brand */}
            <div className="col-span-2 md:col-span-1 flex flex-col gap-4">
              <Link href="/" className="flex items-center gap-2">
                <Image
                  src={MLogo}
                  alt="mint"
                  width={24}
                  height={24}
                  className="rounded-[5px]"
                />
                <span className="text-sm font-semibold text-[#f6f4f0]">
                  mint
                </span>
              </Link>
              <p className="text-xs text-[#a8a6a2] leading-relaxed">
                Runtime-driven application infrastructure
                <br />
                for teams that ship continuously.
              </p>
            </div>
            {/* Col 2 */}
            <div className="flex flex-col gap-3">
              <span className="text-xs font-semibold text-[#f6f4f0] uppercase tracking-wider mb-1">
                Platform
              </span>
              {[
                "Server-Driven UI",
                "Workflow Orchestration",
                "Database Bindings",
                "Live Updates",
                "State Management",
              ].map((l) => (
                <Link
                  key={l}
                  href="#"
                  className="text-xs text-[#a8a6a2] hover:text-[#f6f4f0] transition-colors"
                >
                  {l}
                </Link>
              ))}
            </div>
            {/* Col 3 */}
            <div className="flex flex-col gap-3">
              <span className="text-xs font-semibold text-[#f6f4f0] uppercase tracking-wider mb-1">
                Developers
              </span>
              {["Documentation", "API Reference", "SDK", "Changelog", "Status"].map(
                (l) => (
                  <Link
                    key={l}
                    href={l === "Documentation" ? "/docs" : "#"}
                    className="text-xs text-[#a8a6a2] hover:text-[#f6f4f0] transition-colors"
                  >
                    {l}
                  </Link>
                )
              )}
            </div>
            {/* Col 4 */}
            <div className="flex flex-col gap-3">
              <span className="text-xs font-semibold text-[#f6f4f0] uppercase tracking-wider mb-1">
                Company
              </span>
              {["About", "Blog", "Careers", "Contact"].map((l) => (
                <Link
                  key={l}
                  href="#"
                  className="text-xs text-[#a8a6a2] hover:text-[#f6f4f0] transition-colors"
                >
                  {l}
                </Link>
              ))}
            </div>
          </div>
          {/* Bottom */}
          <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-white/[0.04] gap-4">
            <p className="text-[11px] text-[#a8a6a2]">
              © {new Date().getFullYear()} mint Technology. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              {["Privacy", "Terms", "Security"].map((l) => (
                <Link
                  key={l}
                  href="#"
                  className="text-[11px] text-[#a8a6a2] hover:text-[#f6f4f0] transition-colors"
                >
                  {l}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
