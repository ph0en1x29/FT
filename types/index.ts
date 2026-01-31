// =============================================
// TYPES INDEX - Barrel Export
// =============================================
// All types are split into domain-specific files for maintainability.
// This file re-exports everything to maintain backward compatibility.

// Common / Utility Types
export * from './common.types';

// User / Role / Permission Types
export * from './user.types';

// Customer Types
export * from './customer.types';

// Forklift / Rental / Service Types
export * from './forklift.types';

// Inventory / Parts / Van Stock Types
export * from './inventory.types';

// Job / Job Request / Job Parts Types
export * from './job.types';

// Notification Types
export * from './notification.types';

// HR System Types
export * from './hr.types';

// Integration Types (AutoCount)
export * from './integration.types';
