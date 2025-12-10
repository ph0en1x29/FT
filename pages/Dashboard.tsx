import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { UserRole } from '../types';

interface DashboardProps {
  role: UserRole;
}

const dataStatus = [
  { name: 'Completed', value: 12, color: '#22c55e' },
  { name: 'In Progress', value: 5, color: '#f59e0b' },
  { name: 'New', value: 3, color: '#3b82f6' },
  { name: 'Invoiced', value: 8, color: '#a855f7' },
];

const dataRevenue = [
  { name: 'Mon', revenue: 1200 },
  { name: 'Tue', revenue: 2100 },
  { name: 'Wed', revenue: 800 },
  { name: 'Thu', revenue: 1600 },
  { name: 'Fri', revenue: 2400 },
];

const Dashboard: React.FC<DashboardProps> = ({ role }) => {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <p className="text-slate-500 text-sm">Total Jobs This Week</p>
          <p className="text-3xl font-bold text-slate-800">28</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <p className="text-slate-500 text-sm">Revenue Estimate</p>
          <p className="text-3xl font-bold text-green-600">$8,100</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <p className="text-slate-500 text-sm">Pending Invoices</p>
          <p className="text-3xl font-bold text-purple-600">5</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <p className="text-slate-500 text-sm">Avg. Response Time</p>
          <p className="text-3xl font-bold text-blue-600">4.2h</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm h-80">
          <h3 className="font-semibold text-slate-700 mb-4">Job Status Distribution</h3>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie 
                data={dataStatus} 
                innerRadius={60} 
                outerRadius={80} 
                paddingAngle={5} 
                dataKey="value"
              >
                {dataStatus.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm h-80">
          <h3 className="font-semibold text-slate-700 mb-4">Weekly Revenue</h3>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dataRevenue}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
