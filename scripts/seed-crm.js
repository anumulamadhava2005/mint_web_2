// Seed script for CRM Dashboard community project
const PROJECT_ID = "824dc83d-e86a-454f-bd76-cee24bf7b81c";
const DB_URL = "http://localhost:3000/api/mint-db";

async function query(text, params) {
  const res = await fetch(DB_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, params }),
  });
  return res.json();
}

function uid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function rect(id, name, x, y, w, h, fill, parent, extra = {}) {
  return {
    id, name, type: "rect", x, y, width: w, height: h,
    fills: [{ fillColor: fill, fillOpacity: 1 }],
    strokes: [], opacity: 1, rotation: 0, shapes: [],
    frameId: parent, parentId: parent, hidden: false, locked: false,
    ...extra,
  };
}

function text(id, name, x, y, w, h, content, fontSize, color, parent, extra = {}) {
  return {
    id, name, type: "text", x, y, width: w, height: h,
    fills: [{ fillColor: color, fillOpacity: 1 }],
    strokes: [], opacity: 1, rotation: 0, shapes: [],
    frameId: parent, parentId: parent, hidden: false, locked: false,
    content: {
      children: [{ children: [{ text: content, fontFamily: "Inter", fontSize, fontWeight: extra.bold ? 700 : 400, fill: color }] }],
    },
    ...extra,
  };
}

function frame(id, name, x, y, w, h, fill, parent, children = []) {
  return {
    id, name, type: "frame", x, y, width: w, height: h,
    fills: [{ fillColor: fill, fillOpacity: 1 }],
    strokes: [], opacity: 1, rotation: 0, shapes: children,
    frameId: parent || "00000000-0000-0000-0000-000000000000",
    parentId: parent || "00000000-0000-0000-0000-000000000000",
    hidden: false, locked: false, showContent: true,
  };
}

