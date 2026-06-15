const { Client } = require("pg");
const crypto = require("crypto");

const PID = "88c00748-ef23-4aa5-b8a9-3f2c6ab13528";
const DB_URL = "postgresql://postgres:9989882989@m@localhost:5432/mint_web";
const ROOT_ID = "00000000-0000-0000-0000-000000000000";

// ─── Shape Builders ───────────────────────────────────────────────────────────

function mkFrame(id, name, x, y, w, h, fill, parentId, children = [], extra = {}) {
  return {
    id, name, type: "frame", x, y, width: w, height: h,
    fills: fill ? [{ fillColor: fill, fillOpacity: 1 }] : [],
    strokes: [], opacity: 1, rotation: 0,
    shapes: [...children],
    frameId: parentId || ROOT_ID,
    parentId: parentId || ROOT_ID,
    hidden: false, locked: false, showContent: true,
    ...extra
  };
}

function mkRect(id, name, x, y, w, h, fill, parentId, extra = {}) {
  return {
    id, name, type: "rect", x, y, width: w, height: h,
    fills: fill ? [{ fillColor: fill, fillOpacity: 1 }] : [],
    strokes: [], opacity: 1, rotation: 0, shapes: [],
    frameId: parentId, parentId,
    hidden: false, locked: false,
    ...extra
  };
}

function mkText(id, name, x, y, w, h, txt, fs, color, parentId, extra = {}) {
  return {
    id, name, type: "text", x, y, width: w, height: h,
    fills: color ? [{ fillColor: color, fillOpacity: 1 }] : [],
    strokes: [], opacity: 1, rotation: 0, shapes: [],
    frameId: parentId, parentId,
    hidden: false, locked: false,
    content: {
      type: "root",
      children: [{
        type: "paragraph",
        children: [{
          text: txt, fontFamily: "Inter",
          fontSize: fs, fontWeight: extra.bold ? 700 : 400, fill: color
        }]
      }]
    },
    ...extra
  };
}

// ─── Node Converter ───────────────────────────────────────────────────────────

function shapeToNode(shape, parentX, parentY, objects) {
  const r = (n) => Math.round(n * 10) / 10;
  const node = {
    id: shape.id, name: shape.name,
    type: mapShapeType(shape.type),
    x: r(shape.x - parentX), y: r(shape.y - parentY),
    width: r(shape.width), height: r(shape.height),
    visible: !shape.hidden,
  };
  if (shape.rotation) node.rotation = shape.rotation;
  if (shape.opacity !== undefined && shape.opacity !== 1) node.opacity = shape.opacity;
  if (shape.fills?.length) {
    node.fills = shape.fills.map(f => ({ type: "SOLID", color: f.fillColor, opacity: f.fillOpacity }));
  }
  if (shape.strokes?.length) {
    node.strokes = shape.strokes.map(s => ({
      color: s.strokeColor, opacity: s.strokeOpacity,
      weight: s.strokeWidth, align: s.strokeAlignment?.toUpperCase() || "CENTER"
    }));
  }
  if (shape.rx || shape.ry) node.corners = { uniform: shape.rx || shape.ry };
  if (shape.type === "text" && shape.content) {
    const textVal = shape.content.children
      ? shape.content.children.flatMap(p => p.children ? p.children.map(r => r.text) : []).join("\n")
      : "";
    const firstRun = shape.content.children?.[0]?.children?.[0];
    node.text = {
      characters: textVal,
      fontFamily: firstRun?.fontFamily || "Inter",
      fontSize: firstRun?.fontSize || 14,
      fontWeight: firstRun?.fontWeight || 400,
      color: firstRun?.fill || "#ffffff",
    };
  }
  if (shape.layoutProps?.layout) {
    const lp = shape.layoutProps;
    node.layout = {
      mode: lp.layout === "flex" ? (lp.layoutFlexDir === "column" ? "VERTICAL" : "HORIZONTAL") : "NONE",
      gap: lp.layoutGap,
      paddingTop: lp.layoutPaddingTop, paddingRight: lp.layoutPaddingRight,
      paddingBottom: lp.layoutPaddingBottom, paddingLeft: lp.layoutPaddingLeft,
    };
  }
  if (shape.shapes?.length) {
    const kids = shape.shapes.map(id => objects[id]).filter(s => !!s && !s.hidden);
    if (kids.length > 0) {
      node.children = kids.map(k => shapeToNode(k, shape.x, shape.y, objects));
    }
  }
  if (shape.runtimeBindings) node.pluginData = { runtimeBindings: shape.runtimeBindings };
  return node;
}

function mapShapeType(kind) {
  return { frame: "FRAME", group: "GROUP", rect: "RECTANGLE", circle: "ELLIPSE", text: "TEXT" }[kind] || "FRAME";
}

// ─── Design Tokens ────────────────────────────────────────────────────────────

const C = {
  bg: "#0A0A0A",
  surface: "#111111",
  card: "#18181B",
  primary: "#FAFAFA",
  secondary: "#A1A1AA",
  muted: "#71717A",
  success: "#22C55E",
  warning: "#FBBF24",
  danger: "#EF4444",
  border: "#27272A",
};

// ─── Shared Components ────────────────────────────────────────────────────────

function buildBottomNav(screenId, xO, activeTab, objects) {
  const navId = crypto.randomUUID();
  const tabs = [
    { key: "dashboard", label: "Dashboard", action: "navigateDashboard" },
    { key: "workouts", label: "Workouts", action: "navigateWorkouts" },
    { key: "progress", label: "Progress", action: "navigateProgress" },
    { key: "goals", label: "Goals", action: "navigateGoals" },
    { key: "analytics", label: "Analytics", action: "navigateAnalytics" },
    { key: "profile", label: "Profile", action: "navigateProfile" },
  ];
  const tabW = 65; // 390 / 6
  const tabIds = tabs.map(() => crypto.randomUUID());

  const nav = mkFrame(navId, "BottomNav", xO, 812, 390, 88, C.surface, screenId, tabIds);
  nav.strokes = [{ strokeColor: C.border, strokeWidth: 1, strokeAlignment: "TOP" }];
  nav.layoutProps = { layout: "flex", layoutFlexDir: "row", layoutGap: 0 };
  objects[navId] = nav;

  tabs.forEach((tab, i) => {
    const isActive = tab.key === activeTab;
    const color = isActive ? C.primary : C.muted;
    const tabFrame = mkFrame(tabIds[i], `Tab_${tab.key}`, xO + i * tabW, 812, tabW, 88, "transparent", navId, [], {
      runtimeBindings: { onClick: tab.action }
    });
    tabFrame.layoutProps = {
      layout: "flex", layoutFlexDir: "column", layoutGap: 4,
      layoutPaddingTop: 14, layoutPaddingBottom: 12,
      layoutPaddingLeft: 2, layoutPaddingRight: 2
    };

    const dotId = crypto.randomUUID();
    const lblId = crypto.randomUUID();
    // Active indicator dot
    const dot = mkRect(dotId, `Dot_${tab.key}`, xO + i * tabW + tabW / 2 - 3, 826, 6, 6,
      isActive ? C.primary : "transparent", tabIds[i], { rx: 3 });
    // Label
    const lbl = mkText(lblId, `Label_${tab.key}`, xO + i * tabW, 836, tabW, 14,
      tab.label, 9, color, tabIds[i]);
    tabFrame.shapes = [dotId, lblId];
    objects[tabIds[i]] = tabFrame;
    objects[dotId] = dot;
    objects[lblId] = lbl;
  });

  return navId;
}

// KPI Card — label on top, big value, small unit underneath
function buildKPICard(parentId, x, y, w, h, label, value, unit, valueBind, objects) {
  const cardId = crypto.randomUUID();
  const lblId = crypto.randomUUID();
  const valId = crypto.randomUUID();
  const unitId = crypto.randomUUID();

  const card = mkFrame(cardId, `KPI_${label}`, x, y, w, h, C.card, parentId, [lblId, valId, unitId]);
  card.rx = 12;
  card.layoutProps = {
    layout: "flex", layoutFlexDir: "column", layoutGap: 2,
    layoutPaddingTop: 14, layoutPaddingLeft: 14, layoutPaddingRight: 8, layoutPaddingBottom: 14
  };

  const lbl = mkText(lblId, `KPI_Lbl`, x, y, w - 16, 13, label, 11, C.secondary, cardId);
  const valExtra = valueBind ? { bold: true, runtimeBindings: { textBind: valueBind } } : { bold: true };
  const val = mkText(valId, `KPI_Val`, x, y, w - 16, 32, value, 22, C.primary, cardId, valExtra);
  const unt = mkText(unitId, `KPI_Unit`, x, y, w - 16, 13, unit, 11, C.muted, cardId);

  objects[cardId] = card; objects[lblId] = lbl; objects[valId] = val; objects[unitId] = unt;
  return cardId;
}

// Progress Bar — FIX: label + pct on same row (horizontal flex), track below
function buildProgressBar(parentId, x, y, w, label, pct, labelBind, pctBind, objects) {
  const frameId = crypto.randomUUID();
  const headerRowId = crypto.randomUUID();
  const lblId = crypto.randomUUID();
  const pctTxtId = crypto.randomUUID();
  const trackId = crypto.randomUUID();
  const fillId = crypto.randomUUID();

  // Outer column: [headerRow, track]
  const frame = mkFrame(frameId, `PBar_${label}`, x, y, w, 44, "transparent", parentId, [headerRowId, trackId]);
  frame.layoutProps = { layout: "flex", layoutFlexDir: "column", layoutGap: 6 };

  // Header row: label LEFT, pct RIGHT
  const headerRow = mkFrame(headerRowId, `PBar_Header_${label}`, x, y, w, 18, "transparent", frameId, [lblId, pctTxtId]);
  headerRow.layoutProps = { layout: "flex", layoutFlexDir: "row", layoutGap: 0 };

  const lblExtra = labelBind ? { bold: true, runtimeBindings: { textBind: labelBind } } : { bold: true };
  const lbl = mkText(lblId, `PBar_Lbl`, x, y, w - 44, 18, label, 12, C.primary, headerRowId, lblExtra);
  const pctExtra = pctBind ? { runtimeBindings: { textBind: pctBind } } : {};
  const pctTxt = mkText(pctTxtId, `PBar_Pct`, x, y, 44, 18, `${pct}%`, 12, C.secondary, headerRowId, pctExtra);

  // Track bar
  const track = mkRect(trackId, `PBar_Track`, x, y + 24, w, 6, C.border, frameId, { rx: 3, shapes: [fillId] });
  const fill = mkRect(fillId, `PBar_Fill`, x, y + 24, Math.round(w * pct / 100), 6, C.primary, trackId, { rx: 3 });

  objects[frameId] = frame; objects[headerRowId] = headerRow;
  objects[lblId] = lbl; objects[pctTxtId] = pctTxt;
  objects[trackId] = track; objects[fillId] = fill;
  return frameId;
}

