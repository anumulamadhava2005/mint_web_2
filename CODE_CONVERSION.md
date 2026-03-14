# Code Conversion: JSON Design Data to Framework Code

This document explains how design data (JSON snapshots like `todo.json`) is converted into executable code for various frameworks.

## Overview

The conversion pipeline transforms Figma-style design JSON into runnable code for the following target frameworks:

| Framework | Builder File | Output |
|-----------|--------------|--------|
| Next.js | [builders/next.ts](../src/app/api/convert/builders/next.ts) | Full Next.js app with live-sync |
| React (Vite) | [builders/react.ts](../src/app/api/convert/builders/react.ts) | Vite + React SPA |
| Vue | [builders/vue.ts](../src/app/api/convert/builders/vue.ts) | Vite + Vue 3 SPA |
| Svelte | [builders/svelte.ts](../src/app/api/convert/builders/svelte.ts) | Vite + Svelte SPA |
| React Native | [builders/reactNative.ts](../src/app/api/convert/builders/reactNative.ts) | Expo React Native app |
| Flutter | [builders/flutter.ts](../src/app/api/convert/builders/flutter.ts) | Flutter mobile app |

---

## Data Flow Architecture

```
┌─────────────────────┐
│  JSON Snapshot      │   (e.g., todo.json)
│  - roots[]          │
│  - version          │
│  - payload          │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  POST /api/convert  │   Entry point
│  (route.ts)         │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  buildDrawableTree  │   Normalizes node structure
│  (core/tree.ts)     │   Calculates absolute positions
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Framework Builder  │   Target-specific generator
│  (builders/*.ts)    │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  JSZip Package      │   Downloadable .zip file
│  - package.json     │
│  - source files     │
│  - assets           │
└─────────────────────┘
```

---

## Step 1: Input JSON Structure

The input JSON (like [todo.json](../public/live/snapshots/todo.json)) follows this structure:

```typescript
{
  "version": 2,
  "payload": {
    "roots": [
      {
        "id": "unique_id",           // Node identifier
        "type": "FRAME" | "TEXT" | "RECTANGLE" | ...,
        "name": "ComponentName",      // Used for data-name attributes
        "x": 0,                       // Position relative to parent
        "y": 0,
        "width": 400,                 // Dimensions
        "height": 300,
        "ax": 520,                    // Absolute X (canvas coordinates)
        "ay": 200,                    // Absolute Y (canvas coordinates)
        "w": 400,                     // Width (alternative)
        "h": 300,                     // Height (alternative)
        "fill": {                     // Background style
          "type": "SOLID" | "GRADIENT_LINEAR" | "IMAGE",
          "color": "#1e293b",
          "imageRef": "data:..." | "https://...",
          "fit": "cover" | "contain" | "fill"
        },
        "stroke": {                   // Border style
          "color": "#3b82f6",
          "weight": 2,
          "dashPattern": [5, 5]
        },
        "corners": {                  // Border radius
          "uniform": 16,
          "topLeft": 8,
          "topRight": 8,
          "bottomRight": 8,
          "bottomLeft": 8
        },
        "effects": [                  // Shadows
          { "type": "DROP_SHADOW", "boxShadow": "0px 4px 8px rgba(0,0,0,0.1)" }
        ],
        "text": {                     // Text styling (for TEXT nodes)
          "fontSize": 14,
          "fontFamily": "system-ui",
          "fontWeight": "bold",
          "color": "#ffffff",
          "characters": "Button Text",
          "textAlign": "center"
        },
        "children": [...]             // Nested child nodes
      }
    ]
  }
}
```

---

## Step 2: Tree Building (core/tree.ts)

The `buildDrawableTree()` function normalizes input nodes into a consistent structure:

```typescript
// Input: raw Figma-like nodes
// Output: DrawableNode[] with computed positions

export function buildDrawableTree(
  nodes: NodeInput[], 
  parentAX = 0, 
  parentAY = 0
): DrawableNode[]
```

