// ═══════════════════════════════════════════════════════════════
// Live Sync Files — Generates the connector, the_god, and
// default home page for converted projects.
//
// When the user hits "Convert", these files are injected into
// the ZIP alongside the framework scaffold:
//
//   1. Default home page — black screen with instructions
//   2. mint-connector.mjs — polls /api/project-data for updates
//   3. mint-the-god.mjs  — writes received files to disk
// ═══════════════════════════════════════════════════════════════

import type { GeneratedFile, ConversionOptions } from "./types";

/**
 * Generate the three live-sync files to include in the converted project.
 */
export function generateLiveSyncFiles(
  options: ConversionOptions
): GeneratedFile[] {
  const fileKey = options.fileKey || "unknown";
  const projectId = options.projectId || fileKey;
  const userId = options.userId || "unknown";
  // The editor runs on NEXT_PUBLIC_APP_URL or defaults to the vercel URL
  const editorOrigin = process.env.NEXT_PUBLIC_APP_URL || "https://mintweb2.vercel.app";

  // ─── 1. Default Home Page ──────────────────────────────────
  const homePage = generateHomePage();

  // ─── 2. Connector ──────────────────────────────────────────
  const connector = generateConnector(editorOrigin, projectId, userId);

  // ─── 3. The God ────────────────────────────────────────────
  const theGod = generateTheGod();

  // ─── 4. Config file ────────────────────────────────────────
  const configFile = generateConfig(editorOrigin, projectId, userId);

  return [homePage, connector, theGod, configFile];
}

/**
 * Patch a package.json string to add the sync/connector scripts
 * and auto-start the connector alongside the dev server.
 */
export function patchPackageJsonForSync(
  packageJsonContent: string
): string {
  try {
    const pkg = JSON.parse(packageJsonContent);

    if (!pkg.scripts) pkg.scripts = {};

    // Keep standalone sync command
    pkg.scripts.sync = "node mint-connector.mjs";

    // Auto-start connector alongside dev server so commits
    // are picked up automatically without running sync separately.
    // Compound dev script that starts both.
    if (pkg.scripts.dev && !pkg.scripts["dev:app"]) {
      pkg.scripts["dev:app"] = pkg.scripts.dev;
      pkg.scripts.dev = "node mint-connector.mjs & npm run dev:app";
    } else if (pkg.scripts.start && !pkg.scripts["start:app"]) {
      pkg.scripts["start:app"] = pkg.scripts.start;
      pkg.scripts.start = "node mint-connector.mjs & npm run start:app";
    }

    return JSON.stringify(pkg, null, 2);
  } catch {
    return packageJsonContent;
  }
}

// ═══════════════════════════════════════════════════════════════
// File Generators
// ═══════════════════════════════════════════════════════════════

