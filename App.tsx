import React, { useState } from 'react';
import { HashRouter as Router, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { User, UserRole } from './types';
import Dashboard from './pages/Dashboard';
import JobBoard from './pages/JobBoard';
import JobDetail from './pages/JobDetail';
import CreateJob from './pages/CreateJob';
import LoginPage from './pages/LoginPage';
import UserManagement from './pages/UserManagement';
import { SupabaseDb as MockDb } from './services/supabaseService';
import { LayoutDashboard, List, Package, LogOut, Users } from 'lucide-react';



const Sidebar = ({ role, onLogout }: { role: UserRole, onLogout: () => void }) => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800';

  return (
    <div className="w-64 bg-slate-900 text-white h-screen fixed left-0 top-0 flex flex-col hidden md:flex">
      <div className="p-6">
        <h1 className="text-2xl font-bold tracking-tight">FieldPro</h1>
        <p className="text-xs text-slate-500 uppercase mt-1 tracking-wider">{role} View</p>
      </div>
      
      <nav className="flex-1 px-4 space-y-2">
        {(role === UserRole.ADMIN || role === UserRole.ACCOUNTANT) && (
          <Link to="/" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${isActive('/')}`}>
            <LayoutDashboard className="w-5 h-5" /> Dashboard
          </Link>
        )}
        <Link to="/jobs" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${isActive('/jobs')}`}>
          <List className="w-5 h-5" /> Jobs
        </Link>
        {(role === UserRole.ADMIN || role === UserRole.TECHNICIAN) && (
          <Link to="/inventory" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${isActive('/inventory')}`}>
            <Package className="w-5 h-5" /> Inventory
          </Link>
        )}
        {role === UserRole.ADMIN && (
          <Link to="/users" className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${isActive('/users')}`}>
            <Users className="w-5 h-5" /> Users
          </Link>
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
       <Link to="/inventory" className="p-2 text-slate-600 hover:text-blue-600"><Package className="w-6 h-6" /></Link>
       {role === UserRole.ADMIN && (
         <Link to="/users" className="p-2 text-slate-600 hover:text-blue-600"><Users className="w-6 h-6" /></Link>
       )}
    </div>
  );
};

const InventoryPage = () => {
    const [parts, setParts] = useState<any[]>([]);
    React.useEffect(() => { MockDb.getParts().then(setParts); }, []);
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-slate-900">Inventory</h1>
            <div className="bg-white rounded-xl shadow overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 text-sm">
                        <tr>
                            <th className="p-4">Part Name</th>
                            <th className="p-4">SKU</th>
                            <th className="p-4">Stock</th>
                            <th className="p-4">Price</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {parts.map(p => (
                            <tr key={p.part_id}>
                                <td className="p-4 font-medium">{p.part_name}</td>
                                <td className="p-4 text-slate-500 text-sm">{p.part_code}</td>
                                <td className={`p-4 font-bold ${p.stock_quantity < 10 ? 'text-red-500' : 'text-green-600'}`}>{p.stock_quantity}</td>
                                <td className="p-4">${p.sell_price}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Simple logout handler
  const handleLogout = () => {
    setCurrentUser(null);
  };

  // If not logged in, show Login Page
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
                 : <Dashboard role={currentUser.role} />
            } />
            <Route path="/jobs" element={<JobBoard currentUser={currentUser} />} />
            <Route path="/jobs/new" element={<CreateJob currentUser={currentUser} />} />
            <Route path="/jobs/:id" element={<JobDetail currentUserRole={currentUser.role} currentUserId={currentUser.user_id} currentUserName={currentUser.name} />} />
            <Route path="/inventory" element={<InventoryPage />} />
            
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