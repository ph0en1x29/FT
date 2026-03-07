/* eslint-disable max-lines */
/**
 * AuthenticatedApp - Main layout for logged-in users
 * 
 * This component is lazy-loaded to reduce initial bundle size.
 * Contains: Sidebar, TopHeader, MobileNav, MobileDrawer, and all routes.
 */
import { Building2,CalendarDays,ChevronLeft,FileText,LayoutDashboard,List,Loader2,LogOut,Menu,Moon,Package,PackageCheck,Search,Sun,Truck,User as UserIcon,Users,X,Zap,type LucideIcon } from 'lucide-react';
import React,{ lazy,Suspense,useCallback,useEffect,useState } from 'react';
import { Link,Navigate,Route,HashRouter as Router,Routes,useLocation,useNavigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { DevModeProvider,useDevModeContext } from '../../contexts/DevModeContext';
import { FeatureFlagProvider } from '../../contexts/FeatureFlagContext';
import { NotificationProvider,useNotifications } from '../../contexts/NotificationContext';
import { QueryProvider } from '../../contexts/QueryProvider';
import CommandPalette from '../CommandPalette';
import FloatingActionButton from '../mobile/FloatingActionButton';
import { User,UserRole } from '../../types';
import DevBanner from '../dev/DevBanner';
import DevModeSelector from '../dev/DevModeSelector';
import NotificationBell from '../NotificationBell';

// Lazy load all pages
const JobsTabs = lazy(() => import('../../pages/JobsTabs'));
const JobDetail = lazy(() => import('../../pages/JobDetail'));
const CreateJob = lazy(() => import('../../pages/CreateJob'));
const Customers = lazy(() => import('../../pages/Customers'));
const CustomerProfile = lazy(() => import('../../pages/CustomerProfile'));
const ForkliftsTabs = lazy(() => import('../../pages/ForkliftsTabs'));
const ForkliftProfile = lazy(() => import('../../pages/ForkliftProfile'));
const Invoices = lazy(() => import('../../pages/Invoices'));
const InventoryPage = lazy(() => import('../../pages/InventoryPage'));
const People = lazy(() => import('../../pages/People'));
const EmployeeProfile = lazy(() => import('../../pages/EmployeeProfile'));
const MyLeaveRequests = lazy(() => import('../../pages/MyLeaveRequests'));
const PrototypeDashboards = lazy(() => import('../../pages/PrototypeDashboards'));
const MyVanStock = lazy(() => import('../../pages/MyVanStock'));

// Loading fallback
export const PageLoader = () => (
  <div className="flex items-center justify-center h-full min-h-[400px]">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-[var(--accent)]" />
      <p className="text-sm text-[var(--text-muted)]">Loading...</p>
    </div>
  </div>
);

// Sidebar styles
const sidebarStyles = `
  .sidebar-glass {
    background:
      linear-gradient(180deg, rgba(15, 23, 42, 0.96) 0%, rgba(30, 41, 59, 0.94) 100%);
    border-right: 1px solid rgba(148, 163, 184, 0.16);
    box-shadow: 24px 0 48px rgba(15, 23, 42, 0.16);
    backdrop-filter: blur(20px);
  }
  .nav-item {
    border-radius: 14px;
    transition: all 0.18s ease;
  }
  .nav-item-active {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.24) 0%, rgba(129, 140, 248, 0.14) 100%);
    color: #e0e7ff;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }
  .nav-item-active .nav-icon {
    color: #c7d2fe;
  }
  .nav-item:hover:not(.nav-item-active) {
    background: rgba(255, 255, 255, 0.06);
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
    background: rgba(255, 255, 255, 0.88);
    backdrop-filter: blur(24px);
    border-top: 1px solid rgba(148, 163, 184, 0.16);
  }
  [data-theme="dark"] .bottom-nav-glass,
  .dark .bottom-nav-glass {
    background: rgba(15, 23, 42, 0.9);
    border-top: 1px solid rgba(148, 163, 184, 0.18);
  }
  .mobile-drawer-glass {
    background: linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(30, 41, 59, 0.96) 100%);
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
  navRole: UserRole;
}

const Sidebar = ({ currentUser, onLogout, isCollapsed, setIsCollapsed, navRole }: SidebarProps) => {
  const location = useLocation();
  const { hasPermission } = useDevModeContext();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const canViewDashboard = hasPermission('canViewDashboard');
  const canViewForklifts = hasPermission('canViewForklifts');
  const canViewCustomers = hasPermission('canViewCustomers');
  const canManageInventory = hasPermission('canManageInventory');
  const canFinalizeInvoices = hasPermission('canFinalizeInvoices');
  const canViewHR = hasPermission('canViewHR');
  const canManageUsers = hasPermission('canManageUsers');
  const canViewOwnProfile = hasPermission('canViewOwnProfile');
  const canViewTeam = canManageUsers || canViewHR || hasPermission('canViewKPI');

  const NavItem = ({ to, icon: Icon, label }: { to: string; icon: LucideIcon; label: string }) => (
    <Link
      to={to}
      className={`nav-item relative flex items-center gap-3 px-3 py-2.5 ${isActive(to) ? 'nav-item-active' : 'text-slate-400 hover:text-slate-200'}`}
    >
      <Icon className={`nav-icon w-5 h-5 flex-shrink-0`} />
      {!isCollapsed && <span className="text-sm font-medium">{label}</span>}
      {isCollapsed && <span className="tooltip-sidebar">{label}</span>}
    </Link>
  );

  return (
    <aside className={`sidebar-glass fixed left-0 top-0 h-screen z-50 hidden md:flex flex-col transition-all duration-300 ${isCollapsed ? 'w-[72px] sidebar-collapsed' : 'w-60'}`}>
      <div className="p-3 flex items-center justify-between border-b border-slate-700/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-white" />
          </div>
          {!isCollapsed && <span className="text-white font-bold text-base">FieldPro</span>}
        </div>
        <button onClick={() => setIsCollapsed(!isCollapsed)} className="collapse-btn flex-shrink-0" title={isCollapsed ? 'Expand' : 'Collapse'}>
          <ChevronLeft className={`w-4 h-4 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} />
        </button>
      </div>
      <nav className="flex-1 px-2 py-3 overflow-y-auto sidebar-nav-scroll">
        <div className="space-y-1">
          {canViewDashboard && <NavItem to="/" icon={LayoutDashboard} label="Dashboard" />}
          <NavItem to="/jobs" icon={List} label="Jobs" />
          {canViewForklifts && <NavItem to="/forklifts" icon={Truck} label="Fleet" />}
          {canViewCustomers && <NavItem to="/customers" icon={Building2} label="Customers" />}
          {canManageInventory && <NavItem to="/inventory" icon={Package} label="Inventory" />}
          {canFinalizeInvoices && (
            <>
              <div className="nav-divider" />
              <NavItem to="/invoices" icon={FileText} label="Billing" />
            </>
          )}
          {canViewTeam && <NavItem to="/people" icon={Users} label="Team" />}
        </div>
      </nav>
      <div className="flex-shrink-0 p-2 border-t border-slate-700/50">
        <div className="space-y-1">
          <NavItem to="/my-leave" icon={CalendarDays} label="My Leave" />
          {navRole === UserRole.TECHNICIAN && <NavItem to="/my-van-stock" icon={Truck} label="My Van Stock" />}
          {canViewOwnProfile && (
            <Link to={`/people/employees/${currentUser.user_id}`} className={`nav-item relative flex items-center gap-3 px-3 py-2.5 ${isActive(`/people/employees/${currentUser.user_id}`) ? 'nav-item-active' : 'text-slate-400 hover:text-slate-200'}`}>
              <UserIcon className="nav-icon w-5 h-5 flex-shrink-0" />
              {!isCollapsed && <span className="text-sm font-medium">My Profile</span>}
              {isCollapsed && <span className="tooltip-sidebar">My Profile</span>}
            </Link>
          )}
          <button onClick={onLogout} className="nav-item w-full flex items-center gap-3 px-3 py-2.5 text-red-400 hover:text-red-300 hover:bg-red-500/10">
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!isCollapsed && <span className="text-sm font-medium">Sign Out</span>}
            {isCollapsed && <span className="tooltip-sidebar">Sign Out</span>}
          </button>
        </div>
      </div>
    </aside>
  );
};