**Key transformations:**
1. **Position calculation**: Computes absolute (ax, ay) and local (x, y) coordinates
2. **Fill normalization**: Picks best fill from `fills[]` array (IMAGE > GRADIENT > SOLID)
3. **Stroke normalization**: Extracts primary stroke from `strokes[]` array
4. **Text extraction**: Normalizes text content from `characters`, `textContent`, or `textRaw`

---

## Step 3: Style Mapping (core/render.ts)

The `cssFromDrawableLocal()` function converts node properties to CSS:

```typescript
// Maps DrawableNode → React.CSSProperties

export function cssFromDrawableLocal(d: DrawableNode) {
  const style = {
    position: "absolute",
    left: d.x,
    top: d.y,
    width: d.w,
    height: d.h,
    boxSizing: "border-box",
  };

  // Background (SOLID or GRADIENT)
  if (d.fill?.type === "SOLID") {
    style.background = d.fill.color;
  } else if (d.fill?.type.startsWith("GRADIENT")) {
    style.backgroundImage = cssGradient(d.fill);
  }

  // Border
  if (d.stroke?.weight) {
    style.borderWidth = d.stroke.weight;
    style.borderStyle = d.stroke.dashPattern ? "dashed" : "solid";
    style.borderColor = d.stroke.color;
  }

  // Border radius
  if (d.corners?.uniform) {
    style.borderRadius = d.corners.uniform;
  }

  // Text styling
  if (d.type === "TEXT" && d.text) {
    style.fontSize = d.text.fontSize;
    style.fontFamily = d.text.fontFamily;
    style.fontWeight = d.text.fontWeight;
    style.color = d.text.color;
  }

  return style;
}
```

---

## Step 4: JSX Tree Rendering (core/render.ts)

The `renderTree()` function generates JSX string output:

```typescript
export function renderTree(
  nodes: DrawableNode[], 
  manifest: Map<string, string>,  // Image URL → local path mapping
  indent = 6
): string
```

**Node type handling:**
- **TEXT nodes** → `<Box isText={true} text="..." />`
- **IMAGE nodes** → `<Img src="..." style={...} />`
- **SHAPE nodes** → `<Box style={...} />` or `<div style={...}>...</div>`

**Example output:**
```jsx
<div style={{position:"absolute",left:520,top:200,width:400,height:480,...}} data-name="LoginCard">
  <Box style={{...}} dataName="Title" text="Welcome Back" isText={true} />
  <Img style={{...}} src="/assets/avatar.png" alt="Avatar" />
</div>
```

---

## Step 5: Framework-Specific Builders

### React (Vite) Builder

**File:** [builders/react.ts](../src/app/api/convert/builders/react.ts)

```typescript
export function buildReactVite(zip, name, roots, ref, manifest, imageBlobs) {
  // Generate package.json
  zip.file("package.json", JSON.stringify({
    scripts: { dev: "vite", build: "vite build" },
    dependencies: { react: "^18.2.0", "react-dom": "^18.2.0" },
    devDependencies: { vite: "^5.0.0", typescript: "^5.4.0" },
  }));

  // Generate App.tsx with rendered tree
  const content = renderTree(roots, manifest, 8);
  src.file("App.tsx", `
    export default function App() {
      return (
        <ResponsiveStage refW={${stageW}} refH={${stageH}}>
          ${content}
        </ResponsiveStage>
      );
    }
  `);
}
```

### Vue Builder

**File:** [builders/vue.ts](../src/app/api/convert/builders/vue.ts)

- Generates Vue 3 Single File Components (`.vue`)
- Embeds the tree data as JSON and renders via recursive Vue component
- Uses Composition API (`<script setup>`)

### Flutter Builder

**File:** [builders/flutter.ts](../src/app/api/convert/builders/flutter.ts)

- Generates Dart code with `Stack` + `Positioned` widgets
- Maps styles to Flutter `Container`, `BoxDecoration`, `BorderRadius`

