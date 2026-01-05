# FieldPro Roadmap

**Last Updated:** January 5, 2026

---

## 🎯 Current Sprint: UI Redesign

### Priority: High

#### 1. Dashboard Redesign
- [ ] Reorganize layout for better information hierarchy
- [ ] Escalation panel improvements (expand/collapse done ✅)
- [ ] Better visual grouping of alerts (Escalated, Awaiting Ack, Disputed)
- [ ] Stats cards - review what metrics matter most
- [ ] Charts - consider if both pie and bar are needed
- [ ] Mobile responsiveness check

#### 2. Job Detail Page Redesign
- [ ] Information architecture review
- [ ] Better visual flow for job lifecycle
- [ ] Action buttons placement
- [ ] Media gallery improvements
- [ ] Timeline/activity log presentation
- [ ] Mobile-first layout

#### 3. User/HR/Employee Page Consolidation
- [ ] Merge User Management + HR into single page
- [ ] Tab-based navigation: Users | Leave | Licenses | Permits
- [ ] Cleaner role/permission display
- [ ] Better employee profile view

#### 4. Service Intervals Relocation
- [ ] Option A: Move under Forklifts page as tab
- [ ] Option B: Combine with Service Due page
- [ ] Reduce navigation clutter
- [ ] Keep Admin-only access

---

## 📋 Backlog

### Features
- [ ] AutoCount API integration
- [ ] Job reassignment UI (from escalation panel)
- [ ] Rental amount management
- [ ] Advanced reporting/analytics
- [ ] Customer portal for acknowledgements

### Technical Debt
- [ ] Code splitting for bundle size
- [ ] Component library documentation
- [ ] Test coverage

### Nice-to-Have
- [ ] Dark mode refinements
- [ ] Keyboard shortcuts
- [ ] Bulk operations (jobs, forklifts)
- [ ] Export to Excel/PDF

---

## ✅ Completed (Recent)

### January 5, 2026
- [x] Enhanced escalation management (acknowledge, notes, actions)
- [x] Duplicate service intervals cleanup + unique constraint
- [x] Security linter fixes (views, functions, RLS)
- [x] #7/#8 status UI consistency across all pages
- [x] Deferred completion hourmeter validation
- [x] KPI pages include all completed statuses

### January 4, 2026
- [x] Multi-day job escalation (#7)
- [x] Deferred acknowledgement flow (#8)
- [x] Malaysian public holidays table

### January 3, 2026
- [x] User-Employee merge
- [x] Comprehensive RLS security
- [x] Foreign key indexes (48 added)

---

## 📝 Notes

### Dashboard Redesign Ideas
```
Current:
┌─────────────────────────────────────────┐
│ Stats (4 cards)                         │
│ Charts (Pie + Bar)                      │
│ Escalated Jobs Alert                    │
│ Awaiting Ack Alert                      │
│ Disputed Alert                          │
│ Service Widget + Recent Jobs            │
└─────────────────────────────────────────┘

Proposed:
┌─────────────────────────────────────────┐
│ Key Stats (simplified)                  │
├─────────────────────────────────────────┤
│ ⚠️ Action Required (combined alerts)    │
│   - Escalated (X)                       │
│   - Awaiting Ack (X)                    │
│   - Disputed (X)                        │
├─────────────────────────────────────────┤
│ Today's Work | Service Due | Analytics  │
└─────────────────────────────────────────┘
```

### Job Detail Redesign Ideas
- Header: Job title, status badge, quick actions
- Left column: Details, customer, forklift
- Right column: Activity timeline
- Bottom: Media gallery, signature, invoice

### Navigation Simplification
```
Current sidebar:
- Dashboard
- Jobs
- Forklifts  
- Customers
- Inventory
- Service Due
- Service Intervals  ← merge into Forklifts?
- Invoices
- User Management    ← merge with HR?
- HR Dashboard
- KPI

Proposed:
- Dashboard
- Jobs
- Assets (Forklifts + Service Intervals)
- Customers
- Inventory
- Service Due
- Invoices
- Team (Users + HR + KPI)
- Settings
```
