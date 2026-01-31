# FieldPro Telegram Bot Integration Plan

**Date:** 2026-01-30  
**Status:** Draft - Awaiting Review

---

## Overview

Integrate Telegram notifications into FieldPro so technicians, admins, and supervisors receive instant alerts for job assignments, approvals, and escalations.

---

## Phase 1: Bot Setup & Foundation (30 mins)

### 1.1 Create Telegram Bot
**Action by:** Jay

1. Open Telegram → Message `@BotFather`
2. Send `/newbot`
3. Bot name: `FieldPro Alerts` (or your choice)
4. Bot username: `FieldProAlertsBot` (must be unique, ends in "bot")
5. Copy the API token → Send to Phoenix

### 1.2 Database Table
**Action by:** Phoenix

Create `user_telegram_links` table:

```sql
CREATE TABLE user_telegram_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  telegram_chat_id BIGINT NOT NULL,
  telegram_username TEXT,
  linked_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(user_id),
  UNIQUE(telegram_chat_id)
);

-- Index for fast lookups
CREATE INDEX idx_telegram_links_user ON user_telegram_links(user_id);
CREATE INDEX idx_telegram_links_chat ON user_telegram_links(telegram_chat_id);

-- RLS: Users can see their own link, admins can see all
ALTER TABLE user_telegram_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own telegram link"
  ON user_telegram_links FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users manage own telegram link"
  ON user_telegram_links FOR ALL
  USING (auth.uid() = user_id);
```

---

## Phase 2: Edge Functions (2-3 hours)

### 2.1 Webhook Handler: `telegram-webhook`

Receives incoming messages from Telegram (when users tap "Start").

```
POST /functions/v1/telegram-webhook

Flow:
1. Telegram sends update (user started bot)
2. Extract chat_id, username, and start parameter
3. Start parameter contains encrypted user_id token
4. Verify token, link chat_id to user_id
5. Send confirmation message to user
```

**Handles:**
- `/start <token>` — Link account
- `/unlink` — Disconnect notifications
- `/status` — Check connection status
- `/help` — Show available commands

### 2.2 Notification Sender: `telegram-notify`

Called internally to send notifications.

```
POST /functions/v1/telegram-notify
Authorization: service_role_key

Body:
{
  "user_id": "uuid",          // OR
  "chat_id": 123456789,       // Direct chat_id
  "type": "job_assigned",
  "data": {
    "job_id": "uuid",
    "customer": "ABC Logistics",
    "forklift": "FL-0042",
    "job_type": "Slot-In",
    "location": "Warehouse B"
  }
}
```

**Message Templates by Type:**

| Type | Message |
|------|---------|
| `job_assigned` | 🔧 **New Job Assigned!**<br>Customer: {customer}<br>Forklift: {forklift}<br>Type: {job_type}<br>⏰ Respond within 15 minutes<br>[Accept] [Reject] [Open] |
| `job_accepted` | ✅ **Job Accepted**<br>{tech_name} accepted job #{job_number}<br>Customer: {customer} |
| `job_rejected` | ❌ **Job Rejected**<br>{tech_name} rejected job #{job_number}<br>Reason: {reason} |
| `no_response` | ⚠️ **No Response Alert**<br>No response from {tech_name} on job #{job_number}<br>Deadline passed. |
| `request_approved` | ✅ **Request Approved**<br>Your {request_type} request was approved<br>Job: #{job_number} |
| `request_rejected` | ❌ **Request Rejected**<br>Your {request_type} request was rejected<br>Reason: {reason} |
| `escalation` | 🚨 **Job Escalated**<br>Job #{job_number} is overdue<br>Customer: {customer}<br>Days overdue: {days} |
| `pending_reminder` | 📋 **Pending Approvals**<br>You have {count} items waiting:<br>• {count_parts} parts requests<br>• {count_helpers} helper requests |

### 2.3 Callback Handler: `telegram-callback`

Handles button presses (Accept/Reject from Telegram).

```
Flow:
1. User taps [Accept] button in Telegram
2. Telegram sends callback_query to webhook
3. Parse action: accept_job_{job_id}
4. Call acceptJobAssignment() in Supabase
5. Update message: "✅ Job accepted!"
6. Notify admins
```

---

## Phase 3: Database Triggers (1 hour)

### 3.1 Job Assignment Trigger

```sql
CREATE OR REPLACE FUNCTION notify_telegram_job_assigned()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire when technician_id changes (job assigned/reassigned)
  IF NEW.technician_id IS DISTINCT FROM OLD.technician_id 
     AND NEW.technician_id IS NOT NULL THEN
    
    PERFORM net.http_post(
      url := 'https://your-project.supabase.co/functions/v1/telegram-notify',
      headers := '{"Authorization": "Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb,
      body := jsonb_build_object(
        'user_id', NEW.technician_id,
        'type', 'job_assigned',
        'data', jsonb_build_object(
          'job_id', NEW.job_id,
          'job_number', NEW.job_number,
          'customer', NEW.customer_name,
          'forklift', NEW.forklift_number,
          'job_type', NEW.job_type,
          'location', NEW.location
        )
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_telegram_job_assigned
  AFTER UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION notify_telegram_job_assigned();
```

### 3.2 Request Approved/Rejected Trigger

