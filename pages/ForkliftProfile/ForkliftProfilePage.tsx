import { AlertTriangle } from 'lucide-react';
import React,{ useState } from 'react';
import { useParams } from 'react-router-dom';
import { useDevModeContext } from '../../contexts/DevModeContext';
import { SupabaseDb as MockDb } from '../../services/supabaseService';
import { ForkliftRental,User,UserRole } from '../../types';
import {
AssignForkliftModal,
CurrentAssignmentCard,
EditRentalRateModal,
ForkliftHeader,
ForkliftInfoCard,
HourmeterHistorySection,
NextServiceAlert,
RentalHistorySection,
ServiceTrackingCard,
ScheduledServicesSection,
ScheduleServiceModal,
ServiceHistorySection,
} from './components';
import { useForkliftData } from './hooks/useForkliftData';

interface ForkliftProfilePageProps {
  currentUser: User;
}

export const ForkliftProfilePage: React.FC<ForkliftProfilePageProps> = ({ currentUser }) => {
  const { id } = useParams<{ id: string }>();
  
  // Modal states
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showEditRentalModal, setShowEditRentalModal] = useState(false);
  const [showScheduleServiceModal, setShowScheduleServiceModal] = useState(false);
  const [editingRental, setEditingRental] = useState<ForkliftRental | null>(null);

  // Data hook
  const {
    forklift,
    rentals,
    customers,
    technicians,
    hourmeterHistory,
    loading,
    reload,
    activeRental,
    pendingServices,
    activeServiceHistory,
    cancelledJobs,
    stats,
  } = useForkliftData(id);

  // Permissions
  const { displayRole, hasPermission } = useDevModeContext();
  const canEditRentalRates = hasPermission('canEditRentalRates');
  const canScheduleMaintenance = hasPermission('canScheduleMaintenance');
  const canManageRentals = hasPermission('canManageRentals');
  const isAdmin = displayRole === UserRole.ADMIN;
  const isSupervisor = displayRole === UserRole.SUPERVISOR;
  const canViewCancelled = isAdmin || isSupervisor;

  // End rental confirmation
  const [endRentalConfirm, setEndRentalConfirm] = useState<string | null>(null);

  const handleEndRental = (rentalId: string) => {
    setEndRentalConfirm(rentalId);
  };

  const confirmEndRental = async () => {
    if (!endRentalConfirm) return;
    try {
      await MockDb.endRental(endRentalConfirm, undefined, currentUser.user_id, currentUser.name);
      setEndRentalConfirm(null);
      await reload();
    } catch (error) {
      setEndRentalConfirm(null);
      import('../../services/toastService').then(m => m.showToast.error((error as Error).message));
    }
  };

  const handleEditRentalRate = (rental: ForkliftRental) => {
    setEditingRental(rental);
    setShowEditRentalModal(true);
  };

  const handleModalSuccess = async () => {
    setShowAssignModal(false);
    setShowEditRentalModal(false);
    setShowScheduleServiceModal(false);
    setEditingRental(null);
    await reload();
  };

  // Loading & error states
  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading forklift profile...</div>;
  }

  if (!forklift) {
    return <div className="p-8 text-center text-red-500">Forklift not found</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-4 md:space-y-6 pb-24 md:pb-8">
      <ForkliftHeader
        hasActiveRental={!!activeRental}
        canScheduleMaintenance={canScheduleMaintenance}
        canManageRentals={canManageRentals}
        onScheduleService={() => setShowScheduleServiceModal(true)}
        onRentToCustomer={() => setShowAssignModal(true)}
      />

      <ForkliftInfoCard
        forklift={forklift}
        hasActiveRental={!!activeRental}
        stats={stats}
      />

      <ServiceTrackingCard forklift={forklift} canEdit={isAdmin || isSupervisor} onUpdate={reload} />
      <NextServiceAlert forklift={forklift} />

      {activeRental && (
        <CurrentAssignmentCard
          rental={activeRental}
          canEditRentalRates={canEditRentalRates}
          onEditRate={handleEditRentalRate}
          onEndRental={handleEndRental}
        />
      )}

      <ScheduledServicesSection services={pendingServices} />

      {/* Service & Rental History - Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ServiceHistorySection
          activeServices={activeServiceHistory}
          cancelledJobs={cancelledJobs}
          canViewCancelled={canViewCancelled}
        />
        <RentalHistorySection rentals={rentals} />
      </div>

      <HourmeterHistorySection history={hourmeterHistory} />

      {/* Modals */}
      {showAssignModal && (
        <AssignForkliftModal
          forklift={forklift}
          currentUser={currentUser}
          onClose={() => setShowAssignModal(false)}
          onSuccess={handleModalSuccess}
        />
      )}

      {showEditRentalModal && editingRental && (
        <EditRentalRateModal
          rentalId={editingRental.rental_id}
          currentRate={editingRental.monthly_rental_rate || 0}
          onClose={() => { setShowEditRentalModal(false); setEditingRental(null); }}
          onSuccess={handleModalSuccess}
        />
      )}

      {showScheduleServiceModal && (
        <ScheduleServiceModal
          forklift={forklift}
          technicians={technicians}
          currentUser={currentUser}
          onClose={() => setShowScheduleServiceModal(false)}
          onSuccess={handleModalSuccess}
        />
      )}

      {/* End rental confirmation modal */}
      {endRentalConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEndRentalConfirm(null)}>
          <div className="bg-[var(--surface)] rounded-2xl shadow-xl max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="font-semibold text-[var(--text)]">End Rental</h3>
            </div>
            <p className="text-sm text-[var(--text-muted)] mb-6">End this rental? The forklift will be marked as available.</p>
            <div className="flex gap-3">
              <button onClick={() => setEndRentalConfirm(null)} className="flex-1 px-4 py-2.5 rounded-xl border text-sm font-medium" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
                Cancel
              </button>
              <button onClick={confirmEndRental} className="flex-1 px-4 py-2.5 rounded-xl bg-amber-600 text-white text-sm font-medium hover:bg-amber-700 transition-colors">
                End Rental
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
