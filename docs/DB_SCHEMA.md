# FieldPro Database Schema

> Purpose: Reference for engineers and AI assistants when modifying or extending the database.
> Database: Supabase (PostgreSQL)
> Last Updated: 2026-02-05 (Added service tracking: fleet_service_overview view, service_upgrade_logs table, get_forklift_daily_usage/complete_full_service functions, new forklift columns)

---

## Table of Contents

1. Core Tables
2. Job System
3. Asset Management
4. Hourmeter Tracking
5. Van Stock System
6. Inventory
7. HR System
8. Notifications and KPI
9. System Settings
10. AutoCount Integration
11. Duration Alerts
12. Views
13. Enums
14. Functions
15. Storage Buckets

---

## Core Tables

### `users`
Application user profiles with HR data (merged from former `employees` table).

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `user_id` | UUID | NO | `uuid_generate_v4()` |
| `auth_id` | UUID | YES | |
| `name` | TEXT | NO | |
| `email` | TEXT | NO | |
| `role` | TEXT | NO | |
| `is_active` | BOOLEAN | YES | `true` |
| `avatar` | TEXT | YES | |
| `created_at` | TIMESTAMPTZ | YES | `now()` |
| `employee_code` | VARCHAR | YES | |
| `full_name` | VARCHAR | YES | |
| `phone` | VARCHAR | YES | |
| `ic_number` | VARCHAR | YES | |
| `address` | TEXT | YES | |
| `department` | VARCHAR | YES | |
| `position` | VARCHAR | YES | |
| `joined_date` | DATE | YES | |
| `employment_type` | VARCHAR | YES | `'full-time'` |
| `employment_status` | VARCHAR | YES | `'active'` |
| `emergency_contact_name` | VARCHAR | YES | |
| `emergency_contact_phone` | VARCHAR | YES | |
| `emergency_contact_relationship` | VARCHAR | YES | |
| `profile_photo_url` | TEXT | YES | |
| `updated_at` | TIMESTAMPTZ | YES | `now()` |
| `created_by_id` | UUID | YES | |
| `created_by_name` | VARCHAR | YES | |
| `updated_by_id` | UUID | YES | |
| `updated_by_name` | VARCHAR | YES | |
| `notes` | TEXT | YES | |

Constraints:
- PK: `user_id`
- UNIQUE: `email`, `auth_id`, `employee_code`

> **Note:** The `employees` table has been merged into `users` as of 2026-01-03. All HR-related queries now use the `users` table directly.

---

### `customers`
Customer records.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `customer_id` | UUID | NO | `uuid_generate_v4()` |
| `name` | TEXT | NO | |
| `phone` | TEXT | YES | |
| `email` | TEXT | YES | |
| `address` | TEXT | YES | |
| `notes` | TEXT | YES | |
| `created_at` | TIMESTAMPTZ | YES | `now()` |
| `contact_person` | VARCHAR | YES | |
| `account_number` | VARCHAR | YES | |

Constraints:
- PK: `customer_id`

---

## Job System

### `jobs`
Core work orders.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `job_id` | UUID | NO | `uuid_generate_v4()` |
| `customer_id` | UUID | YES | |
| `title` | TEXT | NO | |
| `description` | TEXT | YES | |
| `priority` | TEXT | NO | |
| `status` | TEXT | NO | |
| `assigned_technician_id` | UUID | YES | |
| `assigned_technician_name` | TEXT | YES | |
| `created_at` | TIMESTAMPTZ | YES | `now()` |
| `scheduled_date` | TIMESTAMPTZ | YES | |
| `arrival_time` | TIMESTAMPTZ | YES | |
| `completion_time` | TIMESTAMPTZ | YES | |
| `notes` | JSONB | YES | `'[]'::jsonb` |
| `technician_signature` | JSONB | YES | |
| `customer_signature` | JSONB | YES | |
| `sla_hours` | INTEGER | YES | |
| `due_at` | TIMESTAMPTZ | YES | |
| `labour_amount` | NUMERIC | YES | `0` |
| `parts_amount` | NUMERIC | YES | `0` |
| `tax_amount` | NUMERIC | YES | `0` |
| `total_amount` | NUMERIC | YES | `0` |
| `quotation_status` | TEXT | YES | `'Draft'::text` |
| `labor_cost` | NUMERIC | YES | `150.00` |
| `invoiced_by_id` | UUID | YES | |
| `invoiced_by_name` | VARCHAR | YES | |
| `invoiced_at` | TIMESTAMPTZ | YES | |
| `invoice_sent_at` | TIMESTAMPTZ | YES | |
| `invoice_sent_via` | ARRAY | YES | |
| `forklift_id` | UUID | YES | |
| `hourmeter_reading` | INTEGER | YES | |
| `condition_checklist` | JSONB | YES | `'{}'::jsonb` |
| `job_carried_out` | TEXT | YES | |
| `recommendation` | TEXT | YES | |
| `repair_start_time` | TIMESTAMPTZ | YES | |
| `repair_end_time` | TIMESTAMPTZ | YES | |
| `service_report_number` | VARCHAR | YES | |
| `quotation_number` | VARCHAR | YES | |
| `quotation_date` | TIMESTAMPTZ | YES | |
| `quotation_validity` | VARCHAR | YES | |
| `delivery_term` | VARCHAR | YES | |
| `payment_term` | VARCHAR | YES | |
| `created_by_id` | UUID | YES | |
| `created_by_name` | VARCHAR | YES | |
| `started_at` | TIMESTAMPTZ | YES | |
| `started_by_id` | UUID | YES | |
| `started_by_name` | VARCHAR | YES | |
| `completed_at` | TIMESTAMPTZ | YES | |
| `completed_by_id` | UUID | YES | |
| `completed_by_name` | VARCHAR | YES | |
| `assigned_at` | TIMESTAMPTZ | YES | |
| `assigned_by_id` | UUID | YES | |
| `assigned_by_name` | VARCHAR | YES | |
| `job_type` | TEXT | YES | `'Service'::text` |
| `is_callback` | BOOLEAN | YES | `false` |
| `original_job_id` | UUID | YES | |
| `callback_reason` | TEXT | YES | |
| `reassigned_at` | TIMESTAMPTZ | YES | |
| `reassigned_by_id` | UUID | YES | |
| `reassigned_by_name` | VARCHAR | YES | |
| `branch_id` | UUID | YES | |
| `deleted_at` | TIMESTAMPTZ | YES | |
| `deleted_by` | UUID | YES | |
| `is_locked` | BOOLEAN | YES | `false` |
| `locked_at` | TIMESTAMPTZ | YES | |
| `locked_reason` | TEXT | YES | |
| `status_v2` | VARCHAR | YES | |
| `deleted_by_name` | TEXT | YES | |
| `deletion_reason` | TEXT | YES | |
| `hourmeter_before_delete` | INTEGER | YES | |
| `cutoff_time` | TIMESTAMPTZ | YES | | Multi-day: when tech marked to continue |
| `is_overtime` | BOOLEAN | YES | `false` | OT jobs don't escalate |
| `escalation_triggered_at` | TIMESTAMPTZ | YES | | When escalation notification sent |
| `verification_type` | TEXT | YES | `'signed_onsite'` | How completion was verified |
| `deferred_reason` | TEXT | YES | | Why customer couldn't sign |
| `evidence_photo_ids` | UUID[] | YES | | References to job_media |
| `customer_notified_at` | TIMESTAMPTZ | YES | | When customer was notified |
| `customer_response_deadline` | TIMESTAMPTZ | YES | | SLA deadline for response |
| `auto_completed_at` | TIMESTAMPTZ | YES | | When auto-completed |
| `dispute_notes` | TEXT | YES | | Customer's dispute reason |
| `disputed_at` | TIMESTAMPTZ | YES | | When disputed |
| `dispute_resolved_at` | TIMESTAMPTZ | YES | | When resolved |
| `dispute_resolution` | TEXT | YES | | Resolution notes |
| `helper_technician_id` | UUID | YES | | Denormalized: current active helper |
| `escalation_acknowledged_at` | TIMESTAMPTZ | YES | | When admin acknowledged escalation |
| `escalation_acknowledged_by` | UUID | YES | | Which admin acknowledged |
| `escalation_notes` | TEXT | YES | | Admin notes about escalation |
| `hourmeter_previous` | INTEGER | YES | | Previous hourmeter reading (for validation) |
| `hourmeter_flag_reasons` | TEXT[] | YES | | Reasons for flagging the reading |
| `hourmeter_flagged` | BOOLEAN | YES | `false` | Whether hourmeter reading was flagged |
| `hourmeter_amendment_id` | UUID | YES | | Reference to approved amendment |
| `hourmeter_validated_at` | TIMESTAMPTZ | YES | | When hourmeter was validated |
| `hourmeter_validated_by_id` | UUID | YES | | Who validated the hourmeter |
| `hourmeter_validated_by_name` | TEXT | YES | | Validator name |
| `checklist_completed` | BOOLEAN | YES | `false` | Whether mandatory checklist items are complete |
| `checklist_missing_items` | TEXT[] | YES | | List of unchecked mandatory items |
| `checklist_used_check_all` | BOOLEAN | YES | `false` | Whether "Check All" was used |
| `checklist_check_all_confirmed` | BOOLEAN | YES | `false` | Whether Check All was confirmed |
| `checklist_validated_at` | TIMESTAMPTZ | YES | | When checklist was validated |
| `checklist_validated_by_id` | UUID | YES | | Who validated checklist |
| `checklist_validated_by_name` | TEXT | YES | | Validator name |
| `parts_confirmed_by_id` | UUID | YES | | Admin 2 (Store) who confirmed parts |
| `parts_confirmed_by_name` | TEXT | YES | | Admin 2 name |
| `parts_confirmed_at` | TIMESTAMPTZ | YES | | When parts were confirmed |
| `parts_confirmation_notes` | TEXT | YES | | Notes for parts confirmation |
| `parts_confirmation_skipped` | BOOLEAN | YES | `false` | Auto-skipped if no parts used |
| `job_confirmed_by_id` | UUID | YES | | Admin 1 (Service) who confirmed job |
| `job_confirmed_by_name` | TEXT | YES | | Admin 1 name |
| `job_confirmed_at` | TIMESTAMPTZ | YES | | When job was confirmed |
| `job_confirmation_notes` | TEXT | YES | | Notes for job confirmation |
| `parts_escalated_at` | TIMESTAMPTZ | YES | | When escalated for parts confirm |
| `parts_escalated_to_id` | UUID | YES | | Supervisor escalated to |
| `parts_escalated_to_name` | TEXT | YES | | Supervisor name |
| `awaiting_parts` | BOOLEAN | YES | `false` | Whether job is waiting for parts |
| `awaiting_parts_since` | TIMESTAMPTZ | YES | | When parts wait started |
| `awaiting_parts_reason` | TEXT | YES | | Reason for waiting on parts |
| `autocount_export_id` | UUID | YES | | Reference to AutoCount export |
| `autocount_exported_at` | TIMESTAMPTZ | YES | | When exported to AutoCount |
| `first_hourmeter_recorded_by_id` | UUID | YES | | **(NEW 2026-01-19)** User who first recorded hourmeter |
| `first_hourmeter_recorded_by_name` | TEXT | YES | | **(NEW 2026-01-19)** Name of first recorder |
| `first_hourmeter_recorded_at` | TIMESTAMPTZ | YES | | **(NEW 2026-01-19)** When hourmeter was first recorded |

Constraints:
- PK: `job_id`

Foreign keys:
- `customer_id` -> `customers.customer_id`
- `forklift_id` -> `forklifts.forklift_id`
- `assigned_technician_id` -> `users.user_id`
- `created_by_id` -> `users.user_id`
- `started_by_id` -> `users.user_id`
- `assigned_by_id` -> `users.user_id`
- `completed_by_id` -> `users.user_id`
- `invoiced_by_id` -> `users.user_id`
- `deleted_by` -> `users.user_id`

---

### `job_assignments`
Tracks lead and assistant technician assignments per job (Helper Technician feature).

| Column | Type | Nullable | Default |
|--------|------|----------|--------|
| `assignment_id` | UUID | NO | `gen_random_uuid()` |
| `job_id` | UUID | NO | |
| `technician_id` | UUID | NO | |
| `assignment_type` | TEXT | NO | `'lead'` |
| `assigned_at` | TIMESTAMPTZ | NO | `now()` |
| `assigned_by` | UUID | YES | |
| `started_at` | TIMESTAMPTZ | YES | |
| `ended_at` | TIMESTAMPTZ | YES | |
| `is_active` | BOOLEAN | NO | `true` |
| `notes` | TEXT | YES | |
| `created_at` | TIMESTAMPTZ | NO | `now()` |
| `updated_at` | TIMESTAMPTZ | NO | `now()` |

