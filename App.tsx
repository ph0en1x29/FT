import React, { useState } from 'react';
import { HashRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { User, UserRole, ROLE_PERMISSIONS } from './types_with_invoice_tracking';
import Dashboard from './pages/Dashboard';
import JobBoard from './pages/JobBoard';
import JobDetail from './pages/JobDetail';
import CreateJob from './pages/CreateJob';
import LoginPage from './pages/LoginPage';
import UserManagement from './pages/UserManagement';
import Customers from './pages/Customers';
import CustomerProfile from './pages/CustomerProfile';
import Forklifts from './pages/Forklifts';
import ForkliftProfile from './pages/ForkliftProfile';
import ServiceRecords from './pages/ServiceRecords';
import Invoices from './pages/Invoices';
import InventoryPage from './pages/InventoryPage';
import TechnicianKPIPage from './pages/TechnicianKPIPageV2';
import NotificationBell from './components/NotificationBell';
import { SupabaseDb as MockDb } from './services/supabaseService';
import { 
  LayoutDashboard, List, Package, LogOut, Users as UsersIcon, 
  Building2, Truck, ClipboardList, FileText, BarChart3, Menu, X, User as UserIcon
} from 'lucide-react';

// Helper to check permissions
const hasPermission = (role: UserRole, permission: keyof typeof ROLE_PERMISSIONS[UserRole]) => {
  return ROLE_PERMISSIONS[role]?.[permission] ?? false;
};

const Sidebar = ({ role, onLogout }: { role: UserRole, onLogout: () => void }) => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800';

  const canViewDashboard = hasPermission(role, 'canViewDashboard');
  const canViewKPI = hasPermission(role, 'canViewKPI');
  const canManageUsers = hasPermission(role, 'canManageUsers');
  const canViewForklifts = hasPermission(role, 'canViewForklifts');
  const canViewCustomers = hasPermission(role, 'canViewCustomers');
  const canManageInventory = hasPermission(role, 'canManageInventory');
  const canViewServiceRecords = hasPermission(role, 'canViewServiceRecords');
  const canFinalizeInvoices = hasPermission(role, 'canFinalizeInvoices');

  return (
    <div className="w-64 bg-slate-900 text-white h-screen fixed left-0 top-0 flex flex-col hidden md:flex">
      <div className="p-6">
        <h1 className="text-2xl font-bold tracking-tight">FieldPro</h1>
        <p className="text-xs text-slate-500 uppercase mt-1 tracking-wider">{role} View</p>
      </div>
      
      <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
        {canViewDashboard && (
          <Link to="/" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${isActive('/')}`}>
            <LayoutDashboard className="w-5 h-5" /> Dashboard
          </Link>
        )}
        <Link to="/jobs" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${isActive('/jobs')}`}>
          <List className="w-5 h-5" /> Jobs
        </Link>
        
        {canViewForklifts && (
          <Link to="/forklifts" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${isActive('/forklifts')}`}>
            <Truck className="w-5 h-5" /> Forklifts
          </Link>
        )}
        {canViewCustomers && (
          <Link to="/customers" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${isActive('/customers')}`}>
            <Building2 className="w-5 h-5" /> Customers
          </Link>
        )}
        {canManageInventory && (
          <Link to="/inventory" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${isActive('/inventory')}`}>
            <Package className="w-5 h-5" /> Inventory
          </Link>
        )}
        
        {/* Records Section */}
        {(canViewServiceRecords || canFinalizeInvoices) && (
          <>
            <div className="pt-4 pb-2">
              <p className="px-4 text-xs text-slate-600 uppercase tracking-wider">Records</p>
            </div>
            {canViewServiceRecords && (
              <Link to="/service-records" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${isActive('/service-records')}`}>
                <ClipboardList className="w-5 h-5" /> Service Records
              </Link>
            )}
            {canFinalizeInvoices && (
              <Link to="/invoices" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${isActive('/invoices')}`}>
                <FileText className="w-5 h-5" /> Invoices
              </Link>
            )}
          </>
        )}
        
        {(canViewKPI || canManageUsers) && (
          <>
            <div className="pt-4 pb-2">
              <p className="px-4 text-xs text-slate-600 uppercase tracking-wider">Management</p>
            </div>
            {canViewKPI && (
              <Link to="/technician-kpi" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${isActive('/technician-kpi')}`}>
                <BarChart3 className="w-5 h-5" /> Technician KPI
              </Link>
            )}
            {canManageUsers && (
              <Link to="/users" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${isActive('/users')}`}>
                <UsersIcon className="w-5 h-5" /> Users
              </Link>
            )}
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

// Top Header with Notifications
const TopHeader = ({ currentUser }: { currentUser: User }) => {
  return (
    <div className="bg-white border-b border-slate-200 px-4 py-3 mb-6 -mx-4 md:-mx-8 -mt-4 md:-mt-8 flex justify-between items-center sticky top-0 z-40">
      <div className="md:hidden">
        <h1 className="text-lg font-bold text-slate-800">FieldPro</h1>
      </div>
      <div className="hidden md:block">
        {/* Spacer for desktop */}
      </div>
      <div className="flex items-center gap-4">
        {/* Notification Bell */}
        <NotificationBell currentUser={currentUser} />
        
        {/* User Info */}
        <div className="flex items-center gap-2 pl-4 border-l border-slate-200">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <UserIcon className="w-4 h-4 text-blue-600" />
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-slate-800">{currentUser.name}</p>
            <p className="text-xs text-slate-500 capitalize">{currentUser.role}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const MobileNav = ({ role }: { role: UserRole }) => {
  const canViewDashboard = hasPermission(role, 'canViewDashboard');
  const canViewForklifts = hasPermission(role, 'canViewForklifts');
  const canViewCustomers = hasPermission(role, 'canViewCustomers');
  const canManageInventory = hasPermission(role, 'canManageInventory');
  const canViewServiceRecords = hasPermission(role, 'canViewServiceRecords');
  const canFinalizeInvoices = hasPermission(role, 'canFinalizeInvoices');
  const canViewKPI = hasPermission(role, 'canViewKPI');

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-2 flex justify-around z-50">
      {canViewDashboard && (
        <Link to="/" className="p-2 text-slate-600 hover:text-blue-600"><LayoutDashboard className="w-6 h-6" /></Link>
      )}
      <Link to="/jobs" className="p-2 text-slate-600 hover:text-blue-600"><List className="w-6 h-6" /></Link>
      {canViewForklifts && (
        <Link to="/forklifts" className="p-2 text-slate-600 hover:text-blue-600"><Truck className="w-6 h-6" /></Link>
      )}
      {canViewCustomers && (
        <Link to="/customers" className="p-2 text-slate-600 hover:text-blue-600"><Building2 className="w-6 h-6" /></Link>
      )}
      {canManageInventory && (
        <Link to="/inventory" className="p-2 text-slate-600 hover:text-blue-600"><Package className="w-6 h-6" /></Link>
      )}
      {canViewServiceRecords && (
        <Link to="/service-records" className="p-2 text-slate-600 hover:text-blue-600"><ClipboardList className="w-6 h-6" /></Link>
      )}
      {canFinalizeInvoices && (
        <Link to="/invoices" className="p-2 text-slate-600 hover:text-blue-600"><FileText className="w-6 h-6" /></Link>
      )}
      {canViewKPI && (
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

  const canViewDashboard = hasPermission(currentUser.role, 'canViewDashboard');
  const canViewKPI = hasPermission(currentUser.role, 'canViewKPI');
  const canManageUsers = hasPermission(currentUser.role, 'canManageUsers');
  const canViewForklifts = hasPermission(currentUser.role, 'canViewForklifts');
  const canViewCustomers = hasPermission(currentUser.role, 'canViewCustomers');
  const canManageInventory = hasPermission(currentUser.role, 'canManageInventory');
  const canViewServiceRecords = hasPermission(currentUser.role, 'canViewServiceRecords');
  const canFinalizeInvoices = hasPermission(currentUser.role, 'canFinalizeInvoices');

  return (
    <Router>
      <div className="min-h-screen bg-slate-50 flex">
        <Sidebar role={currentUser.role} onLogout={handleLogout} />
        <main className="flex-1 md:ml-64 p-4 md:p-8 pb-20 md:pb-8 max-w-7xl mx-auto w-full">
          <TopHeader currentUser={currentUser} />
          <Routes>
            <Route path="/" element={
              !canViewDashboard
                ? <Navigate to="/jobs" /> 
                : <Dashboard role={currentUser.role} currentUser={currentUser} />
            } />
            <Route path="/jobs" element={<JobBoard currentUser={currentUser} />} />
            <Route path="/jobs/new" element={<CreateJob currentUser={currentUser} />} />
            <Route path="/jobs/:id" element={<JobDetail currentUser={currentUser} />} />
            
            {/* Inventory Route */}
            <Route path="/inventory" element={
              canManageInventory
                ? <InventoryPage currentUser={currentUser} />
                : <Navigate to="/" />
            } />
            
            {/* Forklift Routes */}
            <Route path="/forklifts" element={
              canViewForklifts
                ? <Forklifts currentUser={currentUser} />
                : <Navigate to="/" />
            } />
            <Route path="/forklifts/:id" element={
              canViewForklifts
                ? <ForkliftProfile currentUser={currentUser} />
                : <Navigate to="/" />
            } />
            
            {/* Customer Routes */}
            <Route path="/customers" element={
              canViewCustomers
                ? <Customers />
                : <Navigate to="/" />
            } />
            <Route path="/customers/:id" element={
              canViewCustomers
                ? <CustomerProfile currentUser={currentUser} />
                : <Navigate to="/" />
            } />
            
            {/* Service Records Route */}
            <Route path="/service-records" element={
              canViewServiceRecords
                ? <ServiceRecords currentUser={currentUser} />
                : <Navigate to="/" />
            } />
            
            {/* Invoices Route */}
            <Route path="/invoices" element={
              canFinalizeInvoices
                ? <Invoices currentUser={currentUser} />
                : <Navigate to="/" />
            } />
            
            {/* Technician KPI Route */}
            <Route path="/technician-kpi" element={
              canViewKPI
                ? <TechnicianKPIPage currentUser={currentUser} />
                : <Navigate to="/" />
            } />
            
            {/* User Management Route */}
            <Route path="/users" element={
              canManageUsers
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
