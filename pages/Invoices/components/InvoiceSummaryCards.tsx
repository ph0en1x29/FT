import { Calendar,DollarSign,FileText } from 'lucide-react';
import React from 'react';

interface InvoiceSummaryCardsProps {
  totalInvoices: number;
  totalRevenue: number;
}

const InvoiceSummaryCards: React.FC<InvoiceSummaryCardsProps> = ({
  totalInvoices,
  totalRevenue,
}) => {
  const averageInvoice = totalInvoices > 0 ? totalRevenue / totalInvoices : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="card-theme rounded-xl p-4 theme-transition">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-theme-muted">Total Invoices</p>
            <p className="text-xl font-bold text-theme">{totalInvoices}</p>
          </div>
        </div>
      </div>
      
      <div className="card-theme rounded-xl p-4 theme-transition">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <DollarSign className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-theme-muted">Total Revenue</p>
            <p className="text-xl font-bold text-green-600">RM {totalRevenue.toFixed(2)}</p>
          </div>
        </div>
      </div>
      
      <div className="card-theme rounded-xl p-4 theme-transition">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Calendar className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <p className="text-sm text-theme-muted">Average Invoice</p>
            <p className="text-xl font-bold text-theme">RM {averageInvoice.toFixed(2)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InvoiceSummaryCards;
