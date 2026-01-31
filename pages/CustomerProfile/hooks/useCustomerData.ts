import { useState, useEffect, useMemo, useCallback } from 'react';
import { Customer, ForkliftServiceEntry, ForkliftRental, Forklift, JobPartUsed, ExtraCharge } from '../../../types';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';
import { showToast } from '../../../services/toastService';
import { CustomerStats } from '../types';

interface UseCustomerDataResult {
  customer: Customer | null;
  jobs: ForkliftServiceEntry[];
  rentals: ForkliftRental[];
  availableForklifts: Forklift[];
  loading: boolean;
  stats: CustomerStats;
  activeRentals: ForkliftRental[];
  pastRentals: ForkliftRental[];
  activeJobs: ForkliftServiceEntry[];
  cancelledJobs: ForkliftServiceEntry[];
  openJobs: ForkliftServiceEntry[];
  completedJobs: ForkliftServiceEntry[];
  loadCustomerData: () => Promise<void>;
  loadAvailableForklifts: () => Promise<void>;
}

// Completed statuses (work done, even if awaiting acknowledgement or disputed)
const COMPLETED_STATUSES = [
  'Completed', 
  'Awaiting Finalization',
  'Completed Awaiting Acknowledgement',
  'Disputed'
];

export function useCustomerData(customerId: string | undefined): UseCustomerDataResult {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [jobs, setJobs] = useState<ForkliftServiceEntry[]>([]);
  const [rentals, setRentals] = useState<ForkliftRental[]>([]);
  const [availableForklifts, setAvailableForklifts] = useState<Forklift[]>([]);
  const [loading, setLoading] = useState(true);

  const loadCustomerData = useCallback(async () => {
    if (!customerId) return;
    
    setLoading(true);
    try {
      const customers = await MockDb.getCustomers();
      const foundCustomer = customers.find(c => c.customer_id === customerId);
      setCustomer(foundCustomer || null);

      // Get jobs including cancelled ones
      const customerJobs = await MockDb.getCustomerJobsWithCancelled(customerId);
      setJobs(customerJobs.sort((a: ForkliftServiceEntry, b: ForkliftServiceEntry) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ));

      const customerRentals = await MockDb.getCustomerRentals(customerId);
      setRentals(customerRentals);
    } catch (error) {
      showToast.error('Failed to load customer profile');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  const loadAvailableForklifts = useCallback(async () => {
    try {
      const forkliftsWithCustomers = await MockDb.getForkliftsWithCustomers();
      const available = forkliftsWithCustomers.filter(f => !f.current_customer_id);
      setAvailableForklifts(available);
    } catch (error) {
      showToast.error('Failed to load available forklifts');
    }
  }, []);

  useEffect(() => {
    loadCustomerData();
  }, [loadCustomerData]);

  // Computed data
  const activeRentals = useMemo(() => rentals.filter(r => r.status === 'active'), [rentals]);
  const pastRentals = useMemo(() => rentals.filter(r => r.status !== 'active'), [rentals]);
  
  // Filter out cancelled jobs for active metrics
  const activeJobs = useMemo(() => jobs.filter(j => !j.is_cancelled), [jobs]);
  const cancelledJobs = useMemo(() => jobs.filter(j => j.is_cancelled), [jobs]);
  
  const openJobs = useMemo(() => activeJobs.filter(j => !COMPLETED_STATUSES.includes(j.status)), [activeJobs]);
  const completedJobs = useMemo(() => activeJobs.filter(j => COMPLETED_STATUSES.includes(j.status)), [activeJobs]);

  // Calculate stats
  const stats = useMemo<CustomerStats>(() => {
    const totalJobs = activeJobs.length;
    
    const totalServiceRevenue = activeJobs.reduce((acc, job) => {
      const partsCost = (job.parts_used || []).reduce((sum: number, p: JobPartUsed) => sum + (p.sell_price_at_time * p.quantity), 0);
      const laborCost = job.labor_cost || 150;
      const extraChargesCost = (job.extra_charges || []).reduce((sum: number, c: ExtraCharge) => sum + c.amount, 0);
      return acc + partsCost + laborCost + extraChargesCost;
    }, 0);
    
    const totalRentalRevenue = rentals.reduce((acc, rental) => {
      const monthlyRate = rental.monthly_rental_rate || 0;
      if (monthlyRate <= 0) return acc;
      
      const start = new Date(rental.start_date);
      const end = rental.end_date ? new Date(rental.end_date) : new Date();
      const months = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30)));
      return acc + (monthlyRate * months);
    }, 0);
    
    const totalRevenue = totalServiceRevenue + totalRentalRevenue;
    
    const avgResponseTime = activeJobs.filter(j => j.arrival_time).length > 0
      ? activeJobs.filter(j => j.arrival_time).reduce((acc, j) => {
          const created = new Date(j.created_at).getTime();
          const arrived = new Date(j.arrival_time!).getTime();
          return acc + ((arrived - created) / (1000 * 60 * 60));
        }, 0) / activeJobs.filter(j => j.arrival_time).length
      : 0;

    // Calculate issue frequency
    const issueFrequency: { [key: string]: number } = {};
    activeJobs.forEach(job => {
      const title = job.title.toLowerCase();
      const key = title.includes('ac') || title.includes('air') ? 'AC/HVAC' :
                  title.includes('heat') ? 'Heating' :
                  title.includes('plumb') || title.includes('pipe') ? 'Plumbing' :
                  title.includes('electric') ? 'Electrical' :
                  'General Maintenance';
      issueFrequency[key] = (issueFrequency[key] || 0) + 1;
    });

    const topIssues = Object.entries(issueFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3) as [string, number][];

    return {
      totalJobs,
      totalServiceRevenue,
      totalRentalRevenue,
      totalRevenue,
      avgResponseTime,
      activeRentalsCount: activeRentals.length,
      completedJobsCount: completedJobs.length,
      avgJobValue: totalJobs > 0 ? Math.round(totalServiceRevenue / totalJobs) : 0,
      topIssues,
    };
  }, [activeJobs, rentals, activeRentals, completedJobs]);

  return {
    customer,
    jobs,
    rentals,
    availableForklifts,
    loading,
    stats,
    activeRentals,
    pastRentals,
    activeJobs,
    cancelledJobs,
    openJobs,
    completedJobs,
    loadCustomerData,
    loadAvailableForklifts,
  };
}
