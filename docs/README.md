# FieldPro Documentation Index

> **Quick Navigation:** Find the right document for your needs.

---

## For End Users

| Document | Description |
|----------|-------------|
| [USER_GUIDE.md](./USER_GUIDE.md) | How to use FieldPro — roles, features, workflows |
| [User_Manual_v1.1.md](./User_Manual_v1.1.md) | What's new in version 1.1 |

---

## For Engineers & Developers

| Document | Description |
|----------|-------------|
| [DB_SCHEMA.md](./DB_SCHEMA.md) | **Database structure** — tables, columns, relationships, enums |
| [WORKFLOW_SPECIFICATION.md](./WORKFLOW_SPECIFICATION.md) | Technical spec for ACWER implementation — schemas, APIs, logic |
| [SERVICE_AUTOMATION_SPEC.md](./SERVICE_AUTOMATION_SPEC.md) | Service due automation specification |
| [CHANGELOG.md](./CHANGELOG.md) | Decision log, client confirmations, implementation status |
| [DEVELOPMENT_PROCESS.md](./DEVELOPMENT_PROCESS.md) | How to implement changes — golden rules, checklists, templates |
| [SECURITY.md](./SECURITY.md) | Credential handling, Supabase security checklist |
| [.env.example](../.env.example) | Environment variable template |

---

## Recent Documentation Updates

