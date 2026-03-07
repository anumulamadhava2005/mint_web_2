# Penpot Architecture Reference Guide

> A comprehensive implementation reference for recreating the core architecture of Penpot — an open-source design tool with real-time collaboration, canvas rendering, prototyping, and a full-stack Clojure/ClojureScript + Rust/WASM pipeline.

---

## Table of Contents

1. [High-Level Architecture](#1-high-level-architecture)
2. [Project Structure](#2-project-structure)
3. [Technology Stack](#3-technology-stack)
4. [Database Configuration & Schema](#4-database-configuration--schema)
5. [Backend API & RPC System](#5-backend-api--rpc-system)
6. [Real-Time Collaboration & WebSocket](#6-real-time-collaboration--websocket)
7. [Frontend State Management](#7-frontend-state-management)
8. [Canvas Rendering (SVG Classic)](#8-canvas-rendering-svg-classic)
9. [Canvas Rendering (WASM/GPU)](#9-canvas-rendering-wasmgpu)
10. [Shape Data Model](#10-shape-data-model)
11. [Frame Rendering & Viewport](#11-frame-rendering--viewport)
12. [Prototyping & Interactions](#12-prototyping--interactions)
13. [Viewer / Prototype Player](#13-viewer--prototype-player)
14. [File Changes & Operational Transforms](#14-file-changes--operational-transforms)
15. [Authentication & Sessions](#15-authentication--sessions)
16. [Storage & Media](#16-storage--media)
17. [Infrastructure & Docker](#17-infrastructure--docker)
18. [Frontend API Calls (Repo Layer)](#18-frontend-api-calls-repo-layer)
19. [Plugin System](#19-plugin-system)
20. [Key Design Patterns](#20-key-design-patterns)

---

## 1. High-Level Architecture

Penpot follows a **monorepo multi-service architecture**:

```
┌───────────────┐     ┌──────────────┐     ┌───────────────┐
│   Frontend    │────▶│   Backend    │────▶│  PostgreSQL   │
│ (ClojureScript│     │  (Clojure    │     │   Database    │
│  + WASM)      │     │   JVM)       │     └───────────────┘
└───────┬───────┘     └──────┬───────┘
        │                    │              ┌───────────────┐
        │              WebSocket────────────▶  Redis/Valkey │
        │              (real-time)          │  (Pub/Sub)    │
        │                    │              └───────────────┘
        │                    │
        ▼                    ▼              ┌───────────────┐
┌───────────────┐     ┌──────────────┐     │  MinIO / S3   │
│  Render WASM  │     │   Exporter   │     │  (Assets)     │
│  (Rust/Skia)  │     │  (Node.js)   │     └───────────────┘
└───────────────┘     └──────────────┘
```

### Data Flow

1. **User actions** in the frontend generate **events** dispatched to the **store** (Potok).
2. Events produce **changes** (operational transforms) applied to the local state.
3. Changes are sent to the **backend** via HTTP POST (`update-file` RPC command).
4. Backend persists changes to **PostgreSQL**, then broadcasts via **Redis pub/sub**.
5. Other connected clients receive changes through **WebSocket** and apply them locally.
6. The **canvas** re-renders using either the **SVG classic** renderer or the **WASM/GPU** renderer.

---

## 2. Project Structure

```
penpot/
├── backend/         # Clojure JVM backend (HTTP, RPC, DB, WebSocket)
│   └── src/app/
│       ├── config.clj          # Server configuration
│       ├── main.clj            # Integrant system definition
│       ├── db.clj              # Database connection pool (HikariCP)
│       ├── db/sql.clj          # SQL query builders
│       ├── http.clj            # HTTP server (Yetti/Undertow)
│       ├── http/websocket.clj  # WebSocket handler
│       ├── rpc.clj             # RPC routing & middleware
│       ├── rpc/commands/       # All API commands (files, auth, projects...)
│       ├── migrations.clj      # Migration registry
│       ├── migrations/sql/     # SQL migration files (146+)
│       ├── storage.clj         # Object storage abstraction
│       └── tasks/              # Background workers
│
├── frontend/        # ClojureScript SPA (Rumext/React)
│   └── src/app/
│       ├── main/
│       │   ├── store.cljs      # Global Potok store
│       │   ├── repo.cljs       # HTTP API client
│       │   ├── refs.cljs       # Derived state refs (lenses)
│       │   ├── data/           # Business logic events
│       │   │   ├── viewer.cljs # Viewer/prototype state
│       │   │   └── workspace/  # Workspace state management
│       │   └── ui/
│       │       ├── workspace/
│       │       │   ├── viewport.cljs       # SVG canvas viewport
│       │       │   ├── viewport_wasm.cljs  # WASM canvas viewport
│       │       │   ├── viewport/           # Sub-modules (actions, hooks, interactions...)
│       │       │   └── shapes/             # Workspace shape wrappers
│       │       ├── viewer/
│       │       │   ├── interactions.cljs   # Prototype player logic
│       │       │   └── shapes.cljs         # Viewer shape rendering
│       │       └── shapes/                 # Common shape renderers
│       │           ├── frame.cljs
│       │           ├── rect.cljs
│       │           ├── circle.cljs
│       │           ├── path.cljs
│       │           ├── text.cljs
│       │           ├── group.cljs
│       │           └── bool.cljs
│       └── render_wasm/        # WASM bridge (JS↔Rust)
│
├── common/          # Shared Clojure/ClojureScript code
│   └── src/app/common/
│       ├── types/
│       │   ├── shape.cljc             # Shape record & schema
│       │   ├── shape/interactions.cljc # Interaction types & schema
│       │   ├── shape/layout.cljc      # Flex/Grid layout
│       │   └── file.cljc              # File data structure
│       ├── files/
│       │   ├── changes.cljc           # Change types & operations
│       │   └── helpers.cljc           # Shape tree helpers
│       └── geom/                      # Geometry math
│
├── render-wasm/     # Rust WASM rendering engine
│   └── src/
│       ├── main.rs
│       ├── render.rs          # Core rendering loop
│       ├── render/            # Fill, stroke, shadow, filter, text renderers
│       ├── shapes.rs          # Shape types in Rust
│       ├── shapes/            # Shape modules (frames, groups, paths...)
│       ├── state.rs           # Rust app state
│       ├── tiles.rs           # Tile-based rendering
│       ├── view.rs            # Viewbox management
│       └── wasm.rs            # WASM bindings
│
├── exporter/        # Server-side SVG/PDF export (Node.js headless)
├── plugins/         # Plugin SDK (Angular)
└── docker/          # Docker configs, dev environment
```

---

## 3. Technology Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | ClojureScript, Rumext (React wrapper), Shadow-CLJS |
| **State Management** | Potok (event-driven store), Okulary (derived lenses) |
| **Canvas (Classic)** | SVG DOM rendering via React |
| **Canvas (WASM)** | Rust + Skia (via skia-safe), compiled to WebAssembly, GPU-accelerated via WebGL |
| **Backend** | Clojure (JVM), Integrant (DI/lifecycle), Yetti (HTTP server, Undertow-based) |
| **Database** | PostgreSQL 16 with HikariCP connection pool |
| **Cache/PubSub** | Redis/Valkey (real-time messaging, caching) |
| **Object Storage** | MinIO/S3 or filesystem-based |
| **Serialization** | Transit+JSON (API), Fressian (binary DB blobs) |
| **Auth** | Cookie-based sessions, OIDC, LDAP, email+password |
| **Routing** | Reitit (backend), bidi (frontend) |
| **Task Queue** | Custom PostgreSQL-backed background worker |

---

## 4. Database Configuration & Schema

### 4.1 Connection Pool (HikariCP)

The database layer is in `backend/src/app/db.clj`:

```clojure
;; Pool configuration with Integrant
(def defaults
  {::name :main
   ::min-size 0
   ::max-size 60
   ::connection-timeout 10000
   ::validation-timeout 10000
   ::idle-timeout 120000      ; 2 minutes
   ::max-lifetime 1800000     ; 30 minutes
   ::read-only false})

;; Connection init SQL
(def initsql
  (str "SET statement_timeout = 300000;\n"
       "SET idle_in_transaction_session_timeout = 300000;"))
```

**Key Configuration** (from `backend/src/app/config.clj`):
```clojure
{:database-uri "postgresql://postgres/penpot"
 :database-username "penpot"
 :database-password "penpot"}
```

### 4.2 Core Database Tables

The schema evolves through **146+ SQL migrations** in `backend/src/app/migrations/sql/`. Here are the core tables:

#### Profile (Users)
```sql
CREATE TABLE profile (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at  timestamptz NOT NULL DEFAULT clock_timestamp(),
  modified_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  deleted_at  timestamptz NULL,
  fullname    text NOT NULL DEFAULT '',
  email       text NOT NULL,
  photo       text NOT NULL,
  password    text NOT NULL,
  lang        text NULL,
  theme       text NULL,
  is_demo     boolean NOT NULL DEFAULT false
);
```

#### Team
```sql
CREATE TABLE team (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at  timestamptz NOT NULL DEFAULT clock_timestamp(),
  modified_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  deleted_at  timestamptz NULL,
  name        text NOT NULL,
  photo       text NOT NULL,
  is_default  boolean NOT NULL DEFAULT false
);
```

#### Team ↔ Profile Relation
```sql
CREATE TABLE team_profile_rel (
  team_id    uuid REFERENCES team(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES profile(id) ON DELETE CASCADE,
  is_owner   boolean DEFAULT false,
  is_admin   boolean DEFAULT false,
  can_edit   boolean DEFAULT false,
  PRIMARY KEY (team_id, profile_id)
);
```

#### Project
```sql
CREATE TABLE project (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id     uuid NOT NULL REFERENCES team(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT clock_timestamp(),
  modified_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  deleted_at  timestamptz DEFAULT NULL,
  is_default  boolean NOT NULL DEFAULT false,
  name        text NOT NULL
);
```

#### File
```sql
CREATE TABLE file (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  uuid NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT clock_timestamp(),
  modified_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  deleted_at  timestamptz DEFAULT NULL,
  name        text NOT NULL,
  revn        bigint NOT NULL DEFAULT 0,
  data        bytea NULL,
  features    text[] -- PostgreSQL array of feature flags
);
```

The `data` column stores the **entire file data** (all pages, shapes, components, colors, typographies) as a serialized binary blob (Transit or Fressian encoded). This is the core document model.

#### File Change (Revision History)
```sql
CREATE TABLE file_change (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_id    uuid NOT NULL REFERENCES file(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  session_id uuid NULL,
  revn       bigint NOT NULL DEFAULT 0,
  data       bytea NOT NULL,       -- full file data snapshot
  changes    bytea NULL DEFAULT NULL -- the delta changes
);
```

#### File Library Relations
```sql
CREATE TABLE file_library_rel (
  file_id    uuid REFERENCES file(id) ON DELETE CASCADE,
  library_id uuid REFERENCES file(id) ON DELETE CASCADE,
  synced_at  timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (file_id, library_id)
);
```

#### Comments
```sql
CREATE TABLE comment_thread (
  id         uuid PRIMARY KEY,
  file_id    uuid REFERENCES file(id) ON DELETE CASCADE,
  owner_id   uuid REFERENCES profile(id),
  page_id    uuid NOT NULL,
  frame_id   uuid,
  position   point NOT NULL,      -- PostgreSQL geometric point type
  content    text NOT NULL,
  participants uuid[] DEFAULT '{}'
);
```

#### Other Important Tables
- `file_media_object` — Media assets referenced in file shapes
- `file_object_thumbnail` — Cached object thumbnails
- `file_thumbnail` — File-level thumbnails  
- `storage_object` — Binary object storage metadata
- `team_font_variant` — Custom fonts per team
- `share_link` — Public share links for viewing
- `webhook` — Integration webhooks
- `audit_log` — User activity audit trail
- `task` — Background job queue
- `access_token` — API access tokens

### 4.3 Database Access Patterns

```clojure
;; Insert
(db/insert! conn :file {:id file-id :name "My File" :project-id project-id})

;; Query single
(db/get conn :file {:id file-id})

;; Query multiple  
(db/exec! conn ["SELECT * FROM file WHERE project_id = ?" project-id])

;; Update
(db/update! conn :file {:name "New Name"} {:id file-id})

;; Delete
(db/delete! conn :file {:id file-id})

;; Transaction
(db/tx-run! cfg
  (fn [{:keys [::db/conn] :as cfg}]
    (db/insert! conn :file {...})
    (db/insert! conn :file_change {...})))
```

---

## 5. Backend API & RPC System

### 5.1 Architecture

The backend uses an **RPC-over-HTTP** pattern rather than REST. All API methods are accessed through a single endpoint pattern:

```
POST /api/main/methods/{method-name}    # Main API
POST /api/management/methods/{method-name}  # Management API
GET  /api/main/methods/{method-name}    # For get-* queries
```

### 5.2 RPC Route Setup (`backend/src/app/rpc.clj`)

```clojure
;; Routes are defined in the Integrant init-key for ::routes
["/api"
 ["/main"
  ["/methods/:method-name"
   {:middleware [[mw/cors]
                 [sec/client-header-check]
                 [session/authz cfg]
                 [actoken/authz cfg]]
    :handler (make-rpc-handler methods)}]]
    
 ["/management"
  ["/methods/:method-name"
   {:middleware [[mw/shared-key-auth shared-keys]
                 [session/authz cfg]]
    :handler (make-rpc-handler management-methods)}]]]
```

### 5.3 Method Resolution

All RPC commands are defined as multimethod-like functions using the `sv/defmethod` macro:

```clojure
;; Command namespaces are scanned:
(sv/scan-ns
  'app.rpc.commands.auth
  'app.rpc.commands.files
  'app.rpc.commands.files-create
  'app.rpc.commands.files-update
  'app.rpc.commands.files-thumbnails
  'app.rpc.commands.projects
  'app.rpc.commands.teams
  'app.rpc.commands.comments
  'app.rpc.commands.media
  'app.rpc.commands.profile
  'app.rpc.commands.search
  'app.rpc.commands.viewer
  ...)
```

### 5.4 Middleware Wrapping Pipeline

Each RPC method is wrapped with a chain of middleware:

```clojure
(defn- wrap [cfg f mdata]
  (as-> f $
    (wrap-db-transaction cfg $ mdata)    ; Auto DB transaction
    (cond/wrap cfg $ mdata)              ; Conditional (ETag) support
    (retry/wrap-retry cfg $ mdata)       ; Auto retry on transient errors
    (climit/wrap cfg $ mdata)            ; Concurrency limiting
    (wrap-metrics cfg $ mdata)           ; Prometheus metrics
    (rlimit/wrap cfg $ mdata)            ; Rate limiting
    (wrap-audit cfg $ mdata)             ; Audit logging
    (wrap-spec-conform cfg $ mdata)      ; Spec conformance
    (wrap-params-validation cfg $ mdata) ; Malli schema validation
    (wrap-authentication cfg $ mdata)))  ; Auth check
```

### 5.5 Defining an RPC Command

```clojure
(ns app.rpc.commands.files
  (:require [app.util.services :as sv]
            [app.common.schema :as sm]
            [app.db :as db]))

(def ^:private schema:get-file
  [:map {:title "get-file"}
   [:id ::sm/uuid]
   [:features {:optional true} ::cfeat/features]])

(sv/defmethod ::get-file
  "Retrieve a file by its ID"
  {::doc/added "1.17"
   ::sm/params schema:get-file
   ::db/transaction true}   ; <-- auto wraps in DB transaction
  [{:keys [::db/conn] :as cfg} {:keys [id] :as params}]
  (let [file (db/get conn :file {:id id})]
    (check-read-permissions! conn ...)
    file))
```

### 5.6 Key API Commands

| Command | Method | Description |
|---------|--------|-------------|
| `login-with-password` | POST | Email/password login |
| `logout` | POST | Session logout |
| `get-profile` | GET | Current user profile |
| `get-projects` | GET | List team projects |
| `get-file` | GET | Retrieve file data |
| `update-file` | POST | Submit file changes (main collaboration endpoint) |
| `create-file` | POST | Create new file |
| `create-project` | POST | Create project |
| `upload-file-media-object` | POST (multipart) | Upload images/media |
| `create-file-object-thumbnail` | POST (multipart) | Upload shape thumbnail |
| `get-view-only-bundle` | GET | Viewer data bundle |
| `create-comment-thread` | POST | Create comment thread |
| `get-comment-threads` | GET | List comments |
| `create-team` | POST | Create team |
| `get-teams` | GET | List teams |
| `export-binfile` | POST | Binary file export |
| `import-binfile` | POST | Binary file import |

---

## 6. Real-Time Collaboration & WebSocket

### 6.1 WebSocket Architecture

File is located at `backend/src/app/http/websocket.clj`. The WebSocket uses a **message-bus (msgbus)** backed by **Redis/Valkey pub/sub**.

```
Client A ──WebSocket──▶ Backend ──Redis Pub/Sub──▶ Backend ──WebSocket──▶ Client B
                           │                          │
                           └──Subscribe to file-id────┘
```

### 6.2 WebSocket Message Types

```clojure
;; Client → Server messages:
:subscribe-file    ; Start receiving updates for a file
:unsubscribe-file  ; Stop receiving file updates
:subscribe-team    ; Subscribe to team notifications
:pointer-update    ; Mouse cursor position broadcast

;; Server → Client messages:
:join-file         ; User joined the file
:leave-file        ; User left the file
:disconnect        ; User disconnected
:presence          ; Presence info (cursor positions)
:file-change       ; File was updated by another user
:library-change    ; Library dependency was updated
```

### 6.3 WebSocket Handler Flow

```clojure
;; On connection open:
(defmethod handle-message :open [cfg wsp _]
  ;; Subscribe to profile channel (for cross-file notifications)
  (mbus/sub! msgbus :topic profile-id :chan ch)
  ;; Subscribe to system channel
  (mbus/sub! msgbus :topic uuid/zero :chan ch))

;; On file subscription:
(defmethod handle-message :subscribe-file [cfg wsp {:keys [file-id]}]
  ;; Create dedicated channel for the file
  ;; Subscribe to file topic on Redis
  (mbus/sub! msgbus :topic file-id :chan fch)
  ;; Notify others of new participant
  (mbus/pub! msgbus :topic file-id
             :message {:type :join-file :profile-id pid :session-id sid}))

;; On connection close:
(defmethod handle-message :close [cfg wsp _]
  ;; Unsubscribe all channels
  ;; Notify others of disconnect
  (mbus/pub! msgbus :topic file-id
             :message {:type :disconnect :profile-id pid}))
```

### 6.4 Change Propagation (update-file)

When `update-file` is called:

```clojure
;; 1. Validate and persist changes
(db/insert! conn :file_change {...})
;; 2. Apply changes to file data
(swap! file-data apply-changes changes)
;; 3. Persist updated file
(db/update! conn :file {:data (blob/encode file-data)})
;; 4. Broadcast to other clients via Redis
(mbus/pub! msgbus :topic file-id
           :message {:type :file-change
                     :changes changes
                     :revn new-revn
                     :session-id session-id})
```

---

## 7. Frontend State Management

### 7.1 Store (Potok)

The main state atom lives in `frontend/src/app/main/store.cljs`:

```clojure
(defonce state
  (ptk/store {:resolve ptk/resolve
              :on-event on-event
              :on-error on-error}))

;; Dispatch events
(st/emit! (dw/select-shape shape-id))
(st/emit! (dv/initialize params))

;; Subscribe to state changes
(defonce stream (ptk/input-stream state))
```

### 7.2 Event Types

Events can be:
- **Data events** — Pure state transformations `(ptk/UpdateEvent)`
- **Watch events** — Side effects that return observables `(ptk/WatchEvent)`
- **Effect events** — Imperative side effects `(ptk/EffectEvent)`

```clojure
;; Example: Data event (pure state update)
(defn select-shape [id]
  (ptk/reify ::select-shape
    ptk/UpdateEvent
    (update [_ state]
      (update state :workspace-local
              assoc :selected #{id}))))

;; Example: Watch event (async side effect)
(defn fetch-file [file-id]
  (ptk/reify ::fetch-file
    ptk/WatchEvent
    (watch [_ state _]
      (->> (rp/cmd! :get-file {:id file-id})
           (rx/map file-fetched)))))
```

### 7.3 Derived State (Refs/Lenses)

State subscriptions are done via **Okulary lenses** in `frontend/src/app/main/refs.cljs`:

```clojure
(def workspace-local
  (l/derived :workspace-local st/state))

(def workspace-drawing
  (l/derived :workspace-drawing st/state))

(def viewer-data
  (l/derived :viewer-data st/state))

;; Usage in components via mf/deref
(let [local (mf/deref refs/workspace-local)]
  (:zoom local))
```

### 7.4 Global State Shape

```clojure
{:profile          {...}            ; Current user
 :workspace-local  {:zoom 1.0
                    :vbox {:x 0 :y 0 :width 1920 :height 1080}
                    :vport {:width 1920 :height 1080}
                    :selected #{shape-id-1 shape-id-2}
                    :edition nil    ; currently edited shape
                    :panning false
                    :transform nil} ; :move, :resize, :rotate
                    
 :workspace-data   {:id file-id
                    :pages [page-id-1 page-id-2]
                    :pages-index {page-id-1 {:objects {...}}}}
                    
 :workspace-drawing {:tool :rect :object {...}}
 
 :viewer-data      {:file {...}
                    :pages {page-id {:objects {...} :frames [...]}}}
 :viewer-local     {:zoom 1.0
                    :interactions-mode :show-on-click}
 :viewer-overlays  [...]}
```

---

## 8. Canvas Rendering (SVG Classic)

### 8.1 Overview

The classic renderer uses **SVG DOM** elements rendered through React (Rumext). Located in `frontend/src/app/main/ui/workspace/viewport.cljs`.

### 8.2 Viewport Component Structure

```
viewport*               ← Top-level switcher (classic vs WASM)
└── viewport-classic*   ← Classic SVG viewport
    ├── <div.viewport>
    │   ├── <div.viewport-overlays>
    │   │   ├── viewport-texts (HTML foreign objects for text editing)
    │   │   ├── comments-layer
    │   │   └── pixel-overlay (color picker)
    │   │
    │   ├── <svg#render>          ← Main render SVG (shapes)
    │   │   ├── <defs> (gradients, filters)
    │   │   ├── <rect> (background)
    │   │   └── root-shape        ← Recursive shape tree
    │   │       ├── root-frame-wrapper (or thumbnail)
    │   │       ├── shape-wrapper
    │   │       └── ...
    │   │
    │   └── <svg.viewport-controls> ← Interactive overlay SVG
    │       ├── text-editor
    │       ├── shape-outlines
    │       ├── selection-handlers (resize/rotate handles)
    │       ├── measurements
    │       ├── snap-points / snap-distances
    │       ├── rulers
    │       ├── guides
    │       ├── frame-titles
    │       ├── prototyping-flows (interaction arrows)
    │       ├── draw-area
    │       ├── grid-layout-editor
    │       ├── scroll-bars
    │       └── presence-cursors
```

### 8.3 SVG Viewbox / Pan & Zoom

The viewport uses an SVG `viewBox` to implement infinite canvas pan/zoom:

```clojure
[:svg {:id "render"
       :width (:width vport 0)          ; Physical viewport pixels
       :height (:height vport 0)
       :view-box (format-viewbox vbox)   ; "x y width height" in world coords
       :preserveAspectRatio "xMidYMid meet"
       :style {:background-color background}}]
```

- **vport**: Physical size of the viewport in screen pixels
- **vbox**: Virtual rectangle `{:x :y :width :height}` in world coordinates
- **zoom**: `vport.width / vbox.width`

Panning changes `vbox` position. Zooming changes `vbox` dimensions.

### 8.4 Shape Rendering Hierarchy

```clojure
;; root-shape → dispatches by shape type
(case shape-type
  :frame  → frame/root-frame-wrapper or frame/nested-frame-wrapper
  :group  → group/group-wrapper
  :bool   → bool/bool-wrapper
  :rect   → rect-wrapper (generic-wrapper-factory)
  :circle → circle-wrapper
  :image  → image-wrapper
  :path   → path/path-wrapper
  :text   → text/text-wrapper
  :svg-raw → svg-raw/svg-raw-wrapper)
```

### 8.5 Frame Rendering (`frontend/src/app/main/ui/shapes/frame.cljs`)

```clojure
;; Frame container handles:
;; - Blur filter (applied to frame + content)
;; - Shadow filter (applied only to content, under stroke)
;; - Clip path (hide content outside frame bounds when show-content=false)
;; - Background fill
;; - Border radius / rounded corners (via SVG path or rect)
;; - Opacity

[:g.frame-container-wrapper {:opacity opacity}
 [:g.frame-container-blur {:filter filter-str-blur}
  [:defs
   [:& filters/filters {:shape (dissoc shape :blur)}]
   [:& filters/filters {:shape (assoc shape :shadow [])}]]
  [:g.frame-container-shadows {:filter filter-str-shadows}
   [:g {:clip-path (when-not show-content? clip-url)}
    [:& shape-fills {:shape shape}
     [:> :rect props]]  ; or :path for rounded corners
    children]]
  [:& shape-strokes {:shape shape}
   [:> :rect props]]]]
```

### 8.6 Thumbnail Optimization

Root-level frames can render as **thumbnails** (pre-rendered images) when not actively being edited:

```clojure
;; In root-shape:
(if ^boolean (cfh/frame-shape? shape)
  [:& root-frame-wrapper
   {:shape shape
    :objects objects
    :thumbnail? (not (contains? active-frames shape-id))}]
  [:& shape-wrapper {:shape shape}])
```

Active frames (being edited, selected, or visible in viewport) render full SVG. Others show cached bitmap thumbnails for performance.

---

## 9. Canvas Rendering (WASM/GPU)

### 9.1 Overview

The WASM renderer in `render-wasm/` is a Rust application compiled to WebAssembly that uses **Skia** (via `skia-safe`) for GPU-accelerated rendering through WebGL.

Feature flag: `render-wasm/v1`

### 9.2 Architecture

```
Frontend (JS) ─── WASM Bridge ───▶ Rust State ─── Skia ───▶ WebGL Canvas
                  (wapi.rs)         (state.rs)    (render.rs)
```

### 9.3 State Management (Rust)

```rust
pub(crate) struct State {
    pub render_state: RenderState,
    pub text_editor_state: TextEditorState,
    pub current_id: Option<Uuid>,
    pub shapes: ShapesPool,        // HashMap of all shapes
    pub saved_shapes: Option<ShapesPool>, // For temp operations
}
```

### 9.4 Render Loop

```rust
pub(crate) struct RenderState {
    gpu_state: GpuState,              // WebGL context
    pub surfaces: Surfaces,            // Skia GPU surfaces
    pub fonts: FontStore,
    pub viewbox: Viewbox,
    pub images: ImageStore,
    pub background_color: skia::Color,
    pub render_in_progress: bool,
    pending_nodes: Vec<NodeRenderState>,  // Stack for tree traversal
    pub tiles: TileHashMap,             // Tile cache
    pub pending_tiles: PendingTiles,
    pub focus_mode: FocusMode,
    pub nested_fills: Vec<Vec<Fill>>,   // Inherited fill stack
    pub nested_blurs: Vec<Option<Blur>>,
    pub nested_shadows: Vec<Vec<Shadow>>,
}
```

### 9.5 Tile-Based Rendering

The WASM renderer uses a **tile-based** approach for efficient rendering:

```rust
const VIEWPORT_INTEREST_AREA_THRESHOLD: i32 = 3; // Extra tiles around viewport
const MAX_BLOCKING_TIME_MS: i32 = 32;            // Max time per frame

// Tiles beyond the viewport are pre-rendered for smooth panning
// The render loop processes tiles in priority order (visible first)
// Each tile is cached and only re-rendered when shapes change
```

### 9.6 Shape Types (Rust)

```rust
#[derive(Debug, Clone, PartialEq)]
pub enum Type {
    Frame(Frame),
    Group(Group),
    Bool(Bool),
    Rect(Rect),
    Path(Path),
    Text(TextContent),
    Circle,
    SVGRaw(SVGRaw),
}
```

### 9.7 Rendering Pipeline

1. **Tree traversal**: Walk shape tree depth-first via `pending_nodes` stack
2. **Visibility culling**: Skip shapes outside current tile bounds
3. **Clip bounds**: Frames clip their children (configurable `show-content`)
4. **Fill rendering**: Solid colors, gradients, images
5. **Stroke rendering**: With caps, joins, alignment (inner/center/outer)
6. **Effects**: Shadows (drop/inner), blurs (layer/background), filters
7. **Blending**: Per-shape blend modes and opacity
8. **Text**: Font rendering via Skia text layout engine
9. **Tile compositing**: Merge rendered tiles onto the viewport surface

### 9.8 WASM ↔ JS Bridge

The bridge uses direct memory sharing and function exports:

```rust
// In wasm.rs / wapi.rs - exported to JavaScript
#[no_mangle]
pub extern "C" fn set_view(zoom: f32, x: f32, y: f32) { ... }
#[no_mangle]
pub extern "C" fn render(timestamp: i32) { ... }
#[no_mangle]
pub extern "C" fn add_shape(a: u32, b: u32, c: u32, d: u32) { ... }
```

```clojure
;; In frontend ClojureScript
(ns app.render-wasm.api)
;; Calls into WASM module functions to sync shape data and trigger renders
```

---

## 10. Shape Data Model

### 10.1 Shape Record (`common/src/app/common/types/shape.cljc`)

```clojure
(cr/defrecord Shape
  [id name type x y width height rotation
   selrect points transform transform-inverse
   parent-id frame-id flip-x flip-y]
  IShape)
```

### 10.2 Shape Types

```clojure
(def shape-types
  #{:frame :group :bool :rect :path :text :circle :svg-raw :image})
```

### 10.3 Full Shape Schema

A shape contains many optional attributes:

```clojure
;; Core geometry
:id, :name, :type
:x, :y, :width, :height
:rotation                       ; degrees
:selrect                        ; {:x :y :width :height :x1 :y1 :x2 :y2}
:points                         ; 4-element vector of {x,y} points
:transform, :transform-inverse  ; 2D affine matrix
:parent-id, :frame-id           ; tree hierarchy

;; Visual properties
:fills          ; [{:fill-color "#fff" :fill-opacity 1} ...]
:strokes        ; [{:stroke-color "#000" :stroke-width 1 :stroke-alignment :center} ...]
:opacity        ; 0.0 - 1.0
:blend-mode     ; :normal, :multiply, :screen, :overlay, etc.
:shadow         ; [{:type :drop-shadow :color {...} :offset-x 0 :offset-y 4 :blur 8 :spread 0}]
:blur           ; {:type :layer-blur :value 4 :hidden false}

;; Constraints & Layout
:constraints-h  ; :left, :right, :leftright, :center, :scale
:constraints-v  ; :top, :bottom, :topbottom, :center, :scale
:layout         ; :flex or :grid (when shape is a layout container)
:layout-item    ; child layout properties (grow, align-self, etc.)

;; Frame-specific
:show-content   ; boolean - clip children outside frame bounds
:fills          ; frame background
:guides         ; ruler guides within frame

;; Text-specific
:content        ; Rich text content tree (ProseMirror-like)
:grow-type      ; :auto-width, :auto-height, :fixed

;; Bool-specific (boolean operations)
:bool-type      ; :union, :difference, :exclude, :intersection

;; Path-specific
:content        ; Vector of path segments

;; Image-specific
:metadata       ; {:width :height :mtype}

;; Component instances
:component-id, :component-file, :component-root
:main-instance, :shape-ref, :touched

;; Interactions (prototyping)
:interactions   ; Vector of interaction definitions

;; Organizational
:blocked, :hidden, :locked, :collapsed
```

### 10.4 Shape Tree (Objects Map)

All shapes on a page are stored as a flat map keyed by UUID:

```clojure
{:objects
 {#uuid "00000000-0000-0000-0000-000000000000" ; Root frame (always uuid/zero)
  {:id #uuid "..."
   :type :frame
   :name "Root Frame"
   :shapes [frame-id-1 frame-id-2]}
  
  frame-id-1
  {:id frame-id-1
   :type :frame
   :name "Frame 1"
   :parent-id #uuid "00000000-..."
   :frame-id frame-id-1     ; frames reference themselves
   :shapes [rect-id-1 text-id-1]
   :x 100 :y 100 :width 800 :height 600}
  
  rect-id-1
  {:id rect-id-1
   :type :rect
   :parent-id frame-id-1
   :frame-id frame-id-1
   :x 150 :y 150 :width 200 :height 100
   :fills [{:fill-color "#ff0000" :fill-opacity 1}]}}}
```

The `:shapes` key on containers (frames, groups) holds ordered child IDs. `:parent-id` points upward. `:frame-id` always points to the nearest frame ancestor.

---

## 11. Frame Rendering & Viewport

### 11.1 Viewport Props

The workspace component passes these to the viewport:

```clojure
{:selected    #{...}          ; Set of selected shape IDs
 :wglobal     {:options-mode  ; :design, :inspect, :prototype
               :tooltip
               :show-distances?
               :picking-color?}
 :wlocal      {:vbox          ; Virtual viewbox rect
               :vport         ; Physical viewport size
               :zoom          ; Current zoom level
               :zoom-inverse
               :edition       ; Shape ID being edited
               :transform     ; Current transform type
               :panning       ; Is user panning?
               :selrect       ; Selection rectangle
               :edit-path     ; Path editing state
               :highlighted}  ; Highlighted shape IDs
 :layout      #{:rulers :display-guides :show-pixel-grid ...}
 :file        {...}
 :page        {:objects {...} :flows [...] :guides [...]}}
```

### 11.2 Active Frames Optimization

Only frames that are **active** (visible, selected, or hovered) get full SVG rendering. Others show cached thumbnails:

```clojure
(hooks/setup-active-frames base-objects hover-ids selected active-frames zoom transform vbox)

;; In root-shape rendering:
(if (contains? active-frames frame-id)
  ;; Full SVG render of all children
  [:& full-frame-render {:shape shape :objects objects}]
  ;; Cached thumbnail image
  [:& frame-thumbnail-image {:shape shape}])
```

### 11.3 Viewport Hooks

```clojure
;; Registered in viewport-classic* component:
(hooks/setup-dom-events zoom ...)           ; Mouse/keyboard events
(hooks/setup-viewport-size vport ref)       ; Resize observer
(hooks/setup-cursor cursor alt? ...)        ; Cursor icon management
(hooks/setup-keyboard alt? mod? space? ...) ; Keyboard state tracking
(hooks/setup-hover-shapes ...)              ; Shape hover detection
(hooks/setup-viewport-modifiers ...)        ; Shape transform modifiers
(hooks/setup-shortcuts ...)                 ; Keyboard shortcut bindings
(hooks/setup-active-frames ...)             ; Active frame tracking
```

### 11.4 Two-SVG Layer Architecture

```
┌──────────────────────────────────┐
│ SVG#render (pointer-events:none) │ ← Shape rendering (no interaction)
│   ├── Background rect            │
│   └── root-shape (recursive)     │
├──────────────────────────────────┤
│ SVG.viewport-controls            │ ← Interactive overlay
│   ├── Text editor                │
│   ├── Selection handles          │
│   ├── Outlines                   │
│   ├── Measurements               │
│   ├── Snap points                │
│   ├── Rulers & guides            │
│   ├── Frame titles               │
│   ├── Prototype arrows           │
│   └── Presence cursors           │
└──────────────────────────────────┘
```

This separation ensures shapes render without interference from interaction handlers.

---

## 12. Prototyping & Interactions

### 12.1 Interaction Schema (`common/src/app/common/types/shape/interactions.cljc`)

#### Event Types
```clojure
(def event-types
  #{:click            ; User clicks the shape
    :mouse-press      ; Mouse button down
    :mouse-over       ; Mouse enters shape area
    :mouse-enter      ; Mouse enters (no bubble)
    :mouse-leave      ; Mouse leaves shape area
    :after-delay})    ; Timer trigger (frames only)
```

#### Action Types
```clojure
(def action-types
  #{:navigate          ; Go to another frame
    :open-overlay      ; Open frame as overlay
    :toggle-overlay    ; Toggle overlay visibility
    :close-overlay     ; Close an overlay
    :prev-screen       ; Go to previous screen
    :open-url})        ; Open external URL
```

#### Animation Types
```clojure
(def animation-types #{:dissolve :slide :push})
(def easing-types #{:linear :ease :ease-in :ease-out :ease-in-out})
(def direction-types #{:right :left :up :down})
```

#### Overlay Positioning
```clojure
(def overlay-positioning-types
  #{:manual :center
    :top-left :top-right :top-center
    :bottom-left :bottom-right :bottom-center})
```

### 12.2 Interaction Data Structure

```clojure
;; Navigate interaction
{:event-type :click
 :action-type :navigate
 :destination frame-uuid        ; Target frame ID
 :preserve-scroll false
 :animation {:animation-type :dissolve
             :duration 300
             :easing :ease-in-out}}

;; Open overlay interaction
{:event-type :click
 :action-type :open-overlay
 :destination overlay-frame-uuid
 :overlay-pos-type :center      ; or :manual, :top-left, etc.
 :overlay-position {:x 0 :y 0}
 :close-click-outside true
 :background-overlay true
 :position-relative-to shape-uuid
 :animation {:animation-type :slide
             :duration 300
             :easing :ease-in-out
             :way :in
             :direction :right
             :offset-effect false}}

;; After-delay interaction (auto-navigate)
{:event-type :after-delay
 :delay 600                     ; milliseconds
 :action-type :navigate
 :destination next-frame-uuid}
```

### 12.3 Workspace Interaction Editor

In `frontend/src/app/main/ui/workspace/viewport/interactions.cljs`:

- **Visual arrows** connect shapes to their destination frames
- **Drag to connect** — user drags from shape to target frame
- **Marker icons** indicate interaction type (arrow, overlay, back)
- Lines are calculated based on shape positions:

```clojure
(defn connect-to-shape [orig-shape dest-shape]
  ;; Calculates best connection points between two shapes
  ;; Returns [orig-pos orig-x orig-y dest-pos dest-x dest-y]
  ;; Uses bounding rectangles to find closest edges
  )
```

### 12.4 Prototype Mode Toggle

When `options-mode` is `:prototype` in the workspace, interaction arrows become visible and editable:

```clojure
(when show-prototypes?
  [:> widgets/frame-flows*
   {:flows (:flows page)
    :objects objects-modified
    :selected selected
    :zoom zoom}])

;; And in the selection handlers area:
(when show-prototypes?
  [:& interactions/interactions
   {:selected selected
    :page-id page-id
    :zoom zoom
    :objects objects-modified}])
```

### 12.5 Flows

Flows define named entry points for prototyping:

```clojure
;; Page-level flow definition
{:flows [{:id flow-uuid
          :name "Main Flow"
          :starting-frame frame-uuid}]}
```

---

## 13. Viewer / Prototype Player

### 13.1 Architecture (`frontend/src/app/main/ui/viewer.cljs`)

```
viewer*
└── viewer-content*
    ├── header (navigation, zoom, section selector)
    ├── thumbnails-panel (frame list)
    └── viewer-section
        ├── viewer-wrapper
        │   ├── viewer-pagination (prev/next frame buttons)
        │   ├── viewport-container (current frame)
        │   │   └── interactions/viewport
        │   │       └── viewport-svg (SVG rendering)
        │   ├── viewport-container (orig frame - for animations)
        │   └── viewer-overlay (for each open overlay)
        │       └── interactions/viewport
        └── comments-layer (if in comments mode)
```

### 13.2 Viewer Initialization

```clojure
(defn initialize [{:keys [file-id share-id] :as params}]
  ;; 1. Fetch the viewer bundle (file data + permissions)
  ;; 2. Set up local state (zoom, interactions mode)
  ;; 3. Load fonts referenced in text shapes
  )
```

### 13.3 Frame Navigation

```clojure
;; Navigate to specific frame index
(st/emit! (dv/go-to-frame frame-id))

;; Navigate forward/backward
(st/emit! dv/select-prev-frame)
(st/emit! dv/select-next-frame)
(st/emit! dv/select-first-frame)
```

### 13.4 Interaction Handling in Viewer

In `frontend/src/app/main/ui/viewer/interactions.cljs`:

```clojure
;; The viewport-svg component separates fixed and non-fixed elements
;; into two separate SVG layers for CSS sticky positioning:

[:* 
 ;; Fixed elements (position: fixed in scroll)
 [:svg.fixed {...}
  [:& wrapper-fixed {:shape fixed-frame}]]
 
 ;; Normal scrolling elements
 [:svg.not-fixed {...}
  [:& wrapper-not-fixed {:shape frame}]]]
```

### 13.5 Overlay System

Overlays are frames rendered on top of the current view:

```clojure
;; State tracking
(def current-overlays-ref
  (l/derived :viewer-overlays st/state))

;; Overlay rendering
(mf/defc viewer-overlay [{:keys [overlay page frame zoom]}]
  ;; Calculate size and position
  ;; Handle close-on-click-outside
  ;; Handle background overlay dimming
  ;; Render the overlay frame at the correct position
  ;; Support fixed vs relative positioning
  )
```

### 13.6 Animation System

```clojure
(def current-animations-ref
  (l/derived :viewer-animations st/state))

;; Animation types:
;; 1. Go-to-frame: Slide/dissolve between frames
;;    - Both frames render simultaneously during transition
;;    - CSS transforms animate position
;; 2. Open-overlay: Slide/dissolve overlay in
;; 3. Close-overlay: Reverse animation to dismiss

(defn animate-go-to-frame [animation current-vp orig-vp size orig-size wrapper-size]
  ;; Sets CSS transitions on viewport containers
  ;; Handles direction-based transforms (slide left/right/up/down)
  ;; Fires completion callback to clean up animation state
  )
```

### 13.7 Interaction Mode

```clojure
;; Three interaction modes:
:show-on-click    ; Interactions trigger on click, indicator shown on click
:show-always      ; Interaction hotspots always visible
:hide             ; No visual indicators, interactions still work
```

### 13.8 Size Calculation for Viewer

```clojure
(defn calculate-size [objects frame zoom]
  ;; Includes padding for shadows/blur that extend beyond frame bounds
  (let [{:keys [x y width height]} (gsb/get-object-bounds objects frame)]
    {:base-width width :base-height height
     :x x :y y
     :width (* width zoom) :height (* height zoom)
     :vbox (str "0 0 " width " " height)}))
```

---

## 14. File Changes & Operational Transforms

### 14.1 Change Types (`common/src/app/common/files/changes.cljc`)

```clojure
;; Shape operations
:add-obj              ; Add a new shape
:mod-obj              ; Modify shape attributes
:del-obj              ; Delete a shape
:mov-objects          ; Move shapes (reorder, reparent)

;; Page operations
:add-page             ; Add a new page
:mod-page             ; Modify page attributes
:del-page             ; Delete a page
:mov-page             ; Reorder pages

;; Component operations
:add-component        ; Add a new component
:mod-component        ; Modify component
:del-component        ; Delete component
:restore-component    ; Restore deleted component

;; Library operations
:add-color            ; Add color to library
:mod-color            ; Modify library color
:del-color            ; Delete library color
:add-typography       ; Add typography to library
:mod-typography       ; Modify typography
:del-typography       ; Delete typography
:add-media            ; Add media to library
:mod-media            ; Modify media
:del-media            ; Delete media

;; Other
:set-default-grid     ; Set default grid for page
:set-guide            ; Add/modify ruler guide
:set-flow             ; Add/modify prototype flow
:set-plugin-data      ; Plugin data storage
```

### 14.2 Object Operations

Within `:mod-obj`, individual attribute changes use operations:

```clojure
;; Set a single attribute
{:type :set
 :attr :fill-color
 :val "#ff0000"
 :ignore-touched false
 :ignore-geometry false}

;; Assign multiple attributes at once
{:type :assign
 :value {:x 100 :y 200 :width 300}}

;; Set component touched status
{:type :set-touched
 :touched #{:fill-group :stroke-group}}
```

### 14.3 Change Submission Flow

```clojure
;; Frontend creates changes:
(def change
  {:type :mod-obj
   :page-id page-id
   :id shape-id
   :operations [{:type :set :attr :x :val 100}
                {:type :set :attr :y :val 200}]})

;; Changes are batched and sent:
(rp/cmd! :update-file
  {:id file-id
   :session-id session-id
   :revn current-revn
   :changes [change1 change2 ...]})

;; Backend response includes lagged changes (changes from other users
;; that happened between the client's revn and the current revn):
[{:changes [...] :revn 42 :session-id other-session}]
```

### 14.4 Conflict Resolution

Penpot uses **last-write-wins** with revision numbers:
1. Client sends changes with its last known `revn`
2. Server checks if `revn` matches current; if not, returns **lagged changes**
3. Client applies lagged changes first, then re-applies its own changes
4. The backend always advances `revn` monotonically

---

## 15. Authentication & Sessions

### 15.1 Authentication Methods

Located in `backend/src/app/rpc/commands/auth.clj`:

```clojure
;; 1. Email + Password
(sv/defmethod ::login-with-password ...)
;; Verifies password using bcrypt (argon2 upgrade path)
;; Creates HTTP session

;; 2. OIDC (OpenID Connect)
;; Supports Google, GitHub, GitLab, and generic OIDC providers
;; Configured via environment variables

;; 3. LDAP
;; Configurable directory authentication
;; Maps LDAP attributes to profile fields

;; 4. API Access Tokens
;; Long-lived tokens for programmatic access
;; Scoped permissions
```

### 15.2 Session Management

```clojure
;; Sessions are stored in the database:
CREATE TABLE http_session (
  id         text PRIMARY KEY,
  profile_id uuid REFERENCES profile(id),
  created_at timestamptz,
  updated_at timestamptz,
  user_agent text,
  ip_addr    inet
);

;; Token stored in secure cookie: "auth-token"
;; Token is a signed JWT that references the session ID
```

### 15.3 Authorization Middleware

```clojure
;; Applied to all RPC methods by default:
(defn- wrap-authentication [_ f mdata]
  (fn [cfg params]
    (let [profile-id (::profile-id params)]
      (if (and (::auth mdata true) (not (uuid? profile-id)))
        (ex/raise :type :authentication
                  :code :authentication-required)
        (f cfg params)))))
```

### 15.4 File Permissions

```clojure
;; Permission levels:
:is-owner
:is-admin
:can-edit
:can-read (derived from team membership or share link)
:can-comment

;; Check functions:
(check-edition-permissions! conn profile-id file-id)
(check-read-permissions! conn profile-id file-id)
(check-comment-permissions! conn profile-id file-id share-id)
```

---

## 16. Storage & Media

### 16.1 Storage Backends

```clojure
;; Configured in app.config:
:objects-storage-backend "fs"    ; or "s3"

;; Filesystem backend
:objects-storage-fs-directory "assets"

;; S3/MinIO backend
:objects-storage-s3-endpoint "http://minio:9000"
:objects-storage-s3-bucket "penpot"
```

### 16.2 Storage Object Model

```sql
CREATE TABLE storage_object (
  id         uuid PRIMARY KEY,
  created_at timestamptz,
  deleted_at timestamptz,
  size       bigint,
  backend    text,     -- "fs" or "s3"
  metadata   jsonb,
  bucket     text
);
```

### 16.3 Media Upload Flow

```clojure
;; Frontend: multipart upload
(rp/cmd! :upload-file-media-object
  {:file-id file-id
   :name "image.png"
   :content (js/File. ...)
   :is-local true})

;; Backend: stores file, creates media object reference
(sv/defmethod ::upload-file-media-object
  [{:keys [::db/conn ::sto/storage]} {:keys [file-id content]}]
  ;; 1. Upload to storage backend
  ;; 2. Generate thumbnail
  ;; 3. Create file_media_object record
  ;; 4. Return media reference for use in shapes
  )
```

### 16.4 Asset URLs

```clojure
;; Public asset URL pattern:
"/assets/by-id/{media-id}"

;; Resolved in frontend:
(cf/resolve-media media-id) ;; → full URL
```

---

## 17. Infrastructure & Docker

### 17.1 Docker Compose Services

From `docker/devenv/docker-compose.yaml`:

| Service | Image | Port(s) | Purpose |
|---------|-------|---------|---------|
| **main** | `penpotapp/devenv:latest` | 3449 (frontend), 6060 (backend) | Development container |
| **postgres** | `postgres:16.8` | 5432 | Primary database |
| **redis** | `valkey/valkey:8.1` | 6379 | Pub/Sub & caching |
| **minio** | `minio/minio` | 9000, 9001 | Object storage (S3-compatible) |
| **mailer** | `sj26/mailcatcher` | 1080 | Dev email testing |
| **ldap** | `rroemhild/test-openldap` | 10389 | LDAP testing |

### 17.2 Port Map

| Port | Service |
|------|---------|
| 3447 | Frontend dev server (shadow-cljs) |
| 3448 | Frontend dev server (alternate) |
| 3449 | Main application (Vite proxy) |
| 6060 | Backend HTTP server |
| 6061 | Backend nREPL |
| 9000 | MinIO API |
| 9001 | MinIO Console |

### 17.3 PostgreSQL Configuration

```yaml
environment:
  POSTGRES_DB: penpot
  POSTGRES_USER: penpot
  POSTGRES_PASSWORD: penpot
  POSTGRES_INITDB_ARGS: --data-checksums
```

With custom `postgresql.conf` for performance tuning.

### 17.4 Environment Variables

Key backend environment variables:

```bash
PENPOT_PUBLIC_URI=http://localhost:3449
PENPOT_DATABASE_URI=postgresql://postgres/penpot
PENPOT_DATABASE_USERNAME=penpot
PENPOT_DATABASE_PASSWORD=penpot
PENPOT_REDIS_URI=redis://redis/0
PENPOT_SMTP_ENABLED=true
PENPOT_SMTP_HOST=mailer
PENPOT_SMTP_PORT=1025
PENPOT_FLAGS=enable-login enable-registration enable-email-verification
```

### 17.5 Dependency Injection (Integrant)

The backend uses **Integrant** for component lifecycle:

```clojure
;; System map in backend/src/app/main.clj
{::db/pool          {:uri ... :username ... :password ...}
 ::rds/pool         {:uri ...}
 ::sto/storage      {:backend :fs :directory "assets"}
 ::http/server      {:port 6060 :router (ig/ref ::http/router)}
 ::http/router      {:rpc-routes (ig/ref ::rpc/routes)
                     :ws-routes (ig/ref ::ws/routes)}
 ::rpc/methods      {:pool (ig/ref ::db/pool)
                     :storage (ig/ref ::sto/storage)}
 ::rpc/routes       {:methods (ig/ref ::rpc/methods)}
 ::ws/routes        {:msgbus (ig/ref ::mbus/msgbus)}
 ::mbus/msgbus      {:redis (ig/ref ::rds/pool)}}
```

---

## 18. Frontend API Calls (Repo Layer)

### 18.1 HTTP Client (`frontend/src/app/main/repo.cljs`)

All API calls route through the `cmd!` multimethod:

```clojure
;; Generic command call:
(rp/cmd! :get-file {:id file-id})
;; → GET /api/main/methods/get-file?id=<file-id>

(rp/cmd! :update-file {:id file-id :changes [...]})
;; → POST /api/main/methods/update-file
;;   Body: Transit+JSON encoded params

(rp/cmd! :upload-file-media-object {:file-id ... :content ...})
;; → POST /api/main/methods/upload-file-media-object
;;   Body: multipart/form-data
```

### 18.2 Request Building

```clojure
;; Method determination:
;; - If name starts with "get-" → HTTP GET (params in query string)
;; - Otherwise → HTTP POST (params in Transit+JSON body)

;; Headers always include:
{"accept" "application/transit+json,text/event-stream,*/*"
 "x-external-session-id" (cf/external-session-id)}

;; Credentials: "include" (sends cookies)
```

### 18.3 Response Handling

```clojure
(defn handle-response [{:keys [status body]}]
  (cond
    (= 204 status) (rx/of nil)
    (= 200 status) (rx/of body)
    (= 502 status) (rx/throw {:type :bad-gateway})
    (= 503 status) (rx/throw {:type :service-unavailable})
    (= 413 status) (rx/throw {:type :validation :code :request-body-too-large})
    (>= status 400) (rx/throw body)))
```

### 18.4 Server-Sent Events (SSE)

Long-running operations use SSE for progress streaming:

```clojure
;; Export/Import use SSE streams:
::sse/export-binfile  {:stream? true}
::sse/import-binfile  {:stream? true :form-data? true}
::sse/clone-template  {:stream? true}
```

### 18.5 Common API Patterns

```clojure
;; Fetch data (returns Observable):
(->> (rp/cmd! :get-file {:id file-id})
     (rx/map process-file))

;; Submit changes:
(->> (rp/cmd! :update-file
       {:id file-id
        :session-id session-id
        :revn revn
        :changes changes})
     (rx/map handle-lagged-changes))

;; Upload media:
(->> (rp/cmd! :upload-file-media-object
       {:file-id file-id
        :name "image.png"
        :content blob
        :is-local true})
     (rx/map (fn [media] (st/emit! (use-media media)))))
```

---

## 19. Plugin System

### 19.1 Overview

The plugin system is in `plugins/` and `frontend/src/app/plugins/`:

- **Plugin API**: TypeScript API exposed to plugins
- **Plugin Runtime**: Sandboxed iframe execution
- **Plugin Registry**: Plugin discovery and management

### 19.2 Plugin Data Storage

Plugins can store key-value data on files, pages, shapes, components, colors, and typographies:

```clojure
;; Change type for plugin data:
{:type :set-plugin-data
 :object-type :shape       ; :file, :page, :shape, :color, :typography, :component
 :object-id shape-uuid
 :page-id page-uuid
 :namespace :my-plugin
 :key "my-data-key"
 :value "serialized-data-string"}
```

---

## 20. Key Design Patterns

### 20.1 Persistent Data Structures

All state uses Clojure's **immutable persistent data structures**. State changes produce new values, never mutate existing ones. This enables:
- Efficient equality checks via reference comparison
- Safe concurrent access
- Easy undo/redo
- React rendering optimizations (memo)

### 20.2 Event Sourcing for Files

File state is reconstructed from a sequence of changes:
```
Initial State → Change 1 → Change 2 → ... → Change N → Current State
```

Each change is stored in `file_change` table. File `data` column stores the materialized current state for fast reads.

### 20.3 Component Architecture (Rumext/React)

```clojure
;; Memoized functional component:
(mf/defc my-component
  {::mf/wrap [mf/memo]
   ::mf/wrap-props false}
  [props]
  (let [value (mf/deref some-ref)
        memo-val (mf/with-memo [dep1 dep2]
                   (expensive-computation dep1 dep2))]
    [:div {:class "my-class"}
     [:span value]]))
```

### 20.4 Binary Serialization

File data is serialized to binary for database storage:
```clojure
;; Encoding (Clojure → bytes):
(blob/encode file-data)

;; Decoding (bytes → Clojure):
(blob/decode data-bytes)

;; Uses Fressian for efficient binary encoding of Clojure data structures
;; Fall back to Transit+JSON for compatibility
```

### 20.5 Feature Flags

Features are toggled via flags:
```clojure
;; Backend: configured via PENPOT_FLAGS env var
(contains? cf/flags :login)
(contains? cf/flags :registration)
(contains? cf/flags :webhooks)

;; Frontend: per-file feature flags
(features/active-feature? state "render-wasm/v1")
(features/active-feature? state "text-editor/v2")
```

### 20.6 Hot Code Reloading (Development)

- **Frontend**: Shadow-CLJS hot reload + React fast refresh
- **Backend**: nREPL + `tools.namespace.repl/refresh` for live code reloading
- **WASM**: Watch mode with auto-rebuild (`render-wasm/watch`)

### 20.7 Geometry Library

Comprehensive geometry utils in `common/src/app/common/geom/`:

```clojure
;; Points
(gpt/point 10 20)
(gpt/add p1 p2)
(gpt/distance p1 p2)

;; Matrices (2D affine transforms)  
(gmt/matrix)           ; Identity
(gmt/translate-matrix tx ty)
(gmt/rotate-matrix angle)
(gmt/scale-matrix sx sy)
(gmt/multiply m1 m2)

;; Rectangles
(grc/make-rect x y w h)
(grc/overlaps-rects? r1 r2)

;; Shapes
(gsh/transform-shape shape modifiers)
(gsh/shapes->rect shapes)  ; Bounding box of multiple shapes
```

### 20.8 Multi-User Presence

Cursor positions of other users are broadcast in real-time:

```clojure
;; Sent via WebSocket:
{:type :pointer-update
 :page-id page-id
 :x cursor-x
 :y cursor-y
 :profile-id profile-id
 :profile-name "User Name"
 :profile-color "#ff0000"}

;; Rendered as colored cursors on the canvas:
[:& presence/active-cursors {:page-id page-id}]
```

---

## Summary Checklist

To implement a similar system, you need:

- [ ] **Database**: PostgreSQL with UUID primary keys, timestamped rows, soft-delete pattern
- [ ] **Connection Pool**: HikariCP or equivalent with health checks
- [ ] **Migration System**: Sequential SQL migrations with a version registry
- [ ] **API Layer**: RPC-over-HTTP with Transit+JSON serialization
- [ ] **Auth**: Cookie-based sessions with JWT tokens, optional OIDC/LDAP
- [ ] **Real-Time**: WebSocket + Redis pub/sub for change broadcasting
- [ ] **State Management**: Event-sourced store with derived subscriptions
- [ ] **Canvas (SVG)**: Two-layer SVG (render + controls) with viewBox pan/zoom
- [ ] **Canvas (GPU)**: Rust/WASM + Skia with tile-based rendering
- [ ] **Shape Model**: Hierarchical tree stored as flat ID-indexed map
- [ ] **Change System**: Operational transforms with revision-based conflict resolution
- [ ] **Interaction System**: Event→Action model with animations and overlays
- [ ] **Viewer**: Frame navigation, overlay management, animation system
- [ ] **File Storage**: Binary-encoded document blobs with change history
- [ ] **Asset Storage**: S3-compatible object storage with CDN-friendly URLs
- [ ] **Plugin System**: Sandboxed iframe plugins with scoped data storage
- [ ] **Infrastructure**: Docker Compose with PostgreSQL, Redis/Valkey, MinIO
