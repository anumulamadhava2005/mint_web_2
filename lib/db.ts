import { Pool, PoolClient } from "pg";

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
  max: 60,
  idleTimeoutMillis: 120000,
  connectionTimeoutMillis: 10000,
});

pool.on("error", (err) => {
  console.error("Unexpected pool error:", err);
});

async function init() {
  // ── Core tables ──────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY,
      email text UNIQUE NOT NULL,
      password_hash text NOT NULL,
      salt text NOT NULL,
      token text,
      fullname text NOT NULL DEFAULT '',
      photo text NOT NULL DEFAULT '',
      lang text NULL,
      theme text NULL,
      created_at timestamptz DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      description text,
      thumbnail_url text,
      likes integer NOT NULL DEFAULT 0,
      views integer NOT NULL DEFAULT 0,
      owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      is_default boolean NOT NULL DEFAULT false,
      created_at timestamptz DEFAULT now()
    )
  `);

  // Add columns if they don't exist (for existing tables)
  await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS thumbnail_url text`).catch(() => {});
  await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS likes integer NOT NULL DEFAULT 0`).catch(() => {});
  await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS views integer NOT NULL DEFAULT 0`).catch(() => {});
  await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now()`).catch(() => {});
  await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS fullname text NOT NULL DEFAULT ''`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS photo text NOT NULL DEFAULT ''`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS lang text NULL`).catch(() => {});
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS theme text NULL`).catch(() => {});

  // ── Teams ────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS teams (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at  timestamptz NOT NULL DEFAULT now(),
      modified_at timestamptz NOT NULL DEFAULT now(),
      deleted_at  timestamptz NULL,
      name        text NOT NULL,
      is_default  boolean NOT NULL DEFAULT false
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS team_profile_rel (
      team_id    uuid REFERENCES teams(id) ON DELETE CASCADE,
      profile_id uuid REFERENCES users(id) ON DELETE CASCADE,
      is_owner   boolean DEFAULT false,
      is_admin   boolean DEFAULT false,
      can_edit   boolean DEFAULT true,
      PRIMARY KEY (team_id, profile_id)
    )
  `).catch(() => {});

  // ── Files (documents) ────────────────────────────────────
  await pool.query(`
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
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_files_project ON files(project_id)`).catch(() => {});

  // ── File changes (revision history) ──────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS file_changes (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      file_id     uuid NOT NULL REFERENCES files(id) ON DELETE CASCADE,
      created_at  timestamptz NOT NULL DEFAULT now(),
      session_id  uuid NULL,
      revn        bigint NOT NULL DEFAULT 0,
      data        jsonb NULL,
      changes     jsonb NULL
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_file_changes_file ON file_changes(file_id)`).catch(() => {});
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_file_changes_revn ON file_changes(file_id, revn)`).catch(() => {});

  // ── Comments ─────────────────────────────────────────────
  await pool.query(`
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
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_comment_threads_file ON comment_threads(file_id)`).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS comments (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      thread_id   uuid NOT NULL REFERENCES comment_threads(id) ON DELETE CASCADE,
      owner_id    uuid NOT NULL REFERENCES users(id),
      content     text NOT NULL,
      created_at  timestamptz NOT NULL DEFAULT now()
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_comments_thread ON comments(thread_id)`).catch(() => {});

  // ── Share links ──────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS share_links (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      file_id     uuid NOT NULL REFERENCES files(id) ON DELETE CASCADE,
      owner_id    uuid NOT NULL REFERENCES users(id),
      pages       uuid[] DEFAULT '{}',
      flags       text[] DEFAULT '{}',
      created_at  timestamptz NOT NULL DEFAULT now()
    )
  `).catch(() => {});

  // ── Collaboration tables ─────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS collab_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ended_at TIMESTAMP,
      active_users INTEGER DEFAULT 0,
      total_operations INTEGER DEFAULT 0
    )
  `).catch(() => {});

  // ── Auto-update triggers ─────────────────────────────────
  // The trigger function uses modified_at. Add modified_at to projects if needed.
  await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS modified_at timestamptz DEFAULT now()`).catch(() => {});

  await pool.query(`
    CREATE OR REPLACE FUNCTION update_modified_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.modified_at = now();
      RETURN NEW;
    END;
    $$ language 'plpgsql';
  `).catch(() => {});

  await pool.query(`
    DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
    CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_modified_at();
  `).catch(() => {});

  await pool.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_files_modified_at') THEN
        CREATE TRIGGER update_files_modified_at BEFORE UPDATE ON files
        FOR EACH ROW EXECUTE FUNCTION update_modified_at();
      END IF;
    END $$;
  `).catch(() => {});
}

init().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Failed initializing DB:", err);
});

const db = {
  query: (text: string, params?: any[]) => pool.query(text, params),

  /** Run a function within a database transaction */
  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  },
};

export default db;