const TopHeader = ({ currentUser, isDark, onToggleTheme, devModeActive, onOpenSearch }: { currentUser: User; isDark: boolean; onToggleTheme: () => void; devModeActive?: boolean; onOpenSearch?: () => void }) => (
  <div className={`sticky z-40 mb-6 ${devModeActive ? 'top-10' : 'top-0'}`}>
    <div
      className="flex items-center justify-between gap-3 rounded-[24px] px-4 py-3 theme-transition"
      style={{
        background: 'color-mix(in srgb, var(--surface) 86%, white 14%)',
        border: '1px solid var(--border)',
        boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
        backdropFilter: 'blur(24px)',
      }}
    >
      <div className="md:hidden">
        <h1 className="text-lg font-semibold tracking-[-0.02em] text-theme">FieldPro</h1>
      </div>
      <div className="hidden md:block">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-theme-muted">Operations Console</p>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        {onOpenSearch && (
          <button
            onClick={onOpenSearch}
            className="flex items-center gap-2 rounded-2xl border px-3 py-2 text-theme-muted transition-all hover:text-theme"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
            title="Search (⌘K)"
          >
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline text-xs font-medium">⌘K</span>
          </button>
        )}
        <DevModeSelector />
        <button
          onClick={onToggleTheme}
          className="flex items-center gap-2 rounded-2xl border px-3 py-2 text-theme-muted transition-all hover:text-theme"
          style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
          title={isDark ? 'Light Mode' : 'Dark Mode'}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <NotificationBell currentUser={currentUser} />
        <div
          className="flex items-center gap-2 rounded-2xl pl-2 pr-3 py-1.5"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
        >
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-semibold">{currentUser.name.charAt(0).toUpperCase()}</span>
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-theme">{currentUser.name}</p>
            <p className="text-[11px] text-theme-muted capitalize">{currentUser.role}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const MobileNav = ({ currentUser: _currentUser, onOpenDrawer, navRole }: { currentUser: User; onOpenDrawer: () => void; navRole: UserRole }) => {
  const location = useLocation();
  const { unreadCount } = useNotifications();

  const navItems: Array<{ to: string; icon: LucideIcon; label: string; showBadge?: boolean }> = (() => {
    switch (navRole) {
      case UserRole.TECHNICIAN:
        return [
          { to: '/', icon: LayoutDashboard, label: 'Home' },
          { to: '/jobs', icon: List, label: 'Jobs' },
          { to: '/my-van-stock', icon: Package, label: 'Van Stock', showBadge: true },
        ];
      case UserRole.SUPERVISOR:
        return [
          { to: '/', icon: LayoutDashboard, label: 'Home' },
          { to: '/jobs', icon: List, label: 'Jobs' },
          { to: '/jobs?tab=approvals', icon: PackageCheck, label: 'Approvals', showBadge: true },
        ];
      case UserRole.ACCOUNTANT:
        return [
          { to: '/', icon: LayoutDashboard, label: 'Home' },
          { to: '/jobs', icon: List, label: 'Jobs' },
          { to: '/invoices', icon: FileText, label: 'Billing', showBadge: true },
        ];
      case UserRole.ADMIN_SERVICE:
        return [
          { to: '/', icon: LayoutDashboard, label: 'Home' },
          { to: '/jobs', icon: List, label: 'Jobs' },
          { to: '/forklifts', icon: Truck, label: 'Fleet' },
        ];
      case UserRole.ADMIN_STORE:
        return [
          { to: '/', icon: LayoutDashboard, label: 'Home' },
          { to: '/jobs', icon: List, label: 'Jobs' },
          { to: '/inventory', icon: Package, label: 'Inventory', showBadge: true },
        ];
      default:
        return [
          { to: '/', icon: LayoutDashboard, label: 'Home' },
          { to: '/jobs', icon: List, label: 'Jobs' },
          { to: '/inventory', icon: Package, label: 'Inventory', showBadge: true },
        ];
    }
  })();

  const isActive = (to: string) => {
    const [path, query] = to.split('?');
    const pathActive = path === '/' ? location.pathname === '/' : location.pathname === path || location.pathname.startsWith(path + '/');
    if (!query) return pathActive;

    const expected = new URLSearchParams(query);
    const current = new URLSearchParams(location.search);
    return pathActive && Array.from(expected.entries()).every(([key, value]) => current.get(key) === value);
  };

  const Badge = ({ count }: { count: number }) => count > 0 ? (
    <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
      {count > 9 ? '9+' : count}
    </span>
  ) : null;

  const NavIcon = ({ to, icon: Icon, label, badgeCount }: { to: string; icon: LucideIcon; label: string; badgeCount?: number }) => (
    <Link to={to} className={`relative flex flex-col items-center gap-0.5 p-2 rounded-xl ${isActive(to) ? 'text-blue-600' : 'text-slate-400'}`}>
      <Icon className="w-6 h-6" />
      <Badge count={badgeCount ?? 0} />
      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  );

  return (
    <nav className="bottom-nav-glass md:hidden fixed bottom-0 left-0 right-0 z-50 px-2 py-2 flex justify-around items-center">
      {navItems.map((item) => (
        <span key={item.label}><NavIcon to={item.to} icon={item.icon} label={item.label} badgeCount={item.showBadge ? unreadCount : 0} /></span>
      ))}
      <button onClick={onOpenDrawer} className="flex flex-col items-center gap-0.5 p-2 rounded-xl text-slate-400">
        <Menu className="w-6 h-6" />
        <span className="text-[10px] font-medium">More</span>
      </button>
    </nav>
  );
};

