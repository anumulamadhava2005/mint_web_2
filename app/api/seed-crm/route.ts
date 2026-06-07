import { NextResponse } from "next/server";
import crypto from "crypto";
import db from "../../../lib/db";

const PID = "824dc83d-e86a-454f-bd76-cee24bf7b81c";
const ROOT_ID = "00000000-0000-0000-0000-000000000000";

function mkFrame(id: string, name: string, x: number, y: number, w: number, h: number, fill: string | null, parentId: string, children: string[] = [], extra: any = {}) {
  return {
    id,
    name,
    type: "frame",
    x,
    y,
    width: w,
    height: h,
    fills: fill ? [{ fillColor: fill, fillOpacity: 1 }] : [],
    strokes: [],
    opacity: 1,
    rotation: 0,
    shapes: children,
    frameId: parentId || ROOT_ID,
    parentId: parentId || ROOT_ID,
    hidden: false,
    locked: false,
    showContent: true,
    ...extra
  };
}

function mkRect(id: string, name: string, x: number, y: number, w: number, h: number, fill: string | null, parentId: string, extra: any = {}) {
  return {
    id,
    name,
    type: "rect",
    x,
    y,
    width: w,
    height: h,
    fills: fill ? [{ fillColor: fill, fillOpacity: 1 }] : [],
    strokes: [],
    opacity: 1,
    rotation: 0,
    shapes: [],
    frameId: parentId,
    parentId: parentId,
    hidden: false,
    locked: false,
    ...extra
  };
}

function mkText(id: string, name: string, x: number, y: number, w: number, h: number, txt: string, fs: number, color: string, parentId: string, extra: any = {}) {
  return {
    id,
    name,
    type: "text",
    x,
    y,
    width: w,
    height: h,
    fills: color ? [{ fillColor: color, fillOpacity: 1 }] : [],
    strokes: [],
    opacity: 1,
    rotation: 0,
    shapes: [],
    frameId: parentId,
    parentId: parentId,
    hidden: false,
    locked: false,
    content: {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [
            {
              text: txt,
              fontFamily: "Inter",
              fontSize: fs,
              fontWeight: extra.bold ? 700 : 400,
              fill: color
            }
          ]
        }
      ]
    },
    ...extra
  };
}

function cleanEmojis(str: string) {
  if (typeof str !== "string") return str;
  let s = str;
  s = s.replace(/⚡/g, "");
  s = s.replace(/📊/g, "");
  s = s.replace(/👥/g, "");
  s = s.replace(/🔄/g, "");
  s = s.replace(/🟢/g, "*");
  s = s.replace(/🔵/g, "*");
  s = s.replace(/🟡/g, "*");
  return s.trim();
}

function shapeToNode(shape: any, parentX: number, parentY: number, objects: any): any {
  const r = (n: number) => Math.round(n * 10) / 10;
  
  const node: any = {
    id: shape.id,
    name: shape.name,
    type: mapShapeType(shape.type),
    x: r(shape.x - parentX),
    y: r(shape.y - parentY),
    width: r(shape.width),
    height: r(shape.height),
    visible: !shape.hidden,
  };

  if (shape.rotation) node.rotation = shape.rotation;
  if (shape.opacity !== undefined && shape.opacity !== 1) node.opacity = shape.opacity;

  if (shape.fills?.length) {
    node.fills = shape.fills.map((f: any) => ({
      type: f.fillColorGradient ? "GRADIENT_LINEAR" : "SOLID",
      color: f.fillColor,
      opacity: f.fillOpacity,
    }));
  }

  if (shape.strokes?.length) {
    node.strokes = shape.strokes.map((s: any) => ({
      color: s.strokeColor,
      opacity: s.strokeOpacity,
      weight: s.strokeWidth,
      align: s.strokeAlignment?.toUpperCase() || "CENTER",
    }));
  }

  if (shape.rx || shape.ry) {
    node.corners = { uniform: shape.rx || shape.ry };
  }

  if (shape.type === "text" && shape.content) {
    const textVal = shape.content.children
      ? shape.content.children.flatMap((p: any) => p.children ? p.children.map((r: any) => r.text) : []).join("\n")
      : "";
    
    const firstPara = shape.content.children?.[0];
    const firstRun = firstPara?.children?.[0];
    
    node.text = {
      characters: textVal,
      fontFamily: firstRun?.fontFamily || "Inter",
      fontSize: firstRun?.fontSize || 14,
      fontWeight: firstRun?.fontWeight || 400,
      color: firstRun?.fill || shape.fills?.[0]?.fillColor || "#ffffff",
    };
  }

  if (shape.layoutProps?.layout) {
    const lp = shape.layoutProps;
    node.layout = {
      mode: lp.layout === "flex" ? (lp.layoutFlexDir === "column" ? "VERTICAL" : "HORIZONTAL") : "NONE",
      gap: lp.layoutGap,
      paddingTop: lp.layoutPaddingTop,
      paddingRight: lp.layoutPaddingRight,
      paddingBottom: lp.layoutPaddingBottom,
      paddingLeft: lp.layoutPaddingLeft,
    };
  }

  if (shape.shapes?.length) {
    const kids = shape.shapes.map((id: string) => objects[id]).filter((s: any) => !!s && !s.hidden);
    if (kids.length > 0) {
      node.children = kids.map((k: any) => shapeToNode(k, shape.x, shape.y, objects));
    }
  }

  if (shape.runtimeBindings) {
    node.pluginData = { runtimeBindings: shape.runtimeBindings };
  }

  return node;
}

function mapShapeType(kind: string) {
  const map: Record<string, string> = {
    frame: "FRAME",
    group: "GROUP",
    rect: "RECTANGLE",
    circle: "ELLIPSE",
    text: "TEXT",
  };
  return map[kind] || "FRAME";
}

