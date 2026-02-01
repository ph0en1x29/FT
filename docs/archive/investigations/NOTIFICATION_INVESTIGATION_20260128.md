# FieldPro Notification System Investigation Report

**Date:** 2026-01-28  
**Priority:** HIGH (Customer complaints)  
**Investigator:** Phoenix

---

## Executive Summary

The notification system has **solid infrastructure** but suffers from several **configuration and UX issues** that cause users to miss notifications or perceive the system as broken.

| Issue | Severity | Fix Effort |
|-------|----------|------------|
| VAPID key not configured | 🔴 Critical | 30 min |
| Sound requires user interaction first | 🟡 Medium | 1-2 hours |
| No visual "new notification" animation | 🟡 Medium | 1 hour |
| Browser permission not explicitly requested | 🟡 Medium | 2 hours |
| Offline indicator not prominent enough | 🟢 Low | 30 min |

---

## 1. CRITICAL: Push Notifications Not Working (Server-Side)

### Problem
**VAPID key is NOT configured in environment variables.**

```bash
# Check result:
$ grep "VITE_VAPID" /home/jay/FT/.env*
NO VAPID KEY IN ENV
```

### Impact
- Push notifications to closed browser/app **DO NOT WORK**
- Service worker registered but can't receive server-sent push
- Only in-app real-time (Supabase) works

### Fix
```bash
# 1. Generate VAPID keys
npx web-push generate-vapid-keys

# 2. Add to .env or .env.local
VITE_VAPID_PUBLIC_KEY=<your-public-key>

# 3. Server-side: Configure push sending with private key
# (Requires backend changes to actually send push notifications)
```

### Current State
The code is ready (`pushNotificationService.ts`), but:
- No VAPID key = no real push notifications
- Only browser-open real-time works via Supabase

---

## 2. MEDIUM: Sound Notification Issues

### Problem
Audio context requires **user interaction before playing**.

```typescript
// From useRealtimeNotifications.ts
const initAudio = async () => {
  if (audioContext) return;
  audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  // ...
};

// Audio only initializes AFTER user click/touch:
document.addEventListener('click', handleInteraction);
document.addEventListener('touchstart', handleInteraction);
```

### Impact
1. **First notification** after page load → **NO SOUND**
2. Sound only works after user interacts with page
3. If user opens app and walks away → misses audio alert

### Fix Options

**Option A: Explicit "Enable Sound" Button (Recommended)**
```tsx
// Add to dashboard or notification settings
<button onClick={async () => {
  await initAudio();
  playTestSound();
  toast.success("Sound notifications enabled!");
}}>
  🔔 Enable Sound Notifications
</button>
```

**Option B: Auto-init on Permission Grant**
```typescript
// When user grants notification permission, also init audio
const handlePermissionGranted = async () => {
  await initAudio();
  // ... existing code
};
```

---

## 3. MEDIUM: Browser Notification Permission UX

### Problem
Permission prompt is **passive** - only triggered on first notification context load.

### Impact
- Users might dismiss or miss the permission prompt
- No clear UI showing notification status
- Users don't know they need to enable

### Current Behavior
```typescript
// NotificationContext.tsx
useEffect(() => {
  const initPush = async () => {
    const result = await initializePushNotifications();
    // ... passive init
  };
  initPush();
}, []);
```

### Fix: Add Explicit Permission UI

```tsx
// In TechnicianDashboard.tsx or header
const { pushSupported, pushPermission, requestPushPermission } = useNotifications();

{pushSupported && pushPermission !== 'granted' && (
  <div className="alert alert-info">
    <Bell className="animate-pulse" />
    <span>Enable notifications to receive job alerts!</span>
    <button onClick={requestPushPermission}>
      Enable Now
    </button>
  </div>
)}
```

---

## 4. MEDIUM: No Visual "New Notification" Animation

### Problem
When a notification arrives, the bell just shows a badge. No:
- Flash/pulse animation on the badge
- Screen flash
- Popup banner at top of screen

### Impact
Users looking at their screen might not notice new notifications.

### Fix: Add Prominent Animation

