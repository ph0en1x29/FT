-- =============================================
-- Telegram Bot Integration for FieldPro
-- Created: 2026-01-31
-- Author: Phoenix (Clawdbot)
-- =============================================

-- Table to store Telegram chat links for users
CREATE TABLE IF NOT EXISTS user_telegram_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  telegram_chat_id BIGINT NOT NULL,
  telegram_username TEXT,
  telegram_first_name TEXT,
  language TEXT DEFAULT 'en' CHECK (language IN ('en', 'ms')), -- English or Malay
  is_active BOOLEAN DEFAULT true,
  linked_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Notification preferences
  notify_job_assigned BOOLEAN DEFAULT true,
  notify_job_accepted BOOLEAN DEFAULT true,
  notify_job_rejected BOOLEAN DEFAULT true,
  notify_request_status BOOLEAN DEFAULT true,
  notify_escalations BOOLEAN DEFAULT true,
  notify_reminders BOOLEAN DEFAULT true,
  
  -- Constraints
  CONSTRAINT unique_user_telegram UNIQUE(user_id),
  CONSTRAINT unique_chat_id UNIQUE(telegram_chat_id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_telegram_links_user_id ON user_telegram_links(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_links_chat_id ON user_telegram_links(telegram_chat_id);
CREATE INDEX IF NOT EXISTS idx_telegram_links_active ON user_telegram_links(is_active) WHERE is_active = true;

-- Enable RLS
ALTER TABLE user_telegram_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view their own telegram link
CREATE POLICY "Users can view own telegram link"
  ON user_telegram_links
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own telegram link
CREATE POLICY "Users can insert own telegram link"
  ON user_telegram_links
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own telegram link
CREATE POLICY "Users can update own telegram link"
  ON user_telegram_links
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own telegram link
CREATE POLICY "Users can delete own telegram link"
  ON user_telegram_links
  FOR DELETE
  USING (auth.uid() = user_id);

-- Admins and Supervisors can view all telegram links (for admin dashboard)
CREATE POLICY "Admins can view all telegram links"
  ON user_telegram_links
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('Admin', 'admin', 'Supervisor', 'supervisor', 'admin_service', 'admin_store')
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_telegram_link_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trg_telegram_link_updated ON user_telegram_links;
CREATE TRIGGER trg_telegram_link_updated
  BEFORE UPDATE ON user_telegram_links
  FOR EACH ROW
  EXECUTE FUNCTION update_telegram_link_timestamp();

-- =============================================
-- Telegram notification log (for debugging/audit)
-- =============================================

CREATE TABLE IF NOT EXISTS telegram_notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  chat_id BIGINT,
  notification_type TEXT NOT NULL,
  message_text TEXT,
  job_id UUID REFERENCES jobs(job_id) ON DELETE SET NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ
);

-- Index for log queries
CREATE INDEX IF NOT EXISTS idx_telegram_log_user ON telegram_notification_log(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_log_status ON telegram_notification_log(status);
CREATE INDEX IF NOT EXISTS idx_telegram_log_created ON telegram_notification_log(created_at DESC);

-- RLS for notification log (admins only)
ALTER TABLE telegram_notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view notification log"
  ON telegram_notification_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('Admin', 'admin', 'Supervisor', 'supervisor', 'admin_service', 'admin_store')
    )
  );

-- =============================================
-- Comments
-- =============================================

COMMENT ON TABLE user_telegram_links IS 'Links FieldPro users to their Telegram accounts for notifications';
COMMENT ON COLUMN user_telegram_links.language IS 'User preferred language: en (English) or ms (Bahasa Melayu)';
COMMENT ON COLUMN user_telegram_links.telegram_chat_id IS 'Telegram chat ID - unique identifier for sending messages';
COMMENT ON TABLE telegram_notification_log IS 'Audit log of all Telegram notifications sent';
