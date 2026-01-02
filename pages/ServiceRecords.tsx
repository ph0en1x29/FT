import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Job, JobStatus } from '../types_with_invoice_tracking';
import { SupabaseDb as MockDb } from '../services/supabaseService';
import { 
  Search, Filter, FileText, Calendar, User, Truck, 
  Eye, Download, Clock, CheckCircle, Building2
} from 'lucide-react';

interface ServiceRecordsProps {
  currentUser: any;
}

const ServiceRecords: React.FC<ServiceRecordsProps> = ({ currentUser }) => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filters
  const [filterCustomer, setFilterCustomer] = useState('all');
  const [filterTechnician, setFilterTechnician] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const data = await MockDb.getJobs(currentUser);
      // Only show completed or awaiting finalization jobs (have service reports)
      const completedJobs = data.filter(j => 
        j.status === JobStatus.COMPLETED || 
        j.status === JobStatus.AWAITING_FINALIZATION
      );
      setJobs(completedJobs);
    } catch (error) {
      console.error('Error loading jobs:', error);
    }
    setLoading(false);
  };

  // Get unique values for filters
  const uniqueCustomers = useMemo(() => {
    const customers = [...new Set(jobs.map(j => j.customer?.name))].filter(Boolean).sort();
    return customers;
  }, [jobs]);

  const uniqueTechnicians = useMemo(() => {
    const techs = [...new Set(jobs.map(j => j.assigned_technician_name))].filter(Boolean).sort();
    return techs;
  }, [jobs]);

  // Filtered jobs
  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      // Search filter
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        (job.title || '').toLowerCase().includes(searchLower) ||
        (job.customer?.name || '').toLowerCase().includes(searchLower) ||
        (job.forklift?.serial_number || '').toLowerCase().includes(searchLower) ||
        (job.forklift?.make || '').toLowerCase().includes(searchLower) ||
        (job.forklift?.model || '').toLowerCase().includes(searchLower) ||
        (job.assigned_technician_name || '').toLowerCase().includes(searchLower) ||
        (job.job_id || '').toLowerCase().includes(searchLower);

      // Customer filter
      const matchesCustomer = filterCustomer === 'all' || job.customer?.name === filterCustomer;

      // Technician filter
      const matchesTechnician = filterTechnician === 'all' || job.assigned_technician_name === filterTechnician;

      // Date filter
      const jobDate = new Date(job.completion_time || job.created_at);
      const matchesDateFrom = !filterDateFrom || jobDate >= new Date(filterDateFrom);
      const matchesDateTo = !filterDateTo || jobDate <= new Date(filterDateTo + 'T23:59:59');

      return matchesSearch && matchesCustomer && matchesTechnician && matchesDateFrom && matchesDateTo;
    });
  }, [jobs, searchQuery, filterCustomer, filterTechnician, filterDateFrom, filterDateTo]);

  const handleViewServiceReport = (job: Job) => {
    // Open service report in new window
    openServiceReportPDF(job);
  };

  const openServiceReportPDF = (job: Job) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow pop-ups to view the service report');
      return;
    }

    const totalParts = job.parts_used.reduce((acc, p) => acc + (p.sell_price_at_time * p.quantity), 0);
    const labor = job.labor_cost || 150;
    const extra = (job.extra_charges || []).reduce((acc, c) => acc + c.amount, 0);
    const total = totalParts + labor + extra;

    const reportHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Service Report - ${job.job_id.slice(0, 8).toUpperCase()}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 20px; color: #333; font-size: 11px; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #1e40af; padding-bottom: 10px; margin-bottom: 15px; }
          .company-name { font-size: 20px; font-weight: bold; color: #1e40af; }
          .company-info { font-size: 9px; color: #666; margin-top: 3px; }
          .report-title { font-size: 16px; font-weight: bold; color: #333; }
          .report-no { font-size: 18px; font-weight: bold; color: #dc2626; }
          .report-date { font-size: 11px; color: #666; }
          
          .customer-section { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px; }
          .field-row { display: flex; margin-bottom: 5px; }
          .field-label { font-weight: bold; width: 80px; }
          .field-value { flex: 1; border-bottom: 1px solid #ccc; padding-left: 5px; }
          
          .service-type { display: flex; gap: 20px; margin-bottom: 15px; padding: 8px; background: #f8fafc; border-radius: 4px; }
          .service-type label { display: flex; align-items: center; gap: 5px; }
          .checkbox { width: 14px; height: 14px; border: 1px solid #333; display: inline-flex; align-items: center; justify-content: center; }
          .checkbox.checked { background: #1e40af; color: white; }
          
          .equipment-section { margin-bottom: 15px; }
          .equipment-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
          
          .checklist-section { margin-bottom: 15px; }
          .checklist-header { background: #1e40af; color: white; padding: 5px 10px; font-weight: bold; font-size: 10px; }
          .checklist-legend { font-size: 9px; color: #666; margin-bottom: 5px; }
          .checklist-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; border: 1px solid #ddd; padding: 10px; }
          .checklist-category { font-size: 9px; }
          .checklist-category h4 { font-weight: bold; margin-bottom: 5px; border-bottom: 1px solid #ddd; padding-bottom: 3px; }
          .checklist-item { display: flex; align-items: center; gap: 3px; font-size: 8px; margin-bottom: 2px; }
          .check-box { width: 10px; height: 10px; border: 1px solid #333; font-size: 7px; text-align: center; line-height: 10px; }
          
          .job-section { margin-bottom: 15px; }
          .job-section h3 { font-size: 11px; font-weight: bold; margin-bottom: 5px; }
          .job-description { border: 1px solid #ddd; padding: 8px; min-height: 50px; background: #fafafa; }
          
          .parts-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 10px; }
          .parts-table th { background: #f1f5f9; padding: 6px; text-align: left; border: 1px solid #ddd; }
          .parts-table td { padding: 6px; border: 1px solid #ddd; }
          .parts-table .amount { text-align: right; }
          
          .footer-section { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px; }
          .signature-box { border: 1px solid #ddd; padding: 10px; min-height: 80px; }
          .signature-box h4 { font-size: 10px; font-weight: bold; margin-bottom: 5px; border-bottom: 1px solid #ddd; padding-bottom: 3px; }
          .signature-img { max-height: 50px; object-fit: contain; }
          .signature-info { font-size: 8px; color: #666; margin-top: 5px; }
          
          .time-section { display: flex; gap: 20px; margin-bottom: 15px; font-size: 10px; }
          .time-field { display: flex; align-items: center; gap: 5px; }
          
          @media print {
            body { padding: 10px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="company-name">FieldPro</div>
            <div class="company-info">Field Service Management System</div>
            <div style="margin-top: 10px;">
              <div class="report-title">SERVICE / REPAIR REPORT</div>
            </div>
          </div>
          <div style="text-align: right;">
            <div class="report-no">No.: ${job.job_id.slice(0, 8).toUpperCase()}</div>
            <div class="report-date">Date: ${new Date(job.completion_time || job.created_at).toLocaleDateString()}</div>
          </div>
        </div>

        <div class="customer-section">
          <div>
            <div class="field-row">
              <span class="field-label">Name:</span>
              <span class="field-value">${job.customer?.name || ''}</span>
            </div>
            <div class="field-row">
              <span class="field-label">Address:</span>
              <span class="field-value">${job.customer?.address || ''}</span>
            </div>
            <div class="field-row">
              <span class="field-label">Attn:</span>
              <span class="field-value">${job.customer?.phone || ''}</span>
            </div>
          </div>
          <div>
            <div class="service-type">
              <label><span class="checkbox ${job.title?.toLowerCase().includes('service') || job.title?.toLowerCase().includes('pm') ? 'checked' : ''}">✓</span> SERVICE</label>
              <label><span class="checkbox ${job.title?.toLowerCase().includes('repair') ? 'checked' : ''}">✓</span> REPAIR</label>
              <label><span class="checkbox ${job.title?.toLowerCase().includes('check') ? 'checked' : ''}">✓</span> CHECKING</label>
            </div>
          </div>
        </div>

        <div class="equipment-section">
          <div class="equipment-grid">
            <div class="field-row">
              <span class="field-label">Brand:</span>
              <span class="field-value">${job.forklift?.make || ''}</span>
            </div>
            <div class="field-row">
              <span class="field-label">Serial No:</span>
              <span class="field-value">${job.forklift?.serial_number || ''}</span>
            </div>
            <div class="field-row">
              <span class="field-label">Model:</span>
              <span class="field-value">${job.forklift?.model || ''}</span>
            </div>
            <div class="field-row">
              <span class="field-label">Hourmeter:</span>
              <span class="field-value">${job.hourmeter_reading || job.forklift?.hourmeter || ''}</span>
            </div>
          </div>
        </div>

        <div class="checklist-section">
          <div class="checklist-header">Items Checking</div>
          <div class="checklist-legend">✓ - Ok &nbsp;&nbsp;&nbsp; X - Need attention or Repair</div>
          <div class="checklist-grid">
            <div class="checklist-category">
              <h4>Drive System</h4>
              <div class="checklist-item"><span class="check-box"></span> Front axle</div>
              <div class="checklist-item"><span class="check-box"></span> Rear axle</div>
              <div class="checklist-item"><span class="check-box"></span> Drive motor/Engine</div>
              <div class="checklist-item"><span class="check-box"></span> Controller/Transmission</div>
              <h4 style="margin-top: 8px;">Hydraulic System</h4>
              <div class="checklist-item"><span class="check-box"></span> Hydraulic pump</div>
              <div class="checklist-item"><span class="check-box"></span> Control valve</div>
              <div class="checklist-item"><span class="check-box"></span> Hose</div>
              <div class="checklist-item"><span class="check-box"></span> Oil Level</div>
            </div>
            <div class="checklist-category">
              <h4>Steering System</h4>
              <div class="checklist-item"><span class="check-box"></span> Steering wheel/valve</div>
              <div class="checklist-item"><span class="check-box"></span> Steering cylinder</div>
              <div class="checklist-item"><span class="check-box"></span> Steering motor</div>
              <div class="checklist-item"><span class="check-box"></span> Knuckle</div>
              <h4 style="margin-top: 8px;">Load Handling</h4>
              <div class="checklist-item"><span class="check-box"></span> Fork</div>
              <div class="checklist-item"><span class="check-box"></span> Mast & Roller</div>
              <div class="checklist-item"><span class="check-box"></span> Chain & Chain Wheel</div>
              <div class="checklist-item"><span class="check-box"></span> Cylinder</div>
            </div>
            <div class="checklist-category">
              <h4>Braking System</h4>
              <div class="checklist-item"><span class="check-box"></span> Brake pedal</div>
              <div class="checklist-item"><span class="check-box"></span> Parking brake</div>
              <div class="checklist-item"><span class="check-box"></span> Brake fluid/pipe</div>
              <div class="checklist-item"><span class="check-box"></span> Brake master pump</div>
              <h4 style="margin-top: 8px;">Diesel/LPG/Petrol</h4>
              <div class="checklist-item"><span class="check-box"></span> Engine oil level</div>
              <div class="checklist-item"><span class="check-box"></span> Fuel line leaks</div>
              <div class="checklist-item"><span class="check-box"></span> Radiator</div>
              <div class="checklist-item"><span class="check-box"></span> Exhaust piping</div>
            </div>
            <div class="checklist-category">
              <h4>Safety Devices</h4>
              <div class="checklist-item"><span class="check-box"></span> Overhead guard</div>
              <div class="checklist-item"><span class="check-box"></span> Cabin / Body</div>
              <div class="checklist-item"><span class="check-box"></span> Back-rest</div>
              <div class="checklist-item"><span class="check-box"></span> Seat / Belt</div>
              <h4 style="margin-top: 8px;">Lights & Signals</h4>
              <div class="checklist-item"><span class="check-box"></span> Lighting / Beacon</div>
              <div class="checklist-item"><span class="check-box"></span> Horn</div>
              <div class="checklist-item"><span class="check-box"></span> Buzzer</div>
              <div class="checklist-item"><span class="check-box"></span> Rear view mirror</div>
            </div>
            <div class="checklist-category">
              <h4>Electrical System</h4>
              <div class="checklist-item"><span class="check-box"></span> Ignition system</div>
              <div class="checklist-item"><span class="check-box"></span> Battery</div>
              <div class="checklist-item"><span class="check-box"></span> Electrical/wiring</div>
              <div class="checklist-item"><span class="check-box"></span> Instruments/Error</div>
              <h4 style="margin-top: 8px;">Tyres & Wheels</h4>
              <div class="checklist-item"><span class="check-box"></span> Front tyre</div>
              <div class="checklist-item"><span class="check-box"></span> Rear tyre</div>
              <div class="checklist-item"><span class="check-box"></span> Rim</div>
              <div class="checklist-item"><span class="check-box"></span> Wheel nuts</div>
            </div>
          </div>
        </div>

        <div class="job-section">
          <h3>Job Carried Out:</h3>
          <div class="job-description">
            <strong>${job.title}</strong><br/>
            ${job.description}
            ${job.notes && job.notes.length > 0 ? '<br/><br/><strong>Notes:</strong><br/>' + job.notes.join('<br/>') : ''}
          </div>
        </div>

        ${job.parts_used.length > 0 ? `
          <table class="parts-table">
            <thead>
              <tr>
                <th style="width: 30px;">No</th>
                <th style="width: 80px;">Item Code</th>
                <th>Item Description</th>
                <th style="width: 40px;">Qty</th>
                <th style="width: 70px;">Unit Price</th>
                <th style="width: 80px;">Amount (RM)</th>
              </tr>
            </thead>
            <tbody>
              ${job.parts_used.map((p, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${p.part_id?.slice(0, 8) || ''}</td>
                  <td>${p.part_name}</td>
                  <td>${p.quantity}</td>
                  <td class="amount">${p.sell_price_at_time.toFixed(2)}</td>
                  <td class="amount">${(p.sell_price_at_time * p.quantity).toFixed(2)}</td>
                </tr>
              `).join('')}
              <tr>
                <td colspan="5" style="text-align: right; font-weight: bold;">Labor:</td>
                <td class="amount">${labor.toFixed(2)}</td>
              </tr>
              ${extra > 0 ? `
                <tr>
                  <td colspan="5" style="text-align: right; font-weight: bold;">Extra Charges:</td>
                  <td class="amount">${extra.toFixed(2)}</td>
                </tr>
              ` : ''}
              <tr style="background: #f1f5f9;">
                <td colspan="5" style="text-align: right; font-weight: bold;">TOTAL AMOUNT (RM):</td>
                <td class="amount" style="font-weight: bold;">${total.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        ` : ''}

        <div class="time-section">
          <div class="time-field">
            <strong>Repairing Hours:</strong> from ${job.arrival_time ? new Date(job.arrival_time).toLocaleTimeString() : '____'} to ${job.completion_time ? new Date(job.completion_time).toLocaleTimeString() : '____'}
          </div>
        </div>

        <div class="footer-section">
          <div class="signature-box">
            <h4>Technician Name & Signature</h4>
            ${job.technician_signature ? `
              <img src="${job.technician_signature.signature_url}" class="signature-img" />
              <div class="signature-info">
                ${job.technician_signature.signed_by_name}<br/>
                ${new Date(job.technician_signature.signed_at).toLocaleString()}
              </div>
            ` : '<div style="height: 50px;"></div>'}
            <div style="margin-top: 5px; font-weight: bold;">${job.assigned_technician_name || ''}</div>
          </div>
          <div class="signature-box">
            <h4>Service Completed & Checked - Customer</h4>
            ${job.customer_signature ? `
              <img src="${job.customer_signature.signature_url}" class="signature-img" />
              <div class="signature-info">
                ${job.customer_signature.signed_by_name}<br/>
                ${new Date(job.customer_signature.signed_at).toLocaleString()}
              </div>
            ` : '<div style="height: 50px;"></div>'}
            <div style="margin-top: 5px;"><strong>Chop & Sign</strong></div>
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(reportHtml);
    printWindow.document.close();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-theme-muted">Loading service records...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-theme">Service Records</h1>
          <p className="text-sm text-theme-muted mt-1">
            {filteredJobs.length} of {jobs.length} records
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card-theme rounded-xl p-4 space-y-4 theme-transition">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-theme-muted" />
            <input
              type="text"
              placeholder="Search by job title, customer, S/N, technician..."
              className="w-full pl-10 pr-4 py-2.5 bg-theme-surface border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-theme placeholder-slate-400 theme-transition"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Filter Row */}
        <div className="flex flex-wrap gap-3 items-center">
          <Filter className="w-4 h-4 text-theme-muted" />
          
          <select
            className="px-3 py-2 bg-theme-surface border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-theme theme-transition"
            value={filterCustomer}
            onChange={(e) => setFilterCustomer(e.target.value)}
          >
            <option value="all">All Customers</option>
            {uniqueCustomers.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            className="px-3 py-2 bg-theme-surface border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-theme theme-transition"
            value={filterTechnician}
            onChange={(e) => setFilterTechnician(e.target.value)}
          >
            <option value="all">All Technicians</option>
            {uniqueTechnicians.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <span className="text-sm text-theme-muted">From:</span>
            <input
              type="date"
              className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">To:</span>
            <input
              type="date"
              className="px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
            />
          </div>

          {(filterCustomer !== 'all' || filterTechnician !== 'all' || filterDateFrom || filterDateTo) && (
            <button
              onClick={() => {
                setFilterCustomer('all');
                setFilterTechnician('all');
                setFilterDateFrom('');
                setFilterDateTo('');
              }}
              className="text-sm text-red-600 hover:text-red-700"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Records List */}
      {filteredJobs.length === 0 ? (
        <div className="card-theme rounded-xl p-12 text-center theme-transition">
          <FileText className="w-12 h-12 text-theme-muted opacity-40 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-theme mb-2">No service records found</h3>
          <p className="text-sm text-theme-muted">
            {searchQuery || filterCustomer !== 'all' || filterTechnician !== 'all' || filterDateFrom || filterDateTo
              ? 'Try adjusting your search or filters'
              : 'Completed jobs will appear here'}
          </p>
        </div>
      ) : (
        <div className="card-theme rounded-xl overflow-hidden theme-transition">
          <table className="w-full">
            <thead className="bg-theme-surface-2 text-theme-muted text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Report No.</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Equipment</th>
                <th className="px-4 py-3 text-left">Job Title</th>
                <th className="px-4 py-3 text-left">Technician</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme">
              {filteredJobs.map(job => (
                <tr key={job.job_id} className="hover:bg-theme-surface-2 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm font-medium text-blue-600">
                      {job.job_id.slice(0, 8).toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-theme">
                    {new Date(job.completion_time || job.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-theme-muted" />
                      <span className="text-sm font-medium text-theme">{job.customer?.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {job.forklift ? (
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-amber-500" />
                        <div>
                          <div className="text-sm font-medium text-theme">{job.forklift.serial_number}</div>
                          <div className="text-xs text-theme-muted">{job.forklift.make} {job.forklift.model}</div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-theme-muted text-sm">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-theme">{job.title}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-theme-muted" />
                      <span className="text-sm text-theme">{job.assigned_technician_name || '-'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      job.status === JobStatus.COMPLETED 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-amber-100 text-amber-700'
                    }`}>
                      {job.status === JobStatus.COMPLETED ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {job.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => navigate(`/jobs/${job.job_id}`)}
                        className="p-2 text-theme-muted hover:bg-theme-surface-2 rounded-lg"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleViewServiceReport(job)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="Print Service Report"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ServiceRecords;
