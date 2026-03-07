-- Database migration for real-time collaboration
-- Run: psql -U your_user -d your_database -f migrations/001_collaboration.sql

-- Collaboration sessions table
CREATE TABLE IF NOT EXISTS collab_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP,
  active_users INTEGER DEFAULT 0,
  total_operations INTEGER DEFAULT 0
);

-- Create indexes for collab_sessions
CREATE INDEX IF NOT EXISTS idx_collab_sessions_project ON collab_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_collab_sessions_active ON collab_sessions(ended_at) WHERE ended_at IS NULL;

-- Collaboration participants table
CREATE TABLE IF NOT EXISTS collab_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES collab_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  color VARCHAR(7) NOT NULL,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  left_at TIMESTAMP,
  cursor_x FLOAT DEFAULT 0,
  cursor_y FLOAT DEFAULT 0
);

-- Create indexes for collab_participants
CREATE INDEX IF NOT EXISTS idx_collab_participants_session ON collab_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_collab_participants_user ON collab_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_collab_participants_active ON collab_participants(session_id, left_at) WHERE left_at IS NULL;

-- Collaboration operations log (for persistence and recovery)
CREATE TABLE IF NOT EXISTS collab_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES collab_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  operation_type VARCHAR(50) NOT NULL,
  shape_id UUID NOT NULL,
  operation_data JSONB NOT NULL,
  lamport_clock BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for collab_operations
CREATE INDEX IF NOT EXISTS idx_collab_operations_session ON collab_operations(session_id);
CREATE INDEX IF NOT EXISTS idx_collab_operations_shape ON collab_operations(shape_id);
CREATE INDEX IF NOT EXISTS idx_collab_operations_timestamp ON collab_operations(created_at);
CREATE INDEX IF NOT EXISTS idx_collab_operations_clock ON collab_operations(session_id, lamport_clock);

-- Add collaboration metadata to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_collaborative BOOLEAN DEFAULT TRUE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS max_collaborators INTEGER DEFAULT 20;

-- Create view for active collaboration sessions
CREATE OR REPLACE VIEW active_sessions AS
SELECT 
  cs.id AS session_id,
  cs.project_id,
  p.name AS project_name,
  cs.started_at,
  COUNT(DISTINCT cp.user_id) AS active_users,
  cs.total_operations,
  ARRAY_AGG(DISTINCT cp.email) AS participant_emails
FROM collab_sessions cs
JOIN projects p ON cs.project_id = p.id
LEFT JOIN collab_participants cp ON cs.id = cp.session_id AND cp.left_at IS NULL
WHERE cs.ended_at IS NULL
GROUP BY cs.id, cs.project_id, p.name, cs.started_at, cs.total_operations;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Migration completed successfully! Collaboration tables created.';
END $$;
