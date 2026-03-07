"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import {
  MousePointer2,
  Square,
  Circle,
  Minus,
  ChevronDown,
  ChevronRight,
  Plus,
  Type,
  Pen,
  Hand,
  Star,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  Copy,
  MoreHorizontal,
  Search,
  Menu,
  Share2,
  MessageSquare,
  Pentagon,
  Layout,
  ArrowUp,
  ArrowDown,
  Undo2,
  Redo2,
} from "lucide-react";
import { useCollaboration } from "@/hooks/useCollaboration";
import {
  CanvasShape,
  Camera,
  Vec2,
  vec,
  AABB,
  screenToWorld,
  worldToScreen,
  zoomAtPoint,
  pointInShape,
  getHandles,
  HandlePosition,
  handleCursor,
  createShape,
  deg2rad,
  rad2deg,
  clamp,
  ShapeType,
  shapeAABB,
  vrot,
  buildShapeMap,
  worldToLocal,
  // Matrix3 system
  SceneGraph,
  CommandHistory,
  AddShapeCommand,
  DeleteShapesCommand,
  UpdateShapeCommand,
  MoveCommand,
  BatchCommand,
  // New engine modules
  ConstraintSolver,
  AutoLayoutEngine,
  SnappingEngine,
  EditorState,
  FloatingOrigin,
  CRDTDocument,
} from "@/lib/canvasEngine";
import type { SnapGuide } from "@/lib/snappingEngine";
import { mat3TransformPoint, mat3Inverse } from "@/lib/matrix3";
import { renderAll } from "@/lib/canvasRenderer";

// Tool type
type Tool =
  | "select"
  | "hand"
  | "frame"
  | "rectangle"
  | "ellipse"
  | "line"
  | "pen"
  | "text"
  | "star"
  | "polygon"
  | "comment";

// Interaction mode
type InteractionMode =
  | "idle"
  | "panning"
  | "drawing"
  | "selecting"
  | "moving"
  | "resizing"
  | "rotating"
  | "pen-drawing";

interface Page {
  id: string;
  name: string;
}

export type FigmaCanvasProps = {
  projectId: string;
  projectName: string;
  lastSaved?: string;
  currentUser: { id: string; email: string } | null;
  ownerEmail?: string;
  onShare?: () => void;
};