const MobileDrawer = ({ currentUser, isOpen, onClose, onLogout, navRole }: { currentUser: User; isOpen: boolean; onClose: () => void; onLogout: () => void; navRole: UserRole }) => {
  const { hasPermission } = useDevModeContext();
  const canManageInventory = hasPermission('canManageInventory');
  const canFinalizeInvoices = hasPermission('canFinalizeInvoices');
  const canViewHR = hasPermission('canViewHR');
  const canManageUsers = hasPermission('canManageUsers');
  const canViewOwnProfile = hasPermission('canViewOwnProfile');
  const canViewTeam = canManageUsers || canViewHR || hasPermission('canViewKPI');

  if (!isOpen) return null;

  const DrawerLink = ({ to, icon: Icon, label }: { to: string; icon: LucideIcon; label: string }) => (
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
          {canFinalizeInvoices && <DrawerLink to="/invoices" icon={FileText} label="Billing" />}
          {canViewTeam && <DrawerLink to="/people" icon={Users} label="Team" />}
          <div className="border-t border-slate-700/50 my-3" />
          <DrawerLink to="/my-leave" icon={CalendarDays} label="My Leave" />
          {navRole === UserRole.TECHNICIAN && <DrawerLink to="/my-van-stock" icon={Truck} label="My Van Stock" />}
          {canViewOwnProfile && <DrawerLink to={`/people/employees/${currentUser.user_id}`} icon={UserIcon} label="My Profile" />}
          <div className="border-t border-slate-700/50 my-3" />
          <button onClick={() => { onLogout(); onClose(); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-500/10 transition">
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </nav>
      </aside>
    </div>
  );
};

interface AuthenticatedAppProps {
  currentUser: User;
  onLogout: () => void;
}

export default function AuthenticatedApp({ currentUser, onLogout }: AuthenticatedAppProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('fieldpro-theme') === 'dark';
    }
    return false;
  });

  React.useEffect(() => {
    if (isDarkTheme) {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark');
      localStorage.setItem('fieldpro-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      document.documentElement.classList.remove('dark');
      localStorage.setItem('fieldpro-theme', 'light');
    }
  }, [isDarkTheme]);

  const toggleTheme = () => setIsDarkTheme(prev => !prev);

  return (
    <QueryProvider>
      <NotificationProvider currentUser={currentUser}>
        <DevModeProvider currentUser={currentUser}>
          <AppLayout
          currentUser={currentUser}
          onLogout={onLogout}
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
          mobileDrawerOpen={mobileDrawerOpen}
          setMobileDrawerOpen={setMobileDrawerOpen}
          isDarkTheme={isDarkTheme}
          toggleTheme={toggleTheme}
        />
        </DevModeProvider>
      </NotificationProvider>
    </QueryProvider>
  );
}