function generateHomePage(): GeneratedFile {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mint — Getting Started</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      background: #000;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    .container {
      text-align: center;
      max-width: 560px;
      padding: 2rem;
      animation: fadeIn 0.8s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .logo {
      font-size: 2.5rem;
      font-weight: 700;
      background: linear-gradient(135deg, #818cf8, #6366f1, #4f46e5);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 1.5rem;
      letter-spacing: -0.02em;
    }

    h1 {
      font-size: 1.5rem;
      font-weight: 600;
      color: #e4e4e7;
      margin-bottom: 1rem;
      line-height: 1.4;
    }

    .instructions {
      color: #a1a1aa;
      font-size: 0.95rem;
      line-height: 1.7;
      margin-bottom: 2rem;
    }

    .step {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      text-align: left;
      margin-bottom: 1rem;
      padding: 0.75rem 1rem;
      border-radius: 0.75rem;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
    }

    .step-number {
      flex-shrink: 0;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #4f46e5;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 700;
      margin-top: 2px;
    }

    .step-text {
      color: #d4d4d8;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    .step-text code {
      background: rgba(99, 102, 241, 0.15);
      color: #818cf8;
      padding: 0.15em 0.4em;
      border-radius: 4px;
      font-size: 0.8rem;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
    }

    .status {
      margin-top: 1.5rem;
      padding: 0.75rem 1.25rem;
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }

    .status.waiting {
      background: rgba(251, 191, 36, 0.1);
      border: 1px solid rgba(251, 191, 36, 0.2);
      color: #fbbf24;
    }

    .pulse {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #fbbf24;
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50%      { opacity: 0.4; }
    }

    .footer {
      position: fixed;
      bottom: 1.5rem;
      color: #52525b;
      font-size: 0.75rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">▲ Mint</div>
    <h1>Your project is ready!</h1>

    <div class="instructions">
      <div class="step">
        <div class="step-number">1</div>
        <div class="step-text">
          Open the <strong>Mint editor</strong> and make your design changes.
        </div>
      </div>
      <div class="step">
        <div class="step-number">2</div>
        <div class="step-text">
          Click the <strong>Commit</strong> button in the editor toolbar to push your design as code.
        </div>
      </div>
      <div class="step">
        <div class="step-number">3</div>
        <div class="step-text">
          Run <code>npm run sync</code> in this project to start the live sync daemon. Your website will update automatically!
        </div>
      </div>
    </div>

    <div class="status waiting">
      <span class="pulse"></span>
      Waiting for first commit…
    </div>
  </div>

  <div class="footer">Powered by Mint</div>
</body>
</html>`;

  return {
    path: "public/mint-welcome.html",
    content: html,
    type: "text",
  };
}

function generateConnector(
  editorOrigin: string,
  projectId: string,
  userId: string
): GeneratedFile {
  const script = `#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
// Mint Connector — Fetches project data from the Mint server
//
// Usage: node mint-connector.mjs
//    or: npm run sync
//
// This script polls the Mint editor's project-data API every
// 2 seconds. When a new commit is detected, it passes the JSON
// data to the_god which writes the code files to disk.
// Your dev server's HMR picks up the changes automatically.
// ═══════════════════════════════════════════════════════════════

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Load config ───────────────────────────────────────────────
let config = {
  editorOrigin: "${editorOrigin}",
  projectId: "${projectId}",
  userId: "${userId}",
  pollInterval: 2000,
};

try {
  const configPath = path.join(__dirname, "mint-sync.config.json");
  if (fs.existsSync(configPath)) {
    const userConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    config = { ...config, ...userConfig };
  }
} catch (e) {
  // Use defaults
}

// ── Import the_god ────────────────────────────────────────────
let theGod;
try {
  theGod = await import("./mint-the-god.mjs");
} catch (e) {
  console.error("❌ Failed to import mint-the-god.mjs:", e.message);
  process.exit(1);
}

// ── Terminal colors ───────────────────────────────────────────
const c = {
  reset: "\\x1b[0m",
  green: "\\x1b[32m",
  yellow: "\\x1b[33m",
  blue: "\\x1b[34m",
  magenta: "\\x1b[35m",
  cyan: "\\x1b[36m",
  red: "\\x1b[31m",
  dim: "\\x1b[2m",
  bold: "\\x1b[1m",
};

function log(msg, color = c.blue) {
  const time = new Date().toLocaleTimeString();
  console.log(\`\${c.dim}\${time}\${c.reset} \${color}◆\${c.reset} \${msg}\`);
}

// ── State ─────────────────────────────────────────────────────
let lastVersion = 0;
let isPolling = false;
let consecutiveErrors = 0;

// ── Poll function ─────────────────────────────────────────────
async function poll() {
  if (isPolling) return;
  isPolling = true;

  try {
    const url = \`\${config.editorOrigin}/api/project-data/\${config.projectId}?since=\${lastVersion}&user_id=\${config.userId}\`;
    const res = await fetch(url);

    if (res.status === 204) {
      // No new version
      consecutiveErrors = 0;
      isPolling = false;
      return;
    }

    if (!res.ok) {
      throw new Error(\`HTTP \${res.status}: \${res.statusText}\`);
    }

    const data = await res.json();
    consecutiveErrors = 0;

    if (!data.files || data.files.length === 0) {
      isPolling = false;
      return;
    }

    const version = data.version || lastVersion + 1;
    log(\`\${c.bold}New commit v\${version}\${c.reset} — \${data.framework || "?"} — \${data.files.length} file(s)\`, c.magenta);

    // Pass the data to the_god to write files
    const result = theGod.processProjectData(data, __dirname);

    lastVersion = version;

    console.log(\`         \${c.green}✓\${c.reset} \${result.written} file(s) written\${result.skipped > 0 ? \`, \${result.skipped} skipped\` : ""}\`);
    console.log(\`         \${c.dim}HMR should pick up changes automatically.\${c.reset}\`);
    console.log("");

  } catch (err) {
    consecutiveErrors++;
    if (consecutiveErrors <= 3) {
      log(\`Connection error: \${err.message} (retry \${consecutiveErrors}/3)\`, c.yellow);
    } else if (consecutiveErrors === 4) {
      log(\`Cannot reach editor at \${config.editorOrigin}. Is it running? Retrying silently...\`, c.red);
    }
  } finally {
    isPolling = false;
  }
}

// ── Main ──────────────────────────────────────────────────────
console.log("");
console.log(\`  \${c.bold}\${c.magenta}▲ Mint Connector\${c.reset}\`);
console.log(\`  \${c.dim}Project: \${config.projectId}\${c.reset}\`);
console.log(\`  \${c.dim}Polling: \${config.editorOrigin}/api/project-data/\${config.projectId}\${c.reset}\`);
console.log(\`  \${c.dim}Interval: \${config.pollInterval}ms\${c.reset}\`);
console.log("");

// Fetch the current latest version first (so we don't re-apply old commits)
try {
  const url = \`\${config.editorOrigin}/api/project-data/\${config.projectId}\`;
  const res = await fetch(url);
  if (res.ok) {
    const data = await res.json();
    if (data.version) {
      lastVersion = data.version;
      log(\`Starting from version v\${lastVersion}. Waiting for new commits...\`, c.green);
    } else {
      log("No previous commits found. Waiting for first commit...", c.green);
    }
  }
} catch (e) {
  log(\`Could not reach editor at \${config.editorOrigin}. Will retry...\`, c.yellow);
}

log(\`\${c.dim}Keep this running alongside your dev server.\${c.reset}\`, c.dim);
console.log("");

// Start polling
setInterval(poll, config.pollInterval);

// Graceful shutdown
process.on("SIGINT", () => {
  log("Shutting down...", c.dim);
  process.exit(0);
});
process.on("SIGTERM", () => process.exit(0));
`;

  return {
    path: "mint-connector.mjs",
    content: script,
    type: "text",
  };
}

function generateTheGod(): GeneratedFile {
  const script = `// ═══════════════════════════════════════════════════════════════
// Mint the_god — Receives project JSON and writes code files
//
// This module is imported by the connector. When a new commit
// arrives, the connector calls processProjectData() with the
// JSON response from the server. the_god then writes each file
// to the correct location on disk.
//
// Example: route "/" writes code to "src/App.tsx", etc.
// ═══════════════════════════════════════════════════════════════

import fs from "fs";
import path from "path";

// ── Terminal colors ───────────────────────────────────────────
const c = {
  reset: "\\x1b[0m",
  green: "\\x1b[32m",
  yellow: "\\x1b[33m",
  dim: "\\x1b[2m",
  red: "\\x1b[31m",
};

// ── Protected files that should NEVER be overwritten ──────────
const PROTECTED_FILES = new Set([
  "mint-connector.mjs",
  "mint-the-god.mjs",
  "mint-sync.config.json",
  "package.json",
  "package-lock.json",
  "node_modules",
  ".gitignore",
  ".env",
  ".env.local",
]);

function isProtected(filePath) {
  const basename = path.basename(filePath);
  return PROTECTED_FILES.has(basename) || filePath.startsWith("node_modules/");
}

/**
 * Process the project data JSON received from the Mint server.
 * Writes each file to disk, creating directories as needed.
 *
 * @param {Object} data — The JSON response from /api/project-data
 *   @param {Array} data.files — Array of { path, content, type }
 *   @param {string} data.framework — Target framework (react, nextjs, etc.)
 *   @param {number} data.version — Commit version number
 * @param {string} rootDir — The project root directory to write files to
 * @returns {{ written: number, skipped: number }}
 */
export function processProjectData(data, rootDir) {
  const files = data.files || [];
  let written = 0;
  let skipped = 0;

  for (const file of files) {
    // Validate file entry
    if (!file.path || file.content === undefined || file.content === null) {
      skipped++;
      continue;
    }

    // Skip protected files
    if (isProtected(file.path)) {
      skipped++;
      continue;
    }

    try {
      const filePath = path.join(rootDir, file.path);
      const dir = path.dirname(filePath);

      // Create nested directories if needed
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write the file
      fs.writeFileSync(filePath, file.content, "utf-8");
      console.log(\`         ✏️  \${c.dim}\${file.path}\${c.reset}\`);
      written++;
    } catch (err) {
      console.log(\`         ⚠️  \${c.yellow}Failed:\${c.reset} \${file.path} — \${err.message}\`);
      skipped++;
    }
  }

  return { written, skipped };
}
`;

  return {
    path: "mint-the-god.mjs",
    content: script,
    type: "text",
  };
}

function generateConfig(
  editorOrigin: string,
  projectId: string,
  userId: string
): GeneratedFile {
  const config = JSON.stringify(
    {
      editorOrigin,
      projectId,
      userId,
      pollInterval: 2000,
    },
    null,
    2
  );

  return {
    path: "mint-sync.config.json",
    content: config,
    type: "text",
  };
}