export default function FigmaCanvas({
  projectId,
  projectName,
  lastSaved,
  currentUser,
  ownerEmail,
  onShare,
}: FigmaCanvasProps) {
  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Core state
  const [shapes, setShapes] = useState<CanvasShape[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, zoom: 1 });
  const [tool, setTool] = useState<Tool>("select");
  const [mode, setMode] = useState<InteractionMode>("idle");
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  // Pages
  const [pages, setPages] = useState<Page[]>([{ id: "page-1", name: "Page 1" }]);
  const [currentPageId, setCurrentPageId] = useState("page-1");

  // Interaction transient state (refs for perf)
  const modeRef = useRef<InteractionMode>("idle");
  const toolRef = useRef<Tool>("select");
  const cameraRef = useRef<Camera>({ x: 0, y: 0, zoom: 1 });
  const shapesRef = useRef<CanvasShape[]>([]);
  const selectedIdsRef = useRef<Set<string>>(new Set());
  const drawStart = useRef<Vec2>(vec());
  const panStart = useRef<Vec2>(vec());
  const moveOffsets = useRef<Map<string, Vec2>>(new Map());
  const resizeHandle = useRef<HandlePosition>("br");
  const resizeOrigin = useRef<{ shape: CanvasShape; mouse: Vec2 }>({
    shape: {} as CanvasShape,
    mouse: vec(),
  });
  const rotateStart = useRef<{ angle: number; shapeRotation: number }>({
    angle: 0,
    shapeRotation: 0,
  });
  const selectionRect = useRef<AABB | null>(null);
  const dragPreview = useRef<{
    type: string;
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const penPoints = useRef<Vec2[]>([]);
  const dropTargetRef = useRef<string | null>(null);

  // ── Scene Graph (transform hierarchy + spatial index) ──
  const sceneGraphRef = useRef<SceneGraph>(new SceneGraph());
  // ── Command History (undo / redo) ──
  const cmdHistoryRef = useRef<CommandHistory>(new CommandHistory());
  // ── New Engine Modules ──
  const constraintSolverRef = useRef(new ConstraintSolver());
  const autoLayoutRef = useRef(new AutoLayoutEngine());
  const snappingRef = useRef(new SnappingEngine());
  const editorStateRef = useRef(new EditorState());
  const floatingOriginRef = useRef(new FloatingOrigin());
  const crdtDocRef = useRef<CRDTDocument | null>(null);
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  const hoverIdRef = useRef<string | null>(null);
  const snapGuidesRef = useRef<SnapGuide[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  // Snapshot for move / resize / rotate undo (captured at mouse-down)
  const moveSnapshotRef = useRef<CanvasShape[] | null>(null);

  // Sync refs
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { cameraRef.current = camera; }, [camera]);
  useEffect(() => { shapesRef.current = shapes; }, [shapes]);
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);

  // Rebuild scene graph whenever shapes change
  useEffect(() => {
    const pageS = shapes.filter(s => s.pageId === currentPageId);
    sceneGraphRef.current.rebuild(pageS);
  }, [shapes, currentPageId]);

  // Subscribe to command history changes
  useEffect(() => {
    const unsub = cmdHistoryRef.current.subscribe(() => {
      setCanUndo(cmdHistoryRef.current.canUndo());
      setCanRedo(cmdHistoryRef.current.canRedo());
    });
    return unsub;
  }, []);

  // UI sidebar state
  const [leftTab, setLeftTab] = useState<"file" | "assets">("file");
  const [rightTab, setRightTab] = useState<"design" | "prototype">("design");
  const [selectedColor, setSelectedColor] = useState("#818CF8");
  const [collaborators, setCollaborators] = useState<
    Array<{ id: string; email: string; color: string }>
  >([]);

  // Derived
  const zoomPct = Math.round(camera.zoom * 100);
  const pageShapes = shapes.filter((s) => s.pageId === currentPageId);
  const sortedShapes = [...pageShapes].sort((a, b) => a.zIndex - b.zIndex);
  const selectedShapes = sortedShapes.filter((s) => selectedIds.has(s.id));
  const freePages = 3 - pages.length;

  // Collaboration
  const getUserToken = () => {
    if (typeof window === "undefined") return "anonymous";
    const cookies = document.cookie.split(";");
    for (const c of cookies) {
      const [n, v] = c.trim().split("=");
      if (n === "token") return v;
    }
    let t = localStorage.getItem("collab_token");
    if (!t) {
      t = `user_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem("collab_token", t);
    }
    return t;
  };

  const collaboration = useCollaboration({
    projectId,
    token: getUserToken(),
    onParticipantJoin: (p) =>
      setCollaborators((prev) =>
        prev.some((c) => c.id === p.id)
          ? prev
          : [...prev, { id: p.id, email: p.email, color: p.color }],
      ),
    onParticipantLeave: (uid) =>
      setCollaborators((prev) => prev.filter((c) => c.id !== uid)),
  });

  useEffect(() => {
    const ps = Array.from(collaboration.state.participants.values());
    const filtered = ps.filter(
      (p) => p.id !== collaboration.state.currentUser?.id,
    );
    setCollaborators(
      filtered.map((p) => ({ id: p.id, email: p.email, color: p.color })),
    );
  }, [collaboration.state.participants, collaboration.state.currentUser]);

  // Helpers
  const formatLastSaved = (d?: string) => {
    if (!d) return "Never saved";
    const diff = Date.now() - new Date(d).getTime();
    const m = Math.floor(diff / 60000);
    const h = Math.floor(m / 60);
    if (m < 1) return "Saved just now";
    if (m < 60) return `Saved ${m}m ago`;
    if (h < 24) return `Saved ${h}h ago`;
    return `Saved on ${new Date(d).toLocaleDateString()}`;
  };
  const getUserInitials = (e: string) => e.charAt(0).toUpperCase();
  const getUserColor = (e: string) => {
    const c = [
      "#3B82F6",
      "#10B981",
      "#F59E0B",
      "#EF4444",
      "#8B5CF6",
      "#EC4899",
    ];
    const hv = e.split("").reduce((a, ch) => a + ch.charCodeAt(0), 0);
    return c[hv % c.length];
  };

  // Canvas render loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Retina / HiDPI: size the backing buffer at device resolution
    const bufW = Math.round(rect.width * dpr);
    const bufH = Math.round(rect.height * dpr);
    if (canvas.width !== bufW || canvas.height !== bufH) {
      canvas.width = bufW;
      canvas.height = bufH;
    }

    // Scale context so we draw in CSS pixel coordinates,
    // but the backing buffer is at device pixel resolution.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const pageS = shapesRef.current.filter(
      (s) => s.pageId === currentPageId,
    );
    renderAll(
      ctx,
      rect.width,
      rect.height,
      cameraRef.current,
      pageS,
      selectedIdsRef.current,
      selectionRect.current,
      dragPreview.current,
      dropTargetRef.current,
      sceneGraphRef.current,
      {
        hoverId: hoverIdRef.current,
        snapGuides: snapGuidesRef.current,
      },
    );
  }, [currentPageId]);

  useEffect(() => {
    let running = true;
    const loop = () => {
      if (!running) return;
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [draw]);

  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(c);
    return () => ro.disconnect();
  }, [draw]);

  // ── Undo / Redo helpers ──────────────────────────────────
  const performUndo = useCallback(() => {
    const result = cmdHistoryRef.current.undo(shapesRef.current);
    if (result) {
      setShapes(result);
      shapesRef.current = result;
    }
  }, []);
  const performRedo = useCallback(() => {
    const result = cmdHistoryRef.current.redo(shapesRef.current);
    if (result) {
      setShapes(result);
      shapesRef.current = result;
    }
  }, []);

  // Shape CRUD (wired through CommandHistory)
  const addShape = (s: CanvasShape) => {
    const cmd = new AddShapeCommand(s);
    const result = cmdHistoryRef.current.execute(cmd, shapesRef.current);
    setShapes(result);
  };
  const updateShape = (id: string, patch: Partial<CanvasShape>) =>
    setShapes((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );
  const removeShapes = (ids: Set<string>) => {
    const cmd = new DeleteShapesCommand(shapesRef.current, ids);
    const result = cmdHistoryRef.current.execute(cmd, shapesRef.current);
    setShapes(result);
    setSelectedIds(new Set());
  };
  const duplicateSelected = () => {
    const news: CanvasShape[] = [];
    for (const s of shapesRef.current) {
      if (!selectedIdsRef.current.has(s.id)) continue;
      const dup = {
        ...s,
        id: `shape_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        x: s.x + 20,
        y: s.y + 20,
        zIndex: s.zIndex + 0.01,
      };
      news.push(dup);
    }
    if (news.length) {
      setShapes((prev) => [...prev, ...news]);
      setSelectedIds(new Set(news.map((n) => n.id)));
    }
  };

  // Layer ordering
  const bringToFront = () => {
    const maxZ = Math.max(0, ...shapesRef.current.map((s) => s.zIndex));
    let z = maxZ;
    setShapes((prev) =>
      prev.map((s) =>
        selectedIdsRef.current.has(s.id) ? { ...s, zIndex: ++z } : s,
      ),
    );
  };
  const sendToBack = () => {
    const minZ = Math.min(0, ...shapesRef.current.map((s) => s.zIndex));
    let z = minZ;
    setShapes((prev) =>
      prev.map((s) =>
        selectedIdsRef.current.has(s.id) ? { ...s, zIndex: --z } : s,
      ),
    );
  };

  // Mouse helpers
  const worldPosFromEvent = (e: React.MouseEvent | MouseEvent): Vec2 => {
    const canvas = canvasRef.current;
    if (!canvas) return vec();
    const rect = canvas.getBoundingClientRect();
    return screenToWorld(
      vec(e.clientX - rect.left, e.clientY - rect.top),
      cameraRef.current,
    );
  };
  const screenPosFromEvent = (e: React.MouseEvent | MouseEvent): Vec2 => {
    const canvas = canvasRef.current;
    if (!canvas) return vec();
    const rect = canvas.getBoundingClientRect();
    return vec(e.clientX - rect.left, e.clientY - rect.top);
  };

  // Hit test handles (uses scene graph world transforms)
  const hitHandle = (
    wp: Vec2,
  ): { shapeId: string; handle: HandlePosition } | null => {
    const cam = cameraRef.current;
    const hs = 10 / cam.zoom;
    const sg = sceneGraphRef.current;
    for (const s of [...shapesRef.current].reverse()) {
      if (!selectedIdsRef.current.has(s.id)) continue;
      // Use scene graph world transform to get world-space handle positions
      const wt = sg.getWorldTransform(s.id);
      // Handles in local space (0,0 to width,height)
      const localHandles: Array<{ position: HandlePosition; lx: number; ly: number }> = [
        { position: "tl", lx: 0, ly: 0 },
        { position: "tc", lx: s.width / 2, ly: 0 },
        { position: "tr", lx: s.width, ly: 0 },
        { position: "ml", lx: 0, ly: s.height / 2 },
        { position: "mr", lx: s.width, ly: s.height / 2 },
        { position: "bl", lx: 0, ly: s.height },
        { position: "bc", lx: s.width / 2, ly: s.height },
        { position: "br", lx: s.width, ly: s.height },
        { position: "rotate", lx: s.width / 2, ly: -24 / cam.zoom },
      ];
      for (const lh of localHandles) {
        // Transform local handle position to world
        const worldH = mat3TransformPoint(wt, { x: lh.lx, y: lh.ly });
        if (
          Math.abs(wp.x - worldH.x) <= hs / 2 &&
          Math.abs(wp.y - worldH.y) <= hs / 2
        ) {
          return { shapeId: s.id, handle: lh.position };
        }
      }
    }
    return null;
  };

  // Selected shapes from ref
  const selectedShapesNow = () =>
    shapesRef.current.filter((s) => selectedIdsRef.current.has(s.id));

  // ──── Mouse Down ────────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const wp = worldPosFromEvent(e);
    const sp = screenPosFromEvent(e);
    const currentTool = toolRef.current;

    if (currentTool === "hand" || e.button === 1) {
      modeRef.current = "panning";
      setMode("panning");
      panStart.current = sp;
      return;
    }

    if (currentTool === "select") {
      // 1) Check handles
      const hh = hitHandle(wp);
      if (hh) {
        const s = shapesRef.current.find((sh) => sh.id === hh.shapeId);
        if (s) {
          // Use scene graph world transform for center calculation
          const sg = sceneGraphRef.current;
          const wCenter = sg.getWorldCenter(s.id);
          if (hh.handle === "rotate") {
            modeRef.current = "rotating";
            setMode("rotating");
            moveSnapshotRef.current = shapesRef.current.map(sh => ({ ...sh }));
            rotateStart.current = {
              angle: Math.atan2(wp.y - wCenter.y, wp.x - wCenter.x),
              shapeRotation: s.rotation,
            };
          } else {
            modeRef.current = "resizing";
            setMode("resizing");
            moveSnapshotRef.current = shapesRef.current.map(sh => ({ ...sh }));
            resizeHandle.current = hh.handle;
            resizeOrigin.current = { shape: { ...s }, mouse: wp };
          }
          return;
        }
      }

      // 2) Hit test shapes — use SceneGraph's precise geometry pipeline (O(log n))
      const sg = sceneGraphRef.current;
      const hitIds = sg.hitTestPointPrecise(wp);
      const hitId = hitIds.length > 0 ? hitIds[0] : null;
      const hit = hitId ? shapesRef.current.find(s => s.id === hitId) : null;

      if (hit) {
        const alreadySelected = selectedIdsRef.current.has(hit.id);
        let newSel: Set<string>;
        if (e.shiftKey && alreadySelected) {
          newSel = new Set(selectedIdsRef.current);
          newSel.delete(hit.id);
        } else if (e.shiftKey) {
          newSel = new Set(selectedIdsRef.current);
          newSel.add(hit.id);
        } else if (!alreadySelected) {
          newSel = new Set([hit.id]);
        } else {
          newSel = selectedIdsRef.current;
        }
        setSelectedIds(newSel);
        selectedIdsRef.current = newSel;

        modeRef.current = "moving";
        setMode("moving");
        moveSnapshotRef.current = shapesRef.current.map(sh => ({ ...sh }));
        moveOffsets.current = new Map();
        for (const id of newSel) {
          const sv = shapesRef.current.find((sh) => sh.id === id);
          if (sv) {
            // Use scene graph world transform for global position
            const wb = sg.getWorldBounds(sv.id);
            moveOffsets.current.set(id, vec(wb.minX - wp.x, wb.minY - wp.y));
          }
        }
      } else {
        if (!e.shiftKey) {
          setSelectedIds(new Set());
          selectedIdsRef.current = new Set();
        }
        modeRef.current = "selecting";
        setMode("selecting");
        drawStart.current = wp;
        selectionRect.current = null;
      }
      return;
    }

    if (currentTool === "pen") {
      penPoints.current.push(wp);
      modeRef.current = "pen-drawing";
      setMode("pen-drawing");
      return;
    }

    // Drawing shapes/frames
    modeRef.current = "drawing";
    setMode("drawing");
    drawStart.current = wp;
    dragPreview.current = null;
  };

  // ──── Mouse Move ────────────────────────────────────────────
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const wp = worldPosFromEvent(e);
    const sp = screenPosFromEvent(e);
    const m = modeRef.current;

    // Cursor styling + hover tracking — use SceneGraph's spatial index
    if (m === "idle" && toolRef.current === "select") {
      const hh = hitHandle(wp);
      const canvas = canvasRef.current;
      if (canvas) {
        if (hh) {
          canvas.style.cursor = handleCursor(hh.handle);
          hoverIdRef.current = null;
        } else {
          const sg = sceneGraphRef.current;
          const hitIds = sg.hitTestPoint(wp);
          const topHit = hitIds.length > 0 ? hitIds[0] : null;
          canvas.style.cursor = topHit ? "move" : "default";
          // Hover feedback — track which shape is under the cursor
          hoverIdRef.current = topHit;
        }
      }
    } else if (m !== "idle") {
      // Clear hover when interacting
      hoverIdRef.current = null;
    }

    if (m === "panning") {
      const dx = sp.x - panStart.current.x;
      const dy = sp.y - panStart.current.y;
      const cam = cameraRef.current;
      const newCam = { ...cam, x: cam.x + dx, y: cam.y + dy };
      cameraRef.current = newCam;
      setCamera(newCam);
      panStart.current = sp;
      // Floating origin rebase check
      floatingOriginRef.current.rebaseIfNeeded(-newCam.x / newCam.zoom, -newCam.y / newCam.zoom);
      return;
    }

    if (m === "moving") {
      // During move, shapes are positioned via world offsets then
      // converted to local space. SceneGraph drop target detection.

      // Snapping: compute snap for first selected shape's target position
      const firstOff = moveOffsets.current.values().next().value;
      const firstSel = Array.from(selectedIdsRef.current)[0];
      const firstShape = firstSel ? shapesRef.current.find(s => s.id === firstSel) : undefined;
      let snapDx = 0, snapDy = 0;
      if (firstOff && firstShape) {
        const sg = sceneGraphRef.current;
        const wb = sg.getWorldBounds(firstShape.id);
        const dragBounds: AABB = {
          minX: wb.minX,
          minY: wb.minY,
          maxX: wb.maxX,
          maxY: wb.maxY,
        };
        const targetX = wp.x + firstOff.x;
        const targetY = wp.y + firstOff.y;
        const snapResult = snappingRef.current.snap(
          dragBounds,
          targetX,
          targetY,
          selectedIdsRef.current,
          sg,
          cameraRef.current.zoom,
        );
        snapDx = snapResult.deltaX;
        snapDy = snapResult.deltaY;
        snapGuidesRef.current = snapResult.guides;
        setSnapGuides(snapResult.guides);
      }

      setShapes((prev) => {
        const lookup = buildShapeMap(prev);
        return prev.map((s) => {
          const off = moveOffsets.current.get(s.id);
          if (!off) return s;
          // Target global position + snap offset
          const targetGX = wp.x + off.x + snapDx;
          const targetGY = wp.y + off.y + snapDy;
          // Convert to current parent's local space
          const localPos = worldToLocal(vec(targetGX, targetGY), s.parentId, lookup);
          return { ...s, x: localPos.x, y: localPos.y };
        });
      });
      // Use SceneGraph's spatial index for drop target detection (O(log n))
      const sg = sceneGraphRef.current;
      const dtId = sg.findDropTarget(wp, selectedIdsRef.current);
      if (dtId !== dropTargetRef.current) {
        dropTargetRef.current = dtId;
        setDropTargetId(dtId);
      }
      return;
    }

    if (m === "resizing") {
      const orig = resizeOrigin.current.shape;
      const h = resizeHandle.current;
      const dx = wp.x - resizeOrigin.current.mouse.x;
      const dy = wp.y - resizeOrigin.current.mouse.y;
      let nx = orig.x,
        ny = orig.y,
        nw = orig.width,
        nh = orig.height;

      if (h.includes("r")) nw = Math.max(1, orig.width + dx);
      if (h.includes("l")) {
        nx = orig.x + dx;
        nw = Math.max(1, orig.width - dx);
      }
      if (h.includes("b")) nh = Math.max(1, orig.height + dy);
      if (h.includes("t")) {
        ny = orig.y + dy;
        nh = Math.max(1, orig.height - dy);
      }

      if (e.shiftKey) {
        const ratio = orig.width / orig.height;
        if (Math.abs(dx) > Math.abs(dy)) {
          nh = nw / ratio;
        } else {
          nw = nh * ratio;
        }
      }
      updateShape(orig.id, { x: nx, y: ny, width: nw, height: nh });

      // Run constraint solver on children after parent resize
      if (orig.type === "frame" && orig.children.length > 0) {
        const solved = constraintSolverRef.current.solveForResize(
          orig.id,
          orig.width,
          orig.height,
          shapesRef.current,
        );
        if (solved.length > 0) {
          setShapes((prev:any) => {
            const map = new Map(solved.map(s => [s.id, s]));
            return prev.map((s:any) => map.get(s.id) ?? s);
          });
        }
      }
      return;
    }

    if (m === "rotating") {
      const sel = selectedShapesNow();
      if (sel.length === 0) return;
      const s = sel[0];
      // Use SceneGraph world center for rotation
      const sg = sceneGraphRef.current;
      const wCenter = sg.getWorldCenter(s.id);
      const cx = wCenter.x;
      const cy = wCenter.y;
      const currentAngle = Math.atan2(wp.y - cy, wp.x - cx);
      let deg =
        rotateStart.current.shapeRotation +
        rad2deg(currentAngle - rotateStart.current.angle);
      if (e.shiftKey) deg = Math.round(deg / 15) * 15;
      updateShape(s.id, { rotation: deg });
      return;
    }

    if (m === "selecting") {
      const start = drawStart.current;
      selectionRect.current = {
        minX: Math.min(start.x, wp.x),
        minY: Math.min(start.y, wp.y),
        maxX: Math.max(start.x, wp.x),
        maxY: Math.max(start.y, wp.y),
      };
      // Use SceneGraph's spatial index for marquee selection (O(log n))
      const sg = sceneGraphRef.current;
      const hitIds = sg.hitTestRect(selectionRect.current);
      setSelectedIds(new Set(hitIds));
      selectedIdsRef.current = new Set(hitIds);
      return;
    }

    if (m === "drawing") {
      const start = drawStart.current;
      let w = wp.x - start.x;
      let h = wp.y - start.y;
      let x = start.x;
      let y = start.y;

      if (e.shiftKey && toolRef.current !== "line") {
        const size = Math.max(Math.abs(w), Math.abs(h));
        w = Math.sign(w) * size;
        h = Math.sign(h) * size;
      }

      if (w < 0) {
        x = start.x + w;
        w = -w;
      }
      if (h < 0) {
        y = start.y + h;
        h = -h;
      }

      if (toolRef.current === "line") {
        dragPreview.current = {
          type: "line",
          x: start.x,
          y: start.y,
          w: wp.x - start.x,
          h: wp.y - start.y,
        };
      } else {
        dragPreview.current = { type: toolRef.current, x, y, w, h };
      }
      return;
    }
  };

  // ──── Mouse Up ──────────────────────────────────────────────
  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const wp = worldPosFromEvent(e);
    const m = modeRef.current;

    if (m === "panning") {
      modeRef.current = "idle";
      setMode("idle");
      return;
    }

    // ── Finish resizing/rotating — push undo snapshot ──
    if (m === "resizing" || m === "rotating") {
      if (moveSnapshotRef.current) {
        // Create a batch undo command from the snapshot
        const before = moveSnapshotRef.current;
        const after = shapesRef.current.map(s => ({ ...s }));
        const snapshotCmd = {
          description: m === "resizing" ? "Resize shape" : "Rotate shape",
          execute: () => after,
          undo: () => before,
        };
        // Push directly onto history (already executed)
        cmdHistoryRef.current.execute(snapshotCmd, before);
        moveSnapshotRef.current = null;
      }
      modeRef.current = "idle";
      setMode("idle");
      return;
    }

    // ── Finish moving — use SceneGraph reparenting engine ──
    if (m === "moving") {
      // Clear snap guides
      snapGuidesRef.current = [];
      setSnapGuides([]);

      const dtId = dropTargetRef.current;
      dropTargetRef.current = null;
      setDropTargetId(null);

      // Use SceneGraph's matrix-aware reparenting (preserves visual position)
      const sg = sceneGraphRef.current;
      setShapes((prev) => {
        let updated = prev;
        for (const id of selectedIdsRef.current) {
          const shape = updated.find(s => s.id === id);
          if (!shape) continue;
          const newParentId = dtId ?? null;
          if (shape.parentId !== newParentId) {
            // SceneGraph.reparent uses matrix inverse for coord conversion
            updated = sg.reparent(id, newParentId, updated);
          }
        }
        return updated;
      });

      // Push undo snapshot for the entire move + reparent
      if (moveSnapshotRef.current) {
        const before = moveSnapshotRef.current;
        const after = shapesRef.current.map(s => ({ ...s }));
        const moveCmd = {
          description: dtId ? "Move & reparent" : "Move shape(s)",
          execute: () => after,
          undo: () => before,
        };
        cmdHistoryRef.current.execute(moveCmd, before);
        moveSnapshotRef.current = null;
      }

      modeRef.current = "idle";
      setMode("idle");
      return;
    }

    if (m === "selecting") {
      selectionRect.current = null;
      modeRef.current = "idle";
      setMode("idle");
      return;
    }

    if (m === "drawing") {
      const start = drawStart.current;
      let w = wp.x - start.x;
      let h = wp.y - start.y;
      let x = start.x;
      let y = start.y;
      const currentTool = toolRef.current;

      if (e.shiftKey && currentTool !== "line") {
        const size = Math.max(Math.abs(w), Math.abs(h));
        w = Math.sign(w || 1) * size;
        h = Math.sign(h || 1) * size;
      }

      if (currentTool !== "line") {
        if (w < 0) {
          x = start.x + w;
          w = -w;
        }
        if (h < 0) {
          y = start.y + h;
          h = -h;
        }
      }

      const minSize = currentTool === "text" ? 0 : 5;
      if (
        Math.abs(w) > minSize ||
        Math.abs(h) > minSize ||
        currentTool === "text"
      ) {
        const type: ShapeType =
          currentTool === "frame"
            ? "frame"
            : currentTool === "polygon"
              ? "polygon"
              : currentTool === "star"
                ? "star"
                : currentTool === "ellipse"
                  ? "ellipse"
                  : currentTool === "line"
                    ? "line"
                    : currentTool === "text"
                      ? "text"
                      : "rectangle";

        if (currentTool === "text") {
          w = Math.max(w, 100);
          h = Math.max(h, 24);
        }

        const s = createShape(type, x, y, w, h, currentPageId, {
          fill: currentTool === "frame" ? "#2A2A2A" : selectedColor,
          stroke: currentTool === "line" ? selectedColor : "",
          strokeWidth: currentTool === "line" ? 2 : 0,
          text: currentTool === "text" ? "Text" : undefined,
          fontSize: currentTool === "text" ? 16 : undefined,
        });
        addShape(s);
        setSelectedIds(new Set([s.id]));
        selectedIdsRef.current = new Set([s.id]);

        if (currentTool !== "pen") {
          setTool("select");
          toolRef.current = "select";
        }
      }

      dragPreview.current = null;
      modeRef.current = "idle";
      setMode("idle");
      return;
    }
  };

  // Double click
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (toolRef.current === "pen" && penPoints.current.length >= 2) {
      const pts = penPoints.current;
      const bb = {
        minX: Math.min(...pts.map((p) => p.x)),
        minY: Math.min(...pts.map((p) => p.y)),
        maxX: Math.max(...pts.map((p) => p.x)),
        maxY: Math.max(...pts.map((p) => p.y)),
      };
      const s = createShape(
        "path",
        bb.minX,
        bb.minY,
        bb.maxX - bb.minX || 1,
        bb.maxY - bb.minY || 1,
        currentPageId,
        {
          fill: selectedColor,
          points: pts.map((p) => vec(p.x - bb.minX, p.y - bb.minY)),
        },
      );
      addShape(s);
      setSelectedIds(new Set([s.id]));
      selectedIdsRef.current = new Set([s.id]);
      penPoints.current = [];
      setTool("select");
      toolRef.current = "select";
      modeRef.current = "idle";
      setMode("idle");
    }

    if (toolRef.current === "select") {
      const wp2 = worldPosFromEvent(e);
      // Use SceneGraph spatial index for text hit testing
      const sg = sceneGraphRef.current;
      const hitIds = sg.hitTestPoint(wp2);
      const hit = hitIds
        .map(id => shapesRef.current.find(s => s.id === id))
        .find(s => s?.type === "text");
      if (hit) {
        const newText = prompt("Edit text:", hit.text || "");
        if (newText !== null) updateShape(hit.id, { text: newText });
      }
    }
  };

  // Wheel
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sp = vec(e.clientX - rect.left, e.clientY - rect.top);

    if (e.ctrlKey || e.metaKey) {
      const delta = -e.deltaY * 0.003;
      const newCam = zoomAtPoint(cameraRef.current, sp, delta);
      cameraRef.current = newCam;
      setCamera(newCam);
    } else {
      const cam = cameraRef.current;
      const newCam = {
        ...cam,
        x: cam.x - e.deltaX,
        y: cam.y - e.deltaY,
      };
      cameraRef.current = newCam;
      setCamera(newCam);
    }
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    c.addEventListener("wheel", handleWheel, { passive: false });
    return () => c.removeEventListener("wheel", handleWheel);
  }, [handleWheel]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).tagName === "INPUT" ||
        (e.target as HTMLElement).tagName === "TEXTAREA"
      )
        return;

      const ctrl = e.ctrlKey || e.metaKey;

      if (!ctrl) {
        switch (e.key.toLowerCase()) {
          case "v":
            setTool("select");
            toolRef.current = "select";
            return;
          case "h":
            setTool("hand");
            toolRef.current = "hand";
            return;
          case "r":
            setTool("rectangle");
            toolRef.current = "rectangle";
            return;
          case "o":
            setTool("ellipse");
            toolRef.current = "ellipse";
            return;
          case "l":
            setTool("line");
            toolRef.current = "line";
            return;
          case "t":
            setTool("text");
            toolRef.current = "text";
            return;
          case "p":
            setTool("pen");
            toolRef.current = "pen";
            return;
          case "f":
            setTool("frame");
            toolRef.current = "frame";
            return;
        }
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedIdsRef.current.size) removeShapes(selectedIdsRef.current);
        return;
      }

      if (ctrl && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicateSelected();
        return;
      }

      if (ctrl && e.key.toLowerCase() === "a") {
        e.preventDefault();
        const all = shapesRef.current.filter(
          (s) => s.pageId === currentPageId && !s.locked,
        );
        setSelectedIds(new Set(all.map((s) => s.id)));
        selectedIdsRef.current = new Set(all.map((s) => s.id));
        return;
      }

      if (e.key === "Escape") {
        setSelectedIds(new Set());
        selectedIdsRef.current = new Set();
        penPoints.current = [];
        if (modeRef.current !== "idle") {
          modeRef.current = "idle";
          setMode("idle");
          dragPreview.current = null;
          selectionRect.current = null;
        }
        return;
      }

      // Undo / Redo
      if (ctrl && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        performUndo();
        return;
      }
      if (ctrl && ((e.key.toLowerCase() === "z" && e.shiftKey) || e.key.toLowerCase() === "y")) {
        e.preventDefault();
        performRedo();
        return;
      }

      if (e.key === "]") {
        bringToFront();
        return;
      }
      if (e.key === "[") {
        sendToBack();
        return;
      }

      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)
      ) {
        e.preventDefault();
        const d = e.shiftKey ? 10 : 1;
        const dx =
          e.key === "ArrowRight" ? d : e.key === "ArrowLeft" ? -d : 0;
        const dy =
          e.key === "ArrowDown" ? d : e.key === "ArrowUp" ? -d : 0;
        setShapes((prev) =>
          prev.map((s) =>
            selectedIdsRef.current.has(s.id)
              ? { ...s, x: s.x + dx, y: s.y + dy }
              : s,
          ),
        );
        return;
      }

      if (ctrl && e.key === "0") {
        e.preventDefault();
        cameraRef.current = { x: 0, y: 0, zoom: 1 };
        setCamera({ x: 0, y: 0, zoom: 1 });
        return;
      }

      if (e.key === "=" || e.key === "+") {
        const focalX = canvasRef.current
          ? canvasRef.current.getBoundingClientRect().width / 2
          : 400;
        const focalY = canvasRef.current
          ? canvasRef.current.getBoundingClientRect().height / 2
          : 300;
        const newCam = zoomAtPoint(
          cameraRef.current,
          vec(focalX, focalY),
          0.1,
        );
        cameraRef.current = newCam;
        setCamera(newCam);
        return;
      }
      if (e.key === "-") {
        const focalX = canvasRef.current
          ? canvasRef.current.getBoundingClientRect().width / 2
          : 400;
        const focalY = canvasRef.current
          ? canvasRef.current.getBoundingClientRect().height / 2
          : 300;
        const newCam = zoomAtPoint(
          cameraRef.current,
          vec(focalX, focalY),
          -0.1,
        );
        cameraRef.current = newCam;
        setCamera(newCam);
        return;
      }

      if (e.key === " " && !e.repeat) {
        e.preventDefault();
        setTool("hand");
        toolRef.current = "hand";
        return;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === " ") {
        setTool("select");
        toolRef.current = "select";
      }
    };

    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [currentPageId]);

  // Canvas cursor
  const canvasCursor = (): string => {
    if (mode === "panning") return "grabbing";
    if (tool === "hand") return "grab";
    if (tool === "select") return "default";
    return "crosshair";
  };

  // Add page
  const handleAddPage = () => {
    if (freePages <= 0) return;
    const p: Page = {
      id: `page-${Date.now()}`,
      name: `Page ${pages.length + 1}`,
    };
    setPages((prev) => [...prev, p]);
  };

  // Selected shape for right sidebar
  const selShape = selectedShapes.length === 1 ? selectedShapes[0] : null;

  // ═══════════════════════════════════════════════════════════
  // JSX
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-screen w-screen bg-[#0d0d0d] text-white overflow-hidden select-none">
      {/* Top Header */}
      <div className="h-10 bg-[#2c2c2c] border-b border-white/5 flex items-center justify-between px-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <button className="p-1.5 hover:bg-white/[0.08] rounded transition-colors">
            <Menu className="w-3.5 h-3.5 text-zinc-400" />
          </button>
          <button className="flex items-center gap-1.5 px-2 py-1 hover:bg-white/[0.08] rounded-md transition-colors">
            <span className="text-[13px] font-medium text-white">
              {projectName}
            </span>
            {ownerEmail &&
              currentUser &&
              ownerEmail !== currentUser.email && (
                <span className="text-[9px] px-1.5 py-0.5 bg-amber-500/10 text-amber-400 rounded">
                  Viewing
                </span>
              )}
            <ChevronDown className="w-3 h-3 text-zinc-500" />
          </button>
          <div className="flex items-center gap-1.5 ml-1">
            <div
              className={`w-1.5 h-1.5 rounded-full ${collaboration.state.connected ? "bg-green-500" : "bg-zinc-600"}`}
            />
            <span className="text-[11px] text-zinc-500">
              {formatLastSaved(lastSaved)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {collaborators.length > 0 && (
            <div className="flex items-center -space-x-1.5">
              {collaborators.slice(0, 3).map((c) => (
                <div
                  key={c.id}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-medium border-2 border-[#2c2c2c]"
                  style={{ backgroundColor: c.color }}
                  title={c.email}
                >
                  {getUserInitials(c.email)}
                </div>
              ))}
              {collaborators.length > 3 && (
                <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-white text-[10px] font-medium border-2 border-[#2c2c2c]">
                  +{collaborators.length - 3}
                </div>
              )}
            </div>
          )}
          {/* Undo / Redo */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={performUndo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              className="p-1 hover:bg-white/[0.08] rounded transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
            >
              <Undo2 className="w-3.5 h-3.5 text-zinc-400" />
            </button>
            <button
              onClick={performRedo}
              disabled={!canRedo}
              title="Redo (Ctrl+Shift+Z)"
              className="p-1 hover:bg-white/[0.08] rounded transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
            >
              <Redo2 className="w-3.5 h-3.5 text-zinc-400" />
            </button>
          </div>
          <span className="text-[11px] text-zinc-500">{zoomPct}%</span>
          <button
            onClick={onShare}
            className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-medium rounded-md transition-colors flex items-center gap-1.5"
          >
            <Share2 className="w-3 h-3" />
            Share
          </button>
          {currentUser && (
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-medium"
              style={{ backgroundColor: getUserColor(currentUser.email) }}
              title={currentUser.email}
            >
              {getUserInitials(currentUser.email)}
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-60 bg-[#1e1e1e] border-r border-white/[0.08] flex flex-col flex-shrink-0">
          {/* Tabs */}
          <div className="flex h-9 items-center border-b border-white/[0.08] px-1">
            <button
              onClick={() => setLeftTab("file")}
              className={`flex-1 h-7 flex items-center justify-center text-[11px] font-medium transition-colors rounded ${leftTab === "file" ? "text-white bg-white/[0.08]" : "text-zinc-400 hover:text-zinc-300"}`}
            >
              File
            </button>
            <button
              onClick={() => setLeftTab("assets")}
              className={`flex-1 h-7 flex items-center justify-center text-[11px] font-medium transition-colors rounded ${leftTab === "assets" ? "text-white bg-white/[0.08]" : "text-zinc-400 hover:text-zinc-300"}`}
            >
              Assets
            </button>
          </div>

          {/* Search */}
          <div className="p-2 border-b border-white/[0.08]">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600" />
              <input
                type="text"
                placeholder="Search"
                className="w-full h-6 pl-7 pr-2 bg-white/[0.03] border border-white/[0.1] rounded text-[11px] text-white placeholder-zinc-600 focus:outline-none focus:border-white/[0.2] focus:bg-white/[0.05] transition-colors"
              />
            </div>
          </div>

          {/* Pages */}
          <div className="px-2 py-2.5 border-b border-white/[0.08]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">
                Pages
              </span>
              <button
                onClick={handleAddPage}
                disabled={freePages <= 0}
                className="p-0.5 hover:bg-white/[0.08] rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Plus className="w-3 h-3 text-zinc-500" />
              </button>
            </div>
            {pages.map((page) => (
              <div
                key={page.id}
                onClick={() => setCurrentPageId(page.id)}
                className={`flex items-center gap-1.5 px-1.5 py-1 rounded cursor-pointer transition-colors ${currentPageId === page.id ? "bg-white/[0.08] text-white" : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-300"}`}
              >
                <ChevronRight className="w-3 h-3 flex-shrink-0 text-zinc-600" />
                <span className="text-[11px] flex-1 truncate">
                  {page.name}
                </span>
              </div>
            ))}
          </div>

          {/* Layers */}
          <div className="flex-1 overflow-y-auto px-2 py-2.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">
                Layers
              </span>
            </div>
            {sortedShapes.length === 0 ? (
              <div className="text-[11px] text-zinc-700 text-center py-10">
                No layers yet
              </div>
            ) : (
              <div className="space-y-px">
                {(() => {
                  // Use SceneGraph's tree traversal for layer panel
                  const sg = sceneGraphRef.current;
                  const flat = sg.flattenForLayerPanel();
                  return [...flat].reverse().map(({ id, depth }) => {
                    const shape = pageShapes.find(s => s.id === id);
                    if (!shape) return null;
                    return (
                      <div
                        key={shape.id}
                        className={`group flex items-center gap-1.5 py-1 rounded cursor-pointer transition-colors ${selectedIds.has(shape.id) ? "bg-white/[0.08] text-white" : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-300"}`}
                        style={{ paddingLeft: `${6 + depth * 12}px`, paddingRight: "6px" }}
                        onClick={(ev) => {
                          if (ev.shiftKey) {
                            const ns = new Set(selectedIds);
                            ns.has(shape.id)
                              ? ns.delete(shape.id)
                              : ns.add(shape.id);
                            setSelectedIds(ns);
                            selectedIdsRef.current = ns;
                          } else {
                            setSelectedIds(new Set([shape.id]));
                            selectedIdsRef.current = new Set([shape.id]);
                          }
                        }}
                      >
                        {depth > 0 && (
                          <span className="text-zinc-700 text-[9px] select-none" style={{ marginLeft: -4 }}>└</span>
                        )}
                        {shape.type === "frame" ? (
                          <Layout className="w-3 h-3 flex-shrink-0" />
                        ) : shape.type === "ellipse" ? (
                          <Circle className="w-3 h-3 flex-shrink-0" />
                        ) : shape.type === "star" ? (
                          <Star className="w-3 h-3 flex-shrink-0" />
                        ) : shape.type === "polygon" ? (
                          <Pentagon className="w-3 h-3 flex-shrink-0" />
                        ) : shape.type === "line" ? (
                          <Minus className="w-3 h-3 flex-shrink-0" />
                        ) : shape.type === "text" ? (
                          <Type className="w-3 h-3 flex-shrink-0" />
                        ) : shape.type === "path" ? (
                          <Pen className="w-3 h-3 flex-shrink-0" />
                        ) : (
                          <Square className="w-3 h-3 flex-shrink-0" />
                        )}
                        <span className="text-[11px] flex-1 truncate">
                          {shape.name}
                        </span>
                        <button
                          onClick={(ev) => {
                            ev.stopPropagation();
                            updateShape(shape.id, { visible: !shape.visible });
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-white/[0.08] rounded transition-all"
                        >
                          {shape.visible ? (
                            <Eye className="w-3 h-3" />
                          ) : (
                            <EyeOff className="w-3 h-3 text-zinc-600" />
                          )}
                        </button>
                        <button
                          onClick={(ev) => {
                            ev.stopPropagation();
                            updateShape(shape.id, { locked: !shape.locked });
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-white/[0.08] rounded transition-all"
                        >
                          {shape.locked ? (
                            <Lock className="w-3 h-3 text-amber-400" />
                          ) : (
                            <Unlock className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        </div>

        {/* Canvas Area */}
        <div
          ref={containerRef}
          className="flex-1 relative bg-[#1e1e1e] overflow-hidden"
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            style={{ cursor: canvasCursor() }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onDoubleClick={handleDoubleClick}
            onContextMenu={(e) => e.preventDefault()}
          />

          {/* Floating Toolbar */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#2c2c2c] border border-white/10 rounded-lg px-1.5 py-1.5 flex items-center gap-1 shadow-2xl">
            <TB
              icon={<MousePointer2 className="w-3.5 h-3.5" />}
              active={tool === "select"}
              onClick={() => {
                setTool("select");
                toolRef.current = "select";
              }}
              tip="Move (V)"
            />
            <div className="w-px h-5 bg-white/10 mx-0.5" />
            <TB
              icon={<Layout className="w-3.5 h-3.5" />}
              active={tool === "frame"}
              onClick={() => {
                setTool("frame");
                toolRef.current = "frame";
              }}
              tip="Frame (F)"
            />
            <div className="w-px h-5 bg-white/10 mx-0.5" />
            <TB
              icon={<Square className="w-3.5 h-3.5" />}
              active={tool === "rectangle"}
              onClick={() => {
                setTool("rectangle");
                toolRef.current = "rectangle";
              }}
              tip="Rectangle (R)"
            />
            <TB
              icon={<Circle className="w-3.5 h-3.5" />}
              active={tool === "ellipse"}
              onClick={() => {
                setTool("ellipse");
                toolRef.current = "ellipse";
              }}
              tip="Ellipse (O)"
            />
            <TB
              icon={<Minus className="w-3.5 h-3.5" />}
              active={tool === "line"}
              onClick={() => {
                setTool("line");
                toolRef.current = "line";
              }}
              tip="Line (L)"
            />
            <TB
              icon={<Star className="w-3.5 h-3.5" />}
              active={tool === "star"}
              onClick={() => {
                setTool("star");
                toolRef.current = "star";
              }}
              tip="Star"
            />
            <TB
              icon={<Pentagon className="w-3.5 h-3.5" />}
              active={tool === "polygon"}
              onClick={() => {
                setTool("polygon");
                toolRef.current = "polygon";
              }}
              tip="Polygon"
            />
            <div className="w-px h-5 bg-white/10 mx-0.5" />
            <TB
              icon={<Pen className="w-3.5 h-3.5" />}
              active={tool === "pen"}
              onClick={() => {
                setTool("pen");
                toolRef.current = "pen";
              }}
              tip="Pen (P)"
            />
            <div className="w-px h-5 bg-white/10 mx-0.5" />
            <TB
              icon={<Type className="w-3.5 h-3.5" />}
              active={tool === "text"}
              onClick={() => {
                setTool("text");
                toolRef.current = "text";
              }}
              tip="Text (T)"
            />
            <div className="w-px h-5 bg-white/10 mx-0.5" />
            <TB
              icon={<Hand className="w-3.5 h-3.5" />}
              active={tool === "hand"}
              onClick={() => {
                setTool("hand");
                toolRef.current = "hand";
              }}
              tip="Hand (H)"
            />
            <div className="w-px h-5 bg-white/10 mx-0.5" />
            <TB
              icon={<MessageSquare className="w-3.5 h-3.5" />}
              active={tool === "comment"}
              onClick={() => {
                setTool("comment");
                toolRef.current = "comment";
              }}
              tip="Comment (C)"
            />
          </div>

          {/* Zoom controls */}
          <div className="absolute bottom-4 right-4 bg-[#2c2c2c] border border-white/10 rounded-lg px-2 py-1 flex items-center gap-1.5 shadow-xl">
            <button
              onClick={() => {
                const c = zoomAtPoint(
                  cameraRef.current,
                  vec(
                    canvasRef.current!.getBoundingClientRect().width / 2,
                    canvasRef.current!.getBoundingClientRect().height / 2,
                  ),
                  -0.1,
                );
                cameraRef.current = c;
                setCamera(c);
              }}
              className="p-0.5 hover:bg-white/[0.08] rounded transition-colors"
            >
              <Minus className="w-3 h-3 text-zinc-400" />
            </button>
            <span className="text-[11px] min-w-[2.5rem] text-center text-zinc-400 font-medium">
              {zoomPct}%
            </span>
            <button
              onClick={() => {
                const c = zoomAtPoint(
                  cameraRef.current,
                  vec(
                    canvasRef.current!.getBoundingClientRect().width / 2,
                    canvasRef.current!.getBoundingClientRect().height / 2,
                  ),
                  0.1,
                );
                cameraRef.current = c;
                setCamera(c);
              }}
              className="p-0.5 hover:bg-white/[0.08] rounded transition-colors"
            >
              <Plus className="w-3 h-3 text-zinc-400" />
            </button>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-60 bg-[#1e1e1e] border-l border-white/[0.08] flex flex-col flex-shrink-0">
          {/* Tabs */}
          <div className="flex h-9 items-center border-b border-white/[0.08] px-1">
            <button
              onClick={() => setRightTab("design")}
              className={`flex-1 h-7 flex items-center justify-center text-[11px] font-medium transition-colors rounded ${rightTab === "design" ? "text-white bg-white/[0.08]" : "text-zinc-400 hover:text-zinc-300"}`}
            >
              Design
            </button>
            <button
              onClick={() => setRightTab("prototype")}
              className={`flex-1 h-7 flex items-center justify-center text-[11px] font-medium transition-colors rounded ${rightTab === "prototype" ? "text-white bg-white/[0.08]" : "text-zinc-400 hover:text-zinc-300"}`}
            >
              Prototype
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {selShape ? (
              <>
                {/* Transform */}
                <div className="px-2 py-2.5 border-b border-white/[0.08]">
                  <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide mb-2 block">
                    Transform
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    <PropInput
                      label="X"
                      value={Math.round(selShape.x)}
                      onChange={(v) => updateShape(selShape.id, { x: v })}
                    />
                    <PropInput
                      label="Y"
                      value={Math.round(selShape.y)}
                      onChange={(v) => updateShape(selShape.id, { y: v })}
                    />
                    <PropInput
                      label="W"
                      value={Math.round(selShape.width)}
                      onChange={(v) =>
                        updateShape(selShape.id, {
                          width: Math.max(1, v),
                        })
                      }
                    />
                    <PropInput
                      label="H"
                      value={Math.round(selShape.height)}
                      onChange={(v) =>
                        updateShape(selShape.id, {
                          height: Math.max(1, v),
                        })
                      }
                    />
                    <PropInput
                      label="R"
                      value={Math.round(selShape.rotation)}
                      onChange={(v) =>
                        updateShape(selShape.id, { rotation: v })
                      }
                    />
                    <PropInput
                      label="%"
                      value={Math.round(selShape.opacity * 100)}
                      onChange={(v) =>
                        updateShape(selShape.id, {
                          opacity: clamp(v / 100, 0, 1),
                        })
                      }
                    />
                  </div>
                </div>

                {/* Fill */}
                <div className="px-2 py-2.5 border-b border-white/[0.08]">
                  <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide mb-2 block">
                    Fill
                  </span>
                  <div className="flex items-center gap-2 p-1.5 bg-white/[0.03] border border-white/[0.1] rounded">
                    <div className="relative w-4 h-4 rounded overflow-hidden border border-white/[0.1]">
                      <input
                        type="color"
                        value={selShape.fill || "#000000"}
                        onChange={(e) => {
                          updateShape(selShape.id, {
                            fill: e.target.value,
                          });
                          setSelectedColor(e.target.value);
                        }}
                        className="absolute inset-0 w-full h-full cursor-pointer border-0"
                        style={{
                          transform: "scale(1.5)",
                          transformOrigin: "top left",
                        }}
                      />
                    </div>
                    <span className="text-[10px] flex-1 text-zinc-400 font-mono">
                      {(selShape.fill || "#000")
                        .replace("#", "")
                        .toUpperCase()}
                    </span>
                    <span className="text-[10px] text-zinc-600">
                      {Math.round(selShape.opacity * 100)} %
                    </span>
                  </div>
                </div>

                {/* Stroke */}
                <div className="px-2 py-2.5 border-b border-white/[0.08]">
                  <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide mb-2 block">
                    Stroke
                  </span>
                  <div className="flex items-center gap-2 p-1.5 bg-white/[0.03] border border-white/[0.1] rounded">
                    <div className="relative w-4 h-4 rounded overflow-hidden border border-white/[0.1]">
                      <input
                        type="color"
                        value={selShape.stroke || "#ffffff"}
                        onChange={(e) =>
                          updateShape(selShape.id, {
                            stroke: e.target.value,
                            strokeWidth: Math.max(selShape.strokeWidth, 1),
                          })
                        }
                        className="absolute inset-0 w-full h-full cursor-pointer border-0"
                        style={{
                          transform: "scale(1.5)",
                          transformOrigin: "top left",
                        }}
                      />
                    </div>
                    <span className="text-[10px] flex-1 text-zinc-400 font-mono">
                      {(selShape.stroke || "none")
                        .replace("#", "")
                        .toUpperCase()}
                    </span>
                    <PropInput
                      label="W"
                      value={selShape.strokeWidth}
                      onChange={(v) =>
                        updateShape(selShape.id, {
                          strokeWidth: Math.max(0, v),
                        })
                      }
                      small
                    />
                  </div>
                </div>

                {/* Corner radius */}
                {selShape.type === "rectangle" && (
                  <div className="px-2 py-2.5 border-b border-white/[0.08]">
                    <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide mb-2 block">
                      Corner Radius
                    </span>
                    <PropInput
                      label="R"
                      value={selShape.cornerRadius}
                      onChange={(v) =>
                        updateShape(selShape.id, {
                          cornerRadius: Math.max(0, v),
                        })
                      }
                    />
                  </div>
                )}

                {/* Actions */}
                <div className="px-2 py-2.5 border-b border-white/[0.08]">
                  <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide mb-2 block">
                    Actions
                  </span>
                  <div className="space-y-1">
                    <button
                      onClick={duplicateSelected}
                      className="w-full px-2 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] rounded text-[11px] flex items-center gap-2 text-zinc-300 transition-colors"
                    >
                      <Copy className="w-3 h-3" />
                      Duplicate
                    </button>
                    <button
                      onClick={bringToFront}
                      className="w-full px-2 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] rounded text-[11px] flex items-center gap-2 text-zinc-300 transition-colors"
                    >
                      <ArrowUp className="w-3 h-3" />
                      Bring to Front
                    </button>
                    <button
                      onClick={sendToBack}
                      className="w-full px-2 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] rounded text-[11px] flex items-center gap-2 text-zinc-300 transition-colors"
                    >
                      <ArrowDown className="w-3 h-3" />
                      Send to Back
                    </button>
                    <button
                      onClick={() => removeShapes(selectedIds)}
                      className="w-full px-2 py-1.5 bg-red-500/10 hover:bg-red-500/20 rounded text-[11px] flex items-center gap-2 text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Page color */}
                <div className="px-2 py-2.5 border-b border-white/[0.08]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">
                      Page
                    </span>
                    <ChevronDown className="w-3 h-3 text-zinc-600" />
                  </div>
                  <div className="flex items-center gap-2 p-1.5 bg-white/[0.03] border border-white/[0.1] rounded">
                    <div className="relative w-4 h-4 rounded overflow-hidden border border-white/[0.1]">
                      <input
                        type="color"
                        value={selectedColor}
                        onChange={(e) => setSelectedColor(e.target.value)}
                        className="absolute inset-0 w-full h-full cursor-pointer border-0"
                        style={{
                          transform: "scale(1.5)",
                          transformOrigin: "top left",
                        }}
                      />
                    </div>
                    <span className="text-[10px] flex-1 text-zinc-400 font-mono">
                      {selectedColor.replace("#", "").toUpperCase()}
                    </span>
                    <span className="text-[10px] text-zinc-600">100 %</span>
                  </div>
                </div>

                {["Variables", "Styles", "Export"].map((sec) => (
                  <div
                    key={sec}
                    className="px-2 py-2.5 border-b border-white/[0.08]"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wide">
                        {sec}
                      </span>
                      <Plus className="w-3 h-3 text-zinc-600" />
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Sub-components
function TB({
  icon,
  active,
  onClick,
  tip,
}: {
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  tip: string;
}) {
  return (
    <button
      onClick={onClick}
      title={tip}
      className={`p-1.5 rounded-md transition-colors ${
        active
          ? "bg-white/[0.15] text-white"
          : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.08]"
      }`}
    >
      {icon}
    </button>
  );
}

function PropInput({
  label,
  value,
  onChange,
  small,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  small?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-1 ${small ? "" : "bg-white/[0.03] border border-white/[0.1] rounded px-1.5 py-1"}`}
    >
      <span className="text-[9px] text-zinc-600 w-3">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`${small ? "w-8" : "flex-1 w-0"} bg-transparent text-[10px] text-zinc-300 font-mono outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
      />
    </div>
  );
}