- **2026-01-20:** Permission Modal UI — Replaced cramped inline permission panel in DevBanner with centered modal. New `PermissionModal.tsx` component with 27 permissions in 7 groups, toggle switches, search filter, override indicators (amber highlight), and reset functionality. DevBanner now shows "Permissions" button with badge for override count. **Theme-aware styling** works in both light/dark themes. **Fixed permission overrides** - navigation (Sidebar, MobileNav, MobileDrawer) now uses context's `hasPermission()` so overrides actually affect the whole app.
- **2026-01-20:** Dev Mode UI Refactoring — Fixed dual state bug between App.tsx and DevModeSelector by refactoring to `AppLayout` inner component. Removed RoleSwitcher from PrototypeDashboards.tsx (was appearing in page content). All dev mode state now shared via `useDevModeContext()`. DevModeSelector provides compact theme-aware controls in header bar.
- **2026-01-19:** Customer Feedback Implementation (Phase 1-3) — Parts confirmation dependency (Admin 1 blocked until Admin 2 confirms), pricing hidden from technicians, binary checklist states (OK/Not OK), photo auto-start timer, request edit capability, hourmeter persistence, dashboard notifications, multi-admin job locking, pre-job parts for Admin Store. New migration: `20260119000001_customer_feedback_implementation.sql`. New component: `DashboardNotificationCard.tsx`. Updated: `JobDetail.tsx`, `PendingConfirmations.tsx`, `supabaseService.ts`, `types/index.ts`.
- **2026-01-19:** Dev UI Control Panel — Comprehensive slide-out dev panel with role simulation, permission overrides (toggle any of 27 permissions), feature flags (6 toggleable features), and quick actions. New components: `DevPanel.tsx`, `DevPanelToggle.tsx`, `PermissionOverrides.tsx`, `FeatureFlags.tsx`, `QuickActions.tsx`. New context: `FeatureFlagContext.tsx`. Keyboard shortcut: `Ctrl+Shift+D`.
- **2026-01-19:** Dev Mode Context Provider — Complete role simulation using React Context. Page content (buttons, tabs, data) now respects dev mode role. New `DevModeContext.tsx` with `useDevModeContext()` hook and `hasPermission()` helper. Updated 12 pages.
- **2026-01-19:** Dev Mode Complete Role Simulator — Strict mode now blocks direct URL access to routes the impersonated role can't access, plus new collapsible permission panel in DevBanner showing all 27 permissions with ✅/❌ status
- **2026-01-19:** Dev Mode Strict Navigation Permissions — When dev mode is in "Strict" mode, sidebar/navigation now shows only tabs the impersonated role can access
- **2026-01-19:** Dashboard Task-Focus Redesign — Accountant dashboard: FIFO finalization queue with urgency highlighting, days-waiting badges. Technician dashboard: Today's Schedule horizontal carousel with swipeable cards
- **2026-01-18:** Comprehensive documentation audit — DB_SCHEMA.md updated with 6 new tables (AutoCount integration, duration alerts), 20+ new columns, 11 new views, 10 new functions; USER_GUIDE.md updated with Admin Service/Store roles; ROADMAP.md updated
- **2026-01-18:** Bug fixes — Fixed `getLowStockItems` broken query, added missing theme utility classes (`bg-theme-accent-subtle`, `text-theme-accent`, `hover:bg-theme-surface-2`)
- **2026-01-17:** TeamStatusTab UI polish, dark mode fix (removed `dark:` utilities in favor of `[data-theme]` overrides)
- **2026-01-17:** Role-specific dashboards (Technician, Accountant), KPI card click-through filtering, canViewKPI permission fix
- **2026-01-09:** Comprehensive documentation audit — DB_SCHEMA.md, CHANGELOG.md, WORKFLOW_SPECIFICATION.md, ROADMAP.md updated with correct implementation status
- **2026-01-08:** ACWER Requirements Review document created for next phase planning
- **2026-01-07:** Real-time notification system v2, People page consolidation, sidebar simplification, stability hardening
- **2026-01-06:** Dashboard 3-panel redesign, bundle optimization with lazy loading, real-time notification system
- **2026-01-05:** Critical RLS fixes, escalation management enhancements, security linter warnings resolved
- **2026-01-04:** Multi-day escalation (#7), deferred acknowledgement (#8), photo categorization (#10) completed
- **2026-01-03:** User-Employee merge cleanup — all `employees` table references removed, HR data now in `users` table
- **2026-01-03:** Security fixes applied — RLS, function search paths, leaked password protection

---

## For Project Managers

| Document | Description |
|----------|-------------|
| [CHANGELOG.md](./CHANGELOG.md) | Track what's confirmed vs pending vs built |
| [DEVELOPMENT_PROCESS.md](./DEVELOPMENT_PROCESS.md) | Client communication workflow, question templates |

---

## Document Purposes

### DB_SCHEMA.md
- **Audience:** Engineers, AI assistants
- **Content:** All database tables, columns, types, constraints, relationships, enums
- **Update when:** Schema changes, new tables added, columns modified

### USER_GUIDE.md
- **Audience:** End users (Admin, Technicians, Supervisors, Accountants)
- **Content:** Step-by-step instructions, role permissions, troubleshooting
- **Update when:** UI changes, new features released

### User_Manual_v1.1.md
- **Audience:** End users
- **Content:** Release notes for v1.1 features
- **Update when:** New version released (create new file: User_Manual_v1.2.md, etc.)

### WORKFLOW_SPECIFICATION.md
- **Audience:** Engineers, AI assistants
- **Content:** Database schemas, API endpoints, business logic, edge cases
- **Update when:** Requirements change, technical decisions made

### CHANGELOG.md
- **Audience:** Engineers, PMs, AI assistants
- **Content:** Client decisions, implementation status, version history
- **Update when:** Client confirms requirements, features built, releases made

### DEVELOPMENT_PROCESS.md
- **Audience:** Engineers, AI assistants
- **Content:** Golden rules, pre-implementation checklist, communication templates
- **Update when:** Process improves, lessons learned

### SECURITY.md
- **Audience:** Engineers, DevOps
- **Content:** Credential handling, Supabase security checklist, rotation schedule
- **Update when:** Before go-live, security practices change, credentials rotated

---

## Quick Links

- 🏠 [Back to Main README](../README.md)
- 📋 [Current Status](./CHANGELOG.md#implementation-status) — What's built vs pending
- 🔐 [Test Accounts](./USER_GUIDE.md#test-accounts) — Demo credentials

---

## Version History

| Version | Date | Major Changes |
|---------|------|---------------|
| 1.0 | Dec 2024 | Initial FieldPro release |
| 1.0.1 | Dec 2024 | Job types, photo tracking, invoice format |
| 1.1 | Jan 2026 | ACWER workflow (in development) |
