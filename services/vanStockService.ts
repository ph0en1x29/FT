/**
 * Van Stock Service
 *
 * Backward-compatible facade for van stock query, mutation, and usage operations.
 */

export {
  getActiveVansList,
  getAllVanStocks,
  getGlobalLowStockCount,
  getLowStockItems,
  getVanStockById,
  getVanStockByTechnician,
  getVanStockUsageHistory,
} from './vanStockQueriesService';
export {
  addVanStockItem,
  createVanStock,
  deleteVanStock,
  incrementVanStockItemQuantity,
  returnPartToStore,
  transferPartToVan,
  transferVanStockItems,
  updateVanStock,
  updateVanStockItemQuantity,
} from './vanStockMutationsService';
export {
  approveVanStockUsage,
  getPendingVanStockApprovals,
  rejectVanStockUsage,
  scheduleVanStockAudit,
  useVanStockPart,
} from './vanStockUsageService';
