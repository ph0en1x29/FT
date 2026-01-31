/**
 * Authentication Service
 * 
 * Handles user authentication and session management
 */

import { supabase } from './supabaseClient';
import type { User } from '../types';

/**
 * Fetch user by auth ID from the users table
 */
export const fetchUserByAuthId = async (authId: string): Promise<User | null> => {
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

/**
 * Login with email and password
 */
export const login = async (email: string, password: string): Promise<User> => {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) throw new Error(authError.message);
  if (!authData.user) throw new Error('Login failed');

  const userData = await fetchUserByAuthId(authData.user.id);
  if (!userData) throw new Error('User profile not found');

  return userData;
};

/**
 * Alias for fetchUserByAuthId
 */
export const getUserByAuthId = fetchUserByAuthId;

/**
 * Get the current session
 */
export const getSession = async () => {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  return session;
};

/**
 * Sign out the current user
 */
export const logout = async (): Promise<void> => {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
};

/**
 * Listen for auth state changes
 */
export const onAuthStateChange = (callback: (event: string, session: { user: { id: string; email?: string } } | null) => void) => {
  return supabase.auth.onAuthStateChange(callback);
};
