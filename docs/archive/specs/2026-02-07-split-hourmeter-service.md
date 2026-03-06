# Split hourmeterService.ts Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Split the 678-line `services/hourmeterService.ts` into three focused files under 300 lines each, then update the barrel to re-export everything.

**Architecture:** Extract functions by domain into `hourmeterCrudService.ts` (readings + validation + helpers), `hourmeterAmendmentService.ts` (amendment CRUD + approval/rejection), and `hourmeterFleetService.ts` (fleet predictions + dashboard + automation). The original `hourmeterService.ts` becomes a thin re-export barrel.

**Tech Stack:** TypeScript, Supabase client

---

## Consumers to preserve

These files import from `hourmeterService`:
- `components/hourmeter/HourmeterReadingForm.tsx` → `recordHourmeterReading`
- `components/hourmeter/ServicePredictionCard.tsx` → `formatDaysRemaining`, `getUrgencyColor`
- `components/hourmeter/ServicePredictionDashboard.tsx` → `getServicePredictionDashboard`
- `services/forkliftService.ts` → `approveHourmeterAmendment`, `createHourmeterAmendment`, `flagJobHourmeter`, `getForkliftHourmeterHistory`, `getForkliftsDueForService`, `getForkliftServicePredictions`, `getHourmeterAmendments`, `getJobHourmeterAmendment`, `getServicePredictionDashboard`, `rejectHourmeterAmendment`, `runDailyServiceCheck`, `validateHourmeterReading`

All existing imports from `hourmeterService` will continue to work because the barrel re-exports everything.

---

### Task 1: Create `services/hourmeterCrudService.ts`

**Files:**
- Create: `services/hourmeterCrudService.ts`

This file gets: readings CRUD, validation, flagging, and helper functions.

**Step 1: Create the file with these functions extracted from hourmeterService.ts**

Functions to move (copy from source lines):
- `getForkliftHourmeterHistory` (lines 27-42)
- `flagJobHourmeter` (lines 210-219)
- `validateHourmeterReading` (lines 221-251)
- `recordHourmeterReading` (lines 260-304)
- `getHourmeterReadings` (lines 309-327)
- `calculateServicePrediction` (lines 333-395)
- `requiresHourmeterTracking` (lines 536-539)
- `formatDaysRemaining` (lines 544-550)
- `getUrgencyColor` (lines 555-566)

```typescript
/**
 * Hourmeter CRUD Service
 *
 * Handles hourmeter readings, validation, flagging, and helpers.
 */

import type {
  ForkliftType,
  HourmeterFlagReason,
  HourmeterReading,
  ServicePrediction
} from '../types';
import { logDebug, logError, supabase } from './supabaseClient';

// =============================================
// HOURMETER HISTORY
// =============================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getForkliftHourmeterHistory = async (forkliftId: string): Promise<any[]> => {
  // ... (exact copy from lines 28-42)
};

// =============================================
// HOURMETER FLAGGING & VALIDATION
// =============================================

export const flagJobHourmeter = async (jobId: string, flagReasons: HourmeterFlagReason[]): Promise<void> => {
  // ... (exact copy from lines 211-219)
};

export const validateHourmeterReading = async (
  forkliftId: string,
  newReading: number
): Promise<{ isValid: boolean; flags: HourmeterFlagReason[] }> => {
  // ... (exact copy from lines 222-251)
};

// =============================================
// HOURMETER READINGS
// =============================================

export async function recordHourmeterReading(params: {
  forklift_id: string;
  hourmeter_value: number;
  recorded_by_id?: string;
  recorded_by_name?: string;
  job_id?: string;
  is_service_reading?: boolean;
  notes?: string;
}): Promise<{ data: HourmeterReading | null; error: Error | null }> {
  // ... (exact copy from lines 269-304)
}

export async function getHourmeterReadings(
  forklift_id: string,
  limit = 50
): Promise<{ data: HourmeterReading[] | null; error: Error | null }> {
  // ... (exact copy from lines 313-327)
}

export function calculateServicePrediction(
  currentHourmeter: number,
  lastServiceHourmeter: number,
  lastServiceDate: string | undefined,
  serviceInterval: number,
  readings: HourmeterReading[] = []
): ServicePrediction | null {
  // ... (exact copy from lines 340-395)
}

// =============================================
// HELPERS
// =============================================

export function requiresHourmeterTracking(type: ForkliftType | string): boolean {
  const engineTypes = ['Diesel', 'LPG', 'Petrol'];
  return engineTypes.includes(type);
}

export function formatDaysRemaining(days: number): string {
  if (days <= 0) return 'Overdue';
  if (days === 1) return '1 day';
  if (days < 7) return `${days} days`;
  if (days < 14) return `${Math.floor(days / 7)} week`;
  return `${Math.floor(days / 7)} weeks`;
}

export function getUrgencyColor(urgency: string): string {
  switch (urgency) {
    case 'overdue':
      return 'text-red-600 bg-red-100';
    case 'due_soon':
      return 'text-orange-600 bg-orange-100';
    case 'upcoming':
      return 'text-yellow-600 bg-yellow-100';
    default:
      return 'text-green-600 bg-green-100';
  }
}
```