Constraints:
- PK: `assignment_id`
- CHECK: `assignment_type` IN ('lead', 'assistant')
- UNIQUE: (`job_id`, `assignment_type`) WHERE `is_active = true`

Foreign keys:
- `job_id` -> `jobs.job_id` (CASCADE)
- `technician_id` -> `users.user_id` (CASCADE)
- `assigned_by` -> `users.user_id`

Indexes:
- `idx_job_assignments_job_id` on `job_id`
- `idx_job_assignments_technician_id` on `technician_id`
- `idx_job_assignments_active` on (`job_id`, `is_active`) WHERE `is_active = true`

RLS:
- Admin/Supervisor: ALL
- Technician: SELECT own assignments, UPDATE `started_at`/`ended_at`

---

### `job_requests`
In-job requests for assistance, spare parts, or skillful technician.

| Column | Type | Nullable | Default |
|--------|------|----------|--------|
| `request_id` | UUID | NO | `gen_random_uuid()` |
| `job_id` | UUID | NO | |
| `request_type` | TEXT | NO | |
| `requested_by` | UUID | NO | |
| `description` | TEXT | NO | |
| `photo_url` | TEXT | YES | |
| `status` | TEXT | NO | `'pending'` |
| `admin_response_notes` | TEXT | YES | |
| `admin_response_part_id` | UUID | YES | |
| `admin_response_quantity` | INTEGER | YES | |
| `responded_by` | UUID | YES | |
| `responded_at` | TIMESTAMPTZ | YES | |
| `created_at` | TIMESTAMPTZ | NO | `now()` |
| `updated_at` | TIMESTAMPTZ | NO | `now()` |

Constraints:
- PK: `request_id`
- CHECK: `request_type` IN ('assistance', 'spare_part', 'skillful_technician')
- CHECK: `status` IN ('pending', 'approved', 'rejected')

Foreign keys:
- `job_id` -> `jobs.job_id` (CASCADE)
- `requested_by` -> `users.user_id`
- `admin_response_part_id` -> `parts.part_id`
- `responded_by` -> `users.user_id`

Indexes:
- `idx_job_requests_job_id` on `job_id`
- `idx_job_requests_status` on `status`
- `idx_job_requests_type_status` on (`request_type`, `status`)
- `idx_job_requests_requested_by` on `requested_by`

RLS:
- Admin/Supervisor: ALL
- Technician: SELECT (own requests or assigned jobs), INSERT own requests
- **(NEW 2026-01-19)** Technician: UPDATE own pending requests only (`job_requests_tech_update` policy)

---

### `job_service_records`
Service record details for a job (1:1 with job).

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `service_record_id` | UUID | NO | `gen_random_uuid()` |
| `job_id` | UUID | NO | |
| `started_at` | TIMESTAMPTZ | YES | |
| `completed_at` | TIMESTAMPTZ | YES | |
| `repair_start_time` | TIMESTAMPTZ | YES | |
| `repair_end_time` | TIMESTAMPTZ | YES | |
| `checklist_data` | JSONB | YES | `'{}'::jsonb` |
| `service_notes` | TEXT | YES | |
| `job_carried_out` | TEXT | YES | |
| `recommendation` | TEXT | YES | |
| `hourmeter_reading` | INTEGER | YES | |
| `no_parts_used` | BOOLEAN | YES | `false` |
| `parts_summary` | JSONB | YES | `'[]'::jsonb` |
| `photos` | TEXT[] | YES | `'{}'::text[]` |
| `technician_signature` | JSONB | YES | |
| `technician_signature_at` | TIMESTAMPTZ | YES | |
| `customer_signature` | JSONB | YES | |
| `customer_signature_at` | TIMESTAMPTZ | YES | |
| `technician_id` | UUID | NO | |
| `created_at` | TIMESTAMPTZ | YES | `now()` |
| `updated_at` | TIMESTAMPTZ | YES | `now()` |
| `updated_by` | UUID | YES | |
| `locked_at` | TIMESTAMPTZ | YES | |
| `locked_by` | UUID | YES | |
| `lock_reason` | TEXT | YES | `'invoiced'::text` |

Constraints:
- PK: `service_record_id`
- UNIQUE: `job_id`

Foreign keys:
- `job_id` -> `jobs.job_id`
- `technician_id` -> `users.user_id`
- `updated_by` -> `users.user_id`
- `locked_by` -> `users.user_id`

---

### `job_parts`
Parts used in a job.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `job_part_id` | UUID | NO | `uuid_generate_v4()` |
| `job_id` | UUID | YES | |
| `part_id` | UUID | YES | |
| `part_name` | TEXT | NO | |
| `quantity` | INTEGER | NO | `1` |
| `sell_price_at_time` | NUMERIC | NO | |
| `created_at` | TIMESTAMPTZ | YES | `now()` |
| `install_date` | TIMESTAMPTZ | YES | `now()` |
| `warranty_end_date` | TIMESTAMPTZ | YES | |
| `from_van_stock` | BOOLEAN | YES | `false` | Whether part was taken from Van Stock |
| `van_stock_item_id` | UUID | YES | | Reference to van_stock_items |

Constraints:
- PK: `job_part_id`

Foreign keys:
- `job_id` -> `jobs.job_id`
- `part_id` -> `parts.part_id`
- `van_stock_item_id` -> `van_stock_items.item_id`

---

### `job_media`
Media attachments on jobs with GPS tracking and validation.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `media_id` | UUID | NO | `uuid_generate_v4()` |
| `job_id` | UUID | YES | |
| `type` | TEXT | NO | |
| `url` | TEXT | NO | |
| `description` | TEXT | YES | |
| `created_at` | TIMESTAMPTZ | YES | `now()` |
| `uploaded_by_id` | UUID | YES | |
| `uploaded_by_name` | TEXT | YES | |
| `category` | TEXT | NO | `'other'` |
| `is_helper_photo` | BOOLEAN | YES | `false` |
| `gps_latitude` | DECIMAL(10,8) | YES | | GPS latitude |
| `gps_longitude` | DECIMAL(11,8) | YES | | GPS longitude |
| `gps_accuracy` | DECIMAL(10,2) | YES | | GPS accuracy in meters |
| `gps_captured_at` | TIMESTAMPTZ | YES | | When GPS was captured |
| `device_timestamp` | TIMESTAMPTZ | YES | | Timestamp from device |
| `server_timestamp` | TIMESTAMPTZ | YES | `now()` | Timestamp from server |
| `timestamp_mismatch` | BOOLEAN | YES | `false` | Flag if timestamps differ |
| `timestamp_mismatch_minutes` | INTEGER | YES | | Difference in minutes |
| `source` | TEXT | YES | `'unknown'` | Photo source |
| `is_camera_fallback` | BOOLEAN | YES | `false` | Used gallery when camera failed |
| `fallback_description` | TEXT | YES | | Why camera wasn't used |
| `fallback_approved` | BOOLEAN | YES | | Admin approval status |
| `fallback_approved_by_id` | UUID | YES | | Who approved |
| `fallback_approved_by_name` | TEXT | YES | | Approver name |
| `fallback_approved_at` | TIMESTAMPTZ | YES | | When approved |
| `is_start_photo` | BOOLEAN | YES | `false` | Triggers job timer start |
| `is_end_photo` | BOOLEAN | YES | `false` | Triggers job timer end |
| `timer_triggered_at` | TIMESTAMPTZ | YES | | When timer was triggered |
| `job_day_number` | INTEGER | YES | `1` | Day number for multi-day jobs |
| `flagged_for_review` | BOOLEAN | YES | `false` | Needs admin review |
| `flagged_reason` | TEXT | YES | | Why flagged |
| `reviewed_by_id` | UUID | YES | | Admin who reviewed |
| `reviewed_by_name` | TEXT | YES | | Reviewer name |
| `reviewed_at` | TIMESTAMPTZ | YES | | When reviewed |
| `review_notes` | TEXT | YES | | Review notes |

Constraints:
- PK: `media_id`
- CHECK: `category` IN ('before', 'after', 'spare_part', 'condition', 'evidence', 'other')
- CHECK: `source` IN ('camera', 'gallery', 'unknown')

Foreign keys:
- `job_id` -> `jobs.job_id`
- `fallback_approved_by_id` -> `users.user_id`
- `reviewed_by_id` -> `users.user_id`

Indexes:
- `idx_job_media_job_category` on (`job_id`, `category`)
- `idx_job_media_gps` on (`gps_latitude`, `gps_longitude`) WHERE gps_latitude IS NOT NULL
- `idx_job_media_flagged` on (`flagged_for_review`) WHERE flagged_for_review = TRUE
- `idx_job_media_start_photo` on (`job_id`, `is_start_photo`) WHERE is_start_photo = TRUE
- `idx_job_media_end_photo` on (`job_id`, `is_end_photo`) WHERE is_end_photo = TRUE
- `idx_job_media_fallback_pending` on (`is_camera_fallback`, `fallback_approved`) WHERE is_camera_fallback = TRUE AND fallback_approved IS NULL

---

### `job_invoices`
Invoice data (1:1 with job).

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `invoice_id` | UUID | NO | `gen_random_uuid()` |
| `job_id` | UUID | NO | |
| `invoice_number` | VARCHAR | YES | |
| `invoice_date` | DATE | YES | |
| `due_date` | DATE | YES | |
| `service_report_number` | VARCHAR | YES | |
| `line_items` | JSONB | YES | `'[]'::jsonb` |
| `parts_total` | NUMERIC | YES | `0` |
| `labor_hours` | NUMERIC | YES | `0` |
| `labor_rate` | NUMERIC | YES | `0` |
| `labor_total` | NUMERIC | YES | `0` |
| `subtotal` | NUMERIC | YES | `0` |
| `tax_rate` | NUMERIC | YES | `0` |
| `tax_amount` | NUMERIC | YES | `0` |
| `discount_amount` | NUMERIC | YES | `0` |
| `discount_reason` | TEXT | YES | |
| `total` | NUMERIC | YES | `0` |
| `payment_status` | payment_status_enum | YES | `'pending'::payment_status_enum` |
| `amount_paid` | NUMERIC | YES | `0` |
| `payment_date` | DATE | YES | |
| `payment_method` | VARCHAR | YES | |
| `payment_reference` | VARCHAR | YES | |
| `payment_notes` | TEXT | YES | |
| `quotation_number` | VARCHAR | YES | |
| `quotation_date` | DATE | YES | |
| `quotation_validity` | VARCHAR | YES | |
| `delivery_term` | TEXT | YES | |
| `payment_term` | TEXT | YES | |
| `internal_notes` | TEXT | YES | |
| `prepared_by` | UUID | YES | |
| `prepared_by_name` | VARCHAR | YES | |
| `created_at` | TIMESTAMPTZ | YES | `now()` |
| `updated_at` | TIMESTAMPTZ | YES | `now()` |
| `updated_by` | UUID | YES | |
| `finalized_at` | TIMESTAMPTZ | YES | |
| `finalized_by` | UUID | YES | |
| `finalized_by_name` | VARCHAR | YES | |
| `sent_at` | TIMESTAMPTZ | YES | |
| `sent_via` | ARRAY | YES | |
| `sent_to` | ARRAY | YES | |
| `locked_at` | TIMESTAMPTZ | YES | |
| `locked_by` | UUID | YES | |

Constraints:
- PK: `invoice_id`
- UNIQUE: `job_id`

Foreign keys:
- `job_id` -> `jobs.job_id`
- `prepared_by` -> `users.user_id`
- `updated_by` -> `users.user_id`
- `finalized_by` -> `users.user_id`
- `locked_by` -> `users.user_id`

---

### `job_invoice_extra_charges`
Extra charges tied to invoices.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `charge_id` | UUID | NO | `gen_random_uuid()` |
| `invoice_id` | UUID | NO | |
| `job_id` | UUID | NO | |
| `description` | TEXT | NO | |
| `amount` | NUMERIC | NO | `0` |
| `quantity` | NUMERIC | YES | `1` |
| `unit_price` | NUMERIC | YES | |
| `is_approved` | BOOLEAN | YES | `false` |
| `approved_at` | TIMESTAMPTZ | YES | |
| `approved_by` | UUID | YES | |
| `created_at` | TIMESTAMPTZ | YES | `now()` |
| `created_by` | UUID | NO | |
| `created_by_name` | VARCHAR | YES | |
| `updated_at` | TIMESTAMPTZ | YES | `now()` |
| `updated_by` | UUID | YES | |

Constraints:
- PK: `charge_id`

Foreign keys:
- `invoice_id` -> `job_invoices.invoice_id`
- `job_id` -> `jobs.job_id`
- `created_by` -> `users.user_id`
- `approved_by` -> `users.user_id`
- `updated_by` -> `users.user_id`

