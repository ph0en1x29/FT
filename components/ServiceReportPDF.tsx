import React from 'react';
import { Job, ForkliftConditionChecklist, JobType } from '../types_with_invoice_tracking';

interface ServiceReportProps {
  job: Job;
  reportNumber?: string;
  companyInfo?: {
    name: string;
    address: string;
    branch?: string;
    phone: string;
    fax?: string;
    customerService?: string;
    mobile?: string;
    email: string;
  };
}

const defaultCompanyInfo = {
  name: 'FieldPro Service',
  address: 'Your Business Address',
  branch: '',
  phone: '(+60) 3-XXXX XXXX',
  fax: '',
  customerService: '',
  mobile: '',
  email: 'service@yourcompany.com',
};

export const ServiceReportPDF: React.FC<ServiceReportProps> = ({ 
  job, 
  reportNumber,
  companyInfo = defaultCompanyInfo 
}) => {
  const checklist = job.condition_checklist || {};
  
  // Calculate totals
  const totalParts = job.parts_used.reduce((acc, p) => acc + (p.sell_price_at_time * p.quantity), 0);
  const labor = job.labor_cost || 0;
  const extra = (job.extra_charges || []).reduce((acc, c) => acc + c.amount, 0);
  const total = totalParts + labor + extra;

  const renderCheckbox = (checked?: boolean) => (
    <span className={`inline-block w-4 h-4 border border-slate-400 mr-1 text-center leading-4 ${checked ? 'bg-green-100' : ''}`}>
      {checked === true ? '✓' : checked === false ? '✗' : ''}
    </span>
  );

  const ChecklistSection = ({ title, items }: { title: string; items: { label: string; key: keyof ForkliftConditionChecklist }[] }) => (
    <div className="border border-slate-300 p-2">
      <div className="font-bold text-xs mb-1 bg-slate-100 -m-2 p-1 mb-1">{title}</div>
      {items.map(item => (
        <div key={item.key} className="flex items-center text-xs py-0.5">
          {renderCheckbox(checklist[item.key])}
          <span className="text-xs">{item.label}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="bg-white p-6 max-w-4xl mx-auto text-sm font-sans" style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-blue-600 pb-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-blue-800">{companyInfo.name}</h1>
          <p className="text-xs text-slate-600 mt-1">{companyInfo.address}</p>
          {companyInfo.branch && <p className="text-xs text-slate-600">{companyInfo.branch}</p>}
          <p className="text-xs text-slate-600">Tel: {companyInfo.phone}</p>
          {companyInfo.fax && <p className="text-xs text-slate-600">Fax: {companyInfo.fax}</p>}
          {companyInfo.customerService && <p className="text-xs text-blue-600">{companyInfo.customerService}</p>}
          {companyInfo.mobile && <p className="text-xs text-slate-600">{companyInfo.mobile}</p>}
          <p className="text-xs text-blue-600">{companyInfo.email}</p>
        </div>
        <div className="text-right">
          <h2 className="text-xl font-bold text-slate-800">SERVICE / REPAIR REPORT</h2>
          <p className="text-xs text-slate-500 mt-1">Customer Details</p>
          <div className="mt-2 border border-slate-300 p-2 bg-slate-50">
            <p className="text-sm font-bold">No.: {reportNumber || job.service_report_number || job.job_id.slice(0, 8).toUpperCase()}</p>
            <p className="text-xs">Date: {new Date(job.created_at).toLocaleDateString('en-GB')}</p>
          </div>
        </div>
      </div>

      {/* Customer Details */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="border border-slate-300 p-3">
          <div className="grid grid-cols-[80px_1fr] gap-y-1 text-xs">
            <span className="font-semibold">Name:</span>
            <span className="border-b border-slate-300">{job.customer.name}</span>
            <span className="font-semibold">Address:</span>
            <span className="border-b border-slate-300">{job.customer.address}</span>
            <span className="font-semibold">Attn:</span>
            <span className="border-b border-slate-300">{job.customer.contact_person || '-'}</span>
          </div>
        </div>
        <div className="border border-slate-300 p-3">
          <div className="text-xs space-y-1">
            <p>Your ref no.: {job.customer.account_number || '-'}</p>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={job.job_type === JobType.SERVICE} disabled className="w-4 h-4" /> SERVICE
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={job.job_type === JobType.REPAIR} disabled className="w-4 h-4" /> REPAIR
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={job.job_type === JobType.CHECKING} disabled className="w-4 h-4" /> CHECKING
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={job.job_type === JobType.ACCIDENT} disabled className="w-4 h-4" /> ACCIDENT
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Forklift Details */}
      {job.forklift && (
        <div className="grid grid-cols-4 gap-2 mb-4 text-xs border border-slate-300 p-2">
          <div>
            <span className="font-semibold">Brand:</span>
            <span className="ml-1 border-b border-slate-300">{job.forklift.make}</span>
          </div>
          <div>
            <span className="font-semibold">Serial Number:</span>
            <span className="ml-1 border-b border-slate-300">{job.forklift.serial_number}</span>
          </div>
          <div>
            <span className="font-semibold">Forklift No:</span>
            <span className="ml-1 border-b border-slate-300">{job.forklift.forklift_no || '-'}</span>
          </div>
          <div>
            <span className="font-semibold">Equipment:</span>
            <span className="ml-1 border-b border-slate-300">{job.title}</span>
          </div>
          <div>
            <span className="font-semibold">Model:</span>
            <span className="ml-1 border-b border-slate-300">{job.forklift.model}</span>
          </div>
          <div>
            <span className="font-semibold">Hourmeter:</span>
            <span className="ml-1 border-b border-slate-300">{job.hourmeter_reading?.toLocaleString() || job.forklift.hourmeter?.toLocaleString()} hrs</span>
          </div>
        </div>
      )}

      {/* Items Checking Section */}
      <div className="mb-4">
        <div className="bg-slate-200 p-2 text-xs font-bold flex justify-between">
          <span>Items checking</span>
          <span>✓ - Ok &nbsp;&nbsp;&nbsp; ✗ - Need attention or Repair</span>
        </div>
        <div className="grid grid-cols-4 gap-1 border border-slate-300 p-2">
          <ChecklistSection title="Drive System" items={[
            { label: 'Front axle', key: 'drive_front_axle' },
            { label: 'Rear axle', key: 'drive_rear_axle' },
            { label: 'Drive motor/Engine', key: 'drive_motor_engine' },
            { label: 'Drive Controller/Transmission', key: 'drive_controller_transmission' },
          ]} />
          <ChecklistSection title="Steering System" items={[
            { label: 'Steering wheel/valve', key: 'steering_wheel_valve' },
            { label: 'Steering cylinder', key: 'steering_cylinder' },
            { label: 'Steering motor', key: 'steering_motor' },
            { label: 'Knuckle', key: 'steering_knuckle' },
          ]} />
          <ChecklistSection title="Braking System" items={[
            { label: 'Brake pedal', key: 'braking_brake_pedal' },
            { label: 'Parking brake', key: 'braking_parking_brake' },
            { label: 'Brake fluid/pipe', key: 'braking_fluid_pipe' },
            { label: 'Brake master pump', key: 'braking_master_pump' },
          ]} />
          <ChecklistSection title="Electrical System" items={[
            { label: 'Ignition system', key: 'electrical_ignition' },
            { label: 'Battery', key: 'electrical_battery' },
            { label: 'Electrical/wiring', key: 'electrical_wiring' },
            { label: 'Instruments/Error code', key: 'electrical_instruments' },
          ]} />
          
          <ChecklistSection title="Hydraulic System" items={[
            { label: 'Hydraulic pump', key: 'hydraulic_pump' },
            { label: 'Control valve', key: 'hydraulic_control_valve' },
            { label: 'Hose', key: 'hydraulic_hose' },
            { label: 'Oil Level', key: 'hydraulic_oil_level' },
          ]} />
          <ChecklistSection title="Load Handling System" items={[
            { label: 'Fork', key: 'load_fork' },
            { label: 'Mast & Roller', key: 'load_mast_roller' },
            { label: 'Chain & Chain Wheel', key: 'load_chain_wheel' },
            { label: 'Cylinder', key: 'load_cylinder' },
          ]} />
          <ChecklistSection title="Diesel/LPG/Petrol" items={[
            { label: 'Engine oil level', key: 'fuel_engine_oil_level' },
            { label: 'Fuel line leaks', key: 'fuel_line_leaks' },
            { label: 'Radiator', key: 'fuel_radiator' },
            { label: 'Exhaust piping', key: 'fuel_exhaust_piping' },
          ]} />
          <div className="space-y-1">
            <ChecklistSection title="Transmission" items={[
              { label: 'Transmission fluid level', key: 'transmission_fluid_level' },
              { label: 'Inching valve / Cable', key: 'transmission_inching_valve' },
              { label: 'Air Cleaner element', key: 'transmission_air_cleaner' },
              { label: 'LPG Regulator', key: 'transmission_lpg_regulator' },
            ]} />
          </div>
          
          <ChecklistSection title="Safety Devices" items={[
            { label: 'Overhead guard', key: 'safety_overhead_guard' },
            { label: 'Cabin / Body', key: 'safety_cabin_body' },
            { label: 'Back-rest', key: 'safety_backrest' },
            { label: 'Seat / Belt', key: 'safety_seat_belt' },
          ]} />
          <div className="space-y-1 text-xs border border-slate-300 p-2">
            <div className="font-bold bg-slate-100 -m-2 p-1 mb-1">Lighting</div>
            <div className="flex items-center py-0.5">{renderCheckbox(checklist.lighting_beacon_light)} Lighting / Beacon light</div>
            <div className="flex items-center py-0.5">{renderCheckbox(checklist.lighting_horn)} Horn</div>
            <div className="flex items-center py-0.5">{renderCheckbox(checklist.lighting_buzzer)} Buzzer</div>
            <div className="flex items-center py-0.5">{renderCheckbox(checklist.lighting_rear_view_mirror)} Rear view mirror</div>
          </div>
          <ChecklistSection title="Tyres" items={[
            { label: 'Front tyre', key: 'tyres_front' },
            { label: 'Rear tyre', key: 'tyres_rear' },
            { label: 'Rim', key: 'tyres_rim' },
            { label: 'Screw & Nut', key: 'tyres_screw_nut' },
          ]} />
          <ChecklistSection title="Wheels" items={[
            { label: 'Drive wheel', key: 'wheels_drive' },
            { label: 'Load Wheel', key: 'wheels_load' },
            { label: 'Support wheel', key: 'wheels_support' },
            { label: 'Hub & Nut', key: 'wheels_hub_nut' },
          ]} />
        </div>
      </div>

      {/* Recommendation */}
      <div className="mb-4 border border-slate-300 p-2">
        <div className="text-xs font-semibold mb-1">Recommendation:</div>
        <p className="text-xs min-h-[40px] border-b border-slate-300">{job.recommendation || '-'}</p>
      </div>

      {/* Job Carried Out */}
      <div className="mb-4 border border-slate-300 p-2">
        <div className="text-xs font-semibold mb-1">Job Carried Out:</div>
        <p className="text-xs min-h-[40px]">{job.job_carried_out || job.description}</p>
      </div>

      {/* Parts Table */}
      <table className="w-full border-collapse mb-4 text-xs">
        <thead>
          <tr className="bg-slate-100">
            <th className="border border-slate-300 p-2 text-left w-12">No</th>
            <th className="border border-slate-300 p-2 text-left w-24">Item Code</th>
            <th className="border border-slate-300 p-2 text-left">Item Description</th>
            <th className="border border-slate-300 p-2 text-center w-16">Qty</th>
            <th className="border border-slate-300 p-2 text-right w-24">Unit Price</th>
            <th className="border border-slate-300 p-2 text-right w-28">Amount(RM)</th>
          </tr>
        </thead>
        <tbody>
          {job.parts_used.map((part, idx) => (
            <tr key={part.job_part_id}>
              <td className="border border-slate-300 p-2">{idx + 1}</td>
              <td className="border border-slate-300 p-2 font-mono">{part.part_id.slice(0, 6)}</td>
              <td className="border border-slate-300 p-2">{part.part_name}</td>
              <td className="border border-slate-300 p-2 text-center">{part.quantity} unit</td>
              <td className="border border-slate-300 p-2 text-right">{part.sell_price_at_time.toFixed(2)}</td>
              <td className="border border-slate-300 p-2 text-right">{(part.quantity * part.sell_price_at_time).toFixed(2)}</td>
            </tr>
          ))}
          {/* Empty rows for writing */}
          {[...Array(Math.max(0, 5 - job.parts_used.length))].map((_, idx) => (
            <tr key={`empty-${idx}`}>
              <td className="border border-slate-300 p-2 h-8">&nbsp;</td>
              <td className="border border-slate-300 p-2">&nbsp;</td>
              <td className="border border-slate-300 p-2">&nbsp;</td>
              <td className="border border-slate-300 p-2">&nbsp;</td>
              <td className="border border-slate-300 p-2">&nbsp;</td>
              <td className="border border-slate-300 p-2">&nbsp;</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4}></td>
            <td className="border border-slate-300 p-2 text-right font-semibold">Labor:</td>
            <td className="border border-slate-300 p-2 text-right">{labor.toFixed(2)}</td>
          </tr>
          <tr>
            <td colSpan={4}></td>
            <td className="border border-slate-300 p-2 text-right font-bold">TOTAL AMOUNT (RM)</td>
            <td className="border border-slate-300 p-2 text-right font-bold">{total.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>

      {/* Footer with Times and Signatures */}
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Repairing Hours: from</span>
            <span className="border-b border-slate-300 w-20 text-center">
              {job.repair_start_time ? new Date(job.repair_start_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '_____'}
            </span>
            <span>to</span>
            <span className="border-b border-slate-300 w-20 text-center">
              {job.repair_end_time ? new Date(job.repair_end_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '_____'}
            </span>
          </div>
          <div className="mt-4">
            <p className="font-semibold mb-2">Technician Name:</p>
            {job.technician_signature ? (
              <div>
                <img src={job.technician_signature.signature_url} alt="Tech Signature" className="h-12 border-b border-slate-300" />
                <p className="text-xs mt-1">{job.technician_signature.signed_by_name}</p>
              </div>
            ) : (
              <div className="border-b border-slate-300 h-16"></div>
            )}
          </div>
        </div>
        
        <div className="border border-slate-300 p-3">
          <div className="text-center font-bold mb-2">Service Completed & Checked</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-slate-500">for Driver</p>
              <p className="font-semibold">LOGISTICS DEPARTMENT</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">for Customer</p>
              <p className="font-semibold">Name:</p>
              {job.customer_signature && (
                <p className="text-sm">{job.customer_signature.signed_by_name}</p>
              )}
            </div>
          </div>
          {job.customer_signature && (
            <div className="mt-2">
              <img src={job.customer_signature.signature_url} alt="Customer Signature" className="h-12" />
              <p className="text-xs text-slate-500 mt-1">Chop & Sign</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Function to open print dialog for service report
export const printServiceReport = (job: Job, reportNumber?: string) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow pop-ups to print the service report');
    return;
  }

  const checklist = job.condition_checklist || {};
  const totalParts = job.parts_used.reduce((acc, p) => acc + (p.sell_price_at_time * p.quantity), 0);
  const labor = job.labor_cost || 0;
  const extra = (job.extra_charges || []).reduce((acc, c) => acc + c.amount, 0);
  const total = totalParts + labor + extra;

  const renderCheckMark = (checked?: boolean) => 
    checked === true ? '✓' : checked === false ? '✗' : '';

  const checklistHTML = `
    <div class="checklist-grid">
      <div class="checklist-section">
        <div class="section-title">Drive System</div>
        <div class="check-item"><span class="checkbox">${renderCheckMark(checklist.drive_front_axle)}</span> Front axle</div>
        <div class="check-item"><span class="checkbox">${renderCheckMark(checklist.drive_rear_axle)}</span> Rear axle</div>
        <div class="check-item"><span class="checkbox">${renderCheckMark(checklist.drive_motor_engine)}</span> Drive motor/Engine</div>
        <div class="check-item"><span class="checkbox">${renderCheckMark(checklist.drive_controller_transmission)}</span> Controller/Transmission</div>
      </div>
      <div class="checklist-section">
        <div class="section-title">Steering System</div>
        <div class="check-item"><span class="checkbox">${renderCheckMark(checklist.steering_wheel_valve)}</span> Steering wheel/valve</div>
        <div class="check-item"><span class="checkbox">${renderCheckMark(checklist.steering_cylinder)}</span> Steering cylinder</div>
        <div class="check-item"><span class="checkbox">${renderCheckMark(checklist.steering_motor)}</span> Steering motor</div>
        <div class="check-item"><span class="checkbox">${renderCheckMark(checklist.steering_knuckle)}</span> Knuckle</div>
      </div>
      <div class="checklist-section">
        <div class="section-title">Braking System</div>
        <div class="check-item"><span class="checkbox">${renderCheckMark(checklist.braking_brake_pedal)}</span> Brake pedal</div>
        <div class="check-item"><span class="checkbox">${renderCheckMark(checklist.braking_parking_brake)}</span> Parking brake</div>
        <div class="check-item"><span class="checkbox">${renderCheckMark(checklist.braking_fluid_pipe)}</span> Brake fluid/pipe</div>
        <div class="check-item"><span class="checkbox">${renderCheckMark(checklist.braking_master_pump)}</span> Brake master pump</div>
      </div>
      <div class="checklist-section">
        <div class="section-title">Electrical System</div>
        <div class="check-item"><span class="checkbox">${renderCheckMark(checklist.electrical_ignition)}</span> Ignition system</div>
        <div class="check-item"><span class="checkbox">${renderCheckMark(checklist.electrical_battery)}</span> Battery</div>
        <div class="check-item"><span class="checkbox">${renderCheckMark(checklist.electrical_wiring)}</span> Electrical/wiring</div>
        <div class="check-item"><span class="checkbox">${renderCheckMark(checklist.electrical_instruments)}</span> Instruments</div>
      </div>
      <div class="checklist-section">
        <div class="section-title">Hydraulic System</div>
        <div class="check-item"><span class="checkbox">${renderCheckMark(checklist.hydraulic_pump)}</span> Hydraulic pump</div>
        <div class="check-item"><span class="checkbox">${renderCheckMark(checklist.hydraulic_control_valve)}</span> Control valve</div>
        <div class="check-item"><span class="checkbox">${renderCheckMark(checklist.hydraulic_hose)}</span> Hose</div>
        <div class="check-item"><span class="checkbox">${renderCheckMark(checklist.hydraulic_oil_level)}</span> Oil Level</div>
      </div>
      <div class="checklist-section">
        <div class="section-title">Load Handling</div>
        <div class="check-item"><span class="checkbox">${renderCheckMark(checklist.load_fork)}</span> Fork</div>
        <div class="check-item"><span class="checkbox">${renderCheckMark(checklist.load_mast_roller)}</span> Mast & Roller</div>
        <div class="check-item"><span class="checkbox">${renderCheckMark(checklist.load_chain_wheel)}</span> Chain & Chain Wheel</div>
        <div class="check-item"><span class="checkbox">${renderCheckMark(checklist.load_cylinder)}</span> Cylinder</div>
      </div>
      <div class="checklist-section">
        <div class="section-title">Diesel/LPG/Petrol</div>
        <div class="check-item"><span class="checkbox">${renderCheckMark(checklist.fuel_engine_oil_level)}</span> Engine oil level</div>
        <div class="check-item"><span class="checkbox">${renderCheckMark(checklist.fuel_line_leaks)}</span> Fuel line leaks</div>
        <div class="check-item"><span class="checkbox">${renderCheckMark(checklist.fuel_radiator)}</span> Radiator</div>
        <div class="check-item"><span class="checkbox">${renderCheckMark(checklist.fuel_exhaust_piping)}</span> Exhaust piping</div>
      </div>
      <div class="checklist-section">
        <div class="section-title">Tyres & Wheels</div>
        <div class="check-item"><span class="checkbox">${renderCheckMark(checklist.tyres_front)}</span> Front tyre</div>
        <div class="check-item"><span class="checkbox">${renderCheckMark(checklist.tyres_rear)}</span> Rear tyre</div>
        <div class="check-item"><span class="checkbox">${renderCheckMark(checklist.wheels_drive)}</span> Drive wheel</div>
        <div class="check-item"><span class="checkbox">${renderCheckMark(checklist.wheels_load)}</span> Load Wheel</div>
      </div>
    </div>
  `;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Service Report - ${reportNumber || job.job_id.slice(0, 8)}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 11px; padding: 15px; }
        .header { display: flex; justify-content: space-between; border-bottom: 3px solid #1e40af; padding-bottom: 10px; margin-bottom: 10px; }
        .company-name { font-size: 24px; font-weight: bold; color: #1e40af; }
        .report-title { font-size: 16px; font-weight: bold; }
        .report-number { background: #f1f5f9; padding: 8px; border: 1px solid #cbd5e1; margin-top: 5px; }
        .customer-section { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
        .customer-box { border: 1px solid #cbd5e1; padding: 10px; }
        .forklift-details { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; border: 1px solid #cbd5e1; padding: 8px; margin-bottom: 10px; }
        .checklist-header { background: #e2e8f0; padding: 8px; font-weight: bold; display: flex; justify-content: space-between; }
        .checklist-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; border: 1px solid #cbd5e1; padding: 8px; margin-bottom: 10px; }
        .checklist-section { border: 1px solid #e2e8f0; padding: 5px; }
        .section-title { font-weight: bold; background: #f1f5f9; margin: -5px -5px 5px -5px; padding: 3px 5px; font-size: 10px; }
        .check-item { display: flex; align-items: center; gap: 3px; font-size: 10px; padding: 2px 0; }
        .checkbox { display: inline-block; width: 14px; height: 14px; border: 1px solid #64748b; text-align: center; line-height: 14px; font-size: 10px; }
        .job-section { border: 1px solid #cbd5e1; padding: 8px; margin-bottom: 10px; }
        .job-section-title { font-weight: bold; margin-bottom: 5px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        th, td { border: 1px solid #cbd5e1; padding: 6px; text-align: left; }
        th { background: #f1f5f9; font-size: 10px; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .footer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .signature-box { border: 1px solid #cbd5e1; padding: 10px; min-height: 100px; }
        .signature-img { max-height: 50px; }
        @media print { body { padding: 10px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="company-name">FieldPro Service</div>
          <div style="font-size: 10px; color: #64748b;">Field Service Management System</div>
          <div style="font-size: 10px;">Tel: (+60) 3-XXXX XXXX</div>
          <div style="font-size: 10px; color: #1e40af;">service@fieldpro.com</div>
        </div>
        <div style="text-align: right;">
          <div class="report-title">SERVICE / REPAIR REPORT</div>
          <div class="report-number">
            <div><strong>No.: ${reportNumber || job.service_report_number || job.job_id.slice(0, 8).toUpperCase()}</strong></div>
            <div>Date: ${new Date(job.created_at).toLocaleDateString('en-GB')}</div>
          </div>
        </div>
      </div>

      <div class="customer-section">
        <div class="customer-box">
          <div><strong>Name:</strong> ${job.customer.name}</div>
          <div><strong>Address:</strong> ${job.customer.address}</div>
          <div><strong>Attn:</strong> ${job.customer.contact_person || '-'}</div>
        </div>
        <div class="customer-box">
          <div>Your ref no.: ${job.customer.account_number || '-'}</div>
          <div style="margin-top: 10px;">
            <label><input type="checkbox" ${job.job_type === 'Service' ? 'checked' : ''} disabled> SERVICE</label>
            <label style="margin-left: 10px;"><input type="checkbox" ${job.job_type === 'Repair' ? 'checked' : ''} disabled> REPAIR</label>
            <label style="margin-left: 10px;"><input type="checkbox" ${job.job_type === 'Checking' ? 'checked' : ''} disabled> CHECKING</label>
            <label style="margin-left: 10px;"><input type="checkbox" ${job.job_type === 'Accident' ? 'checked' : ''} disabled> ACCIDENT</label>
          </div>
        </div>
      </div>

      ${job.forklift ? `
        <div class="forklift-details">
          <div><strong>Brand:</strong> ${job.forklift.make}</div>
          <div><strong>Serial Number:</strong> ${job.forklift.serial_number}</div>
          <div><strong>Forklift No:</strong> ${job.forklift.forklift_no || '-'}</div>
          <div><strong>Equipment:</strong> ${job.title}</div>
          <div><strong>Model:</strong> ${job.forklift.model}</div>
          <div><strong>Hourmeter:</strong> ${(job.hourmeter_reading || job.forklift.hourmeter)?.toLocaleString()} hrs</div>
        </div>
      ` : ''}

      <div class="checklist-header">
        <span>Items checking</span>
        <span>✓ - Ok &nbsp;&nbsp;&nbsp; ✗ - Need attention or Repair</span>
      </div>
      ${checklistHTML}

      <div class="job-section">
        <div class="job-section-title">Recommendation:</div>
        <div style="min-height: 30px; border-bottom: 1px solid #cbd5e1;">${job.recommendation || '-'}</div>
      </div>

      <div class="job-section">
        <div class="job-section-title">Job Carried Out:</div>
        <div style="min-height: 40px;">${job.job_carried_out || job.description}</div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 30px;">No</th>
            <th style="width: 80px;">Item Code</th>
            <th>Item Description</th>
            <th style="width: 50px;" class="text-center">Qty</th>
            <th style="width: 80px;" class="text-right">Unit Price</th>
            <th style="width: 90px;" class="text-right">Amount(RM)</th>
          </tr>
        </thead>
        <tbody>
          ${job.parts_used.map((part, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td style="font-family: monospace;">${part.part_id.slice(0, 6)}</td>
              <td>${part.part_name}</td>
              <td class="text-center">${part.quantity}</td>
              <td class="text-right">${part.sell_price_at_time.toFixed(2)}</td>
              <td class="text-right">${(part.quantity * part.sell_price_at_time).toFixed(2)}</td>
            </tr>
          `).join('')}
          ${[...Array(Math.max(0, 5 - job.parts_used.length))].map(() => `
            <tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td></tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="4"></td>
            <td class="text-right"><strong>Labor:</strong></td>
            <td class="text-right">${labor.toFixed(2)}</td>
          </tr>
          <tr>
            <td colspan="4"></td>
            <td class="text-right"><strong>TOTAL (RM)</strong></td>
            <td class="text-right"><strong>${total.toFixed(2)}</strong></td>
          </tr>
        </tfoot>
      </table>

      <div class="footer-grid">
        <div>
          <div style="margin-bottom: 10px;">
            <strong>Repairing Hours:</strong> from 
            <span style="border-bottom: 1px solid #000; display: inline-block; width: 60px; text-align: center;">
              ${job.repair_start_time ? new Date(job.repair_start_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}
            </span>
            to
            <span style="border-bottom: 1px solid #000; display: inline-block; width: 60px; text-align: center;">
              ${job.repair_end_time ? new Date(job.repair_end_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : ''}
            </span>
          </div>
          <div style="margin-top: 20px;">
            <strong>Technician Name:</strong>
            ${job.technician_signature ? `
              <div><img src="${job.technician_signature.signature_url}" class="signature-img" /></div>
              <div>${job.technician_signature.signed_by_name}</div>
            ` : '<div style="border-bottom: 1px solid #000; height: 50px; margin-top: 10px;"></div>'}
          </div>
        </div>
        <div class="signature-box">
          <div style="text-align: center; font-weight: bold; margin-bottom: 10px;">Service Completed & Checked</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div>
              <div style="font-size: 9px; color: #64748b;">for Driver</div>
              <div><strong>LOGISTICS DEPT</strong></div>
            </div>
            <div>
              <div style="font-size: 9px; color: #64748b;">for Customer</div>
              <div><strong>Name:</strong> ${job.customer_signature?.signed_by_name || ''}</div>
            </div>
          </div>
          ${job.customer_signature ? `
            <div style="margin-top: 10px;">
              <img src="${job.customer_signature.signature_url}" class="signature-img" />
              <div style="font-size: 9px; color: #64748b;">Chop & Sign</div>
            </div>
          ` : ''}
        </div>
      </div>

      <script>window.onload = function() { window.print(); };</script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
};

export default ServiceReportPDF;
