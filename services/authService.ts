import { supabase } from './supabaseClient';
import { User } from '../types';

// =====================
// AUTHENTICATION OPERATIONS
// =====================

const fetchUserByAuthId = async (authId: string): Promise<User | null> => {
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('auth_id', authId)
    .maybeSingle();

  if (userError) throw new Error(userError.message);
  if (!userData) return null;
  if (!userData.is_active) throw new Error('Account is deactivated');

  return userData as User;
};

export const AuthService = {
  login: async (email: string, password: string): Promise<User> => {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) throw new Error(authError.message);
    if (!authData.user) throw new Error('Login failed');

    const userData = await fetchUserByAuthId(authData.user.id);
    if (!userData) throw new Error('User profile not found');

    return userData;
  },

  getUserByAuthId: fetchUserByAuthId,

  logout: async (): Promise<void> => {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  },

  getCurrentSession: async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw new Error(error.message);
    return session;
  },

  resetPassword: async (email: string): Promise<void> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw new Error(error.message);
  },

  updatePassword: async (newPassword: string): Promise<void> => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });
    if (error) throw new Error(error.message);
  },
};
