# Mint Web Feature Catalog

This document summarizes the app's current feature surface from a developer perspective. Some capabilities are implemented as editor/runtime infrastructure and may depend on connected UI panels, schema data, or DB availability.

## Public And Account Flows

- Marketing page at `/home` explaining Mint as runtime-driven application infrastructure.
- `/signup` and `/login` account entry points.
- Waitlist/approval path through `/waitlist-success`.
- Session validation through cookies and `/api/validate-token`.
- Profile page and profile API for user metadata updates.
- Admin portal for user review/approval and role-gated access.

## Projects Dashboard

The `/projects` dashboard provides:

- Recent projects tab.
- Community/public projects tab.
- Search state for filtering visible content.
- User identity display.
- Admin portal link for admin users.
- Profile and sign-out actions.
- New project creation through dashboard components and `/api/projects`.

Project records track owner, description, thumbnail, likes, views, public status, edit permissions, and timestamps.

## Project Editor

`/projects/[id]` loads project metadata, fetches or creates a file, and mounts the Penpot-style editor. The editor supports:

- Read-only mode for non-owners unless public editing is enabled.
- Visual canvas editing.
- File-backed document data.
- Prototype viewer overlay.
- Navigation back to dashboard.
- Runtime/backend panels and conversion controls through editor components.

The editor implementation is spread across `components/PenpotEditor.tsx`, canvas/rendering components, `lib/editorStore.ts`, `lib/penpot/*`, and layout/interaction utilities.

## Canvas And Design Model

The canvas/document subsystem includes:

- Shape and file types inspired by Penpot.
- SVG shape renderers under `components/penpot/`.
- Geometry, snapping, constraints, group resize, flex layout, grid layout, and auto-sizing utilities.
- Command history and interaction state machines.
- Multi-selection solving and spatial indexing through `quadTree`.
- WebGL/canvas/vector rendering modules for advanced rendering paths.

## Prototype And Preview

Mint includes two preview concepts:

- In-editor `PrototypeViewer` overlay for previewing interactions while editing.
- `/preview/[projectId]` route for project preview/runtime rendering.

Runtime preview data is served through public APIs such as `/api/design-data/[projectId]`, `/api/project-data/[projectId]`, `/api/mobile-config`, and `/api/viewer`.

## Runtime State, Actions, And Workflows

The runtime schema system models:

- Screens and component trees.
- Local/global/session/persisted state.
- Bindings from component props to expressions.
- Actions such as navigation, fetch/mutate, set/update/remove state, cache invalidation, upload, conditions, loops, sequence/parallel execution, device actions, and custom actions.
- Workflows made from nodes and edges.
- Navigation, auth, theme, and database config.

The action runtime supports middleware, conditional execution, debouncing, throttling, success/error chains, and injected platform adapters.

## Backend And Database Tooling

Backend-related capabilities include:

- Runtime schema persistence per project.
- Project database endpoint at `/api/db/[projectId]`.
- Migration endpoint at `/api/db/migrate/[projectId]`.
- Dashboard data endpoint at `/api/projects/[id]/dashboard`.
- Database metadata in tables initialized by `lib/db.ts`.
- CRM seed utilities in `scripts/` and `/api/seed-crm`.

The app currently uses a DB bridge contract rather than direct database access from app routes.

## Export And Conversion

Mint can convert design nodes to generated projects. Supported targets include:

- React.
- Next.js.
- Vue.
- Svelte.
- React Native / Expo.
- Flutter.
- HTML in API validation paths.

`/api/convert` returns generated project files as a ZIP. `/api/commit` converts and stores a versioned commit snapshot for later sync, including changed files, full generated files, warnings, and design data.

## Live Sync

Live sync is supported through generated sync files and polling endpoints:

- `/api/commit` creates versioned project commits.
- `/api/sync/[projectId]` exposes latest sync metadata.
- `/api/design-data/[projectId]` exposes design/runtime data for server-driven clients.
- Conversion options can inject live sync support into generated projects.

Exported apps use project-specific sync tokens derived from the project ID and server secret rather than embedding user session tokens.

## Collaboration And Comments

Real-time collaboration uses `server/websocket.ts` with Socket.IO and optional Redis. It supports:

- File rooms.
- Presence.
- Cursor, selection, and viewport updates.
- File changes and config/code update broadcasts.
- Token validation and project access checks.

Comments use `/api/comments` and DB tables for comment threads and replies tied to files, pages, frames, and canvas positions.

## Community And Publishing

Community/public project support includes:

- `/api/projects/community` for public project discovery.
- Project publication controls through `/api/projects/[id]/publish`.
- Project settings updates through `/api/projects/[id]/settings`.
- Public read access and optional public edit access.

## Admin

Admin functionality includes:

- `/admin` page.
- `/api/admin/users` list/update endpoint.
- Role-gated proxy checks.
- User approval controls for waitlist/product access.

## Existing User Documentation

For user-facing procedures, see:

- [User Guide](USER_GUIDE.md)
- [Actions Config Guide](ACTIONS_CONFIG_GUIDE.md)
- [Tutorial Chat App](TUTORIAL_CHAT_APP.md)
