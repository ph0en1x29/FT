/**
 * Invoice status pie chart component
 */
import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { FileText } from 'lucide-react';
import { InvoiceStatusDataPoint } from '../types';

interface InvoiceStatusChartProps {
  data: InvoiceStatusDataPoint[];
}

export const InvoiceStatusChart: React.FC<InvoiceStatusChartProps> = ({ data }) => {
  const hasData = data.length > 0;

  return (
    <div className="card-premium p-6">
      <div className="mb-6">
        <h3 className="font-semibold text-[var(--text)]">Invoice Status</h3>
        <p className="text-xs mt-0.5 text-[var(--text-muted)]">Current distribution</p>
      </div>
      <div style={{ width: '100%', height: 240 }}>
        {hasData ? (
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={2}
                dataKey="value"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <FileText className="w-10 h-10 text-[var(--text-muted)] opacity-30 mb-2" />
            <p className="text-sm font-medium text-[var(--text)]">No jobs yet</p>
          </div>
        )}
      </div>
      {/* Legend */}
      {hasData && (
        <div className="flex flex-wrap gap-4 justify-center mt-2">
          {data.map((item, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: item.color }}
              ></div>
              <span className="text-[var(--text-muted)]">{item.name}</span>
              <span className="font-medium text-[var(--text)]">{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
