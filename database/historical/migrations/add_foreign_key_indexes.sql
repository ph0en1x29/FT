-- ============================================
-- ADD INDEXES FOR UNINDEXED FOREIGN KEYS
-- Improves JOIN and DELETE performance
-- Date: 2026-01-03
-- ============================================

-- employee_leave_balances
CREATE INDEX IF NOT EXISTS idx_employee_leave_balances_leave_type_id 
  ON employee_leave_balances(leave_type_id);

-- employee_leaves
CREATE INDEX IF NOT EXISTS idx_employee_leaves_approved_by_user_id 
  ON employee_leaves(approved_by_user_id);
CREATE INDEX IF NOT EXISTS idx_employee_leaves_leave_type_id 
  ON employee_leaves(leave_type_id);
CREATE INDEX IF NOT EXISTS idx_employee_leaves_rejected_by_user_id 
  ON employee_leaves(rejected_by_user_id);
CREATE INDEX IF NOT EXISTS idx_employee_leaves_requested_by_user_id 
  ON employee_leaves(requested_by_user_id);

-- forklift_hourmeter_logs
CREATE INDEX IF NOT EXISTS idx_forklift_hourmeter_logs_job_id 
  ON forklift_hourmeter_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_forklift_hourmeter_logs_recorded_by 
  ON forklift_hourmeter_logs(recorded_by);
CREATE INDEX IF NOT EXISTS idx_forklift_hourmeter_logs_rental_id 
  ON forklift_hourmeter_logs(rental_id);

-- forklift_rentals
CREATE INDEX IF NOT EXISTS idx_forklift_rentals_created_by_id 
  ON forklift_rentals(created_by_id);
CREATE INDEX IF NOT EXISTS idx_forklift_rentals_ended_by_id 
  ON forklift_rentals(ended_by_id);

-- forklifts
CREATE INDEX IF NOT EXISTS idx_forklifts_current_customer_id 
  ON forklifts(current_customer_id);
CREATE INDEX IF NOT EXISTS idx_forklifts_customer_id 
  ON forklifts(customer_id);
CREATE INDEX IF NOT EXISTS idx_forklifts_last_service_job_id 
  ON forklifts(last_service_job_id);

-- hr_alerts
CREATE INDEX IF NOT EXISTS idx_hr_alerts_leave_id 
  ON hr_alerts(leave_id);
CREATE INDEX IF NOT EXISTS idx_hr_alerts_license_id 
  ON hr_alerts(license_id);
CREATE INDEX IF NOT EXISTS idx_hr_alerts_permit_id 
  ON hr_alerts(permit_id);

-- job_audit_log
CREATE INDEX IF NOT EXISTS idx_job_audit_log_invoice_id 
  ON job_audit_log(invoice_id);
CREATE INDEX IF NOT EXISTS idx_job_audit_log_service_record_id 
  ON job_audit_log(service_record_id);

-- job_inventory_usage
CREATE INDEX IF NOT EXISTS idx_job_inventory_usage_deducted_by 
  ON job_inventory_usage(deducted_by);
CREATE INDEX IF NOT EXISTS idx_job_inventory_usage_recorded_by 
  ON job_inventory_usage(recorded_by);
CREATE INDEX IF NOT EXISTS idx_job_inventory_usage_service_record_id 
  ON job_inventory_usage(service_record_id);

-- job_invoice_extra_charges
CREATE INDEX IF NOT EXISTS idx_job_invoice_extra_charges_approved_by 
  ON job_invoice_extra_charges(approved_by);
CREATE INDEX IF NOT EXISTS idx_job_invoice_extra_charges_created_by 
  ON job_invoice_extra_charges(created_by);
CREATE INDEX IF NOT EXISTS idx_job_invoice_extra_charges_updated_by 
  ON job_invoice_extra_charges(updated_by);

-- job_invoices
CREATE INDEX IF NOT EXISTS idx_job_invoices_finalized_by 
  ON job_invoices(finalized_by);
CREATE INDEX IF NOT EXISTS idx_job_invoices_locked_by 
  ON job_invoices(locked_by);
CREATE INDEX IF NOT EXISTS idx_job_invoices_prepared_by 
  ON job_invoices(prepared_by);
CREATE INDEX IF NOT EXISTS idx_job_invoices_updated_by 
  ON job_invoices(updated_by);

