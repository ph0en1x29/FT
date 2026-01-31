// This file re-exports from the modular MyVanStock folder for backward compatibility
// The component has been split into:
//   - pages/MyVanStock/MyVanStock.tsx (main component, ~170 lines)
//   - pages/MyVanStock/hooks/useVanStock.ts (state management)
//   - pages/MyVanStock/components/ (StatsCards, StockItemCard, StockItemsList, UsageHistoryTab)
export { default } from './MyVanStock/index';