---

## Step 6: Image Handling (core/images.ts)

Images are processed during conversion:

1. **Data URLs** (`data:image/png;base64,...`):
   - Embedded directly in `<img src="data:...">`

2. **HTTP URLs**:
   - Downloaded and saved to `public/assets/`
   - Referenced as `/assets/filename.ext`

3. **Figma image references**:
   - Mapped via manifest to local paths

---

## Step 7: UX Enhancements (core/tree.ts)

The converter applies smart layout transformations:

### Horizontal Scroll Detection
```typescript
// Nodes that overflow the reference frame become scrollable strips
wrapOverflowAsHorizontal(root, referenceFrame);
```

### Carousel Detection
```typescript
// 3+ large items in a row → snap-scroll carousel
if (isCarousel) {
  wrapper.ux = { scrollX: true, snap: true, peek: true };
}
```

### Elevation Styling
```typescript
// Middle item in a strip gets elevated shadow
if (idx === 1) {
  child.ux = { elevate: true };
}
```

---

## Step 8: Interactions (Optional)

If the input includes interactions:

```json
{
  "interactions": [
    {
      "sourceId": "login_button",
      "targetId": "dashboard_page",
      "type": "NAVIGATE",
      "trigger": "ON_CLICK",
      "animation": { "name": "slide", "direction": "left", "durationMs": 300 }
    }
  ]
}
```

These are:
1. Filtered to only include nodes present in the export
2. Deduplicated
3. Written to `interactions.json`
4. Integrated into Next.js builds for live navigation

---

## API Endpoint

**`POST /api/convert`**

**Request body:**
```json
{
  "target": "react" | "nextjs" | "vue" | "svelte" | "react-native" | "flutter",
  "fileName": "project-name",
  "nodes": [...],
  "referenceFrame": { "id": "...", "x": 0, "y": 0, "width": 1440, "height": 900 },
  "interactions": [...],
  "fileKey": "project-id-for-live-sync"
}
```

**Response:**
- `Content-Type: application/zip`
- Downloadable ZIP with full project structure

---

## Output File Structure

### React (Vite)
```
project-react.zip/
├── package.json
├── index.html
├── tsconfig.json
├── README.md
├── IMAGES.txt
├── interactions.json
├── public/
│   └── assets/
│       └── *.png, *.jpg
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── globals.css
    └── lib/
        ├── tokens.ts
        └── color.ts
```

### Next.js
```
project-nextjs.zip/
├── package.json
├── next.config.js
├── .env.local           # Live sync configuration
├── app/
│   ├── page.tsx         # Static render
│   └── live/
│       └── page.tsx     # Live-synced version
├── src/
│   └── live/
│       └── runtime.tsx  # Live tree renderer
└── public/
    └── assets/
```

---

## Helper Components

### Box Component
Renders shape and text nodes with proper styling:
```tsx
function Box({ style, dataName, text, isText, onClick }) {
  return (
    <div style={style} data-name={dataName} onClick={onClick}>
      {isText && text && <div style={textStyle}>{text}</div>}
    </div>
  );
}
```

### Img Component
Renders image fills with fallback handling:
```tsx
function Img({ style, src, alt }) {
  return src 
    ? <img src={src} alt={alt} style={style} />
    : <div style={style} data-img-missing="" />;
}
```

### ResponsiveStage
Scales the design to fit viewport while maintaining aspect ratio:
```tsx
function ResponsiveStage({ refW, refH, children }) {
  // Uses ResizeObserver to calculate scale factor
  // Applies CSS transform: scale(factor)
}
```

---

## Summary

The conversion pipeline:

1. **Parses** JSON snapshot with nested node structure
2. **Normalizes** positions, fills, strokes, and text
3. **Transforms** to drawable tree with computed coordinates
4. **Renders** to framework-specific code (JSX, Vue SFC, Dart)
5. **Packages** into downloadable ZIP with dependencies
6. **Includes** images, styles, and optional interactions