// Workout Card — used in repeater (isTemplate=true) or as static card
function buildWorkoutCard(parentId, x, y, w, name, duration, calories, muscleGroup, objects, isTemplate = false) {
  const cardId = crypto.randomUUID();
  const nameId = crypto.randomUUID();
  const metaId = crypto.randomUUID();
  const durId = crypto.randomUUID();
  const calId = crypto.randomUUID();
  const tagId = crypto.randomUUID();
  const tagTxtId = crypto.randomUUID();

  const card = mkFrame(cardId, `WorkoutCard`, x, y, w, 84, C.card, parentId, [nameId, metaId, tagId]);
  card.rx = 12;
  card.strokes = [{ strokeColor: C.border, strokeWidth: 1, strokeAlignment: "CENTER" }];
  card.layoutProps = {
    layout: "flex", layoutFlexDir: "column", layoutGap: 6,
    layoutPaddingTop: 14, layoutPaddingLeft: 14, layoutPaddingRight: 14, layoutPaddingBottom: 14
  };
  card.runtimeBindings = { onClick: "openWorkoutDetail" };

  const nameExtra = isTemplate
    ? { bold: true, runtimeBindings: { textBind: "$workout.name" } }
    : { bold: true };
  const nameT = mkText(nameId, `WCard_Name`, x, y, w - 28, 20, name, 15, C.primary, cardId, nameExtra);

  const meta = mkFrame(metaId, `WCard_Meta`, x, y, w - 28, 16, "transparent", cardId, [durId, calId]);
  meta.layoutProps = { layout: "flex", layoutFlexDir: "row", layoutGap: 20 };

  const durExtra = isTemplate ? { runtimeBindings: { textBind: "$workout.duration_minutes" } } : {};
  const calExtra = isTemplate ? { runtimeBindings: { textBind: "$workout.calories_burned" } } : {};
  const dur = mkText(durId, `WCard_Dur`, x, y, 90, 16, `${duration} min`, 12, C.secondary, metaId, durExtra);
  const cal = mkText(calId, `WCard_Cal`, x, y, 110, 16, `${calories} kcal`, 12, C.secondary, metaId, calExtra);

  const tagExtra = isTemplate ? { runtimeBindings: { textBind: "$workout.muscle_group" } } : {};
  const tag = mkRect(tagId, `WCard_Tag`, x, y, 70, 20, C.surface, cardId, { rx: 10, shapes: [tagTxtId] });
  const tagTxt = mkText(tagTxtId, `WCard_TagTxt`, x, y, 70, 20, muscleGroup, 10, C.secondary, tagId, tagExtra);

  objects[cardId] = card; objects[nameId] = nameT; objects[metaId] = meta;
  objects[durId] = dur; objects[calId] = cal;
  objects[tagId] = tag; objects[tagTxtId] = tagTxt;
  return cardId;
}

// Goal Card — used in repeater (isTemplate=true) or static
function buildGoalCard(parentId, x, y, w, title, current, target, unit, pct, objects, isTemplate = false) {
  const cardId = crypto.randomUUID();
  const topRowId = crypto.randomUUID();
  const titleId = crypto.randomUUID();
  const archBtnId = crypto.randomUUID();
  const archTxtId = crypto.randomUUID();
  const subId = crypto.randomUUID();
  const trackId = crypto.randomUUID();
  const fillId = crypto.randomUUID();
  const pctId = crypto.randomUUID();

  const card = mkFrame(cardId, `GoalCard`, x, y, w, 100, C.card, parentId,
    [topRowId, subId, trackId, pctId]);
  card.rx = 12;
  card.strokes = [{ strokeColor: C.border, strokeWidth: 1, strokeAlignment: "CENTER" }];
  card.layoutProps = {
    layout: "flex", layoutFlexDir: "column", layoutGap: 8,
    layoutPaddingTop: 14, layoutPaddingLeft: 14, layoutPaddingRight: 14, layoutPaddingBottom: 14
  };

  // Top row: title left, archive button right
  const topRow = mkFrame(topRowId, `GCard_TopRow`, x, y, w - 28, 22, "transparent", cardId, [titleId, archBtnId]);
  topRow.layoutProps = { layout: "flex", layoutFlexDir: "row", layoutGap: 0 };

  const titleExtra = isTemplate
    ? { bold: true, runtimeBindings: { textBind: "$goal.title" } }
    : { bold: true };
  const titleT = mkText(titleId, `GCard_Title`, x, y, w - 80, 22, title, 13, C.primary, topRowId, titleExtra);
  const archBtn = mkRect(archBtnId, `GCard_Arch`, x, y, 48, 22, C.surface, topRowId, {
    rx: 11, shapes: [archTxtId],
    runtimeBindings: { onClick: "archiveGoal" }
  });
  const archTxt = mkText(archTxtId, `GCard_ArchTxt`, x, y, 48, 22, "Archive", 9, C.muted, archBtnId);

  const subExtra = isTemplate
    ? { runtimeBindings: { textBind: "$goal.current_value" } }
    : {};
  const sub = mkText(subId, `GCard_Sub`, x, y, w - 28, 15,
    `${current}${unit} / ${target}${unit}`, 12, C.secondary, cardId, subExtra);

  const track = mkRect(trackId, `GCard_Track`, x, y, w - 28, 5, C.border, cardId, { rx: 3, shapes: [fillId] });
  const fill = mkRect(fillId, `GCard_Fill`, x, y, Math.round((w - 28) * pct / 100), 5, C.primary, trackId, { rx: 3 });

  const pctExtra = isTemplate ? { runtimeBindings: { textBind: "$goal.pct_complete" } } : {};
  const pctT = mkText(pctId, `GCard_Pct`, x, y, w - 28, 13, `${pct}%`, 11, C.muted, cardId, pctExtra);

  objects[cardId] = card; objects[topRowId] = topRow;
  objects[titleId] = titleT; objects[archBtnId] = archBtn; objects[archTxtId] = archTxt;
  objects[subId] = sub; objects[trackId] = track;
  objects[fillId] = fill; objects[pctId] = pctT;
  return cardId;
}

// ─── Screen: Dashboard ───────────────────────────────────────────────────────

function buildDashboardScreen(objects) {
  const screenId = "pulse-dashboard-screen";
  const xO = 0;

  // Header
  const headerId = crypto.randomUUID();
  const greetId = crypto.randomUUID();
  const dateId = crypto.randomUUID();
  const avatarId = crypto.randomUUID();
  const header = mkFrame(headerId, "Header", xO, 0, 390, 72, C.surface, screenId, [greetId, dateId, avatarId]);
  header.layoutProps = {
    layout: "flex", layoutFlexDir: "row", layoutGap: 0,
    layoutPaddingTop: 20, layoutPaddingLeft: 20, layoutPaddingRight: 20, layoutPaddingBottom: 12
  };
  const greet = mkText(greetId, "Greeting", xO + 20, 20, 280, 24, "Good Morning, Madhava", 17, C.primary, headerId, {
    bold: true, runtimeBindings: { textBind: "$local.greeting" }
  });
  const date = mkText(dateId, "Date", xO + 20, 44, 280, 16, "Saturday, June 6", 12, C.secondary, headerId);
  const avatar = mkRect(avatarId, "Avatar", xO + 342, 18, 36, 36, C.card, headerId, {
    rx: 18, runtimeBindings: { onClick: "navigateProfile" }
  });
  objects[headerId] = header; objects[greetId] = greet;
  objects[dateId] = date; objects[avatarId] = avatar;

  // KPI 2×2 Grid
  const kpiGridId = crypto.randomUUID();
  const col1Id = crypto.randomUUID();
  const col2Id = crypto.randomUUID();
  const kpiGrid = mkFrame(kpiGridId, "KPI_Grid", xO + 16, 80, 358, 168, "transparent", screenId, [col1Id, col2Id]);
  kpiGrid.layoutProps = { layout: "flex", layoutFlexDir: "row", layoutGap: 12 };
  const col1 = mkFrame(col1Id, "KPI_Col1", xO + 16, 80, 173, 168, "transparent", kpiGridId, []);
  col1.layoutProps = { layout: "flex", layoutFlexDir: "column", layoutGap: 12 };
  const col2 = mkFrame(col2Id, "KPI_Col2", xO + 201, 80, 173, 168, "transparent", kpiGridId, []);
  col2.layoutProps = { layout: "flex", layoutFlexDir: "column", layoutGap: 12 };
  objects[kpiGridId] = kpiGrid; objects[col1Id] = col1; objects[col2Id] = col2;

  col1.shapes.push(
    buildKPICard(col1Id, xO + 16, 80, 173, 78, "Today's Workout", "45", "min", "$local.todayActivity.duration_minutes", objects),
    buildKPICard(col1Id, xO + 16, 170, 173, 78, "Steps", "7,420", "steps today", "$local.todayActivity.steps", objects)
  );
  col2.shapes.push(
    buildKPICard(col2Id, xO + 201, 80, 173, 78, "Calories", "540", "kcal burned", "$local.todayActivity.calories", objects),
    buildKPICard(col2Id, xO + 201, 170, 173, 78, "Weight", "72", "kg", "$user.weight_kg", objects)
  );

  // Weekly Activity Chart
  const chartId = crypto.randomUUID();
  const chartTtlId = crypto.randomUUID();
  const chartBarsId = crypto.randomUUID();
  const chart = mkFrame(chartId, "Weekly_Chart", xO + 16, 260, 358, 136, C.card, screenId, [chartTtlId, chartBarsId]);
  chart.rx = 12;
  chart.runtimeBindings = { dataSource: "$local.weeklyWorkouts" };
  chart.layoutProps = {
    layout: "flex", layoutFlexDir: "column", layoutGap: 10,
    layoutPaddingTop: 14, layoutPaddingLeft: 14, layoutPaddingRight: 14, layoutPaddingBottom: 14
  };
  const chartTtl = mkText(chartTtlId, "Chart_Title", xO + 30, 274, 310, 18, "Weekly Activity", 13, C.primary, chartId, { bold: true });
  const chartBars = mkFrame(chartBarsId, "Chart_Bars", xO + 30, 300, 322, 82, "transparent", chartId, []);
  chartBars.layoutProps = { layout: "flex", layoutFlexDir: "row", layoutGap: 6, layoutPaddingTop: 4 };
  objects[chartId] = chart; objects[chartTtlId] = chartTtl; objects[chartBarsId] = chartBars;
  [40, 60, 80, 55, 90, 70, 45].forEach((h, i) => {
    const bId = crypto.randomUUID();
    const bar = mkRect(bId, `DBar_${i}`, xO + 30 + i * 46, 382 - h, 40, h,
      i === 4 ? C.primary : C.border, chartBarsId, { rx: 4 });
    objects[bId] = bar; chartBars.shapes.push(bId);
  });

  // Goal Progress Section
  const goalSecId = crypto.randomUUID();
  const goalTtlId = crypto.randomUUID();
  const goalSec = mkFrame(goalSecId, "Goal_Section", xO + 16, 408, 358, 122, C.card, screenId, [goalTtlId]);
  goalSec.rx = 12;
  goalSec.layoutProps = {
    layout: "flex", layoutFlexDir: "column", layoutGap: 12,
    layoutPaddingTop: 14, layoutPaddingLeft: 14, layoutPaddingRight: 14, layoutPaddingBottom: 14
  };
  const goalTtl = mkText(goalTtlId, "Goal_Section_Title", xO + 30, 422, 310, 18, "Goal Progress", 13, C.primary, goalSecId, { bold: true });
  objects[goalSecId] = goalSec; objects[goalTtlId] = goalTtl;

  goalSec.shapes.push(
    buildProgressBar(goalSecId, xO + 30, 448, 326, "Lose 5kg", 67, "$local.goals[0].title", "$local.goals[0].pct_complete", objects),
    buildProgressBar(goalSecId, xO + 30, 498, 326, "Run 100km/month", 64, "$local.goals[1].title", "$local.goals[1].pct_complete", objects)
  );

  // Recent Workouts — repeater
  const recentId = crypto.randomUUID();
  const recentTtlId = crypto.randomUUID();
  const recent = mkFrame(recentId, "Recent_Workouts", xO + 16, 542, 358, 260, "transparent", screenId, [recentTtlId]);
  recent.layoutProps = { layout: "flex", layoutFlexDir: "column", layoutGap: 10 };
  recent.runtimeBindings = { repeatFor: "$local.recentWorkouts", repeatAs: "workout", dataSource: "workouts" };
  recent.scrollConfig = { behavior: "vertical" };
  const recentTtl = mkText(recentTtlId, "Recent_Title", xO + 16, 542, 310, 20, "Recent Workouts", 14, C.primary, recentId, { bold: true });
  objects[recentId] = recent; objects[recentTtlId] = recentTtl;
  recent.shapes.push(buildWorkoutCard(recentId, xO + 16, 570, 358, "Push Day", 45, 320, "Chest", objects, true));

  const navId = buildBottomNav(screenId, xO, "dashboard", objects);

  const screen = mkFrame(screenId, "Dashboard", xO, 0, 390, 900, C.bg, ROOT_ID,
    [headerId, kpiGridId, chartId, goalSecId, recentId, navId]);
  screen.runtimeBindings = { onMount: "fetchDashboardData" };
  objects[screenId] = screen;
  return screenId;
}

