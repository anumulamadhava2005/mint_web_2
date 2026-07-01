// Pure translator: FigmaLayer tree → runtime schema types.
// No React, no hooks, no side effects.

import type { FigmaLayer, FigmaPage } from '@/lib/stores/figmaStore';
import type {
  AppSchema,
  ScreenSchema,
  ComponentSchema,
  ComponentType,
  StyleSchema,
  LayoutStyle,
  BackgroundStyle,
  BorderStyle,
  TypographyStyle,
  EffectStyle,
  SizingStyle,
  ActionRef,
} from './schema';

// ── Layer type mapping ───────────────────────────────────────

const LAYER_TYPE_MAP: Record<string, ComponentType> = {
  frame: 'frame',
  section: 'frame',
  group: 'group',
  rect: 'rect',
  ellipse: 'rect',   // ellipse renders as rect with border-radius:50% via props
  line: 'line',
  text: 'text',
  image: 'image',
  input: 'input',
  vector: 'rect',
  component: 'frame',
  instance: 'frame',
  comment: 'text',   // shouldn't reach here — filtered above
};

// The editor's binding picker writes scoped paths ($global.x, $page.x) while the
// runtime state engine uses flat state paths ($x). Normalize so the editor and
// preview agree. Auth/params/api/theme/repeat-item paths pass through unchanged.
function normalizeExpr(expr: string): string {
  return expr.replace(/\$(global|page)\.([A-Za-z_][A-Za-z0-9_.]*)/g, '$$$2');
}

function normalizeBindings(bindings: Record<string, string> | undefined): Record<string, string> {
  if (!bindings) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(bindings)) out[k] = normalizeExpr(v);
  return out;
}

// ── Style builder ────────────────────────────────────────────

function buildStyle(layer: FigmaLayer): StyleSchema {
  const fill = layer.fills.find(f => f.visible !== false && f.type !== 'none');
  const stroke = layer.strokes.find(s => s.visible !== false);

  const layout: LayoutStyle = {
    position: 'absolute',
    left: layer.x,
    top: layer.y,
    ...(layer.clipContent ? { } : {}),
  };

  if (layer.autoLayout) {
    const al = layer.autoLayout;
    const justifyMap: Record<string, LayoutStyle['justify']> = {
      start: 'start', center: 'center', end: 'end', 'space-between': 'between',
    };
    const alignMap: Record<string, LayoutStyle['align']> = {
      start: 'start', center: 'center', end: 'end',
    };
    layout.display = 'flex';
    layout.direction = al.direction === 'horizontal' ? 'row' : 'column';
    layout.gap = al.gap;
    layout.justify = justifyMap[al.primaryAlign] ?? 'start';
    layout.align = alignMap[al.counterAlign] ?? 'start';
    layout.wrap = al.wrap;
  }

  const sizing: SizingStyle = {
    width: layer.width,
    height: layer.height,
  };

  const background: BackgroundStyle = {};
  // A text layer's fill is its TEXT color (applied via typography below), not a
  // background — otherwise text renders as a solid box of its own color.
  if (fill && layer.type !== 'text') {
    if (fill.type === 'solid') {
      background.color = fill.color;
      if (fill.opacity < 1) background.opacity = fill.opacity;
    } else if (fill.type === 'linear' && fill.stops?.length) {
      background.gradient = {
        type: 'linear',
        colors: fill.stops.map(s => s.color),
        angle: fill.gradientAngle ?? 90,
      };
    } else if (fill.type === 'radial' && fill.stops?.length) {
      background.gradient = {
        type: 'radial',
        colors: fill.stops.map(s => s.color),
      };
    } else if (fill.type === 'image' && fill.imageUrl) {
      background.image = {
        uri: fill.imageUrl,
        fit: (fill.imageFit === 'crop' ? 'cover' : fill.imageFit) as BackgroundStyle['image'] extends { fit?: infer F } ? F : never,
      };
    }
  }
  if (layer.opacity !== 1 && !background.opacity) {
    background.opacity = layer.opacity;
  }

  const border: BorderStyle = {};
  if (stroke) {
    border.width = stroke.weight;
    border.color = stroke.color;
    border.style = stroke.type as BorderStyle['style'];
  }
  if (layer.cornerRadius) {
    border.radius = layer.cornerRadius;
  }

  const effects: EffectStyle = {};
  const shadows = layer.effects.filter(e => e.visible && (e.type === 'drop-shadow' || e.type === 'inner-shadow'));
  if (shadows.length > 0) {
    effects.shadow = shadows.map(e => ({
      x: e.x, y: e.y, blur: e.blur, spread: e.spread, color: e.color ?? '#000000',
    }));
  }
  const blurEff = layer.effects.find(e => e.visible && e.type === 'layer-blur');
  if (blurEff) effects.blur = blurEff.blur;
  if (layer.rotation) {
    effects.transform = { rotate: layer.rotation };
  }
  if (layer.clipContent) {
    effects.overflow = 'hidden';
  }

  const style: StyleSchema = {};
  if (Object.keys(layout).length > 0) style.layout = layout;
  if (Object.keys(sizing).length > 0) style.sizing = sizing;
  if (Object.keys(background).length > 0) style.background = background;
  if (Object.keys(border).length > 0) style.border = border;
  if (Object.keys(effects).length > 0) style.effects = effects;

  if (layer.type === 'text' || layer.fontFamily || layer.fontSize) {
    const typography: TypographyStyle = {};
    if (layer.fontFamily) typography.fontFamily = layer.fontFamily;
    if (layer.fontSize) typography.fontSize = layer.fontSize;
    if (layer.fontWeight) typography.fontWeight = layer.fontWeight as TypographyStyle['fontWeight'];
    if (layer.fontStyle) typography.fontStyle = layer.fontStyle as TypographyStyle['fontStyle'];
    if (layer.lineHeight) typography.lineHeight = layer.lineHeight;
    if (layer.letterSpacing) typography.letterSpacing = layer.letterSpacing;
    if (layer.textAlign) typography.textAlign = layer.textAlign as TypographyStyle['textAlign'];
    if (layer.textDecoration) typography.textDecoration = layer.textDecoration;
    if (layer.textTransform) typography.textTransform = layer.textTransform;
    const textFill = layer.fills.find(f => f.visible !== false && f.type === 'solid');
    if (textFill) typography.color = textFill.color;
    if (Object.keys(typography).length > 0) style.typography = typography;
  }

  return style;
}

