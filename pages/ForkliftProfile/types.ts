import { Forklift, ForkliftRental, User, Customer, ScheduledService, ForkliftServiceEntry } from '../../types';

export interface ForkliftProfileProps {
  currentUser: User;
}

export interface ForkliftProfileState {
  forklift: Forklift | null;
  rentals: ForkliftRental[];
  serviceHistory: ForkliftServiceEntry[];
  scheduledServices: ScheduledService[];
  hourmeterHistory: any[];
  loading: boolean;
  showCancelledJobs: boolean;
  showHourmeterHistory: boolean;
}

export interface AssignModalState {
  show: boolean;
  customers: Customer[];
  selectedCustomerId: string;
  startDate: string;
  endDate: string;
  rentalNotes: string;
  monthlyRentalRate: string;
}

export interface EditRentalModalState {
  show: boolean;
  rentalId: string | null;
  rate: string;
}

export interface ScheduleServiceModalState {
  show: boolean;
  type: string;
  dueDate: string;
  dueHourmeter: string;
  notes: string;
  technicians: User[];
  assignedTechId: string;
}
