# FieldPro Changelog

All notable changes, decisions, and client requirements for this project.

---

## Status Legend

| Icon | Status | Meaning |
|------|--------|---------|
| ✅ | Requirements Confirmed | Client approved, ready to START building |
| 🔨 | In Development | Currently being built |
| ✔️ | Completed | Implemented and tested |
| ⏳ | Pending Confirmation | Awaiting client response |
| ❌ | Not Started | Requirements confirmed but build not begun |

---

## [Unreleased] - ACWER Workflow Implementation

### Client
**ACWER Industrial Equipment Sdn Bhd** (Malaysia)
- ~2,000 forklifts across Johor and Penang branches
- ~60 service jobs/day
- Uses AutoCount 2.2 for accounting

### Current Phase
📋 **Requirements Confirmed** — Ready to begin implementation

### Documentation
- DB schema docs synced to current Supabase schema (2026-01-02 00:16:45 CST, author: Codex)

### Security Fixes (2026-01-03)
- ✔️ Fixed 5 Security Definer views → converted to SECURITY INVOKER
  - `active_rentals_view`, `v_todays_leave`, `v_expiring_licenses`, `v_pending_leaves`, `v_expiring_permits`
- ✔️ Enabled RLS on 5 tables with role-based policies
  - `quotations`, `service_intervals`, `scheduled_services`, `notifications`, `technician_kpi_snapshots`
- ✔️ Added `SET search_path = public` to 44 functions (prevents search_path injection)
- ✔️ Enabled Leaked Password Protection (Supabase Auth setting)
- ✔️ Created helper functions with proper security: `get_current_user_role()`, `has_role()`, `get_user_id_from_auth()`

**Migration files:**
- `database/migrations/security_fix_linter_issues.sql`
- `database/migrations/fix_security_invoker_views.sql`
- `database/migrations/fix_function_search_paths.sql`

### Implementation Status

| # | Feature | Complexity | Requirements | Build Status |
|---|---------|------------|--------------|--------------|
| 1 | Helper Technician | Medium | ✅ Confirmed | ❌ Not started |
| 2 | In-Job Request System | High | ✅ Confirmed | ❌ Not started |
| 3 | Spare Parts Request/Approval | Medium | ✅ Confirmed | ❌ Not started |
| 4 | Hourmeter Reading + prediction | Medium | ✅ Confirmed | ❌ Not started |
| 5 | Service Intervals | Low | ✅ Confirmed | ❌ Not started |
| 6 | Job Reassignment + Items/KPI | High | ✅ Confirmed | ❌ Not started |
| 7 | Multi-Day Jobs + Escalation | Medium | ✅ Confirmed | ❌ Not started |
| 8 | Deferred Customer Acknowledgement | Medium | ✅ Confirmed | ❌ Not started |
| 9 | KPI Dashboard | Medium | ✅ Confirmed | ❌ Not started |
| 10 | Photo Categorization + ZIP | Low | ✅ Confirmed | ❌ Not started |
| 11 | Partial Work Tracking | Low-Medium | ⏳ Pending | ❌ Not started |

**Summary:** 10 features ready to build, 1 awaiting client confirmation, 0 completed

---

### Confirmed Requirements (Jan 2026)

#### Job Reassignment
| Decision | Details |
|----------|---------|
| Frequency | Rarely |
| Reasons | Skill/expertise issue, Technician unavailable |
| Items handling | Admin controls cancel/transfer (existing process) |
| Multi-reassignment | Allowed (Tech A → B → C) |
| Partial work | Must record separately for billing *(detail level TBD)* |

#### Helper Technician
| Decision | Details |
|----------|---------|
| Max helpers per job | 1 at a time |
| Frequency needed | Sometimes |
| Implementation | Same Technician role, different `assignment_type` ('lead' vs 'assistant') |
| Permissions | Photos + start/end times only. No hourmeter, no spare parts, no signature |

#### Multi-Day Jobs & Escalation
| Decision | Details |
|----------|---------|
| Escalation trigger | 8:00 AM next business day |
| Monday-Friday | Standard job, counts toward day limit |
| Saturday (OT) | Marked "Overtime Job", escalation disabled, days counter paused |
| Sunday | TBD - assume no work |

#### Spare Parts Requests
| Decision | Details |
|----------|---------|
| Admin response time | Within hours |
| Batch requests | Yes, multiple parts at once |
| Technician input | Text description + optional photo |
| Admin action | Selects from inventory, approves/rejects |
| Post-job amendment | Admin can amend Items Used before finalizing |

#### Hourmeter & Service Prediction
| Decision | Details |
|----------|---------|
| Electric forklifts | Every 3 months from delivery date (calendar-based) |
| Diesel forklifts | Every 500 hours (hourmeter-based) |
| LPG forklifts | Every 350 hours (hourmeter-based) |
| Input by | Main Technician only |
| Monitoring | Admin dashboard for prediction |

#### Customer Signature — Deferred Acknowledgement
| Decision | Details |
|----------|---------|
| Standard flow | Customer signs on-site (mandatory for job completion) |
| Exception flow | "Customer Not Signed Onsite" option |
| Requirements | Mandatory reason + mandatory evidence (photos/hourmeter/work images) |
| Job status | "Completed – Awaiting Customer Acknowledgement" |
| Customer notification | Auto-send via email/portal/SMS |
| Customer options | Sign later, acknowledge without signature, raise dispute |
| Auto-complete | 3-5 working days no response → auto Completed, Admin notified |
| Audit | Full trail for billing, KPI, disputes |

---

### Pending Decisions

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Partial work detail level | ⏳ Awaiting client | Options: flag only, time+tasks, percentage |

---

### Technical Decisions Made

| Decision | Rationale |
|----------|-----------|
| Helper as `assignment_type`, not new role | Same person can be lead on one job, assistant on another. Simpler RLS. |
| Service prediction: start with SQL rules | Defer Python ML service until sufficient historical data |
| Spare parts: request/approve flow | Defer full inventory management; integrate AutoCount later |

---

## [1.0.1] - December 2024

### Added
- Job Type Classification (Service, Repair, Checking, Accident)
- Photo upload timestamps and uploader tracking
- Professional invoice format matching industry standards

---

## [1.0.0] - December 2024

### Initial Release
- Role-based permissions: Admin, Supervisor, Accountant, Technician
- Job lifecycle with audit trails
- Customer signature validation
- Condition checklist (48 items)
- PDF invoice and service report generation
- Forklift rental tracking
- Soft light/dark theme
- Multi-select bulk operations

---

## How to Update This Log

When making changes:
1. Add entry under `[Unreleased]` with date
2. Categorize: `Added`, `Changed`, `Fixed`, `Removed`, `Confirmed`, `Pending`
3. Reference client communication where applicable
4. Move to versioned section on release