// ── Event mapping ────────────────────────────────────────────

function buildEvents(layer: FigmaLayer): Record<string, ActionRef[]> | undefined {
  const events: Record<string, ActionRef[]> = {};

  // Prototype interactions → navigation/modal events.
  for (const int of layer.interactions ?? []) {
    const evtKey =
      int.trigger === 'click' ? 'onPress'
      : int.trigger === 'hover' ? 'onHover'
      : int.trigger === 'press' ? 'onPress'
      : 'onPress';

    let ref: ActionRef;
    if (int.action === 'navigate' && int.targetFrameId) {
      ref = { actionId: 'navigate', params: { screen: int.targetFrameId } };
    } else if (int.action === 'back') {
      ref = { actionId: 'goBack', params: {} };
    } else if (int.action === 'openOverlay' && int.targetFrameId) {
      ref = { actionId: 'openModal', params: { screen: int.targetFrameId } };
    } else {
      continue;
    }

    if (!events[evtKey]) events[evtKey] = [];
    events[evtKey].push(ref);
  }

  // Wired action flows: layerEvents maps an event name → action flow IDs.
  // Each flow is registered as a global action under the same ID (see
  // figmaStoreToAppSchema), so we reference it directly.
  for (const [evtKey, flowIds] of Object.entries(layer.layerEvents ?? {})) {
    for (const id of flowIds) {
      if (!events[evtKey]) events[evtKey] = [];
      events[evtKey].push({ actionId: id });
    }
  }

  return Object.keys(events).length > 0 ? events : undefined;
}

// ── Single layer → ComponentSchema ──────────────────────────

export function figmaLayerToComponent(layer: FigmaLayer): ComponentSchema {
  const type: ComponentType = LAYER_TYPE_MAP[layer.type] ?? 'rect';
  const props: Record<string, string | number | boolean | null> = {};

  if (layer.type === 'text') {
    props.text = layer.text ?? '';
  }
  if (layer.type === 'ellipse') {
    // signal to renderer: full border-radius
    props._ellipse = true;
  }
  if (layer.type === 'image') {
    const fill = layer.fills.find(f => f.type === 'image');
    if (fill?.imageUrl) props.src = fill.imageUrl;
  }
  if (layer.type === 'input') {
    props.inputType = layer.inputType ?? 'text';
    if (layer.placeholder) props.placeholder = layer.placeholder;
  }

  const children: ComponentSchema[] | undefined =
    layer.children && layer.children.length > 0
      ? layer.children
          .filter(c => c.type !== 'comment' && c.visible !== false)
          .map(figmaLayerToComponent)
      : undefined;

  const events = buildEvents(layer);

  return {
    id: layer.id,
    type,
    props,
    bindings: normalizeBindings(layer.bindings),
    children,
    style: buildStyle(layer),
    ...(events ? { events } : {}),
    ...(layer.repeatFor ? { repeatFor: { ...layer.repeatFor, items: normalizeExpr(layer.repeatFor.items) } } : {}),
    ...(layer.conditionalRender ? { conditionalRender: normalizeExpr(layer.conditionalRender) } : {}),
  };
}

// ── Page frames → ScreenSchema[] ────────────────────────────

export function figmaPageToScreenSchemas(
  page: FigmaPage,
  pageLayers: FigmaLayer[]
): ScreenSchema[] {
  const frames = pageLayers.filter(
    l => l.type === 'frame' || l.type === 'component' || l.type === 'section'
  );

  return frames.map((frame, index) => {
    const slug = frame.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const route = index === 0 ? '/' : `/${slug}`;
    const fill = frame.fills.find(f => f.visible !== false && f.type === 'solid');

    const components: ComponentSchema[] = (frame.children ?? [])
      .filter(c => c.type !== 'comment')
      .map(figmaLayerToComponent);

    return {
      id: frame.id,
      name: frame.name,
      route,
      components,
      localState: [],
      actions: [],
      width: frame.width,
      height: frame.height,
      backgroundColor: fill?.color ?? '#ffffff',
    } satisfies ScreenSchema;
  });
}

// ── Merge: preserve runtime fields, update visual fields ─────

export function mergeCanvasScreens(
  existing: AppSchema,
  newScreens: ScreenSchema[]
): AppSchema {
  const existingMap = new Map(existing.screens.map(s => [s.id, s]));

  const merged: ScreenSchema[] = newScreens.map(newScreen => {
    const old = existingMap.get(newScreen.id);
    if (!old) return newScreen;
    // Preserve runtime-owned fields, replace visual fields from canvas
    return {
      ...newScreen,
      localState: old.localState,
      actions: old.actions,
      onMount: old.onMount,
      onUnmount: old.onUnmount,
      meta: old.meta,
    };
  });

  // Rebuild navigation routes to match screens
  const routes = merged.map(s => ({ path: s.route, screenId: s.id }));

  return {
    ...existing,
    screens: merged,
    navigation: {
      ...existing.navigation,
      routes,
      initialRoute: merged[0]?.route ?? existing.navigation.initialRoute,
    },
  };
}
