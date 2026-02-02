-- =============================================
-- Error Tracking for "Desire Paths" Analysis
-- Created: 2026-02-02
-- 
-- Tracks failed user actions to identify:
-- - What users are trying to do that fails
-- - Patterns in errors (which actions fail most)
-- - Opportunities for new features
-- =============================================

CREATE TABLE IF NOT EXISTS user_action_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID,
    user_role TEXT,
    action_type TEXT NOT NULL,
    action_target TEXT,
    target_id TEXT,
    error_message TEXT NOT NULL,
    error_code TEXT,
    request_payload JSONB,
    page_url TEXT,
    user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_action_errors_created ON user_action_errors(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_errors_action ON user_action_errors(action_type);

ALTER TABLE user_action_errors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS user_action_errors_auth_all ON user_action_errors;
CREATE POLICY user_action_errors_auth_all ON user_action_errors 
    FOR ALL TO authenticated USING (true) WITH CHECK (true);
GRANT ALL ON user_action_errors TO authenticated;

COMMENT ON TABLE user_action_errors IS 'Tracks failed user actions for Desire Paths analysis';
COMMENT ON COLUMN user_action_errors.action_type IS 'What the user was trying to do (e.g., update_status, add_part)';
COMMENT ON COLUMN user_action_errors.action_target IS 'What entity they were acting on (e.g., job, checklist)';
COMMENT ON COLUMN user_action_errors.error_message IS 'The actual error message shown';