---

### `extra_charges`
Legacy per-job extra charges.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `charge_id` | UUID | NO | `gen_random_uuid()` |
| `job_id` | UUID | NO | |
| `name` | VARCHAR | NO | |
| `description` | TEXT | YES | |
| `amount` | NUMERIC | NO | |
| `created_at` | TIMESTAMPTZ | YES | `now()` |

Constraints:
- PK: `charge_id`

Foreign keys:
- `job_id` -> `jobs.job_id`

---

### `job_inventory_usage`
Parts/stock usage at the job level.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `usage_id` | UUID | NO | `gen_random_uuid()` |
| `job_id` | UUID | NO | |
| `service_record_id` | UUID | YES | |
| `inventory_item_id` | UUID | NO | |
| `part_name` | VARCHAR | NO | |
| `part_code` | VARCHAR | YES | |
| `quantity_used` | NUMERIC | NO | `1` |
| `unit_price` | NUMERIC | NO | |
| `total_price` | NUMERIC | NO | |
| `stock_deducted` | BOOLEAN | YES | `false` |
| `deducted_at` | TIMESTAMPTZ | YES | |
| `deducted_by` | UUID | YES | |
| `recorded_by` | UUID | NO | |
| `recorded_by_name` | VARCHAR | YES | |
| `recorded_at` | TIMESTAMPTZ | YES | `now()` |
| `updated_at` | TIMESTAMPTZ | YES | `now()` |

Constraints:
- PK: `usage_id`

Foreign keys:
- `job_id` -> `jobs.job_id`
- `service_record_id` -> `job_service_records.service_record_id`
- `inventory_item_id` -> `parts.part_id`
- `recorded_by` -> `users.user_id`
- `deducted_by` -> `users.user_id`

---

### `job_status_history`
Audit trail for job status changes.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `history_id` | UUID | NO | `gen_random_uuid()` |
| `job_id` | UUID | NO | |
| `old_status` | VARCHAR | YES | |
| `new_status` | VARCHAR | NO | |
| `changed_by` | UUID | YES | |
| `changed_by_name` | VARCHAR | YES | |
| `changed_by_role` | VARCHAR | YES | |
| `reason` | TEXT | YES | |
| `is_rollback` | BOOLEAN | YES | `false` |
| `changed_at` | TIMESTAMPTZ | NO | `now()` |

Constraints:
- PK: `history_id`

Foreign keys:
- `job_id` -> `jobs.job_id`
- `changed_by` -> `users.user_id`

---

### `job_audit_log`
Detailed audit log.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `audit_id` | UUID | NO | `gen_random_uuid()` |
| `job_id` | UUID | NO | |
| `event_type` | audit_event_type | NO | |
| `event_description` | TEXT | YES | |
| `old_status` | VARCHAR | YES | |
| `new_status` | VARCHAR | YES | |
| `old_value` | JSONB | YES | |
| `new_value` | JSONB | YES | |
| `changed_fields` | ARRAY | YES | |
| `reason` | TEXT | YES | |
| `performed_by` | UUID | YES | |
| `performed_by_name` | VARCHAR | YES | |
| `performed_by_role` | VARCHAR | YES | |
| `performed_at` | TIMESTAMPTZ | NO | `now()` |
| `service_record_id` | UUID | YES | |
| `invoice_id` | UUID | YES | |

Constraints:
- PK: `audit_id`

Foreign keys:
- `job_id` -> `jobs.job_id`
- `performed_by` -> `users.user_id`
- `service_record_id` -> `job_service_records.service_record_id`
- `invoice_id` -> `job_invoices.invoice_id`

---

### `quotations`
Standalone quotation records.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `quotation_id` | UUID | NO | `gen_random_uuid()` |
| `quotation_number` | VARCHAR | NO | |
| `customer_id` | UUID | YES | |
| `forklift_id` | UUID | YES | |
| `date` | TIMESTAMPTZ | YES | `now()` |
| `attention` | VARCHAR | YES | |
| `reference` | TEXT | YES | |
| `items` | JSONB | YES | `'[]'::jsonb` |
| `sub_total` | NUMERIC | YES | `0` |
| `tax_rate` | NUMERIC | YES | `0` |
| `tax_amount` | NUMERIC | YES | `0` |
| `total` | NUMERIC | YES | `0` |
| `validity` | VARCHAR | YES | `'14 DAYS'::character varying` |
| `delivery_site` | TEXT | YES | |
| `delivery_term` | VARCHAR | YES | `'EX-STOCK'::character varying` |
| `payment_term` | VARCHAR | YES | `'UPON DELIVERY'::character varying` |
| `remark` | TEXT | YES | |
| `status` | VARCHAR | YES | `'draft'::character varying` |
| `created_by_id` | UUID | YES | |
| `created_by_name` | VARCHAR | YES | |
| `created_at` | TIMESTAMPTZ | YES | `now()` |
| `job_id` | UUID | YES | |

Constraints:
- PK: `quotation_id`
- UNIQUE: `quotation_number`

Foreign keys:
- `customer_id` -> `customers.customer_id`
- `forklift_id` -> `forklifts.forklift_id`
- `job_id` -> `jobs.job_id`
- `created_by_id` -> `users.user_id`

---

## Asset Management

### `forklifts`
Equipment records.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `forklift_id` | UUID | NO | `gen_random_uuid()` |
| `serial_number` | VARCHAR | NO | |
| `make` | VARCHAR | NO | |
| `model` | VARCHAR | NO | |
| `type` | VARCHAR | NO | `'Diesel'::character varying` |
| `hourmeter` | INTEGER | NO | `0` |
| `year` | INTEGER | YES | |
| `capacity_kg` | INTEGER | YES | |
| `location` | VARCHAR | YES | |
| `status` | VARCHAR | NO | `'Active'::character varying` |
| `last_service_date` | TIMESTAMPTZ | YES | |
| `next_service_due` | TIMESTAMPTZ | YES | |
| `notes` | TEXT | YES | |
| `created_at` | TIMESTAMPTZ | YES | `now()` |
| `updated_at` | TIMESTAMPTZ | YES | `now()` |
| `customer_id` | UUID | YES | |
| `forklift_no` | VARCHAR | YES | |
| `current_customer_id` | UUID | YES | |
| `next_service_type` | VARCHAR | YES | |
| `next_service_hourmeter` | INTEGER | YES | |
| `service_notes` | TEXT | YES | |
| `fuel_type` | VARCHAR | YES | `'diesel'::character varying` |
| `last_service_hourmeter` | INTEGER | YES | `0` |
| `last_service_job_id` | UUID | YES | |
| `service_interval_hours` | INTEGER | YES | |
| `avg_daily_usage` | NUMERIC | YES | `8.0` |
| `last_serviced_hourmeter` | INTEGER | YES | | Hourmeter when last Full Service completed |
| `next_target_service_hour` | INTEGER | YES | | Calculated: last_serviced + interval |
| `last_hourmeter_update` | TIMESTAMPTZ | YES | | For stale data detection (60+ days) |

Constraints:
- PK: `forklift_id`
- UNIQUE: `serial_number`

Foreign keys:
- `customer_id` -> `customers.customer_id`
- `current_customer_id` -> `customers.customer_id`
- `last_service_job_id` -> `jobs.job_id`

---

### `forklift_rentals`
Rental assignments for forklifts.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `rental_id` | UUID | NO | `gen_random_uuid()` |
| `forklift_id` | UUID | NO | |
| `customer_id` | UUID | NO | |
| `start_date` | DATE | NO | |
| `end_date` | DATE | YES | |
| `status` | VARCHAR | YES | `'active'::character varying` |
| `rental_location` | TEXT | YES | |
| `notes` | TEXT | YES | |
| `created_at` | TIMESTAMPTZ | YES | `now()` |
| `created_by_id` | UUID | YES | |
| `created_by_name` | TEXT | YES | |
| `updated_at` | TIMESTAMPTZ | YES | `now()` |
| `ended_at` | TIMESTAMPTZ | YES | |
| `ended_by_id` | UUID | YES | |
| `ended_by_name` | TEXT | YES | |
| `monthly_rental_rate` | NUMERIC | YES | `0` |
| `currency` | VARCHAR | YES | `'RM'::character varying` |
| `hourmeter_at_start` | INTEGER | YES | |
| `hourmeter_at_end` | INTEGER | YES | |

Constraints:
- PK: `rental_id`

Foreign keys:
- `forklift_id` -> `forklifts.forklift_id`
- `customer_id` -> `customers.customer_id`
- `created_by_id` -> `users.user_id`
- `ended_by_id` -> `users.user_id`

---

### `forklift_hourmeter_logs`
Hourmeter readings and history.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `log_id` | UUID | NO | `gen_random_uuid()` |
| `forklift_id` | UUID | NO | |
| `hourmeter_reading` | INTEGER | NO | |
| `previous_reading` | INTEGER | YES | |
| `recorded_at` | TIMESTAMPTZ | YES | `now()` |
| `recorded_by` | UUID | YES | |
| `recorded_by_name` | VARCHAR | YES | |
| `source` | VARCHAR | YES | `'manual'::character varying` |
| `job_id` | UUID | YES | |
| `rental_id` | UUID | YES | |
| `notes` | TEXT | YES | |
| `created_at` | TIMESTAMPTZ | YES | `now()` |

Constraints:
- PK: `log_id`

Foreign keys:
- `forklift_id` -> `forklifts.forklift_id`
- `job_id` -> `jobs.job_id`
- `rental_id` -> `forklift_rentals.rental_id`
- `recorded_by` -> `users.user_id`

---

### `scheduled_services`
Upcoming service events.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `scheduled_id` | UUID | NO | `gen_random_uuid()` |
| `forklift_id` | UUID | NO | |
| `service_interval_id` | UUID | YES | |
| `due_date` | DATE | NO | |
| `due_hourmeter` | INTEGER | YES | |
| `status` | VARCHAR | YES | `'pending'::character varying` |
| `assigned_technician_id` | UUID | YES | |
| `assigned_technician_name` | VARCHAR | YES | |
| `job_id` | UUID | YES | |
| `created_at` | TIMESTAMPTZ | YES | `now()` |
| `notes` | TEXT | YES | |

Constraints:
- PK: `scheduled_id`

Foreign keys:
- `forklift_id` -> `forklifts.forklift_id`
- `service_interval_id` -> `service_intervals.interval_id`
- `assigned_technician_id` -> `users.user_id`
- `job_id` -> `jobs.job_id`

---

### `service_intervals`
Service interval rules per forklift type. Electric uses calendar-based, Diesel/LPG use hourmeter-based.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `interval_id` | UUID | NO | `gen_random_uuid()` |
| `forklift_type` | VARCHAR | NO | |
| `service_type` | VARCHAR | NO | |
| `hourmeter_interval` | INTEGER | YES | | NULL for calendar-based (electric) |
| `calendar_interval_days` | INTEGER | YES | |
| `priority` | VARCHAR | YES | `'Medium'::character varying` |
| `checklist_items` | JSONB | YES | `'[]'::jsonb` |
| `estimated_duration_hours` | NUMERIC | YES | |
| `is_active` | BOOLEAN | YES | `true` |
| `created_at` | TIMESTAMPTZ | YES | `now()` |
| `name` | VARCHAR | YES | |

Constraints:
- PK: `interval_id`
- UNIQUE: `(forklift_type, service_type)`

Default intervals:
- Diesel Full Service: 500 hours
- LPG Full Service: 350 hours  
- Electric Full Service: 90 days (calendar-based)

---

### `service_upgrade_logs` (NEW 2026-02-05)
Audit trail for service upgrade decisions when technicians start minor service on overdue units.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `log_id` | UUID | NO | `gen_random_uuid()` |
| `forklift_id` | UUID | NO | |
| `job_id` | UUID | YES | |
| `original_service_type` | VARCHAR | NO | | e.g., 'Minor Service' |
| `suggested_service_type` | VARCHAR | NO | | e.g., 'Full Service' |
| `user_decision` | VARCHAR | NO | | 'upgraded', 'declined', 'deferred' |
| `hours_overdue` | INTEGER | YES | |
| `days_overdue` | INTEGER | YES | |
| `technician_id` | UUID | YES | |
| `created_at` | TIMESTAMPTZ | YES | `now()` |
| `notes` | TEXT | YES | |

Constraints:
- PK: `log_id`

---

