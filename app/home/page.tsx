"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import MLogo from "@/app/M.png";
import { ArrowRight, ArrowUpRight, ChevronDown } from "lucide-react";

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.classList.add("revealed"); obs.unobserve(el); } },
      { threshold: 0.12, rootMargin: "-30px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

function FAQ({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/[0.06]">
      <button 
        onClick={() => setOpen(!open)} 
        className="w-full flex items-center justify-between py-5 text-left cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded"
      >
        <span className="text-[15px] font-semibold text-[#f5f5f7] pr-8 group-hover:text-white transition-colors">{q}</span>
        <ChevronDown size={16} className={`text-[#888] shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-200 ${open ? "max-h-[400px] pb-5" : "max-h-0"}`}>
        <p className="text-[15px] text-[#a3a3a6] leading-[1.65]">{a}</p>
      </div>
    </div>
  );
}

/* ─── Reddit embed ───────────────────────────────────────────── */
function RedditEmbed() {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!containerRef.current) return;
    const existing = document.querySelector('script[src="https://embed.reddit.com/widgets.js"]');
    if (existing) {
      existing.remove();
    }
    const script = document.createElement("script");
    script.src = "https://embed.reddit.com/widgets.js";
    script.async = true;
    script.charset = "UTF-8";
    containerRef.current.appendChild(script);
  }, []);

  return (
    <div ref={containerRef}>
      <blockquote
        className="reddit-embed-bq"
        style={{ height: 740 }}
        data-embed-style="subreddit-first"
        data-embed-theme="dark"
        data-embed-height="700"
      >
        <a href="https://www.reddit.com/r/reactnative/comments/1tr58gj/building_a_runtimedriven_mobile_app_architecture/">
          Building a runtime-driven mobile app architecture.
        </a>
        <br /> by{" "}
        <a href="https://www.reddit.com/user/Wooden_Sail_342/">u/Wooden_Sail_342</a> in{" "}
        <a href="https://www.reddit.com/r/reactnative/">reactnative</a>
      </blockquote>
    </div>
  );
}

