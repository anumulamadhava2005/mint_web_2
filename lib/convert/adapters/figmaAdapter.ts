// Translates FigmaLayer[] (from figmaStore) → DesignNode[] / ConversionRequest
// so the Figma canvas can feed the existing convertDesign() pipeline.

import type { FigmaLayer, Fill as FigmaFill, Stroke as FigmaStroke, Effect as FigmaEffect, AutoLayout, Interaction as FigmaInteraction } from '@/lib/stores/figmaStore';
import type {
  DesignNode, ConversionRequest, Fill, Stroke, Effect, LayoutProperties,
  TextStyle, Interaction, NodeType, FillType, EffectType,
  InteractionTrigger, InteractionAction, Animation, BlendMode,
  LayoutMode, LayoutJustify, LayoutAlign, LayoutSizing, TargetFramework,
} from '@/lib/convert/types';

// ── Snapshot shape (serialised figmaStore state) ─────────────────
export interface FigmaStoreSnapshot {
  fileName: string;
  pages: Array<{ id: string; name: string }>;
  layers: Record<string, FigmaLayer[]>;
  activePageId: string;
}

// ── Helpers ──────────────────────────────────────────────────────

function mapLayerType(t: FigmaLayer['type']): NodeType | null {
  switch (t) {
    case 'frame':     return 'FRAME';
    case 'section':   return 'FRAME';
    case 'group':     return 'GROUP';
    case 'rect':      return 'RECTANGLE';
    case 'ellipse':   return 'ELLIPSE';
    case 'line':      return 'LINE';
    case 'text':      return 'TEXT';
    case 'image':     return 'IMAGE';
    case 'vector':    return 'VECTOR';
    case 'component': return 'COMPONENT';
    case 'instance':  return 'INSTANCE';
    case 'comment':   return null; // skip
    default:          return 'RECTANGLE';
  }
}

function mapFill(f: FigmaFill): Fill | null {
  if (!f.visible || f.type === 'none') return null;

  const base = { opacity: f.opacity, blendMode: mapBlendMode(f.blendMode) };

  switch (f.type) {
    case 'solid':
      return { type: 'SOLID', color: f.color, ...base };
    case 'linear':
      return {
        type: 'GRADIENT_LINEAR',
        gradientStops: (f.stops ?? []).map(s => ({ position: s.position, color: s.color, opacity: s.opacity })),
        gradientAngle: f.gradientAngle ?? 90,
        ...base,
      };
    case 'radial':
      return {
        type: 'GRADIENT_RADIAL',
        gradientStops: (f.stops ?? []).map(s => ({ position: s.position, color: s.color, opacity: s.opacity })),
        ...base,
      };
    case 'angular':
      return {
        type: 'GRADIENT_ANGULAR',
        gradientStops: (f.stops ?? []).map(s => ({ position: s.position, color: s.color, opacity: s.opacity })),
        ...base,
      };
    case 'image':
      return {
        type: 'IMAGE',
        imageRef: f.imageUrl ?? '',
        imageFit: f.imageFit === 'fit' ? 'contain' : f.imageFit === 'crop' ? 'cover' : f.imageFit === 'fill' ? 'fill' : (f.imageFit as 'tile' | undefined) ?? 'fill',
        ...base,
      };
    default:
      return null;
  }
}

function mapStroke(s: FigmaStroke): Stroke | null {
  if (!s.visible) return null;
  return {
    color: s.color,
    opacity: s.opacity,
    weight: s.weight,
    align: s.position === 'inside' ? 'INSIDE' : s.position === 'outside' ? 'OUTSIDE' : 'CENTER',
    cap: 'NONE',
    join: 'MITER',
    dashPattern: s.type === 'dashed' ? [8, 4] : s.type === 'dotted' ? [2, 4] : [],
  };
}

function mapEffect(e: FigmaEffect): Effect | null {
  if (!e.visible) return null;
  const typeMap: Record<FigmaEffect['type'], EffectType> = {
    'drop-shadow': 'DROP_SHADOW',
    'inner-shadow': 'INNER_SHADOW',
    'layer-blur': 'LAYER_BLUR',
    'background-blur': 'BACKGROUND_BLUR',
  };
  return {
    type: typeMap[e.type],
    visible: true,
    color: e.color,
    offsetX: e.x,
    offsetY: e.y,
    blur: e.blur,
    spread: e.spread,
  };
}