// ─── Screen: Workouts ────────────────────────────────────────────────────────

function buildWorkoutsScreen(objects) {
  const screenId = "pulse-workouts-screen";
  const xO = 420;

  const headerId = crypto.randomUUID();
  const titleId = crypto.randomUUID();
  const header = mkFrame(headerId, "Header", xO, 0, 390, 64, C.surface, screenId, [titleId]);
  header.layoutProps = {
    layout: "flex", layoutFlexDir: "row", layoutGap: 0,
    layoutPaddingTop: 20, layoutPaddingLeft: 20
  };
  const title = mkText(titleId, "Screen_Title", xO + 20, 20, 300, 28, "Workouts", 22, C.primary, headerId, { bold: true });
  objects[headerId] = header; objects[titleId] = title;

  // Search bar — FIX: hint text inside the rect as a child, not a screen sibling
  const searchId = crypto.randomUUID();
  const searchHintId = crypto.randomUUID();
  const search = mkRect(searchId, "Search_Bar", xO + 16, 80, 358, 40, C.card, screenId, {
    rx: 20, shapes: [searchHintId],
    runtimeBindings: { inputBind: "$local.workoutSearch", onChange: "filterWorkouts" }
  });
  const searchHint = mkText(searchHintId, "Search_Hint", xO + 36, 80, 300, 40, "Search workouts...", 13, C.muted, searchId);
  objects[searchId] = search; objects[searchHintId] = searchHint;

  // Filter pills
  const filterRowId = crypto.randomUUID();
  const filterLabels = ["All", "Chest", "Back", "Legs", "Cardio"];
  const filterIds = filterLabels.map(() => crypto.randomUUID());
  const filterRow = mkFrame(filterRowId, "Filter_Row", xO + 16, 132, 358, 32, "transparent", screenId, filterIds);
  filterRow.layoutProps = { layout: "flex", layoutFlexDir: "row", layoutGap: 8 };
  filterLabels.forEach((lbl, i) => {
    const isActive = i === 0;
    const pillTxtId = crypto.randomUUID();
    const pill = mkRect(filterIds[i], `Filter_${lbl}`, xO + 16, 132, 60, 32,
      isActive ? C.primary : C.card, filterRowId, {
      rx: 16, shapes: [pillTxtId],
      runtimeBindings: {
        onClick: "filterWorkouts", onClickArgs: lbl,
        activeBind: "$local.workoutFilter", activeValue: lbl
      }
    });
    const pillTxt = mkText(pillTxtId, `FTxt_${lbl}`, xO + 16, 132, 60, 32, lbl, 12,
      isActive ? C.bg : C.secondary, filterIds[i], { bold: isActive });
    objects[filterIds[i]] = pill; objects[pillTxtId] = pillTxt;
  });
  objects[filterRowId] = filterRow;

  // Workout List repeater
  const listId = crypto.randomUUID();
  const listFrame = mkFrame(listId, "Workout_List", xO + 16, 180, 358, 572, "transparent", screenId, []);
  listFrame.layoutProps = { layout: "flex", layoutFlexDir: "column", layoutGap: 10 };
  listFrame.runtimeBindings = { repeatFor: "$local.workouts", repeatAs: "workout", dataSource: "workouts" };
  listFrame.scrollConfig = { behavior: "vertical" };
  objects[listId] = listFrame;
  listFrame.shapes.push(buildWorkoutCard(listId, xO + 16, 180, 358, "Push Day", 45, 320, "Chest", objects, true));

  // FAB
  const fabId = crypto.randomUUID();
  const fabTxtId = crypto.randomUUID();
  const fab = mkRect(fabId, "FAB_New_Workout", xO + 16, 756, 358, 48, C.primary, screenId, {
    rx: 24, shapes: [fabTxtId], runtimeBindings: { onClick: "openCreateWorkoutModal" }
  });
  const fabTxt = mkText(fabTxtId, "FAB_Txt", xO + 16, 756, 358, 48, "+ New Workout", 14, C.bg, fabId, { bold: true });
  objects[fabId] = fab; objects[fabTxtId] = fabTxt;

  const navId = buildBottomNav(screenId, xO, "workouts", objects);

  const screen = mkFrame(screenId, "Workouts", xO, 0, 390, 900, C.bg, ROOT_ID,
    [headerId, searchId, filterRowId, listId, fabId, navId]);
  screen.runtimeBindings = { onMount: "fetchWorkouts" };
  objects[screenId] = screen;
  return screenId;
}

// ─── Screen: Workout Detail ──────────────────────────────────────────────────

