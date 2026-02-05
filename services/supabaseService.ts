/**
 * Supabase Service - Re-export Barrel
 * 
 * This file maintains backward compatibility by re-exporting all functions
 * from the split service modules. Existing imports from supabaseService.ts
 * will continue to work.
 * 
 * Service Modules:
 * - supabaseClient.ts: Client init, helpers, query profiles
 * - authService.ts: Authentication
 * - userService.ts: User management
 * - customerService.ts: Customer CRUD
 * - forkliftService.ts: Fleet management, rentals, service scheduling
 * - inventoryService.ts: Parts, van stock
 * - notificationService.ts: Notifications
 * - jobService.ts: Job operations
 */

// =====================
// RE-EXPORTS FROM SUPABASE CLIENT
// =====================

export { 
  supabase,
  logDebug,
  logError,
  wait,
  isNetworkError,
  dataURLtoBlob,
  uploadToStorage,
  JOB_SELECT,
  MALAYSIA_TZ,
  getMalaysiaTime,
  formatDateMalaysia,
  isSundayMalaysia,
  isHolidayMalaysia,
  getNextBusinessDay8AM,
  addBusinessDaysMalaysia
} from './supabaseClient';

// =====================
// RE-EXPORTS FROM AUTH SERVICE
// =====================

export {
  login,
  getUserByAuthId,
  fetchUserByAuthId,
  getSession,
  logout,
  onAuthStateChange
} from './authService';

// =====================
// RE-EXPORTS FROM USER SERVICE
// =====================

export {
  getUsers,
  getUsersLightweight,
  getTechnicians,
  getAccountants,
  getAdminsAndSupervisors,
  createUser,
  updateUser
} from './userService';

// =====================
// RE-EXPORTS FROM CUSTOMER SERVICE
// =====================

export {
  getCustomers,
  getCustomersForList,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerFinancialSummary,
  getCustomerJobsWithCancelled
} from './customerService';

// =====================
// RE-EXPORTS FROM FORKLIFT SERVICE
// =====================

export {
  // Forklift CRUD
  getForklifts,
  getForkliftsForList,
  getForkliftById,
  getForkliftWithCustomer,
  getForkliftsWithCustomers,
  createForklift,
  updateForklift,
  deleteForklift,
  updateForkliftHourmeter,
  // Rentals
  getActiveRentalForForklift,
  getRentals,
  getForkliftRentals,
  getCustomerRentals,
  getCustomerActiveRentals,
  assignForkliftToCustomer,
  endRental,
  updateRental,
  updateRentalRate,
  bulkAssignForkliftsToCustomer,
  bulkEndRentals,
  // Service History
  getForkliftServiceHistory,
  getForkliftServiceHistoryWithCancelled,
  // Hourmeter
  getForkliftHourmeterHistory,
  getHourmeterAmendments,
  createHourmeterAmendment,
  approveHourmeterAmendment,
  rejectHourmeterAmendment,
  getJobHourmeterAmendment,
  flagJobHourmeter,
  validateHourmeterReading,
  // Scheduled Services
  getScheduledServices,
  getUpcomingServices,
  createScheduledService,
  updateScheduledService,
  // Service Intervals
  getServiceIntervals,
  getServiceIntervalsByType,
  createServiceInterval,
  updateServiceInterval,
  deleteServiceInterval,
  hardDeleteServiceInterval
} from './forkliftService';

// =====================
// RE-EXPORTS FROM INVENTORY SERVICE
// =====================

export {
  // Parts
  getParts,
  getPartsForList,
  createPart,
  updatePart,
  deletePart,
  // Van Stock
  getAllVanStocks,
  getVanStockByTechnician,
  getVanStockById,
  createVanStock,
  updateVanStock,
  deleteVanStock,
  transferVanStockItems,
  addVanStockItem,
  updateVanStockItemQuantity,
  useVanStockPart,
  getPendingVanStockApprovals,
  approveVanStockUsage,
  rejectVanStockUsage,
  // Replenishment
  createReplenishmentRequest,
  getReplenishmentRequests,
  approveReplenishmentRequest,
  fulfillReplenishment,
  confirmReplenishmentReceipt,
  getLowStockItems,
  scheduleVanStockAudit,
  getVanStockUsageHistory
} from './inventoryService';