function CommandPaletteWrapper({ isOpen, onClose, currentUser }: { isOpen: boolean; onClose: () => void; currentUser: User }) {
  const navigate = useNavigate();
  const handleNavigate = useCallback((path: string) => { navigate(path); }, [navigate]);
  return <CommandPalette isOpen={isOpen} onClose={onClose} currentUser={currentUser} onNavigate={handleNavigate} />;
}

interface AppLayoutProps {
  currentUser: User;
  onLogout: () => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  mobileDrawerOpen: boolean;
  setMobileDrawerOpen: (v: boolean) => void;
  isDarkTheme: boolean;
  toggleTheme: () => void;
}

function AppLayout({ currentUser, onLogout, sidebarCollapsed, setSidebarCollapsed, mobileDrawerOpen, setMobileDrawerOpen, isDarkTheme, toggleTheme }: AppLayoutProps) {
  const devMode = useDevModeContext();
  const navRole = devMode.permissionRole;
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const _canViewDashboard = devMode.hasPermission('canViewDashboard');
  const canViewForklifts = devMode.hasPermission('canViewForklifts');
  const canViewCustomers = devMode.hasPermission('canViewCustomers');
  const canManageInventory = devMode.hasPermission('canManageInventory');
  const canFinalizeInvoices = devMode.hasPermission('canFinalizeInvoices');
  const canCreateJobs = devMode.hasPermission('canCreateJobs');
  const canViewHR = devMode.hasPermission('canViewHR');
  const canManageUsers = devMode.hasPermission('canManageUsers');
  const canViewOwnProfile = devMode.hasPermission('canViewOwnProfile');
  const canViewTeam = canManageUsers || canViewHR || devMode.hasPermission('canViewKPI');

  return (
    <FeatureFlagProvider enabled={devMode.isDev}>
      <Router>
        <style>{sidebarStyles}</style>
        <Toaster position="top-center" richColors toastOptions={{ duration: 4000, className: 'text-sm !mt-2 sm:!mt-2' }} />
        <CommandPaletteWrapper isOpen={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} currentUser={currentUser} />
        <div className="min-h-screen bg-theme-bg flex theme-transition">
          <Sidebar currentUser={currentUser} onLogout={onLogout} isCollapsed={sidebarCollapsed} setIsCollapsed={setSidebarCollapsed} navRole={navRole} />
          <main
            className={`flex-1 transition-all duration-300 ${sidebarCollapsed ? 'md:ml-[72px]' : 'md:ml-60'} p-4 md:p-6 lg:p-8 pb-20 md:pb-8 ${devMode.isDevModeActive ? 'pt-14' : ''}`}
            style={{
              background: 'radial-gradient(circle at top right, rgba(59, 130, 246, 0.08), transparent 24%), radial-gradient(circle at top left, rgba(249, 115, 22, 0.07), transparent 22%)',
            }}
          >
            <TopHeader currentUser={currentUser} isDark={isDarkTheme} onToggleTheme={toggleTheme} devModeActive={devMode.isDevModeActive} onOpenSearch={() => setCommandPaletteOpen(true)} />
            <Suspense fallback={<PageLoader />}>
              <div className="animate-page-enter mx-auto max-w-[1560px]">
              <Routes>
                <Route path="/" element={<PrototypeDashboards currentUser={currentUser} />} />
                <Route path="/jobs" element={<JobsTabs currentUser={currentUser} />} />
                <Route path="/jobs/new" element={canCreateJobs ? <CreateJob currentUser={currentUser} /> : <Navigate to="/" />} />
                <Route path="/jobs/:id" element={<JobDetail currentUser={currentUser} />} />
                <Route path="/forklifts" element={canViewForklifts ? <ForkliftsTabs currentUser={currentUser} /> : <Navigate to="/" />} />
                <Route path="/forklifts/:id" element={canViewForklifts ? <ForkliftProfile currentUser={currentUser} /> : <Navigate to="/" />} />
                <Route path="/customers" element={canViewCustomers ? <Customers /> : <Navigate to="/" />} />
                <Route path="/customers/:id" element={canViewCustomers ? <CustomerProfile currentUser={currentUser} /> : <Navigate to="/" />} />
                <Route path="/inventory" element={canManageInventory ? <InventoryPage currentUser={currentUser} /> : <Navigate to="/" />} />
                <Route path="/invoices" element={canFinalizeInvoices ? <Invoices currentUser={currentUser} /> : <Navigate to="/" />} />
                <Route path="/people" element={canViewTeam ? <People currentUser={currentUser} /> : <Navigate to="/" />} />
                <Route path="/people/employees/:id" element={(canViewHR || canViewOwnProfile) ? <EmployeeProfile currentUser={currentUser} /> : <Navigate to="/" />} />
                <Route path="/my-leave" element={<MyLeaveRequests currentUser={currentUser} />} />
                <Route path="/store" element={<Navigate to="/inventory?tab=replenishments" replace />} />
                <Route path="/my-van-stock" element={[UserRole.TECHNICIAN, UserRole.ADMIN, UserRole.ADMIN_SERVICE, UserRole.ADMIN_STORE, UserRole.SUPERVISOR].includes(navRole) ? <MyVanStock currentUser={currentUser} /> : <Navigate to="/" />} />
                {/* Legacy redirects */}
                <Route path="/service-records" element={<Navigate to="/jobs?tab=history" replace />} />
                <Route path="/van-stock" element={<Navigate to="/inventory?tab=vanstock" replace />} />
                <Route path="/confirmations" element={<Navigate to="/inventory?tab=confirmations" replace />} />
                <Route path="/hourmeter-review" element={<Navigate to="/forklifts?tab=hourmeter" replace />} />
                <Route path="/autocount-export" element={<Navigate to="/invoices?tab=autocount" replace />} />
                <Route path="/reports" element={<Navigate to="/people?tab=performance" replace />} />
                <Route path="/users" element={<Navigate to="/people?tab=users" replace />} />
                <Route path="/hr" element={<Navigate to="/people?tab=overview" replace />} />
                <Route path="/hr/employees" element={<Navigate to="/people?tab=employees" replace />} />
                <Route path="/hr/employees/:id" element={(canViewHR || canViewOwnProfile) ? <EmployeeProfile currentUser={currentUser} /> : <Navigate to="/" />} />
                <Route path="/technician-kpi" element={<Navigate to="/people?tab=performance" replace />} />
                <Route path="/service-intervals" element={<Navigate to="/forklifts?tab=intervals" replace />} />
                <Route path="/service-due" element={<Navigate to="/forklifts?tab=service-due" replace />} />
                <Route path="/my-profile" element={<Navigate to={`/people/employees/${currentUser.user_id}`} replace />} />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
              </div>
            </Suspense>
          </main>
          <FloatingActionButton currentUser={currentUser} />
          <MobileNav currentUser={currentUser} onOpenDrawer={() => setMobileDrawerOpen(true)} navRole={navRole} />
          <MobileDrawer currentUser={currentUser} isOpen={mobileDrawerOpen} onClose={() => setMobileDrawerOpen(false)} onLogout={onLogout} navRole={navRole} />
          {devMode.isDevModeActive && devMode.impersonatedRole && (
            <DevBanner impersonatedRole={devMode.impersonatedRole} actualRole={currentUser.role} devModeType={devMode.devModeType} onExit={devMode.deactivateDevMode} permissionRole={devMode.permissionRole} />
          )}
        </div>
      </Router>
    </FeatureFlagProvider>
  );
}
