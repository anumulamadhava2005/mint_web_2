-- Penpot-inspired database schema extensions
-- Mirrors: backend/src/app/migrations/sql/

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  modified_at timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz NULL,
  name        text NOT NULL,
  is_default  boolean NOT NULL DEFAULT false
);

-- Team <-> Profile relation
CREATE TABLE IF NOT EXISTS team_profile_rel (
  team_id    uuid REFERENCES teams(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES users(id) ON DELETE CASCADE,
  is_owner   boolean DEFAULT false,
  is_admin   boolean DEFAULT false,
  can_edit   boolean DEFAULT true,
  PRIMARY KEY (team_id, profile_id)
);

-- Files table (the core document)
CREATE TABLE IF NOT EXISTS files (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  modified_at timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz DEFAULT NULL,
  name        text NOT NULL DEFAULT 'Untitled',
  revn        bigint NOT NULL DEFAULT 0,
  data        jsonb NULL,
  features    text[] DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_files_project ON files(project_id);
CREATE INDEX IF NOT EXISTS idx_files_modified ON files(modified_at DESC);

-- File change (revision history)
CREATE TABLE IF NOT EXISTS file_changes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id     uuid NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  session_id  uuid NULL,
  revn        bigint NOT NULL DEFAULT 0,
  data        jsonb NULL,
  changes     jsonb NULL
);

CREATE INDEX IF NOT EXISTS idx_file_changes_file ON file_changes(file_id);
CREATE INDEX IF NOT EXISTS idx_file_changes_revn ON file_changes(file_id, revn);

-- Comment threads
CREATE TABLE IF NOT EXISTS comment_threads (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id     uuid NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  owner_id    uuid NOT NULL REFERENCES users(id),
  page_id     uuid NOT NULL,
  frame_id    uuid NULL,
  position_x  float NOT NULL DEFAULT 0,
  position_y  float NOT NULL DEFAULT 0,
  content     text NOT NULL,
  resolved    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  modified_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comment_threads_file ON comment_threads(file_id);

-- Comment replies
CREATE TABLE IF NOT EXISTS comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   uuid NOT NULL REFERENCES comment_threads(id) ON DELETE CASCADE,
  owner_id    uuid NOT NULL REFERENCES users(id),
  content     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_thread ON comments(thread_id);

-- Share links
CREATE TABLE IF NOT EXISTS share_links (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id     uuid NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  owner_id    uuid NOT NULL REFERENCES users(id),
  pages       uuid[] DEFAULT '{}',
  flags       text[] DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_share_links_file ON share_links(file_id);

-- Auto-update modified_at triggers
CREATE OR REPLACE FUNCTION update_modified_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.modified_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_files_modified_at') THEN
    CREATE TRIGGER update_files_modified_at BEFORE UPDATE ON files
    FOR EACH ROW EXECUTE FUNCTION update_modified_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_teams_modified_at') THEN
    CREATE TRIGGER update_teams_modified_at BEFORE UPDATE ON teams
    FOR EACH ROW EXECUTE FUNCTION update_modified_at_column();
  END IF;
END $$;

-- Done
DO $$ BEGIN RAISE NOTICE '✅ Penpot schema migration complete'; END $$;