// ── Screen 1: Dashboard Overview ─────────────────────────
function buildDashboard() {
  const ROOT = "00000000-0000-0000-0000-000000000000";
  const f1 = uid(); // main frame
  const objects = {};

  // Sidebar
  const sb = uid();
  const sbLogo = uid(), sbNav1 = uid(), sbNav2 = uid(), sbNav3 = uid(), sbNav4 = uid(), sbNav5 = uid();
  objects[sb] = frame(sb, "Sidebar", 0, 0, 240, 900, "#111827", f1, [sbLogo, sbNav1, sbNav2, sbNav3, sbNav4, sbNav5]);
  objects[sbLogo] = text(sbLogo, "Logo", 24, 28, 120, 28, "⚡ CRM Pro", 18, "#818cf8", sb, { bold: true });
  objects[sbNav1] = text(sbNav1, "Nav Dashboard", 24, 80, 180, 20, "📊  Dashboard", 14, "#e5e7eb", sb);
  objects[sbNav2] = text(sbNav2, "Nav Contacts", 24, 114, 180, 20, "👥  Contacts", 14, "#9ca3af", sb);
  objects[sbNav3] = text(sbNav3, "Nav Pipeline", 24, 148, 180, 20, "🔄  Pipeline", 14, "#9ca3af", sb);
  objects[sbNav4] = text(sbNav4, "Nav Activities", 24, 182, 180, 20, "📅  Activities", 14, "#9ca3af", sb);
  objects[sbNav5] = text(sbNav5, "Nav Settings", 24, 840, 180, 20, "⚙️  Settings", 14, "#6b7280", sb);

  // Header
  const hdr = uid(), hdrTitle = uid(), hdrSearch = uid(), hdrAvatar = uid();
  objects[hdr] = frame(hdr, "Header", 240, 0, 1160, 64, "#1f2937", f1, [hdrTitle, hdrSearch, hdrAvatar]);
  objects[hdrTitle] = text(hdrTitle, "Page Title", 264, 20, 200, 24, "Dashboard", 20, "#f9fafb", hdr, { bold: true });
  objects[hdrSearch] = rect(hdrSearch, "Search Bar", 700, 16, 300, 32, "#374151", hdr, { rx: 8 });
  objects[hdrAvatar] = rect(hdrAvatar, "Avatar", 1348, 16, 32, 32, "#818cf8", hdr, { rx: 16 });

  // Stat cards
  const stats = uid();
  const s1 = uid(), s1t = uid(), s1v = uid();
  const s2 = uid(), s2t = uid(), s2v = uid();
  const s3 = uid(), s3t = uid(), s3v = uid();
  const s4 = uid(), s4t = uid(), s4v = uid();
  objects[stats] = frame(stats, "Stats Row", 264, 88, 1112, 120, "transparent", f1, [s1, s1t, s1v, s2, s2t, s2v, s3, s3t, s3v, s4, s4t, s4v]);
  // Card 1
  objects[s1] = rect(s1, "Card Revenue", 264, 88, 254, 120, "#1e293b", stats, { rx: 12 });
  objects[s1t] = text(s1t, "Revenue Label", 284, 104, 120, 16, "Total Revenue", 12, "#94a3b8", stats);
  objects[s1v] = text(s1v, "Revenue Value", 284, 132, 160, 32, "$284,500", 28, "#34d399", stats, { bold: true });
  // Card 2
  objects[s2] = rect(s2, "Card Deals", 540, 88, 254, 120, "#1e293b", stats, { rx: 12 });
  objects[s2t] = text(s2t, "Deals Label", 560, 104, 120, 16, "Active Deals", 12, "#94a3b8", stats);
  objects[s2v] = text(s2v, "Deals Value", 560, 132, 100, 32, "147", 28, "#60a5fa", stats, { bold: true });
  // Card 3
  objects[s3] = rect(s3, "Card Leads", 816, 88, 254, 120, "#1e293b", stats, { rx: 12 });
  objects[s3t] = text(s3t, "Leads Label", 836, 104, 120, 16, "New Leads", 12, "#94a3b8", stats);
  objects[s3v] = text(s3v, "Leads Value", 836, 132, 100, 32, "63", 28, "#f472b6", stats, { bold: true });
  // Card 4
  objects[s4] = rect(s4, "Card Win Rate", 1092, 88, 254, 120, "#1e293b", stats, { rx: 12 });
  objects[s4t] = text(s4t, "Win Label", 1112, 104, 120, 16, "Win Rate", 12, "#94a3b8", stats);
  objects[s4v] = text(s4v, "Win Value", 1112, 132, 100, 32, "72%", 28, "#fbbf24", stats, { bold: true });

  // Chart placeholder
  const chart = uid(), chartTitle = uid(), chartBg = uid();
  objects[chart] = frame(chart, "Revenue Chart", 264, 232, 720, 320, "#1e293b", f1, [chartTitle, chartBg]);
  objects[chartTitle] = text(chartTitle, "Chart Title", 284, 248, 200, 20, "Revenue Trend", 16, "#f1f5f9", chart, { bold: true });
  objects[chartBg] = rect(chartBg, "Chart Area", 284, 280, 680, 256, "#0f172a", chart, { rx: 8 });

  // Recent activity table
  const tbl = uid(), tblTitle = uid();
  const r1 = uid(), r1t = uid(), r1s = uid();
  const r2 = uid(), r2t = uid(), r2s = uid();
  const r3 = uid(), r3t = uid(), r3s = uid();
  objects[tbl] = frame(tbl, "Recent Deals", 1008, 232, 368, 320, "#1e293b", f1, [tblTitle, r1, r1t, r1s, r2, r2t, r2s, r3, r3t, r3s]);
  objects[tblTitle] = text(tblTitle, "Table Title", 1028, 248, 200, 20, "Recent Deals", 16, "#f1f5f9", tbl, { bold: true });
  // Row 1
  objects[r1] = rect(r1, "Row1 Bg", 1024, 284, 336, 48, "#111827", tbl, { rx: 8 });
  objects[r1t] = text(r1t, "Row1 Name", 1040, 296, 200, 16, "Acme Corp — Enterprise", 13, "#e2e8f0", tbl);
  objects[r1s] = text(r1s, "Row1 Amount", 1280, 296, 80, 16, "$45,000", 13, "#34d399", tbl, { bold: true });
  // Row 2
  objects[r2] = rect(r2, "Row2 Bg", 1024, 340, 336, 48, "#111827", tbl, { rx: 8 });
  objects[r2t] = text(r2t, "Row2 Name", 1040, 352, 200, 16, "TechStart — Pro Plan", 13, "#e2e8f0", tbl);
  objects[r2s] = text(r2s, "Row2 Amount", 1280, 352, 80, 16, "$12,500", 13, "#60a5fa", tbl, { bold: true });
  // Row 3
  objects[r3] = rect(r3, "Row3 Bg", 1024, 396, 336, 48, "#111827", tbl, { rx: 8 });
  objects[r3t] = text(r3t, "Row3 Name", 1040, 408, 200, 16, "GlobalFin — Audit", 13, "#e2e8f0", tbl);
  objects[r3s] = text(r3s, "Row3 Amount", 1280, 408, 80, 16, "$78,000", 13, "#fbbf24", tbl, { bold: true });

  // Activity feed
  const feed = uid(), feedTitle = uid();
  const a1 = uid(), a2 = uid(), a3 = uid();
  objects[feed] = frame(feed, "Activity Feed", 264, 576, 1112, 300, "#1e293b", f1, [feedTitle, a1, a2, a3]);
  objects[feedTitle] = text(feedTitle, "Feed Title", 284, 592, 200, 20, "Recent Activity", 16, "#f1f5f9", feed, { bold: true });
  objects[a1] = text(a1, "Activity 1", 284, 628, 500, 16, "🟢  Sarah closed deal with Acme Corp — $45,000", 13, "#d1d5db", feed);
  objects[a2] = text(a2, "Activity 2", 284, 658, 500, 16, "🔵  New lead: James Miller from TechVentures", 13, "#d1d5db", feed);
  objects[a3] = text(a3, "Activity 3", 284, 688, 500, 16, "🟡  Meeting scheduled with GlobalFin — Tomorrow 2pm", 13, "#d1d5db", feed);

  // Main frame
  const allChildren = [sb, hdr, stats, chart, tbl, feed];
  objects[f1] = frame(f1, "Dashboard", 0, 0, 1400, 900, "#0f172a", ROOT, allChildren);

  // Root
  objects[ROOT] = {
    id: ROOT, name: "Root Frame", type: "frame", x: 0, y: 0, width: 0, height: 0,
    fills: [], strokes: [], opacity: 1, rotation: 0,
    shapes: [f1], frameId: ROOT, parentId: null,
  };

  return { f1, objects };
}

