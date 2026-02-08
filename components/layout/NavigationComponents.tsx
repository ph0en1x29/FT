/**
 * Navigation sub-components for AuthenticatedApp layout.
 * Extracted to keep AuthenticatedApp under 300 lines.
 */
import {
  Building2,
  CalendarDays,
  FileText,
  LayoutDashboard,
  List,
  Menu,
  Package,
  Truck,
  Users,
  X,
  LogOut,
  ChevronLeft,
  Zap,
  UserIcon,
  type LucideIcon,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useDevModeContext } from '../../contexts/DevModeContext';
import { User, UserRole } from '../../types';

// Re-export UserIcon as it's needed for profile links
const UserIconComponent = UserIcon;

export interface SidebarProps {
  currentUser: User;
  onLogout: () => void;
  isCollapsed: boolean;
  setIsCollapsed: (v: boolean) => void;
  navRole: UserRole;
}

export const Sidebar = ({ currentUser, onLogout, isCollapsed, setIsCollapsed, navRole }: SidebarProps) => {
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
              <UserIconComponent className="nav-icon w-5 h-5 flex-shrink-0" />
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

export const MobileNav = ({ currentUser: _currentUser, onOpenDrawer, navRole: _navRole }: { currentUser: User; onOpenDrawer: () => void; navRole: UserRole }) => {
  const location = useLocation();
  const { hasPermission } = useDevModeContext();
  const isActive = (path: string) => path === '/' ? location.pathname === '/' : location.pathname === path || location.pathname.startsWith(path + '/');

  const canViewDashboard = hasPermission('canViewDashboard');
  const canViewForklifts = hasPermission('canViewForklifts');
  const canViewCustomers = hasPermission('canViewCustomers');

  const NavIcon = ({ to, icon: Icon, label }: { to: string; icon: LucideIcon; label: string }) => (
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

export const MobileDrawer = ({ currentUser, isOpen, onClose, onLogout, navRole }: { currentUser: User; isOpen: boolean; onClose: () => void; onLogout: () => void; navRole: UserRole }) => {
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
          {canViewOwnProfile && <DrawerLink to={`/people/employees/${currentUser.user_id}`} icon={UserIconComponent} label="My Profile" />}
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