### `service_predictions`
Predicted service due calculations.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `prediction_id` | UUID | NO | `gen_random_uuid()` |
| `forklift_id` | UUID | NO | |
| `rental_id` | UUID | YES | |
| `current_hourmeter` | INTEGER | NO | |
| `next_service_hourmeter` | INTEGER | NO | |
| `hours_until_service` | INTEGER | NO | |
| `avg_daily_usage` | NUMERIC | YES | |
| `days_until_service` | INTEGER | YES | |
| `predicted_service_date` | DATE | YES | |
| `is_overdue` | BOOLEAN | YES | `false` |
| `job_created` | BOOLEAN | YES | `false` |
| `job_id` | UUID | YES | |
| `job_created_at` | TIMESTAMPTZ | YES | |
| `notified_7_days` | BOOLEAN | YES | `false` |
| `notified_7_days_at` | TIMESTAMPTZ | YES | |
| `notified_3_days` | BOOLEAN | YES | `false` |
| `notified_3_days_at` | TIMESTAMPTZ | YES | |
| `notified_overdue` | BOOLEAN | YES | `false` |
| `notified_overdue_at` | TIMESTAMPTZ | YES | |
| `calculated_at` | TIMESTAMPTZ | YES | `now()` |
| `created_at` | TIMESTAMPTZ | YES | `now()` |
| `updated_at` | TIMESTAMPTZ | YES | `now()` |

Constraints:
- PK: `prediction_id`

Foreign keys:
- `forklift_id` -> `forklifts.forklift_id`
- `rental_id` -> `forklift_rentals.rental_id`
- `job_id` -> `jobs.job_id`

---

## Hourmeter Tracking

### `hourmeter_history`
Audit trail for all hourmeter readings and changes.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `entry_id` | UUID | NO | `gen_random_uuid()` |
| `forklift_id` | UUID | NO | |
| `job_id` | UUID | YES | |
| `reading` | INTEGER | NO | |
| `previous_reading` | INTEGER | YES | |
| `hours_since_last` | INTEGER | YES | |
| `flag_reasons` | TEXT[] | YES | |
| `was_amended` | BOOLEAN | YES | `false` |
| `amendment_id` | UUID | YES | |
| `recorded_by_id` | UUID | NO | |
| `recorded_by_name` | TEXT | NO | |
| `recorded_at` | TIMESTAMPTZ | NO | `now()` |
| `source` | TEXT | NO | | `'job_start'`, `'job_end'`, `'amendment'`, `'audit'`, `'manual'` |

Constraints:
- PK: `entry_id`
- CHECK: `source` IN ('job_start', 'job_end', 'amendment', 'audit', 'manual')

Foreign keys:
- `forklift_id` -> `forklifts.forklift_id` (CASCADE)
- `job_id` -> `jobs.job_id`
- `amendment_id` -> `hourmeter_amendments.amendment_id`
- `recorded_by_id` -> `users.user_id`

Indexes:
- `idx_hourmeter_history_forklift` on (`forklift_id`, `recorded_at` DESC)

---

### `hourmeter_amendments`
Amendment requests for flagged hourmeter readings.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `amendment_id` | UUID | NO | `gen_random_uuid()` |
| `job_id` | UUID | NO | |
| `forklift_id` | UUID | NO | |
| `original_reading` | INTEGER | NO | |
| `amended_reading` | INTEGER | NO | |
| `reason` | TEXT | NO | |
| `flag_reasons` | TEXT[] | YES | |
| `requested_by_id` | UUID | NO | |
| `requested_by_name` | TEXT | NO | |
| `requested_at` | TIMESTAMPTZ | NO | `now()` |
| `status` | TEXT | NO | `'pending'` |
| `reviewed_by_id` | UUID | YES | |
| `reviewed_by_name` | TEXT | YES | |
| `reviewed_at` | TIMESTAMPTZ | YES | |
| `review_notes` | TEXT | YES | |
| `created_at` | TIMESTAMPTZ | NO | `now()` |
| `updated_at` | TIMESTAMPTZ | NO | `now()` |

Constraints:
- PK: `amendment_id`
- CHECK: `status` IN ('pending', 'approved', 'rejected')

Foreign keys:
- `job_id` -> `jobs.job_id` (CASCADE)
- `forklift_id` -> `forklifts.forklift_id`
- `requested_by_id` -> `users.user_id`
- `reviewed_by_id` -> `users.user_id`

Indexes:
- `idx_hourmeter_amendments_job` on `job_id`
- `idx_hourmeter_amendments_forklift` on `forklift_id`
- `idx_hourmeter_amendments_status` on `status` WHERE status = 'pending'

RLS:
- Admin/Supervisor: ALL
- Technician: INSERT (own requests), SELECT (own requests)
- Accountant: SELECT (for audit)

---

### `hourmeter_validation_configs`
Configuration for hourmeter validation rules.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `config_id` | UUID | NO | `gen_random_uuid()` |
| `warning_threshold_hours` | INTEGER | YES | `100` |
| `alert_threshold_hours` | INTEGER | YES | `500` |
| `lower_reading_action` | TEXT | YES | `'flag'` |
| `expected_daily_usage_hours` | INTEGER | YES | `8` |
| `usage_variance_tolerance` | INTEGER | YES | `50` |
| `require_approval_for_all` | BOOLEAN | YES | `false` |
| `auto_approve_minor_corrections` | BOOLEAN | YES | `true` |
| `minor_correction_threshold` | INTEGER | YES | `2` |
| `is_active` | BOOLEAN | YES | `true` |
| `updated_at` | TIMESTAMPTZ | YES | `now()` |
| `updated_by_id` | UUID | YES | |
| `updated_by_name` | TEXT | YES | |

Constraints:
- PK: `config_id`
- CHECK: `lower_reading_action` IN ('flag', 'block', 'allow')

Foreign keys:
- `updated_by_id` -> `users.user_id`

---

## Van Stock System

### `van_stocks`
Technician Van Stock assignment (one per technician).

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `van_stock_id` | UUID | NO | `gen_random_uuid()` |
| `technician_id` | UUID | NO | |
| `van_code` | TEXT | YES | | Unique van identifier |
| `notes` | TEXT | YES | |
| `max_items` | INTEGER | YES | `50` |
| `is_active` | BOOLEAN | YES | `true` |
| `created_at` | TIMESTAMPTZ | NO | `now()` |
| `created_by_id` | UUID | YES | |
| `created_by_name` | TEXT | YES | |
| `updated_at` | TIMESTAMPTZ | NO | `now()` |
| `last_audit_at` | TIMESTAMPTZ | YES | |
| `next_audit_due` | TIMESTAMPTZ | YES | |

Constraints:
- PK: `van_stock_id`
- UNIQUE: `technician_id`
- UNIQUE: `van_code`

Foreign keys:
- `technician_id` -> `users.user_id` (CASCADE)
- `created_by_id` -> `users.user_id`

Indexes:
- `idx_van_stocks_technician` on `technician_id`

---

### `van_stock_items`
Items in a technician's Van Stock.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `item_id` | UUID | NO | `gen_random_uuid()` |
| `van_stock_id` | UUID | NO | |
| `part_id` | UUID | NO | |
| `quantity` | INTEGER | NO | `0` |
| `min_quantity` | INTEGER | NO | `1` |
| `max_quantity` | INTEGER | NO | `5` |
| `last_replenished_at` | TIMESTAMPTZ | YES | |
| `last_used_at` | TIMESTAMPTZ | YES | |
| `is_core_item` | BOOLEAN | YES | `true` |
| `created_at` | TIMESTAMPTZ | NO | `now()` |
| `updated_at` | TIMESTAMPTZ | NO | `now()` |

Constraints:
- PK: `item_id`
- UNIQUE: (`van_stock_id`, `part_id`)

Foreign keys:
- `van_stock_id` -> `van_stocks.van_stock_id` (CASCADE)
- `part_id` -> `parts.part_id`

Indexes:
- `idx_van_stock_items_van_stock` on `van_stock_id`
- `idx_van_stock_items_part` on `part_id`
- `idx_van_stock_items_low_stock` on (`van_stock_id`, `quantity`) WHERE quantity < min_quantity

---

### `van_stock_usage`
Usage records for Van Stock items on jobs.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `usage_id` | UUID | NO | `gen_random_uuid()` |
| `van_stock_item_id` | UUID | NO | |
| `job_id` | UUID | NO | |
| `job_part_id` | UUID | YES | |
| `quantity_used` | INTEGER | NO | |
| `used_at` | TIMESTAMPTZ | NO | `now()` |
| `used_by_id` | UUID | NO | |
| `used_by_name` | TEXT | NO | |
| `requires_approval` | BOOLEAN | YES | `false` | For customer-owned forklifts |
| `approved_by_id` | UUID | YES | |
| `approved_by_name` | TEXT | YES | |
| `approved_at` | TIMESTAMPTZ | YES | |
| `approval_status` | TEXT | YES | `'approved'` |
| `rejection_reason` | TEXT | YES | |

Constraints:
- PK: `usage_id`
- CHECK: `approval_status` IN ('pending', 'approved', 'rejected')

Foreign keys:
- `van_stock_item_id` -> `van_stock_items.item_id`
- `job_id` -> `jobs.job_id`
- `job_part_id` -> `job_parts.job_part_id`
- `used_by_id` -> `users.user_id`
- `approved_by_id` -> `users.user_id`

Indexes:
- `idx_van_stock_usage_job` on `job_id`
- `idx_van_stock_usage_pending` on `approval_status` WHERE approval_status = 'pending'

---

### `van_stock_replenishments`
Replenishment requests for Van Stock.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `replenishment_id` | UUID | NO | `gen_random_uuid()` |
| `van_stock_id` | UUID | NO | |
| `technician_id` | UUID | NO | |
| `status` | TEXT | NO | `'pending'` |
| `request_type` | TEXT | NO | | `'manual'`, `'auto_slot_in'`, `'low_stock'` |
| `triggered_by_job_id` | UUID | YES | |
| `requested_at` | TIMESTAMPTZ | NO | `now()` |
| `requested_by_id` | UUID | YES | |
| `requested_by_name` | TEXT | YES | |
| `approved_by_id` | UUID | YES | | Admin 2 (Store) approval |
| `approved_by_name` | TEXT | YES | |
| `approved_at` | TIMESTAMPTZ | YES | |
| `fulfilled_at` | TIMESTAMPTZ | YES | |
| `fulfilled_by_id` | UUID | YES | |
| `fulfilled_by_name` | TEXT | YES | |
| `confirmed_by_technician` | BOOLEAN | YES | `false` |
| `confirmed_at` | TIMESTAMPTZ | YES | |
| `confirmation_photo_url` | TEXT | YES | |
| `notes` | TEXT | YES | |
| `created_at` | TIMESTAMPTZ | NO | `now()` |
| `updated_at` | TIMESTAMPTZ | NO | `now()` |

Constraints:
- PK: `replenishment_id`
- CHECK: `status` IN ('pending', 'approved', 'in_progress', 'completed', 'cancelled')
- CHECK: `request_type` IN ('manual', 'auto_slot_in', 'low_stock')

Foreign keys:
- `van_stock_id` -> `van_stocks.van_stock_id`
- `technician_id` -> `users.user_id`
- `triggered_by_job_id` -> `jobs.job_id`
- `requested_by_id` -> `users.user_id`
- `approved_by_id` -> `users.user_id`
- `fulfilled_by_id` -> `users.user_id`

Indexes:
- `idx_van_stock_replenishments_status` on `status`
- `idx_van_stock_replenishments_pending` on (`status`, `requested_at`) WHERE status = 'pending'

---

### `van_stock_replenishment_items`
Items in a replenishment request.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `item_id` | UUID | NO | `gen_random_uuid()` |
| `replenishment_id` | UUID | NO | |
| `van_stock_item_id` | UUID | NO | |
| `part_id` | UUID | NO | |
| `part_name` | TEXT | NO | |
| `part_code` | TEXT | NO | |
| `quantity_requested` | INTEGER | NO | |
| `quantity_issued` | INTEGER | YES | `0` |
| `serial_numbers` | JSONB | YES | `'[]'::jsonb` |
| `is_rejected` | BOOLEAN | YES | `false` |
| `rejection_reason` | TEXT | YES | |

Constraints:
- PK: `item_id`

Foreign keys:
- `replenishment_id` -> `van_stock_replenishments.replenishment_id` (CASCADE)
- `van_stock_item_id` -> `van_stock_items.item_id`
- `part_id` -> `parts.part_id`

---

### `van_stock_audits`
Quarterly audit records for Van Stock.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `audit_id` | UUID | NO | `gen_random_uuid()` |
| `van_stock_id` | UUID | NO | |
| `technician_id` | UUID | NO | |
| `scheduled_date` | DATE | NO | |
| `status` | TEXT | NO | `'scheduled'` |
| `started_at` | TIMESTAMPTZ | YES | |
| `completed_at` | TIMESTAMPTZ | YES | |
| `audited_by_id` | UUID | YES | |
| `audited_by_name` | TEXT | YES | |
| `total_expected_value` | DECIMAL(10,2) | YES | `0` |
| `total_actual_value` | DECIMAL(10,2) | YES | `0` |
| `discrepancy_value` | DECIMAL(10,2) | YES | `0` |
| `discrepancy_notes` | TEXT | YES | |
| `resolution_notes` | TEXT | YES | |
| `resolved_at` | TIMESTAMPTZ | YES | |
| `resolved_by_id` | UUID | YES | |
| `resolved_by_name` | TEXT | YES | |
| `created_at` | TIMESTAMPTZ | NO | `now()` |
| `updated_at` | TIMESTAMPTZ | NO | `now()` |

