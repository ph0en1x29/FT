/**
 * Revenue trend area chart component
 */
import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { DollarSign, TrendingUp } from 'lucide-react';
import { RevenueDataPoint } from '../types';

interface RevenueChartProps {
  data: RevenueDataPoint[];
  totalRevenue: number;
}

export const RevenueChart: React.FC<RevenueChartProps> = ({ data, totalRevenue }) => {
  const hasData = data.some((d) => d.revenue > 0);

  return (
    <div className="card-premium p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-semibold text-[var(--text)]">Revenue Trend</h3>
          <p className="text-xs mt-0.5 text-[var(--text-muted)]">Last 7 days</p>
        </div>
        <div className="flex items-center gap-1 text-xs text-green-600">
          <TrendingUp className="w-3.5 h-3.5" />
          <span className="font-medium">RM{totalRevenue.toLocaleString()} total</span>
        </div>
      </div>
      <div style={{ width: '100%', height: 240 }}>
        {hasData ? (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="revenueGradientAcc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                tickFormatter={(value) => `RM${value}`}
              />
              <Tooltip
                formatter={(value) => [`RM${value}`, 'Revenue']}
                contentStyle={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#22c55e"
                strokeWidth={2}
                fill="url(#revenueGradientAcc)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <DollarSign className="w-10 h-10 text-[var(--text-muted)] opacity-30 mb-2" />
            <p className="text-sm font-medium text-[var(--text)]">No revenue data</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Complete jobs to see revenue trends
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
