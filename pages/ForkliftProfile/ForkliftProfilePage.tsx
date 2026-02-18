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

  // Handlers
  const handleEndRental = async (rentalId: string) => {
    if (!confirm('End this rental? The forklift will be marked as available.')) return;
    try {
      await MockDb.endRental(rentalId, undefined, currentUser.user_id, currentUser.name);
      await reload();
    } catch (error) {
      alert((error as Error).message);
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
          customers={customers}
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
    </div>
  );
};
