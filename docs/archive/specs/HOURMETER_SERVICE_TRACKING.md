# Hourmeter Service Tracking Enhancement

**Date:** 2026-02-05
**Status:** In Development
**Customer Request:** Fleet service tracking improvements

---

## Requirements Summary

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Two hourmeter fields (Last Serviced + Next Target) | 🔄 |
| 2 | Next Target auto-calculated & read-only | 🔄 |
| 3 | Current Hourmeter mandatory on ALL job completions | 🔄 |
| 4 | Block job completion without hourmeter | ✅ Exists |
| 5 | Only Full Service resets baseline | 🔄 |
| 6 | Service intervals by fuel type (Diesel 500, LPG 350, Battery 90d) | 🔄 |
| 7 | Daily usage tracking (14-day default, customizable) | 🔄 |
| 8 | Stale data alert (2+ months no update) | 🔄 |
| 9 | Service upgrade prompt (Minor → Full) | 🔄 |

---

## Existing Infrastructure

### Already Implemented
- `ForkliftType` enum: DIESEL, LPG, ELECTRIC, PETROL
- `Forklift.last_service_hourmeter` field
- `Forklift.service_interval_hours` field
- `HourmeterReading` type for history
- `hourmeter_history` table in DB
- Hourmeter validation on job completion (AWAITING_FINALIZATION)
- `ServiceInterval` type with `hourmeter_interval` and `calendar_interval_days`

### Needs Enhancement
- Service interval lookup by forklift type
- `next_target_service_hour` calculation and storage
- Mandatory hourmeter on ALL jobs (not just when completing)
- Stale data detection
- Upgrade prompt modal
- Fleet dashboard columns

---

## Database Changes

### 1. Forklift Table Updates
```sql
-- Add/ensure these fields exist
ALTER TABLE forklifts ADD COLUMN IF NOT EXISTS last_serviced_hourmeter INTEGER;
ALTER TABLE forklifts ADD COLUMN IF NOT EXISTS next_target_service_hour INTEGER;
ALTER TABLE forklifts ADD COLUMN IF NOT EXISTS last_hourmeter_update TIMESTAMPTZ;

-- Update next_target when last_serviced changes
CREATE OR REPLACE FUNCTION update_next_target_service()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.last_serviced_hourmeter IS DISTINCT FROM OLD.last_serviced_hourmeter THEN
    NEW.next_target_service_hour := NEW.last_serviced_hourmeter + COALESCE(NEW.service_interval_hours, 500);
    NEW.last_hourmeter_update := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_next_target
BEFORE UPDATE ON forklifts
FOR EACH ROW
EXECUTE FUNCTION update_next_target_service();
```

### 2. Service Interval Config by Type
```sql
-- Ensure service_intervals table has correct defaults
INSERT INTO service_intervals (forklift_type, service_type, hourmeter_interval, calendar_interval_days)
VALUES 
  ('Diesel', 'Full Service', 500, NULL),
  ('LPG', 'Full Service', 350, NULL),
  ('Electric', 'Full Service', NULL, 90),
  ('Petrol', 'Full Service', 500, NULL)
ON CONFLICT (forklift_type, service_type) DO UPDATE
SET hourmeter_interval = EXCLUDED.hourmeter_interval,
    calendar_interval_days = EXCLUDED.calendar_interval_days;
```

### 3. Global Settings Table
```sql
-- Add setting for daily usage calculation period
INSERT INTO settings (key, value, description)
VALUES ('daily_usage_period_days', '14', 'Number of days for daily usage calculation')
ON CONFLICT (key) DO NOTHING;
```

---

## Implementation Phases

### Phase 1: Database & Core Logic (Day 1)
- [ ] Migration: Add `last_serviced_hourmeter`, `next_target_service_hour`, `last_hourmeter_update` to forklifts
- [ ] Migration: Create trigger for auto-calculating next_target
- [ ] Migration: Ensure service_intervals has correct data per forklift type
- [ ] Update Forklift type interface

### Phase 2: Mandatory Hourmeter on All Jobs (Day 1)
- [ ] Update job completion validation to require hourmeter for ALL job types
- [ ] Update UI to show hourmeter field prominently on job completion
- [ ] Update hourmeter_history insert on every job

### Phase 3: Full Service Reset Logic (Day 2)
- [ ] On Full Service job completion:
  - Update `last_serviced_hourmeter` with current reading
  - Auto-calculate `next_target_service_hour`
- [ ] Minor Service: Do NOT reset baseline

### Phase 4: Fleet Dashboard Enhancement (Day 2)
- [ ] Add columns: Last Serviced, Next Target, Current, Daily Usage
- [ ] Daily usage calculation from hourmeter_history
- [ ] Stale indicator (2+ months)
- [ ] Service Due status based on current > next_target

### Phase 5: Service Upgrade Prompt (Day 3)
- [ ] Check on Minor Service job start: is unit overdue?
- [ ] Modal component for upgrade decision
- [ ] Job type conversion logic
- [ ] Checklist swap (Minor → Full)
- [ ] Log declined upgrades

### Phase 6: Stale Data Alerts (Day 3)
- [ ] Background check for stale hourmeter data
- [ ] Dashboard indicator
- [ ] Notification to admin + supervisor

---

## UI/UX Specifications

### Upgrade Prompt Modal
```
┌────────────────────────────────────────┐
│  ⚠️ Full Service Overdue              │
│                                        │
│  This unit is 21 hours past target.   │
│                                        │
│  Current: 1,755 hrs                    │
│  Target was: 1,734 hrs                 │
│                                        │
│  Upgrade to Full Service?              │
│                                        │
│  [Upgrade]  [Keep Minor]               │
└────────────────────────────────────────┘
```

### Fleet Dashboard Columns
| Column | Source | Notes |
|--------|--------|-------|
| Serial/Model | forklifts | Existing |
| Status | computed | Service Due if overdue |
| Last Serviced | last_serviced_hourmeter | From forklift |
| Next Target | next_target_service_hour | Auto-calculated |
| Current | hourmeter | Latest reading |
| Daily Usage | computed | From hourmeter_history |
| Stale | computed | last_hourmeter_update > 60 days |

---

## Testing Checklist

- [ ] Create forklift with Diesel type → verify 500hr interval
- [ ] Create forklift with LPG type → verify 350hr interval
- [ ] Create forklift with Electric type → verify calendar-based
- [ ] Complete Minor Service → verify baseline NOT reset
- [ ] Complete Full Service → verify baseline IS reset
- [ ] Start Minor Service on overdue unit → verify upgrade prompt
- [ ] Accept upgrade → verify job type changes to Full Service
- [ ] Decline upgrade → verify unit stays "Service Due"
- [ ] Forklift with no hourmeter update in 60+ days → verify stale indicator
- [ ] Daily usage calculation accuracy
