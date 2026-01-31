import { Job } from '../../../types';

/**
 * Generates and opens a printable invoice PDF in a new window
 */
export const generateInvoicePDF = (job: Job): void => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow pop-ups to view the invoice');
    return;
  }

  const totalParts = job.parts_used.reduce((acc, p) => acc + (p.sell_price_at_time * p.quantity), 0);
  const labor = job.labor_cost || 150;
  const extra = (job.extra_charges || []).reduce((acc, c) => acc + c.amount, 0);
  const subtotal = totalParts + labor + extra;
  const sst = 0; // 0% SST for now
  const total = subtotal + sst;

  const invoiceHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Invoice - INV-${job.job_id.slice(0, 8).toUpperCase()}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; padding: 30px; color: #333; font-size: 11px; }

        .header { display: flex; justify-content: space-between; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #1e40af; }
        .company-section h1 { font-size: 22px; font-weight: bold; color: #1e40af; }
        .company-section p { font-size: 9px; color: #666; line-height: 1.4; }
        .company-section .sst { font-size: 10px; font-weight: bold; margin-top: 5px; }

        .invoice-title { text-align: right; }
        .invoice-title h2 { font-size: 20px; color: #333; margin-bottom: 5px; }
        .invoice-title .inv-no { font-size: 14px; font-weight: bold; color: #dc2626; }
        .invoice-title .inv-date { font-size: 11px; color: #666; margin-top: 3px; }

        .billing-section { display: grid; grid-template-columns: 1.5fr 1fr; gap: 30px; margin-bottom: 20px; }
        .bill-to { background: #f8fafc; padding: 15px; border-radius: 6px; }
        .bill-to h3 { font-size: 10px; color: #64748b; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 1px; }
        .bill-to .company-name { font-size: 13px; font-weight: bold; margin-bottom: 5px; }
        .bill-to p { font-size: 10px; line-height: 1.5; }

        .reference-box { background: #fef3c7; padding: 15px; border-radius: 6px; border: 1px solid #fcd34d; }
        .reference-box h3 { font-size: 10px; color: #92400e; text-transform: uppercase; margin-bottom: 8px; }
        .reference-box p { font-size: 10px; line-height: 1.6; }
        .reference-box strong { color: #78350f; }

        .attn-line { font-size: 11px; margin-bottom: 20px; padding: 10px; background: #f1f5f9; border-radius: 4px; }

        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .items-table th { background: #1e40af; color: white; padding: 10px; text-align: left; font-size: 10px; text-transform: uppercase; }
        .items-table th:last-child, .items-table th:nth-last-child(2) { text-align: right; }
        .items-table td { padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 10px; vertical-align: top; }
        .items-table td:last-child, .items-table td:nth-last-child(2) { text-align: right; }
        .items-table .item-desc { max-width: 350px; }
        .items-table .item-desc strong { display: block; margin-bottom: 3px; }
        .items-table .item-desc small { color: #64748b; font-size: 9px; }

        .totals-section { display: flex; justify-content: flex-end; margin-bottom: 20px; }
        .totals-box { width: 280px; }
        .totals-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 11px; border-bottom: 1px solid #e2e8f0; }
        .totals-row.subtotal { border-top: 2px solid #e2e8f0; margin-top: 5px; padding-top: 10px; }
        .totals-row.grand-total { background: #1e40af; color: white; padding: 12px 10px; margin-top: 5px; font-size: 14px; font-weight: bold; border-radius: 4px; }

        .terms-section { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; font-size: 10px; }
        .terms-box { }
        .terms-box h4 { font-size: 9px; color: #64748b; text-transform: uppercase; margin-bottom: 5px; }
        .terms-box p { line-height: 1.5; }

        .footer-note { text-align: center; font-size: 9px; color: #64748b; margin-bottom: 30px; padding: 15px; background: #f8fafc; border-radius: 6px; }

        .signature-section { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
        .sig-box { }
        .sig-box h4 { font-size: 10px; color: #64748b; margin-bottom: 5px; }
        .sig-box .sig-line { border-bottom: 1px solid #333; height: 60px; margin-bottom: 5px; }
        .sig-box .sig-name { font-size: 11px; font-weight: bold; }
        .sig-box .sig-title { font-size: 9px; color: #666; }

        .accept-box { border: 2px solid #1e40af; padding: 15px; border-radius: 6px; }
        .accept-box h4 { color: #1e40af; margin-bottom: 10px; }
        .accept-box .chop-area { height: 60px; border: 1px dashed #ccc; margin-bottom: 5px; display: flex; align-items: center; justify-content: center; color: #999; font-size: 9px; }

        @media print {
          body { padding: 15px; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company-section">
          <h1>FieldPro</h1>
          <p>
            Field Service Management System<br/>
            123 Business Park, Tech City<br/>
            Tel: 03-1234 5678 | Fax: 03-1234 5679<br/>
            Email: service@fieldpro.com
          </p>
          <p class="sst">SST NO: B16-XXXX-XXXXXXXX</p>
        </div>
        <div class="invoice-title">
          <h2>INVOICE</h2>
          <div class="inv-no">No.: INV-${job.job_id.slice(0, 8).toUpperCase()}</div>
          <div class="inv-date">Date: ${new Date(job.invoiced_at || job.created_at).toLocaleDateString()}</div>
          <div class="inv-date">Page: 1 of 1</div>
        </div>
      </div>

      <div class="billing-section">
        <div class="bill-to">
          <h3>Bill To</h3>
          <div class="company-name">${job.customer?.name || ''}</div>
          <p>
            ${job.customer?.address || ''}<br/>
            Tel: ${job.customer?.phone || ''}<br/>
            Email: ${job.customer?.email || ''}
          </p>
        </div>

        ${job.forklift ? `
          <div class="reference-box">
            <h3>Equipment Reference</h3>
            <p>
              <strong>Model:</strong> ${job.forklift.make} ${job.forklift.model}<br/>
              <strong>Serial No:</strong> ${job.forklift.serial_number}<br/>
              <strong>Type:</strong> ${job.forklift.type}<br/>
              ${job.hourmeter_reading ? `<strong>Hourmeter:</strong> ${job.hourmeter_reading.toLocaleString()} hrs` : ''}
            </p>
          </div>
        ` : ''}
      </div>

      <div class="attn-line">
        <strong>RE:</strong> ${job.title} - ${job.description.substring(0, 100)}${job.description.length > 100 ? '...' : ''}
      </div>

      <table class="items-table">
        <thead>
          <tr>
            <th style="width: 40px;">Item</th>
            <th>Description</th>
            <th style="width: 50px;">Qty</th>
            <th style="width: 90px;">Unit Price (RM)</th>
            <th style="width: 100px;">Amount (RM)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td class="item-desc">
              <strong>Labor Charges</strong>
              <small>Service/repair work performed</small>
            </td>
            <td>1</td>
            <td>${labor.toFixed(2)}</td>
            <td>${labor.toFixed(2)}</td>
          </tr>

          ${job.parts_used.map((p, idx) => `
            <tr>
              <td>${idx + 2}</td>
              <td class="item-desc">
                <strong>${p.part_name}</strong>
              </td>
              <td>${p.quantity}</td>
              <td>${p.sell_price_at_time.toFixed(2)}</td>
              <td>${(p.sell_price_at_time * p.quantity).toFixed(2)}</td>
            </tr>
          `).join('')}

          ${(job.extra_charges || []).map((c, idx) => `
            <tr>
              <td>${job.parts_used.length + idx + 2}</td>
              <td class="item-desc">
                <strong>${c.name}</strong>
                ${c.description ? `<small>${c.description}</small>` : ''}
              </td>
              <td>1</td>
              <td>${c.amount.toFixed(2)}</td>
              <td>${c.amount.toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="totals-section">
        <div class="totals-box">
          <div class="totals-row subtotal">
            <span>Sub Total (Excluding SST)</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div class="totals-row">
            <span>Tax @ 0% on ${subtotal.toFixed(2)}</span>
            <span>${sst.toFixed(2)}</span>
          </div>
          <div class="totals-row grand-total">
            <span>Total (Inclusive of SST)</span>
            <span>RM ${total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div class="terms-section">
        <div class="terms-box">
          <h4>Payment Terms</h4>
          <p>C.O.D / 30 Days from Invoice Date</p>
        </div>
        <div class="terms-box">
          <h4>Validity</h4>
          <p>This invoice is valid for 30 days from the date of issue.</p>
        </div>
      </div>

      <div class="footer-note">
        We hope the above is agreeable to you. The Company has the right to revise charges upon the implementation of new taxes.
        Our invoice is exclusive of any government taxes that may be implemented from time to time. Thank you for your business!
      </div>

      <div class="signature-section">
        <div class="sig-box">
          <h4>Issued By</h4>
          <div class="sig-line"></div>
          <div class="sig-name">${job.invoiced_by_name || 'Accounts Department'}</div>
          <div class="sig-title">FieldPro Service Management</div>
          <div class="sig-title">Date: ${job.invoiced_at ? new Date(job.invoiced_at).toLocaleDateString() : ''}</div>
        </div>

        <div class="accept-box">
          <h4>Accepted and Agreed By:</h4>
          <div class="chop-area">(Please chop & sign)</div>
          <div class="sig-name">${job.customer?.name || ''}</div>
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

  printWindow.document.write(invoiceHtml);
  printWindow.document.close();
};

/**
 * Calculate the total amount for a job/invoice
 */
export const calculateJobTotal = (job: Job): number => {
  const totalParts = job.parts_used.reduce((acc, p) => acc + (p.sell_price_at_time * p.quantity), 0);
  const labor = job.labor_cost || 150;
  const extra = (job.extra_charges || []).reduce((acc, c) => acc + c.amount, 0);
  return totalParts + labor + extra;
};
