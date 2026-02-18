# UI Upgrade Spec — 9 Features

## Stack Context
- React + TypeScript + Tailwind CSS + react-router-dom + lucide-react + sonner (toasts)
- NO framer-motion (use CSS transitions/animations only)
- Theme vars in index.css: `--bg`, `--surface`, `--border`, `--text`, `--accent`, etc.
- Theme classes: `bg-theme-surface`, `text-theme`, `border-theme`, `card-theme`, etc.
- Dark theme via `[data-theme="dark"]`
- Build: `npm run build` (MUST pass)
- Icons: lucide-react ONLY

---

## Feature 1: Wire Pull-to-Refresh into List Pages
**Files to modify:** `pages/JobsTabs.tsx`, `pages/StoreQueue/StoreQueuePage.tsx`
**Existing hook:** `hooks/usePullToRefresh.tsx` — returns `{ pullToRefreshProps, isRefreshing, PullIndicator }`

For each page:
1. Import `usePullToRefresh` from `../../hooks/usePullToRefresh` (adjust path)
2. Find the data-fetching function (usually `loadData` or `fetchJobs`)
3. Call `const { pullToRefreshProps, isRefreshing, PullIndicator } = usePullToRefresh(fetchData)`
4. Wrap the main scrollable container with `{...pullToRefreshProps}`
5. Add `<PullIndicator />` at top of the content area
6. DO NOT change any existing functionality

## Feature 2: Wire Swipe Actions into StoreQueue
**Files to modify:** `pages/StoreQueue/StoreQueuePage.tsx` (or its list items)
**Existing component:** `components/mobile/SwipeableRow.tsx`

