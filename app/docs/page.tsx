"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import MLogo from "@/app/M.png";
import { 
  Menu, 
  X, 
  LayoutDashboard, 
  GitBranch, 
  Database, 
  Download, 
  Lightbulb, 
  PenTool, 
  Cpu, 
  Box, 
  Server, 
  Repeat, 
  Code, 
  Zap, 
  ArrowRight, 
  AlertTriangle, 
  LogIn,
  TerminalSquare
} from "lucide-react";

export default function DocsPage() {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#f6f4f0] antialiased selection:bg-white/20 selection:text-white">
      {/* ── NAVBAR ── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-white/[0.06] shadow-sm">
        <div className="flex items-center justify-between px-6 lg:px-10 py-4 max-w-[1600px] mx-auto">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-3 group">
              <Image src={MLogo} alt="mint" width={28} height={28} className="rounded-[6px] transition-transform group-hover:scale-110" />
              <span className="text-lg font-semibold tracking-tight">mint <span className="text-white/40 font-normal">Docs</span></span>
            </Link>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden lg:flex items-center gap-4">
              <Link href="/login" className="text-[13px] font-medium text-[#a8a6a2] hover:text-[#f6f4f0] transition-colors">Platform</Link>
              <Link href="/signup" className="text-[13px] font-semibold bg-[#f6f4f0] text-[#0a0a0a] px-4 py-1.5 rounded-full hover:bg-white transition-all">Get Started</Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-[1600px] mx-auto pt-[90px] px-6 lg:px-10 pb-32">
        <style dangerouslySetInnerHTML={{ __html: `
          .docs-wrap {
            --font-sans: inherit;
            --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            --color-background-primary: rgba(255,255,255,0.02);
            --color-background-secondary: rgba(255,255,255,0.04);
            --color-background-info: rgba(59, 130, 246, 0.1);
            --color-background-success: rgba(16, 185, 129, 0.1);
            --color-background-warning: rgba(245, 158, 11, 0.1);
            --color-background-danger: rgba(239, 68, 68, 0.1);
            
            --color-border-primary: rgba(255,255,255,0.2);
            --color-border-secondary: rgba(255,255,255,0.1);
            --color-border-tertiary: rgba(255,255,255,0.05);
            --color-border-info: rgba(59, 130, 246, 0.5);
            
            --color-text-primary: #f6f4f0;
            --color-text-secondary: #a8a6a2;
            --color-text-tertiary: #737373;
            
            --color-text-info: #60a5fa;
            --color-text-success: #34d399;
            --color-text-warning: #fbbf24;
            --color-text-danger: #f87171;
            
            --border-radius-md: 6px;
            --border-radius-lg: 12px;
          }
          
          .docs-wrap * {box-sizing:border-box;margin:0;padding:0}
          .docs-wrap {padding:0 0 2rem; max-width: 800px; margin: 0 auto;}
          .docs-nav {display:flex;gap:6px;flex-wrap:wrap;margin-bottom:32px;padding-bottom:16px;border-bottom:0.5px solid var(--color-border-tertiary)}
          .docs-nav button {font-size:13px;padding:8px 16px;border-radius:var(--border-radius-md);border:0.5px solid var(--color-border-secondary);background:transparent;color:var(--color-text-secondary);cursor:pointer;transition:all .15s; display: flex; align-items: center; gap: 8px;}
          .docs-nav button.active, .docs-nav button:hover {background:var(--color-background-secondary);color:var(--color-text-primary)}
          .docs-nav button.active {border-color:var(--color-border-primary);color:var(--color-text-primary);font-weight:500}
          
          .docs-section {display:none}
          .docs-section.show {display:block}
          
          .docs-wrap h2 {font-size:28px;font-weight:600;margin-bottom:12px;color:var(--color-text-primary)}
          .docs-wrap .sub {font-size:16px;color:var(--color-text-secondary);margin-bottom:28px;line-height:1.6}
          
          .docs-cards {display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-bottom:24px}
          .docs-card {background:var(--color-background-primary);border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);padding:20px}
          .docs-card .icon {color:var(--color-text-info);margin-bottom:12px}
          .docs-card h3 {font-size:16px;font-weight:500;margin-bottom:8px; color: var(--color-text-primary)}
          .docs-card p {font-size:14px;color:var(--color-text-secondary);line-height:1.6}
          
          .docs-steps {counter-reset:s;display:flex;flex-direction:column;gap:0}
          .docs-step {display:flex;gap:16px;padding:20px 0;border-bottom:0.5px solid var(--color-border-tertiary)}
          .docs-step:last-child {border-bottom:none}
          .docs-step-num {counter-increment:s;min-width:30px;height:30px;border-radius:50%;background:var(--color-background-info);color:var(--color-text-info);font-size:14px;font-weight:600;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px}
          .docs-step-num::before {content:counter(s)}
          .docs-step-body h4 {font-size:16px;font-weight:500;margin-bottom:6px; color: var(--color-text-primary)}
          .docs-step-body p {font-size:14px;color:var(--color-text-secondary);line-height:1.6}
          .docs-step-body code {font-family:var(--font-mono);font-size:13px;background:var(--color-background-secondary);border:0.5px solid var(--color-border-tertiary);border-radius:4px;padding:2px 6px; color: var(--color-text-primary)}
          
          .docs-block {background:var(--color-background-secondary);border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-md);padding:16px;margin:12px 0;font-family:var(--font-mono);font-size:13px;line-height:1.7;color:var(--color-text-primary);white-space:pre-wrap;overflow-x:auto}
          
          .docs-tag {display:inline-block;font-size:12px;padding:2px 8px;border-radius:var(--border-radius-md);margin-right:6px;font-weight:500}
          .docs-tag-blue {background:var(--color-background-info);color:var(--color-text-info)}
          .docs-tag-green {background:var(--color-background-success);color:var(--color-text-success)}
          .docs-tag-amber {background:var(--color-background-warning);color:var(--color-text-warning)}
          .docs-tag-red {background:var(--color-background-danger);color:var(--color-text-danger)}
          
          .docs-tip {border-left:3px solid var(--color-border-info);padding:14px 18px;background:var(--color-background-info);border-radius:0 var(--border-radius-md) var(--border-radius-md) 0;margin:16px 0;font-size:14px;line-height:1.6;color:var(--color-text-primary)}
          .docs-tip strong {font-weight:600}
          
          .docs-row2 {display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:16px 0}
          
          .docs-action-card {background:var(--color-background-primary);border:0.5px solid var(--color-border-tertiary);border-radius:var(--border-radius-lg);padding:20px;margin-bottom:16px}
          .docs-action-card .head {display:flex;align-items:center;gap:10px;margin-bottom:12px}
          .docs-action-card .head .docs-tag {margin:0}
          .docs-action-card h4 {font-size:16px;font-weight:500;margin:0; color: var(--color-text-primary)}
          .docs-action-card p {font-size:14px;color:var(--color-text-secondary);margin-bottom:12px;line-height:1.6}
          
          .docs-prop-row {display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:0.5px solid var(--color-border-tertiary);font-size:13px}
          .docs-prop-row:last-child {border:none}
          .docs-prop-key {color:var(--color-text-secondary)}
          .docs-prop-val {font-family:var(--font-mono);font-size:12px;color:var(--color-text-primary)}
          
          .docs-flow-node {background:var(--color-background-primary);border:0.5px solid var(--color-border-secondary);border-radius:var(--border-radius-md);padding:10px 14px;font-size:13px;font-weight:500;display:inline-flex;align-items:center;gap:8px; color: var(--color-text-primary)}
          .docs-flow-row {display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:12px 0}
          .docs-arrow {color:var(--color-text-tertiary);font-size:16px}
          
          @media(max-width:480px) {
            .docs-row2 {grid-template-columns:1fr}
            .docs-nav button {font-size:12px;padding:6px 10px}
          }
        `}} />

        <div className="docs-wrap">
          <div className="docs-nav">
            <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>
              <LayoutDashboard size={16} /> Overview
            </button>
            <button className={activeTab === 'design' ? 'active' : ''} onClick={() => setActiveTab('design')}>
              <PenTool size={16} /> Design
            </button>
            <button className={activeTab === 'runtime' ? 'active' : ''} onClick={() => setActiveTab('runtime')}>
              <Cpu size={16} /> Runtime
            </button>
            <button className={activeTab === 'flows' ? 'active' : ''} onClick={() => setActiveTab('flows')}>
              <GitBranch size={16} /> Flows
            </button>
            <button className={activeTab === 'database' ? 'active' : ''} onClick={() => setActiveTab('database')}>
              <Database size={16} /> Database
            </button>
            <button className={activeTab === 'export' ? 'active' : ''} onClick={() => setActiveTab('export')}>
              <Download size={16} /> Export & Sync
            </button>
            <button className={activeTab === 'tips' ? 'active' : ''} onClick={() => setActiveTab('tips')}>
              <Lightbulb size={16} /> Pro tips
            </button>
          </div>

          {/* OVERVIEW */}
          <div className={`docs-section ${activeTab === 'overview' ? 'show' : ''}`}>
            <h2>What is Mint Web?</h2>
            <p className="sub">A design-to-code platform — draw your UI visually, then Mint generates production-ready full-stack code with a real database and API baked in.</p>
            <div className="docs-cards">
              <div className="docs-card"><div className="icon"><Box size={24}/></div><h3>Visual Canvas</h3><p>Design your UI with a powerful editor. Every element maps directly to real code.</p></div>
              <div className="docs-card"><div className="icon"><Cpu size={24}/></div><h3>Mint Runtime</h3><p>Lightweight engine managing state, actions, and data bindings between UI and backend.</p></div>
              <div className="docs-card"><div className="icon"><Server size={24}/></div><h3>Auto Backend</h3><p>PostgreSQL database and CRUD API endpoints generated instantly for your tables.</p></div>
              <div className="docs-card"><div className="icon"><GitBranch size={24}/></div><h3>Workflows</h3><p>Build complex business logic using a node-based visual flowchart editor — no code needed.</p></div>
              <div className="docs-card"><div className="icon"><Repeat size={24}/></div><h3>Live Sync</h3><p>Push canvas changes to your running app instantly — no rebuild, no redeploy.</p></div>
              <div className="docs-card"><div className="icon"><Code size={24}/></div><h3>Multi-Framework</h3><p>Export to React, Next.js, Vue, Svelte and more. You own the code.</p></div>
            </div>
            <div className="docs-tip"><strong>Mental model:</strong> Think of Mint as three layers — the Canvas (what the user sees), the Runtime (the logic layer), and the Backend (data). All three stay in sync automatically.</div>
          </div>

          {/* DESIGN */}
          <div className={`docs-section ${activeTab === 'design' ? 'show' : ''}`}>
            <h2>Design phase</h2>
            <p className="sub">Everything starts on the canvas. Each Frame becomes a route in your app. Properties set in the sidebar map 1-to-1 with CSS/layout rules.</p>
            <div className="docs-steps">
              <div className="docs-step"><div className="docs-step-num"></div><div className="docs-step-body"><h4>Create a project</h4><p>Dashboard → <code>New Project</code> → choose a template or blank canvas → set project name → pick target framework (e.g. Next.js).</p></div></div>
              <div className="docs-step"><div className="docs-step-num"></div><div className="docs-step-body"><h4>Add frames (screens)</h4><p>Press <code>F</code> and draw a frame. Each frame = one route in your app. Name them clearly: <code>Home</code>, <code>Login</code>, <code>Dashboard</code>. Frames can be nested to create reusable layout components.</p></div></div>
              <div className="docs-step"><div className="docs-step-num"></div><div className="docs-step-body"><h4>Style with the right sidebar</h4><p>Select any element to access its design properties:</p></div></div>
            </div>
            <div className="docs-row2" style={{marginTop:'8px'}}>
              <div className="docs-card"><h3 style={{marginBottom:'10px'}}>Layout</h3>
                <div className="docs-prop-row"><span className="docs-prop-key">Direction</span><span className="docs-prop-val">row / column</span></div>
                <div className="docs-prop-row"><span className="docs-prop-key">Align</span><span className="docs-prop-val">flex-start … center</span></div>
                <div className="docs-prop-row"><span className="docs-prop-key">Justify</span><span className="docs-prop-val">space-between …</span></div>
                <div className="docs-prop-row"><span className="docs-prop-key">Gap</span><span className="docs-prop-val">px or %</span></div>
                <div className="docs-prop-row"><span className="docs-prop-key">Mode</span><span className="docs-prop-val">Flexbox / Grid</span></div>
              </div>
              <div className="docs-card"><h3 style={{marginBottom:'10px'}}>Visuals & type</h3>
                <div className="docs-prop-row"><span className="docs-prop-key">Background</span><span className="docs-prop-val">solid / gradient</span></div>
                <div className="docs-prop-row"><span className="docs-prop-key">Border radius</span><span className="docs-prop-val">px</span></div>
                <div className="docs-prop-row"><span className="docs-prop-key">Shadow / Blur</span><span className="docs-prop-val">effects panel</span></div>
                <div className="docs-prop-row"><span className="docs-prop-key">Font family</span><span className="docs-prop-val">any Google font</span></div>
                <div className="docs-prop-row"><span className="docs-prop-key">Weight / Size</span><span className="docs-prop-val">full control</span></div>
              </div>
            </div>
            <div className="docs-tip"><strong>Key insight:</strong> Frames are routes, not just boxes. The frame name becomes the URL path. Nesting a frame inside another frame means that inner route renders inside the outer layout — like nested routes in Next.js.</div>
          </div>

          {/* RUNTIME */}
          <div className={`docs-section ${activeTab === 'runtime' ? 'show' : ''}`}>
            <h2>Mint Runtime — state, bindings & actions</h2>
            <p className="sub">The Runtime is the brain of your app. It holds data in State, connects that data to UI elements via Bindings, and runs logic via Actions triggered by events.</p>

            <h3 style={{fontSize:'18px',fontWeight:500,marginBottom:'12px',color:'var(--color-text-primary)'}}>State management</h3>
            <div className="docs-row2">
              <div className="docs-card"><h3 style={{marginBottom:'8px'}}><span className="docs-tag docs-tag-blue">Global</span></h3><p>Accessible from any screen. Use for data that persists across routes — e.g. <code>currentUser</code>, auth tokens. Enable <strong>Persist</strong> to write to <code>localStorage</code> automatically.</p></div>
              <div className="docs-card"><h3 style={{marginBottom:'8px'}}><span className="docs-tag docs-tag-green">Local</span></h3><p>Scoped to a single frame/component. Use for UI-only state like <code>isLoading</code>, <code>modalOpen</code>, form field values. Destroyed when the frame unmounts.</p></div>
            </div>

            <h3 style={{fontSize:'18px',fontWeight:500,margin:'28px 0 12px',color:'var(--color-text-primary)'}}>Data bindings</h3>
            <div className="docs-steps">
              <div className="docs-step"><div className="docs-step-num"></div><div className="docs-step-body"><h4>Select a component</h4><p>Click any element (e.g. a Text box or a Button label).</p></div></div>
              <div className="docs-step"><div className="docs-step-num"></div><div className="docs-step-body"><h4>Open Bindings panel</h4><p>Click the link icon next to the property you want to connect (e.g. "Content", "Color", "Visible").</p></div></div>
              <div className="docs-step"><div className="docs-step-num"></div><div className="docs-step-body"><h4>Enter an expression</h4><p>Use <code>$global.userName</code> for global state or <code>$local.count</code> for local state. Full expressions work: <code>$local.itemCount &gt; 0 ? 'Items' : 'Empty'</code></p></div></div>
            </div>

            <h3 style={{fontSize:'18px',fontWeight:500,margin:'28px 0 12px',color:'var(--color-text-primary)'}}>Actions — the four types</h3>

            <div className="docs-action-card">
              <div className="head"><span className="docs-tag docs-tag-blue">setState</span><h4>Update state data</h4></div>
              <p>Writes a value to a specific path in your state tree. <code>$args.0</code> means "the first argument passed when this action was called".</p>
              <div className="docs-block">{`{
  "path": "todos",
  "value": "$args.0",
  "also": "SET $lastUpdated = now()"
}`}</div>
              <div className="docs-tip" style={{marginTop:'8px'}}><strong>also</strong> lets you update a second state variable in the same action — useful for timestamps or counters.</div>
            </div>

            <div className="docs-action-card">
              <div className="head"><span className="docs-tag docs-tag-green">fetch</span><h4>HTTP requests & DB queries</h4></div>
              <p>Calls an API endpoint. <code>storePath</code> automatically saves the response into that state key, so you don't need a separate <code>setState</code> afterwards.</p>
              <div className="docs-block">{`{
  "url": "/api/todos",
  "method": "POST",
  "headers": { "Content-Type": "application/json" },
  "body": { "title": "$args.0", "status": "pending" },
  "storePath": "todos",
  "onSuccess": "CALL loadTodos; TOAST 'Saved!'"
}`}</div>
              <div className="docs-tip" style={{marginTop:'8px'}}><strong>onSuccess</strong> chains multiple actions with semicolons. <code>TOAST</code> shows a notification; <code>CALL</code> runs another named action.</div>
            </div>

            <div className="docs-action-card">
              <div className="head"><span className="docs-tag docs-tag-amber">navigate</span><h4>Change screens</h4></div>
              <p>Pushes a new route. Pass dynamic <code>params</code> to send data to the destination screen — access them there via <code>$route.params.userId</code>.</p>
              <div className="docs-block">{`{
  "route": "/dashboard",
  "params": { "userId": "$global.user.id" }
}`}</div>
            </div>

            <div className="docs-action-card">
              <div className="head"><span className="docs-tag docs-tag-red">condition</span><h4>Branching logic</h4></div>
              <p>Evaluates an expression and runs a different action list depending on the result. Each entry in <code>then</code> / <code>else</code> is a command string.</p>
              <div className="docs-block">{`{
  "expression": "$global.isLoggedIn",
  "then": ["CALL goToDashboard"],
  "else": ["OPEN_MODAL 'LoginModal'"]
}`}</div>
            </div>
          </div>

          {/* FLOWS */}
          <div className={`docs-section ${activeTab === 'flows' ? 'show' : ''}`}>
            <h2>Workflows (Flows)</h2>
            <p className="sub">When action JSON strings get complex, switch to Flows — a visual node-based editor that lets you design multi-step logic as a flowchart.</p>

            <div className="docs-steps">
              <div className="docs-step"><div className="docs-step-num"></div><div className="docs-step-body"><h4>Open the Workflows tab</h4><p>Click the <code>Workflows</code> tab in the left sidebar of the editor.</p></div></div>
              <div className="docs-step"><div className="docs-step-num"></div><div className="docs-step-body"><h4>Add a workflow</h4><p>Click <code>Add Workflow</code>, give it a name. This workflow can then be called from any action using <code>CALL myWorkflowName</code>.</p></div></div>
              <div className="docs-step"><div className="docs-step-num"></div><div className="docs-step-body"><h4>Add nodes</h4><p>Three categories of nodes are available:</p>
                <div style={{display:'flex',flexWrap:'wrap',gap:'8px',marginTop:'10px'}}>
                  <span className="docs-tag docs-tag-blue">Logic: Condition, Loop, Delay</span>
                  <span className="docs-tag docs-tag-green">Backend: API Call, DB Query</span>
                  <span className="docs-tag docs-tag-amber">UI: Navigate, Show Modal</span>
                </div>
              </div></div>
              <div className="docs-step"><div className="docs-step-num"></div><div className="docs-step-body"><h4>Connect with edges</h4><p>Draw arrows between nodes to set the execution order. Click any arrow to add a conditional expression on it, e.g. <code>{`{{\${_node_1_output.success}}}`}</code> — the path only executes if the condition is truthy.</p></div></div>
            </div>

            <div className="docs-tip"><strong>When to use Flows vs Actions:</strong> Use action JSON for simple, single-step logic. Switch to Flows when you need branching, loops, or chaining more than 3 steps — the visual graph is much easier to debug.</div>

            <div style={{marginTop:'32px'}}>
              <p style={{fontSize:'16px',fontWeight:500,marginBottom:'16px',color:'var(--color-text-primary)'}}>Example flow: user login</p>
              <div className="docs-flow-row">
                <div className="docs-flow-node"><LogIn size={16} /> Form submit</div>
                <span className="docs-arrow">→</span>
                <div className="docs-flow-node"><Server size={16} /> API Call: POST /auth</div>
                <span className="docs-arrow">→</span>
                <div className="docs-flow-node"><GitBranch size={16} /> Condition: success?</div>
              </div>
              <div className="docs-flow-row" style={{marginLeft:'32px'}}>
                <span className="docs-tag docs-tag-green">true →</span>
                <div className="docs-flow-node"><ArrowRight size={16} /> Navigate /dashboard</div>
              </div>
              <div className="docs-flow-row" style={{marginLeft:'32px'}}>
                <span className="docs-tag docs-tag-red">false →</span>
                <div className="docs-flow-node"><AlertTriangle size={16} /> Show Modal: Error</div>
              </div>
            </div>
          </div>

          {/* DATABASE */}
          <div className={`docs-section ${activeTab === 'database' ? 'show' : ''}`}>
            <h2>Database & backend</h2>
            <p className="sub">Mint provisions a real PostgreSQL database for your project automatically. You define tables in a UI, Mint generates the CRUD API routes. No backend code needed.</p>

            <div className="docs-steps">
              <div className="docs-step"><div className="docs-step-num"></div><div className="docs-step-body"><h4>Enable the database</h4><p>Go to the <code>Database</code> tab → click <code>Enable Database</code>. Mint provisions a PostgreSQL instance scoped to your project.</p></div></div>
              <div className="docs-step"><div className="docs-step-num"></div><div className="docs-step-body"><h4>Create a table</h4><p>Click <code>New Table</code>. Define each column with a name, type, and optional constraints.</p>
                <div style={{marginTop:'12px'}}>
                  <div className="docs-prop-row"><span className="docs-prop-key">UUID</span><span className="docs-prop-val">id — primary key, auto-generated</span></div>
                  <div className="docs-prop-row"><span className="docs-prop-key">Text</span><span className="docs-prop-val">title, description, email…</span></div>
                  <div className="docs-prop-row"><span className="docs-prop-key">Boolean</span><span className="docs-prop-val">completed, isActive…</span></div>
                  <div className="docs-prop-row"><span className="docs-prop-key">Timestamp</span><span className="docs-prop-val">createdAt, updatedAt…</span></div>
                </div>
              </div></div>
              <div className="docs-step"><div className="docs-step-num"></div><div className="docs-step-body"><h4>Set relations</h4><p>Click the <code>Relations</code> tab on any table. Define <code>one-to-many</code> (e.g. a user has many todos) or <code>many-to-many</code> (e.g. posts ↔ tags). Mint generates the join table and foreign keys for you.</p></div></div>
              <div className="docs-step"><div className="docs-step-num"></div><div className="docs-step-body"><h4>Set Row Level Security (RLS)</h4><p>Under <code>Policies</code>, add rules to control who can read or write each row. Example policy for "user can only see their own rows":</p>
                <div className="docs-block">auth.uid() = user_id</div>
                <p style={{fontSize:'14px',color:'var(--color-text-secondary)',marginTop:'8px'}}>Mint applies this as a PostgreSQL RLS policy automatically — no SQL migration files needed.</p>
              </div></div>
            </div>

            <div className="docs-tip"><strong>Accessing data:</strong> Once your table exists, call it from a <code>fetch</code> action using <code>/api/todos</code> (Mint maps table names to route paths). Use the <code>storePath</code> field to auto-save the result into state. For raw SQL queries, use a <code>DB Query</code> node in a Workflow — just write the table name as defined; namespacing is handled for you.</div>
          </div>

          {/* EXPORT */}
          <div className={`docs-section ${activeTab === 'export' ? 'show' : ''}`}>
            <h2>Export, convert & live sync</h2>
            <p className="sub">When your design is ready, Mint compiles it into real source code. You can download it, push it to GitHub, or pull it with the CLI — and keep the canvas and running app in sync.</p>

            <h3 style={{fontSize:'18px',fontWeight:500,marginBottom:'12px',color:'var(--color-text-primary)'}}>How conversion works</h3>
            <div className="docs-steps">
              <div className="docs-step"><div className="docs-step-num"></div><div className="docs-step-body"><h4>Click Export</h4><p>The <code>Export</code> button is in the top header. Mint "flattens" your canvas design tree into optimized component code.</p></div></div>
              <div className="docs-step"><div className="docs-step-num"></div><div className="docs-step-body"><h4>What gets generated</h4><p>Mint outputs: a <code>MintProvider</code> wrapper component (handles the runtime), all your UI components with correct props, backend API routes for each table, and a config file.</p></div></div>
            </div>

            <h3 style={{fontSize:'18px',fontWeight:500,margin:'28px 0 12px',color:'var(--color-text-primary)'}}>How to extract your code</h3>
            <div className="docs-row2">
              <div className="docs-card"><Download size={24} style={{color:'var(--color-text-info)',marginBottom:'12px'}} /><h3>Download ZIP</h3><p>Get the full source code as a ZIP. Unzip and run — it's a complete project in your chosen framework.</p></div>
              <div className="docs-card"><Code size={24} style={{color:'var(--color-text-info)',marginBottom:'12px'}} /><h3>Push to GitHub</h3><p>Connect your GitHub repo in settings. Mint pushes changes directly on each export.</p></div>
            </div>
            <div className="docs-card" style={{marginBottom:'24px'}}>
              <TerminalSquare size={24} style={{color:'var(--color-text-info)',marginBottom:'12px'}} />
              <h3 style={{marginBottom:'6px'}}>CLI — npx mint-cli pull</h3>
              <p style={{fontSize:'14px',color:'var(--color-text-secondary)'}}>Run in an existing project to pull the latest canvas state as code. Useful for teams where designers work in Mint and developers own the repo.</p>
              <div className="docs-block">npx mint-cli pull</div>
            </div>

            <h3 style={{fontSize:'18px',fontWeight:500,margin:'28px 0 12px',color:'var(--color-text-primary)'}}>Live Sync — update without rebuilding</h3>
            <div className="docs-steps">
              <div className="docs-step"><div className="docs-step-num"></div><div className="docs-step-body"><h4>Make a canvas change</h4><p>Change anything — a button color, a font size, a layout. These are "design-layer" changes Mint can push without recompiling logic.</p></div></div>
              <div className="docs-step"><div className="docs-step-num"></div><div className="docs-step-body"><h4>Click "Commit Changes"</h4><p>In the editor header. Mint publishes a new version manifest.</p></div></div>
              <div className="docs-step"><div className="docs-step-num"></div><div className="docs-step-body"><h4>Sync Daemon picks it up</h4><p>Your running app (with the Sync Daemon enabled) polls <code>/api/sync</code> and detects the new version. It hot-patches the UI — no page reload.</p></div></div>
            </div>
            <div className="docs-tip"><strong>How Sync Daemon works under the hood:</strong> The Daemon is a lightweight service worker embedded by <code>MintProvider</code>. It polls <code>/api/sync</code> every few seconds. When the version hash changes, it fetches the updated component definitions and re-renders only the affected parts of the tree — similar to React Fast Refresh but driven from the cloud canvas.</div>
          </div>

          {/* TIPS */}
          <div className={`docs-section ${activeTab === 'tips' ? 'show' : ''}`}>
            <h2>Pro tips for building in Mint</h2>
            <p className="sub">Things that will save you time once you know them.</p>
            <div className="docs-steps">
              <div className="docs-step"><div className="docs-step-num"></div><div className="docs-step-body"><h4>Use <code>$</code> everywhere in expressions</h4><p>Any binding or action field accepts a <code>$</code> expression. <code>$global.user.name</code>, <code>$local.count + 1</code>, <code>$route.params.id</code> — all work. Ternary expressions like <code>$local.error ? 'red' : 'inherit'</code> are valid for color bindings.</p></div></div>
              <div className="docs-step"><div className="docs-step-num"></div><div className="docs-step-body"><h4>Don't prefix table names in raw SQL</h4><p>The Runtime handles namespacing. If your table is named <code>todos</code>, write <code>SELECT * FROM todos</code> — not a prefixed internal name. Mint resolves it for you.</p></div></div>
              <div className="docs-step"><div className="docs-step-num"></div><div className="docs-step-body"><h4>Use the browser console for debugging</h4><p>The Mint Runtime logs every action execution and state change to the browser console. Open DevTools → Console and watch state mutations in real time as you interact with your app.</p></div></div>
              <div className="docs-step"><div className="docs-step-num"></div><div className="docs-step-body"><h4>Persist global state for auth</h4><p>For anything auth-related — user object, token, role — enable the <code>Persist</code> flag on your global state. It writes to <code>localStorage</code> automatically, so your user stays logged in on refresh.</p></div></div>
              <div className="docs-step"><div className="docs-step-num"></div><div className="docs-step-body"><h4>Chain actions with semicolons in onSuccess</h4><p>The <code>onSuccess</code> field in a <code>fetch</code> action runs a sequence. Use semicolons to chain: <code>CALL loadTodos; TOAST 'Done!'; CALL resetForm</code> — they run in order, left to right.</p></div></div>
              <div className="docs-step"><div className="docs-step-num"></div><div className="docs-step-body"><h4>Use Flows for anything with branching</h4><p>If your logic has an if/else or needs to loop, build it as a Flow instead of nesting <code>condition</code> actions. Flows are visual, debuggable, and much easier for teammates to understand.</p></div></div>
              <div className="docs-step"><div className="docs-step-num"></div><div className="docs-step-body"><h4>Name frames after your routes</h4><p>The frame name becomes the URL. <code>UserProfile</code> → <code>/user-profile</code>. Be intentional with naming from the start — renaming frames later can break navigation actions that hardcode the route string.</p></div></div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
