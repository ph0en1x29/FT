/**
 * Types for VanStockPage module
 */
import { User, VanStock, VanStockReplenishment, Part } from '../../types';

export type ViewMode = 'grid' | 'list';
export type FilterType = 'all' | 'low_stock' | 'pending_audit' | 'pending_replenishment';

export interface VanStockPageProps {
  currentUser: User;
  hideHeader?: boolean;
}

export interface VanStockStats {
  totalTechnicians: number;
  totalItems: number;
  totalValue: number;
  lowStockCount: number;
  pendingAudits: number;
  pendingReplenishments: number;
}

export interface VanStockDataState {
  vanStocks: VanStock[];
  replenishments: VanStockReplenishment[];
  loading: boolean;
  searchQuery: string;
  filterType: FilterType;
  viewMode: ViewMode;
  selectedVanStock: VanStock | null;
}

export interface ModalState {
  showDetailModal: boolean;
  showAssignModal: boolean;
  showAddItemModal: boolean;
  showEditModal: boolean;
  showDeleteConfirm: boolean;
  showTransferModal: boolean;
}

export interface AssignModalState {
  availableTechnicians: User[];
  selectedTechnicianId: string;
  vanCode: string;
  vanNotes: string;
}

export interface AddItemModalState {
  availableParts: Part[];
  selectedPartId: string;
  itemQuantity: number;
  itemMinQty: number;
  itemMaxQty: number;
}

export interface EditModalState {
  editVanCode: string;
  editVanNotes: string;
  editMaxItems: number;
  editTechnicianId: string;
  allTechnicians: User[];
}

export interface TransferModalState {
  transferTargetId: string;
  selectedItemsForTransfer: Set<string>;
}