Constraints:
- PK: `audit_id`
- CHECK: `status` IN ('scheduled', 'in_progress', 'completed', 'discrepancy_found')

Foreign keys:
- `van_stock_id` -> `van_stocks.van_stock_id`
- `technician_id` -> `users.user_id`
- `audited_by_id` -> `users.user_id`
- `resolved_by_id` -> `users.user_id`

Indexes:
- `idx_van_stock_audits_scheduled` on (`scheduled_date`, `status`)

---

### `van_stock_audit_items`
Items in an audit with expected vs actual counts.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `audit_item_id` | UUID | NO | `gen_random_uuid()` |
| `audit_id` | UUID | NO | |
| `van_stock_item_id` | UUID | NO | |
| `part_id` | UUID | NO | |
| `part_name` | TEXT | NO | |
| `expected_quantity` | INTEGER | NO | |
| `actual_quantity` | INTEGER | NO | |
| `discrepancy` | INTEGER | | | GENERATED ALWAYS AS (actual_quantity - expected_quantity) STORED |
| `notes` | TEXT | YES | |

Constraints:
- PK: `audit_item_id`

Foreign keys:
- `audit_id` -> `van_stock_audits.audit_id` (CASCADE)
- `van_stock_item_id` -> `van_stock_items.item_id`
- `part_id` -> `parts.part_id`

---

## Inventory

### `parts`
Inventory master.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `part_id` | UUID | NO | `uuid_generate_v4()` |
| `part_name` | TEXT | NO | |
| `part_code` | TEXT | NO | |
| `category` | TEXT | YES | |
| `cost_price` | NUMERIC | NO | |
| `sell_price` | NUMERIC | NO | |
| `warranty_months` | INTEGER | YES | `0` |
| `stock_quantity` | INTEGER | YES | `0` |
| `created_at` | TIMESTAMPTZ | YES | `now()` |
| `last_updated_by` | UUID | YES | |
| `last_updated_by_name` | VARCHAR | YES | |
| `updated_at` | TIMESTAMPTZ | YES | `now()` |
| `min_stock_level` | INTEGER | YES | `10` |
| `supplier` | VARCHAR | YES | |
| `location` | VARCHAR | YES | |

Constraints:
- PK: `part_id`
- UNIQUE: `part_code`

Foreign keys:
- `last_updated_by` -> `users.user_id`

---

## HR System

> **Architecture Change (2026-01-03):** The `employees` table has been merged into `users`. All employee/HR data is now stored directly in the `users` table. HR-related tables (`employee_leaves`, `employee_licenses`, `employee_permits`, etc.) now reference `users.user_id` directly.

### `employees` ❌ DEPRECATED
~~HR profile for a user.~~

**This table has been merged into `users`.** All HR fields are now columns on the `users` table. See the `users` table definition in Core Tables.

Foreign key references that previously pointed to `employees.user_id` now point to `users.user_id`.

---

### `leave_types`
Leave categories.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `leave_type_id` | UUID | NO | `gen_random_uuid()` |
| `name` | VARCHAR | NO | |
| `description` | TEXT | YES | |
| `is_paid` | BOOLEAN | YES | `true` |
| `requires_approval` | BOOLEAN | YES | `true` |
| `requires_document` | BOOLEAN | YES | `false` |
| `max_days_per_year` | INTEGER | YES | |
| `color` | VARCHAR | YES | `'#3B82F6'::character varying` |
| `is_active` | BOOLEAN | YES | `true` |
| `created_at` | TIMESTAMPTZ | YES | `now()` |

Constraints:
- PK: `leave_type_id`
- UNIQUE: `name`

---

### `employee_leave_balances`
Yearly leave balances.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `balance_id` | UUID | NO | `gen_random_uuid()` |
| `user_id` | UUID | NO | |
| `leave_type_id` | UUID | NO | |
| `year` | INTEGER | NO | |
| `entitled_days` | NUMERIC | YES | `0` |
| `used_days` | NUMERIC | YES | `0` |
| `pending_days` | NUMERIC | YES | `0` |
| `carried_forward` | NUMERIC | YES | `0` |
| `created_at` | TIMESTAMPTZ | YES | `now()` |
| `updated_at` | TIMESTAMPTZ | YES | `now()` |

Constraints:
- PK: `balance_id`
- UNIQUE: (`user_id`, `leave_type_id`, `year`)

Foreign keys:
- `user_id` -> `users.user_id`
- `leave_type_id` -> `leave_types.leave_type_id`

---

### `employee_leaves`
Leave requests.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `leave_id` | UUID | NO | `gen_random_uuid()` |
| `user_id` | UUID | NO | |
| `leave_type_id` | UUID | NO | |
| `start_date` | DATE | NO | |
| `end_date` | DATE | NO | |
| `total_days` | NUMERIC | NO | `1` |
| `is_half_day` | BOOLEAN | YES | `false` |
| `half_day_type` | VARCHAR | YES | |
| `reason` | TEXT | YES | |
| `supporting_document_url` | TEXT | YES | |
| `status` | VARCHAR | YES | `'pending'::character varying` |
| `requested_at` | TIMESTAMPTZ | YES | `now()` |
| `requested_by_user_id` | UUID | YES | |
| `approved_at` | TIMESTAMPTZ | YES | |
| `approved_by_id` | UUID | YES | |
| `approved_by_name` | VARCHAR | YES | |
| `approved_by_user_id` | UUID | YES | |
| `rejected_at` | TIMESTAMPTZ | YES | |
| `rejected_by_id` | UUID | YES | |
| `rejected_by_name` | VARCHAR | YES | |
| `rejected_by_user_id` | UUID | YES | |
| `rejection_reason` | TEXT | YES | |
| `created_at` | TIMESTAMPTZ | YES | `now()` |
| `updated_at` | TIMESTAMPTZ | YES | `now()` |
| `notes` | TEXT | YES | |

Constraints:
- PK: `leave_id`

Foreign keys:
- `user_id` -> `users.user_id`
- `leave_type_id` -> `leave_types.leave_type_id`
- `requested_by_user_id` -> `users.user_id`
- `approved_by_user_id` -> `users.user_id`
- `rejected_by_user_id` -> `users.user_id`

---

### `employee_licenses`
License records.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `license_id` | UUID | NO | `gen_random_uuid()` |
| `user_id` | UUID | NO | |
| `license_type` | VARCHAR | NO | |
| `license_number` | VARCHAR | NO | |
| `issuing_authority` | VARCHAR | YES | |
| `issue_date` | DATE | YES | |
| `expiry_date` | DATE | NO | |
| `license_front_image_url` | TEXT | YES | |
| `license_back_image_url` | TEXT | YES | |
| `status` | VARCHAR | YES | `'active'::character varying` |
| `alert_days_before` | INTEGER | YES | `30` |
| `last_alert_sent_at` | TIMESTAMPTZ | YES | |
| `created_at` | TIMESTAMPTZ | YES | `now()` |
| `updated_at` | TIMESTAMPTZ | YES | `now()` |
| `created_by_id` | UUID | YES | |
| `created_by_name` | VARCHAR | YES | |
| `verified_at` | TIMESTAMPTZ | YES | |
| `verified_by_id` | UUID | YES | |
| `verified_by_name` | VARCHAR | YES | |
| `notes` | TEXT | YES | |

Constraints:
- PK: `license_id`

Foreign keys:
- `user_id` -> `users.user_id`

---

### `employee_permits`
Permit records.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `permit_id` | UUID | NO | `gen_random_uuid()` |
| `user_id` | UUID | NO | |
| `permit_type` | VARCHAR | NO | |
| `permit_number` | VARCHAR | NO | |
| `permit_name` | VARCHAR | YES | |
| `issuing_authority` | VARCHAR | YES | |
| `issue_date` | DATE | YES | |
| `expiry_date` | DATE | NO | |
| `restricted_areas` | ARRAY | YES | |
| `permit_document_url` | TEXT | YES | |
| `status` | VARCHAR | YES | `'active'::character varying` |
| `alert_days_before` | INTEGER | YES | `30` |
| `last_alert_sent_at` | TIMESTAMPTZ | YES | |
| `created_at` | TIMESTAMPTZ | YES | `now()` |
| `updated_at` | TIMESTAMPTZ | YES | `now()` |
| `created_by_id` | UUID | YES | |
| `created_by_name` | VARCHAR | YES | |
| `verified_at` | TIMESTAMPTZ | YES | |
| `verified_by_id` | UUID | YES | |
| `verified_by_name` | VARCHAR | YES | |
| `notes` | TEXT | YES | |

Constraints:
- PK: `permit_id`

Foreign keys:
- `user_id` -> `users.user_id`

---

### `hr_alerts`
HR alerts for licenses, permits, leave, etc.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `alert_id` | UUID | NO | `gen_random_uuid()` |
| `alert_type` | VARCHAR | NO | |
| `user_id` | UUID | YES | |
| `license_id` | UUID | YES | |
| `permit_id` | UUID | YES | |
| `leave_id` | UUID | YES | |
| `title` | VARCHAR | NO | |
| `message` | TEXT | NO | |
| `severity` | VARCHAR | YES | `'warning'::character varying` |
| `recipient_ids` | ARRAY | NO | |
| `is_read` | BOOLEAN | YES | `false` |
| `read_at` | TIMESTAMPTZ | YES | |
| `read_by_id` | UUID | YES | |
| `scheduled_for` | TIMESTAMPTZ | NO | |
| `sent_at` | TIMESTAMPTZ | YES | |
| `created_at` | TIMESTAMPTZ | YES | `now()` |
| `expires_at` | TIMESTAMPTZ | YES | |

Constraints:
- PK: `alert_id`

Foreign keys:
- `user_id` -> `users.user_id`
- `license_id` -> `employee_licenses.license_id`
- `permit_id` -> `employee_permits.permit_id`
- `leave_id` -> `employee_leaves.leave_id`

---

## Notifications and KPI

### `notifications`
User notifications.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `notification_id` | UUID | NO | `gen_random_uuid()` |
| `user_id` | UUID | NO | |
| `type` | VARCHAR | NO | |
| `title` | VARCHAR | NO | |
| `message` | TEXT | NO | |
| `reference_type` | VARCHAR | YES | |
| `reference_id` | UUID | YES | |
| `is_read` | BOOLEAN | YES | `false` |
| `priority` | VARCHAR | YES | `'normal'::character varying` |
| `created_at` | TIMESTAMPTZ | YES | `now()` |
| `read_at` | TIMESTAMPTZ | YES | |
| `expires_at` | TIMESTAMPTZ | YES | |

Constraints:
- PK: `notification_id`

Foreign keys:
- `user_id` -> `users.user_id`

---

### `technician_kpi_snapshots`
Snapshot KPIs for technicians.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `snapshot_id` | UUID | NO | `gen_random_uuid()` |
| `technician_id` | UUID | NO | |
| `period_start` | DATE | NO | |
| `period_end` | DATE | NO | |
| `total_jobs_assigned` | INTEGER | YES | `0` |
| `total_jobs_completed` | INTEGER | YES | `0` |
| `completion_rate` | NUMERIC | YES | `0` |
| `avg_response_time` | NUMERIC | YES | `0` |
| `avg_completion_time` | NUMERIC | YES | `0` |
| `avg_repair_time` | NUMERIC | YES | `0` |
| `total_hours_worked` | NUMERIC | YES | `0` |
| `first_time_fix_rate` | NUMERIC | YES | `0` |
| `mean_time_to_repair` | NUMERIC | YES | `0` |
| `technician_utilization` | NUMERIC | YES | `0` |
| `jobs_per_day` | NUMERIC | YES | `0` |
| `repeat_visit_count` | INTEGER | YES | `0` |
| `customer_satisfaction_avg` | NUMERIC | YES | |
| `total_revenue_generated` | NUMERIC | YES | `0` |
| `avg_job_value` | NUMERIC | YES | `0` |
| `total_parts_value` | NUMERIC | YES | `0` |
| `emergency_jobs` | INTEGER | YES | `0` |
| `high_priority_jobs` | INTEGER | YES | `0` |
| `medium_priority_jobs` | INTEGER | YES | `0` |
| `low_priority_jobs` | INTEGER | YES | `0` |
| `service_jobs` | INTEGER | YES | `0` |
| `repair_jobs` | INTEGER | YES | `0` |
| `checking_jobs` | INTEGER | YES | `0` |
| `accident_jobs` | INTEGER | YES | `0` |
| `created_at` | TIMESTAMPTZ | YES | `now()` |

