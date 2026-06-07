# Mint Web API Reference

Most APIs are Next.js App Router route handlers under `app/api`. Unless listed as public in `proxy.ts`, API routes require a valid `token` cookie or `Authorization: Bearer <token>`.

## Auth And Profile

| Route | Methods | Auth | Purpose |
| --- | --- | --- | --- |
| `/api/signup` | `POST` | Public | Create a user account. |
| `/api/login` | `POST` | Public | Verify credentials, issue a session token, and set cookie. |
| `/api/logout` | `POST` | Public/session | Clear the session cookie. |
| `/api/validate-token` | `POST` | Public | Validate a token and return user information. |
| `/api/profile` | `GET`, `PATCH` | Required | Read or update current user profile fields. |
| `/api/onboarding` | `PATCH` | Required | Save onboarding metadata and mark onboarding progress. |

Common failures: `401` for missing/invalid token, `400` for invalid input, `500` for DB/internal errors.

## Projects

| Route | Methods | Auth | Purpose |
| --- | --- | --- | --- |
| `/api/projects` | `GET` | Required | List current user's projects, or fetch one with `?id=` if owner/public. |
| `/api/projects` | `POST` | Required | Create a project with `name`, optional `description`, and optional `thumbnail_url`. |
| `/api/projects/[id]` | `DELETE` | Required | Delete a project the user owns or can administer. |
| `/api/projects/community` | `GET` | Public | List public/community projects. |
| `/api/projects/[id]/settings` | `PATCH` | Required | Update project settings such as name, description, public/edit flags. |
| `/api/projects/[id]/publish` | `PATCH` | Required | Toggle or update publish/public state. |
| `/api/projects/[id]/dashboard` | `GET` | Required | Return project dashboard/backend data. |

Access checks generally allow owners, admins, public readers, or public editors depending on the operation.

## Files And Changes

| Route | Methods | Auth | Purpose |
| --- | --- | --- | --- |
| `/api/files?projectId=` | `GET` | Required | List files in a project. |
| `/api/files?id=` | `GET` | Required | Fetch one file with data. |
| `/api/files` | `POST` | Required | Create a file with `projectId`, optional `name`, and optional `data`. |
| `/api/files` | `PUT` | Required | Rename a file by `id`. |
| `/api/files?id=` | `DELETE` | Required | Soft-delete a file. |
| `/api/files/changes` | `POST` | Required | Persist file changes and revision data. |
| `/api/files/changes` | `GET` | Required | Fetch file changes, usually by file/revision query params. |

Common failures: missing `projectId` or `id`, missing edit permission, file/project not found.

## Comments

| Route | Methods | Auth | Purpose |
| --- | --- | --- | --- |
| `/api/comments` | `GET` | Required | Fetch comment threads/replies for a file or canvas context. |
| `/api/comments` | `POST` | Required | Create a comment thread or reply. |

Comments are tied to files and include canvas location metadata for design review workflows.

## Runtime And Preview Data

| Route | Methods | Auth | Purpose |
| --- | --- | --- | --- |
| `/api/runtime-schema/[projectId]` | `GET` | Required | Load a project's runtime schema for owner, admin, or public-reader access. |
| `/api/runtime-schema/[projectId]` | `POST` | Required | Save a project's runtime schema for owner, admin, or public-editor access. |
| `/api/design-data/[projectId]` | `GET` | Public project or token | Return latest design data for preview/server-driven clients. |
| `/api/project-data/[projectId]` | `GET` | Public project or token | Return project data used by preview/runtime consumers. |
| `/api/mobile-config` | `GET` | Public | Return mobile/runtime config for a project. |
| `/api/viewer` | `GET` | Public | Return viewer-oriented project/file data. |

Some runtime routes are intentionally public or token-addressable because generated clients and preview surfaces need to poll them without a browser product session. Private project data requires either a valid owner session or the project-specific sync token.

## Conversion, Commit, And Sync

| Route | Methods | Auth | Purpose |
| --- | --- | --- | --- |
| `/api/convert` | `GET` | Protected by proxy unless public exception added | Return available target frameworks. |
| `/api/convert` | `POST` | Protected by proxy unless public exception added | Convert design nodes to a downloadable ZIP. |
| `/api/commit` | `POST` | Required | Convert nodes, store versioned generated files/design data, and return changed files. |
| `/api/commit` | `GET` | Required | Fetch commit history or a specific version by query params. |
| `/api/sync/[projectId]` | `GET` | Public | Return latest commit/sync metadata for a project. |

`/api/convert` validates target, file name, design nodes, reference frame, interactions, and conversion options. `/api/commit` additionally verifies project edit access and uses the concurrency-limited conversion worker.

## Database And Backend Data

| Route | Methods | Auth | Purpose |
| --- | --- | --- | --- |
| `/api/db/[projectId]` | `POST` | Required | Project-scoped database operations. |
| `/api/db/migrate/[projectId]` | `POST` | Required | Apply project database migrations/config. |
| `/api/seed-crm` | `GET` | Protected by proxy unless public exception added | Seed CRM demo data. |

The project uses `lib/db.ts` for application persistence and project backend metadata. SQL is sent through `DB_PROXY_URL`.

## Admin

| Route | Methods | Auth | Purpose |
| --- | --- | --- | --- |
| `/api/admin/users` | `GET` | Admin | List users for approval/admin management. |
| `/api/admin/users` | `PATCH` | Admin | Update user role/approval-related fields. |

Admin APIs are protected by `proxy.ts` and require `role = 'admin'`.

## WebSocket Events

The standalone collaboration server is not an App Router API route. It runs from `server/websocket.ts` and uses Socket.IO.

Important event families:

- `subscribe-file` and unsubscribe/session cleanup.
- Presence, cursor, selection, and viewport events.
- File change broadcasts.
- Config update and code update broadcasts.

Connections validate token, file/project access, rate limits, and room capacity.

## API Design Notes

- Authenticated routes usually read `token` from cookies and call `findUserByToken`.
- Public runtime routes exist for generated clients and previews.
- Project access often distinguishes owner, admin, public read, and public edit.
- Errors are JSON responses with `error` and optional details.
- Many routes fail closed when the DB bridge is unreachable.
