"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import MLogo from "@/app/M.png";
import {
  ArrowRight,
  Code2,
  Paintbrush,
  Layers,
  Smartphone,
  Globe,
  Zap,
  ChevronRight,
  Monitor,
  Palette,
  Box,
  ArrowUpRight,
  
} from "lucide-react";

/* ─── fade-in on scroll hook ──────────────────────────────────────────── */
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

/* ─── feature card ────────────────────────────────────────────────────── */
function FeatureCard({
  icon,
  title,
  description,
  linkText,
  href,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  linkText: string;
  href: string;
  accent: string;
}) {
  const ref = useFadeIn();
  return (
    <div
      ref={ref}
      className="group relative rounded-3xl border border-white/[0.06] bg-white/[0.02] p-8 md:p-10 flex flex-col gap-6 opacity-0 translate-y-8 transition-all duration-700 [&.animate-in]:opacity-100 [&.animate-in]:translate-y-0 hover:border-white/[0.12] hover:bg-white/[0.04]"
    >
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center text-white"
        style={{ backgroundColor: accent }}
      >
        {icon}
      </div>
      <h3 className="text-xl md:text-2xl font-semibold tracking-tight text-[#f6f4f0]">
        {title}
      </h3>
      <p className="text-[#a8a6a2] leading-relaxed text-[15px] flex-1">
        {description}
      </p>
      <Link
        href={href}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[#f6f4f0] group-hover:gap-2.5 transition-all"
      >
        {linkText}
        <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
      </Link>
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

/* ─── workflow step ───────────────────────────────────────────────────── */
function WorkflowStep({
  number,
  title,
  description,
  imageSrc,
  imageAlt,
  reverse,
}: {
  number: string;
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  reverse?: boolean;
}) {
  const ref = useFadeIn();
  return (
    <div
      ref={ref}
      className={`grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center opacity-0 translate-y-8 transition-all duration-700 [&.animate-in]:opacity-100 [&.animate-in]:translate-y-0`}
    >
      <div className={`flex flex-col gap-5 ${reverse ? "lg:order-2" : ""}`}>
        <span className="text-xs tracking-[0.25em] uppercase text-[#a8a6a2] font-medium">
          {number}
        </span>
        <h3 className="text-2xl md:text-4xl font-semibold tracking-tight text-[#f6f4f0] leading-tight">
          {title}
        </h3>
        <p className="text-[#a8a6a2] text-base md:text-lg leading-relaxed font-light">
          {description}
        </p>
      </div>
      {/* <div className={`relative ${reverse ? "lg:order-1" : ""}`}>
        <div className="absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-white/[0.04] to-transparent blur-xl" />
        <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] shadow-2xl">
          <Image
            src={imageSrc}
            alt={imageAlt}
            width={640}
            height={400}
            className="w-full h-auto"
          />
        </div>
      </div> */}
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
  const heroScale = useTransform(scrollYProgress, [0, 1], [1, 0.95]);

  /* Navbar scroll effect */
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f6f4f0] overflow-x-hidden antialiased">
      {/* ── NAVBAR ── */}
      <nav
        className={`fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 md:px-10 py-4 transition-all duration-300 ${
          scrolled
            ? "bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-white/[0.06] shadow-[0_1px_20px_rgba(0,0,0,0.5)]"
            : "bg-transparent"
        }`}
      >
        {/* Left: Logo */}
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

        {/* Center: Nav links (desktop) */}
        <div className="hidden md:flex items-center gap-8">
          <Link
            href="/docs"
            className="text-[13px] font-medium text-[#a8a6a2] hover:text-[#f6f4f0] transition-colors"
          >
            Docs
          </Link>
          {["Products", "Solutions", "Community", "Pricing"].map((item) => (
            <Link
              key={item}
              href="#"
              className="text-[13px] font-medium text-[#a8a6a2] hover:text-[#f6f4f0] transition-colors"
            >
              {item}
            </Link>
          ))}
        </div>

        {/* Right: Actions */}
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
            Get started for free
          </Link>
        </div>
      </nav>

      {/* ── HERO ── */}
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
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/[0.1] bg-white/[0.03] text-xs font-medium tracking-wide text-[#a8a6a2]"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Now with Server-Driven UI
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-[clamp(2.5rem,7vw,5.5rem)] font-bold tracking-[-0.03em] leading-[1.05] text-[#f6f4f0]"
          >
            Design to code,
            <br />
            <span className="bg-gradient-to-r from-[#f6f4f0] via-[#d7d6d2] to-[#a8a6a2] bg-clip-text text-transparent">
              all in mint
            </span>
          </motion.h1>

          {/* Subheading */}
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg md:text-xl text-[#a8a6a2] max-w-2xl font-light leading-relaxed"
          >
            mint Technology lets you turn UI designs into production-ready code.
            Import, preview, and ship React, Vue, Flutter, and Expo projects — all from one platform.
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
              Get started for free
              <ArrowRight size={16} />
            </Link>
          </motion.div>
        </div>

        {/* Hero visual – browser mockup */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="relative z-10 mt-16 max-w-5xl w-full mx-auto px-4"
        >
          <div className="rounded-xl border border-white/[0.08] overflow-hidden shadow-[0_20px_80px_-20px_rgba(0,0,0,0.8)] bg-[#111]">
            {/* Browser chrome */}
            <div className="flex items-center gap-2 px-4 py-3 bg-[#161616] border-b border-white/[0.06]">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-white/[0.08]" />
                <div className="w-3 h-3 rounded-full bg-white/[0.08]" />
                <div className="w-3 h-3 rounded-full bg-white/[0.08]" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="bg-white/[0.05] rounded-md px-16 py-1.5 text-[11px] text-[#a8a6a2] font-mono">
                  mintweb.mintit.pro
                </div>
              </div>
            </div>
            {/* Screenshot / Demo video */}
            <video
              src="/videos/create-next-app.mp4"
              aria-label="mint Technology Platform demo"
              width={1200}
              height={750}
              className="w-full h-auto"
              autoPlay
              loop
              playsInline
              muted
            />
          </div>
        </motion.div>
      </motion.section>

      {/* ── STATS BAR ── */}
      <section className="py-16 border-y border-white/[0.04]">
        <div className="max-w-4xl mx-auto flex flex-wrap justify-center gap-8 md:gap-16">
          <Stat value="5+" label="Frameworks" />
          <Stat value="OTA" label="Live Sync" />
          <Stat value="1-Click" label="Export" />
          <Stat value="∞" label="Components" />
        </div>
      </section>

      {/* ── FEATURE CARDS (Figma-style grid) ── */}
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-5 text-[#f6f4f0]">
              Everything you need to ship
            </h2>
            <p className="text-[#a8a6a2] text-lg max-w-2xl mx-auto font-light leading-relaxed">
              A complete design-to-code platform. Import designs, preview live,
              and export production-ready projects.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <FeatureCard
              icon={<Paintbrush size={22} />}
              title="Design Import"
              description="Bring in your Figma designs with full fidelity. We parse frames, auto-layouts, typography, and vectors exactly as designed."
              linkText="Learn more"
              href="#"
              accent="#5b4cd4"
            />
            <FeatureCard
              icon={<Layers size={22} />}
              title="Server-Driven UI"
              description="Push live design updates Over-The-Air to mobile devices and local environments — no rebuild required."
              linkText="Explore SDUI"
              href="#"
              accent="#2d8f6f"
            />
            <FeatureCard
              icon={<Code2 size={22} />}
              title="Code Export"
              description="Download complete, runnable projects as a ZIP. Supports React, Vue, Flutter, and React Native with Expo."
              linkText="See frameworks"
              href="#"
              accent="#c4622d"
            />
            <FeatureCard
              icon={<Smartphone size={22} />}
              title="Mobile Preview"
              description="Preview your designs on real devices instantly. Our MintRenderer dynamically renders UI from JSON schemas."
              linkText="Try preview"
              href="#"
              accent="#2d6dc4"
            />
            <FeatureCard
              icon={<Globe size={22} />}
              title="Multi-Framework"
              description="One design, multiple outputs. Generate code for React, Vue, Flutter, Expo, and React Native from the same source."
              linkText="View outputs"
              href="#"
              accent="#8b5cf6"
            />
            <FeatureCard
              icon={<Zap size={22} />}
              title="Real-Time Sync"
              description="Changes in your design are instantly reflected in your preview. Socket.io and Redis power instant collaboration."
              linkText="See it in action"
              href="#"
              accent="#d4a44c"
            />
          </div>
        </div>
      </section>

      {/* ── DIVIDER ── */}
      <div className="h-px mx-8 md:mx-20 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

      {/* ── HOW IT WORKS ── */}
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-5 text-[#f6f4f0]">
              From first idea to final product
            </h2>
            <p className="text-[#a8a6a2] text-lg max-w-xl mx-auto font-light leading-relaxed">
              Three steps from design to deployed code. No boilerplate, no
              configuration headaches.
            </p>
          </div>

          <div className="flex flex-col gap-24 md:gap-32">
            <WorkflowStep
              number="Step 01"
              title="Sign in and start instantly"
              description="A clean login flow gets your team into projects quickly with minimal friction and a clear primary action."
              imageSrc="/images/sc1.png"
              imageAlt="mint login screen"
            />
            <WorkflowStep
              number="Step 02"
              title="Review the live product view"
              description="Navigate the platform view and entry points in one place so teams can quickly orient before editing or exporting."
              imageSrc="/images/sc2.png"
              imageAlt="mint platform home screen"
              reverse
            />
            <WorkflowStep
              number="Step 03"
              title="Create accounts and onboard teammates"
              description="The signup flow mirrors the same visual system, making onboarding feel consistent and fast for new collaborators."
              imageSrc="/images/sc3.png"
              imageAlt="mint create account screen"
            />
          </div>
        </div>
      </section>

      {/* ── DIVIDER ── */}
      <div className="h-px mx-8 md:mx-20 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

      {/* ── FRAMEWORKS SUPPORTED ── */}
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-5 text-[#f6f4f0]">
            Works with your stack
          </h2>
          <p className="text-[#a8a6a2] text-lg max-w-xl mx-auto font-light leading-relaxed mb-16">
            Generate code for the frameworks and platforms your team already uses.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: "React", icon: <Globe size={28} /> },
              { name: "Vue", icon: <Palette size={28} /> },
              { name: "Flutter", icon: <Smartphone size={28} /> },
              { name: "Expo", icon: <Box size={28} /> },
            ].map((fw) => (
              <div
                key={fw.name}
                className="flex flex-col items-center gap-3 py-8 px-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.12] transition-all group cursor-default"
              >
                <div className="text-[#a8a6a2] group-hover:text-[#f6f4f0] transition-colors">
                  {fw.icon}
                </div>
                <span className="text-sm font-medium text-[#a8a6a2] group-hover:text-[#f6f4f0] transition-colors tracking-wide">
                  {fw.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DIVIDER ── */}
      <div className="h-px mx-8 md:mx-20 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

      {/* ── CTA ── */}
      <section className="relative py-32 md:py-44 px-6 text-center overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[radial-gradient(circle,rgba(246,244,240,0.05),transparent_70%)] blur-[100px] pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto">
          <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 text-[#f6f4f0] leading-[1.05]">
            Ready to build
            <br />
            something great?
          </h2>
          <p className="text-lg md:text-xl text-[#a8a6a2] font-light mb-10 max-w-lg mx-auto">
            Join designers and developers shipping products faster with mint Technology.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="flex items-center gap-2 bg-[#f6f4f0] text-[#0a0a0a] px-8 py-4 rounded-full font-semibold text-base transition-all hover:bg-white hover:shadow-[0_0_30px_rgba(246,244,240,0.2)] hover:scale-[1.02] active:scale-[0.98]"
            >
              Get started for free
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/login"
              className="flex items-center gap-2 border border-white/[0.1] text-[#a8a6a2] hover:text-[#f6f4f0] hover:border-white/[0.2] px-8 py-4 rounded-full font-medium text-base transition-all"
            >
              Log in
              <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/[0.04] bg-[#080808]">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-16">
            {/* Col 1 - Brand */}
            <div className="col-span-2 md:col-span-1 flex flex-col gap-4">
              <Link href="/" className="flex items-center gap-2">
                <Image src={MLogo} alt="mint" width={24} height={24} className="rounded-[5px]" />
                <span className="text-sm font-semibold text-[#f6f4f0]">mint Technology</span>
              </Link>
              <p className="text-xs text-[#a8a6a2] leading-relaxed">
                Design to code, automated.
              </p>
            </div>
            {/* Col 2 */}
            <div className="flex flex-col gap-3">
              <span className="text-xs font-semibold text-[#f6f4f0] uppercase tracking-wider mb-1">
                Product
              </span>
              {["Design Import", "Live Sync", "Code Export", "Mobile Preview"].map((l) => (
                <Link key={l} href="#" className="text-xs text-[#a8a6a2] hover:text-[#f6f4f0] transition-colors">
                  {l}
                </Link>
              ))}
            </div>
            {/* Col 3 */}
            <div className="flex flex-col gap-3">
              <span className="text-xs font-semibold text-[#f6f4f0] uppercase tracking-wider mb-1">
                Frameworks
              </span>
              {["React", "Vue", "Flutter", "Expo / React Native"].map((l) => (
                <Link key={l} href="#" className="text-xs text-[#a8a6a2] hover:text-[#f6f4f0] transition-colors">
                  {l}
                </Link>
              ))}
            </div>
            {/* Col 4 */}
            <div className="flex flex-col gap-3">
              <span className="text-xs font-semibold text-[#f6f4f0] uppercase tracking-wider mb-1">
                Company
              </span>
              {["About", "Blog", "Careers", "Contact"].map((l) => (
                <Link key={l} href="#" className="text-xs text-[#a8a6a2] hover:text-[#f6f4f0] transition-colors">
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
                <Link key={l} href="#" className="text-[11px] text-[#a8a6a2] hover:text-[#f6f4f0] transition-colors">
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