-- job_media
CREATE INDEX IF NOT EXISTS idx_job_media_uploaded_by_id 
  ON job_media(uploaded_by_id);

-- job_parts
CREATE INDEX IF NOT EXISTS idx_job_parts_part_id 
  ON job_parts(part_id);

-- job_service_records
CREATE INDEX IF NOT EXISTS idx_job_service_records_locked_by 
  ON job_service_records(locked_by);
CREATE INDEX IF NOT EXISTS idx_job_service_records_updated_by 
  ON job_service_records(updated_by);

-- job_status_history
CREATE INDEX IF NOT EXISTS idx_job_status_history_changed_by 
  ON job_status_history(changed_by);

-- jobs
CREATE INDEX IF NOT EXISTS idx_jobs_assigned_by_id 
  ON jobs(assigned_by_id);
CREATE INDEX IF NOT EXISTS idx_jobs_completed_by_id 
  ON jobs(completed_by_id);
CREATE INDEX IF NOT EXISTS idx_jobs_created_by_id 
  ON jobs(created_by_id);
CREATE INDEX IF NOT EXISTS idx_jobs_deleted_by 
  ON jobs(deleted_by);
CREATE INDEX IF NOT EXISTS idx_jobs_started_by_id 
  ON jobs(started_by_id);

-- parts
CREATE INDEX IF NOT EXISTS idx_parts_last_updated_by 
  ON parts(last_updated_by);

-- quotations
CREATE INDEX IF NOT EXISTS idx_quotations_created_by_id 
  ON quotations(created_by_id);
CREATE INDEX IF NOT EXISTS idx_quotations_forklift_id 
  ON quotations(forklift_id);
CREATE INDEX IF NOT EXISTS idx_quotations_job_id 
  ON quotations(job_id);

-- scheduled_services
CREATE INDEX IF NOT EXISTS idx_scheduled_services_assigned_technician_id 
  ON scheduled_services(assigned_technician_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_services_job_id 
  ON scheduled_services(job_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_services_service_interval_id 
  ON scheduled_services(service_interval_id);

-- service_predictions
CREATE INDEX IF NOT EXISTS idx_service_predictions_job_id 
  ON service_predictions(job_id);

-- ============================================
-- NOTE ON UNUSED INDEXES
-- ============================================
-- The linter reports 33 unused indexes, but these are likely 
-- unused because the system is in demo/testing mode with 
-- limited data. These indexes may become useful in production:
--
-- employees: idx_employees_department, idx_employees_email
-- employee_licenses: idx_employee_licenses_expiry
-- employee_permits: idx_employee_permits_expiry
-- employee_leaves: idx_employee_leaves_dates
-- hr_alerts: idx_hr_alerts_type
-- forklifts: idx_forklifts_make, idx_forklifts_type, idx_forklifts_status
-- jobs: idx_jobs_job_type, idx_jobs_invoiced_at, idx_jobs_deleted_at, idx_jobs_customer
-- quotations: idx_quotations_customer, idx_quotations_status
-- scheduled_services: idx_scheduled_services_status, idx_scheduled_services_due_date
-- forklift_rentals: idx_forklift_rentals_dates
-- job_service_records: idx_service_records_locked
-- job_invoices: idx_invoices_number, idx_invoices_payment_status, idx_invoices_finalized
-- job_audit_log: idx_audit_log_performed
-- job_inventory_usage: idx_inventory_usage_item, idx_inventory_usage_deducted
-- job_status_history: idx_status_history_changed
-- forklift_hourmeter_logs: idx_hourmeter_logs_forklift, idx_hourmeter_logs_recorded_at, idx_hourmeter_logs_source
-- service_predictions: idx_service_predictions_forklift, idx_service_predictions_rental, idx_service_predictions_date, idx_service_predictions_overdue
--
-- RECOMMENDATION: Keep these indexes for now, review after 
-- production deployment with real usage patterns.
-- ============================================

-- ============================================
-- PERFORMANCE INDEXES FOR JOBS QUERY
-- Addresses the 14.4% slow query time from Query Performance report
-- ============================================

-- Partial index for main jobs list query pattern:
-- WHERE deleted_at IS NULL ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_jobs_active_created 
  ON jobs(created_at DESC) 
  WHERE deleted_at IS NULL;

-- Index for extra_charges.job_id (legacy table, not in FK list)
CREATE INDEX IF NOT EXISTS idx_extra_charges_job_id 
  ON extra_charges(job_id);
