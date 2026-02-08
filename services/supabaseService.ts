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
JOB_SELECT,
MALAYSIA_TZ,addBusinessDaysMalaysia,dataURLtoBlob,formatDateMalaysia,getMalaysiaTime,getNextBusinessDay8AM,isHolidayMalaysia,isNetworkError,isSundayMalaysia,logDebug,
logError,supabase,uploadToStorage,wait
} from './supabaseClient';

// =====================
// RE-EXPORTS FROM AUTH SERVICE
// =====================

export {
fetchUserByAuthId,
getSession,getUserByAuthId,login,logout,
onAuthStateChange
} from './authService';

// =====================
// RE-EXPORTS FROM USER SERVICE
// =====================

export {
createUser,getAccountants,
getAdminsAndSupervisors,getTechnicians,getUsers,
getUsersLightweight,updateUser
} from './userService';

// =====================
// RE-EXPORTS FROM CUSTOMER SERVICE
// =====================

export {
createCustomer,deleteCustomer,
getCustomerFinancialSummary,
getCustomerJobsWithCancelled,getCustomers,
getCustomersForList,updateCustomer
} from './customerService';

// =====================
// RE-EXPORTS FROM FORKLIFT SERVICE
// =====================

export {
approveHourmeterAmendment,assignForkliftToCustomer,bulkAssignForkliftsToCustomer,
bulkEndRentals,createForklift,createHourmeterAmendment,createScheduledService,createServiceInterval,deleteForklift,deleteServiceInterval,endRental,flagJobHourmeter,
// Rentals
getActiveRentalForForklift,getCustomerActiveRentals,getCustomerRentals,getForkliftById,
// Hourmeter
getForkliftHourmeterHistory,getForkliftRentals,
// Service History
getForkliftServiceHistory,
getForkliftServiceHistoryWithCancelled,getForkliftWithCustomer,
// Forklift CRUD
getForklifts,
getForkliftsForList,getForkliftsWithCustomers,getHourmeterAmendments,getJobHourmeterAmendment,getRentals,
// Scheduled Services
getScheduledServices,
// Service Intervals
getServiceIntervals,
getServiceIntervalsByType,getUpcomingServices,hardDeleteServiceInterval,rejectHourmeterAmendment,updateForklift,updateForkliftHourmeter,updateRental,
updateRentalRate,updateScheduledService,updateServiceInterval,validateHourmeterReading
} from './forkliftService';

// =====================
// RE-EXPORTS FROM INVENTORY SERVICE
// =====================

export {
addVanStockItem,approveReplenishmentRequest,approveVanStockUsage,confirmReplenishmentReceipt,createPart,
// Replenishment
createReplenishmentRequest,createVanStock,deletePart,deleteVanStock,fulfillReplenishment,
// Van Stock
getAllVanStocks,getLowStockItems,
// Parts
getParts,
getPartsForList,getPendingVanStockApprovals,getReplenishmentRequests,getVanStockById,getVanStockByTechnician,getVanStockUsageHistory,rejectVanStockUsage,scheduleVanStockAudit,transferVanStockItems,updatePart,updateVanStock,updateVanStockItemQuantity,
useVanStockPart
} from './inventoryService';

// =====================
// RE-EXPORTS FROM NOTIFICATION SERVICE
// =====================

export {
createNotification,getNotifications,
getUnreadNotificationCount,markAllNotificationsRead,markNotificationRead,notifyAdminsOfRequest,notifyJobAssignment,notifyJobReassigned,
notifyJobRejectedByTech,
notifyNoResponseFromTech,notifyPendingFinalization,notifyRequestApproved,
notifyRequestRejected
} from './notificationService';

// =====================
// RE-EXPORTS FROM JOB SERVICE
// =====================

export {
// Job Accept/Reject
acceptJobAssignment,acknowledgeSkillfulTechRequest,
// Job Locking
acquireJobLock,addExtraCharge,addMedia,addNote,
addPartToJob,approveAssistanceRequest,approveSparePartRequest,assignHelper,assignJob,checkExpiredJobResponses,checkJobLock,
cleanupExpiredLocks,createJob,
// Job Requests
createJobRequest,deleteJob,endHelperWork,finalizeInvoice,generateInvoiceText,getActiveHelper,getHelperJobs,
// Job Assignments (Helper)
getJobAssignments,getJobById,
getJobByIdFast,getJobRequests,getJobServiceRecord,
// Job CRUD
getJobs,
getJobsLightweight,getJobsPendingResponse,getPendingRequests,getRecentlyDeletedJobs,getRequestCounts,getUserAssignmentType,hardDeleteJob,isUserHelperOnJob,
// Job Reassignment
reassignJob,rejectJobAssignment,rejectRequest,releaseJobLock,removeExtraCharge,removeHelper,removePartFromJob,sendInvoice,setNoPartsUsed,signJob,startHelperWork,startJobWithCondition,updateConditionChecklist,updateJob,updateJobCarriedOut,
// Job Condition & Checklist
updateJobConditionChecklist,
// Job Operations
updateJobHourmeter,updateJobRepairTimes,updateJobRequest,updateJobStatus,updateLaborCost,updatePartPrice
} from './jobService';

// =====================
// BACKWARD COMPATIBILITY: SupabaseDb object
// =====================

// Import all functions to build the SupabaseDb object
import * as auth from './authService';
import * as customers from './customerService';
import * as forklifts from './forkliftService';
import * as inventory from './inventoryService';
import * as jobs from './jobService';
import * as notifications from './notificationService';
import * as users from './userService';

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

  // Multi-day job support
  markJobContinueTomorrow: jobs.markJobContinueTomorrow,
  resumeMultiDayJob: jobs.resumeMultiDayJob,

  // AutoCount integration (TODO)
  createAutoCountExport: jobs.createAutoCountExport,
  getAutoCountExports: jobs.getAutoCountExports,
  getJobsPendingExport: jobs.getJobsPendingExport,
  retryAutoCountExport: jobs.retryAutoCountExport,
  cancelAutoCountExport: jobs.cancelAutoCountExport,

  // Stub implementations (TODO)
  confirmParts: jobs.confirmParts,
  completeDeferredAcknowledgement: jobs.completeDeferredAcknowledgement,
};
