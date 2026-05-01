/* eslint-disable max-lines */
/**
 * QuotationPDF — ACWER Phase 10 / Tier 4.1 follow-up.
 *
 * Standalone HTML print template for a Quotation (mirrors InvoicePDF.tsx).
 * Admin clicks "Print" in QuotationsSection → printQuotation(quotation)
 * opens a new window with this HTML and triggers print/save-as-PDF via the
 * browser. No external PDF library — same pattern as the existing
 * InvoicePDF / ServiceReportPDF.
 */
import { sanitizeHtml } from '../services/sanitizeService';
import type { Quotation } from '../types';

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

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatNumber = (num: number): string => {
  return num.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const printQuotation = (
  quotation: Quotation,
  companyInfo: CompanyInfo = defaultCompanyInfo,
) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow pop-ups to print the quotation');
    return;
  }

  const customer = quotation.customer;
  const customerName = sanitizeHtml(customer?.name ?? 'Unknown Customer');
  const customerAddress = sanitizeHtml(customer?.address ?? '');
  const customerPhone = sanitizeHtml(customer?.phone ?? '');

  const itemsHtml = quotation.items
    .map(
      item => `
        <tr>
          <td class="text-center">${item.item_number}</td>
          <td>${sanitizeHtml(item.description)}</td>
          <td class="text-center">${item.quantity}</td>
          <td class="text-right">${formatNumber(item.unit_price)}</td>
          <td class="text-right">${formatNumber(item.amount)}</td>
        </tr>
      `,
    )
    .join('');

  // Pad with empty rows so the grid looks nice when there are few items
  const minRows = 6;
  const emptyRows = Math.max(0, minRows - quotation.items.length);
  const emptyRowsHtml = Array.from({ length: emptyRows })
    .map(() => `<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td></tr>`)
    .join('');

  const taxRow =
    Number(quotation.tax_rate) > 0
      ? `<tr>
          <td colspan="4" class="text-right">SST (${quotation.tax_rate}%)</td>
          <td class="text-right">${formatNumber(Number(quotation.tax_amount))}</td>
        </tr>`
      : '';

  const remarkBlock = quotation.remark
    ? `<div class="remark"><strong>Remark:</strong> ${sanitizeHtml(quotation.remark)}</div>`
    : '';

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Quotation ${sanitizeHtml(quotation.quotation_number)}</title>
        <meta charset="UTF-8" />
        <style>
          body { font-family: Arial, sans-serif; font-size: 12px; color: #1f2937; padding: 24px; }
          h1 { font-size: 22px; margin: 0; letter-spacing: 0.04em; }
          h2 { font-size: 14px; margin: 0 0 4px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1f2937; padding-bottom: 12px; margin-bottom: 16px; }
          .company { font-size: 11px; line-height: 1.4; }
          .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 12px; }
          .meta-table td { padding: 4px 8px; vertical-align: top; }
          .meta-table .label { font-weight: 600; width: 110px; }
          .items { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
          .items th { background: #1f2937; color: #fff; padding: 6px; font-size: 11px; text-align: left; }
          .items td { border: 1px solid #d1d5db; padding: 6px; height: 26px; vertical-align: top; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          tfoot td { font-weight: 600; }
          .total-row td { background: #f3f4f6; font-size: 13px; }
          .terms { font-size: 11px; line-height: 1.6; margin-top: 14px; }
          .terms strong { display: inline-block; min-width: 110px; }
          .remark { margin-top: 8px; font-size: 11px; padding: 6px; border-left: 3px solid #1f2937; background: #f9fafb; }
          .footer { margin-top: 28px; display: flex; justify-content: space-between; }
          .signature { width: 45%; border-top: 1px solid #1f2937; padding-top: 4px; font-size: 11px; }
          @media print { body { padding: 12px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>QUOTATION</h1>
            <div class="company">
              <strong>${sanitizeHtml(companyInfo.name)}</strong> ${sanitizeHtml(companyInfo.registration)}<br/>
              ${sanitizeHtml(companyInfo.address)}<br/>
              ${companyInfo.branch ? `Branch: ${sanitizeHtml(companyInfo.branch)}<br/>` : ''}
              Tel: ${sanitizeHtml(companyInfo.tel)} ${companyInfo.fax ? `· Fax: ${sanitizeHtml(companyInfo.fax)}` : ''}<br/>
              Email: ${sanitizeHtml(companyInfo.email)}${companyInfo.sstNo ? ` · SST: ${sanitizeHtml(companyInfo.sstNo)}` : ''}
            </div>
          </div>
          <div class="text-right">
            <h2>${sanitizeHtml(quotation.quotation_number)}</h2>
            <div>Date: <strong>${formatDate(quotation.date)}</strong></div>
            <div>Validity: ${sanitizeHtml(quotation.validity)}</div>
            <div>Status: <strong>${sanitizeHtml(quotation.status.toUpperCase())}</strong></div>
          </div>
        </div>

        <table class="meta-table">
          <tr>
            <td class="label">To:</td>
            <td><strong>${customerName}</strong>${customerAddress ? `<br/>${customerAddress}` : ''}${customerPhone ? `<br/>Tel: ${customerPhone}` : ''}</td>
            <td class="label">Attn:</td>
            <td>${sanitizeHtml(quotation.attention)}</td>
          </tr>
          <tr>
            <td class="label">RE:</td>
            <td colspan="3">${sanitizeHtml(quotation.reference)}</td>
          </tr>
        </table>

        <table class="items">
          <thead>
            <tr>
              <th class="text-center" style="width:48px;">No</th>
              <th>Description</th>
              <th class="text-center" style="width:64px;">Qty</th>
              <th class="text-right" style="width:96px;">Unit Price (RM)</th>
              <th class="text-right" style="width:112px;">Amount (RM)</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
            ${emptyRowsHtml}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="4" class="text-right">Subtotal</td>
              <td class="text-right">${formatNumber(Number(quotation.sub_total))}</td>
            </tr>
            ${taxRow}
            <tr class="total-row">
              <td colspan="4" class="text-right">TOTAL (RM)</td>
              <td class="text-right">${formatNumber(Number(quotation.total))}</td>
            </tr>
          </tfoot>
        </table>

        <div class="terms">
          <div><strong>Delivery term:</strong> ${sanitizeHtml(quotation.delivery_term)}</div>
          <div><strong>Payment term:</strong> ${sanitizeHtml(quotation.payment_term)}</div>
          ${quotation.delivery_site ? `<div><strong>Delivery site:</strong> ${sanitizeHtml(quotation.delivery_site)}</div>` : ''}
        </div>
        ${remarkBlock}

        <div class="footer">
          <div class="signature">Prepared by: ${sanitizeHtml(quotation.created_by_name ?? '')}</div>
          <div class="signature">Customer acceptance (signature &amp; date)</div>
        </div>

        <script>
          window.onload = () => { setTimeout(() => window.print(), 250); };
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
};

export default printQuotation;