Wrap each approval item in StoreQueue with `<SwipeableRow>`:
- Swipe right → Approve (green)
- Swipe left → Reject (red)
- Connect to existing approve/reject handlers
- Only on mobile (wrap in a md:hidden check or just let it work — desktop users won't swipe)

## Feature 3: Filter Bottom Sheets on Mobile
**New file:** `components/mobile/FilterSheet.tsx`
**Concept:** On mobile, collapse filter controls into a button that opens a BottomSheet.

Create a wrapper component `MobileFilterSheet`:
```tsx
interface MobileFilterSheetProps {
  children: ReactNode; // the existing filter controls
  activeFilterCount?: number;
}
```
- On mobile (md:hidden): Show a "Filters" button with badge count → opens BottomSheet with the filter children
- On desktop (hidden md:block): Render children inline as-is
- Use existing `BottomSheet` from `components/mobile/BottomSheet.tsx`
- Import `Filter` icon from lucide-react

Apply to: `pages/JobsTabs.tsx` filter section, `pages/InventoryPage/components/InventoryFilters.tsx`

## Feature 4: Skeleton Loading States
**New file:** `components/ui/SkeletonPatterns.tsx`

Create reusable skeleton patterns:
- `JobCardSkeleton` — mimics a job list item (title bar + 2 lines + status pill)
- `DashboardCardSkeleton` — mimics a stat card (icon circle + number + label)
- `TableRowSkeleton` — mimics a table row
- `ListSkeleton` — renders N of a given skeleton

Use Tailwind's `animate-pulse` with `bg-[var(--surface-2)]` and `rounded` shapes.
Each skeleton should be a simple div layout matching the approximate shape of the real content.

## Feature 5: Command Palette (Cmd+K)
**New file:** `components/CommandPalette.tsx`
**Modify:** `components/layout/AuthenticatedApp.tsx` (add to layout + keyboard listener)

Implementation:
- Fixed overlay, centered modal, z-50
- Search input at top with autofocus
- List of actions filtered by search text
- Actions: navigation items (Dashboard, Jobs, Customers, Inventory, etc.) + quick actions (New Job, New Customer)
- Each action has: icon (LucideIcon), label, optional shortcut text, onSelect (navigate or action)
- Keyboard: Arrow up/down to navigate, Enter to select, Escape to close
- Open with Cmd+K (Mac) / Ctrl+K (Windows)
- Style: `bg-[var(--surface)]` with `backdrop-blur-xl`, border, shadow-xl, rounded-2xl
- Search icon in the input, items highlight on hover/active
- Import `useNavigate` from react-router-dom for navigation actions
- Filter items by fuzzy matching label against search text (simple .toLowerCase().includes())
- Role-aware: only show items the user has access to (use the same role checks as sidebar)

In AuthenticatedApp.tsx:
- Add state `const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)`
- Add useEffect with keydown listener for Cmd+K / Ctrl+K
- Render `<CommandPalette>` conditionally
- Pass currentUser for role-based filtering
- Also add a search icon button in the TopHeader for mobile users (they can't Cmd+K)

## Feature 6: Empty States
**New file:** `components/ui/EmptyState.tsx`

Generic empty state component:
```tsx
interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionTo?: string; // Link destination
  onAction?: () => void; // Or callback
}
```
- Centered layout, icon in a large circle (w-16 h-16, bg-[var(--accent-subtle)], text-[var(--accent)])
- Title in font-semibold text-lg, description in text-theme-muted
- Optional action button (bg-[var(--accent)] text-white rounded-xl px-6 py-3)
- Add padding py-16 for breathing room

Apply to these pages (replace existing "No X found" text):
- `pages/Customers/Customers.tsx` → icon: Building2, "No customers yet", "Add your first customer"
- `pages/InventoryPage/components/PartsTable.tsx` → icon: Package, "No parts found"
- `pages/StoreQueue/StoreQueuePage.tsx` → icon: CheckCircle, "All caught up!", "No pending approvals 🎉"

## Feature 7: Page Transitions
**New file:** `components/ui/PageTransition.tsx`

CSS-only page transition wrapper:
```tsx
const PageTransition: React.FC<{ children: ReactNode }> = ({ children }) => (
  <div className="animate-page-enter">{children}</div>
);
```

Add to `index.css`:
```css
@keyframes page-enter {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-page-enter {
  animation: page-enter 0.2s ease-out;
}
```

Wrap main route content in AuthenticatedApp's `<Routes>` area. Add this wrapper around the `<Suspense>` fallback and the routes container.

## Feature 8: Toast Position on Mobile
**Modify:** `components/layout/AuthenticatedApp.tsx`

Change the `<Toaster>` component:
- Current: `position="top-right"`
- Change to: `position="bottom-center"` with className that adds `mb-20` on mobile (above bottom nav)
- Use Sonner's built-in responsive positioning OR conditionally set position

Simplest approach: change to `position="bottom-center"` and add `toastOptions={{ className: 'text-sm mb-20 sm:mb-0' }}`
This puts toasts above the bottom nav on mobile and normal on desktop.

## Feature 9: Table/Card View Toggle
**New file:** `components/ui/ViewToggle.tsx`

Simple toggle component:
```tsx
interface ViewToggleProps {
  view: 'table' | 'card';
  onChange: (view: 'table' | 'card') => void;
}
```
- Two icon buttons: `LayoutGrid` (card) and `List` (table) from lucide-react
- Active state: `bg-[var(--accent-subtle)] text-[var(--accent)]`
- Inactive: `text-theme-muted hover:bg-theme-surface-2`
- Rounded-lg border border-theme, flex row, p-1 gap-1

This is just the toggle component. Actual integration into Jobs/Inventory pages would be a separate task.
Leave it as a standalone reusable component for now.

---

## Rules for All Agents
1. Run `npm run build` after ALL changes — must pass
2. Use existing theme vars and Tailwind classes (check index.css)
3. Do NOT install new npm packages
4. Do NOT modify files not listed in your feature spec
5. Keep components under 200 lines
6. TypeScript strict — no `any`, no unused vars