function buildWorkoutDetailScreen(objects) {
  const screenId = "pulse-workout-detail-screen";
  const xO = 840;

  const headerId = crypto.randomUUID();
  const backId = crypto.randomUUID();
  const wNameId = crypto.randomUUID();
  const header = mkFrame(headerId, "Header", xO, 0, 390, 64, C.surface, screenId, [backId, wNameId]);
  header.layoutProps = {
    layout: "flex", layoutFlexDir: "row", layoutGap: 12,
    layoutPaddingTop: 20, layoutPaddingLeft: 16
  };
  const back = mkText(backId, "Back_Btn", xO + 16, 20, 32, 24, "<-", 16, C.primary, headerId, {
    runtimeBindings: { onClick: "navigateWorkouts" }
  });
  const wName = mkText(wNameId, "Workout_Name", xO + 52, 20, 280, 24, "Push Day", 18, C.primary, headerId, {
    bold: true, runtimeBindings: { textBind: "$local.activeWorkout.name" }
  });
  objects[headerId] = header; objects[backId] = back; objects[wNameId] = wName;

  // Meta row
  const metaId = crypto.randomUUID();
  const mDurId = crypto.randomUUID();
  const mCalId = crypto.randomUUID();
  const meta = mkFrame(metaId, "Meta_Row", xO + 16, 76, 358, 48, C.card, screenId, [mDurId, mCalId]);
  meta.rx = 12;
  meta.layoutProps = {
    layout: "flex", layoutFlexDir: "row", layoutGap: 24,
    layoutPaddingTop: 12, layoutPaddingLeft: 20, layoutPaddingBottom: 12
  };
  const mDur = mkText(mDurId, "Meta_Dur", xO + 36, 88, 140, 22, "45 min", 14, C.primary, meta.id, {
    bold: true, runtimeBindings: { textBind: "$local.activeWorkout.duration_minutes" }
  });
  const mCal = mkText(mCalId, "Meta_Cal", xO + 180, 88, 140, 22, "320 kcal", 14, C.secondary, meta.id, {
    runtimeBindings: { textBind: "$local.activeWorkout.calories_burned" }
  });
  objects[metaId] = meta; objects[mDurId] = mDur; objects[mCalId] = mCal;

  // Description
  const descId = crypto.randomUUID();
  const desc = mkText(descId, "Workout_Desc", xO + 16, 136, 358, 32, "No description", 13, C.secondary, screenId, {
    runtimeBindings: { textBind: "$local.activeWorkout.description" }
  });
  objects[descId] = desc;

  // Exercise List repeater
  const exListId = crypto.randomUUID();
  const exTitleId = crypto.randomUUID();
  const exList = mkFrame(exListId, "Exercise_List", xO + 16, 180, 358, 468, "transparent", screenId, [exTitleId]);
  exList.layoutProps = { layout: "flex", layoutFlexDir: "column", layoutGap: 10 };
  exList.runtimeBindings = { repeatFor: "$local.activeWorkoutExercises", repeatAs: "exercise", dataSource: "workout_exercises" };
  exList.scrollConfig = { behavior: "vertical" };
  const exTitle = mkText(exTitleId, "Exercise_Title", xO + 16, 180, 310, 20, "Exercises", 14, C.primary, exListId, { bold: true });
  objects[exListId] = exList; objects[exTitleId] = exTitle;

  // Exercise row template
  const exRowId = crypto.randomUUID();
  const exNmId = crypto.randomUUID();
  const exMuscleId = crypto.randomUUID();
  const exSetsId = crypto.randomUUID();
  const exRow = mkFrame(exRowId, "Exercise_Row", xO + 16, 210, 358, 68, C.card, exListId, [exNmId, exMuscleId, exSetsId]);
  exRow.rx = 10;
  exRow.layoutProps = {
    layout: "flex", layoutFlexDir: "column", layoutGap: 3,
    layoutPaddingTop: 12, layoutPaddingLeft: 14, layoutPaddingRight: 14, layoutPaddingBottom: 12
  };
  const exNm = mkText(exNmId, "Ex_Name", xO + 30, 222, 310, 20, "Bench Press", 14, C.primary, exRowId, {
    bold: true, runtimeBindings: { textBind: "$exercise.name" }
  });
  const exMuscle = mkText(exMuscleId, "Ex_Muscle", xO + 30, 242, 200, 14, "Chest", 11, C.muted, exRowId, {
    runtimeBindings: { textBind: "$exercise.muscle_group" }
  });
  const exSets = mkText(exSetsId, "Ex_Sets", xO + 30, 258, 310, 16, "4 × 10 @ 80kg", 12, C.secondary, exRowId, {
    runtimeBindings: { textBind: "$exercise.sets_label" }
  });
  objects[exRowId] = exRow; objects[exNmId] = exNm;
  objects[exMuscleId] = exMuscle; objects[exSetsId] = exSets;
  exList.shapes.push(exRowId);

  // Start Workout CTA
  const startId = crypto.randomUUID();
  const startTxtId = crypto.randomUUID();
  const startBtn = mkRect(startId, "Start_Workout_Btn", xO + 16, 756, 358, 48, C.primary, screenId, {
    rx: 24, shapes: [startTxtId], runtimeBindings: { onClick: "startWorkout" }
  });
  const startTxt = mkText(startTxtId, "Start_Txt", xO + 16, 756, 358, 48, "Start Workout", 14, C.bg, startId, { bold: true });
  objects[startId] = startBtn; objects[startTxtId] = startTxt;

  const navId = buildBottomNav(screenId, xO, "workouts", objects);

  const screen = mkFrame(screenId, "WorkoutDetail", xO, 0, 390, 900, C.bg, ROOT_ID,
    [headerId, metaId, descId, exListId, startId, navId]);
  screen.runtimeBindings = { onMount: "fetchWorkoutDetail" };
  objects[screenId] = screen;
  return screenId;
}

// ─── Screen: Progress ────────────────────────────────────────────────────────

function buildProgressScreen(objects) {
  const screenId = "pulse-progress-screen";
  const xO = 1260;

  const headerId = crypto.randomUUID(); const titleId = crypto.randomUUID();
  const header = mkFrame(headerId, "Header", xO, 0, 390, 64, C.surface, screenId, [titleId]);
  header.layoutProps = {
    layout: "flex", layoutFlexDir: "row", layoutGap: 0,
    layoutPaddingTop: 20, layoutPaddingLeft: 20
  };
  const title = mkText(titleId, "Title", xO + 20, 20, 300, 28, "Progress", 22, C.primary, headerId, { bold: true });
  objects[headerId] = header; objects[titleId] = title;

  // Streak card
  const streakId = crypto.randomUUID();
  const streakNumId = crypto.randomUUID();
  const streakLblId = crypto.randomUUID();
  const streakCard = mkFrame(streakId, "Streak_Card", xO + 16, 76, 358, 68, C.card, screenId, [streakNumId, streakLblId]);
  streakCard.rx = 12;
  streakCard.layoutProps = {
    layout: "flex", layoutFlexDir: "row", layoutGap: 12,
    layoutPaddingTop: 14, layoutPaddingLeft: 20, layoutPaddingBottom: 14
  };
  const streakNum = mkText(streakNumId, "Streak_Num", xO + 36, 90, 70, 36, "12", 30, C.primary, streakId, {
    bold: true, runtimeBindings: { textBind: "$local.analytics.streak" }
  });
  const streakLbl = mkText(streakLblId, "Streak_Lbl", xO + 110, 90, 200, 36, "Day Streak", 14, C.secondary, streakId);
  objects[streakId] = streakCard; objects[streakNumId] = streakNum; objects[streakLblId] = streakLbl;

  // Weight Trend card
  const wGraphId = crypto.randomUUID();
  const wGraphTtlId = crypto.randomUUID();
  const wLatestId = crypto.randomUUID();
  const wGraphFrame = mkFrame(wGraphId, "Weight_Graph", xO + 16, 156, 358, 186, C.card, screenId, [wGraphTtlId, wLatestId]);
  wGraphFrame.rx = 12;
  wGraphFrame.runtimeBindings = { dataSource: "$local.weightTrend" };
  wGraphFrame.layoutProps = {
    layout: "flex", layoutFlexDir: "column", layoutGap: 8,
    layoutPaddingTop: 14, layoutPaddingLeft: 14, layoutPaddingRight: 14, layoutPaddingBottom: 14
  };
  const wGraphTtl = mkText(wGraphTtlId, "WGraph_Title", xO + 30, 170, 220, 18, "Weight Trend", 13, C.primary, wGraphId, { bold: true });
  const wLatest = mkText(wLatestId, "WGraph_Latest", xO + 220, 170, 114, 18, "72 kg", 13, C.success, wGraphId, {
    bold: true, runtimeBindings: { textBind: "$local.weightTrend[0].weight_kg" }
  });
  objects[wGraphId] = wGraphFrame; objects[wGraphTtlId] = wGraphTtl; objects[wLatestId] = wLatest;

  const barsContId = crypto.randomUUID();
  const barCont = mkFrame(barsContId, "Weight_Bars", xO + 30, 200, 322, 128, "transparent", wGraphId, []);
  barCont.layoutProps = { layout: "flex", layoutFlexDir: "row", layoutGap: 6, layoutPaddingTop: 8 };
  objects[barsContId] = barCont; wGraphFrame.shapes.push(barsContId);
  [74, 73.5, 73, 72.8, 72.5, 72.2, 72].forEach((w, i) => {
    const bId = crypto.randomUUID();
    const h = 40 + i * 12; // increasing height as weight decreases = trending down
    const bar = mkRect(bId, `W_Bar_${i}`, xO + 30 + i * 46, 328 - h, 40, h, i === 6 ? C.primary : C.surface, barsContId, { rx: 4 });
    objects[bId] = bar; barCont.shapes.push(bId);
  });

  // Workout Frequency dots
  const freqId = crypto.randomUUID();
  const freqTtlId = crypto.randomUUID();
  const freqFrame = mkFrame(freqId, "Freq_Card", xO + 16, 354, 358, 92, C.card, screenId, [freqTtlId]);
  freqFrame.rx = 12;
  freqFrame.layoutProps = {
    layout: "flex", layoutFlexDir: "column", layoutGap: 10,
    layoutPaddingTop: 14, layoutPaddingLeft: 14, layoutPaddingRight: 14
  };
  const freqTtl = mkText(freqTtlId, "Freq_Title", xO + 30, 368, 310, 18, "Workout Frequency", 13, C.primary, freqId, { bold: true });
  objects[freqId] = freqFrame; objects[freqTtlId] = freqTtl;

  const freqRowId = crypto.randomUUID();
  const freqRow = mkFrame(freqRowId, "Freq_Row", xO + 30, 398, 322, 36, "transparent", freqId, []);
  freqRow.layoutProps = { layout: "flex", layoutFlexDir: "row", layoutGap: 8 };
  objects[freqRowId] = freqRow; freqFrame.shapes.push(freqRowId);
  [true, true, false, true, true, false, false].forEach((done, i) => {
    const dId = crypto.randomUUID();
    const dot = mkRect(dId, `Freq_Dot_${i}`, xO + 30 + i * 46, 398, 36, 36, done ? C.primary : C.card, freqRowId, { rx: 18 });
    objects[dId] = dot; freqRow.shapes.push(dId);
  });

  // Body Stats — FIX: use flex row properly, values bound to $user.*
  const measId = crypto.randomUUID();
  const measTtlId = crypto.randomUUID();
  const measFrame = mkFrame(measId, "Body_Stats", xO + 16, 458, 358, 108, C.card, screenId, [measTtlId]);
  measFrame.rx = 12;
  measFrame.layoutProps = {
    layout: "flex", layoutFlexDir: "column", layoutGap: 10,
    layoutPaddingTop: 14, layoutPaddingLeft: 14, layoutPaddingRight: 14, layoutPaddingBottom: 14
  };
  const measTtl = mkText(measTtlId, "Meas_Title", xO + 30, 472, 310, 18, "Body Stats", 13, C.primary, measId, { bold: true });
  objects[measId] = measFrame; objects[measTtlId] = measTtl;

  const measRowId = crypto.randomUUID();
  const measRow = mkFrame(measRowId, "Meas_Row", xO + 30, 498, 322, 52, "transparent", measId, []);
  measRow.layoutProps = { layout: "flex", layoutFlexDir: "row", layoutGap: 0 };
  objects[measRowId] = measRow; measFrame.shapes.push(measRowId);

  [
    ["Height", "178 cm", "$user.height_cm"],
    ["Weight", "72 kg", "$user.weight_kg"],
    ["Age", "21 yr", null],
  ].forEach(([lbl, val, bind]) => {
    const itemId = crypto.randomUUID();
    const lId = crypto.randomUUID();
    const vId = crypto.randomUUID();
    const item = mkFrame(itemId, `BStat_${lbl}`, xO + 30, 498, 107, 52, "transparent", measRowId, [lId, vId]);
    item.layoutProps = { layout: "flex", layoutFlexDir: "column", layoutGap: 4, layoutPaddingTop: 2 };
    const l = mkText(lId, `BStat_Lbl_${lbl}`, xO + 30, 498, 100, 14, lbl, 11, C.secondary, itemId);
    const valExtra = bind ? { bold: true, runtimeBindings: { textBind: bind } } : { bold: true };
    const v = mkText(vId, `BStat_Val_${lbl}`, xO + 30, 516, 100, 22, val, 16, C.primary, itemId, valExtra);
    objects[itemId] = item; objects[lId] = l; objects[vId] = v;
    measRow.shapes.push(itemId);
  });

  // Log Weight CTA
  const logBtnId = crypto.randomUUID();
  const logBtnTxtId = crypto.randomUUID();
  const logBtn = mkRect(logBtnId, "Log_Weight_Btn", xO + 16, 756, 358, 48, C.primary, screenId, {
    rx: 24, shapes: [logBtnTxtId], runtimeBindings: { onClick: "openLogWeightModal" }
  });
  const logBtnTxt = mkText(logBtnTxtId, "Log_Btn_Txt", xO + 16, 756, 358, 48, "Log Today's Weight", 14, C.bg, logBtnId, { bold: true });
  objects[logBtnId] = logBtn; objects[logBtnTxtId] = logBtnTxt;

  const navId = buildBottomNav(screenId, xO, "progress", objects);

  const screen = mkFrame(screenId, "Progress", xO, 0, 390, 900, C.bg, ROOT_ID,
    [headerId, streakId, wGraphId, freqId, measId, logBtnId, navId]);
  screen.runtimeBindings = { onMount: "fetchProgressData" };
  objects[screenId] = screen;
  return screenId;
}