// ── Screen 2: Contacts List ─────────────────────────
function buildContacts(startX) {
  const ROOT = "00000000-0000-0000-0000-000000000000";
  const f2 = uid();
  const objects = {};

  // Sidebar (same structure)
  const sb = uid(), sbLogo = uid(), sbN1 = uid(), sbN2 = uid(), sbN3 = uid();
  objects[sb] = frame(sb, "Sidebar", startX, 0, 240, 900, "#111827", f2, [sbLogo, sbN1, sbN2, sbN3]);
  objects[sbLogo] = text(sbLogo, "Logo", startX + 24, 28, 120, 28, "⚡ CRM Pro", 18, "#818cf8", sb, { bold: true });
  objects[sbN1] = text(sbN1, "Nav 1", startX + 24, 80, 180, 20, "📊  Dashboard", 14, "#9ca3af", sb);
  objects[sbN2] = text(sbN2, "Nav 2", startX + 24, 114, 180, 20, "👥  Contacts", 14, "#e5e7eb", sb);
  objects[sbN3] = text(sbN3, "Nav 3", startX + 24, 148, 180, 20, "🔄  Pipeline", 14, "#9ca3af", sb);

  // Header
  const hdr = uid(), ht = uid(), addBtn = uid(), addTxt = uid();
  objects[hdr] = frame(hdr, "Header", startX + 240, 0, 1160, 64, "#1f2937", f2, [ht, addBtn, addTxt]);
  objects[ht] = text(ht, "Title", startX + 264, 20, 200, 24, "Contacts", 20, "#f9fafb", hdr, { bold: true });
  objects[addBtn] = rect(addBtn, "Add Btn", startX + 1260, 16, 120, 32, "#818cf8", hdr, { rx: 8 });
  objects[addTxt] = text(addTxt, "Add Txt", startX + 1280, 22, 80, 18, "+ Add Contact", 12, "#ffffff", hdr, { bold: true });

  // Table header
  const th = uid(), th1 = uid(), th2 = uid(), th3 = uid(), th4 = uid(), th5 = uid();
  objects[th] = frame(th, "Table Header", startX + 264, 80, 1112, 40, "#1e293b", f2, [th1, th2, th3, th4, th5]);
  objects[th1] = text(th1, "Col Name", startX + 284, 90, 200, 16, "Name", 12, "#94a3b8", th, { bold: true });
  objects[th2] = text(th2, "Col Email", startX + 500, 90, 200, 16, "Email", 12, "#94a3b8", th, { bold: true });
  objects[th3] = text(th3, "Col Company", startX + 740, 90, 200, 16, "Company", 12, "#94a3b8", th, { bold: true });
  objects[th4] = text(th4, "Col Status", startX + 980, 90, 100, 16, "Status", 12, "#94a3b8", th, { bold: true });
  objects[th5] = text(th5, "Col Value", startX + 1120, 90, 100, 16, "Deal Value", 12, "#94a3b8", th, { bold: true });

  // Table rows
  const contacts = [
    { name: "Sarah Johnson", email: "sarah@acme.com", company: "Acme Corp", status: "Customer", statusColor: "#34d399", value: "$45,000" },
    { name: "James Miller", email: "james@techv.io", company: "TechVentures", status: "Lead", statusColor: "#60a5fa", value: "$—" },
    { name: "Emily Chen", email: "emily@global.com", company: "GlobalFin", status: "Prospect", statusColor: "#fbbf24", value: "$78,000" },
    { name: "Michael Brown", email: "michael@startup.co", company: "StartupCo", status: "Customer", statusColor: "#34d399", value: "$23,400" },
    { name: "Lisa Wang", email: "lisa@enterprise.io", company: "EnterpriseSys", status: "Lead", statusColor: "#60a5fa", value: "$—" },
    { name: "David Kim", email: "david@innovate.dev", company: "InnovateDev", status: "Prospect", statusColor: "#f472b6", value: "$56,000" },
  ];

  const rowIds = [];
  contacts.forEach((c, i) => {
    const rowY = 130 + i * 56;
    const bg = uid(), n = uid(), e = uid(), co = uid(), st = uid(), stBg = uid(), v = uid();
    objects[bg] = rect(bg, `Row${i} Bg`, startX + 264, rowY, 1112, 52, i % 2 === 0 ? "#111827" : "#0f172a", f2, { rx: 4 });
    objects[n] = text(n, `Row${i} Name`, startX + 284, rowY + 16, 200, 16, c.name, 13, "#e2e8f0", f2);
    objects[e] = text(e, `Row${i} Email`, startX + 500, rowY + 16, 200, 16, c.email, 13, "#94a3b8", f2);
    objects[co] = text(co, `Row${i} Company`, startX + 740, rowY + 16, 200, 16, c.company, 13, "#cbd5e1", f2);
    objects[stBg] = rect(stBg, `Row${i} StatusBg`, startX + 980, rowY + 12, 80, 24, c.statusColor + "20", f2, { rx: 12 });
    objects[st] = text(st, `Row${i} Status`, startX + 992, rowY + 16, 60, 16, c.status, 11, c.statusColor, f2, { bold: true });
    objects[v] = text(v, `Row${i} Value`, startX + 1120, rowY + 16, 100, 16, c.value, 13, "#e2e8f0", f2);
    rowIds.push(bg, n, e, co, stBg, st, v);
  });

  const allChildren = [sb, hdr, th, ...rowIds];
  objects[f2] = frame(f2, "Contacts", startX, 0, 1400, 900, "#0f172a", ROOT, allChildren);

  return { f2, objects };
}

