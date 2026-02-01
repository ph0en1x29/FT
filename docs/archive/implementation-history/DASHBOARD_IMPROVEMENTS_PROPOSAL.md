# Dashboard Improvements Proposal

**Date:** 2026-01-28  
**Author:** Phoenix/Clawdbot  
**Status:** Draft for Review

---

## Current State Analysis

### What Exists Today

| Role | Dashboard Content |
|------|-------------------|
| Technician | My Jobs, Queue, Currently Working |
| Admin | Overview stats, recent jobs |
| Supervisor | Similar to admin |
| Accountant | Invoice-focused |

### Pain Points I've Observed

1. **Approval workflows buried in jobs** - Parts verification, job requests require drilling into each job
2. **No action queue** - Users must hunt for things that need their attention
3. **Notifications disconnected** - Bell icon shows notifications, but no dashboard widget
4. **Role dashboards are similar** - Not optimized for each role's actual workflow

---

## Proposal: Action-Oriented Dashboards

### Core Principle
> **"Don't make me hunt. Show me what needs my attention NOW."**

Each role gets a dashboard optimized for their workflow, with **actionable widgets** at the top.

---

## Role-Specific Improvements

### 1. Admin Dashboard (Store/Parts Manager)

**New: "Pending Actions" Section**

```
┌─────────────────────────────────────────────────────────┐
│ 🔔 Pending Actions                              View All │
├─────────────────────────────────────────────────────────┤
│ ⚙️ Parts Verification (5)                               │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ JOB-1234 • SPARROW • 3 parts                        │ │
│ │ Oil Filter, Air Filter, Spark Plug                  │ │
│ │                          [✓ Approve] [✗ Reject]    │ │
│ ├─────────────────────────────────────────────────────┤ │
│ │ JOB-1235 • ANCOM • 1 part                           │ │
│ │ Hydraulic Hose                                      │ │
│ │                          [✓ Approve] [✗ Reject]    │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ 📋 Job Requests (3)                                     │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Spare Part Request • JOB-1234 • Tech One            │ │
│ │ "Need hydraulic seal kit"                           │ │
│ │                          [✓ Approve] [✗ Reject]    │ │
│ └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Benefits:**
- Approve/reject without leaving dashboard
- See all pending items at a glance
- Reduce clicks from 5+ to 1

---

### 2. Supervisor Dashboard

**New: "Team Overview" + "Approvals" Section**

```
┌─────────────────────────────────────────────────────────┐
│ 👥 Team Status                                   Live 🟢 │
├─────────────────────────────────────────────────────────┤
│ Tech One      • Working on JOB-1234 (2h 15m)     📍 Map │
│ Tech Two      • En route to ANCOM               📍 Map │
│ Tech Three    • Available                        Assign │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ 🆘 Assistance Requests (2)                              │
├─────────────────────────────────────────────────────────┤
│ JOB-1234 • Tech One needs helper                        │
│ "Heavy lifting required"        [Assign Helper ▼]       │
├─────────────────────────────────────────────────────────┤
│ JOB-1235 • Skillful Tech Request                        │
│ "Electrical issue beyond my skill"  [Reassign ▼]       │
└─────────────────────────────────────────────────────────┘
```

**Benefits:**
- Real-time team visibility
- Handle assistance requests immediately
- One-click assignment

---

### 3. Technician Dashboard (Enhanced)

**Keep existing "My Jobs" but add:**

```
┌─────────────────────────────────────────────────────────┐
│ 📬 My Requests Status                                   │
├─────────────────────────────────────────────────────────┤
│ ✅ Spare Part Request approved (JOB-1234) - 10m ago     │
│ ⏳ Assistance Request pending (JOB-1235) - 1h ago       │
│ ❌ Leave Request rejected - See reason                  │
└─────────────────────────────────────────────────────────┘
```

**Benefits:**
- Know request status without checking each job
- See approvals/rejections immediately

---

### 4. Accountant Dashboard

**New: "Ready for Invoice" Section**

```
┌─────────────────────────────────────────────────────────┐
│ 💰 Ready for Invoice (12)                       View All │
├─────────────────────────────────────────────────────────┤
│ ☐ JOB-1234 • SPARROW • RM 1,250    [Generate Invoice]  │
│ ☐ JOB-1235 • ANCOM • RM 850        [Generate Invoice]  │
│ ☐ JOB-1236 • KLK • RM 2,100        [Generate Invoice]  │
│                                                         │
│ [☐ Select All]              [Generate Batch Invoice]   │
└─────────────────────────────────────────────────────────┘
```

**Benefits:**
- See all completable jobs at once
- Batch invoice generation
- No hunting through job list

---

## Implementation Approach

### Option A: Dashboard Widgets (Recommended)
- Add action widgets to existing dashboard
- Each role sees relevant widgets
- Quick actions without navigation
- **Effort:** Medium (2-3 days)

### Option B: Dedicated Approval Pages
- New `/approvals` page with tabs
- More screen space for complex workflows
- Dashboard just shows counts with links
- **Effort:** Medium-High (3-4 days)

### Option C: Hybrid (Best UX)
- Dashboard widgets for quick actions (top 3-5 items)
- "View All" links to dedicated pages for full lists
- **Effort:** High (4-5 days)

---

## Quick Wins (Can Do Now)

### 1. Dashboard Notification Widget
Show recent notifications as a widget, not just in the bell.

### 2. "Needs Attention" Badge on Sidebar
Add badge counts to sidebar items:
```
Jobs (3)      ← 3 jobs need action
Inventory (5) ← 5 parts low stock
```

### 3. Pending Parts Count on Job Cards
Show "⚙️ 3 parts pending" on job cards in lists.

---

## My Recommendation

**Start with Option A (Dashboard Widgets)** because:

1. **Fastest to implement** - Uses existing dashboard structure
2. **Immediate value** - Reduces clicks from day one
3. **Iterative** - Can evolve to Option C later
4. **Mobile-friendly** - Widgets work on all screens

### Priority Order

| Priority | Widget | Role | Effort |
|----------|--------|------|--------|
| 1 | Parts Verification Queue | Admin | 4h |
| 2 | Job Requests Queue | Admin/Supervisor | 4h |
| 3 | Assistance Requests | Supervisor | 3h |
| 4 | My Requests Status | Technician | 2h |
| 5 | Ready for Invoice | Accountant | 3h |

**Total: ~16 hours (2 days)**

---

## Questions for Jay

1. **Which role's dashboard should we prioritize first?**
   - Admin (parts approval) seems highest friction currently

2. **Inline approve/reject vs. modal confirmation?**
   - Inline is faster but riskier
   - Modal adds a confirmation step

3. **Should rejected items require a reason?**
   - Good for audit trail
   - Helps technician understand why

4. **Real-time updates?**
   - We have Supabase realtime already
   - Can make widgets live-updating

---

## Mockup: Admin Dashboard with Widgets

```
┌─────────────────────────────────────────────────────────────────────┐
│ FieldPro                                    🔔 (5) 👤 Admin One     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  📊 Dashboard                                   Wednesday, 28 Jan   │
│                                                                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │ Active Jobs │ │ Completed   │ │ Pending     │ │ Low Stock   │   │
│  │     12      │ │    45       │ │ Approval: 8 │ │    15       │   │
│  │   ↑ 3 today │ │  this week  │ │   ⚠️ Action │ │   items     │   │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ ⚡ Needs Your Action                                         │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │                                                              │   │
│  │  ⚙️ Parts Verification (5)                                   │   │
│  │  ┌────────────────────────────────────────────────────────┐ │   │
│  │  │ JOB-1234 • SPARROW                          2h ago     │ │   │
│  │  │ 3 parts: Oil Filter, Air Filter, Spark Plug            │ │   │
│  │  │                              [✓ Approve] [✗ Reject]   │ │   │
│  │  └────────────────────────────────────────────────────────┘ │   │
│  │  ┌────────────────────────────────────────────────────────┐ │   │
│  │  │ JOB-1235 • ANCOM                            5h ago     │ │   │
│  │  │ 1 part: Hydraulic Hose (qty: 2)                        │ │   │
│  │  │                              [✓ Approve] [✗ Reject]   │ │   │
│  │  └────────────────────────────────────────────────────────┘ │   │
│  │                                           [View All 5 →]    │   │
│  │                                                              │   │
│  │  📋 Spare Part Requests (3)                                  │   │
│  │  ┌────────────────────────────────────────────────────────┐ │   │
│  │  │ JOB-1236 • Tech One                         30m ago    │ │   │
│  │  │ "Need hydraulic seal kit urgently"                     │ │   │
│  │  │                              [✓ Approve] [✗ Reject]   │ │   │
│  │  └────────────────────────────────────────────────────────┘ │   │
│  │                                           [View All 3 →]    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 📈 Recent Activity                                           │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │ • JOB-1230 completed by Tech Two (10m ago)                  │   │
│  │ • JOB-1231 assigned to Tech One (25m ago)                   │   │
│  │ • Parts verified for JOB-1228 (1h ago)                      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Next Steps

1. **Jay reviews this proposal**
2. **Pick priority role/widget**
3. **I build prototype**
4. **Iterate based on feedback**

Let me know your thoughts! 🔥
