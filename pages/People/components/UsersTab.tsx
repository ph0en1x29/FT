import {
CheckCircle,
Edit2,
FileText,
Loader2,
Plus,
Search,
Shield,
UserCheck,
Users,
UserX,
Wrench,
X,
XCircle
} from 'lucide-react';
import React,{ useEffect,useMemo,useState } from 'react';
import { SupabaseDb as MockDb } from '../../../services/supabaseService';
import { showToast } from '../../../services/toastService';
import { User,UserRole } from '../../../types';

interface UsersTabProps {
  currentUser: User;
}

const UsersTab: React.FC<UsersTabProps> = ({ currentUser }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; user: User | null; action: 'activate' | 'deactivate' }>({ isOpen: false, user: null, action: 'deactivate' });
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: UserRole.TECHNICIAN,
    password: '',
    is_active: true
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await MockDb.getUsers();
      setUsers(data);
    } catch (error) {
      console.error('Error loading users:', error);
      showToast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => users.filter(user => 
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.role.toLowerCase().includes(searchQuery.toLowerCase())
  ), [users, searchQuery]);

  const handleOpenModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({ name: user.name, email: user.email, role: user.role, password: '', is_active: user.is_active });
    } else {
      setEditingUser(null);
      setFormData({ name: '', email: '', role: UserRole.TECHNICIAN, password: '', is_active: true });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await MockDb.updateUser(editingUser.user_id, {
          name: formData.name,
          role: formData.role,
          is_active: formData.is_active,
          ...(formData.password ? { password: formData.password } : {})
        });
        showToast.success('User updated successfully');
      } else {
        if (!formData.password) {
          showToast.error('Password required');
          return;
        }
        await MockDb.createUser({
          name: formData.name,
          email: formData.email,
          role: formData.role,
          password: formData.password,
          is_active: formData.is_active
        });
        showToast.success('User created successfully');
      }
      setIsModalOpen(false);
      loadUsers();
    } catch (error) {
      showToast.error('Failed to save user', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const handleConfirmToggle = async () => {
    if (!confirmModal.user) return;
    try {
      await MockDb.updateUser(confirmModal.user.user_id, { is_active: !confirmModal.user.is_active });
      showToast.success(`User ${confirmModal.action}d successfully`);
      loadUsers();
    } catch (error) {
      console.error('Error updating user status:', error);
      showToast.error('Failed to update user status');
    } finally {
      setConfirmModal({ isOpen: false, user: null, action: 'deactivate' });
    }
  };

  const getRoleBadge = (role: UserRole) => {
    const badges = {
      [UserRole.ADMIN]: { icon: Shield, class: 'bg-red-100 text-red-800' },
      [UserRole.SUPERVISOR]: { icon: Users, class: 'bg-amber-100 text-amber-800' },
      [UserRole.TECHNICIAN]: { icon: Wrench, class: 'bg-blue-100 text-blue-800' },
      [UserRole.ACCOUNTANT]: { icon: FileText, class: 'bg-purple-100 text-purple-800' },
    };
    const badge = badges[role];
    const Icon = badge.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.class}`}>
        <Icon className="w-3 h-3" /> {role.charAt(0).toUpperCase() + role.slice(1)}
      </span>
    );
  };

  const inputClass = "w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900";

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Actions Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search users..."
            className="w-full pl-10 pr-4 py-2.5 bg-theme-surface border border-theme rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-theme"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button onClick={() => handleOpenModal()} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium">
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      {/* Users Table */}
      <div className="card-theme rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-theme-surface-2 border-b border-theme">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-theme-muted uppercase">User</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-theme-muted uppercase">Role</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-theme-muted uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-theme-muted uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredUsers.map(user => (
              <tr key={user.user_id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{user.name}</p>
                      <p className="text-sm text-slate-500">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">{getRoleBadge(user.role)}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                    {user.is_active ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleOpenModal(user)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded" title="Edit">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setConfirmModal({ isOpen: true, user, action: user.is_active ? 'deactivate' : 'activate' })}
                    className={`p-1.5 rounded ml-1 ${user.is_active ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}`}
                    title={user.is_active ? 'Deactivate' : 'Activate'}
                  >
                    {user.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">{editingUser ? 'Edit User' : 'Add New User'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Name *</label>
                <input type="text" className={inputClass} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email *</label>
                <input type="email" className={inputClass} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} disabled={!!editingUser} required />
                {editingUser && <p className="text-xs text-slate-400 mt-1">Email cannot be changed</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Role *</label>
                <select className={inputClass} value={formData.role} onChange={e => setFormData({...formData, role: e.target.value as UserRole})}>
                  {Object.values(UserRole).map(role => <option key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  {editingUser ? 'New Password (leave blank to keep)' : 'Password *'}
                </label>
                <input type="password" className={inputClass} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required={!editingUser} />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">{editingUser ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Toggle Modal */}
      {confirmModal.isOpen && confirmModal.user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className={`px-6 py-4 border-b ${confirmModal.action === 'deactivate' ? 'bg-red-50' : 'bg-green-50'}`}>
              <h3 className={`font-bold text-lg ${confirmModal.action === 'deactivate' ? 'text-red-800' : 'text-green-800'}`}>
                {confirmModal.action === 'deactivate' ? 'Deactivate User?' : 'Activate User?'}
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-slate-700">
                Are you sure you want to {confirmModal.action} <strong>{confirmModal.user.name}</strong>?
              </p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmModal({ isOpen: false, user: null, action: 'deactivate' })} className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium">Cancel</button>
                <button 
                  onClick={handleConfirmToggle} 
                  className={`flex-1 py-2.5 rounded-lg font-medium text-white ${confirmModal.action === 'deactivate' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
                >
                  {confirmModal.action === 'deactivate' ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersTab;