// ── Screen 3: Pipeline (Kanban) ─────────────────────────
function buildPipeline(startX) {
  const ROOT = "00000000-0000-0000-0000-000000000000";
  const f3 = uid();
  const objects = {};

  // Sidebar
  const sb = uid(), sbLogo = uid(), sbN1 = uid(), sbN2 = uid(), sbN3 = uid();
  objects[sb] = frame(sb, "Sidebar", startX, 0, 240, 900, "#111827", f3, [sbLogo, sbN1, sbN2, sbN3]);
  objects[sbLogo] = text(sbLogo, "Logo", startX + 24, 28, 120, 28, "⚡ CRM Pro", 18, "#818cf8", sb, { bold: true });
  objects[sbN1] = text(sbN1, "Nav 1", startX + 24, 80, 180, 20, "📊  Dashboard", 14, "#9ca3af", sb);
  objects[sbN2] = text(sbN2, "Nav 2", startX + 24, 114, 180, 20, "👥  Contacts", 14, "#9ca3af", sb);
  objects[sbN3] = text(sbN3, "Nav 3", startX + 24, 148, 180, 20, "🔄  Pipeline", 14, "#e5e7eb", sb);

  // Header
  const hdr = uid(), ht = uid();
  objects[hdr] = frame(hdr, "Header", startX + 240, 0, 1160, 64, "#1f2937", f3, [ht]);
  objects[ht] = text(ht, "Title", startX + 264, 20, 200, 24, "Pipeline", 20, "#f9fafb", hdr, { bold: true });

  // Kanban columns
  const columns = [
    { title: "New Leads", color: "#818cf8", deals: [
      { name: "TechStart", value: "$12,500" }, { name: "DataFlow", value: "$8,200" }
    ]},
    { title: "Qualified", color: "#60a5fa", deals: [
      { name: "Acme Corp", value: "$45,000" }, { name: "CloudNet", value: "$28,000" }, { name: "SyncTech", value: "$15,600" }
    ]},
    { title: "Proposal", color: "#fbbf24", deals: [
      { name: "GlobalFin", value: "$78,000" }, { name: "MegaCo", value: "$34,000" }
    ]},
    { title: "Closed Won", color: "#34d399", deals: [
      { name: "EntSys", value: "$92,000" }
    ]},
  ];

  const colIds = [];
  columns.forEach((col, ci) => {
    const colX = startX + 264 + ci * 280;
    const colFrame = uid(), colTitle = uid(), colCount = uid();
    const cardIds = [colTitle, colCount];

    objects[colTitle] = text(colTitle, `${col.title} Title`, colX + 16, 92, 200, 18, col.title, 14, col.color, colFrame, { bold: true });
    objects[colCount] = text(colCount, `${col.title} Count`, colX + 200, 92, 40, 18, `${col.deals.length}`, 12, "#6b7280", colFrame);

    col.deals.forEach((deal, di) => {
      const cy = 124 + di * 100;
      const card = uid(), cName = uid(), cVal = uid(), cBar = uid();
      objects[card] = rect(card, `${deal.name} Card`, colX + 12, cy, 240, 84, "#1e293b", colFrame, { rx: 10 });
      objects[cName] = text(cName, `${deal.name} Name`, colX + 24, cy + 16, 180, 16, deal.name, 14, "#e2e8f0", colFrame, { bold: true });
      objects[cVal] = text(cVal, `${deal.name} Value`, colX + 24, cy + 42, 100, 14, deal.value, 13, col.color, colFrame);
      objects[cBar] = rect(cBar, `${deal.name} Bar`, colX + 24, cy + 66, 100 + Math.random() * 100, 4, col.color, colFrame, { rx: 2 });
      cardIds.push(card, cName, cVal, cBar);
    });

    objects[colFrame] = frame(colFrame, col.title, colX, 76, 264, 800, "#111827", f3, cardIds);
    colIds.push(colFrame);
  });

  const allChildren = [sb, hdr, ...colIds];
  objects[f3] = frame(f3, "Pipeline", startX, 0, 1400, 900, "#0f172a", ROOT, allChildren);

  return { f3, objects };
}