Constraints:
- PK: `snapshot_id`

Foreign keys:
- `technician_id` -> `users.user_id`

---

## System Settings

### `public_holidays`
Malaysian public holidays for business day calculations.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `holiday_id` | UUID | NO | `gen_random_uuid()` |
| `holiday_date` | DATE | NO | |
| `name` | TEXT | NO | |
| `year` | INTEGER | YES | Generated from holiday_date |
| `created_at` | TIMESTAMPTZ | YES | `now()` |

Constraints:
- PK: `holiday_id`
- UNIQUE: `holiday_date`

Indexes:
- `idx_public_holidays_date` on `holiday_date`
- `idx_public_holidays_year` on `year`

RLS:
- All authenticated users: SELECT
- Admin only: INSERT, UPDATE, DELETE

---

### `app_settings`
Application-wide configuration settings.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `setting_id` | UUID | NO | `gen_random_uuid()` |
| `key` | TEXT | NO | |
| `value` | TEXT | NO | |
| `description` | TEXT | YES | |
| `updated_at` | TIMESTAMPTZ | YES | `now()` |
| `updated_by` | UUID | YES | |

Constraints:
- PK: `setting_id`
- UNIQUE: `key`

Foreign keys:
- `updated_by` -> `users.user_id`

RLS:
- All authenticated users: SELECT
- Admin only: UPDATE

Default settings:
- `deferred_ack_sla_days` = '5' (business days for customer acknowledgement)

---