export async function GET() {
  try {
    // 1. Fetch current file canvas row
    const fileRes = await db.query("SELECT * FROM files WHERE project_id = $1 LIMIT 1", [PID]);
    if (!fileRes.rows.length) {
      return NextResponse.json({ error: "CRM file not found in files table" }, { status: 404 });
    }
    const fileRow = fileRes.rows[0];
    const fileData = fileRow.data;
    const pageId = fileData.pages[0];
    const objects = fileData.pagesIndex[pageId].objects;
    const root = objects[ROOT_ID];

    // Clean Emojis in all existing shapes
    for (const [id, obj] of Object.entries(objects)) {
      const anyObj = obj as any;
      if (anyObj.type === "text" && anyObj.content?.children) {
        for (const para of anyObj.content.children) {
          if (para.children) {
            for (const run of para.children) {
              if (run.text) {
                run.text = cleanEmojis(run.text);
              }
            }
          }
        }
      }
    }

    // 2. Build Sidebar items update helper
    function setNavColor(shape: any, isActive: boolean) {
      if (!shape) return;
      const color = isActive ? "#e5e7eb" : "#9ca3af";
      shape.fills = [{ fillColor: color, fillOpacity: 1 }];
      if (shape.content?.children?.[0]?.children?.[0]) {
        shape.content.children[0].children[0].fill = color;
      }
    }

    function buildSidebar(screenId: string, xOffset: number, activeTab: string) {
      const sbId = crypto.randomUUID();
      const logoId = crypto.randomUUID();
      const dashId = crypto.randomUUID();
      const contId = crypto.randomUUID();
      const pipeId = crypto.randomUUID();
      const campId = crypto.randomUUID();
      const tickId = crypto.randomUUID();

      const sb = mkFrame(sbId, "Sidebar", xOffset, 0, 240, 900, "#111827", screenId, [
        logoId, dashId, contId, pipeId, campId, tickId
      ]);

      const logo = mkText(logoId, "Logo", xOffset + 24, 28, 120, 28, "CRM Pro", 18, "#818cf8", sbId, { bold: true });
      const dash = mkText(dashId, "Nav Dashboard", xOffset + 24, 80, 180, 20, "Dashboard", 14, activeTab === "dashboard" ? "#e5e7eb" : "#9ca3af", sbId, {
        runtimeBindings: { onClick: "navigateDashboard" }
      });
      const cont = mkText(contId, "Nav Contacts", xOffset + 24, 114, 180, 20, "Contacts", 14, activeTab === "contacts" ? "#e5e7eb" : "#9ca3af", sbId, {
        runtimeBindings: { onClick: "navigateContacts" }
      });
      const pipe = mkText(pipeId, "Nav Pipeline", xOffset + 24, 148, 180, 20, "Pipeline", 14, activeTab === "pipeline" ? "#e5e7eb" : "#9ca3af", sbId, {
        runtimeBindings: { onClick: "navigatePipeline" }
      });
      const camp = mkText(campId, "Nav Campaigns", xOffset + 24, 182, 180, 20, "Campaigns", 14, activeTab === "campaigns" ? "#e5e7eb" : "#9ca3af", sbId, {
        runtimeBindings: { onClick: "navigateCampaigns" }
      });
      const tick = mkText(tickId, "Nav Tickets", xOffset + 24, 216, 180, 20, "Tickets", 14, activeTab === "tickets" ? "#e5e7eb" : "#9ca3af", sbId, {
        runtimeBindings: { onClick: "navigateTickets" }
      });

      objects[sbId] = sb;
      objects[logoId] = logo;
      objects[dashId] = dash;
      objects[contId] = cont;
      objects[pipeId] = pipe;
      objects[campId] = camp;
      objects[tickId] = tick;

      return sbId;
    }

    function buildHeader(screenId: string, xOffset: number, title: string) {
      const hdId = crypto.randomUUID();
      const tId = crypto.randomUUID();
      const avatarId = crypto.randomUUID();

      const hd = mkFrame(hdId, "Header", xOffset + 240, 0, 1160, 64, "#1f2937", screenId, [tId, avatarId]);
      const t = mkText(tId, "Title", xOffset + 264, 20, 200, 24, title, 20, "#f9fafb", hdId, { bold: true });
      const avatar = mkRect(avatarId, "Avatar", xOffset + 1348, 16, 32, 32, "#818cf8", hdId, { rx: 16 });

      objects[hdId] = hd;
      objects[tId] = t;
      objects[avatarId] = avatar;

      return hdId;
    }

    // 3. Update Existing Screen Sidebars
    const existingScreens = [
      { id: "786f0946-18f0-40ba-a952-313bdd374c50", tab: "dashboard" },
      { id: "6b5c3518-8e94-4a19-93dd-f63b42642137", tab: "contacts" },
      { id: "437d19ff-7655-4a67-9d3c-b5388671eeef", tab: "pipeline" }
    ];

    existingScreens.forEach(scInfo => {
      const screen = objects[scInfo.id] as any;
      if (!screen) return;
      const oldSbId = screen.shapes.find((id: string) => (objects[id] as any)?.name === "Sidebar");
      
      // Replace with completely fresh and updated sidebar
      const newSbId = buildSidebar(scInfo.id, screen.x, scInfo.tab);
      screen.shapes = screen.shapes.filter((id: string) => id !== oldSbId);
      screen.shapes.unshift(newSbId);
    });

    // 4. Dashboard Updates: Activity Feed resize + AI Agent Terminal
    const dashScreen = objects["786f0946-18f0-40ba-a952-313bdd374c50"] as any;
    const feedId = dashScreen.shapes.find((id: string) => (objects[id] as any)?.name === "Activity Feed" || (objects[id] as any)?.name === "Activity");
    const feed = objects[feedId] as any;
    if (feed) {
      feed.width = 720;
      const itemId = feed.shapes.find((id: string) => (objects[id] as any)?.name === "Activity Item" || (objects[id] as any)?.name === "Act1");
      const item = objects[itemId] as any;
      if (item) {
        item.width = 680;
        const txtId = item.shapes.find((id: string) => (objects[id] as any)?.name === "Detail Text");
        const txt = objects[txtId] as any;
        if (txt) txt.width = 500;
      }
    }

    // Create AI Agent Terminal
    const aiFrameId = "ai-agent-terminal-frame";
    const aiTitleId = "ai-terminal-title-txt";
    const aiDescId = "ai-terminal-desc-txt";
    const aiInputId = "ai-terminal-input-field";
    const aiBtnId = "ai-terminal-btn-field";
    const aiBtnTxtId = "ai-terminal-btn-txt-field";
    const aiRespContId = "ai-terminal-resp-container";
    const aiRespTxtId = "ai-terminal-resp-txt-field";

    const aiFrame = mkFrame(aiFrameId, "AI Agent Assistant", 1008, 576, 368, 280, "#1e293b", "786f0946-18f0-40ba-a952-313bdd374c50", [
      aiTitleId, aiDescId, aiInputId, aiBtnId, aiRespContId
    ]);
    aiFrame.layoutProps = { layout: "flex", layoutFlexDir: "column", layoutGap: 12, layoutPaddingTop: 16, layoutPaddingRight: 16, layoutPaddingBottom: 16, layoutPaddingLeft: 16 };

    const aiTitle = mkText(aiTitleId, "AI Terminal Title", 1024, 592, 336, 20, "AI Agent Terminal", 14, "#ffffff", aiFrameId, { bold: true });
    const aiDesc = mkText(aiDescId, "AI Terminal Description", 1024, 624, 336, 16, "Generate mock follow-up email templates.", 11, "#94a3b8", aiFrameId);
    const aiInput = mkRect(aiInputId, "AI Prompt Input", 1024, 652, 336, 36, "#0f172a", aiFrameId, { rx: 4, runtimeBindings: { inputBind: "$local.aiAgentPrompt" } });
    const aiBtn = mkRect(aiBtnId, "AI Action Button", 1024, 700, 140, 32, "#818cf8", aiFrameId, { rx: 4, runtimeBindings: { onClick: "callAIAgent" }, shapes: [aiBtnTxtId] });
    const aiBtnTxt = mkText(aiBtnTxtId, "Button Text", 1024, 700, 140, 32, "Run AI Agent", 12, "#ffffff", aiBtnId, { bold: true });

    const aiRespCont = mkFrame(aiRespContId, "AI Response Container", 1024, 744, 336, 100, "#0f172a", aiFrameId, [aiRespTxtId], { scrollConfig: { behavior: "vertical" } });
    aiRespCont.layoutProps = { layout: "flex", layoutFlexDir: "column", layoutGap: 4, layoutPaddingTop: 8, layoutPaddingRight: 8, layoutPaddingBottom: 8, layoutPaddingLeft: 8 };
    const aiRespTxt = mkText(aiRespTxtId, "AI Response Text", 1032, 752, 320, 80, "Enter a prompt and run...", 11, "#34d399", aiRespContId, { fontFamily: "Courier New" });
    aiRespTxt.runtimeBindings = { textBind: "$local.aiAgentResponse" };

    objects[aiFrameId] = aiFrame;
    objects[aiTitleId] = aiTitle;
    objects[aiDescId] = aiDesc;
    objects[aiInputId] = aiInput;
    objects[aiBtnId] = aiBtn;
    objects[aiBtnTxtId] = aiBtnTxt;
    objects[aiRespContId] = aiRespCont;
    objects[aiRespTxtId] = aiRespTxt;

    if (!dashScreen.shapes.includes(aiFrameId)) {
      dashScreen.shapes.push(aiFrameId);
    }

    // 5. Contacts Drawer Slider Section
    const contactsScreen = objects["6b5c3518-8e94-4a19-93dd-f63b42642137"] as any;
    
    // Set row background onClick to select active contact
    for (const [id, obj] of Object.entries(objects)) {
      const anyObj = obj as any;
      if (anyObj.parentId === "23a49c25-8ace-45eb-be2b-83809908609f" && anyObj.name.startsWith("Row ")) {
        anyObj.runtimeBindings = {
          ...anyObj.runtimeBindings,
          onClick: "selectActiveContact"
        };
      }
    }

    const drawerId = "contact-details-drawer";
    const dHeaderRowId = "drawer-header-row";
    const dTitleId = "drawer-title";
    const dCloseBtnId = "drawer-close-btn";
    const dCloseTxtId = "drawer-close-txt";
    const dInfoSectionId = "drawer-info-section";
    const dInfoNameId = "drawer-info-name";
    const dInfoEmailId = "drawer-info-email";
    const dInfoCompanyId = "drawer-info-company";
    const dScrollContId = "drawer-scroll-container";

    const dIntSectionId = "drawer-interactions-section";
    const dIntTitleId = "interactions-title";
    const dIntInputId = "interaction-input";
    const dIntBtnId = "interaction-log-btn";
    const dIntBtnTxtId = "interaction-log-btn-txt";
    const dIntListId = "interactions-list";
    const dIntRowId = "interaction-row";
    const dIntDescId = "interaction-desc";
    const dIntDateId = "interaction-date";

    const dDocSectionId = "drawer-documents-section";
    const dDocTitleId = "documents-title";
    const dDocInputId = "document-input";
    const dDocBtnId = "document-add-btn";
    const dDocBtnTxtId = "document-add-btn-txt";
    const dDocListId = "documents-list";
    const dDocRowId = "doc-row";
    const dDocNameId = "doc-name-txt";
    const dDocTypeId = "doc-type-txt";

    const dQuoteSectionId = "drawer-quotes-section";
    const dQuoteTitleId = "quotes-title";
    const dQuoteInputId = "quote-input";
    const dQuoteBtnId = "quote-add-btn";
    const dQuoteBtnTxtId = "quote-add-btn-txt";
    const dQuoteListId = "quotes-list";
    const dQuoteRowId = "quote-row";
    const dQuoteLblId = "quote-lbl-val";
    const dQuoteValId = "quote-val-txt";

    const drawer = mkFrame(drawerId, "Contact Details Drawer", 950, 0, 450, 900, "#1e293b", "6b5c3518-8e94-4a19-93dd-f63b42642137", [
      dHeaderRowId, dInfoSectionId, dScrollContId
    ]);
    drawer.strokes = [{ strokeColor: "#334155", strokeWidth: 1, strokeAlignment: "CENTER" }] as any;
    drawer.runtimeBindings = { visibleBind: "$local.activeContact" };
    drawer.layoutProps = { layout: "flex", layoutFlexDir: "column", layoutGap: 16, layoutPaddingTop: 24, layoutPaddingRight: 24, layoutPaddingBottom: 24, layoutPaddingLeft: 24 };

    const dHeaderRow = mkFrame(dHeaderRowId, "Header Row", 950, 24, 402, 40, null, drawerId, [dTitleId, dCloseBtnId]);
    dHeaderRow.layoutProps = { layout: "flex", layoutFlexDir: "row", layoutGap: 16 };
    const dTitle = mkText(dTitleId, "Drawer Title", 950, 24, 250, 24, "Contact Profile", 18, "#f8fafc", dHeaderRowId, { bold: true });
    const dCloseBtn = mkRect(dCloseBtnId, "Close Button", 1210, 24, 60, 28, "#334155", dHeaderRowId, { rx: 4, runtimeBindings: { onClick: "closeActiveContact" }, shapes: [dCloseTxtId] });
    const dCloseTxt = mkText(dCloseTxtId, "Close", 1210, 24, 60, 28, "Close", 12, "#e2e8f0", dCloseBtnId, { bold: true });

    const dInfoSection = mkFrame(dInfoSectionId, "Contact Info Section", 950, 80, 402, 100, null, drawerId, [dInfoNameId, dInfoEmailId, dInfoCompanyId]);
    dInfoSection.layoutProps = { layout: "flex", layoutFlexDir: "column", layoutGap: 8 };
    const dInfoName = mkText(dInfoNameId, "Info Name", 950, 80, 400, 24, "Name", 20, "#ffffff", dInfoSectionId, { bold: true, runtimeBindings: { textBind: "$local.activeContact.name" } });
    const dInfoEmail = mkText(dInfoEmailId, "Info Email", 950, 112, 400, 20, "Email", 14, "#94a3b8", dInfoSectionId, { runtimeBindings: { textBind: "$local.activeContact.email" } });
    const dInfoCompany = mkText(dInfoCompanyId, "Info Company", 950, 140, 400, 20, "Company", 14, "#e2e8f0", dInfoSectionId, { runtimeBindings: { textBind: "$local.activeContact.company" } });

    const dScrollCont = mkFrame(dScrollContId, "Scroll Container", 950, 196, 402, 650, null, drawerId, [dIntSectionId, dDocSectionId, dQuoteSectionId], { scrollConfig: { behavior: "vertical" } });
    dScrollCont.layoutProps = { layout: "flex", layoutFlexDir: "column", layoutGap: 24 };

    const dIntSection = mkFrame(dIntSectionId, "Interactions Section", 950, 196, 400, 250, null, dScrollContId, [dIntTitleId, dIntInputId, dIntBtnId, dIntListId]);
    dIntSection.layoutProps = { layout: "flex", layoutFlexDir: "column", layoutGap: 12 };
    const dIntTitle = mkText(dIntTitleId, "Interactions Title", 950, 196, 400, 20, "Interaction Logs", 14, "#f8fafc", dIntSectionId, { bold: true });
    const dIntInput = mkRect(dIntInputId, "Interaction Input", 950, 228, 400, 40, "#0f172a", dIntSectionId, { rx: 4, runtimeBindings: { inputBind: "$local.newInteraction.description" } });
    const dIntBtn = mkRect(dIntBtnId, "Log Interaction Button", 950, 280, 120, 32, "#818cf8", dIntSectionId, { rx: 4, runtimeBindings: { onClick: "addInteraction" }, shapes: [dIntBtnTxtId] });
    const dIntBtnTxt = mkText(dIntBtnTxtId, "Log Button Text", 950, 280, 120, 32, "Log Call/Email", 12, "#ffffff", dIntBtnId, { bold: true });

    const dIntList = mkFrame(dIntListId, "Interactions List", 950, 324, 400, 150, null, dIntSectionId, [dIntRowId]);
    dIntList.layoutProps = { layout: "flex", layoutFlexDir: "column", layoutGap: 8 };
    dIntList.runtimeBindings = { repeatFor: "$local.activeContactInteractions", repeatAs: "interaction", dataSource: "interactions" };

    const dIntRow = mkFrame(dIntRowId, "Interaction Row", 950, 324, 400, 44, "#334155", dIntListId, [dIntDescId, dIntDateId]);
    dIntRow.rx = 4;
    dIntRow.layoutProps = { layout: "flex", layoutFlexDir: "column", layoutGap: 4, layoutPaddingTop: 8, layoutPaddingLeft: 8 };
    const dIntDesc = mkText(dIntDescId, "Interaction Description", 950, 324, 380, 18, "Description", 13, "#f1f5f9", dIntRowId, { runtimeBindings: { textBind: "$interaction.description" } });
    const dIntDate = mkText(dIntDateId, "Interaction Date", 950, 346, 380, 16, "Date", 11, "#94a3b8", dIntRowId, { runtimeBindings: { textBind: "$interaction.created_at" } });

    const dDocSection = mkFrame(dDocSectionId, "Documents Section", 950, 470, 400, 250, null, dScrollContId, [dDocTitleId, dDocInputId, dDocBtnId, dDocListId]);
    dDocSection.layoutProps = { layout: "flex", layoutFlexDir: "column", layoutGap: 12 };
    const dDocTitle = mkText(dDocTitleId, "Documents Title", 950, 470, 400, 20, "Documents & Invoices", 14, "#f8fafc", dDocSectionId, { bold: true });
    const dDocInput = mkRect(dDocInputId, "Document Name Input", 950, 502, 400, 40, "#0f172a", dDocSectionId, { rx: 4, runtimeBindings: { inputBind: "$local.newDocument.name" } });
    const dDocBtn = mkRect(dDocBtnId, "Add Document Button", 950, 554, 120, 32, "#818cf8", dDocSectionId, { rx: 4, runtimeBindings: { onClick: "addDocument" }, shapes: [dDocBtnTxtId] });
    const dDocBtnTxt = mkText(dDocBtnTxtId, "Add Doc Text", 950, 554, 120, 32, "Add Document", 12, "#ffffff", dDocBtnId, { bold: true });

    const dDocList = mkFrame(dDocListId, "Documents List", 950, 598, 400, 150, null, dDocSectionId, [dDocRowId]);
    dDocList.layoutProps = { layout: "flex", layoutFlexDir: "column", layoutGap: 8 };
    dDocList.runtimeBindings = { repeatFor: "$local.activeContactDocuments", repeatAs: "doc", dataSource: "documents" };

    const dDocRow = mkFrame(dDocRowId, "Doc Row", 950, 598, 400, 44, "#334155", dDocListId, [dDocNameId, dDocTypeId]);
    dDocRow.rx = 4;
    dDocRow.layoutProps = { layout: "flex", layoutFlexDir: "column", layoutGap: 4, layoutPaddingTop: 8, layoutPaddingLeft: 8 };
    const dDocName = mkText(dDocNameId, "Doc Name", 950, 598, 380, 18, "Contract/Proposal", 13, "#f1f5f9", dDocRowId, { runtimeBindings: { textBind: "$doc.name" } });
    const dDocType = mkText(dDocTypeId, "Doc Type", 950, 620, 380, 16, "Type", 11, "#94a3b8", dDocRowId, { runtimeBindings: { textBind: "$doc.type" } });

    const dQuoteSection = mkFrame(dQuoteSectionId, "Quotes Section", 950, 744, 400, 250, null, dScrollContId, [dQuoteTitleId, dQuoteInputId, dQuoteBtnId, dQuoteListId]);
    dQuoteSection.layoutProps = { layout: "flex", layoutFlexDir: "column", layoutGap: 12 };
    const dQuoteTitle = mkText(dQuoteTitleId, "Quotes Title", 950, 744, 400, 20, "Pricing Quotes", 14, "#f8fafc", dQuoteSectionId, { bold: true });
    const dQuoteInput = mkRect(dQuoteInputId, "Quote Total Input", 950, 776, 400, 40, "#0f172a", dQuoteSectionId, { rx: 4, runtimeBindings: { inputBind: "$local.newQuote.total" } });
    const dQuoteBtn = mkRect(dQuoteBtnId, "Generate Quote Button", 950, 828, 140, 32, "#34d399", dQuoteSectionId, { rx: 4, runtimeBindings: { onClick: "addQuote" }, shapes: [dQuoteBtnTxtId] });
    const dQuoteBtnTxt = mkText(dQuoteBtnTxtId, "Gen Quote Text", 950, 828, 140, 32, "Generate Quote", 12, "#0f172a", dQuoteBtnId, { bold: true });

    const dQuoteList = mkFrame(dQuoteListId, "Quotes List", 950, 872, 400, 150, null, dQuoteSectionId, [dQuoteRowId]);
    dQuoteList.layoutProps = { layout: "flex", layoutFlexDir: "column", layoutGap: 8 };
    dQuoteList.runtimeBindings = { repeatFor: "$local.activeContactQuotes", repeatAs: "quoteItem", dataSource: "quotes" };

    const dQuoteRow = mkFrame(dQuoteRowId, "Quote Row", 950, 872, 400, 44, "#334155", dQuoteListId, [dQuoteLblId, dQuoteValId]);
    dQuoteRow.rx = 4;
    dQuoteRow.layoutProps = { layout: "flex", layoutFlexDir: "row", layoutGap: 8, layoutPaddingTop: 12, layoutPaddingLeft: 8 };
    const dQuoteLbl = mkText(dQuoteLblId, "Quote Label", 950, 872, 120, 18, "Quote Value: $", 13, "#f1f5f9", dQuoteRowId);
    const dQuoteVal = mkText(dQuoteValId, "Quote Value", 1078, 872, 100, 18, "0", 13, "#34d399", dQuoteRowId, { bold: true, runtimeBindings: { textBind: "$quoteItem.total" } });

    objects[drawerId] = drawer;
    objects[dHeaderRowId] = dHeaderRow;
    objects[dTitleId] = dTitle;
    objects[dCloseBtnId] = dCloseBtn;
    objects[dCloseTxtId] = dCloseTxt;
    objects[dInfoSectionId] = dInfoSection;
    objects[dInfoNameId] = dInfoName;
    objects[dInfoEmailId] = dInfoEmail;
    objects[dInfoCompanyId] = dInfoCompany;
    objects[dScrollContId] = dScrollCont;
    objects[dIntSectionId] = dIntSection;
    objects[dIntTitleId] = dIntTitle;
    objects[dIntInputId] = dIntInput;
    objects[dIntBtnId] = dIntBtn;
    objects[dIntBtnTxtId] = dIntBtnTxt;
    objects[dIntListId] = dIntList;
    objects[dIntRowId] = dIntRow;
    objects[dIntDescId] = dIntDesc;
    objects[dIntDateId] = dIntDate;
    objects[dDocSectionId] = dDocSection;
    objects[dDocTitleId] = dDocTitle;
    objects[dDocInputId] = dDocInput;
    objects[dDocBtnId] = dDocBtn;
    objects[dDocBtnTxtId] = dDocBtnTxt;
    objects[dDocListId] = dDocList;
    objects[dDocRowId] = dDocRow;
    objects[dDocNameId] = dDocName;
    objects[dDocTypeId] = dDocType;
    objects[dQuoteSectionId] = dQuoteSection;
    objects[dQuoteTitleId] = dQuoteTitle;
    objects[dQuoteInputId] = dQuoteInput;
    objects[dQuoteBtnId] = dQuoteBtn;
    objects[dQuoteBtnTxtId] = dQuoteBtnTxt;
    objects[dQuoteListId] = dQuoteList;
    objects[dQuoteRowId] = dQuoteRow;
    objects[dQuoteLblId] = dQuoteLbl;
    objects[dQuoteValId] = dQuoteVal;

    if (!contactsScreen.shapes.includes(drawerId)) {
      contactsScreen.shapes.push(drawerId);
    }

    // 6. Pipeline Deal Stage Transition buttons
    const pipelineCols = [
      { id: "f4204c36-4df9-4643-99c6-d13f4a02e5ba", name: "New Leads", prev: null, next: "promoteToQualified" },
      { id: "5189c18f-d6c7-42ba-9311-5f6f41757d7c", name: "Qualified", prev: "demoteToNewLeads", next: "promoteToProposal" },
      { id: "49b18001-afc0-44eb-babd-d6062cd60921", name: "Proposal", prev: "promoteToQualified", next: "promoteToWon" },
      { id: "53f508e8-0b7e-4ec7-8ce6-1c0892052af8", name: "Closed Won", prev: "promoteToProposal", next: null }
    ];

    pipelineCols.forEach(col => {
      const colShape = objects[col.id] as any;
      if (!colShape) return;
      const repeaterId = colShape.shapes.find((id: string) => (objects[id] as any)?.name === "Card Repeater");
      const repeater = objects[repeaterId] as any;
      if (!repeater) return;

      repeater.height = 116;
      const bgId = repeater.shapes.find((id: string) => (objects[id] as any)?.name === "Card Bg");
      const bg = objects[bgId] as any;
      if (bg) bg.height = 116;

      if (col.prev) {
        const btnId = crypto.randomUUID();
        const txtId = crypto.randomUUID();
        const btn = mkRect(btnId, "Back Action Button", bg.x + 12, bg.y + 84, 100, 24, "#334155", repeaterId, {
          rx: 4,
          runtimeBindings: { onClick: col.prev },
          shapes: [txtId]
        });
        const txt = mkText(txtId, "Back Action Text", bg.x + 12, bg.y + 84, 100, 24, "<- Back", 11, "#cbd5e1", btnId, { bold: true });
        objects[btnId] = btn;
        objects[txtId] = txt;
        if (!repeater.shapes.includes(btnId)) {
          repeater.shapes.push(btnId);
        }
      }

      if (col.next) {
        const btnId = crypto.randomUUID();
        const txtId = crypto.randomUUID();
        const btn = mkRect(btnId, "Next Action Button", bg.x + 128, bg.y + 84, 100, 24, "#818cf8", repeaterId, {
          rx: 4,
          runtimeBindings: { onClick: col.next },
          shapes: [txtId]
        });
        const txt = mkText(txtId, "Next Action Text", bg.x + 128, bg.y + 84, 100, 24, col.name === "Proposal" ? "Close Won" : "Promote ->", 11, "#ffffff", btnId, { bold: true });
        objects[btnId] = btn;
        objects[txtId] = txt;
        if (!repeater.shapes.includes(btnId)) {
          repeater.shapes.push(btnId);
        }
      }
    });

    // 7. Add Campaigns Screen (x: 4600)
    const campScreenId = "campaigns-screen-uuid";
    const campSbId = buildSidebar(campScreenId, 4600, "campaigns");
    const campHdId = buildHeader(campScreenId, 4600, "Campaigns");

    const formFrameId = crypto.randomUUID();
    const formTitleId = crypto.randomUUID();
    const l1 = crypto.randomUUID(), i1 = crypto.randomUUID();
    const l2 = crypto.randomUUID(), i2 = crypto.randomUUID();
    const l3 = crypto.randomUUID(), i3 = crypto.randomUUID();
    const l4 = crypto.randomUUID(), i4 = crypto.randomUUID();
    const btnId = crypto.randomUUID(), btnTxtId = crypto.randomUUID();

    const formFrame = mkFrame(formFrameId, "Campaign Form", 4864, 88, 350, 450, "#1e293b", campScreenId, [
      formTitleId, l1, i1, l2, i2, l3, i3, l4, i4, btnId
    ]);
    formFrame.layoutProps = { layout: "flex", layoutFlexDir: "column", layoutGap: 12, layoutPaddingTop: 16, layoutPaddingRight: 16, layoutPaddingBottom: 16, layoutPaddingLeft: 16 };
    const formTitle = mkText(formTitleId, "Form Title", 4880, 104, 318, 20, "Create New Campaign", 14, "#ffffff", formFrameId, { bold: true });
    const labelName = mkText(l1, "Label Name", 4880, 136, 318, 16, "Campaign Name", 12, "#94a3b8", formFrameId);
    const inputName = mkRect(i1, "Input Name", 4880, 164, 318, 36, "#0f172a", formFrameId, { rx: 4, runtimeBindings: { inputBind: "$form.campaignName" } });
    const labelBudget = mkText(l2, "Label Budget", 4880, 212, 318, 16, "Budget ($)", 12, "#94a3b8", formFrameId);
    const inputBudget = mkRect(i2, "Input Budget", 4880, 240, 318, 36, "#0f172a", formFrameId, { rx: 4, runtimeBindings: { inputBind: "$form.campaignBudget" } });
    const labelChannel = mkText(l3, "Label Channel", 4880, 288, 318, 16, "Channel", 12, "#94a3b8", formFrameId);
    const inputChannel = mkRect(i3, "Input Channel", 4880, 316, 318, 36, "#0f172a", formFrameId, { rx: 4, runtimeBindings: { inputBind: "$form.campaignChannel" } });
    const labelStatus = mkText(l4, "Label Status", 4880, 364, 318, 16, "Status", 12, "#94a3b8", formFrameId);
    const inputStatus = mkRect(i4, "Input Status", 4880, 392, 318, 36, "#0f172a", formFrameId, { rx: 4, runtimeBindings: { inputBind: "$form.campaignStatus" } });
    const campBtn = mkRect(btnId, "Submit Button", 4880, 440, 150, 36, "#818cf8", formFrameId, { rx: 4, runtimeBindings: { onClick: "addCampaign" }, shapes: [btnTxtId] });
    const campBtnTxt = mkText(btnTxtId, "Submit Text", 4880, 440, 150, 36, "Create Campaign", 13, "#ffffff", btnId, { bold: true });

    objects[formFrameId] = formFrame; objects[formTitleId] = formTitle;
    objects[l1] = labelName; objects[i1] = inputName;
    objects[l2] = labelBudget; objects[i2] = inputBudget;
    objects[l3] = labelChannel; objects[i3] = inputChannel;
    objects[l4] = labelStatus; objects[i4] = inputStatus;
    objects[btnId] = campBtn; objects[btnTxtId] = campBtnTxt;

    const tableFrameId = crypto.randomUUID();
    const tableHeaderId = crypto.randomUUID();
    const tableRepeaterId = crypto.randomUUID();
    const rowBgId = crypto.randomUUID();
    const rNameId = crypto.randomUUID();
    const rBudgetId = crypto.randomUUID();
    const rChannelId = crypto.randomUUID();
    const rStatusId = crypto.randomUUID();

    const tableFrame = mkFrame(tableFrameId, "Campaigns Table", 5240, 88, 736, 750, "#1e293b", campScreenId, [tableHeaderId, tableRepeaterId]);
    tableFrame.layoutProps = { layout: "flex", layoutFlexDir: "column", layoutGap: 8, layoutPaddingTop: 16, layoutPaddingRight: 16, layoutPaddingBottom: 16, layoutPaddingLeft: 16 };

    const hNameId = crypto.randomUUID(), hBudgetId = crypto.randomUUID(), hChannelId = crypto.randomUUID(), hStatusId = crypto.randomUUID();
    const tableHeader = mkFrame(tableHeaderId, "Table Head", 5256, 104, 704, 36, "#0f172a", tableFrameId, [hNameId, hBudgetId, hChannelId, hStatusId]);
    tableHeader.layoutProps = { layout: "flex", layoutFlexDir: "row", layoutGap: 16 };
    const hName = mkText(hNameId, "Col Name", 5256, 104, 230, 20, "Campaign Name", 12, "#94a3b8", tableHeaderId, { bold: true });
    const hBudget = mkText(hBudgetId, "Col Budget", 5502, 104, 110, 20, "Budget", 12, "#94a3b8", tableHeaderId, { bold: true });
    const hChannel = mkText(hChannelId, "Col Channel", 5628, 104, 140, 20, "Channel", 12, "#94a3b8", tableHeaderId, { bold: true });
    const hStatus = mkText(hStatusId, "Col Status", 5784, 104, 140, 20, "Status", 12, "#94a3b8", tableHeaderId, { bold: true });

    objects[tableHeaderId] = tableHeader; objects[hNameId] = hName; objects[hBudgetId] = hBudget; objects[hChannelId] = hChannel; objects[hStatusId] = hStatus;

    const tableRepeater = mkFrame(tableRepeaterId, "Row Repeater", 5256, 148, 704, 400, "transparent", tableFrameId, [rowBgId]);
    tableRepeater.layoutProps = { layout: "flex", layoutFlexDir: "column", layoutGap: 8 };
    tableRepeater.runtimeBindings = { repeatFor: "$local.campaigns", repeatAs: "camp", dataSource: "campaigns" };

    const rowBg = mkFrame(rowBgId, "Row Bg", 5256, 148, 704, 44, "#0f172a", tableRepeaterId, [rNameId, rBudgetId, rChannelId, rStatusId]);
    rowBg.rx = 4; rowBg.layoutProps = { layout: "flex", layoutFlexDir: "row", layoutGap: 16, layoutPaddingTop: 12 };
    const rName = mkText(rNameId, "Row Name", 5256, 148, 230, 20, "Campaign Name", 13, "#e2e8f0", rowBgId, { runtimeBindings: { textBind: "$camp.name" } });
    const rBudget = mkText(rBudgetId, "Row Budget", 5502, 148, 110, 20, "Budget", 13, "#cbd5e1", rowBgId, { runtimeBindings: { textBind: "$camp.budget" } });
    const rChannel = mkText(rChannelId, "Row Channel", 5628, 148, 140, 20, "Channel", 13, "#cbd5e1", rowBgId, { runtimeBindings: { textBind: "$camp.channel" } });
    const rStatus = mkText(rStatusId, "Row Status", 5784, 148, 140, 20, "Status", 13, "#34d399", rowBgId, { runtimeBindings: { textBind: "$camp.status" } });

    objects[tableFrameId] = tableFrame; objects[tableRepeaterId] = tableRepeater; objects[rowBgId] = rowBg;
    objects[rNameId] = rName; objects[rBudgetId] = rBudget; objects[rChannelId] = rChannel; objects[rStatusId] = rStatus;

    const campScreen = mkFrame(campScreenId, "Campaigns", 4600, 0, 1400, 900, "#0f172a", ROOT_ID, [campSbId, campHdId, formFrameId, tableFrameId]);
    campScreen.runtimeBindings = { onMount: "fetchCampaigns" };
    objects[campScreenId] = campScreen;

    // 8. Add Tickets Screen (x: 6100)
    const tickScreenId = "tickets-screen-uuid";
    const tickSbId = buildSidebar(tickScreenId, 6100, "tickets");
    const tickHdId = buildHeader(tickScreenId, 6100, "Tickets");

    const tickTableFrameId = crypto.randomUUID();
    const tickTableHeaderId = crypto.randomUUID();
    const tickTableRepeaterId = crypto.randomUUID();
    const tRowBgId = crypto.randomUUID();
    const trTitleId = crypto.randomUUID(), trPriorityId = crypto.randomUUID(), trStatusId = crypto.randomUUID(), trContactId = crypto.randomUUID();
    const trBtnProgId = crypto.randomUUID(), trBtnProgTxtId = crypto.randomUUID(), trBtnResId = crypto.randomUUID(), trBtnResTxtId = crypto.randomUUID();

    const tickTableFrame = mkFrame(tickTableFrameId, "Tickets Table", 6364, 88, 1112, 750, "#1e293b", tickScreenId, [tickTableHeaderId, tickTableRepeaterId]);
    tickTableFrame.layoutProps = { layout: "flex", layoutFlexDir: "column", layoutGap: 8, layoutPaddingTop: 16, layoutPaddingRight: 16, layoutPaddingBottom: 16, layoutPaddingLeft: 16 };

    const thTitleId = crypto.randomUUID(), thPriorityId = crypto.randomUUID(), thStatusId = crypto.randomUUID(), thContactId = crypto.randomUUID(), thActionsId = crypto.randomUUID();
    const tickTableHeader = mkFrame(tickTableHeaderId, "Table Head", 6380, 104, 1080, 36, "#0f172a", tickTableFrameId, [thTitleId, thPriorityId, thStatusId, thContactId, thActionsId]);
    tickTableHeader.layoutProps = { layout: "flex", layoutFlexDir: "row", layoutGap: 16 };
    const thTitle = mkText(thTitleId, "Col Title", 6380, 104, 330, 20, "Ticket Title", 12, "#94a3b8", tickTableHeaderId, { bold: true });
    const thPriority = mkText(thPriorityId, "Col Priority", 6726, 104, 100, 20, "Priority", 12, "#94a3b8", tickTableHeaderId, { bold: true });
    const thStatus = mkText(thStatusId, "Col Status", 6842, 104, 100, 20, "Status", 12, "#94a3b8", tickTableHeaderId, { bold: true });
    const thContact = mkText(thContactId, "Col Contact", 6958, 104, 180, 20, "Contact", 12, "#94a3b8", tickTableHeaderId, { bold: true });
    const thActions = mkText(thActionsId, "Col Actions", 7154, 104, 220, 20, "Actions", 12, "#94a3b8", tickTableHeaderId, { bold: true });

    objects[tickTableHeaderId] = tickTableHeader; objects[thTitleId] = thTitle; objects[thPriorityId] = thPriority; objects[thStatusId] = thStatus; objects[thContactId] = thContact; objects[thActionsId] = thActions;

    const tickTableRepeater = mkFrame(tickTableRepeaterId, "Row Repeater", 6380, 148, 1080, 500, "transparent", tickTableFrameId, [tRowBgId]);
    tickTableRepeater.layoutProps = { layout: "flex", layoutFlexDir: "column", layoutGap: 8 };
    tickTableRepeater.runtimeBindings = { repeatFor: "$local.tickets", repeatAs: "tick", dataSource: "tickets" };

    const tRowBg = mkFrame(tRowBgId, "Row Bg", 6380, 148, 1080, 52, "#0f172a", tickTableRepeaterId, [trTitleId, trPriorityId, trStatusId, trContactId, trBtnProgId, trBtnResId]);
    tRowBg.rx = 4; tRowBg.layoutProps = { layout: "flex", layoutFlexDir: "row", layoutGap: 16, layoutPaddingTop: 14 };
    const trTitle = mkText(trTitleId, "Row Title", 6380, 148, 330, 20, "Ticket Title", 13, "#e2e8f0", tRowBgId, { runtimeBindings: { textBind: "$tick.title" } });
    const trPriority = mkText(trPriorityId, "Row Priority", 6726, 148, 100, 20, "Priority", 13, "#ef4444", tRowBgId, { runtimeBindings: { textBind: "$tick.priority" } });
    const trStatus = mkText(trStatusId, "Row Status", 6842, 148, 100, 20, "Status", 13, "#cbd5e1", tRowBgId, { runtimeBindings: { textBind: "$tick.status" } });
    const trContact = mkText(trContactId, "Row Contact", 6958, 148, 180, 20, "Contact", 13, "#818cf8", tRowBgId, { runtimeBindings: { textBind: "$tick.contact_name" } });

    const trBtnProg = mkRect(trBtnProgId, "In Progress Btn", 7154, 148, 100, 24, "#334155", tRowBgId, { rx: 4, runtimeBindings: { onClick: "markTicketInProgress" }, shapes: [trBtnProgTxtId] });
    const trBtnProgTxt = mkText(trBtnProgTxtId, "In Progress Txt", 7154, 148, 100, 24, "In Progress", 10, "#e2e8f0", trBtnProgId, { bold: true });
    const trBtnRes = mkRect(trBtnResId, "Resolve Btn", 7270, 148, 80, 24, "#34d399", tRowBgId, { rx: 4, runtimeBindings: { onClick: "markTicketResolved" }, shapes: [trBtnResTxtId] });
    const trBtnResTxt = mkText(trBtnResTxtId, "Resolve Txt", 7270, 148, 80, 24, "Resolve", 10, "#0f172a", trBtnResId, { bold: true });

    objects[tickTableFrameId] = tickTableFrame; objects[tickTableRepeaterId] = tickTableRepeater; objects[tRowBgId] = tRowBg;
    objects[trTitleId] = trTitle; objects[trPriorityId] = trPriority; objects[trStatusId] = trStatus; objects[trContactId] = trContact;
    objects[trBtnProgId] = trBtnProg; objects[trBtnProgTxtId] = trBtnProgTxt; objects[trBtnResId] = trBtnRes; objects[trBtnResTxtId] = trBtnResTxt;

    const tickScreen = mkFrame(tickScreenId, "Tickets", 6100, 0, 1400, 900, "#0f172a", ROOT_ID, [tickSbId, tickHdId, tickTableFrameId]);
    tickScreen.runtimeBindings = { onMount: "fetchTickets" };
    objects[tickScreenId] = tickScreen;

    // 9. Add Login Screen
    const loginScreenId = "auth-login-screen-uuid";
    const loginBoxId = crypto.randomUUID();
    const lTitleId = crypto.randomUUID(), lDescId = crypto.randomUUID();
    const lblEmailId = crypto.randomUUID(), valEmailId = crypto.randomUUID();
    const lblPassId = crypto.randomUUID(), valPassId = crypto.randomUUID();
    const lBtnId = crypto.randomUUID(), lBtnTxtId = crypto.randomUUID();
    const lLinkId = crypto.randomUUID();

    const loginBox = mkFrame(loginBoxId, "Login Box", 450, 200, 500, 450, "#1e293b", loginScreenId, [
      lTitleId, lDescId, lblEmailId, valEmailId, lblPassId, valPassId, lBtnId, lLinkId
    ]);
    loginBox.layoutProps = { layout: "flex", layoutFlexDir: "column", layoutGap: 16, layoutPaddingTop: 32, layoutPaddingRight: 32, layoutPaddingBottom: 32, layoutPaddingLeft: 32 };
    const lTitle = mkText(lTitleId, "Login Title", 482, 232, 436, 32, "CRM Pro - Sign In", 24, "#ffffff", loginBoxId, { bold: true });
    const lDesc = mkText(lDescId, "Login Description", 482, 272, 436, 20, "Enter credentials to access account", 14, "#94a3b8", loginBoxId);
    const lblEmail = mkText(lblEmailId, "Email Label", 482, 308, 436, 16, "Email Address", 12, "#94a3b8", loginBoxId);
    const valEmail = mkRect(valEmailId, "Email Input", 482, 332, 436, 40, "#0f172a", loginBoxId, { rx: 4, runtimeBindings: { inputBind: "$form.email" } });
    const lblPass = mkText(lblPassId, "Password Label", 482, 388, 436, 16, "Password", 12, "#94a3b8", loginBoxId);
    const valPass = mkRect(valPassId, "Password Input", 482, 412, 436, 40, "#0f172a", loginBoxId, { rx: 4, runtimeBindings: { inputBind: "$form.password" } });
    const loginBtn = mkRect(lBtnId, "Sign In Button", 482, 476, 436, 44, "#818cf8", loginBoxId, { rx: 4, runtimeBindings: { onClick: "login" }, shapes: [lBtnTxtId] });
    const loginBtnTxt = mkText(lBtnTxtId, "Sign In Text", 482, 476, 436, 44, "Sign In", 14, "#ffffff", lBtnId, { bold: true });
    const signupLink = mkText(lLinkId, "Signup Link", 482, 536, 436, 20, "Don't have an account? Sign up", 13, "#818cf8", loginBoxId, { runtimeBindings: { onClick: "navigateSignup" } });

    objects[loginBoxId] = loginBox; objects[lTitleId] = lTitle; objects[lDescId] = lDesc;
    objects[lblEmailId] = lblEmail; objects[valEmailId] = valEmail;
    objects[lblPassId] = lblPass; objects[valPassId] = valPass;
    objects[lBtnId] = loginBtn; objects[lBtnTxtId] = loginBtnTxt; objects[lLinkId] = signupLink;

    const loginScreen = mkFrame(loginScreenId, "Login", 0, 0, 1400, 900, "#0f172a", ROOT_ID, [loginBoxId]);
    objects[loginScreenId] = loginScreen;

    // 10. Add Signup Screen
    const signupScreenId = "auth-signup-screen-uuid";
    const signupBoxId = crypto.randomUUID();
    const sTitleId = crypto.randomUUID(), sDescId = crypto.randomUUID();
    const lblOrgId = crypto.randomUUID(), valOrgId = crypto.randomUUID();
    const lblSEmailId = crypto.randomUUID(), valSEmailId = crypto.randomUUID();
    const lblSPassId = crypto.randomUUID(), valSPassId = crypto.randomUUID();
    const sBtnId = crypto.randomUUID(), sBtnTxtId = crypto.randomUUID();
    const sLinkId = crypto.randomUUID();

    const signupBox = mkFrame(signupBoxId, "Signup Box", 450, 150, 500, 550, "#1e293b", signupScreenId, [
      sTitleId, sDescId, lblOrgId, valOrgId, lblSEmailId, valSEmailId, lblSPassId, valSPassId, sBtnId, sLinkId
    ]);
    signupBox.layoutProps = { layout: "flex", layoutFlexDir: "column", layoutGap: 16, layoutPaddingTop: 32, layoutPaddingRight: 32, layoutPaddingBottom: 32, layoutPaddingLeft: 32 };
    const sTitle = mkText(sTitleId, "Signup Title", 482, 182, 436, 32, "CRM Pro - Sign Up", 24, "#ffffff", signupBoxId, { bold: true });
    const sDesc = mkText(sDescId, "Signup Description", 482, 222, 436, 20, "Onboard your organization in seconds", 14, "#94a3b8", signupBoxId);
    const lblOrg = mkText(lblOrgId, "Org Label", 482, 258, 436, 16, "Organization Name", 12, "#94a3b8", signupBoxId);
    const valOrg = mkRect(valOrgId, "Org Input", 482, 282, 436, 40, "#0f172a", signupBoxId, { rx: 4, runtimeBindings: { inputBind: "$form.company" } });
    const lblSEmail = mkText(lblSEmailId, "Email Label", 482, 338, 436, 16, "Email Address", 12, "#94a3b8", signupBoxId);
    const valSEmail = mkRect(valSEmailId, "Email Input", 482, 362, 436, 40, "#0f172a", signupBoxId, { rx: 4, runtimeBindings: { inputBind: "$form.email" } });
    const lblSPass = mkText(lblSPassId, "Password Label", 482, 418, 436, 16, "Password", 12, "#94a3b8", signupBoxId);
    const valSPass = mkRect(valSPassId, "Password Input", 482, 442, 436, 40, "#0f172a", signupBoxId, { rx: 4, runtimeBindings: { inputBind: "$form.password" } });
    const signupBtn = mkRect(sBtnId, "Sign Up Button", 482, 506, 436, 44, "#818cf8", signupBoxId, { rx: 4, runtimeBindings: { onClick: "signup" }, shapes: [sBtnTxtId] });
    const signupBtnTxt = mkText(sBtnTxtId, "Sign Up Text", 482, 506, 436, 44, "Create Account", 14, "#ffffff", sBtnId, { bold: true });
    const loginLink = mkText(sLinkId, "Login Link", 482, 566, 436, 20, "Already have an account? Sign in", 13, "#818cf8", signupBoxId, { runtimeBindings: { onClick: "navigateLogin" } });

    objects[signupBoxId] = signupBox; objects[sTitleId] = sTitle; objects[sDescId] = sDesc;
    objects[lblOrgId] = lblOrg; objects[valOrgId] = valOrg;
    objects[lblSEmailId] = lblSEmail; objects[valSEmailId] = valSEmail;
    objects[lblSPassId] = lblSPass; objects[valSPassId] = valSPass;
    objects[sBtnId] = signupBtn; objects[sBtnTxtId] = signupBtnTxt; objects[sLinkId] = loginLink;

    const signupScreen = mkFrame(signupScreenId, "Signup", 0, 0, 1400, 900, "#0f172a", ROOT_ID, [signupBoxId]);
    objects[signupScreenId] = signupScreen;

    // Append new screens to Root frame shapes list
    if (!root.shapes.includes(campScreenId)) root.shapes.push(campScreenId);
    if (!root.shapes.includes(tickScreenId)) root.shapes.push(tickScreenId);
    if (!root.shapes.includes(loginScreenId)) root.shapes.push(loginScreenId);
    if (!root.shapes.includes(signupScreenId)) root.shapes.push(signupScreenId);

    // 11. Write back file data
    await db.query("UPDATE files SET data = $1 WHERE id = $2", [JSON.stringify(fileData), fileRow.id]);

    // 12. Modify runtime_schemas table
    const schemaRes = await db.query("SELECT * FROM runtime_schemas WHERE project_id = $1 LIMIT 1", [PID]);
    let schema = schemaRes.rows.length ? (typeof schemaRes.rows[0].schema_json === "string" ? JSON.parse(schemaRes.rows[0].schema_json) : schemaRes.rows[0].schema_json) : { id: PID };

    // Define new tables in runtimeSchema
    schema.database = {
      provider: "mint",
      tables: [
        {
          id: "t1",
          name: "contacts",
          fields: [
            { name: "id", type: "uuid", primaryKey: true, required: true },
            { name: "name", type: "text", required: true },
            { name: "email", type: "text", required: true, unique: true },
            { name: "company", type: "text" },
            { name: "status", type: "text", defaultValue: "Lead" },
            { name: "value", type: "text" },
            { name: "created_at", type: "timestamp", defaultValue: "now()" }
          ]
        },
        {
          id: "t2",
          name: "deals",
          fields: [
            { name: "id", type: "uuid", primaryKey: true, required: true },
            { name: "name", type: "text", required: true },
            { name: "value", type: "text" },
            { name: "stage", type: "text", defaultValue: "New Leads" },
            { name: "contact_id", type: "uuid", references: "contacts.id" }
          ]
        },
        {
          id: "t-interactions",
          name: "interactions",
          fields: [
            { name: "id", type: "uuid", primaryKey: true, required: true },
            { name: "description", type: "text", required: true },
            { name: "created_at", type: "timestamp", defaultValue: "now()" },
            { name: "contact_id", type: "uuid", references: "contacts.id" }
          ]
        },
        {
          id: "t-documents",
          name: "documents",
          fields: [
            { name: "id", type: "uuid", primaryKey: true, required: true },
            { name: "name", type: "text", required: true },
            { name: "type", type: "text" },
            { name: "created_at", type: "timestamp", defaultValue: "now()" },
            { name: "contact_id", type: "uuid", references: "contacts.id" }
          ]
        },
        {
          id: "t-quotes",
          name: "quotes",
          fields: [
            { name: "id", type: "uuid", primaryKey: true, required: true },
            { name: "total", type: "text", required: true },
            { name: "status", type: "text", defaultValue: "Draft" },
            { name: "created_at", type: "timestamp", defaultValue: "now()" },
            { name: "contact_id", type: "uuid", references: "contacts.id" }
          ]
        },
        {
          id: "t-tickets",
          name: "tickets",
          fields: [
            { name: "id", type: "uuid", primaryKey: true, required: true },
            { name: "title", type: "text", required: true },
            { name: "priority", type: "text" },
            { name: "status", type: "text", defaultValue: "Open" },
            { name: "created_at", type: "timestamp", defaultValue: "now()" },
            { name: "contact_id", type: "uuid", references: "contacts.id" }
          ]
        },
        {
          id: "t-campaigns",
          name: "campaigns",
          fields: [
            { name: "id", type: "uuid", primaryKey: true, required: true },
            { name: "name", type: "text", required: true },
            { name: "budget", type: "text" },
            { name: "status", type: "text", defaultValue: "Active" },
            { name: "channel", type: "text" },
            { name: "created_at", type: "timestamp", defaultValue: "now()" }
          ]
        }
      ]
    };

    // Define global state variables
    schema.globalState = [
      { id: "gs-user", name: "currentUser", type: "object", defaultValue: { name: "Jane Doe", role: "admin" } },
      { id: "gs-search", name: "search", type: "object", defaultValue: { query: "" } },
      { id: "gs-form", name: "form", type: "object", defaultValue: { name: "", email: "", value: "", company: "", campaignName: "", campaignBudget: "", campaignChannel: "", campaignStatus: "", ticketTitle: "", ticketPriority: "" } },
      { id: "gs-modals", name: "_modals", type: "object", defaultValue: { addContact: { open: false } } },
      { id: "gs-local", name: "local", type: "object", defaultValue: {
        deals: [],
        stats: { deals: 147, leads: 63, revenue: "$284,500", winRate: "72%" },
        wonList: [],
        contacts: [],
        leadsList: [],
        activities: [
          { icon: "*", description: "Sarah closed deal with Acme Corp — $45,000" },
          { icon: "*", description: "New lead: James Miller from TechVentures" },
          { icon: "*", description: "Meeting scheduled with GlobalFin — Tomorrow 2pm" }
        ],
        proposalList: [],
        qualifiedList: [],
        activeContact: null,
        activeContactInteractions: [],
        newInteraction: { description: "" },
        activeContactDocuments: [],
        newDocument: { name: "" },
        activeContactQuotes: [],
        newQuote: { total: "" },
        campaigns: [],
        tickets: [],
        aiAgentPrompt: "",
        aiAgentResponse: "Enter a prompt and run..."
      }}
    ];

    // Define global actions
    schema.globalActions = [
      { id: "act-nav-dash", name: "navigateDashboard", type: "navigate", config: { target: "/dashboard", route: "/dashboard" } },
      { id: "act-nav-contacts", name: "navigateContacts", type: "navigate", config: { target: "/contacts", route: "/contacts" } },
      { id: "act-nav-pipeline", name: "navigatePipeline", type: "navigate", config: { target: "/pipeline", route: "/pipeline" } },
      { id: "act-nav-campaigns", name: "navigateCampaigns", type: "navigate", config: { target: "/campaigns", route: "/campaigns" } },
      { id: "act-nav-tickets", name: "navigateTickets", type: "navigate", config: { target: "/tickets", route: "/tickets" } },
      { id: "act-nav-login", name: "navigateLogin", type: "navigate", config: { target: "/login", route: "/login" } },
      { id: "act-nav-signup", name: "navigateSignup", type: "navigate", config: { target: "/signup", route: "/signup" } },
      { id: "act-open-modal", name: "openAddContactModal", type: "setState", config: { path: "_modals.addContact.open", value: true } },
      { id: "act-close-modal", name: "closeAddContactModal", type: "setState", config: { path: "_modals.addContact.open", value: false } },
      
      // DB Fetches
      { id: "act-fetch-contacts", name: "fetchContacts", type: "fetch", config: { url: "/api/db/{projectId}", body: { sql: "SELECT * FROM \"contacts\" ORDER BY \"created_at\" DESC", params: [] }, method: "POST", onSuccess: "SET $local.contacts = $result.rows" } },
      { id: "act-add-contact", name: "addContact", type: "fetch", config: { url: "/api/db/{projectId}", body: { sql: "INSERT INTO \"contacts\" (\"name\", \"email\", \"company\", \"value\") VALUES ($1, $2, $3, $4) RETURNING *", params: ["$form.name", "$form.email", "$form.company", "$form.value"] }, method: "POST", onSuccess: "SET $form.name = ''; SET $form.email = ''; SET $form.company = ''; SET $form.value = ''; SET $_modals.addContact.open = false; CALL fetchContacts" } },
      
      { id: "act-fetch-leads", name: "fetchLeadsList", type: "fetch", config: { url: "/api/db/{projectId}", body: { sql: "SELECT * FROM \"deals\" WHERE \"stage\" = 'New Leads' ORDER BY \"created_at\" DESC", params: [] }, method: "POST", onSuccess: "SET $local.leadsList = $result.rows" } },
      { id: "act-fetch-qualified", name: "fetchQualifiedList", type: "fetch", config: { url: "/api/db/{projectId}", body: { sql: "SELECT * FROM \"deals\" WHERE \"stage\" = 'Qualified' ORDER BY \"created_at\" DESC", params: [] }, method: "POST", onSuccess: "SET $local.qualifiedList = $result.rows" } },
      { id: "act-fetch-proposal", name: "fetchProposalList", type: "fetch", config: { url: "/api/db/{projectId}", body: { sql: "SELECT * FROM \"deals\" WHERE \"stage\" = 'Proposal' ORDER BY \"created_at\" DESC", params: [] }, method: "POST", onSuccess: "SET $local.proposalList = $result.rows" } },
      { id: "act-fetch-won", name: "fetchWonList", type: "fetch", config: { url: "/api/db/{projectId}", body: { sql: "SELECT * FROM \"deals\" WHERE \"stage\" = 'Closed Won' ORDER BY \"created_at\" DESC", params: [] }, method: "POST", onSuccess: "SET $local.wonList = $result.rows" } },
      { id: "act-fetch-pipeline", name: "fetchPipelineDeals", type: "setState", config: { also: "CALL fetchLeadsList; CALL fetchQualifiedList; CALL fetchProposalList; CALL fetchWonList", path: "dummy", value: "" } },
      
      // Interactions
      { id: "act-fetch-interactions", name: "fetchInteractions", type: "fetch", config: { url: "/api/db/{projectId}", body: { sql: "SELECT * FROM \"interactions\" WHERE \"contact_id\" = $1 ORDER BY \"created_at\" DESC", params: ["$local.activeContact.id"] }, method: "POST", onSuccess: "SET $local.activeContactInteractions = $result.rows" } },
      { id: "act-add-interaction", name: "addInteraction", type: "fetch", config: { url: "/api/db/{projectId}", body: { sql: "INSERT INTO \"interactions\" (\"description\", \"contact_id\") VALUES ($1, $2) RETURNING *", params: ["$local.newInteraction.description", "$local.activeContact.id"] }, method: "POST", onSuccess: "SET $local.newInteraction.description = ''; CALL fetchInteractions" } },
      
      // Documents
      { id: "act-fetch-documents", name: "fetchDocuments", type: "fetch", config: { url: "/api/db/{projectId}", body: { sql: "SELECT * FROM \"documents\" WHERE \"contact_id\" = $1 ORDER BY \"created_at\" DESC", params: ["$local.activeContact.id"] }, method: "POST", onSuccess: "SET $local.activeContactDocuments = $result.rows" } },
      { id: "act-add-document", name: "addDocument", type: "fetch", config: { url: "/api/db/{projectId}", body: { sql: "INSERT INTO \"documents\" (\"name\", \"type\", \"contact_id\") VALUES ($1, 'Contract', $2) RETURNING *", params: ["$local.newDocument.name", "$local.activeContact.id"] }, method: "POST", onSuccess: "SET $local.newDocument.name = ''; CALL fetchDocuments" } },
      
      // Quotes
      { id: "act-fetch-quotes", name: "fetchQuotes", type: "fetch", config: { url: "/api/db/{projectId}", body: { sql: "SELECT * FROM \"quotes\" WHERE \"contact_id\" = $1 ORDER BY \"created_at\" DESC", params: ["$local.activeContact.id"] }, method: "POST", onSuccess: "SET $local.activeContactQuotes = $result.rows" } },
      { id: "act-add-quote", name: "addQuote", type: "fetch", config: { url: "/api/db/{projectId}", body: { sql: "INSERT INTO \"quotes\" (\"total\", \"status\", \"contact_id\") VALUES ($1, 'Draft', $2) RETURNING *", params: ["$local.newQuote.total", "$local.activeContact.id"] }, method: "POST", onSuccess: "SET $local.newQuote.total = ''; CALL fetchQuotes" } },

      // Campaigns
      { id: "act-fetch-campaigns", name: "fetchCampaigns", type: "fetch", config: { url: "/api/db/{projectId}", body: { sql: "SELECT * FROM \"campaigns\" ORDER BY \"created_at\" DESC", params: [] }, method: "POST", onSuccess: "SET $local.campaigns = $result.rows" } },
      { id: "act-add-campaign", name: "addCampaign", type: "fetch", config: { url: "/api/db/{projectId}", body: { sql: "INSERT INTO \"campaigns\" (\"name\", \"budget\", \"status\", \"channel\") VALUES ($1, $2, 'Active', $3) RETURNING *", params: ["$form.campaignName", "$form.campaignBudget", "$form.campaignChannel"] }, method: "POST", onSuccess: "SET $form.campaignName = ''; SET $form.campaignBudget = ''; SET $form.campaignChannel = ''; CALL fetchCampaigns" } },

      // Tickets
      { id: "act-fetch-tickets", name: "fetchTickets", type: "fetch", config: { url: "/api/db/{projectId}", body: { sql: "SELECT t.*, c.name as contact_name FROM \"tickets\" t LEFT JOIN \"contacts\" c ON t.contact_id = c.id ORDER BY t.created_at DESC", params: [] }, method: "POST", onSuccess: "SET $local.tickets = $result.rows" } },
      { id: "act-mark-progress", name: "markTicketInProgress", type: "fetch", config: { url: "/api/db/{projectId}", body: { sql: "UPDATE \"tickets\" SET \"status\" = 'In Progress' WHERE \"id\" = $1", params: ["$tick.id"] }, method: "POST", onSuccess: "CALL fetchTickets" } },
      { id: "act-mark-resolved", name: "markTicketResolved", type: "fetch", config: { url: "/api/db/{projectId}", body: { sql: "UPDATE \"tickets\" SET \"status\" = 'Resolved' WHERE \"id\" = $1", params: ["$tick.id"] }, method: "POST", onSuccess: "CALL fetchTickets" } },

      // Pipeline promotions
      { id: "act-promo-qual", name: "promoteToQualified", type: "fetch", config: { url: "/api/db/{projectId}", body: { sql: "UPDATE \"deals\" SET \"stage\" = 'Qualified' WHERE \"id\" = $1", params: ["$deal.id"] }, method: "POST", onSuccess: "CALL fetchPipelineDeals" } },
      { id: "act-promo-prop", name: "promoteToProposal", type: "fetch", config: { url: "/api/db/{projectId}", body: { sql: "UPDATE \"deals\" SET \"stage\" = 'Proposal' WHERE \"id\" = $1", params: ["$deal.id"] }, method: "POST", onSuccess: "CALL fetchPipelineDeals" } },
      { id: "act-promo-won", name: "promoteToWon", type: "fetch", config: { url: "/api/db/{projectId}", body: { sql: "UPDATE \"deals\" SET \"stage\" = 'Closed Won' WHERE \"id\" = $1", params: ["$deal.id"] }, method: "POST", onSuccess: "CALL fetchPipelineDeals" } },
      { id: "act-demo-lead", name: "demoteToNewLeads", type: "fetch", config: { url: "/api/db/{projectId}", body: { sql: "UPDATE \"deals\" SET \"stage\" = 'New Leads' WHERE \"id\" = $1", params: ["$deal.id"] }, method: "POST", onSuccess: "CALL fetchPipelineDeals" } },

      // Slide-over state toggling
      { id: "act-sel-contact", name: "selectActiveContact", type: "setState", config: { path: "local.activeContact", value: "$args.0", also: "CALL fetchInteractions; CALL fetchDocuments; CALL fetchQuotes" } },
      { id: "act-close-contact", name: "closeActiveContact", type: "setState", config: { path: "local.activeContact", value: null } },

      // Auth
      { id: "act-auth-login", name: "login", type: "custom", config: { also: "SET $currentUser = 'Mani Madhava'; CALL navigateDashboard" } },
      { id: "act-auth-signup", name: "signup", type: "custom", config: { also: "SET $currentUser = 'Mani Madhava'; CALL navigateDashboard" } },

      // AI
      { id: "act-call-ai", name: "callAIAgent", type: "custom", config: { also: "SET $local.aiAgentResponse = 'Generating custom follow-up for lead...\\n\\nSubject: Follow-up on CRM Pro onboarding\\n\\nDear client,\\nWe would love to schedule a demo to walk through the custom sales pipeline features...\\n\\nBest regards,\\nCRM Sales Agent'; SET $local.aiAgentPrompt = ''" } },

      // Dashboard Init
      { id: "act-fetch-recent", name: "fetchRecentDeals", type: "fetch", config: { url: "/api/db/{projectId}", body: { sql: "SELECT * FROM \"deals\" ORDER BY \"created_at\" DESC LIMIT 3", params: [] }, method: "POST", onSuccess: "SET $local.deals = $result.rows" } },
      { id: "act-fetch-dash", name: "fetchDashboardData", type: "setState", config: { also: "CALL fetchRecentDeals; CALL fetchContacts", path: "dummy", value: "" } }
    ];

    schema.navigation = {
      type: "stack",
      initialRoute: "/dashboard",
      routes: [
        { path: "/dashboard", screenId: "786f0946-18f0-40ba-a952-313bdd374c50" },
        { path: "/contacts", screenId: "6b5c3518-8e94-4a19-93dd-f63b42642137" },
        { path: "/pipeline", screenId: "437d19ff-7655-4a67-9d3c-b5388671eeef" },
        { path: "/campaigns", screenId: campScreenId },
        { path: "/tickets", screenId: tickScreenId },
        { path: "/login", screenId: loginScreenId },
        { path: "/signup", screenId: signupScreenId }
      ]
    };

    // Write back runtime schema
    await db.query(
      `INSERT INTO runtime_schemas (project_id, schema_json, updated_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (project_id)
       DO UPDATE SET schema_json = $2, updated_at = now(), updated_by = $3`,
      [PID, JSON.stringify(schema), "4a3114bc-d622-4cf6-afe6-2c251b563091"]
    );

    // 13. Generate the nodes payload list
    const topFrames = [
      objects["786f0946-18f0-40ba-a952-313bdd374c50"], // Dashboard
      objects["6b5c3518-8e94-4a19-93dd-f63b42642137"], // Contacts
      objects["437d19ff-7655-4a67-9d3c-b5388671eeef"], // Pipeline
      objects[campScreenId],
      objects[tickScreenId],
      objects[loginScreenId],
      objects[signupScreenId]
    ];

    const nodes = topFrames.map(f => shapeToNode(f, f.x, f.y, objects));

    // 14. Query or create the user & session
    let userRes = await db.query("SELECT id FROM users WHERE email = 'manimadhava43@gmail.com' LIMIT 1");
    let userId;
    if (userRes.rows.length === 0) {
      userId = crypto.randomUUID();
      await db.query(
        "INSERT INTO users (id, email, password_hash, salt, role, approved) VALUES ($1, $2, $3, $4, 'admin', true)",
        [userId, "manimadhava43@gmail.com", "dummyhash", "dummysalt"]
      );
    } else {
      userId = userRes.rows[0].id;
      // Make sure they are admin & approved
      await db.query(
        "UPDATE users SET role = 'admin', approved = true WHERE id = $1",
        [userId]
      );
    }

    const sessionToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await db.query(
      "INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)",
      [sessionToken, userId, expiresAt]
    );

    // 15. Make POST request to http://localhost:3001/api/commit
    const body = {
      projectId: PID,
      fileId: fileRow.id,
      targetFramework: "nextjs",
      fileName: "crm-design-canvas-nextjs",
      nodes: nodes,
      interactions: [],
      runtimeSchema: schema,
      message: "Rebuild CRM project data with Auth, Campaigns, Tickets, Slide-overs, and Emojis scrubbed"
    };

    const commitRes = await fetch("http://localhost:3001/api/commit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": `token=${sessionToken}`
      },
      body: JSON.stringify(body)
    });

    const commitData = await commitRes.json();

    return NextResponse.json({
      success: true,
      commitStatus: commitRes.status,
      commitData
    });
  } catch (e: any) {
    console.error("Seeding endpoint failed:", e);
    return NextResponse.json({
      success: false,
      error: e.message
    }, { status: 500 });
  }
}