// ─── Screen: Goals ───────────────────────────────────────────────────────────

function buildGoalsScreen(objects) {
  const screenId = "pulse-goals-screen";
  const xO = 1680;

  const headerId = crypto.randomUUID(); const titleId = crypto.randomUUID();
  const header = mkFrame(headerId, "Header", xO, 0, 390, 64, C.surface, screenId, [titleId]);
  header.layoutProps = {
    layout: "flex", layoutFlexDir: "row", layoutGap: 0,
    layoutPaddingTop: 20, layoutPaddingLeft: 20
  };
  const title = mkText(titleId, "Title", xO + 20, 20, 300, 28, "Goals", 22, C.primary, headerId, { bold: true });
  objects[headerId] = header; objects[titleId] = title;

  // Goals List repeater
  const goalsListId = crypto.randomUUID();
  const goalsList = mkFrame(goalsListId, "Goals_List", xO + 16, 76, 358, 660, "transparent", screenId, []);
  goalsList.layoutProps = { layout: "flex", layoutFlexDir: "column", layoutGap: 12 };
  goalsList.runtimeBindings = { repeatFor: "$local.goals", repeatAs: "goal", dataSource: "goals" };
  goalsList.scrollConfig = { behavior: "vertical" };
  objects[goalsListId] = goalsList;
  goalsList.shapes.push(buildGoalCard(goalsListId, xO + 16, 76, 358, "Lose 5kg", 72, 65, "kg", 67, objects, true));

  // Create Goal Modal — FIX: hidden by default
  const modalId = crypto.randomUUID();
  const mTitleId = crypto.randomUUID();
  const mNameLblId = crypto.randomUUID();
  const mNameInpId = crypto.randomUUID();
  const mTgtLblId = crypto.randomUUID();
  const mTgtInpId = crypto.randomUUID();
  const mDlLblId = crypto.randomUUID();
  const mDlInpId = crypto.randomUUID();
  const mBtnId = crypto.randomUUID();
  const mBtnTxtId = crypto.randomUUID();
  const mCloseBtnId = crypto.randomUUID();
  const mCloseTxtId = crypto.randomUUID();

  const modal = mkFrame(modalId, "Create_Goal_Modal", xO + 20, 200, 350, 440, C.card, screenId, [
    mTitleId, mNameLblId, mNameInpId, mTgtLblId, mTgtInpId, mDlLblId, mDlInpId, mBtnId, mCloseBtnId
  ], { hidden: true }); // FIX: hidden by default, shown by visibleBind
  modal.rx = 16;
  modal.strokes = [{ strokeColor: C.border, strokeWidth: 1, strokeAlignment: "CENTER" }];
  modal.layoutProps = {
    layout: "flex", layoutFlexDir: "column", layoutGap: 14,
    layoutPaddingTop: 24, layoutPaddingLeft: 24, layoutPaddingRight: 24, layoutPaddingBottom: 24
  };
  modal.runtimeBindings = { visibleBind: "$local._modals.createGoal.open" };

  const mTitle = mkText(mTitleId, "Modal_Title", xO + 44, 224, 302, 24, "Create New Goal", 16, C.primary, modalId, { bold: true });
  const mNameLbl = mkText(mNameLblId, "Name_Lbl", xO + 44, 264, 302, 16, "Goal Name", 12, C.secondary, modalId);
  const mNameInp = mkRect(mNameInpId, "Name_Input", xO + 44, 292, 302, 40, C.surface, modalId, {
    rx: 8, runtimeBindings: { inputBind: "$form.goalName" }
  });
  const mTgtLbl = mkText(mTgtLblId, "Target_Lbl", xO + 44, 344, 302, 16, "Target Value", 12, C.secondary, modalId);
  const mTgtInp = mkRect(mTgtInpId, "Target_Input", xO + 44, 372, 302, 40, C.surface, modalId, {
    rx: 8, runtimeBindings: { inputBind: "$form.goalTarget" }
  });
  const mDlLbl = mkText(mDlLblId, "Deadline_Lbl", xO + 44, 424, 302, 16, "Deadline", 12, C.secondary, modalId);
  const mDlInp = mkRect(mDlInpId, "Deadline_Input", xO + 44, 452, 302, 40, C.surface, modalId, {
    rx: 8, runtimeBindings: { inputBind: "$form.goalDeadline" }
  });
  const mBtn = mkRect(mBtnId, "Create_Btn", xO + 44, 504, 302, 44, C.primary, modalId, {
    rx: 22, shapes: [mBtnTxtId], runtimeBindings: { onClick: "createGoal" }
  });
  const mBtnTxt = mkText(mBtnTxtId, "Create_Btn_Txt", xO + 44, 504, 302, 44, "Create Goal", 14, C.bg, mBtnId, { bold: true });
  const mCloseBtn = mkRect(mCloseBtnId, "Close_Btn", xO + 44, 560, 302, 36, C.surface, modalId, {
    rx: 18, shapes: [mCloseTxtId], runtimeBindings: { onClick: "closeCreateGoalModal" }
  });
  const mCloseTxt = mkText(mCloseTxtId, "Close_Txt", xO + 44, 560, 302, 36, "Cancel", 13, C.secondary, mCloseBtnId);

  objects[modalId] = modal; objects[mTitleId] = mTitle;
  objects[mNameLblId] = mNameLbl; objects[mNameInpId] = mNameInp;
  objects[mTgtLblId] = mTgtLbl; objects[mTgtInpId] = mTgtInp;
  objects[mDlLblId] = mDlLbl; objects[mDlInpId] = mDlInp;
  objects[mBtnId] = mBtn; objects[mBtnTxtId] = mBtnTxt;
  objects[mCloseBtnId] = mCloseBtn; objects[mCloseTxtId] = mCloseTxt;

  // FAB
  const fabId = crypto.randomUUID();
  const fabTxtId = crypto.randomUUID();
  const fab = mkRect(fabId, "FAB_New_Goal", xO + 16, 756, 358, 48, C.primary, screenId, {
    rx: 24, shapes: [fabTxtId], runtimeBindings: { onClick: "openCreateGoalModal" }
  });
  const fabTxt = mkText(fabTxtId, "FAB_Txt", xO + 16, 756, 358, 48, "+ New Goal", 14, C.bg, fabId, { bold: true });
  objects[fabId] = fab; objects[fabTxtId] = fabTxt;

  const navId = buildBottomNav(screenId, xO, "goals", objects);

  const screen = mkFrame(screenId, "Goals", xO, 0, 390, 900, C.bg, ROOT_ID,
    [headerId, goalsListId, modalId, fabId, navId]);
  screen.runtimeBindings = { onMount: "fetchGoals" };
  objects[screenId] = screen;
  return screenId;
}

// ─── Screen: Analytics ───────────────────────────────────────────────────────

