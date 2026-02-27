# FT Mobile Responsive Spec

## Breakpoints (Tailwind defaults)
- `sm:` → 640px+ (large phones landscape)
- `md:` → 768px+ (tablets) — sidebar appears here
- `lg:` → 1024px+ (desktop)

## Rules for ALL components

### 1. Tap Targets
- All buttons, links, interactive elements: minimum `h-10 min-w-[44px]` (44px)
- On mobile, prefer `h-12` (48px) for primary actions
- Add `p-3` minimum to icon-only buttons

### 2. Tables → Cards on Mobile
- Wrap all `<table>` in `<div className="overflow-x-auto">`
- OR better: use card layout on mobile, table on desktop:
  ```
  <div className="hidden md:block">...table...</div>
  <div className="md:hidden">...card list...</div>
  ```

### 3. Grid Layouts
- Desktop multi-column → mobile single column
- `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- Never assume horizontal space on mobile

### 4. Typography
- Headings: `text-lg md:text-xl lg:text-2xl`
- Body: `text-sm md:text-base`
- Labels: `text-xs md:text-sm`

### 5. Spacing
- Page padding: already `p-4 md:p-6 lg:p-8`
- Cards: `p-3 md:p-4 lg:p-6`
- Gaps: `gap-3 md:gap-4 lg:gap-6`

### 6. Bottom Navigation Clearance
- All pages need `pb-24 md:pb-8` to clear the 80px bottom nav on mobile

### 7. Forms
- Inputs: `w-full` always
- Use `inputmode="numeric"` for number fields
- Labels above inputs on mobile (not side-by-side)
- `grid grid-cols-1 sm:grid-cols-2` for form grids

### 8. Modals
- Full screen on mobile: `fixed inset-0 md:inset-auto md:max-w-lg md:mx-auto md:my-8`
- Or bottom sheet style: slide up from bottom on mobile

### 9. Text Overflow
- Long text: `truncate` or `line-clamp-2`
- Job titles, customer names: always truncate on mobile

### 10. Images / Photos
- `w-full max-w-none md:max-w-md` 
- Grid: `grid-cols-2 sm:grid-cols-3 md:grid-cols-4`

## Technician Priority Pages (most important)
1. JobDetail — THE main page
2. Jobs list (JobsTabs)
3. CreateJob
4. MyVanStock
5. StoreQueue (Approvals)

## PWA Requirements
- manifest.json with icons (192, 512)
- service-worker.js for offline caching
- Theme color matching --accent
- Display: standalone
- Start URL: /

---

## Implementation Status (as of 2026-02-26)

### ✅ Completed
- **Tap targets** — 44px min enforced on all interactive elements (global CSS)
- **Tables → Cards** — Inventory, Customers, People, Invoices all have card views on mobile
- **Grid responsiveness** — All pages use single-col mobile → multi-col desktop grids
- **Form inputs** — All `w-full`, `inputmode` set, labels above on mobile
- **Bottom nav clearance** — `pb-24 md:pb-8` on all pages
- **PWA** — `manifest.json` + service worker (stale-while-revalidate static, network-first API, offline fallback page)
- **Safe area support** — `env(safe-area-inset-bottom)` on bottom nav
- **16px input font** — Prevents iOS auto-zoom on focus
- **Role-aware bottom nav** — Different tabs per role (Technician / Supervisor / Admin / Accountant) with badge counts
- **FAB (Floating Action Button)** — Role-specific quick actions; closes on route change; solid styling
- **Pull-to-refresh** — `usePullToRefresh` hook wired into Jobs page
- **Swipe actions** — `SwipeableRow` on StoreQueue (approve/reject)
- **Bottom sheet modals** — `BottomSheet` + `BottomSheetOrModal` components
- **Command palette** — `Cmd+K` / search button; role-aware; arrow keys + Enter to select
- **Sticky job action bar** — Status-based actions at top of mobile job detail; hides when modal open
- **Collapsible sections** — Job detail sections (Equipment, Checklist, Parts, Photos) collapse on mobile
- **Combobox portal** — Dropdown renders at body level, immune to overflow clipping
- **Dark mode** — All 73+ components use `var(--surface)` instead of `bg-white`

### 🔲 Planned / Not Yet Implemented
- **Offline data sync** — Service worker caches static assets; full offline job creation/editing not yet implemented (network-first means features require connectivity)
- **Push notifications on mobile** — Web push configured but requires user opt-in; not prominently surfaced on mobile onboarding
- **Haptic feedback** — No vibration API usage on swipe actions or confirmations
- **Camera direct capture** — Photo upload uses file picker; no direct camera API integration
- **PWA install prompt** — No custom A2HS (Add to Home Screen) prompt; relies on browser default
