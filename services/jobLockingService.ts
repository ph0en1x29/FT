/**
 * Job Locking Service
 * 
 * Handles job locking for concurrent edit prevention.
 */

// =====================
// JOB LOCKING
// =====================

const _jobLocks: Record<string, { userId: string; userName: string; acquiredAt: Date }> = {};
const _lockTimeoutMs = 5 * 60 * 1000; // 5 minutes

export const acquireJobLock = async (
  jobId: string,
  userId: string,
  userName: string
): Promise<{ success: boolean; lockedBy?: string; lockedByName?: string; lockedAt?: Date }> => {
  const now = new Date();
  const existingLock = _jobLocks[jobId];

  if (existingLock) {
    const lockAge = now.getTime() - existingLock.acquiredAt.getTime();
    if (lockAge < _lockTimeoutMs) {
      if (existingLock.userId === userId) {
        // Refresh own lock
        _jobLocks[jobId] = { userId, userName, acquiredAt: now };
        return { success: true };
      } else {
        // Job is locked by someone else
        return {
          success: false,
          lockedBy: existingLock.userId,
          lockedByName: existingLock.userName,
          lockedAt: existingLock.acquiredAt
        };
      }
    }
    // Lock has expired, allow new lock
  }

  _jobLocks[jobId] = { userId, userName, acquiredAt: now };
  return { success: true };
};

export const releaseJobLock = async (jobId: string, userId: string): Promise<boolean> => {
  const existingLock = _jobLocks[jobId];
  if (!existingLock) return true;

  if (existingLock.userId === userId) {
    delete _jobLocks[jobId];
    return true;
  }

  return false; // Not your lock to release
};

export const checkJobLock = async (
  jobId: string,
  userId: string
): Promise<{ isLocked: boolean; lockedBy?: string; lockedByName?: string; lockedAt?: Date }> => {
  const now = new Date();
  const existingLock = _jobLocks[jobId];

  if (!existingLock) return { isLocked: false };

  const lockAge = now.getTime() - existingLock.acquiredAt.getTime();
  if (lockAge >= _lockTimeoutMs) {
    // Lock expired, clean it up
    delete _jobLocks[jobId];
    return { isLocked: false };
  }

  // If it's our own lock, not "locked" from our perspective
  if (existingLock.userId === userId) return { isLocked: false };

  return {
    isLocked: true,
    lockedBy: existingLock.userId,
    lockedByName: existingLock.userName,
    lockedAt: existingLock.acquiredAt
  };
};

export const cleanupExpiredLocks = async (): Promise<number> => {
  const now = new Date();
  let cleaned = 0;

  for (const jobId of Object.keys(_jobLocks)) {
    const lock = _jobLocks[jobId];
    const lockAge = now.getTime() - lock.acquiredAt.getTime();
    if (lockAge >= _lockTimeoutMs) {
      delete _jobLocks[jobId];
      cleaned++;
    }
  }

  return cleaned;
};

// For testing/admin purposes
export const getAllLocks = (): Record<string, { userId: string; userName: string; acquiredAt: Date }> => {
  return { ..._jobLocks };
};

export const forceReleaseLock = (jobId: string): boolean => {
  if (_jobLocks[jobId]) {
    delete _jobLocks[jobId];
    return true;
  }
  return false;
};