function buildAnalyticsScreen(objects) {
  const screenId = "pulse-analytics-screen";
  const xO = 2100;

  const headerId = crypto.randomUUID(); const titleId = crypto.randomUUID();
  const header = mkFrame(headerId, "Header", xO, 0, 390, 64, C.surface, screenId, [titleId]);
  header.layoutProps = {
    layout: "flex", layoutFlexDir: "row", layoutGap: 0,
    layoutPaddingTop: 20, layoutPaddingLeft: 20
  };
  const title = mkText(titleId, "Title", xO + 20, 20, 300, 28, "Analytics", 22, C.primary, headerId, { bold: true });
  objects[headerId] = header; objects[titleId] = title;

  // FIX: Stats row — 4 equal-width cards in a row
  const statsRowId = crypto.randomUUID();
  const statsRow = mkFrame(statsRowId, "Stats_Row", xO + 16, 76, 358, 78, "transparent", screenId, []);
  statsRow.layoutProps = { layout: "flex", layoutFlexDir: "row", layoutGap: 10 };
  objects[statsRowId] = statsRow;

  [
    ["Workouts", "48", "total", "$local.analytics.total_workouts"],
    ["Calories", "12.4k", "kcal", "$local.analytics.calories_burned"],
    ["Time", "36h", "logged", "$local.analytics.hours"],
    ["Streak", "12", "days", "$local.analytics.streak"],
  ].forEach(([lbl, val, sub, bind]) => {
    const cId = buildKPICard(statsRowId, xO + 16, 76, 79, 78, lbl, val, sub, bind, objects);
    statsRow.shapes.push(cId);
  });

  // Weekly Activity Chart
  const weekChartId = crypto.randomUUID();
  const weekChartTtlId = crypto.randomUUID();
  const weekChart = mkFrame(weekChartId, "Weekly_Activity_Chart", xO + 16, 166, 358, 156, C.card, screenId, [weekChartTtlId]);
  weekChart.rx = 12;
  weekChart.runtimeBindings = { dataSource: "$local.weeklyWorkouts" };
  weekChart.layoutProps = {
    layout: "flex", layoutFlexDir: "column", layoutGap: 10,
    layoutPaddingTop: 14, layoutPaddingLeft: 14, layoutPaddingRight: 14, layoutPaddingBottom: 14
  };
  const weekChartTtl = mkText(weekChartTtlId, "WeekChart_Title", xO + 30, 180, 310, 18, "Weekly Activity", 13, C.primary, weekChartId, { bold: true });
  objects[weekChartId] = weekChart; objects[weekChartTtlId] = weekChartTtl;

  const wBarsId = crypto.randomUUID();
  const wBars = mkFrame(wBarsId, "WBars", xO + 30, 206, 322, 102, "transparent", weekChartId, []);
  wBars.layoutProps = { layout: "flex", layoutFlexDir: "row", layoutGap: 8, layoutPaddingTop: 6 };
  objects[wBarsId] = wBars; weekChart.shapes.push(wBarsId);
  [55, 80, 65, 90, 70, 40, 60].forEach((h, i) => {
    const bId = crypto.randomUUID();
    const bar = mkRect(bId, `AWBar_${i}`, xO + 30 + i * 46, 308 - h, 38, h, i === 3 ? C.primary : C.surface, wBarsId, { rx: 4 });
    objects[bId] = bar; wBars.shapes.push(bId);
  });

  // Monthly Calories Chart
  const calChartId = crypto.randomUUID();
  const calChartTtlId = crypto.randomUUID();
  const calChart = mkFrame(calChartId, "Monthly_Calories_Chart", xO + 16, 334, 358, 136, C.card, screenId, [calChartTtlId]);
  calChart.rx = 12;
  calChart.runtimeBindings = { dataSource: "$local.caloriesTrend" };
  calChart.layoutProps = {
    layout: "flex", layoutFlexDir: "column", layoutGap: 8,
    layoutPaddingTop: 14, layoutPaddingLeft: 14, layoutPaddingRight: 14, layoutPaddingBottom: 14
  };
  const calChartTtl = mkText(calChartTtlId, "CalChart_Title", xO + 30, 348, 310, 18, "Monthly Calories", 13, C.primary, calChartId, { bold: true });
  objects[calChartId] = calChart; objects[calChartTtlId] = calChartTtl;

  const calBarsId = crypto.randomUUID();
  const calBars = mkFrame(calBarsId, "CalBars", xO + 30, 374, 322, 82, "transparent", calChartId, []);
  calBars.layoutProps = { layout: "flex", layoutFlexDir: "row", layoutGap: 4, layoutPaddingTop: 6 };
  objects[calBarsId] = calBars; calChart.shapes.push(calBarsId);
  [60, 80, 70, 90, 65, 85, 75, 95, 70, 88, 80, 100].forEach((h, i) => {
    const bId = crypto.randomUUID();
    const bar = mkRect(bId, `CalBar_${i}`, xO + 30 + i * 27, 456 - h, 22, h, i === 11 ? C.primary : C.surface, calBarsId, { rx: 3 });
    objects[bId] = bar; calBars.shapes.push(bId);
  });

  // Muscle Group Breakdown
  const muscleId = crypto.randomUUID();
  const muscleTtlId = crypto.randomUUID();
  const muscleFrame = mkFrame(muscleId, "Muscle_Breakdown", xO + 16, 482, 358, 300, C.card, screenId, [muscleTtlId]);
  muscleFrame.rx = 12;
  muscleFrame.layoutProps = {
    layout: "flex", layoutFlexDir: "column", layoutGap: 12,
    layoutPaddingTop: 14, layoutPaddingLeft: 14, layoutPaddingRight: 14, layoutPaddingBottom: 14
  };
  const muscleTtl = mkText(muscleTtlId, "Muscle_Title", xO + 30, 496, 310, 18, "Muscle Group Breakdown", 13, C.primary, muscleId, { bold: true });
  objects[muscleId] = muscleFrame; objects[muscleTtlId] = muscleTtl;

  [["Chest", 85], ["Back", 72], ["Legs", 60], ["Shoulders", 55], ["Arms", 78]].forEach(([grp, pct]) => {
    muscleFrame.shapes.push(buildProgressBar(muscleId, xO + 30, 520, 326, grp, pct, null, null, objects));
  });

  const navId = buildBottomNav(screenId, xO, "analytics", objects);

  const screen = mkFrame(screenId, "Analytics", xO, 0, 390, 900, C.bg, ROOT_ID,
    [headerId, statsRowId, weekChartId, calChartId, muscleId, navId]);
  screen.runtimeBindings = { onMount: "fetchAnalytics" };
  objects[screenId] = screen;
  return screenId;
}

// ─── Screen: Profile ────────────────────────────────────────────────────────

