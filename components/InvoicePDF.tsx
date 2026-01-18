import { Job } from '../types';

// Company info interface for customization
interface CompanyInfo {
  name: string;
  registration: string;
  address: string;
  branch?: string;
  tel: string;
  customerService?: string;
  fax?: string;
  sstNo?: string;
  email: string;
}

const defaultCompanyInfo: CompanyInfo = {
  name: 'FIELDPRO SERVICE SDN BHD',
  registration: '(XXXXXX-X)',
  address: 'Your Company Address, City, State, Postal Code',
  branch: '',
  tel: '03-XXXX XXXX (Hunting Line)',
  customerService: '03-XXXX XXXX (Customer Service)',
  fax: '03-XXXX XXXX',
  sstNo: 'XXX-XXXX-XXXXXXXX',
  email: 'service@fieldpro.com',
};

// Format date as DD/MM/YYYY
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

// Format number with commas
const formatNumber = (num: number): string => {
  return num.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// Generate invoice number
const generateInvoiceNumber = (job: Job): string => {
  const year = new Date(job.created_at).getFullYear();
  const jobNum = job.job_id.slice(0, 5).toUpperCase();
  return `INV ${year}-${jobNum}`;
};

// Print invoice matching ACWER format
export const printInvoice = (job: Job, companyInfo: CompanyInfo = defaultCompanyInfo) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow pop-ups to print the invoice');
    return;
  }

  // Calculate totals
  const partsTotal = job.parts_used.reduce((acc, p) => acc + (p.sell_price_at_time * p.quantity), 0);
  const laborCost = job.labor_cost || 0;
  const extraCharges = (job.extra_charges || []).reduce((acc, c) => acc + c.amount, 0);
  const subTotal = partsTotal + laborCost + extraCharges;
  const taxRate = 0; // SST rate, set to 0 for now
  const taxAmount = subTotal * taxRate;
  const grandTotal = subTotal + taxAmount;

  const invoiceNumber = generateInvoiceNumber(job);
  const invoiceDate = formatDate(job.invoiced_at || job.created_at);

  // Build equipment reference line
  const equipmentRef = job.forklift 
    ? `[MODEL: ${job.forklift.model} SN: ${job.forklift.serial_number}${job.forklift.forklift_no ? ` [${job.forklift.forklift_no}]` : ''}]`
    : '';

  // Build items HTML with detailed descriptions
  let itemCounter = 0;
  const partsHtml = job.parts_used.map(part => {
    itemCounter++;
    return `
      <tr>
        <td class="border-cell center">${itemCounter}</td>
        <td class="border-cell description">
          <div class="item-title">${part.part_name}</div>
        </td>
        <td class="border-cell center">${part.quantity} UNIT</td>
        <td class="border-cell right">${formatNumber(part.sell_price_at_time)}</td>
        <td class="border-cell right">${formatNumber(part.sell_price_at_time * part.quantity)}</td>
      </tr>
    `;
  }).join('');

  // Labor row
  if (laborCost > 0) {
    itemCounter++;
    const laborHtml = `
      <tr>
        <td class="border-cell center">${itemCounter}</td>
        <td class="border-cell description">
          <div class="item-title">LABOUR / SERVICE CHARGES</div>
          <div class="item-detail">Service: ${job.title}</div>
          ${job.job_carried_out ? `<div class="item-detail">Work Done: ${job.job_carried_out}</div>` : ''}
        </td>
        <td class="border-cell center">1 LOT</td>
        <td class="border-cell right">${formatNumber(laborCost)}</td>
        <td class="border-cell right">${formatNumber(laborCost)}</td>
      </tr>
    `;
    // Insert labor after parts
    const partsWithLabor = partsHtml + laborHtml;
    // Reassign
    var allItemsHtml = partsWithLabor;
  } else {
    var allItemsHtml = partsHtml;
  }

  // Extra charges
  if (job.extra_charges && job.extra_charges.length > 0) {
    job.extra_charges.forEach(charge => {
      itemCounter++;
      allItemsHtml += `
        <tr>
          <td class="border-cell center">${itemCounter}</td>
          <td class="border-cell description">
            <div class="item-title">${charge.name.toUpperCase()}</div>
            ${charge.description ? `<div class="item-detail">${charge.description}</div>` : ''}
          </td>
          <td class="border-cell center">1 LOT</td>
          <td class="border-cell right">${formatNumber(charge.amount)}</td>
          <td class="border-cell right">${formatNumber(charge.amount)}</td>
        </tr>
      `;
    });
  }

  // Add empty rows to fill space (minimum 8 rows)
  const minRows = 8;
  const currentRows = itemCounter;
  for (let i = currentRows; i < minRows; i++) {
    allItemsHtml += `
      <tr>
        <td class="border-cell center">&nbsp;</td>
        <td class="border-cell">&nbsp;</td>
        <td class="border-cell">&nbsp;</td>
        <td class="border-cell">&nbsp;</td>
        <td class="border-cell">&nbsp;</td>
      </tr>
    `;
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Invoice - ${invoiceNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: Arial, sans-serif; 
      font-size: 11px; 
      padding: 20px 30px;
      color: #000;
      line-height: 1.4;
    }
    
    /* Header Section */
    .header {
      border-bottom: 3px solid #1a365d;
      padding-bottom: 10px;
      margin-bottom: 10px;
    }
    .company-name {
      font-size: 18px;
      font-weight: bold;
      color: #1a365d;
    }
    .company-details {
      font-size: 10px;
      color: #333;
      margin-top: 3px;
    }
    .company-details .highlight {
      color: #1a365d;
    }
    .sst-line {
      font-size: 10px;
      margin-top: 5px;
    }
    
    /* Customer and Invoice Info Section */
    .info-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
    }
    .customer-box {
      width: 55%;
      border: 1px solid #000;
      padding: 8px;
      font-size: 11px;
    }
    .customer-name {
      font-weight: bold;
      margin-bottom: 5px;
    }
    .invoice-box {
      width: 42%;
    }
    .invoice-title {
      background: #1a365d;
      color: white;
      font-size: 16px;
      font-weight: bold;
      text-align: center;
      padding: 8px;
      margin-bottom: 5px;
    }
    .invoice-details {
      border: 1px solid #000;
      font-size: 10px;
    }
    .invoice-row {
      display: flex;
      border-bottom: 1px solid #ccc;
    }
    .invoice-row:last-child {
      border-bottom: none;
    }
    .invoice-label {
      width: 70px;
      padding: 3px 5px;
      background: #f0f0f0;
      font-weight: bold;
    }
    .invoice-value {
      flex: 1;
      padding: 3px 5px;
    }
    
    /* Reference Line */
    .ref-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 10px;
      font-size: 10px;
    }
    .ref-left {
      flex: 1;
    }
    .ref-right {
      text-align: right;
      color: #1a365d;
    }
    .ref-line {
      font-weight: bold;
      margin-top: 5px;
    }
    .equipment-ref {
      font-style: italic;
      margin-top: 3px;
    }
    
    /* Main Table */
    .items-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
    }
    .items-table th {
      background: #e8e8e8;
      border: 1px solid #000;
      padding: 8px 5px;
      font-weight: bold;
      text-align: center;
      font-size: 10px;
    }
    .border-cell {
      border: 1px solid #000;
      padding: 6px 5px;
      vertical-align: top;
    }
    .border-cell.center { text-align: center; }
    .border-cell.right { text-align: right; }
    .border-cell.description { width: 45%; }
    
    .item-title {
      font-weight: bold;
      margin-bottom: 3px;
    }
    .item-detail {
      font-size: 10px;
      color: #333;
      margin-left: 10px;
    }
    
    /* Totals Section */
    .totals-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 15px;
    }
    .totals-left {
      width: 55%;
      font-size: 10px;
    }
    .totals-right {
      width: 42%;
    }
    .totals-table {
      width: 100%;
      border-collapse: collapse;
    }
    .totals-table td {
      border: 1px solid #000;
      padding: 5px 8px;
    }
    .totals-label {
      background: #f0f0f0;
      font-weight: bold;
      width: 60%;
    }
    .totals-value {
      text-align: right;
      font-weight: bold;
    }
    .grand-total {
      background: #1a365d;
      color: white;
    }
    
    /* Terms Row */
    .terms-row {
      display: flex;
      font-size: 10px;
      margin-bottom: 5px;
    }
    .terms-label {
      font-weight: bold;
      margin-right: 5px;
    }
    
    /* Footer */
    .footer-section {
      margin-top: 15px;
      font-size: 9px;
      color: #333;
      border-top: 1px solid #ccc;
      padding-top: 10px;
    }
    .footer-note {
      margin-bottom: 15px;
      line-height: 1.5;
    }
    
    /* Signature Section */
    .signature-section {
      display: flex;
      justify-content: space-between;
      margin-top: 20px;
    }
    .signature-box {
      width: 45%;
    }
    .signature-line {
      border-bottom: 1px solid #000;
      height: 60px;
      margin-bottom: 5px;
    }
    .signature-label {
      font-size: 10px;
      font-weight: bold;
    }
    .signature-company {
      font-size: 9px;
      color: #666;
    }
    .computer-generated {
      font-style: italic;
      font-size: 9px;
      color: #666;
      margin-top: 5px;
    }
    
    .sig-image {
      max-height: 50px;
      max-width: 150px;
    }
    
    @media print {
      body { padding: 10px 20px; }
      @page { margin: 0.5cm; }
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <div class="company-name">${companyInfo.name} ${companyInfo.registration}</div>
    <div class="company-details">
      ${companyInfo.address}<br>
      Tel: ${companyInfo.tel}${companyInfo.customerService ? `, ${companyInfo.customerService}` : ''} ${companyInfo.fax ? `Fax: ${companyInfo.fax}` : ''}<br>
      ${companyInfo.branch ? `Branch: ${companyInfo.branch}<br>` : ''}
      <span class="highlight">Email: ${companyInfo.email}</span>
    </div>
    ${companyInfo.sstNo ? `<div class="sst-line">SST NO: ${companyInfo.sstNo}</div>` : ''}
  </div>
  
  <!-- Customer and Invoice Info -->
  <div class="info-section">
    <div class="customer-box">
      <div class="customer-name">${job.customer?.name || 'N/A'}</div>
      <div>${job.customer?.address || 'N/A'}</div>
      ${job.customer?.phone ? `<div>TEL: ${job.customer.phone}</div>` : ''}
      ${job.customer?.email ? `<div>EMAIL: ${job.customer.email}</div>` : ''}
    </div>
    <div class="invoice-box">
      <div class="invoice-title">INVOICE</div>
      <div class="invoice-details">
        <div class="invoice-row">
          <div class="invoice-label">No.</div>
          <div class="invoice-value">: ${invoiceNumber}</div>
        </div>
        <div class="invoice-row">
          <div class="invoice-label">Date</div>
          <div class="invoice-value">: ${invoiceDate}</div>
        </div>
        <div class="invoice-row">
          <div class="invoice-label">Page</div>
          <div class="invoice-value">: 1 of 1</div>
        </div>
        <div class="invoice-row">
          <div class="invoice-label">A/C No.</div>
          <div class="invoice-value">: ${job.customer.account_number || '-'}</div>
        </div>
        <div class="invoice-row">
          <div class="invoice-label">ATTN.</div>
          <div class="invoice-value">: ${job.customer.contact_person || '-'}</div>
        </div>
      </div>
    </div>
  </div>
  
  <!-- Reference Line -->
  <div class="ref-section">
    <div class="ref-left">
      <div><strong>Technician:</strong> ${job.assigned_technician_name || '-'}</div>
      <div class="ref-line">RE: ${job.title.toUpperCase()}</div>
      ${equipmentRef ? `<div class="equipment-ref">${equipmentRef}</div>` : ''}
    </div>
    <div class="ref-right">
      Please verify details
    </div>
  </div>
  
  <!-- Items Table -->
  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 8%;">Item</th>
        <th style="width: 47%;">Description</th>
        <th style="width: 12%;">Qty</th>
        <th style="width: 15%;">U/Price<br>RM</th>
        <th style="width: 18%;">Amount<br>RM</th>
      </tr>
    </thead>
    <tbody>
      ${allItemsHtml}
    </tbody>
  </table>
  
  <!-- Totals Section -->
  <div class="totals-section">
    <div class="totals-left">
      <div class="terms-row">
        <span class="terms-label">Service Report:</span>
        <span>${job.service_report_number || job.job_id.slice(0, 8).toUpperCase()}</span>
      </div>
      <div class="terms-row">
        <span class="terms-label">Job Type:</span>
        <span>${job.job_type || 'Service'}</span>
      </div>
      ${job.recommendation ? `
      <div class="terms-row">
        <span class="terms-label">Remark:</span>
        <span>${job.recommendation}</span>
      </div>
      ` : ''}
    </div>
    <div class="totals-right">
      <table class="totals-table">
        <tr>
          <td class="totals-label">Sub Total (Excluding SST)</td>
          <td class="totals-value">${formatNumber(subTotal)}</td>
        </tr>
        <tr>
          <td class="totals-label">Tax @ ${(taxRate * 100).toFixed(0)}% on ${formatNumber(subTotal)}</td>
          <td class="totals-value">${formatNumber(taxAmount)}</td>
        </tr>
        <tr>
          <td class="totals-label grand-total">Total (Inclusive of SST)</td>
          <td class="totals-value grand-total">${formatNumber(grandTotal)}</td>
        </tr>
      </table>
    </div>
  </div>
  
  <!-- Delivery Terms -->
  <div style="display: flex; justify-content: flex-end; margin-bottom: 15px;">
    <div style="width: 42%; font-size: 10px;">
      <div class="terms-row">
        <span class="terms-label">Completion Date:</span>
        <span>${job.completed_at ? formatDate(job.completed_at) : '-'}</span>
      </div>
      <div class="terms-row">
        <span class="terms-label">Payment Term:</span>
        <span>${job.payment_term || 'C.O.D'}</span>
      </div>
    </div>
  </div>
  
  <!-- Footer -->
  <div class="footer-section">
    <div class="footer-note">
      Thank you for your business. Please make payment within the agreed terms. 
      For any queries regarding this invoice, please contact our service department.
      The Company reserves the right to charge interest on overdue payments.
    </div>
    
    <div class="signature-section">
      <div class="signature-box">
        <div class="signature-label">Prepared by:</div>
        ${job.technician_signature ? `
          <img src="${job.technician_signature.signature_url}" class="sig-image" alt="Technician Signature">
          <div>${job.technician_signature.signed_by_name}</div>
        ` : `
          <div class="signature-line"></div>
        `}
        <div class="signature-company">${companyInfo.name}</div>
        <div class="computer-generated">This is computer generated, no signature required</div>
      </div>
      <div class="signature-box">
        <div class="signature-label">Received by:</div>
        ${job.customer_signature ? `
          <img src="${job.customer_signature.signature_url}" class="sig-image" alt="Customer Signature">
          <div>${job.customer_signature.signed_by_name}</div>
        ` : `
          <div class="signature-line"></div>
        `}
        <div class="signature-company">${job.customer?.name || 'Customer'}</div>
        <div style="font-size: 9px; color: #666;">(Please chop & sign)</div>
      </div>
    </div>
  </div>
  
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
};

export default printInvoice;