**Expected line count:** ~170 lines

**Step 2: Verify file is under 300 lines**

Run: `wc -l services/hourmeterCrudService.ts`

---

### Task 2: Create `services/hourmeterAmendmentService.ts`

**Files:**
- Create: `services/hourmeterAmendmentService.ts`

Functions to move:
- `getHourmeterAmendments` (lines 48-72)
- `createHourmeterAmendment` (lines 74-102)
- `approveHourmeterAmendment` (lines 104-160)
- `rejectHourmeterAmendment` (lines 162-184)
- `getJobHourmeterAmendment` (lines 186-204)

```typescript
/**
 * Hourmeter Amendment Service
 *
 * Handles amendment CRUD and approval/rejection workflow.
 */

import type {
  HourmeterAmendment,
  HourmeterAmendmentStatus,
  HourmeterFlagReason,
} from '../types';
import { supabase } from './supabaseClient';

// ... all 5 functions, exact copies from source
```

**Expected line count:** ~150 lines

**Step 3: Verify file is under 300 lines**

Run: `wc -l services/hourmeterAmendmentService.ts`

---

### Task 3: Create `services/hourmeterFleetService.ts`

**Files:**
- Create: `services/hourmeterFleetService.ts`

Functions to move:
- `getServicePrediction` (lines 400-424)
- `getForkliftServicePredictions` (lines 429-445)
- `getServicePredictionDashboard` (lines 450-472)
- `completeForkliftService` (lines 477-503)
- `updateServiceInterval` (lines 508-527)
- `getForkliftsDueForService` (lines 576-597)
- `runDailyServiceCheck` (lines 602-678)

```typescript
/**
 * Hourmeter Fleet Service
 *
 * Fleet-level service predictions, dashboard, and automation.
 */

import type {
  ForkliftWithPrediction,
  ServicePrediction,
  ServicePredictionDashboard,
} from '../types';
import { logDebug, logError, supabase } from './supabaseClient';

// ... all 7 functions, exact copies from source
```

**Expected line count:** ~230 lines

**Step 4: Verify file is under 300 lines**

Run: `wc -l services/hourmeterFleetService.ts`

---

### Task 4: Replace `hourmeterService.ts` with barrel re-exports

**Files:**
- Modify: `services/hourmeterService.ts` (replace entire content)

```typescript
/**
 * Hourmeter Service (barrel)
 *
 * Re-exports from:
 * - hourmeterCrudService: readings, validation, flagging, helpers
 * - hourmeterAmendmentService: amendment CRUD and approval workflow
 * - hourmeterFleetService: fleet predictions, dashboard, automation
 */

// CRUD: readings, validation, flagging, helpers
export {
  calculateServicePrediction,
  flagJobHourmeter,
  formatDaysRemaining,
  getForkliftHourmeterHistory,
  getHourmeterReadings,
  getUrgencyColor,
  recordHourmeterReading,
  requiresHourmeterTracking,
  validateHourmeterReading,
} from './hourmeterCrudService';

// Amendments: CRUD and approval workflow
export {
  approveHourmeterAmendment,
  createHourmeterAmendment,
  getHourmeterAmendments,
  getJobHourmeterAmendment,
  rejectHourmeterAmendment,
} from './hourmeterAmendmentService';

// Fleet: predictions, dashboard, automation
export {
  completeForkliftService,
  getForkliftsDueForService,
  getForkliftServicePredictions,
  getServicePrediction,
  getServicePredictionDashboard,
  runDailyServiceCheck,
  updateServiceInterval,
} from './hourmeterFleetService';
```

**Expected line count:** ~45 lines (well under 300 — remove `/* eslint-disable max-lines */`)

---

### Task 5: Build verification

**Step 1: Run build**

Run: `npm run build`
Expected: Clean build with no errors

**Step 2: If errors, fix import issues**

Common issues to check:
- Missing type imports in new files
- Incorrect relative paths

**Step 3: Commit**

```bash
git add services/hourmeterCrudService.ts services/hourmeterAmendmentService.ts services/hourmeterFleetService.ts services/hourmeterService.ts
git commit -m "refactor: split hourmeterService.ts into three focused files

Extract 678-line file into:
- hourmeterCrudService.ts: readings, validation, flagging, helpers
- hourmeterAmendmentService.ts: amendment CRUD and approval workflow
- hourmeterFleetService.ts: fleet predictions, dashboard, automation

Original hourmeterService.ts becomes a thin re-export barrel.
All existing imports preserved via barrel re-exports."
```
