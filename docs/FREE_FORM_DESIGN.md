# Free-Form Design Architecture

## Overview

Mint's visual builder follows a three-layer architecture that separates *design* from *data* and *behavior*. Users draw freely using Figma-style primitives, then wire data and interactions onto any layer — without ever selecting a predefined component type.

## The Mental Model

| Old model (component library) | New model (free-form + bindings) |
|---|---|
| Pick "Button" → configure | Draw rect + text → wire click event |
| Pick "List" → select data source | Draw a card frame → bind Repeat to `$products` |
| Pick "Input" → connect form | Draw any shape → set inputType → bind value |
| Component type determines behavior | Visual properties + bindings determine behavior |

## Three-Layer Architecture

### Layer 1 — Design Primitives
Five visual layer types (same as Figma):

| Type | HTML equivalent | Use for |
|---|---|---|
| `frame` | `<div>` | Containers, screens, auto-layout groups |
| `text` | `<p>`, `<span>`, `<h1>` | All text content |
| `rect` | `<div>` (decorative) | Backgrounds, dividers, decorative shapes |
| `image` | `<img>` | Photos, illustrations, icons |
| `line` | `<hr>` / thin div | Separators, borders |

A `frame` can contain children. When auto-layout is enabled it becomes a flex container. When it has `inputType` in its content it renders as `<input>`.

### Layer 2 — Binding System
Any visual property on any layer can be bound to an expression. Bindings live in `layer.bindings`:

```
bindings: {
  "content.text"           : "$product.name",
  "style.background.color" : "$user.active ? '#22C55E' : '#EF4444'",
  "conditionalRender"      : "$cart.items.length > 0",
  "repeatFor.items"        : "$products",
}
```

**Four binding types:**

| Type | Schema field | Example |
|---|---|---|
| Property | `bindings["prop.path"]` | `bindings["content.text"] = "$user.name"` |
| Visibility | `conditionalRender` | `"$isLoggedIn"` |
| Repeat | `repeatFor` | `{ items: "$products", as: "product" }` |
| Event | `events.onClick` | `[{ actionId: "navigate", params: { route: "/product/$product.id" } }]` |

**Expression syntax** (handled by `lib/runtime/expressions.ts`):
- State reference: `$stateName.path`
- Operators: `+ - * / % == != < > && || !`
- Ternary: `$user.active ? 'green' : 'gray'`
- Pipes: `$price | currency`, `$name | uppercase`, `$date | date:'short'`
- Functions: `count($items)`, `first($list)`, `round($value)`

### Layer 3 — Data Sources
Where binding expressions get their data. Five source types:

1. **Local state** — declared per-screen: `localState: [{ name: "count", defaultValue: 0 }]`
2. **API source** — async state with endpoint: `async: { source: "/api/products", autoFetch: true }`
3. **Auth context** — always available as `$currentUser`, `$isLoggedIn`, `$userRole`
4. **Navigation params** — route `:id` is available as `$params.id`
5. **Form state** — each `frame` with `inputType` auto-registers `$form.fieldName`

## Layer Schema

```ts
interface LayerSchema {
  id: string;
  name: string;          // user-visible name in layers panel
  type: LayerType;       // "frame" | "text" | "rect" | "image" | "line"
  content?: LayerContent;
  children?: LayerSchema[];
  style: StyleSchema;
  bindings?: Record<string, string>;
  conditionalRender?: string;
  repeatFor?: { items: string; as: string; key?: string };
  events?: Record<string, ActionRef[]>;
}

interface LayerContent {
  // text layers
  text?: string;
  textRole?: "h1" | "h2" | "h3" | "p" | "span" | "label";
  // image layers
  src?: string;
  imageFit?: "cover" | "contain" | "fill" | "none";
  // frame layers — interactive
  inputType?: "text" | "email" | "password" | "number" | "textarea" | "checkbox" | "select";
  placeholder?: string;
  selectOptions?: string[];
  // frame layout
  layoutMode?: "none" | "flex-row" | "flex-col";
  // semantic hint for code export
  semanticRole?: "button" | "link" | "nav" | "section" | "header" | "footer" | "form" | "list" | "list-item";
}
```

## Implementation Phases

### Phase 1 — Layer Schema ✅ DONE
- Added `LayerType`, `LayerSchema`, `LayerContent` to `schema.ts`
- Added primitive types to `ComponentType` for backward compat (`frame`, `rect`, `line`, `group`)
- Replaced component palette in SchemaCanvas with a 5-tool drawing strip + collapsed legacy list
- New layers created with primitive types via `createLayer()` + `layerToComponent()` bridge
- Existing ComponentSchema-based screens continue to render unchanged

### Phase 2 — Binding Editor UI
- Add `{}` binding toggle next to every property in the Inspector
- Expression input with autocomplete for state variable names
- Binding preview showing resolved value in canvas
- Repeat binding: "Data → Repeat for each" section in Inspector
- Visibility binding: "Show when" condition toggle

### Phase 3 — Data Source Manager
- New "Data" tab in the screen inspector
- Add/configure local state variables
- Add API data sources (endpoint, method, params, polling interval)
- State variable autocomplete in expression inputs
- Loading/error state display in canvas preview

### Phase 4 — Free-Form Drawing Tools
- Rectangle draw tool (click-drag on canvas to create rect/frame)
- Text tool (click to place, type to fill)
- Image placeholder tool
- Line tool
- Double-click to edit text in-canvas

### Phase 5 — Render Engine & Export
- Update `SchemaRenderer` to render `LayerSchema` using semantic HTML
- `frame` → `<div>` with flex/grid styles
- `text` → `<p>/<h1>/<span>` based on `textRole`
- `image` → `<img>` with object-fit
- `frame` with `inputType` → `<input>`/`<select>`/`<textarea>`
- Update `lib/convert/builders/*` to generate code from LayerSchema
- Maintain backward compat for existing ComponentSchema-based screens

## User Flow Examples

### Product list page
1. Draw a card `frame` (220×100px), add auto-layout flex-col
2. Add `text` layer inside: "Product Name" → bind `content.text` to `$product.name`
3. Add `text` layer: "$0.00" → bind to `$product.price | currency`
4. Select card frame → Repeat for each: `$products`, item: `product`
5. Select card frame → On Click → Navigate to `/products/:id`, id = `$product.id`
6. In Data tab: add API source GET `/api/products` → auto-creates `$products`

### Auth-gated content
1. Draw a frame with content
2. Set Visibility binding: `$isLoggedIn`
3. Done — frame hides for unauthenticated users

### Dynamic button color
1. Draw a rect (130×42px), add a text child "Submit"
2. On the rect: bind `style.background.color` to `$form.isValid ? '#4F46E5' : '#9CA3AF'`
3. The button is gray until the form is valid — no "Button" component needed
