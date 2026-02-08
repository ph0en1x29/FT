/* eslint-disable max-lines */
import React from 'react';
import { sanitizeHtml } from '../services/sanitizeService';
import { Job,Quotation,QuotationItem } from '../types';

interface QuotationPDFProps {
  quotation?: Quotation;
  job?: Job; // Alternative: generate from job data
  companyInfo?: {
    name: string;
    address: string;
    branch?: string;
    phone: string;
    fax?: string;
    email: string;
    sstNo?: string;
  };
}

const defaultCompanyInfo = {
  name: 'FieldPro Service',
  address: 'Your Business Address, City, State, Postal Code',
  branch: '',
  phone: '(+60) 3-XXXX XXXX',
  fax: '(+60) 3-XXXX XXXX',
  email: 'service@yourcompany.com',
  sstNo: 'SST-XXXX-XXXX',
};

// Function to generate quotation from job
export const generateQuotationFromJob = (job: Job): Partial<Quotation> => {
  const items: QuotationItem[] = job.parts_used.map((part, idx) => ({
    item_number: idx + 1,
    description: part.part_name,
    quantity: part.quantity,
    unit_price: part.sell_price_at_time,
    amount: part.quantity * part.sell_price_at_time,
  }));

  // Add labor as an item if exists
  if (job.labor_cost && job.labor_cost > 0) {
    items.push({
      item_number: items.length + 1,
      description: 'Labor Charges',
      quantity: 1,
      unit_price: job.labor_cost,
      amount: job.labor_cost,
    });
  }

  // Add extra charges
  if (job.extra_charges) {
    job.extra_charges.forEach((charge, _idx) => {
      items.push({
        item_number: items.length + 1,
        description: `${charge.name}${charge.description ? ` - ${charge.description}` : ''}`,
        quantity: 1,
        unit_price: charge.amount,
        amount: charge.amount,
      });
    });
  }

  const subTotal = items.reduce((sum, item) => sum + item.amount, 0);

  return {
    customer: job.customer,
    customer_id: job.customer_id,
    date: new Date().toISOString(),
    attention: job.customer.contact_person || '',
    reference: job.forklift 
      ? `[MODEL: ${job.forklift.model} SN: ${job.forklift.serial_number}${job.forklift.forklift_no ? ` [${job.forklift.forklift_no}]` : ''}]`
      : job.title,
    items,
    sub_total: subTotal,
    tax_rate: 0,
    tax_amount: 0,
    total: subTotal,
    validity: '1 WEEK FROM OFFER DATE',
    delivery_term: '1 WEEK UPON CONFIRM ORDER',
    payment_term: 'C.O.D',
    forklift_id: job.forklift_id,
    forklift: job.forklift,
  };
};

