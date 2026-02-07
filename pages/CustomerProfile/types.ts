import React from 'react';
import { Customer, User, ForkliftRental, ForkliftServiceEntry, Forklift } from '../../types';

export interface CustomerProfileProps {
  currentUser: User;
}

export type RentalTab = 'active' | 'past';
export type ServiceTab = 'open' | 'completed' | 'all';

export interface ResultModalState {
  show: boolean;
  type: 'success' | 'error' | 'mixed';
  title: string;
  message: string;
  details?: string[];
}

export interface CustomerStats {
  totalJobs: number;
  totalServiceRevenue: number;
  totalRentalRevenue: number;
  totalRevenue: number;
  avgResponseTime: number;
  activeRentalsCount: number;
  completedJobsCount: number;
  avgJobValue: number;
  topIssues: [string, number][];
}

export interface CustomerHeaderProps {
  customer: Customer;
  isAdmin: boolean;
  isSupervisor: boolean;
  onNavigateBack: () => void;
  onRentForklift: () => void;
  onCreateJob: () => void;
  onEditCustomer: () => void;
  onDeleteCustomer: () => void;
}

export interface CustomerKPIStripProps {
  totalJobs: number;
  activeRentalsCount: number;
  totalServiceRevenue: number;
  totalRentalRevenue: number;
  totalRevenue: number;
}

export interface RentalsSectionProps {
  activeRentals: ForkliftRental[];
  pastRentals: ForkliftRental[];
  rentalTab: RentalTab;
  setRentalTab: (tab: RentalTab) => void;
  isSelectionMode: boolean;
  selectedRentalIds: Set<string>;
  isAdmin: boolean;
  onToggleSelectionMode: () => void;
  onToggleRentalSelection: (rentalId: string, e: React.MouseEvent) => void;
  onSelectAllActiveRentals: () => void;
  onDeselectAll: () => void;
  onOpenBulkEndModal: () => void;
  onEditRental: (rental: ForkliftRental) => void;
  onEndRental: (rentalId: string) => void;
  onNavigateToForklift: (forkliftId: string) => void;
}

export interface ServiceHistoryProps {
  activeJobs: ForkliftServiceEntry[];
  openJobs: ForkliftServiceEntry[];
  completedJobs: ForkliftServiceEntry[];
  cancelledJobs: ForkliftServiceEntry[];
  filteredJobs: ForkliftServiceEntry[];
  serviceTab: ServiceTab;
  setServiceTab: (tab: ServiceTab) => void;
  showCancelledJobs: boolean;
  setShowCancelledJobs: (show: boolean) => void;
  canViewCancelled: boolean;
  onNavigateToJob: (jobId: string) => void;
}

export interface InsightsSidebarProps {
  completedJobsCount: number;
  avgResponseTime: number;
  avgJobValue: number;
  topIssues: [string, number][];
}

export interface EditRentalModalProps {
  rental: ForkliftRental;
  isAdmin: boolean;
  onClose: () => void;
  onSave: (data: {
    startDate: string;
    endDate: string;
    notes: string;
    monthlyRate: string;
  }) => void;
}

export interface BulkEndRentalModalProps {
  selectedRentals: ForkliftRental[];
  bulkEndDate: string;
  setBulkEndDate: (date: string) => void;
  bulkProcessing: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export interface RentForkliftModalProps {
  customerName: string;
  availableForklifts: Forklift[];
  selectedForkliftIds: Set<string>;
  rentStartDate: string;
  rentEndDate: string;
  rentNotes: string;
  rentMonthlyRate: string;
  forkliftSearchQuery: string;
  rentProcessing: boolean;
  isAdmin: boolean;
  onClose: () => void;
  onToggleForklift: (forkliftId: string) => void;
  onSetStartDate: (date: string) => void;
  onSetEndDate: (date: string) => void;
  onSetNotes: (notes: string) => void;
  onSetMonthlyRate: (rate: string) => void;
  onSetSearchQuery: (query: string) => void;
  onConfirm: () => void;
}

export interface ResultModalProps {
  show: boolean;
  type: 'success' | 'error' | 'mixed';
  title: string;
  message: string;
  details?: string[];
  onClose: () => void;
}
