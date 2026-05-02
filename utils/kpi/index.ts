// KPI engine — pure functions for the spec in /home/jay/Downloads/KPI_SPEC.md.
// Phase 1 deliverable. Read tests/unit/kpi/*.spec.ts for usage examples.

export { deriveSessions, laborByTech } from './sessions';
export { awardJobPoints } from './points';
export type { AwardOptions } from './points';
export { computeAttendance } from './attendance';
export { computeMonthlyKpi, rankLeaderboard } from './monthly';
