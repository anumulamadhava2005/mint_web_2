-- ═══════════════════════════════════════════════════════════════
-- Performance indexes for Mint Web
-- Run after 003_create_sessions_table.sql
-- ═══════════════════════════════════════════════════════════════

-- [DB-11] Projects by owner — used on every authenticated API call
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_owner
  ON projects (owner_id);

-- [DB-12] Public projects — community, sync, design-data endpoints
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_public
  ON projects (is_public) WHERE is_public = true;

-- [DB-13] Non-deleted files — nearly every file query filters this
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_files_active
  ON files (project_id, modified_at DESC)
  WHERE deleted_at IS NULL;

-- [DB-14] Sessions token+expiry — auth hot path
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_token_expiry
  ON sessions (token, expires_at)
  WHERE expires_at > now();

-- [DB-15] Trigram index for community ILIKE search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_name_trgm
  ON projects USING gin (name gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_description_trgm
  ON projects USING gin (description gin_trgm_ops);

-- Missing: share_links by file
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_share_links_file
  ON share_links (file_id);

-- Missing: collab_sessions by project
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_collab_sessions_project
  ON collab_sessions (project_id);

-- Missing: comment_threads owner (for user comment history)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comment_threads_owner
  ON comment_threads (owner_id);

-- Missing: users email lookup (case-insensitive for login)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_lower
  ON users (lower(email));
