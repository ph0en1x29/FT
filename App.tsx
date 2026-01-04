import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Sun, Moon } from 'lucide-react';
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
import EmployeesPage from './pages/EmployeesPage';
import EmployeeProfile from './pages/EmployeeProfile';
import HRDashboard from './pages/HRDashboard';
import MyLeaveRequests from './pages/MyLeaveRequests';
import ServiceDue from './pages/ServiceDue';
import ServiceIntervalsConfig from './pages/ServiceIntervalsConfig';
import NotificationBell from './components/NotificationBell';
import { SupabaseDb as MockDb } from './services/supabaseService';
import { 
  LayoutDashboard, List, Package, LogOut, Users as UsersIcon, 
  Building2, Truck, ClipboardList, FileText, BarChart3, Menu, X, User as UserIcon,
  UserCog, CalendarDays, ChevronLeft, ChevronDown, Settings, Zap
} from 'lucide-react';

// Helper to check permissions
const hasPermission = (role: UserRole, permission: keyof typeof ROLE_PERMISSIONS[UserRole]) => {
  return ROLE_PERMISSIONS[role]?.[permission] ?? false;
};

// Sidebar styles as CSS-in-JS for glassmorphism
const sidebarStyles = `
  .sidebar-glass {
    background: #1e293b;
    border-right: 1px solid rgba(255, 255, 255, 0.06);
  }
  .nav-item-active {
    background: rgba(99, 102, 241, 0.15);
    border-left: 3px solid #818cf8;
  }
  .nav-item:hover:not(.nav-item-active) {
    background: rgba(255, 255, 255, 0.04);
  }
  .nav-item {
    border-left: 3px solid transparent;
  }
  .role-badge {
    background: rgba(99, 102, 241, 0.2);
    border: 1px solid rgba(99, 102, 241, 0.3);
  }
  .avatar-ring {
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    padding: 2px;
    border-radius: 9999px;
  }
  .section-content {
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .section-content.expanded {
    max-height: 200px;
  }
  .tooltip-sidebar {
    position: absolute;
    left: 100%;
    margin-left: 12px;
    padding: 6px 12px;
    background: #334155;
    border-radius: 6px;
    white-space: nowrap;
    opacity: 0;
    visibility: hidden;
    transition: all 0.2s ease;
    z-index: 100;
    font-size: 13px;
    color: white;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }
  .sidebar-collapsed .nav-item:hover .tooltip-sidebar {
    opacity: 1;
    visibility: visible;
  }
  .collapse-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: #64748b;
  }
  .collapse-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #94a3b8;
  }
  .bottom-nav-glass {
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-top: 1px solid rgba(0, 0, 0, 0.1);
  }
  .mobile-drawer-glass {
    background: #1e293b;
  }
  .section-header {
    color: #94a3b8;
  }
  .section-header:hover {
    color: #cbd5e1;
    background: rgba(255, 255, 255, 0.04);
  }
  .sidebar-nav-scroll {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .sidebar-nav-scroll::-webkit-scrollbar {
    width: 0;
    height: 0;
    display: none;
  }
`;

interface SidebarProps {
  currentUser: User;
  onLogout: () => void;
  isCollapsed: boolean;
  setIsCollapsed: (v: boolean) => void;
}