// =====================
// RE-EXPORTS FROM NOTIFICATION SERVICE
// =====================

export {
  getNotifications,
  getUnreadNotificationCount,
  createNotification,
  markNotificationRead,
  markAllNotificationsRead,
  notifyJobAssignment,
  notifyPendingFinalization,
  notifyAdminsOfRequest,
  notifyRequestApproved,
  notifyRequestRejected,
  notifyJobReassigned,
  notifyJobRejectedByTech,
  notifyNoResponseFromTech
} from './notificationService';

// =====================
// RE-EXPORTS FROM JOB SERVICE
// =====================

export {
  // Job CRUD
  getJobs,
  getJobsLightweight,
  getJobById,
  getJobByIdFast,
  createJob,
  updateJob,
  assignJob,
  updateJobStatus,
  deleteJob,
  getRecentlyDeletedJobs,
  hardDeleteJob,
  // Job Accept/Reject
  acceptJobAssignment,
  rejectJobAssignment,
  checkExpiredJobResponses,
  getJobsPendingResponse,
  // Job Operations
  updateJobHourmeter,
  addNote,
  addPartToJob,
  addMedia,
  signJob,
  updatePartPrice,
  removePartFromJob,
  updateLaborCost,
  addExtraCharge,
  removeExtraCharge,
  finalizeInvoice,
  sendInvoice,
  generateInvoiceText,
  // Job Condition & Checklist
  updateJobConditionChecklist,
  updateJobCarriedOut,
  updateConditionChecklist,
  setNoPartsUsed,
  getJobServiceRecord,
  updateJobRepairTimes,
  startJobWithCondition,
  // Job Reassignment
  reassignJob,
  // Job Assignments (Helper)
  getJobAssignments,
  getActiveHelper,
  assignHelper,
  removeHelper,
  startHelperWork,
  endHelperWork,
  getHelperJobs,
  isUserHelperOnJob,
  getUserAssignmentType,
  // Job Requests
  createJobRequest,
  updateJobRequest,
  getJobRequests,
  getPendingRequests,
  approveSparePartRequest,
  rejectRequest,
  acknowledgeSkillfulTechRequest,
  approveAssistanceRequest,
  getRequestCounts,
  // Job Locking
  acquireJobLock,
  releaseJobLock,
  checkJobLock,
  cleanupExpiredLocks
} from './jobService';

// =====================
// BACKWARD COMPATIBILITY: SupabaseDb object
// =====================

// Import all functions to build the SupabaseDb object
import * as auth from './authService';
import * as users from './userService';
import * as customers from './customerService';
import * as forklifts from './forkliftService';
import * as inventory from './inventoryService';
import * as notifications from './notificationService';
import * as jobs from './jobService';

/**
 * SupabaseDb - Legacy compatibility object
 * 
 * This object maintains backward compatibility with existing code that uses
 * SupabaseDb.methodName() pattern. New code should prefer direct imports.
 */