async function main() {
  const pageId = uid();
  const ROOT = "00000000-0000-0000-0000-000000000000";

  const { f1, objects: obj1 } = buildDashboard();
  const { f2, objects: obj2 } = buildContacts(1500);
  const { f3, objects: obj3 } = buildPipeline(3000);

  const allObjects = {
    [ROOT]: {
      id: ROOT, name: "Root Frame", type: "frame", x: 0, y: 0, width: 0, height: 0,
      fills: [], strokes: [], opacity: 1, rotation: 0,
      shapes: [f1, f2, f3], frameId: ROOT, parentId: null,
    },
    ...obj1, ...obj2, ...obj3,
  };
  // Remove duplicate root entries from sub-builders
  delete allObjects[ROOT + "_dup"];

  const fileData = {
    pages: [pageId],
    colors: {},
    components: {},
    pagesIndex: {
      [pageId]: {
        id: pageId, name: "Page 1", flows: [],
        objects: allObjects,
      },
    },
    typographies: {},
  };

  const fileId = uid();
  const dataStr = JSON.stringify(fileData).replace(/'/g, "''");

  const result = await query(
    `INSERT INTO files (id, project_id, name, data, revn) VALUES ($1, $2, $3, $4::jsonb, 1) RETURNING id`,
    [fileId, PROJECT_ID, "CRM Design", JSON.stringify(fileData)]
  );

  console.log("CRM Dashboard file created:", result);
}

main().catch(console.error);
