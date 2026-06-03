"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import MLogo from "@/app/M.png";
import {
  LayoutDashboard, GitBranch, Database, Download, Lightbulb,
  PenTool, Cpu, Box, Server, Repeat, Code, Zap, ArrowRight,
  AlertTriangle, LogIn, TerminalSquare, Smartphone, Monitor,
  Layers, Package, Play, Settings, Users, FileCode, Rocket,
  ChevronRight, Hash, Workflow, MousePointer, Type, Image as ImageIcon,
  Square, Circle, Minus, Copy, Scissors, RotateCcw, RotateCw,
  ZoomIn, Lock, Unlock, Eye, EyeOff, AlignLeft, Columns,
  Palette
} from "lucide-react";

const sections = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "getting-started", label: "Getting Started", icon: Rocket },
  { id: "editor", label: "Editor", icon: PenTool },
  { id: "backend", label: "Backend", icon: Cpu },
  { id: "export", label: "Export & Build", icon: Download },
  { id: "sync", label: "Live Sync", icon: Repeat },
  { id: "collab", label: "Collaboration", icon: Users },
  { id: "shortcuts", label: "Shortcuts", icon: Zap },
];

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[26px] font-semibold tracking-tight text-[#f6f4f0] mb-3">{children}</h2>;
}

function SectionSub({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] text-[#a8a6a2] leading-relaxed mb-7">{children}</p>;
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-[17px] font-medium text-[#f6f4f0] mt-8 mb-3">{children}</h3>;
}

function Tip({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-l-[3px] border-blue-500/50 bg-blue-500/[0.06] rounded-r-lg px-4 py-3 my-5 text-[14px] leading-relaxed text-[#e0deda]">
      <strong className="font-semibold">{title}</strong> {children}
    </div>
  );
}

function Warning({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-l-[3px] border-amber-500/50 bg-amber-500/[0.06] rounded-r-lg px-4 py-3 my-5 text-[14px] leading-relaxed text-[#e0deda]">
      <strong className="font-semibold">{title}</strong> {children}
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-4 py-3 my-3 font-mono text-[13px] leading-[1.7] text-[#e0deda] whitespace-pre-wrap overflow-x-auto">
      {children}
    </pre>
  );
}

function StepList({ steps }: { steps: { title: string; desc: React.ReactNode }[] }) {
  return (
    <div className="flex flex-col gap-0">
      {steps.map((s, i) => (
        <div key={i} className="flex gap-4 py-4 border-b border-white/[0.04] last:border-b-0">
          <div className="w-[28px] h-[28px] rounded-full bg-blue-500/10 text-blue-400 text-[13px] font-semibold flex items-center justify-center flex-shrink-0 mt-0.5">
            {i + 1}
          </div>
          <div>
            <h4 className="text-[15px] font-medium text-[#f6f4f0] mb-1">{s.title}</h4>
            <div className="text-[14px] text-[#a8a6a2] leading-relaxed">{s.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Card({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5">
      <Icon size={22} className="text-blue-400 mb-3" />
      <h3 className="text-[15px] font-medium text-[#f6f4f0] mb-2">{title}</h3>
      <p className="text-[13px] text-[#a8a6a2] leading-relaxed">{children}</p>
    </div>
  );
}

function PropRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-white/[0.04] last:border-b-0 text-[13px]">
      <span className="text-[#a8a6a2]">{label}</span>
      <code className="font-mono text-[12px] text-[#e0deda]">{value}</code>
    </div>
  );
}

function FrameworkGrid() {
  const fws = [
    { name: "React", icon: Code, desc: "JSX/TSX components with hooks" },
    { name: "Next.js", icon: Server, desc: "App Router pages and layouts" },
    { name: "Vue", icon: Layers, desc: "Single File Components (.vue)" },
    { name: "Svelte", icon: Zap, desc: "Svelte components (.svelte)" },
    { name: "React Native", icon: Smartphone, desc: "Expo Router mobile app" },
    { name: "Flutter", icon: Palette, desc: "Dart widgets and screens" },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 my-4">
      {fws.map(f => (
        <div key={f.name} className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 flex items-start gap-3">
          <f.icon size={18} className="text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <div className="text-[14px] font-medium text-[#f6f4f0]">{f.name}</div>
            <div className="text-[12px] text-[#a8a6a2] mt-0.5">{f.desc}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
export default function DocsPage() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f6f4f0] antialiased selection:bg-white/20">
      <nav className="fixed top-0 inset-x-0 z-50 bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="flex items-center justify-between px-6 lg:px-10 py-4 max-w-[1600px] mx-auto">
          <Link href="/home" className="flex items-center gap-3 group">
            <Image src={MLogo} alt="mint" width={28} height={28} className="rounded-[6px]" />
            <span className="text-lg font-semibold tracking-tight">mint <span className="text-white/40 font-normal">Docs</span></span>
          </Link>
          <div className="hidden lg:flex items-center gap-4">
            <Link href="/login" className="text-[13px] font-medium text-[#a8a6a2] hover:text-[#f6f4f0] transition-colors">Platform</Link>
            <Link href="/signup" className="text-[13px] font-semibold bg-[#f6f4f0] text-[#0a0a0a] px-4 py-1.5 rounded-full hover:bg-white transition-all">Get Started</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-[1600px] mx-auto pt-[90px] px-6 lg:px-10 pb-32">
        <div className="max-w-[820px] mx-auto">
          {/* Tab navigation */}
          <div className="flex gap-1.5 flex-wrap mb-8 pb-4 border-b border-white/[0.04]">
            {sections.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveTab(s.id)}
                className={`text-[13px] px-3.5 py-2 rounded-md border flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === s.id
                    ? "border-white/[0.15] bg-white/[0.05] text-[#f6f4f0] font-medium"
                    : "border-white/[0.06] bg-transparent text-[#a8a6a2] hover:bg-white/[0.03] hover:text-[#f6f4f0]"
                }`}
              >
                <s.icon size={15} />
                {s.label}
              </button>
            ))}
          </div>

          {/* ─── OVERVIEW ─── */}
          {activeTab === "overview" && (
            <div>
              <SectionHeading>What is Mint?</SectionHeading>
              <SectionSub>
                Mint is a visual application builder. You design your UI on a canvas, configure your backend logic visually, and Mint generates production-ready source code across six frameworks. You own the code — export it, modify it, deploy it anywhere.
              </SectionSub>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                <Card icon={Box} title="Visual Canvas">Design screens on a Figma-like editor. Every element maps directly to real, readable code.</Card>
                <Card icon={Cpu} title="Runtime Engine">Lightweight engine that manages state, data bindings, and actions between your UI and backend.</Card>
                <Card icon={Server} title="Auto Backend">Define database tables visually. Mint generates the schema, API routes, and CRUD operations.</Card>
                <Card icon={GitBranch} title="Workflows">Build complex business logic as visual flowcharts — conditions, loops, API calls, all without code.</Card>
                <Card icon={Repeat} title="Live Sync">Push canvas changes to your running app instantly. The sync daemon patches your code via HMR.</Card>
                <Card icon={Code} title="6 Frameworks">Export to React, Next.js, Vue, Svelte, React Native (Expo), or Flutter. Full project scaffolds included.</Card>
              </div>

              <SubHeading>How it works</SubHeading>
              <StepList steps={[
                { title: "Design your screens", desc: "Draw frames on the canvas. Each frame becomes a route in your app. Add shapes, text, buttons, images, and forms." },
                { title: "Add logic and data", desc: "Open the Backend Panel to define state variables, actions, database tables, and workflows. Bind data to UI elements." },
                { title: "Commit or export", desc: "Click Commit to generate versioned code, or Export to download a ZIP. Your design becomes a complete, runnable project." },
                { title: "Run and iterate", desc: "Install dependencies, start your dev server. Enable Live Sync to push design changes without rebuilding." },
              ]} />

              <Tip title="Mental model:">Think of Mint as three layers — the Canvas (what users see), the Runtime (logic), and the Backend (data). All three stay in sync automatically.</Tip>
            </div>
          )}

          {/* ─── GETTING STARTED ─── */}
          {activeTab === "getting-started" && (
            <div>
              <SectionHeading>Getting Started</SectionHeading>
              <SectionSub>Create your account, set up your first project, and export working code in under 5 minutes.</SectionSub>

              <SubHeading>Create an account</SubHeading>
              <StepList steps={[
                { title: "Sign up", desc: "Go to the signup page. Enter your name, email, and password. Complete the onboarding wizard — tell us what you're building, your industry, and team size." },
                { title: "Create a project", desc: <>From the dashboard, click <code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px]">New Project</code>. Give it a name and optional description.</> },
                { title: "Open the editor", desc: "Click your project to open the visual editor. You'll see a blank canvas ready for your first frame." },
              ]} />

              <SubHeading>Your first screen</SubHeading>
              <StepList steps={[
                { title: "Draw a frame", desc: <>Press <code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px]">F</code> and drag on the canvas. This frame is your first screen — name it &quot;Home&quot; in the layers panel.</> },
                { title: "Add elements", desc: <>Use the toolbar: <code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px]">R</code> for rectangles, <code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px]">T</code> for text, <code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px]">O</code> for ellipses. Drag elements into your frame.</> },
                { title: "Style with the sidebar", desc: "Select any element to see its properties in the right panel — fill color, border, typography, layout direction, padding, and effects." },
                { title: "Export your project", desc: <>Click <code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px]">Export</code> in the toolbar, pick a framework (e.g. React Native), and download the ZIP.</> },
              ]} />

              <SubHeading>Run the exported code</SubHeading>
              <CodeBlock>{`# Extract the ZIP
unzip my-app-react-native.zip -d my-app
cd my-app

# Install dependencies
npm install

# Start the development server
npx expo start

# Or for web frameworks:
npm run dev`}</CodeBlock>

              <Tip title="Expo Go:">For React Native exports, scan the QR code with the Expo Go app on your phone to see your design running as a real mobile app.</Tip>
            </div>
          )}

          {/* ─── EDITOR ─── */}
          {activeTab === "editor" && (
            <div>
              <SectionHeading>The Visual Editor</SectionHeading>
              <SectionSub>The editor is where you design your app. It works like Figma — draw shapes, arrange layouts, style elements — but everything maps to real code components.</SectionSub>

              <SubHeading>Canvas basics</SubHeading>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5">
                  <h4 className="text-[15px] font-medium text-[#f6f4f0] mb-3">Frames = Screens</h4>
                  <p className="text-[13px] text-[#a8a6a2] leading-relaxed mb-2">Every top-level frame becomes a route in your app. The frame name sets the URL path.</p>
                  <PropRow label="Home" value="→ /" />
                  <PropRow label="UserProfile" value="→ /user-profile" />
                  <PropRow label="Settings" value="→ /settings" />
                </div>
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5">
                  <h4 className="text-[15px] font-medium text-[#f6f4f0] mb-3">Shape tools</h4>
                  <PropRow label="Frame" value="F" />
                  <PropRow label="Rectangle" value="R" />
                  <PropRow label="Ellipse" value="O" />
                  <PropRow label="Text" value="T" />
                  <PropRow label="Line" value="L" />
                  <PropRow label="Pen (vector)" value="P" />
                </div>
              </div>

              <SubHeading>Design properties</SubHeading>
              <p className="text-[14px] text-[#a8a6a2] mb-3">Select any element to configure it in the right sidebar.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5">
                  <h4 className="text-[14px] font-medium text-[#f6f4f0] mb-3">Layout</h4>
                  <PropRow label="Direction" value="row / column" />
                  <PropRow label="Align" value="start / center / end" />
                  <PropRow label="Justify" value="between / around / evenly" />
                  <PropRow label="Gap" value="px value" />
                  <PropRow label="Padding" value="per-side control" />
                </div>
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5">
                  <h4 className="text-[14px] font-medium text-[#f6f4f0] mb-3">Appearance</h4>
                  <PropRow label="Fill" value="solid / gradient" />
                  <PropRow label="Border" value="width, color, radius" />
                  <PropRow label="Shadow" value="x, y, blur, spread" />
                  <PropRow label="Opacity" value="0–100%" />
                  <PropRow label="Blur" value="background / layer" />
                </div>
              </div>

              <SubHeading>Layers panel</SubHeading>
              <p className="text-[14px] text-[#a8a6a2] mb-3">The left panel shows your layer hierarchy. Drag to reorder, nest elements by dragging onto frames. Right-click for options: rename, duplicate, delete, lock, hide.</p>

              <SubHeading>Interactions & prototyping</SubHeading>
              <p className="text-[14px] text-[#a8a6a2] mb-3">Connect frames with interaction links to create click-through prototypes. Select an element, choose an event (tap, hover), and set the target frame and transition animation. Use the Prototype Viewer to test flows without exporting.</p>

              <Warning title="Frame naming matters:">The frame name becomes the URL route. Renaming a frame after creating navigation actions can break those references. Name frames intentionally from the start.</Warning>
            </div>
          )}

          {/* ─── BACKEND ─── */}
          {activeTab === "backend" && (
            <div>
              <SectionHeading>Backend Panel</SectionHeading>
              <SectionSub>The Backend Panel is where you configure everything behind the UI — state management, actions, database tables, and workflows. Open it from the bottom toolbar in the editor.</SectionSub>

              <SubHeading>State management</SubHeading>
              <p className="text-[14px] text-[#a8a6a2] mb-3">State holds your app&apos;s data. Define variables with a name, type, and default value.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5">
                  <h4 className="text-[14px] font-medium text-[#f6f4f0] mb-2">Global state</h4>
                  <p className="text-[13px] text-[#a8a6a2] leading-relaxed">Accessible from any screen. Use for auth tokens, user data, app settings. Enable <strong>Persist</strong> to save to localStorage automatically.</p>
                </div>
                <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5">
                  <h4 className="text-[14px] font-medium text-[#f6f4f0] mb-2">Local state</h4>
                  <p className="text-[13px] text-[#a8a6a2] leading-relaxed">Scoped to one screen. Use for form values, loading flags, modal visibility. Destroyed when the screen unmounts.</p>
                </div>
              </div>

              <SubHeading>Data bindings</SubHeading>
              <p className="text-[14px] text-[#a8a6a2] mb-3">Connect state to UI using expressions. Click the link icon next to any component property, then enter an expression:</p>
              <CodeBlock>{`$global.user.name          → global state
$local.isLoading           → local state
$route.params.id           → URL parameter
$local.count > 0 ? "Items" : "Empty"  → ternary`}</CodeBlock>

              <SubHeading>Actions</SubHeading>
              <p className="text-[14px] text-[#a8a6a2] mb-3">Actions are operations triggered by events (tap, submit, mount). Types include:</p>
              <div className="space-y-2 mb-4">
                <PropRow label="setState / updateState / resetState" value="Modify state variables" />
                <PropRow label="navigate / goBack" value="Change screens" />
                <PropRow label="apiCall / fetch" value="HTTP requests" />
                <PropRow label="showToast / showAlert" value="UI feedback" />
                <PropRow label="condition / loop / delay" value="Logic control" />
                <PropRow label="login / logout / register" value="Auth operations" />
              </div>

              <SubHeading>Database</SubHeading>
              <StepList steps={[
                { title: "Enable the database", desc: "Open the Database tab and click Enable. Mint provisions a PostgreSQL schema for your project." },
                { title: "Create tables", desc: "Click New Table. Define columns with name, type (text, integer, boolean, uuid, json, timestamp), and constraints." },
                { title: "Set relations", desc: "Define one-to-many or many-to-many relations between tables. Mint generates foreign keys and join tables." },
                { title: "Access data", desc: <>Use <code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px]">fetch</code> actions with your table&apos;s API route, or <code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px]">DB Query</code> nodes in workflows for raw SQL.</> },
              ]} />

              <SubHeading>Workflows</SubHeading>
              <p className="text-[14px] text-[#a8a6a2] mb-3">For complex logic, use the visual workflow builder. Drag nodes from the palette, connect them with edges, and configure each node&apos;s parameters.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                {["If / Else", "Switch", "Loop", "ForEach", "Map", "Filter", "Delay", "Debounce", "API Call", "DB Query", "Navigate", "Toast"].map(n => (
                  <div key={n} className="bg-white/[0.02] border border-white/[0.05] rounded-lg px-3 py-2 text-[13px] text-[#a8a6a2] text-center">{n}</div>
                ))}
              </div>
              <Tip title="When to use Workflows vs Actions:">Use action JSON for simple, single-step logic. Switch to Workflows when you need branching, loops, or more than 3 chained steps.</Tip>
            </div>
          )}

          {/* ─── EXPORT & BUILD ─── */}
          {activeTab === "export" && (
            <div>
              <SectionHeading>Export & Build</SectionHeading>
              <SectionSub>When your design is ready, Mint compiles it into real source code. Download a ZIP, extract it, install dependencies, and run — it&apos;s a complete project.</SectionSub>

              <SubHeading>Supported frameworks</SubHeading>
              <FrameworkGrid />

              <SubHeading>How to export</SubHeading>
              <StepList steps={[
                { title: "Click Export in the toolbar", desc: "Select your target framework from the dialog." },
                { title: "Configure options", desc: "Choose TypeScript or JavaScript, CSS framework (Tailwind, CSS Modules, Styled Components), and whether to enable Live Sync." },
                { title: "Download the ZIP", desc: "Mint generates code, bundles images, and creates a complete project scaffold. The ZIP downloads to your browser." },
              ]} />

              <SubHeading>How to commit</SubHeading>
              <p className="text-[14px] text-[#a8a6a2] mb-3">Committing is different from exporting. A commit generates code and stores it as a versioned snapshot on the server. This enables Live Sync and version history.</p>
              <StepList steps={[
                { title: "Click Commit in the toolbar", desc: "Select the target framework and enter an optional commit message." },
                { title: "Mint diffs against the previous commit", desc: "Only changed files are stored and sent to sync clients. A full snapshot is kept for future diffs." },
                { title: "Version number increments", desc: "Each commit gets an auto-incrementing version. You can view history and roll back from the commit log." },
              ]} />

              <SubHeading>Extract and run</SubHeading>
              <CodeBlock>{`# Web frameworks (React, Next.js, Vue, Svelte)
unzip my-app-react.zip -d my-app && cd my-app
npm install
npm run dev

# React Native (Expo)
unzip my-app-react-native.zip -d my-app && cd my-app
npm install
npx expo start`}</CodeBlock>

              <SubHeading>Build a release APK (React Native)</SubHeading>
              <p className="text-[14px] text-[#a8a6a2] mb-3">To build a production Android APK, eject from Expo&apos;s managed workflow and use Gradle:</p>
              <CodeBlock>{`# 1. Generate native android/ and ios/ folders
npx expo prebuild

# 2. Build a release APK
cd android
./gradlew assembleRelease

# Output: android/app/build/outputs/apk/release/app-release.apk

# 3. Or build an App Bundle for Play Store
./gradlew bundleRelease

# Output: android/app/build/outputs/bundle/release/app-release.aab`}</CodeBlock>

              <Warning title="Signing:">Release builds require a signing keystore. Create one with keytool and configure it in android/app/build.gradle before running assembleRelease.</Warning>

              <SubHeading>Build for iOS</SubHeading>
              <CodeBlock>{`# After npx expo prebuild
cd ios
pod install
# Open .xcworkspace in Xcode → Product → Archive`}</CodeBlock>
            </div>
          )}

          {/* ─── LIVE SYNC ─── */}
          {activeTab === "sync" && (
            <div>
              <SectionHeading>Live Sync</SectionHeading>
              <SectionSub>Live Sync keeps your running app in sync with the canvas. Make a design change, commit it, and your dev server updates automatically via Hot Module Replacement — no rebuild needed.</SectionSub>

              <SubHeading>How it works</SubHeading>
              <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-5 my-4 font-mono text-[13px] text-[#a8a6a2] leading-loose">
                <div>Editor (browser) → Commit → Server stores version</div>
                <div className="ml-12">↓</div>
                <div>mint-connector.mjs polls /api/project-data every 2s</div>
                <div className="ml-12">↓</div>
                <div>mint-the-god.mjs writes changed files to disk</div>
                <div className="ml-12">↓</div>
                <div>Dev server HMR detects changes → UI updates</div>
              </div>

              <SubHeading>Enable Live Sync</SubHeading>
              <StepList steps={[
                { title: "Enable during export", desc: "Check the \"Enable Live Sync\" option when exporting. This injects three files into your project." },
                { title: "Start the sync daemon", desc: <><code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px]">npm run sync</code> — or it starts automatically with <code className="bg-white/[0.06] px-1.5 py-0.5 rounded text-[13px]">npm run dev</code> (the dev script is auto-patched).</> },
                { title: "Make changes and commit", desc: "Edit anything on the canvas, click Commit. The daemon picks up the new version within 2 seconds." },
              ]} />

              <SubHeading>Injected files</SubHeading>
              <div className="space-y-2 mb-4">
                <PropRow label="mint-connector.mjs" value="Polls server for new commits" />
                <PropRow label="mint-the-god.mjs" value="Writes received files to disk" />
                <PropRow label="mint-sync.config.json" value="Project ID, server URL, poll interval" />
              </div>

              <SubHeading>Protected files</SubHeading>
              <p className="text-[14px] text-[#a8a6a2] mb-3">The sync daemon will never overwrite these files, even if they appear in a commit:</p>
              <CodeBlock>{`package.json, package-lock.json, node_modules/,
.gitignore, .env, .env.local,
mint-connector.mjs, mint-the-god.mjs, mint-sync.config.json`}</CodeBlock>

              <Tip title="Custom poll interval:">Edit mint-sync.config.json to change the polling frequency. Default is 2000ms (2 seconds).</Tip>
            </div>
          )}

          {/* ─── COLLABORATION ─── */}
          {activeTab === "collab" && (
            <div>
              <SectionHeading>Collaboration</SectionHeading>
              <SectionSub>Work with your team in real-time on the same canvas. See each other&apos;s cursors, selections, and changes as they happen.</SectionSub>

              <SubHeading>Real-time features</SubHeading>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <Card icon={MousePointer} title="Live cursors">See where each collaborator is pointing in real-time. Each user gets a unique color.</Card>
                <Card icon={Square} title="Selection sync">When someone selects elements, you see their selection highlighted on your canvas.</Card>
                <Card icon={GitBranch} title="Change broadcasting">Shape additions, deletions, moves, and style changes sync instantly to all editors.</Card>
                <Card icon={Users} title="Presence indicators">See who&apos;s online in the current file with avatar indicators in the toolbar.</Card>
              </div>

              <SubHeading>Teams</SubHeading>
              <p className="text-[14px] text-[#a8a6a2] mb-3">Create teams to manage access. Team members can have different roles: Owner, Admin, or Editor. Owners can manage members and project settings. Editors can design but cannot change project configuration.</p>

              <SubHeading>Limits</SubHeading>
              <div className="space-y-2">
                <PropRow label="Max editors per file" value="50 simultaneous" />
                <PropRow label="Cursor update rate" value="60 fps (16ms throttle)" />
              </div>
            </div>
          )}

          {/* ─── SHORTCUTS ─── */}
          {activeTab === "shortcuts" && (
            <div>
              <SectionHeading>Keyboard Shortcuts</SectionHeading>
              <SectionSub>Speed up your workflow with keyboard shortcuts. These work when the canvas is focused.</SectionSub>

              <SubHeading>Tools</SubHeading>
              <div className="space-y-0">
                <PropRow label="Frame tool" value="F" />
                <PropRow label="Rectangle" value="R" />
                <PropRow label="Ellipse" value="O" />
                <PropRow label="Text" value="T" />
                <PropRow label="Line" value="L" />
                <PropRow label="Pen tool" value="P" />
                <PropRow label="Move tool" value="V" />
                <PropRow label="Hand / pan" value="H or Space + drag" />
              </div>

              <SubHeading>Editing</SubHeading>
              <div className="space-y-0">
                <PropRow label="Copy" value="Ctrl + C" />
                <PropRow label="Paste" value="Ctrl + V" />
                <PropRow label="Cut" value="Ctrl + X" />
                <PropRow label="Duplicate" value="Ctrl + D" />
                <PropRow label="Delete" value="Delete / Backspace" />
                <PropRow label="Undo" value="Ctrl + Z" />
                <PropRow label="Redo" value="Ctrl + Shift + Z" />
                <PropRow label="Select all" value="Ctrl + A" />
                <PropRow label="Group" value="Ctrl + G" />
                <PropRow label="Ungroup" value="Ctrl + Shift + G" />
              </div>

              <SubHeading>View</SubHeading>
              <div className="space-y-0">
                <PropRow label="Zoom in" value="Ctrl + =" />
                <PropRow label="Zoom out" value="Ctrl + -" />
                <PropRow label="Zoom to fit" value="Ctrl + 1" />
                <PropRow label="Zoom to 100%" value="Ctrl + 0" />
                <PropRow label="Toggle layers panel" value="Alt + 1" />
                <PropRow label="Toggle design panel" value="Alt + 2" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-white/[0.04] py-8 text-center text-xs text-zinc-600">
        &copy; {new Date().getFullYear()} mint technologies inc. All rights reserved.
      </footer>
    </div>
  );
}