function mapBlendMode(bm: string): BlendMode {
  const map: Record<string, BlendMode> = {
    normal: 'NORMAL', multiply: 'MULTIPLY', screen: 'SCREEN',
    overlay: 'OVERLAY', darken: 'DARKEN', lighten: 'LIGHTEN',
    'color-dodge': 'COLOR_DODGE', 'color-burn': 'COLOR_BURN',
    'hard-light': 'HARD_LIGHT', 'soft-light': 'SOFT_LIGHT',
    difference: 'DIFFERENCE', exclusion: 'EXCLUSION',
    hue: 'HUE', saturation: 'SATURATION', color: 'COLOR', luminosity: 'LUMINOSITY',
  };
  return map[bm] ?? 'NORMAL';
}

function mapLayout(al: AutoLayout): LayoutProperties {
  const justifyMap: Record<string, LayoutJustify> = {
    start: 'MIN', center: 'CENTER', end: 'MAX', 'space-between': 'SPACE_BETWEEN',
  };
  const alignMap: Record<string, LayoutAlign> = {
    start: 'MIN', center: 'CENTER', end: 'MAX',
  };
  const sizingMap: Record<string, LayoutSizing> = {
    fixed: 'FIXED', hug: 'HUG', fill: 'FILL',
  };

  return {
    mode: (al.direction === 'horizontal' ? 'HORIZONTAL' : 'VERTICAL') as LayoutMode,
    direction: al.direction === 'horizontal' ? 'ROW' : 'COLUMN',
    wrap: al.wrap ? 'WRAP' : 'NO_WRAP',
    gap: al.gap,
    paddingTop: al.paddingTop,
    paddingRight: al.paddingRight,
    paddingBottom: al.paddingBottom,
    paddingLeft: al.paddingLeft,
    primaryAxisAlign: justifyMap[al.primaryAlign] ?? 'MIN',
    counterAxisAlign: alignMap[al.counterAlign] ?? 'MIN',
    layoutSizingHorizontal: sizingMap[al.widthMode] ?? 'FIXED',
    layoutSizingVertical: sizingMap[al.heightMode] ?? 'FIXED',
  };
}

function mapTextStyle(layer: FigmaLayer): TextStyle | undefined {
  if (layer.type !== 'text') return undefined;
  const textAlignMap: Record<string, TextStyle['textAlign']> = {
    left: 'LEFT', center: 'CENTER', right: 'RIGHT', justify: 'JUSTIFIED',
  };
  const textFill = layer.fills.find(f => f.visible && f.type === 'solid');
  return {
    characters: layer.text ?? '',
    fontFamily: layer.fontFamily,
    fontSize: layer.fontSize,
    fontWeight: layer.fontWeight,
    lineHeight: layer.lineHeight,
    letterSpacing: layer.letterSpacing,
    textAlign: textAlignMap[layer.textAlign ?? 'left'] ?? 'LEFT',
    textDecoration: layer.textDecoration === 'underline' ? 'UNDERLINE'
      : layer.textDecoration === 'line-through' ? 'STRIKETHROUGH' : 'NONE',
    textCase: layer.textTransform === 'uppercase' ? 'UPPER'
      : layer.textTransform === 'lowercase' ? 'LOWER'
      : layer.textTransform === 'capitalize' ? 'TITLE' : 'ORIGINAL',
    paragraphSpacing: layer.paragraphSpacing,
    color: textFill?.color,
    opacity: textFill?.opacity,
  };
}