function buildProfileScreen(objects) {
  const screenId = "pulse-profile-screen";
  const xO = 2520;

  const headerId = crypto.randomUUID(); const titleId = crypto.randomUUID();
  const header = mkFrame(headerId, "Header", xO, 0, 390, 64, C.surface, screenId, [titleId]);
  header.layoutProps = {
    layout: "flex", layoutFlexDir: "row", layoutGap: 0,
    layoutPaddingTop: 20, layoutPaddingLeft: 20
  };
  const title = mkText(titleId, "Title", xO + 20, 20, 300, 28, "Profile", 22, C.primary, headerId, { bold: true });
  objects[headerId] = header; objects[titleId] = title;

  // Avatar + name + email (column, centered)
  const avatarSecId = crypto.randomUUID();
  const bigAvatarId = crypto.randomUUID();
  const userNameId = crypto.randomUUID();
  const userEmailId = crypto.randomUUID();
  const avatarSec = mkFrame(avatarSecId, "Avatar_Section", xO + 16, 76, 358, 120, "transparent", screenId,
    [bigAvatarId, userNameId, userEmailId]);
  avatarSec.layoutProps = {
    layout: "flex", layoutFlexDir: "column", layoutGap: 6,
    layoutPaddingTop: 16, layoutPaddingLeft: 16, layoutPaddingRight: 16
  };
  const bigAvatar = mkRect(bigAvatarId, "Big_Avatar", xO + 179 - 28, 92, 56, 56, C.card, avatarSecId, { rx: 28 });
  const userName = mkText(userNameId, "User_Name", xO + 16, 156, 326, 24, "Madhava", 18, C.primary, avatarSecId, {
    bold: true, runtimeBindings: { textBind: "$user.name" }
  });
  const userEmail = mkText(userEmailId, "User_Email", xO + 16, 182, 326, 16, "manimadhava43@gmail.com", 13, C.secondary, avatarSecId, {
    runtimeBindings: { textBind: "$user.email" }
  });
  objects[avatarSecId] = avatarSec; objects[bigAvatarId] = bigAvatar;
  objects[userNameId] = userName; objects[userEmailId] = userEmail;

  // FIX: Profile stats row — proper flex row with 3 equal items, values bound to $user.*
  const pStatsId = crypto.randomUUID();
  const pStats = mkFrame(pStatsId, "Profile_Stats", xO + 16, 208, 358, 72, C.card, screenId, []);
  pStats.rx = 12;
  pStats.layoutProps = { layout: "flex", layoutFlexDir: "row", layoutGap: 0 };
  objects[pStatsId] = pStats;

  [
    ["Height", "178 cm", "$user.height_cm"],
    ["Weight", "72 kg", "$user.weight_kg"],
    ["Age", "21 yr", null],
  ].forEach(([lbl, val, bind]) => {
    const itemId = crypto.randomUUID();
    const lId = crypto.randomUUID();
    const vId = crypto.randomUUID();
    const item = mkFrame(itemId, `PStat_${lbl}`, xO + 16, 208, 119, 72, "transparent", pStatsId, [lId, vId]);
    item.layoutProps = {
      layout: "flex", layoutFlexDir: "column", layoutGap: 4,
      layoutPaddingTop: 12, layoutPaddingLeft: 14, layoutPaddingBottom: 12
    };
    const l = mkText(lId, `PStat_Lbl_${lbl}`, xO + 16, 208, 100, 14, lbl, 11, C.secondary, itemId);
    const valExtra = bind ? { bold: true, runtimeBindings: { textBind: bind } } : { bold: true };
    const v = mkText(vId, `PStat_Val_${lbl}`, xO + 16, 226, 100, 22, val, 16, C.primary, itemId, valExtra);
    objects[itemId] = item; objects[lId] = l; objects[vId] = v;
    pStats.shapes.push(itemId);
  });

  // Settings list
  const settingsId = crypto.randomUUID();
  const settingsFrame = mkFrame(settingsId, "Settings_List", xO + 16, 292, 358, 296, C.card, screenId, []);
  settingsFrame.rx = 12;
  settingsFrame.layoutProps = { layout: "flex", layoutFlexDir: "column", layoutGap: 0 };
  objects[settingsId] = settingsFrame;

  [
    ["Edit Profile", "editProfile"],
    ["Notification Prefs", "editNotifications"],
    ["Units & Preferences", "editPreferences"],
    ["Privacy & Data", "editPrivacy"],
    ["Log Out", "logout"],
  ].forEach(([label, action], i) => {
    const rowId = crypto.randomUUID();
    const rowTxtId = crypto.randomUUID();
    const isLast = i === 4;
    const rowRect = mkRect(rowId, `Setting_${label}`, xO + 16, 308 + i * 52, 358, 52, "transparent", settingsId, {
      strokes: isLast ? [] : [{ strokeColor: C.border, strokeWidth: 1, strokeAlignment: "BOTTOM" }],
      shapes: [rowTxtId],
      runtimeBindings: { onClick: action }
    });
    const rowTxt = mkText(rowTxtId, `STxt_${label}`, xO + 30, 308 + i * 52, 320, 52,
      label, 14, label === "Log Out" ? C.danger : C.primary, rowId);
    objects[rowId] = rowRect; objects[rowTxtId] = rowTxt;
    settingsFrame.shapes.push(rowId);
  });

  const navId = buildBottomNav(screenId, xO, "profile", objects);

  const screen = mkFrame(screenId, "Profile", xO, 0, 390, 900, C.bg, ROOT_ID,
    [headerId, avatarSecId, pStatsId, settingsId, navId]);
  screen.runtimeBindings = { onMount: "fetchUserProfile" };
  objects[screenId] = screen;
  return screenId;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  console.log("Connected to DB...");

  const fileRes = await client.query("SELECT * FROM files WHERE project_id = $1 LIMIT 1", [PID]);
  let fileRow;
  if (!fileRes.rows.length) {
    const fileId = crypto.randomUUID();
    const defaultData = {
      pages: ["page1"],
      colors: {},
      components: {},
      pagesIndex: {
        page1: {
          id: "page1",
          name: "Page 1",
          flows: [],
          objects: {
            "00000000-0000-0000-0000-000000000000": {
              x: 0,
              y: 0,
              id: "00000000-0000-0000-0000-000000000000",
              name: "Root Frame",
              type: "frame",
              fills: [],
              width: 0,
              height: 0,
              shapes: [],
              frameId: "00000000-0000-0000-0000-000000000000",
              opacity: 1,
              strokes: [],
              parentId: null,
              rotation: 0
            }
          }
        }
      },
      typographies: {}
    };
    const insertRes = await client.query(
      "INSERT INTO files (id, project_id, name, data, revn) VALUES ($1, $2, $3, $4::jsonb, 1) RETURNING *",
      [fileId, PID, "Pulse Design", JSON.stringify(defaultData)]
    );
    fileRow = insertRes.rows[0];
  } else {
    fileRow = fileRes.rows[0];
  }
  const fileData = fileRow.data;
  const pageId = fileData.pages[0];
  const objects = fileData.pagesIndex[pageId].objects;
  const root = objects[ROOT_ID];

  const dashId = buildDashboardScreen(objects);
  const workoutsId = buildWorkoutsScreen(objects);
  const detailId = buildWorkoutDetailScreen(objects);
  const progressId = buildProgressScreen(objects);
  const goalsId = buildGoalsScreen(objects);
  const analyticsId = buildAnalyticsScreen(objects);
  const profileId = buildProfileScreen(objects);

  root.shapes.push(dashId, workoutsId, detailId, progressId, goalsId, analyticsId, profileId);

  await client.query("UPDATE files SET data = $1 WHERE id = $2", [JSON.stringify(fileData), fileRow.id]);
  console.log("Canvas saved.");

  // ─── Runtime Schema ──────────────────────────────────────────────────────

  const schemaRes = await client.query("SELECT * FROM runtime_schemas WHERE project_id = $1 LIMIT 1", [PID]);
  let schema = schemaRes.rows.length
    ? (typeof schemaRes.rows[0].schema_json === "string"
      ? JSON.parse(schemaRes.rows[0].schema_json)
      : schemaRes.rows[0].schema_json)
    : { id: PID };

  schema.database = {
    provider: "mint",
    tables: [
      {
        id: "t-users", name: "users",
        fields: [
          { name: "id", type: "uuid", primaryKey: true, required: true },
          { name: "email", type: "text", required: true, unique: true },
          { name: "name", type: "text", required: true },
          { name: "avatar", type: "text" },
          { name: "gender", type: "text" },
          { name: "birth_date", type: "date" },
          { name: "height_cm", type: "numeric" },
          { name: "weight_kg", type: "numeric" },
          { name: "created_at", type: "timestamp", defaultValue: "now()" },
          { name: "updated_at", type: "timestamp", defaultValue: "now()" }
        ]
      },
      {
        id: "t-workouts", name: "workouts",
        fields: [
          { name: "id", type: "uuid", primaryKey: true, required: true },
          { name: "user_id", type: "uuid", references: "users.id" },
          { name: "name", type: "text", required: true },
          { name: "description", type: "text" },
          { name: "duration_minutes", type: "integer" },
          { name: "calories_burned", type: "integer" },
          { name: "muscle_group", type: "text" },   // FIX: was missing, caused fetchWorkouts to fail
          { name: "started_at", type: "timestamp" },
          { name: "ended_at", type: "timestamp" },
          { name: "created_at", type: "timestamp", defaultValue: "now()" }
        ]
      },
      {
        id: "t-exercises", name: "exercises",
        fields: [
          { name: "id", type: "uuid", primaryKey: true, required: true },
          { name: "name", type: "text", required: true },
          { name: "muscle_group", type: "text" },
          { name: "equipment", type: "text" },
          { name: "description", type: "text" },
          { name: "created_at", type: "timestamp", defaultValue: "now()" }
        ]
      },
      {
        id: "t-workout-exercises", name: "workout_exercises",
        fields: [
          { name: "id", type: "uuid", primaryKey: true, required: true },
          { name: "workout_id", type: "uuid", references: "workouts.id" },
          { name: "exercise_id", type: "uuid", references: "exercises.id" },
          { name: "sets", type: "integer" },
          { name: "reps", type: "integer" },
          { name: "weight", type: "numeric" },
          { name: "sets_label", type: "text" },
          { name: "created_at", type: "timestamp", defaultValue: "now()" }
        ]
      },
      {
        id: "t-goals", name: "goals",
        fields: [
          { name: "id", type: "uuid", primaryKey: true, required: true },
          { name: "user_id", type: "uuid", references: "users.id" },
          { name: "title", type: "text", required: true },
          { name: "target_value", type: "numeric" },
          { name: "current_value", type: "numeric" },
          { name: "pct_complete", type: "numeric" },
          { name: "goal_type", type: "text" },
          { name: "deadline", type: "date" },
          { name: "status", type: "text", defaultValue: "active" },
          { name: "created_at", type: "timestamp", defaultValue: "now()" }
        ]
      },
      {
        id: "t-weight-logs", name: "weight_logs",
        fields: [
          { name: "id", type: "uuid", primaryKey: true, required: true },
          { name: "user_id", type: "uuid", references: "users.id" },
          { name: "weight_kg", type: "numeric", required: true },
          { name: "logged_at", type: "timestamp", defaultValue: "now()" }
        ]
      },
      {
        id: "t-activity-logs", name: "activity_logs",
        fields: [
          { name: "id", type: "uuid", primaryKey: true, required: true },
          { name: "user_id", type: "uuid", references: "users.id" },
          { name: "steps", type: "integer" },
          { name: "distance", type: "numeric" },
          { name: "calories", type: "integer" },
          { name: "logged_at", type: "timestamp", defaultValue: "now()" }
        ]
      }
    ]
  };

  schema.globalState = [
    {
      id: "gs-user", name: "user", type: "object", defaultValue: {
        id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890", name: "Madhava", email: "manimadhava43@gmail.com",
        height_cm: 178, weight_kg: 72
      }
    },
    {
      id: "gs-form", name: "form", type: "object", defaultValue: {
        goalName: "", goalTarget: "", goalDeadline: "",
        weightLog: "", workoutName: "", workoutDesc: "", caloriesBurned: 0
      }
    },
    {
      id: "gs-local", name: "local", type: "object", defaultValue: {
        greeting: "Good Morning, Madhava",
        workouts: [],
        recentWorkouts: [],
        activeWorkout: null,
        activeWorkoutExercises: [],
        todayActivity: { duration_minutes: 0, steps: 0, calories: 0 },
        goals: [],
        weightTrend: [],
        weeklyWorkouts: [],
        caloriesTrend: [],
        analytics: { total_workouts: 0, calories_burned: 0, hours: 0, streak: 0 },
        _modals: {
          createGoal: { open: false },  // FIX: default false
          logWeight: { open: false },
          createWorkout: { open: false }
        },
        workoutSearch: "",
        workoutFilter: "All"
      }
    }
  ];

  schema.globalActions = [
    // Navigation
    { id: "act-nav-dash", name: "navigateDashboard", type: "navigate", config: { target: "/dashboard" } },
    { id: "act-nav-workouts", name: "navigateWorkouts", type: "navigate", config: { target: "/workouts" } },
    { id: "act-nav-progress", name: "navigateProgress", type: "navigate", config: { target: "/progress" } },
    { id: "act-nav-goals", name: "navigateGoals", type: "navigate", config: { target: "/goals" } },
    { id: "act-nav-analytics", name: "navigateAnalytics", type: "navigate", config: { target: "/analytics" } },
    { id: "act-nav-profile", name: "navigateProfile", type: "navigate", config: { target: "/profile" } },
    { id: "act-nav-detail", name: "navigateWorkoutDetail", type: "navigate", config: { target: "/workouts/detail" } },

    // Workouts — FIX: removed muscle_group from SELECT so query works even without migration
    {
      id: "act-fetch-workouts", name: "fetchWorkouts", type: "fetch", config: {
        url: "/api/db/{projectId}", method: "POST",
        body: {
          sql: "SELECT id, name, description, duration_minutes, calories_burned, muscle_group, created_at FROM workouts WHERE user_id = $1 ORDER BY created_at DESC",
          params: ["$user.id"]
        },
        onSuccess: "SET $local.workouts = $result.rows"
      }
    },
    {
      id: "act-fetch-recent", name: "fetchRecentWorkouts", type: "fetch", config: {
        url: "/api/db/{projectId}", method: "POST",
        body: {
          sql: "SELECT id, name, description, duration_minutes, calories_burned, muscle_group, created_at FROM workouts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5",
          params: ["$user.id"]
        },
        onSuccess: "SET $local.recentWorkouts = $result.rows"
      }
    },
    {
      id: "act-create-workout", name: "createWorkout", type: "fetch", config: {
        url: "/api/db/{projectId}", method: "POST",
        body: {
          sql: "INSERT INTO workouts (name, description, user_id) VALUES ($1, $2, $3) RETURNING *",
          params: ["$form.workoutName", "$form.workoutDesc", "$user.id"]
        },
        onSuccess: "CALL fetchWorkouts; SET $form.workoutName = ''; CALL closeCreateWorkoutModal"
      }
    },
    {
      id: "act-delete-workout", name: "deleteWorkout", type: "fetch", config: {
        url: "/api/db/{projectId}", method: "POST",
        body: { sql: "DELETE FROM workouts WHERE id = $1", params: ["$workout.id"] },
        onSuccess: "CALL fetchWorkouts"
      }
    },
    {
      id: "act-open-workout", name: "openWorkoutDetail", type: "setState", config: {
        path: "local.activeWorkout", value: "$args.0",
        also: "CALL fetchWorkoutDetail; CALL navigateWorkoutDetail"
      }
    },
    {
      id: "act-fetch-detail", name: "fetchWorkoutDetail", type: "fetch", config: {
        url: "/api/db/{projectId}", method: "POST",
        body: {
          sql: `SELECT we.*, e.name, e.muscle_group,
                    we.sets || ' × ' || we.reps || ' @ ' || COALESCE(we.weight::text,'bw') || 'kg' AS sets_label
                    FROM workout_exercises we JOIN exercises e ON we.exercise_id = e.id
                    WHERE we.workout_id = $1`,
          params: ["$local.activeWorkout.id"]
        },
        onSuccess: "SET $local.activeWorkoutExercises = $result.rows"
      }
    },
    {
      id: "act-start-workout", name: "startWorkout", type: "fetch", config: {
        url: "/api/db/{projectId}", method: "POST",
        body: {
          sql: "UPDATE workouts SET started_at = now() WHERE id = $1 RETURNING *",
          params: ["$local.activeWorkout.id"]
        },
        onSuccess: "SET $local.activeWorkout = $result.rows[0]"
      }
    },
    {
      id: "act-complete-workout", name: "completeWorkout", type: "fetch", config: {
        url: "/api/db/{projectId}", method: "POST",
        body: {
          sql: "UPDATE workouts SET ended_at = now(), calories_burned = $2 WHERE id = $1 RETURNING *",
          params: ["$local.activeWorkout.id", "$form.caloriesBurned"]
        },
        onSuccess: "CALL fetchWorkouts; CALL fetchAnalytics"
      }
    },
    { id: "act-filter-workouts", name: "filterWorkouts", type: "setState", config: { path: "local.workoutFilter", value: "$args.0" } },
    { id: "act-open-create-workout", name: "openCreateWorkoutModal", type: "setState", config: { path: "local._modals.createWorkout.open", value: true } },
    { id: "act-close-create-workout", name: "closeCreateWorkoutModal", type: "setState", config: { path: "local._modals.createWorkout.open", value: false } },

    // Goals
    {
      id: "act-fetch-goals", name: "fetchGoals", type: "fetch", config: {
        url: "/api/db/{projectId}", method: "POST",
        body: {
          sql: `SELECT *, ROUND((current_value::numeric / NULLIF(target_value::numeric, 0)) * 100) AS pct_complete
                    FROM goals WHERE user_id = $1 AND status = 'active' ORDER BY created_at DESC`,
          params: ["$user.id"]
        },
        onSuccess: "SET $local.goals = $result.rows"
      }
    },
    {
      id: "act-create-goal", name: "createGoal", type: "fetch", config: {
        url: "/api/db/{projectId}", method: "POST",
        body: {
          sql: "INSERT INTO goals (user_id, title, target_value, deadline, status) VALUES ($1, $2, $3, $4, 'active') RETURNING *",
          params: ["$user.id", "$form.goalName", "$form.goalTarget", "$form.goalDeadline"]
        },
        onSuccess: "CALL fetchGoals; SET $form.goalName = ''; SET $form.goalTarget = ''; CALL closeCreateGoalModal"
      }
    },
    {
      id: "act-archive-goal", name: "archiveGoal", type: "fetch", config: {
        url: "/api/db/{projectId}", method: "POST",
        body: { sql: "UPDATE goals SET status = 'archived' WHERE id = $1", params: ["$goal.id"] },
        onSuccess: "CALL fetchGoals"
      }
    },
    { id: "act-open-goal-modal", name: "openCreateGoalModal", type: "setState", config: { path: "local._modals.createGoal.open", value: true } },
    { id: "act-close-goal-modal", name: "closeCreateGoalModal", type: "setState", config: { path: "local._modals.createGoal.open", value: false } },

    // Progress / Weight
    {
      id: "act-fetch-progress", name: "fetchProgressData", type: "setState", config: {
        also: "CALL fetchWeightTrend; CALL fetchWeeklyWorkouts; CALL fetchAnalytics",
        path: "dummy", value: ""
      }
    },
    {
      id: "act-fetch-weight", name: "fetchWeightTrend", type: "fetch", config: {
        url: "/api/db/{projectId}", method: "POST",
        body: {
          sql: "SELECT * FROM weight_logs WHERE user_id = $1 ORDER BY logged_at DESC LIMIT 30",
          params: ["$user.id"]
        },
        onSuccess: "SET $local.weightTrend = $result.rows"
      }
    },
    {
      id: "act-log-weight", name: "logWeight", type: "fetch", config: {
        url: "/api/db/{projectId}", method: "POST",
        body: {
          sql: "INSERT INTO weight_logs (user_id, weight_kg) VALUES ($1, $2) RETURNING *",
          params: ["$user.id", "$form.weightLog"]
        },
        onSuccess: "CALL fetchWeightTrend; SET $form.weightLog = ''; CALL closeLogWeightModal"
      }
    },
    { id: "act-open-log-weight", name: "openLogWeightModal", type: "setState", config: { path: "local._modals.logWeight.open", value: true } },
    { id: "act-close-log-weight", name: "closeLogWeightModal", type: "setState", config: { path: "local._modals.logWeight.open", value: false } },
    {
      id: "act-fetch-weekly", name: "fetchWeeklyWorkouts", type: "fetch", config: {
        url: "/api/db/{projectId}", method: "POST",
        body: {
          sql: `SELECT date_trunc('day', created_at) AS day, COUNT(*) AS count
                    FROM workouts WHERE user_id = $1 AND created_at > now() - interval '7 days'
                    GROUP BY day ORDER BY day`,
          params: ["$user.id"]
        },
        onSuccess: "SET $local.weeklyWorkouts = $result.rows"
      }
    },

    // Analytics
    {
      id: "act-fetch-analytics", name: "fetchAnalytics", type: "fetch", config: {
        url: "/api/db/{projectId}", method: "POST",
        body: {
          sql: `SELECT COUNT(*) AS total_workouts,
                    COALESCE(SUM(calories_burned),0) AS calories_burned,
                    COALESCE(ROUND(SUM(duration_minutes)/60.0),0) AS hours,
                    (SELECT COUNT(DISTINCT date_trunc('day', created_at))
                     FROM workouts WHERE user_id = $1
                     AND created_at > now() - interval '30 days') AS streak
                    FROM workouts WHERE user_id = $1`,
          params: ["$user.id"]
        },
        onSuccess: "SET $local.analytics = $result.rows[0]"
      }
    },
    {
      id: "act-fetch-cal-trend", name: "fetchCaloriesTrend", type: "fetch", config: {
        url: "/api/db/{projectId}", method: "POST",
        body: {
          sql: `SELECT date_trunc('month', created_at) AS month, SUM(calories_burned) AS total
                    FROM workouts WHERE user_id = $1 AND created_at > now() - interval '12 months'
                    GROUP BY month ORDER BY month`,
          params: ["$user.id"]
        },
        onSuccess: "SET $local.caloriesTrend = $result.rows"
      }
    },

    // Profile
    {
      id: "act-fetch-profile", name: "fetchUserProfile", type: "fetch", config: {
        url: "/api/db/{projectId}", method: "POST",
        body: { sql: "SELECT * FROM users WHERE id = $1 LIMIT 1", params: ["$user.id"] },
        onSuccess: "SET $user = $result.rows[0]"
      }
    },
    {
      id: "act-fetch-today", name: "fetchTodayActivity", type: "fetch", config: {
        url: "/api/db/{projectId}", method: "POST",
        body: {
          sql: `SELECT COALESCE(SUM(steps),0) AS steps, COALESCE(SUM(calories),0) AS calories,
                    COALESCE(SUM(distance::numeric),0) AS distance
                    FROM activity_logs WHERE user_id = $1 AND logged_at::date = CURRENT_DATE`,
          params: ["$user.id"]
        },
        onSuccess: "SET $local.todayActivity = $result.rows[0]"
      }
    },
    { id: "act-edit-profile", name: "editProfile", type: "navigate", config: { target: "/profile/edit" } },
    { id: "act-logout", name: "logout", type: "navigate", config: { target: "/login" } },
    { id: "act-notif-prefs", name: "editNotifications", type: "navigate", config: { target: "/profile/notifications" } },
    { id: "act-prefs", name: "editPreferences", type: "navigate", config: { target: "/profile/preferences" } },
    { id: "act-privacy", name: "editPrivacy", type: "navigate", config: { target: "/profile/privacy" } },

    // Dashboard init
    {
      id: "act-fetch-dash", name: "fetchDashboardData", type: "setState", config: {
        also: "CALL fetchRecentWorkouts; CALL fetchGoals; CALL fetchWeeklyWorkouts; CALL fetchTodayActivity; CALL fetchAnalytics",
        path: "dummy", value: ""
      }
    }
  ];

  schema.navigation = {
    type: "stack",
    initialRoute: "/dashboard",
    routes: [
      { path: "/dashboard", screenId: dashId },
      { path: "/workouts", screenId: workoutsId },
      { path: "/workouts/detail", screenId: detailId },
      { path: "/progress", screenId: progressId },
      { path: "/goals", screenId: goalsId },
      { path: "/analytics", screenId: analyticsId },
      { path: "/profile", screenId: profileId }
    ]
  };

  await client.query(
    `INSERT INTO runtime_schemas (project_id, schema_json, updated_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (project_id)
     DO UPDATE SET schema_json = $2, updated_at = now(), updated_by = $3`,
    [PID, JSON.stringify(schema), "4a3114bc-d622-4cf6-afe6-2c251b563091"]
  );
  console.log("Runtime schema saved.");

  // ─── Compile & Commit ────────────────────────────────────────────────────

  const topFrameIds = [dashId, workoutsId, detailId, progressId, goalsId, analyticsId, profileId];
  const nodes = topFrameIds.map(id => {
    const f = objects[id];
    return shapeToNode(f, f.x, f.y, objects);
  });
  console.log("Compiled nodes:", nodes.length);

  let userRes = await client.query("SELECT id FROM users WHERE email = 'manimadhava43@gmail.com' LIMIT 1");
  let userId;
  if (!userRes.rows.length) {
    userId = crypto.randomUUID();
    await client.query(
      "INSERT INTO users (id, email, password_hash, salt) VALUES ($1, $2, $3, $4)",
      [userId, "manimadhava43@gmail.com", "dummyhash", "dummysalt"]
    );
    console.log("Created user.");
  } else {
    userId = userRes.rows[0].id;
  }

  const sessionToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await client.query(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)",
    [sessionToken, userId, expiresAt]
  );

  await client.end();

  const body = {
    projectId: PID,
    fileId: fileRow.id,
    targetFramework: "nextjs",
    fileName: "pulse-fitness-tracker",
    nodes,
    interactions: [],
    runtimeSchema: schema,
    message: "Pulse v3 — fix progress bar overlap, profile stats row, modal hidden default, search hint placement, muscle_group column"
  };

  console.log("Committing...");
  const response = await fetch("http://localhost:3001/api/commit", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Cookie": `token=${sessionToken}` },
    body: JSON.stringify(body)
  });

  const resData = await response.json();
  console.log("Commit status:", response.status);
  console.log("Response:", resData);
  if (response.status !== 201) throw new Error(`Commit failed: ${JSON.stringify(resData)}`);
  console.log("Pulse seed v3 completed successfully!");
}

main().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});