// Function to print quotation
export const printQuotation = (
  data: Partial<Quotation>, 
  quotationNumber: string,
  companyInfo = defaultCompanyInfo
) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow pop-ups to print the quotation');
    return;
  }

  const items = data.items || [];
  const subTotal = data.sub_total || 0;
  const taxRate = data.tax_rate || 0;
  const taxAmount = data.tax_amount || 0;
  const total = data.total || subTotal;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Quotation - ${sanitizeHtml(quotationNumber)}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; font-size: 11px; padding: 20px; max-width: 210mm; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; margin-bottom: 20px; }
        .company-info { font-size: 10px; }
        .company-name { font-size: 18px; font-weight: bold; color: #1e40af; margin-bottom: 5px; }
        .company-address { color: #64748b; line-height: 1.5; }
        .doc-title { text-align: right; }
        .doc-title h1 { font-size: 20px; color: #1e40af; margin-bottom: 10px; }
        .quotation-number { font-size: 14px; font-weight: bold; }
        .customer-section { display: grid; grid-template-columns: 2fr 1fr; gap: 20px; margin-bottom: 20px; border: 1px solid #e2e8f0; }
        .customer-address { padding: 15px; background: #f8fafc; }
        .customer-address .name { font-weight: bold; font-size: 12px; margin-bottom: 5px; }
        .quotation-meta { padding: 15px; border-left: 1px solid #e2e8f0; }
        .meta-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .meta-label { color: #64748b; }
        .attention { margin: 10px 0; padding: 10px; background: #fef3c7; border-left: 3px solid #f59e0b; }
        .reference { margin: 10px 0; padding: 10px; background: #e0f2fe; border-left: 3px solid #0ea5e9; }
        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .items-table th { background: #1e40af; color: white; padding: 10px; text-align: left; font-size: 10px; }
        .items-table td { padding: 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
        .items-table .amount { text-align: right; }
        .items-table .qty { text-align: center; }
        .description-details { font-size: 10px; color: #64748b; margin-top: 5px; }
        .totals { width: 300px; margin-left: auto; }
        .totals-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
        .totals-row.total { border-top: 2px solid #1e40af; border-bottom: 2px solid #1e40af; font-weight: bold; font-size: 14px; background: #f8fafc; padding: 12px 8px; }
        .terms { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; font-size: 10px; }
        .term-box { padding: 10px; background: #f8fafc; border: 1px solid #e2e8f0; }
        .term-label { font-weight: bold; color: #64748b; margin-bottom: 5px; }
        .footer-note { font-size: 10px; color: #64748b; margin: 20px 0; padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; line-height: 1.6; }
        .signature-section { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 30px; }
        .signature-box { }
        .signature-line { border-bottom: 1px solid #000; height: 60px; margin: 20px 0 5px 0; }
        .signature-name { font-size: 10px; }
        .prepared-by { font-size: 10px; color: #64748b; }
        .accept-box { border: 1px solid #e2e8f0; padding: 15px; }
        .accept-title { font-weight: bold; margin-bottom: 10px; }
        @media print {
          body { padding: 10px; }
          .items-table th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company-info">
          <div class="company-name">${sanitizeHtml(companyInfo.name)}</div>
          <div class="company-address">
            ${sanitizeHtml(companyInfo.address)}<br>
            Tel: ${sanitizeHtml(companyInfo.phone)}${companyInfo.fax ? `, Fax: ${sanitizeHtml(companyInfo.fax)}` : ''}<br>
            ${companyInfo.branch ? `Branch: ${sanitizeHtml(companyInfo.branch)}<br>` : ''}
            ${companyInfo.sstNo ? `SST NO: ${sanitizeHtml(companyInfo.sstNo)}` : ''}
          </div>
        </div>
        <div class="doc-title">
          <h1>QUOTATION</h1>
          <div class="quotation-number">No.: ${sanitizeHtml(quotationNumber)}</div>
          <div>Date: ${new Date(data.date || new Date()).toLocaleDateString('en-GB')}</div>
          <div>Page: 1 of 1</div>
        </div>
      </div>

      <div class="customer-section">
        <div class="customer-address">
          <div class="name">${sanitizeHtml(data.customer?.name || '')}</div>
          <div>${sanitizeHtml(data.customer?.address || '')}</div>
          <div>TEL: ${sanitizeHtml(data.customer?.phone || '')}</div>
          ${data.customer?.email ? `<div>Email: ${sanitizeHtml(data.customer.email)}</div>` : ''}
          ${data.customer?.account_number ? `<div>A/C No.: ${sanitizeHtml(data.customer.account_number)}</div>` : ''}
        </div>
        <div class="quotation-meta">
          <div class="meta-row">
            <span class="meta-label">ATTN.</span>
          </div>
          <div style="font-weight: bold;">${sanitizeHtml(data.attention || data.customer?.contact_person || '-')}</div>
          <div style="margin-top: 15px; font-size: 10px; color: #0ea5e9;">
            Email: ${sanitizeHtml(companyInfo.email)}
          </div>
          <div style="margin-top: 10px; padding: 8px; background: #fef3c7; text-align: center; font-size: 10px;">
            Please chop & sign
          </div>
        </div>
      </div>

      ${data.reference ? `
        <div class="reference">
          <strong>RE:</strong> ${sanitizeHtml(data.reference)}
        </div>
      ` : ''}

      <p style="margin: 15px 0; font-style: italic;">As requested, we are pleased to quote you as follows :-</p>

      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 40px;">Item</th>
            <th>Description</th>
            <th style="width: 60px;" class="qty">Qty</th>
            <th style="width: 100px;" class="amount">U/ Price<br>RM</th>
            <th style="width: 100px;" class="amount">Amount<br>RM</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td>
                <div><strong>${sanitizeHtml(item.description)}</strong></div>
                ${item.brand ? `<div class="description-details">Brand: ${sanitizeHtml(item.brand)}</div>` : ''}
                ${item.model ? `<div class="description-details">Model: ${sanitizeHtml(item.model)}</div>` : ''}
                ${item.capacity ? `<div class="description-details">Capacity: ${sanitizeHtml(item.capacity)}</div>` : ''}
                ${item.voltage ? `<div class="description-details">Voltage: ${sanitizeHtml(item.voltage)}</div>` : ''}
                ${item.accessory ? `<div class="description-details">Accessory: ${sanitizeHtml(item.accessory)}</div>` : ''}
                ${item.warranty ? `<div class="description-details">Warranty: ${sanitizeHtml(item.warranty)}</div>` : ''}
              </td>
              <td class="qty">${item.quantity} UNIT</td>
              <td class="amount">${item.unit_price.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td class="amount">${item.amount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="totals">
        <div class="totals-row">
          <span>Sub Total (Excluding SST)</span>
          <span>${subTotal.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
        ${taxRate > 0 ? `
          <div class="totals-row">
            <span>Tax @ ${taxRate}%</span>
            <span>${taxAmount.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        ` : `
          <div class="totals-row">
            <span>Tax @ 0% on 0.00</span>
            <span>0.00</span>
          </div>
        `}
        <div class="totals-row total">
          <span>Total (Inclusive of SST)</span>
          <span>${total.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      </div>

      <div class="terms">
        <div class="term-box">
          <div class="term-label">Validity:</div>
          <div>${sanitizeHtml(data.validity || '1 WEEK FROM OFFER DATE')}</div>
        </div>
        <div class="term-box">
          <div class="term-label">Delivery Site:</div>
          <div>${sanitizeHtml(data.delivery_site || '-')}</div>
        </div>
        <div class="term-box">
          <div class="term-label">Delivery Term:</div>
          <div>${sanitizeHtml(data.delivery_term || '1 WEEK UPON CONFIRM ORDER')}</div>
        </div>
        <div class="term-box">
          <div class="term-label">Payment Term:</div>
          <div>${sanitizeHtml(data.payment_term || 'C.O.D')}</div>
        </div>
      </div>

      ${data.remark ? `
        <div style="margin: 15px 0;">
          <strong>Remark:</strong> ${sanitizeHtml(data.remark)}
        </div>
      ` : ''}

      <div class="footer-note">
        We hope the above quotation is agreeable to you and meets with your kind approval. Looking forward to receive your
        valued confirmation order soon. The Company has the right to revise the quotation upon the implementation of a new Sales
        and Service Tax in Malaysia. Our proposed quotation above is exclusive of any government taxes that may be implemented
        from time to time. Kindly chop & Sign the below and fax back to us if you confirm order. Thank You.
      </div>

      <div class="signature-section">
        <div class="signature-box">
          <div class="prepared-by">Your sincerely,</div>
          <div style="font-style: italic; font-size: 10px; color: #64748b; margin-top: 30px;">
            This is computer generated, no signatories required
          </div>
          <div style="margin-top: 20px;">
            <strong>PARTS & SERVICES DEPT</strong><br>
            <span style="font-size: 10px;">TEL: ${sanitizeHtml(companyInfo.phone)}</span><br>
            <span style="font-size: 10px;">EMAIL: ${sanitizeHtml(companyInfo.email)}</span>
          </div>
        </div>
        <div class="accept-box">
          <div class="accept-title">Accept and agreed by:</div>
          <div style="font-weight: bold;">${sanitizeHtml(data.customer?.name || '')}</div>
          <div class="signature-line"></div>
          <div class="signature-name">(Please chop & sign)</div>
        </div>
      </div>

      <script>window.onload = function() { window.print(); };</script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
};

// React Component for preview
export const QuotationPDF: React.FC<QuotationPDFProps> = ({ 
  quotation, 
  job,
  companyInfo = defaultCompanyInfo 
}) => {
  const data = quotation || (job ? generateQuotationFromJob(job) : null);
  
  if (!data) {
    return <div className="text-center text-slate-500 p-8">No quotation data available</div>;
  }

  const items = data.items || [];
  const subTotal = data.sub_total || 0;
  const taxRate = data.tax_rate || 0;
  const taxAmount = data.tax_amount || 0;
  const total = data.total || subTotal;

  return (
    <div className="bg-white p-8 max-w-4xl mx-auto text-sm shadow-lg" style={{ fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div className="flex justify-between items-start mb-6 pb-4 border-b-2 border-blue-600">
        <div>
          <h1 className="text-2xl font-bold text-blue-800">{companyInfo.name}</h1>
          <p className="text-xs text-slate-600 mt-1">{companyInfo.address}</p>
          <p className="text-xs text-slate-600">Tel: {companyInfo.phone}</p>
          {companyInfo.fax && <p className="text-xs text-slate-600">Fax: {companyInfo.fax}</p>}
          {companyInfo.sstNo && <p className="text-xs text-slate-500">SST NO: {companyInfo.sstNo}</p>}
        </div>
        <div className="text-right">
          <h2 className="text-xl font-bold text-blue-800">QUOTATION</h2>
          <div className="mt-2 bg-slate-50 p-3 border border-slate-200 rounded">
            <p className="font-bold">No.: {quotation?.quotation_number || 'Q-DRAFT'}</p>
            <p className="text-xs text-slate-600">Date: {new Date(data.date || new Date()).toLocaleDateString('en-GB')}</p>
            <p className="text-xs text-slate-600">Page: 1 of 1</p>
          </div>
        </div>
      </div>

      {/* Customer Section */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="col-span-2 bg-slate-50 p-4 rounded border border-slate-200">
          <p className="font-bold text-slate-900">{data.customer?.name}</p>
          <p className="text-slate-600">{data.customer?.address}</p>
          <p className="text-slate-600">TEL: {data.customer?.phone}</p>
          {data.customer?.email && <p className="text-blue-600 text-xs">{data.customer.email}</p>}
        </div>
        <div className="bg-slate-50 p-4 rounded border border-slate-200">
          <p className="text-xs text-slate-500 uppercase">ATTN.</p>
          <p className="font-semibold">{data.attention || '-'}</p>
          <p className="text-xs text-blue-600 mt-2">Email: {companyInfo.email}</p>
          <div className="mt-3 p-2 bg-amber-50 border border-amber-200 text-center text-xs rounded">
            Please chop & sign
          </div>
        </div>
      </div>

      {/* Reference */}
      {data.reference && (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-3 mb-4">
          <p className="font-semibold text-blue-800">RE: {data.reference}</p>
        </div>
      )}

      <p className="italic text-slate-600 mb-4">As requested, we are pleased to quote you as follows :-</p>

      {/* Items Table */}
      <table className="w-full border-collapse mb-6">
        <thead>
          <tr className="bg-blue-800 text-white">
            <th className="p-3 text-left text-xs w-12">Item</th>
            <th className="p-3 text-left text-xs">Description</th>
            <th className="p-3 text-center text-xs w-16">Qty</th>
            <th className="p-3 text-right text-xs w-24">U/ Price<br/>RM</th>
            <th className="p-3 text-right text-xs w-24">Amount<br/>RM</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx} className="border-b border-slate-200">
              <td className="p-3">{idx + 1}</td>
              <td className="p-3">
                <p className="font-medium">{item.description}</p>
                {item.brand && <p className="text-xs text-slate-500">Brand: {item.brand}</p>}
                {item.model && <p className="text-xs text-slate-500">Model: {item.model}</p>}
                {item.warranty && <p className="text-xs text-slate-500">Warranty: {item.warranty}</p>}
              </td>
              <td className="p-3 text-center">{item.quantity} UNIT</td>
              <td className="p-3 text-right">{item.unit_price.toFixed(2)}</td>
              <td className="p-3 text-right">{item.amount.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end mb-6">
        <div className="w-72">
          <div className="flex justify-between py-2 border-b border-slate-200">
            <span>Sub Total (Excluding SST)</span>
            <span>{subTotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-200 text-slate-500">
            <span>Tax @ {taxRate}% on {subTotal.toFixed(2)}</span>
            <span>{taxAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-3 bg-slate-100 font-bold text-lg border-t-2 border-b-2 border-blue-800">
            <span>Total (Inclusive of SST)</span>
            <span>{total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Terms */}
      <div className="grid grid-cols-2 gap-4 mb-6 text-xs">
        <div className="bg-slate-50 p-3 rounded">
          <span className="font-semibold text-slate-500">Validity:</span>
          <span className="ml-2">{data.validity}</span>
        </div>
        <div className="bg-slate-50 p-3 rounded">
          <span className="font-semibold text-slate-500">Delivery Site:</span>
          <span className="ml-2">{data.delivery_site || '-'}</span>
        </div>
        <div className="bg-slate-50 p-3 rounded">
          <span className="font-semibold text-slate-500">Delivery Term:</span>
          <span className="ml-2">{data.delivery_term}</span>
        </div>
        <div className="bg-slate-50 p-3 rounded">
          <span className="font-semibold text-slate-500">Payment Term:</span>
          <span className="ml-2">{data.payment_term}</span>
        </div>
      </div>

      {/* Footer Note */}
      <div className="bg-slate-50 p-4 rounded text-xs text-slate-600 mb-6 leading-relaxed">
        We hope the above quotation is agreeable to you and meets with your kind approval. Looking forward to receive your
        valued confirmation order soon. The Company has the right to revise the quotation upon the implementation of a new Sales
        and Service Tax in Malaysia. Our proposed quotation above is exclusive of any government taxes that may be implemented
        from time to time. Kindly chop & Sign the below and fax back to us if you confirm order. Thank You.
      </div>

      {/* Signature Section */}
      <div className="grid grid-cols-2 gap-8">
        <div>
          <p className="text-slate-600 text-xs">Your sincerely,</p>
          <p className="text-xs italic text-slate-400 mt-8">This is computer generated, no signatories required</p>
          <div className="mt-4">
            <p className="font-semibold">PARTS & SERVICES DEPT</p>
            <p className="text-xs text-slate-600">TEL: {companyInfo.phone}</p>
            <p className="text-xs text-blue-600">EMAIL: {companyInfo.email}</p>
          </div>
        </div>
        <div className="border border-slate-300 p-4 rounded">
          <p className="font-semibold mb-2">Accept and agreed by:</p>
          <p className="font-bold">{data.customer?.name}</p>
          <div className="border-b border-slate-400 h-16 mt-4"></div>
          <p className="text-xs text-slate-500 mt-1">(Please chop & sign)</p>
        </div>
      </div>
    </div>
  );
};

export default QuotationPDF;