const Sidebar = ({ currentUser, onLogout, isCollapsed, setIsCollapsed }: SidebarProps) => {
  const location = useLocation();
  const [expandedSections, setExpandedSections] = useState<{ records: boolean; management: boolean }>({
    records: false,
    management: false,
  });

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const canViewDashboard = hasPermission(currentUser.role, 'canViewDashboard');
  const canViewKPI = hasPermission(currentUser.role, 'canViewKPI');
  const canManageUsers = hasPermission(currentUser.role, 'canManageUsers');
  const canViewForklifts = hasPermission(currentUser.role, 'canViewForklifts');
  const canViewCustomers = hasPermission(currentUser.role, 'canViewCustomers');
  const canManageInventory = hasPermission(currentUser.role, 'canManageInventory');
  const canViewServiceRecords = hasPermission(currentUser.role, 'canViewServiceRecords');
  const canFinalizeInvoices = hasPermission(currentUser.role, 'canFinalizeInvoices');
  const canViewHR = hasPermission(currentUser.role, 'canViewHR');
  const canViewOwnProfile = hasPermission(currentUser.role, 'canViewOwnProfile');

  const toggleSection = (section: 'records' | 'management') => {
    if (isCollapsed) return;
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const hasRecordsSection = canViewServiceRecords || canFinalizeInvoices;
  const hasManagementSection = canViewKPI || canManageUsers || canViewHR;

  const NavItem = ({ to, icon: Icon, label, badge }: { to: string; icon: any; label: string; badge?: number }) => (
    <Link
      to={to}
      className={`nav-item relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
        isActive(to) ? 'nav-item-active text-white' : 'text-slate-400 hover:text-slate-200'
      }`}
    >
      <Icon className={`w-5 h-5 flex-shrink-0 ${isActive(to) ? 'text-indigo-400' : ''}`} />
      {!isCollapsed && <span className="text-sm font-medium">{label}</span>}
      {badge && !isCollapsed && (
        <span className="absolute right-3 w-5 h-5 rounded-full text-xs text-white flex items-center justify-center bg-red-500">
          {badge}
        </span>
      )}
      {isCollapsed && <span className="tooltip-sidebar">{label}</span>}
    </Link>
  );

  const SubNavItem = ({ to, label }: { to: string; label: string }) => (
    <Link
      to={to}
      className={`nav-item relative flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm ${
        isCollapsed ? 'justify-center' : 'pl-11'
      } ${isActive(to) ? 'nav-item-active text-white' : 'text-slate-400 hover:text-slate-200'}`}
    >
      {!isCollapsed && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive(to) ? 'bg-indigo-400' : 'bg-slate-500'}`} />}
      {!isCollapsed && <span>{label}</span>}
      {isCollapsed && <span className="tooltip-sidebar">{label}</span>}
    </Link>
  );

  return (
    <aside
      className={`sidebar-glass fixed left-0 top-0 h-screen z-50 hidden md:flex flex-col overflow-hidden transition-all duration-300 ${
        isCollapsed ? 'w-[72px] sidebar-collapsed' : 'w-64'
      }`}
    >
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg flex-shrink-0">
            <Zap className="w-5 h-5 text-white" />
          </div>
          {!isCollapsed && (
            <h1 className="text-white font-bold text-lg tracking-tight">FieldPro</h1>
          )}
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="collapse-btn transition-all duration-200 flex-shrink-0"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft className={`w-5 h-5 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* User Section */}
      <div className="px-4 py-3 border-b border-slate-700/50">
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
          <div className="avatar-ring flex-shrink-0">
            <div className="w-9 h-9 rounded-full bg-slate-600 flex items-center justify-center text-white font-semibold text-sm">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-slate-100 font-medium text-sm truncate">{currentUser.name}</p>
              <span className="role-badge text-[10px] px-2 py-0.5 rounded-full text-indigo-300 inline-block mt-0.5 font-medium uppercase">
                {currentUser.role}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation - scrollable middle section */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto overflow-x-hidden sidebar-nav-scroll">
        {/* Primary Items */}
        <div className="space-y-1">
          {canViewDashboard && <NavItem to="/" icon={LayoutDashboard} label="Dashboard" />}
          <NavItem to="/jobs" icon={List} label="Jobs" />
          {canViewForklifts && <NavItem to="/forklifts" icon={Truck} label="Forklifts" />}
          {canViewCustomers && <NavItem to="/customers" icon={Building2} label="Customers" />}
          {canManageInventory && <NavItem to="/inventory" icon={Package} label="Inventory" />}
        </div>

        {/* Collapsible: Records */}
        {hasRecordsSection && (
          <div className="mt-3">
            <button
              onClick={() => toggleSection('records')}
              className={`section-header w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition ${
                isCollapsed ? 'justify-center' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && <span className="text-sm font-medium">Records</span>}
              </div>
              {!isCollapsed && (
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${expandedSections.records ? 'rotate-180' : ''}`}
                />
              )}
              {isCollapsed && <span className="tooltip-sidebar">Records</span>}
            </button>
            <div className={`section-content ${expandedSections.records ? 'expanded' : ''}`}>
              <div className="mt-1 space-y-0.5">
                {canViewServiceRecords && <SubNavItem to="/service-records" label="Service Records" />}
                {canFinalizeInvoices && <SubNavItem to="/invoices" label="Invoices" />}
              </div>
            </div>
          </div>
        )}

        {/* Collapsible: Management */}
        {hasManagementSection && (
          <div className="mt-1">
            <button
              onClick={() => toggleSection('management')}
              className={`section-header w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition ${
                isCollapsed ? 'justify-center' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && <span className="text-sm font-medium">Management</span>}
              </div>
              {!isCollapsed && (
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${expandedSections.management ? 'rotate-180' : ''}`}
                />
              )}
              {isCollapsed && <span className="tooltip-sidebar">Management</span>}
            </button>
            <div className={`section-content ${expandedSections.management ? 'expanded' : ''}`}>
              <div className="mt-1 space-y-0.5">
                {canViewKPI && <SubNavItem to="/technician-kpi" label="Technician KPI" />}
                {canViewHR && <SubNavItem to="/hr" label="HR / Employees" />}
                {canManageUsers && <SubNavItem to="/users" label="Users" />}
                {currentUser.role === 'admin' && <SubNavItem to="/service-intervals" label="Service Intervals" />}
              </div>
            </div>
          </div>
        )}

      </nav>

      {/* Footer - pinned at bottom */}
      <div className="flex-shrink-0 p-3 border-t border-slate-700/50">
        <div className="space-y-0.5">
          <NavItem to="/my-leave" icon={CalendarDays} label="My Leave" />
          {canViewOwnProfile && (
            <Link
              to={`/hr/employees/${currentUser.user_id}`}
              className={`nav-item relative flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                isActive(`/hr/employees/${currentUser.user_id}`) ? 'nav-item-active text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserIcon className={`w-5 h-5 flex-shrink-0 ${isActive(`/hr/employees/${currentUser.user_id}`) ? 'text-indigo-400' : ''}`} />
              {!isCollapsed && <span className="text-sm font-medium">My Profile</span>}
              {isCollapsed && <span className="tooltip-sidebar">My Profile</span>}
            </Link>
          )}
          <button
            onClick={onLogout}
            className="nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!isCollapsed && <span className="text-sm font-medium">Sign Out</span>}
            {isCollapsed && <span className="tooltip-sidebar">Sign Out</span>}
          </button>
        </div>
      </div>
    </aside>
  );
};

// Top Header with Notifications and Theme Toggle
const TopHeader = ({ currentUser, isDark, onToggleTheme }: { currentUser: User; isDark: boolean; onToggleTheme: () => void }) => {
  return (
    <div className="bg-theme-surface border-b border-theme px-4 py-3 mb-6 -mx-4 md:-mx-8 -mt-4 md:-mt-8 flex justify-between items-center sticky top-0 z-40 theme-transition">
      <div className="md:hidden">
        <h1 className="text-lg font-bold text-theme">FieldPro</h1>
      </div>
      <div className="hidden md:block" />
      <div className="flex items-center gap-4">
        {/* Theme Toggle Button */}
        <button
          onClick={onToggleTheme}
          className="flex items-center gap-2 px-3 py-2 bg-theme-surface-2 border border-theme rounded-lg text-theme-muted hover:text-theme transition-all theme-transition"
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          <span className="text-xs font-medium hidden sm:inline">{isDark ? 'Light' : 'Dark'}</span>
        </button>
        <NotificationBell currentUser={currentUser} />
        <div className="flex items-center gap-2 pl-4 border-l border-theme">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-semibold">{currentUser.name.charAt(0).toUpperCase()}</span>
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-theme">{currentUser.name}</p>
            <p className="text-xs text-theme-muted capitalize">{currentUser.role}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Mobile Bottom Nav
const MobileNav = ({ currentUser, onOpenDrawer }: { currentUser: User; onOpenDrawer: () => void }) => {
  const location = useLocation();
  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const canViewDashboard = hasPermission(currentUser.role, 'canViewDashboard');
  const canViewForklifts = hasPermission(currentUser.role, 'canViewForklifts');
  const canViewCustomers = hasPermission(currentUser.role, 'canViewCustomers');

  const NavIcon = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => (
    <Link to={to} className={`flex flex-col items-center gap-0.5 p-2 rounded-xl ${isActive(to) ? 'text-blue-600' : 'text-slate-400'}`}>
      <Icon className="w-6 h-6" />
      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  );

  return (
    <nav className="bottom-nav-glass md:hidden fixed bottom-0 left-0 right-0 z-50 px-2 py-2 flex justify-around items-center">
      {canViewDashboard && <NavIcon to="/" icon={LayoutDashboard} label="Home" />}
      <NavIcon to="/jobs" icon={List} label="Jobs" />
      {canViewForklifts && <NavIcon to="/forklifts" icon={Truck} label="Assets" />}
      {canViewCustomers && <NavIcon to="/customers" icon={Building2} label="Clients" />}
      <button onClick={onOpenDrawer} className="flex flex-col items-center gap-0.5 p-2 rounded-xl text-slate-400">
        <Menu className="w-6 h-6" />
        <span className="text-[10px] font-medium">More</span>
      </button>
    </nav>
  );
};

// Mobile Drawer
const MobileDrawer = ({ currentUser, isOpen, onClose, onLogout }: { currentUser: User; isOpen: boolean; onClose: () => void; onLogout: () => void }) => {
  const canManageInventory = hasPermission(currentUser.role, 'canManageInventory');
  const canViewServiceRecords = hasPermission(currentUser.role, 'canViewServiceRecords');
  const canFinalizeInvoices = hasPermission(currentUser.role, 'canFinalizeInvoices');
  const canViewKPI = hasPermission(currentUser.role, 'canViewKPI');
  const canViewHR = hasPermission(currentUser.role, 'canViewHR');
  const canManageUsers = hasPermission(currentUser.role, 'canManageUsers');
  const canViewOwnProfile = hasPermission(currentUser.role, 'canViewOwnProfile');

  if (!isOpen) return null;

  const DrawerLink = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => (
    <Link to={to} onClick={onClose} className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-700/50 transition">
      <Icon className="w-5 h-5 text-slate-400" />
      {label}
    </Link>
  );

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <aside className="mobile-drawer-glass absolute right-0 top-0 h-full w-72">
        <div className="p-4 flex justify-between items-center border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-0.5 rounded-full">
              <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center text-white font-semibold">
                {currentUser.name.charAt(0).toUpperCase()}
              </div>
            </div>
            <div>
              <p className="text-slate-100 font-medium text-sm">{currentUser.name}</p>
              <span className="role-badge text-xs px-2 py-0.5 rounded-full text-indigo-300 capitalize">{currentUser.role}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="p-4 space-y-1">
          {canManageInventory && <DrawerLink to="/inventory" icon={Package} label="Inventory" />}
          {canViewServiceRecords && <DrawerLink to="/service-records" icon={ClipboardList} label="Service Records" />}
          {canFinalizeInvoices && <DrawerLink to="/invoices" icon={FileText} label="Invoices" />}
          {canViewKPI && <DrawerLink to="/technician-kpi" icon={BarChart3} label="Technician KPI" />}
          {canViewHR && <DrawerLink to="/hr" icon={UserCog} label="HR / Employees" />}
          {canManageUsers && <DrawerLink to="/users" icon={UsersIcon} label="Users" />}
          <div className="border-t border-slate-700/50 my-3" />
          <DrawerLink to="/my-leave" icon={CalendarDays} label="My Leave" />
          {canViewOwnProfile && <DrawerLink to={`/hr/employees/${currentUser.user_id}`} icon={UserIcon} label="My Profile" />}
          <div className="border-t border-slate-700/50 my-3" />
          <button
            onClick={() => { onLogout(); onClose(); }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-500/10 transition"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </nav>
      </aside>
    </div>
  );
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    // Initialize from localStorage
    if (typeof window !== 'undefined') {
      return localStorage.getItem('fieldpro-theme') === 'dark';
    }
    return false;
  });

  // Apply theme to document and persist to localStorage
  useEffect(() => {
    if (isDarkTheme) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('fieldpro-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('fieldpro-theme', 'light');
    }
  }, [isDarkTheme]);

  const toggleTheme = () => {
    setIsDarkTheme(prev => !prev);
  };

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
  const canViewHR = hasPermission(currentUser.role, 'canViewHR');
  const canViewOwnProfile = hasPermission(currentUser.role, 'canViewOwnProfile');

  return (
    <Router>
      <style>{sidebarStyles}</style>
      <Toaster 
        position="top-right" 
        richColors 
        closeButton
        toastOptions={{
          duration: 4000,
          className: 'text-sm',
        }}
      />
      <div className="min-h-screen bg-theme-bg flex theme-transition">
        <Sidebar
          currentUser={currentUser}
          onLogout={handleLogout}
          isCollapsed={sidebarCollapsed}
          setIsCollapsed={setSidebarCollapsed}
        />
        <main className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? 'md:ml-[72px]' : 'md:ml-64'} p-4 md:p-6 lg:p-8 pb-20 md:pb-8`}>
          <TopHeader currentUser={currentUser} isDark={isDarkTheme} onToggleTheme={toggleTheme} />
          <Routes>
            <Route path="/" element={
              !canViewDashboard
                ? <Navigate to="/jobs" /> 
                : <Dashboard role={currentUser.role} currentUser={currentUser} />
            } />
            <Route path="/jobs" element={<JobBoard currentUser={currentUser} />} />
            <Route path="/jobs/new" element={<CreateJob currentUser={currentUser} />} />
            <Route path="/jobs/:id" element={<JobDetail currentUser={currentUser} />} />
            
            <Route path="/inventory" element={
              canManageInventory ? <InventoryPage currentUser={currentUser} /> : <Navigate to="/" />
            } />
            
            <Route path="/forklifts" element={
              canViewForklifts ? <Forklifts currentUser={currentUser} /> : <Navigate to="/" />
            } />
            <Route path="/forklifts/:id" element={
              canViewForklifts ? <ForkliftProfile currentUser={currentUser} /> : <Navigate to="/" />
            } />
            
            <Route path="/customers" element={canViewCustomers ? <Customers /> : <Navigate to="/" />} />
            <Route path="/customers/:id" element={
              canViewCustomers ? <CustomerProfile currentUser={currentUser} /> : <Navigate to="/" />
            } />
            
            <Route path="/service-records" element={
              canViewServiceRecords ? <ServiceRecords currentUser={currentUser} /> : <Navigate to="/" />
            } />
            
            <Route path="/invoices" element={
              canFinalizeInvoices ? <Invoices currentUser={currentUser} /> : <Navigate to="/" />
            } />
            
            <Route path="/technician-kpi" element={
              canViewKPI ? <TechnicianKPIPage currentUser={currentUser} /> : <Navigate to="/" />
            } />
            
            <Route path="/users" element={canManageUsers ? <UserManagement /> : <Navigate to="/" />} />
            
            <Route path="/hr" element={canViewHR ? <HRDashboard currentUser={currentUser} /> : <Navigate to="/" />} />
            <Route path="/hr/employees" element={
              canViewHR ? <EmployeesPage currentUser={currentUser} /> : <Navigate to="/" />
            } />
            <Route path="/hr/employees/:id" element={
              (canViewHR || canViewOwnProfile) ? <EmployeeProfile currentUser={currentUser} /> : <Navigate to="/" />
            } />
            
            <Route path="/my-profile" element={
              canViewOwnProfile ? <Navigate to={`/hr/employees/${currentUser.user_id}`} /> : <Navigate to="/" />
            } />
            
            <Route path="/my-leave" element={<MyLeaveRequests currentUser={currentUser} />} />
            
            {/* Service Due Page - Admin/Supervisor only */}
            <Route path="/service-due" element={
              (currentUser.role === 'admin' || currentUser.role === 'supervisor') 
                ? <ServiceDue /> 
                : <Navigate to="/" />
            } />
            
            {/* Service Intervals Config - Admin only */}
            <Route path="/service-intervals" element={
              currentUser.role === 'admin'
                ? <ServiceIntervalsConfig currentUser={currentUser} />
                : <Navigate to="/" />
            } />
            
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
        <MobileNav currentUser={currentUser} onOpenDrawer={() => setMobileDrawerOpen(true)} />
        <MobileDrawer
          currentUser={currentUser}
          isOpen={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
          onLogout={handleLogout}
        />
      </div>
    </Router>
  );
}
