import React, { useState } from 'react';
import { HashRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { User, UserRole } from './types_with_invoice_tracking';
import Dashboard from './pages/Dashboard';
import JobBoard from './pages/JobBoard';
import JobDetail from './pages/JobDetail';
import CreateJob from './pages/CreateJob';
import LoginPage from './pages/LoginPage';
import UserManagement from './pages/UserManagement';
import Customers from './pages/Customers';
import CustomerProfile from './pages/CustomerProfile';
import Forklifts from './pages/Forklifts';
import ServiceRecords from './pages/ServiceRecords';
import Invoices from './pages/Invoices';
import InventoryPage from './pages/InventoryPage';
import TechnicianKPIPage from './pages/TechnicianKPIPage';
import { SupabaseDb as MockDb } from './services/supabaseService';
import { 
  LayoutDashboard, List, Package, LogOut, Users as UsersIcon, 
  Building2, Truck, ClipboardList, FileText, BarChart3 
} from 'lucide-react';

const Sidebar = ({ role, onLogout }: { role: UserRole, onLogout: () => void }) => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800';

  return (
    <div className="w-64 bg-slate-900 text-white h-screen fixed left-0 top-0 flex flex-col hidden md:flex">
      <div className="p-6">
        <h1 className="text-2xl font-bold tracking-tight">FieldPro</h1>
        <p className="text-xs text-slate-500 uppercase mt-1 tracking-wider">{role} View</p>
      </div>
      
      <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
        {(role === UserRole.ADMIN || role === UserRole.ACCOUNTANT) && (
          <Link to="/" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${isActive('/')}`}>
            <LayoutDashboard className="w-5 h-5" /> Dashboard
          </Link>
        )}
        <Link to="/jobs" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${isActive('/jobs')}`}>
          <List className="w-5 h-5" /> Jobs
        </Link>
        
        {(role === UserRole.ADMIN || role === UserRole.TECHNICIAN || role === UserRole.ACCOUNTANT) && (
          <>
            <Link to="/forklifts" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${isActive('/forklifts')}`}>
              <Truck className="w-5 h-5" /> Forklifts
            </Link>
            <Link to="/customers" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${isActive('/customers')}`}>
              <Building2 className="w-5 h-5" /> Customers
            </Link>
            <Link to="/inventory" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${isActive('/inventory')}`}>
              <Package className="w-5 h-5" /> Inventory
            </Link>
          </>
        )}
        
        {/* Records Section */}
        {(role === UserRole.ADMIN || role === UserRole.ACCOUNTANT) && (
          <>
            <div className="pt-4 pb-2">
              <p className="px-4 text-xs text-slate-600 uppercase tracking-wider">Records</p>
            </div>
            <Link to="/service-records" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${isActive('/service-records')}`}>
              <ClipboardList className="w-5 h-5" /> Service Records
            </Link>
            <Link to="/invoices" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${isActive('/invoices')}`}>
              <FileText className="w-5 h-5" /> Invoices
            </Link>
          </>
        )}
        
        {role === UserRole.ADMIN && (
          <>
            <div className="pt-4 pb-2">
              <p className="px-4 text-xs text-slate-600 uppercase tracking-wider">Management</p>
            </div>
            <Link to="/technician-kpi" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${isActive('/technician-kpi')}`}>
              <BarChart3 className="w-5 h-5" /> Technician KPI
            </Link>
            <Link to="/users" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${isActive('/users')}`}>
              <UsersIcon className="w-5 h-5" /> Users
            </Link>
          </>
        )}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <button onClick={onLogout} className="flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-white w-full">
          <LogOut className="w-5 h-5" /> Sign Out
        </button>
      </div>
    </div>
  );
};

const MobileNav = ({ role }: { role: UserRole }) => {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-2 flex justify-around z-50">
       {(role === UserRole.ADMIN || role === UserRole.ACCOUNTANT) && (
        <Link to="/" className="p-2 text-slate-600 hover:text-blue-600"><LayoutDashboard className="w-6 h-6" /></Link>
       )}
       <Link to="/jobs" className="p-2 text-slate-600 hover:text-blue-600"><List className="w-6 h-6" /></Link>
       {(role === UserRole.ADMIN || role === UserRole.TECHNICIAN || role === UserRole.ACCOUNTANT) && (
         <>
           <Link to="/forklifts" className="p-2 text-slate-600 hover:text-blue-600"><Truck className="w-6 h-6" /></Link>
           <Link to="/customers" className="p-2 text-slate-600 hover:text-blue-600"><Building2 className="w-6 h-6" /></Link>
           <Link to="/inventory" className="p-2 text-slate-600 hover:text-blue-600"><Package className="w-6 h-6" /></Link>
         </>
       )}
       {(role === UserRole.ADMIN || role === UserRole.ACCOUNTANT) && (
         <>
           <Link to="/service-records" className="p-2 text-slate-600 hover:text-blue-600"><ClipboardList className="w-6 h-6" /></Link>
           <Link to="/invoices" className="p-2 text-slate-600 hover:text-blue-600"><FileText className="w-6 h-6" /></Link>
         </>
       )}
       {role === UserRole.ADMIN && (
         <Link to="/technician-kpi" className="p-2 text-slate-600 hover:text-blue-600"><BarChart3 className="w-6 h-6" /></Link>
       )}
    </div>
  );
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const handleLogout = () => {
    setCurrentUser(null);
  };

  if (!currentUser) {
    return <LoginPage onLogin={setCurrentUser} />;
  }

  return (
    <Router>
      <div className="min-h-screen bg-slate-50 flex">
        <Sidebar role={currentUser.role} onLogout={handleLogout} />
        <main className="flex-1 md:ml-64 p-4 md:p-8 pb-20 md:pb-8 max-w-7xl mx-auto w-full">
          <Routes>
            <Route path="/" element={
               currentUser.role === UserRole.TECHNICIAN 
                 ? <Navigate to="/jobs" /> 
                 : <Dashboard role={currentUser.role} currentUser={currentUser} />
            } />
            <Route path="/jobs" element={<JobBoard currentUser={currentUser} />} />
            <Route path="/jobs/new" element={<CreateJob currentUser={currentUser} />} />
            <Route path="/jobs/:id" element={<JobDetail currentUserRole={currentUser.role} currentUserId={currentUser.user_id} currentUserName={currentUser.name} />} />
            
            {/* Inventory Route - Admin gets CRUD, others get view-only */}
            <Route path="/inventory" element={
              (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.TECHNICIAN || currentUser.role === UserRole.ACCOUNTANT)
                ? <InventoryPage currentUser={currentUser} />
                : <Navigate to="/" />
            } />
            
            {/* Forklift Routes */}
            <Route path="/forklifts" element={
              (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.TECHNICIAN || currentUser.role === UserRole.ACCOUNTANT)
                ? <Forklifts />
                : <Navigate to="/" />
            } />
            
            {/* Customer Routes */}
            <Route path="/customers" element={
              (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.TECHNICIAN || currentUser.role === UserRole.ACCOUNTANT)
                ? <Customers />
                : <Navigate to="/" />
            } />
            <Route path="/customers/:id" element={
              (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.TECHNICIAN || currentUser.role === UserRole.ACCOUNTANT)
                ? <CustomerProfile currentUser={currentUser} />
                : <Navigate to="/" />
            } />
            
            {/* Service Records Route */}
            <Route path="/service-records" element={
              (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.ACCOUNTANT)
                ? <ServiceRecords currentUser={currentUser} />
                : <Navigate to="/" />
            } />
            
            {/* Invoices Route */}
            <Route path="/invoices" element={
              (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.ACCOUNTANT)
                ? <Invoices currentUser={currentUser} />
                : <Navigate to="/" />
            } />
            
            {/* Technician KPI Route - Admin only */}
            <Route path="/technician-kpi" element={
              currentUser.role === UserRole.ADMIN 
                ? <TechnicianKPIPage currentUser={currentUser} />
                : <Navigate to="/" />
            } />
            
            {/* Protected User Management Route */}
            <Route path="/users" element={
              currentUser.role === UserRole.ADMIN 
                ? <UserManagement /> 
                : <Navigate to="/" />
            } />
            
            {/* Catch all redirect */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
        <MobileNav role={currentUser.role} />
      </div>
    </Router>
  );
}