```sql
CREATE OR REPLACE FUNCTION notify_telegram_request_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire when status changes to approved/rejected
  IF NEW.status IN ('approved', 'rejected') 
     AND OLD.status = 'pending' THEN
    
    PERFORM net.http_post(
      url := 'https://your-project.supabase.co/functions/v1/telegram-notify',
      headers := '{"Authorization": "Bearer ' || current_setting('app.service_role_key') || '"}'::jsonb,
      body := jsonb_build_object(
        'user_id', NEW.requested_by_id,
        'type', 'request_' || NEW.status,
        'data', jsonb_build_object(
          'job_id', NEW.job_id,
          'request_type', NEW.request_type,
          'reason', NEW.rejection_reason
        )
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_telegram_request_status
  AFTER UPDATE ON job_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_telegram_request_status();
```

### 3.3 Escalation Trigger

Fire when job becomes escalated (multi-day overdue).

---

## Phase 4: FieldPro UI (1-2 hours)

### 4.1 Connect Telegram Button

**Location:** User Profile page / Settings

```tsx
// components/TelegramConnect.tsx

const TelegramConnect = ({ userId }) => {
  const [linked, setLinked] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Generate secure token for linking
  const connectUrl = `https://t.me/FieldProAlertsBot?start=${generateToken(userId)}`;
  
  if (linked) {
    return (
      <div className="flex items-center gap-2 text-green-600">
        <CheckCircle size={20} />
        <span>Telegram Connected</span>
        <button onClick={handleUnlink}>Disconnect</button>
      </div>
    );
  }
  
  return (
    <a href={connectUrl} target="_blank" className="btn btn-primary">
      <Send size={20} />
      Connect Telegram
    </a>
  );
};
```

### 4.2 Notification Preferences

Allow users to choose what notifications they receive:

```
┌─────────────────────────────────────┐
│ 🔔 Telegram Notifications           │
│                                     │
│ [✅] Job Assignments                │
│ [✅] Request Approvals/Rejections   │
│ [✅] Escalation Alerts              │
│ [  ] Daily Summary                  │
│                                     │
│ [📱 Connect Telegram]               │
└─────────────────────────────────────┘
```

### 4.3 Admin: Bulk Link View

Admin can see which users have Telegram connected:

```
┌────────────────────────────────────────────┐
│ Team Telegram Status                       │
├──────────────────┬──────────┬──────────────┤
│ Name             │ Role     │ Telegram     │
├──────────────────┼──────────┼──────────────┤
│ Ahmad bin Ali    │ Tech     │ ✅ Connected │
│ Siti Aminah      │ Tech     │ ❌ Not linked│
│ Raj Kumar        │ Tech     │ ✅ Connected │
└──────────────────┴──────────┴──────────────┘
```

---

## Phase 5: Testing & Deployment (1 hour)

### 5.1 Test Scenarios

| Test | Expected Result |
|------|-----------------|
| User clicks Connect → taps Start | Links successfully, confirmation message |
| Admin assigns job | Technician receives Telegram notification |
| Tech taps Accept in Telegram | Job accepted, admin notified |
| Tech taps Reject in Telegram | Modal for reason (in FieldPro), or simple reject |
| Request approved | Requester receives notification |
| No response 15 min | Admin receives alert |
| User clicks Disconnect | Link removed, no more notifications |

### 5.2 Deployment Checklist

- [ ] Bot created via BotFather
- [ ] Bot token stored in Supabase secrets
- [ ] Database table created
- [ ] Edge Functions deployed
- [ ] Webhook URL set in Telegram (via BotFather or API)
- [ ] Database triggers active
- [ ] UI components deployed
- [ ] Test with real users

---

## Security Considerations

1. **Token Generation:** Use signed JWT or encrypted token for connect links (prevents user_id guessing)
2. **Webhook Verification:** Verify Telegram's webhook signature
3. **Rate Limiting:** Limit notification frequency to prevent spam
4. **Secrets:** Store bot token in Supabase Vault, not in code

---

## Timeline Estimate

| Phase | Time | Dependency |
|-------|------|------------|
| Phase 1: Bot Setup | 30 min | Jay creates bot |
| Phase 2: Edge Functions | 2-3 hours | Supabase Pro active |
| Phase 3: Database Triggers | 1 hour | Phase 2 complete |
| Phase 4: UI Components | 1-2 hours | Phase 2 complete |
| Phase 5: Testing | 1 hour | All phases complete |
| **Total** | **5-7 hours** | |

---

## Files to Create

```
/supabase/functions/
├── telegram-webhook/
│   └── index.ts
├── telegram-notify/
│   └── index.ts
└── telegram-callback/
    └── index.ts

/database/migrations/
└── 20260130_telegram_integration.sql

/components/
├── TelegramConnect.tsx
└── TelegramStatus.tsx

/services/
└── telegramService.ts
```

---

## Questions for Jay

1. **Bot name preference?** (e.g., "FieldPro Alerts", "FP Notifications")
2. **Bot username preference?** (must end in "bot", must be unique)
3. **Notification language?** English only, or Malay too?
4. **Accept/Reject from Telegram?** Or just notify + "Open in FieldPro"?

---

## Next Steps

1. ✅ Jay reviews this plan
2. ⏳ Jay creates bot via BotFather
3. ⏳ Jay upgrades to Supabase Pro
4. ⏳ Phoenix builds the system
5. ⏳ Test with Jay's account first
6. ⏳ Roll out to team

---

*Awaiting review and approval.*
