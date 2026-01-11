import React, { useState, useEffect, lazy, Suspense } from 'react';
import { HashRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Sun, Moon } from 'lucide-react';
import { User, UserRole, ROLE_PERMISSIONS } from './types_with_invoice_tracking';
import NotificationBell from './components/NotificationBell';
import { NotificationProvider } from './contexts/NotificationContext';
import { 
  LayoutDashboard, List, Package, LogOut, 
  Building2, Truck, FileText, BarChart3, Menu, X, User as UserIcon,
  CalendarDays, ChevronLeft, Zap, Loader2, Users
} from 'lucide-react';

// Lazy load all pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const JobBoard = lazy(() => import('./pages/JobBoard'));
const JobDetail = lazy(() => import('./pages/JobDetail'));
const CreateJob = lazy(() => import('./pages/CreateJob'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const Customers = lazy(() => import('./pages/Customers'));
const CustomerProfile = lazy(() => import('./pages/CustomerProfile'));
const ForkliftsTabs = lazy(() => import('./pages/ForkliftsTabs'));
const ForkliftProfile = lazy(() => import('./pages/ForkliftProfile'));
const ServiceRecords = lazy(() => import('./pages/ServiceRecords'));
const Invoices = lazy(() => import('./pages/Invoices'));
const InventoryPage = lazy(() => import('./pages/InventoryPage'));
const TechnicianKPIPage = lazy(() => import('./pages/TechnicianKPIPageV2'));
const People = lazy(() => import('./pages/People'));
const EmployeeProfile = lazy(() => import('./pages/EmployeeProfile'));
const MyLeaveRequests = lazy(() => import('./pages/MyLeaveRequests'));
const PrototypeDashboards = lazy(() => import('./pages/PrototypeDashboards'));

// Loading fallback
const PageLoader = () => (
  <div className="flex items-center justify-center h-full min-h-[400px]">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
      <p className="text-sm text-[var(--text-muted)]">Loading...</p>
    </div>
  </div>
);

// Permission helper
const hasPermission = (role: UserRole, permission: keyof typeof ROLE_PERMISSIONS[UserRole]) => {
  return ROLE_PERMISSIONS[role]?.[permission] ?? false;
};

// Sidebar styles - cleaner, flatter design
const sidebarStyles = `
  .sidebar-glass {
    background: #1e293b;
    border-right: 1px solid rgba(255, 255, 255, 0.06);
  }
  .nav-item {
    border-radius: 8px;
    transition: all 0.15s ease;
  }
  .nav-item-active {
    background: rgba(99, 102, 241, 0.15);
    color: #a5b4fc;
  }
  .nav-item-active .nav-icon {
    color: #818cf8;
  }
  .nav-item:hover:not(.nav-item-active) {
    background: rgba(255, 255, 255, 0.05);
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
    border-top: 1px solid rgba(0, 0, 0, 0.1);
  }
  .mobile-drawer-glass {
    background: #1e293b;
  }
  .sidebar-nav-scroll {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .sidebar-nav-scroll::-webkit-scrollbar {
    display: none;
  }
  .nav-divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.06);
    margin: 8px 12px;
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

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  // Permissions
  const canViewDashboard = hasPermission(currentUser.role, 'canViewDashboard');
  const canViewForklifts = hasPermission(currentUser.role, 'canViewForklifts');
  const canViewCustomers = hasPermission(currentUser.role, 'canViewCustomers');
  const canManageInventory = hasPermission(currentUser.role, 'canManageInventory');
  const canViewServiceRecords = hasPermission(currentUser.role, 'canViewServiceRecords');
  const canFinalizeInvoices = hasPermission(currentUser.role, 'canFinalizeInvoices');
  const canViewKPI = hasPermission(currentUser.role, 'canViewKPI');
  const canViewHR = hasPermission(currentUser.role, 'canViewHR');
  const canManageUsers = hasPermission(currentUser.role, 'canManageUsers');
  const canViewOwnProfile = hasPermission(currentUser.role, 'canViewOwnProfile');

  // Show People if user can manage users OR view HR
  const canViewPeople = canManageUsers || canViewHR;

  const NavItem = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => (
    <Link
      to={to}
      className={`nav-item relative flex items-center gap-3 px-3 py-2.5 ${
        isActive(to) ? 'nav-item-active' : 'text-slate-400 hover:text-slate-200'
      }`}
    >
      <Icon className={`nav-icon w-5 h-5 flex-shrink-0`} />
      {!isCollapsed && <span className="text-sm font-medium">{label}</span>}
      {isCollapsed && <span className="tooltip-sidebar">{label}</span>}
    </Link>
  );

  return (
    <aside
      className={`sidebar-glass fixed left-0 top-0 h-screen z-50 hidden md:flex flex-col transition-all duration-300 ${
        isCollapsed ? 'w-[72px] sidebar-collapsed' : 'w-60'
      }`}
    >
      {/* Header - Compact */}
      <div className="p-3 flex items-center justify-between border-b border-slate-700/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-white" />
          </div>
          {!isCollapsed && <span className="text-white font-bold text-base">FieldPro</span>}
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="collapse-btn flex-shrink-0"
          title={isCollapsed ? 'Expand' : 'Collapse'}
        >
          <ChevronLeft className={`w-4 h-4 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto sidebar-nav-scroll">
        <div className="space-y-1">
          {/* Core */}
          {canViewDashboard && <NavItem to="/" icon={LayoutDashboard} label="Dashboard" />}
          <NavItem to="/jobs" icon={List} label="Jobs" />
          
          {/* Assets */}
          {canViewForklifts && <NavItem to="/forklifts" icon={Truck} label="Forklifts" />}
          {canViewCustomers && <NavItem to="/customers" icon={Building2} label="Customers" />}
          {canManageInventory && <NavItem to="/inventory" icon={Package} label="Inventory" />}
          
          {/* Records - if user can see service records or invoices */}
          {(canViewServiceRecords || canFinalizeInvoices) && (
            <>
              <div className="nav-divider" />
              {canViewServiceRecords && <NavItem to="/service-records" icon={FileText} label="Service Records" />}
              {canFinalizeInvoices && <NavItem to="/invoices" icon={FileText} label="Invoices" />}
            </>
          )}
          
          {/* Reports & People */}
          {(canViewKPI || canViewPeople) && (
            <>
              <div className="nav-divider" />
              {canViewKPI && <NavItem to="/reports" icon={BarChart3} label="Reports" />}
              {canViewPeople && <NavItem to="/people" icon={Users} label="People" />}
            </>
          )}
        </div>
      </nav>

      {/* Footer - Fixed at bottom */}
      <div className="flex-shrink-0 p-2 border-t border-slate-700/50">
        <div className="space-y-1">
          <NavItem to="/my-leave" icon={CalendarDays} label="My Leave" />
          {canViewOwnProfile && (
            <Link
              to={`/people/employees/${currentUser.user_id}`}
              className={`nav-item relative flex items-center gap-3 px-3 py-2.5 ${
                isActive(`/people/employees/${currentUser.user_id}`) ? 'nav-item-active' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserIcon className="nav-icon w-5 h-5 flex-shrink-0" />
              {!isCollapsed && <span className="text-sm font-medium">My Profile</span>}
              {isCollapsed && <span className="tooltip-sidebar">My Profile</span>}
            </Link>
          )}
          <button
            onClick={onLogout}
            className="nav-item w-full flex items-center gap-3 px-3 py-2.5 text-red-400 hover:text-red-300 hover:bg-red-500/10"
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

// Top Header
const TopHeader = ({ currentUser, isDark, onToggleTheme }: { currentUser: User; isDark: boolean; onToggleTheme: () => void }) => {
  return (
    <div className="bg-theme-surface border-b border-theme px-4 py-3 mb-6 -mx-4 md:-mx-8 -mt-4 md:-mt-8 flex justify-between items-center sticky top-0 z-40 theme-transition">
      <div className="md:hidden">
        <h1 className="text-lg font-bold text-theme">FieldPro</h1>
      </div>
      <div className="hidden md:block" />
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleTheme}
          className="flex items-center gap-2 px-3 py-2 bg-theme-surface-2 border border-theme rounded-lg text-theme-muted hover:text-theme transition-all"
          title={isDark ? 'Light Mode' : 'Dark Mode'}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <NotificationBell currentUser={currentUser} />
        <div className="flex items-center gap-2 pl-3 border-l border-theme">
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
  const canViewPeople = canManageUsers || canViewHR;

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
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-semibold">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-slate-100 font-medium text-sm">{currentUser.name}</p>
              <span className="text-xs text-indigo-300 capitalize">{currentUser.role}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="p-4 space-y-1">
          {canManageInventory && <DrawerLink to="/inventory" icon={Package} label="Inventory" />}
          {canViewServiceRecords && <DrawerLink to="/service-records" icon={FileText} label="Service Records" />}
          {canFinalizeInvoices && <DrawerLink to="/invoices" icon={FileText} label="Invoices" />}
          {canViewKPI && <DrawerLink to="/reports" icon={BarChart3} label="Reports" />}
          {canViewPeople && <DrawerLink to="/people" icon={Users} label="People" />}
          <div className="border-t border-slate-700/50 my-3" />
          <DrawerLink to="/my-leave" icon={CalendarDays} label="My Leave" />
          {canViewOwnProfile && <DrawerLink to={`/people/employees/${currentUser.user_id}`} icon={UserIcon} label="My Profile" />}
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
    if (typeof window !== 'undefined') {
      return localStorage.getItem('fieldpro-theme') === 'dark';
    }
    return false;
  });

  useEffect(() => {
    if (isDarkTheme) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('fieldpro-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('fieldpro-theme', 'light');
    }
  }, [isDarkTheme]);

  const toggleTheme = () => setIsDarkTheme(prev => !prev);
  const handleLogout = () => setCurrentUser(null);

  if (!currentUser) {
    return <LoginPage onLogin={setCurrentUser} />;
  }

  // Permissions
  const canViewDashboard = hasPermission(currentUser.role, 'canViewDashboard');
  const canViewForklifts = hasPermission(currentUser.role, 'canViewForklifts');
  const canViewCustomers = hasPermission(currentUser.role, 'canViewCustomers');
  const canManageInventory = hasPermission(currentUser.role, 'canManageInventory');
  const canViewServiceRecords = hasPermission(currentUser.role, 'canViewServiceRecords');
  const canFinalizeInvoices = hasPermission(currentUser.role, 'canFinalizeInvoices');
  const canCreateJobs = hasPermission(currentUser.role, 'canCreateJobs');
  const canViewKPI = hasPermission(currentUser.role, 'canViewKPI');
  const canViewHR = hasPermission(currentUser.role, 'canViewHR');
  const canManageUsers = hasPermission(currentUser.role, 'canManageUsers');
  const canViewOwnProfile = hasPermission(currentUser.role, 'canViewOwnProfile');
  const canViewPeople = canManageUsers || canViewHR;

  return (
    <NotificationProvider currentUser={currentUser}>
      <Router>
      <style>{sidebarStyles}</style>
      <Toaster position="top-right" richColors closeButton toastOptions={{ duration: 4000, className: 'text-sm' }} />
      <div className="min-h-screen bg-theme-bg flex theme-transition">
        <Sidebar
          currentUser={currentUser}
          onLogout={handleLogout}
          isCollapsed={sidebarCollapsed}
          setIsCollapsed={setSidebarCollapsed}
        />
        <main className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? 'md:ml-[72px]' : 'md:ml-60'} p-4 md:p-6 lg:p-8 pb-20 md:pb-8`}>
          <TopHeader currentUser={currentUser} isDark={isDarkTheme} onToggleTheme={toggleTheme} />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Dashboard */}
              <Route path="/" element={
                canViewDashboard ? <Dashboard role={currentUser.role} currentUser={currentUser} /> : <Navigate to="/jobs" />
              } />
              
              {/* Jobs */}
              <Route path="/jobs" element={<JobBoard currentUser={currentUser} />} />
              <Route path="/jobs/new" element={canCreateJobs ? <CreateJob currentUser={currentUser} /> : <Navigate to="/" />} />
              <Route path="/jobs/:id" element={<JobDetail currentUser={currentUser} />} />
              
              {/* Forklifts - now with tabs for Fleet, Service Intervals, Service Due */}
              <Route path="/forklifts" element={
                canViewForklifts ? <ForkliftsTabs currentUser={currentUser} /> : <Navigate to="/" />
              } />
              <Route path="/forklifts/:id" element={
                canViewForklifts ? <ForkliftProfile currentUser={currentUser} /> : <Navigate to="/" />
              } />
              
              {/* Customers */}
              <Route path="/customers" element={canViewCustomers ? <Customers /> : <Navigate to="/" />} />
              <Route path="/customers/:id" element={
                canViewCustomers ? <CustomerProfile currentUser={currentUser} /> : <Navigate to="/" />
              } />
              
              {/* Inventory */}
              <Route path="/inventory" element={
                canManageInventory ? <InventoryPage currentUser={currentUser} /> : <Navigate to="/" />
              } />
              
              {/* Service Records */}
              <Route path="/service-records" element={
                canViewServiceRecords ? <ServiceRecords currentUser={currentUser} /> : <Navigate to="/" />
              } />
              
              {/* Invoices */}
              <Route path="/invoices" element={
                canFinalizeInvoices ? <Invoices currentUser={currentUser} /> : <Navigate to="/" />
              } />
              
              {/* Reports - Technician KPI */}
              <Route path="/reports" element={
                canViewKPI ? <TechnicianKPIPage currentUser={currentUser} /> : <Navigate to="/" />
              } />
              
              {/* People - combined Users, Employees, Leave */}
              <Route path="/people" element={
                canViewPeople ? <People currentUser={currentUser} /> : <Navigate to="/" />
              } />
              <Route path="/people/employees/:id" element={
                (canViewHR || canViewOwnProfile) ? <EmployeeProfile currentUser={currentUser} /> : <Navigate to="/" />
              } />
              
              {/* My Leave */}
              <Route path="/my-leave" element={<MyLeaveRequests currentUser={currentUser} />} />
              
              {/* Legacy redirects */}
              <Route path="/users" element={<Navigate to="/people?tab=users" replace />} />
              <Route path="/hr" element={<Navigate to="/people?tab=overview" replace />} />
              <Route path="/hr/employees" element={<Navigate to="/people?tab=employees" replace />} />
              <Route path="/hr/employees/:id" element={
                (canViewHR || canViewOwnProfile) ? <EmployeeProfile currentUser={currentUser} /> : <Navigate to="/" />
              } />
              <Route path="/technician-kpi" element={<Navigate to="/reports" replace />} />
              <Route path="/service-intervals" element={<Navigate to="/forklifts?tab=intervals" replace />} />
              <Route path="/service-due" element={<Navigate to="/forklifts?tab=service-due" replace />} />
              <Route path="/my-profile" element={<Navigate to={`/people/employees/${currentUser.user_id}`} replace />} />
              
              {/* Prototype Routes (dev-only, hidden from sidebar) */}
              <Route path="/prototype/dashboards" element={<PrototypeDashboards />} />
              
              {/* Catch all */}
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Suspense>
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
    </NotificationProvider>
  );
}