export default function HomePage() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  const r1 = useReveal();
  const r2 = useReveal();
  const r3 = useReveal();
  const r4 = useReveal();
  const r5 = useReveal();
  const r6 = useReveal();

  return (
    <div className="min-h-screen bg-[#09090b] text-[#e0deda] overflow-x-hidden antialiased selection:bg-white/10">
      <style dangerouslySetInnerHTML={{ __html: `
        .revealed { opacity: 1 !important; transform: translateY(0) !important; }
        .reveal-target { opacity: 0; transform: translateY(24px); transition: opacity 0.6s ease, transform 0.6s ease; }
      `}} />

      {/* NAV */}
      <nav className={`fixed top-0 inset-x-0 z-50 flex items-center justify-between px-6 md:px-10 py-4 transition-all duration-300 ${scrolled ? "bg-[#09090b]/90 backdrop-blur-xl border-b border-white/[0.05]" : "bg-transparent"}`}>
        <Link href="/" className="flex items-center gap-2.5 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded" aria-label="Mint Home">
          <Image src={MLogo} alt="Mint brand logo" width={26} height={26} className="rounded-[5px]" />
          <span className="text-[15px] font-semibold tracking-tight">mint</span>
        </Link>
        <div className="hidden md:flex items-center gap-7">
          <Link href="/docs" className="text-[13px] text-[#888] hover:text-white transition-colors py-2 px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded">Docs</Link>
          <Link href="/login" className="text-[13px] text-[#888] hover:text-white transition-colors py-2 px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded">Log in</Link>
          <Link href="/signup" className="text-[13px] font-medium bg-white text-black px-4 py-2 rounded-full hover:bg-[#e0deda] transition-all active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Join Waitlist</Link>
        </div>
        <Link href="/signup" className="md:hidden text-[13px] font-medium bg-white text-black px-4 py-2 rounded-full active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Waitlist</Link>
      </nav>

      {/* ── HERO ── */}
      <section className="pt-36 pb-20 md:pt-48 md:pb-28 px-6">
        <div className="max-w-3xl mx-auto">
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="text-[13px] text-[#777] uppercase tracking-[0.2em] mb-6">
            Runtime-driven application infrastructure
          </motion.p>

          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.05 }} className="text-[clamp(2rem,6vw,3.75rem)] font-semibold tracking-[-0.03em] leading-[1.1] mb-6 text-[#f5f5f7]">
            Update production app behavior instantly.<br />
            <span className="text-[#555]">Without redeployments.</span>
          </motion.h1>

          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.12 }} className="text-[16px] md:text-[18px] text-[#a3a3a6] leading-relaxed mb-8 max-w-xl">
            Mint is a runtime engine that interprets application schemas — screens, workflows, state, and data bindings — so your team can update production behavior in real time. Design visually or write schemas by hand; the runtime handles instant native rendering and live delivery.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
            <Link href="/signup" className="inline-flex items-center justify-center gap-2 bg-white text-black px-7 py-3.5 rounded-full text-[15px] font-semibold hover:bg-[#e0deda] transition-all active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
              Get Early Access — Join the Waitlist Now! <ArrowRight size={15} />
            </Link>
            <Link href="/docs" className="inline-flex items-center justify-center gap-2 border border-white/[0.08] bg-white/[0.02] px-7 py-3.5 rounded-full text-[15px] text-[#888] hover:text-white hover:border-white/[0.15] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
              Documentation <ArrowUpRight size={15} />
            </Link>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.3 }} className="text-[12px] text-[#555] font-mono flex items-center gap-2">
            Join developers waiting for early access.
          </motion.div>
        </div>
      </section>

      {/* ── THE PROBLEM ── */}
      <section className="py-24 md:py-32 px-6">
        <div ref={r1} className="reveal-target max-w-3xl mx-auto">
          <p className="text-[12px] text-[#777] uppercase tracking-[0.2em] mb-4">The problem</p>
          <h2 className="text-2xl md:text-[32px] font-semibold tracking-tight mb-4 text-[#f5f5f7]">Deployment is the bottleneck.</h2>
          <p className="text-[16px] text-[#a3a3a6] leading-[1.65] mb-8 max-w-xl">
            A button label change. A workflow tweak. A new onboarding step. Each one triggers the same pipeline: code change → PR → build → test → deploy → validate. Most of these aren&apos;t code problems. They&apos;re configuration problems trapped in code.
          </p>

          <div className="bg-[#0f0f11] border border-white/[0.05] rounded-xl p-6 md:p-8 mb-8 font-mono text-[14.5px] text-[#9b9ba0] leading-[1.65]">
            <span className="text-[#555] block mb-4">// Think about last month. Your team shipped:</span>
            <div className="flex flex-col gap-2 mb-6 text-[14.5px]">
              <div>• <span className="text-[#e0deda]">12 copy and layout updates</span></div>
              <div>• <span className="text-[#e0deda]">4 onboarding tweaks</span></div>
              <div>• <span className="text-[#e0deda]">8 backend workflow changes</span></div>
            </div>
            <p>
              Every single one required a code commit, a pull request, manual QA, a deployment pipeline run, and cross-team coordination. That&apos;s dozens of developer hours and CPU cycles spent on updates that contained zero new engineering logic.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/[0.04] rounded-xl overflow-hidden border border-white/[0.04]">
            {[
              ["Slow iteration", "Text changes require full CI/CD runs. Teams wait hours to validate what should take seconds."],
              ["Coupled releases", "Layout, logic, and content ship together. Changing a workflow means redeploying the frontend."],
              ["Platform fragility", "iOS, Android, and web each need separate deploys synced manually. Drift is inevitable."],
            ].map(([t, d]) => (
              <div key={t} className="bg-[#0d0d0f] p-6">
                <h3 className="text-[14.5px] font-semibold text-[#f5f5f7] mb-2">{t}</h3>
                <p className="text-[14.5px] text-[#88888c] leading-[1.65]">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="h-px mx-10 md:mx-24 bg-white/[0.04]" />

      {/* ── WHAT HAPPENS WHEN YOU PUSH ── */}
      <section className="px-6 pb-24 md:pb-32">
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.35 }} className="max-w-3xl mx-auto">
          <div className="rounded-lg border border-white/[0.07] overflow-hidden bg-[#0f0f11]">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-[#131316] border-b border-white/[0.05]">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-white/[0.07]" />
                <div className="w-2.5 h-2.5 rounded-full bg-white/[0.07]" />
                <div className="w-2.5 h-2.5 rounded-full bg-white/[0.07]" />
              </div>
              <span className="ml-2 text-[11px] text-[#555] font-mono">production update</span>
            </div>
            <div className="p-5 md:p-6 font-mono text-[13px] leading-[1.9] overflow-x-auto">
              <div className="text-[#555] mb-3">Publishing changes to 3 connected clients...</div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2.5"><span className="text-emerald-500/80">✓</span> <span className="text-[#999]">New onboarding flow applied</span></div>
                <div className="flex items-center gap-2.5"><span className="text-emerald-500/80">✓</span> <span className="text-[#999]">Updated pricing screen</span></div>
                <div className="flex items-center gap-2.5"><span className="text-emerald-500/80">✓</span> <span className="text-[#999]">Navigation restructured</span></div>
                <div className="flex items-center gap-2.5"><span className="text-emerald-500/80">✓</span> <span className="text-[#999]">Approval workflow activated</span></div>
                <div className="flex items-center gap-2.5"><span className="text-emerald-500/80">✓</span> <span className="text-[#999]">State synced across iOS, Android, Web</span></div>
              </div>
              <div className="mt-4 pt-3 border-t border-white/[0.05] flex items-center gap-3 text-[11px]">
                <span className="inline-flex items-center gap-1.5 text-emerald-500/70">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Done in 38ms
                </span>
                <span className="text-white/[0.1]">|</span>
                <span className="text-[#555]">No build. No deploy. No app store review.</span>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── REDDIT EMBED ── */}
      <section className="py-16 md:py-20 px-6">
        <div className="max-w-2xl mx-auto">
          <p className="text-[12px] text-[#555] uppercase tracking-[0.2em] mb-6 text-center">The conversation that started it (Use headphones for clear audio)</p>
          <RedditEmbed />
        </div>
      </section>

      <div className="h-px mx-10 md:mx-24 bg-white/[0.04]" />

      {/* ── HOW MINT WORKS ── */}
      <section className="py-24 md:py-32 px-6">
        <div ref={r2} className="reveal-target max-w-3xl mx-auto">
          <p className="text-[12px] text-[#777] uppercase tracking-[0.2em] mb-4">How it works</p>
          <h2 className="text-2xl md:text-[32px] font-semibold tracking-tight mb-4 text-[#f5f5f7]">Schema in, application out.</h2>
          <p className="text-[16px] text-[#a3a3a6] leading-[1.65] mb-10 max-w-xl">
            Your application is defined as a structured schema — screens, components, data bindings, workflows, navigation. The mint runtime interprets it on every platform, for every user. Update the schema, and every connected client reflects the change in milliseconds.
          </p>

          <div className="flex flex-col gap-0">
            {[
              ["Define the schema", "Describe screens, components, state, actions, and data bindings as declarative JSON. Use the visual editor to author it, or write it by hand — the runtime doesn't care."],
              ["Publish to the runtime", "Push your schema to the mint runtime. No build step. No bundling. No deploy pipeline. The runtime is always listening."],
              ["Runtime interprets", "The engine resolves components, executes workflows, binds data, manages state, and renders the application dynamically on each client."],
              ["Instant delivery", "Every connected client receives the update. iOS, Android, web — simultaneously. No app store review. No downtime. Sub-50ms propagation."],
            ].map(([title, desc], i) => (
              <div key={i} className="flex gap-5 py-6 border-b border-white/[0.04] last:border-b-0">
                <span className="text-[14.5px] font-mono text-[#555] mt-0.5 shrink-0 w-6">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="text-[15.5px] font-semibold text-[#f5f5f7] mb-1.5">{title}</h3>
                  <p className="text-[14.5px] text-[#88888c] leading-[1.65]">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="h-px mx-10 md:mx-24 bg-white/[0.04]" />

      {/* ── PLATFORM CAPABILITIES ── */}
      <section className="py-24 md:py-32 px-6">
        <div ref={r3} className="reveal-target max-w-3xl mx-auto">
          <p className="text-[12px] text-[#777] uppercase tracking-[0.2em] mb-4">Platform</p>
          <h2 className="text-2xl md:text-[32px] font-semibold tracking-tight mb-10 text-[#f5f5f7]">What the runtime handles.</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/[0.04] rounded-xl overflow-hidden border border-white/[0.04]">
            {[
              ["Server-Driven UI", "Screens defined as schemas, resolved at runtime. Update layouts and components without touching client code."],
              ["Workflow orchestration", "Multi-step workflows — approvals, conditional logic, API calls — as configurable pipelines executed server-side."],
              ["Database bindings", "Components bound directly to data sources. The runtime handles queries, pagination, filtering, and subscriptions."],
              ["Live production updates", "Schema updates propagate to all connected clients in real time. Rollback to any previous version in one click."],
              ["Cross-platform rendering", "Single schema renders natively across iOS, Android, and web. One source of truth, consistent behavior everywhere."],
              ["State management", "Application state — forms, sessions, navigation — managed by the runtime with persistence, sync, and rollback built in."],
              ["Visual authoring", "A Figma-like editor for designing schemas visually. Frames become screens. Shapes become components. Everything is configurable."],
              ["Code generation", "Export the schema as production source code — React, Next.js, Vue, Svelte, React Native, or Flutter. You own the output."],
            ].map(([t, d]) => (
              <div key={t} className="bg-[#0d0d0f] p-6">
                <h3 className="text-[14.5px] font-semibold text-[#f5f5f7] mb-2">{t}</h3>
                <p className="text-[14.5px] text-[#88888c] leading-[1.65]">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="h-px mx-10 md:mx-24 bg-white/[0.04]" />

      {/* ── FOR DEVELOPERS ── */}
      <section className="py-24 md:py-32 px-6">
        <div ref={r4} className="reveal-target max-w-3xl mx-auto">
          <p className="text-[12px] text-[#777] uppercase tracking-[0.2em] mb-4">For developers</p>
          <h2 className="text-2xl md:text-[32px] font-semibold tracking-tight mb-4 text-[#f5f5f7]">You own the components. We run the runtime.</h2>
          <p className="text-[16px] text-[#a3a3a6] leading-[1.65] mb-10 max-w-xl">
            Mint doesn&apos;t replace your engineering team. It separates what changes frequently (screens, workflows, content) from what doesn&apos;t (component implementations, business logic, infrastructure).
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/[0.04] rounded-xl overflow-hidden border border-white/[0.04] mb-8">
            <div className="bg-[#0f0f11] p-5">
              <div className="text-[11px] text-[#777] uppercase tracking-[0.15em] mb-4 font-semibold">Traditional workflow</div>
              <div className="font-mono text-[13px] leading-[2] text-[#555]">
                <div>modify code</div>
                <div>→ open pull request</div>
                <div>→ wait for review</div>
                <div>→ merge to main</div>
                <div>→ CI builds</div>
                <div>→ deploy to staging</div>
                <div>→ QA validates</div>
                <div>→ deploy to production</div>
                <div className="mt-2 text-[#444]">~ hours to days</div>
              </div>
            </div>
            <div className="bg-[#0f0f11] p-5">
              <div className="text-[11px] text-emerald-500/70 uppercase tracking-[0.15em] mb-4 font-semibold">With mint</div>
              <div className="font-mono text-[13px] leading-[2] text-[#9b9ba0]">
                <div>update screen / workflow / state</div>
                <div>→ publish</div>
                <div className="mt-2 text-emerald-500/80">done. 38ms.</div>
                <div className="mt-4 text-[#555]">Rollback?</div>
                <div className="text-[#9b9ba0]">→ one click. instant.</div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-0">
            {[
              ["Your component library, your rules", "Register React, Flutter, SwiftUI, or Compose components. The runtime resolves schema types to your implementations."],
              ["Standard tooling, no lock-in", "Use your existing IDE, git, CI pipeline, and testing framework. Schemas are JSON — version them, diff them, review them."],
              ["Type-safe schema contracts", "Schemas validate against TypeScript-generated types. Mismatches surface at authoring time, not in production."],
              ["Escape hatches everywhere", "Any component can break out of the schema layer and run native code. The runtime is an accelerator, not a cage."],
            ].map(([t, d], i) => (
              <div key={i} className="flex gap-4 py-5 border-b border-white/[0.04] last:border-b-0">
                <span className="text-emerald-500/60 mt-0.5 shrink-0 text-[14px]">✓</span>
                <div>
                  <h4 className="text-[15.5px] font-semibold text-[#f5f5f7] mb-1">{t}</h4>
                  <p className="text-[14.5px] text-[#88888c] leading-[1.65]">{d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="h-px mx-10 md:mx-24 bg-white/[0.04]" />

      {/* ── FAQ ── */}
      <section className="py-24 md:py-32 px-6">
        <div ref={r5} className="reveal-target max-w-2xl mx-auto">
          <p className="text-[12px] text-[#777] uppercase tracking-[0.2em] mb-4">FAQ</p>
          <h2 className="text-2xl md:text-[32px] font-semibold tracking-tight mb-10 text-[#f5f5f7]">Questions.</h2>

          <FAQ q="Is this another no-code app builder?" a="No. Mint is a runtime engine. The visual editor is one way to author schemas — you can also write them by hand. The core product is the runtime that interprets those schemas across platforms, handles state, executes workflows, and delivers updates without redeployment." />
          <FAQ q="How is this different from FlutterFlow / Bubble / Retool?" a="Those are app builders — they generate or host applications. Mint is infrastructure. Your application runs on your stack, with your components, in your deployment. The runtime sits alongside your code and handles the parts that change frequently. You control everything else." />
          <FAQ q="What does 'runtime-driven' actually mean?" a="Instead of compiling configuration into static code that needs redeployment, the runtime interprets a schema at execution time. When the schema changes, the application changes — without a new build, without a new deploy, without an app store review." />
          <FAQ q="Can I still export real source code?" a="Yes. The visual editor exports production code to React, Next.js, Vue, Svelte, React Native (Expo), or Flutter. Full project scaffolds with routing, dependencies, and config. You can commit it to git and keep building on it." />
          <FAQ q="What about the database?" a="You define tables visually — column names, types, constraints, relations. Mint generates the PostgreSQL schema and API routes. Your application talks to a real database with proper migrations, not a mock." />
          <FAQ q="How does live sync work?" a="A lightweight daemon polls the server every 2 seconds. When you publish a schema update, it downloads the changed files and writes them to disk. Your dev server's hot reload picks up the changes. In production, the runtime delivers updates directly — no files involved." />
          <FAQ q="What happens if the runtime is unreachable?" a="The client SDK caches the last-known schema locally. The application continues operating. When connectivity is restored, the runtime syncs the latest version automatically. No user-visible interruption." />
        </div>
      </section>

      <div className="h-px mx-10 md:mx-24 bg-white/[0.04]" />

      {/* ── CTA ── */}
      <section className="py-28 md:py-36 px-6">
        <div ref={r6} className="reveal-target max-w-2xl mx-auto text-center">
          <h2 className="text-3xl md:text-[40px] font-semibold tracking-tight mb-5 leading-[1.15] text-[#f5f5f7]">
            Ship configuration,<br />
            <span className="text-[#555]">not deployments.</span>
          </h2>
          <p className="text-[16px] text-[#a3a3a6] mb-8 max-w-md mx-auto leading-[1.65]">
            Join the waitlist. We&apos;ll let you in when your spot opens.
          </p>
          <div className="flex flex-col items-center gap-4">
            <Link href="/signup" className="inline-flex items-center gap-2 bg-white text-black px-7 py-3.5 rounded-full text-[15px] font-semibold hover:bg-[#e0deda] transition-all active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
              Get Early Access — Join the Waitlist Now! <ArrowRight size={15} />
            </Link>
            <div className="text-[12px] text-[#555] font-mono">
              No credit card required. Cancel anytime.
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/[0.04] py-8 px-6">
        <div className="max-w-3xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image src={MLogo} alt="Mint logo" width={18} height={18} className="rounded-[3px]" />
            <span className="text-[12px] text-[#555]">© {new Date().getFullYear()} mint</span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/docs" className="text-[12px] text-[#555] hover:text-white transition-colors py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded">Docs</Link>
            <Link href="/login" className="text-[12px] text-[#555] hover:text-white transition-colors py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded">Log in</Link>
            <Link href="/signup" className="text-[12px] text-[#555] hover:text-white transition-colors py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded">Waitlist</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
