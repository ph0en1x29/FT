# FieldPro RLS Security Redesign

## Overview

This folder contains the complete database security redesign for FieldPro, implementing:
- **Row Level Security (RLS)** - Role-based access control at the database level
- **Workflow Enforcement** - Status transitions enforced via triggers
- **Audit Logging** - Complete trail of all changes
- **Data Locking** - Service records locked after invoicing

## Files

| File | Description | Run Order |
|------|-------------|-----------|
| `01_enums_and_types.sql` | Creates enums and helper functions | 1st |
| `02_new_tables.sql` | Creates 6 new tables with indexes | 2nd |
| `03_data_migration.sql` | Migrates existing data to new structure | 3rd |
| `04_triggers_and_functions.sql` | Workflow and audit triggers | 4th |
| `05_rpc_functions.sql` | Helper RPC functions | 5th |
| `06_rls_policies.sql` | New role-based policies | 6th |
| `07_drop_old_policies.sql` | Removes old permissive policies | 7th (LAST) |
| `99_rollback.sql` | Emergency rollback script | Only if needed |
| `types_rls_redesign.ts` | TypeScript interfaces | Frontend update |
| `USER_GUIDE.md` | Complete user manual | Documentation |

## Execution Checklist

### Pre-Migration

- [ ] **BACKUP DATABASE** from Supabase Dashboard → Database → Backups
- [ ] Notify users of maintenance window
- [ ] Test in development environment first

### Migration Steps

Run each file in Supabase SQL Editor in order:

- [ ] **Step 1**: Run `01_enums_and_types.sql`
  - Creates: `audit_event_type` enum, `payment_status` enum
  - Creates: Helper functions (`has_role`, `get_current_user_role`, etc.)
  
- [ ] **Step 2**: Run `02_new_tables.sql`
  - Creates: `job_service_records`, `job_invoices`, `job_invoice_extra_charges`
  - Creates: `job_audit_log`, `job_inventory_usage`, `job_status_history`
  - Adds columns to `jobs` table
  
- [ ] **Step 3**: Run `03_data_migration.sql`
  - Migrates service data to `job_service_records`
  - Migrates invoice data to `job_invoices`
  - Migrates parts used to `job_inventory_usage`
  - Creates status history entries
  - Locks completed job records
  
- [ ] **Step 4**: Run `04_triggers_and_functions.sql`
  - Creates: Status transition validation
  - Creates: Completion requirements enforcement
  - Creates: Service record locking on invoice
  - Creates: Inventory deduction on completion
  - Creates: Audit logging triggers
  
- [ ] **Step 5**: Run `05_rpc_functions.sql`
  - Creates: `start_job()`, `complete_job()`, `finalize_invoice()`
  - Creates: `admin_override_lock()`, `cancel_job()`, `record_payment()`
  
- [ ] **Step 6**: Run `06_rls_policies.sql`
  - Creates role-based policies for all tables
  - Revokes public access
  - Grants authenticated role access

### Post-Migration Verification

Before running Step 7, verify the following:

- [ ] **Admin Login**: Can view all jobs
- [ ] **Supervisor Login**: Can view all jobs, create jobs, assign technicians
- [ ] **Technician Login**: Can ONLY see assigned jobs
- [ ] **Accountant Login**: Can view all jobs, can finalize invoices

Test workflow:
- [ ] Technician can start an assigned job
- [ ] Technician CANNOT complete without all requirements
- [ ] Technician CAN complete with all requirements filled
- [ ] Accountant can finalize invoice
- [ ] Service record is locked after invoicing
- [ ] Admin can override locks

### Final Step

- [ ] **Step 7**: Run `07_drop_old_policies.sql` (only after verification!)
  - Removes old overpermissive policies
  - Ensures RLS is enabled on all tables

### Frontend Update

- [ ] Copy `types_rls_redesign.ts` to frontend project
- [ ] Update imports as needed
- [ ] Test all features with new types

## Database Schema After Migration

### New Tables

