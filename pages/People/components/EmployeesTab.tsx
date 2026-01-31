import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '../../types';
import { SupabaseDb as MockDb } from '../../services/supabaseService';
import { showToast } from '../../services/toastService';
import { Users, Search, ChevronRight, Loader2 } from 'lucide-react';

interface EmployeesTabProps {
  currentUser: User;
  initialStatus?: string;
  onFilterChange?: (status: string) => void;
}

const EmployeesTab: React.FC<EmployeesTabProps> = ({ currentUser, initialStatus, onFilterChange }) => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>(initialStatus || 'all');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');

  // Update filter when initialStatus changes (from URL param)
  useEffect(() => {
    const newStatus = initialStatus || 'all';
    if (newStatus !== filterStatus) {
      setFilterStatus(newStatus);
    }
  }, [initialStatus]);

  const handleStatusFilter = (status: string) => {
    setFilterStatus(status);
    onFilterChange?.(status);
  };

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const data = await MockDb.getUsers();
      setEmployees(data);
    } catch (error) {
      console.error('Error loading employees:', error);
      showToast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  };

  const filteredEmployees = useMemo(() => employees.filter(emp => {
    const matchesSearch = 
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (emp.department || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'active' && (emp.employment_status === 'active' || !emp.employment_status)) ||
      (filterStatus === 'inactive' && emp.employment_status === 'inactive');
    
    const matchesDept = filterDepartment === 'all' || emp.department === filterDepartment;
    
    return matchesSearch && matchesStatus && matchesDept;
  }), [employees, searchQuery, filterStatus, filterDepartment]);

  const departments = useMemo(() => [...new Set(employees.map(e => e.department).filter(Boolean))], [employees]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search employees..."
            className="w-full pl-10 pr-4 py-2.5 bg-theme-surface border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-theme"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select className="px-3 py-2 bg-theme-surface border border-theme rounded-lg text-sm text-theme" value={filterStatus} onChange={(e) => handleStatusFilter(e.target.value)}>
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        {departments.length > 0 && (
          <select className="px-3 py-2 bg-theme-surface border border-theme rounded-lg text-sm text-theme" value={filterDepartment} onChange={(e) => setFilterDepartment(e.target.value)}>
            <option value="all">All Departments</option>
            {departments.map(dept => <option key={dept} value={dept}>{dept}</option>)}
          </select>
        )}
      </div>

      {/* Employees Grid */}
      {filteredEmployees.length === 0 ? (
        <div className="card-theme rounded-xl p-12 text-center">
          <Users className="w-12 h-12 text-theme-muted opacity-40 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-theme mb-2">No employees found</h3>
          <p className="text-sm text-theme-muted">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEmployees.map(emp => (
            <div 
              key={emp.user_id} 
              onClick={() => navigate(`/people/employees/${emp.user_id}`)}
              className="card-theme rounded-xl p-4 cursor-pointer hover:shadow-theme hover:border-blue-300 transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-lg">
                  {emp.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-theme group-hover:text-blue-600 truncate">{emp.name}</h3>
                  <p className="text-sm text-theme-muted truncate">{emp.email}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      emp.employment_status === 'active' || !emp.employment_status ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {emp.employment_status || 'Active'}
                    </span>
                    {emp.department && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        {emp.department}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-theme-muted group-hover:text-blue-500" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmployeesTab;
