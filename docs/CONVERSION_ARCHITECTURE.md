# Design-to-Code Conversion Architecture

A comprehensive, extensible system for converting design data (JSON/Figma-style exports) into production-ready code for multiple frameworks.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Quick Start](#quick-start)
4. [API Reference](#api-reference)
5. [Type System](#type-system)
6. [Core Modules](#core-modules)
7. [Framework Builders](#framework-builders)
8. [Design Data Format](#design-data-format)
9. [Extending the System](#extending-the-system)
10. [Best Practices](#best-practices)

---

## Overview

This conversion system transforms design tool exports (Figma, Penpot, or custom formats) into runnable code for:

| Framework | Builder | Output |
|-----------|---------|--------|
| React | `lib/convert/builders/react.ts` | Vite + React SPA |
| Next.js | `lib/convert/builders/next.ts` | Next.js App Router with optional live-sync |
| Vue 3 | `lib/convert/builders/vue.ts` | Vite + Vue 3 Composition API |
| Svelte | `lib/convert/builders/svelte.ts` | Vite + Svelte SPA |
| React Native | `lib/convert/builders/reactNative.ts` | Expo React Native app |
| Flutter | `lib/convert/builders/flutter.ts` | Flutter mobile app |

### Key Features

- **Type-Safe**: Comprehensive TypeScript types for all design primitives
- **Modular**: Plugin architecture for extending builders
- **Smart UX**: Automatic detection of scrollable areas, carousels, and clickable elements
- **Image Handling**: Automatic image extraction, download, and bundling
- **Live Sync**: Optional real-time sync support for Next.js builds
- **Portable**: Generates standalone projects with all dependencies

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      API Layer                                   │
│                   POST /api/convert                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Conversion Pipeline                            │
│                  lib/convert/index.ts                            │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │  Parse   │→ │  Build   │→ │  Apply   │→ │    Generate      │ │
│  │  Input   │  │  Tree    │  │    UX    │  │     Code         │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
           ┌──────────────────┼──────────────────┐
           ▼                  ▼                  ▼
    ┌────────────┐    ┌────────────┐    ┌────────────┐
    │   Core     │    │  Builders  │    │   Types    │
    │ Utilities  │    │            │    │            │
    ├────────────┤    ├────────────┤    ├────────────┤
    │ • tree.ts  │    │ • react    │    │ • Design   │
    │ • styles   │    │ • next     │    │   Nodes    │
    │ • images   │    │ • vue      │    │ • Drawable │
    │ • render   │    │ • svelte   │    │   Nodes    │
    └────────────┘    │ • rn       │    │ • Options  │
                      │ • flutter  │    └────────────┘
                      └────────────┘
```

### Module Breakdown

```
lib/convert/
├── index.ts              # Main entry point, exports convertDesign()
├── types.ts              # Complete type definitions
├── core/
│   ├── index.ts          # Core module exports
│   ├── tree.ts           # Tree building & UX enhancement
│   ├── styles.ts         # CSS/style generation
│   ├── images.ts         # Image collection & processing
│   └── render.ts         # JSX/HTML rendering
└── builders/
    ├── index.ts          # Builder registry
    ├── react.ts          # React (Vite) builder
    ├── next.ts           # Next.js builder
    ├── vue.ts            # Vue 3 builder
    ├── svelte.ts         # Svelte builder
    ├── reactNative.ts    # React Native builder
    └── flutter.ts        # Flutter builder
```

---

## Quick Start

### Basic Usage

```typescript
import { convertDesign } from "@/lib/convert";

const result = await convertDesign({
  target: "react",
  fileName: "my-design",
  nodes: designData.payload.roots,
  referenceFrame: {
    width: 1440,
    height: 900,
  },
});

if (result.success) {
  // result.files contains all generated files
  console.log(`Generated ${result.files.length} files`);
}
```

### API Endpoint

```bash
# Convert to React
curl -X POST http://localhost:3000/api/convert \
  -H "Content-Type: application/json" \
  -d '{
    "target": "react",
    "fileName": "my-project",
    "nodes": [...],
    "referenceFrame": { "width": 1440, "height": 900 }
  }' \
  --output my-project-react.zip

# Get available frameworks
curl http://localhost:3000/api/convert
```

---

## API Reference

### POST /api/convert

Converts design data to framework-specific code.

**Request Body:**

```typescript
{
  // Required
  target: "react" | "nextjs" | "vue" | "svelte" | "react-native" | "flutter",
  nodes: DesignNode[],
  
  // Optional
  fileName?: string,                    // Default: "design-export"
  referenceFrame?: {
    id?: string,
    x?: number,                         // Default: 0
    y?: number,                         // Default: 0
    width?: number,                     // Default: 1440
    height?: number,                    // Default: 900
  },
  interactions?: Interaction[],         // Navigation/trigger definitions
  options?: ConversionOptions,
}
```

**Conversion Options:**

```typescript
{
  generateTypeScript?: boolean,         // Default: true
  includeComments?: boolean,            // Default: false
  cssFramework?: "tailwind" | "styled-components" | "css-modules" | "inline",
  embedImages?: boolean,                // Default: false
  imageQuality?: number,                // Default: 90 (1-100)
  indentSize?: number,                  // Default: 2
  
  // Framework-specific
  nextjsAppRouter?: boolean,            // Default: true
  vueCompositionApi?: boolean,          // Default: true
  enableLiveSync?: boolean,             // Default: false
  fileKey?: string,                     // Required if enableLiveSync is true
}
```

**Response:**

- Success: ZIP file download with `Content-Type: application/zip`
- Error: JSON with `{ success: false, error: string, details?: any }`

### GET /api/convert

Returns list of available frameworks.

```json
{
  "success": true,
  "frameworks": [
    { "name": "react", "displayName": "React (Vite)" },
    { "name": "nextjs", "displayName": "Next.js" },
    { "name": "vue", "displayName": "Vue 3" },
    { "name": "svelte", "displayName": "Svelte" },
    { "name": "react-native", "displayName": "React Native (Expo)" },
    { "name": "flutter", "displayName": "Flutter" }
  ]
}
```

---

## Type System

### DesignNode (Input)

The raw design node format as exported from design tools:

```typescript
interface DesignNode {
  id: UUID;                           // Unique identifier
  name?: string;                      // Layer name
  type: NodeType;                     // FRAME, TEXT, RECTANGLE, etc.
  
  // Geometry
  x: number;                          // Position X
  y: number;                          // Position Y  
  width: number;                      // Width
  height: number;                     // Height
  rotation?: number;                  // Rotation in degrees
  
  // Styling
  fills?: Fill[];                     // Background fills
  strokes?: Stroke[];                 // Borders
  effects?: Effect[];                 // Shadows, blurs
  corners?: CornerRadius;             // Border radius
  opacity?: number;                   // 0-1
  
  // Text (for TEXT nodes)
  text?: TextStyle;
  
  // Layout
  layout?: LayoutProperties;          // Auto-layout / flexbox
  
  // Hierarchy
  children?: DesignNode[];            // Child nodes
}
```

### DrawableNode (Processed)

The normalized node format used internally:

```typescript
interface DrawableNode {
  id: UUID;
  name: string;                       // Sanitized name
  type: NodeType;
  
  // Computed positions
  x: number;                          // Local X (relative to parent)
  y: number;                          // Local Y
  ax: number;                         // Absolute X (canvas)
  ay: number;                         // Absolute Y
  w: number;                          // Width
  h: number;                          // Height
  
  // Normalized (single value, not arrays)
  fill?: Fill;                        // Best fill from fills[]
  stroke?: Stroke;                    // Primary stroke
  effects?: Effect[];                 // With pre-computed CSS
  
  // UX enhancements
  ux?: UXEnhancements;                // Auto-detected patterns
  
  // Interactions
  interactions?: Interaction[];       // Attached interactions
  
  children?: DrawableNode[];
}
```

### Fill Types

```typescript
interface Fill {
  type: "SOLID" | "GRADIENT_LINEAR" | "GRADIENT_RADIAL" | "GRADIENT_ANGULAR" | "IMAGE";
  visible?: boolean;
  opacity?: number;
  
  // Solid
  color?: string;                     // Hex or rgba
  
  // Gradient
  gradientStops?: GradientStop[];
  gradientAngle?: number;
  
  // Image
  imageRef?: string;                  // data: URL, http: URL, or ref
  imageFit?: "fill" | "cover" | "contain" | "tile";
}
```

### Interactions

```typescript
interface Interaction {
  id?: UUID;
  sourceId: UUID;                     // Node that triggers
  trigger: InteractionTrigger;        // ON_CLICK, ON_HOVER, etc.
  action: InteractionAction;          // NAVIGATE, OPEN_OVERLAY, etc.
  targetId?: UUID;                    // Target node/page
  destinationUrl?: string;            // For OPEN_URL action
  animation?: Animation;              // Transition animation
  delay?: number;                     // Delay in ms
}
```

---

## Core Modules

### Tree Builder (`core/tree.ts`)

Transforms design nodes into drawable nodes with computed absolute positions.

```typescript
import { buildDrawableTree, applyUXEnhancements } from "@/lib/convert/core";

// Build the drawable tree
const drawableTree = buildDrawableTree(
  designNodes,              // Input nodes
  parentX,                  // Parent absolute X (default: 0)
  parentY,                  // Parent absolute Y (default: 0)
  interactions              // Optional interactions array
);

// Apply UX enhancements (scroll detection, etc.)
const enhancedTree = applyUXEnhancements(
  drawableTree,
  referenceWidth,
  referenceHeight
);
```

**Key Functions:**

| Function | Description |
|----------|-------------|
| `buildDrawableTree()` | Converts DesignNode[] → DrawableNode[] |
| `applyUXEnhancements()` | Detects scrollable areas, carousels, buttons |
| `flattenTree()` | Flattens tree to array |
| `findNodeById()` | Finds node by ID in tree |
| `calculateBoundingBox()` | Computes bounds of all nodes |

### Style Generator (`core/styles.ts`)

Converts drawable nodes to CSS properties.

```typescript
import { cssFromDrawable, cssToReactStyle, tailwindFromDrawable } from "@/lib/convert/core";

// Get CSS properties object
const style = cssFromDrawable(node, {
  useAbsolutePosition: false,         // Use ax/ay instead of x/y
  omitPosition: false,                // Skip position properties
});

// Convert to React style string
const reactStyle = cssToReactStyle(style, indent);
// => "{\n  position: \"absolute\",\n  left: 100,\n  ..."

// Get Tailwind classes
const classes = tailwindFromDrawable(node);
// => ["absolute", "w-[200px]", "bg-[#1a1a1a]", ...]
```

### Image Handler (`core/images.ts`)

Collects, processes, and bundles images.

```typescript
import { 
  collectImages, 
  buildImageManifest, 
  downloadImages,
  processBase64Images,
  remapImagePaths 
} from "@/lib/convert/core";

// Collect all image references
const imageRefs = collectImages(drawableTree);

// Build manifest (original → local path mapping)
const manifest = buildImageManifest(imageRefs);

// Process base64 images
processBase64Images(imageRefs, manifest);

// Download URL images
await downloadImages(imageRefs, manifest, { timeout: 15000 });

// Update tree with local paths
const finalTree = remapImagePaths(drawableTree, manifest);
```

### Renderer (`core/render.ts`)

Generates JSX/HTML from drawable trees.

```typescript
import { renderJSX, renderHTML, generateResponsiveStage } from "@/lib/convert/core";

// Render to JSX
const jsx = renderJSX(nodes, {
  indent: 8,
  useTypescript: true,
  includeDataAttributes: true,
  manifest: imageManifest,
});

// Render to HTML
const html = renderHTML(nodes, { indent: 2 });

// Generate responsive wrapper component
const wrapper = generateResponsiveStage(1440, 900, "react");
```

---

## Framework Builders

Each builder implements the `FrameworkBuilder` interface:

```typescript
interface FrameworkBuilder {
  name: TargetFramework;
  displayName: string;
  version: string;
  build(
    nodes: DrawableNode[],
    options: ConversionOptions,
    manifest: ImageManifest,
    interactions: Interaction[]
  ): Promise<GeneratedFile[]>;
}
```

### React Builder

Generates a Vite + React project:

```
project-react/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
├── README.md
├── IMAGES.txt
├── interactions.json
├── public/
│   └── assets/           # Downloaded images
└── src/
    ├── main.tsx
    ├── App.tsx           # Rendered design
    ├── globals.css
    ├── components/
    │   └── ResponsiveStage.tsx
    └── lib/
        └── tokens.ts     # Extracted design tokens
```

### Next.js Builder

Generates a Next.js App Router project with optional live sync:

```
project-nextjs/
├── package.json
├── next.config.js
├── tsconfig.json
├── .env.local            # Live sync config (if enabled)
├── README.md
├── app/
│   ├── layout.tsx
│   ├── globals.css
│   ├── page.tsx          # Static render
│   └── live/
│       └── page.tsx      # Live-sync version
├── src/
│   └── components/
│       ├── ResponsiveStage.tsx
│       └── LiveTreeRenderer.tsx
└── public/
    ├── assets/
    └── interactions.json
```

### Vue Builder

Generates a Vite + Vue 3 project using Composition API:

```
project-vue/
├── package.json
├── vite.config.ts
├── tsconfig.json
├── index.html
├── README.md
└── src/
    ├── main.ts
    ├── App.vue
    ├── styles/
    │   └── globals.css
    └── components/
        ├── ResponsiveStage.vue
        └── DesignNode.vue
```

### Svelte Builder

Generates a Vite + Svelte project:

```
project-svelte/
├── package.json
├── vite.config.ts
├── svelte.config.js
├── tsconfig.json
├── index.html
├── README.md
└── src/
    ├── main.ts
    ├── App.svelte
    ├── vite-env.d.ts
    ├── styles/
    │   └── globals.css
    └── components/
        ├── ResponsiveStage.svelte
        └── DesignNode.svelte
```

### React Native Builder

Generates an Expo React Native project:

```
project-rn/
├── package.json
├── app.json
├── tsconfig.json
├── README.md
├── app/
│   ├── _layout.tsx
│   └── index.tsx         # Main screen
├── components/
│   └── DesignNode.tsx
├── lib/
│   └── designData.ts
└── assets/
```

### Flutter Builder

Generates a Flutter project:

```
project-flutter/
├── pubspec.yaml
├── analysis_options.yaml
├── README.md
├── lib/
│   ├── main.dart
│   ├── screens/
│   │   └── home_screen.dart
│   ├── widgets/
│   │   ├── design_container.dart
│   │   └── design_node.dart
│   └── utils/
│       └── colors.dart   # Design tokens
└── assets/
```

---

## Design Data Format

### Full Snapshot Format

```json
{
  "version": 2,
  "name": "Project Name",
  "exportedAt": "2024-01-15T10:30:00Z",
  "payload": {
    "roots": [
      {
        "id": "frame_1",
        "name": "HomePage",
        "type": "FRAME",
        "x": 0,
        "y": 0,
        "width": 1440,
        "height": 900,
        "fills": [
          {
            "type": "SOLID",
            "color": "#ffffff",
            "visible": true
          }
        ],
        "children": [...]
      }
    ]
  },
  "referenceFrame": {
    "id": "frame_1",
    "x": 0,
    "y": 0,
    "width": 1440,
    "height": 900
  },
  "interactions": [
    {
      "sourceId": "button_1",
      "trigger": "ON_CLICK",
      "action": "NAVIGATE",
      "targetId": "page_2",
      "animation": {
        "type": "PUSH",
        "direction": "LEFT",
        "duration": 300
      }
    }
  ]
}
```

### Node Examples

**Frame/Container:**
```json
{
  "id": "card_1",
  "name": "Card",
  "type": "FRAME",
  "x": 20,
  "y": 100,
  "width": 300,
  "height": 200,
  "fills": [{ "type": "SOLID", "color": "#1a1a1a" }],
  "corners": { "uniform": 16 },
  "effects": [{
    "type": "DROP_SHADOW",
    "color": "rgba(0,0,0,0.15)",
    "offsetX": 0,
    "offsetY": 8,
    "blur": 24
  }],
  "children": [...]
}
```

**Text:**
```json
{
  "id": "heading_1",
  "name": "Heading",
  "type": "TEXT",
  "x": 20,
  "y": 20,
  "width": 260,
  "height": 32,
  "text": {
    "characters": "Welcome Back",
    "fontFamily": "Inter",
    "fontSize": 24,
    "fontWeight": 700,
    "color": "#ffffff",
    "textAlign": "LEFT"
  }
}
```

**Image:**
```json
{
  "id": "avatar_1",
  "name": "Avatar",
  "type": "IMAGE",
  "x": 20,
  "y": 60,
  "width": 64,
  "height": 64,
  "fills": [{
    "type": "IMAGE",
    "imageRef": "https://example.com/avatar.jpg",
    "imageFit": "cover"
  }],
  "corners": { "uniform": 32 }
}
```

---

## Extending the System

### Adding a New Builder

1. Create a new builder file:

```typescript
// lib/convert/builders/myFramework.ts
import type { FrameworkBuilder, DrawableNode, GeneratedFile } from "../types";

export const myFrameworkBuilder: FrameworkBuilder = {
  name: "my-framework",
  displayName: "My Framework",
  version: "1.0.0",

  async build(nodes, options, manifest, interactions) {
    const files: GeneratedFile[] = [];

    // Generate your framework-specific files
    files.push({
      path: "package.json",
      content: JSON.stringify({ name: options.fileName }),
      type: "text",
    });

    // ... generate more files

    return files;
  },
};
```

2. Register in the builder index:

```typescript
// lib/convert/builders/index.ts
import { myFrameworkBuilder } from "./myFramework";

export const builders = {
  // ... existing builders
  "my-framework": myFrameworkBuilder,
};
```

3. Add to target framework type:

```typescript
// lib/convert/types.ts
export type TargetFramework = 
  | "react" 
  // ... existing
  | "my-framework";
```

### Creating Plugins

```typescript
import type { ConversionPlugin, DrawableNode, GeneratedFile } from "@/lib/convert";

const myPlugin: ConversionPlugin = {
  name: "my-plugin",
  version: "1.0.0",

  // Transform nodes before conversion
  preProcess(nodes) {
    return nodes.map(node => ({
      ...node,
      // Apply transformations
    }));
  },

  // Transform generated files
  postProcess(files) {
    return files.map(file => ({
      ...file,
      // Modify content
    }));
  },

  // Add additional files
  generateFiles(nodes, options) {
    return [{
      path: "custom-file.ts",
      content: "// Custom content",
      type: "text",
    }];
  },
};
```

---

## Best Practices

### Design File Preparation

1. **Use descriptive layer names** - They become component/element names
2. **Group related elements** - Use frames for logical grouping
3. **Set up auto-layout** - Improves responsive behavior
4. **Use consistent sizing** - Helps with token extraction
5. **Define interactions** - For navigation/prototype features

### Performance Tips

1. **Flatten unnecessary groups** - Too many nested layers = slower render
2. **Optimize images before export** - Large images slow down conversion
3. **Limit shadow complexity** - Multiple shadows are expensive
4. **Use components for repetition** - Reduces output code size

### Common Issues

| Issue | Solution |
|-------|----------|
| Missing images | Check imageRef paths, ensure URLs are accessible |
| Wrong positioning | Verify referenceFrame matches export bounds |
| Text not rendering | Ensure text.characters is set |
| Interactions not working | Check that source and target IDs exist |
| Style mismatch | Compare fill/stroke arrays for visibility flags |

---

## Sample Files

- **Todo App** - [public/snapshots/todo-app.json](../public/snapshots/todo-app.json)

Use these as references for building your own design exports.

---

## License

MIT © 2024