```
┌─────────────────────────┐
│         jobs            │ (existing, modified)
│  + deleted_at           │
│  + deleted_by           │
│  + is_locked            │
│  + locked_at            │
│  + locked_reason        │
└───────────┬─────────────┘
            │
            │ 1:1
            ▼
┌─────────────────────────┐
│   job_service_records   │ (NEW - technician data)
│  - service_record_id    │
│  - job_id (FK, unique)  │
│  - technician_id        │
│  - checklist_data       │
│  - signatures           │
│  - locked_at            │
└───────────┬─────────────┘
            │
            │ 1:1
            ▼
┌─────────────────────────┐
│      job_invoices       │ (NEW - accountant data)
│  - invoice_id           │
│  - job_id (FK, unique)  │
│  - invoice_number       │
│  - payment_status       │
│  - finalized_at         │
└───────────┬─────────────┘
            │
            │ 1:N
            ▼
┌─────────────────────────┐
│job_invoice_extra_charges│ (NEW)
│  - charge_id            │
│  - invoice_id (FK)      │
│  - description          │
│  - amount               │
└─────────────────────────┘

┌─────────────────────────┐
│   job_inventory_usage   │ (NEW - parts tracking)
│  - usage_id             │
│  - job_id (FK)          │
│  - inventory_item_id    │
│  - quantity_used        │
│  - stock_deducted       │
└─────────────────────────┘

┌─────────────────────────┐
│     job_audit_log       │ (NEW - immutable)
│  - audit_id             │
│  - job_id (FK)          │
│  - event_type           │
│  - performed_by         │
│  - performed_at         │
└─────────────────────────┘

┌─────────────────────────┐
│   job_status_history    │ (NEW - timeline)
│  - history_id           │
│  - job_id (FK)          │
│  - old_status           │
│  - new_status           │
│  - changed_at           │
└─────────────────────────┘
```

## Role Permissions Summary

| Table | Admin | Supervisor | Accountant | Technician |
|-------|-------|------------|------------|------------|
| jobs | ALL | SELECT, INSERT, UPDATE | SELECT, UPDATE (status only) | SELECT, UPDATE (own) |
| job_service_records | ALL | SELECT | SELECT | ALL (own, unlocked) |
| job_invoices | ALL | SELECT | ALL | SELECT (own) |
| job_invoice_extra_charges | ALL | SELECT, DELETE | ALL | SELECT, INSERT (own) |
| job_audit_log | SELECT | SELECT | SELECT | - |
| job_inventory_usage | ALL | ALL | SELECT | SELECT, INSERT, DELETE (own) |
| job_status_history | SELECT | SELECT | SELECT | SELECT |
| customers | ALL | ALL | SELECT, INSERT, UPDATE | SELECT |
| forklifts | ALL | ALL | SELECT | SELECT |
| parts | ALL | ALL | SELECT | SELECT |
| forklift_rentals | ALL | ALL | SELECT | SELECT |
| users | ALL | SELECT | SELECT | SELECT |

## Workflow Enforcement

### Status Transitions

```
New → Assigned → In Progress → Awaiting Finalization → Completed
                                    │
                               [TRIGGERS]
                               - Lock service record
                               - Generate invoice
```

### Completion Requirements (Enforced by Trigger)

1. ✅ Job started (started_at not null)
2. ✅ Checklist filled (not empty JSON)
3. ✅ Service notes OR job_carried_out filled
4. ✅ Parts recorded OR no_parts_used = true
5. ✅ Technician signature present
6. ✅ Customer signature present

## Rollback

If something goes wrong, run `99_rollback.sql` to:
- Drop all new tables
- Remove all new triggers and functions
- Remove all new policies
- Remove new columns from jobs table

**WARNING**: Data in new tables will be LOST!

After rollback, you may need to restore original RLS policies manually.

## Support

For issues or questions:
1. Check the audit log for recent changes
2. Review trigger error messages in Supabase logs
3. Contact system administrator

---

*FieldPro Security Redesign - Version 1.0*
*Last Updated: December 2024*
