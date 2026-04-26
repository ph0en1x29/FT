/**
 * Inventory Service
 *
 * Backward-compatible facade for inventory, replenishment, van stock, and van fleet operations.
 */

export { createPart, deletePart, getParts, getPartsForList, updatePart } from './partsService';
export { approveReplenishmentRequest, confirmReplenishmentReceipt, createReplenishmentRequest, fulfillReplenishment, getReplenishmentRequests } from './replenishmentService';
export {
  addVanStockItem,
  approveVanStockUsage,
  createVanStock,
  deleteVanStock,
  getActiveVansList,
  getAllVanStocks,
  getGlobalLowStockCount,
  getLowStockItems,
  getPendingVanStockApprovals,
  getVanStockById,
  getVanStockByTechnician,
  getVanStockUsageHistory,
  incrementVanStockItemQuantity,
  rejectVanStockUsage,
  returnPartToStore,
  scheduleVanStockAudit,
  transferPartToVan,
  transferVanStockItems,
  updateVanStock,
  updateVanStockItemQuantity,
  useVanStockPart,
} from './vanStockService';
export {
  assignTempTech,
  getPendingVanRequests,
  getVanAuditLog,
  getVanFleetOverview,
  removeTempTech,
  reviewVanAccessRequest,
  searchPartAcrossVans,
  submitVanAccessRequest,
  updateVanIdentification,
  updateVanStatus,
} from './vanFleetService';