export const SupabaseDb = {
  // Auth
  login: auth.login,
  getUserByAuthId: auth.getUserByAuthId,

  // Users
  getUsers: users.getUsers,
  getUsersLightweight: users.getUsersLightweight,
  getTechnicians: users.getTechnicians,
  getAccountants: users.getAccountants,
  getAdminsAndSupervisors: users.getAdminsAndSupervisors,
  createUser: users.createUser,
  updateUser: users.updateUser,

  // Customers
  getCustomers: customers.getCustomers,
  getCustomersForList: customers.getCustomersForList,
  createCustomer: customers.createCustomer,
  updateCustomer: customers.updateCustomer,
  deleteCustomer: customers.deleteCustomer,
  getCustomerFinancialSummary: customers.getCustomerFinancialSummary,
  getCustomerJobsWithCancelled: customers.getCustomerJobsWithCancelled,

  // Forklifts
  getForklifts: forklifts.getForklifts,
  getForkliftsForList: forklifts.getForkliftsForList,
  getForkliftById: forklifts.getForkliftById,
  getForkliftWithCustomer: forklifts.getForkliftWithCustomer,
  getForkliftsWithCustomers: forklifts.getForkliftsWithCustomers,
  createForklift: forklifts.createForklift,
  updateForklift: forklifts.updateForklift,
  deleteForklift: forklifts.deleteForklift,
  updateForkliftHourmeter: forklifts.updateForkliftHourmeter,
  getActiveRentalForForklift: forklifts.getActiveRentalForForklift,
  getRentals: forklifts.getRentals,
  getForkliftRentals: forklifts.getForkliftRentals,
  getCustomerRentals: forklifts.getCustomerRentals,
  getCustomerActiveRentals: forklifts.getCustomerActiveRentals,
  assignForkliftToCustomer: forklifts.assignForkliftToCustomer,
  endRental: forklifts.endRental,
  updateRental: forklifts.updateRental,
  updateRentalRate: forklifts.updateRentalRate,
  bulkAssignForkliftsToCustomer: forklifts.bulkAssignForkliftsToCustomer,
  bulkEndRentals: forklifts.bulkEndRentals,
  getForkliftServiceHistory: forklifts.getForkliftServiceHistory,
  getForkliftServiceHistoryWithCancelled: forklifts.getForkliftServiceHistoryWithCancelled,
  getForkliftHourmeterHistory: forklifts.getForkliftHourmeterHistory,
  getHourmeterAmendments: forklifts.getHourmeterAmendments,
  createHourmeterAmendment: forklifts.createHourmeterAmendment,
  approveHourmeterAmendment: forklifts.approveHourmeterAmendment,
  rejectHourmeterAmendment: forklifts.rejectHourmeterAmendment,
  getJobHourmeterAmendment: forklifts.getJobHourmeterAmendment,
  flagJobHourmeter: forklifts.flagJobHourmeter,
  validateHourmeterReading: forklifts.validateHourmeterReading,
  getScheduledServices: forklifts.getScheduledServices,
  getUpcomingServices: forklifts.getUpcomingServices,
  createScheduledService: forklifts.createScheduledService,
  updateScheduledService: forklifts.updateScheduledService,
  getServiceIntervals: forklifts.getServiceIntervals,
  getServiceIntervalsByType: forklifts.getServiceIntervalsByType,
  createServiceInterval: forklifts.createServiceInterval,
  updateServiceInterval: forklifts.updateServiceInterval,
  deleteServiceInterval: forklifts.deleteServiceInterval,
  hardDeleteServiceInterval: forklifts.hardDeleteServiceInterval,
  // Service prediction automation
  getForkliftsDueForService: forklifts.getForkliftsDueForService,
  runDailyServiceCheck: forklifts.runDailyServiceCheck,
  getServicePredictionDashboard: forklifts.getServicePredictionDashboard,
  getForkliftServicePredictions: forklifts.getForkliftServicePredictions,

  // Inventory
  getParts: inventory.getParts,
  getPartsForList: inventory.getPartsForList,
  createPart: inventory.createPart,
  updatePart: inventory.updatePart,
  deletePart: inventory.deletePart,
  getAllVanStocks: inventory.getAllVanStocks,
  getVanStockByTechnician: inventory.getVanStockByTechnician,
  getVanStockById: inventory.getVanStockById,
  createVanStock: inventory.createVanStock,
  updateVanStock: inventory.updateVanStock,
  deleteVanStock: inventory.deleteVanStock,
  transferVanStockItems: inventory.transferVanStockItems,
  addVanStockItem: inventory.addVanStockItem,
  updateVanStockItemQuantity: inventory.updateVanStockItemQuantity,
  useVanStockPart: inventory.useVanStockPart,
  getPendingVanStockApprovals: inventory.getPendingVanStockApprovals,
  approveVanStockUsage: inventory.approveVanStockUsage,
  rejectVanStockUsage: inventory.rejectVanStockUsage,
  createReplenishmentRequest: inventory.createReplenishmentRequest,
  getReplenishmentRequests: inventory.getReplenishmentRequests,
  approveReplenishmentRequest: inventory.approveReplenishmentRequest,
  fulfillReplenishment: inventory.fulfillReplenishment,
  confirmReplenishmentReceipt: inventory.confirmReplenishmentReceipt,
  getLowStockItems: inventory.getLowStockItems,
  scheduleVanStockAudit: inventory.scheduleVanStockAudit,
  getVanStockUsageHistory: inventory.getVanStockUsageHistory,

  // Notifications
  getNotifications: notifications.getNotifications,
  getUnreadNotificationCount: notifications.getUnreadNotificationCount,
  createNotification: notifications.createNotification,
  markNotificationRead: notifications.markNotificationRead,
  markAllNotificationsRead: notifications.markAllNotificationsRead,
  notifyJobAssignment: notifications.notifyJobAssignment,
  notifyPendingFinalization: notifications.notifyPendingFinalization,
  notifyAdminsOfRequest: notifications.notifyAdminsOfRequest,
  notifyRequestApproved: notifications.notifyRequestApproved,
  notifyRequestRejected: notifications.notifyRequestRejected,
  notifyJobReassigned: notifications.notifyJobReassigned,
  notifyJobRejectedByTech: notifications.notifyJobRejectedByTech,
  notifyNoResponseFromTech: notifications.notifyNoResponseFromTech,

  // Jobs
  getJobs: jobs.getJobs,
  getJobsLightweight: jobs.getJobsLightweight,
  getJobById: jobs.getJobById,
  getJobByIdFast: jobs.getJobByIdFast,
  createJob: jobs.createJob,
  updateJob: jobs.updateJob,
  assignJob: jobs.assignJob,
  updateJobStatus: jobs.updateJobStatus,
  deleteJob: jobs.deleteJob,
  getRecentlyDeletedJobs: jobs.getRecentlyDeletedJobs,
  hardDeleteJob: jobs.hardDeleteJob,
  acceptJobAssignment: jobs.acceptJobAssignment,
  rejectJobAssignment: jobs.rejectJobAssignment,
  checkExpiredJobResponses: jobs.checkExpiredJobResponses,
  getJobsPendingResponse: jobs.getJobsPendingResponse,
  updateJobHourmeter: jobs.updateJobHourmeter,
  addNote: jobs.addNote,
  addPartToJob: jobs.addPartToJob,
  addMedia: jobs.addMedia,
  signJob: jobs.signJob,
  updatePartPrice: jobs.updatePartPrice,
  removePartFromJob: jobs.removePartFromJob,
  updateLaborCost: jobs.updateLaborCost,
  addExtraCharge: jobs.addExtraCharge,
  removeExtraCharge: jobs.removeExtraCharge,
  finalizeInvoice: jobs.finalizeInvoice,
  sendInvoice: jobs.sendInvoice,
  generateInvoiceText: jobs.generateInvoiceText,
  updateJobConditionChecklist: jobs.updateJobConditionChecklist,
  updateJobCarriedOut: jobs.updateJobCarriedOut,
  updateConditionChecklist: jobs.updateConditionChecklist,
  setNoPartsUsed: jobs.setNoPartsUsed,
  getJobServiceRecord: jobs.getJobServiceRecord,
  updateJobRepairTimes: jobs.updateJobRepairTimes,
  startJobWithCondition: jobs.startJobWithCondition,
  reassignJob: jobs.reassignJob,
  getJobAssignments: jobs.getJobAssignments,
  getActiveHelper: jobs.getActiveHelper,
  assignHelper: jobs.assignHelper,
  removeHelper: jobs.removeHelper,
  startHelperWork: jobs.startHelperWork,
  endHelperWork: jobs.endHelperWork,
  getHelperJobs: jobs.getHelperJobs,
  isUserHelperOnJob: jobs.isUserHelperOnJob,
  getUserAssignmentType: jobs.getUserAssignmentType,
  createJobRequest: jobs.createJobRequest,
  updateJobRequest: jobs.updateJobRequest,
  getJobRequests: jobs.getJobRequests,
  getPendingRequests: jobs.getPendingRequests,
  approveSparePartRequest: jobs.approveSparePartRequest,
  rejectRequest: jobs.rejectRequest,
  acknowledgeSkillfulTechRequest: jobs.acknowledgeSkillfulTechRequest,
  approveAssistanceRequest: jobs.approveAssistanceRequest,
  getRequestCounts: jobs.getRequestCounts,
  acquireJobLock: jobs.acquireJobLock,
  releaseJobLock: jobs.releaseJobLock,
  checkJobLock: jobs.checkJobLock,
  cleanupExpiredLocks: jobs.cleanupExpiredLocks,
};
