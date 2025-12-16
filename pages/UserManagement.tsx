import React, { useEffect, useState } from 'react';
import { User, UserRole } from '../types_with_invoice_tracking';
import { SupabaseDb as MockDb } from '../services/supabaseService';
import { Plus, Edit2, Search, CheckCircle, XCircle, Shield, Wrench, FileText, User as UserIcon, Lock, X, Users } from 'lucide-react';

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  // Form State
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
    const data = await MockDb.getUsers();
    setUsers(data);
    setLoading(false);
  };

  const handleOpenModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        name: user.name,
        email: user.email,
        role: user.role,
        password: '', // Leave blank unless resetting
        is_active: user.is_active
      });
    } else {
      setEditingUser(null);
      setFormData({
        name: '',
        email: '',
        role: UserRole.TECHNICIAN,
        password: '',
        is_active: true
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        // Update
        await MockDb.updateUser(editingUser.user_id, {
          name: formData.name,
          role: formData.role,
          is_active: formData.is_active,
          ...(formData.password ? { password: formData.password } : {})
        });
      } else {
        // Create
        if (!formData.password) return alert("Password is required for new users");
        await MockDb.createUser({
          name: formData.name,
          email: formData.email,
          role: formData.role,
          password: formData.password,
          is_active: formData.is_active
        });
      }
      setIsModalOpen(false);
      loadUsers();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleToggleStatus = async (user: User) => {
    if (!confirm(`Are you sure you want to ${user.is_active ? 'deactivate' : 'activate'} this user?`)) return;
    await MockDb.updateUser(user.user_id, { is_active: !user.is_active });
    loadUsers();
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><Shield className="w-3 h-3" /> Admin</span>;
      case UserRole.SUPERVISOR:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800"><Users className="w-3 h-3" /> Supervisor</span>;
      case UserRole.TECHNICIAN:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"><Wrench className="w-3 h-3" /> Technician</span>;
      case UserRole.ACCOUNTANT:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800"><FileText className="w-3 h-3" /> Accountant</span>;
    }
  };

  // Input styles
  const inputClass = "w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900";

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
          <p className="text-slate-500 text-sm">Manage team members and access roles.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add User
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                 <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500">Loading users...</td></tr>
              ) : (
                users.map(user => (
                  <tr key={user.user_id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
                          <UserIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-medium text-slate-900">{user.name}</div>
                          <div className="text-sm text-slate-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {getRoleBadge(user.role)}
                    </td>
                    <td className="px-6 py-4">
                      {user.is_active ? (
                        <span className="inline-flex items-center gap-1 text-green-600 text-sm font-medium"><CheckCircle className="w-3 h-3" /> Active</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-400 text-sm font-medium"><XCircle className="w-3 h-3" /> Inactive</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                       <button 
                          onClick={() => handleOpenModal(user)}
                          className="text-slate-400 hover:text-blue-600 p-1 rounded"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleToggleStatus(user)}
                          className={`${user.is_active ? 'text-slate-400 hover:text-red-600' : 'text-slate-400 hover:text-green-600'} p-1 rounded`}
                          title={user.is_active ? "Deactivate" : "Activate"}
                        >
                          {user.is_active ? <XCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                        </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-slate-800">{editingUser ? 'Edit User' : 'Add New User'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input 
                  type="text" 
                  className={inputClass}
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                <input 
                  type="email" 
                  className={`${inputClass} ${editingUser ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                  required
                  disabled={!!editingUser}
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                <div className="relative">
                  <select 
                    className={`${inputClass} appearance-none`}
                    value={formData.role}
                    onChange={e => setFormData({...formData, role: e.target.value as UserRole})}
                  >
                    <option value={UserRole.ADMIN}>Admin</option>
                    <option value={UserRole.SUPERVISOR}>Supervisor</option>
                    <option value={UserRole.TECHNICIAN}>Technician</option>
                    <option value={UserRole.ACCOUNTANT}>Accountant</option>
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-2">
                   {editingUser ? 'Reset Password (Optional)' : 'Password'}
                   <Lock className="w-3 h-3 text-slate-400" />
                </label>
                <input 
                  type="password" 
                  className={inputClass}
                  placeholder={editingUser ? "Leave blank to keep current" : "Enter password"}
                  required={!editingUser}
                  value={formData.password}
                  onChange={e => setFormData({...formData, password: e.target.value})}
                />
              </div>

              {editingUser && (
                 <div className="flex items-center gap-2 pt-2">
                    <input 
                        type="checkbox"
                        id="isActive"
                        checked={formData.is_active}
                        onChange={e => setFormData({...formData, is_active: e.target.checked})}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <label htmlFor="isActive" className="text-sm text-slate-700 font-medium">Active Account</label>
                 </div>
              )}

              <div className="pt-6 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;