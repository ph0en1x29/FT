# FT Mobile V2 — Role-Aware UX Improvements

## 1. Role-Aware Bottom Navigation

File: `components/layout/AuthenticatedApp.tsx` → `MobileNav` component

Replace the current fixed bottom nav with role-specific icons:

**Technician:**
- Home (dashboard) | Jobs | Van Stock | More
- Van Stock replaces "Clients" (techs don't manage customers on-site)

**Supervisor:**
- Home | Jobs | Approvals | More  
- Approvals = `/jobs?tab=approvals` (StoreQueue)

**Admin / Admin Service / Admin Store:**
- Home | Jobs | Inventory | More
- Keep current layout mostly, but add notification badge on Inventory

**Accountant:**
- Home | Jobs | Billing | More
- Billing = `/invoices`

Implementation:
```tsx
// In MobileNav, use navRole to determine which 3 middle icons to show
const getNavItems = (navRole: UserRole, permissions: object) => {
  switch(navRole) {
    case 'technician':
      return [
        { to: '/', icon: LayoutDashboard, label: 'Home' },
        { to: '/jobs', icon: List, label: 'Jobs' },
        { to: '/my-van-stock', icon: Package, label: 'Van' },
      ];
    case 'supervisor':
      return [
        { to: '/', icon: LayoutDashboard, label: 'Home' },
        { to: '/jobs', icon: List, label: 'Jobs' },
        { to: '/jobs?tab=approvals', icon: PackageCheck, label: 'Approvals' },
      ];
    case 'accountant':
      return [
        { to: '/', icon: LayoutDashboard, label: 'Home' },
        { to: '/jobs', icon: List, label: 'Jobs' },
        { to: '/invoices', icon: FileText, label: 'Billing' },
      ];
    default: // admin variants
      return [
        { to: '/', icon: LayoutDashboard, label: 'Home' },
        { to: '/jobs', icon: List, label: 'Jobs' },
        { to: '/inventory', icon: Package, label: 'Inventory' },
      ];
  }
};
```

## 2. Floating Action Button (FAB)

New file: `components/mobile/FloatingActionButton.tsx`

A circular button in bottom-right (above bottom nav) that expands into role-specific quick actions.

**Design:**
- Position: `fixed bottom-20 right-4 z-40 md:hidden`
- Primary button: 56px circle, accent color, "+" icon
- On tap: expands upward showing 2-3 action buttons with labels
- Backdrop blur overlay when expanded

**Role actions:**

Technician:
- 📷 Add Photo → navigates to current job's photo section (or opens camera)
- 🔧 Request Part → opens CreateRequestModal
- ⏱ Timer → starts/stops job timer

Supervisor:
- ✅ Approvals → /jobs?tab=approvals
- 📋 Assign Job → /jobs (with assign filter)

Admin:
- ➕ New Job → /jobs/new
- ✅ Approvals → /jobs?tab=approvals
- 📦 Inventory → /inventory

Accountant:
- 📄 New Invoice → /invoices (with create action)

**Props:** `currentUser: User` (to determine role), `currentJobId?: string` (for tech context actions)

## 3. Pull-to-Refresh

New hook: `hooks/usePullToRefresh.ts`

Simple implementation using touch events:
- Track touchstart/touchmove/touchend
- If at scroll top and pulling down > 60px threshold, trigger refresh callback
- Show a spinner indicator at top while refreshing
- Works on any scrollable container

Usage in JobsTabs, Inventory, Customers, etc:
```tsx
const { pullToRefreshProps, isRefreshing, PullIndicator } = usePullToRefresh(refetchData);
return (
  <div {...pullToRefreshProps}>
    <PullIndicator />
    {/* page content */}
  </div>
);
```

## 4. Bottom Sheet Modals

New file: `components/mobile/BottomSheet.tsx`

Replace centered modals with slide-up bottom sheets on mobile.

**Design:**
- On mobile (`md:hidden`): slides up from bottom, rounded top corners, drag handle
- On desktop (`hidden md:block`): normal centered modal (keep existing)
- Max height: 85vh, scrollable content
- Drag down to dismiss (touch gesture)
- Backdrop with blur

**Props:**
```tsx
interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxHeight?: string; // default '85vh'
}
```

## 5. Notification Badges on Bottom Nav

In MobileNav, add badge dots/counts for:
- Technician: unread notifications count on Jobs icon
- Supervisor/Admin: pending approvals count on Approvals/Inventory icon

Use the existing notification context or a simple query:
```tsx
// Small red dot or count badge
const Badge = ({ count }: { count: number }) => count > 0 ? (
  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
    {count > 9 ? '9+' : count}
  </span>
) : null;
```

## 6. Sticky Action Bar on JobDetail

File: `pages/JobDetail/JobDetailPage.tsx`

On mobile, add a sticky bottom action bar (above the bottom nav):
- Position: `fixed bottom-16 left-0 right-0 z-30 md:hidden`
- Background: surface with blur
- Shows primary actions based on job status:
  - New/Assigned: "Start Job" button
  - In Progress: "Complete Job" | "Add Photo" | "Request Part"  
  - Completed: "Generate Report"

## 7. Swipe Actions on List Items

New file: `components/mobile/SwipeableRow.tsx`

Wrap list items to enable swipe gestures:
- Swipe right: primary action (green) — Approve / Start
- Swipe left: secondary action (red) — Reject / Delete
- 60px threshold to trigger
- Smooth spring animation

Usage:
```tsx
<SwipeableRow
  onSwipeRight={() => handleApprove(item.id)}
  onSwipeLeft={() => handleReject(item.id)}
  rightLabel="Approve"
  leftLabel="Reject"
  rightColor="bg-green-500"
  leftColor="bg-red-500"
>
  <ApprovalCard {...item} />
</SwipeableRow>
```

Use in: StoreQueue approvals, job lists

## Important Rules
- All new components go in `components/mobile/`
- All must be `md:hidden` (desktop unchanged)
- Use existing Tailwind classes and CSS variables
- No new dependencies
- Must pass `npm run build`
- Touch targets minimum 44px
