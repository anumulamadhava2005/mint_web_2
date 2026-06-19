// ═══════════════════════════════════════════════════════════════
// Render-dispatch test — push a real ComponentSchema tree (with a
// "dataTable") through the actual SchemaRenderer dispatch and confirm
// a <table> with bound data actually comes out. NOT the standalone
// component — this goes through type-switch + BindingEngine resolution.
// ═══════════════════════════════════════════════════════════════

import React from "react";
import { renderToString } from "react-dom/server";
import SchemaRenderer from "../components/SchemaRenderer";
import { StateEngine } from "../lib/runtime/state";
import type { ComponentSchema } from "../lib/runtime/schema";

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.log(`  ✗ ${msg}`);
    failed++;
  } else {
    console.log(`  ✓ ${msg}`);
  }
}

// Seed state so the dataTable's "$local.expenses" dataSource resolves.
const state = new StateEngine();
state.set("local.expenses", [
  { id: 1, description: "Office supplies", amount: 150, status: "approved" },
  { id: 2, description: "Travel", amount: 500, status: "pending_manager" },
]);

const schema: ComponentSchema[] = [
  {
    id: "screen-root",
    type: "view",
    props: {},
    bindings: {},
    style: {},
    children: [
      {
        id: "dt-1",
        type: "dataTable",
        props: {
          columns: [
            { key: "id", label: "ID", type: "number" },
            { key: "description", label: "Description" },
            { key: "amount", label: "Amount", type: "currency" },
            { key: "status", label: "Status", type: "status" },
          ],
          dataSource: "$local.expenses",
          searchable: true,
        },
        bindings: {},
        style: {},
      },
    ],
  },
];

console.log("── SchemaRenderer dispatch: dataTable ──");
const html = renderToString(React.createElement(SchemaRenderer, { components: schema, state }));

assert(html.includes("<table"), "real render path emits a <table> element");
assert(html.includes('data-testid="data-table"'), "DataTable component was dispatched");
assert(html.includes("Office supplies"), "bound dataSource rows rendered");
assert(html.includes("Travel"), "second bound row rendered");

if (failed > 0) {
  console.log(`\n${failed} assertion(s) failed`);
  process.exit(1);
}
console.log("\nAll dispatch assertions passed");
