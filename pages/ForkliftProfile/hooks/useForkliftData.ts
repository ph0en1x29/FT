import { useCallback,useEffect,useState } from 'react';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';
import { Customer,Forklift,ForkliftRental,ForkliftServiceEntry,ScheduledService,User } from '../../../types';

export interface ForkliftData {
  forklift: Forklift | null;
  rentals: ForkliftRental[];
  serviceHistory: ForkliftServiceEntry[];
  scheduledServices: ScheduledService[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  hourmeterHistory: any[];
  customers: Customer[];
  technicians: User[];
  loading: boolean;
}

export function useForkliftData(forkliftId: string | undefined) {
  const [forklift, setForklift] = useState<Forklift | null>(null);
  const [rentals, setRentals] = useState<ForkliftRental[]>([]);
  const [serviceHistory, setServiceHistory] = useState<ForkliftServiceEntry[]>([]);
  const [scheduledServices, setScheduledServices] = useState<ScheduledService[]>([]);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [hourmeterHistory, setHourmeterHistory] = useState<any[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [technicians, setTechnicians] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const loadForkliftData = useCallback(async () => {
    if (!forkliftId) return;
    
    setLoading(true);
    try {
      const [
        forkliftData,
        rentalData,
        serviceData,
        scheduledData,
        customersData,
        techData,
        hourmeterData
      ] = await Promise.all([
        MockDb.getForkliftWithCustomer(forkliftId),
        MockDb.getForkliftRentals(forkliftId),
        MockDb.getForkliftServiceHistoryWithCancelled(forkliftId),
        MockDb.getScheduledServices({ forklift_id: forkliftId }),
        MockDb.getCustomers(),
        MockDb.getTechnicians(),
        MockDb.getForkliftHourmeterHistory(forkliftId)
      ]);

      setForklift(forkliftData);
      setRentals(rentalData);
      setServiceHistory(serviceData);
      setScheduledServices(scheduledData);
      setCustomers(customersData);
      setTechnicians(techData);
      setHourmeterHistory(hourmeterData);
    } catch (error) {
      console.error('Error loading forklift data:', error);
    } finally {
      setLoading(false);
    }
  }, [forkliftId]);

  useEffect(() => {
    loadForkliftData();
  }, [loadForkliftData]);

  // Computed values
  const activeRental = rentals.find(r => r.status === 'active');
  const pastRentals = rentals.filter(r => r.status !== 'active');
  const pendingServices = scheduledServices.filter(s => s.status === 'pending' || s.status === 'scheduled');
  const activeServiceHistory = serviceHistory.filter(j => !j.is_cancelled);
  const cancelledJobs = serviceHistory.filter(j => j.is_cancelled);

  // Stats
  const totalServices = activeServiceHistory.length;
  const completedStatuses = ['Completed', 'Awaiting Finalization', 'Completed Awaiting Acknowledgement', 'Disputed'];
  const completedServices = activeServiceHistory.filter(j => completedStatuses.includes(j.status)).length;
  const totalPartsUsed = activeServiceHistory.reduce((acc, job) => acc + (job.parts_used?.length || 0), 0);
  
  const totalRentalRevenue = rentals.reduce((acc, rental) => {
    if (!rental.monthly_rental_rate) return acc;
    const start = new Date(rental.start_date);
    const end = rental.end_date ? new Date(rental.end_date) : new Date();
    const months = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30)));
    return acc + (rental.monthly_rental_rate * months);
  }, 0);

  return {
    forklift,
    rentals,
    serviceHistory,
    scheduledServices,
    hourmeterHistory,
    customers,
    technicians,
    loading,
    reload: loadForkliftData,
    // Computed
    activeRental,
    pastRentals,
    pendingServices,
    activeServiceHistory,
    cancelledJobs,
    // Stats
    stats: {
      totalServices,
      completedServices,
      totalPartsUsed,
      totalRentalRevenue
    }
  };
}