```tsx
// NotificationBell.tsx - Add pulse when new notification arrives
const [hasNewNotification, setHasNewNotification] = useState(false);

useEffect(() => {
  // When unread count increases
  if (unreadCount > prevCount) {
    setHasNewNotification(true);
    // Also show a toast banner at top
    toast.info("New notification!", { duration: 3000 });
    // Reset animation after 5 seconds
    setTimeout(() => setHasNewNotification(false), 5000);
  }
}, [unreadCount]);

// In JSX
<Bell className={`${hasNewNotification ? 'animate-bounce text-red-500' : ''}`} />
```

---

## 5. LOW: Connection Indicator Not Prominent

### Problem
The "Live" / "Offline" indicator is **tiny** and only visible when dropdown is open.

### Current
```tsx
// Inside dropdown header - hard to see
<div className="text-[10px]">
  {isConnected ? <Wifi /> : <WifiOff />}
  {isConnected ? 'Live' : 'Offline'}
</div>
```

### Fix: Show in Bell Area

```tsx
// Show connection status next to bell, always visible
<div className="relative">
  <Bell />
  {!isConnected && (
    <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" 
          title="Notifications offline" />
  )}
</div>
```

---

## 6. VERIFIED WORKING ✅

### Real-time Subscriptions
```typescript
// useRealtimeNotifications.ts subscribes to:
✅ notifications (INSERT for user)
✅ jobs (UPDATE/INSERT for assigned technician)
✅ job_requests (INSERT/UPDATE for admin/tech)
```

### Notification Creation
```typescript
// supabaseService.ts creates notifications on:
✅ Job assignment → notifyJobAssignment()
✅ Job reassignment → creates 2 notifications
✅ Request approval/rejection → creates notification
✅ Leave requests → creates notification
```

### RLS Policies
```sql
-- fix_notification_rls_v3.sql
✅ Users can SELECT their own notifications
✅ Users can UPDATE their own (mark read)
✅ Any authenticated can INSERT (for system)
✅ Realtime enabled via publication
```

### Toast Notifications
```typescript
// In-app toasts work via:
✅ Sonner toast library
✅ showToast.info/success/error/warning
✅ Triggered on new notification received
```

---

## 7. RECOMMENDED FIXES (Priority Order)

### Sprint 1 (This Week)

1. **Configure VAPID Key** — 30 min
   - Generate keys
   - Add to environment
   - Test push delivery

2. **Add "Enable Notifications" Banner** — 2 hours
   - Show on technician dashboard
   - Request both browser + sound permission
   - Persist preference

3. **Add Visual Pulse on New Notification** — 1 hour
   - Animate bell icon
   - Optional: shake/bounce animation
   - Toast banner at top

### Sprint 2 (Next Week)

4. **Add Sound Permission Button** — 1 hour
   - Explicit "Enable Sound" in settings
   - Test sound on enable

5. **Make Connection Indicator Visible** — 30 min
   - Show dot/icon next to bell
   - Red = offline warning

6. **Server-Side Push (Backend)** — 4-8 hours
   - Setup push notification server
   - Store subscriptions in DB
   - Send push from server on notification create

---

## 8. TESTING CHECKLIST

After fixes, verify:

| Test | Expected Result |
|------|-----------------|
| Fresh page load → notification arrives | Sound plays, toast shows, bell animates |
| App in background → job assigned | Push notification appears (system tray) |
| Offline then online | "Reconnected" indicator, missed notifications load |
| Permission denied | Clear message, alternative flow |
| Technician gets job assignment | Instant notification (< 2 seconds) |
| Admin approves request | Technician sees notification immediately |

---

## 9. CODE LOCATIONS

| Component | File |
|-----------|------|
| Push service | `services/pushNotificationService.ts` |
| Realtime hook | `utils/useRealtimeNotifications.ts` |
| Context | `contexts/NotificationContext.tsx` |
| Bell UI | `components/NotificationBell.tsx` |
| Dashboard card | `components/DashboardNotificationCard.tsx` |
| Settings | `components/NotificationSettings.tsx` |
| Service worker | `public/sw.js` |
| Toast service | `services/toastService.ts` |
| Notification creation | `services/supabaseService.ts` → `createNotification()` |

---

## 10. ENVIRONMENT REQUIREMENTS

```bash
# Required for full push notification support:
VITE_VAPID_PUBLIC_KEY=<generated-public-key>

# Server-side (for sending push):
VAPID_PRIVATE_KEY=<generated-private-key>
VAPID_SUBJECT=mailto:admin@fieldpro.my
```

---

*Report generated by Phoenix/Clawdbot*