function mapInteraction(int: FigmaInteraction, sourceId: string): Interaction {
  const triggerMap: Record<FigmaInteraction['trigger'], InteractionTrigger> = {
    click: 'ON_CLICK', hover: 'ON_HOVER', press: 'ON_PRESS', drag: 'ON_DRAG',
  };
  const actionMap: Record<FigmaInteraction['action'], InteractionAction> = {
    navigate: 'NAVIGATE', openOverlay: 'OPEN_OVERLAY',
    scrollTo: 'SCROLL_TO', back: 'BACK',
  };
  const transitionMap: Record<FigmaInteraction['transition'], Animation['type']> = {
    instant: 'INSTANT', dissolve: 'DISSOLVE',
    'slide-left': 'SLIDE_IN', 'slide-right': 'SLIDE_IN',
    'push-left': 'PUSH', 'push-right': 'PUSH',
    'smart-animate': 'SMART_ANIMATE',
  };
  const directionMap: Record<string, Animation['direction']> = {
    'slide-left': 'LEFT', 'slide-right': 'RIGHT',
    'push-left': 'LEFT', 'push-right': 'RIGHT',
  };

  return {
    id: int.id,
    sourceId,
    trigger: triggerMap[int.trigger] ?? 'ON_CLICK',
    action: actionMap[int.action] ?? 'NAVIGATE',
    targetId: int.targetFrameId,
    animation: int.transition !== 'instant' ? {
      type: transitionMap[int.transition] ?? 'DISSOLVE',
      direction: directionMap[int.transition],
      easing: int.easing === 'ease-in' ? 'EASE_IN'
        : int.easing === 'ease-out' ? 'EASE_OUT'
        : int.easing === 'ease-in-out' ? 'EASE_IN_OUT' : 'LINEAR',
      duration: int.duration,
    } : undefined,
  };
}

// ── Core converter ───────────────────────────────────────────────

export function figmaLayerToDesignNode(layer: FigmaLayer): DesignNode | null {
  const nodeType = mapLayerType(layer.type);
  if (!nodeType) return null; // skip comments

  const fills = layer.fills.map(mapFill).filter((f): f is Fill => f !== null);
  const strokes = layer.strokes.map(mapStroke).filter((s): s is Stroke => s !== null);
  const effects = layer.effects.map(mapEffect).filter((e): e is Effect => e !== null);

  const node: DesignNode = {
    id: layer.id,
    name: layer.name,
    type: nodeType,
    visible: layer.visible,
    locked: layer.locked,
    x: layer.x,
    y: layer.y,
    width: layer.width,
    height: layer.height,
    rotation: layer.rotation || undefined,
    opacity: layer.opacity !== 1 ? layer.opacity : undefined,
    blendMode: mapBlendMode(layer.blendMode),
    fills: fills.length > 0 ? fills : undefined,
    strokes: strokes.length > 0 ? strokes : undefined,
    effects: effects.length > 0 ? effects : undefined,
    corners: layer.cornerRadius ? { uniform: layer.cornerRadius } : undefined,
    clipContent: layer.clipContent,
    componentId: layer.componentId,
    text: mapTextStyle(layer),
    layout: layer.autoLayout ? mapLayout(layer.autoLayout) : undefined,
  };

  // Recurse children (skip comment children)
  if (layer.children && layer.children.length > 0) {
    const mapped = layer.children
      .map(figmaLayerToDesignNode)
      .filter((n): n is DesignNode => n !== null);
    if (mapped.length > 0) node.children = mapped;
  }

  return node;
}

// Collect all interactions from the entire layer tree
function collectInteractions(layers: FigmaLayer[]): Interaction[] {
  const result: Interaction[] = [];
  const walk = (arr: FigmaLayer[]) => {
    for (const l of arr) {
      if (l.type === 'comment') continue;
      for (const int of l.interactions ?? []) {
        result.push(mapInteraction(int, l.id));
      }
      if (l.children) walk(l.children);
    }
  };
  walk(layers);
  return result;
}

// ── Public API ───────────────────────────────────────────────────

export function figmaStoreToConversionRequest(
  snapshot: FigmaStoreSnapshot,
  framework: TargetFramework,
  options?: ConversionRequest['options']
): ConversionRequest {
  const pageLayers = snapshot.layers[snapshot.activePageId] ?? [];

  // Top-level frames become screens / root nodes
  const rootLayers = pageLayers.filter(
    l => l.type === 'frame' || l.type === 'component' || l.type === 'section'
  );

  const nodes = rootLayers
    .map(figmaLayerToDesignNode)
    .filter((n): n is DesignNode => n !== null);

  const interactions = collectInteractions(pageLayers);

  const firstFrame = rootLayers[0];
  const referenceFrame = firstFrame ? {
    id: firstFrame.id,
    x: 0,
    y: 0,
    width: firstFrame.width,
    height: firstFrame.height,
  } : undefined;

  return {
    target: framework,
    fileName: snapshot.fileName || 'design-export',
    nodes,
    referenceFrame,
    interactions,
    options: options ?? {},
  };
}
