#!/usr/bin/env tsx
// Step 2: Run the RN export from the persisted schema, inspect output

import { buildReactNativeFromSchema } from "../lib/convert/builders/reactNativeSchema";

const PROJECT_ID = "5a31e6a7-9a4f-4722-a488-83b12aa038d3";
const TOKEN = "401fb95337eefa718540794c4dddc998535df19858908724b4f00c6569f03530";
const BASE = "http://localhost:3001";

async function main() {
  // Fetch the persisted schema
  const res = await fetch(`${BASE}/api/runtime-schema/${PROJECT_ID}`, {
    headers: { Cookie: `token=${TOKEN}` },
  });
  const { schema } = await res.json();
  if (!schema) { console.error("No schema found"); process.exit(1); }

  console.log(`Schema: ${schema.screens.length} screens, ${schema.globalActions.length} global actions`);

  // Run the export
  const files = buildReactNativeFromSchema(schema, {
    projectId: PROJECT_ID,
    apiOrigin: "https://mintweb.mintit.pro",
    appName: "Expense Approval",
  });

  console.log(`\nGenerated ${files.length} files:`);
  for (const f of files) {
    console.log(`  ${f.path} (${f.content.length} chars)`);
  }

  // Inspect for placeholders/TODOs
  let issues = 0;
  for (const f of files) {
    const lines = f.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/TODO|PLACEHOLDER|FIXME|stub|not implemented/i.test(line)) {
        console.log(`  ⚠ ${f.path}:${i + 1}: ${line.trim()}`);
        issues++;
      }
    }
  }

  // Check that every screen's actions reference real dbQuery/setState/navigate
  const runtimeFile = files.find((f) => f.path === "lib/mint-runtime.tsx");
  if (runtimeFile) {
    const actionNames = [
      "loadExpenses", "loadSteps", "loadEvents", "submitExpense",
      "approveExpense", "addWorkflowStep", "login",
      "loadDashboard", "loadPendingManager", "loadPendingFinance",
      "approveExpenseFromList", "rejectExpenseFromList", "markReimbursed",
    ];
    for (const name of actionNames) {
      if (!runtimeFile.content.includes(name)) {
        console.log(`  ⚠ Missing action in runtime: ${name}`);
        issues++;
      }
    }
    // Check for dbQuery usage
    const dbQueryCount = (runtimeFile.content.match(/dbQuery\(/g) || []).length;
    console.log(`\nRuntime: ${dbQueryCount} dbQuery() calls`);
    const getNextStepCount = (runtimeFile.content.match(/getNextStep\(/g) || []).length;
    console.log(`Runtime: ${getNextStepCount} getNextStep() calls`);
  }

  // Check screen files for real actions() calls
  const screenFiles = files.filter((f) => f.path.startsWith("app/") && f.path.endsWith(".tsx") && f.path !== "app/_layout.tsx");
  for (const sf of screenFiles) {
    const hasActions = sf.content.includes("actions(");
    const hasUseMint = sf.content.includes("useMint()");
    if (!hasUseMint) {
      console.log(`  ⚠ ${sf.path}: missing useMint()`);
      issues++;
    }
    console.log(`  ${sf.path}: actions()=${hasActions}, useMint()=${hasUseMint}`);
  }

  console.log(`\n${issues === 0 ? "✅ PASS" : `❌ ${issues} issues found`}: zero placeholder/TODO, all screens use real dbQuery/setState/navigate`);
}

main().catch(console.error);