### `customer_acknowledgements`
Customer acknowledgement records for deferred job completion (#8).

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `ack_id` | UUID | NO | `gen_random_uuid()` |
| `job_id` | UUID | NO | |
| `customer_id` | UUID | NO | |
| `status` | TEXT | NO | `'pending'` |
| `access_token` | TEXT | YES | Generated |
| `token_expires_at` | TIMESTAMPTZ | YES | |
| `responded_at` | TIMESTAMPTZ | YES | |
| `response_method` | TEXT | YES | |
| `response_notes` | TEXT | YES | |
| `customer_signature` | TEXT | YES | |
| `signed_at` | TIMESTAMPTZ | YES | |
| `created_at` | TIMESTAMPTZ | YES | `now()` |
| `updated_at` | TIMESTAMPTZ | YES | `now()` |

Constraints:
- PK: `ack_id`
- UNIQUE: `access_token`
- CHECK: `status` IN ('pending', 'acknowledged', 'disputed', 'auto_completed')
- CHECK: `response_method` IN ('portal', 'email', 'phone', 'auto')

Foreign keys:
- `job_id` -> `jobs.job_id` (CASCADE)
- `customer_id` -> `customers.customer_id`

Indexes:
- `idx_customer_acks_job` on `job_id`
- `idx_customer_acks_token` on `access_token`
- `idx_customer_acks_status` on `status`
- `idx_customer_acks_pending` on `job_id` WHERE status = 'pending'

RLS:
- All authenticated users: SELECT
- Admin/Supervisor: ALL
- Technician: INSERT only

---

## AutoCount Integration

Tables for integrating with AutoCount accounting software.

### `autocount_exports`
Invoice export records to AutoCount.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `export_id` | UUID | NO | `gen_random_uuid()` |
| `job_id` | UUID | NO | |
| `export_type` | TEXT | NO | `'invoice'` |
| `autocount_invoice_number` | TEXT | YES | |
| `status` | TEXT | NO | `'pending'` |
| `customer_code` | TEXT | YES | |
| `customer_name` | TEXT | NO | |
| `invoice_date` | DATE | NO | |
| `due_date` | DATE | YES | |
| `total_amount` | DECIMAL(12,2) | NO | |
| `tax_amount` | DECIMAL(12,2) | YES | `0` |
| `currency` | TEXT | NO | `'MYR'` |
| `line_items` | JSONB | NO | `'[]'::jsonb` |
| `exported_at` | TIMESTAMPTZ | YES | |
| `exported_by_id` | UUID | YES | |
| `exported_by_name` | TEXT | YES | |
| `export_error` | TEXT | YES | |
| `retry_count` | INTEGER | NO | `0` |
| `last_retry_at` | TIMESTAMPTZ | YES | |
| `created_at` | TIMESTAMPTZ | NO | `now()` |
| `updated_at` | TIMESTAMPTZ | NO | `now()` |

Constraints:
- PK: `export_id`
- CHECK: `export_type` IN ('invoice', 'credit_note')
- CHECK: `status` IN ('pending', 'exported', 'failed', 'cancelled')

Foreign keys:
- `job_id` -> `jobs.job_id` (CASCADE)
- `exported_by_id` -> `users.user_id`

Indexes:
- `idx_autocount_exports_job` on `job_id`
- `idx_autocount_exports_status` on `status` WHERE status IN ('pending', 'failed')

---

### `autocount_customer_mappings`
Maps FieldPro customers to AutoCount customer codes.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `mapping_id` | UUID | NO | `gen_random_uuid()` |
| `customer_id` | UUID | NO | |
| `autocount_customer_code` | TEXT | NO | |
| `autocount_customer_name` | TEXT | YES | |
| `is_active` | BOOLEAN | NO | `true` |
| `last_synced_at` | TIMESTAMPTZ | YES | |
| `created_at` | TIMESTAMPTZ | NO | `now()` |
| `updated_at` | TIMESTAMPTZ | NO | `now()` |

Constraints:
- PK: `mapping_id`
- UNIQUE: `customer_id`

Foreign keys:
- `customer_id` -> `customers.customer_id` (CASCADE)

Indexes:
- `idx_autocount_customer_mappings_code` on `autocount_customer_code`

---

### `autocount_item_mappings`
Maps FieldPro parts to AutoCount item codes.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `mapping_id` | UUID | NO | `gen_random_uuid()` |
| `part_id` | UUID | NO | |
| `autocount_item_code` | TEXT | NO | |
| `autocount_item_name` | TEXT | YES | |
| `is_active` | BOOLEAN | NO | `true` |
| `last_synced_at` | TIMESTAMPTZ | YES | |
| `created_at` | TIMESTAMPTZ | NO | `now()` |
| `updated_at` | TIMESTAMPTZ | NO | `now()` |

Constraints:
- PK: `mapping_id`
- UNIQUE: `part_id`

Foreign keys:
- `part_id` -> `parts.part_id` (CASCADE)

Indexes:
- `idx_autocount_item_mappings_code` on `autocount_item_code`

---

### `autocount_settings`
AutoCount integration configuration.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `setting_id` | UUID | NO | `gen_random_uuid()` |
| `is_enabled` | BOOLEAN | NO | `false` |
| `api_endpoint` | TEXT | YES | |
| `company_code` | TEXT | YES | |
| `default_tax_code` | TEXT | YES | |
| `default_currency` | TEXT | NO | `'MYR'` |
| `auto_export_on_finalize` | BOOLEAN | NO | `false` |
| `labor_item_code` | TEXT | YES | |
| `extra_charge_item_code` | TEXT | YES | |
| `updated_at` | TIMESTAMPTZ | NO | `now()` |
| `updated_by_id` | UUID | YES | |
| `updated_by_name` | TEXT | YES | |

Constraints:
- PK: `setting_id`

Foreign keys:
- `updated_by_id` -> `users.user_id`

---

## Duration Alerts

Tables for tracking job duration thresholds and alerts.

### `duration_alert_configs`
Configuration for job duration warning and alert thresholds per job type.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `config_id` | UUID | NO | `gen_random_uuid()` |
| `job_type` | TEXT | NO | |
| `warning_threshold_hours` | DECIMAL(4,2) | NO | |
| `alert_threshold_hours` | DECIMAL(4,2) | NO | |
| `notify_supervisor` | BOOLEAN | YES | `true` |
| `notify_admin` | BOOLEAN | YES | `true` |
| `is_active` | BOOLEAN | YES | `true` |
| `created_at` | TIMESTAMPTZ | YES | `now()` |
| `updated_at` | TIMESTAMPTZ | YES | `now()` |

Constraints:
- PK: `config_id`
- UNIQUE: `job_type`

Default values:
| Job Type | Warning (hrs) | Alert (hrs) | Supervisor | Admin |
|----------|---------------|-------------|------------|-------|
| Service | 2.5 | 3 | Yes | Yes |
| Repair | 4 | 5 | Yes | Yes |
| Slot-In | 4 | 5 | Yes | Yes |
| Checking | 1.5 | 2 | Yes | No |
| Courier | 1 | 1.5 | No | No |

---

### `job_duration_alerts`
Tracks sent duration alerts for jobs.

| Column | Type | Nullable | Default |
|--------|------|----------|---------|
| `alert_id` | UUID | NO | `gen_random_uuid()` |
| `job_id` | UUID | NO | |
| `alert_type` | TEXT | NO | |
| `threshold_hours` | DECIMAL(4,2) | NO | |
| `actual_hours` | DECIMAL(6,2) | NO | |
| `sent_at` | TIMESTAMPTZ | NO | `now()` |
| `sent_to_ids` | UUID[] | NO | |
| `acknowledged_at` | TIMESTAMPTZ | YES | |
| `acknowledged_by_id` | UUID | YES | |
| `notes` | TEXT | YES | |

Constraints:
- PK: `alert_id`
- CHECK: `alert_type` IN ('warning', 'exceeded')

Foreign keys:
- `job_id` -> `jobs.job_id` (CASCADE)
- `acknowledged_by_id` -> `users.user_id`

Indexes:
- `idx_job_duration_alerts_job` on `job_id`

---

## Views

### `active_rentals_view`
Active rentals with customer and forklift data.

Columns:
- `rental_id` UUID
- `forklift_id` UUID
- `customer_id` UUID
- `start_date` DATE
- `end_date` DATE
- `status` VARCHAR
- `rental_location` TEXT
- `notes` TEXT
- `created_at` TIMESTAMPTZ
- `serial_number` VARCHAR
- `make` VARCHAR
- `model` VARCHAR
- `forklift_type` VARCHAR
- `hourmeter` INTEGER
- `customer_name` TEXT
- `customer_address` TEXT
- `customer_phone` TEXT

---

### `v_expiring_licenses`
Expiring licenses view.

Columns:
- `license_id` UUID
- `user_id` UUID
- `license_type` VARCHAR
- `license_number` VARCHAR
- `issuing_authority` VARCHAR
- `issue_date` DATE
- `expiry_date` DATE
- `license_front_image_url` TEXT
- `license_back_image_url` TEXT
- `status` VARCHAR
- `alert_days_before` INTEGER
- `last_alert_sent_at` TIMESTAMPTZ
- `created_at` TIMESTAMPTZ
- `updated_at` TIMESTAMPTZ
- `created_by_id` UUID
- `created_by_name` VARCHAR
- `verified_at` TIMESTAMPTZ
- `verified_by_id` UUID
- `verified_by_name` VARCHAR
- `notes` TEXT
- `full_name` VARCHAR
- `phone` VARCHAR
- `department` VARCHAR
- `employee_code` VARCHAR
- `days_until_expiry` INTEGER

---

### `v_expiring_permits`
Expiring permits view.

Columns:
- `permit_id` UUID
- `user_id` UUID
- `permit_type` VARCHAR
- `permit_number` VARCHAR
- `permit_name` VARCHAR
- `issuing_authority` VARCHAR
- `issue_date` DATE
- `expiry_date` DATE
- `restricted_areas` ARRAY
- `permit_document_url` TEXT
- `status` VARCHAR
- `alert_days_before` INTEGER
- `last_alert_sent_at` TIMESTAMPTZ
- `created_at` TIMESTAMPTZ
- `updated_at` TIMESTAMPTZ
- `created_by_id` UUID
- `created_by_name` VARCHAR
- `verified_at` TIMESTAMPTZ
- `verified_by_id` UUID
- `verified_by_name` VARCHAR
- `notes` TEXT
- `full_name` VARCHAR
- `phone` VARCHAR
- `department` VARCHAR
- `employee_code` VARCHAR
- `days_until_expiry` INTEGER

---

### `v_pending_leaves`
Pending leave requests view.

Columns:
- `leave_id` UUID
- `user_id` UUID
- `leave_type_id` UUID
- `start_date` DATE
- `end_date` DATE
- `total_days` NUMERIC
- `is_half_day` BOOLEAN
- `half_day_type` VARCHAR
- `reason` TEXT
- `supporting_document_url` TEXT
- `status` VARCHAR
- `requested_at` TIMESTAMPTZ
- `requested_by_user_id` UUID
- `approved_at` TIMESTAMPTZ
- `approved_by_id` UUID
- `approved_by_name` VARCHAR
- `approved_by_user_id` UUID
- `rejected_at` TIMESTAMPTZ
- `rejected_by_id` UUID
- `rejected_by_name` VARCHAR
- `rejected_by_user_id` UUID
- `rejection_reason` TEXT
- `created_at` TIMESTAMPTZ
- `updated_at` TIMESTAMPTZ
- `notes` TEXT
- `full_name` VARCHAR
- `department` VARCHAR
- `employee_code` VARCHAR
- `leave_type_name` VARCHAR

---

### `v_todays_leave`
Leaves for today view.

Columns:
- `leave_id` UUID
- `user_id` UUID
- `leave_type_id` UUID
- `start_date` DATE
- `end_date` DATE
- `total_days` NUMERIC
- `is_half_day` BOOLEAN
- `half_day_type` VARCHAR
- `reason` TEXT
- `supporting_document_url` TEXT
- `status` VARCHAR
- `requested_at` TIMESTAMPTZ
- `requested_by_user_id` UUID
- `approved_at` TIMESTAMPTZ
- `approved_by_id` UUID
- `approved_by_name` VARCHAR
- `approved_by_user_id` UUID
- `rejected_at` TIMESTAMPTZ
- `rejected_by_id` UUID
- `rejected_by_name` VARCHAR
- `rejected_by_user_id` UUID
- `rejection_reason` TEXT
- `created_at` TIMESTAMPTZ
- `updated_at` TIMESTAMPTZ
- `notes` TEXT
- `full_name` VARCHAR
- `department` VARCHAR
- `employee_code` VARCHAR
- `leave_type_name` VARCHAR
- `leave_type_color` VARCHAR

---

### `pending_hourmeter_amendments`
Pending hourmeter amendment requests awaiting review.

Columns:
- `amendment_id` UUID
- `job_id` UUID
- `job_title` TEXT
- `forklift_id` UUID
- `forklift_serial` VARCHAR
- `forklift_make` VARCHAR
- `forklift_model` VARCHAR
- `original_reading` INTEGER
- `amended_reading` INTEGER
- `difference` INTEGER (amended - original)
- `reason` TEXT
- `flag_reasons` TEXT[]
- `requested_by_name` TEXT
- `requested_at` TIMESTAMPTZ
- `hours_pending` NUMERIC

---

### `flagged_hourmeter_readings`
Jobs with flagged hourmeter readings that need amendment.

Columns:
- `job_id` UUID
- `title` TEXT
- `status` TEXT
- `assigned_technician_name` TEXT
- `forklift_serial` VARCHAR
- `hourmeter_reading` INTEGER
- `hourmeter_previous` INTEGER
- `hours_difference` INTEGER
- `hourmeter_flag_reasons` TEXT[]
- `created_at` TIMESTAMPTZ

---

### `van_stock_summary`
Summary view of Van Stock by technician.

Columns:
- `van_stock_id` UUID
- `technician_id` UUID
- `technician_name` TEXT
- `is_active` BOOLEAN
- `last_audit_at` TIMESTAMPTZ
- `next_audit_due` TIMESTAMPTZ
- `total_items` INTEGER
- `low_stock_items` INTEGER
- `total_value` NUMERIC
- `pending_replenishments` INTEGER

---

### `pending_van_stock_approvals`
Parts used from Van Stock on customer-owned forklifts awaiting approval.

Columns:
- `usage_id` UUID
- `job_id` UUID
- `job_title` TEXT
- `customer_name` TEXT
- `forklift_serial` VARCHAR
- `forklift_ownership` VARCHAR
- `part_name` TEXT
- `part_code` TEXT
- `quantity_used` INTEGER
- `used_at` TIMESTAMPTZ
- `used_by_name` TEXT
- `technician_name` TEXT

---

### `fleet_dashboard_summary`
Aggregated fleet status metrics for dashboard.

Columns:
- `total_fleet_count` BIGINT
- `available_count` BIGINT
- `rented_out_count` BIGINT
- `in_service_count` BIGINT
- `service_due_count` BIGINT
- `awaiting_parts_count` BIGINT
- `out_of_service_count` BIGINT
- `reserved_count` BIGINT
- `service_due_this_week` BIGINT

---

### `jobs_monthly_summary`
Monthly job completion metrics.

Columns:
- `month` TIMESTAMPTZ
- `jobs_completed` BIGINT
- `avg_duration_hours` NUMERIC

---

### `most_active_forklifts`
Top 10 most serviced forklifts in last 30 days.

Columns:
- `forklift_id` UUID
- `serial_number` VARCHAR
- `make` VARCHAR
- `model` VARCHAR
- `job_count` BIGINT
- `total_hours` NUMERIC

---

### `flagged_photos`
Photos flagged for admin review (GPS missing, timestamp mismatch, etc.).

Columns:
- `media_id` UUID
- `job_id` UUID
- `job_title` TEXT
- `assigned_technician_name` TEXT
- `customer_name` TEXT
- `url` TEXT
- `category` TEXT
- `flagged_reason` TEXT
- `timestamp_mismatch` BOOLEAN
- `timestamp_mismatch_minutes` INTEGER
- `gps_latitude` DECIMAL
- `gps_longitude` DECIMAL
- `source` TEXT
- `is_camera_fallback` BOOLEAN
- `fallback_description` TEXT
- `created_at` TIMESTAMPTZ
- `reviewed_at` TIMESTAMPTZ
- `reviewed_by_name` TEXT

---

### `pending_camera_fallbacks`
Photos taken using gallery (camera fallback) pending admin approval.

Columns:
- `media_id` UUID
- `job_id` UUID
- `job_title` TEXT
- `assigned_technician_name` TEXT
- `fallback_description` TEXT
- `created_at` TIMESTAMPTZ
- `uploaded_by_name` TEXT

---

### `pending_parts_confirmations`
Jobs awaiting Admin 2 (Store) parts confirmation.

Columns:
- `job_id` UUID
- `title` TEXT
- `status` TEXT
- `created_at` TIMESTAMPTZ
- `completed_at` TIMESTAMPTZ
- `assigned_technician_name` TEXT
- `customer_name` TEXT
- `forklift_serial` VARCHAR
- `total_parts_used` BIGINT
- `hours_since_completion` NUMERIC
- `needs_escalation` BOOLEAN

---

### `pending_autocount_exports`
AutoCount export records pending or failed.

Columns:
- `export_id` UUID
- `job_id` UUID
- `job_title` TEXT
- `service_report_number` VARCHAR
- `customer_name` TEXT
- `customer_code` TEXT
- `total_amount` DECIMAL
- `status` TEXT
- `retry_count` INTEGER
- `export_error` TEXT
- `created_at` TIMESTAMPTZ
- `updated_at` TIMESTAMPTZ

---

### `autocount_export_history`
Complete AutoCount export history.

Columns:
- `export_id` UUID
- `job_id` UUID
- `job_title` TEXT
- `service_report_number` VARCHAR
- `autocount_invoice_number` TEXT
- `customer_name` TEXT
- `total_amount` DECIMAL
- `status` TEXT
- `exported_at` TIMESTAMPTZ
- `exported_by_name` TEXT
- `export_error` TEXT

---

### `fleet_service_overview` (NEW 2026-02-05)
Comprehensive view for the Fleet > Service Due tab with computed service metrics.

Columns:
- `forklift_id` UUID
- `serial_number` VARCHAR
- `make` VARCHAR
- `model` VARCHAR
- `type` VARCHAR
- `current_hourmeter` INTEGER — Current reading from forklifts.hourmeter
- `last_serviced_hourmeter` INTEGER — Reading when last Full Service completed
- `next_target_service_hour` INTEGER — Calculated target
- `hours_remaining` INTEGER — Computed: next_target - current
- `hours_overdue` INTEGER — If negative hours_remaining, shows positive overdue amount
- `last_service_date` TIMESTAMPTZ
- `days_since_service` INTEGER
- `last_hourmeter_update` TIMESTAMPTZ
- `is_stale_data` BOOLEAN — TRUE if no hourmeter update in 60+ days
- `service_urgency` VARCHAR — 'overdue', 'due_soon', 'ok'
- `current_customer_id` UUID
- `customer_name` TEXT

---

### `v_forklift_service_predictions` (NEW 2026-02-05)
Alternative service prediction view with urgency classification.

Columns:
- `forklift_id` UUID
- `serial_number` VARCHAR
- `make` VARCHAR
- `model` VARCHAR
- `type` VARCHAR
- `hourmeter` INTEGER
- `next_target_service_hour` INTEGER
- `hours_remaining` INTEGER
- `days_remaining` INTEGER — Estimated based on avg daily usage
- `service_urgency` VARCHAR — 'overdue', 'due_soon', 'ok'
- `has_open_job` BOOLEAN

---

## Enums

### `audit_event_type`
`job_created`, `job_assigned`, `job_reassigned`, `status_changed`, `status_rollback`, `service_record_created`,
`service_record_updated`, `signature_captured`, `invoice_created`, `invoice_finalized`, `invoice_updated`,
`payment_received`, `admin_override`, `inventory_deducted`, `extra_charge_added`, `extra_charge_removed`,
`job_cancelled`, `lock_overridden`, `signature_added`, `record_locked`

### `job_status_enum`
`draft`, `assigned`, `in_progress`, `completed`, `invoiced`, `paid`, `cancelled`

### `payment_status`
`pending`, `partial`, `paid`, `overdue`, `refunded`

### `payment_status_enum`
`pending`, `partial`, `paid`, `overdue`, `cancelled`

### `user_role_enum`
`admin`, `admin_service`, `admin_store`, `supervisor`, `accountant`, `technician`

> **Note:** As of 2026-01-15, admin roles can be split:
> - `admin` - Full system access (acts as both service and store admin)
> - `admin_service` - Job operations, hourmeter approval, job confirmations
> - `admin_store` - Inventory, van stock, parts confirmation

---

## Functions

### Helper Functions

#### `get_current_user_role()`
Returns the role of the currently authenticated user.

| Returns | Description |
|---------|-------------|
| TEXT | Role name (`admin`, `supervisor`, `accountant`, `technician`) |

---

#### `has_role(required_role TEXT)`
Checks if the current user has the specified role.

| Parameter | Type | Description |
|-----------|------|-------------|
| `required_role` | TEXT | Role to check |

| Returns | Description |
|---------|-------------|
| BOOLEAN | True if user has the role |

---

#### `has_any_role(required_roles TEXT[])`
Checks if the current user has any of the specified roles.

| Parameter | Type | Description |
|-----------|------|-------------|
| `required_roles` | TEXT[] | Array of roles to check |

| Returns | Description |
|---------|-------------|
| BOOLEAN | True if user has any of the roles |

---

#### `is_admin_or_supervisor()`
Checks if the current user is an admin or supervisor.

| Returns | Description |
|---------|-------------|
| BOOLEAN | True if admin or supervisor |

---

#### `is_assigned_to_job(job_id_param UUID)`
Checks if the current user is assigned to the specified job.

| Parameter | Type | Description |
|-----------|------|-------------|
| `job_id_param` | UUID | Job to check |

| Returns | Description |
|---------|-------------|
| BOOLEAN | True if assigned |

---

#### `get_status_order(status_val TEXT)`
Returns numeric order for job status comparison.

| Parameter | Type | Description |
|-----------|------|-------------|
| `status_val` | TEXT | Status value |

| Returns | Description |
|---------|-------------|
| INTEGER | 0=New, 1=Assigned, 2=In Progress, 3=Awaiting Finalization, 4=Completed |

---

#### `is_forward_transition(old_status TEXT, new_status TEXT)`
Checks if status transition is moving forward in workflow.

| Returns | Description |
|---------|-------------|
| BOOLEAN | True if new status is ahead of old |

---

#### `is_backward_transition(old_status TEXT, new_status TEXT)`
Checks if status transition is moving backward in workflow.

| Returns | Description |
|---------|-------------|
| BOOLEAN | True if new status is behind old |

---

### RPC Functions (Callable from App)

#### `start_job(p_job_id UUID)`
Technician starts working on an assigned job. Moves status from `Assigned` → `In Progress`.

| Parameter | Type | Description |
|-----------|------|-------------|
| `p_job_id` | UUID | Job to start |

| Returns | Description |
|---------|-------------|
| JSONB | `{success, message, job_id, new_status}` or `{success: false, error}` |

Permissions: Assigned technician, admin, supervisor

---

#### `complete_job(p_job_id UUID, p_force BOOLEAN DEFAULT FALSE)`
Technician submits job for finalization. Moves status from `In Progress` → `Awaiting Finalization`.

| Parameter | Type | Description |
|-----------|------|-------------|
| `p_job_id` | UUID | Job to complete |
| `p_force` | BOOLEAN | Admin can bypass validation |

| Returns | Description |
|---------|-------------|
| JSONB | `{success, message, job_id, new_status}` or `{success: false, error, missing_fields}` |

Validations:
- Service record exists with `started_at`
- Checklist filled
- Service notes or job carried out description
- Parts recorded or marked `no_parts_used`
- Technician signature
- Customer signature

---

#### `finalize_invoice(p_job_id UUID, p_invoice_number TEXT DEFAULT NULL)`
Accountant finalizes the invoice. Moves status from `Awaiting Finalization` → `Completed`.

| Parameter | Type | Description |
|-----------|------|-------------|
| `p_job_id` | UUID | Job to finalize |
| `p_invoice_number` | TEXT | Optional custom invoice number |

| Returns | Description |
|---------|-------------|
| JSONB | `{success, message, job_id, invoice_id, invoice_number, new_status}` |

Permissions: Accountant, Admin

---

#### `admin_override_lock(p_job_id UUID, p_reason TEXT, p_action TEXT DEFAULT 'unlock')`
Admin can unlock records with a reason.

| Parameter | Type | Description |
|-----------|------|-------------|
| `p_job_id` | UUID | Job to override |
| `p_reason` | TEXT | Required reason for override |
| `p_action` | TEXT | `unlock`, `rollback_status`, `edit_service`, `edit_invoice` |

| Returns | Description |
|---------|-------------|
| JSONB | `{success, message, job_id, action, reason}` |

Permissions: Admin only

---

#### `cancel_job(p_job_id UUID, p_reason TEXT)`
Cancel a job in New/Assigned status (soft delete).

| Parameter | Type | Description |
|-----------|------|-------------|
| `p_job_id` | UUID | Job to cancel |
| `p_reason` | TEXT | Required cancellation reason |

| Returns | Description |
|---------|-------------|
| JSONB | `{success, message, job_id, reason}` |

Permissions: Admin, Supervisor

---

#### `record_payment(p_job_id UUID, p_amount DECIMAL, p_payment_method TEXT, p_reference TEXT, p_notes TEXT)`
Record payment against an invoice.

| Parameter | Type | Description |
|-----------|------|-------------|
| `p_job_id` | UUID | Job with invoice |
| `p_amount` | DECIMAL | Payment amount |
| `p_payment_method` | TEXT | `cash`, `transfer`, etc. |
| `p_reference` | TEXT | Optional reference number |
| `p_notes` | TEXT | Optional payment notes |

| Returns | Description |
|---------|-------------|
| JSONB | `{success, message, job_id, amount, total_paid, payment_status}` |

Permissions: Accountant, Admin

---

### Service Automation Functions

#### `get_forklifts_due_for_service(p_days_ahead INTEGER DEFAULT 7)`
Get all forklifts due for service within specified days.

| Parameter | Type | Description |
|-----------|------|-------------|
| `p_days_ahead` | INTEGER | Days to look ahead |

Returns table with columns:
- `forklift_id`, `serial_number`, `make`, `model`, `type`
- `hourmeter`, `next_service_due`, `next_service_hourmeter`
- `current_customer_id`
- `days_until_due`, `hours_until_due`
- `is_overdue`, `has_open_job`

---

#### `auto_create_service_jobs(p_days_ahead INTEGER DEFAULT 7, p_created_by_name VARCHAR DEFAULT 'System')`
Auto-create service jobs for forklifts due for service.

| Parameter | Type | Description |
|-----------|------|-------------|
| `p_days_ahead` | INTEGER | Days to look ahead |
| `p_created_by_name` | VARCHAR | Creator name for audit |

Returns table with columns:
- `forklift_serial`, `job_id`, `action`, `message`

---

#### `create_service_due_notifications(p_days_ahead INTEGER DEFAULT 7)`
Create notifications for admins/supervisors about upcoming services.

| Parameter | Type | Description |
|-----------|------|-------------|
| `p_days_ahead` | INTEGER | Days to look ahead |

| Returns | Description |
|---------|-------------|
| INTEGER | Number of notifications created |

---

#### `daily_service_check()`
Daily automation job that creates notifications and auto-creates service jobs.

Returns table with columns:
- `check_type` (`notifications`, `jobs_created`)
- `count`
- `details`

Scheduled via pg_cron at 8:00 AM MYT daily.

---

### Trigger Functions

| Function | Trigger | Description |
|----------|---------|-------------|
| `validate_job_status_transition()` | `trg_validate_status_transition` ON jobs | Enforces sequential workflow and role-based status transitions |
| `validate_job_completion_requirements()` | `trg_validate_completion` ON jobs | Ensures all required fields before job completion |
| `lock_service_record_on_invoice()` | `trg_lock_on_invoice` ON jobs | Locks service records when job is invoiced |
| `prevent_locked_service_record_edit()` | `trg_prevent_locked_edit` ON job_service_records | Prevents unauthorized edits to locked records |
| `deduct_inventory_on_completion()` | `trg_deduct_inventory` ON jobs | Deducts parts from inventory on job completion |
| `log_job_changes()` | `trg_audit_job_changes` ON jobs | Creates audit trail for job changes |
| `log_service_record_changes()` | `trg_audit_service_record` ON job_service_records | Logs signature/lock events |
| `log_invoice_changes()` | `trg_audit_invoice` ON job_invoices | Logs invoice creation/finalization/payment |
| `auto_create_service_record()` | `trg_auto_service_record` ON jobs | Auto-creates service record on job assignment |
| `track_status_history()` | `trg_track_status_history` ON jobs | Tracks job status changes over time |
| `validate_hourmeter_reading()` | `trigger_validate_hourmeter` ON jobs | Validates hourmeter readings and flags suspicious values |
| `update_forklift_hourmeter()` | `trigger_update_forklift_hourmeter` ON jobs | Updates forklift hourmeter and records history on job changes |
| `validate_job_checklist()` | `trigger_validate_checklist` ON jobs | Validates mandatory checklist items before completion |
| `audit_direct_hourmeter_update()` | `trigger_audit_direct_hourmeter_update` ON forklifts | Audits direct hourmeter edits to forklifts |
| `trigger_slot_in_replenishment()` | `trigger_slot_in_van_stock_replenishment` ON jobs | Auto-creates Van Stock replenishment on Slot-In job completion |
| `deduct_van_stock()` | `trigger_deduct_van_stock` ON job_parts | Deducts from Van Stock when parts are used from van |
| `check_parts_confirmed_before_job_complete()` | `enforce_parts_confirmation` ON jobs | **(NEW 2026-01-19)** Blocks job finalization until parts are confirmed by Admin Store |

---

### Hourmeter Functions

#### `apply_hourmeter_amendment(p_amendment_id UUID, p_approved_by_id UUID, p_approved_by_name TEXT, p_approve BOOLEAN, p_notes TEXT DEFAULT NULL)`
Apply or reject a hourmeter amendment request.

| Parameter | Type | Description |
|-----------|------|-------------|
| `p_amendment_id` | UUID | Amendment to process |
| `p_approved_by_id` | UUID | Approver's user ID |
| `p_approved_by_name` | TEXT | Approver's name |
| `p_approve` | BOOLEAN | True to approve, false to reject |
| `p_notes` | TEXT | Optional review notes |

| Returns | Description |
|---------|-------------|
| BOOLEAN | True if successful |

Permissions: Admin (Service), Supervisor

---

#### `get_forklift_daily_usage(p_forklift_id UUID, p_days INTEGER DEFAULT 14)` (NEW 2026-02-05)
Calculate average daily hourmeter usage and trend for a forklift.

| Parameter | Type | Description |
|-----------|------|-------------|
| `p_forklift_id` | UUID | Forklift to analyze |
| `p_days` | INTEGER | Days of history to analyze (default 14) |

| Returns | Type | Description |
|---------|------|-------------|
| `avg_daily_hours` | NUMERIC | Average hours per day |
| `usage_trend` | TEXT | 'increasing', 'decreasing', 'stable', or 'insufficient_data' |
| `reading_count` | INTEGER | Number of readings in period |

---

#### `complete_full_service(p_forklift_id UUID, p_hourmeter INTEGER, p_job_id UUID DEFAULT NULL)` (NEW 2026-02-05)
Record completion of a Full Service job, resetting the service baseline.

| Parameter | Type | Description |
|-----------|------|-------------|
| `p_forklift_id` | UUID | Forklift serviced |
| `p_hourmeter` | INTEGER | Current hourmeter reading |
| `p_job_id` | UUID | Optional job ID for audit |

Updates:
- Sets `last_serviced_hourmeter` to current reading
- Recalculates `next_target_service_hour` based on service interval
- Updates `last_service_date` to NOW()

---

### Van Stock Functions

#### `schedule_quarterly_audits()`
Schedule quarterly Van Stock audits for all active technicians.

| Returns | Description |
|---------|-------------|
| INTEGER | Number of audits scheduled |

---

### Admin Role Functions

#### `is_admin_type(user_role TEXT, admin_type TEXT)`
Check if a user role matches an admin type.

| Parameter | Type | Description |
|-----------|------|-------------|
| `user_role` | TEXT | User's current role |
| `admin_type` | TEXT | `'service'` or `'store'` |

| Returns | Description |
|---------|-------------|
| BOOLEAN | True if role matches admin type |

Notes:
- `admin` role returns true for both types
- `admin_service` returns true only for `'service'`
- `admin_store` returns true only for `'store'`

---

#### `check_parts_confirmation_needed()`
Trigger function to auto-skip parts confirmation if no parts used.

Called on: `jobs` UPDATE (when status changes to 'Awaiting Finalization')

---

#### `escalate_pending_confirmations()`
Escalate jobs pending parts confirmation for >24 hours.

| Returns | Description |
|---------|-------------|
| INTEGER | Number of jobs escalated |

---

### Photo & Timer Functions

#### `validate_photo_timestamp()`
Trigger function to validate photo timestamp against server time.

Called on: `job_media` INSERT

Behavior:
- Calculates difference between device and server timestamp
- Flags photos with mismatch > tolerance (default 5 minutes)
- Sets `flagged_for_review` and `flagged_reason`

---

#### `validate_photo_gps()`
Trigger function to validate GPS coordinates on photos.

Called on: `job_media` INSERT

Behavior:
- Checks if GPS is required (from app_settings)
- Flags photos missing GPS coordinates

---

#### `photo_trigger_timer()`
Trigger function to auto-start/stop job timer based on photos.

Called on: `job_media` INSERT

Behavior:
- Start photo (is_start_photo=true, category='before'): Sets `jobs.started_at` and `repair_start_time`
- End photo (is_end_photo=true, category='after'): Sets `jobs.repair_end_time`

---

#### `check_job_duration_alerts()`
Check all in-progress jobs for duration threshold violations.

| Returns | Description |
|---------|-------------|
| INTEGER | Number of alerts sent |

Behavior:
- Checks jobs against `duration_alert_configs`
- Creates records in `job_duration_alerts`
- Notifies supervisors and admins based on config

---

### Fleet Dashboard Functions

#### `update_forklift_status_from_job()`
Trigger function to auto-update forklift status based on job status.

Called on: `jobs` UPDATE (status, awaiting_parts)

Behavior:
- Job starts: Forklift -> 'In Service'
- Job awaiting parts: Forklift -> 'Awaiting Parts'
- Job completes: Forklift -> 'Available' or 'Service Due'

---

#### `get_fleet_dashboard_metrics()`
Get aggregated fleet metrics for dashboard.

| Returns | Description |
|---------|-------------|
| JSONB | Fleet metrics object |

Returns:
```json
{
  "total_fleet_count": 50,
  "units_by_status": {
    "available": 30,
    "rented_out": 10,
    "in_service": 5,
    "service_due": 3,
    "awaiting_parts": 1,
    "out_of_service": 1,
    "reserved": 0
  },
  "service_due_this_week": 3,
  "jobs_completed_this_month": 45,
  "average_job_duration_hours": 2.5
}
```

---

### AutoCount Functions

#### `prepare_autocount_export(p_job_id UUID)`
Prepare invoice data for AutoCount export.

| Parameter | Type | Description |
|-----------|------|-------------|
| `p_job_id` | UUID | Job to export |

| Returns | Description |
|---------|-------------|
| UUID | Export record ID |

Behavior:
- Creates `autocount_exports` record
- Builds line items from labor, parts, extra charges
- Maps customer/item codes from mapping tables
- Updates `jobs.autocount_export_id`

---

## Storage Buckets

### `hr-documents`
Supabase storage bucket for HR-related document uploads.

Used in: `services/hrService.ts`

Stores:
- Employee profile photos
- License images (front/back)
- Permit documents
- Leave supporting documents
